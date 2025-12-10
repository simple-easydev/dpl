import OpenAI from 'openai';
import { supabase } from './supabase';

const fallbackApiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!fallbackApiKey) {
  console.warn('No fallback OpenAI API key configured.');
}

export const openai = fallbackApiKey ? new OpenAI({
  apiKey: fallbackApiKey,
  dangerouslyAllowBrowser: true
}) : null;

export async function getOrganizationOpenAI(organizationId: string): Promise<OpenAI | null> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('openai_api_key_encrypted')
    .eq('id', organizationId)
    .maybeSingle();

  if (error || !org || !org.openai_api_key_encrypted) {
    console.warn('No OpenAI API key found for organization. Using fallback or null.');
    return openai;
  }

  try {
    return new OpenAI({
      apiKey: org.openai_api_key_encrypted,
      dangerouslyAllowBrowser: true,
    });
  } catch (err) {
    console.error('Failed to initialize OpenAI client with organization key:', err);
    return openai;
  }
}

export interface ColumnMapping {
  date?: string;
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
}

export async function detectColumnMapping(sampleRows: any[], organizationId?: string): Promise<ColumnMapping> {
  const aiClient = organizationId ? await getOrganizationOpenAI(organizationId) : openai;

  if (!aiClient) {
    return autoDetectColumns(sampleRows);
  }

  try {
    const columns = Object.keys(sampleRows[0] || {});
    const sampleData = sampleRows.slice(0, 3);

    const prompt = `Analyze this sales data and identify which columns correspond to each field.

Columns: ${columns.join(', ')}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Return a JSON object mapping these fields to column names:
- date: column containing order/transaction date
- revenue or amount: column containing sale amount/revenue
- account or customer: column containing customer/account name
- product or sku: column containing product name or SKU
- quantity: column containing quantity sold (may be labeled as QTY, Qty, Units, Cases, Boxes, Pcs, CS, Count, Volume, Pieces, Qnty)
- order_id: column containing order/transaction ID
- category: column containing product category (if exists)
- region: column containing geographic region (if exists)
- distributor: column containing distributor/vendor/supplier name (if exists)
- representative: column containing sales rep/account manager/salesperson name (if exists - may be labeled as Rep, Sales Rep, Salesperson, Agent, Sold By)
- date_of_sale: column containing the actual sale date (if different from order date)

IMPORTANT:
- "QTY" should be mapped to quantity
- "Rep", "Sales Rep", "Salesperson" should be mapped to representative
- Be flexible with abbreviations and variations in column names
- Look at the actual data values to help determine the field type

Only include fields that you can confidently identify. Return only the JSON object, no explanation.`;

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const mapping = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

    return mapping;
  } catch (error) {
    console.error('Error detecting columns with AI:', error);
    return autoDetectColumns(sampleRows);
  }
}

function autoDetectColumns(sampleRows: any[]): ColumnMapping {
  if (sampleRows.length === 0) return {};

  const columns = Object.keys(sampleRows[0]);
  const mapping: ColumnMapping = {};

  const datePatterns = /date|time|day|created|order.*date/i;
  const revenuePatterns = /revenue|amount|total|price|sales|value/i;
  const accountPatterns = /account|customer|client|buyer|company/i;
  const productPatterns = /product|item|sku|name|description/i;
  const quantityPatterns = /quantity|qty|units|count/i;
  const orderIdPatterns = /order.*id|transaction.*id|id/i;
  const categoryPatterns = /category|type|class/i;
  const regionPatterns = /region|location|area|territory|zone/i;
  const distributorPatterns = /distributor|vendor|supplier|wholesaler|dist/i;
  const representativePatterns = /rep|representative|sales.*rep|account.*manager|salesperson|sold.*by|agent/i;
  const saleeDatePatterns = /sale.*date|sold.*date|invoice.*date/i;

  for (const col of columns) {
    if (!mapping.date_of_sale && saleeDatePatterns.test(col)) {
      mapping.date_of_sale = col;
    }
    if (!mapping.date && datePatterns.test(col)) {
      mapping.date = col;
    }
    if (!mapping.revenue && revenuePatterns.test(col)) {
      mapping.revenue = col;
    }
    if (!mapping.account && accountPatterns.test(col)) {
      mapping.account = col;
    }
    if (!mapping.product && productPatterns.test(col)) {
      mapping.product = col;
    }
    if (!mapping.quantity && quantityPatterns.test(col)) {
      mapping.quantity = col;
    }
    if (!mapping.order_id && orderIdPatterns.test(col)) {
      mapping.order_id = col;
    }
    if (!mapping.category && categoryPatterns.test(col)) {
      mapping.category = col;
    }
    if (!mapping.region && regionPatterns.test(col)) {
      mapping.region = col;
    }
    if (!mapping.distributor && distributorPatterns.test(col)) {
      mapping.distributor = col;
    }
    if (!mapping.representative && representativePatterns.test(col)) {
      mapping.representative = col;
    }
  }

  return mapping;
}

export interface ExtractedDataItem {
  distributor: string;
  account_name: string;
  product_name: string;
  quantity: string;
  date: string;
  representative: string;
}

export interface ExtractionResult {
  data: ExtractedDataItem[];
  confidence_score: number;
  raw_response: any;
}

export interface AITrainingConfiguration {
  field_mappings?: Record<string, any>;
  parsing_instructions?: string;
  orientation?: string;
}

export async function extractStructuredData(
  documentText: string,
  organizationId?: string,
  documentType?: string,
  aiConfig?: AITrainingConfiguration
): Promise<ExtractionResult> {
  const aiClient = organizationId ? await getOrganizationOpenAI(organizationId) : openai;

  if (!aiClient) {
    return fallbackExtraction(documentText);
  }

  try {
    let prompt = `You are an AI data extraction assistant specialized in extracting sales transaction data from documents.

When a user provides a document, your job is to:
1. Read the document carefully.
2. Identify and extract all relevant sales and depletion information.
3. Output the data as structured JSON that can be saved into the depletion tracking database.

Follow this format for your response:
[
  {
    "distributor": "",
    "account_name": "",
    "product_name": "",
    "quantity": "",
    "date": "",
    "representative": ""
  }
]

FIELD EXTRACTION GUIDELINES:

1. QUANTITY: Look for numbers associated with:
   - "QTY", "Qty", "Quantity"
   - "Units", "Cases", "Boxes"
   - "Pcs", "Pieces", "CS"
   - "Count", "Volume"
   - Any number followed by unit indicators

2. REPRESENTATIVE: Look for person names near:
   - "Rep", "Sales Rep", "Representative"
   - "Salesperson", "Sales Person"
   - "Account Manager", "Territory Manager"
   - "Sold By", "Sales Agent"
   - Any person's name in a sales context

3. ACCOUNT/CUSTOMER: Look for company or business names near:
   - "Account", "Customer", "Client"
   - "Sold To", "Ship To", "Bill To"
   - "Buyer", "Purchaser"

4. PRODUCT: Look for product information near:
   - "Product", "Item", "SKU"
   - "Part Number", "Item Number"
   - "Description", "Product Name"

5. DATE: Look for dates in various formats:
   - MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
   - "Order Date", "Sale Date", "Invoice Date"
   - "Transaction Date", "Ship Date"

6. DISTRIBUTOR: Look for the main company name (usually at the top):
   - "Distributor", "Vendor", "Supplier"
   - Company letterhead or header information

Rules:
- If any field is missing, leave it blank ("").
- Do not include extra commentary or explanation—just return the JSON array.
- Extract ALL items/products found in the document as separate entries.
- Be thorough and extract every piece of data available.
- Pay special attention to abbreviated field names (QTY, Rep, etc.)
- Look at the context and nearby text to understand what each value represents.`;

    if (aiConfig?.parsing_instructions) {
      prompt += `\n\nAI TRAINING INSTRUCTIONS FOR THIS DISTRIBUTOR:
${aiConfig.parsing_instructions}

Please follow these training instructions carefully as they guide how to extract and map depletion data from this distributor's unique file format.`;
    }

    if (aiConfig?.field_mappings && Object.keys(aiConfig.field_mappings).length > 0) {
      prompt += `\n\nFIELD MAPPING HINTS (AI TRAINING DATA):
${JSON.stringify(aiConfig.field_mappings, null, 2)}

Use these learned patterns to help identify where each field is located in the document.`;
    }

    prompt += `\n\nDocument to analyze:
${documentText}`;

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a precise data extraction assistant. Return only valid JSON arrays with no additional text or formatting.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{"data": []}';

    console.log(" content ==>", content)
    let parsed;

    try {
      parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    } catch {
      parsed = { data: [] };
    }

    const data = Array.isArray(parsed) ? parsed : (parsed.data || []);

    const validatedData = data.map((item: any) => ({
      distributor: String(item.distributor || '').trim(),
      account_name: String(item.account_name || '').trim(),
      product_name: String(item.product_name || '').trim(),
      quantity: String(item.quantity || '').trim(),
      date: String(item.date || '').trim(),
      representative: String(item.representative || '').trim(),
    }));

    const confidence_score = calculateConfidenceScore(validatedData);

    console.log(`🤖 AI Extraction Summary:`);
    console.log(`   - Total items extracted: ${validatedData.length}`);
    console.log(`   - Confidence score: ${(confidence_score * 100).toFixed(0)}%`);
    console.log(`   - Training instructions used: ${aiConfig?.parsing_instructions ? 'Yes' : 'No'}`);

    if (validatedData.length > 0) {
      const itemsWithAccount = validatedData.filter(item => item.account_name).length;
      const itemsWithProduct = validatedData.filter(item => item.product_name).length;
      const itemsWithDate = validatedData.filter(item => item.date).length;
      const itemsWithQuantity = validatedData.filter(item => item.quantity).length;

      console.log(`   - Items with account_name: ${itemsWithAccount} (${((itemsWithAccount/validatedData.length)*100).toFixed(0)}%)`);
      console.log(`   - Items with product_name: ${itemsWithProduct} (${((itemsWithProduct/validatedData.length)*100).toFixed(0)}%)`);
      console.log(`   - Items with date: ${itemsWithDate} (${((itemsWithDate/validatedData.length)*100).toFixed(0)}%)`);
      console.log(`   - Items with quantity: ${itemsWithQuantity} (${((itemsWithQuantity/validatedData.length)*100).toFixed(0)}%)`);

      if (itemsWithAccount === 0 || itemsWithProduct === 0) {
        console.warn(`⚠️ WARNING: Critical fields are missing!`);
        if (itemsWithAccount === 0) console.warn(`   - NO account names extracted`);
        if (itemsWithProduct === 0) console.warn(`   - NO product names extracted`);
        console.warn(`💡 TIP: Review your AI training instructions to ensure they specify how to extract these fields`);
      }
    }

    return {
      data: validatedData,
      confidence_score,
      raw_response: parsed,
    };
  } catch (error) {
    console.error('Error extracting structured data with AI:', error);
    return fallbackExtraction(documentText);
  }
}

function calculateConfidenceScore(data: ExtractedDataItem[]): number {
  if (data.length === 0) return 0;

  let totalScore = 0;
  for (const item of data) {
    let itemScore = 0;
    if (item.distributor) itemScore += 0.15;
    if (item.account_name) itemScore += 0.2;
    if (item.product_name) itemScore += 0.3;
    if (item.quantity) itemScore += 0.1;
    if (item.date) itemScore += 0.15;
    if (item.representative) itemScore += 0.1;
    totalScore += itemScore;
  }

  return Math.min(totalScore / data.length, 1);
}

function fallbackExtraction(documentText: string): ExtractionResult {
  const lines = documentText.split('\n').filter(line => line.trim().length > 0);

  const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/;
  const quantityPattern = /\b\d+\s*(pcs|pc|units|qty|quantity|boxes|box)\b/i;
  const repPattern = /(?:rep|representative|sales rep|salesperson|account manager):\s*([A-Za-z\s]+)/i;

  const extractedItems: ExtractedDataItem[] = [];
  let globalRep = '';

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    const quantityMatch = line.match(quantityPattern);
    const repMatch = line.match(repPattern);

    if (repMatch) {
      globalRep = repMatch[1].trim();
    }

    if (line.length > 10) {
      extractedItems.push({
        distributor: '',
        account_name: '',
        product_name: line.slice(0, 100),
        quantity: quantityMatch ? quantityMatch[0] : '',
        date: dateMatch ? dateMatch[0] : '',
        representative: globalRep,
      });
    }
  }

  return {
    data: extractedItems.slice(0, 50),
    confidence_score: 0.3,
    raw_response: { fallback: true },
  };
}

export async function repairCSV(csvText: string): Promise<string | null> {
  const aiClient = openai;

  if (!aiClient) {
    console.warn('No OpenAI client available for CSV repair');
    return null;
  }

  try {
    const prompt = `You are a CSV data repair specialist. The following CSV file has formatting issues that prevent proper parsing.

Your task:
1. Identify and fix formatting issues such as:
   - Inconsistent number of columns across rows
   - Extra or missing delimiters (commas)
   - Unescaped special characters
   - Malformed quoted fields
   - Inconsistent line endings
   - BOM or encoding issues

2. Return a properly formatted CSV with:
   - Consistent number of columns in every row
   - Proper escaping of special characters
   - Valid CSV structure
   - All data preserved (don't remove any information)

3. Maintain the original header row and all data rows

Return ONLY the repaired CSV text, no explanations or markdown formatting.

CSV to repair:
${csvText}`;

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a CSV repair specialist. Return only the repaired CSV text with no additional formatting or explanation.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    });

    const repairedCSV = response.choices[0]?.message?.content || '';

    if (!repairedCSV || repairedCSV.length < 10) {
      console.warn('OpenAI returned empty or invalid CSV repair');
      return null;
    }

    console.log('✅ CSV successfully repaired by OpenAI');
    return repairedCSV;
  } catch (error) {
    console.error('Error repairing CSV with OpenAI:', error);
    return null;
  }
}

export async function generateInsights(
  salesData: {
    totalRevenue: number;
    totalOrders: number;
    topAccounts: Array<{ name: string; revenue: number }>;
    topProducts: Array<{ name: string; revenue: number }>;
    revenueByMonth: Array<{ month: string; revenue: number }>;
  },
  organizationId?: string
): Promise<string[]> {
  const aiClient = organizationId ? await getOrganizationOpenAI(organizationId) : openai;

  if (!aiClient) {
    return [
      'Configure your OpenAI API key in Settings to enable AI-powered insights.',
    ];
  }

  try {
    const prompt = `Analyze this sales data and provide 3-5 key business insights:

Total Revenue: $${salesData.totalRevenue.toLocaleString()}
Total Orders: ${salesData.totalOrders}
Average Order Value: $${(salesData.totalRevenue / salesData.totalOrders).toFixed(2)}

Top 5 Accounts by Revenue:
${salesData.topAccounts.map((a, i) => `${i + 1}. ${a.name}: $${a.revenue.toLocaleString()}`).join('\n')}

Top 5 Products by Revenue:
${salesData.topProducts.map((p, i) => `${i + 1}. ${p.name}: $${p.revenue.toLocaleString()}`).join('\n')}

Revenue by Month (last 6 months):
${salesData.revenueByMonth.map(m => `${m.month}: $${m.revenue.toLocaleString()}`).join('\n')}

Provide actionable insights about:
1. Revenue trends and patterns
2. Customer concentration and risks
3. Product performance
4. Growth opportunities

Return as a JSON array of strings, each being one insight. Keep insights concise and actionable.`;

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const insights = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

    return insights;
  } catch (error) {
    console.error('Error generating insights:', error);
    return [
      'Unable to generate AI insights at this time. Please check your OpenAI API configuration.',
    ];
  }
}
