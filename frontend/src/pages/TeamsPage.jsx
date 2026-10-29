import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Radio, Search, X, LogOut, RefreshCw, CheckCircle2, AlertTriangle, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRaceSocket } from '../context/RaceSocketContext';
import { api } from '../api/client';
import dashboardBg from '../assets/dashboard_bg.jpg';

export default function TeamsPage() {
  const { user } = useAuth();
  const { registerListener, isConnected, reconnect } = useRaceSocket();

  const [teams, setTeams] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_admin_teams');
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(teams.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loggingOutTeamId, setLoggingOutTeamId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadTeams = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.admin.getTeams();
      if (Array.isArray(res)) {
        setTeams(res);
        try { sessionStorage.setItem('cloudnex_admin_teams', JSON.stringify(res)); } catch {}
      }
    } catch (err) {
      if (!silent) setErrorMsg(err.message || 'Failed to load registered teams');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();

    const unsubscribe = registerListener((event) => {
      if (event && event.type === 'TEAM_STATUS_CHANGED' && event.data) {
        const { team_id, is_online } = event.data;
        if (team_id) {
          setTeams(prev => (Array.isArray(prev) ? prev : []).map(t => {
            if (t.team_id === team_id) {
              return { ...t, is_online: !!is_online };
            }
            return t;
          }));
        }
      }
      if (event && (event.type === 'TEAM_REGISTERED' || event.type === 'USER_REGISTERED' || event.type === 'LEADERBOARD_UPDATED')) {
        loadTeams(true);
      }
    });

    // Auto-refresh telemetry every 6 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadTeams(true);
      }
    }, 6000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [registerListener]);

  const handleForceLogoutTeam = async (teamId) => {
    if (!teamId) return;
    const confirmLogout = window.confirm(`Terminate session for ${teamId}?\nThis will forcefully disconnect the team and return their participant dashboard to the main landing page.`);
    if (!confirmLogout) return;

    setLoggingOutTeamId(teamId);
    try {
      // Optimistic offline update
      setTeams(prev => (Array.isArray(prev) ? prev : []).map(t => t.team_id === teamId ? { ...t, is_online: false } : t));

      await api.admin.forceLogoutTeam(teamId);
      setSuccessMsg(`Team ${teamId} has been successfully logged out from their participant dashboard.`);
      setTimeout(() => loadTeams(true), 400);
    } catch (err) {
      setErrorMsg(err.message || `Failed to log out team ${teamId}`);
      loadTeams(true);
    } finally {
      setLoggingOutTeamId(null);
    }
  };

  const filteredTeams = teams.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (t.team_id && t.team_id.toLowerCase().includes(q)) ||
      (t.team_name && t.team_name.toLowerCase().includes(q)) ||
      (t.leader_name && t.leader_name.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.institution && t.institution.toLowerCase().includes(q))
    );
  });

  const sortedTeams = [...filteredTeams].sort((a, b) => {
    const scoreA = parseFloat(a.total_score || 0);
    const scoreB = parseFloat(b.total_score || 0);
    return scoreB - scoreA;
  });

  const onlineCount = teams.filter(t => t.is_online).length;

  const formatRegDate = (val) => {
    if (!val) return 'N/A';
    try {
      let isoStr = String(val).trim();
      if (!isoStr.endsWith('Z') && !isoStr.includes('+')) {
        isoStr += 'Z';
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(val).slice(0, 19);
      
      const datePart = d.toLocaleDateString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      return `${datePart}, ${timePart}`;
    } catch {
      return String(val);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] py-8 px-4 sm:px-8 lg:px-12">
      {/* High-Tech Dashboard Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img
          src={dashboardBg}
          alt="CLOUDNEX Registered Teams Atmosphere"
          className="w-full h-full object-cover object-top opacity-40 filter brightness-95 contrast-110"
        />
        <div className="absolute inset-0 bg-[#080a0f]/80 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-[#080a0f]/90" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-race font-bold tracking-widest uppercase flex items-center space-x-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>GM UNIVERSITY &bull; IGNITRON 2K26</span>
                </span>
                <span className="px-3 py-1 bg-cyan-600 text-white rounded-full text-xs font-race font-bold tracking-widest uppercase shadow-md shadow-cyan-950/60 flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>REGISTERED TEAMS DIRECTORY</span>
                </span>
                <button
                  type="button"
                  onClick={() => !isConnected && reconnect && reconnect()}
                  title={isConnected ? 'Telemetry active' : 'Click to reconnect telemetry'}
                  className={`flex items-center space-x-1.5 text-xs font-mono-code transition-colors ${isConnected ? 'text-emerald-400 cursor-default' : 'text-amber-400 hover:text-amber-300 cursor-pointer underline decoration-dotted'}`}
                >
                  <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                  <span>{isConnected ? 'LIVE GRID TELEMETRY' : 'DISCONNECTED (RECONNECT)'}</span>
                </button>
              </div>
              <h2 className="font-race text-2xl sm:text-3xl font-black text-white">
                REGISTERED TEAMS &amp; LIVE SESSIONS
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono-code">
                Real-time monitor of participating teams, credential details, online/offline session indicators, and remote participant session termination.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 flex items-center space-x-2.5 text-xs font-mono-code">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-bold">{onlineCount} ONLINE</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-300 font-bold">{teams.length} REGISTERED</span>
              </div>

              <button
                onClick={() => loadTeams(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-white/10 text-xs font-race flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono-code flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">&times;</button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono-code flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white">&times;</button>
          </div>
        )}

        {/* Registered Teams Table Card */}
        <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <h3 className="font-race text-xl font-bold text-white flex items-center space-x-2">
                <span>REGISTERED TEAMS DIRECTORY</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono-code font-bold">
                  {filteredTeams.length} of {teams.length} Teams
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono-code mt-1">
                Search teams by Team ID or name to inspect connection state and manage participant sessions.
              </p>
            </div>

            {/* Top Team ID Search Bar */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team by ID (e.g. TEAM-01), name..."
                className="w-full pl-10 pr-9 py-2 bg-slate-950/90 border border-cyan-500/30 focus:border-cyan-400 rounded-xl text-xs font-mono-code text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shadow-inner transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Teams Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-code">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-race">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Team &amp; ID</th>
                  <th className="py-3 px-4">Leader &amp; Contact</th>
                  <th className="py-3 px-4">Registered On</th>
                  <th className="py-3 px-4">Session Status</th>
                  <th className="py-3 px-4">Round 1</th>
                  <th className="py-3 px-4">Round 2</th>
                  <th className="py-3 px-4">Total Score</th>
                  <th className="py-3 px-4 text-right">Participant Session Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedTeams.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-mono-code bg-slate-950/30">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Search className="w-8 h-8 text-slate-600" />
                        <p className="text-sm">
                          {searchQuery
                            ? `No registered teams found matching "${searchQuery}"`
                            : 'No teams registered yet.'}
                        </p>
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="px-4 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-race font-bold uppercase transition-all"
                          >
                            Clear Search Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedTeams.map((t, idx) => {
                    const r1Pts = t.scores_by_round?.['1'];
                    const r2Pts = t.scores_by_round?.['2'];
                    const combinedScore = (parseFloat(r1Pts || 0) + parseFloat(r2Pts || 0)) > 0
                      ? (parseFloat(r1Pts || 0) + parseFloat(r2Pts || 0))
                      : parseFloat(t.total_score || 0);

                    return (
                      <tr key={t.team_id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-bold font-race text-white">#{idx + 1}</td>
                        <td className="py-3 px-4">
                          <strong className="text-white block font-sans font-bold text-sm">{t.team_name}</strong>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                              {t.team_id}
                            </span>
                            <span className="text-slate-500 text-[11px] truncate max-w-[140px]">{t.institution}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200 block font-medium">{t.leader_name || 'Leader N/A'}</span>
                          <span className="text-slate-500 text-[11px] block">{t.email || '-'}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {formatRegDate(t.registered_at)}
                        </td>
                        <td className="py-3 px-4">
                          {t.is_online ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950/50">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>ONLINE</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold bg-slate-900/90 text-slate-400 border border-white/10">
                              <span className="w-2 h-2 rounded-full bg-slate-600" />
                              <span>OFFLINE</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-cyan-400 font-bold">{r1Pts !== undefined ? `${r1Pts} pts` : '-'}</td>
                        <td className="py-3 px-4 text-red-400 font-bold">{r2Pts !== undefined ? `${r2Pts} pts` : '-'}</td>
                        <td className="py-3 px-4 font-bold text-amber-400 text-sm">{combinedScore.toFixed(1)} Pts</td>
                        <td className="py-3 px-4 text-right">
                          {t.is_online ? (
                            <button
                              type="button"
                              onClick={() => handleForceLogoutTeam(t.team_id)}
                              disabled={loggingOutTeamId === t.team_id}
                              className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 hover:text-white border border-red-700/60 text-xs font-race font-bold transition-all inline-flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Remotely terminate team session on participant dashboard"
                            >
                              <LogOut className="w-3.5 h-3.5 text-red-400" />
                              <span>{loggingOutTeamId === t.team_id ? 'Logging Out...' : 'Force Logout'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-600 font-mono-code italic pr-2">
                              Not Logged In
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
