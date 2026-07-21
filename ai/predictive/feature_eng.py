"""
Feature engineering — fetch telemetry from Supabase, build sliding windows.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional


def fetch_telemetry(
    supabase,
    signals: list[str],
    limit: int = 2000,
) -> pd.DataFrame:
    """Fetch recent telemetry rows, return DataFrame with signal columns."""
    cols = "ts," + ",".join(signals)
    res = (
        supabase.table("plant_telemetry")
        .select(cols)
        .order("ts", desc=True)
        .limit(limit)
        .execute()
    )
    if not res.data:
        return pd.DataFrame(columns=["ts"] + signals)

    df = pd.DataFrame(res.data)
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    df = df.sort_values("ts").reset_index(drop=True)

    for col in signals:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df[signals] = df[signals].ffill().bfill().fillna(0.0)
    return df


class Scaler:
    """Simple per-signal min-max scaler (no sklearn dependency)."""

    def __init__(self):
        self.min_: dict[str, float] = {}
        self.max_: dict[str, float] = {}

    def fit(self, df: pd.DataFrame, signals: list[str]) -> "Scaler":
        for s in signals:
            self.min_[s] = float(df[s].min())
            self.max_[s] = float(df[s].max())
        return self

    def transform(self, df: pd.DataFrame, signals: list[str]) -> np.ndarray:
        out = np.zeros((len(df), len(signals)), dtype=np.float32)
        for i, s in enumerate(signals):
            rng = self.max_[s] - self.min_[s]
            if rng < 1e-8:
                rng = 1.0
            out[:, i] = (df[s].values - self.min_[s]) / rng
        return out

    def fit_transform(self, df: pd.DataFrame, signals: list[str]) -> np.ndarray:
        return self.fit(df, signals).transform(df, signals)

    def inverse(self, arr: np.ndarray, signals: list[str]) -> np.ndarray:
        out = arr.copy()
        for i, s in enumerate(signals):
            rng = self.max_[s] - self.min_[s]
            if rng < 1e-8:
                rng = 1.0
            out[:, i] = arr[:, i] * rng + self.min_[s]
        return out


def make_windows(
    arr: np.ndarray,
    window: int,
    horizon: int,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Build (X, y) sliding windows for sequence prediction.
    X: (N, window, features)
    y: (N, features)  — next `horizon` steps averaged as forecast target
    """
    X, y = [], []
    total = len(arr)
    for i in range(total - window - horizon + 1):
        X.append(arr[i : i + window])
        y.append(arr[i + window : i + window + horizon].mean(axis=0))
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def reconstruction_error(actual: np.ndarray, predicted: np.ndarray) -> np.ndarray:
    """Per-sample mean squared error across all features."""
    return ((actual - predicted) ** 2).mean(axis=1)


def anomaly_score(errors: np.ndarray) -> tuple[float, float]:
    """Returns (mean, std) of reconstruction errors for z-score computation."""
    return float(errors.mean()), float(errors.std() + 1e-8)
