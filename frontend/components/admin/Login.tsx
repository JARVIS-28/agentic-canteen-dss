"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, isAuthenticated } from '../../lib/admin';
import { API_BASE_URL } from '../../lib/api';
import { cn } from '../../lib/utils';
import { LogIn, UserPlus, ShieldCheck, Brain, Zap, BarChart3, Fingerprint, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import HeroVisual from '../visuals/HeroVisual';

export default function Login() {
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [canteenName, setCanteenName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [success, setSuccess] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState<'english' | 'hinglish' | 'hindi'>('english');
  const [cashOnHand, setCashOnHand] = useState<number>(5000);

  useEffect(() => {
    if (isAuthenticated()) router.push('/overview');
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = mode === 'signup' ? signupEmail : loginEmail;
    const password = mode === 'signup' ? signupPassword : loginPassword;

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    
    if (mode === 'signup') {
      const payload = {
        full_name: fullName,
        canteen_name: canteenName,
        college_name: collegeName,
        manager_password: password,
        email: email,
        city: city || 'PES EC Campus',
        language: language,
        cash_on_hand: cashOnHand
      };
      const baseUrl = API_BASE_URL;
      if (!baseUrl) {
        setError('Backend URL missing, register not possible');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${baseUrl}/admin/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || 'Unable to register admin');
        }
        setSuccess('Registration successful! Logging you in...');
        const ok = await login(email, password);
        setLoading(false);
        if (ok) {
          router.push('/overview');
        } else {
          setMode('login');
        }
        return;
      } catch (err) {
        setLoading(false);
        setError((err as Error).message);
        return;
      }
    }
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      router.push('/overview');
      return;
    }
    setError('Invalid password. If this is a new account, use the system admin password.');
  };

  const switchToSignup = () => {
    setMode('signup');
    setError('');
    setSuccess('');
    setSignupEmail('');
    setSignupPassword('');
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-6 bg-[var(--surface)] selection:bg-[var(--pes-orange)] selection:text-white overflow-hidden relative">
      
      {/* ThreeJS Hero Visual */}
      <HeroVisual />

      {/* Background Neural Network Ambient Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--pes-orange)]/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse-slow" />
      </div>

      <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-12 lg:gap-24 items-center relative z-10">
        
        {/* Left Side: Celestial Architect Brand Showcase */}
        <motion.div 
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col justify-center text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-3 mb-6 bg-white/40 backdrop-blur-xl px-4 py-2 rounded-full border border-black/5 shadow-sm w-fit mx-auto lg:ml-0">
            <div className="w-2 h-2 rounded-full bg-[var(--pes-orange)] animate-ping" />
            <span className="text-xs font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">Neural Link Active — Node-01</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-display font-black text-[var(--on-surface)] tracking-tighter leading-[0.9] mb-6 uppercase">
            Canteen <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--pes-orange)] via-[#ff9b45] to-[var(--pes-orange)] bg-[length:200%_auto] animate-gradient-flow">Intelligence.</span>
          </h1>

          <p className="text-base font-bold text-[var(--text-muted)] leading-relaxed mb-10 max-w-xl mx-auto lg:ml-0 uppercase tracking-widest opacity-80">
            The authoritative command interface for hyper-scale canteen management. Predicted stock. Intercepted risk. Absolute visibility.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto lg:ml-0">
             <div className="glass-card !p-5 group hover:!border-[var(--pes-orange)]/20 transition-all duration-700 bg-white/60 backdrop-blur-md">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Brain size={20} />
                 </div>
                 <span className="text-[10px] font-black text-black/20 uppercase tracking-widest">forecasting_agent.py</span>
               </div>
               <h3 className="font-display font-black text-[var(--on-surface)] text-sm uppercase tracking-tight mb-2">Forecasting Engine</h3>
               <p className="text-xs font-bold text-[var(--text-muted)] leading-relaxed uppercase tracking-widest">High-precision AI predicting daily demand to optimize stock levels and minimize food waste.</p>
             </div>
             
             <div className="glass-card !p-5 group hover:!border-[var(--pes-orange)]/20 transition-all duration-700 bg-white/60 backdrop-blur-md">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 rounded-xl bg-[var(--pes-orange)]/10 text-[var(--pes-orange)] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck size={20} />
                 </div>
                 <span className="text-[10px] font-black text-black/20 uppercase tracking-widest">risk_agent.py</span>
               </div>
               <h3 className="font-display font-black text-[var(--on-surface)] text-sm uppercase tracking-tight mb-2">Risk Intelligence</h3>
               <p className="text-xs font-bold text-[var(--text-muted)] leading-relaxed uppercase tracking-widest">Automated financial guard blocking risky procurement to ensure stable operational cash flow.</p>
             </div>

             <div className="glass-card !p-5 group hover:!border-[var(--pes-orange)]/20 transition-all duration-700 bg-white/60 backdrop-blur-md">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BarChart3 size={20} />
                 </div>
                 <span className="text-[10px] font-black text-black/20 uppercase tracking-widest">trend_agent.py</span>
               </div>
               <h3 className="font-display font-black text-[var(--on-surface)] text-sm uppercase tracking-tight mb-2">Telemetry Core</h3>
               <p className="text-xs font-bold text-[var(--text-muted)] leading-relaxed uppercase tracking-widest">Smart signal scout tracking weather and campus events for hyper-accurate demand sensing.</p>
             </div>

             <div className="glass-card !p-5 group hover:!border-[var(--pes-orange)]/20 transition-all duration-700 bg-white/60 backdrop-blur-md">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap size={20} />
                 </div>
                 <span className="text-[10px] font-black text-black/20 uppercase tracking-widest">LiveExecutionPanel.tsx</span>
               </div>
               <h3 className="font-display font-black text-[var(--on-surface)] text-sm uppercase tracking-tight mb-2">Atomic Execution</h3>
               <p className="text-xs font-bold text-[var(--text-muted)] leading-relaxed uppercase tracking-widest">Real-time architect synchronizing inventory and barcode parsing for instant operational updates.</p>
             </div>
          </div>
        </motion.div>

        {/* Right Side: Authentication Node */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full lg:w-[500px] shrink-0"
        >
          <div className="glass-card !p-8 relative overflow-hidden shadow-2xl border-black/5 bg-white">
            {/* Focal Point Glow */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--pes-orange)]/5 blur-[100px] rounded-full" />
            
            <div className="relative z-10">
              {/* Authentication Mode Switch */}
              <div className="flex p-1 bg-slate-100 backdrop-blur-2xl rounded-[20px] mb-8 border border-black/5">
                <button 
                  onClick={switchToLogin}
                  className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${mode === 'login' ? 'bg-white text-[var(--on-surface)] shadow-md scale-105' : 'text-[var(--text-muted)] hover:text-[var(--on-surface)]'}`}
                >
                  <Fingerprint size={14} className={mode === 'login' ? 'text-[var(--pes-orange)]' : ''} />
                  Authorize
                </button>
                <button 
                  onClick={switchToSignup}
                  className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${mode === 'signup' ? 'bg-white text-[var(--on-surface)] shadow-md scale-105' : 'text-[var(--text-muted)] hover:text-[var(--on-surface)]'}`}
                >
                  <UserPlus size={14} className={mode === 'signup' ? 'text-[var(--pes-orange)]' : ''} />
                  Provision
                </button>
              </div>

              <div className="mb-6 text-center lg:text-left">
                <h2 className="text-3xl font-display font-black text-[var(--on-surface)] tracking-tighter uppercase leading-none mb-2">
                  {mode === 'login' ? 'Identity Verification' : 'Node Deployment'}
                </h2>
                <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
                  {mode === 'login' ? 'Insert credentials to engage command hub' : 'Register management identity into the network'}
                </p>
              </div>
              
              <form key={mode} onSubmit={submit} autoComplete={mode === 'signup' ? 'off' : 'on'} className="flex flex-col gap-6">
                {mode === 'signup' && (
                  <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                    <input type="text" name="hidden_username" autoComplete="username" tabIndex={-1} />
                    <input type="password" name="hidden_password" autoComplete="new-password" tabIndex={-1} />
                  </div>
                )}
                {mode === 'signup' && (
                  <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Descriptor (Full Name)</label>
                      <input
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        type="text"
                        placeholder="e.g. ASHA RAO"
                        className="input-field w-full !bg-slate-50 !py-3.5 uppercase placeholder:text-slate-300 border-slate-200 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Unit ID</label>
                        <input
                          value={canteenName}
                          onChange={e => setCanteenName(e.target.value)}
                          type="text"
                          placeholder="e.g. ARCADE-01"
                          className="input-field w-full !bg-slate-50 !py-3.5 uppercase placeholder:text-slate-300 border-slate-200 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Campus</label>
                        <input
                          value={collegeName}
                          onChange={e => setCollegeName(e.target.value)}
                          type="text"
                          placeholder="PES EC"
                          className="input-field w-full !bg-slate-50 !py-3.5 uppercase placeholder:text-slate-300 border-slate-200 text-xs"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">City Focus</label>
                        <input
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          type="text"
                          placeholder="BENGALURU"
                          className="input-field w-full !bg-slate-50 !py-3.5 uppercase placeholder:text-slate-300 border-slate-200 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Treasury Alpha</label>
                        <input
                          value={cashOnHand}
                          onChange={e => setCashOnHand(Number(e.target.value))}
                          type="number"
                          placeholder="5000"
                          className="input-field w-full !bg-slate-50 !py-3.5 uppercase placeholder:text-slate-300 border-slate-200 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Linguistic Protocol</label>
                      <div className="flex gap-2">
                        {['english', 'hinglish', 'hindi'].map(lang => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setLanguage(lang as any)}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all",
                              language === lang ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-[var(--text-muted)] border-slate-100 hover:border-slate-200"
                            )}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Communication Vector (Email)</label>
                  <input
                    value={mode === 'login' ? loginEmail : signupEmail}
                    onChange={e => mode === 'login' ? setLoginEmail(e.target.value) : setSignupEmail(e.target.value)}
                    type="email"
                    placeholder="manager@pes.edu"
                    className="input-field w-full !bg-slate-50 !py-3.5 border-slate-200 text-xs"
                    autoComplete={mode === 'login' ? "email" : "off"}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Neural Key (Password)</label>
                  <input
                    value={mode === 'login' ? loginPassword : signupPassword}
                    onChange={e => mode === 'login' ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="input-field w-full !bg-slate-50 !py-3.5 border-slate-200 text-xs"
                    autoComplete={mode === 'login' ? "current-password" : "new-password"}
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600"
                  >
                    <AlertTriangle size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                  </motion.div>
                )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600"
                  >
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{success}</span>
                  </motion.div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="group relative w-full bg-[var(--pes-orange)] text-white py-4 rounded-[20px] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-2 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {mode === 'login' ? 'ENGAGE SYSTEM' : 'CORE INJECTION'}
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
