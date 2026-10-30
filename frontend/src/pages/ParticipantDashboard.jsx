import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, Clock, CheckCircle2, Lock, Upload,
  GitBranch, Globe, ShieldAlert, Award,
  RefreshCw, Radio, AlertCircle, Eye, ArrowUpRight,
  Trophy, Sparkles, X, Timer, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRaceSocket } from '../context/RaceSocketContext';
import { api } from '../api/client';
import CircuitTrack from '../components/CircuitTrack';
import Round3Celebration from '../components/Round3Celebration';
import RulesAndRegulationsModal from '../components/RulesAndRegulationsModal';
import dashboardBg from '../assets/dashboard_bg.jpg';

export default function ParticipantDashboard() {
  const { user, teamId, team, refreshProfile } = useAuth();
  const { registerListener, isConnected, reconnect } = useRaceSocket();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesModalTab, setRulesModalTab] = useState('pdf');

  const [rounds, setRounds] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_rounds');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(1);
  const selectedRoundNumberRef = useRef(1);
  const round3SectionRef = useRef(null);

  const parseUtcDate = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    const hasTimezone = str.endsWith('Z') || str.includes('+') || (str.split('-').length > 3);
    const formatted = hasTimezone ? str : `${str}Z`;
    const parsed = new Date(formatted).getTime();
    return isNaN(parsed) ? new Date(str).getTime() : parsed;
  };

  const scrollToAnnouncement = () => {
    setTimeout(() => {
      const el = document.getElementById('round3-announcement-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (round3SectionRef.current) {
        round3SectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 200);
  };

  // Championship Winner Announcement State (Separated from Round 3 Selection)
  const [winnerAnnouncement, setWinnerAnnouncement] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_winner');
      return cached ? JSON.parse(cached) : {
        is_announced: false,
        is_timer_active: false,
        announcement_time: null,
        held: false,
        winner: null,
        runner_up: null
      };
    } catch {
      return {
        is_announced: false,
        is_timer_active: false,
        announcement_time: null,
        held: false,
        winner: null,
        runner_up: null
      };
    }
  });
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerSecondsLeft, setWinnerSecondsLeft] = useState(null);
  const hasFetchedWinnerExpiryRef = useRef(false);
  const modalCanvasRef = useRef(null);

  // Animated celebration sprinkles & mini-blasts exclusively contained inside the winner podium template
  useEffect(() => {
    if (!showWinnerModal) return;
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const colors = ['#f59e0b', '#fbbf24', '#fde047', '#38bdf8', '#06b6d4', '#ec4899', '#10b981', '#ffffff'];

    const createBurst = (x, y) => {
      if (particles.length > 90) return;
      const count = 22;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = Math.random() * 3.5 + 1.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 3 + 1.5,
          alpha: 1,
          decay: Math.random() * 0.02 + 0.012,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2
        });
      }
    };

    createBurst(canvas.width * 0.3, canvas.height * 0.25);
    createBurst(canvas.width * 0.7, canvas.height * 0.25);

    let frame = 0;
    const render = () => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      if (frame % 75 === 0) {
        createBurst(
          Math.random() * (canvas.width * 0.7) + canvas.width * 0.15,
          Math.random() * (canvas.height * 0.35) + canvas.height * 0.15
        );
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [showWinnerModal]);

  useEffect(() => {
    selectedRoundNumberRef.current = selectedRoundNumber;
  }, [selectedRoundNumber]);

  // Real-time live countdown ticker for winner announcement (only re-renders on second change)
  useEffect(() => {
    if (winnerAnnouncement?.is_timer_active && winnerAnnouncement?.announcement_time && !winnerAnnouncement?.is_announced) {
      hasFetchedWinnerExpiryRef.current = false;
      const targetMs = parseUtcDate(winnerAnnouncement.announcement_time);
      const update = () => {
        const skew = (typeof window !== 'undefined' && window.__cloudnex_server_time_skew) || 0;
        const now = Date.now() + skew;
        const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
        setWinnerSecondsLeft(prev => prev === remaining ? prev : remaining);
        if (remaining <= 0) {
          setShowWinnerModal(true);
          setWinnerAnnouncement(prev => ({
            ...prev,
            is_announced: true,
            is_timer_active: false
          }));
          if (!hasFetchedWinnerExpiryRef.current) {
            hasFetchedWinnerExpiryRef.current = true;
            fetchData();
          }
        }
      };
      update();
      const interval = setInterval(update, 250);
      return () => clearInterval(interval);
    } else {
      setWinnerSecondsLeft(null);
    }
  }, [winnerAnnouncement?.is_timer_active, winnerAnnouncement?.announcement_time, winnerAnnouncement?.is_announced]);

  const [submissions, setSubmissions] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_subs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  // Instant load: If we have cached rounds, render immediately without blocking!
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cloudnex_cached_rounds');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });

  // Safety timeout: Never keep the participant trapped on a loading spinner for more than 750ms
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 750);
    return () => clearTimeout(safetyTimer);
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Submission Form State
  const [githubUrl, setGithubUrl] = useState('');
  const [deployedUrl, setDeployedUrl] = useState('');
  const [deployInstructions, setDeployInstructions] = useState('');
  const [implementationSummary, setImplementationSummary] = useState('');
  const [architectureNotes, setArchitectureNotes] = useState('');
  const [recoveryStrategy, setRecoveryStrategy] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Load Rounds and Submissions
  const fetchData = async () => {
    try {
      const [roundsData, subsData, winnerData] = await Promise.all([
        api.rounds.getAll(),
        api.submissions.getMy(),
        api.winner.get().catch(() => null)
      ]);
      const safeR = Array.isArray(roundsData) ? roundsData : [];
      const safeS = Array.isArray(subsData) ? subsData : [];
      setRounds(safeR);
      setSubmissions(safeS);
      try {
        sessionStorage.setItem('cloudnex_cached_rounds', JSON.stringify(safeR));
        sessionStorage.setItem('cloudnex_cached_subs', JSON.stringify(safeS));
      } catch {}
      if (winnerData) {
        setWinnerAnnouncement(winnerData);
        try {
          sessionStorage.setItem('cloudnex_cached_winner', JSON.stringify(winnerData));
        } catch {}
      }

      const parseUtcTime = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        const hasTz = str.endsWith('Z') || str.includes('+') || (str.split('-').length > 3);
        const formatted = hasTz ? str : `${str}Z`;
        const parsed = new Date(formatted).getTime();
        return isNaN(parsed) ? new Date(str).getTime() : parsed;
      };

      const r3 = safeR.find(r => r.round_number === 3);
      const isR3TimerExpired = Boolean(
        r3?.results_timer_active &&
        r3?.results_announcement_time &&
        parseUtcTime(r3.results_announcement_time) <= Date.now()
      );
      const isR3SelectionRevealed = Boolean(
        r3 && !r3.results_held && (r3.selection_revealed || r3.results_announced || isR3TimerExpired)
      );
      const isUserQualifiedR3 = Boolean(
        isR3SelectionRevealed && (
          team?.is_qualified_r3 ||
          user?.is_qualified_r3 ||
          team?.status === 'QUALIFIED_FOR_FINAL' ||
          r3?.user_access === 'QUALIFIED' ||
          r3?.selection_status === 'QUALIFIED'
        )
      );
      if (r3?.results_timer_active && !isR3SelectionRevealed) {
        setSelectedRoundNumber(3);
        selectedRoundNumberRef.current = 3;
        scrollToAnnouncement();
      }

      // Auto-focus on whichever round is currently LIVE if no round is selected or current round is locked/closed
      const liveRound = safeR.find(r => r.status === 'LIVE');
      if (liveRound && !r3?.results_timer_active) {
        const curRound = safeR.find(r => r.round_number === selectedRoundNumberRef.current);
        if (!curRound || curRound.status === 'LOCKED' || curRound.status === 'CLOSED') {
          setSelectedRoundNumber(liveRound.round_number);
          selectedRoundNumberRef.current = liveRound.round_number;
        }
      }

      if (winnerData?.is_timer_active && !winnerData?.is_announced) {
        // Winner announcement countdown active - timer banner is shown on cockpit without forcing round tab switch
      }

      // Populate form if submission exists for selected round
      const targetRound = selectedRoundNumberRef.current;
      const currentSub = safeS.find(s => s.round_number === targetRound);
      if (currentSub) {
        setGithubUrl(currentSub.github_url || '');
        setDeployedUrl(currentSub.deployed_url || '');
        setDeployInstructions(currentSub.deployment_instructions || '');
        setImplementationSummary(currentSub.implementation_summary || '');
        setArchitectureNotes(currentSub.architecture_notes || '');
        setRecoveryStrategy(currentSub.recovery_strategy || '');
      } else {
        setGithubUrl('');
        setDeployedUrl('');
        setDeployInstructions('');
        setImplementationSummary('');
        setArchitectureNotes('');
        setRecoveryStrategy('');
        setSelectedFile(null);
      }
    } catch (err) {
      console.error('Error loading dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const userRef = useRef(user);
  const teamRef = useRef(team);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { teamRef.current = team; }, [team]);

  // Proactive session heartbeat to immediately enforce single-device limit
  useEffect(() => {
    let unmounted = false;
    const verifySession = async () => {
      if (unmounted) return;
      try {
        await api.auth.me();
      } catch (err) {
        if (err?.status === 401) {
          console.warn('Participant session invalidated by another device:', err.message);
        }
      }
    };

    const intervalId = setInterval(verifySession, 5000);
    const handleFocus = () => { verifySession(); };
    window.addEventListener('focus', handleFocus);

    return () => {
      unmounted = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    fetchData();

    // Listen for telemetry sync and cross-tab events
    const unregister = registerListener((event) => {
      console.log('Telemetry event received on cockpit:', event.type);

      // 1. INSTANT WINNER ANNOUNCEMENT UPDATE (0ms)
      if (event.type === 'WINNER_ANNOUNCEMENT_UPDATED' && event.data) {
        setWinnerAnnouncement(prev => {
          const merged = {
            ...prev,
            ...event.data,
            winner: event.data.winner || prev?.winner,
            runner_up: event.data.runner_up || prev?.runner_up
          };
          try { sessionStorage.setItem('cloudnex_cached_winner', JSON.stringify(merged)); } catch {}
          return merged;
        });
        if (event.data.is_announced && !event.data.held) {
          setShowWinnerModal(true);
        } else if (event.data.held || !event.data.is_announced) {
          setShowWinnerModal(false);
        }
      }

      // 2. INSTANT ROUND 3 SELECTION / TIMER UPDATE (0ms)
      if (event.type === 'ROUND_3_RESULTS_TIMER' && event.data) {
        setRounds(prevRounds => {
          if (!Array.isArray(prevRounds)) return prevRounds;
          const updated = prevRounds.map(r => {
            if (Number(r.round_number) === 3) {
              return {
                ...r,
                results_timer_active: Boolean(event.data.results_timer_active),
                results_announcement_time: event.data.results_announcement_time,
                selection_revealed: Boolean(event.data.selection_revealed),
                results_announced: Boolean(event.data.results_announced),
                results_held: Boolean(event.data.results_held)
              };
            }
            return r;
          });
          try { sessionStorage.setItem('cloudnex_cached_rounds', JSON.stringify(updated)); } catch {}
          return updated;
        });

        if (event.data?.results_timer_active && !event.data?.results_held) {
          setSelectedRoundNumber(3);
          selectedRoundNumberRef.current = 3;
          scrollToAnnouncement();
        }
      }

      // 3. INSTANT ROUND STATUS CHANGED (0ms)
      if (event.type === 'ROUND_STATUS_CHANGED' && event.data) {
        const payload = event.data;
        const pRoundNum = Number(payload.round_number);
        const isLive = payload.status === 'LIVE';

        setRounds(prevRounds => {
          if (!Array.isArray(prevRounds)) return prevRounds;
          const updated = prevRounds.map(r => {
            if (Number(r.round_number) === pRoundNum) {
              return { ...r, ...payload };
            } else if (isLive && r.status === 'LIVE') {
              // When one round goes live, any previous live round automatically closes
              return { ...r, status: 'CLOSED', is_active: false };
            }
            return r;
          });
          try { sessionStorage.setItem('cloudnex_cached_rounds', JSON.stringify(updated)); } catch {}
          return updated;
        });

        // Automatically pivot participant viewport to the active LIVE round!
        if (isLive) {
          setSelectedRoundNumber(pRoundNum);
          selectedRoundNumberRef.current = pRoundNum;
        }

        fetchData();
        refreshProfile();
      }

      // 4. INSTANT PROBLEM PUBLISHED (0ms)
      if (event.type === 'PROBLEM_PUBLISHED' && event.data) {
        const pubRound = Number(event.data.round_number);
        setRounds(prevRounds => {
          if (!Array.isArray(prevRounds)) return prevRounds;
          const updated = prevRounds.map(r => {
            if (Number(r.round_number) === pubRound || !event.data.round_number) {
              return {
                ...r,
                problem_published: Boolean(event.data.problem_published),
                ...(event.data.problem_statement ? { problem_statement: event.data.problem_statement } : {})
              };
            }
            return r;
          });
          try { sessionStorage.setItem('cloudnex_cached_rounds', JSON.stringify(updated)); } catch {}
          return updated;
        });
        fetchData();
      }

      // 5. PROBLEM UNPUBLISHED / ALLOCATION RESET
      if (event.type === 'PROBLEM_UNPUBLISHED' || event.type === 'PROBLEMS_ALLOCATION_RESET') {
        setRounds(prevRounds => {
          if (!Array.isArray(prevRounds)) return prevRounds;
          const updated = prevRounds.map(r => ({ ...r, problem_statement: null }));
          try { sessionStorage.setItem('cloudnex_cached_rounds', JSON.stringify(updated)); } catch {}
          return updated;
        });
        fetchData();
        refreshProfile();
      }

      // 6. QUALIFICATIONS UPDATE
      if (event.type === 'QUALIFICATIONS_UPDATED' && event.data?.updated) {
        // Only refresh if selection has officially been revealed or announced by admin
        const curR3 = (roundsRef.current || []).find(r => Number(r.round_number) === 3);
        const isRevealed = Boolean(curR3 && !curR3.results_held && (curR3.selection_revealed || curR3.results_announced));
        if (isRevealed) {
          fetchData();
          refreshProfile();
        }
      }

      // Background telemetry synchronization for other events
      if (
        event.type === 'PROBLEMS_ALLOCATED' ||
        event.type === 'LEADERBOARD_UPDATED' ||
        event.type === 'LEADERBOARD_SETTINGS_CHANGED'
      ) {
        fetchData();
        refreshProfile();
      }
    });

    // High-speed adaptive sync heartbeat (every 3 seconds when tab is active)
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData();
      }
    }, 3000);

    // Instant sync when tab gains focus or user switches back
    const handleReactivation = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData();
        refreshProfile();
      }
    };

    window.addEventListener('focus', handleReactivation);
    document.addEventListener('visibilitychange', handleReactivation);

    return () => {
      unregister();
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleReactivation);
      document.removeEventListener('visibilitychange', handleReactivation);
    };
  }, []);

  const safeRounds = Array.isArray(rounds) ? rounds : [];
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];

  const activeRound = safeRounds.find(r => r.round_number === selectedRoundNumber) || safeRounds[0] || {};
  const activeSubmission = safeSubmissions.find(s => s.round_number === selectedRoundNumber);

  const round1 = safeRounds.find(r => r.round_number === 1);
  const round2 = safeRounds.find(r => r.round_number === 2);
  const round3 = safeRounds.find(r => r.round_number === 3);


  const isR3TimerExpired = Boolean(
    round3?.results_timer_active &&
    round3?.results_announcement_time &&
    parseUtcDate(round3.results_announcement_time) <= Date.now()
  );

  // Results and Round 3 Selections are revealed when explicitly announced/revealed by admin OR when countdown timer has reached zero (and not held)
  const isSelectionRevealed = Boolean(
    round3 &&
    !round3.results_held &&
    (round3.selection_revealed || round3.results_announced || isR3TimerExpired)
  );

  const r3ResultsLive = Boolean((round3?.results_announced || isSelectionRevealed) && !round3?.results_held);

  // When timer is set by Admin and still running
  const r3TimerActive = Boolean(
    round3?.results_timer_active &&
    round3?.results_announcement_time &&
    !round3?.results_announced &&
    !round3?.results_held &&
    !isR3TimerExpired
  );
  const isPostRound2 = Boolean(
    (round2 && ['CLOSED', 'COMPLETED', 'EVALUATION'].includes(round2.status)) ||
    (round3 && ['LIVE', 'CLOSED', 'COMPLETED', 'EVALUATION'].includes(round3.status))
  );
  const isR3Open = Boolean(round3 && round3.status === 'LIVE');

  const isTeamMarkedQualified = Boolean(
    team?.is_qualified_r3 ||
    user?.is_qualified_r3 ||
    team?.status === 'QUALIFIED_FOR_FINAL' ||
    round3?.user_access === 'QUALIFIED' ||
    round3?.selection_status === 'QUALIFIED' ||
    activeRound.user_access === 'QUALIFIED'
  );

  const isTeamMarkedEliminated = Boolean(
    team?.is_eliminated ||
    user?.is_eliminated ||
    team?.status === 'ELIMINATED' ||
    round3?.user_access === 'ELIMINATED' ||
    round3?.selection_status === 'ELIMINATED' ||
    activeRound.user_access === 'ELIMINATED'
  );

  const isEliminated = Boolean(
    isSelectionRevealed && isTeamMarkedEliminated
  );
  const isQualifiedR3 = Boolean(
    isTeamMarkedQualified && (isSelectionRevealed || isR3Open)
  );

  const checkTeamMatch = (annTeam, currentTeam, currentUser, propTeamId) => {
    if (!annTeam) return false;
    const annId = String(annTeam.team_id || annTeam.id || annTeam._id || '').trim().toLowerCase();
    const annName = String(annTeam.team_name || annTeam.name || '').trim().toLowerCase();

    const myIds = [
      propTeamId,
      currentTeam?.team_id,
      currentTeam?.id,
      currentTeam?._id,
      currentUser?.team_id,
      currentUser?.id,
      currentUser?._id
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    const myNames = [
      currentTeam?.team_name,
      currentTeam?.name,
      currentUser?.team_name,
      currentUser?.name
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    if (annId && myIds.some(id => {
      if (id === annId) return true;
      const cleanId1 = id.replace(/^[a-z_-]*0*/g, '');
      const cleanId2 = annId.replace(/^[a-z_-]*0*/g, '');
      return Boolean(cleanId1 && cleanId2 && cleanId1 === cleanId2);
    })) {
      return true;
    }

    if (annName && myNames.some(name => {
      if (name === annName) return true;
      const cleanN1 = name.replace(/[^a-z0-9]/g, '');
      const cleanN2 = annName.replace(/[^a-z0-9]/g, '');
      return Boolean(cleanN1 && cleanN2 && cleanN1 === cleanN2);
    })) {
      return true;
    }

    if (annTeam.leader_name && (currentTeam?.leader_name || currentUser?.full_name || currentUser?.name)) {
      const l1 = String(annTeam.leader_name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const l2 = String(currentTeam?.leader_name || currentUser?.full_name || currentUser?.name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (l1 && l2 && l1 === l2) return true;
    }
    return false;
  };

  const skew = (typeof window !== 'undefined' && window.__cloudnex_server_time_skew) || 0;
  const isWinnerTimerExpired = Boolean(
    winnerAnnouncement?.is_timer_active &&
    winnerAnnouncement?.announcement_time &&
    parseUtcDate(winnerAnnouncement.announcement_time) <= (Date.now() + skew)
  );

  const isWinnerAnnounced = Boolean(
    (winnerAnnouncement?.is_announced || (winnerAnnouncement?.is_timer_active && (winnerSecondsLeft === 0 || isWinnerTimerExpired))) &&
    !winnerAnnouncement?.held
  );

  const isWinner = Boolean(
    isWinnerAnnounced &&
    checkTeamMatch(winnerAnnouncement?.winner, team, user, teamId)
  );

  const isRunnerUp = Boolean(
    isWinnerAnnounced &&
    checkTeamMatch(winnerAnnouncement?.runner_up, team, user, teamId)
  );

  const memberList = Array.isArray(team?.members) && team.members.length > 0
    ? team.members.filter(Boolean)
    : (Array.isArray(user?.members) && user.members.length > 0 ? user.members.filter(Boolean) : []);

  const handleSelectRound = (round) => {
    const rNum = round.round_number;
    setSelectedRoundNumber(rNum);
    selectedRoundNumberRef.current = rNum;
    setActionSuccess('');
    setActionError('');
    const sub = safeSubmissions.find(s => s.round_number === rNum);
    if (sub) {
      setGithubUrl(sub.github_url || '');
      setDeployedUrl(sub.deployed_url || '');
      setDeployInstructions(sub.deployment_instructions || '');
      setImplementationSummary(sub.implementation_summary || '');
      setArchitectureNotes(sub.architecture_notes || '');
      setRecoveryStrategy(sub.recovery_strategy || '');
    } else {
      setGithubUrl('');
      setDeployedUrl('');
      setDeployInstructions('');
      setImplementationSummary('');
      setArchitectureNotes('');
      setRecoveryStrategy('');
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedRoundNumber === 1) {
      if (file.size > 2 * 1024 * 1024) {
        setActionError('File size exceeds the 2MB limit for Round 1. Please upload a file, diagram, or GIF under 2MB.');
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
      if (!allowed.includes(ext)) {
        setActionError('Unsupported format. In Round 1, only file (PDF) or image/diagram/GIF (PNG, JPG, JPEG, GIF, WEBP) under 2MB is accepted.');
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
    }
    setActionError('');
    setSelectedFile(file);
  };

  const handleSubmitSolution = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (selectedRoundNumber === 1) {
      if (activeSubmission) {
        setActionError('Your team has already submitted for Round 1. Only 1 submission is permitted.');
        return;
      }
      if (!selectedFile && (!githubUrl || !githubUrl.trim())) {
        setActionError('Please provide your architecture diagram file (under 2MB) or your GitHub repository link for Round 1.');
        return;
      }
      if (selectedFile && selectedFile.size > 2 * 1024 * 1024) {
        setActionError('File size exceeds 2MB limit. Please upload a file, diagram, or GIF under 2MB.');
        return;
      }
    } else if (selectedRoundNumber === 2) {
      if (activeSubmission) {
        setActionError('Your team has already submitted for Round 2. Only 1 submission is permitted.');
        return;
      }
      if (!githubUrl || !githubUrl.trim()) {
        setActionError('Please provide your GitHub repository link for Round 2.');
        return;
      }
      if (!deployedUrl || !deployedUrl.trim()) {
        setActionError('Please provide your Live demo link for Round 2.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('round_number', selectedRoundNumber);
      if (selectedRoundNumber === 1) {
        // Round 1 submits architecture file and/or GitHub repo link
        if (selectedFile) formData.append('file', selectedFile);
        if (githubUrl && githubUrl.trim()) formData.append('github_url', githubUrl.trim());
      } else if (selectedRoundNumber === 2) {
        // Round 2 strictly only submits GitHub repo link and Live App link
        formData.append('github_url', githubUrl.trim());
        formData.append('deployed_url', deployedUrl.trim());
      } else {
        if (githubUrl) formData.append('github_url', githubUrl);
        if (deployedUrl) formData.append('deployed_url', deployedUrl);
        if (deployInstructions) formData.append('deployment_instructions', deployInstructions);
        if (implementationSummary) formData.append('implementation_summary', implementationSummary);
        if (architectureNotes) formData.append('architecture_notes', architectureNotes);
        if (recoveryStrategy) formData.append('recovery_strategy', recoveryStrategy);
        if (selectedFile) formData.append('file', selectedFile);
      }

      const res = await api.submissions.submit(formData);
      setActionSuccess(res.message || `Round ${selectedRoundNumber} solution submitted successfully!`);
      setSelectedFile(null);
      await fetchData();
    } catch (err) {
      setActionError(err.message || 'Submission error. Check requirements.');
    } finally {
      setSubmitting(false);
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
          <span>INITIALIZING PIT-WALL TELEMETRY...</span>
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
          alt="CLOUDNEX Dashboard Atmosphere"
          className="w-full h-full object-cover object-top opacity-40 filter brightness-95 contrast-110"
        />
        {/* Atmospheric gradients for readability */}
        <div className="absolute inset-0 bg-[#080a0f]/75 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-[#080a0f]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080a0f]/80 via-transparent to-[#080a0f]/80" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        
        {/* Race Status Panel / Cockpit Header */}
        <div className="racing-card rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-race font-bold tracking-wider flex items-center space-x-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{(team?.institution || user?.institution || 'GM UNIVERSITY').toUpperCase()}</span>
                </span>
                <span className="px-3 py-1 bg-red-600/30 text-red-400 border border-red-500/40 rounded-full text-xs font-race font-bold tracking-wider">
                  TEAM PIT WALL &bull; {teamId}
                </span>
                <button
                  type="button"
                  onClick={() => !isConnected && reconnect && reconnect()}
                  title={isConnected ? 'Telemetry active' : 'Click to reconnect telemetry'}
                  className={`flex items-center space-x-1.5 text-xs font-mono-code transition-colors ${isConnected ? 'text-emerald-400 cursor-default' : 'text-amber-400 hover:text-amber-300 cursor-pointer underline decoration-dotted'}`}
                >
                  <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                  <span>{isConnected ? 'TELEMETRY SYNCED' : 'OFFLINE (RETRY)'}</span>
                </button>
              </div>

              <h2 className="font-race text-2xl sm:text-3xl font-black text-white">
                {user?.team_name || team?.team_name || 'Race Team'}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 font-mono-code leading-relaxed">
                Institution: <strong className="text-cyan-300">{team?.institution || user?.institution || 'GM University'}</strong> &bull; Event: <strong className="text-slate-200">IGNITRON 2K26</strong> &bull; Leader: <strong className="text-slate-200">{team?.leader_name || user?.username}</strong>
                {memberList.length > 0 && (
                  <> &bull; Members: <strong className="text-slate-200">{memberList.join(', ')}</strong></>
                )}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => { setRulesModalTab('pdf'); setShowRulesModal(true); }}
                title="View Rules & Code of Conduct (PDF)"
                className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center space-x-1.5 text-xs font-mono-code cursor-pointer"
              >
                <Shield className="w-4 h-4 text-red-400" />
                <span className="hidden sm:inline">Rules &amp; Regulations</span>
              </button>

              <button
                onClick={fetchData}
                title="Refresh Telemetry"
                className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors flex items-center space-x-1.5 text-xs font-mono-code cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Sync Telemetry</span>
              </button>
            </div>
          </div>

          {/* Championship Winner Countdown Banner (Shown when countdown timer is active before announcement) */}
          {winnerAnnouncement?.is_timer_active && !isWinnerAnnounced && !winnerAnnouncement?.held && (winnerSecondsLeft === null || winnerSecondsLeft > 0) && !isWinnerTimerExpired && (
            <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/90 via-slate-900 to-amber-950/70 border-2 border-red-500/80 shadow-2xl shadow-red-500/20 text-white flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shrink-0 shadow-xl shadow-red-500/50">
                  <Clock className="w-6 h-6 text-white animate-spin" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-race font-black uppercase tracking-wider shadow-sm">
                      👑 OFFICIAL CHAMPIONSHIP RESULTS
                    </span>
                    <span className="text-[10px] text-amber-300 font-race font-bold uppercase tracking-wider">
                      IGNITRON 2K26
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-race font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 mt-1">
                    CHAMPIONSHIP WINNERS ANNOUNCEMENT IN PROGRESS
                  </h3>
                  <p className="text-xs text-slate-300 font-mono-code">
                    Race Stewards are finalizing the official podium. Winners reveal is imminent!
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-red-950/90 border border-red-500/60 text-red-300 font-race shadow-lg shadow-red-950/50">
                <Timer className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="font-mono-code text-amber-300 text-lg font-black tracking-widest">
                  00:{String(Math.max(0, winnerSecondsLeft ?? (winnerAnnouncement?.timer_seconds || 10))).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {/* Championship Winner Broadcast Banner (Shown only when overall championship winner is live) */}
          {isWinnerAnnounced && (
            <div className="mt-6 rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg,rgba(92,36,6,0.9) 0%,rgba(9,13,22,1) 50%,rgba(78,18,80,0.6) 100%)',
                boxShadow: '0 0 50px rgba(245,158,11,0.45), 0 0 80px rgba(236,72,153,0.15)'
              }}
            >
              {/* Gold shimmer border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400 pointer-events-none" />
              <div className="absolute inset-[-1px] rounded-2xl border border-amber-300/20 pointer-events-none" />
              {/* Glowing halo */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-64 h-8 bg-amber-400/25 blur-xl rounded-full pointer-events-none" />

              {/* Floating celebration sprinkles & sparkles */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                <span className="absolute top-2 left-8 text-amber-300 text-xs animate-ping opacity-75">✦</span>
                <span className="absolute top-3 right-1/4 text-yellow-300 text-sm animate-pulse">✨</span>
                <span className="absolute bottom-2 left-1/3 text-cyan-300 text-xs animate-bounce">★</span>
                <span className="absolute top-2 right-10 text-pink-300 text-xs animate-ping opacity-60">✦</span>
                <span className="absolute bottom-2 right-1/3 text-amber-200 text-sm animate-pulse">✨</span>
              </div>

              <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  {/* Trophy with spinning ring */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/60">
                      <Trophy className="w-6 h-6 text-slate-950 animate-bounce" />
                    </div>
                    <div className="absolute -inset-1.5 rounded-xl border border-yellow-400/50 animate-spin" style={{animationDuration:'3s'}} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-0.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500 via-amber-400 to-cyan-400 text-slate-950 text-[9px] font-race font-black uppercase tracking-wider shadow-sm">
                        👑 OFFICIAL CHAMPIONSHIP RESULTS
                      </span>
                      <span className="text-[10px] text-amber-300 font-race font-bold uppercase tracking-wider">IGNITRON 2K26</span>
                    </div>
                    {/* Giant CLOUDNEX 2K26 brand */}
                    <p className="font-race text-xl sm:text-2xl font-black tracking-[0.06em] uppercase leading-none"
                      style={{
                        background: 'linear-gradient(180deg, #f0fdfa 0%, #cffafe 20%, #67e8f9 45%, #0ea5e9 75%, #0284c7 95%, #0369a1 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.5))'
                      }}
                    >
                      CLOUDNEX 2K26
                    </p>
                    <h3 className="text-sm sm:text-base font-race font-black mt-0.5"
                      style={{
                        background: 'linear-gradient(90deg,#fef08a,#f43f5e,#fbbf24,#38bdf8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}
                    >
                      🏆 {winnerAnnouncement?.winner?.team_name || 'Grand Champion'} &bull;
                      <span style={{
                        background: 'linear-gradient(90deg,#67e8f9,#c084fc,#f472b6)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}> 🥈 {winnerAnnouncement?.runner_up?.team_name || 'Runner Up'}</span>
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWinnerModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-race font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/40 shrink-0 transition-transform active:scale-95 cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Open Podium 🎉</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Three-Round Race Track Visual */}
        <CircuitTrack
          rounds={rounds}
          onSelectRound={handleSelectRound}
          activeRoundNumber={selectedRoundNumber}
          teamStatus={team?.status}
          isQualifiedR3={isQualifiedR3}
          isEliminated={isEliminated && isSelectionRevealed}
          onExpire={fetchData}
        />

        {/* Selected Round Work Desk */}
        {selectedRoundNumber === 3 ? (
          /* Round 3: Submission Removed. Full-Width Animated Video-Style Celebration or Countdown Notice */
          <div ref={round3SectionRef} id="round3-announcement-section" className="w-full scroll-mt-8">
            <Round3Celebration
              isQualified={isQualifiedR3}
              isEliminated={isEliminated}
              team={team}
              user={user}
              teamId={teamId}
              resultsAnnouncementTime={
                (winnerAnnouncement?.is_timer_active && !winnerAnnouncement?.is_announced)
                  ? winnerAnnouncement?.announcement_time
                  : round3?.results_announcement_time
              }
              resultsTimerActive={
                (winnerAnnouncement?.is_timer_active && !winnerAnnouncement?.is_announced)
                  ? true
                  : round3?.results_timer_active
              }
              resultsAnnounced={
                (winnerAnnouncement?.is_timer_active && !winnerAnnouncement?.is_announced)
                  ? false
                  : (round3?.results_announced || isSelectionRevealed || Boolean(winnerAnnouncement?.is_announced))
              }
              isWinnerTimer={Boolean(winnerAnnouncement?.is_timer_active && !winnerAnnouncement?.is_announced)}
              winnerAnnouncement={winnerAnnouncement}
              onAnnounced={fetchData}
            />
          </div>
        ) : (
          /* Rounds 1 & 2: Two-Column Work Desk (Problem Statement & Solution Submission) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Shared Problem Statement for Rounds 1 & 2 (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. Problem Statement Card (Comes First) */}
              <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                  <div className="flex items-center space-x-3">
                    <span className="w-3 h-3 rounded-full bg-red-600" />
                    <span className="font-race font-bold text-lg text-white">
                      PROBLEM STATEMENT
                    </span>
                  </div>

                  <div className="text-xs font-mono-code text-slate-400">
                    STATUS: <strong className="text-white">{activeRound.status}</strong>
                  </div>
                </div>

                {/* Problem Statement Content (Only Title and Description) */}
                {activeRound.problem_statement ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-race text-xl sm:text-2xl font-black text-white tracking-wide">
                        {activeRound.problem_statement.title}
                      </h3>
                    </div>

                    <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-white/5 text-sm text-slate-300 leading-relaxed font-sans">
                      <p className="whitespace-pre-line leading-relaxed">
                        {activeRound.problem_statement.description || activeRound.problem_statement.scenario}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 px-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center border bg-amber-950/40 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-950/50">
                      <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
                    </div>

                    <h4 className="font-race text-xl font-bold text-white">
                      Problem statement has not yet been released.
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto font-mono-code leading-relaxed">
                      {activeRound.lock_reason || 'Problem statements remain confidential until approved and published by Race Control.'}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Round Objective & Key Deliverables Card (Comes Next) */}
              <div className="racing-card rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${selectedRoundNumber === 1 ? 'bg-cyan-400' : 'bg-red-500'} animate-pulse`} />
                    <h3 className="font-race font-bold text-base sm:text-lg text-white">
                      {selectedRoundNumber === 1 ? 'Round 1 — Architecture Design' : 'Round 2 — Build & Deploy'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono-code px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-slate-300 font-bold uppercase">
                    LAP 0{selectedRoundNumber} BRIEF
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  {selectedRoundNumber === 1
                    ? 'Participants must design a robust, scalable, secure, and cost-efficient cloud architecture capable of handling high-velocity telemetry streams in real time. Teams will develop an architecture blueprint incorporating multi-region cloud infrastructure, event-stream processing, VPC security boundaries, fault tolerance, disaster recovery, and cost optimization under strict budget constraints.'
                    : 'Teams must transform their proposed architecture into a functional cloud-based application or prototype. Participants will configure cloud services, deploy application components, integrate APIs and databases, and demonstrate the working solution. The application will be evaluated on functionality, deployment quality, security, scalability, resource utilization, and adherence to the given problem statement.'}
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2">
                  <h4 className="text-[11px] font-race font-bold uppercase tracking-wider text-slate-300">
                    Key Deliverables
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 font-mono-code">
                    {selectedRoundNumber === 1 ? (
                      <>
                        <li className="flex items-start space-x-2">
                          <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                          <span>Identify the problem and proposed solution.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                          <span>Draw a system architecture diagram.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                          <span>Create a workflow diagram.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                          <span>Select suitable technologies, databases, APIs, and cloud services.</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                          <span>Write and test the code.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                          <span>Implement the core features.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                          <span>Deploy the application using a platform such as GCP, Microsoft Azure or AWS.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 font-bold mt-0.5">&bull;</span>
                          <span>Submit a working public URL and demonstrate the application.</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>

          {/* Right Column: Submission Form & Receipt (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="racing-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <span className="font-race font-bold text-lg text-white">
                  SOLUTION SUBMISSION
                </span>
                <span className="text-xs font-mono-code text-cyan-400 font-bold">
                  LAP 0{selectedRoundNumber}
                </span>
              </div>

              {/* Status alerts */}
              {actionError && (
                <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-600 text-red-300 text-xs font-mono-code flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-600 text-emerald-300 text-xs font-mono-code flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Previous Submission Receipt */}
              {activeSubmission && (
                <div className="mb-6 p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 text-xs font-mono-code space-y-2">
                  <div className="flex items-center justify-between text-emerald-400 font-bold pb-2 border-b border-white/5">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>SUBMISSION VERIFIED ON FILE</span>
                    </span>
                    <span>{activeSubmission.submitted_at ? new Date(activeSubmission.submitted_at).toLocaleTimeString() : ''}</span>
                  </div>

                  {activeSubmission.github_url && (
                    <div className="truncate text-slate-300">
                      GitHub: <a href={activeSubmission.github_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">{activeSubmission.github_url}</a>
                    </div>
                  )}

                  {activeSubmission.deployed_url && selectedRoundNumber !== 1 && (
                    <div className="truncate text-slate-300">
                      Live App: <a href={activeSubmission.deployed_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">{activeSubmission.deployed_url}</a>
                    </div>
                  )}

                  {activeSubmission.file_name && (
                    <div className="text-slate-300 flex items-center space-x-1.5">
                      <span>Uploaded File:</span>
                      <a
                        href={`/api/v1/submissions/file/${activeSubmission.file_path || activeSubmission.file_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:text-amber-300 underline font-bold inline-flex items-center space-x-1"
                        title="Click to view blueprint photo/file"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{activeSubmission.file_name}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {typeof activeSubmission.score === 'number' && !isNaN(activeSubmission.score) && (
                    <div className="pt-2 border-t border-white/5 text-amber-300 font-bold">
                      Judge Score: <span className="text-white text-sm">{activeSubmission.score} / {(Number(activeSubmission.round_number || selectedRoundNumber) === 2) ? '100 PTS' : '50 PTS'}</span>
                      {activeSubmission.feedback && (
                        <p className="text-[11px] text-slate-400 font-normal mt-1 italic">
                          Feedback: &ldquo;{activeSubmission.feedback}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submission Form (Locked if Round 1 or Round 2 already submitted, or round not LIVE, or R3 eliminated) */}
              {selectedRoundNumber === 1 && activeSubmission ? (
                /* Round 1: Completed & Locked Receipt (Strictly One-Time) */
                <div className="p-6 rounded-2xl bg-slate-950/90 border border-emerald-500/40 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-400 flex items-center justify-center mx-auto glow-green">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-race text-base sm:text-lg font-bold text-white uppercase">
                    ROUND 1 SUBMISSION LOCKED &amp; VERIFIED
                  </h4>
                  <p className="text-xs text-slate-300 font-mono-code leading-relaxed max-w-sm mx-auto">
                    Your Round 1 solution has been officially recorded on the grid. Only 1 submission is permitted for Round 1 and re-submissions are disabled.
                  </p>
                  {activeSubmission.file_name && (
                    <div className="pt-2 text-xs font-mono-code flex items-center justify-center space-x-1.5">
                      <span className="text-slate-400">File on record:</span>
                      <a
                        href={`/api/v1/submissions/file/${activeSubmission.file_path || activeSubmission.file_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline font-bold inline-flex items-center space-x-1"
                        title="Click to view blueprint photo/file"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{activeSubmission.file_name}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : selectedRoundNumber === 2 && activeSubmission ? (
                /* Round 2: Completed & Locked Receipt (Strictly One-Time) */
                <div className="p-6 rounded-2xl bg-slate-950/90 border border-emerald-500/40 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-400 flex items-center justify-center mx-auto glow-green">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-race text-base sm:text-lg font-bold text-white uppercase">
                    ROUND 2 SUBMISSION LOCKED &amp; VERIFIED
                  </h4>
                  <p className="text-xs text-slate-300 font-mono-code leading-relaxed max-w-sm mx-auto">
                    Your Round 2 repository and live application links have been officially recorded. Only 1 submission is permitted for Round 2 and re-submissions are disabled.
                  </p>
                  <div className="pt-2 text-xs font-mono-code space-y-2 text-left max-w-md mx-auto bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
                    {activeSubmission.github_url && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center space-x-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                          <span>GitHub:</span>
                        </span>
                        <a href={activeSubmission.github_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline truncate max-w-[220px]">
                          {activeSubmission.github_url}
                        </a>
                      </div>
                    )}
                    {activeSubmission.deployed_url && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Live App:</span>
                        </span>
                        <a href={activeSubmission.deployed_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline truncate max-w-[220px]">
                          {activeSubmission.deployed_url}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (activeRound.status === 'LIVE' || activeRound.submissions_open) && !(selectedRoundNumber === 3 && (isEliminated || !isQualifiedR3)) ? (
                <form onSubmit={handleSubmitSolution} className="space-y-4">
                  {activeRound.submissions_open && activeRound.status !== 'LIVE' && (
                    <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-xs font-mono-code text-emerald-300 flex items-center space-x-2">
                      <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                      <span>Race Control has opened the submission window for Lap 0{selectedRoundNumber}! Submit your solution below.</span>
                    </div>
                  )}
                  {/* Round 1 Form: File or Photo below 2MB & GitHub repository link */}
                  {selectedRoundNumber === 1 ? (
                    <div className="space-y-4">
                      {/* 1-Time Submission Only Notice */}
                      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs font-mono-code text-amber-300 flex items-center space-x-2.5 shadow-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span><strong className="text-amber-400 font-race uppercase">1-Time Submission Only:</strong> You can only submit once. Further submissions are locked.</span>
                      </div>

                      {/* GitHub Repository URL for Round 1 */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1.5 flex items-center space-x-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                          <span>GitHub Repository Link</span>
                        </label>
                        <input
                          type="url"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          placeholder="https://github.com/myteam/cloudnex-architecture"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono-code focus:outline-none focus:border-red-500"
                        />
                      </div>

                      {/* Architecture File Upload */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1.5 flex items-center space-x-1.5">
                          <Upload className="w-3.5 h-3.5 text-red-500" />
                          <span>Upload Architecture File / Photo / GIF (Max 2MB)</span>
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                          onChange={handleFileChange}
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-race file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-500 bg-slate-950 p-2 rounded-xl border border-white/10 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-400 mt-1.5 px-1">
                          <span>Accepted: PDF, PNG, JPG, JPEG, GIF</span>
                          <span className="text-amber-400 font-bold">Max 2 MB</span>
                        </div>
                        {selectedFile && (
                          <div className="mt-2 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs font-mono-code text-emerald-300 flex items-center justify-between">
                            <span className="truncate">{selectedFile.name}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || (!selectedFile && !githubUrl.trim())}
                        className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-race font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/60 transition-all flex items-center justify-center space-x-2"
                      >
                        {submitting ? (
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Submit Round 1 Architecture (Final)</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : selectedRoundNumber === 2 ? (
                    /* Round 2 Form: Strictly Live Link & GitHub Repo Link (1-Time Submission) */
                    <div className="space-y-4">
                      {/* 1-Time Submission Only Notice */}
                      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs font-mono-code text-amber-300 flex items-center space-x-2.5 shadow-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span><strong className="text-amber-400 font-race uppercase">1-Time Submission Only:</strong> You can only submit once. Further submissions are locked.</span>
                      </div>

                      {/* GitHub URL */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1 flex items-center space-x-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                          <span>GitHub Repository URL <strong className="text-red-400">*</strong></span>
                        </label>
                        <input
                          type="url"
                          required
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          placeholder="https://github.com/myteam/cloudnex-blueprint"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono-code focus:outline-none focus:border-red-500"
                        />
                      </div>

                      {/* Deployed App URL */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1 flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Live Application / Demo URL <strong className="text-red-400">*</strong></span>
                        </label>
                        <input
                          type="url"
                          required
                          value={deployedUrl}
                          onChange={(e) => setDeployedUrl(e.target.value)}
                          placeholder="https://f1-telemetry.myteam.io"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-500"
                        />
                      </div>


                      <button
                        type="submit"
                        disabled={submitting || !githubUrl.trim() || !deployedUrl.trim()}
                        className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-race font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/60 transition-all flex items-center justify-center space-x-2"
                      >
                        {submitting ? (
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Submit Round 2 Solution (Final)</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* Round 3 Fields */
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs font-mono-code text-slate-300 space-y-1.5">
                        <div className="font-race font-bold text-white uppercase text-[11px] text-amber-400">
                          FINAL ROUND EVALUATION &amp; SUBMISSION RULES (TOTAL: 50 MARKS):
                        </div>
                        <p>&bull; Submit your Crisis Mitigation Strategy, Hotfix Repository, and Restored Live Application URL.</p>
                        <div className="pt-1 text-[11px] text-slate-400 space-y-0.5 border-t border-white/5 mt-1.5">
                          <div className="text-amber-400 font-bold font-race text-[10px] uppercase">Marks Breakdown (50 Marks Total):</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                            <span>1. Crisis Challenge (30 Marks)</span>
                            <span>2. Presentation &amp; Defense (20 Marks)</span>
                          </div>
                        </div>
                      </div>

                      {/* GitHub URL (Round 3) */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1 flex items-center space-x-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                          <span>GitHub Repository URL</span>
                        </label>
                        <input
                          type="url"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          placeholder="https://github.com/myteam/cloudnex-blueprint"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono-code focus:outline-none focus:border-red-500"
                        />
                      </div>

                      {/* Deployed App URL (Round 3) */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1 flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Deployed Application URL</span>
                        </label>
                        <input
                          type="url"
                          value={deployedUrl}
                          onChange={(e) => setDeployedUrl(e.target.value)}
                          placeholder="https://f1-telemetry.myteam.io"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono-code focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Recovery Strategy (Round 3) */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1 flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Incident Recovery &amp; Crisis Mitigation Strategy</span>
                        </label>
                        <textarea
                          rows="3"
                          required
                          value={recoveryStrategy}
                          onChange={(e) => setRecoveryStrategy(e.target.value)}
                          placeholder="Explain circuit breaker activation, cache stampede resolution, and post-mortem mitigation..."
                          className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white font-mono-code focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* File Upload (Round 3) */}
                      <div>
                        <label className="block text-xs font-race text-slate-300 uppercase mb-1 flex items-center space-x-1.5">
                          <Upload className="w-3.5 h-3.5 text-slate-400" />
                          <span>Upload Project Files / Diagrams (ZIP, PDF, JSON)</span>
                        </label>
                        <input
                          type="file"
                          onChange={handleFileChange}
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-race file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700 bg-slate-950 p-1.5 rounded-xl border border-white/10"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-race font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/60 transition-all flex items-center justify-center space-x-2"
                      >
                        {submitting ? (
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>{activeSubmission ? 'Update Solution Payload' : 'Submit Solution to Race Stewards'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="p-6 text-center rounded-xl bg-slate-950/60 border border-white/5 space-y-2 text-xs font-mono-code text-slate-400">
                  <Lock className="w-6 h-6 text-slate-600 mx-auto" />
                  <p>Submissions are currently locked for this round.</p>
                  <p className="text-[11px] text-slate-500">
                    {selectedRoundNumber === 3 && isEliminated
                      ? 'Team eliminated after Round 2.'
                      : !activeRound.submissions_open && activeRound.status !== 'LIVE'
                      ? 'Submissions are currently closed. Awaiting announcement from Race Control.'
                      : 'Please await announcement from Race Control.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules & Regulations Modal for Participants */}
      <RulesAndRegulationsModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        defaultTab={rulesModalTab}
      />

      {/* Winner Podium Celebration Modal for Participants */}
      {showWinnerModal && (winnerAnnouncement?.is_announced || isWinnerAnnounced) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          {/* Ambient glows */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-40 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-20 left-1/4 w-80 h-40 bg-fuchsia-600/15 blur-3xl rounded-full pointer-events-none" />

          <div className="relative max-w-2xl w-full rounded-2xl overflow-hidden text-center space-y-5 max-h-[92vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(160deg,rgba(9,10,20,1) 0%,rgba(9,13,22,1) 60%,rgba(4,6,10,1) 100%)',
              boxShadow: '0 0 80px rgba(245,158,11,0.35), 0 0 120px rgba(236,72,153,0.12)'
            }}
          >
            {/* Gold shimmer border */}
            <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400/80 pointer-events-none" />
            {/* Celebration Canvas sprinkles contained inside modal */}
            <canvas ref={modalCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
            {/* Subtle scanlines */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,0,0,0.07)_3px,rgba(0,0,0,0.07)_6px)] pointer-events-none rounded-2xl" />

            <div className="relative p-6 sm:p-8 space-y-5">
              <button
                onClick={() => setShowWinnerModal(false)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Outline badge with trophies (subtle clean glow) */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#030d1d]/85 border border-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.4)] backdrop-blur-md">
                <span className="text-xs">🏆</span>
                <span className="text-white font-race font-bold text-[10px] sm:text-xs tracking-[0.22em] uppercase">
                  OFFICIAL GRAND PRIX PODIUM
                </span>
                <span className="text-xs">🏆</span>
              </div>

              {/* Giant CLOUDNEX 2K26 brand — Electric Cyan / Ice Blue Metallic with softer glow */}
              <div className="relative mt-1 mb-0.5">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-72 sm:w-[400px] h-12 bg-cyan-400/15 blur-2xl rounded-full" />
                </div>
                <p className="font-race text-4xl sm:text-6xl font-black tracking-[0.06em] uppercase leading-none relative"
                  style={{
                    background: 'linear-gradient(180deg, #f0fdfa 0%, #cffafe 20%, #67e8f9 45%, #0ea5e9 75%, #0284c7 95%, #0369a1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.6)) drop-shadow(0 0 20px rgba(14,165,233,0.35))'
                  }}
                >
                  CLOUDNEX 2K26
                </p>
                <p className="font-race text-[10px] sm:text-[11px] uppercase tracking-[0.45em] text-cyan-100 font-extrabold mt-1 drop-shadow-[0_0_4px_rgba(56,189,248,0.4)]">
                  — THE CHAMPIONSHIP HAS SPOKEN —
                </p>
              </div>

              {/* WINNER headline — Gold Champions + 3D Golden WINNERS with subtle clean glow */}
              <div className="mt-1">
                <h2 className="font-race leading-none select-none">
                  <span className="block text-xs sm:text-base font-black uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]">
                    🏆 CONGRATULATIONS, CHAMPIONS!
                  </span>
                  <span className="block text-3xl sm:text-5xl font-black uppercase tracking-wider my-1"
                    style={{
                      background: 'linear-gradient(180deg, #ffffff 0%, #fffbeb 18%, #fef08a 40%, #facc15 65%, #ca8a04 90%, #854d0e 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 0 10px rgba(250,204,21,0.65)) drop-shadow(0 0 20px rgba(234,179,8,0.4))'
                    }}
                  >
                    WINNERS
                  </span>
                  <div className="w-full max-w-sm h-[1.5px] bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_8px_#facc15] mx-auto mt-1.5" />
                </h2>
              </div>

              {/* Winner Card (simple in gold color like runner section) */}
              <div className="rounded-xl overflow-hidden relative text-left"
                style={{
                  background: 'linear-gradient(135deg,rgba(120,53,15,0.6) 0%,rgba(9,13,22,1) 50%,rgba(15,23,42,0.7) 100%)',
                  boxShadow: '0 0 40px rgba(245,158,11,0.35), inset 0 1px 0 rgba(245,158,11,0.2)'
                }}
              >
                <div className="absolute inset-0 rounded-xl border-2 border-amber-400/75 pointer-events-none" />
                <div className="flex items-center space-x-3 p-4">
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/40">
                      <Trophy className="w-6 h-6 text-slate-950 animate-bounce" />
                    </div>
                    <div className="absolute -inset-1.5 rounded-xl border border-amber-400/40 animate-spin" style={{animationDuration:'3s'}} />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-200 text-slate-950 text-[9px] font-race font-black uppercase shadow-sm">
                      👑 1ST PLACE · GRAND CHAMPION
                    </span>
                    <h3 className="font-race text-xl sm:text-3xl font-black mt-0.5"
                      style={{
                        background: 'linear-gradient(90deg,#fef08a,#fbbf24,#fde68a,#f59e0b)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.6))'
                      }}
                    >
                      {winnerAnnouncement?.winner?.team_name || 'Grand Champion'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono-code text-slate-400">
                        {winnerAnnouncement?.winner?.institution || 'Championship Contender'}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-100/90 font-sans leading-relaxed px-4 pb-4">
                  From the very first keystroke to the final deployment,{' '}
                  <span className="font-bold text-yellow-300">{winnerAnnouncement?.winner?.team_name || 'this team'}</span>{' '}
                  demonstrated true cloud mastery under pressure.
                </p>
              </div>

              {/* Runner Up Card */}
              <div className="rounded-xl overflow-hidden relative text-left"
                style={{
                  background: 'linear-gradient(135deg,rgba(6,182,212,0.3) 0%,rgba(30,27,75,0.8) 40%,rgba(9,13,22,0.95) 75%,rgba(236,72,153,0.2) 100%)',
                  boxShadow: '0 0 40px rgba(6,182,212,0.35), 0 0 70px rgba(168,85,247,0.25), inset 0 1px 0 rgba(6,182,212,0.25)'
                }}
              >
                <div className="absolute inset-0 rounded-xl border-2 border-cyan-400/80 pointer-events-none" />
                <div className="flex items-center space-x-3 p-4">
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 flex items-center justify-center shadow-md shadow-cyan-500/40">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -inset-1.5 rounded-xl border border-cyan-400/40 animate-spin" style={{animationDuration:'4s'}} />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-400 via-teal-200 to-purple-400 text-slate-950 text-[9px] font-race font-black uppercase shadow-sm">
                      🥈 1ST RUNNER UP
                    </span>
                    <h3 className="font-race text-lg sm:text-2xl font-black mt-0.5"
                      style={{
                        background: 'linear-gradient(90deg,#67e8f9 0%,#a855f7 35%,#f472b6 70%,#38bdf8 100%)',
                        backgroundSize: '250% 100%',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        filter: 'drop-shadow(0 0 12px rgba(6,182,212,0.7)) drop-shadow(0 0 25px rgba(168,85,247,0.5))'
                      }}
                    >
                      {winnerAnnouncement?.runner_up?.team_name || '1st Runner Up'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono-code text-slate-400">
                        {winnerAnnouncement?.runner_up?.institution || 'Championship Contender'}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-cyan-100/90 font-sans leading-relaxed px-4 pb-4">
                  The race was fierce, and{' '}
                  <span className="font-bold text-cyan-300">{winnerAnnouncement?.runner_up?.team_name || 'this team'}</span>{' '}
                  gave everything on the grid, earning their elite place on the podium.
                </p>
              </div>

              <button
                onClick={() => setShowWinnerModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 font-race font-bold text-xs uppercase transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
