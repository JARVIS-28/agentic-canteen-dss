"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/admin";
import { ArrowRight, Utensils, Shield, Sparkles, TrendingUp, Layers, ChefHat } from "lucide-react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";

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
    { title: "Predictive Forecasting", desc: "AI models trained on historic sales to accurately predict future demand and reduce daily waste.", icon: TrendingUp, color: "#ee8326" },
    { title: "Financial Shield", desc: "Real-time liquidity analysis blocking risky procurements and ensuring stable daily cash flow.", icon: Shield, color: "#374175" },
    { title: "Smart Portions", desc: "Track exact portion sizes and ingredient consumption to optimize recipes automatically.", icon: Utensils, color: "#8b8eaa" },
    { title: "Automated Supply", desc: "Seamless generation of purchase orders directly correlated to expected weekly output.", icon: Layers, color: "#ee8326" }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[var(--bg-main)] font-sans overflow-x-hidden selection:bg-[var(--pes-orange)] selection:text-white relative">
      
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
          <div className="w-12 h-12 bg-white text-black rounded-lg flex items-center justify-center font-bold text-lg">
            PES
          </div>
          <span className="font-bold tracking-tighter text-2xl hidden sm:block">Canteen System</span>
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
            Version 2.0
          </motion.div>
          
          <div className="overflow-hidden mb-6">
            <motion.h1 custom={2} initial="hidden" animate="visible" variants={textVariants} className="text-[12vw] sm:text-[10vw] md:text-8xl lg:text-[120px] font-black text-[var(--pes-blue-dark)] leading-[0.9] tracking-tighter">
              Enterprise <br/>
              <span className="text-[var(--pes-orange)] italic pr-4">Grade</span> Intelligence.
            </motion.h1>
          </div>

          <motion.p custom={3} initial="hidden" animate="visible" variants={textVariants} className="text-[var(--text-secondary)] text-lg md:text-2xl font-medium max-w-2xl leading-relaxed mt-8 mb-12 mix-blend-color-burn">
            Elevating campus dining through autonomous predictive modeling. We don&apos;t just manage stock; we orchestrate it.
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
            <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter max-w-2xl">
              Precision in every <span className="text-[#ee8326]">ingredient.</span>
            </h2>
            <p className="max-w-sm text-[#8b8eaa] text-lg font-medium">
              A sophisticated engine designed to eliminate manual tracking and enforce data-driven procurement.
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
                <f.icon size={48} color={f.color} className="mb-8 p-3 rounded-2xl bg-white/10 group-hover:scale-110 transition-transform duration-500" />
                <h3 className="text-2xl md:text-3xl font-bold mb-4">{f.title}</h3>
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
            <h2 className="text-5xl md:text-7xl lg:text-9xl font-black mb-8 tracking-tighter leading-none mt-20 md:mt-0">
              Ready?
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

