import { supabase } from './supabase';
import { getOrganizationOpenAI } from './openai';
import { normalizeProductName as normalizeForStorage, parseProductName, createStandardizedName } from './productNameParser';
import { compareProducts, findBestMatches, type SimilarityResult } from './productSimilarity';

export interface ProductMatch {
  existingProductName: string;
  existingProductId: string;
  confidence: number;
  reasoning: string;
  totalRevenue: number;
  totalOrders: number;
  lastSaleDate: string;
}

export interface DuplicateAnalysisResult {
  productName: string;
  matches: ProductMatch[];
  shouldAutoMerge: boolean;
  suggestedCanonicalName: string;
}

export interface ProductMapping {
  variant: string;
  canonical: string;
  confidence: number;
  source: 'manual' | 'ai_auto' | 'ai_confirmed';
}

export function normalizeProductName(name: string): string {
  return normalizeForStorage(name);
}

export async function checkExistingMappings(
  productNames: string[],
  organizationId: string
): Promise<Map<string, string>> {
  const mappings = new Map<string, string>();

  const { data: existingMappings } = await supabase
    .from('product_mappings')
    .select('product_variant, canonical_name')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('product_variant', productNames);

  if (existingMappings) {
    for (const mapping of existingMappings) {
      mappings.set(mapping.product_variant, mapping.canonical_name);

      await supabase.rpc('increment_mapping_usage', {
        mapping_id: mapping.id
      });
    }
  }

  return mappings;
}

export async function analyzeProductDuplicates(
  newProducts: string[],
  organizationId: string,
  autoMergeThreshold: number = 0.90
): Promise<DuplicateAnalysisResult[]> {
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, product_name, total_revenue, total_orders, last_sale_date')
    .eq('organization_id', organizationId)
    .order('total_revenue', { ascending: false })
    .limit(500);

  if (!existingProducts || existingProducts.length === 0) {
    return newProducts.map(name => ({
      productName: name,
      matches: [],
      shouldAutoMerge: false,
      suggestedCanonicalName: name
    }));
  }

  const aiClient = await getOrganizationOpenAI(organizationId);

  if (!aiClient) {
    return performBasicDuplicateDetection(newProducts, existingProducts, autoMergeThreshold);
  }

  try {
    const results: DuplicateAnalysisResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < newProducts.length; i += batchSize) {
      const batch = newProducts.slice(i, i + batchSize);
      const batchResults = await analyzeBatchWithAI(
        batch,
        existingProducts,
        aiClient,
        autoMergeThreshold
      );
      results.push(...batchResults);
    }

    return results;
  } catch (error) {
    console.error('Error analyzing duplicates with AI:', error);
    return performBasicDuplicateDetection(newProducts, existingProducts);
  }
}

async function analyzeBatchWithAI(
  newProducts: string[],
  existingProducts: any[],
  aiClient: any,
  autoMergeThreshold: number
): Promise<DuplicateAnalysisResult[]> {
  const existingProductList = existingProducts
    .slice(0, 100)
    .map(p => p.product_name)
    .join('\n');

  const prompt = `You are a product name matching expert. Analyze these new product names and identify potential duplicates from the existing product catalog.

NEW PRODUCTS TO ANALYZE:
${newProducts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

EXISTING PRODUCT CATALOG:
${existingProductList}

MATCHING RULES:
1. Extract and compare these components separately:
   - Brand name (most important)
   - Product type (vodka, whiskey, beer, etc.)
   - Volume/size (normalize all to mL)
   - Package count (6PK = 6-pack = 6 pack)
   - Descriptors (flavor, style, age, etc.)

2. Volume normalization:
   - 750ML = 750mL = 750M = 750 ml (all same)
   - 1L = 1000mL
   - 12oz = 355mL
   - Volumes within 5% are considered identical

3. Package count handling:
   - 6PK = 6-pack = 6 pack = "case of 6" = 6CT
   - Single bottles vs multi-packs of SAME product ARE duplicates
   - Example: "Avua Prata 750mL" and "Avua Prata 6PK 750mL" are the SAME product

4. Word order should NOT matter:
   - "AVUA PRATA CACHACA" = "Avua Cachaca Prata" = "Cachaca Avua Prata"
   - Compare tokens, not exact string order

5. Confidence scoring:
   - 0.95-1.0: Same brand + same volume + same product type (only formatting differs)
   - 0.85-0.94: Same brand + same volume (minor descriptor differences)
   - 0.70-0.84: Same brand + similar volume (needs verification)
   - Below 0.70: Different products or too uncertain

6. Examples of HIGH CONFIDENCE duplicates (0.90+):
   - "AVUA PRATA CACHACA 6PK 750M" ↔ "Avua Cachaca Prata - 750 mL" (0.95 - same product, word order and package differs)
   - "Avua Cachaca Prata- 750mL" ↔ "AVUA PRATA CACHACA 6PK 750M" (0.95 - SAME PRODUCT despite word reordering)
   - "Grey Goose Vodka 750ML" ↔ "GREY GOOSE VODKA 750" (0.96 - same product)
   - "Tito's Handmade Vodka 1.75L" ↔ "TITOS VODKA 1750ML" (0.95 - same product)
   - "Corona Extra 12oz 6-pack" ↔ "Corona Extra Beer 12 oz Bottles" (0.92 - same product)
   - "Jack Daniel's Tennessee Whiskey 750mL" ↔ "JACK DANIELS WHISKEY 750ML" (0.97 - same product)
   - "PALADAR TEQ SB REPO SB SERIES 6PK LA POPULAR 750ML" ↔ "Paladar Reposado Tequila 750mL" (0.93 - same brand/type/volume)

7. Examples of MEDIUM CONFIDENCE (needs review, 0.70-0.89):
   - "Patron Silver Tequila 750mL" ↔ "Patron Reposado Tequila 750mL" (0.75 - different varieties)
   - "Budweiser 12oz" ↔ "Bud Light 12oz" (0.72 - different products, same brand)

8. Examples that are NOT duplicates:
   - "Grey Goose Vodka 750mL" vs "Grey Goose Vodka 1.75L" (different sizes)
   - "Corona Extra" vs "Corona Light" (different products)
   - "Jack Daniel's No. 7" vs "Jack Daniel's Honey" (different varieties)

Return a JSON array with one object per new product:
{
  "productName": "exact name from NEW PRODUCTS list",
  "matches": [
    {
      "existingProductName": "name from catalog",
      "confidence": 0.95,
      "reasoning": "Same brand (Avua), same product (Cachaca Prata), same volume (750mL), only differs in word order and package notation"
    }
  ],
  "suggestedCanonicalName": "best standardized version"
}

IMPORTANT:
- WORD ORDER DOES NOT MATTER: "Avua Prata Cachaca" = "Avua Cachaca Prata" = "Cachaca Prata Avua"
- Focus on BRAND + VOLUME + PRODUCT TYPE matches (these are the key identifiers)
- Package count differences (6PK vs single) should NOT reduce confidence below 0.90 if other components match
- Same volume in different formats MUST match: 750M = 750ML = 750mL = 750 ml (all identical)
- Confidence score MUST be 0.90+ when brand, volume, and product type all match
- Only include matches with confidence >= 0.70
- Sort matches by confidence (highest first)
- Include up to 3 best matches per product
- For canonical name, use standardized format: "Brand ProductType Descriptors VolumemL [PackageCountPK]"
- If no matches found, return empty matches array
- Return valid JSON only, no markdown formatting or explanations`;

  const response = await aiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a precise product matching assistant. Return only valid JSON arrays.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content || '{"results": []}';
  let parsed;

  try {
    parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
  } catch {
    parsed = { results: [] };
  }

  const aiResults = Array.isArray(parsed) ? parsed : (parsed.results || []);

  const results: DuplicateAnalysisResult[] = aiResults.map((result: any) => {
    const matches: ProductMatch[] = (result.matches || []).map((match: any) => {
      const existingProduct = existingProducts.find(
        p => p.product_name === match.existingProductName
      );

      return {
        existingProductName: match.existingProductName,
        existingProductId: existingProduct?.id || '',
        confidence: match.confidence || 0,
        reasoning: match.reasoning || '',
        totalRevenue: existingProduct?.total_revenue || 0,
        totalOrders: existingProduct?.total_orders || 0,
        lastSaleDate: existingProduct?.last_sale_date || ''
      };
    });

    const highestConfidence = matches.length > 0 ? matches[0].confidence : 0;
    const shouldAutoMerge = highestConfidence >= autoMergeThreshold;

    return {
      productName: result.productName,
      matches,
      shouldAutoMerge,
      suggestedCanonicalName: result.suggestedCanonicalName || result.productName
    };
  });

  console.log(`🤖 AI Duplicate Detection: Analyzed ${newProducts.length} products`);
  const autoMergeCount = results.filter(r => r.shouldAutoMerge).length;
  const needsReviewCount = results.filter(r => r.matches.length > 0 && !r.shouldAutoMerge).length;
  console.log(`   - Auto-merge: ${autoMergeCount}`);
  console.log(`   - Needs review: ${needsReviewCount}`);
  console.log(`   - New products: ${results.filter(r => r.matches.length === 0).length}`);

  return results;
}

function performBasicDuplicateDetection(
  newProducts: string[],
  existingProducts: any[],
  autoMergeThreshold: number = 0.90
): DuplicateAnalysisResult[] {
  console.log('🔍 Using enhanced fallback duplicate detection (no AI available)');

  return newProducts.map(newProduct => {
    const normalizedNew = normalizeProductName(newProduct);
    const matches: ProductMatch[] = [];
    const newComp = parseProductName(newProduct);

    for (const existing of existingProducts) {
      const normalizedExisting = normalizeProductName(existing.product_name);

      if (normalizedNew === normalizedExisting) {
        matches.push({
          existingProductName: existing.product_name,
          existingProductId: existing.id,
          confidence: 0.95,
          reasoning: 'Exact match after normalization',
          totalRevenue: existing.total_revenue,
          totalOrders: existing.total_orders,
          lastSaleDate: existing.last_sale_date
        });
        continue;
      }

      const similarity = compareProducts(newProduct, existing.product_name);

      if (similarity.confidence >= 0.70) {
        const reasoningText = similarity.reasoning.length > 0
          ? similarity.reasoning.join('; ')
          : `Component match score: ${(similarity.score * 100).toFixed(0)}%`;

        matches.push({
          existingProductName: existing.product_name,
          existingProductId: existing.id,
          confidence: similarity.confidence,
          reasoning: reasoningText,
          totalRevenue: existing.total_revenue,
          totalOrders: existing.total_orders,
          lastSaleDate: existing.last_sale_date
        });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    const topMatches = matches.slice(0, 3);

    const highestConfidence = topMatches.length > 0 ? topMatches[0].confidence : 0;
    const shouldAutoMerge = highestConfidence >= autoMergeThreshold;

    let suggestedCanonicalName = newProduct;
    if (topMatches.length > 0) {
      suggestedCanonicalName = topMatches[0].existingProductName;
    } else {
      const standardized = createStandardizedName(newComp);
      if (standardized) {
        suggestedCanonicalName = standardized;
      }
    }

    return {
      productName: newProduct,
      matches: topMatches,
      shouldAutoMerge,
      suggestedCanonicalName
    };
  });
}

export async function createProductMapping(
  organizationId: string,
  variant: string,
  canonical: string,
  confidence: number,
  source: 'manual' | 'ai_auto' | 'ai_confirmed',
  userId?: string
): Promise<void> {
  await supabase.from('product_mappings').insert({
    organization_id: organizationId,
    product_variant: variant,
    canonical_name: canonical,
    confidence_score: confidence,
    source,
    created_by: userId,
    is_active: true
  });
}

export async function addToReviewQueue(
  organizationId: string,
  uploadId: string,
  productName: string,
  matches: ProductMatch[],
  aiAnalysis: any
): Promise<void> {
  await supabase.from('duplicate_review_queue').insert({
    organization_id: organizationId,
    upload_id: uploadId,
    product_name: productName,
    potential_matches: matches,
    ai_analysis: aiAnalysis,
    status: 'pending'
  });
}

export async function logMergeDecision(
  organizationId: string,
  mergeType: 'auto' | 'manual' | 'bulk',
  sourceNames: string[],
  targetCanonical: string,
  confidence: number | null,
  reasoning: string | null,
  recordsAffected: number,
  uploadId: string | null,
  userId: string | null
): Promise<void> {
  await supabase.from('merge_audit_log').insert({
    organization_id: organizationId,
    merge_type: mergeType,
    source_product_names: sourceNames,
    target_canonical_name: targetCanonical,
    confidence_score: confidence,
    ai_reasoning: reasoning,
    records_affected: recordsAffected,
    upload_id: uploadId,
    performed_by: userId,
    can_undo: true
  });
}

export async function getPendingReviewProducts(
  uploadId: string,
  organizationId: string
): Promise<any[]> {
  const { data } = await supabase
    .from('duplicate_review_queue')
    .select('*')
    .eq('upload_id', uploadId)
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return data || [];
}

export async function markProductReviewed(
  queueId: string,
  decision: any,
  userId: string
): Promise<void> {
  await supabase
    .from('duplicate_review_queue')
    .update({
      status: 'reviewed',
      user_decision: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    })
    .eq('id', queueId);
}
