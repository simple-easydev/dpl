import { supabase } from './supabase';
import { compareProducts } from './productSimilarity';
import { getOrganizationOpenAI } from './openai';
import { updateAggregatedData } from './dataProcessor';

export interface ScanOptions {
  organizationId: string;
  minConfidence?: number;
  batchSize?: number;
  maxProductsToScan?: number;
  skipRecentlyScannedProducts?: boolean;
}

export interface ScanResult {
  scanId: string;
  productsScanned: number;
  candidatesFound: number;
  highConfidenceCount: number;
  durationSeconds: number;
  error?: string;
}

export interface DuplicateCandidate {
  product1Id: string;
  product2Id: string;
  product1Name: string;
  product2Name: string;
  confidenceScore: number;
  similarityDetails: any;
}

export async function scanForDuplicates(options: ScanOptions): Promise<ScanResult> {
  const {
    organizationId,
    minConfidence = 0.70,
    batchSize = 50,
    maxProductsToScan = 500
  } = options;

  const startTime = Date.now();

  const { data: scanRecord, error: scanError } = await supabase
    .from('duplicate_scan_history')
    .insert({
      organization_id: organizationId,
      scan_started_at: new Date().toISOString(),
      status: 'running',
      scan_parameters: {
        minConfidence,
        batchSize,
        maxProductsToScan
      }
    })
    .select()
    .single();

  if (scanError || !scanRecord) {
    console.error('Failed to create scan record:', scanError);
    throw new Error('Failed to initialize duplicate scan');
  }

  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, product_name, total_revenue, total_orders')
      .eq('organization_id', organizationId)
      .order('total_revenue', { ascending: false })
      .limit(maxProductsToScan);

    if (productsError || !products) {
      throw new Error('Failed to fetch products for scanning');
    }

    console.log(`🔍 Background scan started for organization ${organizationId}`);
    console.log(`   - Scanning ${products.length} products`);
    console.log(`   - Minimum confidence: ${minConfidence}`);

    const candidates: DuplicateCandidate[] = [];
    const scannedPairs = new Set<string>();

    for (let i = 0; i < products.length; i++) {
      const product1 = products[i];

      for (let j = i + 1; j < products.length; j++) {
        const product2 = products[j];

        const pairKey = [product1.id, product2.id].sort().join('|');
        if (scannedPairs.has(pairKey)) {
          continue;
        }
        scannedPairs.add(pairKey);

        const { data: existingCandidate } = await supabase
          .from('background_duplicate_candidates')
          .select('id')
          .eq('organization_id', organizationId)
          .or(`and(product1_id.eq.${product1.id},product2_id.eq.${product2.id}),and(product1_id.eq.${product2.id},product2_id.eq.${product1.id})`)
          .maybeSingle();

        if (existingCandidate) {
          continue;
        }

        const similarity = compareProducts(product1.product_name, product2.product_name);

        if (similarity.confidence >= minConfidence) {
          candidates.push({
            product1Id: product1.id,
            product2Id: product2.id,
            product1Name: product1.product_name,
            product2Name: product2.product_name,
            confidenceScore: similarity.confidence,
            similarityDetails: {
              score: similarity.score,
              reasoning: similarity.reasoning,
              componentScores: similarity.componentScores
            }
          });

          console.log(`   ✓ Found duplicate: "${product1.product_name}" ≈ "${product2.product_name}" (${(similarity.confidence * 100).toFixed(0)}%)`);
        }
      }

      if (i % 10 === 0 && i > 0) {
        console.log(`   - Progress: ${i}/${products.length} products scanned, ${candidates.length} candidates found`);
      }
    }

    if (candidates.length > 0) {
      const candidatesToInsert = candidates.map(candidate => ({
        organization_id: organizationId,
        product1_id: candidate.product1Id,
        product2_id: candidate.product2Id,
        product1_name: candidate.product1Name,
        product2_name: candidate.product2Name,
        confidence_score: candidate.confidenceScore,
        similarity_details: candidate.similarityDetails,
        status: 'pending',
        detected_at: new Date().toISOString(),
        notification_sent: false
      }));

      const { error: insertError } = await supabase
        .from('background_duplicate_candidates')
        .insert(candidatesToInsert);

      if (insertError) {
        console.error('Failed to insert candidates:', insertError);
      }
    }

    const highConfidenceCount = candidates.filter(c => c.confidenceScore >= 0.90).length;

    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    await supabase
      .from('duplicate_scan_history')
      .update({
        scan_completed_at: new Date().toISOString(),
        products_scanned: products.length,
        candidates_found: candidates.length,
        high_confidence_count: highConfidenceCount,
        scan_duration_seconds: durationSeconds,
        status: 'completed'
      })
      .eq('id', scanRecord.id);

    await supabase
      .from('organizations')
      .update({
        last_duplicate_scan: new Date().toISOString()
      })
      .eq('id', organizationId);

    console.log(`✅ Background scan completed`);
    console.log(`   - Products scanned: ${products.length}`);
    console.log(`   - Candidates found: ${candidates.length}`);
    console.log(`   - High confidence (>90%): ${highConfidenceCount}`);
    console.log(`   - Duration: ${durationSeconds.toFixed(1)}s`);

    return {
      scanId: scanRecord.id,
      productsScanned: products.length,
      candidatesFound: candidates.length,
      highConfidenceCount,
      durationSeconds
    };

  } catch (error) {
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    await supabase
      .from('duplicate_scan_history')
      .update({
        scan_completed_at: new Date().toISOString(),
        scan_duration_seconds: durationSeconds,
        error_message: (error as Error).message,
        status: 'failed'
      })
      .eq('id', scanRecord.id);

    console.error('Background scan failed:', error);

    return {
      scanId: scanRecord.id,
      productsScanned: 0,
      candidatesFound: 0,
      highConfidenceCount: 0,
      durationSeconds,
      error: (error as Error).message
    };
  }
}

export async function getPendingCandidates(organizationId: string) {
  const { data, error } = await supabase
    .from('background_duplicate_candidates')
    .select(`
      *,
      product1:products!background_duplicate_candidates_product1_id_fkey(id, product_name, total_revenue, total_orders, last_sale_date),
      product2:products!background_duplicate_candidates_product2_id_fkey(id, product_name, total_revenue, total_orders, last_sale_date)
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .is('archived_at', null)
    .order('confidence_score', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch pending candidates:', error);
    return [];
  }

  return data || [];
}

export async function mergeDuplicateCandidate(
  candidateId: string,
  organizationId: string,
  keepProductId: string,
  mergeProductId: string,
  userId: string
) {
  const { data: candidate } = await supabase
    .from('background_duplicate_candidates')
    .select('*')
    .eq('id', candidateId)
    .single();

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  const { data: keepProduct } = await supabase
    .from('products')
    .select('product_name')
    .eq('id', keepProductId)
    .single();

  const { data: mergeProduct } = await supabase
    .from('products')
    .select('product_name')
    .eq('id', mergeProductId)
    .single();

  if (!keepProduct || !mergeProduct) {
    throw new Error('Products not found');
  }

  const { data: salesData } = await supabase
    .from('sales_data')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('product_name', mergeProduct.product_name);

  await supabase
    .from('sales_data')
    .update({ product_name: keepProduct.product_name })
    .eq('organization_id', organizationId)
    .eq('product_name', mergeProduct.product_name);

  await supabase
    .from('product_mappings')
    .insert({
      organization_id: organizationId,
      product_variant: mergeProduct.product_name,
      canonical_name: keepProduct.product_name,
      confidence_score: candidate.confidence_score,
      source: 'manual',
      created_by: userId,
      is_active: true
    });

  await supabase
    .from('merge_audit_log')
    .insert({
      organization_id: organizationId,
      merge_type: 'manual',
      source_product_names: [mergeProduct.product_name],
      target_canonical_name: keepProduct.product_name,
      confidence_score: candidate.confidence_score,
      ai_reasoning: `Background scan detected duplicate (${(candidate.confidence_score * 100).toFixed(0)}% confidence)`,
      records_affected: salesData?.length || 0,
      performed_by: userId,
      can_undo: true
    });

  await supabase
    .from('background_duplicate_candidates')
    .update({
      status: 'merged',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      user_decision: {
        action: 'merged',
        kept_product: keepProduct.product_name,
        merged_product: mergeProduct.product_name
      }
    })
    .eq('id', candidateId);

  console.log(`✓ Merged "${mergeProduct.product_name}" into "${keepProduct.product_name}"`);
  console.log(`🔄 Regenerating products aggregation...`);

  await updateAggregatedData(organizationId);

  console.log(`✅ Products table updated successfully`);
}

export async function dismissDuplicateCandidate(
  candidateId: string,
  userId: string,
  reason?: string
) {
  await supabase
    .from('background_duplicate_candidates')
    .update({
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      user_decision: {
        action: 'dismissed',
        reason: reason || 'Not a duplicate'
      }
    })
    .eq('id', candidateId);

  console.log(`✓ Dismissed duplicate candidate ${candidateId}`);
}

export async function getOrganizationsNeedingScan(): Promise<string[]> {
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, duplicate_scan_enabled, last_duplicate_scan, scan_frequency_hours')
    .eq('duplicate_scan_enabled', true);

  if (!organizations) return [];

  const needsScan: string[] = [];

  for (const org of organizations) {
    const shouldScan = await supabase.rpc('should_run_duplicate_scan', { org_id: org.id });

    if (shouldScan.data === true) {
      needsScan.push(org.id);
    }
  }

  return needsScan;
}
