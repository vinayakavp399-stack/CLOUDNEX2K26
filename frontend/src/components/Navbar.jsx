import React from 'react';
import { Shield, Trophy, LogOut, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ignitronLogo from '../assets/ignitron_logo.jpg';

export default function Navbar({ currentView, setView }) {
  const { user, isAuthenticated, isAdmin, teamId, logout } = useAuth();
  const isLanding = currentView === 'landing';

  return (
    <header className={`${isLanding ? 'absolute top-0 left-0 right-0' : 'relative'} z-50 bg-transparent border-b border-white/5 transition-all`}>
      {/* Top institutional strip */}
      <div className="bg-transparent border-b border-white/5 py-1">
        <div className="w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between text-[11px] font-race tracking-wider">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="tracking-widest">GM UNIVERSITY</span>
            <span className="text-slate-500 hidden sm:inline">&bull;</span>
            <span className="text-slate-300 font-medium hidden sm:inline text-[10px] font-mono-code">FACULTY OF ENGINEERING &amp; TECHNOLOGY</span>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="w-full px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div
            onClick={() => setView('landing')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            {/* Original red Gauge logo */}
            <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-lg shadow-lg shadow-red-900/40 group-hover:scale-105 transition-transform">
              <Gauge className="w-7 h-7 text-white" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full flex items-center justify-center text-[9px] font-black text-black">
                26
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-race text-2xl font-black tracking-wider text-white">
                  CLOUD<span className="text-gradient-blue">NEX</span>
                </span>
                <span className="text-xs font-black px-1.5 py-0.5 bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 rounded tracking-widest font-race">
                  2K26
                </span>
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[10px] font-bold tracking-widest text-cyan-400 font-race uppercase">
                  GM UNIVERSITY
                </span>
                <span className="text-[9px] text-slate-600">&bull;</span>
                <span className="text-[9px] font-mono-code text-slate-400 tracking-wider">
                  IGNITRON
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links (only for logged-in users) */}
          <nav className="hidden md:flex items-center space-x-1">
            {isAdmin && (
              <>
                <button
                  onClick={() => setView('admin')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold rounded-md transition-colors ${
                    currentView === 'admin'
                      ? 'text-white bg-red-600/30 border-b-2 border-red-500'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Shield className="w-4 h-4 text-red-400" />
                  <span>Admin Console</span>
                </button>
                <button
                  onClick={() => setView('leaderboard')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold rounded-md transition-colors ${
                    currentView === 'leaderboard'
                      ? 'text-white bg-white/10 border-b-2 border-amber-400'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Leaderboard</span>
                </button>
              </>
            )}
          </nav>

          {/* Right side: IGNITRON logo, GM University name & Login */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* GM University & IGNITRON Badge */}
            <div className="flex items-center space-x-2.5 px-3 py-1.5 bg-slate-900/90 border border-cyan-500/30 rounded-lg shadow-sm hover:border-cyan-400/50 transition-colors">
              <img
                src={ignitronLogo}
                alt="IGNITRON 2K26"
                className="w-7 h-7 rounded object-cover border border-cyan-400/30"
              />
              <div className="text-left">
                <p className="text-[10px] sm:text-[11px] font-bold text-white tracking-wider leading-none">GM UNIVERSITY</p>
                <p className="text-[9px] font-mono-code text-cyan-400 tracking-wider leading-none mt-1">IGNITRON 2K26</p>
              </div>
            </div>

            {/* User Controls */}
            {isAuthenticated && (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-race font-bold text-white">
                    {isAdmin ? 'RACE DIRECTOR' : user?.team_name || teamId}
                  </span>
                  <span className="text-[11px] font-mono-code text-cyan-400">
                    {isAdmin ? 'CHIEF STEWARD' : teamId}
                  </span>
                </div>

                <button
                  onClick={() => {
                    logout();
                    setView('landing');
                  }}
                  title="Logout"
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white text-xs font-semibold rounded border border-red-800/40 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
