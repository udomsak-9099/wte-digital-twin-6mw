"""
opcua_poller.py — Ovation OPC-UA → Supabase bridge
Polls Ovation DCS tags and writes to Supabase time-series table.

Requirements:
    pip install asyncua supabase python-dotenv pyyaml
"""

import asyncio
import yaml
import os
from datetime import datetime, timezone
from asyncua import Client
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
OPC_ENDPOINT = os.environ.get("OPC_ENDPOINT", "opc.tcp://192.168.1.100:4840")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_S", "5"))

with open("../config/tag_mapping.yaml") as f:
    tag_config = yaml.safe_load(f)

TAGS = {t["alias"]: t["node_id"] for t in tag_config["tags"]}

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


async def poll_once(client: Client) -> dict:
    row = {"ts": datetime.now(timezone.utc).isoformat()}
    for alias, node_id in TAGS.items():
        try:
            node = client.get_node(node_id)
            val = await node.read_value()
            row[alias.lower()] = float(val) if val is not None else None
        except Exception as e:
            row[alias.lower()] = None
            print(f"  [WARN] {alias}: {e}")
    return row


async def main():
    print(f"[opcua_poller] Connecting to {OPC_ENDPOINT}")
    async with Client(url=OPC_ENDPOINT) as client:
        print("[opcua_poller] Connected. Starting poll loop...")
        while True:
            row = await poll_once(client)
            try:
                supabase.table("plant_telemetry").insert(row).execute()
                print(f"[{row['ts']}] GEN_MW={row.get('gen_mw')} STEAM_PRESS={row.get('steam_press')}")
            except Exception as e:
                print(f"[ERROR] Supabase insert: {e}")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
