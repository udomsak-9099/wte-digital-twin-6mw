"""
OpcuaPoller — production bridge for Emerson Ovation DCS via OPC-UA.
Used when BRIDGE_MODE=live in config/.env

Reads tag_mapping.yaml for node IDs.
Auto-reconnects on disconnect with exponential backoff.
"""

from __future__ import annotations
import asyncio
import os
import yaml
from asyncua import Client
from opcua.bridge.base_poller import BasePoller, STATUS, log

TAG_MAP_PATH = os.path.join(os.path.dirname(__file__), "../config/tag_mapping.yaml")
OPC_ENDPOINT  = os.environ.get("OPC_ENDPOINT",  "opc.tcp://192.168.1.100:4840")
OPC_NAMESPACE = int(os.environ.get("OPC_NAMESPACE", "2"))
OPC_USERNAME  = os.environ.get("OPC_USERNAME", "")
OPC_PASSWORD  = os.environ.get("OPC_PASSWORD", "")


def _load_tags() -> dict[str, str]:
    with open(TAG_MAP_PATH) as f:
        cfg = yaml.safe_load(f)
    return {t["alias"].lower(): t["node_id"] for t in cfg.get("tags", [])}


class OpcuaPoller(BasePoller):

    def __init__(self):
        super().__init__()
        self._client: Client | None = None
        self._tags: dict[str, str] = _load_tags()
        log.info(f"[OpcuaPoller] Loaded {len(self._tags)} tags from tag_mapping.yaml")

    async def connect(self) -> None:
        STATUS.mode = "live"
        self._client = Client(url=OPC_ENDPOINT)
        if OPC_USERNAME:
            self._client.set_user(OPC_USERNAME)
            self._client.set_password(OPC_PASSWORD)
        await self._client.connect()
        log.info(f"[OpcuaPoller] Connected to {OPC_ENDPOINT}")

    async def disconnect(self) -> None:
        if self._client:
            try:
                await self._client.disconnect()
            except Exception:
                pass
            self._client = None

    async def read_once(self) -> dict:
        row: dict = {}
        if not self._client:
            raise RuntimeError("Not connected")

        for alias, node_id in self._tags.items():
            try:
                node = self._client.get_node(node_id)
                val  = await node.read_value()
                row[alias] = round(float(val), 4) if val is not None else None
            except Exception as e:
                row[alias] = None
                log.warning(f"  [WARN] {alias} ({node_id}): {e}")

        return row
