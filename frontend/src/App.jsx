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

  // Listen for single-device participant force logout event
  useEffect(() => {
    if (!registerListener) return;
    const unsubscribe = registerListener((event) => {
      if (event && event.type === 'FORCE_LOGOUT') {
        alert(event.data?.message || 'Your session has been terminated because this account was logged into on another device.');
        logout();
        handleSetView('landing');
      }
    });
    return unsubscribe;
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
            onSuccess={handleLoginSuccess}
            onBack={() => handleSetView('landing')}
          />
        )}

        {currentView === 'login-admin' && (
          <LoginPage
            initialRole="admin"
            onSuccess={handleLoginSuccess}
            onBack={() => handleSetView('landing')}
          />
        )}

        {currentView === 'participant' && (
          isAuthenticated && isParticipant ? (
            <ParticipantDashboard />
          ) : (
            <LoginPage
              initialRole="participant"
              onSuccess={handleLoginSuccess}
              onBack={() => handleSetView('landing')}
            />
          )
        )}

        {currentView === 'admin' && (
          isAuthenticated && isAdmin ? (
            <AdminDashboard />
          ) : (
            <LoginPage
              initialRole="admin"
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

      {/* Hide footer on admin portal so announcement and race control stay clean */}
      {currentView !== 'admin' && <Footer />}
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
