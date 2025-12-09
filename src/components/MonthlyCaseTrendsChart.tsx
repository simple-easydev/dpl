import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ProductCasesTrend } from '../lib/revenueAnalytics';
import { AggregatedProductCasesTrend } from '../lib/aggregatedAnalytics';

interface MonthlyCaseTrendsChartProps {
  data: ProductCasesTrend[] | AggregatedProductCasesTrend[];
  showBrandNames?: boolean;
}

export default function MonthlyCaseTrendsChart({ data, showBrandNames = false }: MonthlyCaseTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-theme-muted">
        No data available for chart
      </div>
    );
  }

  const allMonths = data[0]?.monthlyCases.map(d => d.month) || [];

  const chartData = allMonths.map((month) => {
    const dataPoint: any = { month };

    data.forEach((product) => {
      const monthData = product.monthlyCases.find(m => m.month === month);
      const label = showBrandNames && 'brandName' in product
        ? `${product.productName} (${product.brandName})`
        : product.productName;
      dataPoint[label] = monthData?.cases || 0;
    });

    return dataPoint;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-theme-text mb-1">Monthly Case Trends by Product</h3>
        <p className="text-sm text-theme-muted mb-4">12-month volume performance by top products</p>
        <ResponsiveContainer width="100%" height={400}>
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
              tickFormatter={(value) => {
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(1)}k`;
                }
                return value.toString();
              }}
              style={{ fill: '#a1a1aa' }}
              label={{
                value: 'Cases',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#a1a1aa', fontSize: 12 }
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 18, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px',
                backdropFilter: 'blur(12px)',
              }}
              labelStyle={{ color: '#fff', fontWeight: '600', marginBottom: '8px' }}
              itemStyle={{ color: '#a1a1aa', padding: '4px 0' }}
              formatter={(value: number, name: string) => {
                return [
                  `${value.toLocaleString()} cases`,
                  name
                ];
              }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
              }}
              iconType="line"
            />
            {data.map((product) => {
              const label = showBrandNames && 'brandName' in product
                ? `${product.productName} (${product.brandName})`
                : product.productName;

              return (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stroke={product.color}
                  strokeWidth={2.5}
                  dot={{ fill: product.color, r: 4 }}
                  activeDot={{ r: 6 }}
                  name={label}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
