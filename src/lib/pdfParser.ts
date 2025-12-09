export interface PDFExtractionResult {
  text: string;
  pages: number;
  info: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
  };
}

export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  try {
    // Use pdfjs-dist directly instead of pdf-parse for browser compatibility
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up the worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: typedArray });
    const pdf = await loadingTask.promise;

    // Extract metadata
    const metadata = await pdf.getMetadata();
    const info = metadata.info || {};

    // Extract text from all pages
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return {
      text: fullText,
      pages: pdf.numPages,
      info: {
        Title: info.Title,
        Author: info.Author,
        Subject: info.Subject,
        Creator: info.Creator,
        Producer: info.Producer,
        CreationDate: info.CreationDate,
      },
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${(error as Error).message}`);
  }
}

export function cleanPDFText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export interface PDFFieldPattern {
  fieldName: string;
  pattern?: RegExp;
  keywords?: string[];
  extractionMethod?: 'regex' | 'keyword' | 'ai';
}

export function extractFieldByPattern(
  text: string,
  pattern: PDFFieldPattern
): string | null {
  if (pattern.pattern) {
    const match = text.match(pattern.pattern);
    return match ? match[1] || match[0] : null;
  }

  if (pattern.keywords && pattern.keywords.length > 0) {
    const lines = extractLines(text);
    for (const keyword of pattern.keywords) {
      const keywordLower = keyword.toLowerCase();
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        if (lineLower.includes(keywordLower)) {
          const parts = line.split(':');
          if (parts.length > 1) {
            return parts[1].trim();
          }
          return line.replace(new RegExp(keyword, 'i'), '').trim();
        }
      }
    }
  }

  return null;
}

export function extractTableData(text: string): string[][] {
  const lines = extractLines(text);
  const tableData: string[][] = [];

  for (const line of lines) {
    const cells = line.split(/\s{2,}|\t/).filter(cell => cell.trim().length > 0);

    if (cells.length > 1) {
      tableData.push(cells);
    }
  }

  return tableData;
}

export interface SalesDataPattern {
  datePatterns: RegExp[];
  quantityPatterns: RegExp[];
  revenuePatterns: RegExp[];
  accountPatterns: RegExp[];
  productPatterns: RegExp[];
  representativePatterns: RegExp[];
}

export function getDefaultSalesPatterns(): SalesDataPattern {
  return {
    datePatterns: [
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
    ],
    quantityPatterns: [
      /(?:qty|quantity|units|cases|boxes|pcs|pieces)[:\s]+([\d,]+)/gi,
      /\b(\d+)\s+(?:units|cases|boxes|pcs|pieces)\b/gi,
    ],
    revenuePatterns: [
      /\$\s*([\d,]+\.\d{2})/g,
      /(?:total|amount|price|revenue)[:\s]+\$?\s*([\d,]+\.\d{2})/gi,
    ],
    accountPatterns: [
      /(?:account|customer|client|sold\s+to)[:\s]+([^\n]+)/gi,
      /(?:ship\s+to|bill\s+to)[:\s]+([^\n]+)/gi,
    ],
    productPatterns: [
      /(?:product|item|sku|part)[:\s#]+([^\n]+)/gi,
    ],
    representativePatterns: [
      /(?:rep|representative|sales\s+rep|salesperson|sold\s+by)[:\s]+([^\n]+)/gi,
    ],
  };
}

export interface ExtractedSalesRow {
  date?: string;
  account?: string;
  product?: string;
  representative?: string;
  quantity?: number;
  revenue?: number;
  confidence: number;
  rawText?: string;
}

export function extractSalesDataFromTable(tableData: string[][]): ExtractedSalesRow[] {
  if (tableData.length < 2) return [];

  const headers = tableData[0].map(h => h.toLowerCase().trim());
  const rows = tableData.slice(1);

  const columnMap = detectTableColumns(headers);
  const results: ExtractedSalesRow[] = [];

  for (const row of rows) {
    if (row.length === 0) continue;

    const extracted: ExtractedSalesRow = { confidence: 0 };
    let fieldCount = 0;

    if (columnMap.date !== -1 && row[columnMap.date]) {
      extracted.date = row[columnMap.date].trim();
      fieldCount++;
    }

    if (columnMap.account !== -1 && row[columnMap.account]) {
      extracted.account = row[columnMap.account].trim();
      fieldCount++;
    }

    if (columnMap.product !== -1 && row[columnMap.product]) {
      extracted.product = row[columnMap.product].trim();
      fieldCount++;
    }

    if (columnMap.representative !== -1 && row[columnMap.representative]) {
      extracted.representative = row[columnMap.representative].trim();
      fieldCount++;
    }

    if (columnMap.quantity !== -1 && row[columnMap.quantity]) {
      const qtyStr = row[columnMap.quantity].replace(/[^\d.]/g, '');
      const qty = parseFloat(qtyStr);
      if (!isNaN(qty)) {
        extracted.quantity = qty;
        fieldCount++;
      }
    }

    if (columnMap.revenue !== -1 && row[columnMap.revenue]) {
      const revStr = row[columnMap.revenue].replace(/[^\d.]/g, '');
      const rev = parseFloat(revStr);
      if (!isNaN(rev)) {
        extracted.revenue = rev;
        fieldCount++;
      }
    }

    extracted.confidence = fieldCount / 5;
    extracted.rawText = row.join(' | ');

    if (fieldCount >= 3) {
      results.push(extracted);
    }
  }

  return results;
}

function detectTableColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {
    date: -1,
    account: -1,
    product: -1,
    representative: -1,
    quantity: -1,
    revenue: -1,
  };

  const patterns: Record<string, RegExp[]> = {
    date: [/date/i, /invoice/i, /order.*date/i, /ship.*date/i],
    account: [/account/i, /customer/i, /client/i, /sold.*to/i, /ship.*to/i],
    product: [/product/i, /item/i, /sku/i, /part/i, /material/i, /description/i],
    representative: [/rep/i, /sales.*rep/i, /representative/i, /salesperson/i, /agent/i],
    quantity: [/qty/i, /quantity/i, /units/i, /cases/i, /boxes/i, /count/i],
    revenue: [/amount/i, /total/i, /price/i, /revenue/i, /sales/i, /extended/i],
  };

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    for (const [fieldType, patternList] of Object.entries(patterns)) {
      if (map[fieldType] === -1) {
        for (const pattern of patternList) {
          if (pattern.test(header)) {
            map[fieldType] = i;
            break;
          }
        }
      }
    }
  }

  return map;
}

export function extractSalesDataByPatterns(
  text: string,
  patterns: SalesDataPattern = getDefaultSalesPatterns()
): ExtractedSalesRow[] {
  const lines = extractLines(text);
  const results: ExtractedSalesRow[] = [];

  for (const line of lines) {
    if (line.length < 10) continue;

    const extracted: ExtractedSalesRow = { confidence: 0, rawText: line };
    let fieldCount = 0;

    for (const datePattern of patterns.datePatterns) {
      const matches = line.match(datePattern);
      if (matches && matches[0]) {
        extracted.date = matches[0];
        fieldCount++;
        break;
      }
    }

    for (const revenuePattern of patterns.revenuePatterns) {
      const matches = [...line.matchAll(revenuePattern)];
      if (matches.length > 0) {
        const revStr = matches[matches.length - 1][1] || matches[matches.length - 1][0];
        const rev = parseFloat(revStr.replace(/[^\d.]/g, ''));
        if (!isNaN(rev)) {
          extracted.revenue = rev;
          fieldCount++;
        }
        break;
      }
    }

    for (const quantityPattern of patterns.quantityPatterns) {
      const matches = [...line.matchAll(quantityPattern)];
      if (matches.length > 0) {
        const qtyStr = matches[0][1] || matches[0][0];
        const qty = parseFloat(qtyStr.replace(/[^\d.]/g, ''));
        if (!isNaN(qty)) {
          extracted.quantity = qty;
          fieldCount++;
        }
        break;
      }
    }

    for (const accountPattern of patterns.accountPatterns) {
      const matches = [...line.matchAll(accountPattern)];
      if (matches.length > 0) {
        extracted.account = (matches[0][1] || matches[0][0]).trim();
        fieldCount++;
        break;
      }
    }

    for (const productPattern of patterns.productPatterns) {
      const matches = [...line.matchAll(productPattern)];
      if (matches.length > 0) {
        extracted.product = (matches[0][1] || matches[0][0]).trim();
        fieldCount++;
        break;
      }
    }

    for (const repPattern of patterns.representativePatterns) {
      const matches = [...line.matchAll(repPattern)];
      if (matches.length > 0) {
        extracted.representative = (matches[0][1] || matches[0][0]).trim();
        fieldCount++;
        break;
      }
    }

    extracted.confidence = fieldCount / 5;

    if (fieldCount >= 3) {
      results.push(extracted);
    }
  }

  return results;
}

export function detectDistributorFromPDF(text: string, distributorNames: string[]): string | null {
  const textLower = text.toLowerCase();
  const firstPage = text.substring(0, Math.min(2000, text.length)).toLowerCase();

  for (const distributorName of distributorNames) {
    const nameLower = distributorName.toLowerCase();

    if (firstPage.includes(nameLower)) {
      return distributorName;
    }

    const words = nameLower.split(' ');
    if (words.length > 1) {
      const matchCount = words.filter(word => firstPage.includes(word)).length;
      if (matchCount >= Math.ceil(words.length * 0.7)) {
        return distributorName;
      }
    }
  }

  return null;
}
