import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAuthToken, getUserData, setAuthToken, setUserData } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUserData());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initUser() {
      const token = getAuthToken();
      if (token) {
        try {
          const profile = await api.auth.me();
          setUser(profile);
          setUserData(profile);
        } catch (err) {
          // Only clear session if explicitly rejected with 401 (invalidated credentials or single device takeover)
          if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('Could not validate') || err?.message?.includes('logged out') || err?.message?.includes('terminated')) {
            console.warn('Session expired or invalidated by another device', err);
            setAuthToken(null);
            setUserData(null);
            setUser(null);
            localStorage.removeItem('cloudnex_view');
          } else {
            // Network delay, server cold start on Render, or temporary glitch:
            // Do NOT log out the user! Keep existing session active.
            console.warn('Backend server waking up or temporary network lag; retaining active login session.', err);
          }
        }
      }
      setLoading(false);
    }
    initUser();
  }, []);

  const login = async (username, password, force = false) => {
    const data = await api.auth.login(username, password, force);
    
    // Fast login path: Use profile returned directly by login endpoint
    const profile = data.user || {
      username: data.username,
      role: data.role,
      team_id: data.team_id,
      team_name: data.team_name,
      team: data.team
    };
    setAuthToken(data.access_token, profile?.role);
    setUser(profile);
    setUserData(profile);

    // Sync full profile in the background without blocking the UI navigation
    api.auth.me().then(latest => {
      if (latest) {
        setUser(latest);
        setUserData(latest);
      }
    }).catch(() => {});

    return profile;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    }
    setAuthToken(null, user?.role);
    setUserData(null);
    setUser(null);
    localStorage.removeItem('cloudnex_view');
  };

  const refreshProfile = async () => {
    try {
      const profile = await api.auth.me();
      setUser(profile);
      setUserData(profile);
      return profile;
    } catch {
      return null;
    }
  };

  const value = {
    user,
    role: user?.role,
    teamId: user?.team_id,
    teamName: user?.team_name,
    team: user?.team,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isParticipant: user?.role === 'participant',
    loading,
    login,
    logout,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
