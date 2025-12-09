import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MonthlyRevenue } from '../lib/revenueAnalytics';

interface MonthlyRevenueChartProps {
  data: MonthlyRevenue[];
  showComparison?: boolean;
}

export default function MonthlyRevenueChart({ data, showComparison = false }: MonthlyRevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-theme-muted">
        No data available for chart
      </div>
    );
  }

  const chartData = data.map((item, index) => {
    const previousYearIndex = index - 12;
    const previousYearRevenue = previousYearIndex >= 0 ? data[previousYearIndex]?.revenue : null;

    return {
      month: item.month,
      revenue: item.revenue,
      orders: item.orders,
      previousYear: previousYearRevenue,
      growth: item.growth,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-theme-text mb-4">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="rgba(255, 255, 255, 0.2)"
              fontSize={12}
              tickMargin={8}
              style={{ fill: '#a1a1aa' }}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.2)"
              fontSize={12}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              style={{ fill: '#a1a1aa' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 18, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px',
                backdropFilter: 'blur(12px)',
              }}
              labelStyle={{ color: '#fff', fontWeight: '600' }}
              itemStyle={{ color: '#a1a1aa' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#8B5CF6"
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Current Year Revenue"
            />
            {showComparison && (
              <Line
                type="monotone"
                dataKey="previousYear"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#60a5fa', r: 3 }}
                name="Previous Year Revenue"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-theme-text mb-4">Cumulative Revenue</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData.map((item, index) => ({
            ...item,
            cumulative: chartData.slice(0, index + 1).reduce((sum, d) => sum + d.revenue, 0),
          }))}>
            <defs>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C65F2" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C65F2" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="rgba(255, 255, 255, 0.2)"
              fontSize={12}
              tickMargin={8}
              style={{ fill: '#a1a1aa' }}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.2)"
              fontSize={12}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              style={{ fill: '#a1a1aa' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(26, 26, 36, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px',
                backdropFilter: 'blur(12px)',
              }}
              labelStyle={{ color: '#fff', fontWeight: '600' }}
              itemStyle={{ color: '#a1a1aa' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cumulative Revenue']}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#7C65F2"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorCumulative)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
