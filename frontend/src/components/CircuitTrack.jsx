import React from 'react';
import { Cpu, Rocket, AlertTriangle, CheckCircle2, Lock, Flag, Award, ShieldAlert, Clock, Upload } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

export default function CircuitTrack({ rounds, onSelectRound, activeRoundNumber, teamStatus, isQualifiedR3, isEliminated, onExpire }) {
  const getRoundStatusBadge = (r) => {
    switch (r.status) {
      case 'LIVE':
        return {
          label: 'CIRCUIT LIVE',
          bgColor: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400',
          dotColor: 'bg-emerald-400 animate-ping'
        };
      case 'CLOSED':
      case 'COMPLETED':
        return {
          label: 'CHECKERED FLAG',
          bgColor: 'bg-blue-950/80 border-blue-500/50 text-blue-400',
          dotColor: 'bg-blue-400'
        };
      case 'EVALUATION':
        return {
          label: 'STEWARDS EVALUATION',
          bgColor: 'bg-amber-950/80 border-amber-500/50 text-amber-400',
          dotColor: 'bg-amber-400'
        };
      default:
        return {
          label: 'LOCKED',
          bgColor: 'bg-slate-900 border-slate-700 text-slate-500',
          dotColor: 'bg-slate-500'
        };
    }
  };

  const getRoundIcon = (num) => {
    switch (num) {
      case 1:
        return <Cpu className="w-6 h-6 text-cyan-400" />;
      case 2:
        return <Rocket className="w-6 h-6 text-red-400" />;
      case 3:
        return <AlertTriangle className="w-6 h-6 text-amber-400" />;
      default:
        return <Flag className="w-6 h-6 text-slate-400" />;
    }
  };

  return (
    <div className="relative py-8 px-4 sm:px-6 bg-slate-950/60 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Background Circuit Asphalt Grid Lines */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Track Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-race uppercase tracking-widest text-red-500 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <span>F1 RACE TELEMETRY CIRCUIT</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-race font-black text-white mt-1">
            THREE-ROUND CHAMPIONSHIP TRACK
          </h3>
        </div>

        {/* Qualification Status Pill */}
        {teamStatus && (
          <div className="flex items-center space-x-2">
            {isEliminated ? (
              <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-red-950/80 border border-red-700 rounded-lg text-red-300 text-xs font-race font-bold">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>RACE COMPLETED (ELIMINATED)</span>
              </div>
            ) : isQualifiedR3 ? (
              <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-cyan-950/80 border border-cyan-500 rounded-lg text-cyan-300 text-xs font-race font-bold shadow-lg shadow-cyan-950/50 glow-blue">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>QUALIFIED FOR FINAL LAP</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs font-race">
                <span>GRID STATUS: ACTIVE</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Circuit Checkpoints */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        {[1, 2, 3].map((num) => {
          const roundSpecs = {
            1: {
              title: 'Round 1 — Architecture Design',
              description: 'Participants must design a robust, scalable, secure, and cost-efficient cloud architecture capable of handling high-velocity telemetry streams in real time. Teams will develop an architecture blueprint incorporating multi-region cloud infrastructure, event-stream processing, VPC security boundaries, fault tolerance, disaster recovery, and cost optimization under strict budget constraints.',
              deliverables: [
                'Identify the problem and proposed solution.',
                'Draw a system architecture diagram.',
                'Create a workflow diagram.',
                'Select suitable technologies, databases, APIs, and cloud services.'
              ]
            },
            2: {
              title: 'Round 2 — Build & Deploy',
              description: 'Teams must transform their proposed architecture into a functional cloud-based application or prototype. Participants will configure cloud services, deploy application components, integrate APIs and databases, and demonstrate the working solution. The application will be evaluated on functionality, deployment quality, security, scalability, resource utilization, and adherence to the given problem statement.',
              deliverables: [
                'Write and test the code.',
                'Implement the core features.',
                'Deploy the application using a platform such as GCP, Microsoft Azure or AWS.',
                'Submit a working public URL and demonstrate the application.'
              ]
            },
            3: {
              title: 'Round 3 — Cloud Crisis Challenge',
              description: 'Qualified teams will face unexpected real-world cloud infrastructure challenges introduced by the organizers. Teams must diagnose the issue, implement an appropriate solution, and demonstrate how their application maintains availability, performance, and reliability under pressure. Challenges will use controlled simulations or safely configured test environments.',
              deliverables: [
                'Crises and presentation'
              ]
            }
          };

          const spec = roundSpecs[num];
          const round = (rounds || []).find((r) => Number(r.round_number) === num) || {
            round_number: num,
            title: spec.title,
            subtitle: spec.description,
            status: 'LOCKED'
          };
          const badge = getRoundStatusBadge(round);
          const isSelected = activeRoundNumber === round.round_number;
          const isLocked = round.status === 'LOCKED';
          const isLive = round.status === 'LIVE';
          const isR3 = round.round_number === 3;

          return (
            <div
              key={num}
              onClick={() => onSelectRound && onSelectRound(round)}
              className={`relative rounded-xl p-5 cursor-pointer transition-all duration-75 active:scale-[0.99] border flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900/90 border-red-500 shadow-xl shadow-red-950/50 scale-[1.02]'
                  : 'bg-slate-900/50 border-white/10 hover:border-white/20 hover:bg-slate-900/70'
              }`}
            >
              <div>
                {/* Checkpoint Number & Icon */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${
                      round.status === 'LIVE'
                        ? 'bg-red-950/50 border-red-500/50'
                        : 'bg-slate-800/60 border-white/10'
                    }`}>
                      {getRoundIcon(round.round_number)}
                    </div>
                    <div>
                      <span className="text-[11px] font-mono-code text-slate-400 block uppercase">
                        CHECKPOINT 0{round.round_number}
                      </span>
                      <span className="font-race font-bold text-sm text-white">
                        LAP {round.round_number} OF 3
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1">
                    <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold border ${badge.bgColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                      <span>{badge.label}</span>
                    </div>
                    {round.submissions_open && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse">
                        <Upload className="w-2.5 h-2.5" />
                        <span>SUBMISSIONS OPEN</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h4 className="font-race text-lg font-bold text-white mb-2">
                  {spec.title}
                </h4>

                {/* Description (Round 3 only) */}
                {num === 3 && spec.description && (
                  <p className="text-xs text-slate-300 line-clamp-3 mb-3 leading-relaxed">
                    {spec.description}
                  </p>
                )}

                {/* Key Deliverables Section (Round 3 only) */}
                {num === 3 && spec.deliverables && spec.deliverables.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-1.5">
                    <span className="text-[10px] font-race font-bold uppercase tracking-wider text-slate-400 block">
                      Key Deliverables
                    </span>
                    <ul className="text-[11px] text-slate-300 space-y-1 font-mono-code">
                      {spec.deliverables.map((d, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <span className="text-amber-400 font-bold">&bull;</span>
                          <span className="leading-tight">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Round Duration & Live Timer Display */}
                {isLive && isR3 ? (
                  <div className="mb-4 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/40 shadow-lg shadow-emerald-950/30">
                    <div className="flex items-center justify-between text-[10px] font-mono-code">
                      <span className="text-emerald-400 font-bold uppercase flex items-center space-x-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>FINAL LAP LIVE (UNTIMED)</span>
                      </span>
                      <span className="text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-[10px]">
                        NO TIMER
                      </span>
                    </div>
                  </div>
                ) : isLive && round.deadline && !isR3 ? (
                  <div className="mb-4 p-3 rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/30">
                    <div className="flex items-center justify-between text-[10px] font-mono-code mb-1.5">
                      <span className="text-cyan-400 font-bold uppercase flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span>REAL-TIME CLOCK</span>
                      </span>
                      <span className="text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-[10px]">
                        {round.round_number === 1 ? '45 MIN' : '3.30 HRS'}
                      </span>
                    </div>
                    <CountdownTimer
                      targetDate={round.deadline}
                      title={`LAP 0${round.round_number} REMAINING`}
                      onExpire={onExpire}
                    />
                  </div>
                ) : (
                  <div className="mb-3 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-white/5 text-[11px] font-mono-code flex items-center justify-between text-slate-400">
                    <span>Lap Time:</span>
                    <strong className="text-slate-300">
                      {round.round_number === 1 ? '45 Minutes' : round.round_number === 2 ? '3 Hours 30 Mins' : 'Untimed (Live Evaluation)'}
                    </strong>
                  </div>
                )}

                {/* Round 3 Elimination Barrier Notice */}
                {isR3 && (
                  <div className="mb-4 p-2.5 rounded bg-amber-950/30 border border-amber-600/30 text-[11px] font-mono-code text-amber-300">
                    <div className="flex items-center space-x-1 font-bold text-amber-400 mb-0.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>PIT-WALL ELIMINATION FILTER</span>
                    </div>
                    <span>Requires Top-Tier Qualification from Round 2.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
