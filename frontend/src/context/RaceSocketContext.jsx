import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

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

  // WebSocket Connection Management
  useEffect(() => {
    let unmounted = false;

    function getWsUrls() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const hostname = window.location.hostname;
      const query = teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';

      const urls = [
        `${protocol}//${host}/ws${query}`,
        `${protocol}//${host}/api/v1/ws${query}`
      ];

      // If running on standard dev port 5173, also include direct backend connection fallback
      if (window.location.port === '5173') {
        urls.push(`${protocol}//${hostname}:8000/ws${query}`);
      }

      return urls;
    }

    let urlIndex = 0;

    function connectWs() {
      if (unmounted) return;

      const wsUrls = getWsUrls();
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
            console.log(`🏁 Connected to Race Control live telemetry socket via ${currentUrl}`);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!unmounted) {
              dispatchEvent(data, 'ws');
            }
          } catch (e) {
            // Heartbeat pong or plain string
          }
        };

        ws.onclose = () => {
          if (!unmounted) {
            setIsConnected(false);
            urlIndex++;
            retryCountRef.current++;
            // Fast exponential backoff capped at 2000ms
            const delay = Math.min(400 * Math.pow(1.5, Math.min(retryCountRef.current, 4)), 2000);
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = setTimeout(connectWs, delay);
          }
        };

        ws.onerror = () => {
          try { ws.close(); } catch {}
        };
      } catch (err) {
        if (!unmounted) {
          urlIndex++;
          retryCountRef.current++;
          const delay = Math.min(500 * Math.pow(1.5, Math.min(retryCountRef.current, 4)), 2000);
          if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = setTimeout(connectWs, delay);
        }
      }
    }

    connectWs();

    // Fast heartbeat ping interval to keep connection hot
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try { socketRef.current.send('ping'); } catch {}
      }
    }, 10000);

    // Instant reconnect on window focus or network recovery
    const handleReactivate = () => {
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        retryCountRef.current = 0;
        connectWs();
      }
    };

    window.addEventListener('focus', handleReactivate);
    window.addEventListener('online', handleReactivate);

    return () => {
      unmounted = true;
      clearInterval(pingInterval);
      window.removeEventListener('focus', handleReactivate);
      window.removeEventListener('online', handleReactivate);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
        socketRef.current = null;
      }
    };
  }, [teamId, dispatchEvent]);

  return (
    <RaceSocketContext.Provider value={{ isConnected, lastEvent, registerListener, broadcastLocalEvent }}>
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

