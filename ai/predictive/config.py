"""
Predictive Maintenance configuration.
Defines which signals to monitor per equipment and alert thresholds.
"""

from __future__ import annotations

# Sliding window length (number of 5-second samples)
WINDOW_SIZE = 60          # 5 min of history
STEP_SIZE   = 12          # evaluate every 1 min
FORECAST_HORIZON = 12     # predict 1 min ahead

# LSTM architecture
HIDDEN_SIZE  = 64
NUM_LAYERS   = 2
DROPOUT      = 0.2
BATCH_SIZE   = 32
EPOCHS       = 50
LEARNING_RATE = 1e-3

# Anomaly alert threshold (reconstruction error z-score)
ALERT_Z_SCORE = 3.0      # > 3σ = anomaly
WARN_Z_SCORE  = 2.0      # > 2σ = warning

# ── Equipment definitions ──────────────────────────────────────────────────────
# Each equipment has:
#   signals   : DB columns to monitor (must exist in plant_telemetry)
#   limits    : hard engineering limits for sanity check
#   model_path: where to save/load the trained model

EQUIPMENT: dict[str, dict] = {

    "turbine": {
        "label": "Steam Turbine",
        "signals": [
            "turbine_speed",       # RPM  — normal ~3000
            "steam_press",         # bar  — turbine inlet pressure proxy
            "steam_temp",          # °C   — turbine inlet temp proxy
            "condenser_press",     # bar  — normal ~0.075–0.085
            "hotwell_level",       # %    — normal 45–65
            "cw_in_temp",          # °C   — normal 28–36
            "cw_out_temp",         # °C   — normal 38–46
            "gen_mw",              # MW   — normal 5.5–6.6
        ],
        "limits": {
            "turbine_speed":   (2700, 3300),
            "condenser_press": (0.04, 0.15),
            "hotwell_level":   (20, 90),
        },
        "alert_rules": {
            "turbine_speed":   {"min": 2850, "max": 3150, "severity": "critical"},
            "condenser_press": {"min": 0.06, "max": 0.12, "severity": "warning"},
        },
        "model_path": "ai/predictive/models/turbine_lstm.pt",
    },

    "boiler": {
        "label": "Boiler",
        "signals": [
            "drum_level",          # %    — normal 45–55 (tight control)
            "steam_press",         # bar  — normal 38–41
            "steam_temp",          # °C   — normal 390–405
            "steam_flow",          # t/h  — normal 24–32
            "fw_flow",             # t/h  — tracks steam_flow
            "fw_temp",             # °C   — normal 100–115
            "eco_out_temp",        # °C   — normal 200–220
            "o2_furnace",          # vol% — normal 6–11
        ],
        "limits": {
            "drum_level":  (10, 90),
            "steam_press": (30, 45),
            "steam_temp":  (350, 430),
        },
        "alert_rules": {
            "drum_level":  {"min": 30, "max": 70, "severity": "critical"},
            "steam_press": {"min": 35, "max": 42, "severity": "warning"},
            "o2_furnace":  {"min": 5,  "max": 13, "severity": "warning"},
        },
        "model_path": "ai/predictive/models/boiler_lstm.pt",
    },

    "transformer": {
        "label": "GSU Transformer",
        "signals": [
            "gen_voltage",         # kV   — normal 10.8–11.2
            "gen_mw",              # MW   — affects transformer load
            "gen_mvar",            # MVAr — reactive power
            "gen_pf",              # p.f. — normal 0.85–1.0
            "aux_mw",              # MW   — auxiliary consumption
        ],
        "limits": {
            "gen_voltage": (10.0, 12.0),
            "gen_pf":      (0.7, 1.0),
        },
        "alert_rules": {
            "gen_voltage": {"min": 10.5, "max": 11.5, "severity": "warning"},
            "gen_pf":      {"min": 0.80, "severity": "warning"},
        },
        "model_path": "ai/predictive/models/transformer_lstm.pt",
    },
}

# Supabase table for PM alerts
PM_ALERTS_TABLE = "pm_alerts"
