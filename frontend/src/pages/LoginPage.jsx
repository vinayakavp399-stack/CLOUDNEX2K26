import React, { useState } from 'react';
import { Shield, User, Lock, ArrowRight, Zap, CheckCircle2, AlertCircle, Building, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import dashboardBg from '../assets/dashboard_bg.jpg';

export default function LoginPage({ initialRole = 'participant', onSuccess, onBack }) {
  const [activeTab, setActiveTab] = useState(initialRole); // 'participant', 'admin', 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration form state
  const [regTeamId, setRegTeamId] = useState('');
  const [regTeamName, setRegTeamName] = useState('');
  const [regLeaderName, setRegLeaderName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInstitution, setRegInstitution] = useState('');
  const [regMembers, setRegMembers] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const profile = await login(username, password);
      if (activeTab === 'admin' && profile.role !== 'admin') {
        setError('This portal is restricted to authorized Race Directors (Admins).');
        setLoading(false);
        return;
      }
      if (onSuccess) {
        onSuccess(profile);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
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
    const cleanEmail = regEmail.trim();

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
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Team Leader email address.');
      return;
    }

    setLoading(true);

    try {
      const membersArray = regMembers
        .split('\n')
        .map(m => m.trim())
        .filter(Boolean);

      const resp = await api.auth.register({
        team_id: cleanTeamId,
        team_name: cleanTeamName,
        leader_name: cleanLeader,
        email: cleanEmail,
        password: regPassword,
        institution: regInstitution.trim(),
        members: membersArray
      });

      setSuccessMsg(resp.message || `Team '${cleanTeamName}' successfully registered by Team Leader ${cleanLeader}! You may now sign in.`);
      setActiveTab('participant');
      setUsername(cleanTeamId.toLowerCase());
      setPassword(regPassword);
    } catch (err) {
      setError(err.message || 'Registration failed. Check the fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center bg-[#080a0f] relative overflow-hidden">
      {/* High-Tech Dashboard Background Image */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img
          src={dashboardBg}
          alt="CLOUDNEX Atmosphere"
          className="w-full h-full object-cover object-top opacity-35 filter brightness-95 contrast-110"
        />
        <div className="absolute inset-0 bg-[#080a0f]/80 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-[#080a0f]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080a0f]/80 via-transparent to-[#080a0f]/80" />
      </div>

      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none z-0" />

      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-race font-bold tracking-wider flex items-center space-x-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>GM UNIVERSITY</span>
            </span>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-mono-code font-bold">
              <span>CLOUDNEX 2K26</span>
            </div>
          </div>
          <h2 className="font-race text-3xl font-black text-white tracking-wider">
            {activeTab === 'admin'
              ? 'RACE DIRECTOR CONTROL'
              : activeTab === 'register'
              ? 'REGISTER TEAM GRID'
              : 'PARTICIPANT COCKPIT'}
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Formula 1 Racing Competition &bull; <strong className="text-cyan-300">GM University, Davangere</strong>
          </p>
        </div>

        {/* Card */}
        <div className="racing-card rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/10">
          {/* Tab selector */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl mb-6 border border-white/5 text-xs font-race font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('participant'); setError(''); setSuccessMsg(''); }}
              className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${
                activeTab === 'participant'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Participant
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('admin'); setError(''); setSuccessMsg(''); }}
              className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Race Director
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
              className={`py-2 rounded-lg transition-all duration-75 active:scale-95 cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register Team
            </button>
          </div>

          {/* Error / Success Alerts */}
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
                <label className="block text-xs font-race font-bold text-slate-300 uppercase mb-1.5">
                  {activeTab === 'admin' ? 'Director Username' : 'Team ID or Email'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={activeTab === 'admin' ? 'e.g. race_director' : 'e.g. TEAM-RED-BULL-01'}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono-code placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-race font-bold text-slate-300 uppercase mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security key"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono-code placeholder:text-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-race font-bold text-sm tracking-wider uppercase text-white shadow-lg transition-all flex items-center justify-center space-x-2 mt-6 ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-red-950/60'
                    : 'bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600'
                }`}
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Cockpit</span>
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
                  <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                    Team ID
                  </label>
                  <input
                    type="text"
                    required
                    value={regTeamId}
                    onChange={(e) => setRegTeamId(e.target.value)}
                    placeholder="e.g. APEX-07"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regTeamName}
                    onChange={(e) => setRegTeamName(e.target.value)}
                    placeholder="Apex Racers"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                    Team Leader
                  </label>
                  <input
                    type="text"
                    required
                    value={regLeaderName}
                    onChange={(e) => setRegLeaderName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                    Leader Email
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="leader@college.edu"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  value={regInstitution}
                  onChange={(e) => setRegInstitution(e.target.value)}
                  placeholder="e.g. GM University, Davangere"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                  Team Members (One per line)
                </label>
                <textarea
                  rows="2"
                  value={regMembers}
                  onChange={(e) => setRegMembers(e.target.value)}
                  placeholder="Karthik V&#10;Divya R"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono-code"
                />
              </div>

              <div>
                <label className="block text-[11px] font-race text-slate-300 uppercase mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create team password"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono-code"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-race font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer"
              >
                {loading ? 'Registering Team...' : 'Submit Grid Registration'}
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
