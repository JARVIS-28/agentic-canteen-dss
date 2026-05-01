"use client";

import { useAppStore } from "@/lib/store";
import { CATEGORY_COLORS } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, Package, AlertCircle, ShoppingCart,
  Zap, Brain, ShieldCheck, Activity, Sparkles, ChevronRight, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import IconDescriptionPopover from "@/components/IconDescriptionPopover";

interface OverviewProps {
  setPage: (p: "overview" | "inventory" | "analysis") => void;
}

export default function Overview({ setPage }: OverviewProps) {
  const { items, notifications, cashOnHand } = useAppStore();

  const analyzed     = items.filter(i => i.status === "done" && i.analysis);
  const totalStock   = items.reduce((a, i) => a + i.current_stock, 0);
  const lowStock     = items.filter(i => i.current_stock > 0 && i.current_stock <= (i.usual_order_qty || 0) * 0.2);
  const outOfStock   = items.filter(i => i.current_stock === 0);
  const recentAlerts = notifications.filter(n => !n.read).slice(0, 5);

  const activeCategoryMap: Record<string, { items: typeof items; analyzed: typeof items }> = {};
  items.forEach(item => {
    const cat = (item as any).item_category || "general";
    if (!activeCategoryMap[cat]) activeCategoryMap[cat] = { items: [], analyzed: [] };
    activeCategoryMap[cat].items.push(item);
    if (item.status === "done" && item.analysis) activeCategoryMap[cat].analyzed.push(item);
  });

  const stockData = items.slice(0, 8).map(i => ({
    name: i.item_name.slice(0, 8),
    stock: i.current_stock,
    recommended: i.analysis?.recommended_qty ?? i.usual_order_qty,
  }));

  const pieData = [
    { name: "Healthy",   value: items.length - lowStock.length - outOfStock.length, color: "#059669" },
    { name: "Low Stock", value: lowStock.length,   color: "#d97706" },
    { name: "Out",       value: outOfStock.length, color: "#dc2626" },
  ].filter(d => d.value > 0);

  const healthPct = Math.round(((pieData[0]?.value ?? 0) / Math.max(items.length, 1)) * 100);

  if (items.length === 0) {
    return (
      <div className="bento-grid animate-in fade-in duration-700">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={cn("skeleton", i === 0 ? "bento-item bento-item-lg h-72" : "bento-item bento-item-sm h-52")} style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }

  const springDelay = (i: number) => ({ delay: i * 0.08, type: "spring" as const, stiffness: 90, damping: 15 });

  return (
    <div className="flex flex-col gap-6 pb-16" style={{ fontFamily: "var(--font-body)" }}>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
              Hub <span className="px-3 py-1 rounded-xl animate-kinetic inline-block" style={{ color: "var(--pes-orange)", background: "var(--pes-orange-dim)" }}>Telemetry</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
              Neural Operations Console
            </p>
            <span className="text-[10px] font-bold uppercase tracking-widest pl-3" style={{ color: "var(--pes-orange)", borderLeft: "2px solid rgba(238,131,38,0.2)" }}>
              {format(new Date(), "MMMM do, yyyy")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-base)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "var(--success-dim)" }}>
            <Activity size={13} style={{ color: "var(--success)" }} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--success)" }}>Core Synchronized</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {format(new Date(), "EEE, HH:mm")}
          </p>
        </div>
      </div>

      <div className="bento-grid">
        {/* KPI Cards */}
        {[
          { label: "Asset Density",  value: items.length,                               icon: Package,    trend: "+12%", color: "var(--pes-orange)", bg: "var(--pes-orange-dim)", data: [20,45,28,65,45,80,70], desc: "Total active inventory units" },
          { label: "Shift Velocity", value: "₹" + (items.length * 450).toLocaleString(), icon: ShoppingCart, trend: "+8.2%", color: "#2563eb",         bg: "#dbeafe",              data: [30,20,50,40,70,60,90], desc: "Transaction volume this shift" },
          { label: "AI Confidence",  value: "98.4%",                                    icon: ShieldCheck, trend: "MAX",   color: "var(--success)",    bg: "var(--success-dim)",   data: [90,95,92,98,97,99,98], desc: "AI prediction confidence score" },
          { label: "System Load",    value: "Normal",                                   icon: Activity,   trend: "GOOD",  color: "#7c3aed",            bg: "#f5f3ff",              data: [40,50,45,55,50,52,50], desc: "Current system load status" },
        ].map((m, idx) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springDelay(idx)}
              className="bento-item bento-item-sm clay-card p-5 group cursor-default relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${m.bg} 0%, transparent 70%)`, transform: "translate(30%, -30%)" }} />
              <div className="flex items-center justify-between mb-4">
                <IconDescriptionPopover label={m.label} description={m.desc} align="start"
                  triggerClassName="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--border-base)] transition-transform duration-300 group-hover:scale-110"
                  style={{ background: m.bg }}
                >
                  <Icon size={17} style={{ color: m.color }} />
                </IconDescriptionPopover>
                <div className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest" style={{ background: "var(--bg-tonal)", color: "var(--text-muted)" }}>
                  {m.trend}
                </div>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
              <h3 className="text-2xl font-black tracking-tight leading-none" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}>{m.value}</h3>
              <div className="mt-3 h-8 w-full opacity-40 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.data.map((v, i) => ({ v, i }))}>
                    <Area type="monotone" dataKey="v" stroke={m.color} fill={m.color} fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          );
        })}

        {/* Large Predictive Chart */}
        <div className="bento-item bento-item-lg glass-card p-6 md:p-8 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full rounded-r-full" style={{ background: "var(--pes-orange)" }} />
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(238,131,38,0.06) 0%, transparent 70%)" }} />

          <div className="flex items-center justify-between mb-6 pl-4">
            <div>
              <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Predictive Vector</h2>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] mt-1" style={{ color: "var(--text-muted)" }}>Neural demand projection · 7-Day window</p>
            </div>
            <button className="btn-secondary !py-2 !px-4 !text-[10px] flex items-center gap-1.5" onClick={() => setPage("inventory")}>
              Full Terminal <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex-1 h-[240px] pl-4">
            {items.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={6}>
                  <defs>
                    <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--pes-orange)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--pes-orange)" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-base)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 700, fontFamily: "var(--font-body)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(238,131,38,0.04)", radius: 8 }}
                    contentStyle={{ background: "#fff", borderRadius: "14px", border: "1px solid var(--border-base)", boxShadow: "var(--shadow-lg)", fontFamily: "var(--font-body)" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "11px", fontWeight: 700 }}
                    labelStyle={{ color: "var(--pes-orange)", fontWeight: 900, fontSize: "10px", textTransform: "uppercase" }}
                  />
                  <Bar dataKey="stock" name="Live Stock" fill="url(#stockGrad)" radius={[5, 5, 0, 0]} barSize={20} />
                  <Bar dataKey="recommended" name="AI Vector" fill="var(--pes-blue)" fillOpacity={0.15} radius={[5, 5, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center rounded-2xl" style={{ background: "var(--bg-tonal)", border: "1px dashed var(--border-strong)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Awaiting Neural Link</p>
              </div>
            )}
          </div>
        </div>

        {/* Health Donut */}
        <div className="bento-item bento-item-sm clay-card p-7 flex flex-col items-center">
          <h2 className="text-lg font-black uppercase tracking-tight w-full mb-0.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Integrity</h2>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-8 w-full" style={{ color: "var(--text-muted)" }}>Sector Health Score</p>

          <div className="relative w-full max-w-[140px] aspect-square mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={65} dataKey="value" paddingAngle={5} animationDuration={900}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.05em" }}>{healthPct}%</span>
              <span className="text-[8px] font-black uppercase tracking-widest mt-0.5" style={{ color: "var(--success)" }}>Stable</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "var(--bg-tonal)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                </div>
                <span className="text-sm font-black" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Feed */}
        <div className="bento-item bento-item-md glass-card p-7 relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Intelligence Brief</h2>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] mt-1" style={{ color: "var(--text-muted)" }}>Neural Alert Stream</p>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse" style={{ background: "var(--error-dim)", color: "var(--error)", border: "1px solid rgba(220,38,38,0.1)" }}>
              <AlertCircle size={17} />
            </div>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {recentAlerts.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center rounded-2xl" style={{ background: "var(--bg-tonal)", border: "1px dashed var(--border-strong)" }}>
                <Sparkles size={20} className="mb-3" style={{ color: "var(--success)" }} />
                <p className="font-black uppercase tracking-widest text-xs" style={{ color: "var(--text-primary)" }}>Zero Disruption</p>
                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>All sectors nominal</p>
              </div>
            ) : (
              recentAlerts.map((n, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.07 }}
                  key={n.id}
                  className="group flex gap-4 p-4 rounded-2xl transition-all cursor-pointer hover:shadow-md"
                  style={{ background: "var(--bg-tonal)", border: "1px solid var(--border-base)" }}
                >
                  <div className={cn("w-1 h-10 rounded-full shrink-0 mt-0.5")}
                    style={{ background: n.severity === "critical" ? "var(--error)" : "var(--warning)" }} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm mb-0.5 group-hover:text-[var(--pes-orange)] transition-colors truncate uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>{n.title}</h4>
                    <p className="text-xs font-medium leading-snug" style={{ color: "var(--text-muted)" }}>{n.message}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {outOfStock.length > 0 && (
            <div className="mt-5 p-4 rounded-2xl relative overflow-hidden" style={{ background: "var(--error-dim)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={12} style={{ color: "var(--error)" }} className="animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--error)" }}>Risk Interception</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-tight" style={{ color: "var(--error)" }}>
                Critical Depletion: {outOfStock.map(i => i.item_name).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Sector Heat */}
        <div className="bento-item bento-item-md glass-card p-7">
          <h2 className="text-lg font-black uppercase tracking-tight mb-0.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Sector Heat</h2>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] mb-8" style={{ color: "var(--text-muted)" }}>Real-time inter-departmental velocity</p>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(activeCategoryMap).slice(0, 4).map(([cat, data], idx) => {
              const color = CATEGORY_COLORS[cat] || "#94a3b8";
              const totalCount = data.items.length;
              const analyzedCount = data.analyzed.length;
              const avgTrend = analyzedCount > 0
                ? data.analyzed.reduce((s, i) => s + (i.analysis?.trend_modifier || 1), 0) / analyzedCount
                : 1;

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + idx * 0.08 }}
                  key={cat}
                  className="group p-4 rounded-2xl transition-all cursor-crosshair hover:shadow-md"
                  style={{ background: "var(--bg-tonal)", border: "1px solid var(--border-base)" }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] truncate max-w-[100px]"
                      style={{ background: "var(--bg-card)", color: "var(--text-secondary)", borderLeft: `3px solid ${color}`, paddingLeft: "6px" }}>
                      {cat}
                    </div>
                    <div className={cn("flex items-center gap-0.5 font-black text-[10px]",
                      avgTrend > 1.05 ? "" : avgTrend < 0.95 ? "" : ""
                    )} style={{ color: avgTrend > 1.05 ? "var(--success)" : avgTrend < 0.95 ? "var(--error)" : "var(--text-muted)" }}>
                      {avgTrend > 1.05 ? <TrendingUp size={11} /> : avgTrend < 0.95 ? <TrendingDown size={11} /> : <ArrowRight size={11} />}
                      {avgTrend.toFixed(1)}x
                    </div>
                  </div>
                  <div className="text-2xl font-black mb-0.5" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}>{totalCount}</div>
                  <div className="text-[8px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Node Intensity</div>
                  <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--border-base)" }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(analyzedCount / Math.max(totalCount, 1)) * 100}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="absolute h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div
            className="mt-6 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all group hover:shadow-md"
            style={{ background: "var(--bg-tonal)", border: "1px solid var(--border-base)" }}
            onClick={() => setPage("analysis")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:rotate-12"
                style={{ background: "var(--pes-orange-dim)", color: "var(--pes-orange)" }}>
                <Brain size={17} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>Advanced Analysis</p>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Deep sector drill-down</p>
              </div>
            </div>
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" style={{ color: "var(--pes-orange)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
