import React from 'react';
import { TrendingUp, Cloud, Calendar, Newspaper } from 'lucide-react';

interface TrendSourceBreakdownProps {
  apiTrendSignals?: Record<string, any>;
  trendSources?: string[];
  trendModifier?: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  google_trends: <TrendingUp className="w-5 h-5" />,
  weather: <Cloud className="w-5 h-5" />,
  festival: <Calendar className="w-5 h-5" />,
  news: <Newspaper className="w-5 h-5" />,
};

const COLOR_MAP: Record<string, string> = {
  google_trends: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
  weather: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]',
  festival: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]',
  news: 'bg-orange-500/10 text-[var(--pes-orange)] border-orange-500/20 shadow-[0_0_15px_rgba(255,165,0,0.1)]',
};

const SOURCE_NAMES: Record<string, string> = {
  google_trends: 'Neural Trends',
  weather: 'Atmo Signals',
  festival: 'Cultural Vector',
  news: 'Pulse Streams',
};

export function TrendSourceBreakdown({
  apiTrendSignals,
  trendSources = [],
  trendModifier = 1.0,
}: TrendSourceBreakdownProps) {
  if (!apiTrendSignals || Object.keys(apiTrendSignals).length === 0) {
    return null;
  }

  return (
    <div className="glass-card !p-6 border border-white/5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--pes-orange)] opacity-[0.02] blur-3xl pointer-events-none" />
      
      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3 mb-6">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--pes-orange)] animate-pulse" />
        Synaptic Trend Breakdown
      </h3>

      <div className="space-y-4">
        {Object.entries(apiTrendSignals).map(([source, data]: [string, any]) => {
          const sourceName = SOURCE_NAMES[source] || source.toUpperCase();
          const icon = ICON_MAP[source];
          const colorClass = COLOR_MAP[source] || 'bg-white/5 text-white/40 border-white/10';
          const impactScore = data?.impact_score || 1.0;

          // Weights matching the logic: 35% festival, 25% weather, 20% google_trends, 20% news
          const weights: Record<string, number> = {
            festival: 0.35,
            weather: 0.25,
            google_trends: 0.2,
            news: 0.2,
          };
          const weight = weights[source] || 0.2;
          const contribution = ((impactScore - 1) * weight * 100).toFixed(1);

          return (
            <div key={source} className={`border rounded-[1.25rem] p-4 transition-all hover:scale-[1.02] ${colorClass}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1 opacity-80">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black text-sm tracking-tight text-white">{sourceName}</p>
                    <p className="text-[10px] font-bold opacity-60 mt-1.5 leading-relaxed">
                      {_renderSourceDetails(source, data)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display font-black text-lg text-white">{impactScore.toFixed(2)}x</p>
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">{contribution}% IMPACT</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current transition-all duration-700"
                  style={{ width: `${Math.min(100, (impactScore - 0.5) / 2.5 * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary section */}
      <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Aggregate Delta Modifier</span>
          <p className="text-[11px] font-bold text-white/40 italic">
            Computed from {trendSources.length} neural vectors
          </p>
        </div>
        <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/5">
          <span className="text-2xl font-display font-black text-[var(--pes-orange)] shadow-[0_0_20px_rgba(255,165,0,0.2)]">
            {trendModifier.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}

function _renderSourceDetails(source: string, data: any): string {
  switch (source) {
    case 'google_trends':
      return `Search volume: ${data?.trend_value?.toFixed(0) || '?'}/100 - ${data?.trend_direction || 'stable'}`;
    case 'weather':
      return `${data?.weather || '?'} • Temp: ${data?.temperature?.toFixed(0) || '?'}°C • Humidity: ${data?.humidity?.toFixed(0) || '?'}%`;
    case 'festival':
      return data?.upcoming_festivals?.length
        ? `${data.upcoming_festivals.length} upcoming festivals • Next: ${data.upcoming_festivals[0]}`
        : 'No major festivals upcoming';
    case 'news':
      return data?.sentiment
        ? `Sentiment: ${data.sentiment} • Mentions: ${data.article_count || 0}`
        : 'No relevant news';
    default:
      return JSON.stringify(data).substring(0, 50) + '...';
  }
}
