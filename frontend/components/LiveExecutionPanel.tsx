'use client';

import React, { useEffect, useRef } from 'react';
import { ThoughtMessage } from '@/hooks/useWebSocketAnalysis';
import { BarChart2, TrendingUp, Square, ShieldAlert, MessageSquare, Bot, RefreshCw, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveExecutionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  thoughts: ThoughtMessage[];
  isAnalyzing: boolean;
  sessionId?: string | null;
}

const AGENT_META: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  ForecastingAgent: {
    color: '#0ea5e9',
    bg:   '#f0f9ff',
    icon: <BarChart2 size={16} />,
    label: 'Forecasting — Node',
  },
  TrendAgent: {
    color: '#8b5cf6',
    bg:   '#f5f3ff',
    icon: <TrendingUp size={16} />,
    label: 'Trend — Scout',
  },
  MatrixBuilder: {
    color: '#10b981',
    bg:   '#f0fdf4',
    icon: <Square size={16} />,
    label: 'Matrix — Architect',
  },
  RiskAgent: {
    color: '#ef4444',
    bg:   '#fef2f2',
    icon: <ShieldAlert size={16} />,
    label: 'Risk — Guard',
  },
  ExplanationAgent: {
    color: '#f97316',
    bg:   '#fff7ed',
    icon: <MessageSquare size={16} />,
    label: 'Explanation — Envoy',
  },
};

const DEFAULT_META = { color: '#64748b', bg: '#f8fafc', icon: <Bot size={16} />, label: 'Neural Agent' };

export function LiveExecutionPanel({
  isOpen,
  onClose,
  thoughts,
  isAnalyzing,
  sessionId,
}: LiveExecutionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts]);

  if (!isOpen) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* ── Panel ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-[3rem] border-t border-black/5 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom duration-700"
        style={{ height: '70vh' }}
      >
        <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-10 py-8 border-b border-black/5">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-[var(--pes-orange)]/10 text-[var(--pes-orange)] rounded-2xl flex items-center justify-center shadow-sm border border-[var(--pes-orange)]/20">
                {isAnalyzing ? <RefreshCw size={28} className="animate-spin" /> : <Bot size={28} />}
              </div>
              <div>
                <h3 className="text-2xl font-display font-black text-[var(--on-surface)] uppercase tracking-tighter">
                  {isAnalyzing ? "Processing Intelligence" : "Analysis Sync Complete"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", isAnalyzing ? "bg-amber-500" : "bg-emerald-500")} />
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    Active Link: {sessionId?.slice(0, 8) || 'LOCAL_NODE'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-[var(--text-muted)] hover:text-[var(--on-surface)] rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
            >
              Disconnect
            </button>
          </div>

          {/* Pipeline Icons */}
          <div className="flex px-10 py-4 gap-4 border-b border-slate-50 overflow-x-auto no-scrollbar">
             {Object.entries(AGENT_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 opacity-60">
                   <div style={{ color: meta.color }}>{meta.icon}</div>
                   <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{meta.label.split(' ')[0]}</span>
                </div>
             ))}
          </div>

          {/* Thoughts Container */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-10 py-12 space-y-8 scroll-smooth no-scrollbar"
          >
            {thoughts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-30">
                <Zap size={48} className="mb-6 animate-bounce" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Synapse Fire...</p>
              </div>
            ) : (
              thoughts.map((t, i) => {
                const meta = t.type === 'thought' && t.data?.agent ? (AGENT_META[t.data.agent] || DEFAULT_META) : DEFAULT_META;
                const isError = t.type === 'error';

                return (
                  <div key={i} className="animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="flex gap-6 max-w-4xl">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border"
                        style={{ backgroundColor: meta.bg, color: meta.color, borderColor: `${meta.color}33` }}
                      >
                        {meta.icon}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-30">
                            {new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <div className={cn(
                          "glass-card !bg-slate-50/50 !p-6 !rounded-[1.5rem] border border-black/5 shadow-sm",
                          isError && "border-rose-200 bg-rose-50/50"
                        )}>
                          <p className={cn(
                            "text-sm font-bold leading-relaxed",
                            isError ? "text-rose-600" : "text-[var(--on-surface)]"
                          )}>
                            {t.message || t.data?.thought}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {isAnalyzing && (
              <div className="flex items-center gap-4 px-6 py-4 bg-slate-50 border border-black/5 rounded-2xl w-fit animate-pulse">
                <RefreshCw size={14} className="animate-spin text-[var(--pes-orange)]" />
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Processing Intelligence Vector...</span>
              </div>
            )}
          </div>

          {/* Footer Status */}
          <div className="px-10 py-6 bg-slate-50/50 border-t border-black/5 flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="flex -space-x-3">
                 {Object.values(AGENT_META).slice(0, 3).map((m, idx) => (
                   <div key={idx} className="w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm" style={{ color: m.color }}>
                     {m.icon}
                   </div>
                 ))}
               </div>
               <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60">Multi-Agent Consensus Active</p>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--pes-orange)] animate-ping" />
                <span className="text-[9px] font-black text-[var(--on-surface)] uppercase tracking-widest">Terminal Node-01 // Secure</span>
             </div>
          </div>
        </div>
      </div>
    </>
  );
}
