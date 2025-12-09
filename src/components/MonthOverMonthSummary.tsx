import { Package, DollarSign, MapPin, Users, Wine, Store, Info } from 'lucide-react';

interface MonthOverMonthSummaryProps {
  totalCases: number;
  totalRevenue: number;
  totalMarkets: number;
  totalAccounts: number;
  onPremiseAccounts: number;
  offPremiseAccounts: number;
}

export default function MonthOverMonthSummary({
  totalCases,
  totalRevenue,
  totalMarkets,
  totalAccounts,
  onPremiseAccounts,
  offPremiseAccounts,
}: MonthOverMonthSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      <SummaryCard
        title="Total Cases"
        value={totalCases.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        icon={Package}
        color="teal"
        description="Cases sold with current filters"
        tooltip="Only includes records with valid dates (order date or default period). Duplicate records are automatically removed to ensure accurate counting across all views."
      />

      <SummaryCard
        title="Revenue Volume"
        value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={DollarSign}
        color="green"
        description="Total revenue generated"
      />

      <SummaryCard
        title="Markets"
        value={totalMarkets.toString()}
        icon={MapPin}
        color="blue"
        description="Unique distributor states"
      />

      <SummaryCard
        title="Total Accounts"
        value={totalAccounts.toString()}
        icon={Users}
        color="orange"
        description="Unique accounts"
      />

      <SummaryCard
        title="On-Premise Accounts"
        value={onPremiseAccounts.toString()}
        icon={Wine}
        color="blue-light"
        description="Restaurants, bars, venues"
      />

      <SummaryCard
        title="Off-Premise Accounts"
        value={offPremiseAccounts.toString()}
        icon={Store}
        color="emerald"
        description="Retail stores, shops"
      />
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'teal' | 'green' | 'blue' | 'orange' | 'blue-light' | 'emerald';
  description: string;
  tooltip?: string;
}

function SummaryCard({ title, value, icon: Icon, color, description, tooltip }: SummaryCardProps) {
  const colorClasses = {
    teal: 'bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600',
    green: 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-600',
    blue: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
    orange: 'bg-gradient-to-br from-orange-500 via-orange-600 to-red-600',
    'blue-light': 'bg-gradient-to-br from-blue-400 via-blue-500 to-cyan-600',
    emerald: 'bg-gradient-to-br from-teal-400 via-emerald-500 to-green-600',
  };

  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color]} rounded-xl p-3 shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">
            {title}
          </p>
          {tooltip && (
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64">
                <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-lg p-3 shadow-xl">
                  <p className="text-xs text-gray-300 dark:text-zinc-300 leading-relaxed">{tooltip}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-500 opacity-80">
          {description}
        </p>
      </div>
    </div>
  );
}
