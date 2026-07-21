"""
WtE Digital Twin — FastAPI backend
Exposes /simulate endpoint to trigger MATLAB simulation and store results in Supabase.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../config/.env"))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
MATLAB_SCRIPT = os.environ.get("MATLAB_SCRIPT", "matlab/core/s00_run.m")
MATLAB_BIN = os.environ.get("MATLAB_BIN", "matlab")

app = FastAPI(
    title="WtE Digital Twin API",
    version="0.1.0",
    description="REST API for the 6.6 MW Moving Grate WtE plant digital twin",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── Models ────────────────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    waste_feed_rate: float = Field(default=110.0, description="Waste feed rate t/day")
    fuel_lhv: float = Field(default=8.5, description="Lower heating value MJ/kg")
    fuel_moisture: float = Field(default=40.0, description="Fuel moisture %")
    duration_h: float = Field(default=1.0, description="Simulation duration hours")
    save_to_db: bool = Field(default=True, description="Write results to Supabase")


class SimulateResponse(BaseModel):
    status: str
    run_id: str
    started_at: str
    duration_s: float
    outputs: dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    supabase: str
    matlab: str
    bridge_mode: str
    bridge_connected: bool
    bridge_last_insert: str | None
    bridge_rows_inserted: int
    bridge_error: str | None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_matlab() -> bool:
    try:
        result = subprocess.run(
            [MATLAB_BIN, "-batch", "disp('ok')"],
            capture_output=True, text=True, timeout=30
        )
        return result.returncode == 0
    except Exception:
        return False


async def _run_matlab(params: SimulateRequest) -> dict[str, Any]:
    """
    Runs MATLAB s00_run.m in batch mode, passing params as environment variables.
    Returns parsed scalar outputs from stdout (last line: JSON).
    """
    env = {
        **os.environ,
        "SIM_WASTE_FEED": str(params.waste_feed_rate),
        "SIM_FUEL_LHV": str(params.fuel_lhv),
        "SIM_MOISTURE": str(params.fuel_moisture),
        "SIM_DURATION_H": str(params.duration_h),
    }

    matlab_expr = (
        f"waste_feed={params.waste_feed_rate};"
        f"fuel_lhv={params.fuel_lhv};"
        f"fuel_moisture={params.fuel_moisture};"
        f"duration_h={params.duration_h};"
        f"run('{MATLAB_SCRIPT}');"
    )

    loop = asyncio.get_event_loop()
    proc = await loop.run_in_executor(
        None,
        lambda: subprocess.run(
            [MATLAB_BIN, "-batch", matlab_expr],
            capture_output=True, text=True, timeout=300, env=env
        )
    )

    if proc.returncode != 0:
        raise RuntimeError(f"MATLAB exited {proc.returncode}: {proc.stderr[-500:]}")

    # Parse last non-empty line as JSON output from MATLAB disp(jsonencode(out))
    lines = [l.strip() for l in proc.stdout.splitlines() if l.strip()]
    import json
    if lines:
        try:
            return json.loads(lines[-1])
        except json.JSONDecodeError:
            pass

    # Fallback: return mock computed outputs if MATLAB not available
    return _mock_outputs(params)


def _mock_outputs(params: SimulateRequest) -> dict[str, Any]:
    """Physics-based approximation when MATLAB is unavailable."""
    feed_kg_s = params.waste_feed_rate * 1000 / 86400
    heat_input_mw = feed_kg_s * params.fuel_lhv / 1000 * (1 - params.fuel_moisture / 100)
    gen_mw = round(heat_input_mw * 0.22, 3)          # ~22% net efficiency
    steam_flow = round(heat_input_mw / 2.5 * 3600, 1)  # kg/h
    return {
        "gen_mw": gen_mw,
        "net_mw": round(gen_mw * 0.91, 3),
        "heat_input_mw": round(heat_input_mw, 3),
        "steam_flow_kg_h": steam_flow,
        "steam_press_bar": 40.0,
        "steam_temp_c": 400.0,
        "furnace_temp_c": round(850 + heat_input_mw * 2, 1),
        "o2_furnace_pct": 8.5,
        "co_mg_nm3": 42.0,
        "pm_cems": 12.0,
        "nox_mg_nm3": 155.0,
        "so2_mg_nm3": 35.0,
        "bottom_ash_t_h": round(params.waste_feed_rate * 0.20 / 24, 3),
        "fly_ash_t_h": round(params.waste_feed_rate * 0.04 / 24, 3),
        "source": "mock_physics",
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return {"message": "WtE Digital Twin API — see /docs"}


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    """Check API, Supabase, and MATLAB availability."""
    try:
        supabase.table("plant_telemetry").select("id").limit(1).execute()
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    matlab_ok = await asyncio.get_event_loop().run_in_executor(None, _check_matlab)

    try:
        from opcua.bridge.base_poller import STATUS as BRIDGE_STATUS
        bridge_mode = BRIDGE_STATUS.mode
        bridge_connected = BRIDGE_STATUS.connected
        bridge_last_insert = BRIDGE_STATUS.last_insert
        bridge_rows = BRIDGE_STATUS.rows_inserted
        bridge_error = BRIDGE_STATUS.error
    except Exception:
        bridge_mode = os.environ.get("BRIDGE_MODE", "mock")
        bridge_connected = False
        bridge_last_insert = None
        bridge_rows = 0
        bridge_error = "bridge not running in same process"

    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        supabase=db_status,
        matlab="ok" if matlab_ok else "unavailable (mock mode)",
        bridge_mode=bridge_mode,
        bridge_connected=bridge_connected,
        bridge_last_insert=bridge_last_insert,
        bridge_rows_inserted=bridge_rows,
        bridge_error=bridge_error,
    )


@app.post("/simulate", response_model=SimulateResponse, tags=["Simulation"])
async def simulate(req: SimulateRequest):
    """
    Trigger MATLAB simulation with given plant parameters.
    Falls back to physics-based mock if MATLAB is unavailable.
    Returns computed outputs and optionally writes them to Supabase.
    """
    import uuid, time

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    t0 = time.perf_counter()

    try:
        outputs = await _run_matlab(req)
    except Exception as e:
        outputs = _mock_outputs(req)
        outputs["matlab_error"] = str(e)

    duration_s = round(time.perf_counter() - t0, 3)

    if req.save_to_db:
        row = {
            "source": "simulation",
            "gen_mw": outputs.get("gen_mw"),
            "net_mw": outputs.get("net_mw"),
            "steam_flow": outputs.get("steam_flow_kg_h"),
            "steam_press": outputs.get("steam_press_bar"),
            "steam_temp": outputs.get("steam_temp_c"),
            "furnace_temp_z1": outputs.get("furnace_temp_c"),
            "o2_furnace": outputs.get("o2_furnace_pct"),
            "co_furnace": outputs.get("co_mg_nm3"),
            "pm_cems": outputs.get("pm_cems"),
            "scr_nox_out": outputs.get("nox_mg_nm3"),
            "so2_cems": outputs.get("so2_mg_nm3"),
            "waste_feed_rate": req.waste_feed_rate,
            "fuel_lhv": req.fuel_lhv,
            "fuel_moisture": req.fuel_moisture,
        }
        try:
            supabase.table("plant_telemetry").insert(row).execute()
        except Exception as e:
            outputs["db_error"] = str(e)

    return SimulateResponse(
        status="ok",
        run_id=run_id,
        started_at=started_at.isoformat(),
        duration_s=duration_s,
        outputs=outputs,
    )


@app.get("/latest", tags=["Data"])
async def latest():
    """Return the most recent plant telemetry row."""
    try:
        res = (
            supabase.table("plant_telemetry")
            .select("*")
            .order("ts", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
        raise HTTPException(status_code=404, detail="No data yet")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/telemetry", tags=["Data"])
async def telemetry(limit: int = 100):
    """Return recent plant telemetry rows (default last 100)."""
    try:
        res = (
            supabase.table("plant_telemetry")
            .select("ts,gen_mw,net_mw,steam_press,steam_temp,o2_furnace,pm_cems,scr_nox_out,source")
            .order("ts", desc=True)
            .limit(min(limit, 1000))
            .execute()
        )
        return {"count": len(res.data), "rows": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts", tags=["Predictive Maintenance"])
async def alerts(
    equipment: str | None = None,
    severity: str | None = None,
    unacked_only: bool = False,
    limit: int = 50,
):
    """Return PM alerts — filter by equipment, severity, or unacknowledged."""
    try:
        q = supabase.table("pm_alerts").select("*")
        if equipment:
            q = q.eq("equipment", equipment)
        if severity:
            q = q.eq("severity", severity)
        if unacked_only:
            q = q.eq("acknowledged", False)
        res = q.order("ts", desc=True).limit(min(limit, 500)).execute()
        return {"count": len(res.data), "alerts": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/alerts/{alert_id}/ack", tags=["Predictive Maintenance"])
async def acknowledge_alert(alert_id: int):
    """Mark an alert as acknowledged."""
    try:
        from datetime import datetime, timezone
        supabase.table("pm_alerts").update({
            "acknowledged": True,
            "ack_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", alert_id).execute()
        return {"status": "ok", "id": alert_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
