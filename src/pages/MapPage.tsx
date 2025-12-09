import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { DollarSign, ShoppingCart, MapPin, Building2 } from 'lucide-react';
import { normalizeStateName, stateCoordinates } from '../lib/stateUtils';
import { useNavigate } from 'react-router-dom';

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

interface DistributorInfo {
  name: string;
  revenue: number;
  active: boolean;
}

interface StateData {
  state: string;
  revenue: number;
  orders: number;
  accounts: number;
  distributorCount: number;
  activeDistributors: number;
  distributors: DistributorInfo[];
}

type DataMode = 'sales' | 'distributors';


export default function MapPage() {
  const { currentOrganization, isPlatformAdmin, isViewingAllBrands } = useOrganization();
  const navigate = useNavigate();
  const [stateData, setStateData] = useState<StateData[]>([]);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataMode, setDataMode] = useState<DataMode>('sales');

  const fetchAllBrandsMapData = async () => {
    setLoading(true);

    // Fetch all active distributors (custom + global) from all organizations
    const { data: distributorsData, error: distError } = await supabase
      .from('distributors')
      .select('id, name, state, active, is_global')
      .eq('active', true);

    // Fetch all sales data across all organizations
    const { data: salesData, error: salesError } = await supabase
      .from('sales_data')
      .select('distributor, region, revenue, account_name, organization_id');

    const hasDistributorData = !distError && distributorsData && distributorsData.length > 0;
    const hasSalesData = !salesError && salesData && salesData.length > 0;

    if (!hasDistributorData && !hasSalesData) {
      setStateData([]);
      setDataMode('sales');
      setLoading(false);
      return;
    }

    const stateMap = new Map<string, {
      revenue: number;
      orderCount: number;
      accounts: Set<string>;
      distributorCount: number;
      activeDistributors: number;
      distributorRevenue: Map<string, { revenue: number; active: boolean }>;
    }>();

    let unmappedSalesCount = 0;
    let distributorMappedSalesCount = 0;
    let regionMappedSalesCount = 0;

    if (hasDistributorData && hasSalesData) {
      const distributorNameToState = new Map<string, { state: string; active: boolean }>();
      distributorsData.forEach((dist: any) => {
        // Use organization-specific state if available, otherwise use distributor's default state
        const stateToUse = orgDistributorStates[dist.id] || dist.state;
        if (stateToUse) {
          distributorNameToState.set(dist.name.toLowerCase().trim(), {
            state: stateToUse,
            active: dist.active
          });
        }
      });

      salesData.forEach((sale: any) => {
        let normalizedState: string | null = null;
        let distributorName = '';
        let isActive = true;

        if (sale.distributor) {
          const distKey = sale.distributor.toLowerCase().trim();
          const distInfo = distributorNameToState.get(distKey);
          if (distInfo) {
            normalizedState = normalizeStateName(distInfo.state);
            distributorName = sale.distributor;
            isActive = distInfo.active;
            if (normalizedState) {
              distributorMappedSalesCount++;
            }
          }
        }

        if (!normalizedState && sale.region) {
          normalizedState = normalizeStateName(sale.region);
          if (normalizedState) {
            regionMappedSalesCount++;
          }
        }

        if (!normalizedState) {
          unmappedSalesCount++;
          return;
        }

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.revenue += Number(sale.revenue) || 0;
        stateEntry.orderCount += 1;

        if (sale.account_name) {
          stateEntry.accounts.add(sale.account_name);
        }

        if (distributorName) {
          const distRev = stateEntry.distributorRevenue.get(distributorName) || { revenue: 0, active: isActive };
          distRev.revenue += Number(sale.revenue) || 0;
          stateEntry.distributorRevenue.set(distributorName, distRev);
        }

        stateMap.set(normalizedState, stateEntry);
      });

      distributorsData.forEach((dist: any) => {
        // Use organization-specific state if available, otherwise use distributor's default state
        const stateToUse = orgDistributorStates[dist.id] || dist.state;
        if (!stateToUse) return;
        const normalizedState = normalizeStateName(stateToUse);
        if (!normalizedState) return;

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.distributorCount++;
        if (dist.active) {
          stateEntry.activeDistributors++;
        }

        if (!stateEntry.distributorRevenue.has(dist.name)) {
          stateEntry.distributorRevenue.set(dist.name, { revenue: 0, active: dist.active });
        }

        stateMap.set(normalizedState, stateEntry);
      });

      console.log(
        `[All Brands] Sales mapping: ${distributorMappedSalesCount} via distributor, ` +
        `${regionMappedSalesCount} via region, ${unmappedSalesCount} unmapped`
      );

      setDataMode('sales');
    } else if (hasDistributorData) {
      distributorsData.forEach((dist: any) => {
        // Use organization-specific state if available, otherwise use distributor's default state
        const stateToUse = orgDistributorStates[dist.id] || dist.state;
        if (!stateToUse) return;
        const normalizedState = normalizeStateName(stateToUse);
        if (!normalizedState) return;

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.distributorCount++;
        if (dist.active) {
          stateEntry.activeDistributors++;
        }

        stateEntry.distributorRevenue.set(dist.name, { revenue: 0, active: dist.active });
        stateMap.set(normalizedState, stateEntry);
      });

      setDataMode('distributors');
    } else if (hasSalesData) {
      salesData.forEach((sale: any) => {
        const normalizedState = normalizeStateName(sale.region);
        if (!normalizedState) {
          unmappedSalesCount++;
          return;
        }

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.revenue += Number(sale.revenue) || 0;
        stateEntry.orderCount += 1;

        if (sale.account_name) {
          stateEntry.accounts.add(sale.account_name);
        }

        stateMap.set(normalizedState, stateEntry);
      });

      setDataMode('sales');
    }

    const states = Array.from(stateMap.entries())
      .map(([state, data]) => {
        const distributors = Array.from(data.distributorRevenue.entries())
          .map(([name, info]) => ({
            name,
            revenue: info.revenue,
            active: info.active
          }))
          .sort((a, b) => b.revenue - a.revenue);

        return {
          state,
          revenue: data.revenue,
          orders: data.orderCount,
          accounts: data.accounts.size,
          distributorCount: data.distributorCount,
          activeDistributors: data.activeDistributors,
          distributors
        };
      })
      .filter(s => stateCoordinates[s.state])
      .sort((a, b) => b.revenue - a.revenue);

    setStateData(states);
    setLoading(false);
  };

  useEffect(() => {
    fetchMapData();
  }, [currentOrganization, isPlatformAdmin, isViewingAllBrands]);

  const fetchMapData = async () => {
    if (!isPlatformAdmin && !currentOrganization) return;

    // Platform admin viewing all brands
    if (isPlatformAdmin && isViewingAllBrands) {
      await fetchAllBrandsMapData();
      return;
    }

    // Regular user or platform admin viewing specific brand
    if (!currentOrganization) return;

    setLoading(true);

    // Query organization_distributors junction table to get added global distributors
    const [addedGlobalResult, customResult] = await Promise.all([
      supabase
        .from('organization_distributors')
        .select('distributor_id, state, distributors(id, name, state, active, is_global)')
        .eq('organization_id', currentOrganization.id),
      supabase
        .from('distributors')
        .select('id, name, state, active, is_global')
        .eq('organization_id', currentOrganization.id)
        .eq('is_global', false)
    ]);

    const { data: addedGlobalData, error: addedGlobalError } = addedGlobalResult;
    const { data: customData, error: customError } = customResult;

    let distributorsData: any[] = [];
    const orgDistributorStates: Record<string, string> = {};

    if (!addedGlobalError && !customError) {
      // Process added global distributors
      const globalDistributors = (addedGlobalData || [])
        .map((item: any) => {
          if (item.distributors && item.state) {
            orgDistributorStates[item.distributor_id] = item.state;
          }
          return item.distributors;
        })
        .filter((d: any) => d !== null);

      // Combine custom and global distributors
      distributorsData = [...(customData || []), ...globalDistributors];

      // Filter to only active distributors
      distributorsData = distributorsData.filter((d: any) => d.active === true);
    }

    const distError = addedGlobalError || customError;

    const { data: salesData, error: salesError } = await supabase
      .from('sales_data')
      .select('distributor, region, revenue, account_name')
      .eq('organization_id', currentOrganization.id);

    const hasDistributorData = !distError && distributorsData && distributorsData.length > 0;
    const hasSalesData = !salesError && salesData && salesData.length > 0;

    if (!hasDistributorData && !hasSalesData) {
      setStateData([]);
      setDataMode('sales');
      setLoading(false);
      return;
    }

    const stateMap = new Map<string, {
      revenue: number;
      orderCount: number;
      accounts: Set<string>;
      distributorCount: number;
      activeDistributors: number;
      distributorRevenue: Map<string, { revenue: number; active: boolean }>;
    }>();

    let unmappedSalesCount = 0;
    let distributorMappedSalesCount = 0;
    let regionMappedSalesCount = 0;

    if (hasDistributorData && hasSalesData) {
      const distributorNameToState = new Map<string, { state: string; active: boolean }>();
      distributorsData.forEach((dist: any) => {
        // Use organization-specific state if available, otherwise use distributor's default state
        const stateToUse = orgDistributorStates[dist.id] || dist.state;
        if (stateToUse) {
          distributorNameToState.set(dist.name.toLowerCase().trim(), {
            state: stateToUse,
            active: dist.active
          });
        }
      });

      salesData.forEach((sale: any) => {
        let normalizedState: string | null = null;
        let distributorName = '';
        let isActive = true;

        if (sale.distributor) {
          const distKey = sale.distributor.toLowerCase().trim();
          const distInfo = distributorNameToState.get(distKey);
          if (distInfo) {
            normalizedState = normalizeStateName(distInfo.state);
            distributorName = sale.distributor;
            isActive = distInfo.active;
            if (normalizedState) {
              distributorMappedSalesCount++;
            }
          }
        }

        if (!normalizedState && sale.region) {
          normalizedState = normalizeStateName(sale.region);
          if (normalizedState) {
            regionMappedSalesCount++;
          }
        }

        if (!normalizedState) {
          unmappedSalesCount++;
          return;
        }

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.revenue += Number(sale.revenue) || 0;
        stateEntry.orderCount += 1;

        if (sale.account_name) {
          stateEntry.accounts.add(sale.account_name);
        }

        if (distributorName) {
          const distRev = stateEntry.distributorRevenue.get(distributorName) || { revenue: 0, active: isActive };
          distRev.revenue += Number(sale.revenue) || 0;
          stateEntry.distributorRevenue.set(distributorName, distRev);
        }

        stateMap.set(normalizedState, stateEntry);
      });

      distributorsData.forEach((dist: any) => {
        // Use organization-specific state if available, otherwise use distributor's default state
        const stateToUse = orgDistributorStates[dist.id] || dist.state;
        if (!stateToUse) return;
        const normalizedState = normalizeStateName(stateToUse);
        if (!normalizedState) return;

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.distributorCount++;
        if (dist.active) {
          stateEntry.activeDistributors++;
        }

        if (!stateEntry.distributorRevenue.has(dist.name)) {
          stateEntry.distributorRevenue.set(dist.name, { revenue: 0, active: dist.active });
        }

        stateMap.set(normalizedState, stateEntry);
      });

      console.log(
        `Sales mapping: ${distributorMappedSalesCount} via distributor, ` +
        `${regionMappedSalesCount} via region, ${unmappedSalesCount} unmapped`
      );

      setDataMode('sales');
    } else if (hasDistributorData) {
      distributorsData.forEach((dist: any) => {
        // Use organization-specific state if available, otherwise use distributor's default state
        const stateToUse = orgDistributorStates[dist.id] || dist.state;
        if (!stateToUse) return;
        const normalizedState = normalizeStateName(stateToUse);
        if (!normalizedState) return;

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.distributorCount++;
        if (dist.active) {
          stateEntry.activeDistributors++;
        }

        stateEntry.distributorRevenue.set(dist.name, { revenue: 0, active: dist.active });
        stateMap.set(normalizedState, stateEntry);
      });

      setDataMode('distributors');
    } else if (hasSalesData) {
      salesData.forEach((sale: any) => {
        const normalizedState = normalizeStateName(sale.region);
        if (!normalizedState) {
          unmappedSalesCount++;
          return;
        }

        const stateEntry = stateMap.get(normalizedState) || {
          revenue: 0,
          orderCount: 0,
          accounts: new Set(),
          distributorCount: 0,
          activeDistributors: 0,
          distributorRevenue: new Map()
        };

        stateEntry.revenue += Number(sale.revenue) || 0;
        stateEntry.orderCount += 1;

        if (sale.account_name) {
          stateEntry.accounts.add(sale.account_name);
        }

        stateMap.set(normalizedState, stateEntry);
      });

      setDataMode('sales');
    }

    const states = Array.from(stateMap.entries())
      .map(([state, data]) => {
        const distributors = Array.from(data.distributorRevenue.entries())
          .map(([name, info]) => ({
            name,
            revenue: info.revenue,
            active: info.active
          }))
          .sort((a, b) => b.revenue - a.revenue);

        return {
          state,
          revenue: data.revenue,
          orders: data.orderCount,
          accounts: data.accounts.size,
          distributorCount: data.distributorCount,
          activeDistributors: data.activeDistributors,
          distributors
        };
      })
      .filter(s => stateCoordinates[s.state])
      .sort((a, b) => b.revenue - a.revenue);

    setStateData(states);
    setLoading(false);
  };


  const getStateColor = (stateName: string) => {
    const state = stateData.find(s => s.state === stateName);
    if (!state) return '#f3f4f6';

    if (dataMode === 'distributors') {
      const maxDistributors = Math.max(...stateData.map(s => s.distributorCount || 0));
      const intensity = (state.distributorCount || 0) / maxDistributors;

      if (intensity > 0.7) return '#2563eb';
      if (intensity > 0.5) return '#3b82f6';
      if (intensity > 0.3) return '#60a5fa';
      if (intensity > 0.1) return '#93c5fd';
      return '#bfdbfe';
    } else {
      const maxRevenue = Math.max(...stateData.map(s => s.revenue));
      const intensity = state.revenue / maxRevenue;

      if (intensity > 0.7) return '#059669';
      if (intensity > 0.5) return '#10b981';
      if (intensity > 0.3) return '#34d399';
      if (intensity > 0.1) return '#6ee7b7';
      return '#a7f3d0';
    }
  };


  const totalRevenue = stateData.reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = stateData.reduce((sum, s) => sum + s.orders, 0);
  const totalDistributors = stateData.reduce((sum, s) => sum + (s.distributorCount || 0), 0);
  const totalStates = stateData.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (stateData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold text-theme-text mb-2">Geographic Sales Map</h1>
          <p className="text-theme-muted">
            Interactive visualization of sales across the United States
          </p>
        </div>

        <div className="glass-card rounded-2xl p-12 text-center">
          <MapPin className="w-16 h-16 text-theme-muted mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-theme-text mb-2">No Data Available</h2>
          <p className="text-theme-muted mb-6 max-w-md mx-auto">
            Get started by adding distributors to see their locations on the map, or upload sales data to visualize revenue by state.
          </p>
          <button
            onClick={() => navigate('/dashboard/distributors')}
            className="px-6 py-3 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition-all font-medium"
          >
            Add Distributors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-theme-text mb-2">Geographic Sales Map</h1>
          <p className="text-theme-muted">
            {isViewingAllBrands
              ? `Interactive visualization ${dataMode === 'sales' ? 'of sales' : 'of distributors'} across all brands in the United States`
              : `Interactive visualization ${dataMode === 'sales' ? 'of sales' : 'of distributors'} across the United States`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isViewingAllBrands && (
            <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-theme-text">All Brands View</span>
            </div>
          )}
          {dataMode === 'distributors' && (
            <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-theme-text">Distributor View</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dataMode === 'sales' ? (
          <>
            <div className="glass-card rounded-2xl p-6 glow-hover-teal">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Revenue</span>
                <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-theme-text">
                ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <p className="text-xs text-theme-muted mt-1">Across all states</p>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-blue">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Orders</span>
                <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-theme-text">
                {totalOrders.toLocaleString()}
              </span>
              <p className="text-xs text-theme-muted mt-1">All transactions</p>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-blue">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Active States</span>
                <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-theme-text">{totalStates}</span>
              <p className="text-xs text-theme-muted mt-1">With sales activity</p>
            </div>
          </>
        ) : (
          <>
            <div className="glass-card rounded-2xl p-6 glow-hover-blue">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Distributors</span>
                <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-theme-text">
                {totalDistributors.toLocaleString()}
              </span>
              <p className="text-xs text-theme-muted mt-1">Across all states</p>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-teal">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Active Distributors</span>
                <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-theme-text">
                {stateData.reduce((sum, s) => sum + (s.activeDistributors || 0), 0).toLocaleString()}
              </span>
              <p className="text-xs text-theme-muted mt-1">Currently operational</p>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-blue">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">States Covered</span>
                <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-theme-text">{totalStates}</span>
              <p className="text-xs text-theme-muted mt-1">With distributor presence</p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl p-6 glow-hover-blue">
            <h2 className="text-xl font-semibold text-theme-text mb-4">
              {dataMode === 'sales' ? 'United States Sales Map' : 'United States Distributor Map'}
            </h2>
            <div className="relative bg-white/5 rounded-xl overflow-hidden" style={{ height: '600px' }}>
              <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: '100%' }}>
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const stateName = geo.properties.name;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={() => setHoveredState(stateName)}
                          onMouseLeave={() => setHoveredState(null)}
                          style={{
                            default: {
                              fill: getStateColor(stateName),
                              stroke: '#1f2937',
                              strokeWidth: 0.75,
                              outline: 'none',
                            },
                            hover: {
                              fill: '#047857',
                              stroke: '#1f2937',
                              strokeWidth: 1.5,
                              outline: 'none',
                              cursor: 'pointer',
                            },
                            pressed: {
                              fill: '#065f46',
                              stroke: '#1f2937',
                              strokeWidth: 2,
                              outline: 'none',
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>

              {hoveredState && (() => {
                const state = stateData.find(s => s.state === hoveredState);
                if (!state) {
                  return (
                    <div className="absolute top-4 left-4 glass rounded-xl p-4 pointer-events-none max-w-xs">
                      <h3 className="font-semibold text-theme-text mb-2">{hoveredState}</h3>
                      <p className="text-sm text-theme-muted">No data</p>
                    </div>
                  );
                }

                return (
                  <div className="absolute top-4 left-4 glass rounded-xl p-4 pointer-events-none max-w-xs">
                    <h3 className="font-semibold text-theme-text mb-2">{hoveredState}</h3>
                    <div className="space-y-1 text-sm">
                      {dataMode === 'sales' ? (
                        <>
                          <p className="text-theme-muted">
                            Revenue: <span className="font-semibold text-theme-text">
                              ${state.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </p>
                          <p className="text-theme-muted">
                            Orders: <span className="font-semibold text-theme-text">
                              {state.orders.toLocaleString()}
                            </span>
                          </p>
                          <p className="text-theme-muted">
                            Accounts: <span className="font-semibold text-theme-text">
                              {state.accounts}
                            </span>
                          </p>
                          {state.distributors.length > 0 && (
                            <>
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-xs text-theme-muted font-semibold mb-1">Top Distributors:</p>
                                {state.distributors.slice(0, 3).map(dist => (
                                  <p key={dist.name} className="text-xs text-theme-muted">
                                    {dist.name}: <span className="font-semibold text-theme-text">
                                      ${dist.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    {!dist.active && <span className="text-orange-400 ml-1">(Inactive)</span>}
                                  </p>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-theme-muted">
                            Distributors: <span className="font-semibold text-theme-text">
                              {state.distributorCount}
                            </span>
                          </p>
                          <p className="text-theme-muted">
                            Active: <span className="font-semibold text-theme-text">
                              {state.activeDistributors}
                            </span>
                          </p>
                          {state.distributors.length > 0 && (
                            <>
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-xs text-theme-muted font-semibold mb-1">Distributors:</p>
                                {state.distributors.slice(0, 5).map(dist => (
                                  <p key={dist.name} className="text-xs text-theme-muted">
                                    {dist.name}
                                    {!dist.active && <span className="text-orange-400 ml-1">(Inactive)</span>}
                                  </p>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-theme-muted flex-wrap">
              <span>Hover over a state to view {dataMode === 'sales' ? 'sales' : 'distributor'} details</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 glow-hover-purple">
            <h2 className="text-xl font-semibold text-theme-text mb-4">
              {dataMode === 'sales' ? 'Top States by Revenue' : 'Top States by Distributors'}
            </h2>
            <div className="space-y-3 max-h-[580px] overflow-y-auto">
              {stateData.slice(0, 20).map((state, index) => (
                <div
                  key={state.state}
                  className="glass rounded-xl p-4 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-teal rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {index + 1}
                      </div>
                      <h3 className="font-semibold text-theme-text">{state.state}</h3>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    {dataMode === 'sales' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-theme-muted">Revenue:</span>
                          <span className="font-semibold text-theme-text">
                            ${state.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-theme-muted">Orders:</span>
                          <span className="font-semibold text-theme-text">{state.orders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-theme-muted">Accounts:</span>
                          <span className="font-semibold text-theme-text">{state.accounts}</span>
                        </div>
                        {state.distributorCount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-theme-muted">Distributors:</span>
                            <span className="font-semibold text-theme-text">{state.distributorCount}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-theme-muted">Distributors:</span>
                          <span className="font-semibold text-theme-text">{state.distributorCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-theme-muted">Active:</span>
                          <span className="font-semibold text-theme-text">{state.activeDistributors}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
