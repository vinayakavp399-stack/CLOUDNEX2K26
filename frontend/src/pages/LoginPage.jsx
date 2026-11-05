import React, { useState } from 'react';
import { Shield, User, Lock, ArrowRight, Zap, CheckCircle2, AlertCircle, Building, Users, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import dashboardBg from '../assets/dashboard_bg.jpg';

export default function LoginPage({ initialRole = 'participant', lockedPortal = null, onSuccess, onBack, onSwitchPortal }) {
  const { isLight } = useTheme();
  const [activeTab, setActiveTab] = useState(() => {
    if (lockedPortal === 'admin') return 'admin';
    if (lockedPortal === 'participant') {
      return initialRole === 'register' ? 'register' : 'participant';
    }
    return initialRole;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showParticipantPassword, setShowParticipantPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Synchronize tab if lockedPortal changes
  React.useEffect(() => {
    if (lockedPortal === 'admin') {
      setActiveTab('admin');
    } else if (lockedPortal === 'participant') {
      setActiveTab(prev => (prev === 'register' ? 'register' : 'participant'));
    }
  }, [lockedPortal]);

  // Registration form state
  const [regTeamId, setRegTeamId] = useState('');
  const [regTeamName, setRegTeamName] = useState('');
  const [regLeaderName, setRegLeaderName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInstitution, setRegInstitution] = useState('');
  const [regMembers, setRegMembers] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflictError, setConflictError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { login, register } = useAuth();

  const handleLogin = async (e, force = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setConflictError(false);
    setLoading(true);

    const expectedRole = activeTab === 'admin' ? 'admin' : 'participant';

    try {
      const profile = await login(username, password, force, expectedRole);
      if (expectedRole === 'admin' && profile.role !== 'admin') {
        setError('Access denied: Participant credentials cannot be used for Race Director (Admin) login.');
        setLoading(false);
        return;
      }
      if (expectedRole === 'participant' && profile.role !== 'participant') {
        setError('Access denied: Race Director credentials cannot be used for Participant login.');
        setLoading(false);
        return;
      }
      if (onSuccess) {
        onSuccess(profile);
      }
    } catch (err) {
      if (err.status === 409 || err.message?.toLowerCase().includes('already logged in on another device') || err.message?.toLowerCase().includes('one device at a time')) {
        setConflictError(true);
      } else {
        setError(err.message || 'Login failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanTeamId = regTeamId.trim();
    const cleanTeamName = regTeamName.trim();
    const cleanLeader = regLeaderName.trim();

    if (!cleanLeader) {
      setError('Registration must be completed by the Team Leader. Please enter the Team Leader name.');
      return;
    }
    if (!cleanTeamName) {
      setError('Please provide a unique Team Name.');
      return;
    }
    if (!cleanTeamId) {
      setError('Please provide a unique Team ID.');
      return;
    }
    if (!regPassword) {
      setError('Please provide a secure team password.');
      return;
    }

    setLoading(true);

    try {
      const membersArray = regMembers
        .split('\n')
        .map(m => m.trim())
        .filter(Boolean);

      const resp = await register({
        team_id: cleanTeamId,
        team_name: cleanTeamName,
        leader_name: cleanLeader,
        email: '',
        password: regPassword,
        institution: regInstitution.trim(),
        members: membersArray
      });

      // Seamless Instant Entry: Directly launch the participant into their Cockpit!
      if (onSuccess && resp.user) {
        onSuccess(resp.user);
      } else {
        setSuccessMsg(resp.message || `Team '${cleanTeamName}' successfully registered! You are now logged in.`);
        setActiveTab('participant');
        setUsername(cleanTeamId.toLowerCase());
        setPassword(regPassword);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Check the fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center relative overflow-hidden transition-colors duration-300 ${
      isLight ? 'bg-gradient-to-b from-sky-50 via-slate-50 to-indigo-50/40 text-slate-900' : 'bg-[#080a0f] text-white'
    }`}>
      {/* High-Tech Dashboard Background Image */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img
          src={dashboardBg}
          alt="CLOUDNEX Atmosphere"
          className={`w-full h-full object-cover object-top opacity-35 filter ${isLight ? 'brightness-110 contrast-100' : 'brightness-95 contrast-110'}`}
        />
        <div className={`absolute inset-0 ${isLight ? 'bg-slate-50/85 backdrop-blur-[2px]' : 'bg-[#080a0f]/80 backdrop-blur-[1px]'}`} />
        <div className={`absolute inset-0 bg-gradient-to-t ${isLight ? 'from-slate-100 via-transparent to-slate-100/90' : 'from-[#080a0f] via-transparent to-[#080a0f]/90'}`} />
        <div className={`absolute inset-0 bg-gradient-to-r ${isLight ? 'from-slate-100/80 via-transparent to-slate-100/80' : 'from-[#080a0f]/80 via-transparent to-[#080a0f]/80'}`} />
      </div>

      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none z-0" />

      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className={`px-3 py-1 border rounded-full text-xs font-race font-bold tracking-wider flex items-center space-x-1.5 shadow-sm ${
              activeTab === 'admin'
                ? isLight ? 'bg-red-50 text-red-700 border-red-300' : 'bg-red-500/20 text-red-300 border-red-500/40'
                : isLight ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeTab === 'admin' ? 'bg-red-500' : 'bg-cyan-500'}`} />
              <span>GM UNIVERSITY</span>
            </span>
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-mono-code font-bold ${
              isLight ? 'bg-white border-slate-200 text-slate-700 shadow-sm' : 'bg-slate-900 border-white/10 text-slate-300'
            }`}>
              <span>{activeTab === 'admin' ? 'CHIEF STEWARDS & RACE CONTROL' : 'CLOUDNEX 2K26 GRID'}</span>
            </div>
          </div>
          <h2 className={`font-race text-3xl font-black tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {activeTab === 'admin'
              ? 'RACE DIRECTOR CONTROL'
              : activeTab === 'register'
                ? 'REGISTER TEAM GRID'
                : 'PARTICIPANT COCKPIT'}
          </h2>
          <p className={`text-xs mt-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {activeTab === 'admin' ? (
              <>Restricted Organizer Portal &bull; <strong className="text-red-500 font-bold">Chief Steward Authorization Required</strong></>
            ) : (
              <>Formula 1 Racing Competition &bull; <strong className={isLight ? 'text-sky-700 font-bold' : 'text-cyan-300'}>GM University, Davangere</strong></>
            )}
          </p>
        </div>

        {/* Card */}
        <div className={`rounded-2xl p-6 sm:p-8 shadow-2xl border transition-all ${
          isLight ? 'bg-white/95 border-sky-200 shadow-slate-200/80 text-slate-900' : 'racing-card border-white/10 text-white'
        }`}>
          {/* Tab selector or Portal indicator */}
          {lockedPortal === 'participant' ? (
            <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl mb-6 border text-xs font-race font-bold ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-white/5'
            }`}>
              <button
                type="button"
                onClick={() => { setActiveTab('participant'); setError(''); setSuccessMsg(''); }}
                className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${activeTab === 'participant'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Participant Sign In
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
                className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${activeTab === 'register'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Register Team
              </button>
            </div>
          ) : lockedPortal === 'admin' ? (
            <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-race font-bold mb-6 ${
              isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/40 border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span>RESTRICTED ORGANIZER ACCESS</span>
              </div>
              <span className={`text-[10px] font-mono-code px-2 py-0.5 rounded font-bold ${
                isLight ? 'bg-red-100 text-red-800' : 'bg-red-500/20 text-red-300'
              }`}>ADMIN ONLY</span>
            </div>
          ) : (
            <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-6 border text-xs font-race font-bold ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-white/5'
            }`}>
              <button
                type="button"
                onClick={() => { setActiveTab('participant'); setError(''); setSuccessMsg(''); }}
                className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${activeTab === 'participant'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Participant
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('admin'); setError(''); setSuccessMsg(''); }}
                className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${activeTab === 'admin'
                    ? 'bg-red-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Race Director
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
                className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${activeTab === 'register'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Register
              </button>
            </div>
          )}

          {/* Error / Success / Conflict Alerts */}
          {conflictError && (
            <div className="mb-4 p-4 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs shadow-lg">
              <div className="flex items-center space-x-2 font-race font-bold text-amber-400 text-sm mb-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Single Device Limit (Participant)</span>
              </div>
              <p className="text-slate-300 mb-3 leading-relaxed">
                Team <strong>{username.toUpperCase()}</strong> is currently logged in on another device.
                For participants, only 1 device can be accessed at a time.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={(e) => handleLogin(e, true)}
                  disabled={loading}
                  className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-race font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-amber-950/60 cursor-pointer"
                >
                  {loading ? 'Switching Device...' : 'Sign Out Other Device & Log In Here'}
                </button>
                <button
                  type="button"
                  onClick={() => setConflictError(false)}
                  className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-600/50 text-red-300 text-xs font-mono-code flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 text-xs font-mono-code flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form (Participant or Admin) */}
          {activeTab !== 'register' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block text-xs font-race font-bold uppercase mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {activeTab === 'admin' ? 'Director Username' : 'Team ID or Email'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={activeTab === 'admin' ? 'e.g. race_director' : 'e.g. TEAM-RED-BULL-01'}
                    className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono-code transition-colors ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-600 focus:bg-white'
                        : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-race font-bold uppercase mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={activeTab !== 'admin' && showParticipantPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security key"
                    className={`w-full border rounded-xl pl-10 pr-11 py-2.5 text-sm font-mono-code transition-colors ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-600 focus:bg-white'
                        : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500'
                    }`}
                  />
                  {activeTab !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => setShowParticipantPassword(!showParticipantPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
                      title={showParticipantPassword ? 'Hide password' : 'View password'}
                    >
                      {showParticipantPassword ? (
                        <EyeOff className={`w-4 h-4 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-cyan-400'}`} />
                      ) : (
                        <Eye className={`w-4 h-4 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-cyan-400'}`} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-race font-bold text-sm tracking-wider uppercase text-white shadow-lg transition-all flex items-center justify-center space-x-2 mt-6 cursor-pointer ${activeTab === 'admin'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-red-950/60'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-950/60'
                  }`}
              >
                {loading ? (
                  <span className="flex items-center space-x-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Telemetry...</span>
                  </span>
                ) : (
                  <>
                    <span>{activeTab === 'admin' ? 'Enter Race Control' : 'Enter Cockpit'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-race uppercase mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Team ID
                  </label>
                  <input
                    type="text"
                    required
                    value={regTeamId}
                    onChange={(e) => setRegTeamId(e.target.value)}
                    placeholder="e.g. APEX-07"
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-mono-code ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-race uppercase mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regTeamName}
                    onChange={(e) => setRegTeamName(e.target.value)}
                    placeholder="Apex Racers"
                    className={`w-full border rounded-lg px-3 py-2 text-xs ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-race uppercase mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Team Leader Name
                </label>
                <input
                  type="text"
                  required
                  value={regLeaderName}
                  onChange={(e) => setRegLeaderName(e.target.value)}
                  placeholder="Full Name of Team Leader"
                  className={`w-full border rounded-lg px-3 py-2 text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-race uppercase mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  value={regInstitution}
                  onChange={(e) => setRegInstitution(e.target.value)}
                  placeholder="e.g. GM University, Davangere"
                  className={`w-full border rounded-lg px-3 py-2 text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-race uppercase mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Team Members (One per line)
                </label>
                <textarea
                  rows="2"
                  value={regMembers}
                  onChange={(e) => setRegMembers(e.target.value)}
                  placeholder="Karthik V&#10;Divya R"
                  className={`w-full border rounded-lg p-2.5 text-xs font-mono-code ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-race uppercase mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create team password"
                    className={`w-full border rounded-lg pl-3 pr-10 py-2 text-xs font-mono-code ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-slate-950 border-white/10 text-white placeholder:text-slate-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-1.5 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
                    title={showRegPassword ? 'Hide password' : 'View password'}
                  >
                    {showRegPassword ? (
                      <EyeOff className={`w-4 h-4 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-cyan-400'}`} />
                    ) : (
                      <Eye className={`w-4 h-4 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-cyan-400'}`} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-race font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span className="flex items-center space-x-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching Grid Registration...</span>
                  </span>
                ) : (
                  <>
                    <span>Submit Grid Registration & Enter Cockpit</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={onBack}
            className="text-xs font-mono-code text-slate-400 hover:text-white transition-colors"
          >
            &larr; Back to Grand Prix Overview
          </button>
        </div>
      </div>
    </div>
  );
}
