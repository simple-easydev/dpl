import { useMemo } from 'react';
import { Package, AlertTriangle, Activity, Clock, TrendingUp, BarChart3 } from 'lucide-react';

interface InventoryWidgetsProps {
  summary: {
    totalImporterInventory: number;
    totalDistributorInventory: number;
    totalDepleted: number;
    outOfStockCount: number;
    lowStockCount: number;
    totalProducts: number;
    trackedImporterCount: number;
    trackedDistributorCount: number;
  };
  distributorInventory: any[];
  transactions: any[];
}

export default function InventoryWidgets({ summary, distributorInventory, transactions }: InventoryWidgetsProps) {
  const stockHealthScore = useMemo(() => {
    const total = summary.trackedDistributorCount;
    if (total === 0) return 0;

    const healthy = total - summary.outOfStockCount - summary.lowStockCount;
    return Math.round((healthy / total) * 100);
  }, [summary]);

  const reorderAlerts = useMemo(() => {
    return distributorInventory
      .filter(item => {
        const qty = Number(item.current_quantity);
        const initial = Number(item.initial_quantity);
        return qty <= 0 || (qty > 0 && qty < initial * 0.2);
      })
      .slice(0, 5);
  }, [distributorInventory]);

  const recentActivity = useMemo(() => {
    return transactions
      .slice(0, 5)
      .map(t => ({
        ...t,
        timeAgo: getTimeAgo(new Date(t.created_at))
      }));
  }, [transactions]);

  const turnoverRate = useMemo(() => {
    if (summary.totalDistributorInventory === 0) return 0;
    const depleted = summary.totalDepleted;
    const initial = summary.totalDistributorInventory + depleted;
    if (initial === 0) return 0;
    return Math.round((depleted / initial) * 100);
  }, [summary]);

  const criticalProducts = useMemo(() => {
    return distributorInventory.filter(item => Number(item.current_quantity) <= 0).length;
  }, [distributorInventory]);

  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  function getTransactionIcon(type: string) {
    switch (type) {
      case 'importer_adjustment':
        return '📦';
      case 'distributor_initial':
        return '🏁';
      case 'distributor_adjustment':
        return '🔄';
      case 'auto_depletion':
        return '📉';
      default:
        return '📋';
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Stock Health</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Activity className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-semibold text-gray-900 dark:text-white">
              {stockHealthScore}%
            </span>
            <div className="flex-1 mb-2">
              <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    stockHealthScore >= 80 ? 'bg-gradient-teal' :
                    stockHealthScore >= 50 ? 'bg-gradient-orange' :
                    'bg-gradient-to-r from-red-500 to-red-600'
                  }`}
                  style={{ width: `${stockHealthScore}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
            {summary.trackedDistributorCount - summary.outOfStockCount - summary.lowStockCount} healthy products
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Products Tracked</span>
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-gray-900 dark:text-white">
            {summary.totalProducts.toLocaleString()}
          </span>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
            {summary.trackedImporterCount} in importer stock
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-purple">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Turnover Rate</span>
            <div className="rounded-xl p-2 bg-gradient-orange">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-gray-900 dark:text-white">
              {turnoverRate}%
            </span>
            <span className="text-sm text-gray-600 dark:text-zinc-400">depletion</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
            {summary.totalDepleted.toLocaleString()} units moved
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-red">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Critical Items</span>
            <div className="rounded-xl p-2 bg-gradient-red">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-gray-900 dark:text-white">
            {criticalProducts}
          </span>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
            Out of stock items
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-2 bg-gradient-red">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reorder Alerts</h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Products needing attention</p>
            </div>
          </div>

          <div className="space-y-3">
            {reorderAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-zinc-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>All products are well stocked</p>
              </div>
            ) : (
              reorderAlerts.map((item, index) => {
                const isOutOfStock = Number(item.current_quantity) <= 0;
                const percentRemaining = Number(item.current_quantity) / Number(item.initial_quantity) * 100;

                return (
                  <div
                    key={index}
                    className="p-4 glass rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {item.products?.product_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                          {item.distributors?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          isOutOfStock ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                        }`}>
                          {Number(item.current_quantity).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-zinc-400">
                          of {Number(item.initial_quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isOutOfStock ? 'bg-red-600' : 'bg-orange-600'
                        }`}
                        style={{ width: `${Math.max(5, percentRemaining)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Latest inventory transactions</p>
            </div>
          </div>

          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-zinc-400">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              recentActivity.map((transaction, index) => (
                <div
                  key={index}
                  className="p-4 glass rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getTransactionIcon(transaction.transaction_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {transaction.products?.product_name || 'Unknown Product'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">
                        {transaction.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${
                        transaction.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">
                        {transaction.timeAgo}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
