import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Sparkles, RefreshCw, ShieldCheck, AlertTriangle, Lightbulb } from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import ProgressRing from '../components/ui/ProgressRing';
import SkeletonCard from '../components/ui/SkeletonCard';

import { fetchAIReport, generateFreshAIReport } from '../store/slices/aiReportSlice';
import { addToast } from '../store/slices/uiSlice';

export const AIReportPage = () => {
  const dispatch = useDispatch();
  const { report, status, isGenerating } = useSelector((state) => state.aiReport);

  useEffect(() => {
    dispatch(fetchAIReport(false));
  }, [dispatch]);

  const handleRefresh = async () => {
    try {
      await dispatch(generateFreshAIReport()).unwrap();
      dispatch(addToast({ message: 'Fresh AI analysis generated!', type: 'success' }));
    } catch (err) {
      dispatch(addToast({ message: err || 'Failed to generate report', type: 'error' }));
    }
  };

  const jsonContent = report?.content_json || {};
  const score = jsonContent.health_score || 70;
  const healthStatus = jsonContent.status || 'Good';
  const topRisk = jsonContent.top_risk || 'Monitor recurring expenditures';
  const topOpportunity = jsonContent.top_opportunity || 'Grow savings buffer';
  const savingsRate = jsonContent.savings_rate_pct !== undefined ? jsonContent.savings_rate_pct : 25;

  const getScoreColor = (sc) => {
    if (sc >= 80) return '#10b981';
    if (sc >= 65) return '#6366f1';
    if (sc >= 50) return '#f59e0b';
    return '#f43f5e';
  };

  const scoreColor = getScoreColor(score);

  return (
    <PageTransition className="space-y-4">
      {/* Top Hero Banner */}
      <GlassCard glow className="p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Score Ring */}
          <div className="flex items-center gap-5">
            <ProgressRing progress={score} size={96} strokeWidth={9} color={scoreColor}>
              <div className="text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{score}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-1">/ 100</span>
              </div>
            </ProgressRing>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Financial Health Score
                </h2>
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${scoreColor}25`, color: scoreColor, borderColor: `${scoreColor}50`, borderWidth: 1 }}
                >
                  {healthStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Gemini AI 30-day multi-factor cashflow audit
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  Savings Rate: <strong className="text-slate-900 dark:text-white">{savingsRate}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Action Button & Quota Info */}
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isGenerating}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl gradient-primary-btn text-white text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
              <span>{isGenerating ? 'Auditing with Gemini...' : 'Re-Analyze'}</span>
            </button>

            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500 dark:text-emerald-400" />
              <span>Free-tier quota guarded • Cached</span>
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Highlights: Risk & Opportunity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassCard className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <AlertTriangle size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Top Risk</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">{topRisk}</p>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <Lightbulb size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Key Opportunity</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">{topOpportunity}</p>
        </GlassCard>
      </div>

      {/* Detailed Markdown Analysis */}
      <GlassCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
            <span>AI Advisor Detailed Report</span>
          </h3>
          {report?.generated_at && (
            <span className="text-[11px] text-slate-500">
              Generated: {new Date(report.generated_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {status === 'loading' && !report ? (
          <SkeletonCard count={3} height="h-20" />
        ) : (
          <div className="max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
            {report?.content_markdown ? (
              report.content_markdown.split('\n\n').map((paragraph, index) => {
                if (paragraph.startsWith('### ')) {
                  return (
                    <h4
                      key={index}
                      className="text-sm font-bold text-indigo-600 dark:text-indigo-300 pt-2 pb-1 border-b border-slate-200 dark:border-white/5"
                    >
                      {paragraph.replace('### ', '')}
                    </h4>
                  );
                } else if (paragraph.startsWith('- ') || paragraph.startsWith('1. ')) {
                  return (
                    <div key={index} className="space-y-1.5 pl-2">
                      {paragraph.split('\n').map((line, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-2">
                          <span className="text-indigo-600 dark:text-indigo-400 shrink-0">•</span>
                          <span>{line.replace(/^[-*]|\d+\.\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <p key={index} className="text-slate-700 dark:text-slate-300">
                    {paragraph}
                  </p>
                );
              })
            ) : (
              <p className="text-slate-500">Click Re-Analyze to generate your first financial audit.</p>
            )}
          </div>
        )}
      </GlassCard>
    </PageTransition>
  );
};

export default AIReportPage;

