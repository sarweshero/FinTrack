import { useSelector } from 'react-redux';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const CustomDonutTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl bg-white/95 dark:bg-[#0e1320]/95 border border-slate-200 dark:border-white/10 p-2.5 shadow-xl backdrop-blur-md text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-semibold text-slate-900 dark:text-white">{data.category_name}</span>
        </div>
        <div className="text-slate-600 dark:text-slate-300">
          ₹{data.amount.toFixed(2)} ({data.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

export const CategoryDonutChart = ({ data = [], total = 0, height = 200 }) => {
  const theme = useSelector((state) => state.ui.theme);
  const isDark = theme === 'dark';

  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate-500">
        No category breakdown data available
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<CustomDonutTooltip />} />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={4}
            dataKey="amount"
            nameKey="category_name"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || '#6366f1'}
                stroke={isDark ? 'rgba(0,0,0,0.5)' : '#ffffff'}
                strokeWidth={2}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
        <span className="text-sm font-bold text-slate-900 dark:text-white">${total.toFixed(0)}</span>
      </div>
    </div>
  );
};

export default CategoryDonutChart;

