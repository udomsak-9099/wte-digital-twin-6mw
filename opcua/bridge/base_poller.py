"""
Abstract base for all pollers — MockPoller and OpcuaPoller share this interface.
Switch between them with BRIDGE_MODE=mock|live in config/.env
"""

from __future__ import annotations
import asyncio
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../config/.env"))

log = logging.getLogger("bridge")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_S", "5"))
BRIDGE_MODE = os.environ.get("BRIDGE_MODE", "mock").lower()   # "mock" or "live"


class BridgeStatus:
    """Shared connection state — readable by FastAPI /health."""
    mode: str = BRIDGE_MODE
    connected: bool = False
    last_insert: str | None = None
    error: str | None = None
    rows_inserted: int = 0


STATUS = BridgeStatus()


class BasePoller(ABC):
    """All pollers must implement `read_once()` → dict of DB column values."""

    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to data source."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Cleanly close connection."""

    @abstractmethod
    async def read_once(self) -> dict:
        """Read one snapshot of all signals. Returns DB column dict."""

    async def run(self) -> None:
        """Main loop — connect, poll forever, auto-reconnect on failure."""
        RETRY_DELAY = 10  # seconds between reconnect attempts
        while True:
            try:
                log.info(f"[{BRIDGE_MODE.upper()}] Connecting...")
                await self.connect()
                STATUS.connected = True
                STATUS.error = None
                log.info(f"[{BRIDGE_MODE.upper()}] Connected. Polling every {POLL_INTERVAL}s")

                while True:
                    row = await self.read_once()
                    row["source"] = BRIDGE_MODE
                    row.setdefault("created_at", datetime.now(timezone.utc).isoformat())

                    try:
                        self.supabase.table("plant_telemetry").insert(row).execute()
                        STATUS.last_insert = row["created_at"]
                        STATUS.rows_inserted += 1
                        log.info(
                            f"✓ gen_mw={row.get('gen_mw','?')} "
                            f"steam_press={row.get('steam_press','?')} "
                            f"[row #{STATUS.rows_inserted}]"
                        )
                    except Exception as e:
                        log.error(f"Supabase insert error: {e}")
                        STATUS.error = str(e)

                    await asyncio.sleep(POLL_INTERVAL)

            except asyncio.CancelledError:
                break
            except Exception as e:
                STATUS.connected = False
                STATUS.error = str(e)
                log.error(f"Connection error: {e} — retrying in {RETRY_DELAY}s")
                try:
                    await self.disconnect()
                except Exception:
                    pass
                await asyncio.sleep(RETRY_DELAY)


def get_poller() -> BasePoller:
    """Factory — returns the right poller based on BRIDGE_MODE."""
    if BRIDGE_MODE == "live":
        from opcua.bridge.opcua_poller_v2 import OpcuaPoller
        return OpcuaPoller()
    else:
        from opcua.bridge.mock_poller import MockPoller
        return MockPoller()
