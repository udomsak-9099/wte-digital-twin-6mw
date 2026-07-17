"""
LSTM autoencoder for anomaly detection.
Uses reconstruction error — no labels needed (unsupervised).
"""

from __future__ import annotations
import os
import pickle
import numpy as np

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

from ai.predictive.config import HIDDEN_SIZE, NUM_LAYERS, DROPOUT


class LSTMAutoEncoder(nn.Module if TORCH_AVAILABLE else object):
    """LSTM encoder-decoder for multivariate time-series reconstruction."""

    def __init__(self, n_features: int):
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch required: uv pip install torch")
        super().__init__()
        self.n_features = n_features

        self.encoder = nn.LSTM(
            input_size=n_features,
            hidden_size=HIDDEN_SIZE,
            num_layers=NUM_LAYERS,
            batch_first=True,
            dropout=DROPOUT if NUM_LAYERS > 1 else 0,
        )
        self.decoder = nn.LSTM(
            input_size=HIDDEN_SIZE,
            hidden_size=HIDDEN_SIZE,
            num_layers=NUM_LAYERS,
            batch_first=True,
            dropout=DROPOUT if NUM_LAYERS > 1 else 0,
        )
        self.fc_out = nn.Linear(HIDDEN_SIZE, n_features)

    def forward(self, x):
        # x: (batch, seq_len, n_features)
        enc_out, (h, c) = self.encoder(x)
        # repeat last hidden state as decoder input
        dec_input = enc_out[:, -1:, :].repeat(1, x.size(1), 1)
        dec_out, _ = self.decoder(dec_input, (h, c))
        return self.fc_out(dec_out)


class FallbackStatModel:
    """
    Statistical fallback when PyTorch is unavailable.
    Uses exponential moving average + z-score for anomaly detection.
    """

    def __init__(self, alpha: float = 0.05):
        self.alpha = alpha
        self.ema: np.ndarray | None = None
        self.var: np.ndarray | None = None

    def update(self, x: np.ndarray) -> np.ndarray:
        """Update EMA and return reconstruction (predicted = EMA)."""
        if self.ema is None:
            self.ema = x.copy()
            self.var = np.ones_like(x) * 0.01
        self.var  = self.alpha * (x - self.ema) ** 2 + (1 - self.alpha) * self.var
        self.ema  = self.alpha * x + (1 - self.alpha) * self.ema
        return self.ema.copy()

    def reconstruction_errors(self, X: np.ndarray) -> np.ndarray:
        """X: (N, features). Returns per-sample MSE."""
        errors = []
        for row in X:
            pred = self.update(row)
            errors.append(float(((row - pred) ** 2).mean()))
        return np.array(errors)


def save_model(model, scaler, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if TORCH_AVAILABLE and isinstance(model, LSTMAutoEncoder):
        import torch
        torch.save({"state_dict": model.state_dict(), "n_features": model.n_features}, path)
    else:
        with open(path, "wb") as f:
            pickle.dump({"model": model, "scaler": scaler}, f)


def load_model(path: str, scaler=None):
    if not os.path.exists(path):
        return None, scaler
    if path.endswith(".pt") and TORCH_AVAILABLE:
        import torch
        data = torch.load(path, map_location="cpu")
        m = LSTMAutoEncoder(n_features=data["n_features"])
        m.load_state_dict(data["state_dict"])
        m.eval()
        return m, scaler
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data["model"], data.get("scaler", scaler)
