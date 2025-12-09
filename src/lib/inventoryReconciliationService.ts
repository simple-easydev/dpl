import { supabase } from './supabase';

export interface ReconciliationStats {
  totalOrders: number;
  processedOrders: number;
  unprocessedOrders: number;
  failedOrders: number;
  ordersMissingInventory: number;
  earliestUnprocessedDate: string | null;
  latestUnprocessedDate: string | null;
}

export interface UnprocessedOrder {
  id: string;
  product_name: string;
  distributor: string;
  quantity_in_bottles: number;
  order_date: string | null;
  created_at: string;
  reason?: string;
}

export interface BackfillResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  errors: Array<{
    salesDataId: string;
    productName: string;
    error: string;
  }>;
}

export async function getReconciliationStats(organizationId: string): Promise<ReconciliationStats> {
  const { data: allOrders, error: allError } = await supabase
    .from('sales_data')
    .select('id, inventory_processed, order_date, created_at')
    .eq('organization_id', organizationId);

  if (allError || !allOrders) {
    console.error('Error fetching reconciliation stats:', allError);
    return {
      totalOrders: 0,
      processedOrders: 0,
      unprocessedOrders: 0,
      failedOrders: 0,
      ordersMissingInventory: 0,
      earliestUnprocessedDate: null,
      latestUnprocessedDate: null,
    };
  }

  const totalOrders = allOrders.length;
  const processedOrders = allOrders.filter(o => o.inventory_processed === true).length;
  const failedOrders = allOrders.filter(o => o.inventory_processed === false).length;
  const unprocessedOrders = allOrders.filter(o => o.inventory_processed === null).length;

  const unprocessedDates = allOrders
    .filter(o => o.inventory_processed === null && o.order_date)
    .map(o => o.order_date)
    .sort();

  return {
    totalOrders,
    processedOrders,
    unprocessedOrders,
    failedOrders,
    ordersMissingInventory: failedOrders,
    earliestUnprocessedDate: unprocessedDates[0] || null,
    latestUnprocessedDate: unprocessedDates[unprocessedDates.length - 1] || null,
  };
}

export async function getUnprocessedOrders(
  organizationId: string,
  limit: number = 100
): Promise<UnprocessedOrder[]> {
  const { data, error } = await supabase
    .from('sales_data')
    .select('id, product_name, distributor, quantity_in_bottles, order_date, created_at')
    .eq('organization_id', organizationId)
    .is('inventory_processed', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching unprocessed orders:', error);
    return [];
  }

  return data || [];
}

export async function getFailedOrders(
  organizationId: string,
  limit: number = 100
): Promise<UnprocessedOrder[]> {
  const { data, error } = await supabase
    .from('sales_data')
    .select('id, product_name, distributor, quantity_in_bottles, order_date, created_at')
    .eq('organization_id', organizationId)
    .eq('inventory_processed', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching failed orders:', error);
    return [];
  }

  return (data || []).map(order => ({
    ...order,
    reason: 'Inventory record not found at time of processing',
  }));
}

export async function backfillInventoryDepletions(
  organizationId: string,
  options?: {
    distributorId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    retryFailed?: boolean;
  }
): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: false,
    processedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  let query = supabase
    .from('sales_data')
    .select('id, product_name, distributor, quantity_in_bottles, order_date, created_at')
    .eq('organization_id', organizationId);

  if (options?.retryFailed) {
    query = query.or('inventory_processed.is.null,inventory_processed.eq.false');
  } else {
    query = query.is('inventory_processed', null);
  }

  if (options?.startDate) {
    query = query.gte('order_date', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('order_date', options.endDate);
  }

  query = query.order('created_at', { ascending: true });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: orders, error: fetchError } = await query;

  if (fetchError || !orders) {
    console.error('Error fetching orders for backfill:', fetchError);
    return result;
  }

  console.log(`🔄 Starting backfill for ${orders.length} orders...`);

  for (const order of orders) {
    if (!order.product_name || !order.distributor || !order.quantity_in_bottles) {
      result.skippedCount++;
      continue;
    }

    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('product_name', order.product_name)
      .maybeSingle();

    if (!product) {
      result.failedCount++;
      result.errors.push({
        salesDataId: order.id,
        productName: order.product_name,
        error: 'Product not found',
      });

      await supabase
        .from('sales_data')
        .update({
          inventory_processed: false,
          inventory_processed_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      continue;
    }

    const { data: distributor } = await supabase
      .from('distributors')
      .select('id')
      .eq('name', order.distributor)
      .maybeSingle();

    if (!distributor) {
      result.failedCount++;
      result.errors.push({
        salesDataId: order.id,
        productName: order.product_name,
        error: 'Distributor not found',
      });

      await supabase
        .from('sales_data')
        .update({
          inventory_processed: false,
          inventory_processed_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      continue;
    }

    const { data: inventory } = await supabase
      .from('inventory_distributor')
      .select('id, current_quantity, initial_quantity')
      .eq('organization_id', organizationId)
      .eq('product_id', product.id)
      .eq('distributor_id', distributor.id)
      .maybeSingle();

    if (!inventory) {
      result.failedCount++;
      result.errors.push({
        salesDataId: order.id,
        productName: order.product_name,
        error: 'Inventory record not found - initialize inventory first',
      });

      await supabase
        .from('sales_data')
        .update({
          inventory_processed: false,
          inventory_processed_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      continue;
    }

    const quantityToDeduct = Number(order.quantity_in_bottles);
    const newQuantity = inventory.current_quantity - quantityToDeduct;

    const { error: updateError } = await supabase
      .from('inventory_distributor')
      .update({
        current_quantity: newQuantity,
        last_updated: new Date().toISOString(),
      })
      .eq('id', inventory.id);

    if (updateError) {
      result.failedCount++;
      result.errors.push({
        salesDataId: order.id,
        productName: order.product_name,
        error: `Failed to update inventory: ${updateError.message}`,
      });
      continue;
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('inventory_transactions')
      .insert({
        organization_id: organizationId,
        product_id: product.id,
        distributor_id: distributor.id,
        transaction_type: 'auto_depletion',
        quantity_change: -quantityToDeduct,
        previous_quantity: inventory.current_quantity,
        new_quantity: newQuantity,
        reference_id: order.id,
        notes: 'Backfilled depletion from historical order',
        created_by: null,
      })
      .select('id')
      .single();

    if (transactionError) {
      console.error('Error creating transaction for backfill:', transactionError);
    }

    await supabase
      .from('sales_data')
      .update({
        inventory_processed: true,
        inventory_processed_at: new Date().toISOString(),
        inventory_transaction_id: transaction?.id || null,
      })
      .eq('id', order.id);

    result.processedCount++;
  }

  result.success = result.processedCount > 0 || orders.length === 0;

  console.log(`✅ Backfill complete: ${result.processedCount} processed, ${result.failedCount} failed, ${result.skippedCount} skipped`);

  return result;
}

export async function getInventoryReconciliationReport(organizationId: string) {
  const stats = await getReconciliationStats(organizationId);

  const { data: distributorInventory } = await supabase
    .from('inventory_distributor')
    .select(`
      id,
      created_at,
      products!inner(product_name),
      distributors!inner(name)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  const inventoryByDistributor = new Map<string, { created_at: string; products: string[] }>();

  if (distributorInventory) {
    distributorInventory.forEach(inv => {
      const distName = (inv.distributors as any).name;
      const productName = (inv.products as any).product_name;

      if (!inventoryByDistributor.has(distName)) {
        inventoryByDistributor.set(distName, {
          created_at: inv.created_at,
          products: [],
        });
      }

      inventoryByDistributor.get(distName)!.products.push(productName);
    });
  }

  const { data: ordersBeforeInventory } = await supabase
    .from('sales_data')
    .select('id, distributor, product_name, created_at, inventory_processed')
    .eq('organization_id', organizationId)
    .is('inventory_processed', null);

  const ordersByDistributor = new Map<string, number>();

  if (ordersBeforeInventory) {
    ordersBeforeInventory.forEach(order => {
      const count = ordersByDistributor.get(order.distributor) || 0;
      ordersByDistributor.set(order.distributor, count + 1);
    });
  }

  return {
    stats,
    inventoryByDistributor: Array.from(inventoryByDistributor.entries()).map(([name, data]) => ({
      distributor: name,
      inventoryCreatedAt: data.created_at,
      productCount: data.products.length,
      unprocessedOrders: ordersByDistributor.get(name) || 0,
    })),
  };
}
