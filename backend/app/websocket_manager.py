import asyncio
import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger("cloudnex.websocket")

class ConnectionManager:
    def __init__(self):
        # Active connections: list of WebSocket objects
        self.active_connections: List[WebSocket] = []
        # Map user or team_id to websockets
        self.team_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, team_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if team_id:
            if team_id not in self.team_connections:
                self.team_connections[team_id] = []
            self.team_connections[team_id].append(websocket)
        logger.info(f"WebSocket connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, team_id: Optional[str] = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if team_id and team_id in self.team_connections:
            if websocket in self.team_connections[team_id]:
                self.team_connections[team_id].remove(websocket)
            if not self.team_connections[team_id]:
                del self.team_connections[team_id]
        logger.info(f"WebSocket disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, payload: dict):
        """Broadcast message to all connected clients (participants & admins) concurrently."""
        if not self.active_connections:
            return

        message = json.dumps({
            "type": event_type,
            "data": payload
        })

        async def _safe_send(ws: WebSocket):
            try:
                await ws.send_text(message)
                return None
            except Exception:
                return ws

        # Broadcast in parallel to all active sockets with zero serialization latency
        results = await asyncio.gather(*[_safe_send(conn) for conn in list(self.active_connections)], return_exceptions=True)
        dead = [ws for ws in results if isinstance(ws, WebSocket)]
        for dead_conn in dead:
            if dead_conn in self.active_connections:
                self.active_connections.remove(dead_conn)

    async def send_team_message(self, team_id: str, event_type: str, payload: dict):
        """Send message specifically to a team concurrently."""
        if team_id not in self.team_connections or not self.team_connections[team_id]:
            return

        message = json.dumps({
            "type": event_type,
            "data": payload
        })

        async def _safe_send(ws: WebSocket):
            try:
                await ws.send_text(message)
                return None
            except Exception:
                return ws

        results = await asyncio.gather(*[_safe_send(conn) for conn in list(self.team_connections[team_id])], return_exceptions=True)
        dead = [ws for ws in results if isinstance(ws, WebSocket)]
        for dead_conn in dead:
            if dead_conn in self.team_connections[team_id]:
                self.team_connections[team_id].remove(dead_conn)

    async def close_team_connections(self, team_id: str, reason: str = "LOGGED_IN_ON_ANOTHER_DEVICE"):
        """Close and terminate all active websocket connections for a team."""
        if team_id not in self.team_connections or not self.team_connections[team_id]:
            return

        conns = list(self.team_connections[team_id])
        self.team_connections[team_id] = []
        for ws in conns:
            if ws in self.active_connections:
                self.active_connections.remove(ws)
            try:
                await ws.close(code=4001, reason=reason)
            except Exception:
                pass

ws_manager = ConnectionManager()
