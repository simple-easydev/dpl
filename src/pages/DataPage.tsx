import { useEffect, useState, useMemo, useCallback } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Download, Plus, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Wine, Store, HelpCircle, Building2, TrendingUp, Package, DollarSign, ShoppingCart, X, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import AddOrderModal from '../components/AddOrderModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import MonthOverMonthSummary from '../components/MonthOverMonthSummary';

interface SalesRecord {
  id: string;
  order_id: string | null;
  order_date: string | null;
  default_period: string | null;
  account_name: string;
  product_name: string;
  quantity: number;
  quantity_in_bottles: number | null;
  case_size: number | null;
  quantity_unit: 'cases' | 'bottles' | 'barrel' | null;
  package_type: string | null;
  bottles_per_unit: number | null;
  revenue: number;
  brand: string | null;
  account_state: string | null;
  date_of_sale: string | null;
  premise_type?: 'on_premise' | 'off_premise' | 'unclassified' | 'online' | null;
  organization_name?: string;
  organization_id?: string;
  representative?: string | null;
  distributor?: string | null;
}

interface AccountDepletionData {
  account_name: string;
  account_state: string | null;
  premise_type: 'on_premise' | 'off_premise' | 'unclassified' | 'online' | null;
  organization_name?: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
}

interface BrandMonthlyData {
  brand: string;
  organization_name?: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
}

interface ProductMonthlyData {
  product_name: string;
  brand: string;
  organization_name?: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
}

interface BrandWithProducts {
  brand: string;
  organization_name?: string;
  products: ProductMonthlyData[];
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
}

type ViewMode = 'brand' | 'product';
type SortField = 'brand' | 'product' | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun' | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec' | 'total';
type SortDirection = 'asc' | 'desc' | null;
type PremiseFilter = 'all' | 'on_premise' | 'off_premise' | 'unclassified' | 'online';

const MONTHS = [
  { key: 'jan', label: 'Jan', index: 0 },
  { key: 'feb', label: 'Feb', index: 1 },
  { key: 'mar', label: 'Mar', index: 2 },
  { key: 'apr', label: 'Apr', index: 3 },
  { key: 'may', label: 'May', index: 4 },
  { key: 'jun', label: 'Jun', index: 5 },
  { key: 'jul', label: 'Jul', index: 6 },
  { key: 'aug', label: 'Aug', index: 7 },
  { key: 'sep', label: 'Sep', index: 8 },
  { key: 'oct', label: 'Oct', index: 9 },
  { key: 'nov', label: 'Nov', index: 10 },
  { key: 'dec', label: 'Dec', index: 11 },
];

function calculateCasesFromRecord(record: SalesRecord): number {
  if (record.quantity_in_bottles && record.bottles_per_unit && record.bottles_per_unit > 0) {
    return record.quantity_in_bottles / record.bottles_per_unit;
  }

  if (record.quantity_in_bottles && record.case_size && record.case_size > 0) {
    return record.quantity_in_bottles / record.case_size;
  }

  if (record.quantity_unit === 'bottles') {
    const bottlesPerCase = record.bottles_per_unit || record.case_size || 12;
    return record.quantity / bottlesPerCase;
  }

  if (record.quantity_unit === 'cases' || record.quantity_unit === null) {
    return record.quantity;
  }

  return record.quantity;
}

function getRecordDateInfo(record: SalesRecord): { date: Date | null; year: number | null; month: number | null } {
  if (record.order_date) {
    const date = new Date(record.order_date);
    return {
      date,
      year: date.getFullYear(),
      month: date.getMonth()
    };
  } else if (record.default_period) {
    const [year, month] = record.default_period.split('-').map(Number);
    return {
      date: new Date(year, month - 1, 15),
      year,
      month: month - 1
    };
  }
  return { date: null, year: null, month: null };
}

export default function DataPage() {
  const { currentOrganization, isPlatformAdmin } = useOrganization();
  const { isPlatformAdmin: isAuthPlatformAdmin } = useAuth();
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedRepresentatives, setSelectedRepresentatives] = useState<string[]>([]);
  const [selectedPremiseTypes, setSelectedPremiseTypes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('brand');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [brandAccountData, setBrandAccountData] = useState<Map<string, AccountDepletionData[]>>(new Map());
  const [productAccountData, setProductAccountData] = useState<Map<string, AccountDepletionData[]>>(new Map());

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  // Helper function to deduplicate sales records
  const deduplicateRecords = useCallback((records: SalesRecord[]): SalesRecord[] => {
    const seenKeys = new Map<string, SalesRecord>();

    records.forEach(record => {
      let key: string;

      // If order_id exists, use it as the primary key
      if (record.order_id) {
        key = `${record.organization_id}_${record.order_id}`;
      } else {
        // Otherwise, create a composite key from critical fields
        const dateKey = record.order_date || record.default_period || 'no_date';
        key = `${record.organization_id}_${dateKey}_${record.account_name}_${record.product_name}_${record.quantity}_${record.quantity_in_bottles || 0}`;
      }

      // Keep only the first occurrence of each unique key
      if (!seenKeys.has(key)) {
        seenKeys.set(key, record);
      }
    });

    return Array.from(seenKeys.values());
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    data.forEach(record => {
      const { year } = getRecordDateInfo(record);
      if (year !== null) {
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  useEffect(() => {
    if (data.length > 0 && selectedYear === 'all' && availableYears.length > 0) {
      setSelectedYear(availableYears[0].toString());
    }
  }, [data, availableYears]);

  const calculateAccountDepletions = useCallback((brand: string, productName?: string): AccountDepletionData[] => {
    let filtered = data.filter(record => {
      if (record.brand !== brand) return false;
      if (productName && record.product_name !== productName) return false;

      const { year } = getRecordDateInfo(record);
      if (year === null) return false;

      if (selectedYear !== 'all') {
        if (year !== parseInt(selectedYear)) return false;
      }

      if (selectedStates.length > 0 && record.account_state && !selectedStates.includes(record.account_state)) return false;
      if (selectedPremiseTypes.length > 0 && record.premise_type && !selectedPremiseTypes.includes(record.premise_type)) return false;
      if (selectedRepresentatives.length > 0 && record.representative && !selectedRepresentatives.includes(record.representative)) return false;

      return true;
    });

    // Deduplicate records before processing to prevent double-counting
    filtered = deduplicateRecords(filtered);

    const accountMap = new Map<string, AccountDepletionData>();

    filtered.forEach(record => {
      const { month } = getRecordDateInfo(record);
      if (month === null) return;

      const cases = calculateCasesFromRecord(record);

      if (!accountMap.has(record.account_name)) {
        accountMap.set(record.account_name, {
          account_name: record.account_name,
          account_state: record.account_state,
          premise_type: record.premise_type || null,
          organization_name: record.organization_name,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
          total: 0
        });
      }

      const accountData = accountMap.get(record.account_name)!;
      const monthKey = MONTHS[month].key as keyof Omit<AccountDepletionData, 'account_name' | 'account_state' | 'premise_type' | 'organization_name' | 'total'>;
      accountData[monthKey] += cases;
      accountData.total += cases;
    });

    return Array.from(accountMap.values()).sort((a, b) => b.total - a.total);
  }, [data, selectedYear, selectedStates, selectedPremiseTypes, selectedRepresentatives, deduplicateRecords]);

  useEffect(() => {
    if (viewMode === 'brand' && expandedBrands.size > 0) {
      const newMap = new Map<string, AccountDepletionData[]>();
      expandedBrands.forEach(brand => {
        const accountData = calculateAccountDepletions(brand);
        newMap.set(brand, accountData);
      });
      setBrandAccountData(newMap);
    } else if (viewMode === 'product' && expandedProducts.size > 0) {
      const newMap = new Map<string, AccountDepletionData[]>();
      expandedProducts.forEach(productKey => {
        const [brand, productName] = productKey.split('|||');
        const accountData = calculateAccountDepletions(brand, productName);
        newMap.set(productKey, accountData);
      });
      setProductAccountData(newMap);
    }
  }, [selectedYear, selectedStates, selectedPremiseTypes, selectedRepresentatives, data, expandedBrands, expandedProducts, viewMode, calculateAccountDepletions]);

  // Cascading filter options - each filter is computed based on the previous filters
  const availableStates = useMemo(() => {
    let filtered = [...data];

    // Filter by year only
    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    const states = new Set<string>();
    filtered.forEach(record => {
      if (record.account_state) {
        states.add(record.account_state);
      }
    });
    return Array.from(states).sort();
  }, [data, selectedYear]);

  const availableBrands = useMemo(() => {
    let filtered = [...data];

    // Filter by year
    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    // Filter by selected states
    if (selectedStates.length > 0) {
      filtered = filtered.filter(record => record.account_state && selectedStates.includes(record.account_state));
    }

    const brands = new Set<string>();
    filtered.forEach(record => {
      if (record.brand) {
        brands.add(record.brand);
      }
    });
    return Array.from(brands).sort();
  }, [data, selectedYear, selectedStates]);

  const availableProducts = useMemo(() => {
    let filtered = [...data];

    // Filter by year
    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    // Filter by selected states
    if (selectedStates.length > 0) {
      filtered = filtered.filter(record => record.account_state && selectedStates.includes(record.account_state));
    }

    // Filter by selected brands
    if (selectedBrands.length > 0) {
      filtered = filtered.filter(record => record.brand && selectedBrands.includes(record.brand));
    }

    const products = new Set<string>();
    filtered.forEach(record => {
      if (record.product_name) {
        products.add(record.product_name);
      }
    });
    return Array.from(products).sort();
  }, [data, selectedYear, selectedStates, selectedBrands]);

  const availableRepresentatives = useMemo(() => {
    let filtered = [...data];

    // Filter by year
    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    // Filter by selected states
    if (selectedStates.length > 0) {
      filtered = filtered.filter(record => record.account_state && selectedStates.includes(record.account_state));
    }

    // Filter by selected brands
    if (selectedBrands.length > 0) {
      filtered = filtered.filter(record => record.brand && selectedBrands.includes(record.brand));
    }

    // Filter by selected products
    if (selectedProducts.length > 0) {
      filtered = filtered.filter(record => record.product_name && selectedProducts.includes(record.product_name));
    }

    const reps = new Set<string>();
    filtered.forEach(record => {
      if (record.representative) {
        reps.add(record.representative);
      }
    });
    return Array.from(reps).sort();
  }, [data, selectedYear, selectedStates, selectedBrands, selectedProducts]);

  // Auto-clear invalid filter selections when available options change
  useEffect(() => {
    if (selectedStates.length > 0) {
      const validStates = selectedStates.filter(state => availableStates.includes(state));
      if (validStates.length !== selectedStates.length) {
        setSelectedStates(validStates);
      }
    }
  }, [availableStates]);

  useEffect(() => {
    if (selectedBrands.length > 0) {
      const validBrands = selectedBrands.filter(brand => availableBrands.includes(brand));
      if (validBrands.length !== selectedBrands.length) {
        setSelectedBrands(validBrands);
      }
    }
  }, [availableBrands]);

  useEffect(() => {
    if (selectedProducts.length > 0) {
      const validProducts = selectedProducts.filter(product => availableProducts.includes(product));
      if (validProducts.length !== selectedProducts.length) {
        setSelectedProducts(validProducts);
      }
    }
  }, [availableProducts]);

  useEffect(() => {
    if (selectedRepresentatives.length > 0) {
      const validReps = selectedRepresentatives.filter(rep => availableRepresentatives.includes(rep));
      if (validReps.length !== selectedRepresentatives.length) {
        setSelectedRepresentatives(validReps);
      }
    }
  }, [availableRepresentatives]);

  const brandMonthlyData = useMemo(() => {
    let filtered = [...data];

    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    if (selectedStates.length > 0) {
      filtered = filtered.filter(record => record.account_state && selectedStates.includes(record.account_state));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter(record => record.brand && selectedBrands.includes(record.brand));
    }

    if (selectedProducts.length > 0) {
      filtered = filtered.filter(record => record.product_name && selectedProducts.includes(record.product_name));
    }

    if (selectedRepresentatives.length > 0) {
      filtered = filtered.filter(record => record.representative && selectedRepresentatives.includes(record.representative));
    }

    if (selectedPremiseTypes.length > 0) {
      filtered = filtered.filter(record => record.premise_type && selectedPremiseTypes.includes(record.premise_type));
    }

    // Deduplicate records before processing to prevent double-counting
    filtered = deduplicateRecords(filtered);

    const brandMap = new Map<string, BrandMonthlyData>();

    filtered.forEach(record => {
      const { month } = getRecordDateInfo(record);
      if (month === null) return;

      const brand = record.brand || record.organization_name || 'Unknown Brand';
      const orgName = record.organization_name || 'Unknown';
      const brandKey = `${brand}`;
      const cases = calculateCasesFromRecord(record);

      if (!brandMap.has(brandKey)) {
        brandMap.set(brandKey, {
          brand,
          organization_name: orgName,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
          total: 0
        });
      }

      const brandData = brandMap.get(brandKey)!;
      const monthKey = MONTHS[month].key as keyof Omit<BrandMonthlyData, 'brand' | 'organization_name' | 'total'>;
      brandData[monthKey] += cases;
      brandData.total += cases;
    });

    let result = Array.from(brandMap.values());

    if (sortDirection && sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField as keyof BrandMonthlyData];
        const bVal = b[sortField as keyof BrandMonthlyData];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    }

    return result;
  }, [data, selectedYear, selectedStates, selectedBrands, selectedProducts, selectedRepresentatives, selectedPremiseTypes, sortField, sortDirection, deduplicateRecords]);

  const productViewData = useMemo(() => {
    let filtered = [...data];

    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    if (selectedStates.length > 0) {
      filtered = filtered.filter(record => record.account_state && selectedStates.includes(record.account_state));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter(record => record.brand && selectedBrands.includes(record.brand));
    }

    if (selectedProducts.length > 0) {
      filtered = filtered.filter(record => record.product_name && selectedProducts.includes(record.product_name));
    }

    if (selectedRepresentatives.length > 0) {
      filtered = filtered.filter(record => record.representative && selectedRepresentatives.includes(record.representative));
    }

    if (selectedPremiseTypes.length > 0) {
      filtered = filtered.filter(record => record.premise_type && selectedPremiseTypes.includes(record.premise_type));
    }

    // Deduplicate records before processing to prevent double-counting
    filtered = deduplicateRecords(filtered);

    const productMap = new Map<string, ProductMonthlyData>();

    filtered.forEach(record => {
      const { month } = getRecordDateInfo(record);
      if (month === null) return;

      const brand = record.brand || record.organization_name || 'Unknown Brand';
      const orgName = record.organization_name || 'Unknown';
      const productKey = `${brand}|||${record.product_name}`;
      const cases = calculateCasesFromRecord(record);

      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          product_name: record.product_name,
          brand,
          organization_name: orgName,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
          total: 0
        });
      }

      const productData = productMap.get(productKey)!;
      const monthKey = MONTHS[month].key as keyof Omit<ProductMonthlyData, 'product_name' | 'brand' | 'organization_name' | 'total'>;
      productData[monthKey] += cases;
      productData.total += cases;
    });

    const brandProductMap = new Map<string, BrandWithProducts>();

    Array.from(productMap.values()).forEach(product => {
      if (!brandProductMap.has(product.brand)) {
        brandProductMap.set(product.brand, {
          brand: product.brand,
          organization_name: product.organization_name,
          products: [],
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
          total: 0
        });
      }

      const brandData = brandProductMap.get(product.brand)!;
      brandData.products.push(product);
      brandData.jan += product.jan;
      brandData.feb += product.feb;
      brandData.mar += product.mar;
      brandData.apr += product.apr;
      brandData.may += product.may;
      brandData.jun += product.jun;
      brandData.jul += product.jul;
      brandData.aug += product.aug;
      brandData.sep += product.sep;
      brandData.oct += product.oct;
      brandData.nov += product.nov;
      brandData.dec += product.dec;
      brandData.total += product.total;
    });

    let result = Array.from(brandProductMap.values());

    result.forEach(brand => {
      brand.products.sort((a, b) => {
        if (sortDirection && sortField && sortField !== 'brand') {
          const aVal = a[sortField as keyof ProductMonthlyData];
          const bVal = b[sortField as keyof ProductMonthlyData];

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc'
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
          }

          return sortDirection === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        }
        return b.total - a.total;
      });
    });

    if (sortDirection && sortField) {
      result.sort((a, b) => {
        if (sortField === 'brand') {
          return sortDirection === 'asc'
            ? a.brand.localeCompare(b.brand)
            : b.brand.localeCompare(a.brand);
        }
        const aVal = a[sortField as keyof Omit<BrandWithProducts, 'brand' | 'products'>];
        const bVal = b[sortField as keyof Omit<BrandWithProducts, 'brand' | 'products'>];
        return sortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    }

    return result;
  }, [data, selectedYear, selectedStates, selectedBrands, selectedProducts, selectedRepresentatives, selectedPremiseTypes, sortField, sortDirection, deduplicateRecords]);

  const totalCases = useMemo(() => {
    if (viewMode === 'brand') {
      return brandMonthlyData.reduce((sum, brand) => sum + brand.total, 0);
    } else {
      return productViewData.reduce((sum, brand) => sum + brand.total, 0);
    }
  }, [brandMonthlyData, productViewData, viewMode]);

  const entityCount = useMemo(() => {
    if (viewMode === 'brand') {
      return brandMonthlyData.length;
    } else {
      return productViewData.reduce((count, brand) => count + brand.products.length, 0);
    }
  }, [brandMonthlyData, productViewData, viewMode]);

  const avgCasesPerEntity = entityCount > 0 ? totalCases / entityCount : 0;

  const summaryMetrics = useMemo(() => {
    let filtered = [...data];

    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    if (selectedStates.length > 0) {
      filtered = filtered.filter(record => record.account_state && selectedStates.includes(record.account_state));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter(record => record.brand && selectedBrands.includes(record.brand));
    }

    if (selectedProducts.length > 0) {
      filtered = filtered.filter(record => record.product_name && selectedProducts.includes(record.product_name));
    }

    if (selectedRepresentatives.length > 0) {
      filtered = filtered.filter(record => record.representative && selectedRepresentatives.includes(record.representative));
    }

    if (selectedPremiseTypes.length > 0) {
      filtered = filtered.filter(record => record.premise_type && selectedPremiseTypes.includes(record.premise_type));
    }

    // Deduplicate records before processing to prevent double-counting
    filtered = deduplicateRecords(filtered);

    const totalCases = filtered.reduce((sum, record) => {
      return sum + calculateCasesFromRecord(record);
    }, 0);

    const totalRevenue = filtered.reduce((sum, record) => sum + (record.revenue || 0), 0);

    const uniqueMarkets = new Set<string>();
    filtered.forEach(record => {
      if (record.account_state) {
        uniqueMarkets.add(record.account_state);
      }
    });

    const uniqueAccounts = new Set<string>();
    filtered.forEach(record => {
      if (record.account_name) {
        uniqueAccounts.add(record.account_name);
      }
    });

    const uniqueOnPremiseAccounts = new Set<string>();
    const uniqueOffPremiseAccounts = new Set<string>();
    filtered.forEach(record => {
      if (record.account_name) {
        if (record.premise_type === 'on_premise') {
          uniqueOnPremiseAccounts.add(record.account_name);
        } else if (record.premise_type === 'off_premise') {
          uniqueOffPremiseAccounts.add(record.account_name);
        }
      }
    });

    return {
      totalCases,
      totalRevenue,
      totalMarkets: uniqueMarkets.size,
      totalAccounts: uniqueAccounts.size,
      onPremiseAccounts: uniqueOnPremiseAccounts.size,
      offPremiseAccounts: uniqueOffPremiseAccounts.size,
    };
  }, [data, selectedYear, selectedStates, selectedBrands, selectedProducts, selectedRepresentatives, selectedPremiseTypes, deduplicateRecords]);

  const dateRangeDisplay = useMemo(() => {
    if (data.length === 0) return 'No data available';

    let filtered = [...data];

    if (selectedYear !== 'all') {
      filtered = filtered.filter(record => {
        const { year } = getRecordDateInfo(record);
        if (year === null) return false;
        return year === parseInt(selectedYear);
      });
    }

    if (filtered.length === 0) return 'No data for selected filters';

    const dates = filtered
      .map(r => getRecordDateInfo(r).date)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) return 'No data for selected filters';

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    if (selectedYear === 'all') {
      const minYear = minDate.getFullYear();
      const maxYear = maxDate.getFullYear();
      if (minYear === maxYear) {
        return `${format(minDate, 'MMM d')} - ${format(maxDate, 'MMM d, yyyy')}`;
      }
      return `${format(minDate, 'MMM d, yyyy')} - ${format(maxDate, 'MMM d, yyyy')}`;
    } else {
      return `${format(minDate, 'MMM d')} - ${format(maxDate, 'MMM d, yyyy')}`;
    }
  }, [data, selectedYear]);

  const fetchData = async () => {
    const isSuperAdmin = isPlatformAdmin || isAuthPlatformAdmin;

    if (!currentOrganization && !isSuperAdmin) return;
    setLoading(true);

    try {
      let salesQuery = supabase
        .from('sales_data')
        .select('id, order_id, order_date, default_period, account_name, product_name, quantity, quantity_in_bottles, case_size, quantity_unit, package_type, bottles_per_unit, revenue, brand, account_state, date_of_sale, premise_type, organization_id, representative, distributor')
        .or('order_date.not.is.null,default_period.not.is.null')
        .order('order_date', { ascending: false, nullsFirst: false });

      if (currentOrganization) {
        salesQuery = salesQuery.eq('organization_id', currentOrganization.id);
      }

      const { data: salesData, error: salesError } = await salesQuery;

      if (salesError || !salesData) {
        console.error('Error fetching sales data:', salesError);
        setLoading(false);
        return;
      }

      let accountsQuery = supabase
        .from('accounts')
        .select('account_name, state, premise_type, organization_id');

      if (currentOrganization) {
        accountsQuery = accountsQuery.eq('organization_id', currentOrganization.id);
      }

      const { data: accounts, error: accountsError } = await accountsQuery;

      const organizationIds = [...new Set(salesData.map((s: any) => s.organization_id))];
      const { data: organizations } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', organizationIds);

      const orgMap = new Map(
        (organizations || []).map((org: any) => [org.id, org.name])
      );

      if (!accountsError && accounts) {
        const accountMap = new Map(
          accounts.map((acc: any) => [
            `${acc.organization_id}_${acc.account_name}`,
            { state: acc.state, premise_type: acc.premise_type }
          ])
        );

        const transformedData = salesData.map((record: any) => {
          const accountKey = `${record.organization_id}_${record.account_name}`;
          const accountInfo = accountMap.get(accountKey);
          return {
            ...record,
            account_state: record.account_state || accountInfo?.state || null,
            premise_type: record.premise_type || accountInfo?.premise_type || null,
            organization_name: orgMap.get(record.organization_id) || 'Unknown',
            organization_id: record.organization_id
          };
        });

        setData(transformedData);
      } else {
        const transformedData = salesData.map((record: any) => ({
          ...record,
          organization_name: orgMap.get(record.organization_id) || 'Unknown',
          organization_id: record.organization_id
        }));
        setData(transformedData);
      }
    } catch (error) {
      console.error('Unexpected error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderAdded = () => {
    fetchData();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection(null);
        setSortField('total');
      } else {
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-3 h-3" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3 h-3" />;
    }
    return <ArrowUpDown className="w-3 h-3 opacity-40" />;
  };

  const toggleBrandExpansion = async (brand: string) => {
    const newExpanded = new Set(expandedBrands);

    if (newExpanded.has(brand)) {
      newExpanded.delete(brand);
      setExpandedBrands(newExpanded);
    } else {
      newExpanded.add(brand);
      setExpandedBrands(newExpanded);

      if (!brandAccountData.has(brand)) {
        const accountData = calculateAccountDepletions(brand);
        const newMap = new Map(brandAccountData);
        newMap.set(brand, accountData);
        setBrandAccountData(newMap);
      }
    }
  };

  const toggleProductExpansion = async (brand: string, productName: string) => {
    const productKey = `${brand}|||${productName}`;
    const newExpanded = new Set(expandedProducts);

    if (newExpanded.has(productKey)) {
      newExpanded.delete(productKey);
      setExpandedProducts(newExpanded);
    } else {
      newExpanded.add(productKey);
      setExpandedProducts(newExpanded);

      if (!productAccountData.has(productKey)) {
        const accountData = calculateAccountDepletions(brand, productName);
        const newMap = new Map(productAccountData);
        newMap.set(productKey, accountData);
        setProductAccountData(newMap);
      }
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setExpandedBrands(new Set());
    setExpandedProducts(new Set());
  };


  const exportToCSV = () => {
    const isSuperAdmin = isPlatformAdmin || isAuthPlatformAdmin;
    const showOrganization = isSuperAdmin && !currentOrganization;
    let headers: string[];
    let rows: string[][];

    if (viewMode === 'brand') {
      headers = showOrganization
        ? ['Organization', 'Brand', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total']
        : ['Brand', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total'];
      rows = brandMonthlyData.map(brand => {
        const row = [
          ...(showOrganization ? [brand.organization_name || 'Unknown'] : []),
          brand.brand,
          brand.jan.toFixed(2),
          brand.feb.toFixed(2),
          brand.mar.toFixed(2),
          brand.apr.toFixed(2),
          brand.may.toFixed(2),
          brand.jun.toFixed(2),
          brand.jul.toFixed(2),
          brand.aug.toFixed(2),
          brand.sep.toFixed(2),
          brand.oct.toFixed(2),
          brand.nov.toFixed(2),
          brand.dec.toFixed(2),
          brand.total.toFixed(2)
        ];
        return row;
      });
    } else {
      headers = showOrganization
        ? ['Organization', 'Brand', 'Product', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total']
        : ['Brand', 'Product', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total'];
      rows = [];
      productViewData.forEach(brand => {
        brand.products.forEach(product => {
          rows.push([
            ...(showOrganization ? [product.organization_name || 'Unknown'] : []),
            brand.brand,
            product.product_name,
            product.jan.toFixed(2),
            product.feb.toFixed(2),
            product.mar.toFixed(2),
            product.apr.toFixed(2),
            product.may.toFixed(2),
            product.jun.toFixed(2),
            product.jul.toFixed(2),
            product.aug.toFixed(2),
            product.sep.toFixed(2),
            product.oct.toFixed(2),
            product.nov.toFixed(2),
            product.dec.toFixed(2),
            product.total.toFixed(2)
          ]);
        });
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    let filename = viewMode === 'brand' ? 'brand-monthly-cases' : 'product-monthly-cases';
    if (selectedYear !== 'all') filename += `-${selectedYear}`;
    if (selectedStates.length > 0) filename += `-${selectedStates.length}-states`;
    if (selectedBrands.length > 0) filename += `-${selectedBrands.length}-brands`;
    if (selectedProducts.length > 0) filename += `-${selectedProducts.length}-products`;
    if (selectedRepresentatives.length > 0) filename += `-${selectedRepresentatives.length}-reps`;
    if (selectedPremiseTypes.length > 0) filename += `-${selectedPremiseTypes.join('-')}`;
    filename += `-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    a.download = filename;
    a.click();
  };

  const formatCases = (cases: number) => {
    if (cases === 0) return '-';
    return cases.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">Month Over Month</h1>
          <p className="text-base text-gray-500 dark:text-zinc-400">Track brand performance and case sales across all periods</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white rounded-xl hover:shadow-xl hover:shadow-teal-500/40 hover:scale-105 transition-all duration-300 font-semibold shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Order
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-5 py-3 glass text-gray-700 dark:text-zinc-300 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 hover:scale-105 transition-all duration-300 font-semibold border border-gray-200 dark:border-white/10"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <AddOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleOrderAdded}
      />

      <MonthOverMonthSummary
        totalCases={summaryMetrics.totalCases}
        totalRevenue={summaryMetrics.totalRevenue}
        totalMarkets={summaryMetrics.totalMarkets}
        totalAccounts={summaryMetrics.totalAccounts}
        onPremiseAccounts={summaryMetrics.onPremiseAccounts}
        offPremiseAccounts={summaryMetrics.offPremiseAccounts}
      />

      <div className="glass-card p-6 rounded-2xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">Filters</h3>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-1">
            <button
              onClick={() => handleViewModeChange('brand')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                viewMode === 'brand'
                  ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-400 shadow-md'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
              }`}
            >
              Brand
            </button>
            <button
              onClick={() => handleViewModeChange('product')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                viewMode === 'product'
                  ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-400 shadow-md'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
              }`}
            >
              Product
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border-2 border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium transition-all duration-200 hover:border-teal-300 dark:hover:border-teal-500/50"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end justify-end">
              {(selectedStates.length > 0 || selectedBrands.length > 0 || selectedProducts.length > 0 || selectedRepresentatives.length > 0 || selectedPremiseTypes.length > 0) && (
                <button
                  onClick={() => {
                    setSelectedStates([]);
                    setSelectedBrands([]);
                    setSelectedProducts([]);
                    setSelectedRepresentatives([]);
                    setSelectedPremiseTypes([]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <MultiSelectDropdown
              label="State (Distributor)"
              options={availableStates}
              selectedValues={selectedStates}
              onChange={setSelectedStates}
              placeholder="All States"
            />

            <MultiSelectDropdown
              label="Brand"
              options={availableBrands}
              selectedValues={selectedBrands}
              onChange={setSelectedBrands}
              placeholder="All Brands"
            />

            <MultiSelectDropdown
              label="Product (SKU)"
              options={availableProducts}
              selectedValues={selectedProducts}
              onChange={setSelectedProducts}
              placeholder="All Products"
            />

            <MultiSelectDropdown
              label="Sales Representative"
              options={availableRepresentatives}
              selectedValues={selectedRepresentatives}
              onChange={setSelectedRepresentatives}
              placeholder="All Reps"
            />

            <MultiSelectDropdown
              label="Premise Type"
              options={['on_premise', 'off_premise', 'online', 'unclassified']}
              selectedValues={selectedPremiseTypes}
              onChange={setSelectedPremiseTypes}
              placeholder="All Premises"
            />
          </div>
        </div>
      </div>

      {selectedYear === 'all' && (
        <div className="glass-card p-4 rounded-xl mb-6 border-2 border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">
                Multi-Year Data Aggregation
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Monthly totals are aggregated across all years. For example, "Oct" shows combined cases from October 2023, October 2024, October 2025, etc. Select a specific year above for accurate monthly analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4 rounded-xl mb-6 border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              Data Range:
            </span>
            <span className="text-sm text-gray-600 dark:text-zinc-400">
              {dateRangeDisplay}
            </span>
          </div>
          {selectedYear !== 'all' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-500/30">
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                {selectedYear} Data Only
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-shadow duration-300">
        {(viewMode === 'brand' ? brandMonthlyData.length === 0 : productViewData.length === 0) ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 mb-4">
              <Package className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-lg font-medium text-gray-600 dark:text-zinc-400">No sales data available for the selected filters.</p>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-2">Try adjusting your filter criteria or add new sales data.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full">
                <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b-2 border-teal-500/20 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 z-20">
                      <button
                        onClick={() => handleSort(viewMode === 'brand' ? 'brand' : 'product')}
                        className="flex items-center gap-2 hover:text-teal-600 dark:hover:text-teal-400 transition-colors group"
                      >
                        <span>{viewMode === 'brand' ? 'Brand' : 'Brand / Product'}</span>
                        <span className="group-hover:scale-110 transition-transform">{getSortIcon(viewMode === 'brand' ? 'brand' : 'product')}</span>
                      </button>
                    </th>
                    {MONTHS.map(month => (
                      <th key={month.key} className="px-4 py-4 text-center text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort(month.key as SortField)}
                          className="flex items-center gap-1 mx-auto hover:text-orange-600 dark:hover:text-orange-400 transition-colors group"
                        >
                          <span>{month.label}</span>
                          <span className="group-hover:scale-110 transition-transform">{getSortIcon(month.key as SortField)}</span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20">
                      <button
                        onClick={() => handleSort('total')}
                        className="flex items-center gap-1 mx-auto hover:text-teal-600 dark:hover:text-teal-400 transition-colors group"
                      >
                        <span>Total</span>
                        <span className="group-hover:scale-110 transition-transform">{getSortIcon('total')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {viewMode === 'brand' ? (
                    brandMonthlyData.map((brand) => {
                      const isExpanded = expandedBrands.has(brand.brand);
                      const accountData = brandAccountData.get(brand.brand) || [];

                      return (
                        <>
                          <tr key={brand.brand} className="hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-transparent dark:hover:from-teal-900/10 dark:hover:to-transparent transition-all duration-200 group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-zinc-900 group-hover:bg-teal-50/50 dark:group-hover:bg-teal-900/10 z-10 transition-colors duration-200">
                              <button
                                onClick={() => toggleBrandExpansion(brand.brand)}
                                className="flex items-center gap-2 hover:text-teal-600 dark:hover:text-teal-400 transition-all duration-200 group-hover:translate-x-1"
                              >
                                <span className="p-1 rounded-lg bg-gray-100 dark:bg-zinc-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition-colors duration-200">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </span>
                                <div className="flex flex-col">
                                  <span>{brand.brand}</span>
                                  {brand.organization_name && !currentOrganization && (isPlatformAdmin || isAuthPlatformAdmin) && (
                                    <span className="text-xs text-theme-muted flex items-center gap-1">
                                      <Building2 className="w-3 h-3" />
                                      {brand.organization_name}
                                    </span>
                                  )}
                                </div>
                              </button>
                            </td>
                            {MONTHS.map(month => {
                              const value = brand[month.key as keyof Omit<BrandMonthlyData, 'brand' | 'total'>] as number;
                              return (
                                <td
                                  key={month.key}
                                  className={`px-4 py-4 whitespace-nowrap text-sm text-center transition-colors ${
                                    value > 0
                                      ? 'font-semibold text-gray-800 dark:text-zinc-200'
                                      : 'text-gray-400 dark:text-zinc-600 font-normal'
                                  }`}
                                >
                                  <span className={value > 0 ? 'inline-block px-2 py-1 rounded-lg bg-gray-50 dark:bg-zinc-800/50' : ''}>
                                    {formatCases(value)}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-teal-700 dark:text-teal-400 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20">
                              <span className="inline-block px-3 py-1 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                                {formatCases(brand.total)}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && accountData.map((account) => (
                          <tr key={account.account_name} className="bg-gradient-to-r from-gray-50 via-gray-50 to-transparent dark:from-zinc-900/50 dark:via-zinc-900/50 dark:to-transparent hover:bg-white/80 dark:hover:bg-white/5 transition-all duration-150">
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-zinc-300 sticky left-0 bg-gray-50/80 dark:bg-zinc-900/50 hover:bg-white/90 dark:hover:bg-white/5 z-10 transition-colors duration-150">
                              <div className="flex items-center gap-2 ml-12 pl-2 border-l-4 border-teal-400/40 dark:border-teal-500/30">
                                <span>{account.account_name}</span>
                                {account.premise_type === 'on_premise' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-sm">
                                    <Wine className="w-3 h-3" />
                                    On
                                  </span>
                                )}
                                {account.premise_type === 'off_premise' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-teal-100 to-emerald-200 dark:from-teal-900/30 dark:to-emerald-800/30 text-teal-700 dark:text-teal-300 text-xs font-semibold shadow-sm">
                                    <Store className="w-3 h-3" />
                                    Off
                                  </span>
                                )}
                                {account.premise_type === 'online' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300 text-xs font-semibold shadow-sm">
                                    <ShoppingCart className="w-3 h-3" />
                                    Online
                                  </span>
                                )}
                                {account.premise_type === 'unclassified' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-gray-200 to-gray-300 dark:from-zinc-700 dark:to-zinc-600 text-gray-600 dark:text-zinc-400 text-xs font-semibold shadow-sm">
                                    <HelpCircle className="w-3 h-3" />
                                  </span>
                                )}
                                {account.account_state && (
                                  <span className="text-xs text-gray-500 dark:text-zinc-500">({account.account_state})</span>
                                )}
                              </div>
                            </td>
                            {MONTHS.map(month => {
                              const value = account[month.key as keyof Omit<AccountDepletionData, 'account_name' | 'account_state' | 'premise_type' | 'total'>] as number;
                              return (
                                <td
                                  key={month.key}
                                  className={`px-4 py-3 whitespace-nowrap text-xs text-center transition-colors ${
                                    value > 0 ? 'text-gray-700 dark:text-zinc-300 font-medium' : 'text-gray-400 dark:text-zinc-600'
                                  }`}
                                >
                                  {formatCases(value)}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-center font-bold text-teal-600 dark:text-teal-400 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 dark:from-teal-900/10 dark:to-emerald-900/10">
                              {formatCases(account.total)}
                            </td>
                          </tr>
                          ))}
                        </>
                      );
                    })
                  ) : (
                    productViewData.map((brandWithProducts) => {
                      const isBrandExpanded = expandedBrands.has(brandWithProducts.brand);

                      return (
                        <>
                          <tr key={brandWithProducts.brand} className="bg-gray-50/50 dark:bg-zinc-800/30 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-all duration-200 group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-50/50 dark:bg-zinc-800/30 group-hover:bg-gray-100/50 dark:group-hover:bg-zinc-800/50 z-10 transition-colors duration-200">
                              <button
                                onClick={() => toggleBrandExpansion(brandWithProducts.brand)}
                                className="flex items-center gap-2 hover:text-teal-600 dark:hover:text-teal-400 transition-all duration-200 group-hover:translate-x-1"
                              >
                                <span className="p-1 rounded-lg bg-gray-200 dark:bg-zinc-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition-colors duration-200">
                                  {isBrandExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </span>
                                <div className="flex flex-col">
                                  <span>{brandWithProducts.brand}</span>
                                  {brandWithProducts.organization_name && !currentOrganization && (isPlatformAdmin || isAuthPlatformAdmin) && (
                                    <span className="text-xs text-theme-muted flex items-center gap-1">
                                      <Building2 className="w-3 h-3" />
                                      {brandWithProducts.organization_name}
                                    </span>
                                  )}
                                </div>
                              </button>
                            </td>
                            {MONTHS.map(month => {
                              const value = brandWithProducts[month.key as keyof Omit<BrandWithProducts, 'brand' | 'products' | 'total'>] as number;
                              return (
                                <td
                                  key={month.key}
                                  className={`px-4 py-4 whitespace-nowrap text-sm text-center transition-colors ${
                                    value > 0
                                      ? 'font-semibold text-gray-800 dark:text-zinc-200'
                                      : 'text-gray-400 dark:text-zinc-600 font-normal'
                                  }`}
                                >
                                  <span className={value > 0 ? 'inline-block px-2 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800/50' : ''}>
                                    {formatCases(value)}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-teal-700 dark:text-teal-400 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20">
                              <span className="inline-block px-3 py-1 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                                {formatCases(brandWithProducts.total)}
                              </span>
                            </td>
                          </tr>
                          {isBrandExpanded && brandWithProducts.products.map((product) => {
                            const productKey = `${brandWithProducts.brand}|||${product.product_name}`;
                            const isProductExpanded = expandedProducts.has(productKey);
                            const accountData = productAccountData.get(productKey) || [];

                            return (
                              <>
                                <tr key={productKey} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/10 dark:hover:to-transparent transition-all duration-200 group">
                                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200 sticky left-0 bg-white dark:bg-zinc-900 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 z-10 transition-colors duration-200">
                                    <button
                                      onClick={() => toggleProductExpansion(brandWithProducts.brand, product.product_name)}
                                      className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 ml-8"
                                    >
                                      <span className="p-1 rounded-lg bg-gray-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors duration-200">
                                        {isProductExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                      </span>
                                      <span className="font-medium">{product.product_name}</span>
                                    </button>
                                  </td>
                                  {MONTHS.map(month => {
                                    const value = product[month.key as keyof Omit<ProductMonthlyData, 'product_name' | 'brand' | 'total'>] as number;
                                    return (
                                      <td
                                        key={month.key}
                                        className={`px-4 py-3 whitespace-nowrap text-xs text-center transition-colors ${
                                          value > 0
                                            ? 'font-semibold text-gray-700 dark:text-zinc-300'
                                            : 'text-gray-400 dark:text-zinc-600 font-normal'
                                        }`}
                                      >
                                        <span className={value > 0 ? 'inline-block px-2 py-1 rounded-lg bg-gray-50 dark:bg-zinc-800/50' : ''}>
                                          {formatCases(value)}
                                        </span>
                                      </td>
                                    );
                                  })}
                                  <td className="px-4 py-3 whitespace-nowrap text-xs text-center font-bold text-blue-700 dark:text-blue-400 bg-gradient-to-r from-blue-50/50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-800/10">
                                    <span className="inline-block px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                      {formatCases(product.total)}
                                    </span>
                                  </td>
                                </tr>
                                {isProductExpanded && accountData.map((account) => (
                                  <tr key={account.account_name} className="bg-gradient-to-r from-gray-50 via-gray-50 to-transparent dark:from-zinc-900/50 dark:via-zinc-900/50 dark:to-transparent hover:bg-white/80 dark:hover:bg-white/5 transition-all duration-150">
                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-zinc-300 sticky left-0 bg-gray-50/80 dark:bg-zinc-900/50 hover:bg-white/90 dark:hover:bg-white/5 z-10 transition-colors duration-150">
                                      <div className="flex items-center gap-2 ml-16 pl-2 border-l-4 border-blue-400/40 dark:border-blue-500/30">
                                        <span>{account.account_name}</span>
                                        {account.premise_type === 'on_premise' && (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-sm">
                                            <Wine className="w-3 h-3" />
                                            On
                                          </span>
                                        )}
                                        {account.premise_type === 'off_premise' && (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-teal-100 to-emerald-200 dark:from-teal-900/30 dark:to-emerald-800/30 text-teal-700 dark:text-teal-300 text-xs font-semibold shadow-sm">
                                            <Store className="w-3 h-3" />
                                            Off
                                          </span>
                                        )}
                                        {account.premise_type === 'online' && (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300 text-xs font-semibold shadow-sm">
                                            <ShoppingCart className="w-3 h-3" />
                                            Online
                                          </span>
                                        )}
                                        {account.premise_type === 'unclassified' && (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-gray-200 to-gray-300 dark:from-zinc-700 dark:to-zinc-600 text-gray-600 dark:text-zinc-400 text-xs font-semibold shadow-sm">
                                            <HelpCircle className="w-3 h-3" />
                                          </span>
                                        )}
                                        {account.account_state && (
                                          <span className="text-xs text-gray-500 dark:text-zinc-500">({account.account_state})</span>
                                        )}
                                      </div>
                                    </td>
                                    {MONTHS.map(month => {
                                      const value = account[month.key as keyof Omit<AccountDepletionData, 'account_name' | 'account_state' | 'premise_type' | 'total'>] as number;
                                      return (
                                        <td
                                          key={month.key}
                                          className={`px-4 py-3 whitespace-nowrap text-xs text-center transition-colors ${
                                            value > 0 ? 'text-gray-700 dark:text-zinc-300 font-medium' : 'text-gray-400 dark:text-zinc-600'
                                          }`}
                                        >
                                          {formatCases(value)}
                                        </td>
                                      );
                                    })}
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-center font-bold text-teal-600 dark:text-teal-400 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 dark:from-teal-900/10 dark:to-emerald-900/10">
                                      {formatCases(account.total)}
                                    </td>
                                  </tr>
                                ))}
                              </>
                            );
                          })}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t-2 border-gray-100 dark:border-white/10 bg-gradient-to-r from-gray-50 to-transparent dark:from-zinc-900/50 dark:to-transparent">
              <div className="flex justify-center items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                  <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-sm text-gray-700 dark:text-zinc-300 font-semibold">
                    {viewMode === 'brand'
                      ? `${brandMonthlyData.length} brand${brandMonthlyData.length !== 1 ? 's' : ''}`
                      : `${productViewData.length} brand${productViewData.length !== 1 ? 's' : ''}, ${entityCount} product${entityCount !== 1 ? 's' : ''}`
                    }
                  </span>
                </div>
                {(selectedYear !== 'all' || selectedStates.length > 0 || selectedBrands.length > 0 || selectedProducts.length > 0 || selectedRepresentatives.length > 0 || selectedPremiseTypes.length > 0) && (
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-zinc-400">
                    {selectedYear !== 'all' && (
                      <span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-md font-medium">
                        {selectedYear}
                      </span>
                    )}
                    {selectedStates.length > 0 && (
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-md font-medium">
                        {selectedStates.length} state{selectedStates.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {selectedBrands.length > 0 && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md font-medium">
                        {selectedBrands.length} brand{selectedBrands.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {selectedProducts.length > 0 && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md font-medium">
                        {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {selectedRepresentatives.length > 0 && (
                      <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-md font-medium">
                        {selectedRepresentatives.length} rep{selectedRepresentatives.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {selectedPremiseTypes.length > 0 && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                        {selectedPremiseTypes.length} premise{selectedPremiseTypes.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
