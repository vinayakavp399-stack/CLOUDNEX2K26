import React from 'react';
import { Cpu, Rocket, AlertTriangle, Shield, Activity } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import F1CarHero from '../components/F1CarHero';

export default function LandingPage({ onParticipantLogin, onAdminLogin, onGoToDashboard }) {
  const { isLight } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#030610] text-white'
    }`}>
      {/* Hero Section */}
      <F1CarHero
        onParticipantLogin={onParticipantLogin}
        onAdminLogin={onAdminLogin}
        onGoToDashboard={onGoToDashboard}
      />

      {/* Three-Round Race Track Breakdown */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center space-x-2 text-xs font-race font-bold tracking-widest uppercase mb-3 px-3.5 py-1.5 rounded-full border shadow-sm ${
            isLight
              ? 'bg-sky-50 border-sky-300 text-sky-800'
              : 'bg-cyan-950/50 border-cyan-500/25 text-cyan-400'
          }`}>
            <Activity className="w-3.5 h-3.5" />
            <span>COMPETITION STRUCTURE</span>
          </div>
          <h2 className={`text-3xl sm:text-5xl font-race font-black uppercase tracking-wide ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            THREE-ROUND <span className={isLight ? 'text-gradient-blue' : 'text-gradient-cloud'}>CHALLENGE</span>
          </h2>
          <p className={`text-sm mt-3 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Work through three rounds that test your architecture thinking, deployment skills, and ability to handle unexpected cloud infrastructure problems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Round 1 Card */}
          <div className={`rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border transition-all duration-200 hover:-translate-y-1 shadow-xl ${
            isLight
              ? 'bg-white/95 border-sky-200/90 shadow-slate-200/80'
              : 'cloud-card'
          }`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full pointer-events-none ${
              isLight ? 'bg-sky-500/10' : 'bg-cyan-500/10'
            }`} />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  isLight
                    ? 'bg-sky-50 border-sky-200 text-sky-600'
                    : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400'
                }`}>
                  <Cpu className="w-6 h-6" />
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-mono-code font-bold border ${
                  isLight
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-slate-900 text-cyan-400 border-cyan-500/30'
                }`}>
                  LAP 1 &bull; QUALIFYING
                </span>
              </div>

              <h3 className={`font-race text-xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Round 1 — Architecture Design
              </h3>
              <p className={`text-xs font-mono-code mb-3 font-semibold ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                Polesitter Circuit Blueprint
              </p>
              <p className={`text-xs leading-relaxed mb-6 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Participants must design a robust, scalable, secure, and cost-efficient cloud architecture capable of handling high-velocity telemetry streams in real time. Teams will develop an architecture blueprint incorporating multi-region cloud infrastructure, event-stream processing, VPC security boundaries, fault tolerance, disaster recovery, and cost optimization under strict budget constraints.
              </p>

              <div className="space-y-2 mb-6">
                <h4 className={`text-[11px] font-race font-bold uppercase tracking-wider ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Key Deliverables
                </h4>
                <ul className={`text-xs space-y-1.5 font-mono-code ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`}>&bull;</span>
                    <span>Identify the problem and proposed solution.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`}>&bull;</span>
                    <span>Draw a system architecture diagram.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`}>&bull;</span>
                    <span>Create a workflow diagram.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`}>&bull;</span>
                    <span>Select suitable technologies, databases, APIs, and cloud services.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className={`pt-4 border-t flex items-center justify-between text-xs ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'
            }`}>
              <span>Status: <strong className="text-emerald-500 font-bold">Green Flag</strong></span>
              <span className="font-mono-code font-bold">Max: 50 Pts</span>
            </div>
          </div>

          {/* Round 2 Card */}
          <div className={`rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border transition-all duration-200 hover:-translate-y-1 shadow-xl ${
            isLight
              ? 'bg-white/95 border-red-200/90 shadow-slate-200/80'
              : 'cloud-card'
          }`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full pointer-events-none ${
              isLight ? 'bg-red-500/10' : 'bg-red-600/10'
            }`} />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  isLight
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-red-950/60 border-red-500/40 text-red-400'
                }`}>
                  <Rocket className="w-6 h-6" />
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-mono-code font-bold border ${
                  isLight
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-slate-900 text-red-400 border-red-500/30'
                }`}>
                  LAP 2 &bull; SPRINT RACE
                </span>
              </div>

              <h3 className={`font-race text-xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Round 2 — Build &amp; Deploy
              </h3>
              <p className={`text-xs font-mono-code mb-3 font-semibold ${isLight ? 'text-red-700' : 'text-red-300'}`}>
                Grand Prix Production Sprint
              </p>
              <p className={`text-xs leading-relaxed mb-6 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Teams must transform their proposed architecture into a functional cloud-based application or prototype. Participants will configure cloud services, deploy application components, integrate APIs and databases, and demonstrate the working solution. The application will be evaluated on functionality, deployment quality, security, scalability, resource utilization, and adherence to the given problem statement.
              </p>

              <div className="space-y-2 mb-6">
                <h4 className={`text-[11px] font-race font-bold uppercase tracking-wider ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Key Deliverables
                </h4>
                <ul className={`text-xs space-y-1.5 font-mono-code ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'}`}>&bull;</span>
                    <span>Write and test the code.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'}`}>&bull;</span>
                    <span>Implement the core features.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'}`}>&bull;</span>
                    <span>Deploy the application using a platform such as GCP, Microsoft Azure or AWS.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'}`}>&bull;</span>
                    <span>Submit a working public URL and demonstrate the application.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className={`pt-4 border-t flex items-center justify-between text-xs ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'
            }`}>
              <span className="text-amber-600 dark:text-amber-400 font-bold">Mid-Season Elimination</span>
              <span className="font-mono-code font-bold">Max: 100 Pts</span>
            </div>
          </div>

          {/* Round 3 Card */}
          <div className={`rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border transition-all duration-200 hover:-translate-y-1 shadow-xl ${
            isLight
              ? 'bg-white/95 border-amber-200/90 shadow-slate-200/80'
              : 'racing-card border-amber-500/20'
          }`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full pointer-events-none ${
              isLight ? 'bg-amber-500/10' : 'bg-amber-500/10'
            }`} />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-mono-code font-bold border ${
                  isLight
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-900 text-amber-400 border-amber-500/30'
                }`}>
                  LAP 3 &bull; FINAL LAP
                </span>
              </div>

              <h3 className={`font-race text-xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Round 3 — Cloud Crisis Challenge
              </h3>
              <p className={`text-xs font-mono-code mb-3 font-semibold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                Crisis &amp; Presentation
              </p>
              <p className={`text-xs leading-relaxed mb-6 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Qualified teams will face unexpected real-world cloud infrastructure challenges introduced by the organizers. Teams must diagnose the issue, implement an appropriate solution, and demonstrate how their application maintains availability, performance, and reliability under pressure. Challenges will use controlled simulations or safely configured test environments.
              </p>

              <div className="space-y-2 mb-6">
                <h4 className={`text-[11px] font-race font-bold uppercase tracking-wider ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Key Deliverables
                </h4>
                <ul className={`text-xs space-y-1.5 font-mono-code ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>&bull;</span>
                    <span>Diagnose unexpected real-world cloud infrastructure crises.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>&bull;</span>
                    <span>Implement solutions maintaining availability, performance, and reliability under pressure.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <span className={`font-bold mt-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>&bull;</span>
                    <span>Crises and presentation demonstration.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className={`pt-4 border-t flex items-center justify-between text-xs ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'
            }`}>
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">Championship Podium</span>
              <span className="font-mono-code font-bold">Max: 50 Pts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rules & Championship Regulations */}
      <section className={`py-12 w-full border-t px-4 sm:px-8 lg:px-12 transition-colors ${
        isLight ? 'border-slate-200 bg-slate-100/50' : 'border-white/10 bg-slate-950/40'
      }`}>
        <div className="w-full max-w-7xl mx-auto">
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-6 pb-3 border-b ${
            isLight ? 'border-slate-200' : 'border-white/10'
          }`}>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-500 shrink-0" />
              <h3 className={`font-race text-lg sm:text-xl font-black tracking-wide uppercase ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                CloudNex Hackathon &ndash; Rules &amp; Code of Conduct
              </h3>
            </div>
            <span className={`text-[11px] font-mono-code font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Strict Adherence Required Across All Laps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm font-mono-code leading-relaxed">
            {/* Rule 01 */}
            <div className={`rounded-xl border p-4 shadow-md backdrop-blur-sm transition-all flex flex-col justify-between ${
              isLight
                ? 'bg-white border-slate-200 hover:border-red-400'
                : 'bg-slate-900/75 border-white/10 hover:border-red-500/40'
            }`}>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-500 border border-red-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    01
                  </span>
                  <strong className={`font-black uppercase text-sm font-race tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Team Participation
                  </strong>
                </div>
                <p className={isLight ? 'text-slate-700 font-medium' : 'text-slate-200 font-bold'}>
                  Each team must have a fixed number of members as decided by the organizers. All members must participate actively. <span className="text-amber-600 dark:text-amber-400 font-black">Team size: 3 to 4 participants</span> representing a recognized institution.
                </p>
              </div>
            </div>

            {/* Rule 02 */}
            <div className={`rounded-xl border p-4 shadow-md backdrop-blur-sm transition-all flex flex-col justify-between ${
              isLight
                ? 'bg-white border-slate-200 hover:border-red-400'
                : 'bg-slate-900/75 border-white/10 hover:border-red-500/40'
            }`}>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-500 border border-red-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    02
                  </span>
                  <strong className={`font-black uppercase text-sm font-race tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Architecture &amp; Workflow (R1)
                  </strong>
                </div>
                <p className={isLight ? 'text-slate-700 font-medium' : 'text-slate-200 font-bold'}>
                  Teams must design and present a clear system architecture and workflow within the allotted time. <span className="text-sky-600 dark:text-cyan-400 font-black">Submissions must consist of original architectural diagrams</span> and workflows.
                </p>
              </div>
            </div>

            {/* Rule 03 */}
            <div className={`rounded-xl border p-4 shadow-md backdrop-blur-sm transition-all flex flex-col justify-between ${
              isLight
                ? 'bg-white border-slate-200 hover:border-red-400'
                : 'bg-slate-900/75 border-white/10 hover:border-red-500/40'
            }`}>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-500 border border-red-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    03
                  </span>
                  <strong className={`font-black uppercase text-sm font-race tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Cloud Deployment (R2)
                  </strong>
                </div>
                <p className={`mb-2 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-200 font-bold'}`}>
                  Implement, test, and deploy to cloud within time limit with verifiable GitHub code and live deployments.
                </p>
                <div className={`p-2 rounded-lg border text-[11px] font-mono-code ${
                  isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-200 font-bold'
                }`}>
                  <strong className="text-amber-600 dark:text-amber-400 font-black block mb-0.5">⚠️ CLOUD ACCOUNT NOTICE:</strong>
                  Organizers are not responsible for cloud account creation; teams must prepare GCP/Azure/AWS accounts prior to start.
                </div>
              </div>
            </div>

            {/* Rule 04 */}
            <div className={`rounded-xl border p-4 shadow-md backdrop-blur-sm transition-all flex flex-col justify-between ${
              isLight
                ? 'bg-white border-slate-200 hover:border-sky-400'
                : 'bg-slate-900/75 border-white/10 hover:border-cyan-500/40'
            }`}>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-500 border border-cyan-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    04
                  </span>
                  <strong className={`font-black uppercase text-sm font-race tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Crisis Challenge (R3)
                  </strong>
                </div>
                <p className={isLight ? 'text-slate-700 font-medium' : 'text-slate-200 font-bold'}>
                  Solve the surprise crisis challenge assigned by organizers and explain the recovery solution during live presentation under controlled pressure.
                </p>
              </div>
            </div>

            {/* Rule 05 */}
            <div className={`rounded-xl border p-4 shadow-md backdrop-blur-sm transition-all flex flex-col justify-between ${
              isLight
                ? 'bg-white border-slate-200 hover:border-sky-400'
                : 'bg-slate-900/75 border-white/10 hover:border-cyan-500/40'
            }`}>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-500 border border-cyan-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    05
                  </span>
                  <strong className={`font-black uppercase text-sm font-race tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Presentation &amp; Evaluation
                  </strong>
                </div>
                <p className={isLight ? 'text-slate-700 font-medium' : 'text-slate-200 font-bold'}>
                  Present within allotted time and answer judges' questions. <span className="text-sky-600 dark:text-cyan-400 font-black">Top-scoring teams advance to Round 3.</span> Judging decisions are final.
                </p>
              </div>
            </div>

            {/* Rule 06 */}
            <div className={`rounded-xl border p-4 shadow-md backdrop-blur-sm transition-all flex flex-col justify-between ${
              isLight
                ? 'bg-white border-slate-200 hover:border-sky-400'
                : 'bg-slate-900/75 border-white/10 hover:border-cyan-500/40'
            }`}>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-500 border border-cyan-500/40 flex items-center justify-center font-mono-code font-black text-xs shrink-0">
                    06
                  </span>
                  <strong className={`font-black uppercase text-sm font-race tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Fair Play &amp; Originality
                  </strong>
                </div>
                <p className={isLight ? 'text-slate-700 font-medium' : 'text-slate-200 font-bold'}>
                  Plagiarism and disruption are strictly prohibited. Teams must follow organizers' instructions and complete all rounds within time limits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
