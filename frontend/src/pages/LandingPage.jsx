import React from 'react';
import { Cpu, Rocket, AlertTriangle, Trophy, Shield, CheckCircle2, ChevronRight, Award, Zap, Layers, Server, Activity } from 'lucide-react';
import F1CarHero from '../components/F1CarHero';

export default function LandingPage({ onParticipantLogin, onAdminLogin, onGoToDashboard }) {
  return (
    <div className="min-h-screen bg-[#080a0f]">
      {/* Hero Section */}
      <F1CarHero
        onParticipantLogin={onParticipantLogin}
        onAdminLogin={onAdminLogin}
        onGoToDashboard={onGoToDashboard}
      />

      {/* Three-Round Race Track Breakdown */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 text-xs font-race font-bold text-cyan-500 tracking-widest uppercase mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>COMPETITION STRUCTURE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-race font-black text-white">
            THREE-ROUND CHALLENGE
          </h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            Work through three rounds that test your architecture thinking, deployment skills, and ability to handle unexpected cloud infrastructure problems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Round 1 Card */}
          <div className="racing-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-900 text-cyan-400 text-xs font-mono-code font-bold border border-cyan-500/30">
                  LAP 1 &bull; QUALIFYING
                </span>
              </div>

              <h3 className="font-race text-xl font-bold text-white mb-2">
                Round 1 — Architecture Design
              </h3>
              <p className="text-xs font-mono-code text-cyan-300 mb-3">
                Polesitter Circuit Blueprint
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Participants must design a robust, scalable, secure, and cost-efficient cloud architecture capable of handling high-velocity telemetry streams in real time. Teams will develop an architecture blueprint incorporating multi-region cloud infrastructure, event-stream processing, VPC security boundaries, fault tolerance, disaster recovery, and cost optimization under strict budget constraints.
              </p>

              <div className="space-y-2 mb-6">
                <h4 className="text-[11px] font-race text-slate-300 font-bold uppercase tracking-wider">
                  Key Deliverables
                </h4>
                <ul className="text-xs text-slate-400 space-y-1.5 font-mono-code">
                  <li className="flex items-start space-x-1.5">
                    <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                    <span>Identify the problem and proposed solution.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                    <span>Draw a system architecture diagram.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                    <span>Create a workflow diagram.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                    <span>Select suitable technologies, databases, APIs, and cloud services.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span>Status: <strong className="text-emerald-400">Green Flag</strong></span>
              <span>Max: 50 Pts</span>
            </div>
          </div>

          {/* Round 2 Card */}
          <div className="racing-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-red-400" />
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-900 text-red-400 text-xs font-mono-code font-bold border border-red-500/30">
                  LAP 2 &bull; SPRINT RACE
                </span>
              </div>

              <h3 className="font-race text-xl font-bold text-white mb-2">
                Round 2 — Build &amp; Deploy
              </h3>
              <p className="text-xs font-mono-code text-red-300 mb-3">
                Grand Prix Production Sprint
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Teams must transform their proposed architecture into a functional cloud-based application or prototype. Participants will configure cloud services, deploy application components, integrate APIs and databases, and demonstrate the working solution. The application will be evaluated on functionality, deployment quality, security, scalability, resource utilization, and adherence to the given problem statement.
              </p>

              <div className="space-y-2 mb-6">
                <h4 className="text-[11px] font-race text-slate-300 font-bold uppercase tracking-wider">
                  Key Deliverables
                </h4>
                <ul className="text-xs text-slate-400 space-y-1.5 font-mono-code">
                  <li className="flex items-start space-x-1.5">
                    <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                    <span>Write and test the code.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                    <span>Implement the core features.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                    <span>Deploy the application using a platform such as GCP, Microsoft Azure or AWS.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                    <span>Submit a working public URL and demonstrate the application.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span className="text-amber-400 font-bold">Mid-Season Elimination</span>
              <span>Max: 100 Pts</span>
            </div>
          </div>

          {/* Round 3 Card */}
          <div className="racing-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border-amber-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-900 text-amber-400 text-xs font-mono-code font-bold border border-amber-500/30">
                  LAP 3 &bull; FINAL LAP
                </span>
              </div>

              <h3 className="font-race text-xl font-bold text-white mb-2">
                Round 3 — Cloud Crisis Challenge
              </h3>
              <p className="text-xs font-mono-code text-amber-300 mb-3">
                Crisis &amp; Presentation
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Qualified teams will face unexpected real-world cloud infrastructure challenges introduced by the organizers. Teams must diagnose the issue, implement an appropriate solution, and demonstrate how their application maintains availability, performance, and reliability under pressure. Challenges will use controlled simulations or safely configured test environments.
              </p>

              <div className="space-y-2 mb-6">
                <h4 className="text-[11px] font-race text-slate-300 font-bold uppercase tracking-wider">
                  Key Deliverables
                </h4>
                <ul className="text-xs text-slate-400 space-y-1.5 font-mono-code">
                  <li className="flex items-start space-x-1.5">
                    <span className="text-amber-400 font-bold mt-0.5">&bull;</span>
                    <span>Diagnose unexpected real-world cloud infrastructure crises.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-amber-400 font-bold mt-0.5">&bull;</span>
                    <span>Implement solutions maintaining availability, performance, and reliability under pressure.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className="text-amber-400 font-bold mt-0.5">&bull;</span>
                    <span>Crises and presentation demonstration.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span className="text-cyan-400 font-bold">Championship Podium</span>
              <span>Max: 50 Pts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rules & Championship Regulations */}
      <section className="py-8 sm:py-10 w-full border-t border-white/10 px-4 sm:px-8 lg:px-12">
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4 pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-red-500 shrink-0" />
              <h3 className="font-race text-lg sm:text-xl font-black text-white tracking-wide uppercase">
                CloudNex Hackathon &ndash; Rules &amp; Code of Conduct
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono-code font-bold uppercase tracking-wider">
              Strict Adherence Required Across All Laps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm font-mono-code leading-relaxed">
            {/* Rule 01 */}
            <div className="rounded-xl bg-slate-900/75 border border-white/10 hover:border-red-500/40 p-4 shadow-lg backdrop-blur-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    01
                  </span>
                  <strong className="text-white font-black uppercase text-sm font-race tracking-wide">
                    Team Participation
                  </strong>
                </div>
                <p className="text-slate-200 font-bold">
                  Each team must have a fixed number of members as decided by the organizers. All members must participate actively. <span className="text-amber-400 font-black">Team size: 3 to 4 participants</span> representing a recognized institution.
                </p>
              </div>
            </div>

            {/* Rule 02 */}
            <div className="rounded-xl bg-slate-900/75 border border-white/10 hover:border-red-500/40 p-4 shadow-lg backdrop-blur-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    02
                  </span>
                  <strong className="text-white font-black uppercase text-sm font-race tracking-wide">
                    Architecture &amp; Workflow (R1)
                  </strong>
                </div>
                <p className="text-slate-200 font-bold">
                  Teams must design and present a clear system architecture and workflow within the allotted time. <span className="text-cyan-400 font-black">Submissions must consist of original architectural diagrams</span> and workflows.
                </p>
              </div>
            </div>

            {/* Rule 03 */}
            <div className="rounded-xl bg-slate-900/75 border border-white/10 hover:border-red-500/40 p-4 shadow-lg backdrop-blur-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    03
                  </span>
                  <strong className="text-white font-black uppercase text-sm font-race tracking-wide">
                    Cloud Deployment (R2)
                  </strong>
                </div>
                <p className="text-slate-200 font-bold mb-2">
                  Implement, test, and deploy to cloud within time limit with verifiable GitHub code and live deployments.
                </p>
                <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[11px] font-mono-code text-amber-200 font-bold">
                  <strong className="text-amber-400 font-black block mb-0.5">⚠️ CLOUD ACCOUNT NOTICE:</strong>
                  Organizers are not responsible for cloud account creation; teams must prepare GCP/Azure/AWS accounts prior to start.
                </div>
              </div>
            </div>

            {/* Rule 04 */}
            <div className="rounded-xl bg-slate-900/75 border border-white/10 hover:border-cyan-500/40 p-4 shadow-lg backdrop-blur-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    04
                  </span>
                  <strong className="text-white font-black uppercase text-sm font-race tracking-wide">
                    Crisis Challenge (R3)
                  </strong>
                </div>
                <p className="text-slate-200 font-bold">
                  Solve the surprise crisis challenge assigned by organizers and explain the recovery solution during live presentation under controlled pressure.
                </p>
              </div>
            </div>

            {/* Rule 05 */}
            <div className="rounded-xl bg-slate-900/75 border border-white/10 hover:border-cyan-500/40 p-4 shadow-lg backdrop-blur-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    05
                  </span>
                  <strong className="text-white font-black uppercase text-sm font-race tracking-wide">
                    Presentation &amp; Evaluation
                  </strong>
                </div>
                <p className="text-slate-200 font-bold">
                  Present within allotted time and answer judges' questions. <span className="text-cyan-400 font-black">Top-scoring teams advance to Round 3.</span> Judging decisions are final.
                </p>
              </div>
            </div>

            {/* Rule 06 */}
            <div className="rounded-xl bg-slate-900/75 border border-white/10 hover:border-cyan-500/40 p-4 shadow-lg backdrop-blur-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    06
                  </span>
                  <strong className="text-white font-black uppercase text-sm font-race tracking-wide">
                    Fair Play &amp; Originality
                  </strong>
                </div>
                <p className="text-slate-200 font-bold">
                  Plagiarism and disruption are strictly prohibited. Teams must follow organizers' instructions and complete all rounds within time limits.
                </p>
              </div>
            </div>
          </div>

          {/* Last line: Subtle developer credit positioned at the bottom right */}
          <div className="mt-8 pt-3 border-t border-white/5 flex items-center justify-end">
            <span className="text-[9px] text-slate-600/70 hover:text-slate-400 font-mono-code transition-colors tracking-tight select-none">
              developed by <a href="mailto:vinayakpujar018@gmail.com" className="hover:underline">vinayakpujar018@gmail.com</a>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
