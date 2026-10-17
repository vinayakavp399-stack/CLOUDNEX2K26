import React from 'react';
import { Shield, Cloud, Terminal, Cpu } from 'lucide-react';
import ignitronLogo from '../assets/ignitron_logo.jpg';

export default function Footer() {
  return (
    <footer className="mt-auto bg-[#05070a] border-t border-white/10 text-slate-400 relative z-20">
      {/* Top accent stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Column 1: Organization Branding */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/40">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-race text-xl font-black text-white tracking-wider">
                  CLOUDNEX <span className="text-cyan-400">2K26</span>
                </span>
                <p className="text-xs text-slate-400 font-semibold">
                  Next-Gen Cloud Engineering Challenge
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-300 max-w-lg leading-relaxed space-y-1">
              <p>
                Organized by the <strong className="text-white">Department of Cloud Computing and Business Systems</strong> in association with <strong className="text-white">IGNITRON 2K26 &amp; Student Affairs</strong>
              </p>
              <p className="font-bold text-cyan-400 font-race">
                GM University
              </p>
              <p className="text-slate-400">
                P.B. Road, Davangere.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono-code text-cyan-400 pt-1">
              <Terminal className="w-4 h-4" />
              <span>DESIGN. DEPLOY. SCALE. SOLVE.</span>
            </div>
          </div>

          {/* Column 2: Rounds */}
          <div>
            <h4 className="font-race text-xs font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Competition Rounds</span>
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400 font-mono-code font-bold">R1:</span>
                <span>Architecture Design</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400 font-mono-code font-bold">R2:</span>
                <span>Build &amp; Deploy</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400 font-mono-code font-bold">R3:</span>
                <span>Cloud Crisis Challenge</span>
              </li>
              <li className="text-xs text-slate-500 pt-1">
                Elimination &amp; qualification after Round 2
              </li>
            </ul>
          </div>

          {/* Column 3: Host + IGNITRON */}
          <div>
            <h4 className="font-race text-xs font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Organized By</span>
            </h4>

            {/* IGNITRON logo in footer */}
            <div className="flex items-center space-x-3 mb-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20">
              <img src={ignitronLogo} alt="IGNITRON 2K26" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className="text-sm font-black text-white tracking-wider">IGNITRON</p>
                <p className="text-xs text-indigo-300">2K26 Annual Tech Fest</p>
              </div>
            </div>

            <address className="not-italic text-sm text-slate-400 space-y-1 leading-relaxed">
              <p className="text-slate-300 font-medium">GM University Campus</p>
              <p>P.B. Road, Davangere - 577006</p>
              <p>Karnataka, India</p>
              <p className="text-xs text-slate-300 pt-2 font-mono-code">
                <a
                  href="mailto:cloudnex2k26@gmail.com"
                  className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                >
                  cloudnex2k26@gmail.com
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-3 sm:space-y-0">
          <div>
            &copy; {new Date().getFullYear()} CLOUDNEX 2K26 &bull; GM University. All rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">IGNITRON 2K26 &bull; National Tech Symposium</span>
            <span>&bull;</span>
            <span className="text-cyan-400 font-bold font-race">NEXT-GEN CLOUD ENGINEERING</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
