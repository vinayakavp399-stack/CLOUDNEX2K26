import React, { useState, useEffect, Component } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RaceSocketProvider, useRaceSocket } from './context/RaceSocketContext';
import { getUserData } from './api/client';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ParticipantDashboard from './pages/ParticipantDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TeamsPage from './pages/TeamsPage';
import LeaderboardPage from './pages/LeaderboardPage';

const VALID_VIEWS = ['landing', 'login-participant', 'login-admin', 'participant', 'admin', 'teams', 'leaderboard'];

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Telemetry ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080a0f] text-white flex flex-col items-center justify-center p-6 text-center font-race">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center mb-4 text-red-400">
            <span className="text-2xl font-black">!</span>
          </div>
          <h2 className="text-xl font-bold tracking-wider mb-2">TELEMETRY VIEW RECOVERY</h2>
          <p className="text-xs text-slate-400 font-mono-code max-w-md mb-6 leading-relaxed">
            The active telemetry viewport encountered a refresh synchronization issue. Click below to reset your cockpit view.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('cloudnex_view');
              sessionStorage.clear();
              window.location.href = '/';
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-950/60"
          >
            Reset Cockpit View &amp; Return Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, isAuthenticated, isAdmin, isParticipant, logout } = useAuth();
  const { registerListener } = useRaceSocket();

  // Restore active view from localStorage or user role so reloading stays on dashboard
  const [currentView, setView] = useState(() => {
    const saved = localStorage.getItem('cloudnex_view');
    if (saved && VALID_VIEWS.includes(saved) && saved !== 'landing') {
      return saved;
    }
    const savedUser = getUserData();
    if (savedUser?.role === 'admin') return 'admin';
    if (savedUser?.role === 'participant') return 'participant';
    return 'landing';
  });

  const handleSetView = (view) => {
    const target = VALID_VIEWS.includes(view) ? view : 'landing';
    setView(target);
    if (target === 'landing') {
      localStorage.removeItem('cloudnex_view');
    } else {
      localStorage.setItem('cloudnex_view', target);
    }
  };

  // If user is authenticated and currentView is unassigned/landing, automatically take them to their console
  useEffect(() => {
    if (isAuthenticated) {
      const saved = localStorage.getItem('cloudnex_view');
      if (!saved || saved === 'landing' || !VALID_VIEWS.includes(saved)) {
        const target = isAdmin ? 'admin' : 'participant';
        setView(target);
        localStorage.setItem('cloudnex_view', target);
      }
    }
  }, [isAuthenticated, isAdmin]);

  // If user logs out or is unauthenticated, redirect to main dashboard (landing) immediately
  useEffect(() => {
    if (!isAuthenticated) {
      if (currentView === 'admin' || currentView === 'participant' || currentView === 'teams') {
        handleSetView('landing');
      }
    }
  }, [isAuthenticated, currentView]);

  // Listen for single-device participant force logout event from telemetry event bus and global 401 interception
  useEffect(() => {
    let isHandling = false;
    const triggerLogout = (msg) => {
      if (isHandling) return;
      isHandling = true;
      logout();
      handleSetView('landing');
      setTimeout(() => { isHandling = false; }, 1000);
    };

    const handleCustomForceLogout = (e) => {
      triggerLogout(e?.detail?.message);
    };

    window.addEventListener('cloudnex:force_logout', handleCustomForceLogout);

    let unsubscribeWs = null;
    if (registerListener) {
      unsubscribeWs = registerListener((event) => {
        if (event && event.type === 'FORCE_LOGOUT') {
          triggerLogout(event.data?.message);
        }
      });
    }

    return () => {
      window.removeEventListener('cloudnex:force_logout', handleCustomForceLogout);
      if (unsubscribeWs) unsubscribeWs();
    };
  }, [registerListener, logout]);

  // Handle successful login routing
  const handleLoginSuccess = (profile) => {
    if (profile?.role === 'admin') {
      handleSetView('admin');
    } else {
      handleSetView('participant');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080a0f] text-slate-100">
      <Navbar currentView={currentView} setView={handleSetView} />

      <main className="flex-1">
        <ErrorBoundary>
          {currentView === 'landing' && (
            <LandingPage
              onParticipantLogin={() => handleSetView('login-participant')}
              onAdminLogin={() => handleSetView('login-admin')}
              onGoToDashboard={() => handleSetView(isAdmin ? 'admin' : 'participant')}
            />
          )}

          {currentView === 'login-participant' && (
            <LoginPage
              initialRole="participant"
              lockedPortal="participant"
              onSuccess={handleLoginSuccess}
              onBack={() => handleSetView('landing')}
            />
          )}

          {currentView === 'login-admin' && (
            <LoginPage
              initialRole="admin"
              lockedPortal="admin"
              onSuccess={handleLoginSuccess}
              onBack={() => handleSetView('landing')}
            />
          )}

          {currentView === 'participant' && (
            isAuthenticated ? (
              isParticipant ? (
                <ParticipantDashboard />
              ) : (
                <AdminDashboard />
              )
            ) : (
              <LoginPage
                initialRole="participant"
                lockedPortal="participant"
                onSuccess={handleLoginSuccess}
                onBack={() => handleSetView('landing')}
              />
            )
          )}

          {currentView === 'admin' && (
            isAuthenticated ? (
              isAdmin ? (
                <AdminDashboard initialTab="rounds" />
              ) : (
                <ParticipantDashboard />
              )
            ) : (
              <LoginPage
                initialRole="admin"
                lockedPortal="admin"
                onSuccess={handleLoginSuccess}
                onBack={() => handleSetView('landing')}
              />
            )
          )}

          {currentView === 'teams' && (
            isAuthenticated ? (
              isAdmin ? (
                <TeamsPage />
              ) : (
                <ParticipantDashboard />
              )
            ) : (
              <LoginPage
                initialRole="admin"
                lockedPortal="admin"
                onSuccess={handleLoginSuccess}
                onBack={() => handleSetView('landing')}
              />
            )
          )}

          {currentView === 'leaderboard' && (
            isAdmin ? (
              <LeaderboardPage />
            ) : (
              <ParticipantDashboard />
            )
          )}

          {!VALID_VIEWS.includes(currentView) && (
            <LandingPage
              onParticipantLogin={() => handleSetView('login-participant')}
              onAdminLogin={() => handleSetView('login-admin')}
              onGoToDashboard={() => handleSetView(isAdmin ? 'admin' : 'participant')}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Hide footer on admin/teams console so announcement and race control stay clean */}
      {currentView !== 'admin' && currentView !== 'teams' && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RaceSocketProvider>
        <AppContent />
      </RaceSocketProvider>
    </AuthProvider>
  );
}
