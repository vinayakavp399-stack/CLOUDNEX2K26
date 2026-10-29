import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getAuthToken } from '../api/client';

const RaceSocketContext = createContext(null);

export function RaceSocketProvider({ children }) {
  const { teamId } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const listenersRef = useRef(new Set());
  const broadcastChannelRef = useRef(null);
  const retryCountRef = useRef(0);
  const reconnectRef = useRef(null);

  const reconnect = useCallback(() => {
    if (reconnectRef.current) {
      reconnectRef.current();
    }
  }, []);

  const registerListener = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const dispatchEvent = useCallback((eventData, source = 'ws') => {
    if (!eventData || !eventData.type) return;
    setLastEvent(eventData);

    listenersRef.current.forEach(cb => {
      try {
        cb(eventData);
      } catch (e) {
        console.error('Socket listener error', e);
      }
    });

    // If event came from websocket, broadcast to other open tabs in this browser (0ms cross-tab sync)
    if (source === 'ws' && broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(eventData);
      } catch {}
    }
  }, []);

  // Broadcast an event locally across all tabs without waiting for network
  const broadcastLocalEvent = useCallback((eventType, payload) => {
    const eventObj = { type: eventType, data: payload, local: true, timestamp: new Date().toISOString() };
    dispatchEvent(eventObj, 'local');
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(eventObj);
      } catch {}
    }
  }, [dispatchEvent]);

  // Set up Cross-Tab Telemetry Broadcast Channel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('cloudnex_telemetry_bus');
        broadcastChannelRef.current = channel;

        channel.onmessage = (msgEvent) => {
          if (msgEvent.data) {
            dispatchEvent(msgEvent.data, 'channel');
          }
        };

        return () => {
          channel.close();
          broadcastChannelRef.current = null;
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or blocked', err);
      }
    }
  }, [dispatchEvent]);

  // WebSocket Connection Management with Self-Healing and Zero-Drop Resilience
  useEffect(() => {
    let unmounted = false;

    function getBackendEndpoints() {
      const token = getAuthToken() || getAuthToken('admin') || getAuthToken('participant');
      const params = [];
      if (teamId) params.push(`team_id=${encodeURIComponent(teamId)}`);
      if (token) params.push(`token=${encodeURIComponent(token)}`);
      const query = params.length > 0 ? `?${params.join('&')}` : '';

      const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0'
      );

      const customApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://cloudnex-backend.onrender.com' : null);
      const urls = [];

      // 1. Direct custom/production backend URL (e.g. Render)
      if (customApiUrl) {
        const wsProtocol = customApiUrl.startsWith('https') ? 'wss:' : 'ws:';
        const cleanHost = customApiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        urls.push(`${wsProtocol}//${cleanHost}/ws${query}`);
        urls.push(`${wsProtocol}//${cleanHost}/api/v1/ws${query}`);
      }

      // 2. In local dev mode, proxy through Vite and connect direct to FastAPI
      if (isLocal) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const hostname = window.location.hostname;

        urls.push(`${protocol}//${host}/ws${query}`);
        urls.push(`${protocol}//${host}/api/v1/ws${query}`);
        urls.push(`${protocol}//${hostname}:8000/ws${query}`);
        urls.push(`${protocol}//${hostname}:8000/api/v1/ws${query}`);
        urls.push(`${protocol}//127.0.0.1:8000/ws${query}`);
      } else if (!customApiUrl) {
        // Fallback production default if neither custom URL nor localhost
        urls.push(`wss://cloudnex-backend.onrender.com/ws${query}`);
        urls.push(`wss://cloudnex-backend.onrender.com/api/v1/ws${query}`);
      }

      // Deduplicate URLs
      return [...new Set(urls)];
    }

    // Keep Render / backend alive and wake from sleep if cold-started
    function pingBackendWake() {
      try {
        const customApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://cloudnex-backend.onrender.com' : null);
        const wakeTarget = customApiUrl || '/health';
        fetch(wakeTarget.startsWith('http') ? `${wakeTarget.replace(/\/+$/, '')}/health` : '/health', {
          method: 'GET',
          cache: 'no-store'
        }).catch(() => {});
      } catch {}
    }

    let urlIndex = 0;

    function connectWs() {
      if (unmounted) return;

      const wsUrls = getBackendEndpoints();
      if (!wsUrls.length) return;

      const currentUrl = wsUrls[urlIndex % wsUrls.length];

      try {
        if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
          return;
        }

        const ws = new WebSocket(currentUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!unmounted) {
            setIsConnected(true);
            retryCountRef.current = 0;
            console.log(`🏁 Telemetry WebSocket linked successfully via ${currentUrl}`);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!unmounted) {
              dispatchEvent(data, 'ws');
            }
          } catch {
            // Raw text or pong heartbeat
          }
        };

        ws.onclose = (event) => {
          if (!unmounted) {
            setIsConnected(false);
            if (event && event.code === 4001) {
              console.warn('WebSocket closed: single device takeover.');
              dispatchEvent({
                type: 'FORCE_LOGOUT',
                data: { message: 'Your session has been terminated because this account was logged into on another device.' }
              }, 'ws');
              return;
            }

            // Immediately attempt waking backend in case of sleep
            pingBackendWake();

            urlIndex = (urlIndex + 1) % wsUrls.length;
            retryCountRef.current++;
            // Rapid backoff capped at 1500ms
            const delay = Math.min(300 * Math.pow(1.3, Math.min(retryCountRef.current, 5)), 1500);
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = setTimeout(connectWs, delay);
          }
        };

        ws.onerror = () => {
          try { ws.close(); } catch {}
        };
      } catch (err) {
        if (!unmounted) {
          pingBackendWake();
          urlIndex = (urlIndex + 1) % wsUrls.length;
          retryCountRef.current++;
          const delay = Math.min(400 * Math.pow(1.3, Math.min(retryCountRef.current, 5)), 1500);
          if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = setTimeout(connectWs, delay);
        }
      }
    }

    // Initial connection + initial wake-up ping
    pingBackendWake();
    connectWs();

    // Fast heartbeat ping interval + auto-heal if socket is dead
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try { socketRef.current.send('ping'); } catch {}
      } else if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        // Auto-heal dead connection
        connectWs();
      }
    }, 8000);

    // Prevent cloud backend from sleeping while dashboard tab is open
    const wakeInterval = setInterval(pingBackendWake, 180000); // every 3 minutes

    reconnectRef.current = () => {
      retryCountRef.current = 0;
      urlIndex = 0;
      pingBackendWake();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
        socketRef.current = null;
      }
      connectWs();
    };

    // Instant reconnect on tab focus, network recovery, or visibility change
    const handleReactivate = () => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        retryCountRef.current = 0;
        pingBackendWake();
        connectWs();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleReactivate();
      }
    };

    window.addEventListener('focus', handleReactivate);
    window.addEventListener('online', handleReactivate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unmounted = true;
      reconnectRef.current = null;
      clearInterval(pingInterval);
      clearInterval(wakeInterval);
      window.removeEventListener('focus', handleReactivate);
      window.removeEventListener('online', handleReactivate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
        socketRef.current = null;
      }
    };
  }, [teamId, dispatchEvent]);

  return (
    <RaceSocketContext.Provider value={{ isConnected, lastEvent, registerListener, broadcastLocalEvent, reconnect }}>
      {children}
    </RaceSocketContext.Provider>
  );
}

export function useRaceSocket() {
  const context = useContext(RaceSocketContext);
  if (!context) {
    throw new Error('useRaceSocket must be used within a RaceSocketProvider');
  }
  return context;
}
