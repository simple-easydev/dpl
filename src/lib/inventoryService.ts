import { supabase } from './supabase';

export interface ImporterInventory {
  id: string;
  organization_id: string;
  product_id: string;
  quantity: number;
  updated_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributorInventory {
  id: string;
  organization_id: string;
  product_id: string;
  distributor_id: string;
  initial_quantity: number;
  current_quantity: number;
  last_updated: string;
  created_at: string;
  created_by: string | null;
}

export interface InventoryTransaction {
  id: string;
  organization_id: string;
  product_id: string;
  distributor_id: string | null;
  transaction_type: 'importer_adjustment' | 'distributor_initial' | 'distributor_adjustment' | 'auto_depletion';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export async function getImporterInventory(organizationId: string) {
  const { data, error } = await supabase
    .from('inventory_importer')
    .select(`
      *,
      products (
        id,
        product_name
      )
    `)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching importer inventory:', error);
    return [];
  }

  return data || [];
}

export async function updateImporterInventory(
  organizationId: string,
  productId: string,
  quantity: number,
  notes?: string
) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: existing } = await supabase
    .from('inventory_importer')
    .select('id, quantity')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from('inventory_importer')
      .update({
        quantity,
        notes: notes || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Error updating importer inventory:', updateError);
      return false;
    }

    await logInventoryTransaction({
      organization_id: organizationId,
      product_id: productId,
      distributor_id: null,
      transaction_type: 'importer_adjustment',
      quantity_change: quantity - existing.quantity,
      previous_quantity: existing.quantity,
      new_quantity: quantity,
      notes: notes || null,
      created_by: userId,
    });

    return true;
  } else {
    const { error: insertError } = await supabase
      .from('inventory_importer')
      .insert({
        organization_id: organizationId,
        product_id: productId,
        quantity,
        notes: notes || null,
        updated_by: userId,
      });

    if (insertError) {
      console.error('Error creating importer inventory:', insertError);
      return false;
    }

    await logInventoryTransaction({
      organization_id: organizationId,
      product_id: productId,
      distributor_id: null,
      transaction_type: 'importer_adjustment',
      quantity_change: quantity,
      previous_quantity: 0,
      new_quantity: quantity,
      notes: notes || null,
      created_by: userId,
    });

    return true;
  }
}

export async function getDistributorInventory(organizationId: string, distributorId?: string) {
  let query = supabase
    .from('inventory_distributor')
    .select(`
      *,
      products (
        id,
        product_name
      ),
      distributors (
        id,
        name,
        state
      )
    `)
    .eq('organization_id', organizationId);

  if (distributorId) {
    query = query.eq('distributor_id', distributorId);
  }

  const { data, error } = await query.order('last_updated', { ascending: false });

  if (error) {
    console.error('Error fetching distributor inventory:', error);
    return [];
  }

  return data || [];
}

export async function initializeDistributorInventory(
  organizationId: string,
  productId: string,
  distributorId: string,
  initialQuantity: number
) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: existing } = await supabase
    .from('inventory_distributor')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('distributor_id', distributorId)
    .maybeSingle();

  if (existing) {
    console.warn('Distributor inventory already exists for this product');
    return false;
  }

  const { error: insertError } = await supabase
    .from('inventory_distributor')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      distributor_id: distributorId,
      initial_quantity: initialQuantity,
      current_quantity: initialQuantity,
      created_by: userId,
    });

  if (insertError) {
    console.error('Error initializing distributor inventory:', insertError);
    return false;
  }

  await logInventoryTransaction({
    organization_id: organizationId,
    product_id: productId,
    distributor_id: distributorId,
    transaction_type: 'distributor_initial',
    quantity_change: initialQuantity,
    previous_quantity: 0,
    new_quantity: initialQuantity,
    notes: 'Initial inventory setup',
    created_by: userId,
  });

  return true;
}

export async function adjustDistributorInventory(
  organizationId: string,
  productId: string,
  distributorId: string,
  newQuantity: number,
  notes?: string
) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: existing } = await supabase
    .from('inventory_distributor')
    .select('id, current_quantity')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('distributor_id', distributorId)
    .maybeSingle();

  if (!existing) {
    console.error('Distributor inventory not found');
    return false;
  }

  const { error: updateError } = await supabase
    .from('inventory_distributor')
    .update({
      current_quantity: newQuantity,
      last_updated: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (updateError) {
    console.error('Error adjusting distributor inventory:', updateError);
    return false;
  }

  await logInventoryTransaction({
    organization_id: organizationId,
    product_id: productId,
    distributor_id: distributorId,
    transaction_type: 'distributor_adjustment',
    quantity_change: newQuantity - existing.current_quantity,
    previous_quantity: existing.current_quantity,
    new_quantity: newQuantity,
    notes: notes || null,
    created_by: userId,
  });

  return true;
}

export async function deductFromDistributorInventory(
  organizationId: string,
  productId: string,
  distributorId: string,
  quantityToDeduct: number,
  salesDataId: string
) {
  const { data: existing } = await supabase
    .from('inventory_distributor')
    .select('id, current_quantity')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('distributor_id', distributorId)
    .maybeSingle();

  if (!existing) {
    console.warn(`No inventory record found for product ${productId} at distributor ${distributorId}`);
    await supabase
      .from('sales_data')
      .update({
        inventory_processed: false,
        inventory_processed_at: new Date().toISOString(),
      })
      .eq('id', salesDataId);
    return false;
  }

  const newQuantity = existing.current_quantity - quantityToDeduct;

  const { error: updateError } = await supabase
    .from('inventory_distributor')
    .update({
      current_quantity: newQuantity,
      last_updated: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (updateError) {
    console.error('Error deducting from distributor inventory:', updateError);
    return false;
  }

  const { data: transaction, error: transactionError } = await supabase
    .from('inventory_transactions')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      distributor_id: distributorId,
      transaction_type: 'auto_depletion',
      quantity_change: -quantityToDeduct,
      previous_quantity: existing.current_quantity,
      new_quantity: newQuantity,
      reference_id: salesDataId,
      notes: 'Automatic deduction from depletion data',
      created_by: null,
    })
    .select('id')
    .single();

  if (transactionError) {
    console.error('Error logging inventory transaction:', transactionError);
  }

  await supabase
    .from('sales_data')
    .update({
      inventory_processed: true,
      inventory_processed_at: new Date().toISOString(),
      inventory_transaction_id: transaction?.id || null,
    })
    .eq('id', salesDataId);

  return true;
}

export async function processDepletionForInventory(
  organizationId: string,
  salesDataId: string,
  productName: string,
  distributorName: string,
  quantity: number
) {
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('product_name', productName)
    .maybeSingle();

  if (!product) {
    console.warn(`Product not found: ${productName}`);
    return false;
  }

  const { data: distributor } = await supabase
    .from('distributors')
    .select('id')
    .eq('name', distributorName)
    .maybeSingle();

  if (!distributor) {
    console.warn(`Distributor not found: ${distributorName}`);
    return false;
  }

  return await deductFromDistributorInventory(
    organizationId,
    product.id,
    distributor.id,
    quantity,
    salesDataId
  );
}

export async function getInventoryTransactions(
  organizationId: string,
  productId?: string,
  distributorId?: string,
  limit: number = 100
) {
  let query = supabase
    .from('inventory_transactions')
    .select(`
      *,
      products (
        product_name
      ),
      distributors (
        name
      )
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  if (distributorId) {
    query = query.eq('distributor_id', distributorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inventory transactions:', error);
    return [];
  }

  return data || [];
}

async function logInventoryTransaction(transaction: {
  organization_id: string;
  product_id: string;
  distributor_id: string | null;
  transaction_type: 'importer_adjustment' | 'distributor_initial' | 'distributor_adjustment' | 'auto_depletion';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
}) {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .insert({
      ...transaction,
      reference_id: transaction.reference_id || null,
      notes: transaction.notes || null,
      created_by: transaction.created_by || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error logging inventory transaction:', error);
    return null;
  }

  return data?.id || null;
}

export async function mergeProductInventories(
  organizationId: string,
  productIds: string[],
  canonicalProductId: string
) {
  try {
    const { data: importerInventories } = await supabase
      .from('inventory_importer')
      .select('*')
      .eq('organization_id', organizationId)
      .in('product_id', productIds);

    if (importerInventories && importerInventories.length > 0) {
      const totalQuantity = importerInventories.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      const latestNotes = importerInventories
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]?.notes;

      await supabase
        .from('inventory_importer')
        .delete()
        .eq('organization_id', organizationId)
        .in('product_id', productIds);

      if (totalQuantity > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        await supabase
          .from('inventory_importer')
          .insert({
            organization_id: organizationId,
            product_id: canonicalProductId,
            quantity: totalQuantity,
            notes: latestNotes || 'Merged from multiple products',
            updated_by: userId,
          });

        await logInventoryTransaction({
          organization_id: organizationId,
          product_id: canonicalProductId,
          distributor_id: null,
          transaction_type: 'importer_adjustment',
          quantity_change: totalQuantity,
          previous_quantity: 0,
          new_quantity: totalQuantity,
          notes: `Merged inventory from ${productIds.length} products`,
          created_by: userId,
        });
      }
    }

    const { data: distributorInventories } = await supabase
      .from('inventory_distributor')
      .select('*')
      .eq('organization_id', organizationId)
      .in('product_id', productIds);

    if (distributorInventories && distributorInventories.length > 0) {
      const distributorGroups = new Map<string, any[]>();
      distributorInventories.forEach(inv => {
        const key = inv.distributor_id;
        if (!distributorGroups.has(key)) {
          distributorGroups.set(key, []);
        }
        distributorGroups.get(key)!.push(inv);
      });

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      for (const [distributorId, inventories] of distributorGroups.entries()) {
        const totalInitial = inventories.reduce((sum, inv) => sum + Number(inv.initial_quantity), 0);
        const totalCurrent = inventories.reduce((sum, inv) => sum + Number(inv.current_quantity), 0);

        await supabase
          .from('inventory_distributor')
          .delete()
          .eq('organization_id', organizationId)
          .eq('distributor_id', distributorId)
          .in('product_id', productIds);

        await supabase
          .from('inventory_distributor')
          .insert({
            organization_id: organizationId,
            product_id: canonicalProductId,
            distributor_id: distributorId,
            initial_quantity: totalInitial,
            current_quantity: totalCurrent,
            created_by: userId,
          });

        await logInventoryTransaction({
          organization_id: organizationId,
          product_id: canonicalProductId,
          distributor_id: distributorId,
          transaction_type: 'distributor_adjustment',
          quantity_change: totalCurrent,
          previous_quantity: 0,
          new_quantity: totalCurrent,
          notes: `Merged inventory from ${productIds.length} products`,
          created_by: userId,
        });
      }
    }

    const { data: transactions } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .in('product_id', productIds);

    if (transactions && transactions.length > 0) {
      await supabase
        .from('inventory_transactions')
        .update({ product_id: canonicalProductId })
        .eq('organization_id', organizationId)
        .in('product_id', productIds);
    }

    console.log('✅ Successfully merged inventory for products');
    return true;
  } catch (error) {
    console.error('Error merging product inventories:', error);
    return false;
  }
}

export async function getInventorySummary(organizationId: string) {
  const { data: productsData } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', organizationId);

  const totalProducts = productsData?.length || 0;

  const { data: importerData } = await supabase
    .from('inventory_importer')
    .select('quantity')
    .eq('organization_id', organizationId);

  const { data: distributorData } = await supabase
    .from('inventory_distributor')
    .select('current_quantity, initial_quantity')
    .eq('organization_id', organizationId);

  const totalImporterInventory = importerData?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
  const totalDistributorInventory = distributorData?.reduce((sum, item) => sum + Number(item.current_quantity), 0) || 0;
  const totalDistributorInitial = distributorData?.reduce((sum, item) => sum + Number(item.initial_quantity), 0) || 0;
  const totalDepleted = totalDistributorInitial - totalDistributorInventory;

  const outOfStockCount = distributorData?.filter(item => Number(item.current_quantity) <= 0).length || 0;
  const lowStockCount = distributorData?.filter(item => Number(item.current_quantity) > 0 && Number(item.current_quantity) < Number(item.initial_quantity) * 0.2).length || 0;

  const trackedImporterCount = importerData?.length || 0;
  const trackedDistributorCount = distributorData?.length || 0;

  return {
    totalImporterInventory,
    totalDistributorInventory,
    totalDepleted,
    outOfStockCount,
    lowStockCount,
    totalProducts,
    trackedImporterCount,
    trackedDistributorCount,
  };
}
