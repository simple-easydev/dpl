import { TrendingUp, TrendingDown, Users, Trophy, Package, ArrowUpRight, RotateCw, Info } from 'lucide-react';
import { MonthlyRevenue, DepletionsMetrics, RevenueForecast, BestMonthMetrics, ReorderRateMetrics } from '../lib/revenueAnalytics';

interface AdvancedMetricsProps {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  bestMonth?: BestMonthMetrics;
  totalAccounts: number;
  allTimeTotalCases: number;
  casesGrowthPercentage: number;
  depletionsMetrics?: DepletionsMetrics;
  forecast?: RevenueForecast;
  monthlyData: MonthlyRevenue[];
  reorderRateMetrics?: ReorderRateMetrics;
}

export default function AdvancedMetrics({
  currentMonthRevenue,
  previousMonthRevenue,
  bestMonth,
  totalAccounts,
  allTimeTotalCases,
  casesGrowthPercentage,
  depletionsMetrics,
  forecast,
  monthlyData,
  reorderRateMetrics,
}: AdvancedMetricsProps) {
  const revenueChange = previousMonthRevenue > 0
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : 0;

  const last3Months = monthlyData.slice(-3);
  const avgGrowthRate = last3Months.length > 0
    ? last3Months.reduce((sum, m) => sum + m.growth, 0) / last3Months.length
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Cases Sold"
        value={allTimeTotalCases.toLocaleString()}
        change={casesGrowthPercentage}
        icon={Package}
        description="Lifetime cases sold"
        color="green"
        tooltip="Only includes records with valid dates (order date or default period). Duplicate records are automatically removed to ensure accurate counting."
      />

      {bestMonth && (
        <BestMonthCard bestMonth={bestMonth} />
      )}

      <MetricCard
        title="Total Accounts"
        value={totalAccounts.toString()}
        icon={Users}
        description="Total accounts in database"
        color="orange"
        hideChange
      />

      <MetricCard
        title="Growth Velocity"
        value={`${avgGrowthRate.toFixed(1)}%`}
        change={avgGrowthRate}
        icon={TrendingUp}
        description="3-month average growth"
        color="green"
        hideChange
      />

      {depletionsMetrics && (
        <DepletionsCard depletions={depletionsMetrics} />
      )}

      {forecast && (
        <ForecastCard forecast={forecast} />
      )}

      <RetentionMetricCard monthlyData={monthlyData} />

      {reorderRateMetrics && (
        <ReorderRateCard reorderRate={reorderRateMetrics} />
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  description: string;
  color: 'green' | 'blue' | 'orange' | 'purple';
  hideChange?: boolean;
  tooltip?: string;
}

function MetricCard({ title, value, change = 0, icon: Icon, description, color, hideChange = false, tooltip }: MetricCardProps) {
  const isPositive = change >= 0;

  const colorClasses = {
    green: 'bg-gradient-teal',
    blue: 'bg-gradient-blue',
    orange: 'bg-gradient-orange',
    purple: 'bg-gradient-blue-light',
  };

  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-hover-blue">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color]} rounded-xl p-3 shadow-glass`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {!hideChange && (
          <div className={`flex items-center gap-1 text-sm font-bold ${
            isPositive ? 'text-accent-teal-400' : 'text-accent-orange-400'
          }`}>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <div className="bg-red-500 rounded-full p-1 flex items-center justify-center">
                <TrendingDown className="w-3 h-3 text-white" />
              </div>
            )}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-theme-muted uppercase tracking-wide">{title}</p>
          {tooltip && (
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-theme-muted hover:text-accent-blue-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64">
                <div className="bg-dark-800 border border-white/20 rounded-lg p-3 shadow-xl">
                  <p className="text-xs text-theme-muted leading-relaxed">{tooltip}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-theme-text">{value}</p>
        <p className="text-xs text-theme-muted opacity-80">{description}</p>
      </div>
    </div>
  );
}

function DepletionsCard({ depletions }: { depletions: DepletionsMetrics }) {
  const statusLabel = {
    strong: 'Strong',
    growing: 'Growing',
    stable: 'Stable',
    declining: 'Declining',
  }[depletions.status];

  const statusColor = {
    strong: 'text-accent-teal-400',
    growing: 'text-accent-teal-400',
    stable: 'text-blue-400',
    declining: 'text-accent-orange-400',
  }[depletions.status];

  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-hover-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-gradient-blue rounded-xl p-3 shadow-glass">
          <Package className="w-5 h-5 text-white" />
        </div>
        <span className={`text-sm font-bold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Month Over Month Revenue</p>
        <p className="text-3xl font-bold text-theme-text">
          ${depletions.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs text-theme-muted opacity-80">
          Last 12 months • {depletions.growthPercentage >= 0 ? '+' : ''}{depletions.growthPercentage.toFixed(1)}% vs last month
        </p>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">Active Accounts</span>
          <span className="font-bold text-theme-text">
            {depletions.accountCount}
          </span>
        </div>
      </div>
    </div>
  );
}

function ForecastCard({ forecast }: { forecast: RevenueForecast }) {
  const confidenceColor = forecast.confidence > 70 ? 'text-accent-teal-400' :
    forecast.confidence > 50 ? 'text-accent-orange-400' : 'text-accent-orange-500';

  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-hover-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-gradient-blue rounded-xl p-3 shadow-glass">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <span className={`text-sm font-bold ${confidenceColor}`}>
          {forecast.confidence.toFixed(0)}% confidence
        </span>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Next Month Forecast</p>
        <p className="text-3xl font-bold text-theme-text">
          ${forecast.forecastedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs text-theme-muted opacity-80">
          Based on {forecast.basedOnMonths} months of data
        </p>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="w-full bg-dark-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              forecast.confidence > 70 ? 'bg-gradient-teal' :
              forecast.confidence > 50 ? 'bg-gradient-orange' : 'bg-accent-orange-500'
            }`}
            style={{ width: `${forecast.confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RetentionMetricCard({ monthlyData }: { monthlyData: MonthlyRevenue[] }) {
  if (monthlyData.length < 2) {
    return null;
  }

  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];

  const retentionRate = previousMonth.accounts > 0
    ? (Math.min(currentMonth.accounts, previousMonth.accounts) / previousMonth.accounts) * 100
    : 0;

  const isGood = retentionRate >= 80;

  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-hover-blue">
      <div className="flex items-center justify-between mb-4">
        <div className={`${isGood ? 'bg-gradient-teal' : 'bg-gradient-orange'} rounded-xl p-3 shadow-glass`}>
          <Users className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Account Retention</p>
        <p className="text-3xl font-bold text-theme-text">
          {retentionRate.toFixed(0)}%
        </p>
        <p className="text-xs text-theme-muted opacity-80">Month-over-month retention</p>
      </div>

      <div className="pt-3 border-t border-white/10 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">Previous</span>
          <span className="font-bold text-theme-text">{previousMonth.accounts}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">Current</span>
          <span className="font-bold text-theme-text">{currentMonth.accounts}</span>
        </div>
      </div>
    </div>
  );
}

function ReorderRateCard({ reorderRate }: { reorderRate: ReorderRateMetrics }) {
  const isGoodRate = reorderRate.rate >= 60;
  const isModerateRate = reorderRate.rate >= 40 && reorderRate.rate < 60;

  const getColorClass = () => {
    if (isGoodRate) return 'bg-gradient-teal';
    if (isModerateRate) return 'bg-gradient-orange';
    return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
  };

  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-hover-blue">
      <div className="flex items-center justify-between mb-4">
        <div className={`${getColorClass()} rounded-xl p-3 shadow-glass`}>
          <RotateCw className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Reorder Rate</p>
        <p className="text-3xl font-bold text-theme-text">
          {reorderRate.rate.toFixed(1)}%
        </p>
        <p className="text-xs text-theme-muted opacity-80">
          Customers who purchased multiple times • {reorderRate.period}
        </p>
      </div>

      <div className="pt-3 border-t border-white/10 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">Reordering</span>
          <span className="font-bold text-theme-text">{reorderRate.reorderingAccounts}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">Total Accounts</span>
          <span className="font-bold text-theme-text">{reorderRate.totalAccounts}</span>
        </div>
      </div>
    </div>
  );
}

function BestMonthCard({ bestMonth }: { bestMonth: BestMonthMetrics }) {
  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-hover-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-3 shadow-glass">
          <Trophy className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Best Month</p>
        <p className="text-3xl font-bold text-theme-text">
          {bestMonth.monthName}
        </p>
        <p className="text-xs text-theme-muted opacity-80">
          {bestMonth.cases.toLocaleString()} cases
        </p>
      </div>
    </div>
  );
}
