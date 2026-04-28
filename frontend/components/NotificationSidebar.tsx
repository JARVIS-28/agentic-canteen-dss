"use client";

import { useAppStore } from "@/lib/store";
import { Notification } from "@/lib/types";
import { PackageMinus, AlertTriangle, TrendingUp, ShieldAlert, Coins, Bell, CheckCircle2, X } from "lucide-react";

// Adjusted colors for light mode high-contrast
const SEVERITY_COLOR = { 
  info: "#0ea5e9", // Sky 500
  warning: "#f59e0b", // Amber 500
  critical: "#ef4444" // Red 500
};

const TYPE_ICON: Record<Notification["type"], React.ReactNode> = {
  low_stock:         <PackageMinus size={14} />,
  out_of_stock:      <AlertTriangle size={14} />,
  high_demand:       <TrendingUp size={14} />,
  risk_alert:        <ShieldAlert size={14} />,
  profit_opportunity:<Coins size={14} />,
};

export default function NotificationSidebar({ onClose }: { onClose: () => void }) {
  const { notifications, markAllRead, markRead } = useAppStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[90] transition-all duration-500"
      />

      {/* Pristine Slate Panel */}
      <aside
        className="slide-in fixed inset-y-0 right-0 w-full sm:w-[400px] flex flex-col z-[100] bg-white border-l border-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex-none px-6 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex flex-col gap-1">
            <h2 className="text-slate-900 font-display font-black text-lg tracking-tight flex items-center gap-3">
              <div className="bg-[var(--pes-orange)] text-white p-2 rounded-xl shadow-lg shadow-orange-100">
                <Bell size={16} strokeWidth={2.5} />
              </div>
              Command Feed
            </h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
              {unreadCount > 0 ? `${unreadCount} Neural Signals Active` : "Synaptic Link Clear"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button 
                onClick={markAllRead}
                className="text-[9px] font-black uppercase tracking-widest bg-white text-slate-500 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center gap-2 border border-slate-100"
              >
                <CheckCircle2 size={12} /> Flush
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2.5 rounded-xl bg-white border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Notification Area - No scrollbar visible */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3 no-scrollbar bg-slate-50/30">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 gap-6 opacity-60">
              <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                <ShieldAlert size={28} className="text-slate-200" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] mb-2">Sector Quiet</p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">The central terminal detects no anomalous vectors in current canteen logic.</p>
              </div>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationCard key={n.id} n={n} onRead={() => markRead(n.id)} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-none px-6 py-5 bg-white border-t border-slate-100">
           <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-300 mb-4">Signal Classifications</div>
           <div className="flex flex-wrap gap-1.5">
             {(["out_of_stock", "low_stock", "high_demand", "risk_alert", "profit_opportunity"] as Notification["type"][]).map((t) => (
               <span key={t} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[8px] uppercase font-black text-slate-500 tracking-widest">
                 {TYPE_ICON[t]} <span className="opacity-80">{t.replace(/_/g, " ")}</span>
               </span>
             ))}
           </div>
        </div>
      </aside>
    </>
  );
}

function NotificationCard({ n, onRead }: { n: Notification; onRead: () => void }) {
  const isRead = n.read;
  
  return (
    <div
      onClick={onRead}
      className={`group relative overflow-hidden rounded-[1.25rem] p-4 cursor-pointer transition-all duration-300 border ${
        isRead 
          ? "bg-white border-slate-100 opacity-50" 
          : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200"
      }`}
    >
      {!isRead && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: SEVERITY_COLOR[n.severity] }} 
        />
      )}

      {/* Unread Signal Point */}
      {!isRead && (
        <div 
          className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full"
          style={{ background: SEVERITY_COLOR[n.severity], boxShadow: `0 0 8px ${SEVERITY_COLOR[n.severity]}` }} 
        />
      )}

      <div className="flex gap-4 items-start relative z-10 w-full">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300"
          style={{ 
            background: isRead ? '#f8fafc' : `${SEVERITY_COLOR[n.severity]}10`,
            borderColor: isRead ? '#f1f5f9' : `${SEVERITY_COLOR[n.severity]}20`,
            color: isRead ? '#94a3b8' : SEVERITY_COLOR[n.severity]
          }}
        >
          {TYPE_ICON[n.type]}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <h4 
            className="text-[8px] font-black uppercase tracking-[0.2em] mb-1.5 truncate"
            style={{ color: isRead ? '#94a3b8' : SEVERITY_COLOR[n.severity] }}
          >
            {n.title}
          </h4>
          
          <p className={`text-[13px] leading-relaxed mb-3 ${isRead ? 'text-slate-400' : 'text-slate-700 font-bold'}`}>
            {n.message}
          </p>
          
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[7px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md uppercase tracking-widest truncate max-w-[120px]">
              {n.item_name}
            </span>
            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              {new Date(n.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
