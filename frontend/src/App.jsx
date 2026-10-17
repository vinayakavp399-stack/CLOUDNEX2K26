import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RaceSocketProvider } from './context/RaceSocketContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ParticipantDashboard from './pages/ParticipantDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LeaderboardPage from './pages/LeaderboardPage';

function AppContent() {
  const { user, isAuthenticated, isAdmin, isParticipant } = useAuth();
  const [currentView, setView] = useState('landing');

  // Handle successful login routing
  const handleLoginSuccess = (profile) => {
    if (profile.role === 'admin') {
      setView('admin');
    } else {
      setView('participant');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080a0f] text-slate-100">
      <Navbar currentView={currentView} setView={setView} />

      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingPage
            onParticipantLogin={() => setView('login-participant')}
            onAdminLogin={() => setView('login-admin')}
          />
        )}

        {currentView === 'login-participant' && (
          <LoginPage
            initialRole="participant"
            onSuccess={handleLoginSuccess}
            onBack={() => setView('landing')}
          />
        )}

        {currentView === 'login-admin' && (
          <LoginPage
            initialRole="admin"
            onSuccess={handleLoginSuccess}
            onBack={() => setView('landing')}
          />
        )}

        {currentView === 'participant' && (
          isAuthenticated && isParticipant ? (
            <ParticipantDashboard />
          ) : (
            <LoginPage
              initialRole="participant"
              onSuccess={handleLoginSuccess}
              onBack={() => setView('landing')}
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
              onBack={() => setView('landing')}
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
