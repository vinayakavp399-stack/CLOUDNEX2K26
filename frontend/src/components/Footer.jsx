import React from 'react';
import { Shield, Cloud, Terminal, Cpu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ignitronLogo from '../assets/ignitron_logo.jpg';

export default function Footer() {
  const { isLight } = useTheme();

  return (
    <footer className={`mt-auto border-t relative z-20 transition-colors ${
      isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#05070a] border-white/10 text-slate-400'
    }`}>
      {/* Top accent stripe */}
      <div className={`h-1 w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 ${isLight ? 'opacity-80' : 'opacity-60'}`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Column 1: Organization Branding */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/40">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className={`font-race text-xl font-black tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  CLOUDNEX <span className={isLight ? 'text-cyan-700 font-black' : 'text-cyan-400'}>2K26</span>
                </span>
                <p className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Next-Gen Cloud Engineering Challenge
                </p>
              </div>
            </div>

            <div className={`text-sm max-w-lg leading-relaxed space-y-1 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
              <p>
                Organized by the <strong className={isLight ? 'text-slate-900 font-bold' : 'text-white'}>Department of Cloud Computing and Business Systems</strong> in association with <strong className={isLight ? 'text-slate-900 font-bold' : 'text-white'}>IGNITRON 2K26 &amp; Student Affairs</strong>
              </p>
              <p className={`font-bold font-race ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>
                GM University
              </p>
              <p className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                P.B. Road, Davangere.
              </p>
            </div>

            <div className={`flex items-center space-x-2 text-xs font-mono-code pt-1 ${isLight ? 'text-cyan-800 font-bold' : 'text-cyan-400'}`}>
              <Terminal className="w-4 h-4" />
              <span>DESIGN. DEPLOY. SCALE. SOLVE.</span>
            </div>
          </div>

          {/* Column 2: Rounds */}
          <div>
            <h4 className={`font-race text-xs font-bold uppercase tracking-widest mb-4 flex items-center space-x-2 ${
              isLight ? 'text-slate-900' : 'text-slate-200'
            }`}>
              <Cpu className={`w-4 h-4 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <span>Competition Rounds</span>
            </h4>
            <ul className={`space-y-2 text-sm ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
              <li className="flex items-center space-x-2">
                <span className={`font-mono-code font-bold ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>R1:</span>
                <span>Architecture Design</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className={`font-mono-code font-bold ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>R2:</span>
                <span>Build &amp; Deploy</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className={`font-mono-code font-bold ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>R3:</span>
                <span>Cloud Crisis Challenge</span>
              </li>
              <li className={`text-xs pt-1 ${isLight ? 'text-slate-500 font-medium' : 'text-slate-500'}`}>
                Elimination &amp; qualification after Round 2
              </li>
            </ul>
          </div>

          {/* Column 3: Host + IGNITRON */}
          <div>
            <h4 className={`font-race text-xs font-bold uppercase tracking-widest mb-4 flex items-center space-x-2 ${
              isLight ? 'text-slate-900' : 'text-slate-200'
            }`}>
              <Shield className={`w-4 h-4 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
              <span>Organized By</span>
            </h4>

            {/* IGNITRON logo in footer */}
            <div className={`flex items-center space-x-3 mb-4 p-3 rounded-xl border ${
              isLight ? 'bg-white border-indigo-200 shadow-sm' : 'bg-indigo-950/40 border-indigo-500/20'
            }`}>
              <img src={ignitronLogo} alt="IGNITRON 2K26" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className={`text-sm font-black tracking-wider ${isLight ? 'text-indigo-950 font-bold' : 'text-white'}`}>IGNITRON</p>
                <p className={`text-xs ${isLight ? 'text-indigo-700 font-bold' : 'text-indigo-300'}`}>2K26 Annual Tech Fest</p>
              </div>
            </div>

            <address className={`not-italic text-sm space-y-1 leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              <p className={`font-medium ${isLight ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>GM University Campus</p>
              <p>P.B. Road, Davangere - 577006</p>
              <p>Karnataka, India</p>
              <p className={`text-xs pt-2 font-mono-code ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                <a
                  href="mailto:cloudnex2k26@gmail.com"
                  className={`underline transition-colors ${isLight ? 'text-cyan-800 hover:text-cyan-950 font-bold' : 'text-cyan-400 hover:text-cyan-300'}`}
                >
                  cloudnex2k26@gmail.com
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`pt-8 border-t flex flex-col sm:flex-row items-center justify-between text-xs space-y-3 sm:space-y-0 ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-slate-500'
        }`}>
          <div>
            &copy; {new Date().getFullYear()} CLOUDNEX 2K26 &bull; GM University. All rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}>IGNITRON 2K26 &bull; National Tech Symposium</span>
            <span>&bull;</span>
            <span className={`font-bold font-race ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>NEXT-GEN CLOUD ENGINEERING</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
