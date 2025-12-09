import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap } from 'recharts';
import { RevenueByCategory } from '../lib/revenueAnalytics';

const COLORS = [
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#f43f5e',
];

interface RevenueBreakdownChartsProps {
  regionData: RevenueByCategory[];
}

export default function RevenueBreakdownCharts({ regionData }: RevenueBreakdownChartsProps) {
  if (!regionData?.length) {
    return (
      <div className="glass-card rounded-2xl p-6 glow-hover-blue">
        <h3 className="text-xl font-bold text-theme-text mb-4">Revenue by State</h3>
        <div className="flex items-center justify-center h-60 text-theme-muted">
          No state data available. State information may not be included in uploaded sales data.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 glow-hover-blue">
      <h3 className="text-xl font-bold text-theme-text mb-4">Revenue by State</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={regionData}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
          <XAxis
            dataKey="category"
            stroke="#78788f"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fill: '#a8a8ba' }}
          />
          <YAxis
            stroke="#78788f"
            fontSize={12}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            style={{ fill: '#a8a8ba' }}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{
              backgroundColor: 'rgba(26, 26, 36, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
              color: '#fff',
            }}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            itemStyle={{ color: '#a8a8ba' }}
          />
          <Bar dataKey="revenue" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {regionData.slice(0, 5).map((item) => (
          <div key={item.category} className="flex items-center justify-between text-sm">
            <span className="text-theme-text font-semibold">{item.category}</span>
            <div className="flex items-center gap-3">
              <span className="text-theme-muted">{item.percentage.toFixed(1)}%</span>
              <span className="font-bold text-theme-text w-24 text-right">
                ${item.revenue.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TreemapChartProps {
  data: RevenueByCategory[];
  title: string;
}

export function TreemapChart({ data, title }: TreemapChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-xl font-bold text-theme-text mb-4">{title}</h3>
        <div className="flex items-center justify-center h-60 text-theme-muted">
          No data available
        </div>
      </div>
    );
  }

  const treemapData = data.map((item, index) => ({
    name: item.category,
    size: item.revenue,
    fill: COLORS[index % COLORS.length],
  }));

  const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, size } = props;

    if (width < 50 || height < 35) return null;

    const truncateName = (text: string, maxLength: number = 20) => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + '...';
    };

    const displayName = truncateName(name);
    const fontSize = width < 100 ? 10 : 12;
    const amountFontSize = width < 100 ? 9 : 11;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: props.fill,
            stroke: '#fff',
            strokeWidth: 2,
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={fontSize}
          fontWeight="600"
        >
          {displayName}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={amountFontSize}
        >
          ${(size / 1000).toFixed(0)}k
        </text>
      </g>
    );
  };

  return (
    <div className="glass-card rounded-2xl p-6 glow-hover-purple">
      <h3 className="text-xl font-bold text-theme-text mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={treemapData}
          dataKey="size"
          stroke="#fff"
          fill="#16a34a"
          content={<CustomizedContent />}
        />
      </ResponsiveContainer>
    </div>
  );
}
