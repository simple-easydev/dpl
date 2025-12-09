import { parseDate, parseNumber } from './fileParser';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fieldScores: Record<string, number>;
  overallScore: number;
}

export interface ValidationError {
  field: string;
  message: string;
  rowIndex?: number;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  rowIndex?: number;
  value?: any;
}

export interface SalesDataRow {
  date?: any;
  account?: string;
  product?: string;
  representative?: string;
  quantity?: any;
  revenue?: any;
  [key: string]: any;
}

export function validateSalesData(
  rows: SalesDataRow[],
  requiredFields: string[] = ['date', 'account', 'product', 'revenue']
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const fieldScores: Record<string, number> = {
    date: 0,
    account: 0,
    product: 0,
    representative: 0,
    quantity: 0,
    revenue: 0,
  };

  if (rows.length === 0) {
    errors.push({
      field: 'general',
      message: 'No data rows provided for validation',
    });
    return {
      isValid: false,
      errors,
      warnings,
      fieldScores,
      overallScore: 0,
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors = validateRow(row, requiredFields, i);
    errors.push(...rowErrors.errors);
    warnings.push(...rowErrors.warnings);

    Object.keys(fieldScores).forEach(field => {
      if (rowErrors.fieldPresent[field]) {
        fieldScores[field]++;
      }
    });
  }

  Object.keys(fieldScores).forEach(field => {
    fieldScores[field] = fieldScores[field] / rows.length;
  });

  const overallScore = calculateOverallScore(fieldScores, requiredFields);
  const isValid = errors.length === 0 && overallScore >= 0.6;

  return {
    isValid,
    errors,
    warnings,
    fieldScores,
    overallScore,
  };
}

function validateRow(
  row: SalesDataRow,
  requiredFields: string[],
  rowIndex: number
): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fieldPresent: Record<string, boolean>;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const fieldPresent: Record<string, boolean> = {};

  const dateValue = row.date;
  const accountValue = row.account;
  const productValue = row.product;
  const representativeValue = row.representative;
  const quantityValue = row.quantity;
  const revenueValue = row.revenue;

  if (requiredFields.includes('date')) {
    if (!dateValue || dateValue === '') {
      errors.push({
        field: 'date',
        message: 'Date is required but missing',
        rowIndex,
        value: dateValue,
      });
      fieldPresent.date = false;
    } else {
      const parsedDate = parseDate(dateValue);
      if (!parsedDate) {
        errors.push({
          field: 'date',
          message: 'Date value is not a valid date format',
          rowIndex,
          value: dateValue,
        });
        fieldPresent.date = false;
      } else if (parsedDate > new Date()) {
        warnings.push({
          field: 'date',
          message: 'Date is in the future',
          rowIndex,
          value: dateValue,
        });
        fieldPresent.date = true;
      } else if (parsedDate < new Date('1900-01-01')) {
        warnings.push({
          field: 'date',
          message: 'Date is suspiciously old',
          rowIndex,
          value: dateValue,
        });
        fieldPresent.date = true;
      } else {
        fieldPresent.date = true;
      }
    }
  }

  if (requiredFields.includes('account')) {
    if (!accountValue || String(accountValue).trim() === '') {
      errors.push({
        field: 'account',
        message: 'Account name is required but missing',
        rowIndex,
        value: accountValue,
      });
      fieldPresent.account = false;
    } else {
      const accountStr = String(accountValue).trim();
      if (accountStr.length < 2) {
        warnings.push({
          field: 'account',
          message: 'Account name is too short (less than 2 characters)',
          rowIndex,
          value: accountValue,
        });
        fieldPresent.account = false;
      } else if (accountStr.length > 200) {
        warnings.push({
          field: 'account',
          message: 'Account name is unusually long',
          rowIndex,
          value: accountValue,
        });
        fieldPresent.account = true;
      } else {
        fieldPresent.account = true;
      }
    }
  }

  if (requiredFields.includes('product')) {
    if (!productValue || String(productValue).trim() === '') {
      errors.push({
        field: 'product',
        message: 'Product name is required but missing',
        rowIndex,
        value: productValue,
      });
      fieldPresent.product = false;
    } else {
      const productStr = String(productValue).trim();
      if (productStr.length < 2) {
        warnings.push({
          field: 'product',
          message: 'Product name is too short (less than 2 characters)',
          rowIndex,
          value: productValue,
        });
        fieldPresent.product = false;
      } else if (productStr.length > 200) {
        warnings.push({
          field: 'product',
          message: 'Product name is unusually long',
          rowIndex,
          value: productValue,
        });
        fieldPresent.product = true;
      } else {
        fieldPresent.product = true;
      }
    }
  }

  if (representativeValue && String(representativeValue).trim() !== '') {
    fieldPresent.representative = true;
  } else {
    fieldPresent.representative = false;
  }

  if (quantityValue !== undefined && quantityValue !== null && quantityValue !== '') {
    const parsedQty = parseNumber(quantityValue);
    if (parsedQty === null) {
      warnings.push({
        field: 'quantity',
        message: 'Quantity value is not a valid number',
        rowIndex,
        value: quantityValue,
      });
      fieldPresent.quantity = false;
    } else if (parsedQty <= 0) {
      warnings.push({
        field: 'quantity',
        message: 'Quantity is zero or negative',
        rowIndex,
        value: quantityValue,
      });
      fieldPresent.quantity = false;
    } else if (parsedQty > 1000000) {
      warnings.push({
        field: 'quantity',
        message: 'Quantity is unusually large',
        rowIndex,
        value: quantityValue,
      });
      fieldPresent.quantity = true;
    } else {
      fieldPresent.quantity = true;
    }
  } else {
    fieldPresent.quantity = false;
  }

  if (requiredFields.includes('revenue')) {
    if (!revenueValue && revenueValue !== 0) {
      errors.push({
        field: 'revenue',
        message: 'Revenue is required but missing',
        rowIndex,
        value: revenueValue,
      });
      fieldPresent.revenue = false;
    } else {
      const parsedRevenue = parseNumber(revenueValue);
      if (parsedRevenue === null) {
        errors.push({
          field: 'revenue',
          message: 'Revenue value is not a valid number',
          rowIndex,
          value: revenueValue,
        });
        fieldPresent.revenue = false;
      } else if (parsedRevenue < 0) {
        warnings.push({
          field: 'revenue',
          message: 'Revenue is negative',
          rowIndex,
          value: revenueValue,
        });
        fieldPresent.revenue = false;
      } else if (parsedRevenue === 0) {
        warnings.push({
          field: 'revenue',
          message: 'Revenue is zero',
          rowIndex,
          value: revenueValue,
        });
        fieldPresent.revenue = false;
      } else if (parsedRevenue > 10000000) {
        warnings.push({
          field: 'revenue',
          message: 'Revenue is unusually large',
          rowIndex,
          value: revenueValue,
        });
        fieldPresent.revenue = true;
      } else {
        fieldPresent.revenue = true;
      }
    }
  }

  return { errors, warnings, fieldPresent };
}

function calculateOverallScore(
  fieldScores: Record<string, number>,
  requiredFields: string[]
): number {
  const weights: Record<string, number> = {
    date: 0.25,
    account: 0.25,
    product: 0.25,
    revenue: 0.25,
    quantity: 0.1,
    representative: 0.05,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  requiredFields.forEach(field => {
    const weight = weights[field] || 0.1;
    totalWeight += weight;
    weightedScore += fieldScores[field] * weight;
  });

  Object.keys(fieldScores).forEach(field => {
    if (!requiredFields.includes(field) && fieldScores[field] > 0) {
      const weight = weights[field] || 0.05;
      totalWeight += weight;
      weightedScore += fieldScores[field] * weight;
    }
  });

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

export function detectDuplicateRows(rows: SalesDataRow[]): number[][] {
  const duplicates: number[][] = [];
  const seen = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = generateRowKey(row);

    if (seen.has(key)) {
      const indices = seen.get(key)!;
      indices.push(i);
      if (indices.length === 2) {
        duplicates.push(indices);
      }
    } else {
      seen.set(key, [i]);
    }
  }

  return duplicates;
}

function generateRowKey(row: SalesDataRow): string {
  const date = row.date ? String(row.date).trim().toLowerCase() : '';
  const account = row.account ? String(row.account).trim().toLowerCase() : '';
  const product = row.product ? String(row.product).trim().toLowerCase() : '';
  const revenue = row.revenue ? String(row.revenue).trim() : '';

  return `${date}|${account}|${product}|${revenue}`;
}

export function summarizeValidation(result: ValidationResult): string {
  const { isValid, errors, warnings, overallScore } = result;

  if (isValid && errors.length === 0 && warnings.length === 0) {
    return `Data validation passed successfully with ${(overallScore * 100).toFixed(0)}% quality score.`;
  }

  const parts: string[] = [];

  if (errors.length > 0) {
    parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''} found`);
  }

  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''} found`);
  }

  parts.push(`Quality score: ${(overallScore * 100).toFixed(0)}%`);

  return parts.join(', ');
}

export function getTopValidationIssues(
  errors: ValidationError[],
  warnings: ValidationWarning[],
  limit: number = 5
): string[] {
  const issues: string[] = [];

  const errorsByField = errors.reduce((acc, err) => {
    acc[err.field] = (acc[err.field] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(errorsByField)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .forEach(([field, count]) => {
      issues.push(`${field}: ${count} error${count > 1 ? 's' : ''}`);
    });

  const warningsByField = warnings.reduce((acc, warn) => {
    acc[warn.field] = (acc[warn.field] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(warningsByField)
    .sort(([, a], [, b]) => b - a)
    .slice(0, Math.max(0, limit - issues.length))
    .forEach(([field, count]) => {
      issues.push(`${field}: ${count} warning${count > 1 ? 's' : ''}`);
    });

  return issues;
}
