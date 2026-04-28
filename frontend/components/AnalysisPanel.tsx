"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { InventoryItem, MASResponse } from "@/lib/types";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { CATEGORY_COLORS } from "@/lib/constants";
import { 
  Brain, Package, Banknote, 
  ShieldAlert, CheckCircle2, AlertCircle, 
  Coins, TrendingUp, Radio, Bot, 
  ChevronRight, Zap,
  CalendarDays, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AnalysisView = "single" | "portfolio";

const HORIZON_ORDER = [
  { key: "today", label: "Today", val: 0 },
  { key: "tmrw", label: "Tmrw", val: 1 },
  { key: "week", label: "Week", val: 7 },
  { key: "month", label: "Month", val: 30 },
] as const;

const horizonKeyFromDays = (days: number): (typeof HORIZON_ORDER)[number]["key"] => {
  if (days === 0) return "today";
  if (days === 1) return "tmrw";
  if (days === 7) return "week";
  return "month";
};

const cleanAdviceText = (text: string) => text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\s+/g, " ").trim();

export default function AnalysisPanel() {
  const {
    items, activeItemId, setActiveItem,
    selectedCategory, setSelectedCategory,
    cashOnHand, horizonDays, setHorizonDays
  } = useAppStore();

  const analyzed = useMemo(() => {
    return items
      .filter((i) => i.status === "done" && i.analysis)
      .map((item) => {
        const label = horizonKeyFromDays(horizonDays);
        const hData = (item.analysis as any)?.horizons?.[label];
        if (hData) {
          return {
            ...item,
            analysis: {
              ...item.analysis,
              recommended_qty: hData.qty,
              explanation_english: hData.explanation,
              risk_status: hData.risk_status
            }
          } as InventoryItem;
        }
        return item;
      });
  }, [items, horizonDays]);
  
  const activeCategories = useMemo(() => Array.from(new Set(analyzed.map(i => (i as any).item_category || "general"))), [analyzed]);
  const allCategories = ["all", ...activeCategories];

  const [view, setView] = useState<AnalysisView>("single");

  const filteredItems = useMemo(() => {
    return selectedCategory && selectedCategory !== "all"
      ? analyzed.filter((i) => (i as any).item_category === selectedCategory || (!(i as any).item_category && selectedCategory === "general"))
      : analyzed;
  }, [selectedCategory, analyzed]);

  const activeItem = useMemo(() => {
    return filteredItems.find((i) => i.id === activeItemId) ?? filteredItems[0];
  }, [filteredItems, activeItemId]);

  const portfolioData = useMemo(() => {
    if (analyzed.length === 0) return null;
    const totalCash = cashOnHand > 0 ? cashOnHand : 5000;
    const catMap: Record<string, typeof analyzed> = {};
    analyzed.forEach(item => {
      const cat = (item as any).item_category || "general";
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(item);
    });

    const category_analyses: Record<string, any> = {};
    let totalSpend = 0;

    Object.entries(catMap).forEach(([cat, catItems]) => {
      const totalRec = catItems.reduce((s, i) => s + (i.analysis?.recommended_qty || 0), 0);
      const totalStock = catItems.reduce((s, i) => s + (i.current_stock || 0), 0);
      const spend = catItems.reduce((s, i) => s + ((i.analysis?.recommended_qty || 0) * (i.unit_price || 0)), 0);
      const anyRisky = catItems.some(i => i.analysis?.risk_status !== "Safe");
      const avgMod = catItems.reduce((s, i) => s + (i.analysis?.trend_modifier || 1), 0) / catItems.length;

      totalSpend += spend;
      category_analyses[cat] = {
        category: cat,
        total_items: catItems.length,
        total_current_stock: totalStock,
        total_recommended_stock: totalRec,
        total_spend_required: spend,
        category_trend_modifier: avgMod,
        category_risk_status: anyRisky ? "At Risk" : "Safe",
      };
    });

    const utilization = totalCash > 0 ? (totalSpend / totalCash) * 100 : 0;
    const anyRisky = analyzed.some(i => i.analysis?.risk_status !== "Safe");
    const priorityList = analyzed
      .map(i => {
        const recommendedQty = i.analysis?.recommended_qty || 0;
        const unitPrice = i.unit_price || 0;
        return {
          item_name: i.item_name,
          current_stock: i.current_stock,
          recommended_qty: recommendedQty,
          unit_price: unitPrice,
          spend_required: recommendedQty * unitPrice,
          urgency_score: i.current_stock === 0
            ? 100
            : Math.max(0, 100 - (i.current_stock / Math.max(recommendedQty || 1, 1)) * 100),
        };
      })
      .sort((a, b) => b.urgency_score - a.urgency_score);

    const totalCashRequired = priorityList.reduce((sum, item) => sum + item.spend_required, 0);
    let remainingCash = totalCash;
    let restockCashCovered = 0;

    for (const candidate of priorityList) {
      if (candidate.spend_required <= remainingCash) {
        restockCashCovered += candidate.spend_required;
        remainingCash -= candidate.spend_required;
      } else {
        break;
      }
    }

    const restockCoveragePercentage = totalCashRequired > 0
      ? (restockCashCovered / totalCashRequired) * 100
      : 0;

    return {
      total_items: analyzed.length,
      total_cash_utilized: totalSpend,
      total_cash_required: totalCashRequired,
      restock_cash_covered: restockCashCovered,
      restock_coverage_percentage: restockCoveragePercentage,
      utilization_percentage: utilization,
      portfolio_risk_status: anyRisky ? "At Risk" : "Safe",
      category_analyses,
      priority_reorder_list: priorityList.slice(0, 10),
      cash_on_hand: totalCash,
    };
  }, [analyzed, cashOnHand]);

  if (analyzed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center animate-in-card">
        <div className="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-[var(--pes-orange)] mb-8 border border-slate-100 shadow-xl">
           <Brain size={64} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-display font-black text-[var(--on-surface)] uppercase tracking-tighter mb-2">No Intelligence Feed</h2>
        <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest max-w-xs leading-relaxed">Neural stream is empty. Initiate inventory analysis in the terminal.</p>
        <button className="mt-12 btn-primary" onClick={() => (window.location.href='/inventory')}>Initialize Terminal</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in-card pb-32">
      
      {/* Control Module */}
      <div className="glass-card !bg-white !border-black/5 p-6 flex flex-col xl:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6 w-full xl:w-auto">
          <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100 w-full md:w-auto overflow-x-auto no-scrollbar">
            {(["single", "portfolio"] as AnalysisView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                  view === v ? "bg-[var(--pes-orange)] text-white shadow-lg" : "text-[var(--text-muted)] hover:text-[var(--on-surface)]"
                )}
              >
                {v === "single" ? "Asset Analysis" : "Portfolio Array"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-full md:w-auto overflow-x-auto no-scrollbar">
             <div className="px-4 py-1 flex items-center gap-3 text-[var(--on-surface)]">
                <CalendarDays size={16} className="text-[var(--pes-orange)]" />
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Horizon:</span>
             </div>
             <div className="flex gap-1.5">
               {(HORIZON_ORDER).map((h) => (
                 <button
                  key={h.val}
                  onClick={() => setHorizonDays(h.val)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    horizonDays === h.val ? "bg-white text-[var(--on-surface)] border border-black/5 shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--on-surface)]"
                  )}
                 >
                   {h.label}
                 </button>
               ))}
             </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full xl:w-auto pb-1 xl:pb-0">
          {allCategories.map((cat) => (
            <button 
              key={cat}
              onClick={() => { setSelectedCategory(cat === "all" ? null : cat); setView("single"); }}
              className={cn(
                "whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                (selectedCategory === cat || (!selectedCategory && cat === "all"))
                  ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                  : "bg-slate-50 text-[var(--text-muted)] border-slate-100 hover:bg-white hover:text-[var(--on-surface)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {view === "portfolio" && portfolioData ? (
        <PortfolioDashboard data={portfolioData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative items-start">
          {/* Asset Sidebar */}
          <div className="lg:col-span-3 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[80vh] no-scrollbar pb-4 lg:pb-0">
            {filteredItems.map((item) => {
              const isActive = activeItem?.id === item.id;
              const itemCat = (item as any).item_category || "general";
              const color = CATEGORY_COLORS[itemCat] || "#94a3b8";
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItem(item.id || "")}
                  className={cn(
                    "w-full p-5 flex items-center gap-4 transition-all duration-500 relative group rounded-2xl mb-2",
                    isActive 
                      ? "clay-card !bg-white !p-5 shadow-lg scale-[1.02] border-[var(--pes-orange)]/30" 
                      : "hover:bg-slate-50 border border-transparent"
                  )}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100 shadow-sm transition-transform duration-500 group-hover:rotate-12">
                    <Package size={20} style={{ color }} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-black text-[var(--on-surface)] truncate uppercase tracking-tight">{item.item_name}</div>
                    <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">STOCK: {item.current_stock}</div>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--pes-orange)] animate-pulse shadow-[0_0_8px_var(--pes-orange)]" />}
                </button>
              );
            })}
          </div>

          {/* Asset Intel Dashboard */}
          <div className="lg:col-span-9 space-y-8">
            {activeItem && activeItem.analysis ? (
              <AssetIntelligenceView item={activeItem} analysis={activeItem.analysis} />
            ) : (
              <div className="glass-card !bg-white border-black/5 !rounded-[3rem] p-32 text-center flex flex-col items-center">
                 <Radio className="text-slate-100 mb-8 animate-pulse" size={64} />
                 <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em]">Select active node for telemetry</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioDashboard({ data }: { data: any }) {
  const formatCurrency = (value: number) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
  const coveragePercent = Math.min(100, Math.max(0, data.restock_coverage_percentage || 0));
  const kpiMetrics = [
    { label: "Fleet Nodes", value: data.total_items, icon: <Package size={18} />, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Optimal Flow", value: formatCurrency(data.restock_cash_required || 0), sub: "Gross Reinvestment", icon: <Banknote size={18} />, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Fill Efficiency", value: `${coveragePercent.toFixed(1)}%`, sub: "Operational Cover", icon: <Coins size={18} />, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Budget Velocity", value: `${data.utilization_percentage.toFixed(1)}%`, sub: "Efficiency Index", icon: <TrendingUp size={18} />, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Fleet Integrity", value: data.portfolio_risk_status, icon: <ShieldAlert size={18} />, color: "text-[var(--on-surface)]", bg: "bg-slate-50" },
  ];

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-700">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {kpiMetrics.map((m) => (
         <div key={m.label} className="glass-card !bg-white !border-black/5 p-6 flex flex-col justify-between h-40 shadow-sm transition-all hover:shadow-md">
           <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", m.bg, m.color)}>
             {m.icon}
           </div>
           <div>
             <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{m.label}</p>
             <p className={cn("metric-value text-2xl font-black", m.color)}>{m.value}</p>
             {m.sub && <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase mt-1">{m.sub}</p>}
           </div>
         </div>
        ))}
      </div>

      <div className="section-tonal !bg-slate-50 !p-0 !rounded-[3rem] overflow-hidden border border-slate-100 shadow-sm">
        <div className="bg-gradient-to-r from-[var(--pes-orange)] to-rose-500 h-1.5" />
        <div className="p-8">
          <h4 className="text-[10px] font-black text-[var(--pes-orange)] uppercase tracking-[0.3em] mb-3 flex items-center gap-3">
            <Sparkles size={16} /> 
            Neural Portfolio Mapping
          </h4>
          <p className="text-sm font-bold text-[var(--text-muted)] leading-relaxed max-w-5xl">
            Synthesis engine has parsed your operational array. <strong className="text-[var(--on-surface)]">Predictive Re-balancing</strong> is currently prioritizing high-turnover sectors to maximize profitability. The <strong className="text-rose-600 font-black">Depletion Vector</strong> indicates urgent action is required on the hotlist below.
          </p>
        </div>
      </div>

      <div className="glass-card !bg-white !border-black/5 p-8 space-y-4 shadow-sm">
        <div className="flex justify-between items-center gap-6">
          <div>
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Fleet Coverage Stability</p>
            <p className="metric-value text-2xl text-[var(--on-surface)]">{formatCurrency(data.restock_cash_covered || 0)} <span className="text-slate-300 text-sm font-medium">/ {formatCurrency(data.total_cash_required || 0)}</span></p>
            <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-1">Cash Integrity: {formatCurrency(data.cash_on_hand || 0)}</p>
          </div>
          <div className="text-right">
            <p className="metric-value text-3xl text-[var(--pes-orange)]">{coveragePercent.toFixed(0)}%</p>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mt-1">Secured</p>
          </div>
        </div>
        <div className="h-3 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${coveragePercent}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[var(--pes-orange)] to-emerald-400" 
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <h3 className="px-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Sector Telemetry</h3>
            {Object.entries(data.category_analyses || {}).map(([cat, info]: [string, any], idx) => (
              <motion.div 
                 key={cat} 
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: idx * 0.1 }}
                 className="glass-card !bg-white !border-black/5 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-lg transition-all cursor-crosshair shadow-sm"
               >
                 <div className="flex items-center gap-6">
                    <div className="w-2 h-14 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || "#94a3b8", boxShadow: `0 0 10px ${CATEGORY_COLORS[cat] || "#94a3b8"}22` }} />
                    <div>
                       <h4 className="font-display font-black text-[var(--on-surface)] text-lg uppercase tracking-tight">{cat}</h4>
                       <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{info.total_items} ACTIVE ASSETS</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-3 gap-12 text-center md:text-left">
                    <div><p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-2">Live Units</p><p className="metric-value text-xl text-[var(--on-surface)]">{info.total_current_stock}</p></div>
                    <div><p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-2">Target Cap</p><p className="metric-value text-xl text-[var(--pes-orange)]">{info.total_recommended_stock}</p></div>
                    <div><p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-2">Commitment</p><p className="metric-value text-xl text-emerald-600">₹{info.total_spend_required.toLocaleString()}</p></div>
                 </div>
              </motion.div>
            ))}
        </div>

        <div className="section-tonal !p-5 md:!p-8 !bg-slate-50 border border-slate-100 rounded-[3rem] h-fit sticky top-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] flex items-center gap-3">
              <Radio size={16} className="text-rose-600 animate-pulse" /> Critical Hotlist
            </h3>
            <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-rose-100">Action Required</div>
          </div>
          <div className="space-y-4">
             {data.priority_reorder_list.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-white border border-black/5 hover:border-[var(--pes-orange)]/30 transition-all group shadow-sm">
                   <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-slate-200 group-hover:text-[var(--pes-orange)] transition-colors">{String(i+1).padStart(2, '0')}</span>
                      <div>
                        <p className="text-sm font-black text-[var(--on-surface)] leading-tight uppercase tracking-tighter truncate max-w-[120px]">{item.item_name}</p>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Urg: {Math.round(item.urgency_score)}%</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="metric-value text-xl text-rose-600 leading-tight">+{item.recommended_qty}</p>
                      <p className="text-[9px] font-black text-slate-200 uppercase mt-1 tracking-widest">Inbound</p>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetIntelligenceView({ item, analysis }: { item: InventoryItem; analysis: MASResponse }) {
  const radarData = [
    { metric: "PREDICTION",  value: Math.round((analysis.forecast_confidence || 0) * 100) },
    { metric: "DEMAND", value: Math.round((analysis.trend_modifier || 1) * 10) },
    { metric: "SAFETY",    value: Math.round((1 - Math.min(1, analysis.liquidity_ratio || 0)) * 100) },
    { metric: "PROFIT",    value: Math.min(100, Math.round((analysis.profit_impact || 0) / 20)) },
  ];

  const qtyData = [
    { name: "STOCK", qty: item.current_stock, fill: item.current_stock < 10 ? "#fb7185" : "#34d399" },
    { name: "TARGET", qty: analysis.recommended_qty, fill: "var(--pes-orange)" },
    { name: "USUAL", qty: item.usual_order_qty, fill: "#374175" },
  ];

  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-700">
      <div className="glass-card !bg-white !border-black/5 p-8 rounded-[3rem] flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden group shadow-sm">
        <div className="absolute top-0 left-0 w-2 h-full bg-[var(--pes-orange)]" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--pes-orange)] opacity-0 group-hover:opacity-5 blur-[100px] transition-opacity duration-1000" />
        <div>
           <h2 className="text-2xl md:text-3xl lg:text-4xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase mb-2 group-hover:translate-x-1 transition-transform">{item.item_name}</h2>
           <div className="flex items-center gap-6 mt-3">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-3">
                <Package size={14} className="text-[var(--pes-orange)]" /> {item.item_category} UNIT
              </span>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3",
                (analysis as any).is_working_day !== false ? "text-emerald-600" : "text-amber-600"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", (analysis as any).is_working_day !== false ? "bg-emerald-500" : "bg-amber-500")} />
                {(analysis as any).is_working_day !== false ? "Operational Window Open" : "Operational Pause"}
              </span>
           </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right hidden md:block">
             <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Sector Integrity</p>
             <p className={cn("metric-value text-xl uppercase tracking-tighter", analysis.risk_status === "Unsafe" ? "text-rose-600" : "text-emerald-600")}>
               {analysis.risk_status === "Unsafe" ? "Unstable Node" : "Optimal Path"}
             </p>
           </div>
           <div className={cn(
             "h-20 w-20 rounded-[2rem] flex items-center justify-center border transition-all duration-500 bg-slate-50",
             analysis.risk_status === "Unsafe" ? "border-rose-200 text-rose-600 shadow-sm" : "border-emerald-200 text-emerald-600 shadow-sm"
           )}>
             {analysis.risk_status === "Unsafe" ? <ShieldAlert size={40} className="animate-pulse" /> : <CheckCircle2 size={40} />}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Neural Forecast", value: analysis.recommended_qty, sub: "Optimum Volume", color: "text-[var(--pes-orange)]", icon: Zap, pulse: true },
            { label: "Integrity Index", value: `${Math.round(analysis.forecast_confidence*100)}%`, sub: "Confidence Rating", color: "text-emerald-600", icon: ShieldAlert, pulse: false },
            { label: "Market Drift", value: (analysis.trend_modifier || 1.0).toFixed(2) + "x", sub: "Velocity Alpha", color: "text-blue-600", icon: TrendingUp, pulse: false },
          ].map((m, idx) => (
            <motion.div 
               key={m.label} 
               initial={{ opacity: 0, y: 15 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.1 }}
               className="clay-card flex flex-col items-center text-center !p-10 group relative overflow-hidden"
            >
               {m.pulse && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
               <div className={cn("w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform", m.color)}>
                 <m.icon size={28} />
               </div>
               <div className="metric-value text-3xl md:text-4xl lg:text-5xl mb-2 text-[var(--on-surface)]">{m.value}</div>
               <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{m.label}</div>
               <div className="text-[8px] font-black uppercase text-[var(--text-muted)] opacity-60">{m.sub}</div>
            </motion.div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 glass-card !bg-white !border-black/5 p-10 shadow-sm">
           <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-12">Unit Saturation Telemetry</h4>
           <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={qtyData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 12 }} 
                      contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                      itemStyle={{ fontWeight: 'black', fontSize: '12px', color: 'var(--on-surface)' }}
                    />
                    <Bar dataKey="qty" radius={[8, 8, 8, 8]} barSize={50}>
                       {qtyData.map((e, index) => <Cell key={index} fill={e.fill} />)}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
        <div className="lg:col-span-2 glass-card !bg-white !border-black/5 p-10 shadow-sm">
           <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-12">Neural Attribution</h4>
           <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                 <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(0,0,0,0.05)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                    <Radar dataKey="value" stroke="var(--pes-orange)" fill="var(--pes-orange)" fillOpacity={0.15} />
                 </RadarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="bg-white border border-black/5 p-10 rounded-[3rem] shadow-xl relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-slate-50 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
             <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500"><Bot size={34} /></div>
               <div>
                  <h4 className="text-[var(--on-surface)] font-display font-black text-2xl tracking-tighter uppercase">Intelligence Output</h4>
                  <div className="flex items-center gap-3 mt-1"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm" /><p className="text-[var(--pes-orange)] text-[10px] uppercase font-black tracking-[0.3em]">Synthesized Feed Active</p></div>
               </div>
             </div>
             
             <div className="flex items-center gap-4">
                <div className={cn("px-6 py-3 rounded-2xl flex items-center gap-4 border font-black text-[10px] uppercase tracking-[0.3em] transition-all",
                    analysis.mdp_action === "APPROVE" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-rose-600 border-rose-200 bg-rose-50"
                )}>
                   <Zap size={18} className={analysis.mdp_action === "APPROVE" ? "text-emerald-600" : "text-rose-600"} />
                   <span>Directive: {analysis.mdp_action === "APPROVE" ? "Authorize" : "Override"}</span>
                </div>

                <ExecuteButton item={item} rec={analysis.recommended_qty} />
             </div>
          </div>

          <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 relative group-hover:border-slate-200 transition-all">
              <div className="absolute top-10 left-0 w-2 h-16 bg-[var(--pes-orange)] rounded-r-2xl transform -translate-x-1 group-hover:scale-y-125 transition-transform duration-500"></div>
              <p className="text-[var(--on-surface)] font-bold text-xl sm:text-2xl leading-relaxed pl-6 selection:bg-[var(--pes-orange)]">
                  {cleanAdviceText(analysis.explanation_english || "Calibrating neural array...")}
              </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
            <div className="flex gap-3">
               {analysis.trend_sources?.map(src => <span key={src} className="text-[10px] font-black px-4 py-2 rounded-xl bg-slate-100 text-[var(--pes-orange)] border border-slate-200 uppercase tracking-[0.2em]">{src}</span>)}
            </div>
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
              Liquidity Protocol: Verify Treasury Before Execution.
            </p>
          </div>
      </div>
    </div>
  );
}

function ExecuteButton({ item, rec }: { item: InventoryItem; rec: number }) {
  const { updateItem, addToast } = useAppStore();
  const [isApplying, setIsApplying] = useState(false);

  const handleExecute = async () => {
    setIsApplying(true);
    // Simulate network delay for "Sending Directive to Procurement"
    await new Promise(r => setTimeout(r, 1500));
    
    updateItem(item.id, { usual_order_qty: rec });
    addToast(`Directive Executed: ${item.item_name} target set to ${rec}`, "success");
    setIsApplying(false);
  };

  const isUpToDate = item.usual_order_qty === rec;

  return (
    <button 
      onClick={handleExecute}
      disabled={isApplying || isUpToDate}
      className={cn(
        "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all flex items-center gap-3",
        isUpToDate 
          ? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default" 
          : "bg-slate-900 text-white hover:bg-[var(--pes-orange)]",
        isApplying && "opacity-70 cursor-wait"
      )}
    >
      {isApplying ? (
        <>
          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span>Deploying...</span>
        </>
      ) : isUpToDate ? (
        <>
          <CheckCircle2 size={16} />
          <span>Aligned</span>
        </>
      ) : (
        <>
          <Zap size={16} />
          <span>Execute Directive</span>
        </>
      )}
    </button>
  );
}
