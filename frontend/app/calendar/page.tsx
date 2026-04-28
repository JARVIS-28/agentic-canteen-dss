"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Upload, FileText, Filter, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { CalendarMeta } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

type CalendarEvent = {
  event_date: string;
  event_name: string;
  event_type: string;
  stream_type: string;
};

const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  holiday: { bg: "#fff7ed", text: "#b45309", border: "#fecaca", label: "Holiday" },
  exam: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd", label: "Exam" },
  festival: { bg: "#ecfccb", text: "#15803d", border: "#bef264", label: "Festival" },
  cultural: { bg: "#fdf4ff", text: "#9333ea", border: "#fbcfe8", label: "Cultural" },
  sports_day: { bg: "#ecfeff", text: "#0f766e", border: "#67e8f9", label: "Sports Event" },
  workshop: { bg: "#eef2ff", text: "#312e81", border: "#c7d2fe", label: "Workshop" },
  other: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", label: "Other" },
};

const MANUAL_EVENT_TYPE_OPTIONS = [
  { value: "Holiday", label: "Holiday" },
  { value: "Exam", label: "Exam" },
  { value: "Festival", label: "Festival" },
  { value: "Cultural", label: "Cultural Event" },
  { value: "Sports_Day", label: "Sports Event" },
  { value: "Workshop", label: "Workshop" },
  { value: "Other", label: "Other" },
];

const toIsoDate = (value?: Date | null) => {
  if (!value) return "";
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStreamStyle = (stream?: string, eventType?: string, isShared: boolean = false) => {
  const s = stream?.toLowerCase() || "";
  const t = eventType?.toLowerCase() || "";
  const eventKey = t.replace(/\s+/g, "_");
  
  if (isShared || s.includes("common") || s.includes("general") || t.includes("holiday") || t.includes("public")) {
    return { bg: "#fffbeb", text: "#b45309", border: "#fde68a" };
  }

  if (eventKey && EVENT_TYPE_STYLES[eventKey]) {
    return EVENT_TYPE_STYLES[eventKey];
  }

  if (s.includes("nursing")) return { bg: "#fdf2f8", text: "#be185d", border: "#fbcfe8" };
  if (s.includes("mbbs") || s.includes("medical") || s.includes("medicine"))
    return { bg: "#fff1f2", text: "#e11d48", border: "#fecdd3" };
  if (s.includes("pharma") || s.includes("b.pharm"))
    return { bg: "#f0fdfa", text: "#0d9488", border: "#99f6e4" };
  if (s.includes("btech") || s.includes("b.tech") || s.includes("engineering"))
    return { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" };
  if (s.includes("bsc") || s.includes("b.sc"))
    return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" };
  if (s.includes("bba") || s.includes("mba") || s.includes("management"))
    return { bg: "#fffaf3", text: "#c2410c", border: "#fed7aa" };
  if (s.includes("bca") || s.includes("mca") || s.includes("computer"))
    return { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" };
  
  return { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" };
};

const calendarEndpoint = (path: string) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);

export default function CalendarPage() {
  const [calendarMetas, setCalendarMetas] = useState<CalendarMeta[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("grid");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [manualEventForm, setManualEventForm] = useState({
    date: "",
    label: "",
    event_type: "Holiday",
    stream_type: "General",
  });
  const [manualState, setManualState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [manualMessage, setManualMessage] = useState("");

  const loadCalendarData = async () => {
    setStatus("loading");
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("admin_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [metaRes, eventsRes] = await Promise.all([
        fetch(calendarEndpoint("/admin/calendar"), { headers }),
        fetch(calendarEndpoint("/admin/calendar/events"), { headers }),
      ]);

      if (metaRes.ok) {
        const payload = await metaRes.json();
        setCalendarMetas(payload?.files || []);
      }
      
      if (eventsRes.ok) {
        const payload = await eventsRes.json();
        setEvents(payload || []);
      }
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load calendar data");
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  const handleUpload = async () => {
    if (!calendarFile) {
      setUploadState("error");
      setUploadMessage("Select a calendar PDF before uploading.");
      return;
    }
    setUploadState("uploading");
    const form = new FormData();
    form.append("file", calendarFile);
    const token = localStorage.getItem("admin_token");
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    
    try {
      const response = await fetch(calendarEndpoint("/admin/calendar/upload"), {
        method: "POST",
        body: form,
        headers,
      });
      if (!response.ok) throw new Error("Upload failed");
      setUploadState("success");
      setUploadMessage("Calendar processed successfully!");
      setCalendarFile(null);
      loadCalendarData();
    } catch (error) {
      setUploadState("error");
      setUploadMessage("Upload failed. Check format.");
    }
  };

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  }, [currentMonth]);

  const todayIso = toIsoDate(new Date());

  const changeMonth = (offset: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + offset);
    setCurrentMonth(next);
    setSelectedDate(null);
    setManualState("idle");
    setManualMessage("");
  };

  const availableStreamOptions = useMemo(() => {
    const collector = new Set<string>(calendarMetas.map(meta => meta.stream_type || "General"));
    collector.add("General");
    return Array.from(collector);
  }, [calendarMetas]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(ev => ev.event_date === selectedDate);
  }, [events, selectedDate]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return "";
    const localDate = new Date(`${selectedDate}T00:00:00`);
    return localDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }, [selectedDate]);

  const handleDateSelection = (dateStr?: string) => {
    if (!dateStr) return;
    setSelectedDate(dateStr);
    setManualEventForm(prev => ({ ...prev, date: dateStr }));
    setManualState("idle");
    setManualMessage("");
  };

  useEffect(() => {
    if (!selectedDate) {
      setManualEventForm(prev => ({ ...prev, date: "" }));
    }
  }, [selectedDate]);

  const handleManualEventSubmit = async () => {
    if (!manualEventForm.date) {
      setManualState("error");
      setManualMessage("Select a date first.");
      return;
    }
    if (!manualEventForm.label.trim()) {
      setManualState("error");
      setManualMessage("Provide an event name.");
      return;
    }
    setManualState("saving");
    setManualMessage("");

    try {
      const token = localStorage.getItem("admin_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["authorization"] = `Bearer ${token}`;
        headers["x-admin-token"] = token;
      }

      const response = await fetch(calendarEndpoint("/admin/calendar/events"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_date: manualEventForm.date,
          event_name: manualEventForm.label.trim(),
          event_type: manualEventForm.event_type,
          stream_type: (manualEventForm.stream_type || "General").trim() || "General",
        }),
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure?.detail || "Unable to save event");
      }

      await response.json();
      setManualEventForm(prev => ({ ...prev, label: "" }));
      setManualState("success");
      setManualMessage("Event saved to the campus calendar.");
      loadCalendarData();
    } catch (error) {
      setManualState("error");
      setManualMessage(error instanceof Error ? error.message : "Unable to save event");
    }
  };

  const sharedEventKeys = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    events.forEach(ev => {
      const key = `${ev.event_date}_${ev.event_name.toLowerCase().trim()}`;
      if (!counts[key]) counts[key] = new Set();
      counts[key].add(ev.stream_type);
    });
    
    const shared = new Set<string>();
    Object.entries(counts).forEach(([key, streams]) => {
      if (streams.size > 1) shared.add(key);
    });
    return shared;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 30);
  }, [events]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8 animate-in fade-in duration-500">
      
      {/* Hero Header */}
      <header className="bg-white border border-slate-200 p-6 lg:p-10 rounded-[2.5rem] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">Campus Radar</span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
               Live Sync
            </div>
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-2">Calendar Hub</h1>
          <p className="text-sm font-bold text-slate-400 max-w-lg leading-relaxed uppercase tracking-wider">
            Consolidated departmental intelligence & holiday tracking systems.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full lg:w-auto">
          <button 
            onClick={() => setViewMode(viewMode === "grid" ? "timeline" : "grid")}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            {viewMode === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
            {viewMode === "grid" ? "Timeline" : "Grid"}
          </button>
          <div className="hidden sm:flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl items-center justify-center">
            <CalendarDays size={32} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Toggle / Upload Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <section className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center justify-between">
               Active Streams
               <Filter size={16} className="text-slate-400" />
            </h2>
            
            <div className="space-y-3">
              {status === "error" && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                  <p className="text-[10px] font-black text-rose-600 uppercase mb-1">Database Sync Error</p>
                  <p className="text-xs font-bold text-rose-700">{errorMessage}</p>
                </div>
              )}
              
              {calendarMetas.length === 0 && status !== 'loading' && status !== 'error' ? (
                <div className="py-8 text-center text-slate-300 font-bold text-xs uppercase tracking-widest bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                  No calendars found
                </div>
              ) : (
                calendarMetas.map((meta, idx) => {
                  const style = getStreamStyle(meta.stream_type);
                  return (
                    <div key={idx} className="group relative p-4 rounded-2xl border transition-all hover:shadow-md overflow-hidden" style={{ borderColor: `${style.border}44`, backgroundColor: `${style.bg}50` }}>
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest truncate" style={{ color: style.text }}>{meta.stream_type || "General"}</span>
                        <a href={meta.public_url || "#"} target="_blank" className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0">
                           <FileText size={14} />
                        </a>
                      </div>
                      <p className="text-xs font-black text-slate-900 truncate mb-1">{meta.file_name}</p>
                      <p className="text-[10px] font-bold text-slate-400">Processed {new Date().toLocaleDateString()}</p>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingest New Schedule</h3>
              <div className="space-y-4">
                <div className="relative group cursor-pointer">
                   <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={(e) => setCalendarFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                   />
                   <div className={cn(
                     "flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all",
                     calendarFile ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                   )}>
                      {calendarFile ? <CheckCircle2 size={24} /> : <Upload size={24} />}
                      <span className="text-[11px] font-black mt-2 uppercase tracking-tight">{calendarFile ? calendarFile.name : "Select PDF File"}</span>
                   </div>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploadState === "uploading" || !calendarFile}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                >
                  {uploadState === "uploading" ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : "Process Intelligence"}
                </button>
                
                {uploadMessage && (
                   <div className={cn(
                     "p-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2",
                     uploadState === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                   )}>
                     {uploadState === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                     <span className="text-[10px] font-black uppercase tracking-widest leading-none">{uploadMessage}</span>
                   </div>
                )}
              </div>
            </div>
          </section>
        </aside>

        {/* Main Calendar View */}
        <main className="lg:col-span-9">
          {viewMode === "grid" ? (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Global Holidays Highlighted</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => changeMonth(-1)} className="flex-1 sm:flex-none p-3 bg-white hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all border border-slate-200"><ChevronLeft size={20} /></button>
                  <button onClick={() => setCurrentMonth(new Date())} className="flex-1 sm:flex-none px-6 py-3 text-xs font-black text-slate-900 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 uppercase tracking-widest">Today</button>
                  <button onClick={() => changeMonth(1)} className="flex-1 sm:flex-none p-3 bg-white hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all border border-slate-200"><ChevronRight size={20} /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 border-b border-slate-200">
                {["S", "M", "T", "W", "T", "F", "S"].map(d => (
                  <div key={d} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{d}</div>
                ))}
              </div>

              {/* Responsive Day Grid */}
              <div className="grid grid-cols-7 auto-rows-[minmax(80px,auto)] lg:auto-rows-[160px]">
                {monthDays.map((day, idx) => {
                  const dateStr = day ? toIsoDate(day) : undefined;
                  const dayEvents = dateStr ? events.filter(e => e.event_date === dateStr) : [];
                  const isToday = dateStr === todayIso;

                  return (
                    <div
                      key={idx}
                      role={dateStr ? "button" : undefined}
                      tabIndex={dateStr ? 0 : undefined}
                      onClick={dateStr ? () => handleDateSelection(dateStr) : undefined}
                      onKeyDown={dateStr ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleDateSelection(dateStr);
                        }
                      } : undefined}
                      className={cn(
                        "group border-r border-b border-slate-100 p-1 lg:p-3 transition-all hover:bg-slate-50/50 relative min-h-[80px]",
                        isToday && "bg-indigo-50/30",
                        dateStr === selectedDate && "ring-2 ring-indigo-500/60",
                        dateStr && "cursor-pointer"
                      )}
                    >
                      {day && (
                        <>
                          <span className={cn(
                            "text-xs lg:text-sm font-black mb-2 inline-flex items-center justify-center w-6 h-6 lg:w-8 lg:h-8 rounded-xl transition-all",
                            isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-400 group-hover:text-slate-900"
                          )}>
                            {day.getDate()}
                          </span>
                          <div className="mt-1 space-y-1 overflow-hidden">
                            {dayEvents.map((ev, eidx) => {
                               const eventKey = `${ev.event_date}_${ev.event_name.toLowerCase().trim()}`;
                               const isShared = sharedEventKeys.has(eventKey);
                               const style = getStreamStyle(ev.stream_type, ev.event_type, isShared);
                               return (
                                 <div key={eidx} className="group/item relative">
                                   <div 
                                     className="text-[10px] sm:text-[11px] px-2 py-1 lg:py-1.5 rounded-lg border truncate font-bold shadow-sm cursor-default"
                                     style={{ borderColor: `${style.border}88`, backgroundColor: style.bg, color: style.text }}
                                   >
                                     {isShared && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />}
                                     {ev.event_name}
                                   </div>
                                  {/* Tooltip on larger screens */}
                                  <div className="absolute hidden lg:group-hover/item:block z-50 bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl -top-2 left-full ml-3 w-48 shadow-2xl pointer-events-none border border-white/10 animate-in fade-in slide-in-from-left-2 duration-200">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.text }} />
                                       <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{ev.stream_type}</span>
                                    </div>
                                    <p className="font-bold text-xs leading-relaxed">{ev.event_name}</p>
                                    <div className="mt-2 flex items-center gap-1.5">
                                       <Info size={10} className="text-white/40" />
                                       <span className="text-[10px] font-black uppercase text-white/40">{ev.event_type}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingEvents.length === 0 ? (
                <div className="p-20 text-center bg-white border border-slate-200 rounded-[3rem] shadow-sm">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                     <CalendarDays size={48} />
                   </div>
                   <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No intelligence found</p>
                </div>
              ) : (
                upcomingEvents.map((event, idx) => {
                  const style = getStreamStyle(event.stream_type, event.event_type);
                  return (
                    <article 
                      key={idx} 
                      className="group bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:bg-slate-50 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1"
                      style={{ borderColor: `${style.border}44`, borderLeft: `8px solid ${style.text}` }}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white border border-slate-100" style={{ color: style.text, borderColor: `${style.border}88` }}>{event.stream_type}</span>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                           </span>
                        </div>
                        <h4 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">{event.event_name}</h4>
                      </div>
                      <span 
                        className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-inner bg-white border"
                        style={{ borderColor: `${style.border}88`, color: style.text }}
                      >
                        {event.event_type}
                      </span>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </main>

        <section className="lg:col-span-12">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm p-6 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Manual Event Registry</p>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  {selectedDate ? selectedDateLabel : "Select a date to add a custom event"}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDate
                    ? "Capture ad-hoc holidays, exams, or celebration days for that department."
                    : "Click a day above to pick a date for your manual entry."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setManualState("idle");
                  setManualMessage("");
                }}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600"
              >
                Clear selection
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Events on {selectedDate ? selectedDateLabel : "selected day"}
                </p>
                {selectedDate ? (
                  selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((ev) => {
                      const style = getStreamStyle(ev.stream_type, ev.event_type);
                      return (
                        <div
                          key={`${ev.event_name}-${ev.event_date}-${ev.stream_type}`}
                          className="flex items-center justify-between gap-4 border border-slate-200 rounded-2xl p-4"
                          style={{ borderColor: `${style.border}44`, backgroundColor: style.bg }}
                        >
                          <div>
                            <p className="text-sm font-black text-slate-900 leading-tight">{ev.event_name}</p>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{ev.stream_type || "General"}</p>
                          </div>
                          <span
                            className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border"
                            style={{ borderColor: `${style.border}88`, color: style.text }}
                          >
                            {ev.event_type}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">No events recorded for this date yet.</p>
                  )
                ) : (
                  <p className="text-sm text-slate-500">Pick a date above to inspect events or add one.</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {Object.values(EVENT_TYPE_STYLES).map((style) => (
                    <span
                      key={style.label}
                      className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border"
                      style={{ borderColor: `${style.border}88`, color: style.text, backgroundColor: style.bg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.text }} />
                      {style.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleManualEventSubmit();
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Department / Stream</label>
                      <input
                        list="calendar-dept-options"
                        value={manualEventForm.stream_type}
                        onChange={(event) => setManualEventForm(prev => ({ ...prev, stream_type: event.target.value }))}
                        placeholder="General"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <datalist id="calendar-dept-options">
                        {availableStreamOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Event Type</label>
                      <select
                        value={manualEventForm.event_type}
                        onChange={(event) => setManualEventForm(prev => ({ ...prev, event_type: event.target.value }))}
                        className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      >
                        {MANUAL_EVENT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Title</label>
                      <input
                        value={manualEventForm.label}
                        onChange={(event) => setManualEventForm(prev => ({ ...prev, label: event.target.value }))}
                        placeholder="Ex. Cultural Evening / Guest Lecture"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={manualState === "saving"}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-[12px] font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-indigo-200 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {manualState === "saving" ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    ) : null}
                    Add Event
                  </button>

                  {manualMessage && (
                    <div
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]",
                        manualState === "error" ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-600"
                      )}
                    >
                      {manualMessage}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

