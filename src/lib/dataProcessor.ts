import { supabase } from './supabase';
import { detectColumnMappingEnhanced, saveColumnMappingHistory } from './columnDetection';
import type { ColumnMapping } from './columnDetection';
import { parseDate, parseNumber, cleanString, parseDateFromMonthYear } from './fileParser';
import { extractTextFromPDF, cleanPDFText } from './pdfParser';
import { extractStructuredData, type AITrainingConfiguration } from './openai';
import type { Database } from './database.types';
import {
  analyzeProductDuplicates,
  checkExistingMappings,
  createProductMapping,
  addToReviewQueue,
  logMergeDecision,
  normalizeProductName
} from './productDeduplicationService';
import { PackageType, BOTTLES_PER_PACKAGE } from './fobPricingService';
import { classifyUnclassifiedAccounts } from './premiseClassificationService';
import { processDepletionForInventory } from './inventoryService';

type SalesDataInsert = Database['public']['Tables']['sales_data']['Insert'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];

interface ProcessOptions {
  organizationId: string;
  userId: string;
  filename: string;
  fileSize: number;
  rows?: any[];
  distributorId: string;
  pdfFile?: File;
  manualMapping?: ColumnMapping;
  defaultPeriod?: string | null;
  unitType?: 'cases' | 'bottles';
  parsingWarnings?: any;
  originalFile?: File;
}

async function storeFileInStorage(
  file: File,
  organizationId: string,
  uploadId: string,
  filename: string
): Promise<string | null> {
  try {
    const filePath = `${organizationId}/${uploadId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads-storage')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to store file in storage:', uploadError);
      return null;
    }

    return filePath;
  } catch (error) {
    console.error('Error storing file:', error);
    return null;
  }
}

export async function processAndStoreSalesData(options: ProcessOptions) {
  const { organizationId, userId, filename, fileSize, rows, distributorId, pdfFile, manualMapping, defaultPeriod, unitType = 'cases', parsingWarnings: inputParsingWarnings, originalFile } = options;

  const { data: distributor, error: distributorError } = await supabase
    .from('distributors')
    .select('name, state')
    .eq('id', distributorId)
    .single() as any;

  if (distributorError || !distributor) {
    throw new Error('Invalid distributor selected');
  }

  const distributorName = distributor.name;
  let distributorState = distributor.state;

  // Check for organization-specific state override
  const { data: orgDistributor } = await supabase
    .from('organization_distributors')
    .select('state')
    .eq('organization_id', organizationId)
    .eq('distributor_id', distributorId)
    .maybeSingle() as any;

  if (orgDistributor?.state) {
    distributorState = orgDistributor.state;
  }

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single() as any;

  if (organizationError || !organization) {
    throw new Error('Invalid organization');
  }

  const organizationName = organization.name;

  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      filename,
      file_size: fileSize,
      status: 'processing',
      distributor_id: distributorId,
      unit_type: unitType,
    })
    .select()
    .single();

  if (uploadError || !upload) {
    throw new Error('Failed to create upload record');
  }

  const fileToStore = originalFile || pdfFile;
  if (fileToStore) {
    const filePath = await storeFileInStorage(
      fileToStore,
      organizationId,
      upload.id,
      filename
    );

    if (filePath) {
      await supabase
        .from('uploads')
        .update({
          file_path: filePath,
          is_reprocessable: true,
        })
        .eq('id', upload.id);
    }
  }

  try {
    let salesRecords: any[] = [];
    let columnMapping: ColumnMapping = {};
    let confidence = 0;
    let method = 'unknown';
    let aiConfigs: any[] = [];
    let extractionResult: any = null;
    let detectionResult: any = null;
    const parsingWarnings: any = inputParsingWarnings || null;

    if (pdfFile) {
      console.log(`📄 Processing PDF file: ${filename}...`);

      // Fetch the active AI training configuration for this distributor (there's only one)
      const { data: aiConfigData } = await supabase
        .from('ai_training_configurations')
        .select('*')
        .eq('distributor_id', distributorId)
        .eq('is_active', true)
        .maybeSingle();

      const aiConfig = aiConfigData;
      aiConfigs = aiConfig ? [aiConfig] : [];

      const pdfResult = await extractTextFromPDF(pdfFile);
      const cleanedText = cleanPDFText(pdfResult.text);

      console.log(`📄 Extracted ${pdfResult.pages} pages from PDF`);
      console.log(`🤖 AI Training Config: ${aiConfig ? aiConfig.configuration_name : 'none (generic extraction)'}`);

      const aiTrainingConfig: AITrainingConfiguration | undefined = aiConfig ? {
        field_mappings: aiConfig.field_mappings as Record<string, any>,
        parsing_instructions: aiConfig.parsing_instructions,
        orientation: aiConfig.orientation,
      } : undefined;

      extractionResult = await extractStructuredData(
        cleanedText,
        organizationId,
        'pdf',
        aiTrainingConfig
      );

      console.log(`🤖 AI extracted ${extractionResult.data.length} items with ${(extractionResult.confidence_score * 100).toFixed(0)}% confidence`);

      if (extractionResult.data.length > 0) {
        console.log('📊 Sample of extracted data (first 3 items):', JSON.stringify(extractionResult.data.slice(0, 3), null, 2));
      }

      const transformedRecords = extractionResult.data.map((item) => {
        const itemRevenue = item.revenue || item.amount ? parseNumber(item.revenue || item.amount) : null;
        const itemDate = item.date ? parseDate(item.date) : null;

        return {
          organization_id: organizationId,
          upload_id: upload.id,
          distributor: item.distributor || distributorName,
          account: cleanString(item.account_name),
          product: cleanString(item.product_name),
          quantity: parseNumber(item.quantity),
          date: itemDate,
          revenue: itemRevenue,
          has_revenue_data: itemRevenue !== null,
          default_period: !itemDate && defaultPeriod ? defaultPeriod : null,
          representative: cleanString(item.representative),
          account_state: distributorState,
          _original: item,
        };
      });

      const recordsBeforeFilter = transformedRecords.length;
      salesRecords = transformedRecords.filter(record =>
        record.account && record.product
      );
      const recordsAfterFilter = salesRecords.length;
      const filteredOutCount = recordsBeforeFilter - recordsAfterFilter;

      if (filteredOutCount > 0) {
        console.warn(`⚠️ Filtered out ${filteredOutCount} of ${recordsBeforeFilter} records due to missing required data`);

        const missingAccounts = transformedRecords.filter(r => !r.account).length;
        const missingProducts = transformedRecords.filter(r => !r.product).length;
        const missingRevenue = transformedRecords.filter(r => r.revenue === null || r.revenue === undefined).length;

        if (missingAccounts > 0) {
          console.warn(`   - ${missingAccounts} records missing account names`);
        }
        if (missingProducts > 0) {
          console.warn(`   - ${missingProducts} records missing product names`);
        }
        if (missingRevenue > 0) {
          console.log(`   ℹ️ ${missingRevenue} records without revenue (optional for depletion reports)`);
        }

        if (recordsAfterFilter === 0 && recordsBeforeFilter > 0) {
          console.warn('❌ ALL records were filtered out. Showing sample of filtered data:');
          console.warn(JSON.stringify(transformedRecords.slice(0, 2).map(r => ({
            account: r.account || '(empty)',
            product: r.product || '(empty)',
            revenue: r.revenue ?? '(empty)',
            original_account: r._original.account_name,
            original_product: r._original.product_name,
          })), null, 2));
        }
      } else {
        console.log(`✅ All ${recordsAfterFilter} records passed validation`);
      }

      confidence = extractionResult.confidence_score;
      method = aiConfig ? 'ai_with_training' : 'ai_generic';

      if (aiConfig) {
        const wasSuccessful = salesRecords.length > 0;
        const now = new Date().toISOString();

        const updatedStats = {
          ...(aiConfig.extraction_stats as any || {}),
          total_extractions: ((aiConfig.extraction_stats as any)?.total_extractions || 0) + 1,
          successful_extractions: wasSuccessful ? ((aiConfig.extraction_stats as any)?.successful_extractions || 0) + 1 : ((aiConfig.extraction_stats as any)?.successful_extractions || 0),
          last_used: now,
        };

        await supabase
          .from('ai_training_configurations')
          .update({
            extraction_stats: updatedStats,
            success_count: wasSuccessful ? (aiConfig.success_count || 0) + 1 : aiConfig.success_count || 0,
            failure_count: !wasSuccessful ? (aiConfig.failure_count || 0) + 1 : aiConfig.failure_count || 0,
            last_successful_use: wasSuccessful ? now : aiConfig.last_successful_use,
          })
          .eq('id', aiConfig.id);

        console.log(`📊 Updated AI config stats: ${wasSuccessful ? 'SUCCESS' : 'FAILURE'} - Total successes: ${wasSuccessful ? (aiConfig.success_count || 0) + 1 : aiConfig.success_count || 0}`);
      }

      await supabase
        .from('uploads')
        .update({
          column_mapping: {
            _confidence: confidence,
            _method: method,
            _source: 'pdf',
            _pages: pdfResult.pages,
            _ai_config_used: aiConfig?.configuration_name || 'none',
          } as any
        })
        .eq('id', upload.id);

    } else if (rows) {
      console.log(`🔍 Starting column detection for ${filename}...`);

      // Fetch the active AI training configuration for this distributor (there's only one)
      const { data: aiConfigData } = await supabase
        .from('ai_training_configurations')
        .select('*')
        .eq('distributor_id', distributorId)
        .eq('is_active', true)
        .maybeSingle();

      const aiConfig = aiConfigData;
      aiConfigs = aiConfig ? [aiConfig] : [];

      console.log(`🤖 AI Training Config for Excel/CSV: ${aiConfig ? aiConfig.configuration_name : 'none (generic detection)'}`);

      const aiTrainingConfig: AITrainingConfiguration | undefined = aiConfig ? {
        field_mappings: aiConfig.field_mappings as Record<string, any>,
        parsing_instructions: aiConfig.parsing_instructions,
        orientation: aiConfig.orientation,
      } : undefined;

      if (manualMapping) {
        columnMapping = manualMapping;
        confidence = 1.0;
        method = 'manual';
        console.log('📋 Using manual column mapping');

        detectionResult = {
          mapping: manualMapping,
          confidence: 1.0,
          method: 'manual',
          details: {}
        };
      } else {
        detectionResult = await detectColumnMappingEnhanced(
          rows,
          organizationId,
          distributorId,
          filename,
          aiTrainingConfig
        );

        columnMapping = detectionResult.mapping;
        confidence = detectionResult.confidence;
        method = detectionResult.method;
      }

      console.log('📋 Detected mapping:', columnMapping);
      console.log('📊 Detection confidence:', confidence);
      console.log('🔧 Detection method:', method);

      if (confidence < 0.3) {
        console.warn('⚠️ Low confidence mapping detected');
      }

      console.log({ detectionResult })

      await supabase
        .from('uploads')
        .update({
          column_mapping: {
            ...columnMapping,
            _confidence: confidence,
            _method: method,
            _details: detectionResult?.details || {},
            _ai_config_used: aiConfig?.configuration_name || 'none',
            _parsing_warnings: parsingWarnings,
          } as any
        })
        .eq('id', upload.id);

      // Restructure rows to use detected column names as keys
      // Original rows have generic keys (__EMPTY, __EMPTY_1), we need to map them to actual column names
      const detectedColumns = detectionResult?.columns || Object.keys(rows[0] || {});
      console.log('📋 Detected column names:', detectedColumns);
      
      const restructuredRows = rows.map(row => {
        const restructured: Record<string, any> = {};
        const originalKeys = Object.keys(row);
        
        detectedColumns.forEach((colName, index) => {
          if (index < originalKeys.length) {
            const originalKey = originalKeys[index];
            restructured[colName] = row[originalKey];
          }
        });
        
        return restructured;
      });

      console.log(`📝 Transforming ${restructuredRows.length} rows...`);
      const transformResults = restructuredRows.map((row, index) => ({
        record: transformRow(row, columnMapping, organizationId, upload.id, distributorName, organizationName, distributorState, defaultPeriod, unitType),
        rowIndex: index
      }));

      console.log({ transformResults })
      

      salesRecords = transformResults
        .filter(r => r.record !== null)
        .map(r => r.record);

      const failedRows = transformResults.filter(r => r.record === null);

      if (failedRows.length > 0) {
        console.warn(`⚠️ ${failedRows.length} rows filtered out`);

        // Count records without revenue (informational only - not a filter reason)
        const missingRevenueCount = rows.filter((row, idx) => {
          const revenueCol = columnMapping.revenue || columnMapping.amount;
          const revenue = revenueCol ? parseNumber(row[revenueCol]) : null;
          return revenue === null || revenue === undefined;
        }).length;

        if (missingRevenueCount > 0) {
          console.log(`   ℹ️ ${missingRevenueCount} rows without revenue (optional for depletion reports)`);
        }

        if (failedRows.length < 10) {
          console.warn('Filtered row indices:', failedRows.map(r => r.rowIndex));
        }
      }

      console.log(`✅ Successfully transformed ${salesRecords.length} rows`);

      if (rows.length > salesRecords.length) {
        const filteredCount = rows.length - salesRecords.length;
        console.log(`📊 Upload summary: ${salesRecords.length} records processed, ${filteredCount} records skipped`);
      }
    } else {
      throw new Error('Either rows or pdfFile must be provided');
    }

    if (salesRecords.length === 0) {
      let errorMessage = 'No valid data found.';

      if (pdfFile) {
        const aiConfigName = aiConfigs && aiConfigs.length > 0 ? aiConfigs[0].configuration_name : null;

        if (extractionResult.data.length === 0) {
          errorMessage = aiConfigName
            ? `❌ AI extraction failed using "${aiConfigName}".\n\n` +
              `The AI training instructions may not match this file's format.\n\n` +
              `💡 TO FIX: Go to AI Training page → Test "${aiConfigName}" → Update instructions → Test again`
            : `❌ No AI training exists for "${distributorName}".\n\n` +
              `💡 TO FIX: Go to AI Training page → Create configuration for "${distributorName}" → Test → Activate`;
        } else {
          const transformedCount = extractionResult.data.length;
          const missingAccounts = extractionResult.data.filter(item => !cleanString(item.account_name)).length;
          const missingProducts = extractionResult.data.filter(item => !cleanString(item.product_name)).length;

          const issues = [];
          if (missingAccounts > 0) issues.push(`${missingAccounts} missing account names`);
          if (missingProducts > 0) issues.push(`${missingProducts} missing product names`);

          const missingRevenueCount = extractionResult.data.filter(item => {
            const itemRevenue = item.revenue || item.amount ? parseNumber(item.revenue || item.amount) : null;
            return itemRevenue === null || itemRevenue === undefined;
          }).length;

          // Revenue is optional - don't include in required field errors
          if (missingRevenueCount > 0 && missingRevenueCount < transformedCount) {
            console.log(`   ℹ️ ${missingRevenueCount} records without revenue (optional for depletion reports)`);
          }

          errorMessage = aiConfigName
            ? `⚠️ Extracted ${transformedCount} records but all missing required fields: ${issues.join(', ')}.\n\n` +
              `Configuration: "${aiConfigName}"\n\n` +
              `Note: For depletion reports, only Account and Product are required. Date and Revenue are optional.\n\n` +
              `💡 TO FIX: Test "${aiConfigName}" in AI Training page → Update to specify how to extract accounts and products`
            : `⚠️ Extracted ${transformedCount} records but all missing: ${issues.join(', ')}.\n\n` +
              `Note: For depletion reports, only Account and Product are required. Date and Revenue are optional.\n\n` +
              `💡 TO FIX: Create AI training for "${distributorName}" specifying account and product extraction`;
        }
      } else {
        const aiConfigName = aiConfigs && aiConfigs.length > 0 ? aiConfigs[0].configuration_name : null;
        const detectedColumns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
        const columnList = detectedColumns.length > 0 ? detectedColumns.join(', ') : 'none';

        const mappingDetails = [];
        if (!columnMapping.account && !columnMapping.customer) mappingDetails.push('account/customer');
        if (!columnMapping.product && !columnMapping.sku) mappingDetails.push('product/SKU');

        errorMessage = `❌ Failed to map columns.\n\n` +
          `Columns found: ${columnList}\n` +
          `Missing: ${mappingDetails.join(', ')}\n` +
          `Confidence: ${(confidence * 100).toFixed(0)}%\n\n` +
          (aiConfigName
            ? `💡 TO FIX: Test "${aiConfigName}" in AI Training page → Update to specify column names → Test again`
            : `💡 TO FIX: Create AI training for "${distributorName}" describing which columns contain account and product data`);
      }

      throw new Error(errorMessage);
    }

    const recordsWithMissingDates = salesRecords.filter(record => !record.order_date).length;
    const hasMissingDates = recordsWithMissingDates > 0;

    if (hasMissingDates) {
      console.warn(`⚠️ ${recordsWithMissingDates} of ${salesRecords.length} records are missing dates`);
    }

    console.log('🔍 Starting duplicate product detection...');

    const uniqueProductNames = [...new Set(salesRecords.map(r =>
      pdfFile ? r.product : cleanString(r.product_name)
    ).filter(Boolean))];

    console.log(`   - Found ${uniqueProductNames.length} unique product names in upload`);

    const { data: orgSettings } = await supabase
      .from('organizations')
      .select('auto_merge_threshold')
      .eq('id', organizationId)
      .single();

    const autoMergeThreshold = orgSettings?.auto_merge_threshold || 0.90;

    const existingMappings = await checkExistingMappings(uniqueProductNames, organizationId);
    console.log(`   - Found ${existingMappings.size} products with existing mappings`);

    const unmappedProducts = uniqueProductNames.filter(p => !existingMappings.has(p));

    let duplicateAnalysis: any[] = [];
    const productsNeedingReview: string[] = [];
    const autoMergedProducts: Map<string, string> = new Map();

    if (unmappedProducts.length > 0) {
      console.log(`   - Analyzing ${unmappedProducts.length} new products for duplicates...`);
      duplicateAnalysis = await analyzeProductDuplicates(
        unmappedProducts,
        organizationId,
        autoMergeThreshold
      );

      for (const analysis of duplicateAnalysis) {
        if (analysis.shouldAutoMerge && analysis.matches.length > 0) {
          const canonicalName = analysis.matches[0].existingProductName;
          autoMergedProducts.set(analysis.productName, canonicalName);

          await createProductMapping(
            organizationId,
            analysis.productName,
            canonicalName,
            analysis.matches[0].confidence,
            'ai_auto',
            userId
          );

          await logMergeDecision(
            organizationId,
            'auto',
            [analysis.productName],
            canonicalName,
            analysis.matches[0].confidence,
            analysis.matches[0].reasoning,
            salesRecords.filter(r => (pdfFile ? r.product : r.product_name) === analysis.productName).length,
            upload.id,
            userId
          );

          console.log(`   ✓ Auto-merged: "${analysis.productName}" → "${canonicalName}" (${(analysis.matches[0].confidence * 100).toFixed(0)}%)`);
        } else if (analysis.matches.length > 0) {
          productsNeedingReview.push(analysis.productName);

          await addToReviewQueue(
            organizationId,
            upload.id,
            analysis.productName,
            analysis.matches,
            analysis
          );

          console.log(`   ⚠ Needs review: "${analysis.productName}" - ${analysis.matches.length} potential matches`);
        }
      }
    }

    for (const [variant, canonical] of existingMappings.entries()) {
      autoMergedProducts.set(variant, canonical);
    }

    console.log(`🔍 Duplicate detection complete:`);
    console.log(`   - Auto-merged: ${autoMergedProducts.size - existingMappings.size} products`);
    console.log(`   - Previously mapped: ${existingMappings.size} products`);
    console.log(`   - Needs review: ${productsNeedingReview.length} products`);

    if (pdfFile) {
      for (const record of salesRecords) {
        // Rename fields to match database schema
        record.account_name = record.account;
        delete record.account;

        record.order_date = record.date;
        delete record.date;

        const productName = record.product;
        if (autoMergedProducts.has(productName)) {
          record.product_name = autoMergedProducts.get(productName);
          record.normalized_name = normalizeProductName(record.product_name);
        } else {
          record.product_name = productName;
          record.normalized_name = normalizeProductName(productName);
        }
        if (!record.brand) {
          record.brand = organizationName;
        }
        delete record.product;
      }
    } else {
      for (const record of salesRecords) {
        const productName = record.product_name;
        if (autoMergedProducts.has(productName)) {
          record.product_name = autoMergedProducts.get(productName);
        }
        record.normalized_name = normalizeProductName(record.product_name);
        if (!record.brand) {
          record.brand = organizationName;
        }
      }
    }

    // Deduplicate records with order_id to prevent unique constraint violations
    const recordsWithOrderId = salesRecords.filter(r => r.order_id);
    const recordsWithoutOrderId = salesRecords.filter(r => !r.order_id);
    
    const seenOrderIds = new Set<string>();
    const deduplicatedWithOrderId: any[] = [];
    let duplicateOrderIdCount = 0;

    for (const record of recordsWithOrderId) {
      const key = `${record.organization_id}:${record.order_id}`;
      if (!seenOrderIds.has(key)) {
        seenOrderIds.add(key);
        deduplicatedWithOrderId.push(record);
      } else {
        duplicateOrderIdCount++;
      }
    }

    if (duplicateOrderIdCount > 0) {
      console.warn(`⚠️ Removed ${duplicateOrderIdCount} duplicate order_id entries from upload`);
    }

    const deduplicatedRecords = [...deduplicatedWithOrderId, ...recordsWithoutOrderId];

    // Check for existing order_ids in database to prevent conflicts
    if (deduplicatedWithOrderId.length > 0) {
      const orderIdsToCheck = deduplicatedWithOrderId.map(r => r.order_id);
      const { data: existingOrderIds } = await supabase
        .from('sales_data')
        .select('order_id')
        .eq('organization_id', organizationId)
        .in('order_id', orderIdsToCheck);

      if (existingOrderIds && existingOrderIds.length > 0) {
        const existingSet = new Set(existingOrderIds.map(r => r.order_id));
        const finalRecords = deduplicatedRecords.filter(r => !r.order_id || !existingSet.has(r.order_id));
        const skippedCount = deduplicatedRecords.length - finalRecords.length;
        
        if (skippedCount > 0) {
          console.warn(`⚠️ Skipped ${skippedCount} records with order_ids that already exist in database`);
        }
        
        salesRecords = finalRecords;
      } else {
        salesRecords = deduplicatedRecords;
      }
    } else {
      salesRecords = deduplicatedRecords;
    }

    const batchSize = 500;
    const insertedRecords: any[] = [];

    for (let i = 0; i < salesRecords.length; i += batchSize) {
      const batch = salesRecords.slice(i, i + batchSize).map(({ _original, ...record }) => record);
      const { data: insertedData, error: insertError } = await supabase
        .from('sales_data')
        .insert(batch)
        .select('id, product_name, distributor, quantity_in_bottles');

      if (insertError) {
        throw new Error(`Failed to insert sales data: ${insertError.message}`);
      }

      if (insertedData) {
        insertedRecords.push(...insertedData);
      }
    }

    console.log('📦 Processing inventory depletions...');
    let inventoryUpdateCount = 0;

    for (const record of insertedRecords) {
      if (record.product_name && record.distributor && record.quantity_in_bottles) {
        const success = await processDepletionForInventory(
          organizationId,
          record.id,
          record.product_name,
          record.distributor,
          Number(record.quantity_in_bottles)
        );

        if (success) {
          inventoryUpdateCount++;
        }
      }
    }

    if (inventoryUpdateCount > 0) {
      console.log(`✅ Updated inventory for ${inventoryUpdateCount} depletions`);
    }

    await updateAggregatedData(organizationId);

    const successRate = rows ? salesRecords.length / rows.length : 1;

    const needsProductReview = productsNeedingReview.length > 0;
    const uploadStatus = needsProductReview ? 'needs_product_review' : (hasMissingDates ? 'needs_review' : 'completed');

    let statusMessage: string | undefined;
    if (needsProductReview && hasMissingDates) {
      statusMessage = `⚠️ Upload requires review: ${productsNeedingReview.length} product(s) need duplicate review and ${recordsWithMissingDates} record(s) missing dates.`;
    } else if (needsProductReview) {
      statusMessage = `⚠️ Upload requires review: ${productsNeedingReview.length} product(s) may be duplicates. Please review before data appears in analytics.`;
    } else if (hasMissingDates) {
      statusMessage = `⚠️ Upload requires review: ${recordsWithMissingDates} record(s) missing dates. Please add dates manually before this data appears in analytics.`;
    }

    await supabase
      .from('uploads')
      .update({
        status: uploadStatus,
        row_count: salesRecords.length,
        processed_at: new Date().toISOString(),
        error_message: statusMessage,
        column_mapping: {
          ...(columnMapping || {}),
          _confidence: confidence,
          _method: method,
          _missing_dates: hasMissingDates,
          _records_missing_dates: recordsWithMissingDates,
          _duplicate_detection: {
            auto_merged: autoMergedProducts.size - existingMappings.size,
            needs_review: productsNeedingReview.length,
            previously_mapped: existingMappings.size
          },
          _parsing_warnings: parsingWarnings
        } as any
      })
      .eq('id', upload.id);

    if (rows && detectionResult) {
      await saveColumnMappingHistory(
        organizationId,
        upload.id,
        distributorId,
        filename,
        Object.keys(rows[0] || {}),
        columnMapping,
        detectionResult.confidence,
        detectionResult.method,
        salesRecords.length,
        successRate
      );
    }

    if (needsProductReview) {
      console.log('⚠️ Upload requires review - potential duplicate products');
      console.log(`📊 ${productsNeedingReview.length} products need review`);
    } else if (hasMissingDates) {
      console.log('⚠️ Upload requires review - missing dates');
      console.log(`📊 ${recordsWithMissingDates} of ${salesRecords.length} records need dates`);
    } else {
      console.log('✅ Upload completed successfully');
    }
    console.log(`📊 Success rate: ${(successRate * 100).toFixed(1)}%`);

    return {
      uploadId: upload.id,
      rowsProcessed: salesRecords.length,
      columnMapping,
      confidence: detectionResult?.confidence || confidence,
      successRate,
      needsReview: hasMissingDates || needsProductReview,
      needsProductReview,
      missingDatesCount: recordsWithMissingDates,
      duplicateDetection: {
        autoMerged: autoMergedProducts.size - existingMappings.size,
        needsReview: productsNeedingReview.length
      },
      parsingWarnings
    };
  } catch (error) {
    await supabase
      .from('uploads')
      .update({
        status: 'failed',
        error_message: (error as Error).message,
        processed_at: new Date().toISOString(),
      })
      .eq('id', upload.id);

    throw error;
  }
}

function detectPackageType(row: any, mapping: ColumnMapping, productName: string, userUnitType: 'cases' | 'bottles' = 'cases'): { packageType: PackageType; bottlesPerUnit: number; quantityInBottles: number; quantity: number } {
  const quantityValue = mapping.quantity ? parseNumber(row[mapping.quantity]) || 1 : 1;
  const quantityUnit = mapping.quantity_unit ? String(row[mapping.quantity_unit]).toLowerCase().trim() : '';
  const caseSize = mapping.case_size ? parseNumber(row[mapping.case_size]) : null;

  const productLower = productName.toLowerCase();

  if (productLower.includes('barrel') || quantityUnit.includes('barrel')) {
    return {
      packageType: 'barrel',
      bottlesPerUnit: 1,
      quantityInBottles: quantityValue,
      quantity: quantityValue
    };
  }

  if (quantityUnit.includes('single') || quantityUnit === 'bottle' || quantityUnit === 'bottles') {
    return {
      packageType: 'single',
      bottlesPerUnit: 1,
      quantityInBottles: quantityValue,
      quantity: quantityValue
    };
  }

  if (quantityUnit.includes('case') || quantityUnit === 'cs') {
    if (caseSize === 12 || productLower.includes('12') || productLower.includes('12pk') || productLower.includes('12-pack')) {
      return {
        packageType: 'case_12',
        bottlesPerUnit: 12,
        quantityInBottles: quantityValue * 12,
        quantity: quantityValue
      };
    }
    return {
      packageType: 'case_6',
      bottlesPerUnit: 6,
      quantityInBottles: quantityValue * 6,
      quantity: quantityValue
    };
  }

  if (productLower.includes('12pk') || productLower.includes('12-pack') || productLower.includes('12 pack') || caseSize === 12) {
    return {
      packageType: 'case_12',
      bottlesPerUnit: 12,
      quantityInBottles: quantityValue * 12,
      quantity: quantityValue
    };
  }

  if (userUnitType === 'bottles') {
    return {
      packageType: 'single',
      bottlesPerUnit: 1,
      quantityInBottles: quantityValue,
      quantity: quantityValue
    };
  }

  return {
    packageType: 'case_6',
    bottlesPerUnit: 6,
    quantityInBottles: quantityValue * 6,
    quantity: quantityValue
  };
}

function transformRow(
  row: any,
  mapping: ColumnMapping,
  organizationId: string,
  uploadId: string,
  distributorName: string,
  organizationName: string,
  distributorState: string | null,
  defaultPeriod?: string | null,
  userUnitType: 'cases' | 'bottles' = 'cases'
): SalesDataInsert | null {
  const dateCol = mapping.date;
  const monthCol = mapping.month;
  const yearCol = mapping.year;
  const revenueCol = mapping.revenue || mapping.amount;
  const accountCol = mapping.account || mapping.customer;
  const productCol = mapping.product || mapping.sku;

  if (!accountCol || !productCol) {
    return null;
  }

  const accountName = cleanString(row[accountCol]);
  const productName = cleanString(row[productCol]);

  if (!accountName || !productName) {
    return null;
  }

  if (accountName.length < 2 || productName.length < 2) {
    return null;
  }

  // Try to parse date from multiple sources
  let orderDate: Date | null = null;

  if (dateCol) {
    orderDate = parseDate(row[dateCol]);
  } else if (monthCol && yearCol) {
    orderDate = parseDateFromMonthYear(row[monthCol], row[yearCol]);

    if (orderDate) {
      console.log(`📅 Combined month (${row[monthCol]}) and year (${row[yearCol]}) into date:`, orderDate.toISOString().split('T')[0]);
    }
  }
  const revenue = revenueCol ? parseNumber(row[revenueCol]) : null;
  const hasRevenueData = revenue !== null && revenue !== undefined;

  const orderId = mapping.order_id ? cleanString(row[mapping.order_id]) : null;
  const category = mapping.category ? cleanString(row[mapping.category]) : null;
  const region = mapping.region ? cleanString(row[mapping.region]) : null;
  const representative = mapping.representative ? cleanString(row[mapping.representative]) : null;
  const brand = mapping.brand ? cleanString(row[mapping.brand]) : organizationName;

  const dateOfSaleCol = mapping.date_of_sale;
  const dateOfSale = dateOfSaleCol ? parseDate(row[dateOfSaleCol]) : null;

  const packageInfo = detectPackageType(row, mapping, productName, userUnitType);

  const unitPrice = hasRevenueData && packageInfo.quantity > 0 ? revenue! / packageInfo.quantity : null;

  return {
    organization_id: organizationId,
    upload_id: uploadId,
    order_date: orderDate ? orderDate.toISOString().split('T')[0] : null,
    revenue: revenue !== null ? revenue : null,
    account_name: accountName,
    product_name: productName,
    quantity: packageInfo.quantity,
    order_id: orderId,
    category,
    region,
    distributor: distributorName,
    account_state: distributorState,
    representative,
    brand,
    date_of_sale: dateOfSale ? dateOfSale.toISOString().split('T')[0] : null,
    unit_price: unitPrice,
    has_revenue_data: hasRevenueData,
    default_period: defaultPeriod || null,
    package_type: packageInfo.packageType,
    bottles_per_unit: packageInfo.bottlesPerUnit,
    quantity_in_bottles: packageInfo.quantityInBottles,
    quantity_unit: packageInfo.packageType.includes('case') ? 'cases' : (packageInfo.packageType === 'barrel' ? 'barrel' : 'bottles'),
    case_size: packageInfo.packageType.includes('case') ? packageInfo.bottlesPerUnit : null,
    raw_data: row,
  };
}

export async function updateAggregatedData(organizationId: string) {
  const { data: salesData } = await supabase
    .from('sales_data')
    .select('account_name, product_name, revenue, order_date, quantity, quantity_in_bottles, quantity_unit, case_size, brand')
    .eq('organization_id', organizationId);

  if (!salesData || salesData.length === 0) return;

  const accountMap = new Map<string, {
    totalRevenue: number;
    totalOrders: number;
    firstOrderDate: string;
    lastOrderDate: string;
  }>();

  const productMap = new Map<string, {
    totalRevenue: number;
    totalUnits: number;
    totalOrders: number;
    firstSaleDate: string;
    lastSaleDate: string;
    brandCounts: Map<string, number>;
  }>();

  for (const sale of salesData) {
    const accountKey = sale.account_name;
    const accountData = accountMap.get(accountKey) || {
      totalRevenue: 0,
      totalOrders: 0,
      firstOrderDate: sale.order_date,
      lastOrderDate: sale.order_date,
    };

    accountData.totalRevenue += Number(sale.revenue);
    accountData.totalOrders += 1;
    if (sale.order_date < accountData.firstOrderDate) {
      accountData.firstOrderDate = sale.order_date;
    }
    if (sale.order_date > accountData.lastOrderDate) {
      accountData.lastOrderDate = sale.order_date;
    }
    accountMap.set(accountKey, accountData);

    const productKey = sale.product_name;
    const productData = productMap.get(productKey) || {
      totalRevenue: 0,
      totalUnits: 0,
      totalOrders: 0,
      firstSaleDate: sale.order_date,
      lastSaleDate: sale.order_date,
      brandCounts: new Map<string, number>(),
    };

    productData.totalRevenue += Number(sale.revenue);

    let unitsInBottles = 0;
    if (sale.quantity_in_bottles !== null && sale.quantity_in_bottles !== undefined) {
      unitsInBottles = Number(sale.quantity_in_bottles);
    } else if (sale.quantity_unit === 'cases' && sale.case_size) {
      unitsInBottles = Number(sale.quantity) * Number(sale.case_size);
    } else {
      unitsInBottles = Number(sale.quantity) || 1;
    }

    productData.totalUnits += unitsInBottles;
    productData.totalOrders += 1;
    if (sale.order_date < productData.firstSaleDate) {
      productData.firstSaleDate = sale.order_date;
    }
    if (sale.order_date > productData.lastSaleDate) {
      productData.lastSaleDate = sale.order_date;
    }

    if (sale.brand) {
      const currentCount = productData.brandCounts.get(sale.brand) || 0;
      productData.brandCounts.set(sale.brand, currentCount + 1);
    }

    productMap.set(productKey, productData);
  }

  for (const [accountName, data] of accountMap.entries()) {
    const { error } = await supabase
      .from('accounts')
      .upsert({
        organization_id: organizationId,
        account_name: accountName,
        total_revenue: data.totalRevenue,
        total_orders: data.totalOrders,
        first_order_date: data.firstOrderDate,
        last_order_date: data.lastOrderDate,
        average_order_value: data.totalRevenue / data.totalOrders,
      }, {
        onConflict: 'organization_id,account_name',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`Error upserting account ${accountName}:`, error);
    }
  }

  for (const [productName, data] of productMap.entries()) {
    const { data: existingProduct } = await supabase
      .from('products')
      .select('manual_brand, brand')
      .eq('organization_id', organizationId)
      .eq('product_name', productName)
      .maybeSingle();

    let primaryBrand: string | null = null;
    if (data.brandCounts.size > 0) {
      let maxCount = 0;
      for (const [brand, count] of data.brandCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          primaryBrand = brand;
        }
      }
    }

    const updateData: any = {
      organization_id: organizationId,
      product_name: productName,
      total_revenue: data.totalRevenue,
      total_units: data.totalUnits,
      total_orders: data.totalOrders,
      average_price: data.totalRevenue / data.totalUnits,
      first_sale_date: data.firstSaleDate,
      last_sale_date: data.lastSaleDate,
    };

    if (!existingProduct?.manual_brand) {
      updateData.brand = primaryBrand;
    }

    const { error } = await supabase
      .from('products')
      .upsert(updateData, {
        onConflict: 'organization_id,product_name',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`Error upserting product ${productName}:`, error);
    }
  }

  console.log('🏢 Starting automatic premise type classification for new accounts...');
  try {
    const classificationResult = await classifyUnclassifiedAccounts(organizationId);
    if (classificationResult.success > 0) {
      console.log(`✅ Classified ${classificationResult.success} accounts`);
    }
    if (classificationResult.failed > 0) {
      console.warn(`⚠️ Failed to classify ${classificationResult.failed} accounts`);
    }
  } catch (err) {
    console.error('Error during automatic account classification:', err);
  }
}
