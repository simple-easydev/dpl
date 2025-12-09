export interface ProductComponents {
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

export interface VolumeInfo {
  value: number;
  unit: string;
  standardizedML: number;
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

const KNOWN_BRANDS: string[] = [
  'avua', 'grey goose', 'gray goose', 'greygoose', 'jack daniels', 'jack daniel',
  'makers mark', 'jim beam', 'johnnie walker', 'johnny walker', 'jose cuervo',
  'patron', 'titos', 'tito\'s', 'dos equis', 'modelo', 'corona', 'bud light',
  'budweiser', 'miller', 'coors', 'heineken', 'stella artois', 'guinness',
  'absolut', 'smirnoff', 'bacardi', 'captain morgan', 'tanqueray', 'bombay',
  'hendricks', 'hendrick\'s', 'ketel one', 'ciroc', 'belvedere', 'skyy',
  'jameson', 'crown royal', 'chivas', 'glenlivet', 'glenfiddich', 'macallan',
  'lagavulin', 'johnnie', 'walker', 'dewar\'s', 'dewars', 'buchanan\'s', 'buchanans',
  'don julio', 'casamigos', 'espolon', 'olmeca', 'sauza', 'cuervo',
  'bacardi', 'havana club', 'diplomatico', 'zacapa', 'appleton', 'brugal',
  'hennessy', 'remy martin', 'courvoisier', 'martell', 'jagermeister',
  'aperol', 'campari', 'cointreau', 'grand marnier', 'kahlua', 'baileys',
  'fireball', 'southern comfort', 'malibu', 'midori', 'pernod', 'sambuca',
  'paladar', 'svol', 'drifter', 'aquavit', 'reposado', 'anejo', 'blanco'
];

const COMMON_BRAND_VARIATIONS: Record<string, string> = {
  'grey goose': 'greygoose',
  'gray goose': 'greygoose',
  'jack daniels': 'jackdaniels',
  'jack daniel': 'jackdaniels',
  'makers mark': 'makersmark',
  'jim beam': 'jimbeam',
  'johnnie walker': 'johnniewalker',
  'johnny walker': 'johnniewalker',
  'jose cuervo': 'josecuervo',
  'patron': 'patron',
  'titos': 'titos',
  'tito\'s': 'titos',
  'dos equis': 'dosequis',
  'modelo especial': 'modeloespecial',
  'corona extra': 'coronaextra',
  'bud light': 'budlight',
  'miller lite': 'millerlite',
  'coors light': 'coorslight',
  'hendrick\'s': 'hendricks',
  'dewar\'s': 'dewars',
  'buchanan\'s': 'buchanans'
};

const COMMON_PRODUCT_TYPES = [
  'vodka', 'whiskey', 'whisky', 'bourbon', 'scotch', 'gin', 'rum', 'tequila',
  'brandy', 'cognac', 'liqueur', 'beer', 'wine', 'champagne', 'prosecco',
  'cachaca', 'mezcal', 'sake', 'soju', 'absinthe', 'vermouth', 'port',
  'sherry', 'amaro', 'aquavit', 'grappa', 'armagnac', 'calvados', 'pisco'
];

export function extractVolume(text: string): VolumeInfo | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|M)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(?:l|L|liter|litre)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(?:oz|ounce)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(?:gal|gallon)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(?:pt|pint)(?:\b|$)/i,
    /(\d+(?:\.\d+)?)\s*(?:qt|quart)(?:\b|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const fullMatch = match[0].toLowerCase();

      let unit = 'ml';
      let conversionFactor = 1;

      if (fullMatch.includes('l') && !fullMatch.includes('ml') && !fullMatch.match(/\d+l/)) {
        unit = 'l';
        conversionFactor = 1000;
      } else if (fullMatch.includes('oz') || fullMatch.includes('ounce')) {
        unit = 'oz';
        conversionFactor = 29.5735;
      } else if (fullMatch.includes('gal')) {
        unit = 'gal';
        conversionFactor = 3785.41;
      } else if (fullMatch.includes('pt') || fullMatch.includes('pint')) {
        unit = 'pt';
        conversionFactor = 473.176;
      } else if (fullMatch.includes('qt') || fullMatch.includes('quart')) {
        unit = 'qt';
        conversionFactor = 946.353;
      } else {
        unit = 'ml';
        conversionFactor = 1;
      }

      return {
        value,
        unit,
        standardizedML: value * conversionFactor
      };
    }
  }

  return null;
}

export function extractPackageCount(text: string): number {
  for (const pattern of PACKAGE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 1;
}

export function normalizeProductName(name: string): string {
  let normalized = name.toLowerCase().trim();

  normalized = normalized.replace(/[^\w\s]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');

  Object.entries(COMMON_BRAND_VARIATIONS).forEach(([original, replacement]) => {
    const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    normalized = normalized.replace(regex, replacement);
  });

  return normalized.trim();
}

export function extractBrand(text: string, tokens: string[]): string {
  const lowerText = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');

  const multiWordBrands = [
    'grey goose', 'gray goose', 'jack daniels', 'jack daniel', 'makers mark',
    'jim beam', 'johnnie walker', 'johnny walker', 'jose cuervo', 'don julio',
    'captain morgan', 'crown royal', 'stella artois', 'dos equis', 'modelo especial',
    'corona extra', 'bud light', 'miller lite', 'coors light', 'havana club',
    'remy martin', 'grand marnier', 'southern comfort', 'ketel one',
    'hendrick\'s', 'hendricks', 'dewar\'s', 'dewars', 'buchanan\'s', 'buchanans'
  ];

  for (const brand of multiWordBrands) {
    const brandWords = brand.split(' ');
    const hasAllWords = brandWords.every(word => lowerText.includes(word));
    if (hasAllWords) {
      return brand.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).replace(/\\/g, '')
      ).join(' ');
    }
  }

  for (const brand of KNOWN_BRANDS) {
    if (brand.length > 3 && lowerText.includes(brand)) {
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }

  const textTokens = lowerText.split(/\s+/).filter(t => t.length > 0);
  for (const token of textTokens) {
    if (token.length > 3 && KNOWN_BRANDS.includes(token)) {
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }

  if (tokens.length >= 2) {
    const firstTwo = tokens.slice(0, 2).join(' ');
    return firstTwo.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  } else if (tokens.length === 1) {
    return tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1);
  }

  return '';
}

export function extractProductType(text: string): string {
  const lowerText = text.toLowerCase();

  for (const type of COMMON_PRODUCT_TYPES) {
    if (lowerText.includes(type)) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  return '';
}

export function tokenizeProductName(name: string): string[] {
  const volumeInfo = extractVolume(name);
  let nameWithoutVolume = name;
  if (volumeInfo) {
    nameWithoutVolume = name.replace(new RegExp(`${volumeInfo.value}\\s*${volumeInfo.unit}`, 'gi'), '');
  }

  for (const pattern of PACKAGE_PATTERNS) {
    nameWithoutVolume = nameWithoutVolume.replace(pattern.regex, '');
  }

  const tokens = nameWithoutVolume
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1)
    .filter(token => !['the', 'a', 'an', 'of', 'for', 'and', 'or'].includes(token));

  return tokens;
}

export function parseProductName(name: string): ProductComponents {
  const tokens = tokenizeProductName(name);
  const volumeInfo = extractVolume(name);
  const packageCount = extractPackageCount(name);
  const brand = extractBrand(name, tokens);
  const productType = extractProductType(name);

  const descriptors = tokens.filter(token =>
    !brand.toLowerCase().includes(token) &&
    !productType.toLowerCase().includes(token)
  );

  return {
    brand,
    productType,
    volume: volumeInfo ? `${volumeInfo.value}${volumeInfo.unit}` : '',
    volumeML: volumeInfo?.standardizedML || null,
    packageCount,
    descriptors,
    originalName: name,
    normalizedName: normalizeProductName(name),
    tokens
  };
}

export function createStandardizedName(components: ProductComponents): string {
  const parts: string[] = [];

  if (components.brand) {
    parts.push(components.brand);
  }

  if (components.productType) {
    parts.push(components.productType);
  }

  if (components.descriptors.length > 0) {
    parts.push(...components.descriptors.slice(0, 2));
  }

  if (components.volumeML) {
    const volumeML = Math.round(components.volumeML);
    parts.push(`${volumeML}mL`);
  }

  if (components.packageCount > 1) {
    parts.push(`${components.packageCount}PK`);
  }

  return parts
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
