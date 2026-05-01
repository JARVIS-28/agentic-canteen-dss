"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/admin";
import { ArrowRight, Utensils, Shield, Sparkles, TrendingUp, Layers, ChefHat } from "lucide-react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import HeroVisual from "@/components/visuals/HeroVisual";

export default function HomePage() {
  const router = useRouter();
  const isAuth = isAuthenticated();
  const containerRef = useRef<HTMLDivElement>(null);

  const EASE_OUT = [0.16, 1, 0.3, 1] as const;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Parallax effects
  const yHero = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const yDetails = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  const handleAction = () => {
    if (isAuth) {
      router.push("/overview");
    } else {
      router.push("/admin");
    }
  };

  const navVariants: Variants = {
    hidden: { y: -20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: EASE_OUT } }
  };

  const textVariants: Variants = {
    hidden: { y: 40, opacity: 0 },
    visible: (custom: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: custom * 0.1, duration: 1, ease: EASE_OUT }
    })
  };

  const features = [
    { 
      title: "Forecasting Engine", 
      desc: "High-precision AI predicting daily demand to optimize stock levels and minimize food waste.", 
      icon: TrendingUp, 
      color: "#ee8326",
      ref: "forecasting_agent.py"
    },
    { 
      title: "Risk Intelligence", 
      desc: "Automated financial guard blocking risky procurement to ensure stable operational cash flow.", 
      icon: Shield, 
      color: "#374175",
      ref: "risk_agent.py"
    },
    { 
      title: "Telemetry Core", 
      desc: "Smart signal scout tracking weather and campus events for hyper-accurate demand sensing.", 
      icon: Utensils, 
      color: "#8b8eaa",
      ref: "trend_agent.py"
    },
    { 
      title: "Atomic Execution", 
      desc: "Real-time architect synchronizing inventory and barcode parsing for instant operational updates.", 
      icon: Layers, 
      color: "#ee8326",
      ref: "LiveExecutionPanel.tsx"
    }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[var(--bg-main)] font-sans overflow-x-hidden selection:bg-[var(--pes-orange)] selection:text-white relative">
      
      {/* ThreeJS Hero Visual */}
      <HeroVisual />

      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[var(--pes-orange)]/10 blur-[140px]" 
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[var(--pes-blue)]/5 blur-[150px]" 
        />
      </div>

      {/* Navigation */}
      <motion.nav 
        variants={navVariants}
        initial="hidden"
        animate="visible"
        className="fixed top-0 left-0 right-0 p-6 md:p-10 flex justify-between items-center z-50 mix-blend-difference"
      >
        <div className="flex items-center gap-4 text-white">
          <div className="w-12 h-12 bg-[var(--pes-orange)] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-[var(--pes-orange)]/20">
            IQ
          </div>
          <span className="font-display font-black tracking-tighter text-3xl hidden sm:block">Canteen IQ</span>
        </div>
        <button 
          onClick={handleAction}
          className="group relative px-6 md:px-8 py-3 rounded-full bg-white text-black font-semibold text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-105"
        >
          <div className="absolute inset-0 bg-[#ee8326] translate-x-[-100%] group-hover:translate-x-[0%] transition-transform duration-500 ease-[0.16,1,0.3,1] z-0" />
          <span className="relative z-10 group-hover:text-white transition-colors duration-300">
            {isAuth ? "Dashboard" : "Login"}
          </span>
        </button>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-[100svh] flex flex-col justify-center px-6 md:px-12 lg:px-24 z-10">
        <motion.div style={{ y: yHero, opacity: opacityHero }} className="max-w-7xl pt-20">
          <motion.div custom={1} initial="hidden" animate="visible" variants={textVariants} className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[var(--pes-blue)]/20 bg-white/40 backdrop-blur-xl mb-8 text-[var(--pes-blue-dark)] font-black text-xs uppercase tracking-[0.2em]">
            <Sparkles size={16} className="text-[var(--pes-orange)]" /> 
            Version 2.0 — Neural Link
          </motion.div>
          
          <div className="overflow-hidden mb-6">
            <motion.h1 custom={2} initial="hidden" animate="visible" variants={textVariants} className="text-[10vw] md:text-7xl lg:text-8xl font-black text-[var(--pes-blue-dark)] leading-[0.95] tracking-tighter uppercase">
              Intelligent <br/>
              <span className="text-[var(--pes-orange)] italic pr-4">Canteen</span> OS.
            </motion.h1>
          </div>

          <motion.p custom={3} initial="hidden" animate="visible" variants={textVariants} className="text-[var(--text-secondary)] text-lg md:text-2xl font-medium max-w-2xl leading-relaxed mt-8 mb-12 mix-blend-color-burn">
            Elevating campus dining through autonomous predictive modeling. Driven by XGBoost-LGBM fusion nodes and real-time telemetry.
          </motion.p>

          <motion.button 
            custom={4} initial="hidden" animate="visible" variants={textVariants}
            onClick={handleAction}
            className="group flex items-center gap-4 text-[var(--pes-blue-dark)] font-black uppercase tracking-widest text-lg hover:text-[var(--pes-orange)] transition-colors"
          >
            <span className="border-b-2 border-transparent group-hover:border-[var(--pes-orange)] transition-all pb-1">Enter Workspace</span>
            <div className="w-12 h-12 rounded-full border-2 border-[var(--pes-blue-dark)] group-hover:border-[var(--pes-orange)] flex items-center justify-center group-hover:translate-x-2 transition-all">
              <ArrowRight size={20} />
            </div>
          </motion.button>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="relative z-20 bg-[var(--pes-blue-dark)] text-[#eae5e6] py-32 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <h2 className="text-4xl md:text-6xl font-black leading-none tracking-tighter max-w-2xl uppercase">
              Precision in every <span className="text-[#ee8326]">cycle.</span>
            </h2>
            <p className="max-w-sm text-[#8b8eaa] text-lg font-medium">
              A multi-agent DSS architecture designed to eliminate waste and enforce data-driven procurement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group p-10 rounded-[2rem] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-500 overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="flex justify-between items-start mb-8">
                  <f.icon size={48} color={f.color} className="p-3 rounded-2xl bg-white/10 group-hover:scale-110 transition-transform duration-500" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{f.ref}</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 uppercase tracking-tight">{f.title}</h3>
                <p className="text-[#8b8eaa] font-medium leading-relaxed text-lg">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Big CTA Section */}
      <section className="relative z-20 bg-[var(--pes-blue-dark)] pb-32">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="w-full bg-[#ee8326] text-white rounded-[3rem] p-12 md:p-24 flex flex-col items-center text-center relative overflow-hidden"
          >
            <ChefHat size={120} className="absolute top-[-20%] right-[-5%] text-white/10 rotate-[15deg] pointer-events-none" />
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 tracking-tighter leading-none mt-20 md:mt-0 uppercase">
              Get Smarter.
            </h2>
            <button 
              onClick={handleAction}
              className="bg-[var(--pes-blue-dark)] text-white px-10 py-5 rounded-full font-bold text-xl uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-4 hover:shadow-2xl"
            >
              Start Operating <ArrowRight />
            </button>
          </motion.div>
        </div>
      </section>

    </div>
  );
}

