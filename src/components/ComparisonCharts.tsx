import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

interface MetricComparisonChartProps {
  data: Array<{ name: string; current: number; previous: number }>;
  title: string;
  valueFormatter?: (value: number) => string;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
}

export function MetricComparisonChart({ data, title, valueFormatter, currentPeriodLabel, previousPeriodLabel }: MetricComparisonChartProps) {
  const { theme } = useTheme();
  const defaultFormatter = (value: number) => value.toLocaleString();
  const formatter = valueFormatter || defaultFormatter;

  const isDark = theme === 'dark';
  const chartColors = {
    bg: isDark ? 'rgba(17, 18, 26, 0.7)' : '#FFFFFF',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)',
    text: isDark ? '#F9FAFB' : '#0F1222',
    grid: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    tooltipBg: isDark ? '#1F2937' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
    axis: isDark ? '#9CA3AF' : '#64748b',
  };

  return (
    <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis dataKey="name" tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={formatter} />
          <Tooltip
            contentStyle={{
              backgroundColor: chartColors.tooltipBg,
              border: `1px solid ${chartColors.tooltipBorder}`,
              borderRadius: '8px',
              color: chartColors.text,
            }}
            formatter={formatter}
          />
          <Legend />
          <Bar dataKey="previous" fill="#94a3b8" name={previousPeriodLabel || "Previous Period"} radius={[4, 4, 0, 0]} />
          <Bar dataKey="current" fill="#3b82f6" name={currentPeriodLabel || "Current Period"} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DailyTrendChartProps {
  currentData: Array<{ date: string; revenue: number }>;
  previousData: Array<{ date: string; revenue: number }>;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
}

export function DailyTrendChart({ currentData, previousData, currentPeriodLabel, previousPeriodLabel }: DailyTrendChartProps) {
  const { theme } = useTheme();
  const combinedData = currentData.map((item, index) => ({
    day: `Day ${index + 1}`,
    current: item.revenue,
    previous: previousData[index]?.revenue || 0,
  }));

  const isDark = theme === 'dark';
  const chartColors = {
    bg: isDark ? 'rgba(17, 18, 26, 0.7)' : '#FFFFFF',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)',
    text: isDark ? '#F9FAFB' : '#0F1222',
    grid: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    tooltipBg: isDark ? '#1F2937' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
    axis: isDark ? '#9CA3AF' : '#64748b',
  };

  return (
    <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="day"
            tick={{ fill: chartColors.axis, fontSize: 12 }}
            interval={4}
          />
          <YAxis tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: chartColors.tooltipBg,
              border: `1px solid ${chartColors.tooltipBorder}`,
              borderRadius: '8px',
              color: chartColors.text,
            }}
            formatter={(value: number) =>
              `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#94a3b8"
            strokeWidth={2}
            name={previousPeriodLabel}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="#3b82f6"
            strokeWidth={2}
            name={currentPeriodLabel}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface WaterfallData {
  name: string;
  value: number;
  isTotal?: boolean;
}

interface RevenueWaterfallChartProps {
  startingRevenue: number;
  endingRevenue: number;
  components: Array<{ name: string; value: number }>;
}

export function RevenueWaterfallChart({
  startingRevenue,
  endingRevenue,
  components,
}: RevenueWaterfallChartProps) {
  const data: WaterfallData[] = [
    { name: 'Previous', value: startingRevenue, isTotal: true },
    ...components,
    { name: 'Current', value: endingRevenue, isTotal: true },
  ];

  return (
    <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Bridge Analysis</h3>
      <div className="flex items-end justify-around h-64 border-b border-gray-200 dark:border-slate-700 px-4 pb-4">
        {data.map((item, index) => {
          const isPositive = item.value > 0;
          const height = Math.abs(item.value) / Math.max(startingRevenue, endingRevenue) * 200;

          return (
            <div key={index} className="flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-gray-900 dark:text-white">
                ${Math.abs(item.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div
                className={`w-16 rounded-t ${
                  item.isTotal
                    ? 'bg-slate-700'
                    : isPositive
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
                style={{ height: `${Math.max(height, 20)}px` }}
              />
              <div className="text-xs text-gray-600 dark:text-slate-400 text-center max-w-[80px]">
                {item.name}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 mt-4 text-center">
        Net change: {endingRevenue > startingRevenue ? '+' : ''}$
        {(endingRevenue - startingRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

interface DistributionComparisonProps {
  currentData: Array<{ name: string; value: number }>;
  previousData: Array<{ name: string; value: number }>;
  title: string;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
}

export function DistributionComparison({ currentData, previousData, title, currentPeriodLabel, previousPeriodLabel }: DistributionComparisonProps) {
  const { theme } = useTheme();
  const maxItems = 8;
  const currentTop = currentData.slice(0, maxItems);
  const previousTop = previousData.slice(0, maxItems);

  const allNames = new Set([
    ...currentTop.map(d => d.name),
    ...previousTop.map(d => d.name),
  ]);

  const chartData = Array.from(allNames).map(name => ({
    name,
    current: currentTop.find(d => d.name === name)?.value || 0,
    previous: previousTop.find(d => d.name === name)?.value || 0,
  }));

  const isDark = theme === 'dark';
  const chartColors = {
    bg: isDark ? 'rgba(17, 18, 26, 0.7)' : '#FFFFFF',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)',
    text: isDark ? '#F9FAFB' : '#0F1222',
    grid: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    tooltipBg: isDark ? '#1F2937' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
    axis: isDark ? '#9CA3AF' : '#64748b',
  };

  return (
    <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis type="number" tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: chartColors.axis, fontSize: 12 }} width={120} />
          <Tooltip
            contentStyle={{
              backgroundColor: chartColors.tooltipBg,
              border: `1px solid ${chartColors.tooltipBorder}`,
              borderRadius: '8px',
              color: chartColors.text,
            }}
            formatter={(value: number) =>
              `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
          />
          <Legend />
          <Bar dataKey="previous" fill="#94a3b8" name={previousPeriodLabel || "Previous"} radius={[0, 4, 4, 0]} />
          <Bar dataKey="current" fill="#3b82f6" name={currentPeriodLabel || "Current"} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
