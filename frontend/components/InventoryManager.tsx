"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { 
  analyzeInventory, 
  getInventory, 
  addInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem, 
  recordSale,
  lookupProduct,
  lookupInventoryProduct,
  identifyBarcode
} from "@/lib/api";
import { InventoryItem } from "@/lib/types";
import { useWebSocketAnalysis } from "@/hooks/useWebSocketAnalysis";
import { motion } from "framer-motion";
import { LiveExecutionPanel } from "./LiveExecutionPanel";
import { CSVImportWizard } from "./CSVImportWizard";
import { CATEGORY_COLORS, PREDEFINED_CATEGORIES } from "@/lib/constants";
import { 
  FileText, 
  BarChart2, 
  Target, 
  TrendingUp, 
  ShieldAlert, 
  ClipboardList, 
  Package, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  ArrowRight,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  Barcode,
  Calendar,
  Radio
} from "lucide-react";
import { cn } from "@/lib/utils";


const CITIES = ["PES EC Campus"];

export default function InventoryManager() {
  const {
    items, cashOnHand, addItem, addItemWithId, removeItem, updateItemStock,
    updateItemStatus, setItemAnalysis, setActiveItem, setItems, addToast,
    horizonDays, setHorizonDays,
    isBatchAnalyzing, startBatchAnalysis, stopBatchAnalysis, batchProgress, batchTotal
  } = useAppStore();


  const router = useRouter();

  useEffect(() => {
    const loadInventory = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (token) {
        try {
          const data = await getInventory(token);
          const currentItems = useAppStore.getState().items;
          const mapped: InventoryItem[] = data.map((i: any) => {
            const existing = currentItems.find(curr => curr.id === i.id);
            let finalStatus: any = i.analysis_result ? "done" : "idle";
            if (existing && existing.status !== "idle") {
              finalStatus = existing.status;
            }
            return {
              ...i,
              analysis: i.analysis_result || null,
              status: finalStatus
            };
          });
          setItems(mapped);
        } catch (e) {
          console.error("Fetch inventory error", e);
        }
      }
    };
    loadInventory();
  }, [setItems]);

  const [form, setForm] = useState({
    item_name: "",
    unit_price: "",
    cost_price: "",
    usual_order_qty: "",
    cash_on_hand: "",
    user_location: "PES EC Campus",
    expiry_date: "",
    current_stock: "",
    item_category: "snacks",
    is_perishable: false,
    barcode: "",
    min_stock_level: "5"
  });

  const [formError, setFormError] = useState("");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null);
  const [useRealTime, setUseRealTime] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  const populateFromInventoryItem = (item: any, barcodeValue: string, toastMessage: string) => {
    addToast(toastMessage, "info");
    setSearchQuery(item.item_name || "");
    setForm({
      item_name: item.item_name || "",
      unit_price: (item.unit_price ?? 0).toString(),
      cost_price: (item.cost_price ?? item.unit_price ?? 0).toString(),
      usual_order_qty: ((item.usual_order_qty ?? item.reorder_threshold ?? 1)).toString(),
      cash_on_hand: (item.cash_on_hand ?? cashOnHand ?? 0).toString(),
      user_location: item.user_location || "PES EC Campus",
      expiry_date: item.expiry_date || "",
      current_stock: (item.current_stock ?? item.quantity ?? 0).toString(),
      item_category: item.item_category || "snacks",
      is_perishable: !!item.is_perishable,
      barcode: item.barcode || barcodeValue,
      min_stock_level: (item.min_stock_level || 5).toString()
    });
  };

  const { connect } = useWebSocketAnalysis({
    onResult: (result) => {
      if (analyzingItemId) {
        setItemAnalysis(analyzingItemId, result);
        setActiveItem(analyzingItemId);
      }
    },
    onDone: () => {
      setTimeout(() => setShowExecutionPanel(false), 1500);
      if (analyzingItemId) updateItemStatus(analyzingItemId, "done");
      setAnalyzingId(null);
      setAnalyzingItemId(null);
    },
    onError: (error) => {
      console.error("WS error:", error);
      if (analyzingItemId) updateItemStatus(analyzingItemId, "error");
      setAnalyzingId(null);
      setAnalyzingItemId(null);
    },
  });

  const handleIdentify = async (code: string) => {
    if (!code) {
      addToast("Enter barcode first", "warning");
      return;
    }
    setIdentifying(true);
    try {
      const data = await identifyBarcode({ code });
      const product = data.product;
      if (product) {
        setForm(prev => ({
          ...prev,
          item_name: product.item_name || prev.item_name,
          item_category: product.item_category || prev.item_category,
          unit_price: (product.unit_price || product.suggested_price || prev.unit_price).toString(),
          cost_price: (product.cost_price || (product.unit_price ? product.unit_price * 0.7 : prev.cost_price)).toString(),
          is_perishable: product.is_perishable ?? prev.is_perishable,
          expiry_date: product.expiry_date || prev.expiry_date
        }));
        addToast(`Identified: ${product.item_name}`, "success");
      }
    } catch (err: any) {
      addToast(err.message || "Identification failed", "error");
    } finally {
      setIdentifying(false);
    }
  };

  const handleAdd = async () => {
    if (!form.item_name.trim()) { setFormError("Enter item name"); return; }
    if (!form.unit_price || Number(form.unit_price) <= 0) { setFormError("Invalid sell price"); return; }
    
    const token = localStorage.getItem('admin_token');
    if (!token) { setFormError("Auth required"); return; }

    try {
      const backend_item = await addInventoryItem(token, {
        ...form,
        unit_price: Number(form.unit_price),
        cost_price: Number(form.cost_price || 0),
        usual_order_qty: Number(form.usual_order_qty || 1),
        cash_on_hand: Number(form.cash_on_hand || cashOnHand || 0),
        expiry_date: form.expiry_date || null,
        current_stock: Number(form.current_stock || 0),
        min_stock_level: Number(form.min_stock_level || 5),
      });

      addItemWithId({
        ...backend_item,
        cash_on_hand: Number(form.cash_on_hand || cashOnHand || 0),
      } as any);
      
      setForm({ 
        item_name: "", unit_price: "", cost_price: "", usual_order_qty: "", 
        cash_on_hand: "", user_location: "PES EC Campus", expiry_date: "",
        current_stock: "", item_category: "snacks", is_perishable: false, barcode: "",
        min_stock_level: "5"
      });
      setFormError("");
      addToast(`${backend_item.item_name} added!`, "success");
    } catch (e: any) {
      setFormError(e.message || "Failed to add product");
    }
  };


  const handleQuickUpdateAction = async (diff: number) => {
    if (!editingItem) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const newQty = Math.max(0, editingItem.current_stock + diff);
      await updateInventoryItem(token, editingItem.id, { current_stock: newQty });
      updateItemStock(editingItem.id, newQty);
      setEditingItem(prev => prev ? { ...prev, current_stock: newQty } : null);
      addToast(`Updated ${editingItem.item_name} stock`, "success");
    } catch (e: any) {
      addToast(e.message || "Failed to update", "error");
    }
  };

  const handleQuickUpdate = async () => {
    if (!editingItem) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const newQty = Math.max(0, editingItem.current_stock + editQty);
      await updateInventoryItem(token, editingItem.id, { current_stock: newQty });
      updateItemStock(editingItem.id, newQty);
      setEditingItem(null);
      setEditQty(0);
      addToast(`Stock for ${editingItem.item_name} updated`, "success");
    } catch (e: any) {
      addToast(e.message || "Failed to update", "error");
    }
  };

  const isStale = useCallback((item: InventoryItem): boolean => {
    if (!item.analysis || !item.last_analyzed_at || !item.last_updated) return true;
    return new Date(item.last_analyzed_at) < new Date(item.last_updated);
  }, []);

  const runSingleAnalysis = async (
    item: InventoryItem,
    showErrorToast = false
  ): Promise<boolean> => {
    updateItemStatus(item.id, "analyzing");
    try {
      const result = await analyzeInventory({
        item_id: item.id, item_name: item.item_name, unit_price: item.unit_price,
        usual_order_qty: item.usual_order_qty, current_stock: item.current_stock,
        item_category: item.item_category || "snacks", is_perishable: item.is_perishable,
        cash_on_hand: Number((item as any).cash_on_hand || cashOnHand || 5000), 
        user_location: item.user_location || "PES EC Campus",
        expiry_date: (item as any).expiry_date,
        horizon_days: useAppStore.getState().horizonDays,
        monthly_revenue: 50000 
      });
      setItemAnalysis(item.id, result);
      return true;
    } catch (error: any) {
      updateItemStatus(item.id, "error");
      if (showErrorToast) {
        addToast(
          error?.message || `AI analysis failed for ${item.item_name}`,
          "error"
        );
      }
      return false;
    }
  };

  const handleAnalyze = async (item: InventoryItem) => {
    if (isBatchAnalyzing) {
      addToast("Batch analysis is running. Stop it before single AI analysis.", "warning");
      return;
    }
    if (analyzingId) return;
    setAnalyzingId(item.id);
    await runSingleAnalysis(item, true);
    setAnalyzingId(null);
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchCat = filterCategory === "all" || i.item_category === filterCategory;
      const matchSearch = i.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || (i as any).barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, filterCategory, searchQuery]);

  const handleRunBatchAnalysis = () => {
    if (isBatchAnalyzing) {
      stopBatchAnalysis();
      addToast("Stopping batch analysis...", "warning");
      return;
    }

    if (analyzingId) {
      addToast("Please wait for current analysis to finish.", "warning");
      return;
    }

    const targets = filteredItems;
    if (targets.length === 0) {
      addToast("No items found for batch analysis.", "info");
      return;
    }

    startBatchAnalysis(targets.map(t => t.id));
    addToast(`Batch started: ${targets.length} items queued`, "success");
  };


  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    items.forEach(i => {
      const cat = i.item_category || "snacks";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]);
  }, [items]);

  const advisorySummary = useMemo(() => ({
    drifted: items.filter(isStale).length,
    lowStock: items.filter(i => i.current_stock < (i.min_stock_level || 5)).length,
    highRisk: items.filter(i => i.analysis?.risk_status !== "Safe").length
  }), [items, isStale]);

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in-card">
      
      {/* Planetary Intel Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-5 relative overflow-hidden group bg-white shadow-sm border-black/5">
           <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 blur-[40px] rounded-full" />
           <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-1">Drift Parity</p>
           <h3 className="text-lg md:text-xl font-display font-black text-[var(--on-surface)]">{advisorySummary.drifted} <span className="text-[var(--text-secondary)] text-[10px] font-medium">Out-of-Sync</span></h3>
           <button onClick={() => {}} className="mt-4 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-[var(--on-surface)] rounded-xl text-[8px] font-black uppercase tracking-[0.2em] border border-black/5 flex items-center gap-3 transition-all">
             <RefreshCw size={14} className="text-[var(--pes-orange)]" /> Synchronize Neural Drift
           </button>
        </div>
        <div className="glass-card p-5 relative overflow-hidden group bg-white shadow-sm border-black/5">
           <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 blur-[40px] rounded-full" />
           <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-1">Fleet Availability</p>
           <h3 className="text-lg md:text-xl font-display font-black text-[var(--on-surface)]">{advisorySummary.lowStock} <span className="text-[var(--text-secondary)] text-[10px] font-medium">Critical Depletion</span></h3>
           <div className="mt-6 flex gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < 3 ? "bg-[var(--pes-orange)] shadow-[0_0_10px_rgba(255,165,0,0.2)]" : "bg-slate-100")} />
              ))}
           </div>
        </div>
        <div className="section-tonal !p-5 relative overflow-hidden group border border-black/5 bg-[var(--surface-container-high)]">
           <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-125 transition-transform duration-1000 rotate-12"><AlertTriangle size={96} className="text-[var(--on-surface)]" /></div>
           <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.3em] mb-1">Neural Alert Vector</p>
           <h3 className="text-lg md:text-xl font-display font-black text-[var(--on-surface)]">{advisorySummary.highRisk} <span className="text-[var(--on-surface)]/30 text-[10px] font-medium">Active Anomalies</span></h3>
           <p className="text-[8px] font-black text-[var(--on-surface)]/40 mt-4 uppercase tracking-widest flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
             Anomalous Supply Logic Detected
           </p>
        </div>
      </div>

      {/* Operations Console */}
      <div className="glass-card p-5 md:p-8 bg-white shadow-sm border-black/5">
        <div className="flex flex-col xl:flex-row gap-6 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--pes-orange)] transition-colors" size={20} />
            <input 
              type="text" placeholder="Access central inventory stream..."
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-16 pr-6 py-4 text-sm font-bold text-[var(--on-surface)] placeholder:text-slate-300 focus:outline-none focus:border-[var(--pes-orange)]/50 focus:bg-white transition-all shadow-inner"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full xl:w-auto overflow-x-auto no-scrollbar pb-2 xl:pb-0">
             <button
               onClick={handleRunBatchAnalysis}
               className={cn(
                 "flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border whitespace-nowrap",
                 isBatchAnalyzing
                   ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                   : "bg-[var(--pes-orange)] text-white border-[var(--pes-orange)]/50 shadow-[0_0_20px_rgba(255,165,0,0.2)] hover:scale-105"
               )}
             >
               <Zap size={18} fill={isBatchAnalyzing ? "white" : "none"} /> {isBatchAnalyzing ? "Interrupt Sync" : "Neural Batch Run"}
             </button>
             <button onClick={() => setShowCSVImport(true)} className="flex-1 md:flex-none btn-secondary !bg-slate-50 !border-slate-100 hover:!bg-white">
               <Plus size={18} /> Logic Import
             </button>
          </div>
        </div>

        {(isBatchAnalyzing || batchProgress > 0) && batchTotal > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Synapse Propagation ({isBatchAnalyzing ? "Transmitting" : "Held"})</p>
              <p className="text-[10px] font-black text-[var(--pes-orange)] uppercase tracking-widest">{batchProgress} <span className="text-slate-300">/ {batchTotal} NODES</span></p>
            </div>
            <div className="h-3 w-full bg-slate-200/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[var(--pes-orange)] to-rose-500 transition-all shadow-[0_0_15px_rgba(238,131,38,0.3)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (batchProgress / Math.max(1, batchTotal)) * 100)}%` }}
              />
            </div>
            <p className="mt-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Background persistence active. Sub-processes continue in restricted mode.
            </p>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mt-10 pt-8 border-t border-slate-100">
          <div className="flex gap-2 overflow-x-auto pb-4 lg:pb-0 no-scrollbar w-full lg:w-auto">
            {categories.map(([cat, count]) => (
              <button 
                key={cat} onClick={() => setFilterCategory(cat)}
                className={cn(
                  "whitespace-nowrap px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border",
                  filterCategory === cat ? "bg-white text-[var(--on-surface)] border-black/10 shadow-lg" : "bg-slate-50 text-[var(--text-muted)] border-slate-100 hover:bg-white hover:text-[var(--on-surface)]"
                )}
              >
                {cat} <span className="ml-2 opacity-50">[{count}]</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl w-full lg:w-auto border border-slate-100">
             <div className="px-4 flex items-center gap-3 text-[var(--text-muted)] border-r border-slate-200 mr-2">
                <CalendarDays size={16} className="text-[var(--pes-orange)]" /><span className="text-[10px] font-black uppercase tracking-widest">Horizon Depth</span>
             </div>
             <div className="flex gap-1.5 flex-1 lg:flex-none">
               {([{ label: "Today", val: 0 }, { label: "Tmrw", val: 1 }, { label: "Week", val: 7 }, { label: "Month", val: 30 }]).map((h) => (
                 <button
                  key={h.val} onClick={() => setHorizonDays(h.val)}
                  className={cn(
                    "flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    horizonDays === h.val ? "bg-white text-[var(--on-surface)] shadow-md border border-black/5" : "text-[var(--text-muted)] hover:text-[var(--on-surface)]"
                  )}
                 >{h.label}</button>
               ))}
             </div>
          </div>
        </div>
      </div>

      {/* Catalog Entry */}
      <div className="glass-card !p-12 !rounded-[3rem] border border-slate-100 bg-white shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--pes-orange)] opacity-[0.03] blur-[80px] rounded-full" />
        <h3 className="text-sm font-black text-[var(--on-surface)] uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
          <Plus size={24} className="text-[var(--pes-orange)]" /> Provision New Asset Node
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Node Identifier</label>
            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold text-[var(--on-surface)] focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all placeholder:text-slate-200" placeholder="e.g. CORE.FILTER_COFFEE_01" value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Market Value (₹)</label>
            <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold text-[var(--on-surface)] focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all" placeholder="20" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Procurement Basis (₹)</label>
            <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold text-[var(--on-surface)] focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all" placeholder="15" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
          </div>

          <div>
             <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Live Saturation</label>
             <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold text-[var(--on-surface)] focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all" placeholder="0" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} />
          </div>
          <div>
             <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Vector Qty (Default)</label>
             <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold text-[var(--on-surface)] focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all" placeholder="50" value={form.usual_order_qty} onChange={e => setForm(f => ({ ...f, usual_order_qty: e.target.value }))} />
          </div>
          <div>
             <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Sector Class</label>
             <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-[11px] font-black text-[var(--pes-orange)] uppercase tracking-widest focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all appearance-none cursor-pointer" value={form.item_category} onChange={e => setForm(f => ({ ...f, item_category: e.target.value }))}>
                {PREDEFINED_CATEGORIES.map(c => <option key={c} value={c} className="bg-white text-[var(--on-surface)]">{c.toUpperCase()}</option>)}
             </select>
          </div>
          <div className="md:col-span-2">
             <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Atmospheric Scan (Barcode)</label>
             <div className="flex gap-3">
                <input className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold text-[var(--on-surface)] focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all" placeholder="Signal Stream ID..." value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
                <button 
                  onClick={() => handleIdentify(form.barcode)}
                  disabled={identifying || !form.barcode}
                  className="bg-slate-900 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center gap-3 whitespace-nowrap disabled:opacity-30"
                >
                  {identifying ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  Scan Neural
                </button>
             </div>
          </div>

          <div>
             <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Expiration Vector</label>
             <input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-xs font-black text-[var(--on-surface)]/60 focus:outline-none focus:border-[var(--pes-orange)]/40 focus:bg-white transition-all" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          </div>
          <div className="flex flex-col">
             <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-3 block px-1">Bio-Stability</label>
             <button onClick={() => setForm(f => ({ ...f, is_perishable: !f.is_perishable }))} className={cn("w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border", form.is_perishable ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-[var(--text-muted)] border-slate-100")}>
               {form.is_perishable ? "Biologically Active" : "Inert / Stable"}
             </button>
          </div>
          <div className="md:col-span-2 flex items-end">
             <button onClick={handleAdd} className="w-full btn-primary !py-5">Submit to Terminal Registry</button>
          </div>
        </div>

        {formError && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-8 p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 text-rose-600"
          >
             <AlertCircle size={20} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">{formError}</span>
          </motion.div>
        )}
      </div>

      {/* Registry Stream */}
      <div className="space-y-6">
        <h2 className="text-[12px] font-black text-[var(--text-muted)] uppercase tracking-[0.5em] px-4 flex items-center gap-4">
           <ClipboardList size={20} className="text-[var(--pes-orange)]" /> Central Terminal Ledger
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map((item, idx) => (
            <motion.div 
              key={item.id} 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-6 md:p-8 !bg-white hover:shadow-xl transition-all group flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden border border-black/5"
            >
              {item.current_stock < (item.min_stock_level || 5) && <div className="absolute left-0 top-0 w-1 h-full bg-rose-500 animate-pulse" />}
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[var(--pes-orange)]/10 group-hover:text-[var(--pes-orange)] transition-all duration-500">
                  <Package size={32} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <h4 className="font-display font-black text-[var(--on-surface)] text-xl tracking-tight uppercase group-hover:translate-x-1 transition-transform">{item.item_name}</h4>
                    <span className="bg-slate-100 border border-slate-200 text-[var(--text-muted)] text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">{item.item_category}</span>
                    {item.is_perishable && <div className="w-2 h-2 rounded-full bg-rose-500" title="Perishable Asset" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-[11px] font-black tracking-[0.1em]">
                    <span className="text-[var(--on-surface)]">STOCK: <span className={cn(item.current_stock < 10 ? "text-rose-600" : "text-emerald-600")}>{item.current_stock}</span></span>
                    <span className="text-slate-200">|</span>
                    <span className="text-[var(--pes-orange)]">VAL: ₹{item.unit_price}</span>
                    {item.barcode && <span className="flex items-center gap-2 text-[var(--text-muted)]"><Barcode size={14} /> IDENT: {item.barcode}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto mt-6 md:mt-0">
                {item.analysis ? (
                  <div className="flex flex-1 md:flex-none items-center gap-6 bg-slate-50 border border-slate-100 p-4 rounded-2xl group/chip hover:border-[var(--pes-orange)]/30 transition-all">
                     <div className="text-right">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">Optimum Flow</p>
                        <p className="metric-value text-lg text-emerald-600">+{item.analysis.recommended_qty} UNITS</p>
                     </div>
                     <button onClick={() => { setActiveItem(item.id); router.push('/overview'); }} className="p-3 bg-white shadow-sm rounded-xl hover:bg-[var(--pes-orange)] hover:text-white transition-all"><Info size={20} /></button>
                  </div>
                ) : null}
                <button 
                  onClick={() => handleAnalyze(item)}
                  disabled={item.status === "analyzing"}
                  className={cn(
                    "flex-1 md:flex-none flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border",
                    item.status === "done" ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-[var(--text-muted)] border-slate-100 hover:border-[var(--pes-orange)]/50 hover:text-[var(--on-surface)]"
                  )}
                >
                  {item.status === "analyzing" ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : <Radio size={12} />}
                  {item.status === "done" ? "SYNCED" : "ENGAGE AI"}
                </button>
                <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-slate-50 border border-slate-100 flex-1 justify-center md:flex-none">
                  <TrendingUp size={12} className="text-[var(--pes-orange)]" />
                  <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Trending</span>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => setEditingItem(item)} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-[var(--text-muted)] hover:text-[var(--on-surface)] hover:border-[var(--pes-orange)]/50 transition-all">
                     <FileText size={16} />
                   </button>
                   <button onClick={() => setConfirmDeleteId(item.id)} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-[var(--text-muted)] hover:text-rose-600 hover:border-rose-500/50 transition-all">
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modals & Integrated Deletion */}
      
      {showCSVImport && (
        <CSVImportWizard 
          cashOnHand={cashOnHand} 
          userLocation="PES EC Campus" 
          onClose={() => { 
            setShowCSVImport(false); 
            getInventory(localStorage.getItem('admin_token')!).then(setItems); 
          }} 
        />
      )}

      {/* Deletion Isolation Chamber */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-8 animate-in fade-in duration-500">
           <div className="glass-card !p-12 max-w-md w-full !bg-white !border-slate-100 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-pulse" />
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
                <ShieldAlert size={40} />
              </div>
              <h4 className="text-3xl font-display font-black text-[var(--on-surface)] uppercase tracking-tighter mb-4">Confirm Annihilation</h4>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.3em] leading-relaxed mb-10">You are about to erase this asset from the core persistence matrix. This action is irreversible.</p>
              
              <div className="flex gap-4">
                 <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-5 rounded-2xl bg-slate-50 border border-slate-100 text-[var(--text-muted)] font-black text-[10px] uppercase tracking-widest hover:text-[var(--on-surface)] hover:bg-slate-100 transition-all">Abort</button>
                 <button 
                   onClick={() => { deleteInventoryItem(localStorage.getItem('admin_token')!, confirmDeleteId).then(() => { removeItem(confirmDeleteId); setConfirmDeleteId(null); }); }} 
                   className="flex-1 py-5 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:scale-105 active:scale-95 transition-all"
                 >
                   Confirm Deletion
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Overlay */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-8 animate-in fade-in duration-500">
           <div className="glass-card !p-12 max-w-xl w-full !bg-white !border-slate-100 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-900" />
              <div className="flex items-center justify-between mb-10">
                <h4 className="text-3xl font-display font-black text-[var(--on-surface)] uppercase tracking-tighter">Modulate Asset</h4>
                <button onClick={() => setEditingItem(null)} className="p-3 text-[var(--text-muted)] hover:text-[var(--on-surface)] transition-colors">
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                   <div>
                     <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Asset ID</p>
                     <p className="text-lg font-display font-black text-[var(--on-surface)] uppercase tracking-tight truncate max-w-[200px]">{editingItem.item_name}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Current Units</p>
                     <p className="metric-value text-3xl text-[var(--pes-orange)]">{editingItem.current_stock}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Inject Stock Offset</p>
                   <div className="flex items-center gap-4">
                     <input
                       type="number"
                       className="input-field flex-1 !bg-slate-50 !py-6 !text-2xl font-black text-center shadow-inner"
                       placeholder="00"
                       onChange={(e) => {
                         const val = parseInt(e.target.value);
                         if (!isNaN(val)) setEditQty(val);
                       }}
                     />
                     <button 
                        onClick={handleQuickUpdate}
                        className="btn-primary !h-full !px-8 !py-6"
                      >
                       COMMIT
                     </button>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleQuickUpdateAction(-1)} className="py-6 rounded-2xl bg-slate-50 border border-slate-100 text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all">- RECORD CONSUMPTION</button>
                  <button onClick={() => handleQuickUpdateAction(1)} className="py-6 rounded-2xl bg-slate-50 border border-slate-100 text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all">+ RECORD INTAKE</button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
