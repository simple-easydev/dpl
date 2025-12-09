import { Edit2, TrendingDown, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import StateIcon from './StateIcon';
import { format } from 'date-fns';

interface DistributorInventoryCardProps {
  item: {
    id: string;
    product_id: string;
    distributor_id: string;
    initial_quantity: number;
    current_quantity: number;
    last_updated: string;
    products?: {
      product_name: string;
    };
    distributors?: {
      name: string;
    };
  };
  distributorState?: string | null;
  onEdit: (item: any) => void;
}

export default function DistributorInventoryCard({
  item,
  distributorState,
  onEdit,
}: DistributorInventoryCardProps) {
  const currentQty = Number(item.current_quantity);
  const initialQty = Number(item.initial_quantity);
  const depleted = initialQty - currentQty;
  const depletionPercentage = initialQty > 0 ? (depleted / initialQty) * 100 : 0;

  const isOutOfStock = currentQty <= 0;
  const isLowStock = currentQty > 0 && currentQty < initialQty * 0.2;
  const isHealthy = currentQty >= initialQty * 0.2;

  const getStatusColor = () => {
    if (isOutOfStock) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (isLowStock) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  };

  const getStatusIcon = () => {
    if (isOutOfStock) return AlertTriangle;
    if (isLowStock) return Package;
    return CheckCircle;
  };

  const getProgressColor = () => {
    if (isOutOfStock) return 'bg-red-500';
    if (isLowStock) return 'bg-orange-500';
    return 'bg-gradient-to-r from-teal-500 to-blue-500';
  };

  const StatusIcon = getStatusIcon();

  return (
    <div className="glass-card rounded-2xl p-6 glow-hover-blue transition-all duration-300 hover:-translate-y-1 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {item.products?.product_name || 'Unknown Product'}
          </h3>
          <div className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
            <StateIcon stateName={distributorState} className="w-4 h-4" />
            <span className="text-sm font-medium">{item.distributors?.name || 'Unknown Distributor'}</span>
          </div>
        </div>
        <button
          onClick={() => onEdit(item)}
          className="p-2 rounded-xl glass hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-all duration-200 opacity-0 group-hover:opacity-100"
          title="Edit inventory"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 ${getStatusColor()}`}>
        <StatusIcon className="w-3.5 h-3.5" />
        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Initial
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {initialQty.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Current
            </div>
            <div className={`text-xl font-bold ${
              isOutOfStock ? 'text-red-600 dark:text-red-400' :
              isLowStock ? 'text-orange-600 dark:text-orange-400' :
              'text-green-600 dark:text-green-400'
            }`}>
              {currentQty.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Depleted
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1">
              <TrendingDown className="w-4 h-4 text-orange-500" />
              {depleted.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-zinc-400 font-medium">Depletion Progress</span>
            <span className="font-bold text-gray-900 dark:text-white">{depletionPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.min(depletionPercentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-white/10">
          <div className="text-xs text-gray-500 dark:text-zinc-500">
            Last updated: {format(new Date(item.last_updated), 'MMM dd, yyyy')}
          </div>
        </div>
      </div>
    </div>
  );
}
