import React from 'react';
import { ArrowLeft, Users, Shield, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import TeamSection from '../components/TeamSection';

export default function TeamPage({ onBack }) {
  const { isLight } = useTheme();

  return (
    <div className={`min-h-[calc(100vh-80px)] py-3 sm:py-4 transition-colors duration-300 flex flex-col ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#030610] text-white'
    }`}>
      {/* Top Header / Breadcrumb navigation */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-2 sm:mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-cyan-500/20">
          <button
            onClick={onBack}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-race font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
              isLight
                ? 'bg-white text-slate-700 hover:text-cyan-700 hover:bg-slate-100 border border-slate-300 shadow-slate-200'
                : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-cyan-500/30 hover:border-cyan-400'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-500" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className={`text-[11px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              CLOUDNEX 2K26 &bull; IGNITRON &bull; GM UNIVERSITY
            </span>
          </div>
        </div>
      </div>

      {/* Render the core single-page no-scroll TeamSection */}
      <div className="flex-1 flex flex-col justify-center">
        <TeamSection embedded={false} />
      </div>
    </div>
  );
}

