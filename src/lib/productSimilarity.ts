import { parseProductName, type ProductComponents } from './productNameParser';

export interface SimilarityResult {
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

export function levenshteinDistance(str1: string, str2: string): number {
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

export function calculateStringSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  return 1 - (distance / maxLength);
}

export function calculateTokenOverlap(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }

  const set1 = new Set(tokens1.map(t => t.toLowerCase()));
  const set2 = new Set(tokens2.map(t => t.toLowerCase()));

  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;
  const jaccardSimilarity = union > 0 ? intersection / union : 0;

  const minSize = Math.min(set1.size, set2.size);
  const containmentScore = minSize > 0 ? intersection / minSize : 0;

  return Math.max(jaccardSimilarity, containmentScore * 0.9);
}

export function compareBrands(brand1: string, brand2: string): number {
  if (!brand1 || !brand2) return 0;

  const normalized1 = brand1.toLowerCase().trim();
  const normalized2 = brand2.toLowerCase().trim();

  if (normalized1 === normalized2) return 1.0;

  const similarity = calculateStringSimilarity(normalized1, normalized2);

  if (similarity >= 0.85) return similarity;

  const tokens1 = normalized1.split(/\s+/);
  const tokens2 = normalized2.split(/\s+/);

  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1.length > 2 && t2.length > 2) {
        const tokenSimilarity = calculateStringSimilarity(t1, t2);
        if (tokenSimilarity >= 0.85) {
          return Math.max(similarity, tokenSimilarity * 0.9);
        }
      }
    }
  }

  return similarity;
}

export function compareVolumes(vol1: number | null, vol2: number | null): number {
  if (vol1 === null || vol2 === null) return 0.5;

  if (vol1 === vol2) return 1.0;

  const difference = Math.abs(vol1 - vol2);
  const average = (vol1 + vol2) / 2;
  const percentDifference = difference / average;

  if (percentDifference < 0.01) return 1.0;
  if (percentDifference < 0.05) return 0.98;
  if (percentDifference < 0.1) return 0.90;
  if (percentDifference < 0.2) return 0.75;

  return Math.max(0, 1 - percentDifference);
}

export function comparePackageCounts(count1: number, count2: number): number {
  if (count1 === count2) return 1.0;

  if ((count1 === 1 && count2 > 1) || (count2 === 1 && count1 > 1)) {
    return 0.6;
  }

  const difference = Math.abs(count1 - count2);
  if (difference <= 2) return 0.8;
  if (difference <= 4) return 0.6;

  return 0.3;
}

export function compareProductTypes(type1: string, type2: string): number {
  if (!type1 || !type2) return 0.5;

  const normalized1 = type1.toLowerCase().trim();
  const normalized2 = type2.toLowerCase().trim();

  if (normalized1 === normalized2) return 1.0;

  const knownVariations: Record<string, string[]> = {
    'whiskey': ['whisky', 'bourbon', 'scotch'],
    'beer': ['ale', 'lager', 'stout', 'ipa'],
    'wine': ['red wine', 'white wine', 'rose'],
    'vodka': ['vodka'],
    'rum': ['rum'],
    'gin': ['gin'],
    'tequila': ['tequila', 'mezcal']
  };

  for (const [base, variations] of Object.entries(knownVariations)) {
    if ((normalized1 === base && variations.includes(normalized2)) ||
        (normalized2 === base && variations.includes(normalized1)) ||
        (variations.includes(normalized1) && variations.includes(normalized2))) {
      return 0.9;
    }
  }

  return calculateStringSimilarity(normalized1, normalized2);
}

export function calculateComponentSimilarity(
  comp1: ProductComponents,
  comp2: ProductComponents
): SimilarityResult {
  const reasoning: string[] = [];
  const componentScores = {
    brand: 0,
    productType: 0,
    volume: 0,
    packageCount: 0,
    tokens: 0,
    overall: 0
  };

  componentScores.brand = compareBrands(comp1.brand, comp2.brand);
  if (componentScores.brand >= 0.85) {
    reasoning.push(`Brand match: "${comp1.brand}" ≈ "${comp2.brand}" (${(componentScores.brand * 100).toFixed(0)}%)`);
  }

  componentScores.productType = compareProductTypes(comp1.productType, comp2.productType);
  if (componentScores.productType >= 0.85) {
    reasoning.push(`Product type match: "${comp1.productType}" ≈ "${comp2.productType}" (${(componentScores.productType * 100).toFixed(0)}%)`);
  }

  componentScores.volume = compareVolumes(comp1.volumeML, comp2.volumeML);
  if (comp1.volumeML && comp2.volumeML) {
    if (componentScores.volume >= 0.95) {
      reasoning.push(`Same volume: ${comp1.volume} = ${comp2.volume}`);
    } else if (componentScores.volume >= 0.7) {
      reasoning.push(`Similar volume: ${comp1.volume} ≈ ${comp2.volume}`);
    }
  }

  componentScores.packageCount = comparePackageCounts(comp1.packageCount, comp2.packageCount);
  if (comp1.packageCount !== comp2.packageCount) {
    if (componentScores.packageCount >= 0.6) {
      reasoning.push(`Different packaging: ${comp1.packageCount}pk vs ${comp2.packageCount}pk (may be same product)`);
    }
  }

  componentScores.tokens = calculateTokenOverlap(comp1.tokens, comp2.tokens);
  if (componentScores.tokens >= 0.7) {
    const commonTokens = comp1.tokens.filter(t1 =>
      comp2.tokens.some(t2 => t1.toLowerCase() === t2.toLowerCase())
    );
    if (commonTokens.length > 0) {
      reasoning.push(`Common descriptors: ${commonTokens.join(', ')}`);
    }
  }

  const weights = {
    brand: 0.35,
    productType: 0.20,
    volume: 0.30,
    packageCount: 0.05,
    tokens: 0.10
  };

  componentScores.overall =
    componentScores.brand * weights.brand +
    componentScores.productType * weights.productType +
    componentScores.volume * weights.volume +
    componentScores.packageCount * weights.packageCount +
    componentScores.tokens * weights.tokens;

  let confidence = componentScores.overall;

  if (componentScores.brand >= 0.9 && componentScores.volume >= 0.95) {
    confidence = Math.max(confidence, 0.92);
    reasoning.push('High confidence: brand and volume closely match');
  }

  if (componentScores.brand >= 0.95 && componentScores.volume >= 0.95 && componentScores.productType >= 0.85) {
    confidence = Math.max(confidence, 0.95);
    reasoning.push('Very high confidence: brand, volume, and product type all match');
  }

  if (componentScores.brand >= 0.85 && componentScores.productType >= 0.85 && componentScores.volume >= 0.85) {
    confidence = Math.max(confidence, 0.88);
  }

  if (comp1.packageCount !== comp2.packageCount && componentScores.brand >= 0.9 && componentScores.volume >= 0.9) {
    reasoning.push('Note: Same product with different package counts (e.g., single vs 6-pack)');
  }

  if (comp1.normalizedName === comp2.normalizedName) {
    confidence = Math.max(confidence, 0.95);
    reasoning.push('Normalized names are identical');
  }

  const score = componentScores.overall;

  return {
    score,
    confidence,
    reasoning,
    componentScores
  };
}

export function compareProducts(product1: string, product2: string): SimilarityResult {
  const comp1 = parseProductName(product1);
  const comp2 = parseProductName(product2);

  return calculateComponentSimilarity(comp1, comp2);
}

export function findBestMatches(
  newProduct: string,
  existingProducts: string[],
  minConfidence: number = 0.70
): Array<{ product: string; similarity: SimilarityResult }> {
  const matches: Array<{ product: string; similarity: SimilarityResult }> = [];

  const newComp = parseProductName(newProduct);

  for (const existingProduct of existingProducts) {
    const existingComp = parseProductName(existingProduct);

    if (newComp.brand && existingComp.brand &&
        compareBrands(newComp.brand, existingComp.brand) < 0.5) {
      continue;
    }

    const similarity = calculateComponentSimilarity(newComp, existingComp);

    if (similarity.confidence >= minConfidence) {
      matches.push({
        product: existingProduct,
        similarity
      });
    }
  }

  matches.sort((a, b) => b.similarity.confidence - a.similarity.confidence);

  return matches.slice(0, 5);
}
