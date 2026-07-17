"""
Train LSTM autoencoder for each equipment.
Fetches historical telemetry from Supabase, trains, saves model.

Usage:
  uv run python ai/predictive/train.py --equipment turbine
  uv run python ai/predictive/train.py --equipment boiler
  uv run python ai/predictive/train.py --equipment transformer
  uv run python ai/predictive/train.py --all
"""

from __future__ import annotations
import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import numpy as np
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="config/.env")
log = logging.getLogger("pm.train")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from ai.predictive.config import EQUIPMENT, WINDOW_SIZE, FORECAST_HORIZON, EPOCHS, BATCH_SIZE, LEARNING_RATE
from ai.predictive.feature_eng import fetch_telemetry, Scaler, make_windows
from ai.predictive.model import TORCH_AVAILABLE, FallbackStatModel, save_model

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    from ai.predictive.model import LSTMAutoEncoder
except ImportError:
    pass


def train_equipment(name: str, supabase):
    cfg     = EQUIPMENT[name]
    signals = cfg["signals"]
    path    = cfg["model_path"]

    log.info(f"[{name}] Fetching telemetry ({len(signals)} signals)...")
    df = fetch_telemetry(supabase, signals, limit=5000)

    if len(df) < WINDOW_SIZE * 3:
        log.warning(f"[{name}] Not enough data ({len(df)} rows). Need ≥ {WINDOW_SIZE * 3}. Skipping.")
        return

    log.info(f"[{name}] {len(df)} rows fetched")

    scaler = Scaler()
    arr    = scaler.fit_transform(df, signals)
    X, _   = make_windows(arr, WINDOW_SIZE, FORECAST_HORIZON)

    log.info(f"[{name}] Windows: {X.shape}")

    if TORCH_AVAILABLE:
        _train_lstm(name, X, signals, scaler, path)
    else:
        log.warning("[WARN] PyTorch not available — training fallback stat model")
        model = FallbackStatModel()
        model.reconstruction_errors(arr)        # warm-up pass
        save_model(model, scaler, path.replace(".pt", ".pkl"))
        log.info(f"[{name}] Fallback model saved to {path.replace('.pt', '.pkl')}")


def _train_lstm(name, X, signals, scaler, path):
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    from ai.predictive.model import LSTMAutoEncoder

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info(f"[{name}] Training LSTM on {device} — {EPOCHS} epochs")

    n_features = X.shape[2]
    model = LSTMAutoEncoder(n_features=n_features).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.MSELoss()

    tensor_X = torch.tensor(X)
    loader   = DataLoader(TensorDataset(tensor_X, tensor_X), batch_size=BATCH_SIZE, shuffle=True)

    best_loss = float("inf")
    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        avg = total_loss / len(loader)
        if epoch % 10 == 0 or epoch == 1:
            log.info(f"[{name}] Epoch {epoch:3d}/{EPOCHS}  loss={avg:.6f}")
        if avg < best_loss:
            best_loss = avg

    save_model(model, scaler, path)
    log.info(f"[{name}] Model saved → {path}  (best loss={best_loss:.6f})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--equipment", choices=list(EQUIPMENT.keys()))
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    targets = list(EQUIPMENT.keys()) if args.all else ([args.equipment] if args.equipment else [])
    if not targets:
        parser.print_help()
        return

    for name in targets:
        train_equipment(name, supabase)


if __name__ == "__main__":
    main()
