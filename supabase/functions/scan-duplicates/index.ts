import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProductComponents {
  brand: string;
  productType: string;
  volume: string;
  volumeML: number | null;
  packageCount: number;
  descriptors: string[];
  originalName: string;
  normalizedName: string;
  tokens: string[];
}

interface SimilarityResult {
  score: number;
  confidence: number;
  reasoning: string[];
  componentScores: {
    brand: number;
    productType: number;
    volume: number;
    packageCount: number;
    tokens: number;
    overall: number;
  };
}

const VOLUME_CONVERSIONS: Record<string, number> = {
  'ml': 1,
  'l': 1000,
  'oz': 29.5735,
  'gallon': 3785.41,
  'gal': 3785.41,
  'pt': 473.176,
  'pint': 473.176,
  'qt': 946.353,
  'quart': 946.353
};

const PACKAGE_PATTERNS = [
  { regex: /(\d+)\s*pk/i, multiplier: 1 },
  { regex: /(\d+)\s*pack/i, multiplier: 1 },
  { regex: /(\d+)\s*-\s*pack/i, multiplier: 1 },
  { regex: /(\d+)\s*bottle/i, multiplier: 1 },
  { regex: /(\d+)\s*btl/i, multiplier: 1 },
  { regex: /case\s*of\s*(\d+)/i, multiplier: 1 },
  { regex: /(\d+)\s*ct/i, multiplier: 1 },
  { regex: /(\d+)\s*count/i, multiplier: 1 }
];

function extractVolume(text: string): { value: number; unit: string; standardizedML: number } | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(ml|mL|ML|M)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(l|L|liter|litre)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(oz|ounce)(?:\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase().replace(/[^a-z]/g, '');
      const normalizedUnit = unit === 'm' ? 'ml' : unit;
      const conversionFactor = VOLUME_CONVERSIONS[normalizedUnit] || 1;

      return {
        value,
        unit: match[2],
        standardizedML: value * conversionFactor
      };
    }
  }

  return null;
}

function extractPackageCount(text: string): number {
  for (const pattern of PACKAGE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 1;
}

function parseProductName(name: string): ProductComponents {
  const tokens = name.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const volumeInfo = extractVolume(name);
  const packageCount = extractPackageCount(name);

  return {
    brand: tokens.slice(0, 2).join(' '),
    productType: '',
    volume: volumeInfo ? `${volumeInfo.value}${volumeInfo.unit}` : '',
    volumeML: volumeInfo?.standardizedML || null,
    packageCount,
    descriptors: tokens,
    originalName: name,
    normalizedName: name.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(),
    tokens
  };
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  return 1 - (distance / maxLength);
}

function compareProducts(product1: string, product2: string): SimilarityResult {
  const comp1 = parseProductName(product1);
  const comp2 = parseProductName(product2);

  const brandSimilarity = calculateStringSimilarity(comp1.brand, comp2.brand);
  const volumeSimilarity = comp1.volumeML && comp2.volumeML && comp1.volumeML === comp2.volumeML ? 1.0 : 0.5;
  const tokenOverlap = comp1.tokens.filter(t => comp2.tokens.includes(t)).length / Math.max(comp1.tokens.length, comp2.tokens.length);

  const confidence = (brandSimilarity * 0.4) + (volumeSimilarity * 0.3) + (tokenOverlap * 0.3);

  const reasoning: string[] = [];
  if (brandSimilarity >= 0.8) reasoning.push(`Similar brand names`);
  if (comp1.volumeML === comp2.volumeML && comp1.volumeML) reasoning.push(`Same volume`);
  if (tokenOverlap >= 0.5) reasoning.push(`${Math.round(tokenOverlap * 100)}% word overlap`);

  return {
    score: confidence,
    confidence,
    reasoning,
    componentScores: {
      brand: brandSimilarity,
      productType: 0.5,
      volume: volumeSimilarity,
      packageCount: 0.5,
      tokens: tokenOverlap,
      overall: confidence
    }
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, minConfidence = 0.70, maxProducts = 500 } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startTime = Date.now();

    const { data: scanRecord, error: scanError } = await supabase
      .from('duplicate_scan_history')
      .insert({
        organization_id: organizationId,
        scan_started_at: new Date().toISOString(),
        status: 'running',
        scan_parameters: { minConfidence, maxProducts }
      })
      .select()
      .single();

    if (scanError) {
      throw new Error(`Failed to create scan record: ${scanError.message}`);
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, product_name, total_revenue, total_orders')
      .eq('organization_id', organizationId)
      .order('total_revenue', { ascending: false })
      .limit(maxProducts);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    const candidates: Array<{
      product1Id: string;
      product2Id: string;
      product1Name: string;
      product2Name: string;
      confidenceScore: number;
      similarityDetails: any;
    }> = [];

    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const product1 = products[i];
        const product2 = products[j];

        const { data: existing } = await supabase
          .from('background_duplicate_candidates')
          .select('id')
          .eq('organization_id', organizationId)
          .or(`and(product1_id.eq.${product1.id},product2_id.eq.${product2.id}),and(product1_id.eq.${product2.id},product2_id.eq.${product1.id})`)
          .maybeSingle();

        if (existing) continue;

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
        }
      }
    }

    if (candidates.length > 0) {
      const candidatesToInsert = candidates.map(c => ({
        organization_id: organizationId,
        product1_id: c.product1Id,
        product2_id: c.product2Id,
        product1_name: c.product1Name,
        product2_name: c.product2Name,
        confidence_score: c.confidenceScore,
        similarity_details: c.similarityDetails,
        status: 'pending'
      }));

      await supabase.from('background_duplicate_candidates').insert(candidatesToInsert);
    }

    const highConfidenceCount = candidates.filter(c => c.confidenceScore >= 0.90).length;
    const durationSeconds = (Date.now() - startTime) / 1000;

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
      .update({ last_duplicate_scan: new Date().toISOString() })
      .eq('id', organizationId);

    return new Response(
      JSON.stringify({
        success: true,
        scanId: scanRecord.id,
        productsScanned: products.length,
        candidatesFound: candidates.length,
        highConfidenceCount,
        durationSeconds
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Scan error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to scan for duplicates"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
