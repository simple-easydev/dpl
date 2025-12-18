import { supabase } from './supabase';
import { openai } from './openai';

export interface ColumnMapping {
  date?: string;
  month?: string;
  year?: string;
  revenue?: string;
  amount?: string;
  account?: string;
  customer?: string;
  product?: string;
  sku?: string;
  quantity?: string;
  order_id?: string;
  category?: string;
  region?: string;
  distributor?: string;
  representative?: string;
  date_of_sale?: string;
  brand?: string;
}

export interface DetectionResult {
  mapping: ColumnMapping;
  confidence: number;
  method: 'openai' | 'synonym' | 'pattern' | 'learned' | 'hybrid' | 'ai_training';
  columns?: string[]; // Detected column names from header row
  columnIndices?:number[];
  details: {
    [key: string]: {
      column: string;
      confidence: number;
      source: string;
    };
  };
}

interface FieldSynonym {
  field_type: string;
  synonym: string;
  confidence_weight: number | null;
}

interface LearnedMapping {
  final_mapping: ColumnMapping;
  confidence_score: number;
  detection_method: string;
}

export async function detectColumnMappingEnhanced(
  sampleRows: any[],
  organizationId: string,
  distributorId?: string,
  filename?: string,
  aiTrainingConfig?: { field_mappings?: Record<string, any>; parsing_instructions?: string; orientation?: string }
): Promise<DetectionResult> {
  if (sampleRows.length === 0) {
    return {
      mapping: {},
      confidence: 0,
      method: 'pattern',
      details: {},
    };
  }

  // Detect the actual header row (handles complex layouts with titles/groupings above headers)
  const headerDetection = await detectHeaderRow(sampleRows);
  const headerRowIndex = headerDetection.index;
  const columns = headerDetection.columns;
  const columnIndices = headerDetection.columnIndices;
  const headerConfidence = headerDetection.confidence;
  
  console.log(`📋 Detected header row at index ${headerRowIndex} (confidence: ${headerConfidence}%):`, columns);
  
  // Use rows after the header row for data analysis
  const dataRows = sampleRows.slice(headerRowIndex + 1).filter(row => {
    // Filter out empty rows and summary/total rows
    const values = Object.values(row).filter(v => v != null && v !== '');
    return values.length > 0 && !isLikelySummaryRow(row);
  });

  const synonyms = await loadSynonyms(organizationId);
  const learnedMappings = await loadLearnedMappings(organizationId, distributorId);

  let bestResult: DetectionResult = {
    mapping: {},
    confidence: 0,
    method: 'pattern',
    details: {},
  };

  let aiResult: DetectionResult | null = null;
  let learnedResult: DetectionResult | null = null;
  let synonymResult: DetectionResult | null = null;
  let patternResult: DetectionResult | null = null;
  let aiTrainingResult: DetectionResult | null = null;

  if (aiTrainingConfig?.field_mappings && Object.keys(aiTrainingConfig.field_mappings).length > 0) {
    console.log('🎓 Found AI training field mappings, attempting direct mapping...');
    try {
      aiTrainingResult = sanitizeDetectionResult(detectWithAITrainingMappings(columns, dataRows, aiTrainingConfig.field_mappings));
      if (aiTrainingResult.confidence > bestResult.confidence) {
        bestResult = aiTrainingResult;
        console.log('✅ AI training mapping applied with confidence:', aiTrainingResult.confidence);
      }
    } catch (error) {
      console.warn('⚠️ AI training mapping failed:', error);
    }
  }

  if (learnedMappings.length > 0) {
    console.log('📚 Found learned mappings, attempting to apply...');
    try {
      learnedResult = sanitizeDetectionResult(applyLearnedMapping(columns, learnedMappings));
      if (learnedResult.confidence > bestResult.confidence) {
        bestResult = learnedResult;
        console.log('✅ Learned mapping applied with confidence:', learnedResult.confidence);
      }
    } catch (error) {
      console.warn('⚠️ Learned mapping failed:', error);
    }
  }

  // const aiClient = await getOrganizationOpenAI(organizationId);
  const aiClient = openai;
  if (aiClient) {
    console.log('🤖 Attempting OpenAI detection...');
    if (aiTrainingConfig?.parsing_instructions) {
      console.log('📖 Using AI training instructions from configuration');
    }
    try {
      aiResult = sanitizeDetectionResult(await detectWithOpenAI(aiClient, columns, dataRows, synonyms, aiTrainingConfig));
      if (aiResult.confidence > bestResult.confidence) {
        bestResult = aiResult;
        console.log('✅ OpenAI detection succeeded with confidence:', aiResult.confidence);
      }
    } catch (error) {
      console.warn('⚠️ OpenAI detection failed:', error);
    }
  }

  console.log('🔤 Attempting synonym-based detection...');
  try {
    synonymResult = sanitizeDetectionResult(detectWithSynonyms(columns, dataRows, synonyms));
    if (synonymResult.confidence > bestResult.confidence) {
      bestResult = synonymResult;
      console.log('✅ Synonym detection succeeded with confidence:', synonymResult.confidence);
    }
  } catch (error) {
    console.warn('⚠️ Synonym detection failed:', error);
  }

  console.log('📊 Attempting pattern-based detection...');
  try {
    patternResult = sanitizeDetectionResult(detectWithPatterns(columns, dataRows));
    if (patternResult.confidence > bestResult.confidence) {
      bestResult = patternResult;
      console.log('✅ Pattern detection succeeded with confidence:', patternResult.confidence);
    }
  } catch (error) {
    console.warn('⚠️ Pattern detection failed:', error);
  }

  try {
    const validResults = [aiTrainingResult, aiResult, learnedResult, synonymResult, patternResult].filter(r => r !== null) as DetectionResult[];
    if (validResults.length > 0) {
      const hybridResult = combineResults(validResults);
      if (hybridResult.confidence > bestResult.confidence) {
        bestResult = hybridResult;
        console.log('✅ Hybrid approach improved confidence to:', hybridResult.confidence);
      }
    }
  } catch (error) {
    console.warn('⚠️ Hybrid combination failed, using best individual result:', error);
  }

  bestResult = sanitizeDetectionResult(bestResult);
  
  // Include the detected column names in the result
  bestResult.columns = columns;
  bestResult.columnIndices = columnIndices;

  console.log('🎯 Final mapping:', bestResult.mapping);
  console.log('📈 Final confidence:', bestResult.confidence);
  console.log('🔧 Detection method:', bestResult.method);
  console.log('📋 Detected columns:', columns);

  return bestResult;
}

async function loadSynonyms(organizationId: string): Promise<FieldSynonym[]> {
  const { data: globalSynonyms } = await supabase
    .from('field_synonyms')
    .select('field_type, synonym, confidence_weight')
    .is('organization_id', null)
    .eq('is_active', true);

  const { data: orgSynonyms } = await supabase
    .from('field_synonyms')
    .select('field_type, synonym, confidence_weight')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  return [...(globalSynonyms || []), ...(orgSynonyms || [])];
}

/**
 * Detects the actual header row in complex spreadsheets using AI
 * Handles cases where first rows contain titles, groupings, or empty cells
 */
async function detectHeaderRow(rows: any[]): Promise<{ index: number; columns: string[]; confidence: number, columnIndices:number[] }> {

  if (rows.length === 0) {
    return { index: 0, columns: [], confidence: 0, columnIndices:[] };
  }

  // Use AI to detect header row
  try {
    console.log('🤖 Using AI to detect header row...');
    
    const aiResult = await detectHeaderRowWithAI(rows);
    
    if (aiResult && aiResult.confidence >= 70) {
      console.log(`✅ AI detected header at row ${aiResult.headerRowIndex} (confidence: ${aiResult.confidence}%)`);
      console.log(`📋 AI extracted columns:`, aiResult.columnNames);
      console.log(`📍 AI column indices:`, aiResult.columnIndices);
      
      return {
        index: aiResult.headerRowIndex,
        columns: aiResult.columnNames,
        columnIndices: aiResult.columnIndices,
        confidence: aiResult.confidence
      };

    } else {
      console.warn('⚠️ AI confidence too low, falling back to rule-based detection');
    }
  } catch (error) {
    console.warn('⚠️ AI header detection failed, falling back to rule-based detection:', error);
  }

  // Fallback to rule-based detection
  console.log('🔧 Using rule-based header detection...');
  let bestRowIndex = 0;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const values = Object.values(row);
    
    const score = calculateHeaderScore(values, rows, i);

    console.log(`  Row ${i}: score=${score}, values:`, values.slice(0, 5));

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  const selectedRow = rows[bestRowIndex];
  
  // Extract actual column names from the header row's VALUES, not keys
  // The keys might be generic (__EMPTY_, A, B, C) but values contain real names
  const allKeys = Object.keys(selectedRow);
  const columns: string[] = [];
  
  allKeys.forEach(key => {
    const headerValue = selectedRow[key];
    if (headerValue != null && String(headerValue).trim() !== '') {
      // Use the actual header value as the column name
      columns.push(String(headerValue).trim());
    }
  });

  console.log(`🎯 Selected row ${bestRowIndex} as header (score: ${bestScore})`);
  console.log(`📋 Extracted ${columns.length} column names:`, columns.slice(0, 10));

  // If no columns found, fallback to using keys
  if (columns.length === 0) {
    console.warn('⚠️ No non-empty column names found in detected header row, using object keys');
    return { index: bestRowIndex, columns: allKeys, confidence: 50, columnIndices:[] };
  }

  return { index: bestRowIndex, columns, confidence: 60, columnIndices:[] };
}

/**
 * Uses AI to detect the header row in complex spreadsheets
 * Calls Supabase Edge Function to keep OpenAI API key secure
 */
async function detectHeaderRowWithAI(rows: any[]): Promise<{ headerRowIndex: number; columnNames: string[]; columnIndices: number[]; confidence: number; reasoning: string } | null> {
  try {
    // Prepare first 15 rows for analysis
    const rowsToAnalyze = rows.slice(0, 15).map((row, idx) => ({
      rowIndex: idx,
      values: Object.values(row).map(v => {
        if (v == null) return null;
        const str = String(v);
        // Truncate long values to save tokens
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
      })
    }));

    console.log('🔐 Calling Supabase Edge Function for secure AI header detection...');

    const { data, error } = await supabase.functions.invoke('detect-header-row', {
      body: { rows: rowsToAnalyze }
    });

    if (error) {
      console.error('Edge Function error:', error);
      return null;
    }

    if (!data) {
      console.warn('No response from Edge Function');
      return null;
    }

    // Validate result structure
    if (
      typeof data.headerRowIndex !== 'number' ||
      !Array.isArray(data.columnNames) ||
      !Array.isArray(data.columnIndices) ||
      typeof data.confidence !== 'number'
    ) {
      console.warn('Invalid response structure from Edge Function:', data);
      return null;
    }

    return {
      headerRowIndex: data.headerRowIndex,
      columnNames: data.columnNames,
      columnIndices: data.columnIndices,
      confidence: data.confidence,
      reasoning: data.reasoning || 'No reasoning provided'
    };
  } catch (error) {
    console.error('Error calling Edge Function for header detection:', error);
    return null;
  }
}

/**
 * Calculates a score for how likely a row is to be a header row
 * Higher scores indicate more header-like characteristics
 */
function calculateHeaderScore(values: any[], allRows: any[], rowIndex: number): number {
  let score = 0;

  // 1. Non-empty cell count (headers usually have many columns filled)
  const nonEmptyCells = values.filter(v => v != null && String(v).trim() !== '').length;
  score += nonEmptyCells * 10;

  // 2. Check for common header keywords
  const headerKeywords = /^(type|date|name|account|customer|product|item|quantity|qty|amount|revenue|price|total|memo|description|number|id|state|region|rep|representative|brand|sku|order|invoice|cases|units|sales)$/i;
  const keywordMatches = values.filter(v => 
    v != null && typeof v === 'string' && headerKeywords.test(v.trim())
  ).length;
  score += keywordMatches * 50;

  // 3. Check for column names with underscores (Customer_Name, Product_Name, etc.)
  const hasColumnNamingPattern = values.filter(v => 
    v != null && typeof v === 'string' && /^[A-Z][a-z]+(_[A-Z][a-z]+)+/i.test(v.trim())
  ).length;
  score += hasColumnNamingPattern * 40;

  // 4. Check for date-like column headers (01/2025, 02/2025, etc.)
  const hasDateColumns = values.filter(v => 
    v != null && typeof v === 'string' && /^\d{2}\/\d{4}$/.test(v.trim())
  ).length;
  score += hasDateColumns * 30;

  // 5. Strongly boost if row has MANY date columns (typical of time-series data)
  if (hasDateColumns >= 5) {
    score += 200; // Strong indicator of header row
  }

  // 6. STRONGLY penalize rows with actual date VALUES (08/05/2025, 08/14/2025 - data rows)
  const hasActualDateValues = values.filter(v => {
    if (v == null || typeof v !== 'string') return false;
    const str = v.trim();
    // Match MM/DD/YYYY format (actual dates)
    return /^\d{2}\/\d{2}\/\d{4}$/.test(str);
  }).length;
  if (hasActualDateValues > 0) {
    score -= 300; // Heavy penalty - this is a data row!
  }

  // 7. Penalize rows with decimal numbers (42.25, 84.50 - likely data)
  const hasDecimalValues = values.filter(v => {
    if (v == null) return false;
    const str = String(v).replace(/[$,\s]/g, '');
    const num = parseFloat(str);
    return !isNaN(num) && str.includes('.') && num > 0;
  }).length;
  if (hasDecimalValues >= 2) {
    score -= 150; // Strong penalty for multiple decimal values
  }

  // 8. Penalize rows with mostly numeric values (likely data, not headers)
  const numericCells = values.filter(v => {
    if (v == null) return false;
    const str = String(v).replace(/[$,\s]/g, '');
    return !isNaN(parseFloat(str)) && str !== '';
  }).length;
  if (numericCells > nonEmptyCells * 0.6) {
    score -= numericCells * 20;
  }

  // 9. Penalize rows with section header keywords
  const sectionKeywords = /^(total|inventory|summary|subtotal|grand total|report|category|share|dataset|user|cube|by|sort)$/i;
  const hasSectionKeyword = values.some(v => 
    v != null && typeof v === 'string' && sectionKeywords.test(v.trim())
  );
  if (hasSectionKeyword && nonEmptyCells < 5) {
    score -= 100;
  }

  // 10. Strongly penalize rows that start with metadata keywords
  const metadataKeywords = /^(by|sort|total|dataset|user|cube|12 months|share):/i;
  const startsWithMetadata = values.some(v => 
    v != null && typeof v === 'string' && metadataKeywords.test(v.trim())
  );
  if (startsWithMetadata) {
    score -= 200; // Strong penalty for metadata rows
  }

  // 11. Penalize rows that look like metadata (key: value pairs)
  const looksLikeMetadata = values.some(v => 
    v != null && typeof v === 'string' && /^(dataset|user|cube|by|sort):/i.test(v.trim())
  );
  if (looksLikeMetadata) {
    score -= 150;
  }

  // 12. Prefer rows that come after empty/sparse rows (common layout pattern)
  if (rowIndex > 0) {
    const prevRow = allRows[rowIndex - 1];
    const prevNonEmpty = Object.values(prevRow).filter(v => v != null && String(v).trim() !== '').length;
    if (prevNonEmpty < 3) {
      score += 30; // Boost if previous row was sparse
    }
  }

  // 13. Check for underscore-separated values (common header pattern)
  const hasUnderscores = values.filter(v => 
    v != null && typeof v === 'string' && v.includes('_')
  ).length;
  score += hasUnderscores * 15;

  // 14. Boost score if row has high column diversity (different value types/patterns)
  const uniquePatterns = new Set(values.map(v => {
    if (v == null || String(v).trim() === '') return 'empty';
    const str = String(v);
    if (/^\d{2}\/\d{4}$/.test(str)) return 'date_column';
    if (/^[A-Z][a-z]+(_[A-Z][a-z]+)+$/i.test(str)) return 'underscore_name';
    if (/^\d+$/.test(str)) return 'number';
    if (typeof v === 'string') return 'text';
    return 'other';
  }));
  if (uniquePatterns.size >= 3) {
    score += 25; // Diverse column types suggest header row
  }

  // 15. Penalize rows with very few non-empty cells (likely titles or section dividers)
  if (nonEmptyCells < 3 && rowIndex < 10) {
    score -= 50;
  }

  // 16. Boost if row contains short text values typical of headers
  const shortTextCount = values.filter(v => 
    v != null && typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 20
  ).length;
  if (shortTextCount >= nonEmptyCells * 0.7 && nonEmptyCells >= 4) {
    score += 40; // Headers are usually short text
  }

  return score;
}

/**
 * Checks if a row is likely a summary/total row (should be excluded from sample data)
 */
function isLikelySummaryRow(row: any): boolean {
  const values = Object.values(row);
  const firstValue = values.find(v => v != null && String(v).trim() !== '');
  
  if (firstValue && typeof firstValue === 'string') {
    const summaryKeywords = /^(total|subtotal|grand total|sum|summary|inventory|category|section|group)/i;
    return summaryKeywords.test(firstValue.trim());
  }
  
  return false;
}

async function loadLearnedMappings(
  organizationId: string,
  distributorId?: string
): Promise<LearnedMapping[]> {
  let query = supabase
    .from('column_mapping_history')
    .select('final_mapping, confidence_score, detection_method')
    .eq('organization_id', organizationId)
    .gte('confidence_score', 0.7)
    .order('created_at', { ascending: false })
    .limit(5);

  if (distributorId) {
    query = query.eq('distributor_id', distributorId);
  }

  const { data } = await query;
  return (data || []).map(item => ({
    final_mapping: item.final_mapping as ColumnMapping,
    confidence_score: item.confidence_score || 0,
    detection_method: item.detection_method || 'unknown'
  }));
}

function applyLearnedMapping(
  columns: string[],
  learnedMappings: LearnedMapping[]
): DetectionResult {
  const columnSet = new Set(columns.map(c => c.toLowerCase().trim()));

  for (const learned of learnedMappings) {
    const learnedColumns = Object.values(learned.final_mapping)
      .filter(Boolean)
      .map((c: any) => c.toLowerCase().trim());

    const matchCount = learnedColumns.filter(c => columnSet.has(c)).length;
    const matchRatio = learnedColumns.length > 0 ? matchCount / learnedColumns.length : 0;

    if (matchRatio >= 0.7) {
      const details: any = {};
      Object.entries(learned.final_mapping).forEach(([field, column]) => {
        if (column && columnSet.has(column.toLowerCase().trim())) {
          details[field] = {
            column,
            confidence: learned.confidence_score,
            source: 'learned',
          };
        }
      });

      return {
        mapping: learned.final_mapping,
        confidence: matchRatio * learned.confidence_score,
        method: 'learned',
        details,
      };
    }
  }

  return { mapping: {}, confidence: 0, method: 'learned', details: {} };
}

function detectWithAITrainingMappings(
  columns: string[],
  sampleRows: any[],
  fieldMappings: Record<string, any>
): DetectionResult {
  const mapping: any = {};
  const details: any = {};
  let totalConfidence = 0;
  let mappedFields = 0;

  const normalizedColumns = columns.map(col => ({
    original: col,
    normalized: col.toLowerCase().trim()
  }));

  for (const [targetField, possibleColumns] of Object.entries(fieldMappings)) {
    if (!possibleColumns || (Array.isArray(possibleColumns) && possibleColumns.length === 0)) {
      continue;
    }

    const columnsList = Array.isArray(possibleColumns) ? possibleColumns : [possibleColumns];

    for (const possibleCol of columnsList) {
      if (!possibleCol) continue;

      const normalizedPossible = String(possibleCol).toLowerCase().trim();

      const matchedColumn = normalizedColumns.find(col =>
        col.normalized === normalizedPossible
      );

      if (matchedColumn) {
        const mappingKey = getFieldKey(targetField) || targetField;

        if (!mapping[mappingKey]) {
          mapping[mappingKey] = matchedColumn.original;
          details[mappingKey] = {
            column: matchedColumn.original,
            confidence: 0.95,
            source: 'ai_training_config',
          };
          totalConfidence += 0.95;
          mappedFields++;
          console.log(`✓ Mapped ${matchedColumn.original} → ${mappingKey} (AI training)`);
        }
        break;
      }
    }
  }

  const overallConfidence = mappedFields > 0 ? totalConfidence / mappedFields : 0;

  console.log(`🎓 AI Training Mapping: ${mappedFields} fields mapped with ${(overallConfidence * 100).toFixed(0)}% confidence`);

  return {
    mapping,
    confidence: overallConfidence,
    method: 'ai_training',
    details,
  };
}

/**
 * Uses AI to detect column mappings via Supabase Edge Function
 * Keeps OpenAI API key secure on server-side
 */
async function detectWithOpenAI(
  aiClient: any,
  columns: string[],
  sampleRows: any[],
  synonyms: FieldSynonym[],
  aiTrainingConfig?: { field_mappings?: Record<string, any>; parsing_instructions?: string; orientation?: string }
): Promise<DetectionResult> {
  try {
    const sampleData = sampleRows.slice(0, 5);

    const synonymsByField = synonyms.reduce((acc, s) => {
      if (!acc[s.field_type]) acc[s.field_type] = [];
      acc[s.field_type].push(s.synonym);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('🔐 Calling Supabase Edge Function for secure AI column mapping...');

    const { data, error } = await supabase.functions.invoke('detect-column-mapping', {
      body: {
        columns,
        sampleData,
        synonymsByField,
        aiTrainingConfig,
      }
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data || !data.mapping) {
      console.warn('No valid response from Edge Function');
      throw new Error('No valid response from Edge Function');
    }

    const details: any = {};
    Object.entries(data.mapping || {}).forEach(([field, column]) => {
      if (column) {
        details[field] = {
          column,
          confidence: data.confidence || 0.8,
          source: 'openai',
        };
      }
    });

    console.log(`✅ OpenAI column mapping via Edge Function: ${(data.confidence * 100).toFixed(0)}% confidence`);

    return {
      mapping: data.mapping || {},
      confidence: data.confidence || 0.8,
      method: 'openai',
      details,
    };
  } catch (error) {
    console.error('Error calling Edge Function for column mapping:', error);
    throw error;
  }
}

function detectWithSynonyms(
  columns: string[],
  sampleRows: any[],
  synonyms: FieldSynonym[]
): DetectionResult {
  const mapping: any = {};
  const details: any = {};
  let totalConfidence = 0;
  let mappedFields = 0;

  const synonymMap = new Map<string, { field: string; weight: number }[]>();

  synonyms.forEach(s => {
    const normalizedSynonym = s.synonym.toLowerCase().trim();
    if (!synonymMap.has(normalizedSynonym)) {
      synonymMap.set(normalizedSynonym, []);
    }
    synonymMap.get(normalizedSynonym)!.push({
      field: s.field_type,
      weight: s.confidence_weight || 1.0,
    });
  });

  for (const col of columns) {
    const normalizedCol = col.toLowerCase().trim();

    if (synonymMap.has(normalizedCol)) {
      const matches = synonymMap.get(normalizedCol)!;
      const bestMatch = matches.reduce((best, curr) =>
        curr.weight > best.weight ? curr : best
      );

      const fieldKey = getFieldKey(bestMatch.field);
      if (fieldKey && !mapping[fieldKey]) {
        mapping[fieldKey] = col;
        details[fieldKey] = {
          column: col,
          confidence: bestMatch.weight,
          source: 'synonym-exact',
        };
        totalConfidence += bestMatch.weight;
        mappedFields++;
      }
    } else {
      for (const [synonym, matches] of synonymMap.entries()) {
        if (normalizedCol.includes(synonym) || synonym.includes(normalizedCol)) {
          const bestMatch = matches.reduce((best, curr) =>
            curr.weight > best.weight ? curr : best
          );

          const fieldKey = getFieldKey(bestMatch.field);
          if (fieldKey && !mapping[fieldKey]) {
            mapping[fieldKey] = col;
            details[fieldKey] = {
              column: col,
              confidence: bestMatch.weight * 0.8,
              source: 'synonym-partial',
            };
            totalConfidence += bestMatch.weight * 0.8;
            mappedFields++;
            break;
          }
        }
      }
    }
  }

  const overallConfidence = mappedFields > 0 ? totalConfidence / mappedFields : 0;

  return {
    mapping,
    confidence: overallConfidence,
    method: 'synonym',
    details,
  };
}

function detectWithPatterns(columns: string[], sampleRows: any[]): DetectionResult {
  const mapping: any = {};
  const details: any = {};

  const patterns = {
    date: [
      { regex: /^(order[_ ]?date|invoice[_ ]?date|sale[_ ]?date|ship[_ ]?date|transaction[_ ]?date)$/i, weight: 1.0 },
      { regex: /^(period|month[_ ]?year|sales[_ ]?period|reporting[_ ]?period)$/i, weight: 0.95 },
      { regex: /date/i, weight: 0.7 },
    ],
    month: [
      { regex: /^(month|sales[_ ]?month|period[_ ]?month|month[_ ]?name|month[_ ]?number|mnth)$/i, weight: 1.0 },
      { regex: /month/i, weight: 0.8 },
    ],
    year: [
      { regex: /^(year|sales[_ ]?year|period[_ ]?year|yr)$/i, weight: 1.0 },
      { regex: /year/i, weight: 0.8 },
    ],
    revenue: [
      { regex: /^(revenue|amount|total|extended[_ ]?price|sale[_ ]?amount|net[_ ]?amount|line[_ ]?total|ext[_ ]?price)$/i, weight: 1.0 },
      { regex: /(revenue|amount|price|sales|total|ext[_ ]?price|line[_ ]?amt)/i, weight: 0.7 },
      { regex: /(amt|value|cost)/i, weight: 0.5 },
    ],
    account: [
      { regex: /^(account|customer|client|ship[_ ]?to|sold[_ ]?to|acct[_ ]?name|cust[_ ]?name|customer[_ ]?name)$/i, weight: 1.0 },
      { regex: /(account|customer|client|acct|cust|buyer|purchaser)/i, weight: 0.7 },
    ],
    product: [
      { regex: /^(product|item|sku|part[_ ]?number|item[_ ]?number|prod[_ ]?name|item[_ ]?desc|description)$/i, weight: 1.0 },
      { regex: /(product|item|sku|material|part|prod|desc)/i, weight: 0.7 },
    ],
    quantity: [
      { regex: /^(quantity|qty|units|cases|boxes|count|volume|pieces|qnty|pcs|cs)$/i, weight: 1.0 },
      { regex: /(quantity|qty|units|cases|boxes|count|pcs|qnty|cs|vol)/i, weight: 0.8 },
    ],
    order_id: [
      { regex: /^(order[_ ]?id|order[_ ]?number|invoice[_ ]?number|transaction[_ ]?id)$/i, weight: 1.0 },
      { regex: /(order|invoice|transaction).*(id|number|no)/i, weight: 0.8 },
    ],
    representative: [
      { regex: /^(rep|representative|sales[_ ]?rep|salesperson|account[_ ]?manager|sold[_ ]?by|sales[_ ]?person|sales[_ ]?agent)$/i, weight: 1.0 },
      { regex: /(rep|sales[_ ]?rep|salesperson|agent|manager|sold[_ ]?by)/i, weight: 0.7 },
      { regex: /(sales|agent)/i, weight: 0.5 },
    ],
    brand: [
      { regex: /^(brand|brand[_ ]?name|manufacturer|producer|supplier|vendor[_ ]?name|company[_ ]?name)$/i, weight: 1.0 },
      { regex: /(brand|manufacturer|producer|supplier|vendor|company|mfg)/i, weight: 0.7 },
    ],
  };

  for (const col of columns) {
    for (const [field, patternList] of Object.entries(patterns)) {
      if (!mapping[field]) {
        for (const { regex, weight } of patternList) {
          if (regex.test(col)) {
            mapping[field] = col;
            details[field] = {
              column: col,
              confidence: weight,
              source: 'pattern',
            };
            break;
          }
        }
      }
    }
  }

  const analyzedMapping = analyzeDataValues(sampleRows, columns, mapping);
  Object.assign(mapping, analyzedMapping.mapping);
  Object.assign(details, analyzedMapping.details);

  const mappedCount = Object.keys(mapping).length;
  const avgConfidence = Object.values(details).reduce((sum: number, d: any) => sum + d.confidence, 0) / Math.max(mappedCount, 1);

  return {
    mapping,
    confidence: avgConfidence,
    method: 'pattern',
    details,
  };
}

function analyzeDataValues(sampleRows: any[], columns: string[], existingMapping: any): { mapping: any; details: any } {
  const mapping: any = {};
  const details: any = {};

  for (const col of columns) {
    if (Object.values(existingMapping).includes(col)) continue;

    const values = sampleRows.map(row => row[col]).filter(v => v != null && v !== '');
    if (values.length === 0) continue;

    if (!existingMapping.date && isLikelyDate(values)) {
      mapping.date = col;
      details.date = { column: col, confidence: 0.85, source: 'value-analysis' };
    } else if (!existingMapping.month && isLikelyMonth(values)) {
      mapping.month = col;
      details.month = { column: col, confidence: 0.85, source: 'value-analysis' };
    } else if (!existingMapping.year && isLikelyYear(values)) {
      mapping.year = col;
      details.year = { column: col, confidence: 0.85, source: 'value-analysis' };
    } else if (!existingMapping.revenue && isLikelyRevenue(values)) {
      mapping.revenue = col;
      details.revenue = { column: col, confidence: 0.8, source: 'value-analysis' };
    } else if (!existingMapping.quantity && isLikelyQuantity(values)) {
      mapping.quantity = col;
      details.quantity = { column: col, confidence: 0.75, source: 'value-analysis' };
    }
  }

  return { mapping, details };
}

function isLikelyDate(values: any[]): boolean {
  let dateCount = 0;
  for (const val of values.slice(0, 10)) {
    const str = String(val);
    if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(str) || !isNaN(Date.parse(str))) {
      dateCount++;
    }
  }
  return dateCount / Math.min(values.length, 10) > 0.7;
}

function isLikelyMonth(values: any[]): boolean {
  let monthCount = 0;
  const monthNames = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)$/i;

  for (const val of values.slice(0, 10)) {
    const str = String(val).trim().toLowerCase();
    const num = Number(str);

    if (monthNames.test(str)) {
      monthCount++;
    } else if (Number.isInteger(num) && num >= 1 && num <= 12) {
      monthCount++;
    }
  }
  return monthCount / Math.min(values.length, 10) > 0.7;
}

function isLikelyYear(values: any[]): boolean {
  let yearCount = 0;
  for (const val of values.slice(0, 10)) {
    const num = Number(val);
    if (Number.isInteger(num) && num >= 2000 && num <= 2100) {
      yearCount++;
    }
  }
  return yearCount / Math.min(values.length, 10) > 0.7;
}

function isLikelyRevenue(values: any[]): boolean {
  let numericCount = 0;
  let hasDecimal = false;

  for (const val of values.slice(0, 10)) {
    const str = String(val).replace(/[$,\s]/g, '');
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) {
      numericCount++;
      if (str.includes('.') && num > 10) hasDecimal = true;
    }
  }

  return numericCount / Math.min(values.length, 10) > 0.8 && hasDecimal;
}

function isLikelyQuantity(values: any[]): boolean {
  let integerCount = 0;

  for (const val of values.slice(0, 10)) {
    const num = Number(val);
    if (Number.isInteger(num) && num > 0 && num < 10000) {
      integerCount++;
    }
  }

  return integerCount / Math.min(values.length, 10) > 0.7;
}

function sanitizeDetectionResult(result: DetectionResult): DetectionResult {
  if (!result.details || typeof result.details !== 'object') {
    result.details = {};
  }
  if (!result.mapping || typeof result.mapping !== 'object') {
    result.mapping = {};
  }
  if (typeof result.confidence !== 'number') {
    result.confidence = 0;
  }
  return result;
}

function combineResults(results: DetectionResult[]): DetectionResult {
  const combinedMapping: any = {};
  const combinedDetails: any = {};

  if (!results || results.length === 0) {
    return {
      mapping: {},
      confidence: 0,
      method: 'hybrid',
      details: {},
    };
  }

  const validResults = results.filter(r => r && r.mapping && r.details);
  if (validResults.length === 0) {
    console.warn('⚠️ No valid results to combine');
    return {
      mapping: {},
      confidence: 0,
      method: 'hybrid',
      details: {},
    };
  }

  const fieldScores: Record<string, { column: string; score: number; sources: string[] }> = {};

  for (const result of validResults) {
    if (!result.details) {
      console.warn('⚠️ Result missing details, skipping:', result.method);
      continue;
    }

    Object.entries(result.mapping).forEach(([field, column]) => {
      if (!column) return;

      const key = `${field}:${column}`;
      if (!fieldScores[key]) {
        fieldScores[key] = { column: column as string, score: 0, sources: [] };
      }

      const detailConf = (result.details && result.details[field]?.confidence) || result.confidence || 0;
      fieldScores[key].score += detailConf * 0.5;
      fieldScores[key].sources.push(result.method);
    });
  }

  const fieldBest: Record<string, { column: string; score: number; sources: string[] }> = {};
  Object.entries(fieldScores).forEach(([key, data]) => {
    const field = key.split(':')[0];
    if (!fieldBest[field] || data.score > fieldBest[field].score) {
      fieldBest[field] = data;
    }
  });

  Object.entries(fieldBest).forEach(([field, data]) => {
    combinedMapping[field] = data.column;
    combinedDetails[field] = {
      column: data.column,
      confidence: Math.min(data.score, 1.0),
      source: data.sources.join('+'),
    };
  });

  const avgConfidence = Object.values(combinedDetails).reduce((sum: number, d: any) => sum + d.confidence, 0) / Math.max(Object.keys(combinedDetails).length, 1);

  return {
    mapping: combinedMapping,
    confidence: avgConfidence,
    method: 'hybrid',
    details: combinedDetails,
  };
}

function getFieldKey(fieldType: string): string | null {
  const mapping: Record<string, string> = {
    'date': 'date',
    'revenue': 'revenue',
    'amount': 'revenue',
    'account': 'account',
    'customer': 'account',
    'account_name': 'account',
    'product': 'product',
    'product_name': 'product',
    'sku': 'product',
    'quantity': 'quantity',
    'order_id': 'order_id',
    'category': 'category',
    'region': 'region',
    'distributor': 'distributor',
    'representative': 'representative',
    'date_of_sale': 'date_of_sale',
    'brand': 'brand',
    'address': 'address',
    'city': 'city',
    'state': 'state',
    'zip': 'zip',
    'phone': 'phone',
    'vintage': 'vintage',
    'premise_type': 'premise_type',
    'sale_type': 'sale_type',
    'bottles_count': 'bottles_count',
    'bottles_per_case': 'bottles_per_case',
  };
  return mapping[fieldType] || null;
}

export async function saveColumnMappingHistory(
  organizationId: string,
  uploadId: string | null,
  distributorId: string | null,
  filename: string,
  detectedColumns: string[],
  finalMapping: ColumnMapping,
  confidenceScore: number,
  detectionMethod: string,
  rowsProcessed: number,
  successRate: number
): Promise<void> {
  const filenamePattern = generateFilenamePattern(filename);

  await supabase.from('column_mapping_history').insert({
    organization_id: organizationId,
    upload_id: uploadId,
    distributor_id: distributorId,
    filename_pattern: filenamePattern,
    detected_columns: detectedColumns,
    final_mapping: finalMapping as any,
    confidence_score: confidenceScore,
    detection_method: detectionMethod,
    rows_processed: rowsProcessed,
    success_rate: successRate,
  });

  await updateSynonymUsage(organizationId, finalMapping);
}

function generateFilenamePattern(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}/g, '%')
    .replace(/\d{4}_\d{2}_\d{2}/g, '%')
    .replace(/\d{2}-\d{2}-\d{4}/g, '%')
    .replace(/\d+/g, '%')
    .replace(/[_\-\s]+/g, '%');
}

async function updateSynonymUsage(organizationId: string, mapping: ColumnMapping): Promise<void> {
  for (const column of Object.values(mapping)) {
    if (!column) continue;

    const { error } = await supabase
      .from('field_synonyms')
      .update({ usage_count: 1 } as any)
      .eq('synonym', column)
      .eq('organization_id', organizationId);

    if (error) {
      console.warn('Failed to update synonym usage:', error);
    }
  }
}
