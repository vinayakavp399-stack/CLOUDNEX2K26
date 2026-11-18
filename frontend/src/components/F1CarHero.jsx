import React, { useRef, useEffect, useState } from 'react';
import { Zap, Shield, ChevronRight, Phone, Gauge, Sparkles, Terminal, Activity, ArrowRight, Layers, Award, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────────────────────────────────────────────────
   Interactive Cyber Constellation & Packet-Stream Canvas
   Features:
   - Floating cloud telemetry data nodes
   - Dynamic network connections with packet streams
   - Subtle interactive mouse magnetic repulsion
   ───────────────────────────────────────────────────────────── */
function CyberTelemetryCanvas({ isLight }) {
  const ref = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, raf;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const darkColors = ['#00f5ff', '#38bdf8', '#818cf8', '#a5b4fc', '#67e8f9', '#c084fc'];
    const lightColors = ['#0284c7', '#0ea5e9', '#6366f1', '#3b82f6', '#06b6d4', '#8b5cf6'];
    const palette = isLight ? lightColors : darkColors;

    // Generate 65 dynamic nodes
    const NODES = Array.from({ length: 65 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 2.2 + 0.8,
      col: palette[Math.floor(Math.random() * palette.length)],
      baseAlpha: Math.random() * 0.5 + 0.35,
    }));

    // Data packets that travel along connection lines
    const PACKETS = Array.from({ length: 14 }, () => ({
      nodeA: Math.floor(Math.random() * NODES.length),
      nodeB: Math.floor(Math.random() * NODES.length),
      progress: Math.random(),
      speed: Math.random() * 0.008 + 0.004,
      col: palette[Math.floor(Math.random() * palette.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const mouse = mouseRef.current;

      // Draw connection lines between nearby nodes
      for (let i = 0; i < NODES.length; i++) {
        const a = NODES[i];
        for (let j = i + 1; j < NODES.length; j++) {
          const b = NODES[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 145) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = a.col;
            ctx.globalAlpha = (1 - dist / 145) * (isLight ? 0.24 : 0.18);
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }

        // Mouse connection line
        const mDist = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (mDist < 160) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = isLight ? '#0284c7' : '#00f5ff';
          ctx.globalAlpha = (1 - mDist / 160) * 0.35;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      // Draw animated travelling data packets
      PACKETS.forEach(p => {
        const nA = NODES[p.nodeA];
        const nB = NODES[p.nodeB];
        const dist = Math.hypot(nA.x - nB.x, nA.y - nB.y);

        if (dist < 160) {
          p.progress += p.speed;
          if (p.progress >= 1) {
            p.progress = 0;
            p.nodeA = Math.floor(Math.random() * NODES.length);
            p.nodeB = Math.floor(Math.random() * NODES.length);
          }
          const px = nA.x + (nB.x - nA.x) * p.progress;
          const py = nA.y + (nB.y - nA.y) * p.progress;

          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p.col;
          ctx.globalAlpha = isLight ? 0.85 : 0.95;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.col;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          p.nodeA = Math.floor(Math.random() * NODES.length);
          p.nodeB = Math.floor(Math.random() * NODES.length);
          p.progress = 0;
        }
      });

      // Draw and move nodes
      NODES.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) n.x = w;
        if (n.x > w) n.x = 0;
        if (n.y < 0) n.y = h;
        if (n.y > h) n.y = 0;

        // Subtle mouse repulsion
        const mDist = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        if (mDist < 100) {
          const angle = Math.atan2(n.y - mouse.y, n.x - mouse.x);
          n.x += Math.cos(angle) * 1.5;
          n.y += Math.sin(angle) * 1.5;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.col;
        ctx.globalAlpha = isLight ? 0.75 : 0.7;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isLight]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Hero — Modern, High-Tech, Beautiful & Animated
   ───────────────────────────────────────────────────────────── */
export default function F1CarHero({ onParticipantLogin, onAdminLogin, onGoToDashboard }) {
  const { user, isAuthenticated, isAdmin, teamId } = useAuth();
  const { isLight } = useTheme();

  return (
    <div className={`relative overflow-hidden min-h-screen flex flex-col transition-colors duration-300 ${
      isLight
        ? 'bg-gradient-to-b from-sky-50 via-slate-50 to-indigo-50/40 text-slate-900'
        : 'bg-[#030610] text-white'
    }`}>

      {/* ── Atmospheric Ambient Glowing Radial Lights ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {isLight ? (
          <>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-r from-sky-400/20 via-cyan-400/15 to-indigo-400/20 rounded-full blur-[110px]" />
            <div className="absolute bottom-10 left-10 w-[350px] h-[350px] bg-sky-300/15 rounded-full blur-[90px]" />
            <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-300/15 rounded-full blur-[90px]" />
            {/* Subtle Grid */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(rgba(14,165,233,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.06) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
          </>
        ) : (
          <>
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[550px] bg-gradient-to-r from-cyan-500/20 via-blue-600/15 to-indigo-600/20 rounded-full blur-[130px]" />
            <div className="absolute top-10 left-1/4 w-[400px] h-[300px] bg-cyan-400/12 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[350px] bg-indigo-500/15 rounded-full blur-[110px]" />
            {/* Cyber Grid Lines */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
          </>
        )}
      </div>

      {/* ── Concentric Cyber Sonar / Radar Rings Behind Title ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none" style={{ zIndex: 0 }}>
        {/* Ring 1 */}
        <div className={`w-[480px] h-[480px] sm:w-[650px] sm:h-[650px] rounded-full border border-dashed transition-all ${
          isLight ? 'border-sky-300/30' : 'border-cyan-400/20'
        }`} style={{ animation: 'spin 50s linear infinite' }} />
        {/* Ring 2 */}
        <div className={`absolute inset-10 rounded-full border transition-all ${
          isLight ? 'border-indigo-300/25' : 'border-indigo-500/20'
        }`} style={{ animation: 'spin 35s linear infinite reverse' }} />
        {/* Ring 3 */}
        <div className={`absolute inset-24 rounded-full border border-dotted transition-all ${
          isLight ? 'border-cyan-400/30' : 'border-cyan-300/15'
        }`} style={{ animation: 'spin 20s linear infinite' }} />
      </div>

      {/* ── Interactive Cyber Telemetry Canvas ── */}
      <CyberTelemetryCanvas isLight={isLight} />

      {/* ── Holographic Scan Sweep Line ── */}
      <div className="absolute inset-0 holo-scan pointer-events-none" style={{ zIndex: 1 }} />

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="relative z-10 flex flex-col flex-1 w-full pt-[76px] sm:pt-32 pb-3 sm:pb-10 px-3 sm:px-8 lg:px-12 justify-between">

        {/* ── TOP HEADER BADGE ── */}
        <div className="w-full flex items-center justify-center mb-1.5 sm:mb-6 px-3">
          <div className={`inline-flex items-center justify-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border backdrop-blur-md shadow-sm transition-all text-center ${
            isLight
              ? 'bg-white/85 border-sky-300 text-slate-700 shadow-sky-100'
              : 'bg-slate-950/75 border-cyan-500/30 text-slate-200 shadow-[0_0_15px_rgba(0,245,255,0.15)]'
          }`}>
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <div className="font-mono-code font-bold text-[9px] sm:text-[11px] tracking-wider sm:tracking-widest uppercase text-center flex items-center justify-center gap-1.5 shrink-0">
              <span className="whitespace-nowrap">IGNITRON 2K26</span>
              <span className="text-cyan-500">&bull;</span>
              <span className="whitespace-nowrap">GM UNIVERSITY</span>
              <span className="text-cyan-500 hidden sm:inline">&bull;</span>
              <span className="hidden sm:inline whitespace-nowrap">NATIONAL CLOUD HACKATHON</span>
            </div>
          </div>
        </div>

        {/* ── CENTRE: ANIMATED CLOUDNEX + NEXT GEN ENGINEERING + 2K26 ── */}
        <div className="flex flex-col items-center text-center my-auto py-1 sm:py-8 relative px-2">

          {/* Background Ambient Glow Behind Brand */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-28 sm:h-32 bg-cyan-400/25 blur-3xl pointer-events-none rounded-full" />

          {/* Animated CLOUDNEX Headline with Shimmer & Glowing Cyber Shadow */}
          <h1
            className={`font-race font-black text-3xl xs:text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-tight leading-none mb-1.5 sm:mb-4 select-none transition-all duration-300 hover:scale-[1.02] cursor-default`}
            style={{
              textShadow: isLight
                ? '0 10px 30px rgba(14,165,233,0.3), 0 0 45px rgba(56,189,248,0.2)'
                : '0 0 35px rgba(0,245,255,0.55), 0 0 70px rgba(99,102,241,0.35)',
            }}
          >
            <span className={isLight ? 'text-slate-900' : 'text-white'}>CLOUD</span>
            <span className={isLight ? 'text-gradient-blue' : 'text-gradient-cyan'}>NEX</span>
          </h1>

          {/* Next-Gen Cloud Engineering with Animated Light Line */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-1.5 sm:mb-3 w-full max-w-xs sm:max-w-md relative px-2">
            <div className={`h-px flex-1 ${isLight ? 'bg-gradient-to-r from-transparent via-sky-500 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'}`} />
            <span className={`font-mono-code font-bold text-[9px] sm:text-xs tracking-[0.15em] sm:tracking-[0.35em] uppercase text-center ${isLight ? 'text-sky-700' : 'text-cyan-400 drop-shadow-[0_0_10px_rgba(0,245,255,0.6)]'}`}>
              Next-Gen Cloud Engineering
            </span>
            <div className={`h-px flex-1 ${isLight ? 'bg-gradient-to-r from-transparent via-sky-500 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'}`} />
          </div>

          {/* 2K26 Badge */}
          <div className="mb-2 sm:mb-6 animate-float">
            <span className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:px-4 sm:py-1.5 rounded-xl text-xs sm:text-base font-mono-code font-black tracking-widest border transition-all duration-300 shadow-xl ${
              isLight
                ? 'bg-gradient-to-r from-sky-100 to-indigo-100 text-sky-900 border-sky-300 shadow-sky-100'
                : 'bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-indigo-950/90 text-cyan-300 border-cyan-400/50 shadow-[0_0_25px_rgba(0,245,255,0.35)]'
            }`}>
              <Sparkles className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-cyan-400 animate-pulse" />
              <span>2K26</span>
              <Sparkles className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-400 animate-pulse" />
            </span>
          </div>

          {/* Championship Catchy Pitch */}
          <p className={`text-[10px] xs:text-[11px] sm:text-base font-sans max-w-2xl leading-relaxed px-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            A 3-lap competitive cloud engineering championship testing{' '}
            <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white'}>architecture design</strong>,{' '}
            <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white'}>live deployment</strong>, and{' '}
            <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white'}>crisis recovery</strong> under real-world pressure.
          </p>
        </div>

        {/* ── BOTTOM ROW: Login Options (Participant & Organizer) ── */}
        <div className="w-full mt-auto pt-1 sm:pt-6">
          {isAuthenticated ? (
            <div className="w-full max-w-xl mx-auto">
              <button
                id="btn-active-dashboard"
                onClick={onGoToDashboard}
                className={`group flex items-center justify-between p-2.5 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-md border shadow-xl transition-all duration-150 hover:-translate-y-1 active:scale-95 text-left w-full cursor-pointer ${
                  isLight
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 text-white border-emerald-400 shadow-emerald-200'
                    : 'neon-border-pulse bg-gradient-to-r from-emerald-900/80 via-cyan-900/80 to-slate-900/90 hover:from-emerald-600 hover:to-cyan-600 border-emerald-400/50'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white group-hover:scale-110 transition-all shrink-0">
                    <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-race font-black text-xs sm:text-sm tracking-wider text-white uppercase flex items-center gap-2">
                      <span>{isAdmin ? 'Race Control' : 'Enter Dashboard'}</span>
                      <span className="text-[8px] sm:text-[9px] font-mono-code px-1.5 py-0.5 bg-white/20 text-white rounded font-bold">ACTIVE</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-mono-code text-white/80 truncate">
                      {isAdmin ? 'Chief Steward' : user?.team_name || teamId}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:translate-x-1.5 transition-transform shrink-0 ml-2" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-6 w-full max-w-5xl mx-auto">
              {/* Participant Login */}
              <button
                id="btn-participant-login"
                onClick={onParticipantLogin}
                className={`group flex items-center justify-between p-2 sm:p-5 rounded-xl sm:rounded-2xl backdrop-blur-md border shadow-xl transition-all duration-150 hover:-translate-y-1 active:scale-95 text-left w-full cursor-pointer ${
                  isLight
                    ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white border-sky-400 shadow-sky-200 hover:shadow-sky-300'
                    : 'neon-border-pulse bg-gradient-to-r from-cyan-900/85 via-blue-900/85 to-slate-900/90 hover:from-cyan-600 hover:to-blue-600 border-cyan-400/40 text-white shadow-[0_0_20px_rgba(0,245,255,0.25)]'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 group-hover:bg-cyan-400 group-hover:text-black transition-all shrink-0">
                    <Zap className="w-4 h-4 sm:w-6 sm:h-6 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-race font-black text-[11px] sm:text-sm tracking-wider text-white uppercase flex items-center gap-1.5">
                      <span>Participant Login</span>
                      <span className="text-[7px] sm:text-[9px] font-mono-code px-1.5 py-0.5 bg-cyan-500/30 text-cyan-200 rounded font-bold shrink-0">TEAM</span>
                    </div>
                    <p className="text-[8px] sm:text-[11px] font-mono-code text-white/80 truncate">
                      Access challenge laps, blueprints &amp; telemetry
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-cyan-300 group-hover:text-white group-hover:translate-x-1.5 transition-transform shrink-0 ml-1.5" />
              </button>

              {/* Organizer Login */}
              <button
                id="btn-admin-login"
                onClick={onAdminLogin}
                className={`group flex items-center justify-between p-2 sm:p-5 rounded-xl sm:rounded-2xl backdrop-blur-md border shadow-md transition-all duration-150 hover:-translate-y-1 active:scale-95 text-left w-full cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-red-400 shadow-slate-100'
                    : 'bg-slate-950/80 hover:bg-slate-900/90 border-white/15 hover:border-red-500/50 shadow-slate-950'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
                  <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shrink-0 ${
                    isLight
                      ? 'bg-red-50 border border-red-200 text-red-600 group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white'
                      : 'bg-red-950/40 border border-red-500/40 text-red-400 group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white'
                  }`}>
                    <Shield className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`font-race font-black text-[11px] sm:text-sm tracking-wider uppercase flex items-center gap-1.5 ${
                      isLight ? 'text-slate-800' : 'text-white'
                    }`}>
                      <span>Organizer Login</span>
                      <span className={`text-[7px] sm:text-[9px] font-mono-code px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/30 text-red-300'
                      }`}>ADMIN</span>
                    </div>
                    <p className={`text-[8px] sm:text-[11px] font-mono-code truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Race Stewards, Problem Desk &amp; Marks Console
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 sm:w-5 sm:h-5 group-hover:translate-x-1.5 transition-transform shrink-0 ml-1.5 ${
                  isLight ? 'text-slate-400 group-hover:text-red-600' : 'text-slate-400 group-hover:text-red-400'
                }`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Ambient Gradient Fade ── */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: isLight 
            ? 'linear-gradient(to bottom, transparent, rgba(248,250,252,0.95))' 
            : 'linear-gradient(to bottom, transparent, #030610)', 
          zIndex: 5 
        }} 
      />
    </div>
  );
}
