import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api, getUserData } from '../api/client';

const RaceSocketContext = createContext(null);

/**
 * RaceTelemetryProvider (replaces WebSockets with intelligent HTTP polling & event streaming)
 * Maintains 100% backward compatibility with useRaceSocket across all dashboards and pages.
 */
export function RaceSocketProvider({ children }) {
  const { teamId } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);

  const listenersRef = useRef(new Set());
  const broadcastChannelRef = useRef(null);
  const lastEventIdRef = useRef(null);
  const isPollingRef = useRef(false);
  const pollTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const unmountedRef = useRef(false);

  const registerListener = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const dispatchEvent = useCallback((eventData, source = 'http') => {
    if (!eventData || !eventData.type) return;
    setLastEvent(eventData);

    listenersRef.current.forEach(cb => {
      try {
        cb(eventData);
      } catch (e) {
        console.error('Telemetry listener error:', e);
      }
    });

    // Cross-tab synchronization via BroadcastChannel (0ms sync across local tabs)
    if (source === 'http' && broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(eventData);
      } catch {}
    }
  }, []);

  // Broadcast an event locally across all open tabs without waiting for server roundtrip
  const broadcastLocalEvent = useCallback((eventType, payload) => {
    const eventObj = {
      type: eventType,
      data: payload,
      local: true,
      timestamp: new Date().toISOString()
    };
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
        console.warn('BroadcastChannel not supported or blocked:', err);
      }
    }
  }, [dispatchEvent]);

  // Intelligent HTTP Event Polling Engine
  const executePoll = useCallback(async () => {
    if (unmountedRef.current || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const storedUser = getUserData();
      const effectiveTeam = teamId || storedUser?.team_id || null;

      const res = await api.telemetry.poll(lastEventIdRef.current, effectiveTeam);

      if (unmountedRef.current) return;

      setIsConnected(true);
      retryCountRef.current = 0;

      if (res && typeof res.last_event_id === 'number') {
        if (lastEventIdRef.current === null) {
          // Initial sync: capture the baseline event ID without replaying historical events
          lastEventIdRef.current = res.last_event_id;
        } else if (res.last_event_id < lastEventIdRef.current) {
          // Server restarted or counter reset: re-align ID
          lastEventIdRef.current = res.last_event_id;
        } else {
          lastEventIdRef.current = res.last_event_id;
        }
      }

      // Dispatch pending events sequentially
      if (res && Array.isArray(res.events) && res.events.length > 0) {
        res.events.forEach(ev => {
          dispatchEvent(ev, 'http');
        });
      }
    } catch (err) {
      if (unmountedRef.current) return;
      // Mark disconnected if unreachable
      setIsConnected(false);
      retryCountRef.current++;
    } finally {
      isPollingRef.current = false;
      if (!unmountedRef.current) {
        // Adaptive delay: 2.5s when active, 6s when tab is backgrounded, 1.5s on rapid retry
        const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        let delay = 2500;
        if (retryCountRef.current > 0) {
          delay = Math.min(1200 * Math.pow(1.3, Math.min(retryCountRef.current, 4)), 5000);
        } else if (isHidden) {
          delay = 6000;
        }

        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = setTimeout(executePoll, delay);
      }
    }
  }, [teamId, dispatchEvent]);

  // Manual reconnect / sync trigger
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    executePoll();
  }, [executePoll]);

  // Lifecycle & event listeners
  useEffect(() => {
    unmountedRef.current = false;

    // Start initial poll immediately
    executePoll();

    // Trigger immediate poll on tab focus, visibility return, or network reconnect
    const handleReactivate = () => {
      retryCountRef.current = 0;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      executePoll();
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
      unmountedRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      window.removeEventListener('focus', handleReactivate);
      window.removeEventListener('online', handleReactivate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executePoll]);

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
