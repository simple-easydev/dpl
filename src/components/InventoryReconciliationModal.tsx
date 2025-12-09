import { useState, useEffect } from 'react';
import { X, AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock, TrendingDown, Package } from 'lucide-react';
import {
  getReconciliationStats,
  getUnprocessedOrders,
  getFailedOrders,
  backfillInventoryDepletions,
  getInventoryReconciliationReport,
  type ReconciliationStats,
  type UnprocessedOrder,
  type BackfillResult,
} from '../lib/inventoryReconciliationService';

interface InventoryReconciliationModalProps {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryReconciliationModal({
  organizationId,
  onClose,
  onSuccess,
}: InventoryReconciliationModalProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [unprocessedOrders, setUnprocessedOrders] = useState<UnprocessedOrder[]>([]);
  const [failedOrders, setFailedOrders] = useState<UnprocessedOrder[]>([]);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [reconciliationReport, setReconciliationReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'unprocessed' | 'failed'>('overview');

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    setLoading(true);
    const [statsData, unprocessedData, failedData, reportData] = await Promise.all([
      getReconciliationStats(organizationId),
      getUnprocessedOrders(organizationId, 50),
      getFailedOrders(organizationId, 50),
      getInventoryReconciliationReport(organizationId),
    ]);

    setStats(statsData);
    setUnprocessedOrders(unprocessedData);
    setFailedOrders(failedData);
    setReconciliationReport(reportData);
    setLoading(false);
  };

  const handleBackfill = async (retryFailed: boolean = false) => {
    if (!confirm(
      retryFailed
        ? 'This will retry processing failed orders. Continue?'
        : 'This will process all unprocessed historical orders and update inventory levels. Continue?'
    )) {
      return;
    }

    setProcessing(true);
    setBackfillResult(null);

    const result = await backfillInventoryDepletions(organizationId, {
      retryFailed,
      limit: 1000,
    });

    setBackfillResult(result);
    setProcessing(false);

    if (result.success) {
      await loadData();
      if (result.processedCount > 0) {
        onSuccess();
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="glass-card rounded-2xl p-8 max-w-4xl w-full">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="glass-card rounded-2xl p-6 max-w-6xl w-full my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Inventory Reconciliation
            </h2>
            <p className="text-gray-600 dark:text-zinc-400 mt-1">
              Process historical orders that occurred before inventory was initialized
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">Total Orders</span>
                <Package className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalOrders.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">Processed</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {stats.processedOrders.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">Unprocessed</span>
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <span className="text-2xl font-semibold text-orange-600 dark:text-orange-400">
                {stats.unprocessedOrders.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">Failed</span>
                <XCircle className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {stats.failedOrders.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">Completion</span>
                <TrendingDown className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalOrders > 0
                  ? Math.round((stats.processedOrders / stats.totalOrders) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        )}

        {stats && stats.unprocessedOrders > 0 && (
          <div className="glass rounded-xl p-4 mb-6 border-l-4 border-orange-500">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Historical Orders Need Processing
                </h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
                  {stats.unprocessedOrders.toLocaleString()} order{stats.unprocessedOrders !== 1 ? 's' : ''} from{' '}
                  {stats.earliestUnprocessedDate ? new Date(stats.earliestUnprocessedDate).toLocaleDateString() : 'unknown date'} to{' '}
                  {stats.latestUnprocessedDate ? new Date(stats.latestUnprocessedDate).toLocaleDateString() : 'unknown date'}{' '}
                  occurred before inventory was initialized. These orders have not affected your inventory levels yet.
                </p>
                <button
                  onClick={() => handleBackfill(false)}
                  disabled={processing}
                  className="btn-primary flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Process Historical Orders
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {stats && stats.failedOrders > 0 && (
          <div className="glass rounded-xl p-4 mb-6 border-l-4 border-red-500">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Failed Orders
                </h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
                  {stats.failedOrders.toLocaleString()} order{stats.failedOrders !== 1 ? 's' : ''} could not be processed
                  because inventory records don't exist for those products. Initialize inventory for these products first.
                </p>
                <button
                  onClick={() => handleBackfill(true)}
                  disabled={processing}
                  className="px-4 py-2 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Failed Orders
                </button>
              </div>
            </div>
          </div>
        )}

        {backfillResult && (
          <div className={`glass rounded-xl p-4 mb-6 border-l-4 ${
            backfillResult.success ? 'border-green-500' : 'border-red-500'
          }`}>
            <div className="flex items-start gap-3">
              {backfillResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Backfill Results
                </h3>
                <div className="text-sm text-gray-600 dark:text-zinc-400 space-y-1">
                  <p>✅ Processed: {backfillResult.processedCount}</p>
                  <p>❌ Failed: {backfillResult.failedCount}</p>
                  <p>⏭️ Skipped: {backfillResult.skippedCount}</p>
                </div>
                {backfillResult.errors.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-zinc-300">
                      View Errors ({backfillResult.errors.length})
                    </summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {backfillResult.errors.slice(0, 10).map((error, idx) => (
                        <div key={idx} className="text-gray-600 dark:text-zinc-400">
                          {error.productName}: {error.error}
                        </div>
                      ))}
                      {backfillResult.errors.length > 10 && (
                        <div className="text-gray-500 dark:text-zinc-500">
                          ... and {backfillResult.errors.length - 10} more
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-medium transition ${
              activeTab === 'overview'
                ? 'bg-gradient-blue text-white shadow-glow-blue'
                : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('unprocessed')}
            className={`px-4 py-2 rounded-xl font-medium transition ${
              activeTab === 'unprocessed'
                ? 'bg-gradient-blue text-white shadow-glow-blue'
                : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            Unprocessed ({unprocessedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`px-4 py-2 rounded-xl font-medium transition ${
              activeTab === 'failed'
                ? 'bg-gradient-blue text-white shadow-glow-blue'
                : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            Failed ({failedOrders.length})
          </button>
        </div>

        <div className="glass rounded-xl overflow-hidden max-h-96 overflow-y-auto">
          {activeTab === 'overview' && reconciliationReport && (
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Inventory Status by Distributor
              </h3>
              {reconciliationReport.inventoryByDistributor.length === 0 ? (
                <p className="text-gray-600 dark:text-zinc-400 text-center py-8">
                  No distributor inventory initialized yet
                </p>
              ) : (
                <div className="space-y-2">
                  {reconciliationReport.inventoryByDistributor.map((item: any, idx: number) => (
                    <div key={idx} className="glass rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{item.distributor}</div>
                          <div className="text-sm text-gray-600 dark:text-zinc-400">
                            {item.productCount} products tracked • Created {new Date(item.inventoryCreatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        {item.unprocessedOrders > 0 && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                            {item.unprocessedOrders} unprocessed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'unprocessed' && (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Distributor
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {unprocessedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-600 dark:text-zinc-400">
                      No unprocessed orders
                    </td>
                  </tr>
                ) : (
                  unprocessedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{order.product_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-zinc-400">{order.distributor}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        {order.quantity_in_bottles?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-zinc-400">
                        {order.order_date ? new Date(order.order_date).toLocaleDateString() : 'No date'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'failed' && (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Distributor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {failedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-600 dark:text-zinc-400">
                      No failed orders
                    </td>
                  </tr>
                ) : (
                  failedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{order.product_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-zinc-400">{order.distributor}</td>
                      <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{order.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={loadData}
            className="px-4 py-2 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
