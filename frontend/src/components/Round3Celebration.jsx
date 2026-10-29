import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Sparkles, ShieldAlert, Heart, Clock, Radio, Timer, Award, Medal, CheckCircle2 } from 'lucide-react';

export default function Round3Celebration({
  isQualified,
  isEliminated,
  team,
  user,
  teamId,
  resultsAnnouncementTime,
  resultsTimerActive,
  resultsAnnounced,
  winnerAnnouncement = null,
  isWinnerTimer = false,
  onAnnounced
}) {
  const canvasRef = useRef(null);
  const hasTriggeredAnnouncedRef = useRef(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [totalTimerDuration, setTotalTimerDuration] = useState(10);

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

  // Strip points and marks from steward commendation so participants do not see points
  const cleanCommendation = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\s*based on Round 1 & 2 score\s*\([^)]*\)/gi, ' based on Round 1 & 2 performance.')
      .replace(/\s*based on Round 1 & 2 marks\s*\([^)]*\)/gi, ' based on Round 1 & 2 performance.')
      .replace(/\s*\(\d+(\.\d+)?\s*(pts|points)?\)/gi, '')
      .replace(/\s+pts\b/gi, '')
      .replace(/\s+points\b/gi, '')
      .trim();
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

  // Calculate real-time seconds remaining until announcement
  const getSecondsRemaining = () => {
    if (!resultsAnnouncementTime) return 0;
    const targetMs = parseUtcDate(resultsAnnouncementTime);
    if (!targetMs) return 0;
    const diff = targetMs - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsRemaining());
  const onAnnouncedRef = useRef(onAnnounced);
  useEffect(() => {
    onAnnouncedRef.current = onAnnounced;
  }, [onAnnounced]);

  const lastAnnouncedTargetRef = useRef(null);

  // Synchronize when resultsAnnouncementTime or resultsTimerActive changes from telemetry event bus
  useEffect(() => {
    if (resultsAnnouncementTime && resultsTimerActive) {
      const remaining = getSecondsRemaining();
      setSecondsLeft(remaining);
      setTimerExpired(remaining <= 0);
      setTotalTimerDuration(remaining > 0 ? remaining : 10);
    }
  }, [resultsAnnouncementTime, resultsTimerActive]);

  // When admin sets the countdown, countdown is active while seconds remain
  const remainingRealtime = getSecondsRemaining();
  const isCountdownActive = Boolean(
    resultsTimerActive &&
    resultsAnnouncementTime &&
    !resultsAnnounced &&
    !timerExpired &&
    (secondsLeft > 0 || remainingRealtime > 0)
  );

  const isWinnerTimerExpired = Boolean(
    isWinnerTimer &&
    (resultsAnnounced || timerExpired || secondsLeft <= 0 || remainingRealtime <= 0)
  );

  const isWinnerAnnounced = Boolean(
    (winnerAnnouncement?.is_announced || isWinnerTimerExpired) &&
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

  // Results are announced if explicitly announced, winner timer expired, or countdown timer expired in real-time
  const isAnnounced = Boolean(
    resultsAnnounced ||
    isWinnerAnnounced ||
    (resultsTimerActive && resultsAnnouncementTime && (secondsLeft <= 0 || timerExpired) && remainingRealtime <= 0)
  );

  // Check qualification status of team only if explicitly qualified or results are announced
  const isTeamQualified = Boolean(
    isQualified ||
    (isAnnounced && (
      team?.is_qualified_r3 ||
      user?.is_qualified_r3 ||
      team?.status === 'QUALIFIED_FOR_FINAL'
    ))
  );

  const isTeamEliminated = Boolean(
    isEliminated ||
    (isAnnounced && (
      team?.is_eliminated ||
      user?.is_eliminated ||
      team?.status === 'ELIMINATED'
    ))
  );

  // High-precision live ticker (ticks every 250ms but only re-renders on second change)
  useEffect(() => {
    if (!resultsTimerActive || !resultsAnnouncementTime || resultsAnnounced) return;

    const interval = setInterval(() => {
      const remaining = getSecondsRemaining();
      setSecondsLeft(prev => prev === remaining ? prev : remaining);

      if (remaining <= 0) {
        setTimerExpired(true);
        if (lastAnnouncedTargetRef.current !== resultsAnnouncementTime) {
          lastAnnouncedTargetRef.current = resultsAnnouncementTime;
          if (onAnnouncedRef.current) {
            onAnnouncedRef.current();
          }
        }
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [resultsTimerActive, resultsAnnouncementTime, resultsAnnounced]);

  // Canvas particle / fireworks celebration animation for qualified, winner, or runner-up teams (no paper blast stream)
  useEffect(() => {
    if ((!isTeamQualified || !isAnnounced) && !isWinner && !isRunnerUp) return;

    const canvas = canvasRef.current;
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
    let colors = ['#f59e0b', '#06b6d4', '#ef4444', '#10b981', '#ec4899', '#ffffff', '#fbbf24', '#38bdf8'];
    if (isWinner) {
      colors = ['#f59e0b', '#fbbf24', '#fde047', '#ffffff', '#ea580c', '#eab308'];
    } else if (isRunnerUp) {
      colors = ['#06b6d4', '#38bdf8', '#e2e8f0', '#ffffff', '#94a3b8', '#0ea5e9'];
    } else if (isWinnerAnnounced && isQualified) {
      colors = ['#10b981', '#34d399', '#06b6d4', '#38bdf8', '#a855f7', '#ffffff'];
    }

    const createFirework = (x, y) => {
      if (particles.length > 120) return;
      const count = 35;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 4 + 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 3 + 2,
          alpha: 1,
          decay: Math.random() * 0.018 + 0.01,
          shape: Math.random() > 0.5 ? 'rect' : 'circle',
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2
        });
      }
    };

    createFirework(canvas.width * 0.25, canvas.height * 0.35);
    createFirework(canvas.width * 0.75, canvas.height * 0.35);

    let frame = 0;
    const render = () => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      if (frame % 90 === 0) {
        createFirework(
          Math.random() * (canvas.width * 0.8) + canvas.width * 0.1,
          Math.random() * (canvas.height * 0.4) + canvas.height * 0.15
        );
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
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

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size * 1.5, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [isTeamQualified, isWinner, isRunnerUp, isWinnerAnnounced, isAnnounced]);

  // =========================================================================
  // STATE A: WINNER ANNOUNCED & THIS TEAM IS THE GRAND CHAMPION (WINNER)
  // =========================================================================
  if (isWinnerAnnounced && isWinner) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-yellow-400/80 bg-gradient-to-b from-[#1c1305] via-[#090d16] to-[#04060a] shadow-2xl shadow-yellow-500/30 p-6 sm:p-8 max-w-3xl mx-auto">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-20 text-center max-w-2xl mx-auto space-y-4 pt-1">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 via-amber-500/30 to-yellow-500/20 border border-yellow-400 text-yellow-300 text-[10px] font-race font-bold tracking-widest uppercase shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
            <span>CLOUDNEX 2K26 GRAND PRIX CHAMPION</span>
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
          </div>

          <div className="relative inline-block mx-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-yellow-300 via-amber-500 to-orange-600 p-1 shadow-2xl shadow-amber-500/60 animate-pulse">
              <div className="w-full h-full rounded-full bg-[#080a0f] flex items-center justify-center border-2 border-yellow-400">
                <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-300 drop-shadow-[0_0_20px_rgba(250,204,21,1)] animate-bounce" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="font-race font-black tracking-tight leading-tight select-none">
              <span className="block text-2xl sm:text-3xl font-extrabold uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-200 to-white drop-shadow-[0_2px_12px_rgba(251,191,36,0.5)]">
                CONGRATULATIONS
              </span>
              <span className="block text-3xl sm:text-5xl font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-100 drop-shadow-[0_4px_20px_rgba(251,191,36,0.8)] mt-1">
                CHAMPIONS!
              </span>
            </h1>
            <div className="text-lg sm:text-xl font-race font-black text-white tracking-wide">
              WINNER OF <span className="text-yellow-400 underline decoration-yellow-400/80">CLOUDNEX 2K26</span>!
            </div>
            <p className="text-xs text-amber-100/90 font-mono-code max-w-lg mx-auto leading-relaxed pt-1">
              Supreme triumph! From the very first lap to the final deployment, your team mastered every challenge under pressure and claimed the championship trophy.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-yellow-400/60 backdrop-blur-md shadow-xl text-left max-w-lg mx-auto space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[9px] font-mono-code uppercase text-yellow-400/80 block font-bold">CHAMPIONSHIP WINNER</span>
                <strong className="text-base font-race font-black text-white block">
                  {user?.team_name || team?.team_name || 'Champion Team'}
                </strong>
              </div>
              <span className="px-3 py-1 rounded-lg bg-yellow-400 text-slate-950 font-race font-black text-xs uppercase shadow-md">
                1ST PLACE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
              <div>
                <span className="text-slate-400 block text-[9px]">CHAMPIONSHIP VENUE:</span>
                <span className="text-white font-semibold">GM University, Davangere</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">EVENT:</span>
                <span className="text-amber-400 font-semibold">IGNITRON 2K26</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE B: WINNER ANNOUNCED & THIS TEAM IS THE 1ST RUNNER UP
  // =========================================================================
  if (isWinnerAnnounced && isRunnerUp) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-400/80 bg-gradient-to-b from-[#061926] via-[#090d16] to-[#04060a] shadow-2xl shadow-cyan-500/30 p-6 sm:p-8 max-w-3xl mx-auto">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-20 text-center max-w-2xl mx-auto space-y-4 pt-1">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-race font-bold tracking-widest uppercase shadow-md">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span>CLOUDNEX 2K26 OFFICIAL PODIUM FINISH</span>
            <Award className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          <div className="relative inline-block mx-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-400 via-slate-300 to-slate-500 p-1 shadow-2xl shadow-cyan-500/50 animate-pulse">
              <div className="w-full h-full rounded-full bg-[#080a0f] flex items-center justify-center border-2 border-cyan-400">
                <Award className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,1)]" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="font-race font-black tracking-tight leading-tight select-none">
              <span className="block text-2xl sm:text-3xl font-extrabold uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-teal-200 to-white drop-shadow-[0_2px_12px_rgba(6,182,212,0.5)]">
                CONGRATULATIONS
              </span>
              <span className="block text-3xl sm:text-5xl font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-100 drop-shadow-[0_4px_20px_rgba(6,182,212,0.8)] mt-1">
                RUNNER UP!
              </span>
            </h1>
            <div className="text-lg sm:text-xl font-race font-black text-white tracking-wide">
              1ST RUNNER UP OF <span className="text-cyan-400 underline decoration-cyan-400/80">CLOUDNEX 2K26</span>!
            </div>
            <p className="text-xs text-cyan-100/90 font-mono-code max-w-lg mx-auto leading-relaxed pt-1">
              Incredible resilience and cloud engineering prowess! Your team fought fiercely across all three rounds and secured an elite podium finish as the official 1st Runner Up.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-cyan-400/60 backdrop-blur-md shadow-xl text-left max-w-lg mx-auto space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[9px] font-mono-code uppercase text-cyan-400/80 block font-bold">PODIUM RUNNER UP</span>
                <strong className="text-base font-race font-black text-white block">
                  {user?.team_name || team?.team_name || 'Runner Up Team'}
                </strong>
              </div>
              <span className="px-3 py-1 rounded-lg bg-cyan-400 text-slate-950 font-race font-black text-xs uppercase shadow-md">
                2ND PLACE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
              <div>
                <span className="text-slate-400 block text-[9px]">CHAMPIONSHIP VENUE:</span>
                <span className="text-white font-semibold">GM University, Davangere</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">EVENT:</span>
                <span className="text-amber-400 font-semibold">IGNITRON 2K26</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE C: WINNER ANNOUNCED & TEAM IS QUALIFIED FOR ROUND 3 (NOT WINNER OR RUNNER UP)
  // Shows the dedicated QUALIFIED SECTION for finalists
  // =========================================================================
  if (isWinnerAnnounced && isTeamQualified && !isWinner && !isRunnerUp) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-b from-[#0a1e17] via-[#090d16] to-[#04060a] shadow-xl shadow-emerald-950/50 p-6 sm:p-8 max-w-3xl mx-auto">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-20 text-center max-w-2xl mx-auto space-y-4 pt-1">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[10px] font-race font-bold tracking-widest uppercase shadow-md">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>OFFICIAL QUALIFIED FINALIST RECOGNITION</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <div className="relative inline-block mx-auto">
            <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-400 to-cyan-300 p-1 shadow-lg shadow-emerald-500/40 animate-pulse">
              <div className="w-full h-full rounded-full bg-[#080a0f] flex items-center justify-center border border-emerald-400">
                <Medal className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-300 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-race font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-300 to-cyan-300 drop-shadow-[0_2px_10px_rgba(16,185,129,0.4)]">
              ROUND 3 QUALIFIED FINALIST
            </h1>
            <div className="text-base sm:text-lg font-race font-extrabold text-white tracking-wide">
              CONGRATULATIONS ON COMPLETING AS A <span className="text-emerald-400 underline decoration-emerald-500/60">TOP FINALIST</span>!
            </div>
            <p className="text-xs text-slate-300 font-mono-code max-w-lg mx-auto leading-relaxed pt-0.5">
              Outstanding achievement! Your squad cleared all Round 1 and Round 2 elimination filters and demonstrated elite cloud architecture skills as an official Round 3 finalist in the <strong className="text-emerald-300">CLOUDNEX 2K26 Championship</strong>.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/85 border border-emerald-500/40 backdrop-blur-md shadow-lg text-left max-w-lg mx-auto space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[9px] font-mono-code uppercase text-emerald-400 block font-bold">QUALIFIED FINALIST SQUAD</span>
                <strong className="text-sm font-race font-bold text-white block">
                  {user?.team_name || team?.team_name || 'Finalist Squad'}
                </strong>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono-code text-[11px] font-bold">
                QUALIFIED FINALIST
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
              <div>
                <span className="text-slate-400 block text-[9px]">CHAMPIONSHIP VENUE:</span>
                <span className="text-white font-semibold">GM University, Davangere</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">EVENT:</span>
                <span className="text-amber-400 font-semibold">IGNITRON 2K26</span>
              </div>
            </div>
            {team?.director_feedback && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono-code text-emerald-200">
                <span className="text-[9px] uppercase font-bold text-emerald-400 block mb-0.5">CHIEF STEWARD COMMENDATION:</span>
                &ldquo;{cleanCommendation(team.director_feedback)}&rdquo;
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 1: LIVE COUNTDOWN ACTIVE (Shown for all teams while countdown runs)
  // =========================================================================
  if (isCountdownActive || (resultsTimerActive && !isAnnounced && secondsLeft > 0)) {
    const progressPercent = totalTimerDuration > 0
      ? Math.max(0, Math.min(100, ((totalTimerDuration - secondsLeft) / totalTimerDuration) * 100))
      : 0;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#111827] via-[#090d16] to-[#04060a] shadow-xl shadow-amber-950/40 p-4 sm:p-6 max-w-xl mx-auto text-center space-y-4">
        {/* Ambient Neon Atmosphere */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Telemetry Badge */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-1.5">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-red-950/90 border border-red-500/50 text-red-300 text-[9px] font-race font-bold uppercase tracking-widest shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <Radio className="w-3 h-3 text-red-400" />
            <span>LIVE STEWARDS BROADCAST</span>
          </div>

          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-[9px] font-race font-bold uppercase tracking-wider">
            <span>IGNITRON 2K26</span>
          </div>
        </div>

        {/* Section Heading */}
        <div className="relative z-10 space-y-1">
          <h3 className="text-base sm:text-lg font-race font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500">
            {isWinnerTimer ? 'CHAMPIONSHIP WINNERS ANNOUNCEMENT COUNTDOWN' : 'ROUND 3 RESULTS ANNOUNCEMENT COUNTDOWN'}
          </h3>
          <p className="text-[11px] font-mono-code text-slate-300 max-w-md mx-auto leading-relaxed">
            {isWinnerTimer
              ? 'Race Stewards are finalizing the Grand Champion & 1st Runner Up. Stand by for the live broadcast!'
              : 'Race Stewards are finalizing qualifiers. Results will unlock live when countdown hits zero!'}
          </p>
        </div>

        {/* F1 Starting Lights Gantry (Compact) */}
        <div className="relative z-10 flex justify-center py-0.5">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-black/80 border border-white/10 shadow-lg backdrop-blur-md">
            <span className="text-[9px] font-race font-bold text-slate-400 mr-0.5">GRID LIGHTS:</span>
            {[1, 2, 3, 4, 5].map((lightIndex) => {
              const isLit = secondsLeft <= 5 ? (6 - lightIndex) >= secondsLeft : true;
              return (
                <div key={lightIndex} className="flex flex-col items-center space-y-0.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                      isLit
                        ? 'bg-red-600 border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse'
                        : 'bg-slate-900 border-slate-700 opacity-30'
                    }`}
                  />
                  <span className="text-[7px] font-mono-code text-slate-500">L{lightIndex}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Centerpiece Live Countdown Ticker */}
        <div className="relative z-10 my-1 flex flex-col items-center justify-center">
          <div className="relative px-6 py-2.5 rounded-2xl bg-slate-950/90 border border-amber-500/40 shadow-xl backdrop-blur-lg">
            <div className="text-4xl sm:text-5xl font-race font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-yellow-600 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)] select-none">
              {secondsLeft}
            </div>
            <div className="text-[10px] font-race font-bold uppercase tracking-widest text-amber-400 mt-0.5 flex items-center justify-center space-x-1.5">
              <Timer className="w-3 h-3 animate-spin text-amber-400" />
              <span>SECONDS REMAINING</span>
            </div>
          </div>
        </div>

        {/* Telemetry Progress Bar */}
        <div className="relative z-10 max-w-xs mx-auto space-y-1">
          <div className="flex justify-between text-[9px] font-mono-code text-slate-400">
            <span>PROGRESS</span>
            <span className="text-amber-300 font-bold">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-900 border border-white/10 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 via-amber-400 to-red-500 transition-all duration-200 shadow-[0_0_6px_rgba(245,158,11,0.7)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Sealed Team Identifier Card */}
        <div className="relative z-10 p-3 rounded-xl bg-slate-950/80 border border-white/10 backdrop-blur-md max-w-sm mx-auto text-left space-y-1.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <div>
              <span className="text-[8px] font-mono-code text-slate-400 uppercase block">TEAM RECORD</span>
              <strong className="text-xs font-race text-white">{user?.team_name || team?.team_name || 'Contender Team'}</strong>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-white/10 text-cyan-300 font-mono-code text-[10px] font-bold">
              {teamId}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-300">
            <span>SELECTION STATUS:</span>
            <span className="text-amber-400 font-race font-bold text-[10px] animate-pulse">
              SEALED &bull; UNLOCKS AT ZERO
            </span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE D: ANNOUNCED (OR COUNTDOWN COMPLETED) & TEAM IS QUALIFIED FOR ROUND 3
  // Shows the 3rd round selection announcement celebration card
  // =========================================================================
  if (isAnnounced && isTeamQualified) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#0e1726] via-[#090d16] to-[#04060a] shadow-xl shadow-cyan-950/60 p-5 sm:p-7 max-w-3xl mx-auto">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-20 text-center max-w-2xl mx-auto space-y-4 pt-1">
          <div className="flex items-center justify-center w-full mb-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-race font-bold tracking-widest uppercase shadow-sm">
              <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
              <span>OFFICIAL STEWARDS ANNOUNCEMENT</span>
              <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
            </div>
          </div>

          <div className="relative inline-block mx-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-1 shadow-lg shadow-yellow-500/40 animate-pulse">
              <div className="w-full h-full rounded-full bg-[#080a0f] flex items-center justify-center border border-amber-400/80">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] animate-bounce" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-race font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-cyan-300 drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)]">
              CONGRATULATIONS!
            </h1>
            <div className="text-base sm:text-lg font-race font-extrabold text-white tracking-wide">
              YOU ARE SELECTED FOR <span className="text-cyan-400 underline decoration-cyan-500/60">ROUND 3</span>!
            </div>
            <p className="text-xs text-slate-300 font-mono-code max-w-lg mx-auto leading-relaxed pt-0.5">
              Qualified teams will face unexpected real-world cloud infrastructure challenges introduced by the organizers. Teams must diagnose the issue, implement an appropriate solution, and demonstrate how their application maintains availability, performance, and reliability under pressure. Challenges will use controlled simulations or safely configured test environments.
            </p>
            <div className="pt-2">
              <span className="inline-block px-3 py-1 rounded-md bg-amber-950/80 border border-amber-500/40 text-amber-300 font-race text-[11px] font-bold uppercase tracking-wider">
                Key Deliverable: Crises &amp; Presentation
              </span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/85 border border-white/10 backdrop-blur-md shadow-lg text-left max-w-lg mx-auto space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[9px] font-mono-code uppercase text-slate-400 block">QUALIFIED SQUAD</span>
                <strong className="text-sm font-race font-bold text-white block">
                  {user?.team_name || team?.team_name || 'Champion Team'}
                </strong>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono-code text-[11px] font-bold">
                {teamId}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
              <div>
                <span className="text-slate-400 block text-[9px]">CHAMPIONSHIP VENUE:</span>
                <span className="text-white font-semibold">GM University, Davangere</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">EVENT:</span>
                <span className="text-amber-400 font-semibold">IGNITRON 2K26</span>
              </div>
            </div>
            {team?.director_feedback && (
              <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[11px] font-mono-code text-cyan-200">
                <span className="text-[9px] uppercase font-bold text-cyan-400 block mb-0.5">CHIEF STEWARD COMMENDATION:</span>
                &ldquo;{cleanCommendation(team.director_feedback)}&rdquo;
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: AWAITING ADMIN ANNOUNCEMENT (No timer active yet & results not announced)
  // =========================================================================
  if (!isAnnounced) {
    return (
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-950/80 border border-amber-500/30 text-center max-w-xl mx-auto space-y-4">
        <div className="w-14 h-14 rounded-full bg-slate-900 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-950/40">
          <Clock className="w-7 h-7 animate-pulse text-amber-400" />
        </div>

        <div className="space-y-1.5">
          <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-race font-bold tracking-wider uppercase">
            EVALUATIONS IN PROGRESS
          </span>
          <h3 className="text-xl sm:text-2xl font-race font-bold text-white mt-2">
            Round 3 Selections Pending Announcement
          </h3>
          <p className="text-xs text-slate-400 font-mono-code max-w-md mx-auto leading-relaxed pt-1">
            Race Control Stewards are currently reviewing all submissions.
            Qualifiers and official podium results will go live as soon as Race Control begins the official announcement countdown.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs font-mono-code text-slate-400 max-w-md mx-auto flex items-center justify-between">
          <span>Grid Status:</span>
          <span className="text-amber-400 font-race font-bold">Awaiting Steward Announcement</span>
        </div>

        <div className="pt-2 text-[10px] font-mono-code text-slate-500 border-t border-white/5">
          Team: <strong className="text-white">{user?.team_name || team?.team_name}</strong> ({teamId})
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 3: RESULTS ANNOUNCED & TEAM IS NOT SELECTED / ELIMINATED
  // Respectful completion card (NO points, NO leaderboard)
  // =========================================================================
  return (
    <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-b from-[#130b0f] via-[#0d090f] to-[#080a0f] shadow-xl p-5 sm:p-7 max-w-2xl mx-auto">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto text-center space-y-4">
        {/* Finish Icon */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center shadow-md shadow-red-950/60">
          <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" />
        </div>

        {/* Status Pill */}
        <div>
          <span className="px-3 py-1 rounded-full bg-red-950/80 border border-red-600/50 text-red-300 text-[10px] font-race font-bold tracking-widest uppercase">
            RACE COMPLETED &bull; ROUND 2 FINISH
          </span>
        </div>

        {/* Required Exact Headings & Encouraging Wording */}
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-race font-black text-white">
            Sorry, you are not included in the 3rd round.
          </h2>

          <p className="text-sm sm:text-base font-race font-bold text-amber-400">
            Try again next time! All the best!
          </p>

          <p className="text-xs text-slate-400 font-mono-code max-w-md mx-auto leading-relaxed pt-1">
            Thank you for participating with great passion in the <strong className="text-slate-200">CLOUDNEX 2K26 Championship</strong>.
            Your technical architecture and sprint execution demonstrated commendable talent.
          </p>
        </div>

        {/* Team Record Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 text-left max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
            <div>
              <span className="text-[9px] font-mono-code text-slate-500 uppercase block">TEAM</span>
              <strong className="text-xs font-race text-white">{user?.team_name || team?.team_name}</strong>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-400 font-mono-code text-[11px]">
              {teamId}
            </span>
          </div>

          <div className="text-[11px] font-mono-code text-slate-400 flex items-center justify-between">
            <span>Institution:</span>
            <strong className="text-cyan-300">GM University, Davangere</strong>
          </div>

          {team?.director_feedback && (
            <div className="p-2 rounded-lg bg-red-950/30 border border-red-500/20 text-[11px] font-mono-code text-red-300">
              <span className="text-[9px] uppercase font-bold text-red-400 block mb-0.5">STEWARD NOTES:</span>
              &ldquo;{cleanCommendation(team.director_feedback)}&rdquo;
            </div>
          )}
        </div>

        <div className="pt-1 text-[11px] font-mono-code text-slate-500 flex items-center justify-center space-x-1.5">
          <Heart className="w-3.5 h-3.5 text-red-400" />
          <span>Keep building, innovating, and reaching for the championship podium!</span>
        </div>
      </div>
    </div>
  );
}
