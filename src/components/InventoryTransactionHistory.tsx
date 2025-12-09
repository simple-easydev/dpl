import { useState, useMemo } from 'react';
import { Clock, TrendingUp, TrendingDown, Package, RotateCcw, Filter } from 'lucide-react';

interface InventoryTransactionHistoryProps {
  transactions: any[];
  products: any[];
  distributors: any[];
}

export default function InventoryTransactionHistory({ transactions, products, distributors }: InventoryTransactionHistoryProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (filterType !== 'all' && transaction.transaction_type !== filterType) {
        return false;
      }
      if (selectedProduct !== 'all' && transaction.product_id !== selectedProduct) {
        return false;
      }
      if (selectedDistributor !== 'all' && transaction.distributor_id !== selectedDistributor) {
        return false;
      }
      return true;
    });
  }, [transactions, filterType, selectedProduct, selectedDistributor]);

  function getTransactionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'importer_adjustment': 'Importer Adjustment',
      'distributor_initial': 'Initial Stock',
      'distributor_adjustment': 'Manual Adjustment',
      'auto_depletion': 'Auto Depletion'
    };
    return labels[type] || type;
  }

  function getTransactionTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'importer_adjustment': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'distributor_initial': 'bg-green-500/20 text-green-400 border-green-500/30',
      'distributor_adjustment': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'auto_depletion': 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }

  function getTransactionIcon(quantityChange: number) {
    if (quantityChange > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (quantityChange < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <RotateCcw className="w-4 h-4 text-gray-500" />;
  }

  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="glass-card rounded-2xl p-6 glow-hover-blue">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h3>
          <p className="text-sm text-gray-600 dark:text-zinc-400">Complete audit trail of all inventory movements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
            Transaction Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
          >
            <option value="all">All Types</option>
            <option value="importer_adjustment">Importer Adjustment</option>
            <option value="distributor_initial">Initial Stock</option>
            <option value="distributor_adjustment">Manual Adjustment</option>
            <option value="auto_depletion">Auto Depletion</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
            Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
          >
            <option value="all">All Products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
            Distributor
          </label>
          <select
            value={selectedDistributor}
            onChange={(e) => setSelectedDistributor(e.target.value)}
            className="w-full px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
          >
            <option value="all">All Distributors</option>
            {distributors.map((dist) => (
              <option key={dist.id} value={dist.id}>
                {dist.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-600 dark:text-zinc-400">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No transactions found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredTransactions.map((transaction, index) => (
            <div
              key={index}
              className="relative p-4 glass rounded-xl hover:bg-white/5 transition-colors border border-white/5"
            >
              {index !== filteredTransactions.length - 1 && (
                <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-gradient-to-b from-accent-primary/50 to-transparent" />
              )}

              <div className="flex items-start gap-4">
                <div className="rounded-lg p-2 glass mt-1">
                  {getTransactionIcon(transaction.quantity_change)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getTransactionTypeColor(transaction.transaction_type)}`}>
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {transaction.products?.product_name || 'Unknown Product'}
                      </p>
                      {transaction.distributors?.name && (
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                          {transaction.distributors.name}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className={`text-lg font-semibold ${
                        transaction.quantity_change > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">
                        {transaction.previous_quantity.toLocaleString()} → {transaction.new_quantity.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {transaction.notes && (
                    <div className="mt-2 p-2 glass rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-zinc-300">
                        {transaction.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(transaction.created_at)}
                    </span>
                    {transaction.reference_id && (
                      <span className="text-gray-500 dark:text-zinc-500">
                        Ref: {transaction.reference_id.substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
