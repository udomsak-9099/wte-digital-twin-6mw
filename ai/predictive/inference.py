"""
Real-time PM inference — runs every minute, scores each equipment,
writes alerts to Supabase pm_alerts table.
"""

from __future__ import annotations
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import numpy as np
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="config/.env")
log = logging.getLogger("pm.inference")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from ai.predictive.config import (
    EQUIPMENT, WINDOW_SIZE, ALERT_Z_SCORE, WARN_Z_SCORE, PM_ALERTS_TABLE
)
from ai.predictive.feature_eng import fetch_telemetry, Scaler
from ai.predictive.model import load_model, TORCH_AVAILABLE, FallbackStatModel

EVAL_INTERVAL = 60   # seconds between evaluations


class PMEngine:
    """Loads models and scores each equipment in real-time."""

    def __init__(self, supabase):
        self.supabase = supabase
        self.models: dict = {}
        self.scalers: dict = {}
        self.baselines: dict = {}   # (mean, std) of training errors per equipment

    def load_all_models(self):
        for name, cfg in EQUIPMENT.items():
            path = cfg["model_path"]
            pkl  = path.replace(".pt", ".pkl")
            actual_path = pkl if (not os.path.exists(path) and os.path.exists(pkl)) else path
            model, scaler = load_model(actual_path)
            if model is None:
                log.warning(f"[{name}] No trained model found at {actual_path} — using stat fallback")
                model  = FallbackStatModel()
                scaler = Scaler()
            self.models[name]  = model
            self.scalers[name] = scaler
            log.info(f"[{name}] Model loaded ({'LSTM' if TORCH_AVAILABLE and not isinstance(model, FallbackStatModel) else 'StatFallback'})")

    def _score(self, name: str, arr: np.ndarray) -> float:
        """Return reconstruction error for latest window."""
        model  = self.models[name]
        if isinstance(model, FallbackStatModel):
            errors = model.reconstruction_errors(arr[-WINDOW_SIZE:])
            return float(errors.mean())

        import torch
        with torch.no_grad():
            x    = torch.tensor(arr[-WINDOW_SIZE:]).unsqueeze(0)  # (1, W, F)
            pred = model(x).numpy()
            err  = float(((x.numpy() - pred) ** 2).mean())
        return err

    def _z_score(self, name: str, error: float) -> float:
        mean, std = self.baselines.get(name, (error, 1e-4))
        return (error - mean) / std

    def _update_baseline(self, name: str, error: float):
        if name not in self.baselines:
            self.baselines[name] = (error, 1e-4)
        mean, std = self.baselines[name]
        mean = 0.99 * mean + 0.01 * error
        std  = max(0.99 * std + 0.01 * abs(error - mean), 1e-6)
        self.baselines[name] = (mean, std)

    def _check_hard_limits(self, name: str, df) -> list[dict]:
        """Check engineering hard limits — no model needed."""
        alerts = []
        cfg    = EQUIPMENT[name]
        ts     = datetime.now(timezone.utc).isoformat()
        latest = df.iloc[-1]

        for signal, rule in cfg.get("alert_rules", {}).items():
            val = float(latest.get(signal, 0) or 0)
            triggered = False
            msg = ""
            if "min" in rule and val < rule["min"]:
                triggered = True
                msg = f"{signal}={val:.2f} < min {rule['min']}"
            if "max" in rule and val > rule["max"]:
                triggered = True
                msg = f"{signal}={val:.2f} > max {rule['max']}"
            if triggered:
                alerts.append({
                    "equipment": name,
                    "signal": signal,
                    "value": val,
                    "severity": rule["severity"],
                    "type": "limit",
                    "message": msg,
                    "created_at": ts,
                })
        return alerts

    async def evaluate_all(self):
        alerts_to_insert = []
        ts = datetime.now(timezone.utc).isoformat()

        for name, cfg in EQUIPMENT.items():
            signals = cfg["signals"]
            df = fetch_telemetry(self.supabase, signals, limit=WINDOW_SIZE + 20)

            if len(df) < WINDOW_SIZE:
                log.info(f"[{name}] Not enough data yet ({len(df)}/{WINDOW_SIZE})")
                continue

            scaler = self.scalers[name]
            if not scaler.min_:
                scaler.fit(df, signals)

            arr   = scaler.transform(df, signals)
            error = self._score(name, arr)
            self._update_baseline(name, error)
            z     = self._z_score(name, error)

            log.info(f"[{name}] reconstruction_error={error:.6f}  z={z:.2f}")

            # LSTM anomaly alert
            if abs(z) >= ALERT_Z_SCORE:
                alerts_to_insert.append({
                    "equipment": name,
                    "signal": "multivariate",
                    "value": round(error, 6),
                    "severity": "critical",
                    "type": "lstm_anomaly",
                    "message": f"Anomaly detected z={z:.2f} (threshold {ALERT_Z_SCORE})",
                    "created_at": ts,
                })
            elif abs(z) >= WARN_Z_SCORE:
                alerts_to_insert.append({
                    "equipment": name,
                    "signal": "multivariate",
                    "value": round(error, 6),
                    "severity": "warning",
                    "type": "lstm_anomaly",
                    "message": f"Unusual pattern z={z:.2f} (warn threshold {WARN_Z_SCORE})",
                    "created_at": ts,
                })

            # Hard limit checks
            alerts_to_insert.extend(self._check_hard_limits(name, df))

        if alerts_to_insert:
            try:
                self.supabase.table(PM_ALERTS_TABLE).insert(alerts_to_insert).execute()
                for a in alerts_to_insert:
                    log.warning(f"🚨 [{a['equipment'].upper()}] {a['severity'].upper()}: {a['message']}")
            except Exception as e:
                log.error(f"Supabase insert error: {e}")

    async def run(self):
        self.load_all_models()
        log.info(f"PM engine running — evaluating every {EVAL_INTERVAL}s")
        while True:
            try:
                await self.evaluate_all()
            except Exception as e:
                log.error(f"Evaluation error: {e}")
            await asyncio.sleep(EVAL_INTERVAL)


if __name__ == "__main__":
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )
    engine = PMEngine(supabase)
    asyncio.run(engine.run())
