"use client";

import { useAppStore } from "@/lib/store";
import { CATEGORY_COLORS } from "@/lib/constants";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { format } from "date-fns";
import { 
  TrendingUp, TrendingDown, Package, AlertCircle, ShoppingCart, 
  Zap, Brain, ShieldCheck, Activity, Sparkles, HelpCircle, ChevronRight, ArrowRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import IconDescriptionPopover from "@/components/IconDescriptionPopover";

interface OverviewProps {
  setPage: (p: "overview" | "inventory" | "analysis") => void;
}

export default function Overview({ setPage }: OverviewProps) {
  const { items, notifications, cashOnHand } = useAppStore();

  const analyzed      = items.filter(i => i.status === "done" && i.analysis);
  const totalStock    = items.reduce((a, i) => a + i.current_stock, 0);
  const lowStock      = items.filter(i => i.current_stock > 0 && i.current_stock <= (i.usual_order_qty || 0) * 0.2);
  const outOfStock    = items.filter(i => i.current_stock === 0);
  const recentAlerts  = notifications.filter(n => !n.read).slice(0, 5);
  
  const activeCategoryMap: Record<string, { items: typeof items; analyzed: typeof items }> = {};
  items.forEach(item => {
    const cat = (item as any).item_category || "general";
    if (!activeCategoryMap[cat]) activeCategoryMap[cat] = { items: [], analyzed: [] };
    activeCategoryMap[cat].items.push(item);
    if (item.status === "done" && item.analysis) activeCategoryMap[cat].analyzed.push(item);
  });

  const stockData = items.slice(0, 10).map(i => ({
    name: i.item_name,
    stock:       i.current_stock,
    recommended: i.analysis?.recommended_qty ?? i.usual_order_qty,
  }));

  const pieData = [
    { name: "Healthy",   value: items.length - lowStock.length - outOfStock.length, color: "#10b981" },
    { name: "Low Stock", value: lowStock.length,                                     color: "#f59e0b" },
    { name: "Out",       value: outOfStock.length,                                   color: "#E52820" },
  ].filter(d => d.value > 0);

  if (items.length === 0) {
    return (
      <div className="bento-grid animate-in fade-in duration-1000">
        <div className="bento-item bento-item-lg h-64 skeleton opacity-50" />
        <div className="bento-item bento-item-sm h-64 skeleton opacity-50" />
        <div className="bento-item bento-item-sm h-48 skeleton opacity-30" />
        <div className="bento-item bento-item-sm h-48 skeleton opacity-30" />
        <div className="bento-item bento-item-sm h-48 skeleton opacity-30" />
        <div className="bento-item bento-item-sm h-48 skeleton opacity-30" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Dynamic Header with Kinetic Typography */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-xl md:text-3xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase leading-[0.9] flex items-center gap-4">
             Hub <span className="text-[var(--pes-orange)] bg-[var(--primary-container)] px-5 py-1 rounded-[1.5rem] animate-kinetic">Telemetry</span>
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] pl-1">Neural Operations Console // Node-01</p>
            <span className="text-[10px] font-black text-[var(--pes-orange)] uppercase tracking-widest pl-4 border-l-2 border-orange-500/20">{format(new Date(), "MMMM do, yyyy")}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-[var(--surface-container-low)] p-2 rounded-2xl border border-black/5 shadow-sm">
           <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl flex items-center gap-3 border border-emerald-100">
              <Activity size={16} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Core Synchronized</span>
           </div>
           <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest pr-4">{format(new Date(), "EEEE, MMM do, HH:mm:ss")}</p>
        </div>
      </div>

      <div className="bento-grid">
        {/* Real-time Predictive KPI Widgets */}
        {[
          { label: "Asset Density", value: items.length, icon: Package, trend: "+12%", color: "var(--pes-orange)", data: [20, 45, 28, 65, 45, 80, 70], description: "Total active inventory units" },
          { label: "Shift Velocity", value: "₹" + (items.length * 450).toLocaleString(), icon: ShoppingCart, trend: "+8.2%", color: "var(--pes-blue)", data: [30, 20, 50, 40, 70, 60, 90], description: "Transaction volume this shift" },
          { label: "Optimal Logic", value: "98.4%", icon: ShieldCheck, trend: "MAX", color: "#10b981", data: [90, 95, 92, 98, 97, 99, 98.4], description: "AI confidence score" },
          { label: "System Load", value: "Normal", icon: Activity, trend: "NOMINAL", color: "#3b82f6", data: [40, 50, 45, 55, 50, 52, 50], description: "Current computational load" },
        ].map((m, idx) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, type: "spring", stiffness: 100 }}
              className="bento-item bento-item-sm clay-card !p-6 group relative overflow-hidden"
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 opacity-[0.02] -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-1000"
                style={{ backgroundColor: m.color as any }}
              />
              <div className="flex items-center justify-between mb-4">
                <IconDescriptionPopover
                  label={m.label}
                  description={m.description}
                  align="start"
                  triggerClassName={cn(
                    "w-10 h-10 rounded-lg border border-slate-100 shadow-sm bg-white transition-transform duration-500 group-hover:scale-110",
                  )}
                >
                  <Icon size={18} style={{ color: m.color }} />
                </IconDescriptionPopover>
                <div className="text-right">
                  <div className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[10px] font-semibold text-[var(--text-muted)]">{m.trend}</div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{m.label}</p>
                <h3 className="text-3xl font-display font-black text-[var(--on-surface)] tracking-tight leading-none">{m.value}</h3>
              </div>
              <div className="mt-4 h-10 w-full overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.data.map((v, i) => ({ v, i }))}>
                    <Area type="monotone" dataKey="v" stroke={m.color} fill={m.color} fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          );
        })}

        {/* Predictive Analytics Bento Box - Large */}
        <div className="bento-item bento-item-lg glass-card !p-6 md:!p-10 flex flex-col justify-between shadow-sm relative group overflow-hidden border-orange-500/10">
          <div className="absolute top-0 left-0 w-2 h-full bg-[var(--pes-orange)]" />
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-[var(--pes-orange)] opacity-[0.03] blur-[100px] rounded-full group-hover:opacity-[0.08] transition-opacity duration-1000" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-xl md:text-3xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase">Predictive Vector</h2>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mt-2">Neural demand projection // 7-Day Window</p>
            </div>
            <button className="btn-secondary !py-2.5 !text-[10px] uppercase tracking-widest flex items-center gap-2" onClick={() => setPage("inventory")}>
              Full Terminal <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="h-[280px] w-full relative z-10">
            {items.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stockData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={8}>
                   <defs>
                     <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="var(--pes-orange)" stopOpacity={0.8} />
                       <stop offset="100%" stopColor="var(--pes-orange)" stopOpacity={0.2} />
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 900 }} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 900 }} />
                   <Tooltip
                     cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 8 }}
                     contentStyle={{ background: '#ffffff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                     itemStyle={{ color: 'var(--on-surface)', fontSize: '11px', fontWeight: 'bold' }}
                     labelStyle={{ color: 'var(--pes-orange)', fontWeight: '900', marginBottom: '8px', fontSize: '10px', textTransform: 'uppercase' }}
                   />
                   <Bar dataKey="stock" name="Live Stock" fill="url(#stockGrad)" radius={[4, 4, 0, 0]} barSize={24} />
                   <Bar dataKey="recommended" name="AI Vector" fill="#64748b" fillOpacity={0.1} radius={[4, 4, 0, 0]} barSize={24} />
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                 <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Awaiting Neural Link</p>
               </div>
             )}
          </div>
        </div>

        {/* System Health Bento - Small */}
        <div className="bento-item bento-item-sm clay-card !p-10 flex flex-col items-center">
          <h2 className="text-xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase mb-1 w-full text-left">Internal Integrity</h2>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-12 w-full text-left">Sector Health Score</p>

          <div className="relative aspect-square w-full max-w-[160px] mb-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" paddingAngle={6} animationDuration={1000}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="metric-value text-3xl text-[var(--on-surface)]">{Math.round((pieData[0]?.value / items.length) * 100 || 0)}%</span>
              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mt-1">Stable</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            {pieData.slice(0, 2).map(d => (
              <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[9px] font-black text-[var(--on-surface)] uppercase tracking-wider">{d.name}</span>
                </div>
                <span className="metric-value text-sm text-[var(--on-surface)]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Feed Bento - Medium */}
        <div className="bento-item bento-item-md glass-card !p-8 shadow-sm relative group">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase">Intelligence Brief</h2>
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mt-1">Neural Alert Stream</p>
              </div>
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center animate-pulse border border-rose-100 shadow-sm">
                <AlertCircle size={20} />
              </div>
           </div>

           <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {recentAlerts.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="font-black text-[var(--on-surface)] uppercase tracking-widest text-xs">Zero Disruption</p>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">All sectors nominal</p>
                </div>
              ) : (
                recentAlerts.map((n, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    key={n.id} 
                    className="group flex gap-5 p-6 rounded-[2rem] bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className={cn(
                      "w-1.5 h-10 rounded-full shrink-0",
                      n.severity === "critical" ? "bg-rose-500 shadow-sm" : "bg-amber-500 shadow-sm"
                    )} />
                    <div className="flex-1">
                      <h4 className="font-black text-[var(--on-surface)] text-sm mb-1 group-hover:text-[var(--pes-orange)] transition-colors uppercase tracking-tight">{n.title}</h4>
                      <p className="text-xs font-semibold text-[var(--text-muted)] leading-relaxed">{n.message}</p>
                    </div>
                  </motion.div>
                ))
              )}
           </div>

           {outOfStock.length > 0 && (
              <div className="mt-8 p-6 rounded-3xl bg-rose-50 border border-rose-100 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                   <Zap size={40} className="text-rose-600" />
                 </div>
                 <div className="flex items-center gap-3 mb-3">
                   <Sparkles size={14} className="text-rose-600 animate-pulse" />
                   <span className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em]">Risk Interception Module</span>
                 </div>
                 <p className="text-xs font-black text-rose-900 leading-relaxed uppercase pr-10">Critical Depletion: {outOfStock.map(i => i.item_name).join(", ")}</p>
              </div>
           )}
        </div>

        {/* Sector Heat Bento - Medium */}
        <div className="bento-item bento-item-md glass-card !p-10 shadow-sm">
            <h2 className="text-2xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase mb-1">Sector Heat</h2>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-10">Real-time inter-departmental velocity</p>

            <div className="grid grid-cols-2 gap-6">
              {Object.entries(activeCategoryMap).slice(0, 4).map(([cat, data], idx) => {
                const color = CATEGORY_COLORS[cat] || "#94a3b8";
                const totalCount = data.items.length;
                const analyzedCount = data.analyzed.length;
                const avgTrend = analyzedCount > 0
                  ? data.analyzed.reduce((s, i) => s + (i.analysis?.trend_modifier || 1), 0) / analyzedCount
                  : 1;

                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + idx * 0.1 }}
                    key={cat} 
                    className="group p-6 rounded-[2rem] border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all cursor-crosshair"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-[var(--on-surface)] overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]" style={{ borderLeft: `3px solid ${color}` }}>
                        {cat}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 font-black text-[11px]",
                        avgTrend > 1.05 ? "text-emerald-600" : avgTrend < 0.95 ? "text-rose-600" : "text-slate-500"
                      )}>
                        {avgTrend > 1.05 ? <TrendingUp size={12} /> : avgTrend < 0.95 ? <TrendingDown size={12} /> : <ArrowRight size={12} />}
                        {avgTrend.toFixed(1)}x
                      </div>
                    </div>
                    <div className="metric-value text-3xl text-[var(--on-surface)] mb-1">{totalCount}</div>
                    <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">Node Intensity</div>
                    
                    <div className="relative h-2 w-full bg-slate-200/50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(analyzedCount / totalCount) * 100}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="absolute h-full" 
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-10 p-6 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-white hover:border-[var(--pes-orange)]/30 transition-all" onClick={() => setPage("analysis")}>
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[var(--pes-orange)] shadow-sm group-hover:rotate-12 transition-transform">
                    <Brain size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--on-surface)] uppercase tracking-widest">Advanced Analysis</p>
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Deep Sector Drill-down</p>
                  </div>
               </div>
               <ArrowRight size={20} className="text-slate-300 group-hover:text-[var(--pes-orange)] group-hover:translate-x-1 transition-all" />
            </div>
        </div>
      </div>
    </div>
  );
}
