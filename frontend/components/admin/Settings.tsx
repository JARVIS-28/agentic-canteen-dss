"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  AlertTriangle, 
  CheckCircle2, 
  LogOut, 
  Sparkles, 
  Trash2, 
  User, 
  MapPin, 
  Languages, 
  Wallet,
  Clock,
  Calendar as CalendarIcon,
  Shield,
  Save
} from "lucide-react";
import { isAuthenticated, logout, deleteAccount } from "@/lib/admin";
import { AdminCalendar } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const STORAGE_KEY = "canteen_settings_v2";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EVENT_TYPE_OPTIONS = [
  { value: "holiday", label: "Holiday" },
  { value: "exam", label: "Exam Block" },
  { value: "event", label: "Campus Event" },
  { value: "other", label: "Other Info" },
];

const EVENT_TYPE_META: Record<string, { label: string; className: string }> = {
  holiday: { label: "Holiday", className: "bg-rose-50 border-rose-100 text-rose-600" },
  exam: { label: "Exam", className: "bg-amber-50 border-amber-100 text-amber-600" },
  event: { label: "Event", className: "bg-indigo-50 border-indigo-100 text-indigo-600" },
  other: { label: "Other", className: "bg-slate-50 border-slate-100 text-slate-600" },
};

function formatEventDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

const DEFAULT_CALENDAR: AdminCalendar = {
  semester: "SPRING 2026",
  working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  events: [],
  notes: "Operational rhythm synchronized with university schedule.",
};

type Settings = {
  open_time?: string;
  close_time?: string;
  breaks: { start: string; end: string }[];
  calendar: AdminCalendar;
};

const DEFAULT_SETTINGS: Settings = {
  open_time: "09:00",
  close_time: "17:00",
  breaks: [],
  calendar: DEFAULT_CALENDAR,
};

function mergeSettings(data?: Partial<Settings>): Settings {
  const base = data || {};
  const events = (base.calendar?.events || DEFAULT_CALENDAR.events).map((event, idx) => ({
    id:
      typeof (event as any).id === "string"
        ? (event as any).id
        : `${event.date || idx}-${Math.random().toString(36).slice(2, 6)}`,
    ...event,
  }));
  return {
    ...DEFAULT_SETTINGS,
    ...base,
    calendar: { ...DEFAULT_CALENDAR, ...(base.calendar || {}), events },
  };
}

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(value: Settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...value,
        calendar: {
          ...value.calendar,
          events: value.calendar.events.map(({ id, ...rest }) => rest),
        },
      })
    );
  } catch (e) {}
}

async function fetchJson(path: string, init?: RequestInit) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") : null;
  const headers = new Headers(init?.headers as any || {});
  if (token) headers.set("x-admin-token", token);
  const res = await fetch(API_BASE_URL + path, { ...(init || {}), headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default function Settings() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [newEvent, setNewEvent] = useState({ date: "", type: "holiday", label: "", details: "" });
  const [eventError, setEventError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [newBreakStart, setNewBreakStart] = useState("");
  const [newBreakEnd, setNewBreakEnd] = useState("");
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [editAdmin, setEditAdmin] = useState({
    full_name: "",
    canteen_name: "",
    college_name: "",
    city: "",
    language: "english" as "english" | "hindi" | "kannada",
    cash_on_hand: 0
  });
  const { setUserProfile, cashOnHand: storeCash, setCashOnHand } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/admin");
      return;
    }
    (async () => {
      try {
        const [data, meData] = await Promise.all([
           fetchJson("/admin/settings").catch(() => null),
           fetchJson("/admin/me").catch(() => null)
        ]);
        if (data) {
          const normalized = mergeSettings(data);
          setSettings(normalized);
          persistSettings(normalized);
        }
        if (meData) {
          setAdminInfo(meData);
          setEditAdmin({
            full_name: meData.full_name || "",
            canteen_name: meData.canteen_name || "",
            college_name: meData.college_name || "",
            city: meData.city || "",
            language: meData.language || "english",
            cash_on_hand: meData.cash_on_hand || 0
          });
        }
      } catch (e) {
        setSettings(DEFAULT_SETTINGS);
      }
    })();
  }, [router]);

  const updateProfile = async () => {
    setSaveStatus("saving");
    try {
      await fetchJson("/admin/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editAdmin)
      });
      setSaveStatus("saved");
      setAdminInfo((prev: any) => ({ ...prev, ...editAdmin }));
      setUserProfile({ ...editAdmin, id: adminInfo?.id, email: adminInfo?.email });
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("idle");
    }
  };

  const syncSettingsWithServer = async (payload: Settings) => {
    setSaveStatus("saving");
    try {
      await fetchJson("/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open_time: payload.open_time,
          close_time: payload.close_time,
          breaks: payload.breaks,
          calendar: {
            ...payload.calendar,
            events: payload.calendar.events.map(({ id, ...rest }) => rest),
          },
        }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("idle");
    }
  };

  const updateSettingsState = (updater: (prev: Settings) => Settings) => {
    setSettings((prev) => {
      const next = updater(prev);
      persistSettings(next);
      void syncSettingsWithServer(next);
      return next;
    });
  };

  const toggleDay = (day: string) => {
    updateSettingsState((prev) => {
      const isActive = prev.calendar.working_days.includes(day);
      const nextDays = isActive
        ? prev.calendar.working_days.filter((value) => value !== day)
        : [...prev.calendar.working_days, day];
      const orderedDays = DAYS.filter((dayOption) => nextDays.includes(dayOption));
      return {
        ...prev,
        calendar: { ...prev.calendar, working_days: orderedDays },
      };
    });
  };

  const updateTimes = (field: "open_time" | "close_time", value: string) => {
    updateSettingsState((prev) => ({ ...prev, [field]: value }));
  };

  const addBreak = () => {
    if (!newBreakStart || !newBreakEnd || newBreakStart >= newBreakEnd) return;
    updateSettingsState((prev) => ({
      ...prev,
      breaks: [...prev.breaks, { start: newBreakStart, end: newBreakEnd }],
    }));
    setNewBreakStart("");
    setNewBreakEnd("");
  };

  const removeBreak = (index: number) => {
    updateSettingsState((prev) => ({
      ...prev,
      breaks: prev.breaks.filter((_, idx) => idx !== index),
    }));
  };

  const handleAddEvent = () => {
    if (!newEvent.date || !newEvent.label.trim()) {
      setEventError("Date and description are required");
      return;
    }
    const payload = {
      ...newEvent,
      id: `${newEvent.date}-${Math.random().toString(36).slice(2, 5)}`,
    };
    setEventError("");
    setNewEvent({ date: "", type: "holiday", label: "", details: "" });
    updateSettingsState(prev => ({
      ...prev,
      calendar: { ...prev.calendar, events: [...prev.calendar.events, payload] }
    }));
  };

  const handleRemoveEvent = (id?: string) => {
    if (!id) return;
    const nextEvents = settings.calendar.events.filter((event) => event.id !== id);
    updateSettingsState(prev => ({
      ...prev,
      calendar: { ...prev.calendar, events: nextEvents }
    }));
  };

  const handleLogout = () => {
    logout();
    router.push("/admin");
  };

  const handleDeleteAccount = async () => {
    try {
      const ok = await deleteAccount();
      if (ok) router.push("/admin");
    } catch (e) {
      console.error("Failed to delete account:", e);
    }
  };

  const sortedEvents = useMemo(() => {
    return [...settings.calendar.events].sort((a, b) => {
      const left = a.date ? new Date(a.date).getTime() : 0;
      const right = b.date ? new Date(b.date).getTime() : 0;
      return left - right;
    });
  }, [settings.calendar.events]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-1000">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-2 rounded-full bg-[var(--pes-orange)] animate-pulse" />
             <span className="text-[10px] font-black text-[var(--pes-orange)] uppercase tracking-[0.3em]">Command Node Alpha</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase leading-none">
            Infrastructure Configuration
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
            Calibrate operational matrices and management identities.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn(
             "px-5 py-2.5 rounded-full border transition-all duration-500 flex items-center gap-3",
             saveStatus === "saving" ? "bg-slate-50 border-slate-200 text-slate-400" : 
             saveStatus === "saved" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
             "opacity-0"
          )}>
            {saveStatus === "saving" ? <Clock size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            <span className="text-[10px] font-black uppercase tracking-widest">
               {saveStatus === "saving" ? "Syncing Logic" : "Neural Sync OK"}
            </span>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Card */}
        <section className="lg:col-span-8 glass-card !p-6 md:!p-10 relative overflow-hidden bg-white border border-slate-100 shadow-sm">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--pes-orange)]/5 blur-[100px] pointer-events-none rounded-full" />
           
           <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                 <User size={24} />
              </div>
              <div>
                 <h3 className="text-xl md:text-2xl font-display font-black text-[var(--on-surface)] uppercase tracking-tight">Identity Management</h3>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Administrative authority profile</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Shield size={10} /> Full Legal Descriptor
                  </label>
                  <input
                    value={editAdmin.full_name}
                    onChange={e => setEditAdmin(prev => ({ ...prev, full_name: e.target.value }))}
                    className="input-field w-full !bg-slate-50 !py-4 uppercase !text-sm !font-bold"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Clock size={10} /> Unit ID
                  </label>
                  <input
                    value={editAdmin.canteen_name}
                    onChange={e => setEditAdmin(prev => ({ ...prev, canteen_name: e.target.value }))}
                    className="input-field w-full !bg-slate-50 !py-4 uppercase !text-sm !font-bold"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <MapPin size={10} /> Campus Node
                  </label>
                  <input
                    value={editAdmin.college_name}
                    onChange={e => setEditAdmin(prev => ({ ...prev, college_name: e.target.value }))}
                    className="input-field w-full !bg-slate-50 !py-4 uppercase !text-sm !font-bold"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <MapPin size={10} /> City Context
                  </label>
                  <input
                    value={editAdmin.city}
                    onChange={e => setEditAdmin(prev => ({ ...prev, city: e.target.value }))}
                    className="input-field w-full !bg-slate-50 !py-4 uppercase !text-sm !font-bold"
                    placeholder="e.g. BENGALURU"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Wallet size={10} /> Treasury Alpha (Cash)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={editAdmin.cash_on_hand}
                      onChange={e => setEditAdmin(prev => ({ ...prev, cash_on_hand: Number(e.target.value) }))}
                      className="input-field w-full !bg-slate-50 !py-4 !pl-8 !text-sm !font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Languages size={10} /> Linguistic Protocol
                  </label>
                  <div className="flex gap-2">
                    {(["english", "hindi", "kannada"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setEditAdmin((prev) => ({ ...prev, language: lang }))}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                          editAdmin.language === lang 
                            ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                        )}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
           </div>

           <div className="mt-10 flex justify-end">
              <button 
                onClick={updateProfile}
                disabled={saveStatus === "saving"}
                className="btn-primary !py-4 !px-10 flex items-center gap-3 active:scale-95 transition-transform"
              >
                <Save size={16} />
                Persist Profile
              </button>
           </div>
        </section>

        {/* Operational Card */}
        <section className="lg:col-span-4 space-y-8">
           <div className="glass-card !p-8 bg-white border border-slate-100 flex flex-col h-full">
              <div className="space-y-6 flex-1">
                 <div>
                    <h3 className="text-xl font-display font-black text-[var(--on-surface)] uppercase tracking-tight">Cycle Modulation</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Active operational windows</p>
                 </div>

                 <div className="grid grid-cols-7 gap-1">
                    {DAYS.map(day => {
                       const active = settings.calendar.working_days.includes(day);
                       return (
                          <button
                            key={day}
                            onClick={() => toggleDay(day)}
                            className={cn(
                               "h-12 flex items-center justify-center rounded-lg text-[9px] font-black transition-all border",
                               active ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-slate-50 text-slate-300 border-slate-100 hover:bg-slate-100"
                            )}
                          >
                             {day[0]}
                          </button>
                       )
                    })}
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Opening Pulse</label>
                       <input 
                        type="time" 
                        value={settings.open_time}
                        onChange={e => updateTimes("open_time", e.target.value)}
                        className="input-field w-full !bg-slate-50 !py-3 !text-sm border-slate-100"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Shutdown Spike</label>
                       <input 
                        type="time" 
                        value={settings.close_time}
                        onChange={e => updateTimes("close_time", e.target.value)}
                        className="input-field w-full !bg-slate-50 !py-3 !text-sm border-slate-100"
                       />
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-50">
                    <h4 className="text-[10px] font-black text-[var(--on-surface)] uppercase tracking-widest">Temporal Fractures (Breaks)</h4>
                    <div className="flex gap-2">
                       <input type="time" value={newBreakStart} onChange={e => setNewBreakStart(e.target.value)} className="input-field flex-1 !bg-slate-50 !py-2 !text-xs" />
                       <input type="time" value={newBreakEnd} onChange={e => setNewBreakEnd(e.target.value)} className="input-field flex-1 !bg-slate-50 !py-2 !text-xs" />
                       <button onClick={addBreak} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-colors"><Sparkles size={14}/></button>
                    </div>
                    
                    <div className="space-y-2">
                       {settings.breaks.map((b,i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <span className="text-[10px] font-bold text-slate-600">{b.start} — {b.end}</span>
                             <button onClick={() => removeBreak(i)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={12}/></button>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Global rhythm section */}
        <section className="lg:col-span-12 glass-card !p-10 bg-white border border-slate-100">
           <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
              <div className="space-y-2">
                 <h3 className="text-3xl font-display font-black text-[var(--on-surface)] uppercase tracking-tight">Matrix Rhythm</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global campus protocol events</p>
              </div>
              <div className="w-full md:w-64 space-y-2 text-right">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Semester Epoch</label>
                  <input 
                    value={settings.calendar.semester}
                    onChange={e => updateSettingsState(prev => ({ ...prev, calendar: { ...prev.calendar, semester: e.target.value.toUpperCase() } }))}
                    className="input-field w-full !bg-slate-50 !py-4 text-right pr-4 uppercase !text-lg !font-black !text-[var(--pes-orange)]"
                  />
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              <div className="space-y-6">
                 <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Inject Vector</h4>
                    <div className="space-y-4">
                       <select 
                          value={newEvent.type}
                          onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
                          className="input-field w-full !bg-white !py-3 !text-xs cursor-pointer"
                       >
                          {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                       </select>
                       <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} className="input-field w-full !bg-white !py-3 !text-xs" />
                       <input 
                        placeholder="DESCRIPTOR..." 
                        value={newEvent.label} 
                        onChange={e => setNewEvent(p => ({ ...p, label: e.target.value.toUpperCase() }))} 
                        className="input-field w-full !bg-white !py-3 !text-xs uppercase" 
                       />
                       <button onClick={handleAddEvent} className="btn-primary w-full !py-4 flex items-center justify-center gap-2 group">
                          Anchor <Sparkles size={12} className="group-hover:rotate-12 transition-transform" />
                       </button>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-2">System Broadcast Memo</label>
                    <textarea
                      value={settings.calendar.notes}
                      onChange={e => updateSettingsState(prev => ({ ...prev, calendar: { ...prev.calendar, notes: e.target.value } }))}
                      className="input-field w-full !bg-slate-50 !py-4 min-h-[150px] !text-xs leading-relaxed"
                      placeholder="Enter global operational notes..."
                    />
                 </div>
              </div>

              <div className="lg:col-span-3">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedEvents.length === 0 ? (
                       <div className="col-span-2 py-20 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                          <CalendarIcon size={40} strokeWidth={1} />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em]">Zero Vectors Detected</p>
                       </div>
                    ) : (
                       sortedEvents.map(ev => {
                          const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.other;
                          return (
                             <div key={ev.id} className="group relative p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                                <div className="flex justify-between items-start mb-6">
                                   <div className="space-y-2">
                                      <span className={cn("px-4 py-1 rounded-full text-[7px] font-black uppercase tracking-[0.2em] border", meta.className)}>
                                         {meta.label}
                                      </span>
                                      <h4 className="text-xl font-display font-black text-[var(--on-surface)] leading-none mt-2">{formatEventDate(ev.date)}</h4>
                                   </div>
                                   <button onClick={() => handleRemoveEvent(ev.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{ev.label}</p>
                             </div>
                          )
                       })
                    )}
                 </div>
              </div>
           </div>
        </section>

        {/* Danger Zone */}
        <section className="lg:col-span-12">
            <div className="glass-card !p-12 !border-rose-100 !bg-rose-50/30 relative overflow-hidden">
               <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="space-y-2">
                     <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-50 border border-rose-100 rounded-full text-rose-600 mb-2">
                        <AlertTriangle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Termination Zone</span>
                     </div>
                     <h3 className="text-3xl font-display font-black text-slate-900 uppercase tracking-tight">Erradicate Neural History</h3>
                     <p className="text-xs font-bold text-slate-400 max-w-xl leading-relaxed uppercase tracking-widest">
                        Permanent deletion of administrative authority, inventory data, and system logs. This action is irreversible.
                     </p>
                  </div>

                  {showDeleteConfirm ? (
                     <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                        <button 
                          onClick={handleDeleteAccount}
                          className="px-12 py-5 bg-rose-600 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-xl hover:bg-rose-700 transition-all active:scale-95"
                        >
                           Confirm Annihilation
                        </button>
                        <button onClick={() => setShowDeleteConfirm(false)} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Abort Sequence</button>
                     </div>
                  ) : (
                     <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-12 py-5 border border-rose-200 text-rose-600 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                     >
                        Terminate Node
                     </button>
                  )}
               </div>
            </div>
        </section>
      </div>

      <style jsx>{`
        .input-field {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .input-field:focus {
            background-color: white !important;
            border-color: var(--pes-orange) !important;
            box-shadow: 0 10px 30px rgba(238, 131, 38, 0.1);
        }
      `}</style>
    </div>
  );
}
