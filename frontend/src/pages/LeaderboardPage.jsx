import React, { useState, useEffect } from 'react';
import { Trophy, Award, Search, Radio, Shield, Lock, Unlock, Flame, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRaceSocket } from '../context/RaceSocketContext';
import dashboardBg from '../assets/dashboard_bg.jpg';

export default function LeaderboardPage() {
  const { isAdmin } = useAuth();
  const { registerListener, isConnected } = useRaceSocket();

  const [leaderboard, setLeaderboard] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_leaderboard');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.standings) && parsed.standings.some(s => String(s.team_id).startsWith('TEAM-RED-BULL'))) {
        sessionStorage.removeItem('cloudnex_cached_leaderboard');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_leaderboard');
      return !cached;
    } catch {
      return true;
    }
  });

  // Safety timeout: Never keep the user waiting on a loading spinner for more than 750ms
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 750);
    return () => clearTimeout(safetyTimer);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityMode, setVisibilityMode] = useState('LOCKED');
  const [updating, setUpdating] = useState(false);
  const [rounds, setRounds] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_rounds');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const fetchStandings = async () => {
    try {
      const [data, roundsData] = await Promise.all([
        api.leaderboard.get(),
        api.rounds.getAll().catch(() => [])
      ]);
      setLeaderboard(data);
      setRounds(roundsData || []);
      setVisibilityMode(data.visibility_mode || 'LOCKED');
      try {
        sessionStorage.setItem('cloudnex_cached_leaderboard', JSON.stringify(data));
        if (roundsData && roundsData.length > 0) {
          sessionStorage.setItem('cloudnex_cached_rounds', JSON.stringify(roundsData));
        }
      } catch {}
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();

    const unregister = registerListener((event) => {
      if (
        event.type === 'LEADERBOARD_UPDATED' ||
        event.type === 'LEADERBOARD_SETTINGS_CHANGED' ||
        event.type === 'WINNER_ANNOUNCEMENT_UPDATED'
      ) {
        if (event.type === 'LEADERBOARD_SETTINGS_CHANGED' && event.data?.visibility_mode) {
          setVisibilityMode(event.data.visibility_mode);
        }
        fetchStandings();
      }
    });

    return () => unregister();
  }, []);

  const triggerConfetti = () => {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  };

  const handleUpdateVisibility = async (newMode) => {
    setUpdating(true);
    try {
      await api.leaderboard.updateSettings({ visibility_mode: newMode });
      setVisibilityMode(newMode);
      await fetchStandings();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const standings = leaderboard?.standings || [];
  const filtered = standings.filter(s =>
    s.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.team_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.institution?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const top3 = standings.slice(0, 3);

  const round2 = rounds.find(r => r.round_number === 2);
  const round3 = rounds.find(r => r.round_number === 3);
  const isPostRound2 = Boolean(
    (round2 && ['CLOSED', 'COMPLETED', 'EVALUATION'].includes(round2.status)) ||
    (round3 && ['LIVE', 'CLOSED', 'COMPLETED', 'EVALUATION'].includes(round3.status))
  );
  const isR3Open = Boolean(round3 && round3.status === 'LIVE');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080a0f] text-slate-300 font-race">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading standings...</span>
        </div>
      </div>
    );
  }

  // Locked state — shown to everyone except admin when leaderboard is not yet released
  const isLocked = leaderboard?.status === 'LOCKED';
  const isHidden = leaderboard?.status === 'HIDDEN';

  if ((isLocked || isHidden) && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center px-4 relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none z-0">
          <img
            src={dashboardBg}
            alt="CLOUDNEX Atmosphere"
            className="w-full h-full object-cover object-top opacity-30"
          />
          <div className="absolute inset-0 bg-[#080a0f]/85" />
        </div>
        <div className="relative z-10 max-w-lg w-full text-center">
          <div className="racing-card rounded-3xl p-10 border border-white/10 shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
              <Lock className="w-10 h-10 text-slate-400" />
            </div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-race font-bold tracking-wider mb-4">
              <span>GM UNIVERSITY &bull; IGNITRON 2K26</span>
            </div>
            <h2 className="font-race text-2xl font-black text-white mb-3">
              {isLocked ? 'Leaderboard Not Yet Released' : 'Standings Hidden'}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {isLocked
                ? 'The organizer will reveal the official standings after Round 2 evaluations are complete. Check back soon!'
                : 'The standings are temporarily hidden by the organizer.'}
            </p>
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-white/10 rounded-full text-xs font-mono-code text-slate-400">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Results will be revealed by the organizer</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* High-Tech Dashboard Background Image */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img
          src={dashboardBg}
          alt="CLOUDNEX Leaderboard Atmosphere"
          className="w-full h-full object-cover object-top opacity-40 filter brightness-95 contrast-110"
        />
        <div className="absolute inset-0 bg-[#080a0f]/75 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-[#080a0f]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080a0f]/80 via-transparent to-[#080a0f]/80" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-race font-bold tracking-wider flex items-center space-x-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>GM UNIVERSITY</span>
            </span>
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono-code font-bold">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>OFFICIAL CHAMPIONSHIP STANDINGS</span>
            </div>
          </div>

          <h1 className="font-race text-3xl sm:text-5xl font-black text-white tracking-wider">
            LEADERBOARD
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-mono-code">
            CLOUDNEX 2K26 &bull; <strong className="text-cyan-300">GM UNIVERSITY</strong> IGNITRON &bull; OFFICIAL RESULTS
          </p>

          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex items-center space-x-1.5 text-xs font-mono-code text-slate-400">
                <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span>STATUS: {leaderboard?.status || 'LOCKED'}</span>
              </div>

              <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/10">
                <button
                  onClick={() => handleUpdateVisibility('LOCKED')}
                  disabled={updating}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    visibilityMode === 'LOCKED'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </button>
                <button
                  onClick={() => handleUpdateVisibility('PUBLIC')}
                  disabled={updating}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    visibilityMode === 'PUBLIC'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Unlock className="w-3 h-3" />
                  <span>Reveal</span>
                </button>
                <button
                  onClick={() => handleUpdateVisibility('FROZEN')}
                  disabled={updating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    visibilityMode === 'FROZEN'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Freeze
                </button>
                <button
                  onClick={() => handleUpdateVisibility('ADMIN_ONLY')}
                  disabled={updating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    visibilityMode === 'ADMIN_ONLY'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hide
                </button>
              </div>
            </div>
          )}
        </div>

        {/* F1 Podium Top 3 Cards */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 max-w-5xl mx-auto items-end">
            {/* P2: Silver */}
            {top3[1] && (
              <div className="racing-card rounded-2xl p-6 border-slate-400/30 text-center relative order-2 md:order-1">
                <div className="w-12 h-12 rounded-full bg-slate-300 text-slate-900 font-race font-black text-lg mx-auto mb-3 flex items-center justify-center shadow-lg">
                  P2
                </div>
                <h4 className="font-race font-bold text-white text-base truncate">{top3[1].team_name}</h4>
                <p className="text-[11px] font-mono-code text-slate-400 truncate mt-0.5">{top3[1].institution}</p>
                <div className="font-race text-2xl font-black text-slate-200 mt-3">
                  {top3[1].total_score} <span className="text-xs text-slate-400 font-mono-code font-normal">PTS</span>
                </div>
                <span className="text-[10px] font-mono-code text-cyan-400 block mt-1">
                  GAP: +{top3[1].gap_to_leader} PTS
                </span>
              </div>
            )}

            {/* P1: Gold (Center & Elevated) */}
            {top3[0] && (
              <div
                onClick={triggerConfetti}
                className="racing-card rounded-2xl p-8 border-amber-500/50 text-center relative order-1 md:order-2 scale-105 shadow-2xl shadow-amber-950/40 cursor-pointer glow-red"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-slate-950 font-race font-black text-[10px] rounded-full uppercase tracking-wider">
                  1ST PLACE
                </div>
                <div className="w-16 h-16 rounded-full bg-amber-400 text-slate-950 font-race font-black text-2xl mx-auto mb-3 flex items-center justify-center shadow-xl shadow-amber-500/30">
                  P1
                </div>
                <h3 className="font-race font-black text-white text-xl truncate">{top3[0].team_name}</h3>
                <p className="text-xs font-mono-code text-amber-300/80 truncate mt-0.5">{top3[0].institution}</p>
                <div className="font-race text-4xl font-black text-amber-400 mt-3">
                  {top3[0].total_score} <span className="text-xs text-slate-300 font-mono-code font-normal">PTS</span>
                </div>
                <span className="text-xs font-mono-code text-emerald-400 font-bold block mt-1">
                  CHAMPIONSHIP LEADER
                </span>
              </div>
            )}

            {/* P3: Bronze */}
            {top3[2] && (
              <div className="racing-card rounded-2xl p-6 border-amber-700/30 text-center relative order-3">
                <div className="w-12 h-12 rounded-full bg-amber-700 text-white font-race font-black text-lg mx-auto mb-3 flex items-center justify-center">
                  P3
                </div>
                <h4 className="font-race font-bold text-white text-base truncate">{top3[2].team_name}</h4>
                <p className="text-[11px] font-mono-code text-slate-400 truncate mt-0.5">{top3[2].institution}</p>
                <div className="font-race text-2xl font-black text-amber-600 mt-3">
                  {top3[2].total_score} <span className="text-xs text-slate-400 font-mono-code font-normal">PTS</span>
                </div>
                <span className="text-[10px] font-mono-code text-cyan-400 block mt-1">
                  GAP: +{top3[2].gap_to_leader} PTS
                </span>
              </div>
            )}
          </div>
        )}

        {/* Full Grid Standings Table */}
        <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <h3 className="font-race text-xl font-bold text-white">FULL STANDINGS TABLE</h3>
              <p className="text-xs text-slate-400 font-mono-code mt-0.5">
                Verified results across all evaluated rounds.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search team or college..."
                className="bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-500 w-full sm:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto pt-4">
            <table className="w-full text-left text-xs font-mono-code">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-race">
                  <th className="py-3.5 px-4">Pos</th>
                  <th className="py-3.5 px-4">Team</th>
                  <th className="py-3.5 px-4">Institution</th>
                  <th className="py-3.5 px-4 text-center">R1</th>
                  <th className="py-3.5 px-4 text-center">R2</th>
                  <th className="py-3.5 px-4 text-center">R3</th>
                  <th className="py-3.5 px-4">Gap</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((team) => {
                  const isP1 = team.position === 1;
                  const isP2 = team.position === 2;
                  const isP3 = team.position === 3;

                  return (
                    <tr
                      key={team.team_id}
                      className={`hover:bg-white/5 transition-colors ${isP1 ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="py-4 px-4 font-race font-bold">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs ${
                          isP1 ? 'bg-amber-400 text-black font-black' :
                          isP2 ? 'bg-slate-300 text-black font-black' :
                          isP3 ? 'bg-amber-700 text-white font-black' :
                          'text-slate-400'
                        }`}>
                          P{team.position}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <strong className="text-white text-sm font-sans font-bold block">
                            {team.team_name}
                          </strong>
                          {isR3Open && team.is_qualified_r3 && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-500/40">
                              R3
                            </span>
                          )}
                          {isPostRound2 && team.is_eliminated && (
                            <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-400 text-[10px] font-bold border border-red-500/40">
                              OUT
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px] font-mono-code">{team.team_id}</span>
                      </td>

                      <td className="py-4 px-4 text-slate-300">{team.institution}</td>

                      <td className="py-4 px-4 text-center text-cyan-400 font-bold">
                        {team.scores_by_round?.['1'] !== undefined ? team.scores_by_round['1'] : '-'}
                      </td>

                      <td className="py-4 px-4 text-center text-red-400 font-bold">
                        {team.scores_by_round?.['2'] !== undefined ? team.scores_by_round['2'] : '-'}
                      </td>

                      <td className="py-4 px-4 text-center text-amber-400 font-bold">
                        {team.scores_by_round?.['3'] !== undefined ? team.scores_by_round['3'] : '-'}
                      </td>

                      <td className="py-4 px-4 text-slate-400">
                        {team.gap_to_leader === 0 ? (
                          <span className="text-emerald-400 font-bold">LEADER</span>
                        ) : (
                          `+${team.gap_to_leader} pts`
                        )}
                      </td>

                      <td className="py-4 px-4 text-right font-race font-black text-base text-white">
                        {team.total_score}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 font-mono-code">
                      No teams match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
