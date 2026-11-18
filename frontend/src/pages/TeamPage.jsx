import React from 'react';
import { ArrowLeft, Users, Shield, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import TeamSection from '../components/TeamSection';

export default function TeamPage({ onBack }) {
  const { isLight } = useTheme();

  return (
    <div className={`h-[calc(100dvh-68px)] sm:min-h-[calc(100vh-80px)] py-1.5 sm:py-4 transition-colors duration-300 flex flex-col justify-between overflow-hidden ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#030610] text-white'
    }`}>
      {/* Top Header / Breadcrumb navigation */}
      <div className="max-w-7xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 mb-1 sm:mb-3 shrink-0">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-cyan-500/20">
          <button
            onClick={onBack}
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-race font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0 ${
              isLight
                ? 'bg-white text-slate-700 hover:text-cyan-700 hover:bg-slate-100 border border-slate-300 shadow-slate-200'
                : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-cyan-500/30 hover:border-cyan-400'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="hidden xs:inline">Back to Dashboard</span>
            <span className="xs:hidden">Back</span>
          </button>

          <div className="flex items-center space-x-1.5 truncate">
            <span className={`text-[9px] sm:text-[11px] font-mono-code truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              CLOUDNEX 2K26 &bull; GM UNIVERSITY
            </span>
          </div>
        </div>
      </div>

      {/* Render the core single-page no-scroll TeamSection */}
      <div className="flex-1 flex flex-col justify-center w-full my-auto overflow-hidden">
        <TeamSection embedded={false} />
      </div>
    </div>
  );
}

