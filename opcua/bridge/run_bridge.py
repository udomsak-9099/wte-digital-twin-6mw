"""
run_bridge.py — single entry point for all bridge modes.

Usage:
  BRIDGE_MODE=mock uv run python opcua/bridge/run_bridge.py   ← dev / before Ovation ready
  BRIDGE_MODE=live uv run python opcua/bridge/run_bridge.py   ← production (Ovation connected)

BRIDGE_MODE defaults to "mock" if not set.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from opcua.bridge.base_poller import BRIDGE_MODE, STATUS, log


async def main():
    log.info(f"Bridge starting — mode={BRIDGE_MODE.upper()}")

    if BRIDGE_MODE == "live":
        from opcua.bridge.opcua_poller_v2 import OpcuaPoller
        poller = OpcuaPoller()
    else:
        from opcua.bridge.mock_poller import MockPoller
        poller = MockPoller()

    await poller.run()


if __name__ == "__main__":
    asyncio.run(main())
