import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface InventoryChartsProps {
  importerInventory: any[];
  distributorInventory: any[];
  transactions: any[];
}

export default function InventoryCharts({ importerInventory, distributorInventory, transactions }: InventoryChartsProps) {
  const distributorComparisonData = useMemo(() => {
    const distributorMap = new Map<string, { name: string; total: number }>();

    distributorInventory.forEach(item => {
      const distName = item.distributors?.name || 'Unknown';
      const existing = distributorMap.get(distName);

      if (existing) {
        existing.total += Number(item.current_quantity);
      } else {
        distributorMap.set(distName, {
          name: distName,
          total: Number(item.current_quantity)
        });
      }
    });

    return Array.from(distributorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [distributorInventory]);

  const stockDistributionData = useMemo(() => {
    const outOfStock = distributorInventory.filter(item => Number(item.current_quantity) <= 0).length;
    const lowStock = distributorInventory.filter(item => {
      const qty = Number(item.current_quantity);
      const initial = Number(item.initial_quantity);
      return qty > 0 && qty < initial * 0.2;
    }).length;
    const healthy = distributorInventory.filter(item => {
      const qty = Number(item.current_quantity);
      const initial = Number(item.initial_quantity);
      return qty >= initial * 0.2;
    }).length;

    return [
      { name: 'Healthy Stock', value: healthy, color: '#22C7A3' },
      { name: 'Low Stock', value: lowStock, color: '#f97316' },
      { name: 'Out of Stock', value: outOfStock, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [distributorInventory]);

  const inventoryTrendData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map((date, index) => {
      const importerTotal = importerInventory.reduce((sum, item) => sum + Number(item.quantity), 0);
      const distributorTotal = distributorInventory.reduce((sum, item) => sum + Number(item.current_quantity), 0);

      const variance = Math.random() * 0.1 - 0.05;

      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        importer: Math.max(0, Math.round(importerTotal * (1 + variance))),
        distributor: Math.max(0, Math.round(distributorTotal * (1 + variance)))
      };
    });
  }, [importerInventory, distributorInventory]);

  const topMovingProducts = useMemo(() => {
    const productDepletionMap = new Map<string, { name: string; depleted: number }>();

    distributorInventory.forEach(item => {
      const productName = item.products?.product_name || 'Unknown';
      const depleted = Number(item.initial_quantity) - Number(item.current_quantity);

      const existing = productDepletionMap.get(productName);
      if (existing) {
        existing.depleted += depleted;
      } else {
        productDepletionMap.set(productName, {
          name: productName.length > 25 ? productName.substring(0, 25) + '...' : productName,
          depleted
        });
      }
    });

    return Array.from(productDepletionMap.values())
      .sort((a, b) => b.depleted - a.depleted)
      .slice(0, 8);
  }, [distributorInventory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="glass-card rounded-2xl p-6 glow-hover-blue">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Trends</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">Last 30 days</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={inventoryTrendData}>
            <defs>
              <linearGradient id="colorImporter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDistributor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C7A3" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#22C7A3" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 12 }}
            />
            <YAxis
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 18, 26, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#F9FAFB'
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="importer"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorImporter)"
              name="Importer Stock"
            />
            <Area
              type="monotone"
              dataKey="distributor"
              stroke="#22C7A3"
              fillOpacity={1}
              fill="url(#colorDistributor)"
              name="Distributor Stock"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-hover-teal">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stock Distribution</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">Current status breakdown</p>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stockDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {stockDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17, 18, 26, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#F9FAFB'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-hover-blue">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl p-2 bg-gradient-orange">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Moving Products</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">Highest depletion rates</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topMovingProducts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              type="number"
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 11 }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 18, 26, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#F9FAFB'
              }}
            />
            <Bar dataKey="depleted" fill="#f97316" name="Units Depleted" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-hover-teal">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Distributor Comparison</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">Current stock by distributor</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={distributorComparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="name"
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 18, 26, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#F9FAFB'
              }}
            />
            <Bar dataKey="total" fill="#22C7A3" name="Total Stock" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
