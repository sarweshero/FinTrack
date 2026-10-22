import { useSelector } from 'react-redux';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-white/95 dark:bg-[#0e1320]/95 border border-slate-200 dark:border-white/10 p-3 shadow-2xl backdrop-blur-md text-xs">
        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-bold text-slate-900 dark:text-white">₹{Number(entry.value).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const SpendTrendChart = ({ series = [], height = 240 }) => {
  const theme = useSelector((state) => state.ui.theme);
  const isDark = theme === 'dark';

  if (!series || series.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-slate-500">
        No trend data available for this timeframe
      </div>
    );
  }

  // Format date display for x-axis (e.g. "Oct 12")
  const formattedData = series.map((item) => {
    let displayDate = item.date;
    try {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      // fallback
    }
    return {
      ...item,
      displayDate,
    };
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="givenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            vertical={false}
          />

          <XAxis
            dataKey="displayDate"
            stroke={isDark ? '#64748b' : '#94a3b8'}
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
            interval="preserveStartEnd"
          />

          <YAxis
            stroke={isDark ? '#64748b' : '#94a3b8'}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${val}`}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#incomeGrad)"
          />
          <Area
            type="monotone"
            dataKey="spend"
            name="Spend (Debit)"
            stroke="#f43f5e"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#spendGrad)"
          />
          <Area
            type="monotone"
            dataKey="amount_given"
            name="Amount Given"
            stroke="#f59e0b"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#givenGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SpendTrendChart;

