"""
Real-time event manager compatibility layer.
WebSockets have been replaced with HTTP event streaming and adaptive polling.
This module re-exports EventManager as ws_manager for backwards compatibility.
"""
from app.event_manager import EventManager, event_manager, ws_manager

__all__ = ["EventManager", "event_manager", "ws_manager"]
