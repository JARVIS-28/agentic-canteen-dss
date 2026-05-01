"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Menu, X, Bell, User, Package,
  BarChart2, CalendarDays, Settings,
  LogOut, Search, ShoppingCart, Home,
  ChevronDown, TrendingUp
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
  { label: "Overview",    href: "/overview",        icon: Home },
  { label: "Inventory",   href: "/inventory",        icon: Package },
  { label: "Sales",       href: "/sales",            icon: ShoppingCart },
  { label: "AI Analysis", href: "/analysis",         icon: BarChart2 },
  { label: "Calendar",    href: "/calendar",         icon: CalendarDays },
  { label: "Settings",    href: "/admin/settings",   icon: Settings },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cashOnHand = useAppStore((s) => s.cashOnHand);
  const setCashOnHand = useAppStore((s) => s.setCashOnHand);
  const [isCashEditorOpen, setCashEditorOpen] = useState(false);
  const [cashInput, setCashInput] = useState(cashOnHand.toString());
  const unreadCount = useAppStore((s) => s.notifications.filter((n) => !n.read).length);

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

  useEffect(() => { setCashInput(cashOnHand.toString()); }, [cashOnHand]);
  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (token && isShellPage) {
      const hydrateData = async () => {
        try {
          const adminData = await getAdminMe(token);
          if (adminData?.id) {
            useAppStore.getState().setUserProfile({
              id: adminData.id,
              email: adminData.email || "",
              full_name: adminData.full_name || "",
              canteen_name: adminData.canteen_name || "Canteen IQ Hub",
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
            analysis: i.analysis_result || null,
            status: i.analysis_result ? ("done" as const) : ("idle" as const)
          }));
          useAppStore.getState().setItems(mapped);
        } catch (error) {
          console.error("Failed to hydrate:", error);
          if ((error as any).message?.includes("401") || (error as any).message?.includes("expired")) handleLogout();
        }
      };
      hydrateData();
    }
  }, [isShellPage]);

  const handleCashSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = Number(cashInput);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setCashOnHand(parsed);
    setCashEditorOpen(false);
  };

  if (!isShellPage) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)", fontFamily: "var(--font-body)" }}>
      <BackgroundAnalysisManager />

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[252px] flex flex-col transition-transform duration-500 ease-[0.16,1,0.3,1] lg:static lg:translate-x-0 shrink-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}
        style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-base)", boxShadow: "2px 0 20px rgba(0,0,0,0.06)" }}
      >
        <div className="flex flex-col h-full overflow-hidden">

          {/* Logo */}
          <div className="px-6 py-6 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-base)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
                style={{ background: "var(--pes-orange)", boxShadow: "0 4px 12px rgba(238,131,38,0.3)" }}>
                IQ
              </div>
              <div className="leading-none">
                <p className="font-black text-lg tracking-tight" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>Canteen IQ</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] mt-0.5" style={{ color: "var(--text-muted)" }}>Intelligence Hub</p>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1.5 rounded-lg transition-colors hover:bg-gray-100">
              <X size={18} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] px-3 mb-3" style={{ color: "var(--text-muted)" }}>Navigation</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.href || (item.href !== "/overview" && activePath.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-link", isActive && "active")}
                >
                  {isActive && (
                    <motion.div layoutId="activeNavIndicator" className="absolute left-0 top-[22%] bottom-[22%] w-[3px] rounded-r-full"
                      style={{ background: "var(--pes-orange)", boxShadow: "0 0 10px rgba(238,131,38,0.4)" }} />
                  )}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300",
                    isActive ? "shadow-sm" : ""
                  )}
                    style={{ background: isActive ? "rgba(238,131,38,0.12)" : "var(--bg-tonal)" }}
                  >
                    <Icon size={16} style={{ color: isActive ? "var(--pes-orange)" : "var(--text-muted)" }} />
                  </div>
                  <span className={cn("flex-1 text-sm", isActive ? "font-bold" : "font-semibold")}>{item.label}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pes-orange)" }} />}
                </Link>
              );
            })}
          </nav>

          {/* Bottom: Liquidity + Logout */}
          <div className="p-4" style={{ borderTop: "1px solid var(--border-base)" }}>
            <div className="p-4 rounded-2xl mb-3 relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--pes-orange-dim), rgba(55,65,117,0.06))", border: "1px solid rgba(238,131,38,0.12)" }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={12} style={{ color: "var(--pes-orange)" }} />
                <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Liquidity Score</p>
              </div>
              <p className="text-2xl font-black tracking-tight" style={{ color: "var(--pes-orange)", fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}>
                ₹{cashOnHand.toLocaleString("en-IN")}
              </p>
              <p className="text-[9px] font-bold mt-0.5" style={{ color: "var(--success)" }}>↑ Operational</p>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:opacity-80"
              style={{ background: "rgba(220,38,38,0.07)", color: "var(--error)", border: "1px solid rgba(220,38,38,0.12)" }}
              onClick={handleLogout}
            >
              <LogOut size={14} />
              Terminate Session
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Main Area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="pes-header">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden header-btn"
            >
              <Menu size={20} />
            </button>

            {/* Search */}
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Ask Neural Hub… (e.g. 'low stock items')"
                  className="w-full h-10 rounded-xl pl-11 pr-4 text-sm font-medium outline-none transition-all"
                  style={{
                    background: "var(--bg-tonal)",
                    border: "1px solid var(--border-base)",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-body)"
                  }}
                  onFocus={e => { e.target.style.borderColor = "var(--pes-orange)"; e.target.style.boxShadow = "0 0 0 3px var(--pes-orange-dim)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border-base)"; e.target.style.boxShadow = "none"; }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value;
                      if (val.trim()) {
                        useAppStore.getState().addToast(`Processing: "${val.slice(0, 30)}…"`, "info");
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date */}
            <div className="hidden lg:flex flex-col items-end pr-4" style={{ borderRight: "1px solid var(--border-base)" }}>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Temporal Sync</span>
              <span className="text-xs font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
                {format(new Date(), "EEE, MMM do")}
              </span>
            </div>

            {/* Cash chip */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setCashEditorOpen(p => !p)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl transition-all group"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-base)", boxShadow: "var(--shadow-xs)" }}
              >
                <div className="text-right">
                  <span className="block text-[9px] font-black uppercase tracking-[0.2em] leading-none mb-1" style={{ color: "var(--text-muted)" }}>Asset Status</span>
                  <span className="block text-base font-black leading-none" style={{ color: "var(--pes-orange)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    ₹{cashOnHand.toLocaleString("en-IN")}
                  </span>
                </div>
                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
              </button>
              {isCashEditorOpen && (
                <form className="cash-form" onSubmit={handleCashSubmit}>
                  <label className="text-xs font-black uppercase tracking-widest text-center block" style={{ color: "var(--text-muted)" }}>
                    Update Liquidity
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--bg-tonal)", border: "1px solid var(--border-base)" }}>
                    <span className="font-black text-xl" style={{ color: "var(--text-secondary)" }}>₹</span>
                    <input
                      autoFocus type="number" min={0}
                      value={cashInput}
                      onChange={e => setCashInput(e.target.value)}
                    />
                  </div>
                  <div className="cash-form-actions">
                    <button type="submit">Commit</button>
                    <button type="button" onClick={() => { setCashInput(cashOnHand.toString()); setCashEditorOpen(false); }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>

            {/* Bell */}
            <button onClick={() => setNotificationsOpen(true)} className="header-btn relative">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center text-[8px] font-black text-white rounded-full ring-2 ring-white"
                  style={{ background: "var(--pes-orange)" }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User */}
            <Link href="/admin/settings" title="Settings" className="header-btn">
              <User size={18} />
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto no-scrollbar" style={{ background: "var(--bg-base)", padding: "clamp(16px, 3vw, 28px)" }}>
          <div className="max-w-[1440px] mx-auto min-h-full pb-12">
            {children}
          </div>
        </main>
      </div>

      {isNotificationsOpen && <NotificationSidebar onClose={() => setNotificationsOpen(false)} />}
    </div>
  );
}
