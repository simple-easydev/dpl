import { supabase } from './supabase';

export interface FieldSynonym {
  id: string;
  field_type: string;
  synonym: string;
  organization_id: string | null;
  confidence_weight: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getAllSynonyms(organizationId: string): Promise<FieldSynonym[]> {
  const { data: globalSynonyms } = await supabase
    .from('field_synonyms')
    .select('*')
    .is('organization_id', null)
    .eq('is_active', true)
    .order('field_type')
    .order('usage_count', { ascending: false });

  const { data: orgSynonyms } = await supabase
    .from('field_synonyms')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('field_type')
    .order('usage_count', { ascending: false });

  return [...(globalSynonyms || []), ...(orgSynonyms || [])];
}

export async function getSynonymsByFieldType(
  fieldType: string,
  organizationId: string
): Promise<FieldSynonym[]> {
  const { data: globalSynonyms } = await supabase
    .from('field_synonyms')
    .select('*')
    .eq('field_type', fieldType)
    .is('organization_id', null)
    .eq('is_active', true)
    .order('usage_count', { ascending: false });

  const { data: orgSynonyms } = await supabase
    .from('field_synonyms')
    .select('*')
    .eq('field_type', fieldType)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('usage_count', { ascending: false });

  return [...(globalSynonyms || []), ...(orgSynonyms || [])];
}

export async function addCustomSynonym(
  fieldType: string,
  synonym: string,
  organizationId: string,
  confidenceWeight: number = 1.0
): Promise<{ success: boolean; error?: string }> {
  const normalizedSynonym = synonym.trim().toLowerCase();

  if (!normalizedSynonym) {
    return { success: false, error: 'Synonym cannot be empty' };
  }

  const validFieldTypes = [
    'quantity',
    'revenue',
    'date',
    'account',
    'product',
    'order_id',
    'category',
    'region',
    'distributor',
    'representative',
    'date_of_sale',
  ];

  if (!validFieldTypes.includes(fieldType)) {
    return { success: false, error: 'Invalid field type' };
  }

  const { data: existing } = await supabase
    .from('field_synonyms')
    .select('id')
    .eq('field_type', fieldType)
    .eq('synonym', normalizedSynonym)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'This synonym already exists for your organization' };
  }

  const { error } = await supabase.from('field_synonyms').insert({
    field_type: fieldType,
    synonym: normalizedSynonym,
    organization_id: organizationId,
    confidence_weight: confidenceWeight,
    is_active: true,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deactivateSynonym(
  synonymId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('field_synonyms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', synonymId)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getMappingHistory(
  organizationId: string,
  limit: number = 20
): Promise<any[]> {
  const { data } = await supabase
    .from('column_mapping_history')
    .select(`
      *,
      upload:uploads(filename, created_at),
      distributor:distributors(name, state)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getMappingStatistics(organizationId: string): Promise<{
  totalMappings: number;
  averageConfidence: number;
  averageSuccessRate: number;
  detectionMethods: Record<string, number>;
  topSynonyms: Array<{ synonym: string; field_type: string; usage_count: number }>;
}> {
  const { data: mappings } = await supabase
    .from('column_mapping_history')
    .select('confidence_score, success_rate, detection_method')
    .eq('organization_id', organizationId);

  const { data: synonyms } = await supabase
    .from('field_synonyms')
    .select('synonym, field_type, usage_count')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .limit(10);

  const detectionMethods: Record<string, number> = {};
  let totalConfidence = 0;
  let totalSuccessRate = 0;

  (mappings || []).forEach((m) => {
    detectionMethods[m.detection_method] = (detectionMethods[m.detection_method] || 0) + 1;
    totalConfidence += m.confidence_score || 0;
    totalSuccessRate += m.success_rate || 0;
  });

  return {
    totalMappings: mappings?.length || 0,
    averageConfidence: mappings?.length ? totalConfidence / mappings.length : 0,
    averageSuccessRate: mappings?.length ? totalSuccessRate / mappings.length : 0,
    detectionMethods,
    topSynonyms: synonyms || [],
  };
}

export const FIELD_TYPE_DESCRIPTIONS: Record<string, string> = {
  quantity: 'Number of units sold (Cases, Units, Qty, Boxes, etc.)',
  revenue: 'Sale amount or revenue (Amount, Total, Sales, Extended Price, etc.)',
  date: 'Transaction or order date (Order Date, Invoice Date, Sale Date, etc.)',
  account: 'Customer or account name (Customer, Account, Client, Ship To, etc.)',
  product: 'Product or item identifier (Product, Item, SKU, Part Number, etc.)',
  order_id: 'Order or transaction ID (Order ID, Invoice Number, Transaction ID, etc.)',
  category: 'Product category or type (Category, Type, Class, etc.)',
  region: 'Geographic region or territory (Region, Territory, Zone, State, etc.)',
  distributor: 'Distributor or vendor name (Distributor, Vendor, Supplier, etc.)',
  representative: 'Sales representative (Rep, Salesperson, Account Manager, etc.)',
  date_of_sale: 'Actual sale date if different from order date',
};
