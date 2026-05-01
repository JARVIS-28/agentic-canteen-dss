"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { 
  Menu, X, Bell, User, Package, 
  BarChart2, CalendarDays, Settings, 
  LogOut, Terminal, ShoppingCart, Sparkles 
} from "lucide-react";
import NotificationSidebar from "@/components/NotificationSidebar";
import BackgroundAnalysisManager from "@/components/BackgroundAnalysisManager";
import { logout } from "@/lib/admin";
import { useAppStore } from "@/lib/store";
import { getInventory, getAdminMe } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const navItems = [
  { label: "Overview", href: "/overview", icon: Package },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  { label: "AI Analysis", href: "/analysis", icon: BarChart2 },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cashOnHand = useAppStore((state) => state.cashOnHand);
  const setCashOnHand = useAppStore((state) => state.setCashOnHand);
  const [isCashEditorOpen, setCashEditorOpen] = useState(false);
  const [cashInput, setCashInput] = useState(cashOnHand.toString());

  const unreadCount = useAppStore((state) => state.notifications.filter((n) => !n.read).length);

  const activePath = pathname === "/" ? "/overview" : pathname;
  const activeItem = useMemo(
    () => navItems.find((item) => activePath.startsWith(item.href)) ?? navItems[0],
    [activePath]
  );

  const isShellPage = pathname !== "/" && pathname !== "/admin" && !pathname.startsWith("/admin/login");

  const handleLogout = async () => {
    await logout().catch(() => {});
    router.push("/");
  };

  useEffect(() => {
    setCashInput(cashOnHand.toString());
  }, [cashOnHand]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (token && isShellPage) {
      const hydrateData = async () => {
        try {
          const adminData = await getAdminMe(token);
          if (adminData && adminData.id) {
            useAppStore.getState().setUserProfile({
              id: adminData.id,
              email: adminData.email || "",
              full_name: adminData.full_name || "",
              canteen_name: adminData.canteen_name || "PES Canteen",
              college_name: adminData.college_name || "PES EC Campus",
              city: adminData.city || "BENGALURU",
              language: adminData.language || "english",
              cash_on_hand: adminData.cash_on_hand ?? 5000, 
              created_at: adminData.created_at || new Date().toISOString()
            });
          }

          const invData = await getInventory(token);
          const mapped = invData.map((i: any) => ({
            ...i,
            id: i.id,
            item_name: i.item_name,
            current_stock: i.current_stock,
            unit_price: i.unit_price,
            usual_order_qty: i.usual_order_qty,
            item_category: i.item_category,
            is_perishable: i.is_perishable,
            analysis: i.analysis_result || null,
            status: i.analysis_result ? ("done" as const) : ("idle" as const)
          }));
          useAppStore.getState().setItems(mapped);
        } catch (error) {
          console.error("Failed to hydrate dashboard data:", error);
          if ((error as any).message?.includes("401") || (error as any).message?.includes("expired")) {
             handleLogout();
          }
        }
      };
      hydrateData();
    }
  }, [isShellPage]);

  const handleCashSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(cashInput);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setCashOnHand(parsed);
    setCashEditorOpen(false);
  };

  const handleCashCancel = () => {
    setCashInput(cashOnHand.toString());
    setCashEditorOpen(false);
  };

  if (!isShellPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-[var(--surface)] overflow-hidden font-sans selection:bg-[var(--pes-orange)] selection:text-white">
      <BackgroundAnalysisManager />
      
      {/* Sidebar - Integrated High-End Nav */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-[var(--surface-container-low)] border-r border-black/5 transition-transform duration-500 ease-[0.16,1,0.3,1] lg:static lg:translate-x-0 shrink-0 shadow-2xl lg:shadow-none",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-8 pb-12 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                P
              </div>
              <div className="leading-none">
                <p className="font-display font-black text-[var(--on-surface)] tracking-tighter text-2xl">CORE</p>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mt-1">Intelligence Hub</p>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-[var(--pes-orange)] transition-colors">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.href || (item.href !== "/overview" && activePath.startsWith(item.href));
              return (
                <Link 
                   key={item.href} 
                   href={item.href} 
                   className={cn(
                     "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                     isActive 
                       ? "bg-[var(--surface-container-highest)] text-[var(--pes-orange)] shadow-lg" 
                       : "text-[var(--text-secondary)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]"
                   )}
                >
                  {isActive && <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-[var(--pes-orange)] rounded-r-full" />}
                  <Icon size={20} className={cn(
                    "transition-transform duration-500 group-hover:scale-110",
                    isActive ? "text-[var(--pes-orange)]" : ""
                  )} />
                  <span className={cn(
                    "flex-1 text-sm font-bold tracking-wide",
                    isActive ? "font-black" : ""
                  )}>{item.label}</span>
                  {isActive && <Sparkles size={12} className="text-[var(--pes-orange)] animate-pulse" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-6 mt-auto">
             <div className="section-tonal !p-6 !rounded-[24px] mb-6 bg-[var(--surface-container-high)]">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Liquidity Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-[var(--on-surface)] tracking-tighter">₹{cashOnHand.toLocaleString("en-IN")}</span>
                  <span className="text-[10px] font-black text-emerald-600 mb-1">+2.4%</span>
                </div>
             </div>

            <button 
              className="w-full flex items-center justify-center gap-3 px-6 py-4 text-rose-500 font-black hover:bg-rose-50 rounded-2xl transition-all duration-300 uppercase tracking-widest text-[10px] border border-transparent hover:border-rose-100" 
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Terminate Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-400/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Sleek Integrated Header */}
        <header className="h-24 bg-white/50 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-8 sticky top-0 z-40 transition-all">
          <div className="flex items-center gap-6 flex-1">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-3 hover:bg-slate-100 rounded-2xl transition-colors"
            >
              <Menu size={24} />
            </button>
            
            {/* Omni-Intelligence Universal Search (Natural Language Querying) */}
            <div className="hidden md:flex items-center flex-1 max-w-xl group">
               <div className="relative w-full">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <Terminal size={18} className="text-[var(--pes-orange)] group-focus-within:animate-pulse" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ask Neural Hub... (e.g. 'Show low stock perishable items')" 
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-[1.25rem] pl-14 pr-12 text-base font-bold text-[var(--on-surface)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--pes-orange)]/10 focus:bg-white focus:border-[var(--pes-orange)]/30 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if (val.trim()) {
                          useAppStore.getState().addToast(`Neural Hub: Processing "${val.slice(0, 30)}..."`, "info");
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <div className="absolute inset-y-0 right-5 flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-black text-slate-400">⌘ K</kbd>
                  </div>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Temporal Reference */}
            <div className="hidden lg:flex flex-col items-end px-4 border-r border-black/5 leading-none">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">Temporal Sync</span>
              <span className="text-[10px] font-black text-[var(--on-surface)] uppercase tracking-wider">
                {format(new Date(), "EEEE, MMM do")}
              </span>
            </div>

            {/* Liquidity Editor (Trigger) */}
            <div className="relative group hidden sm:block">
              <button
                onClick={() => setCashEditorOpen((prev) => !prev)}
                className="flex items-center gap-4 px-6 py-3 bg-white border border-black/5 hover:border-[var(--pes-orange)]/30 rounded-2xl transition-all group shadow-sm"
              >
                <div className="text-right">
                  <span className="block text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] leading-none mb-1">Asset Status</span>
                  <span className="block text-xl font-black text-[var(--pes-orange)] leading-none tracking-tighter">₹{cashOnHand.toLocaleString("en-IN")}</span>
                </div>
              </button>
              
              {isCashEditorOpen && (
                <form 
                  className="absolute right-0 top-[calc(100%+12px)] w-80 clay-card !p-8 animate-in-card z-50 text-center shadow-2xl border-black/5 !bg-white"
                  onSubmit={handleCashSubmit}
                >
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-6 underline decoration-[var(--pes-orange)] decoration-2 underline-offset-4">Inject Liquidity</label>
                  <div className="flex items-center gap-2 mb-6 bg-slate-50 rounded-2xl p-4 border border-black/5 focus-within:border-[var(--pes-orange)]/50 transition-all">
                    <span className="text-[var(--text-secondary)] font-black text-xl">₹</span>
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-2xl font-black text-center text-[var(--on-surface)] w-full py-2"
                      value={cashInput}
                      onChange={(event) => setCashInput(event.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 btn-primary !py-4 !text-[10px]">Commit</button>
                    <button type="button" onClick={handleCashCancel} className="flex-1 btn-secondary !py-4 !text-[10px]">Cancel</button>
                  </div>
                </form>
              )}
            </div>
            
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative w-12 h-12 flex items-center justify-center text-[var(--on-surface)] bg-white border border-black/5 rounded-2xl hover:scale-105 transition-all shadow-sm"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center bg-[var(--pes-orange)] text-[8px] font-black text-white rounded-full ring-4 ring-white transform translate-x-1/4 -translate-y-1/4 shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
            <Link 
              href="/admin/settings"
              title="Identity & Settings"
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-black/5 p-[2px] hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-sm group/user relative"
            >
               <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center group-hover/user:bg-[var(--pes-orange)] group-hover/user:text-white transition-colors">
                 <User size={22} className="transition-all" />
               </div>
               {/* Tooltip hint */}
               <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/user:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                 Identity Node
               </span>
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-transparent scroll-smooth no-scrollbar p-4 md:p-8 lg:p-10">
          <div className="max-w-[1400px] mx-auto min-h-full pb-12">
            {children}
          </div>
        </main>
      </div>

      {isNotificationsOpen && <NotificationSidebar onClose={() => setNotificationsOpen(false)} />}
    </div>
  );
}
