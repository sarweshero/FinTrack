import GlassCard from './GlassCard';
import AnimatedCounter from './AnimatedCounter';

export const StatCard = ({
  title,
  amount = 0,
  prefix = '₹',
  icon: Icon,
  trend,
  color = 'indigo',
  subtitle,
  onClick,
  className = '',
}) => {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      glow: 'shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]',
      gradient: 'from-emerald-500/10 via-transparent to-transparent',
    },
    rose: {
      bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      glow: 'shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]',
      gradient: 'from-rose-500/10 via-transparent to-transparent',
    },
    indigo: {
      bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      glow: 'shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]',
      gradient: 'from-indigo-500/10 via-transparent to-transparent',
    },
    amber: {
      bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      glow: 'shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]',
      gradient: 'from-amber-500/10 via-transparent to-transparent',
    },
    purple: {
      bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      glow: 'shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)]',
      gradient: 'from-purple-500/10 via-transparent to-transparent',
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <GlassCard
      onClick={onClick}
      className={`relative overflow-hidden group border border-slate-200/80 dark:border-white/5 ${className}`}
    >
      <div
        className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${scheme.gradient} blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`}
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${scheme.bg}`}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          <AnimatedCounter value={amount} prefix={prefix} />
        </div>
        {trend && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              trend > 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</div>
      )}
    </GlassCard>
  );
};

export default StatCard;

