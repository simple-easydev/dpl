import { supabase } from './supabase';

export type PackageType = 'case_6' | 'case_12' | 'single' | 'barrel';

export interface FOBPrice {
  productId: string;
  distributorId: string;
  packageType: PackageType;
  fobPrice: number;
  isOverride: boolean;
}

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  case_6: '6-Pack Case',
  case_12: '12-Pack Case',
  single: 'Single Bottle',
  barrel: 'Barrel'
};

export const BOTTLES_PER_PACKAGE: Record<PackageType, number> = {
  case_6: 6,
  case_12: 12,
  single: 1,
  barrel: 1
};

export interface FOBPricingMatrix {
  productId: string;
  productName: string;
  defaultFobPrice: number | null;
  distributorPrices: Record<string, Record<PackageType, number | null>>;
  availablePackageTypes: PackageType[];
}

export interface CalculatedRevenue {
  casesSold: number;
  fobPrice: number;
  revenue: number;
  usedDefault: boolean;
}

export async function getFOBPrice(
  organizationId: string,
  productId: string,
  distributorId: string,
  packageType: PackageType = 'case_6'
): Promise<FOBPrice | null> {
  const { data: override } = await supabase
    .from('fob_pricing_matrix')
    .select('fob_price_override, package_type')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('distributor_id', distributorId)
    .eq('package_type', packageType)
    .maybeSingle();

  if (override) {
    return {
      productId,
      distributorId,
      packageType,
      fobPrice: Number(override.fob_price_override),
      isOverride: true,
    };
  }

  const { data: product } = await supabase
    .from('products')
    .select('default_fob_price')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (product && product.default_fob_price !== null && packageType === 'case_6') {
    return {
      productId,
      distributorId,
      packageType,
      fobPrice: Number(product.default_fob_price),
      isOverride: false,
    };
  }

  return null;
}

export async function bulkGetFOBPrices(
  organizationId: string,
  productIds: string[],
  distributorIds: string[],
  packageType: PackageType = 'case_6'
): Promise<Map<string, FOBPrice>> {
  const priceMap = new Map<string, FOBPrice>();

  const { data: overrides } = await supabase
    .from('fob_pricing_matrix')
    .select('product_id, distributor_id, fob_price_override, package_type')
    .eq('organization_id', organizationId)
    .in('product_id', productIds)
    .in('distributor_id', distributorIds)
    .eq('package_type', packageType);

  if (overrides) {
    overrides.forEach((override) => {
      const key = `${override.product_id}_${override.distributor_id}_${override.package_type}`;
      priceMap.set(key, {
        productId: override.product_id,
        distributorId: override.distributor_id,
        packageType: override.package_type as PackageType,
        fobPrice: Number(override.fob_price_override),
        isOverride: true,
      });
    });
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, default_fob_price')
    .eq('organization_id', organizationId)
    .in('id', productIds);

  if (products && packageType === 'case_6') {
    products.forEach((product) => {
      if (product.default_fob_price !== null) {
        distributorIds.forEach((distributorId) => {
          const key = `${product.id}_${distributorId}_${packageType}`;
          if (!priceMap.has(key)) {
            priceMap.set(key, {
              productId: product.id,
              distributorId,
              packageType,
              fobPrice: Number(product.default_fob_price),
              isOverride: false,
            });
          }
        });
      }
    });
  }

  return priceMap;
}

export async function calculateFOBRevenue(
  organizationId: string,
  productId: string,
  distributorId: string,
  unitsSold: number,
  packageType: PackageType = 'case_6'
): Promise<CalculatedRevenue | null> {
  const fobPrice = await getFOBPrice(organizationId, productId, distributorId, packageType);

  if (!fobPrice) {
    return null;
  }

  return {
    casesSold: unitsSold,
    fobPrice: fobPrice.fobPrice,
    revenue: unitsSold * fobPrice.fobPrice,
    usedDefault: !fobPrice.isOverride,
  };
}

export async function calculateFOBRevenueFromBottles(
  organizationId: string,
  productId: string,
  bottlesSold: number,
  packageType: PackageType = 'case_6'
): Promise<number | null> {
  const { data: product } = await supabase
    .from('products')
    .select('default_fob_price')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!product || product.default_fob_price === null) {
    return null;
  }

  const caseFobPrice = Number(product.default_fob_price);
  const bottlesPerUnit = BOTTLES_PER_PACKAGE[packageType];
  const bottleFobPrice = caseFobPrice / bottlesPerUnit;
  const fobRevenue = bottleFobPrice * bottlesSold;

  return fobRevenue;
}

export async function saveFOBPriceOverride(
  organizationId: string,
  productId: string,
  distributorId: string,
  fobPrice: number,
  userId: string,
  packageType: PackageType = 'case_6'
): Promise<boolean> {
  const { error } = await supabase.from('fob_pricing_matrix').upsert(
    {
      organization_id: organizationId,
      product_id: productId,
      distributor_id: distributorId,
      fob_price_override: fobPrice,
      package_type: packageType,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'organization_id,product_id,distributor_id,package_type',
    }
  );

  return !error;
}

export async function deleteFOBPriceOverride(
  organizationId: string,
  productId: string,
  distributorId: string,
  packageType: PackageType = 'case_6'
): Promise<boolean> {
  const { error } = await supabase
    .from('fob_pricing_matrix')
    .delete()
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('distributor_id', distributorId)
    .eq('package_type', packageType);

  return !error;
}

export async function updateDefaultFOBPrice(
  organizationId: string,
  productId: string,
  defaultFobPrice: number | null
): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .update({ default_fob_price: defaultFobPrice })
    .eq('id', productId)
    .eq('organization_id', organizationId);

  return !error;
}

export async function updateProductPackageTypes(
  organizationId: string,
  productId: string,
  availablePackageTypes: PackageType[],
  defaultPackageType: PackageType
): Promise<{ success: boolean; error?: string }> {
  console.log('📦 Updating product package types:', {
    productId,
    availablePackageTypes,
    defaultPackageType
  });

  if (availablePackageTypes.length === 0) {
    return { success: false, error: 'At least one package type must be available' };
  }

  if (!availablePackageTypes.includes(defaultPackageType)) {
    return { success: false, error: 'Default package type must be one of the available types' };
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      available_package_types: availablePackageTypes,
      default_package_type: defaultPackageType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .select('id, product_name, available_package_types, default_package_type')
    .single();

  if (error) {
    console.error('❌ Failed to update product package types:', error);
    return { success: false, error: error.message };
  }

  console.log('✅ Successfully updated product package types:', data);
  return { success: true };
}

export async function getProductFOBPricesForAllPackages(
  organizationId: string,
  productId: string,
  distributorId: string
): Promise<Record<PackageType, FOBPrice | null>> {
  const packageTypes: PackageType[] = ['case_6', 'case_12', 'single', 'barrel'];
  const result: Record<PackageType, FOBPrice | null> = {} as Record<PackageType, FOBPrice | null>;

  for (const packageType of packageTypes) {
    result[packageType] = await getFOBPrice(organizationId, productId, distributorId, packageType);
  }

  return result;
}

export async function getFOBPricingMatrix(
  organizationId: string
): Promise<FOBPricingMatrix[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, product_name, default_fob_price, available_package_types')
    .eq('organization_id', organizationId)
    .order('product_name');

  if (!products) return [];

  const productIds = products.map((p) => p.id);

  const { data: overrides } = await supabase
    .from('fob_pricing_matrix')
    .select('product_id, distributor_id, fob_price_override, package_type')
    .eq('organization_id', organizationId)
    .in('product_id', productIds);

  const matrix: FOBPricingMatrix[] = products.map((product) => {
    const distributorPrices: Record<string, Record<PackageType, number | null>> = {};
    const availablePackageTypes = (product.available_package_types as PackageType[]) || ['case_6'];

    if (overrides) {
      overrides
        .filter((o) => o.product_id === product.id)
        .forEach((o) => {
          if (!distributorPrices[o.distributor_id]) {
            distributorPrices[o.distributor_id] = {} as Record<PackageType, number | null>;
          }
          distributorPrices[o.distributor_id][o.package_type as PackageType] = Number(o.fob_price_override);
        });
    }

    return {
      productId: product.id,
      productName: product.product_name,
      defaultFobPrice: product.default_fob_price !== null ? Number(product.default_fob_price) : null,
      distributorPrices,
      availablePackageTypes,
    };
  });

  return matrix;
}

export async function bulkSaveFOBPrices(
  organizationId: string,
  updates: Array<{
    productId: string;
    distributorId: string;
    fobPrice: number | null;
    packageType?: PackageType;
  }>,
  userId: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const update of updates) {
    const packageType = update.packageType || 'case_6';
    if (update.fobPrice === null) {
      const deleted = await deleteFOBPriceOverride(
        organizationId,
        update.productId,
        update.distributorId,
        packageType
      );
      if (deleted) success++;
      else failed++;
    } else {
      const saved = await saveFOBPriceOverride(
        organizationId,
        update.productId,
        update.distributorId,
        update.fobPrice,
        userId,
        packageType
      );
      if (saved) success++;
      else failed++;
    }
  }

  return { success, failed };
}
