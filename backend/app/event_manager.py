import asyncio
import time
import logging
from collections import deque
from typing import Dict, List, Optional, Any

logger = logging.getLogger("cloudnex.telemetry")


class EventManager:
    """
    Lightweight, high-performance in-memory event manager for real-time race telemetry.
    Replaces WebSockets with resilient, proxy-friendly HTTP polling and event streaming.
    """
    def __init__(self, max_history: int = 500):
        self._max_history = max_history
        self._events: deque = deque(maxlen=max_history)
        self._event_counter: int = 0
        self._lock = asyncio.Lock()
        # Track active team heartbeats: team_id -> timestamp of last poll
        self._team_heartbeats: Dict[str, float] = {}

    def _next_event_id(self) -> int:
        self._event_counter += 1
        return self._event_counter

    async def broadcast(self, event_type: str, payload: dict):
        """Append a broadcast event for all connected clients (participants & admins)."""
        event = {
            "id": self._next_event_id(),
            "type": event_type,
            "data": payload,
            "target_team_id": None,
            "timestamp": time.time()
        }
        self._events.append(event)
        logger.debug(f"Telemetry broadcast: {event_type} (ID: {event['id']})")
        return event

    async def send_team_message(self, team_id: str, event_type: str, payload: dict):
        """Append a targeted event specifically for a single team."""
        clean_team_id = str(team_id).strip().upper() if team_id else None
        event = {
            "id": self._next_event_id(),
            "type": event_type,
            "data": payload,
            "target_team_id": clean_team_id,
            "timestamp": time.time()
        }
        self._events.append(event)
        logger.debug(f"Telemetry team message for {clean_team_id}: {event_type} (ID: {event['id']})")
        return event

    async def close_team_connections(self, team_id: str, reason: str = "LOGGED_IN_ON_ANOTHER_DEVICE"):
        """Terminate team session by queuing a FORCE_LOGOUT event and removing active heartbeat."""
        clean_team_id = str(team_id).strip().upper() if team_id else None
        if clean_team_id and clean_team_id in self._team_heartbeats:
            del self._team_heartbeats[clean_team_id]
        await self.send_team_message(clean_team_id, "FORCE_LOGOUT", {"reason": reason})

    def record_heartbeat(self, team_id: Optional[str] = None):
        """Records client activity/heartbeat to track online teams via HTTP polling."""
        if team_id:
            clean_id = str(team_id).strip().upper()
            self._team_heartbeats[clean_id] = time.time()

    def is_team_online(self, team_id: Optional[str], timeout_seconds: float = 15.0) -> bool:
        """Checks if a team has polled within the last timeout_seconds."""
        if not team_id:
            return False
        clean_id = str(team_id).strip().upper()
        last_seen = self._team_heartbeats.get(clean_id)
        if not last_seen:
            return False
        return (time.time() - last_seen) < timeout_seconds

    @property
    def team_connections(self) -> Dict[str, List[Any]]:
        """Backwards compatibility property for existing code checking team connection status."""
        now = time.time()
        active = {}
        for t_id, last_seen in list(self._team_heartbeats.items()):
            if (now - last_seen) < 15.0:
                active[t_id] = [True]
        return active

    def get_events(self, since_id: Optional[int] = None, team_id: Optional[str] = None, max_events: int = 100) -> List[dict]:
        """
        Fetch all events since since_id that are public or targeted to team_id.
        If since_id is None (initial handshake), returns empty list while client captures baseline event ID.
        If since_id >= 0, returns all events strictly greater than since_id.
        """
        clean_team_id = str(team_id).strip().upper() if team_id else None

        # Initial baseline sync (no since_id provided) or server restart where client id exceeds current counter
        if since_id is None or since_id < 0 or since_id > self._event_counter:
            return []

        # Return all events with id > since_id for public or matching team
        eligible = [
            e for e in self._events
            if e["id"] > since_id and (e["target_team_id"] is None or e["target_team_id"] == clean_team_id)
        ]
        return eligible[:max_events]

    def get_latest_event_id(self) -> int:
        return self._event_counter

    # Legacy no-op methods for safety
    async def connect(self, websocket=None, team_id=None):
        if team_id:
            self.record_heartbeat(team_id)

    def disconnect(self, websocket=None, team_id=None):
        pass


event_manager = EventManager()
# Alias for backwards compatibility
ws_manager = event_manager

