"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/admin";
import { ArrowRight, Utensils, Shield, Sparkles, TrendingUp, Layers, ChefHat, Zap, Brain, Activity } from "lucide-react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";

export default function HomePage() {
  const router = useRouter();
  const isAuth = isAuthenticated();
  const containerRef = useRef<HTMLDivElement>(null);
  const EASE_OUT = [0.16, 1, 0.3, 1] as const;

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const yHero = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.35], [1, 0]);

  const handleAction = () => router.push(isAuth ? "/overview" : "/admin");

  const textVariants: Variants = {
    hidden: { y: 32, opacity: 0 },
    visible: (c: number) => ({
      y: 0, opacity: 1,
      transition: { delay: c * 0.09, duration: 0.9, ease: EASE_OUT }
    })
  };

  const features = [
    {
      title: "Forecasting Engine",
      desc: "High-precision XGBoost-LGBM fusion predicting daily demand to optimize stock levels and minimize waste.",
      icon: TrendingUp,
      color: "#ee8326",
      bg: "#fff4ea",
      ref: "forecasting_agent.py"
    },
    {
      title: "Risk Intelligence",
      desc: "Automated financial guard blocking risky procurement to ensure stable operational cash flow.",
      icon: Shield,
      color: "#374175",
      bg: "#eef0fb",
      ref: "risk_agent.py"
    },
    {
      title: "Telemetry Core",
      desc: "Smart signal scout tracking weather and campus events for hyper-accurate demand sensing.",
      icon: Activity,
      color: "#059669",
      bg: "#ecfdf5",
      ref: "trend_agent.py"
    },
    {
      title: "Atomic Execution",
      desc: "Real-time architect synchronizing inventory and barcode parsing for instant operational updates.",
      icon: Zap,
      color: "#7c3aed",
      bg: "#f5f3ff",
      ref: "LiveExecutionPanel.tsx"
    },
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-screen overflow-hidden selection:bg-[#ee8326] selection:text-white"
      style={{ background: "var(--bg-base)", fontFamily: "var(--font-body)" }}
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(238,131,38,0.08) 0%, transparent 70%)", transform: "translate(20%, -20%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(55,65,117,0.08) 0%, transparent 70%)", transform: "translate(-20%, 20%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, #374175 1px, transparent 0)", backgroundSize: "36px 36px" }}
        />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5"
        style={{ background: "rgba(250,250,254,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md"
            style={{ background: "var(--pes-orange)" }}
          >
            IQ
          </div>
          <span className="font-black text-xl tracking-tight hidden sm:block" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
            Canteen IQ
          </span>
        </div>
        <button
          onClick={handleAction}
          className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm overflow-hidden transition-all duration-300 hover:shadow-lg"
          style={{ background: "var(--pes-blue-dark)", color: "#fff", fontFamily: "var(--font-body)" }}
        >
          <span>{isAuth ? "Dashboard" : "Sign In"}</span>
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-[100svh] flex items-center px-6 md:px-12 lg:px-20 z-10 pt-20">
        <motion.div style={{ y: yHero, opacity: opacityHero }} className="max-w-7xl w-full mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <div>
              <motion.div
                custom={1} initial="hidden" animate="visible" variants={textVariants}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8 border"
                style={{ background: "var(--pes-orange-dim)", color: "var(--pes-orange)", borderColor: "rgba(238,131,38,0.2)" }}
              >
                <Sparkles size={13} />
                Version 2.0 — Neural Link Active
                <span className="status-dot active ml-1" />
              </motion.div>

              <motion.p
                custom={2} initial="hidden" animate="visible" variants={textVariants}
                className="text-xs font-bold uppercase tracking-[0.25em] mb-5"
                style={{ color: "var(--text-muted)" }}
              >
                The authoritative command interface for canteen management
              </motion.p>

              <motion.h1
                custom={3} initial="hidden" animate="visible" variants={textVariants}
                className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.0] mb-6"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
              >
                Intelligent
                <br />
                <span style={{ color: "var(--pes-orange)" }}>Canteen</span>{" "}
                <span className="italic" style={{ color: "var(--pes-blue)" }}>OS.</span>
              </motion.h1>

              <motion.p
                custom={4} initial="hidden" animate="visible" variants={textVariants}
                className="text-lg leading-relaxed mb-10 max-w-lg font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Elevating campus dining through autonomous predictive modeling. Driven by ensemble AI, real-time telemetry, and adaptive risk intelligence.
              </motion.p>

              <motion.div custom={5} initial="hidden" animate="visible" variants={textVariants} className="flex items-center gap-4">
                <button
                  onClick={handleAction}
                  className="btn-primary"
                >
                  Enter Workspace
                  <ArrowRight size={16} />
                </button>
                <div className="flex items-center gap-3 pl-4" style={{ borderLeft: "1px solid var(--border-base)" }}>
                  <div className="flex -space-x-2">
                    {["#ee8326", "#374175", "#059669"].map((c, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    3 AI agents<br />always running
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Right: Visual Card */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.3, ease: EASE_OUT }}
              className="hidden lg:block"
            >
              <div className="glass-card p-8 relative" style={{ borderRadius: "var(--r-3xl)" }}>
                {/* Mock dashboard preview */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Hub Telemetry</p>
                    <h3 className="text-xl font-black" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Neural Operations</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "var(--success-dim)", color: "var(--success)" }}>
                    <span className="status-dot active" />
                    Live
                  </div>
                </div>

                {/* Mini KPI row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "Stock Items", val: "24", trend: "+12%", color: "var(--pes-orange)" },
                    { label: "AI Confidence", val: "98.4%", trend: "MAX", color: "var(--success)" },
                    { label: "Cash Flow", val: "₹12.5K", trend: "+8%", color: "var(--pes-blue)" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="p-3 rounded-2xl" style={{ background: "var(--bg-tonal)" }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>{kpi.label}</p>
                      <p className="text-lg font-black" style={{ color: kpi.color, letterSpacing: "-0.04em" }}>{kpi.val}</p>
                      <p className="text-[9px] font-bold" style={{ color: "var(--success)" }}>{kpi.trend}</p>
                    </div>
                  ))}
                </div>

                {/* Bar chart mock */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Predictive Stock Vector</p>
                  {["Rice", "Dal", "Sambar", "Coffee", "Bread"].map((item, i) => {
                    const pct = [85, 62, 90, 45, 73][i];
                    return (
                      <div key={item} className="flex items-center gap-3">
                        <span className="text-xs font-semibold w-14 shrink-0" style={{ color: "var(--text-secondary)" }}>{item}</span>
                        <div className="flex-1 h-2 rounded-full" style={{ background: "var(--bg-tonal)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.2, delay: 0.6 + i * 0.1, ease: EASE_OUT }}
                            className="h-full rounded-full"
                            style={{ background: i === 0 ? "var(--pes-orange)" : i === 2 ? "var(--success)" : "var(--pes-blue)" }}
                          />
                        </div>
                        <span className="text-xs font-bold w-9 text-right" style={{ color: "var(--text-primary)" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Orange glow accent */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-b-3xl"
                  style={{ background: "linear-gradient(90deg, transparent, var(--pes-orange), transparent)", opacity: 0.6 }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Stats Strip */}
      <section className="relative z-20 py-14 px-6 md:px-12" style={{ borderTop: "1px solid var(--border-base)", borderBottom: "1px solid var(--border-base)", background: "var(--bg-card)" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            // { val: "98.4%", label: "AI Accuracy" },
            { val: "3×", label: "Agents Always Running" },
            { val: "<2s", label: "Analysis Latency" },
            { val: "∞", label: "Demand Horizon" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: EASE_OUT }}
              className="text-center"
            >
              <p className="text-4xl font-black mb-1" style={{ color: "var(--pes-orange)", fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}>{s.val}</p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-20 py-28 px-6 md:px-12 lg:px-20" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "var(--pes-orange)" }}>Core Modules</p>
              <h2 className="text-4xl md:text-5xl font-black leading-none" style={{ letterSpacing: "-0.035em", color: "var(--text-primary)" }}>
                Precision in every
                <br />
                <span style={{ color: "var(--pes-orange)" }}>cycle.</span>
              </h2>
            </div>
            <p className="max-w-sm text-base font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              A multi-agent DSS architecture designed to eliminate waste and enforce data-driven procurement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, delay: i * 0.1, ease: EASE_OUT }}
                  className="group p-8 clay-card cursor-default relative overflow-hidden"
                  style={{ borderRadius: "var(--r-2xl)" }}
                >
                  <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${f.bg} 0%, transparent 70%)`, transform: "translate(30%, -30%)" }}
                  />
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
                      style={{ background: f.bg }}>
                      <Icon size={22} color={f.color} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                      style={{ background: "var(--bg-tonal)", color: "var(--text-muted)" }}>
                      {f.ref}
                    </span>
                  </div>
                  <h3 className="text-xl font-black mb-3 uppercase tracking-tight relative z-10" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{f.title}</h3>
                  <p className="text-sm font-medium leading-relaxed relative z-10" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                  <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-700" style={{ background: `linear-gradient(90deg, ${f.color}, transparent)` }} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Big CTA */}
      <section className="relative z-20 pb-24 px-6 md:px-12 lg:px-20" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
            className="relative overflow-hidden rounded-[2rem] p-12 md:p-16 text-center"
            style={{ background: "var(--pes-blue-dark)" }}
          >
            <ChefHat size={160} className="absolute -top-10 -right-10 rotate-12 pointer-events-none" style={{ color: "rgba(255,255,255,0.04)" }} />
            <Brain size={100} className="absolute -bottom-8 -left-8 -rotate-12 pointer-events-none" style={{ color: "rgba(255,255,255,0.04)" }} />

            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Ready to Deploy
            </p>
            <h2 className="text-5xl md:text-6xl font-black mb-4 text-white" style={{ letterSpacing: "-0.04em" }}>
              Get Smarter.
            </h2>
            <p className="text-base font-medium mb-10 max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
              Upgrade your canteen operations with neural intelligence. Predicted stock. Intercepted risk. Absolute visibility.
            </p>
            <button
              onClick={handleAction}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 hover:-translate-y-1"
              style={{ background: "var(--pes-orange)", color: "#fff", boxShadow: "0 10px 40px rgba(238,131,38,0.3)", fontFamily: "var(--font-body)" }}
            >
              Start Operating
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
