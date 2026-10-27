import React from 'react';
import { Zap, Shield, ChevronRight, Phone, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/hero.png';

export default function F1CarHero({ onParticipantLogin, onAdminLogin, onGoToDashboard }) {
  const { user, isAuthenticated, isAdmin, teamId } = useAuth();
  return (
    <div className="relative overflow-hidden min-h-screen flex flex-col">
      {/* Full-bleed CLOUDNEX hero image background */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="CLOUDNEX"
          className="w-full h-full object-cover object-center filter brightness-110 contrast-105"
        />
        {/* Soft bottom fade to blend with page background, keeping the image bright & vibrant */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-[#080a0f]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Content — Positioned cleanly at the outer bottom edges */}
      <div className="relative z-10 flex flex-col justify-end flex-1 w-full px-4 sm:px-8 lg:px-12 pb-8 pt-32">
        <div className="flex flex-col lg:flex-row items-end justify-between gap-6">

          {/* Left side bottom: Separate small boxes for Faculty and Student Coordinators */}
          <div className="flex flex-col gap-2 w-full sm:w-72 lg:w-80">
            <div className="text-[10px] font-race font-bold tracking-widest text-cyan-400 uppercase flex items-center space-x-1.5 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span>EVENT COORDINATORS</span>
            </div>

            {/* Separate Box 1: Faculty Coordinators */}
            <div className="rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 hover:border-amber-500/40 px-3 py-2 shadow-lg transition-all text-left w-full">
              <div className="text-[10px] font-mono-code text-slate-400 uppercase tracking-wider mb-1">
                Faculty Coordinators
              </div>
              <div className="space-y-1 font-mono-code text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-race font-bold text-xs text-white">Usha T M</span>
                  <a
                    href="tel:6361736961"
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 font-mono-code text-[11px] font-semibold transition-colors shrink-0"
                    title="Call Faculty Coordinator Usha T M"
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>63617 36961</span>
                  </a>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-race font-bold text-xs text-white">Pooja K R</span>
                  <a
                    href="tel:6363725690"
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 font-mono-code text-[11px] font-semibold transition-colors shrink-0"
                    title="Call Faculty Coordinator Pooja K R"
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>63637 25690</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Separate Box 2: Student Coordinators */}
            <div className="rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 hover:border-cyan-500/40 px-3 py-2 shadow-lg transition-all text-left w-full">
              <div className="text-[10px] font-mono-code text-slate-400 uppercase tracking-wider mb-1">
                Student Coordinators
              </div>
              <div className="space-y-1 font-mono-code text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 font-semibold font-race text-xs">Vinayak Pujar</span>
                  <a
                    href="tel:8088079573"
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 font-mono-code text-[11px] font-semibold transition-colors shrink-0"
                    title="Call Vinayak Pujar"
                  >
                    <Phone className="w-2.5 h-2.5 text-cyan-400" />
                    <span>80880 79573</span>
                  </a>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 font-semibold font-race text-xs">Darshan G M</span>
                  <a
                    href="tel:7676566133"
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 font-mono-code text-[11px] font-semibold transition-colors shrink-0"
                    title="Call Darshan G M"
                  >
                    <Phone className="w-2.5 h-2.5 text-cyan-400" />
                    <span>76765 66133</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right side bottom: Login options one by one as separate cards */}
          {/* Right side bottom: Login options one by one as separate cards */}
          <div className="flex flex-col gap-3 w-full sm:w-80 lg:w-96">
            <div className="text-[11px] font-race font-bold tracking-widest text-cyan-400 uppercase flex items-center justify-between px-1">
              <span>{isAuthenticated ? 'ACTIVE SESSION' : 'ACCESS COMPETITION DASHBOARD'}</span>
            </div>

            {isAuthenticated ? (
              <button
                id="btn-active-dashboard"
                onClick={onGoToDashboard}
                className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-900/80 via-cyan-900/80 to-slate-900/90 hover:from-emerald-600 hover:to-cyan-600 backdrop-blur-md border border-emerald-400/50 hover:border-emerald-300 shadow-xl shadow-emerald-950/60 hover:shadow-emerald-500/25 transition-all duration-75 transform hover:-translate-y-0.5 active:scale-95 text-left w-full cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 group-hover:scale-110 group-hover:bg-emerald-400 group-hover:text-black transition-all duration-75 shrink-0">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-race font-black text-sm tracking-wider text-white uppercase flex items-center space-x-2">
                      <span>{isAdmin ? 'Race Control' : 'Enter Dashboard'}</span>
                      <span className="text-[9px] font-mono-code px-1.5 py-0.5 bg-emerald-500/30 text-emerald-200 rounded">ACTIVE</span>
                    </div>
                    <p className="text-[10px] font-mono-code text-cyan-300 truncate max-w-[170px]">
                      {isAdmin ? 'Chief Steward' : user?.team_name || teamId}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-300 group-hover:text-white group-hover:translate-x-1 transition-all duration-75 shrink-0 ml-2" />
              </button>
            ) : (
              <>
                {/* Option 1: Participant Login */}
                <button
                  id="btn-participant-login"
                  onClick={onParticipantLogin}
                  className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-cyan-900/80 via-blue-900/80 to-slate-900/90 hover:from-cyan-600 hover:to-blue-600 backdrop-blur-md border border-cyan-400/40 hover:border-cyan-300 shadow-xl shadow-cyan-950/60 hover:shadow-cyan-500/25 transition-all duration-75 transform hover:-translate-y-0.5 active:scale-95 text-left w-full cursor-pointer"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 group-hover:bg-cyan-400 group-hover:text-black transition-all duration-75 shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="font-race font-black text-sm tracking-wider text-white uppercase flex items-center space-x-2">
                      <span>Participant Login</span>
                      <span className="text-[10px] font-mono-code px-1.5 py-0.5 bg-cyan-500/30 text-cyan-200 rounded">TEAM</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-cyan-300 group-hover:text-white group-hover:translate-x-1 transition-all duration-75 shrink-0 ml-2" />
                </button>

                {/* Option 2: Organizer Login */}
                <button
                  id="btn-admin-login"
                  onClick={onAdminLogin}
                  className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-900/90 backdrop-blur-md border border-white/15 hover:border-red-500/50 shadow-xl transition-all duration-75 transform hover:-translate-y-0.5 active:scale-95 text-left w-full cursor-pointer"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-center text-red-400 group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white transition-all duration-75 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="font-race font-black text-sm tracking-wider text-white uppercase flex items-center space-x-2">
                      <span>Organizer Login</span>
                      <span className="text-[10px] font-mono-code px-1.5 py-0.5 bg-red-500/30 text-red-300 rounded">ADMIN</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-red-400 group-hover:translate-x-1 transition-all duration-75 shrink-0 ml-2" />
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
