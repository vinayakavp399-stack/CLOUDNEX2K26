import React, { useState, useEffect } from 'react';
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

function AppContent() {
  const { user, isAuthenticated, isAdmin, isParticipant, logout } = useAuth();
  const { registerListener } = useRaceSocket();

  // Restore active view from localStorage or user role so reloading the page or reopening the browser
  // stays right on the user's dashboard!
  const [currentView, setView] = useState(() => {
    const saved = localStorage.getItem('cloudnex_view');
    const savedUser = getUserData();
    if (saved && saved !== 'landing') {
      return saved;
    }
    if (savedUser?.role === 'admin') return 'admin';
    if (savedUser?.role === 'participant') return 'participant';
    return 'landing';
  });

  const handleSetView = (view) => {
    setView(view);
    if (view === 'landing') {
      localStorage.removeItem('cloudnex_view');
    } else {
      localStorage.setItem('cloudnex_view', view);
    }
  };

  // If user is authenticated and currentView is unassigned/landing, automatically take them to their console
  useEffect(() => {
    if (isAuthenticated) {
      const saved = localStorage.getItem('cloudnex_view');
      if (!saved || saved === 'landing') {
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

  // Listen for single-device participant force logout event from WebSocket and global 401 interception
  useEffect(() => {
    let isHandling = false;
    const triggerLogout = (msg) => {
      if (isHandling) return;
      isHandling = true;
      alert(msg || 'Your session has been terminated.');
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
    if (profile.role === 'admin') {
      handleSetView('admin');
    } else {
      handleSetView('participant');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080a0f] text-slate-100">
      <Navbar currentView={currentView} setView={handleSetView} />

      <main className="flex-1">
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
