import { compareProducts } from './productSimilarity';
import { parseProductName } from './productNameParser';

console.log('🧪 Testing Enhanced Duplicate Detection\n');
console.log('='.repeat(60));

const testCases = [
  {
    name: 'Avua Cachaca Example - USER REPORTED ISSUE',
    product1: 'Avua Cachaca Prata- 750mL',
    product2: 'AVUA PRATA CACHACA 6PK 750M',
    expectedHighConfidence: true,
    expectedMinConfidence: 0.90
  },
  {
    name: 'Grey Goose Example',
    product1: 'Grey Goose Vodka 750ML',
    product2: 'GREY GOOSE VODKA 750',
    expectedHighConfidence: true,
    expectedMinConfidence: 0.90
  },
  {
    name: 'Corona Example',
    product1: 'Corona Extra 12oz Bottles',
    product2: 'Corona Extra Beer 12 oz',
    expectedHighConfidence: true,
    expectedMinConfidence: 0.90
  },
  {
    name: 'Tito\'s Example',
    product1: 'Tito\'s Handmade Vodka 1.75L',
    product2: 'TITOS VODKA 1750ML',
    expectedHighConfidence: true,
    expectedMinConfidence: 0.90
  },
  {
    name: 'Paladar Complex Name',
    product1: 'PALADAR TEQ SB REPO SB SERIES 6PK LA POPULAR 750ML',
    product2: 'Paladar Reposado Tequila 750mL',
    expectedHighConfidence: true,
    expectedMinConfidence: 0.85
  },
  {
    name: 'Word Order Variation',
    product1: 'Avua Amburana Cachaca 750mL',
    product2: 'CACHACA AVUA AMBURANA 750M',
    expectedHighConfidence: true,
    expectedMinConfidence: 0.90
  },
  {
    name: 'Different Sizes - Should NOT Match',
    product1: 'Grey Goose Vodka 750mL',
    product2: 'Grey Goose Vodka 1.75L',
    expectedHighConfidence: false,
    expectedMinConfidence: 0
  },
  {
    name: 'Different Products - Should NOT Match',
    product1: 'Corona Extra',
    product2: 'Corona Light',
    expectedHighConfidence: false,
    expectedMinConfidence: 0
  }
];

for (const testCase of testCases) {
  console.log(`\n\n📦 Test Case: ${testCase.name}`);
  console.log('-'.repeat(60));
  console.log(`Product 1: "${testCase.product1}"`);
  console.log(`Product 2: "${testCase.product2}"`);
  console.log();

  const comp1 = parseProductName(testCase.product1);
  const comp2 = parseProductName(testCase.product2);

  console.log('Parsed Components:');
  console.log(`  Product 1: Brand="${comp1.brand}", Volume="${comp1.volume}" (${comp1.volumeML}mL), Package=${comp1.packageCount}`);
  console.log(`  Product 2: Brand="${comp2.brand}", Volume="${comp2.volume}" (${comp2.volumeML}mL), Package=${comp2.packageCount}`);
  console.log();

  const similarity = compareProducts(testCase.product1, testCase.product2);

  console.log('Similarity Analysis:');
  console.log(`  Overall Confidence: ${(similarity.confidence * 100).toFixed(1)}%`);
  console.log(`  Component Scores:`);
  console.log(`    - Brand:    ${(similarity.componentScores.brand * 100).toFixed(1)}%`);
  console.log(`    - Volume:   ${(similarity.componentScores.volume * 100).toFixed(1)}%`);
  console.log(`    - Tokens:   ${(similarity.componentScores.tokens * 100).toFixed(1)}%`);
  console.log(`    - Package:  ${(similarity.componentScores.packageCount * 100).toFixed(1)}%`);
  console.log(`    - Overall:  ${(similarity.componentScores.overall * 100).toFixed(1)}%`);

  if (similarity.reasoning.length > 0) {
    console.log(`  Reasoning:`);
    similarity.reasoning.forEach(reason => {
      console.log(`    • ${reason}`);
    });
  }

  const passed = testCase.expectedHighConfidence
    ? similarity.confidence >= testCase.expectedMinConfidence
    : similarity.confidence < 0.90;

  console.log();
  console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  if (!passed) {
    if (testCase.expectedHighConfidence) {
      console.log(`    Expected: High confidence (>=${(testCase.expectedMinConfidence * 100).toFixed(0)}%)`);
      console.log(`    Got: ${(similarity.confidence * 100).toFixed(1)}%`);
      console.log(`    Gap: ${((testCase.expectedMinConfidence - similarity.confidence) * 100).toFixed(1)}% below threshold`);
    } else {
      console.log(`    Expected: Low confidence (<90%)`);
      console.log(`    Got: ${(similarity.confidence * 100).toFixed(1)}%`);
    }
  }
}

console.log('\n\n' + '='.repeat(60));
console.log('🏁 Testing Complete\n');
