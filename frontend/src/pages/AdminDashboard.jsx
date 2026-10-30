import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Flag, Users, Cpu, Rocket, AlertTriangle, CheckCircle2,
  Lock, Unlock, Clock, FileText, Award, Eye, EyeOff, Edit3, Save, RefreshCw,
  TrendingUp, Activity, Terminal, ArrowUpRight, ShieldAlert, Radio,
  Shuffle, Upload, Download, Layers, BarChart3, Sparkles, Check, X,
  PlusCircle, Database, HelpCircle, RotateCcw, Trophy, XCircle, ArrowLeft,
  Search, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRaceSocket } from '../context/RaceSocketContext';
import { api } from '../api/client';
import CountdownTimer from '../components/CountdownTimer';
import dashboardBg from '../assets/dashboard_bg.jpg';

export default function AdminDashboard({ initialTab = 'rounds' }) {
  const { user } = useAuth();
  const { registerListener, isConnected, broadcastLocalEvent, reconnect } = useRaceSocket();

  const [overview, setOverview] = useState(() => {
    try {
      const cached = localStorage.getItem('cloudnex_admin_overview') || sessionStorage.getItem('cloudnex_admin_overview');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.teams) && parsed.teams.some(t => String(t.team_id).startsWith('TEAM-RED-BULL'))) {
        sessionStorage.removeItem('cloudnex_admin_overview');
        localStorage.removeItem('cloudnex_admin_overview');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [teams, setTeams] = useState(() => {
    try {
      const cached = localStorage.getItem('cloudnex_admin_teams') || sessionStorage.getItem('cloudnex_admin_teams');
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.some(t => String(t.team_id).startsWith('TEAM-RED-BULL'))) {
        sessionStorage.removeItem('cloudnex_admin_teams');
        localStorage.removeItem('cloudnex_admin_teams');
        return [];
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [submissions, setSubmissions] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_admin_subs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('cloudnex_admin_overview');
    } catch {
      return true;
    }
  });
  const [activeTab, setActiveTab] = useState(initialTab); // 'rounds', 'problems', 'teams', 'evaluation', 'final_round', 'winner_announcement'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTeamQuery, setSearchTeamQuery] = useState('');
  const displayTeamCount = teams.length > 0 ? teams.length : (overview?.total_teams ? overview.total_teams : (loading ? '...' : 0));
  const [loggingOutTeamId, setLoggingOutTeamId] = useState(null);

  // Problem Allocation & Studio State
  const [allocationStats, setAllocationStats] = useState(null);
  const [problemStatements, setProblemStatements] = useState([]);
  const [selectedProblemIndex, setSelectedProblemIndex] = useState(0); // 0..9 for PS-01..PS-10
  const [allocationSubTab, setAllocationSubTab] = useState('studio'); // 'studio' or 'report'
  const [allocating, setAllocating] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetEventModalOpen, setResetEventModalOpen] = useState(false);
  const [resetEventConfirmText, setResetEventConfirmText] = useState('');
  const [isResettingEvent, setIsResettingEvent] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [jsonUploadText, setJsonUploadText] = useState('');
  const [maxTeamsInput, setMaxTeamsInput] = useState(5);
  const [autoAllocEnabled, setAutoAllocEnabled] = useState(true);

  // Round 3 Selection Announcement Timer State (in seconds)
  const [r3TimerSeconds, setR3TimerSeconds] = useState(10);
  const [settingR3Timer, setSettingR3Timer] = useState(false);

  // Winner Announcement State (Completely separated from Round 3 Selection)
  const [winnerTimerSeconds, setWinnerTimerSeconds] = useState(10);
  const [announcementCountdown, setAnnouncementCountdown] = useState(null);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [isPublishingLive, setIsPublishingLive] = useState(false);
  const isGoingLiveRef = useRef(false);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState(() => ({
    is_announced: false,
    is_timer_active: false,
    announcement_time: null,
    held: false,
    winner: null,
    runner_up: null
  }));
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const celebrationCanvasRef = useRef(null);
  const [startingRoundNum, setStartingRoundNum] = useState(null);

  // High-performance concurrency guard & background reload debouncer
  const isLoadingDataRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const debounceReloadTimerRef = useRef(null);

  // Selected round for problem editor
  const [editingRoundNum, setEditingRoundNum] = useState(1);
  const [problemForm, setProblemForm] = useState({
    problem_id: 'PS-01',
    problem_number: 1,
    title: '',
    description: '',
    max_capacity: 5,
    is_published: true
  });

  // Evaluation Form Modal State
  const [evaluations, setEvaluations] = useState([]);
  const [evalRoundFilter, setEvalRoundFilter] = useState('all'); // 'all', 1, 2, 3
  const [evalModal, setEvalModal] = useState(null); // submission or team grading object
  const [evalScores, setEvalScores] = useState({
    // Round 1 Specific Rubrics (Total 50 Marks)
    architecture_design: 10,
    service_selection: 7,
    scalability_performance: 7,
    security_protection: 6,
    high_availability: 6,
    cost_optimization: 3,
    technical_feasibility: 3,
    // Round 2 Specific Rubrics (Total 100 Marks)
    app_functionality: 12,
    cloud_deployment: 20,
    database_integration: 8,
    containerization: 8,
    auth_security: 12,
    object_storage: 8,
    monitoring_logging: 4,
    reliability_error_handling: 4,
    cloud_config_management: 4,
    // Round 3 Specific Rubrics (Total 50 Marks)
    crisis_challenge: 25,
    presentation: 16,
    // Generic / Fallback Rubrics
    innovation: 18,
    functionality: 22,
    scalability: 18,
    crisis: 18,
    blockchainBonus: 0,
    includeBonus: true,
    feedback: ''
  });

  // Blueprint / Artifact Preview Modal State
  const [previewFile, setPreviewFile] = useState(null); // { url, filename, title, isPdf }

  const loadData = async (silent = false) => {
    if (isLoadingDataRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    isLoadingDataRef.current = true;
    try {
      const results = await Promise.allSettled([
        api.admin.getOverview(),
        api.admin.getTeams(),
        api.admin.getSubmissions(),
        api.admin.getAllocationStats(),
        api.admin.getProblemStatements(),
        api.admin.getEvaluations()
      ]);

      const [ovRes, teamsRes, subsRes, allocRes, probsRes, evalsRes] = results;

      if (ovRes.status === 'fulfilled') {
        setOverview(ovRes.value);
        try {
          sessionStorage.setItem('cloudnex_admin_overview', JSON.stringify(ovRes.value));
          localStorage.setItem('cloudnex_admin_overview', JSON.stringify(ovRes.value));
        } catch {}
        if (ovRes.value?.winner_announcement) {
          const wAnn = ovRes.value.winner_announcement;
          setWinnerAnnouncement(prev => {
            // Guard active timer from being overwritten by stale server response
            if (prev?.is_timer_active && !prev?.is_announced && !wAnn?.is_timer_active && !wAnn?.is_announced) {
              return prev;
            }
            return wAnn;
          });
        }
      } else {
        console.error('Failed to load overview:', ovRes.reason);
      }

      if (teamsRes.status === 'fulfilled') {
        setTeams(teamsRes.value);
        try {
          sessionStorage.setItem('cloudnex_admin_teams', JSON.stringify(teamsRes.value));
          localStorage.setItem('cloudnex_admin_teams', JSON.stringify(teamsRes.value));
        } catch {}
      } else {
        console.error('Failed to load teams:', teamsRes.reason);
      }

      if (subsRes.status === 'fulfilled') {
        setSubmissions(subsRes.value);
        try { sessionStorage.setItem('cloudnex_admin_subs', JSON.stringify(subsRes.value)); } catch {}
      } else {
        console.error('Failed to load submissions:', subsRes.reason);
      }

      if (allocRes.status === 'fulfilled') {
        setAllocationStats(allocRes.value);
        if (allocRes.value?.max_teams_per_problem) {
          setMaxTeamsInput(allocRes.value.max_teams_per_problem);
        }
        if (allocRes.value?.is_automatic_enabled !== undefined) {
          setAutoAllocEnabled(allocRes.value.is_automatic_enabled);
        }
      } else {
        console.error('Failed to load allocation stats:', allocRes.reason);
      }

      if (probsRes.status === 'fulfilled') {
        setProblemStatements(probsRes.value);
      } else {
        console.error('Failed to load problem statements:', probsRes.reason);
      }

      if (evalsRes && evalsRes.status === 'fulfilled') {
        setEvaluations(evalsRes.value || []);
      } else if (evalsRes?.reason) {
        console.error('Failed to load evaluations:', evalsRes.reason);
      }

      // If overview or teams failed due to 401/403, notify the admin
      if (ovRes.status === 'rejected') {
        const msg = ovRes.reason?.message || '';
        if (msg.includes('403')) {
          setErrorMsg('Session conflict detected: A participant portal was opened in another window, overriding your admin session. Please log in again.');
        } else if (msg.includes('401') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('validate')) {
          setErrorMsg('Admin session expired or credentials could not be validated. Please sign in again.');
        }
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      if (!silent) setLoading(false);
      isLoadingDataRef.current = false;
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        loadData(true);
      }
    }
  };

  const scheduleLoadData = (delay = 300) => {
    if (debounceReloadTimerRef.current) clearTimeout(debounceReloadTimerRef.current);
    debounceReloadTimerRef.current = setTimeout(() => {
      loadData(true);
    }, delay);
  };

  useEffect(() => {
    loadData();
    // Safety fallback: Never keep the screen blocked for more than 750ms
    const safetyTimer = setTimeout(() => setLoading(false), 3500);

    // Listen to real-time socket and cross-tab events
    const unregister = registerListener((event) => {
      if (event.type === 'TEAM_REGISTERED' && event.data) {
        const newTeam = event.data.team || event.data;
        if (newTeam && newTeam.team_id) {
          setTeams(prevTeams => {
            const list = Array.isArray(prevTeams) ? prevTeams : [];
            if (list.some(t => t.team_id === newTeam.team_id)) return list;
            return [newTeam, ...list];
          });
          setOverview(prev => prev ? ({ ...prev, total_teams: (prev.total_teams || 0) + 1 }) : prev);
          scheduleLoadData(100);
        }
        return;
      }
      if (event.type === 'NEW_SUBMISSION' && event.data) {
        const newSub = event.data;
        // Instantly reflect new submission on Admin UI in 0ms!
        setSubmissions(prevSubs => {
          const list = Array.isArray(prevSubs) ? prevSubs : [];
          const exists = list.some(s => s.team_id === newSub.team_id && Number(s.round_number) === Number(newSub.round_number));
          if (exists) {
            return list.map(s => (s.team_id === newSub.team_id && Number(s.round_number) === Number(newSub.round_number)) ? { ...s, ...newSub, updated_at: newSub.submitted_at } : s);
          }
          return [{ ...newSub, id: `sub_${Date.now()}`, is_new: true }, ...list];
        });
        setOverview(prev => prev ? ({ ...prev, total_submissions: (prev.total_submissions || 0) + 1 }) : prev);
        scheduleLoadData(150);
        return;
      }

      if (event.type === 'TEAM_STATUS_CHANGED' && event.data) {
        const { team_id, is_online } = event.data;
        if (team_id) {
          setTeams(prevTeams => (Array.isArray(prevTeams) ? prevTeams : []).map(t => {
            if (t.team_id === team_id) {
              return { ...t, is_online: !!is_online };
            }
            return t;
          }));
        }
        scheduleLoadData(200);
        return;
      }

      if (
        event.type === 'ROUND_STATUS_CHANGED' ||
        event.type === 'LEADERBOARD_UPDATED' ||
        event.type === 'QUALIFICATIONS_UPDATED' ||
        event.type === 'PROBLEMS_ALLOCATED' ||
        event.type === 'PROBLEMS_ALLOCATION_RESET' ||
        event.type === 'PROBLEM_PUBLISHED' ||
        event.type === 'PROBLEM_UNPUBLISHED' ||
        event.type === 'ROUND_3_RESULTS_TIMER' ||
        event.type === 'WINNER_ANNOUNCEMENT_UPDATED'
      ) {
        if (event.type === 'WINNER_ANNOUNCEMENT_UPDATED' && event.data) {
          setWinnerAnnouncement(event.data);
          if (event.data.is_announced) {
            setIsAnnouncing(false);
            setAnnouncementCountdown(null);
          } else if (event.data.is_timer_active && event.data.announcement_time) {
            setIsAnnouncing(true);
            const skew = (typeof window !== 'undefined' && window.__cloudnex_server_time_skew) || 0;
            const targetMs = parseUtcDate(event.data.announcement_time);
            const rem = Math.max(0, Math.ceil((targetMs - (Date.now() + skew)) / 1000));
            setAnnouncementCountdown(rem);
          }
        }
        if (event.type === 'ROUND_STATUS_CHANGED' && event.data) {
          setOverview(prev => {
            if (!prev) return prev;
            const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
            const updatedRounds = prevRounds.map(r => {
              if (Number(r.round_number) === Number(event.data.round_number)) {
                return { ...r, ...event.data };
              }
              return r;
            });
            const liveRound = updatedRounds.find(r => r.status === 'LIVE')?.round_number || null;
            return { ...prev, current_live_round: liveRound, rounds: updatedRounds };
          });
        }
        if (event.type !== 'ROUND_STATUS_CHANGED' && event.type !== 'WINNER_ANNOUNCEMENT_UPDATED') {
          scheduleLoadData(200);
        }
      }
    });

    // Adaptive Admin Sync Heartbeat (paused during live countdowns to guarantee zero lag and prevent state wipe)
    const adminHeartbeat = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (!isGoingLiveRef.current && !isAnnouncing && !winnerAnnouncement?.is_timer_active) {
          loadData(true);
        }
      }
    }, 5000);

    const handleAdminFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    };

    window.addEventListener('focus', handleAdminFocus);
    document.addEventListener('visibilitychange', handleAdminFocus);

    return () => {
      clearTimeout(safetyTimer);
      clearInterval(adminHeartbeat);
      window.removeEventListener('focus', handleAdminFocus);
      document.removeEventListener('visibilitychange', handleAdminFocus);
      if (debounceReloadTimerRef.current) clearTimeout(debounceReloadTimerRef.current);
      unregister();
    };
  }, []);

  // Update Problem Editor form when problem selection changes
  useEffect(() => {
    if (problemStatements && problemStatements.length > 0) {
      const p = problemStatements[selectedProblemIndex] || problemStatements[0];
      if (p) {
        setProblemForm({
          problem_id: p.problem_id || `PS-${(selectedProblemIndex + 1).toString().padStart(2, '0')}`,
          problem_number: p.problem_number || (selectedProblemIndex + 1),
          title: p.title || '',
          description: p.description || p.scenario || '',
          max_capacity: p.max_capacity || maxTeamsInput || 5,
          is_published: p.is_published !== false
        });
      }
    }
  }, [selectedProblemIndex, problemStatements]);

  // Round Management Handlers (Instant Optimistic Updates)
  const handleOpenRound = async (roundNumber, deadlineMinutes = null, publishProblems = true) => {
    try {
      if (roundNumber === 1) {
        const hasAllocatedTeams = (allocationStats && allocationStats.total_allocated_teams > 0) ||
          (Array.isArray(teams) && teams.some(t => Boolean(t.assigned_problem_id || t.problem_statement_id)));
        if (!hasAllocatedTeams) {
          setErrorMsg("Cannot start Round 1: Problem statements have not been distributed to teams yet. Please allocate problem statements in the 'Problem Allocation' tab before starting Round 1.");
          return;
        }
      }
      if (roundNumber === 3) {
        const hasQualifiedTeams = Array.isArray(teams) && teams.some(t => t.is_qualified_r3);
        if (!hasQualifiedTeams) {
          setErrorMsg("Cannot start Round 3: No teams have been selected or qualified for Round 3 yet. Please qualify teams from the Evaluation or Standings tab before starting Round 3.");
          return;
        }
      }
      setStartingRoundNum(roundNumber);
      setErrorMsg('');
      const defaultMins = roundNumber === 1 ? 45 : (roundNumber === 2 ? 210 : null);
      const mins = roundNumber === 3 ? null : (deadlineMinutes !== null ? deadlineMinutes : defaultMins);
      const label = roundNumber === 3 ? 'Untimed (No Timer)' : (mins < 60 ? `${mins} minutes` : `${(mins / 60).toFixed(1)} hours`);
      const subOpen = roundNumber === 1 || roundNumber === 2;

      // Single-click guarantee: await server response first so database state is confirmed
      const res = await api.admin.openRound(roundNumber, mins, true);
      const confirmedDeadline = roundNumber === 3 ? null : (res?.deadline || (mins ? new Date(Date.now() + mins * 60000).toISOString() : null));
      const confirmedStartTime = res?.start_time || new Date().toISOString();

      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === Number(roundNumber)) {
            return {
              ...r,
              status: 'LIVE',
              is_active: true,
              start_time: confirmedStartTime,
              deadline: confirmedDeadline,
              duration_minutes: mins,
              submissions_open: subOpen,
              problem_published: roundNumber === 3 ? false : true
            };
          }
          return r;
        });
        return {
          ...prev,
          current_live_round: roundNumber,
          rounds: updatedRounds
        };
      });
      setProblemStatements(prev => (prev || []).map(p => ({ ...p, is_published: true })));
      setSuccessMsg(`Round ${roundNumber} started live with ${label} timer!`);

      // Broadcast confirmed live round event
      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('ROUND_STATUS_CHANGED', {
          round_number: roundNumber,
          status: 'LIVE',
          is_active: true,
          start_time: confirmedStartTime,
          deadline: confirmedDeadline,
          duration_minutes: mins,
          submissions_open: subOpen,
          problem_published: true
        });
      }
    } catch (err) {
      setErrorMsg(err.message || `Failed to open Round ${roundNumber}`);
    } finally {
      setStartingRoundNum(null);
    }
  };

  const handleCloseRound = async (roundNumber) => {
    try {
      setErrorMsg('');
      // Single-click guarantee: await server response first
      await api.admin.closeRound(roundNumber);

      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === Number(roundNumber)) {
            return {
              ...r,
              status: 'CLOSED',
              is_active: false,
              submissions_open: false
            };
          }
          return r;
        });
        return {
          ...prev,
          current_live_round: prev.current_live_round === roundNumber ? null : prev.current_live_round,
          rounds: updatedRounds
        };
      });
      setSuccessMsg(`Round ${roundNumber} closed. Submissions locked.`);

      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('ROUND_STATUS_CHANGED', {
          round_number: roundNumber,
          status: 'CLOSED',
          is_active: false,
          submissions_open: false
        });
      }
    } catch (err) {
      setErrorMsg(err.message || `Failed to close Round ${roundNumber}`);
    }
  };

  const handlePublishProblems = async (roundNumber = 1) => {
    try {
      setErrorMsg('');
      // OPTIMISTIC UPDATE IMMEDIATELY
      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === Number(roundNumber)) {
            return { ...r, problem_published: true };
          }
          return r;
        });
        return { ...prev, rounds: updatedRounds };
      });
      setAllocationStats(prev => prev ? ({ ...prev, is_published: true }) : prev);
      setProblemStatements(prev => (prev || []).map(p => ({ ...p, is_published: true })));
      setSuccessMsg(`Problem statements for Round ${roundNumber} approved & published! Now live to participants.`);

      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('PROBLEM_PUBLISHED', { round_number: roundNumber, problem_published: true });
        broadcastLocalEvent('ROUND_STATUS_CHANGED', { round_number: roundNumber, problem_published: true });
      }

      api.admin.publishProblems(roundNumber)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to approve and publish problem statements');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to approve and publish problem statements');
    }
  };

  const handleUnpublishProblems = async (roundNumber = 1) => {
    try {
      setErrorMsg('');
      // OPTIMISTIC UPDATE IMMEDIATELY
      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === Number(roundNumber)) {
            return { ...r, problem_published: false };
          }
          return r;
        });
        return { ...prev, rounds: updatedRounds };
      });
      setAllocationStats(prev => prev ? ({ ...prev, is_published: false }) : prev);
      setProblemStatements(prev => (prev || []).map(p => ({ ...p, is_published: false })));
      setSuccessMsg(`Problem statements for Round ${roundNumber} unpublished.`);

      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('PROBLEM_UNPUBLISHED', { round_number: roundNumber });
        broadcastLocalEvent('ROUND_STATUS_CHANGED', { round_number: roundNumber, problem_published: false });
      }

      api.admin.unpublishProblems(roundNumber)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to unpublish problem statements');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to unpublish problem statements');
    }
  };

  const handleReopenRound = async (roundNumber, deadlineMinutes = null) => {
    try {
      if (roundNumber === 1) {
        const hasAllocatedTeams = (allocationStats && allocationStats.total_allocated_teams > 0) ||
          (Array.isArray(teams) && teams.some(t => Boolean(t.assigned_problem_id || t.problem_statement_id)));
        if (!hasAllocatedTeams) {
          setErrorMsg("Cannot start Round 1: Problem statements have not been distributed to teams yet. Please allocate problem statements in the 'Problem Allocation' tab before starting Round 1.");
          return;
        }
      }
      setStartingRoundNum(roundNumber);
      setErrorMsg('');
      const defaultMins = roundNumber === 1 ? 45 : (roundNumber === 2 ? 210 : 180);
      const mins = deadlineMinutes !== null ? deadlineMinutes : defaultMins;
      const label = mins < 60 ? `${mins} minutes` : `${(mins / 60).toFixed(1)} hours`;
      const subOpen = roundNumber === 1 || roundNumber === 2;

      // Single-click guarantee: await server response first
      const res = await api.admin.reopenRound(roundNumber, mins, true);
      const confirmedDeadline = res?.deadline || new Date(Date.now() + mins * 60000).toISOString();
      const confirmedStartTime = res?.start_time || new Date().toISOString();

      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === Number(roundNumber)) {
            return {
              ...r,
              status: 'LIVE',
              is_active: true,
              start_time: confirmedStartTime,
              deadline: confirmedDeadline,
              duration_minutes: mins,
              submissions_open: subOpen,
              problem_published: true
            };
          }
          return r;
        });
        return {
          ...prev,
          current_live_round: roundNumber,
          rounds: updatedRounds
        };
      });
      setProblemStatements(prev => (prev || []).map(p => ({ ...p, is_published: true })));
      setSuccessMsg(`Round ${roundNumber} started live with ${label} timer!`);

      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('ROUND_STATUS_CHANGED', {
          round_number: roundNumber,
          status: 'LIVE',
          is_active: true,
          start_time: confirmedStartTime,
          deadline: confirmedDeadline,
          duration_minutes: mins,
          submissions_open: subOpen,
          problem_published: true
        });
      }
    } catch (err) {
      setErrorMsg(err.message || `Failed to start Round ${roundNumber}`);
    } finally {
      setStartingRoundNum(null);
    }
  };

  const handleToggleSubmissions = async (roundNumber, open) => {
    try {
      setErrorMsg('');
      await api.admin.toggleSubmissions(roundNumber, open);

      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === Number(roundNumber)) {
            return { ...r, submissions_open: open };
          }
          return r;
        });
        return { ...prev, rounds: updatedRounds };
      });
      setSuccessMsg(`Submissions for Round ${roundNumber} are now ${open ? 'OPEN' : 'CLOSED'}.`);

      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('ROUND_STATUS_CHANGED', {
          round_number: roundNumber,
          submissions_open: open
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle submissions');
    }
  };

  // Round 3 Results & Selection Announcement Handler (in seconds)
  const handleSetResultsTimer = async (action = 'set', seconds = r3TimerSeconds) => {
    try {
      if (action === 'set' || action === 'announce_now') {
        const hasQualified = Array.isArray(teams) && teams.some(t => t.is_qualified_r3);
        if (!hasQualified) {
          setErrorMsg("Cannot announce Round 3 qualifiers: No teams have been selected or qualified for Round 3 yet. Please qualify teams in the Evaluation tab first.");
          return;
        }
      }
      setSettingR3Timer(true);
      setErrorMsg('');

      // OPTIMISTIC UPDATE IMMEDIATELY
      setOverview(prev => {
        if (!prev) return prev;
        const prevRounds = Array.isArray(prev.rounds) ? prev.rounds : [];
        const updatedRounds = prevRounds.map(r => {
          if (Number(r.round_number) === 3) {
            const isSet = action === 'set';
            return {
              ...r,
              results_timer_active: isSet,
              results_timer_seconds: isSet ? seconds : null,
              results_announcement_time: isSet ? new Date(Date.now() + seconds * 1000).toISOString() : null,
              results_announced: action === 'announce_now' ? true : (action === 'clear' ? false : r.results_announced),
              selection_revealed: action === 'announce_now' ? true : (action === 'clear' ? false : r.selection_revealed),
              results_held: action === 'hold' ? true : (action === 'announce_now' || action === 'set' ? false : r.results_held)
            };
          }
          return r;
        });
        return { ...prev, rounds: updatedRounds };
      });

      setSuccessMsg(
        action === 'announce_now'
          ? 'Round 3 qualifiers revealed live immediately!'
          : action === 'hold'
          ? 'Round 3 qualifiers concealed.'
          : action === 'clear'
          ? 'Round 3 results countdown reset.'
          : `Round 3 countdown initiated (${seconds}s)!`
      );

      if (typeof broadcastLocalEvent === 'function') {
        const isSet = action === 'set';
        broadcastLocalEvent('ROUND_3_RESULTS_TIMER', {
          round_number: 3,
          results_timer_active: isSet,
          results_announcement_time: isSet ? new Date(Date.now() + seconds * 1000).toISOString() : null,
          results_announced: action === 'announce_now',
          selection_revealed: action === 'announce_now',
          results_held: action === 'hold'
        });
        broadcastLocalEvent('ROUND_STATUS_CHANGED', {
          round_number: 3,
          results_timer_active: isSet,
          results_announced: action === 'announce_now',
          selection_revealed: action === 'announce_now',
          results_held: action === 'hold'
        });
      }

      api.admin.setResultsTimer(3, seconds, action)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to update results announcement timer');
          loadData(true);
        })
        .finally(() => setSettingR3Timer(false));
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update results announcement timer');
      setSettingR3Timer(false);
    }
  };

  const parseUtcDate = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    const hasTimezone = str.endsWith('Z') || str.includes('+') || (str.split('-').length > 3);
    const formatted = hasTimezone ? str : `${str}Z`;
    const parsed = new Date(formatted).getTime();
    return isNaN(parsed) ? new Date(str).getTime() : parsed;
  };

  const handleGoLiveInstant = async () => {
    const hasQualified = Array.isArray(teams) && teams.some(t => t.is_qualified_r3);
    if (!hasQualified) {
      setErrorMsg("Cannot announce winners: No teams have been qualified for Round 3 yet. Please qualify teams for Round 3 first.");
      return;
    }

    // Determine winner and runner up automatically from round 3 marks
    const qualifiedTeams = [...(teams || [])]
      .filter(t => t.is_qualified_r3)
      .sort((a, b) => {
        const scA = parseFloat(a.scores_by_round?.['3'] ?? a.r3_score ?? 0);
        const scB = parseFloat(b.scores_by_round?.['3'] ?? b.r3_score ?? 0);
        return scB - scA;
      });

    const optWinner = winnerAnnouncement?.winner || overview?.winner_announcement?.winner || (qualifiedTeams[0] ? {
      team_id: qualifiedTeams[0].team_id,
      team_name: qualifiedTeams[0].team_name,
      institution: qualifiedTeams[0].institution,
      r3_score: parseFloat(qualifiedTeams[0].scores_by_round?.['3'] ?? qualifiedTeams[0].r3_score ?? 0)
    } : null);

    const optRunnerUp = winnerAnnouncement?.runner_up || overview?.winner_announcement?.runner_up || (qualifiedTeams[1] ? {
      team_id: qualifiedTeams[1].team_id,
      team_name: qualifiedTeams[1].team_name,
      institution: qualifiedTeams[1].institution,
      r3_score: parseFloat(qualifiedTeams[1].scores_by_round?.['3'] ?? qualifiedTeams[1].r3_score ?? 0)
    } : null);

    const instantWinnerDoc = {
      key: 'winner_announcement',
      is_announced: true,
      is_timer_active: false,
      announcement_time: null,
      held: false,
      winner: optWinner,
      runner_up: optRunnerUp
    };

    // INSTANT 0ms TRANSITION:
    // Instantly reveal the celebration announcement without waiting for the network!
    setWinnerAnnouncement(instantWinnerDoc);
    setIsAnnouncing(false);
    setAnnouncementCountdown(null);
    setAnnouncementDismissed(false);
    setIsPublishingLive(false);

    if (typeof broadcastLocalEvent === 'function') {
      broadcastLocalEvent('WINNER_ANNOUNCEMENT_UPDATED', instantWinnerDoc);
    }

    try {
      const res = await api.admin.setWinnerAnnouncement('announce_now', 0);
      if (res) {
        const finalizedDoc = {
          key: 'winner_announcement',
          is_announced: true,
          is_timer_active: false,
          announcement_time: null,
          held: false,
          winner: res.winner || optWinner,
          runner_up: res.runner_up || optRunnerUp
        };
        setWinnerAnnouncement(finalizedDoc);
        if (typeof broadcastLocalEvent === 'function') {
          broadcastLocalEvent('WINNER_ANNOUNCEMENT_UPDATED', finalizedDoc);
        }
      }
      setSuccessMsg('🏆 WINNER & 1ST RUNNER UP ARE NOW LIVE ACROSS ALL PORTALS!');
    } catch (err) {
      console.warn('Background winner announcement live sync:', err);
    } finally {
      isGoingLiveRef.current = false;
    }
  };

  // High-precision live ticker for winner announcement countdown (only re-renders on second change)
  useEffect(() => {
    const wAnn = winnerAnnouncement?.is_timer_active
      ? winnerAnnouncement
      : overview?.winner_announcement;

    if (wAnn?.is_announced) {
      setIsAnnouncing(false);
      setAnnouncementCountdown(null);
      setIsPublishingLive(false);
      isGoingLiveRef.current = false;
      return;
    }

    if (wAnn?.is_timer_active && wAnn?.announcement_time && !wAnn?.is_announced) {
      const targetTime = parseUtcDate(wAnn.announcement_time);
      setIsAnnouncing(true);

      const tick = () => {
        const skew = (typeof window !== 'undefined' && window.__cloudnex_server_time_skew) || 0;
        const now = Date.now() + skew;
        const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
        setAnnouncementCountdown(prev => prev === remaining ? prev : remaining);

        if (remaining <= 0) {
          if (!isGoingLiveRef.current) {
            isGoingLiveRef.current = true;
            handleGoLiveInstant();
          }
        }
      };

      tick();
      const interval = setInterval(tick, 250);
      return () => clearInterval(interval);
    } else {
      if (!isGoingLiveRef.current && !isPublishingLive) {
        setIsAnnouncing(false);
        setAnnouncementCountdown(null);
      }
    }
  }, [
    winnerAnnouncement?.is_timer_active,
    winnerAnnouncement?.announcement_time,
    winnerAnnouncement?.is_announced,
    overview?.winner_announcement?.is_timer_active,
    overview?.winner_announcement?.announcement_time,
    overview?.winner_announcement?.is_announced
  ]);

  const handleStartGoLive = async (seconds = 10) => {
    const hasQualified = Array.isArray(teams) && teams.some(t => t.is_qualified_r3);
    if (!hasQualified) {
      setErrorMsg("Cannot announce winners: No teams have been qualified for Round 3 yet. Please qualify teams for Round 3 first.");
      return;
    }
    if (seconds <= 0) {
      return await handleGoLiveInstant();
    }
    if (isPublishingLive) return;
    setIsPublishingLive(true);

    try {
      setErrorMsg('');
      setAnnouncementDismissed(false);
      isGoingLiveRef.current = false;

      // Single-click guarantee: await server confirmation
      const res = await api.admin.setWinnerAnnouncement('set', seconds);

      const targetIso = res?.announcement_time || new Date(Date.now() + seconds * 1000).toISOString();
      const nextWinnerDoc = {
        key: 'winner_announcement',
        is_timer_active: true,
        is_announced: false,
        timer_seconds: seconds,
        announcement_time: targetIso,
        held: false,
        winner: res?.winner || winnerAnnouncement?.winner,
        runner_up: res?.runner_up || winnerAnnouncement?.runner_up
      };

      setWinnerAnnouncement(nextWinnerDoc);
      setIsAnnouncing(true);
      setAnnouncementCountdown(seconds);

      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('WINNER_ANNOUNCEMENT_UPDATED', nextWinnerDoc);
      }

      setSuccessMsg(`🚀 Winner Go Live countdown initiated (${seconds}s)!`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start countdown');
      setIsAnnouncing(false);
      setAnnouncementCountdown(null);
      isGoingLiveRef.current = false;
    } finally {
      setIsPublishingLive(false);
    }
  };

  const handleResetGoLive = async () => {
    try {
      setIsAnnouncing(false);
      setIsPublishingLive(false);
      setAnnouncementCountdown(null);
      setAnnouncementDismissed(false);
      isGoingLiveRef.current = false;

      // OPTIMISTIC RESET IMMEDIATELY
      setWinnerAnnouncement(prev => ({
        ...prev,
        is_announced: false,
        is_timer_active: false,
        announcement_time: null,
        held: false
      }));
      setSuccessMsg('Winner announcement reset to Draft mode.');

      api.admin.setWinnerAnnouncement('clear', 0)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to reset announcement');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset announcement');
    }
  };

  const handleHideWinnerBroadcast = async () => {
    try {
      setIsAnnouncing(false);
      setIsPublishingLive(false);
      setAnnouncementCountdown(null);
      setAnnouncementDismissed(false);
      isGoingLiveRef.current = false;

      // OPTIMISTIC CONCEAL IMMEDIATELY
      setWinnerAnnouncement(prev => ({
        ...prev,
        held: true
      }));
      setSuccessMsg('Winner announcement concealed / hidden from participants.');

      api.admin.setWinnerAnnouncement('hold', 0)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to conceal winner announcement');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to conceal winner announcement');
    }
  };

  // Lock body & html scrolling while the announcement overlay is live, up until Back or Reset is clicked
  useEffect(() => {
    const isLiveOverlay = Boolean(
      activeTab === 'winner_announcement' &&
      winnerAnnouncement?.is_announced &&
      !announcementDismissed
    );

    if (isLiveOverlay) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, [activeTab, winnerAnnouncement, announcementDismissed]);

  // High-performance, lightweight celebration animation (paper blast ribbons + fireworks sparks)
  useEffect(() => {
    const isLive = Boolean(
      activeTab === 'winner_announcement' &&
      winnerAnnouncement?.is_announced &&
      !announcementDismissed
    );
    if (!isLive) return;

    const canvas = celebrationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    // Rich 16-colour palette for maximum visual impact
    const colors = ['#f59e0b','#fbbf24','#fde047','#ef4444','#f97316','#10b981','#06b6d4','#38bdf8','#ffffff','#ec4899','#a855f7','#c084fc','#34d399','#fb923c','#facc15','#67e8f9'];
    const goldColors = ['#f59e0b','#fbbf24','#fde047','#facc15','#fef08a','#ffffff'];

    // Draw a 5-point star (used as a particle shape)
    const drawStar = (ctx, cx, cy, spikes, outerR, innerR) => {
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerR);
      ctx.closePath();
      ctx.fill();
    };

    const createCrackerBurst = (x, y, big = false) => {
      if (particles.length > 200) return;
      const count = big ? 65 : 42;
      const burstColor = colors[Math.floor(Math.random() * colors.length)];
      const goldBurst = Math.random() > 0.6;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * (big ? 7.5 : 5.5) + 2.5;
        const shape = ['spark','circle','star','ribbon'][Math.floor(Math.random() * 4)];
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (big ? 2 : 1.5),
          color: goldBurst
            ? goldColors[Math.floor(Math.random() * goldColors.length)]
            : (Math.random() > 0.35 ? burstColor : colors[Math.floor(Math.random() * colors.length)]),
          size: Math.random() * (big ? 5.5 : 4.5) + 2.5,
          alpha: 1,
          decay: Math.random() * 0.018 + 0.007,
          shape,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.25,
          trail: []
        });
      }
    };

    // Paper blast ribbons — denser & wider
    const paperCount = 90;
    const papers = [];
    const cw = canvas.width || window.innerWidth || 1280;
    const ch = canvas.height || window.innerHeight || 800;
    for (let i = 0; i < paperCount; i++) {
      const isRibbon = Math.random() > 0.55;
      papers.push({
        x: Math.random() * cw,
        y: Math.random() * ch * 1.4 - ch * 0.5,
        vx: (Math.random() - 0.5) * 2.4,
        vy: Math.random() * 2.5 + 1.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        width:  isRibbon ? Math.random() * 14 + 6  : Math.random() * 10 + 5,
        height: isRibbon ? Math.random() * 4  + 2  : Math.random() * 8  + 4,
        tilt: Math.random() * Math.PI * 2,
        tiltSpeed: (Math.random() - 0.5) * 0.12 + 0.04,
        isRibbon
      });
    }

    // Staggered initial mega bursts across the top
    createCrackerBurst(cw * 0.15, ch * 0.2, true);
    createCrackerBurst(cw * 0.50, ch * 0.12, true);
    createCrackerBurst(cw * 0.85, ch * 0.2, true);
    createCrackerBurst(cw * 0.30, ch * 0.28);
    createCrackerBurst(cw * 0.70, ch * 0.28);

    let frame = 0;
    const render = () => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      // Staggered burst schedule for sustained spectacle
      if (frame % 38 === 0) {
        createCrackerBurst(
          Math.random() * (canvas.width * 0.85) + canvas.width * 0.075,
          Math.random() * (canvas.height * 0.45) + canvas.height * 0.05,
          Math.random() > 0.55
        );
      }
      // Occasional mega centre burst
      if (frame % 180 === 0) {
        createCrackerBurst(canvas.width * 0.5, canvas.height * 0.18, true);
      }

      // Render paper blast confetti
      for (let i = 0; i < papers.length; i++) {
        const p = papers[i];
        p.y += p.vy;
        p.x += p.vx;
        p.tilt += p.tiltSpeed;
        if (p.y > canvas.height + 30) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(p.tilt) * (p.isRibbon ? 1.8 : 0.8));
        if (p.isRibbon) {
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Render cracker explosion particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.055;
        pt.vx *= 0.99;
        pt.alpha -= pt.decay;
        pt.rotation += pt.rotationSpeed;

        if (pt.alpha <= 0) { particles.splice(i, 1); continue; }

        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation);

        if (pt.shape === 'spark') {
          ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size * 2.5, pt.size * 0.65);
        } else if (pt.shape === 'ribbon') {
          ctx.fillRect(-pt.size, -pt.size * 0.35, pt.size * 2.8, pt.size * 0.7);
        } else if (pt.shape === 'star') {
          drawStar(ctx, 0, 0, 5, pt.size, pt.size * 0.42);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, pt.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [activeTab, Boolean(winnerAnnouncement?.is_announced), announcementDismissed]);

  // Save Problem Statement
  const handleSaveProblem = async (e) => {
    e.preventDefault();
    try {
      setErrorMsg('');
      const pid = problemForm.problem_id || `PS-${(selectedProblemIndex + 1).toString().padStart(2, '0')}`;
      const updatedFields = {
        title: problemForm.title,
        description: problemForm.description,
        scenario: problemForm.description,
        max_capacity: Number(problemForm.max_capacity) || 5,
        is_published: problemForm.is_published
      };

      // Optimistic update
      setProblemStatements(prev => (prev || []).map(p => {
        if (p.problem_id === pid) {
          return { ...p, ...updatedFields };
        }
        return p;
      }));

      setSuccessMsg(`Problem statement ${pid} successfully updated!`);

      api.admin.updateProblemStatement(pid, updatedFields)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to update problem statement');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update problem statement');
    }
  };

  // Allocation Handlers
  const handleAllocateProblems = async () => {
    try {
      setAllocating(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await api.admin.allocateProblems(false);
      setSuccessMsg(res.message || 'Problem statements randomly allocated to all eligible teams!');
      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('PROBLEMS_ALLOCATED', { timestamp: new Date().toISOString() });
      }
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to allocate problem statements');
    } finally {
      setAllocating(false);
    }
  };

  const handleResetAllocation = async () => {
    try {
      if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
        setErrorMsg('You must type RESET to confirm pool reallocation.');
        return;
      }
      setErrorMsg('');
      const res = await api.admin.resetAllocation('RESET', resetReason || 'Manual reset from Race Control');
      setSuccessMsg(res.message || 'Allocation successfully reset.');
      setResetModalOpen(false);
      setResetConfirmText('');
      setResetReason('');
      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('PROBLEMS_ALLOCATION_RESET', { timestamp: new Date().toISOString() });
      }
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset allocation');
    }
  };

  const handleResetEntireEvent = async () => {
    try {
      if (resetEventConfirmText.trim().toUpperCase() !== 'RESET') {
        setErrorMsg('You must type RESET to confirm full event reset.');
        return;
      }
      setIsResettingEvent(true);
      setErrorMsg('');
      const res = await api.admin.resetEvent('RESET');
      setProblemStatements(prev => (prev || []).map(p => ({ ...p, is_published: false })));
      setSuccessMsg(res.message || 'Entire event successfully reset to the beginning! All users and teams are preserved.');
      setResetEventModalOpen(false);
      setResetEventConfirmText('');
      if (typeof broadcastLocalEvent === 'function') {
        broadcastLocalEvent('EVENT_RESET', { timestamp: new Date().toISOString() });
        broadcastLocalEvent('PROBLEMS_ALLOCATION_RESET', { timestamp: new Date().toISOString() });
      }
      await loadData(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset entire event');
    } finally {
      setIsResettingEvent(false);
    }
  };

  const handleUpdateCapacity = async (val) => {
    try {
      const num = Number(val);
      if (isNaN(num) || num < 1) return;
      setMaxTeamsInput(num);
      setAllocationStats(prev => prev ? ({ ...prev, max_teams_per_problem: num }) : prev);
      setSuccessMsg(`Configured maximum capacity to ${num} teams per problem.`);

      api.admin.updateAllocationConfig({ max_teams_per_problem: num })
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to update capacity');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update capacity');
    }
  };

  const handleToggleAutoAlloc = async (enabled) => {
    try {
      setAutoAllocEnabled(enabled);
      setAllocationStats(prev => prev ? ({ ...prev, is_automatic_enabled: enabled }) : prev);
      setSuccessMsg(`Automatic problem allocation setting ${enabled ? 'enabled' : 'disabled'}.`);

      api.admin.updateAllocationConfig({ is_automatic_enabled: enabled })
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to update automatic allocation setting');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update automatic allocation setting');
    }
  };


  const handleBulkUploadProblems = async () => {
    try {
      setErrorMsg('');
      let parsed;
      try {
        parsed = JSON.parse(jsonUploadText);
      } catch (e) {
        setErrorMsg('Invalid JSON format. Please verify JSON array format.');
        return;
      }
      if (!Array.isArray(parsed)) {
        setErrorMsg('JSON must be an array of problem statement objects.');
        return;
      }
      const cleanItems = parsed.map((item, idx) => ({
        problem_id: item.problem_id || `PS-${String(idx + 1).padStart(2, '0')}`,
        problem_number: item.problem_number || (idx + 1),
        title: item.title || `Problem Statement ${idx + 1}`,
        description: item.description || item.scenario || '',
        scenario: item.description || item.scenario || '',
        max_capacity: item.max_capacity || 5,
        is_published: item.is_published !== false
      }));
      await api.admin.saveProblemStatements(cleanItems);
      setSuccessMsg(`${cleanItems.length} Problem statements uploaded successfully!`);
      setUploadModalOpen(false);
      setJsonUploadText('');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload problem statements');
    }
  };

  // Remote Participant Session Logout Handler
  const handleForceLogoutTeam = async (teamId) => {
    if (!teamId) return;
    const confirmLogout = window.confirm(`Terminate session for ${teamId}?\nThis will immediately log out the team from their participant dashboard on their device.`);
    if (!confirmLogout) return;

    setLoggingOutTeamId(teamId);
    try {
      // Optimistically update online status
      setTeams(prev => (Array.isArray(prev) ? prev : []).map(t => t.team_id === teamId ? { ...t, is_online: false } : t));

      await api.admin.forceLogoutTeam(teamId);
      setSuccessMsg(`Team ${teamId} participant session has been terminated successfully.`);
      scheduleLoadData(250);
    } catch (err) {
      setErrorMsg(err.message || `Failed to log out team ${teamId}`);
      scheduleLoadData(100);
    } finally {
      setLoggingOutTeamId(null);
    }
  };

  // Elimination Handlers (Instant Optimistic Updates)
  const handleToggleQualification = async (teamId, currentStatus) => {
    return handleSetTeamQualification(teamId, !currentStatus);
  };

  const handleSetTeamQualification = async (teamId, shouldQualify, customFeedback = null) => {
    try {
      setErrorMsg('');
      const targetTeam = (teams || []).find((t) => t.team_id === teamId);
      const r1 = parseFloat(targetTeam?.scores_by_round?.['1'] || 0);
      const r2 = parseFloat(targetTeam?.scores_by_round?.['2'] || 0);
      const totalR12 = (r1 + r2) > 0 ? (r1 + r2) : parseFloat(targetTeam?.total_score || 0);

      // OPTIMISTIC UPDATE IMMEDIATELY
      let updatedList = [];
      setTeams(prevTeams => {
        const next = (prevTeams || []).map(t => {
          if (t.team_id !== teamId) return t;
          return {
            ...t,
            is_qualified_r3: shouldQualify,
            is_eliminated: !shouldQualify,
            status: shouldQualify ? 'QUALIFIED_R3' : 'ELIMINATED',
            decision_locked: true
          };
        });
        updatedList = next;
        try { sessionStorage.setItem('cloudnex_admin_teams', JSON.stringify(next)); } catch {}
        return next;
      });

      setOverview(prev => {
        if (!prev) return prev;
        const currentQualified = (teams || []).filter(t => t.team_id === teamId ? shouldQualify : t.is_qualified_r3).length;
        const currentEliminated = (teams || []).filter(t => t.team_id === teamId ? !shouldQualify : t.is_eliminated).length;
        return {
          ...prev,
          qualified_teams: currentQualified,
          eliminated_teams: currentEliminated
        };
      });

      setSuccessMsg(
        shouldQualify
          ? `🏆 Team "${targetTeam?.team_name || teamId}" marked as QUALIFIED for Final Round (Decision Confirmed).`
          : `Team "${targetTeam?.team_name || teamId}" marked as ELIMINATED from Final Round (Decision Confirmed).`
      );

      const payload = {
        qualifications: [
          {
            team_id: teamId,
            qualified: shouldQualify,
            feedback: customFeedback || (shouldQualify
              ? 'Qualified for Round 3 (Final Lap) based on Round 1 & 2 performance. Congratulations!'
              : 'Eliminated post-Round 2.')
          }
        ]
      };

      // Qualifications remain sealed and private to Race Control until admin starts the announcement timer or clicks reveal in Round Control (Lap 03).
      api.admin.qualify(payload)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to update qualification');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message);
    }
  };


  // Helper to open Evaluation Modal for ANY Live Team (Rounds 1, 2, or 3)
  const handleOpenEvaluationForTeam = (team, roundNum = null) => {
    let targetRound = 1;
    if (roundNum !== null && roundNum !== undefined && roundNum !== 'all') {
      targetRound = Number(roundNum);
    } else if (overview?.current_live_round) {
      targetRound = Number(overview.current_live_round);
    }
    const sub = submissions.find(s => s.team_id === team.team_id && s.round_number === targetRound);
    const existingEval = evaluations.find(e => e.team_id === team.team_id && e.round_number === targetRound);

    setEvalModal({
      id: sub?.id || `${team.team_id}_r${targetRound}`,
      team_id: team.team_id,
      team_name: team.team_name,
      round_number: targetRound,
      feedback: existingEval?.feedback || sub?.feedback || ''
    });

    if (existingEval) {
      setEvalScores({
        // Round 1 Specific Rubrics (50 Marks)
        architecture_design: existingEval.architecture_design !== undefined ? existingEval.architecture_design : 10,
        service_selection: existingEval.service_selection !== undefined ? existingEval.service_selection : 7,
        scalability_performance: existingEval.scalability_performance !== undefined ? existingEval.scalability_performance : 7,
        security_protection: existingEval.security_protection !== undefined ? existingEval.security_protection : 6,
        high_availability: existingEval.high_availability !== undefined ? existingEval.high_availability : 6,
        cost_optimization: existingEval.cost_optimization !== undefined ? existingEval.cost_optimization : 3,
        technical_feasibility: existingEval.technical_feasibility !== undefined ? existingEval.technical_feasibility : 3,
        // Round 2 Specific Rubrics (100 Marks)
        app_functionality: existingEval.app_functionality !== undefined ? existingEval.app_functionality : 12,
        cloud_deployment: existingEval.cloud_deployment !== undefined ? existingEval.cloud_deployment : 20,
        database_integration: existingEval.database_integration !== undefined ? existingEval.database_integration : 8,
        containerization: existingEval.containerization !== undefined ? existingEval.containerization : 8,
        auth_security: existingEval.auth_security !== undefined ? existingEval.auth_security : 12,
        object_storage: existingEval.object_storage !== undefined ? existingEval.object_storage : 8,
        monitoring_logging: existingEval.monitoring_logging !== undefined ? existingEval.monitoring_logging : 4,
        reliability_error_handling: existingEval.reliability_error_handling !== undefined ? existingEval.reliability_error_handling : 4,
        cloud_config_management: existingEval.cloud_config_management !== undefined ? existingEval.cloud_config_management : 4,
        // Round 3 Specific Rubrics (50 Marks)
        crisis_challenge: existingEval.crisis_challenge !== undefined ? existingEval.crisis_challenge : 25,
        presentation: existingEval.presentation !== undefined ? existingEval.presentation : (existingEval.presentation_score ?? 16),
        // Generic Rubrics
        innovation: existingEval.innovation_score ?? 18,
        functionality: existingEval.functionality_score ?? 22,
        scalability: existingEval.scalability_score ?? 18,
        crisis: existingEval.crisis_handling_score ?? 18,
        blockchainBonus: existingEval.blockchain_bonus ?? 0,
        includeBonus: existingEval.include_bonus !== false,
        feedback: existingEval.feedback || ''
      });
    } else {
      setEvalScores({
        // Round 1 Specific Rubrics (50 Marks)
        architecture_design: 10,
        service_selection: 7,
        scalability_performance: 7,
        security_protection: 6,
        high_availability: 6,
        cost_optimization: 3,
        technical_feasibility: 3,
        // Round 2 Specific Rubrics (100 Marks)
        app_functionality: 12,
        cloud_deployment: 20,
        database_integration: 8,
        containerization: 8,
        auth_security: 12,
        object_storage: 8,
        monitoring_logging: 4,
        reliability_error_handling: 4,
        cloud_config_management: 4,
        // Round 3 Specific Rubrics (50 Marks)
        crisis_challenge: 25,
        presentation: 16,
        // Generic Rubrics
        innovation: 18,
        functionality: 22,
        scalability: 18,
        crisis: 18,
        blockchainBonus: 0,
        includeBonus: true,
        feedback: sub?.feedback || ''
      });
    }
  };

  // Evaluation Submit (Instant Optimistic UI Feedback)
  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!evalModal) return;

    try {
      setErrorMsg('');
      const subId = evalModal.id || `${evalModal.team_id}_r${evalModal.round_number}`;
      const isRound1 = Number(evalModal.round_number) === 1;
      const isRound2 = Number(evalModal.round_number) === 2;
      const isRound3 = Number(evalModal.round_number) === 3;

      let payload = {
        submission_id: subId,
        team_id: evalModal.team_id,
        round_number: evalModal.round_number,
        feedback: evalScores.feedback
      };

      let calculatedTotal = 0;

      if (isRound1) {
        payload = {
          ...payload,
          architecture_design: parseFloat(evalScores.architecture_design || 0),
          service_selection: parseFloat(evalScores.service_selection || 0),
          scalability_performance: parseFloat(evalScores.scalability_performance || 0),
          security_protection: parseFloat(evalScores.security_protection || 0),
          high_availability: parseFloat(evalScores.high_availability || 0),
          cost_optimization: parseFloat(evalScores.cost_optimization || 0),
          technical_feasibility: parseFloat(evalScores.technical_feasibility || 0)
        };
        calculatedTotal =
          payload.architecture_design +
          payload.service_selection +
          payload.scalability_performance +
          payload.security_protection +
          payload.high_availability +
          payload.cost_optimization +
          payload.technical_feasibility;
      } else if (isRound2) {
        payload = {
          ...payload,
          app_functionality: parseFloat(evalScores.app_functionality || 0),
          cloud_deployment: parseFloat(evalScores.cloud_deployment || 0),
          database_integration: parseFloat(evalScores.database_integration || 0),
          containerization: parseFloat(evalScores.containerization || 0),
          auth_security: parseFloat(evalScores.auth_security || 0),
          object_storage: parseFloat(evalScores.object_storage || 0),
          monitoring_logging: parseFloat(evalScores.monitoring_logging || 0),
          reliability_error_handling: parseFloat(evalScores.reliability_error_handling || 0),
          cloud_config_management: parseFloat(evalScores.cloud_config_management || 0)
        };
        calculatedTotal =
          payload.app_functionality +
          payload.cloud_deployment +
          payload.database_integration +
          payload.containerization +
          payload.auth_security +
          payload.object_storage +
          payload.monitoring_logging +
          payload.reliability_error_handling +
          payload.cloud_config_management;
      } else if (isRound3) {
        payload = {
          ...payload,
          crisis_challenge: parseFloat(evalScores.crisis_challenge || 0),
          presentation: parseFloat(evalScores.presentation || 0)
        };
        calculatedTotal = payload.crisis_challenge + payload.presentation;
      } else {
        payload = {
          ...payload,
          innovation_score: parseFloat(evalScores.innovation || 0),
          functionality_score: parseFloat(evalScores.functionality || 0),
          scalability_score: parseFloat(evalScores.scalability || 0),
          crisis_handling_score: parseFloat(evalScores.crisis || 0),
          presentation_score: parseFloat(evalScores.presentation || 0),
          blockchain_bonus: parseFloat(evalScores.blockchainBonus || 0),
          include_bonus: evalScores.includeBonus
        };
        calculatedTotal =
          payload.innovation_score +
          payload.functionality_score +
          payload.scalability_score +
          payload.crisis_handling_score +
          payload.presentation_score +
          (payload.include_bonus ? payload.blockchain_bonus : 0);
      }

      // OPTIMISTIC UPDATE IMMEDIATELY
      setEvaluations(prev => {
        const filtered = (prev || []).filter(item => !(item.team_id === evalModal.team_id && item.round_number === evalModal.round_number));
        return [...filtered, { ...payload, total_score: calculatedTotal }];
      });
      setTeams(prev => (prev || []).map(t => {
        if (t.team_id !== evalModal.team_id) return t;
        const newScoresByRound = { ...(t.scores_by_round || {}) };
        newScoresByRound[String(evalModal.round_number)] = calculatedTotal;
        const newTotal = Object.values(newScoresByRound).reduce((acc, score) => acc + (parseFloat(score) || 0), 0);
        return {
          ...t,
          scores_by_round: newScoresByRound,
          total_score: newTotal
        };
      }));

      const maxLabel = isRound2 ? '100' : '50';
      setSuccessMsg(`Marks for ${evalModal.team_name} (Lap 0${evalModal.round_number}) recorded: ${calculatedTotal.toFixed(1)} / ${maxLabel} Pts!`);
      setEvalModal(null);

      api.admin.evaluate(payload)
        .then(() => scheduleLoadData(400))
        .catch(err => {
          setErrorMsg(err.message || 'Failed to save evaluation marks');
          loadData(true);
        });
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080a0f] text-slate-300 font-race relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none z-0">
          <img
            src={dashboardBg}
            alt="CLOUDNEX Atmosphere"
            className="w-full h-full object-cover object-top opacity-30"
          />
          <div className="absolute inset-0 bg-[#080a0f]/85" />
        </div>
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span>CONNECTING TO RACE DIRECTOR HQ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* High-Tech Dashboard Background Image */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img
          src={dashboardBg}
          alt="CLOUDNEX Admin Dashboard Atmosphere"
          className="w-full h-full object-cover object-top opacity-40 filter brightness-95 contrast-110"
        />
        {/* Atmospheric gradients for readability */}
        <div className="absolute inset-0 bg-[#080a0f]/75 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-[#080a0f]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080a0f]/80 via-transparent to-[#080a0f]/80" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">

        {/* Race Director Header */}
        <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-race font-bold tracking-widest uppercase flex items-center space-x-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>GM UNIVERSITY</span>
                </span>
                <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-race font-bold tracking-widest uppercase shadow-md shadow-red-950/60">
                  RACE DIRECTOR CONSOLE
                </span>
                <button
                  type="button"
                  onClick={() => !isConnected && reconnect && reconnect()}
                  title={isConnected ? 'Telemetry active' : 'Click to reconnect broadcast engine'}
                  className={`flex items-center space-x-1.5 text-xs font-mono-code transition-colors ${isConnected ? 'text-emerald-400 cursor-default' : 'text-amber-400 hover:text-amber-300 cursor-pointer underline decoration-dotted'}`}
                >
                  <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                  <span>{isConnected ? 'BROADCAST ENGINE ONLINE' : 'DISCONNECTED (RECONNECT)'}</span>
                </button>
              </div>
              <h2 className="font-race text-2xl sm:text-3xl font-black text-white">
                F1 STEWARD RACE CONTROL HQ
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono-code">
                <strong className="text-cyan-300">GM University, Davangere</strong> &bull; IGNITRON 2K26 &bull; Department of Cloud Computing &bull; Chief Steward: {user?.username}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={loadData}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-white/10 text-xs font-race flex items-center space-x-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Telemetry</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-8">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">REGISTERED TEAMS</span>
              <span className="font-race text-2xl font-black text-white">{displayTeamCount}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">ACTIVE ON GRID</span>
              <span className="font-race text-2xl font-black text-emerald-400">{overview?.active_teams || 0}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">QUALIFIED FOR R3</span>
              <span className="font-race text-2xl font-black text-cyan-400">{overview?.qualified_teams || 0}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">ELIMINATED</span>
              <span className="font-race text-2xl font-black text-red-500">{overview?.eliminated_teams || 0}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">LIVE LAP</span>
              <span className="font-race text-2xl font-black text-amber-400">
                {overview?.current_live_round ? `LAP 0${overview.current_live_round}` : 'SAFETY CAR'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">PENDING EVALS</span>
              <span className="font-race text-2xl font-black text-purple-400">{overview?.pending_evaluations || 0}</span>
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
          <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono-code flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <div className="flex items-center space-x-2">
              {(errorMsg.toLowerCase().includes('credentials') || errorMsg.toLowerCase().includes('session') || errorMsg.toLowerCase().includes('expired')) && (
                <button
                  onClick={() => {
                    api.auth.logout();
                    window.location.reload();
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-race font-bold transition-all cursor-pointer"
                >
                  Sign In Again
                </button>
              )}
              <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white px-1 text-base">&times;</button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4 text-xs font-race font-bold">
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-4 py-2.5 rounded-xl transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-2 ${activeTab === 'rounds' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
          >
            <Flag className="w-4 h-4" />
            <span>Round Control</span>
          </button>

          <button
            onClick={() => setActiveTab('problems')}
            className={`px-4 py-2.5 rounded-xl transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-2 ${activeTab === 'problems' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Problem Allocation &amp; 10 PS Pool</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`px-4 py-2.5 rounded-xl transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-2 ${activeTab === 'evaluation' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
          >
            <Award className="w-4 h-4" />
            <span>Judge Evaluations ({displayTeamCount} Live Teams)</span>
          </button>

          <button
            onClick={() => setActiveTab('qualification')}
            className={`px-4 py-2.5 rounded-xl transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-2 ${activeTab === 'qualification' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>R3 Qualification ({teams.filter((t) => t.is_qualified_r3).length} Qualified)</span>
          </button>

          <button
            onClick={() => setActiveTab('final_round')}
            className={`px-4 py-2.5 rounded-xl transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-2 ${activeTab === 'final_round' ? 'bg-red-600 text-white shadow-lg shadow-red-950/50' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Final Round ({teams.filter((t) => t.is_qualified_r3).length} Qualified)</span>
          </button>

          <button
            onClick={() => setActiveTab('winner_announcement')}
            className={`px-4 py-2.5 rounded-xl transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-2 ${activeTab === 'winner_announcement'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-950/50 glow-amber'
                : 'bg-slate-900 text-amber-400 hover:text-white border border-amber-500/30'
              }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Winner Announcement</span>
            {Boolean(winnerAnnouncement?.is_announced) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Reset Entire Event Button */}
          <button
            onClick={() => {
              setResetEventConfirmText('');
              setResetEventModalOpen(true);
            }}
            className="ml-auto px-3.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 hover:text-white transition-all duration-75 active:scale-95 cursor-pointer flex items-center space-x-1.5 shadow-md shadow-red-950/40 text-xs font-race font-bold uppercase tracking-wider"
            title="Reset entire event to initial state (preserves registered users and teams)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            <span>Reset Event</span>
          </button>
        </div>

        {/* TAB 1: ROUND CONTROL */}
        {activeTab === 'rounds' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((num) => {
              const rnd = (overview?.rounds || []).find((r) => Number(r.round_number) === num) || {
                round_number: num,
                title: num === 1 ? 'Round 1 — Architecture Design' : num === 2 ? 'Round 2 — Build & Deploy' : 'Round 3 — Cloud Crisis Challenge',
                subtitle: num === 1 ? 'Participants must design a robust, scalable, secure, and cost-efficient cloud architecture capable of handling high-velocity telemetry streams in real time.' : num === 2 ? 'Teams must transform their proposed architecture into a functional cloud-based application or prototype.' : 'Qualified teams will face unexpected real-world cloud infrastructure challenges introduced by the organizers.',
                status: 'LOCKED'
              };
              const isLive = rnd.status === 'LIVE';
              const isClosed = rnd.status === 'CLOSED';
              const isLocked = rnd.status === 'LOCKED';

              // Sequential Round Validation Rules
              const allRoundsList = overview?.rounds || [];
              const runningRound = allRoundsList.find(r => r.status === 'LIVE');
              const anotherRunning = runningRound && Number(runningRound.round_number) !== num;

              const prevRound = num > 1 ? allRoundsList.find(r => Number(r.round_number) === num - 1) : null;
              const isPrevFinished = num === 1 || (prevRound && (prevRound.status === 'CLOSED' || prevRound.status === 'COMPLETED' || prevRound.status === 'LIVE'));
              const hasR3Qualified = (teams || []).some(t => t.is_qualified_r3);

              let blockReason = null;
              if (isLocked && !isPrevFinished) {
                blockReason = `Lap 0${num - 1} has not started yet. Activate Lap 0${num - 1} first.`;
              } else if (isLocked && num === 3 && !hasR3Qualified) {
                blockReason = `No teams have been qualified for Lap 03 yet. Qualify teams before starting Lap 03.`;
              }

              return (
                <div key={num} className="racing-card rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono-code text-cyan-400 font-bold uppercase">
                        LAP 0{rnd.round_number}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        {rnd.submissions_open && rnd.round_number !== 3 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/50 animate-pulse flex items-center space-x-1">
                            <Upload className="w-3 h-3 text-cyan-400" />
                            <span>SUBMISSIONS OPEN</span>
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold ${isLive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 animate-pulse' :
                          isClosed ? 'bg-blue-950 text-blue-400 border border-blue-500/40' :
                            'bg-slate-900 text-slate-500 border border-slate-700'
                          }`}>
                          {rnd.status}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-race text-lg font-bold text-white mb-1.5">
                      {rnd.title}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                      {rnd.subtitle}
                    </p>

                    <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 text-xs font-mono-code space-y-1.5 mb-2">
                      <div className="flex justify-between text-slate-400">
                        <span>Duration:</span>
                        <strong className="text-cyan-300">
                          {rnd.round_number === 1 ? '45 Minutes' : rnd.round_number === 2 ? '3 Hours 30 Mins' : 'Untimed (Live Evaluation)'}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Submissions:</span>
                        <strong className="text-white">
                          {rnd.round_number === 3 ? 'Final Lap (No Submissions)' : `${overview?.submissions_per_round?.[rnd.round_number] || 0} teams`}
                        </strong>
                      </div>
                    </div>

                    {/* Real-time Countdown Timer in Race Control Column (Rounds 1 & 2 only) */}
                    {isLive && rnd.deadline && rnd.round_number !== 3 && (
                      <div className="my-2.5 p-3 rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/30">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-race text-cyan-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                            <span>ROUND {rnd.round_number} TIME REMAINING</span>
                          </span>
                          <span className="text-[10px] font-mono-code text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800">
                            {rnd.round_number === 1 ? '45 MIN' : '3.30 HRS'}
                          </span>
                        </div>
                        <CountdownTimer
                          targetDate={rnd.deadline}
                          title={`ROUND 0${rnd.round_number} CLOCK`}
                          onExpire={() => loadData()}
                        />
                      </div>
                    )}

                    {/* Round 3 Untimed Live Badge */}
                    {isLive && rnd.round_number === 3 && (
                      <div className="my-2.5 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/40 shadow-lg shadow-emerald-950/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-race text-emerald-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span>ROUND 3 LIVE EVALUATION</span>
                          </span>
                          <span className="text-[10px] font-mono-code text-emerald-300 font-bold px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800">
                            UNTIMED (NO TIMER)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Start / End / Submissions Controls */}
                  <div className="pt-4 border-t border-white/10 space-y-2.5">
                    {isLive ? (
                      <>
                        <button
                          onClick={() => handleCloseRound(rnd.round_number)}
                          className="w-full py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-600/50 text-red-200 text-xs font-race font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors glow-red shadow-lg shadow-red-950/50 cursor-pointer"
                        >
                          <Lock className="w-4 h-4" />
                          <span>End Round</span>
                        </button>
                        {rnd.round_number !== 3 && (
                          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/80 border border-white/5">
                            <span className="text-[11px] text-cyan-300 font-mono-code flex items-center space-x-1.5">
                              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                              <span>{rnd.submissions_open ? 'Submissions: OPEN' : 'Submissions: LOCKED'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleSubmissions(rnd.round_number, !rnd.submissions_open)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono-code font-bold uppercase transition-all cursor-pointer ${
                                rnd.submissions_open
                                  ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/50'
                                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50'
                              }`}
                            >
                              {rnd.submissions_open ? 'Lock' : 'Open'}
                            </button>
                          </div>
                        )}
                        <div className="flex items-center justify-center space-x-2 py-1 text-xs text-emerald-400 font-mono-code">
                          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          <span>{rnd.round_number === 3 ? 'Final Lap is active • Results countdown in progress' : 'Round is Live & Timer Running'}</span>
                        </div>
                      </>
                    ) : isClosed ? (
                      <>
                        {rnd.round_number !== 3 ? (
                          <div className="space-y-2.5">
                            {/* Clear indicator that Round is Closed & Concluded */}
                            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-center space-y-1">
                              <div className="flex items-center justify-center space-x-1.5 text-slate-300 font-race font-bold text-xs uppercase">
                                <Lock className="w-3.5 h-3.5 text-red-400" />
                                <span>Round 0{rnd.round_number} Closed &bull; Concluded</span>
                              </div>
                              <span className="text-[10px] font-mono-code text-slate-400 block">
                                Round ended &bull; Submissions {rnd.submissions_open ? 'OPEN' : 'LOCKED'}
                              </span>
                            </div>

                            {/* Option to reopen the round if needed */}
                            <button
                              disabled={startingRoundNum === rnd.round_number}
                              onClick={() => handleReopenRound(rnd.round_number)}
                              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-race font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow cursor-pointer disabled:opacity-60"
                            >
                              {startingRoundNum === rnd.round_number ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                  <span>Reopening Lap 0{rnd.round_number}...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Reopen Round ({rnd.round_number === 1 ? '45 min' : '3.30 hrs'})</span>
                                </>
                              )}
                            </button>

                            {/* Submissions Intake Control - Only for Round 1 & Round 2 */}
                            {rnd.submissions_open ? (
                              <button
                                onClick={() => handleToggleSubmissions(rnd.round_number, false)}
                                className="w-full py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-xs font-race font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-amber-950/50 glow-amber"
                              >
                                <Lock className="w-4 h-4 text-amber-400" />
                                <span>End Submissions</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleSubmissions(rnd.round_number, true)}
                                className="w-full py-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-xs font-race font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-cyan-950/50 glow-cyan"
                              >
                                <Upload className="w-4 h-4 text-cyan-400" />
                                <span>Open Submissions</span>
                              </button>
                            )}

                            <div className="text-center py-0.5">
                              {rnd.submissions_open ? (
                                <span className="text-[11px] text-cyan-300 font-mono-code flex items-center justify-center space-x-1.5">
                                  <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                                  <span>Submissions are OPEN for participants</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-mono-code block">
                                  Round ended &bull; Click &quot;Open Submissions&quot; only if required
                                </span>
                              )}
                            </div>
                            {anotherRunning && (
                              <div className="text-[10px] font-mono-code text-amber-300/80 text-center leading-tight">
                                Note: Starting will switch live grid focus from Lap 0{runningRound.round_number} to Lap 0{rnd.round_number}.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-center space-y-1">
                            <div className="flex items-center justify-center space-x-1.5 text-blue-300 font-race font-bold text-xs uppercase">
                              <CheckCircle2 className="w-4 h-4 text-blue-400" />
                              <span>Round 3 Concluded</span>
                            </div>
                            <span className="text-[11px] font-mono-code text-slate-400 block">
                              No submissions in Round 3. Use results announcement timer below.
                            </span>
                          </div>
                        )}
                      </>
                    ) : blockReason ? (
                      <>
                        <button
                          disabled
                          title={blockReason}
                          className="w-full py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs font-race font-bold uppercase tracking-wider flex items-center justify-center space-x-2 cursor-not-allowed opacity-60"
                        >
                          <Lock className="w-4 h-4 text-slate-500" />
                          <span>Round Locked</span>
                        </button>
                        <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20 text-[11px] font-mono-code text-amber-300/90 leading-tight">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{blockReason}</span>
                        </div>
                      </>
                    ) : (
                      <button
                        disabled={startingRoundNum === rnd.round_number}
                        onClick={() => handleOpenRound(rnd.round_number)}
                        className="w-full py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-race font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-emerald-950/40 glow-green disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {startingRoundNum === rnd.round_number ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            <span>Starting Lap 0{rnd.round_number}...</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4" />
                            <span>Start Round ({rnd.round_number === 1 ? '45 min' : rnd.round_number === 2 ? '3.30 hrs' : 'Untimed'})</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* ROUND 3 QUALIFIERS ANNOUNCEMENT (BASED ON ROUND 1 & 2 MARKS) */}
                    {rnd.round_number === 3 && (() => {
                      if (!hasR3Qualified) {
                        return (
                          <div className="mt-4 pt-3.5 border-t border-amber-500/30 space-y-2.5 bg-gradient-to-b from-amber-950/20 via-slate-950/80 to-slate-950/95 p-3.5 rounded-xl border border-amber-500/20">
                            <div className="flex items-center space-x-2 text-amber-400">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span className="text-[10px] font-race font-bold uppercase tracking-wider">
                                R3 QUALIFIERS TIMER UNAVAILABLE
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono-code leading-relaxed">
                              No teams have been qualified for Round 3 yet. The announcement timer option will only be available once teams are qualified for Round 3.
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveTab('evaluation')}
                              className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Qualify Teams in Evaluation Tab</span>
                            </button>
                          </div>
                        );
                      }

                      const parseUtcDate = (val) => {
                        if (!val) return 0;
                        if (typeof val === 'number') return val;
                        const str = String(val).trim();
                        const hasTimezone = str.endsWith('Z') || str.includes('+') || (str.split('-').length > 3);
                        const formatted = hasTimezone ? str : `${str}Z`;
                        const parsed = new Date(formatted).getTime();
                        return isNaN(parsed) ? new Date(str).getTime() : parsed;
                      };
                      const isTimerElapsed = Boolean(
                        rnd.results_timer_active &&
                        rnd.results_announcement_time &&
                        parseUtcDate(rnd.results_announcement_time) <= Date.now()
                      );
                      const isR3SelectionLive = Boolean(rnd.selection_revealed || rnd.results_announced || isTimerElapsed) && !rnd.results_held;
                      const isR3CountdownLive = Boolean(rnd.results_timer_active && rnd.results_announcement_time && !isR3SelectionLive && !isTimerElapsed);

                      return (
                        <div className="mt-4 pt-3.5 border-t border-amber-500/30 space-y-3 bg-gradient-to-b from-amber-950/30 via-slate-950/80 to-slate-950/95 p-3.5 rounded-xl border border-amber-500/20 shadow-inner">
                          {/* Heading & Live Status */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-race text-amber-400 font-black uppercase tracking-wider flex items-center space-x-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>R3 QUALIFIERS ANNOUNCEMENT</span>
                              </span>
                              {isR3SelectionLive ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center space-x-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                  <span>LIVE</span>
                                </span>
                              ) : isR3CountdownLive ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-red-950 text-red-300 border border-red-500/50 flex items-center space-x-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                  <span>COUNTDOWN</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-slate-900 text-slate-400 border border-slate-700">
                                  DRAFT
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-amber-200/90 font-mono-code leading-tight">
                              Reveals participants selected for Round 3 based on Round 1 &amp; 2 marks.
                              <span className="text-slate-400 block text-[9px] mt-0.5 font-normal">
                                (Winner announcement is separate in Tab 6).
                              </span>
                            </p>
                          </div>

                          {/* CASE 1: ACTIVE COUNTDOWN RUNNING */}
                          {isR3CountdownLive && (
                            <div className="space-y-2.5 pt-1">
                              <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/40 text-center">
                                <div className="text-[10px] font-race text-red-300 font-bold uppercase mb-1 flex items-center justify-center space-x-1">
                                  <Clock className="w-3 h-3 text-red-400 animate-spin" />
                                  <span>REVEALING QUALIFIERS IN</span>
                                </div>
                                <CountdownTimer
                                  targetDate={rnd.results_announcement_time}
                                  title=""
                                  onExpire={loadData}
                                />
                              </div>

                              {/* Retake & Restart Controls */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSetResultsTimer('clear')}
                                  disabled={settingR3Timer}
                                  className="w-full py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-white border border-amber-500/40 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow"
                                  title="Reset countdown and retake timer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Retake Timer</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSetResultsTimer('set', r3TimerSeconds)}
                                  disabled={settingR3Timer}
                                  className="w-full py-2 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow"
                                  title="Restart countdown clock"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Restart ({r3TimerSeconds}s)</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSetResultsTimer('announce_now')}
                                disabled={settingR3Timer}
                                className="w-full py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span>Reveal Qualifiers Now</span>
                              </button>
                            </div>
                          )}

                          {/* CASE 2: QUALIFIERS ARE REVEALED LIVE */}
                          {isR3SelectionLive && (
                            <div className="space-y-2.5 pt-1">
                              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-center">
                                <span className="text-[10px] font-race text-emerald-300 font-bold uppercase flex items-center justify-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>QUALIFIERS PUBLISHED LIVE</span>
                                </span>
                                <span className="text-[9px] font-mono-code text-slate-300 block mt-0.5">
                                  Participants see Round 3 qualification on their dashboards.
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSetResultsTimer('clear')}
                                  disabled={settingR3Timer}
                                  className="w-full py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-white border border-amber-500/40 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow"
                                  title="Retake timer and prepare a new countdown"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Retake Timer</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSetResultsTimer('hold')}
                                  disabled={settingR3Timer}
                                  className="w-full py-2 px-2 rounded-lg bg-red-950/50 hover:bg-red-950/80 text-red-300 border border-red-500/40 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow"
                                  title="Conceal selection from participants"
                                >
                                  <EyeOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                  <span>Conceal</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* CASE 3: IDLE / TIMER SETUP */}
                          {!isR3CountdownLive && !isR3SelectionLive && (
                            <div className="space-y-2.5 pt-1">
                              {/* Timer presets & custom seconds */}
                              <div>
                                <span className="text-[9px] font-mono-code uppercase text-slate-400 block mb-1">
                                  Countdown Duration:
                                </span>
                                <div className="flex items-center gap-1">
                                  {[5, 10, 15, 30, 60].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setR3TimerSeconds(s)}
                                      className={`flex-1 py-1 rounded text-[10px] font-mono-code font-bold transition-all cursor-pointer ${
                                        r3TimerSeconds === s
                                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                                          : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
                                      }`}
                                    >
                                      {s}s
                                    </button>
                                  ))}
                                  <div className="relative w-14">
                                    <input
                                      type="number"
                                      min="3"
                                      max="7200"
                                      value={r3TimerSeconds}
                                      onChange={(e) => setR3TimerSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white font-mono-code focus:outline-none focus:border-amber-500 text-center"
                                      placeholder="Sec"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Start Countdown & Reveal Instantly */}
                              <div className="space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSetResultsTimer('set', r3TimerSeconds)}
                                  disabled={settingR3Timer}
                                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-600 via-amber-500 to-amber-400 hover:from-red-500 hover:to-amber-300 text-slate-950 font-race font-black text-xs uppercase shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer transform hover:scale-[1.01] active:scale-95"
                                >
                                  <Rocket className="w-3.5 h-3.5 text-slate-950" />
                                  <span>START COUNTDOWN ({r3TimerSeconds}s)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSetResultsTimer('announce_now')}
                                  disabled={settingR3Timer}
                                  className="w-full py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 text-[10px] font-race font-bold uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                                  title="Reveal Round 3 selection immediately without a timer"
                                >
                                  <Sparkles className="w-3 h-3 text-emerald-400" />
                                  <span>Reveal Qualifiers Immediately</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: AI-ASSISTED AUTOMATIC PROBLEM STATEMENT ALLOCATION & STUDIO */}
        {activeTab === 'problems' && (
          <div className="space-y-6">
            {/* Top Allocation Telemetry Banner */}
            <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-race uppercase tracking-widest text-red-500 font-bold mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                    <span>F1 RACE CONTROL • PROBLEM ALLOCATION ENGINE</span>
                  </div>
                  <h3 className="font-race text-xl sm:text-2xl font-black text-white">
                    10 COMPETITION PROBLEM STATEMENTS &amp; GRID ALLOCATION
                  </h3>
                  <p className="text-xs text-slate-400 font-mono-code mt-1 max-w-3xl">
                    Balanced, randomized server-side allocation across the 10 official problem statements. Ensures consecutive teams receive distinct challenges with fair capacity distribution.
                  </p>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center space-x-3">
                  <div className={`px-4 py-2 rounded-xl border text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 ${allocationStats?.is_finalized
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 glow-green'
                    : 'bg-amber-950/80 border-amber-500/50 text-amber-400'
                    }`}>
                    {allocationStats?.is_finalized ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Allocation Finalized</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Ready For Allocation</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5">
                  <span className="text-[11px] font-race text-slate-400 uppercase block">Eligible Grid Teams</span>
                  <strong className="text-xl sm:text-2xl font-race font-bold text-white mt-1 block">
                    {allocationStats?.eligible_teams ?? teams.filter(t => !t.is_eliminated).length}
                  </strong>
                  <span className="text-[10px] font-mono-code text-slate-500">
                    Total: {allocationStats?.total_registered_teams ?? teams.length} Registered
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5">
                  <span className="text-[11px] font-race text-slate-400 uppercase block">Allocated Teams</span>
                  <strong className="text-xl sm:text-2xl font-race font-bold text-emerald-400 mt-1 block">
                    {allocationStats?.allocated_teams ?? 0}
                  </strong>
                  <span className="text-[10px] font-mono-code text-emerald-500/80">
                    {allocationStats?.eligible_teams > 0
                      ? `${Math.round(((allocationStats?.allocated_teams || 0) / allocationStats.eligible_teams) * 100)}% Coverage`
                      : '0% Coverage'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5">
                  <span className="text-[11px] font-race text-slate-400 uppercase block">Unallocated Teams</span>
                  <strong className={`text-xl sm:text-2xl font-race font-bold mt-1 block ${(allocationStats?.unallocated_teams || 0) > 0 ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                    {allocationStats?.unallocated_teams ?? 0}
                  </strong>
                  <span className="text-[10px] font-mono-code text-slate-500">
                    {(allocationStats?.unallocated_teams || 0) === 0 ? 'All Teams Assigned' : 'Awaiting Engine Run'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5">
                  <span className="text-[11px] font-race text-slate-400 uppercase block">Grid Capacity</span>
                  <strong className="text-xl sm:text-2xl font-race font-bold text-cyan-400 mt-1 block">
                    {allocationStats?.total_capacity ?? (10 * maxTeamsInput)} Slots
                  </strong>
                  <span className="text-[10px] font-mono-code text-cyan-500/80">
                    {maxTeamsInput} Teams / Problem Statement
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                {/* Left Controls: Configuration */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono-code">
                    <span className="text-slate-400">Max Teams / Problem:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={maxTeamsInput}
                      onChange={(e) => setMaxTeamsInput(e.target.value)}
                      className="w-14 bg-slate-900 border border-white/20 rounded px-2 py-0.5 text-center text-white font-bold"
                    />
                    <button
                      onClick={() => handleUpdateCapacity(maxTeamsInput)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px]"
                    >
                      Set
                    </button>
                  </div>

                  <label className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-xl border border-white/10 text-xs font-race uppercase cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAllocEnabled}
                      onChange={(e) => handleToggleAutoAlloc(e.target.checked)}
                      className="w-4 h-4 rounded text-red-600 bg-slate-900 border-white/20"
                    />
                    <span className="text-slate-300 text-[11px]">Enable Automatic Allocation</span>
                  </label>

                </div>

                {/* Right Controls: Engine Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload 10 Problems JSON</span>
                  </button>

                  {allocationStats?.is_finalized ? (
                    <>
                      <button
                        disabled
                        className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-400 text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 cursor-not-allowed opacity-80"
                      >
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <span>Allocation Finalized (Protected)</span>
                      </button>

                      <button
                        onClick={() => {
                          setResetConfirmText('');
                          setResetModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-300 text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Reset Allocation</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAllocateProblems}
                      disabled={allocating}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all glow-green shadow-lg shadow-emerald-950/50"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>{allocating ? 'Distributing Teams...' : 'Generate Random Allocation'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* OFFICIAL PROBLEM STATEMENT PUBLICATION APPROVAL BANNER */}
            <div className={`racing-card rounded-2xl p-6 border transition-all ${allocationStats?.is_published
              ? 'border-emerald-500/40 bg-emerald-950/20'
              : 'border-amber-500/40 bg-amber-950/20'
              }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start space-x-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${allocationStats?.is_published
                    ? 'bg-emerald-950 border-emerald-500/60 text-emerald-400 glow-green'
                    : 'bg-amber-950 border-amber-500/60 text-amber-400'
                    }`}>
                    {allocationStats?.is_published ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-race uppercase tracking-widest text-slate-400">
                        Problem Visibility:
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${allocationStats?.is_published
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                        : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                        }`}>
                        {allocationStats?.is_published ? 'APPROVED & PUBLISHED' : 'PENDING APPROVAL (HIDDEN)'}
                      </span>
                    </div>
                    <h4 className="text-sm font-race font-bold text-white mt-0.5">
                      {allocationStats?.is_published
                        ? 'Problem Statements Are Live On Participant Dashboards'
                        : 'Problem Statements Are Confidential & Hidden From Participants'}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono-code mt-0.5 max-w-2xl">
                      {allocationStats?.is_published
                        ? 'Participants can now view their assigned problem statement, requirements, and deliverables in real time.'
                        : 'Teams can see their assigned grid positions, but problem statements remain confidential until you approve publication.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-3">
                  {!allocationStats?.is_published ? (
                    <button
                      onClick={() => handlePublishProblems(1)}
                      className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all glow-green shadow-lg shadow-emerald-950/60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve &amp; Publish Problems</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnpublishProblems(1)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all"
                    >
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Unpublish (Hide From Teams)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-Tabs: Studio Editor vs. Allocation Report */}
            <div className="flex space-x-3 border-b border-white/10 pb-2">
              <button
                onClick={() => setAllocationSubTab('studio')}
                className={`px-4 py-2 rounded-xl text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${allocationSubTab === 'studio'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white'
                  }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>10 Problem Statements Studio</span>
              </button>

              <button
                onClick={() => setAllocationSubTab('report')}
                className={`px-4 py-2 rounded-xl text-xs font-race font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${allocationSubTab === 'report'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white'
                  }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Allocation Report &amp; Team Distribution</span>
                {allocationStats?.allocated_teams > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-mono-code font-bold ml-1">
                    {allocationStats.allocated_teams}
                  </span>
                )}
              </button>
            </div>

            {/* SUB-VIEW 1: 10 PROBLEM STATEMENTS STUDIO */}
            {allocationSubTab === 'studio' && (
              <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6">
                {/* 10 Problem Selector Pills */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-race text-slate-300 uppercase font-bold">
                      Select Problem Statement (Pool of 10)
                    </span>
                    <span className="text-xs font-mono-code text-cyan-400">
                      Problem {selectedProblemIndex + 1} of 10 Selected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const prob = problemStatements[idx];
                      const assignedCount = prob?.assigned_teams_count || 0;
                      const cap = prob?.max_capacity || maxTeamsInput || 5;
                      const isSelected = selectedProblemIndex === idx;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedProblemIndex(idx)}
                          className={`p-2.5 rounded-xl border text-center transition-all duration-75 active:scale-95 cursor-pointer ${isSelected
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-950/60 font-bold scale-[1.03]'
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                            }`}
                        >
                          <div className="text-[11px] font-race font-bold">
                            PS-{String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="text-[10px] font-mono-code mt-0.5 opacity-80">
                            {assignedCount}/{cap}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form to Edit Selected Problem Statement */}
                <form onSubmit={handleSaveProblem} className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 rounded bg-red-950/80 border border-red-600/50 text-xs font-mono-code font-bold text-red-300 uppercase">
                        {problemForm.problem_id || `PS-${String(selectedProblemIndex + 1).padStart(2, '0')}`}
                      </span>
                      <span className="text-xs font-mono-code text-slate-400">
                        Editing Specifications
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-mono-code text-cyan-400">
                      <span>Assigned Teams:</span>
                      <strong className="text-white font-bold">
                        {problemStatements[selectedProblemIndex]?.assigned_teams_count || 0} / {problemForm.max_capacity || maxTeamsInput}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-race text-slate-300 uppercase mb-1">
                      Problem Title
                    </label>
                    <input
                      type="text"
                      required
                      value={problemForm.title}
                      onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
                      placeholder="e.g. Global Cloud Architecture & Resilient Messaging Challenge"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-race text-slate-300 uppercase mb-1">
                      Problem Description
                    </label>
                    <textarea
                      rows="6"
                      required
                      value={problemForm.description}
                      onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                      placeholder="Enter the detailed description of this problem statement..."
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-xs text-white font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-race text-slate-300 uppercase">Max Capacity:</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={problemForm.max_capacity}
                          onChange={(e) => setProblemForm({ ...problemForm, max_capacity: e.target.value })}
                          className="w-16 bg-slate-950 border border-white/20 rounded-lg px-2 py-1 text-xs text-white text-center font-bold"
                        />
                      </div>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={problemForm.is_published}
                          onChange={(e) => setProblemForm({ ...problemForm, is_published: e.target.checked })}
                          className="w-4 h-4 rounded text-red-600 bg-slate-950 border-white/10"
                        />
                        <span className="text-xs font-race text-slate-300 uppercase">
                          Published &amp; Active
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-race font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center space-x-2 shadow-lg shadow-red-950/50"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Problem Statement Specifications</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUB-VIEW 2: ALLOCATION REPORT & TEAM DISTRIBUTION */}
            {allocationSubTab === 'report' && (
              <div className="space-y-6">
                {/* Unallocated Warning Alert */}
                {(allocationStats?.unallocated_teams || 0) > 0 && (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-race text-sm font-bold text-amber-300">
                        {allocationStats.unallocated_teams} Teams Currently Unallocated
                      </h4>
                      <p className="text-xs text-slate-300 font-mono-code mt-0.5">
                        These registered teams have not yet been assigned to a problem statement. Click <strong>Generate Random Allocation</strong> above to distribute all teams.
                      </p>
                    </div>
                  </div>
                )}

                {/* 10 Problem Distribution Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(allocationStats?.problem_distributions || []).map((prob) => {
                    const assignedList = prob.teams || [];
                    const cap = prob.max_capacity || maxTeamsInput || 5;
                    const percent = prob.percentage_filled || 0;
                    const isFull = assignedList.length >= cap;

                    return (
                      <div
                        key={prob.problem_id}
                        className="racing-card rounded-2xl p-5 border border-white/10 space-y-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                            <div className="flex items-center space-x-2.5">
                              <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-xs font-mono-code font-bold text-cyan-400">
                                {prob.problem_id}
                              </span>
                              <span className="text-xs font-mono-code text-slate-400">
                                Slot {prob.problem_number}
                              </span>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono-code font-bold ${isFull
                              ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                              : assignedList.length > 0
                                ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-400'
                                : 'bg-slate-900 border border-slate-700 text-slate-500'
                              }`}>
                              {assignedList.length} / {cap} Teams
                            </span>
                          </div>

                          <h4 className="font-race text-base font-bold text-white mb-1">
                            {prob.title}
                          </h4>
                          <p className="text-xs text-slate-400 font-mono-code line-clamp-2 mb-3">
                            {prob.tagline}
                          </p>

                          {/* Capacity Progress Bar */}
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5 mb-4">
                            <div
                              className={`h-full transition-all duration-500 ${isFull ? 'bg-emerald-500' : 'bg-cyan-500'
                                }`}
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>

                          {/* Assigned Teams Pill List */}
                          <div>
                            <span className="text-[11px] font-race text-slate-400 uppercase tracking-wider block mb-2">
                              Assigned Teams ({assignedList.length})
                            </span>
                            {assignedList.length === 0 ? (
                              <div className="text-xs font-mono-code text-slate-600 italic py-2">
                                No teams allocated to this challenge yet.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {assignedList.map((tm, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className="p-2 rounded-lg bg-slate-950/70 border border-white/5 flex items-center justify-between text-xs font-mono-code"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      <strong className="text-white">{tm.team_name}</strong>
                                      <span className="text-[10px] text-slate-500">({tm.team_id})</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                      {tm.institution || 'Independent'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ROUND 3 SELECTION & QUALIFICATION DESK */}
        {(activeTab === 'qualification' || activeTab === 'elimination' || activeTab === 'teams') && (
          <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6">
            {/* Header & Context */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <div className="flex items-center space-x-2 text-xs font-race uppercase tracking-widest text-emerald-400 font-bold mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>F1 RACE CONTROL • ROUND 3 DESK</span>
                </div>
                <h3 className="font-race text-xl sm:text-2xl font-black text-white flex items-center space-x-3">
                  <span>ROUND 3 SELECTION &amp; QUALIFICATION DESK</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono-code font-bold">
                    {teams.filter((t) => t.is_qualified_r3).length} Qualified
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono-code mt-1 max-w-3xl">
                  Qualify or eliminate participating teams for the Final Lap (Round 3) strictly based on their combined Round 1 &amp; Round 2 marks. Decisions broadcast live instantly to participant dashboards.
                </p>
              </div>

              {/* Telemetry Summary Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                  <span className="text-[10px] font-mono-code text-emerald-300 uppercase block">R3 QUALIFIED</span>
                  <span className="font-race text-lg sm:text-xl font-black text-emerald-400">
                    {teams.filter((t) => t.is_qualified_r3).length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-center">
                  <span className="text-[10px] font-mono-code text-red-300 uppercase block">ELIMINATED</span>
                  <span className="font-race text-lg sm:text-xl font-black text-red-400">
                    {teams.filter((t) => t.is_eliminated).length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-center">
                  <span className="text-[10px] font-mono-code text-slate-400 uppercase block">PENDING</span>
                  <span className="font-race text-lg sm:text-xl font-black text-slate-300">
                    {teams.filter((t) => !t.is_qualified_r3 && !t.is_eliminated).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar: Notice & Search Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs font-mono-code text-amber-300/90 bg-amber-950/30 border border-amber-500/20 px-3.5 py-2 rounded-xl">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Steward Note:</strong> Qualify or eliminate teams below based on Round 1 &amp; 2 marks. Results remain private to Race Control until you trigger the announcement timer in Round Control (Lap 03).
                </span>
              </div>

              {/* Search Option by Team ID / Name */}
              <div className="relative w-full sm:w-80 shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTeamQuery}
                  onChange={(e) => setSearchTeamQuery(e.target.value)}
                  placeholder="Search by Team ID (e.g. TEAM-01), name..."
                  className="w-full pl-10 pr-9 py-2 bg-slate-950/90 border border-cyan-500/30 focus:border-cyan-400 rounded-xl text-xs font-mono-code text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shadow-inner transition-all"
                />
                {searchTeamQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchTeamQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Teams Qualification Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-code">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase font-race">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Team &amp; ID</th>
                    <th className="py-3 px-4">Institution</th>
                    <th className="py-3 px-4">Round 1 Marks</th>
                    <th className="py-3 px-4">Round 2 Marks</th>
                    <th className="py-3 px-4">Combined (R1+R2)</th>
                    <th className="py-3 px-4 text-center">Round 3 Status</th>
                    <th className="py-3 px-4 text-right">R3 Qualification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(() => {
                    const filteredTeams = teams.filter((t) => {
                      if (!searchTeamQuery) return true;
                      const q = searchTeamQuery.toLowerCase().trim();
                      return (
                        (t.team_id && t.team_id.toLowerCase().includes(q)) ||
                        (t.team_name && t.team_name.toLowerCase().includes(q)) ||
                        (t.leader_name && t.leader_name.toLowerCase().includes(q)) ||
                        (t.institution && t.institution.toLowerCase().includes(q))
                      );
                    });

                    if (loading && teams.length === 0) {
                      return (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-slate-400 font-mono-code bg-slate-950/30">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm text-cyan-300 font-race tracking-wider">CONNECTING TO GRID TELEMETRY...</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    if (filteredTeams.length === 0) {
                      return (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-slate-400 font-mono-code bg-slate-950/30">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <Search className="w-8 h-8 text-slate-600" />
                              <p className="text-sm">No registered teams found matching &ldquo;{searchTeamQuery}&rdquo;</p>
                              {searchTeamQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchTeamQuery('')}
                                  className="px-4 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-race font-bold uppercase transition-all"
                                >
                                  Clear Search Filter
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Sort strictly by combined Round 1 & Round 2 score descending
                    const sortedTeams = [...filteredTeams].sort((a, b) => {
                      const r1A = parseFloat(a.scores_by_round?.['1'] || 0);
                      const r2A = parseFloat(a.scores_by_round?.['2'] || 0);
                      const scoreA = (r1A + r2A) > 0 ? (r1A + r2A) : parseFloat(a.total_score || 0);

                      const r1B = parseFloat(b.scores_by_round?.['1'] || 0);
                      const r2B = parseFloat(b.scores_by_round?.['2'] || 0);
                      const scoreB = (r1B + r2B) > 0 ? (r1B + r2B) : parseFloat(b.total_score || 0);

                      return scoreB - scoreA;
                    });

                    return sortedTeams.map((t, idx) => {
                      const r1Pts = t.scores_by_round?.['1'];
                      const r2Pts = t.scores_by_round?.['2'];
                      const combinedScore = (parseFloat(r1Pts || 0) + parseFloat(r2Pts || 0)) > 0
                        ? (parseFloat(r1Pts || 0) + parseFloat(r2Pts || 0))
                        : parseFloat(t.total_score || 0);

                      const isQualified = Boolean(t.is_qualified_r3);
                      const isEliminated = Boolean(t.is_eliminated);

                      return (
                        <tr
                          key={t.team_id}
                          className={`transition-colors ${
                            isQualified
                              ? 'bg-emerald-950/15 hover:bg-emerald-950/25 border-l-2 border-emerald-500'
                              : isEliminated
                              ? 'bg-red-950/15 hover:bg-red-950/25 border-l-2 border-red-500/60 opacity-80'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-3 px-4 font-bold font-race text-white">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black ${
                                idx === 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                  : idx === 1
                                  ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                                  : idx === 2
                                  ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                                  : 'text-slate-400'
                              }`}
                            >
                              P{idx + 1}
                            </span>
                          </td>

                          {/* Team & ID */}
                          <td className="py-3 px-4">
                            <strong className="text-white block font-sans font-bold text-sm">
                              {t.team_name}
                            </strong>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                                {t.team_id}
                              </span>
                              <span className="text-slate-400 text-[11px] truncate max-w-[130px]">
                                {t.leader_name ? `Lead: ${t.leader_name}` : ''}
                              </span>
                            </div>
                          </td>

                          {/* Institution */}
                          <td className="py-3 px-4 text-slate-300 text-xs">
                            {t.institution || 'Independent'}
                          </td>

                          {/* Round 1 Marks */}
                          <td className="py-3 px-4">
                            {r1Pts !== undefined ? (
                              <span className="px-2 py-1 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
                                {parseFloat(r1Pts).toFixed(1)} pts
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">-</span>
                            )}
                          </td>

                          {/* Round 2 Marks */}
                          <td className="py-3 px-4">
                            {r2Pts !== undefined ? (
                              <span className="px-2 py-1 rounded-md bg-purple-950/80 text-purple-300 border border-purple-500/40 text-xs font-bold">
                                {parseFloat(r2Pts).toFixed(1)} pts
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">-</span>
                            )}
                          </td>

                          {/* Combined Marks (R1 + R2) */}
                          <td className="py-3 px-4 font-bold text-amber-400 text-sm">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 font-mono-code">
                              {combinedScore.toFixed(1)} Pts
                            </span>
                          </td>

                          {/* R3 Status Badge */}
                          <td className="py-3 px-4 text-center">
                            {isQualified ? (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono-code font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-sm shadow-emerald-950/60">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>QUALIFIED (R3)</span>
                              </span>
                            ) : isEliminated ? (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono-code font-bold bg-red-950 text-red-300 border border-red-500/60 shadow-sm shadow-red-950/60">
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                <span>ELIMINATED</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono-code font-bold bg-slate-900 text-slate-400 border border-white/10">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>PENDING</span>
                              </span>
                            )}
                          </td>

                          {/* Qualify / Eliminate Controls */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Qualify Button */}
                              <button
                                type="button"
                                onClick={() => handleSetTeamQualification(t.team_id, true)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-race font-bold transition-all inline-flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer ${
                                  isQualified
                                    ? 'bg-emerald-600 text-white border border-emerald-400 shadow-emerald-900/50 glow-green'
                                    : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-600/50'
                                }`}
                                title="Qualify team for Round 3 (Final Lap)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{isQualified ? 'Qualified ✓' : 'Qualify'}</span>
                              </button>

                              {/* Eliminate Button */}
                              <button
                                type="button"
                                onClick={() => handleSetTeamQualification(t.team_id, false)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-race font-bold transition-all inline-flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer ${
                                  isEliminated
                                    ? 'bg-red-600 text-white border border-red-400 shadow-red-900/50 glow-red'
                                    : 'bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white border border-red-600/50'
                                }`}
                                title="Eliminate team from competing in Round 3"
                              >
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                <span>{isEliminated ? 'Eliminated ✗' : 'Eliminate'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: JUDGE EVALUATION STUDIO */}
        {activeTab === 'evaluation' && (
          <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <div className="flex items-center space-x-2 text-xs font-race uppercase tracking-widest text-red-500 font-bold mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span>RACE STEWARDS • SCORING SYSTEM</span>
                </div>
                <h3 className="font-race text-xl sm:text-2xl font-black text-white">
                  JUDGE EVALUATION &amp; MARKS ALLOCATION DESK
                </h3>
                <p className="text-xs text-slate-400 font-mono-code mt-1">
                  Allocate marks directly to all live participating teams for Rounds 1 &amp; 2. Scores reflect live on the championship leaderboard.
                </p>
              </div>

              {/* Lap Filter Switcher */}
              <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setEvalRoundFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-race font-bold uppercase transition-all ${evalRoundFilter === 'all'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  All Laps Overview
                </button>
                {[1, 2].map((rNum) => (
                  <button
                    key={rNum}
                    type="button"
                    onClick={() => setEvalRoundFilter(rNum)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-race font-bold uppercase transition-all ${evalRoundFilter === rNum
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Lap 0{rNum}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="text-[11px] font-race text-slate-400 uppercase">Live Registered Teams</div>
                <div className="text-xl font-race font-bold text-white mt-0.5">{teams.length}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="text-[11px] font-race text-slate-400 uppercase">Artifacts Received</div>
                <div className="text-xl font-race font-bold text-cyan-400 mt-0.5">{submissions.length}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="text-[11px] font-race text-slate-400 uppercase">Evaluations Graded</div>
                <div className="text-xl font-race font-bold text-emerald-400 mt-0.5">{evaluations.length}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="text-[11px] font-race text-slate-400 uppercase">Championship Round</div>
                <div className="text-xl font-race font-bold text-amber-400 mt-0.5">
                  {overview?.current_live_round ? `Lap 0${overview.current_live_round} Live` : 'Grid Standby'}
                </div>
              </div>
            </div>

            {/* Live Teams Evaluation Table */}
            {evalRoundFilter === 'all' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono-code text-slate-400 bg-slate-950/60 border border-white/5 px-4 py-2.5 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>All Laps Overview displays live marks for all rounds. To review submission artifacts and allocate marks, select <strong>Lap 01</strong> or <strong>Lap 02</strong> above.</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono-code">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase font-race">
                        <th className="py-3 px-4">Championship Team</th>
                        <th className="py-3 px-4 text-center">Lap 01 Marks (Max 50)</th>
                        <th className="py-3 px-4 text-center">Lap 02 Marks (Max 100)</th>
                        <th className="py-3 px-4 text-center">Total Points</th>
                        <th className="py-3 px-4 text-right">Round 3 Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading && teams.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400 font-mono-code bg-slate-950/30">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm text-cyan-300 font-race tracking-wider">SYNCING LIVE GRID TELEMETRY...</p>
                            </div>
                          </td>
                        </tr>
                      ) : teams.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400 font-mono-code bg-slate-950/30">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Award className="w-8 h-8 text-slate-600" />
                              <p className="text-sm">No registered teams on the grid yet.</p>
                              <p className="text-xs text-slate-500">Registered teams will appear here once they register on the platform.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        teams.map((t) => {
                          const r1Score = t.scores_by_round?.['1'];
                          const r2Score = t.scores_by_round?.['2'];

                          return (
                            <tr key={t.team_id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center space-x-2">
                                  <strong className="text-white font-sans text-sm font-bold">{t.team_name}</strong>
                                  {t.is_qualified_r3 && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold">
                                      FINALIST
                                    </span>
                                  )}
                                  {t.is_eliminated && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-700/40 text-[10px] text-red-400">
                                      ELIMINATED
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px] mt-0.5">
                                  {t.team_id} &bull; {t.institution || 'GM University'} &bull; Leader: {t.leader_name}
                                </div>
                              </td>

                              {/* Lap 1 Marks (Read Only) */}
                              <td className="py-3.5 px-4 text-center">
                                {r1Score !== undefined ? (
                                  <span className="inline-block px-3 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/30">
                                    {parseFloat(r1Score).toFixed(1)} / 50 Marks
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">Not Graded</span>
                                )}
                              </td>

                              {/* Lap 2 Marks (Read Only) */}
                              <td className="py-3.5 px-4 text-center">
                                {r2Score !== undefined ? (
                                  <span className="inline-block px-3 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/30">
                                    {parseFloat(r2Score).toFixed(1)} / 100 Marks
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">Not Graded</span>
                                )}
                              </td>

                              {/* Total Score */}
                              <td className="py-3.5 px-4 text-center">
                                <span className="font-race font-bold text-sm text-amber-400">
                                  {parseFloat(t.total_score || 0).toFixed(1)} Pts
                                </span>
                              </td>

                              {/* Round 3 Status */}
                              <td className="py-3.5 px-4 text-right">
                                {t.is_qualified_r3 ? (
                                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-sm">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>QUALIFIED</span>
                                  </span>
                                ) : t.is_eliminated ? (
                                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold bg-red-950 text-red-300 border border-red-500/60 shadow-sm">
                                    <XCircle className="w-3 h-3 text-red-400" />
                                    <span>ELIMINATED</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono-code text-slate-400 bg-slate-900 border border-white/10">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>PENDING</span>
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
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono-code">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase font-race">
                      <th className="py-3 px-4">Live Team</th>
                      <th className="py-3 px-4">Submission Artifacts (Lap 0{evalRoundFilter})</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Lap Score</th>
                      <th className="py-3 px-4">Total Score</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {teams.map((t) => {
                      const sub = submissions.find(
                        (s) => s.team_id === t.team_id && s.round_number === evalRoundFilter
                      );
                      const lapScore = t.scores_by_round?.[String(evalRoundFilter)];

                      return (
                        <tr key={t.team_id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <strong className="text-white font-sans text-sm font-bold">{t.team_name}</strong>
                              {t.is_qualified_r3 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold">
                                  FINALIST
                                </span>
                              )}
                              {t.is_eliminated && (
                                <span className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-700/40 text-[10px] text-red-400">
                                  ELIMINATED
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] mt-0.5">
                              {t.team_id} &bull; {t.institution || 'GM University'} &bull; Leader: {t.leader_name}
                            </div>
                          </td>

                          {/* Artifacts */}
                          <td className="py-3.5 px-4">
                            {sub ? (
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                {sub.github_url && (
                                  <a
                                    href={sub.github_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:text-white underline flex items-center space-x-1"
                                  >
                                    <span>GitHub Repo</span>
                                  </a>
                                )}
                                {sub.deployed_url && (
                                  <a
                                    href={sub.deployed_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded bg-slate-900 border border-red-500/40 text-red-300 hover:text-white underline flex items-center space-x-1"
                                  >
                                    <span>Live App URL</span>
                                  </a>
                                )}
                                {(sub.file_path || sub.file_name) && (
                                  <div className="inline-flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fileName = sub.file_path || sub.file_name;
                                        const fileUrl = `/api/v1/submissions/file/${fileName}`;
                                        setPreviewFile({
                                          url: fileUrl,
                                          filename: sub.file_name || fileName,
                                          title: `${t.team_name} • Round 1 Architecture Blueprint`,
                                          teamName: t.team_name,
                                          isPdf: (fileName || '').toLowerCase().endsWith('.pdf')
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 hover:text-white font-bold transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
                                      title="Click to open architecture blueprint file/photo in portal"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                                      <span>View Blueprint ({sub.file_name || 'File'})</span>
                                    </button>
                                    <a
                                      href={`/api/v1/submissions/file/${sub.file_path || sub.file_name}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-amber-500/40"
                                      title="Open blueprint directly in new tab like demo link"
                                    >
                                      <ArrowUpRight className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-950 border border-white/10 text-slate-500 text-[11px]">
                                No artifact submitted yet (Live)
                              </span>
                            )}
                          </td>

                          {/* Timestamp */}
                          <td className="py-3.5 px-4 text-slate-400">
                            {sub?.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString() : '—'}
                          </td>

                          {/* Lap Score */}
                          <td className="py-3.5 px-4 font-bold">
                            {lapScore !== undefined ? (
                              <span className="text-emerald-400 text-sm font-bold font-mono-code">
                                {lapScore} / {Number(evalRoundFilter) === 2 ? '100 Pts' : '50 Marks'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Total Score */}
                          <td className="py-3.5 px-4 text-white font-race font-bold">
                            {t.total_score || 0} Pts
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluationForTeam(t, evalRoundFilter)}
                              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-race font-bold text-xs uppercase shadow-md shadow-red-950/50 transition-all flex items-center space-x-1.5 ml-auto"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{lapScore !== undefined ? 'Update Marks' : 'Allocate Marks'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FINAL ROUND (ROUND 3 SHOWDOWN & RUBRICS EVALUATION) */}
        {activeTab === 'final_round' && (
          <div className="space-y-6">



            {/* Qualified Teams List / Table */}
            {(() => {
              // Filter ONLY qualified teams and sort:
              // Strictly by Round 3 marks if evaluated, otherwise by Round 1 & Round 2 cumulative score descending
              const qualified = teams
                .filter((t) => t.is_qualified_r3)
                .slice()
                .sort((a, b) => {
                  const r3A = a.scores_by_round?.['3'] !== undefined && a.scores_by_round?.['3'] !== null
                    ? parseFloat(a.scores_by_round['3'])
                    : null;
                  const r3B = b.scores_by_round?.['3'] !== undefined && b.scores_by_round?.['3'] !== null
                    ? parseFloat(b.scores_by_round['3'])
                    : null;

                  if (r3A !== null && r3B !== null && r3B !== r3A) {
                    return r3B - r3A;
                  }
                  if (r3A !== null && r3B === null) return -1;
                  if (r3A === null && r3B !== null) return 1;

                  // Pre-Round 3 scoring: sort strictly by Round 1 & Round 2 cumulative score
                  const r1A = parseFloat(a.scores_by_round?.['1'] || 0);
                  const r2A = parseFloat(a.scores_by_round?.['2'] || 0);
                  const scoreA = (r1A + r2A) > 0 ? (r1A + r2A) : parseFloat(a.total_score || 0);

                  const r1B = parseFloat(b.scores_by_round?.['1'] || 0);
                  const r2B = parseFloat(b.scores_by_round?.['2'] || 0);
                  const scoreB = (r1B + r2B) > 0 ? (r1B + r2B) : parseFloat(b.total_score || 0);

                  if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                  }
                  return a.team_name.localeCompare(b.team_name);
                });

              if (qualified.length === 0) {
                return (
                  <div className="racing-card rounded-2xl p-12 text-center border border-white/10 shadow-2xl">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                      <Trophy className="w-8 h-8 text-amber-400" />
                    </div>
                    <h4 className="font-race text-xl font-bold text-white mb-2">
                      NO TEAMS QUALIFIED FOR FINAL ROUND YET
                    </h4>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                      Teams will appear here once they are marked as qualified for Round 3 in the Teams &amp; Elimination Desk.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('qualification')}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-race font-bold text-xs uppercase shadow-lg shadow-amber-950/50 transition-all flex items-center space-x-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Select Qualifiers in R3 Desk</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('teams')}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-white/10 font-race font-bold text-xs uppercase transition-all flex items-center space-x-2"
                      >
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span>Open Teams Desk</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div>
                      <h4 className="font-race text-lg font-bold text-white flex items-center space-x-2">
                        <span>FINAL ROUND LEADERBOARD</span>
                        <span className="text-xs text-amber-400 font-mono-code font-normal">
                          (Arranged strictly by Round 3 marks)
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 font-mono-code mt-0.5">
                        All qualified finalists participating in Round 3. Allocate marks using the Round 3 rubrics below.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('winner_announcement')}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-race font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer shadow-sm self-start sm:self-auto"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Winner Announcement &amp; Go Live &rarr;</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono-code text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 uppercase text-[11px] tracking-wider">
                          <th className="py-3 px-4">Grid Pos</th>
                          <th className="py-3 px-4">Finalist Team &amp; Leader</th>
                          <th className="py-3 px-4">Institution</th>
                          <th className="py-3 px-4">R1 &amp; R2 Score</th>
                          <th className="py-3 px-4">Problem Statement</th>
                          <th className="py-3 px-4">Round 3 Status</th>
                          <th className="py-3 px-4">Final Round Marks (Max 50)</th>
                          <th className="py-3 px-4 text-right">Judge Rubrics Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {qualified.map((t, idx) => {
                          const r3Pts = t.scores_by_round?.['3'];
                          const hasR3Score = r3Pts !== undefined && r3Pts !== null;

                          const isP1 = idx === 0;
                          const isP2 = idx === 1;
                          const isP3 = idx === 2;

                          return (
                            <tr
                              key={t.team_id}
                              className={`transition-colors ${isP1
                                ? 'bg-amber-500/10 hover:bg-amber-500/15'
                                : isP2
                                  ? 'bg-slate-800/40 hover:bg-slate-800/60'
                                  : isP3
                                    ? 'bg-amber-900/15 hover:bg-amber-900/25'
                                    : 'hover:bg-white/5'
                                }`}
                            >
                              {/* Grid Position */}
                              <td className="py-3.5 px-4 font-bold font-race text-sm">
                                <div className="flex items-center space-x-1.5">
                                  {isP1 ? (
                                    <span className="flex items-center space-x-1 text-amber-400">
                                      <Trophy className="w-4 h-4 text-amber-400 inline" />
                                      <span>P1</span>
                                    </span>
                                  ) : isP2 ? (
                                    <span className="flex items-center space-x-1 text-slate-300">
                                      <Award className="w-4 h-4 text-slate-300 inline" />
                                      <span>P2</span>
                                    </span>
                                  ) : isP3 ? (
                                    <span className="flex items-center space-x-1 text-amber-600">
                                      <Award className="w-4 h-4 text-amber-600 inline" />
                                      <span>P3</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">P{idx + 1}</span>
                                  )}
                                </div>
                              </td>

                              {/* Team info */}
                              <td className="py-3.5 px-4">
                                <div className="font-sans font-bold text-white text-sm flex items-center space-x-1.5">
                                  <span>{t.team_name}</span>
                                  {isP1 && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase font-race font-bold">
                                      {hasR3Score ? 'R3 Leader' : 'Pole Sitter'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                                  <span>ID: {t.team_id}</span>
                                  {t.leader_name && <span>• Leader: {t.leader_name}</span>}
                                </div>
                              </td>

                              {/* Institution */}
                              <td className="py-3.5 px-4 text-slate-300">
                                {t.institution || '—'}
                              </td>

                              {/* R1 & R2 Qualifier Score */}
                              <td className="py-3.5 px-4">
                                {(() => {
                                  const r1 = t.scores_by_round?.['1'];
                                  const r2 = t.scores_by_round?.['2'];
                                  const combined = (parseFloat(r1 || 0) + parseFloat(r2 || 0)) > 0
                                    ? (parseFloat(r1 || 0) + parseFloat(r2 || 0))
                                    : parseFloat(t.total_score || 0);
                                  return (
                                    <div>
                                      <span className="font-bold text-amber-300 text-xs font-mono-code block">
                                        {combined.toFixed(1)} Pts
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono-code">
                                        R1: {r1 !== undefined ? `${r1} pts` : '-'} &bull; R2: {r2 !== undefined ? `${r2} pts` : '-'}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* Problem Statement */}
                              <td className="py-3.5 px-4">
                                {t.problem_statement_id ? (
                                  <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-bold">
                                    {t.problem_statement_id}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>

                              {/* Round 3 Status */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-[11px] shadow-sm shadow-emerald-950">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>QUALIFIED FINALIST</span>
                                </span>
                              </td>

                              {/* Round 3 Marks */}
                              <td className="py-3.5 px-4 font-bold">
                                {hasR3Score ? (
                                  <span className="text-emerald-400 text-sm font-bold font-mono-code">
                                    {r3Pts} / 50 Marks
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-normal">
                                    Pending Evaluation
                                  </span>
                                )}
                              </td>

                              {/* Action: Allocate Round 3 Marks using Rubrics */}
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEvaluationForTeam(t, 3)}
                                  className={`px-3.5 py-1.5 rounded-xl text-white font-race font-bold text-xs uppercase shadow-md transition-all flex items-center space-x-1.5 ml-auto ${hasR3Score
                                    ? 'bg-slate-800 hover:bg-slate-700 border border-white/20'
                                    : 'bg-red-600 hover:bg-red-700 shadow-red-950/50 glow-red'
                                    }`}
                                  title="Open Round 3 rubrics to evaluate final round crisis recovery"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>{hasR3Score ? 'Update R3 Marks' : 'Allocate R3 Marks'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 6: SEPARATE WINNER ANNOUNCEMENT & GO LIVE SECTION */}
        {activeTab === 'winner_announcement' && (
          <div className="space-y-6">
            {(() => {
              const skew = (typeof window !== 'undefined' && window.__cloudnex_server_time_skew) || 0;
              const targetTime = winnerAnnouncement?.announcement_time ? parseUtcDate(winnerAnnouncement.announcement_time) : 0;
              const isTimerExpired = Boolean(
                winnerAnnouncement?.is_timer_active &&
                targetTime > 0 &&
                (Date.now() + skew) >= targetTime
              );

              const isResultsAnnounced = Boolean(
                (winnerAnnouncement?.is_announced || isTimerExpired || (announcementCountdown !== null && announcementCountdown <= 0)) &&
                !winnerAnnouncement?.held
              );
              const isCountdownActive = Boolean(
                !isResultsAnnounced &&
                !isTimerExpired &&
                (winnerAnnouncement?.is_timer_active || isAnnouncing || (announcementCountdown !== null && announcementCountdown > 0))
              );
              const qualifiedR3Teams = [...(teams || [])]
                .filter((t) => t.is_qualified_r3)
                .sort((a, b) => {
                  const scA = parseFloat(a.scores_by_round?.['3'] ?? a.r3_score ?? 0);
                  const scB = parseFloat(b.scores_by_round?.['3'] ?? b.r3_score ?? 0);
                  return scB - scA;
                });
              const hasR3Qualifiers = qualifiedR3Teams.length > 0;

              const winner = winnerAnnouncement?.winner || overview?.winner_announcement?.winner || qualifiedR3Teams[0];
              const runnerUp = winnerAnnouncement?.runner_up || overview?.winner_announcement?.runner_up || qualifiedR3Teams[1];

              return (
                <div className="space-y-6">

                  {/* NO TEAMS QUALIFIED ALERT (Before going live when no teams have been qualified for final round) */}
                  {!isResultsAnnounced && !isCountdownActive && !hasR3Qualifiers && (
                    <div className="racing-card rounded-2xl p-8 sm:p-12 border-2 border-amber-500/40 bg-slate-950/90 shadow-2xl text-center max-w-xl mx-auto space-y-5 animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-950/40">
                        <AlertTriangle className="w-8 h-8 text-amber-400" />
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-race font-bold uppercase tracking-widest text-amber-400">
                          QUALIFICATION REQUIRED
                        </span>
                        <h4 className="font-race text-2xl font-black text-white">
                          NO TEAMS QUALIFIED FOR FINAL ROUND
                        </h4>
                        <p className="text-xs text-slate-400 font-mono-code max-w-md mx-auto leading-relaxed">
                          The Go Live option and Championship Winner Announcement are available only after teams have been qualified for Round 3. Please select and qualify teams in the Evaluation or Standings tab first.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('evaluation')}
                          className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-race font-bold uppercase transition-all inline-flex items-center space-x-2 cursor-pointer shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          <span>Go to Evaluation / Standings</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* GO LIVE CONTROL CONSOLE (Shown when results are NOT yet live AND teams are qualified) */}
                  {/* BEFORE GOING LIVE: ONLY CONTAINS THE TIMER & GO LIVE BUTTON */}
                  {!isResultsAnnounced && !isCountdownActive && hasR3Qualifiers && (
                    <div className="racing-card rounded-2xl p-8 sm:p-12 border-2 border-amber-500/50 bg-gradient-to-b from-slate-950/95 via-slate-950/95 to-amber-950/20 shadow-2xl text-center max-w-xl mx-auto space-y-6 animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-950/40">
                        <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-race font-bold uppercase tracking-widest text-amber-400">
                          ANNOUNCEMENT TIMER
                        </span>
                        <h4 className="font-race text-2xl font-black text-white">
                          START CHAMPIONSHIP COUNTDOWN
                        </h4>
                        <p className="text-xs text-slate-400 font-mono-code max-w-md mx-auto">
                          Select the countdown timer duration and click Go Live to announce the winner &amp; 1st runner up.
                        </p>
                      </div>

                      {/* ONLY SHOWS THE TIMER */}
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                        <span className="text-[11px] font-mono-code text-slate-400 uppercase block font-bold">
                          SELECT COUNTDOWN TIMER:
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {[5, 10, 15, 30, 60].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setWinnerTimerSeconds(s)}
                              className={`px-4 py-2 rounded-xl text-xs font-mono-code font-bold transition-all cursor-pointer ${
                                winnerTimerSeconds === s
                                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 scale-105'
                                  : 'bg-slate-950 text-slate-400 hover:text-white border border-white/10'
                              }`}
                            >
                              {s}s Timer
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* GO LIVE BUTTON */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => handleStartGoLive(winnerTimerSeconds)}
                          disabled={isPublishingLive}
                          className="flex-1 py-4 rounded-xl font-race font-black text-xs uppercase transition-all flex items-center justify-center space-x-2.5 shadow-2xl bg-gradient-to-r from-red-600 via-amber-500 to-amber-400 hover:from-red-500 hover:to-amber-300 text-slate-950 shadow-red-950/70 glow-red cursor-pointer transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                          {isPublishingLive ? (
                            <>
                              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                              <span>STARTING COUNTDOWN...</span>
                            </>
                          ) : (
                            <>
                              <Rocket className="w-5 h-5 text-slate-950" />
                              <span>GO LIVE ({winnerTimerSeconds}s TIMER)</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGoLiveInstant()}
                          disabled={isPublishingLive}
                          className="py-4 px-5 rounded-xl font-race font-bold text-xs uppercase transition-all flex items-center justify-center space-x-2 shadow-xl bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-white border border-amber-500/40 cursor-pointer transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                          <Trophy className="w-4 h-4 text-amber-400" />
                          <span>REVEAL NOW</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ACTIVE COUNTDOWN SCREEN (When timer starts) */}
                  {isCountdownActive && (
                    <div className="racing-card rounded-2xl p-8 sm:p-12 border-2 border-red-500/60 bg-gradient-to-b from-red-950/40 via-slate-950/95 to-slate-950/95 shadow-2xl text-center relative overflow-hidden space-y-5 animate-fade-in">
                      <div className="absolute inset-0 bg-red-600/5 animate-pulse pointer-events-none" />

                      <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-race uppercase tracking-widest font-bold">
                        <Clock className="w-4 h-4 animate-spin text-red-400" />
                        <span>CHAMPIONSHIP RESULTS ANNOUNCEMENT COUNTDOWN</span>
                      </div>

                      <h3 className="font-race text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
                        {announcementCountdown === 0 || isPublishingLive
                          ? 'REVEALING GRAND CHAMPION & 1ST RUNNER UP...'
                          : 'GOING LIVE WITH WINNER & RUNNER UP IN'}
                      </h3>

                      <div className="my-6 space-y-2">
                        <span className="font-race text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-amber-300 tracking-widest filter drop-shadow-[0_0_25px_rgba(239,68,68,0.7)] select-none">
                          00:{String(Math.max(0, announcementCountdown || 0)).padStart(2, '0')}
                        </span>
                        {(announcementCountdown === 0 || isPublishingLive) && (
                          <div className="flex items-center justify-center space-x-2 text-amber-300 font-race font-bold text-xs sm:text-sm tracking-wider animate-pulse pt-2">
                            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                            <span>BROADCASTING OFFICIAL RESULTS LIVE...</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 font-mono-code max-w-md mx-auto">
                        Results will automatically broadcast across all stages when the timer reaches zero.
                      </p>

                      <div className="flex items-center justify-center gap-3 pt-3">
                        <button
                          type="button"
                          onClick={handleGoLiveInstant}
                          disabled={isPublishingLive}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-race font-bold text-xs uppercase shadow-lg shadow-amber-950/60 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                        >
                          <Trophy className="w-4 h-4" />
                          <span>{isPublishingLive ? 'Publishing Live...' : 'Reveal Results Immediately'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetGoLive}
                          disabled={isPublishingLive}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 font-race font-bold text-xs uppercase transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Cancel Broadcast</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BROADCAST IN PROGRESS CARD (Shown in dashboard if admin clicked Back to dismiss fullscreen overlay) */}
                  {isResultsAnnounced && announcementDismissed && (
                    <div className="racing-card rounded-2xl p-8 sm:p-10 border-2 border-amber-500/50 bg-gradient-to-b from-slate-950/95 via-slate-950/95 to-amber-950/20 shadow-2xl text-center max-w-xl mx-auto space-y-6 animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/40">
                        <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-race font-bold uppercase tracking-widest text-emerald-400">
                          ANNOUNCEMENT HELD IN COCKPIT &bull; LIVE BROADCAST ACTIVE
                        </span>
                        <h4 className="font-race text-2xl font-black text-white">
                          CHAMPIONSHIP PODIUM ANNOUNCED
                        </h4>
                        <p className="text-xs text-slate-400 font-mono-code max-w-md mx-auto">
                          Winner &amp; 1st Runner Up broadcast is actively live on participant displays while held in your Race Control cockpit.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setAnnouncementDismissed(false)}
                          className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-race font-black text-xs uppercase shadow-lg shadow-amber-950/60 transition-all flex items-center space-x-2 cursor-pointer"
                        >
                          <Trophy className="w-4 h-4 text-slate-950" />
                          <span>Resume Fullscreen Announcement</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResetGoLive}
                          className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 font-race font-bold text-xs uppercase transition-all flex items-center space-x-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Take Offline &amp; Reset</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OFFICIAL LIVE ANIMATED ANNOUNCEMENT — FULLSCREEN OVERLAY */}
                  {isResultsAnnounced && !announcementDismissed && (
                    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#02030a] select-none">
                      {/* ── Multi-layer ambient glows for depth ── */}
                      <div className="absolute -right-40 -top-40 w-[600px] h-[600px] bg-amber-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
                      <div className="absolute -left-40 -bottom-40 w-[600px] h-[600px] bg-fuchsia-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none" />
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(245,158,11,0.12),transparent)] pointer-events-none" />
                      {/* Subtle scanline overlay for drama */}
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_4px)] pointer-events-none z-[5]" />

                      {/* Continuous Paper Blast (Confetti) & Crackers (Fireworks) Canvas */}
                      <canvas
                        ref={celebrationCanvasRef}
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                      />

                      {/* ── CONTENT AREA ── */}
                      <div className="relative z-20 flex-1 overflow-hidden py-3 px-4 flex flex-col justify-center min-h-0">
                        <div className="max-w-3xl mx-auto w-full flex flex-col gap-3 sm:gap-4 justify-center min-h-0">

                          {/* ── MEGA CLOUDNEX HEADER (Styled to match reference design) ── */}
                          <div className="text-center space-y-1">
                            {/* Outline badge with trophies (subtle clean glow) */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#030d1d]/85 border border-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.4)] backdrop-blur-md">
                              <span className="text-xs">🏆</span>
                              <span className="text-white font-race font-bold text-[10px] sm:text-xs tracking-[0.22em] uppercase">
                                OFFICIAL GRAND PRIX FINAL RESULTS
                              </span>
                              <span className="text-xs">🏆</span>
                            </div>

                            {/* Giant CLOUDNEX 2K26 brand — Electric Cyan / Ice Blue Metallic with softer glow */}
                            <div className="relative mt-1 mb-0.5">
                              {/* Soft ambient backlight aura */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-72 sm:w-[420px] h-12 bg-cyan-400/15 blur-2xl rounded-full" />
                              </div>
                              <p className="font-race text-5xl sm:text-7xl font-black tracking-[0.06em] uppercase leading-none relative"
                                style={{
                                  background: 'linear-gradient(180deg, #f0fdfa 0%, #cffafe 20%, #67e8f9 45%, #0ea5e9 75%, #0284c7 95%, #0369a1 100%)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                  filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.6)) drop-shadow(0 0 22px rgba(14,165,233,0.35))'
                                }}
                              >
                                CLOUDNEX 2K26
                              </p>
                              {/* Subtitle with dashes */}
                              <p className="font-race text-[10px] sm:text-xs uppercase tracking-[0.45em] text-cyan-100 font-extrabold mt-1 drop-shadow-[0_0_4px_rgba(56,189,248,0.4)]">
                                — THE CHAMPIONSHIP HAS SPOKEN —
                              </p>
                            </div>

                            {/* WINNER headline — Gold Champions + 3D Golden WINNERS with subtle clean glow */}
                            <div className="mt-1">
                              <h2 className="font-race leading-none select-none">
                                <span className="block text-sm sm:text-lg font-black uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]">
                                  🏆 CONGRATULATIONS, CHAMPIONS!
                                </span>
                                <span className="block text-4xl sm:text-6xl font-black uppercase tracking-wider my-1"
                                  style={{
                                    background: 'linear-gradient(180deg, #ffffff 0%, #fffbeb 18%, #fef08a 40%, #facc15 65%, #ca8a04 90%, #854d0e 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    filter: 'drop-shadow(0 0 10px rgba(250,204,21,0.65)) drop-shadow(0 0 22px rgba(234,179,8,0.4))'
                                  }}
                                >
                                  WINNERS
                                </span>
                                {/* Horizon Golden Light Beam */}
                                <div className="w-full max-w-sm h-[1.5px] bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_8px_#facc15] mx-auto mt-1.5" />
                              </h2>
                            </div>
                          </div>

                          {/* ── WINNER CARD (simple in gold color like runner section) ── */}
                          <div className="rounded-2xl overflow-hidden relative"
                            style={{
                              background: 'linear-gradient(135deg,rgba(120,53,15,0.6) 0%,rgba(2,6,23,1) 50%,rgba(15,23,42,0.7) 100%)',
                              boxShadow: '0 0 40px rgba(245,158,11,0.35), inset 0 1px 0 rgba(245,158,11,0.2)'
                            }}
                          >
                            <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/75 pointer-events-none" />

                            <div className="flex items-center gap-3 p-3.5 sm:p-4 border-b border-amber-400/25 relative">
                              {/* Trophy icon with spinning ring */}
                              <div className="relative shrink-0">
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/40">
                                  <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-slate-950 animate-bounce" />
                                </div>
                                <div className="absolute -inset-1.5 rounded-xl border border-amber-400/40 animate-spin" style={{animationDuration:'3s'}} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-200 text-slate-950 text-[9px] font-race font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                                  👑 1ST PLACE · GRAND CHAMPION
                                </span>
                                <h3 className="font-race text-xl sm:text-3xl font-black mt-0.5 tracking-wide uppercase truncate"
                                  style={{
                                    background: 'linear-gradient(90deg,#fef08a,#fbbf24,#fde68a,#f59e0b)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.6))'
                                  }}
                                >
                                  {winner ? winner.team_name : 'Grand Champion'}
                                </h3>

                              </div>
                            </div>
                            <div className="p-3.5 sm:p-4 space-y-1.5">
                              <p className="font-race text-sm font-black tracking-wide"
                                style={{
                                  background: 'linear-gradient(90deg,#fde047,#fbbf24,#f59e0b)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text'
                                }}
                              >
                                🌟 Crowned. Undisputed. Unstoppable.
                              </p>
                              <p className="text-xs text-amber-100/90 font-sans leading-relaxed">
                                From the very first keystroke to the final deployment,{' '}
                                <span className="font-bold text-yellow-300">{winner ? winner.team_name : 'this team'}</span>{' '}
                                demonstrated what true cloud mastery looks like under pressure.
                                Their architecture didn't just survive the storm —{' '}
                                <span className="italic font-semibold text-amber-300">it became the storm.</span>
                              </p>
                              <p className="text-[9px] text-amber-400/70 font-mono-code italic border-l-2 border-amber-500/40 pl-2">
                                "Excellence isn't a moment. It's a mindset."
                              </p>
                            </div>
                          </div>

                          {/* ── RUNNER UP CARD ── */}
                          <div className="rounded-2xl overflow-hidden relative"
                            style={{
                              background: 'linear-gradient(135deg,rgba(6,182,212,0.3) 0%,rgba(30,27,75,0.8) 40%,rgba(2,6,23,0.95) 75%,rgba(236,72,153,0.2) 100%)',
                              boxShadow: '0 0 50px rgba(6,182,212,0.4), 0 0 80px rgba(168,85,247,0.3), inset 0 1px 0 rgba(6,182,212,0.3)'
                            }}
                          >
                            <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400/75 pointer-events-none" />

                            <div className="flex items-center gap-3 p-3.5 sm:p-4 border-b border-cyan-400/25 relative">
                              <div className="relative shrink-0">
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-cyan-500/40">
                                  <Award className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                </div>
                                <div className="absolute -inset-1.5 rounded-xl border border-cyan-400/40 animate-spin" style={{animationDuration:'4s'}} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-400 via-teal-200 to-purple-400 text-slate-950 text-[9px] font-race font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                                  🥈 1ST RUNNER UP
                                </span>
                                <h3 className="font-race text-xl sm:text-3xl font-black mt-0.5 tracking-wide uppercase truncate"
                                  style={{
                                    background: 'linear-gradient(90deg,#67e8f9 0%,#a855f7 35%,#f472b6 70%,#38bdf8 100%)',
                                    backgroundSize: '250% 100%',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    filter: 'drop-shadow(0 0 15px rgba(6,182,212,0.7)) drop-shadow(0 0 30px rgba(168,85,247,0.5))'
                                  }}
                                >
                                  {runnerUp ? runnerUp.team_name : '1st Runner Up'}
                                </h3>

                              </div>
                            </div>
                            <div className="p-3.5 sm:p-4 space-y-1.5">
                              <p className="font-race text-sm font-black tracking-wide"
                                style={{
                                  background: 'linear-gradient(90deg,#67e8f9,#c084fc,#f472b6)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text'
                                }}
                              >
                                👏 Brilliant. Resilient. Remarkable.
                              </p>
                              <p className="text-xs text-cyan-100/88 font-sans leading-relaxed">
                                The race was fierce, and{' '}
                                <span className="font-bold text-cyan-300">{runnerUp ? runnerUp.team_name : 'this team'}</span>{' '}
                                gave everything on the grid. Runner Up at CLOUDNEX is no small feat —{' '}
                                <span className="italic font-semibold text-teal-300">it's a testament to world-class talent.</span>
                              </p>
                              <p className="text-[9px] text-cyan-400/70 font-mono-code italic border-l-2 border-cyan-500/40 pl-2">
                                "Second place proves they pushed the champion to their absolute limit."
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* ── TINY RESET BUTTON — absolute bottom-left ── */}
                      <div className="absolute bottom-3 left-4 z-30">
                        <button
                          type="button"
                          onClick={handleResetGoLive}
                          className="px-2.5 py-1 rounded bg-slate-950/90 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-white/5 hover:border-red-500/30 text-[9px] font-mono-code transition-all duration-300 flex items-center space-x-1 cursor-pointer opacity-0 hover:opacity-100 shadow-sm"
                          title="Take offline and reset"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Take Offline &amp; Reset</span>
                        </button>
                      </div>

                      {/* ── BACK TO COCKPIT BUTTON (Bottom-right) ── */}
                      <div className="absolute bottom-3 right-4 z-30">
                        <button
                          type="button"
                          onClick={() => setAnnouncementDismissed(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/20 hover:border-amber-400/60 text-xs font-mono-code transition-all flex items-center space-x-1.5 cursor-pointer shadow-lg hover:shadow-amber-500/10 group"
                          title="Back to Cockpit • Hold Announcement"
                        >
                          <ArrowLeft className="w-3.5 h-3.5 text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
                          <span>Back to Cockpit &bull; Hold Announcement</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
{/* EVALUATION MODAL */}
        {evalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="racing-card rounded-2xl p-6 sm:p-7 max-w-xl w-full max-h-[90vh] overflow-y-auto border border-red-500/40 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 sticky top-0 bg-[#080a0f]/95 backdrop-blur-md z-10 -mt-2 pt-2">
                <div>
                  <h4 className="font-race text-lg font-bold text-white flex items-center space-x-2">
                    <span>{evalModal.round_number === 1 ? 'ROUND 1 ARCHITECTURE EVALUATION' : (evalModal.round_number === 3 ? 'FINAL ROUND EVALUATION' : 'ALLOCATE MARKS')}: {evalModal.team_name}</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs font-mono-code text-cyan-400">
                      {evalModal.team_id}
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    {evalModal.round_number === 1 ? (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/50 text-[10px] font-race uppercase font-bold">
                        Round 1 Rubrics &bull; Max 50 Marks
                      </span>
                    ) : evalModal.round_number === 3 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-race uppercase font-bold">
                        Round 3 Rubrics &bull; Max 50 Marks
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-race uppercase font-bold">
                        Round 2 Rubrics &bull; Max 100 Pts
                      </span>
                    )}
                    <span className="text-slate-600">&bull;</span>
                    <div className="flex items-center space-x-1.5">
                      <label className="text-[11px] font-race text-slate-400 uppercase">Lap:</label>
                      <select
                        value={evalModal.round_number}
                        onChange={(e) => {
                          const newR = Number(e.target.value);
                          setEvalModal({ ...evalModal, round_number: newR });
                          const existingEval = evaluations.find(
                            (ev) => ev.team_id === evalModal.team_id && ev.round_number === newR
                          );
                          if (existingEval) {
                            setEvalScores({
                              architecture_design: existingEval.architecture_design ?? 10,
                              service_selection: existingEval.service_selection ?? 7,
                              scalability_performance: existingEval.scalability_performance ?? 7,
                              security_protection: existingEval.security_protection ?? 6,
                              high_availability: existingEval.high_availability ?? 6,
                              cost_optimization: existingEval.cost_optimization ?? 3,
                              technical_feasibility: existingEval.technical_feasibility ?? 3,
                              innovation: existingEval.innovation_score ?? 18,
                              functionality: existingEval.functionality_score ?? 22,
                              scalability: existingEval.scalability_score ?? 18,
                              crisis: existingEval.crisis_handling_score ?? 18,
                              presentation: existingEval.presentation_score ?? 14,
                              blockchainBonus: existingEval.blockchain_bonus ?? 0,
                              includeBonus: existingEval.include_bonus !== false,
                              feedback: existingEval.feedback || ''
                            });
                          } else {
                            setEvalScores({
                              architecture_design: 10,
                              service_selection: 7,
                              scalability_performance: 7,
                              security_protection: 6,
                              high_availability: 6,
                              cost_optimization: 3,
                              technical_feasibility: 3,
                              innovation: 18,
                              functionality: 22,
                              scalability: 18,
                              crisis: 18,
                              presentation: 14,
                              blockchainBonus: 0,
                              includeBonus: true,
                              feedback: ''
                            });
                          }
                        }}
                        className="bg-slate-900 border border-white/20 rounded px-2 py-0.5 text-white text-xs font-bold font-mono-code"
                      >
                        <option value={1}>Lap 01: Architecture (50 Marks)</option>
                        <option value={2}>Lap 02: Build &amp; Deploy (100 Pts)</option>
                        <option value={3}>Lap 03: Final Round Cloud Crisis (50 Marks)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setEvalModal(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold p-1"
                >
                  &times;
                </button>
              </div>

              {/* Submitted Artifacts Banner inside Evaluation Modal */}
              {(() => {
                const sub = submissions.find(
                  (s) => s.team_id === evalModal.team_id && s.round_number === evalModal.round_number
                );
                if (!sub) {
                  return (
                    <div className="p-3 mb-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono-code text-slate-400">
                      No submission artifact recorded yet for Lap 0{evalModal.round_number}.
                    </div>
                  );
                }
                return (
                  <div className="p-3 mb-3 rounded-xl bg-slate-950/90 border border-white/15 space-y-2 text-xs font-mono-code">
                    <span className="text-[11px] font-race text-slate-400 uppercase flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Lap 0{evalModal.round_number} Submitted Solution:</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {(sub.file_path || sub.file_name) && (
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const fileName = sub.file_path || sub.file_name;
                              const fileUrl = `/api/v1/submissions/file/${fileName}`;
                              setPreviewFile({
                                url: fileUrl,
                                filename: sub.file_name || fileName,
                                title: `${evalModal.team_name} • Round 1 Architecture Blueprint`,
                                teamName: evalModal.team_name,
                                isPdf: (fileName || '').toLowerCase().endsWith('.pdf')
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-race font-bold text-xs uppercase flex items-center space-x-1.5 shadow-md shadow-amber-950/60"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open Blueprint ({sub.file_name || 'File'})</span>
                          </button>
                          <a
                            href={`/api/v1/submissions/file/${sub.file_path || sub.file_name}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                            title="Open in new window like demo link"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                      {sub.github_url && (
                        <a
                          href={sub.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-500/50 text-cyan-300 hover:text-white flex items-center space-x-1 font-bold"
                        >
                          <span>GitHub Repo</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                      {sub.deployed_url && (
                        <a
                          href={sub.deployed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-red-500/50 text-red-300 hover:text-white flex items-center space-x-1 font-bold"
                        >
                          <span>Live Demo App</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleSaveEvaluation} className="space-y-3 font-mono-code text-xs">
                {evalModal.round_number === 1 ? (
                  /* OFFICIAL 7 ROUND 1 ARCHITECTURE RUBRICS (50 MARKS TOTAL) */
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-slate-950 border border-cyan-500/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-cyan-300">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-race font-bold uppercase text-[11px] tracking-wider">Round 1 Rubrics Criteria</span>
                      </div>
                      <span className="font-race font-black text-xs text-cyan-300 px-2.5 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-500/50">
                        Total 50 Marks
                      </span>
                    </div>

                    {/* 1. Cloud Architecture Design (Max 12) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">1</span>
                          <span>Cloud Architecture Design</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 12 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Correct architecture, component interactions, and suitability for the given problem
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="12"
                          step="0.5"
                          value={evalScores.architecture_design ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, architecture_design: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="12"
                          step="0.5"
                          value={evalScores.architecture_design ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, architecture_design: Math.min(12, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* 2. Cloud Service Selection (Max 8) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">2</span>
                          <span>Cloud Service Selection</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 8 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Appropriate selection of compute, database, storage, networking, and cloud services
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="8"
                          step="0.5"
                          value={evalScores.service_selection ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, service_selection: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="8"
                          step="0.5"
                          value={evalScores.service_selection ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, service_selection: Math.min(8, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* 3. Scalability & Performance (Max 8) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">3</span>
                          <span>Scalability &amp; Performance</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 8 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Handling peak users, traffic growth, load balancing, and resource scaling
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="8"
                          step="0.5"
                          value={evalScores.scalability_performance ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, scalability_performance: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="8"
                          step="0.5"
                          value={evalScores.scalability_performance ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, scalability_performance: Math.min(8, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* 4. Security & Data Protection (Max 7) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">4</span>
                          <span>Security &amp; Data Protection</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 7 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Authentication, access control, encryption, and protection of sensitive data
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="7"
                          step="0.5"
                          value={evalScores.security_protection ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, security_protection: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="7"
                          step="0.5"
                          value={evalScores.security_protection ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, security_protection: Math.min(7, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* 5. High Availability & Fault Tolerance (Max 7) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">5</span>
                          <span>High Availability &amp; Fault Tolerance</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 7 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Redundancy, failure handling, backup, and disaster recovery
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="7"
                          step="0.5"
                          value={evalScores.high_availability ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, high_availability: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="7"
                          step="0.5"
                          value={evalScores.high_availability ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, high_availability: Math.min(7, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* 6. Cost Optimization (Max 4) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">6</span>
                          <span>Cost Optimization</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 4 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Cost-effective service selection and efficient resource utilization
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="4"
                          step="0.5"
                          value={evalScores.cost_optimization ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, cost_optimization: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="4"
                          step="0.5"
                          value={evalScores.cost_optimization ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, cost_optimization: Math.min(4, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* 7. Technical Feasibility (Max 4) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono-code font-bold">7</span>
                          <span>Technical Feasibility</span>
                        </label>
                        <span className="text-cyan-400 font-mono-code font-bold text-xs bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Max 4 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Practical implementation, justified design decisions, and compatibility of components
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="4"
                          step="0.5"
                          value={evalScores.technical_feasibility ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, technical_feasibility: e.target.value })}
                          className="flex-1 accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="4"
                          step="0.5"
                          value={evalScores.technical_feasibility ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, technical_feasibility: Math.min(4, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : evalModal.round_number === 2 ? (
                  /* OFFICIAL 9 ROUND 2 BUILD & DEPLOY RUBRICS (100 MARKS TOTAL) */
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-500/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-emerald-300">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-race font-bold uppercase text-[11px] tracking-wider">Round 2 Build &amp; Deploy Rubrics</span>
                      </div>
                      <span className="font-race font-black text-xs text-emerald-300 px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/50">
                        Total 100 Marks
                      </span>
                    </div>

                    {/* 1. Application Functionality & API Implementation (Max 15) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">1</span>
                          <span>Application Functionality &amp; API Implementation</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 15 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Required API endpoints, correct request/response handling, validation, and error handling
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="15"
                          step="0.5"
                          value={evalScores.app_functionality ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, app_functionality: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.5"
                          value={evalScores.app_functionality ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, app_functionality: Math.min(15, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 2. Cloud Deployment & Accessibility (Max 25) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">2</span>
                          <span>Cloud Deployment &amp; Accessibility</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 25 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Successful deployment, application accessibility, correct configuration, and service availability
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="25"
                          step="0.5"
                          value={evalScores.cloud_deployment ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, cloud_deployment: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="25"
                          step="0.5"
                          value={evalScores.cloud_deployment ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, cloud_deployment: Math.min(25, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 3. Database Integration (Max 10) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">3</span>
                          <span>Database Integration</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 10 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Database connectivity, CRUD operations, data persistence, and correct query handling
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={evalScores.database_integration ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, database_integration: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={evalScores.database_integration ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, database_integration: Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 4. Containerization (Max 10) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">4</span>
                          <span>Containerization</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 10 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Correct Dockerfile, successful image build, container execution, and configuration
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={evalScores.containerization ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, containerization: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={evalScores.containerization ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, containerization: Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 5. Authentication & Security (Max 15) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">5</span>
                          <span>Authentication &amp; Security</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 15 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Authentication, authorization, secure credentials, IAM permissions, and protection against unauthorized access
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="15"
                          step="0.5"
                          value={evalScores.auth_security ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, auth_security: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.5"
                          value={evalScores.auth_security ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, auth_security: Math.min(15, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 6. Object Storage Integration (Max 10) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">6</span>
                          <span>Object Storage Integration</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 10 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Successful file uploads, storage, retrieval, and appropriate access permissions
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={evalScores.object_storage ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, object_storage: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={evalScores.object_storage ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, object_storage: Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 7. Monitoring & Logging (Max 5) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">7</span>
                          <span>Monitoring &amp; Logging</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 5 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Application logs, error visibility, health checks, and basic monitoring configuration
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={evalScores.monitoring_logging ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, monitoring_logging: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={evalScores.monitoring_logging ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, monitoring_logging: Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 8. Reliability & Error Handling (Max 5) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">8</span>
                          <span>Reliability &amp; Error Handling</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 5 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Handling invalid requests, service failures, and configuration or connection errors
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={evalScores.reliability_error_handling ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, reliability_error_handling: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={evalScores.reliability_error_handling ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, reliability_error_handling: Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* 9. Cloud Configuration & Resource Management (Max 5) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono-code font-bold">9</span>
                          <span>Cloud Configuration &amp; Resource Management</span>
                        </label>
                        <span className="text-emerald-400 font-mono-code font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          Max 5 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Correct networking, environment variables, resource configuration, and cleanup of unnecessary resources
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={evalScores.cloud_config_management ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, cloud_config_management: e.target.value })}
                          className="flex-1 accent-emerald-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={evalScores.cloud_config_management ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, cloud_config_management: Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* OFFICIAL ROUND 3 FINAL SHOWDOWN RUBRICS (50 MARKS TOTAL) */
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/60 to-slate-950 border border-amber-500/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-amber-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-race font-bold uppercase text-[11px] tracking-wider">Round 3 Crisis &amp; Defense Rubrics</span>
                      </div>
                      <span className="font-race font-black text-xs text-amber-300 px-2.5 py-0.5 rounded-full bg-amber-900/60 border border-amber-500/50">
                        Total 50 Marks
                      </span>
                    </div>

                    {/* 1. Crisis Challenge (Max 30) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-amber-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-mono-code font-bold">1</span>
                          <span>Crisis Challenge</span>
                        </label>
                        <span className="text-amber-400 font-mono-code font-bold text-xs bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                          Max 30 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Incident mitigation, chaos engineering recovery, root cause diagnosis, and live system stabilization
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="0.5"
                          value={evalScores.crisis_challenge ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, crisis_challenge: e.target.value })}
                          className="flex-1 accent-amber-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="30"
                          step="0.5"
                          value={evalScores.crisis_challenge ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, crisis_challenge: Math.min(30, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* 2. Presentation (Max 20) */}
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 hover:border-amber-500/40 transition-colors space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-white font-bold font-race text-xs flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-mono-code font-bold">2</span>
                          <span>Presentation &amp; Defense</span>
                        </label>
                        <span className="text-amber-400 font-mono-code font-bold text-xs bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                          Max 20 Marks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-tight">
                        Post-mortem defense, stakeholder communication, architectural explanation, and steward Q&amp;A
                      </p>
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="0.5"
                          value={evalScores.presentation ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, presentation: e.target.value })}
                          className="flex-1 accent-amber-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={evalScores.presentation ?? 0}
                          onChange={(e) => setEvalScores({ ...evalScores, presentation: Math.min(20, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-16 bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 mb-1">Steward Feedback &amp; Review</label>
                  <textarea
                    rows="2"
                    value={evalScores.feedback}
                    onChange={(e) => setEvalScores({ ...evalScores, feedback: e.target.value })}
                    placeholder="Enter technical comments..."
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Live Calculated Total Marks Preview */}
                {evalModal.round_number === 1 ? (
                  <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 flex items-center justify-between">
                    <div>
                      <span className="font-race text-cyan-300 uppercase text-xs block">Round 1 Calculated Marks:</span>
                      <span className="text-[10px] text-slate-400 font-mono-code">Sum of 7 official rubrics</span>
                    </div>
                    <span className="font-race font-bold text-lg text-cyan-300">
                      {(
                        parseFloat(evalScores.architecture_design || 0) +
                        parseFloat(evalScores.service_selection || 0) +
                        parseFloat(evalScores.scalability_performance || 0) +
                        parseFloat(evalScores.security_protection || 0) +
                        parseFloat(evalScores.high_availability || 0) +
                        parseFloat(evalScores.cost_optimization || 0) +
                        parseFloat(evalScores.technical_feasibility || 0)
                      ).toFixed(1)} / 50 Marks
                    </span>
                  </div>
                ) : evalModal.round_number === 2 ? (
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between">
                    <div>
                      <span className="font-race text-emerald-400 uppercase text-xs block">Round 2 Calculated Marks:</span>
                      <span className="text-[10px] text-slate-400 font-mono-code">Sum of 9 official deployment rubrics</span>
                    </div>
                    <span className="font-race font-bold text-lg text-emerald-400">
                      {(
                        parseFloat(evalScores.app_functionality || 0) +
                        parseFloat(evalScores.cloud_deployment || 0) +
                        parseFloat(evalScores.database_integration || 0) +
                        parseFloat(evalScores.containerization || 0) +
                        parseFloat(evalScores.auth_security || 0) +
                        parseFloat(evalScores.object_storage || 0) +
                        parseFloat(evalScores.monitoring_logging || 0) +
                        parseFloat(evalScores.reliability_error_handling || 0) +
                        parseFloat(evalScores.cloud_config_management || 0)
                      ).toFixed(1)} / 100 Marks
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-between">
                    <div>
                      <span className="font-race text-amber-300 uppercase text-xs block">Round 3 Calculated Marks:</span>
                      <span className="text-[10px] text-slate-400 font-mono-code">Crisis Challenge (30) + Presentation (20)</span>
                    </div>
                    <span className="font-race font-bold text-lg text-amber-400">
                      {(
                        parseFloat(evalScores.crisis_challenge || 0) +
                        parseFloat(evalScores.presentation || 0)
                      ).toFixed(1)} / 50 Marks
                    </span>
                  </div>
                )}

                <div className="pt-3 flex space-x-3 font-race">
                  <button
                    type="button"
                    onClick={() => setEvalModal(null)}
                    className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase cursor-pointer hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase glow-red shadow-lg shadow-red-950/60 cursor-pointer transition-colors"
                  >
                    Save &amp; Record Marks
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: RESET ALLOCATION CONFIRMATION */}
        {resetModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="racing-card max-w-md w-full p-6 rounded-2xl border border-red-600/50 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-red-500">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h4 className="font-race text-lg font-bold text-white uppercase">
                  CONFIRM ALLOCATION RESET
                </h4>
              </div>

              <p className="text-xs text-slate-300 font-mono-code leading-relaxed">
                Resetting will wipe all problem statement assignments from all registered teams and move them back to unallocated status.
              </p>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-race text-slate-300 uppercase">
                  Reason for Reshuffle / Reset (Optional)
                </label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="e.g. Added 5 late-registering teams"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-race text-amber-400 uppercase font-bold">
                  Type <span className="text-red-500 font-mono-code font-black">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="w-full bg-slate-950 border border-red-500/50 rounded-xl px-3 py-2 text-sm text-center text-white font-mono-code font-bold uppercase tracking-widest"
                />
              </div>

              <div className="pt-4 flex space-x-3 font-race">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalOpen(false);
                    setResetConfirmText('');
                    setResetReason('');
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={handleResetAllocation}
                  disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                  className={`w-1/2 py-2.5 rounded-xl text-white text-xs font-bold uppercase transition-all ${resetConfirmText.trim().toUpperCase() === 'RESET'
                    ? 'bg-red-600 hover:bg-red-700 glow-red'
                    : 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: BULK UPLOAD 10 PROBLEMS */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="racing-card max-w-2xl w-full p-6 sm:p-8 rounded-2xl border border-white/20 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2.5">
                  <Upload className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-race text-lg font-bold text-white uppercase">
                    UPLOAD 10 PROBLEM STATEMENTS JSON
                  </h4>
                </div>
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-mono-code">
                Paste a JSON array containing problem statement objects. Each object should define <code>problem_id</code>, <code>title</code>, and <code>description</code>.
              </p>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const templateList = problemStatements && problemStatements.length > 0
                      ? problemStatements
                      : Array.from({ length: 10 }, (_, i) => ({
                        problem_id: `PS-${String(i + 1).padStart(2, '0')}`,
                        title: `Problem Statement ${i + 1}`,
                        description: `Detailed description for Problem Statement ${i + 1}...`
                      }));
                    setJsonUploadText(JSON.stringify(
                      templateList.map((p, idx) => ({
                        problem_id: p.problem_id || `PS-${String(idx + 1).padStart(2, '0')}`,
                        title: p.title || `Problem Statement ${idx + 1}`,
                        description: p.description || p.scenario || ''
                      })),
                      null,
                      2
                    ));
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-race rounded-lg"
                >
                  Load Current Template JSON
                </button>
              </div>

              <textarea
                rows="12"
                value={jsonUploadText}
                onChange={(e) => setJsonUploadText(e.target.value)}
                placeholder={'[\n  {\n    "problem_id": "PS-01",\n    "title": "Cloud Architecture Challenge",\n    "description": "Detailed description of the challenge..."\n  }\n]'}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white font-mono-code"
              />

              <div className="pt-2 flex justify-end space-x-3 font-race">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkUploadProblems}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase glow-green"
                >
                  Save &amp; Apply Problem Statements
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IN-PORTAL BLUEPRINT / FILE PREVIEW MODAL */}
        {previewFile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6">
            <div className="racing-card rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-amber-500/50 shadow-2xl overflow-hidden bg-slate-950">
              {/* Modal Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-race text-sm sm:text-base font-bold text-white uppercase">
                      {previewFile.title}
                    </h4>
                    <span className="text-[11px] font-mono-code text-slate-400">
                      {previewFile.filename}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono-code flex items-center space-x-1.5 border border-white/10 transition-colors"
                    title="Open in new window like demo link"
                  >
                    <span>Open in New Tab</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-lg font-bold"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Modal Body: Inline Viewer */}
              <div className="p-4 flex-1 overflow-auto bg-black/60 flex items-center justify-center min-h-[350px]">
                {previewFile.isPdf ? (
                  <iframe
                    src={previewFile.url}
                    title={previewFile.title}
                    className="w-full h-[70vh] rounded-lg border border-white/10 bg-slate-900"
                  />
                ) : (
                  <div className="relative max-h-[72vh] flex items-center justify-center w-full">
                    <img
                      src={previewFile.url}
                      alt={previewFile.title}
                      className="max-w-full max-h-[72vh] object-contain rounded-lg border border-white/10 shadow-2xl"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `/static/uploads/${previewFile.filename}`;
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs font-mono-code text-slate-400">
                <span>Architecture Blueprint Telemetry &bull; Round 1</span>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-race font-bold text-xs uppercase transition-all"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RESET ENTIRE EVENT CONFIRMATION */}
        {resetEventModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="racing-card max-w-lg w-full p-6 sm:p-7 rounded-2xl border border-red-600/70 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-red-500">
                <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-500/50 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h4 className="font-race text-lg sm:text-xl font-black text-white uppercase tracking-wide">
                    RESET ENTIRE EVENT
                  </h4>
                  <span className="text-[10px] font-mono-code text-red-400 font-bold uppercase tracking-wider block">
                    Race Control Hard Reset
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-slate-200 font-mono-code leading-relaxed space-y-2">
                <p className="font-bold text-red-300">
                  ⚠️ This action will reset the competition back to the very beginning:
                </p>
                <ul className="space-y-1 list-disc list-inside text-slate-300 text-[11px]">
                  <li>All 3 rounds are reset to locked state (Round 1 ready to start).</li>
                  <li>All submitted solution files and links are wiped.</li>
                  <li>All judge evaluations &amp; marks are wiped (team scores set to 0.0 Pts).</li>
                  <li>All winner announcements &amp; podium ceremonies are cleared.</li>
                  <li className="text-emerald-400 font-bold">
                    User accounts, login passwords, and registered teams are NEVER deleted.
                  </li>
                </ul>
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-race text-amber-400 uppercase font-bold">
                  Type <span className="text-red-500 font-mono-code font-black text-sm">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetEventConfirmText}
                  onChange={(e) => setResetEventConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="w-full bg-slate-950 border border-red-500/50 focus:border-red-500 rounded-xl px-4 py-2.5 text-sm text-center text-white font-mono-code font-bold uppercase tracking-widest outline-none shadow-inner"
                />
              </div>

              <div className="pt-3 flex space-x-3 font-race">
                <button
                  type="button"
                  disabled={isResettingEvent}
                  onClick={() => {
                    setResetEventModalOpen(false);
                    setResetEventConfirmText('');
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetEventConfirmText.trim().toUpperCase() !== 'RESET' || isResettingEvent}
                  onClick={handleResetEntireEvent}
                  className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-red-950/60 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                >
                  {isResettingEvent ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Event Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
