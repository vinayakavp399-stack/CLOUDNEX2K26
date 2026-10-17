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
          console.warn('Session expired or invalid token', err);
          setAuthToken(null);
          setUserData(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    initUser();
  }, []);

  const login = async (username, password) => {
    const data = await api.auth.login(username, password);
    
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
