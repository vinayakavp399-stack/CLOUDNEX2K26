import { Shield, Trophy, LogOut, Users, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ignitronLogo from '../assets/ignitron_logo.jpg';
import gmuLogo from '../assets/gmu_logo.jpg';

export default function Navbar({ currentView, setView }) {
  const { user, isAuthenticated, isAdmin, teamId, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const isLanding = currentView === 'landing';

  return (
    <header className={`${isLanding ? 'absolute top-0 left-0 right-0' : 'relative'} z-50 ${isDark ? 'bg-slate-950/40 border-white/5' : 'bg-white/80 border-slate-200/80 shadow-sm'} backdrop-blur-md border-b transition-all`}>
      {/* Top institutional strip */}
      <div className={`border-b ${isDark ? 'bg-transparent border-white/5' : 'bg-slate-50/70 border-slate-200'} py-1 transition-colors`}>
        <div className="w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between text-[11px] font-race tracking-wider">
          <div className="flex items-center space-x-2 text-cyan-500 font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="tracking-widest">GM UNIVERSITY</span>
            <span className="text-slate-400 hidden sm:inline">&bull;</span>
            <span className={`font-medium hidden sm:inline text-[10px] font-mono-code ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>FACULTY OF ENGINEERING &amp; TECHNOLOGY</span>
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
            {/* GM University Logo */}
            <div className="relative flex items-center justify-center w-12 h-12 bg-black rounded-xl overflow-hidden border border-amber-500/40 shadow-lg shadow-amber-900/30 group-hover:scale-105 transition-transform shrink-0">
              <img
                src={gmuLogo}
                alt="GM University"
                className="w-full h-full object-cover"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-cyan-400 rounded-full flex items-center justify-center text-[9px] font-black text-black shadow">
                26
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-race text-2xl font-black tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                  className={`flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentView === 'admin'
                      ? isDark
                        ? 'text-white bg-red-600/30 border border-red-500/50 shadow-sm'
                        : 'text-red-900 bg-red-100 border border-red-300 shadow-sm font-bold'
                      : isDark
                      ? 'text-slate-300 hover:text-white hover:bg-white/5'
                      : 'text-slate-700 hover:text-red-700 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-4 h-4 text-red-500" />
                  <span>Admin Console</span>
                </button>
                <button
                  onClick={() => setView('teams')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentView === 'teams'
                      ? isDark
                        ? 'text-white bg-cyan-600/30 border border-cyan-400/50 shadow-sm'
                        : 'text-sky-900 bg-sky-100 border border-sky-300 shadow-sm font-bold'
                      : isDark
                      ? 'text-slate-300 hover:text-white hover:bg-white/5'
                      : 'text-slate-700 hover:text-sky-700 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-4 h-4 text-cyan-500" />
                  <span>Teams</span>
                </button>
              </>
            )}
          </nav>

          {/* Right side: Theme Toggle, IGNITRON logo, GM University name & Login */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5">
            {/* Theme Toggle Pill (Lite / Dark Mode) */}
            <button
              onClick={toggleTheme}
              type="button"
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-race font-bold transition-all duration-200 cursor-pointer shadow-sm ${
                isDark
                  ? 'bg-slate-900/90 text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,245,255,0.25)]'
                  : 'bg-white/95 text-amber-600 border-amber-400/60 hover:border-amber-500 hover:shadow-[0_0_12px_rgba(251,191,36,0.35)] shadow-amber-500/10'
              }`}
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] tracking-wider hidden xs:inline">DARK</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] tracking-wider hidden xs:inline">LIGHT</span>
                </>
              )}
            </button>

            {/* GM University & IGNITRON Badge */}
            <div className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-lg shadow-sm border transition-colors ${
              isDark ? 'bg-slate-900/90 border-cyan-500/30 hover:border-cyan-400/50' : 'bg-white/95 border-slate-300 hover:border-cyan-500 shadow-slate-200'
            }`}>
              <img
                src={ignitronLogo}
                alt="IGNITRON 2K26"
                className="w-7 h-7 rounded object-cover border border-cyan-400/30"
              />
              <div className="text-left">
                <p className={`text-[10px] sm:text-[11px] font-bold tracking-wider leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>GM UNIVERSITY</p>
                <p className="text-[9px] font-mono-code text-cyan-500 tracking-wider leading-none mt-1 font-bold">IGNITRON 2K26</p>
              </div>
            </div>

            {/* User Controls */}
            {isAuthenticated && (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className={`text-xs font-race font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isAdmin ? 'RACE DIRECTOR' : user?.team_name || teamId}
                  </span>
                  <span className="text-[11px] font-mono-code text-cyan-500 font-bold">
                    {isAdmin ? 'CHIEF STEWARD' : teamId}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setView('landing');
                  }}
                  title="Sign Out"
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-bold text-xs ${
                    isDark
                      ? 'bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white border-red-800/40'
                      : 'bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border-red-300 shadow-sm'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
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
