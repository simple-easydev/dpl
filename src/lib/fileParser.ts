import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedFileData {
  rows: any[];
  headers: string[];
  parsingWarnings?: {
    totalRowsInFile: number;
    successfullyParsed: number;
    skippedRows: number;
    errors: Array<{
      row: number;
      message: string;
      data?: any;
    }>;
    repairAttempted?: boolean;
    repairSuccessful?: boolean;
  };
}

export async function parseFile(file: File): Promise<ParsedFileData> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  } else if (extension === 'txt') {
    return parseText(file);
  } else {
    throw new Error('Unsupported file format. Please upload CSV, XLSX, or TXT files.');
  }
}

export async function parseFileAsText(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return readTextFile(file);
  } else if (extension === 'csv') {
    return readTextFile(file);
  } else if (extension === 'json') {
    return readTextFile(file);
  } else {
    throw new Error('File type not supported for text extraction. Please use TXT, CSV, or JSON files.');
  }
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text || '');
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

async function parseText(file: File): Promise<ParsedFileData> {
  const text = await readTextFile(file);
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  const rows = lines.map((line, index) => ({
    line_number: index + 1,
    content: line.trim(),
  }));

  return {
    rows,
    headers: ['line_number', 'content'],
  };
}

async function detectCSVHeaders(text: string): Promise<{ found: boolean; preview: string }> {
  const cleanedText = text.replace(/^\uFEFF/, '').trim();

  if (cleanedText.length === 0) {
    return { found: false, preview: '(File is empty)' };
  }

  const lines = cleanedText.split(/\r?\n/);
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return { found: false, preview: '(File contains only blank lines)' };
  }

  const firstLine = nonEmptyLines[0].trim();
  const preview = nonEmptyLines.slice(0, 3).join('\n');

  const delimiters = [',', ';', '\t', '|'];
  let foundDelimiter = false;

  for (const delimiter of delimiters) {
    if (firstLine.includes(delimiter)) {
      foundDelimiter = true;
      const parts = firstLine.split(delimiter);
      const nonEmptyParts = parts.filter(p => p.trim().length > 0);

      // Valid CSV headers need at least 2 non-empty columns
      // Allow trailing empty columns (common in CSV files with trailing commas)
      if (parts.length > 1 && nonEmptyParts.length >= 2) {
        console.log(`✓ CSV headers detected using delimiter '${delimiter === '\t' ? '\\t' : delimiter}': ${nonEmptyParts.join(', ')}`);
        return { found: true, preview };
      }
    }
  }

  if (!foundDelimiter) {
    return {
      found: false,
      preview: `First line: "${firstLine}"\n\nNo standard CSV delimiter (comma, semicolon, tab, or pipe) detected.`
    };
  }

  return {
    found: false,
    preview: `First line: "${firstLine}"\n\nDelimiters found but could not parse valid headers.`
  };
}

async function parseCSV(file: File): Promise<ParsedFileData> {
  const text = await readTextFile(file);

  return new Promise((resolve, reject) => {
    const parsingErrors: Array<{ row: number; message: string; data?: any }> = [];
    const totalRows = 0;

    Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '',
      delimitersToGuess: [',', ';', '\t', '|'],
      transformHeader: (header: string) => {
        return header.trim().replace(/\r/g, '').replace(/\n/g, '').replace(/^\uFEFF/, '');
      },
      dynamicTyping: false,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const allRows = results.data as any[];

        console.log('📊 CSV Parse Complete:');
        console.log('  - Headers detected:', headers);
        console.log('  - Total rows parsed:', allRows.length);
        console.log('  - Parsing errors:', results.errors.length);

        if (headers.length === 0) {
          reject(new Error(
            'No column headers detected in CSV file.\n\n' +
            'Please ensure your CSV file has:\n' +
            '- A header row with column names in the first row\n' +
            '- Standard delimiters (comma, semicolon, tab, or pipe)\n' +
            '- Proper UTF-8 encoding if using special characters'
          ));
          return;
        }

        // Filter out summary rows (rows starting with TOTAL, SUBTOTAL, etc.)
        const validRows = allRows.filter((row, index) => {
          if (!row) return false;

          // Check if this is a summary row
          const firstValue = Object.values(row)[0];
          const firstValueStr = String(firstValue || '').trim().toUpperCase();
          if (firstValueStr === 'TOTAL' || firstValueStr === 'SUBTOTAL' || firstValueStr === 'GRAND TOTAL') {
            console.log(`  ⏭️  Skipped summary row ${index + 1}:`, firstValueStr);
            return false;
          }

          // Check if row has any non-empty values
          const hasData = Object.values(row).some(
            val => val !== null && val !== undefined && val !== ''
          );
          return hasData;
        });

        // Track parsing errors from PapaParse
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach((error: any) => {
            parsingErrors.push({
              row: error.row || 0,
              message: error.message,
              data: error.row
            });
          });
        }

        if (validRows.length === 0 && parsingErrors.length > 0) {
          reject(new Error(
            `CSV parsing failed: ${parsingErrors[0].message}\n\n` +
            `Found ${parsingErrors.length} parsing error(s).\n` +
            `Row ${parsingErrors[0].row}: ${parsingErrors[0].message}\n\n` +
            `Please check your CSV file formatting. Common issues:\n` +
            `- Inconsistent number of columns\n` +
            `- Extra commas or delimiters\n` +
            `- Special characters in data\n` +
            `- Missing quotes around text with commas`
          ));
          return;
        }

        const parsingWarnings = parsingErrors.length > 0 ? {
          totalRowsInFile: allRows.length,
          successfullyParsed: validRows.length,
          skippedRows: parsingErrors.length,
          errors: parsingErrors.slice(0, 10)
        } : undefined;

        if (parsingErrors.length > 0) {
          console.warn(`⚠️ CSV parsing completed with ${parsingErrors.length} skipped row(s)`);
          console.warn(`   Successfully parsed: ${validRows.length} rows`);
        }

        console.log('✅ CSV parsing successful - returning', validRows.length, 'rows with headers:', headers);

        resolve({
          rows: validRows,
          headers,
          parsingWarnings
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: null
        });

        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }

        const rows = jsonData.filter((row: any) => {
          return Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        });

        const headers = Object.keys(jsonData[0] as object);

        resolve({ rows, headers });
      } catch (error) {
        reject(new Error(`Excel parsing error: ${(error as Error).message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function parseDate(dateValue: any): Date | null {
  if (!dateValue) return null;

  let parsedDate: Date | null = null;

  if (dateValue instanceof Date) {
    parsedDate = dateValue;
  } else if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    parsedDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
    if (isNaN(parsedDate.getTime())) return null;
  } else if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();

    // Try parsing month-year formats like "Jan 2024", "January 2024"
    const monthYearPattern = /^([A-Za-z]+)\s+(\d{4})$/;
    const monthYearMatch = trimmed.match(monthYearPattern);
    if (monthYearMatch) {
      const monthStr = monthYearMatch[1];
      const year = parseInt(monthYearMatch[2]);
      const monthIndex = parseMonthName(monthStr);
      if (monthIndex !== null) {
        return new Date(Date.UTC(year, monthIndex, 1));
      }
    }

    // Try parsing formats like "01/2024", "1/2024"
    const slashPattern = /^(\d{1,2})\/(\d{4})$/;
    const slashMatch = trimmed.match(slashPattern);
    if (slashMatch) {
      const month = parseInt(slashMatch[1]) - 1;
      const year = parseInt(slashMatch[2]);
      if (month >= 0 && month <= 11) {
        return new Date(Date.UTC(year, month, 1));
      }
    }

    // Try parsing formats like "2024-01", "2024/01"
    const yearMonthPattern = /^(\d{4})[-\/](\d{1,2})$/;
    const yearMonthMatch = trimmed.match(yearMonthPattern);
    if (yearMonthMatch) {
      const year = parseInt(yearMonthMatch[1]);
      const month = parseInt(yearMonthMatch[2]) - 1;
      if (month >= 0 && month <= 11) {
        return new Date(Date.UTC(year, month, 1));
      }
    }

    // Try parsing quarter formats like "Q1 2024", "2024 Q1"
    const quarterPattern = /^(?:Q(\d)\s+(\d{4})|(\d{4})\s+Q(\d))$/i;
    const quarterMatch = trimmed.match(quarterPattern);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1] || quarterMatch[4]);
      const year = parseInt(quarterMatch[2] || quarterMatch[3]);
      if (quarter >= 1 && quarter <= 4) {
        const month = (quarter - 1) * 3;
        return new Date(Date.UTC(year, month, 1));
      }
    }

    // Default: try standard date parsing
    parsedDate = new Date(trimmed);
    if (isNaN(parsedDate.getTime())) {
      console.warn(`Failed to parse date: "${dateValue}"`);
      return null;
    }
  } else {
    return null;
  }

  // Extract only year and month, normalize to first day of month
  // This ensures all dates are stored at month-level granularity
  // Use UTC methods to avoid timezone shifts
  const year = parsedDate.getUTCFullYear();
  const month = parsedDate.getUTCMonth();
  return new Date(Date.UTC(year, month, 1));
}

function parseMonthName(monthStr: string): number | null {
  const monthLower = monthStr.toLowerCase();
  const monthMap: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11,
  };
  return monthMap[monthLower] ?? null;
}

export function parseDateFromMonthYear(month: any, year: any): Date | null {
  if (!month || !year) return null;

  let monthIndex: number | null = null;
  let yearNum: number | null = null;

  // Parse month
  if (typeof month === 'number') {
    monthIndex = month - 1;
  } else if (typeof month === 'string') {
    const trimmed = month.trim();
    const parsed = parseInt(trimmed);
    if (!isNaN(parsed)) {
      monthIndex = parsed - 1;
    } else {
      monthIndex = parseMonthName(trimmed);
    }
  }

  // Parse year
  if (typeof year === 'number') {
    yearNum = year;
  } else if (typeof year === 'string') {
    yearNum = parseInt(year.trim());
  }

  if (monthIndex === null || yearNum === null) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (yearNum < 1900 || yearNum > 2100) return null;

  return new Date(Date.UTC(yearNum, monthIndex, 1));
}

export function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }

  return null;
}

export function cleanString(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function extractPeriodFromFilename(filename: string): string | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(csv|xlsx|xls|txt|pdf)$/i, '');

  // Try pattern: month_year or month-year (jan_2024, january-2024)
  const monthYearPattern = /([a-z]+)[_\-\s](\d{4})/i;
  const monthYearMatch = nameWithoutExt.match(monthYearPattern);
  if (monthYearMatch) {
    const monthStr = monthYearMatch[1];
    const year = monthYearMatch[2];
    const monthIndex = parseMonthName(monthStr);
    if (monthIndex !== null) {
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }
  }

  // Try pattern: year_month or year-month (2024_01, 2024-jan)
  const yearMonthPattern = /(\d{4})[_\-\s]([a-z0-9]+)/i;
  const yearMonthMatch = nameWithoutExt.match(yearMonthPattern);
  if (yearMonthMatch) {
    const year = yearMonthMatch[1];
    const monthStr = yearMonthMatch[2];

    // Try parsing as number first
    const monthNum = parseInt(monthStr);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      return `${year}-${String(monthNum).padStart(2, '0')}`;
    }

    // Try parsing as month name
    const monthIndex = parseMonthName(monthStr);
    if (monthIndex !== null) {
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }
  }

  // Try pattern: YYYYMM (202401, 202412)
  const compactPattern = /(\d{4})(\d{2})/;
  const compactMatch = nameWithoutExt.match(compactPattern);
  if (compactMatch) {
    const year = compactMatch[1];
    const month = parseInt(compactMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  // Try quarter pattern: Q1_2024, 2024_Q1
  const quarterPattern = /(?:Q(\d)[_\-\s](\d{4})|(\d{4})[_\-\s]Q(\d))/i;
  const quarterMatch = nameWithoutExt.match(quarterPattern);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1] || quarterMatch[4]);
    const year = quarterMatch[2] || quarterMatch[3];
    if (quarter >= 1 && quarter <= 4) {
      const month = (quarter - 1) * 3 + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  return null;
}
