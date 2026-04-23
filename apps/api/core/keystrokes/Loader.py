"""Lazy loader for the keystroke model.

First call to `_ensure_loaded()`:
  1. Downloads weights + stats from the GitHub release if not cached
  2. Loads DeBERTa tokenizer, builds model, loads state_dict
  3. Caches the whole bundle in a module global behind a lock

Subsequent calls return the cached bundle instantly.
"""
import json
import threading
import urllib.request
from pathlib import Path

import torch
from transformers import AutoTokenizer

from .config import (
    BASE_MODEL,
    NUM_CONTINUOUS,
    WEIGHTS_URL,
    STATS_URL,
    WEIGHTS_PATH,
    STATS_PATH,
)
from .TextToKeystrokeModelMultiHead import TextToKeystrokeModelMultiHead

_bundle = None
_load_lock = threading.Lock()


def _download(url: str, dest: Path) -> None:
    # Download a file from a URL to the destination path. Skip if already exists.
    if not url:
        raise RuntimeError(
            f"Missing download URL for {dest.name}. "
            "Set KEYSTROKE_WEIGHTS_URL / KEYSTROKE_STATS_URL env vars."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"[keystroke] downloading {url} -> {dest}")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def _strip_dataparallel_prefix(sd):
    #If the state dict keys are pref
    if not any(k.startswith("module.") for k in sd):
        return sd
    return {k[7:] if k.startswith("module.") else k: v for k, v in sd.items()}


def _ensure_loaded():
    # Return the loaded bundle, loading it if needed. Thread-safe.
    global _bundle
    if _bundle is not None:
        #if already loaded just return
        return _bundle
    with _load_lock:
        if _bundle is not None:
            return _bundle

        if not WEIGHTS_PATH.exists():
            _download(WEIGHTS_URL, WEIGHTS_PATH)
        if not STATS_PATH.exists():
            _download(STATS_URL, STATS_PATH)
        #gpu is possible, otherwise cpu is fine
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        #for debug
        print(f"[keystroke] loading model on {device}")

        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
        model = TextToKeystrokeModelMultiHead(BASE_MODEL, NUM_CONTINUOUS).to(device)

        ckpt = torch.load(WEIGHTS_PATH, map_location=device)
        if isinstance(ckpt, dict) and "state_dict" in ckpt:
            ckpt = ckpt["state_dict"]
        model.load_state_dict(_strip_dataparallel_prefix(ckpt), strict=False)
        model.eval()

        with open(STATS_PATH) as f:
            stats = json.load(f)

        _bundle = {
            "tokenizer": tokenizer,
            "model": model,
            "cont_mean": torch.tensor(stats["mean"], device=device),
            "cont_std":  torch.tensor(stats["std"],  device=device),
            "device": device,
        }
        print("[keystroke] ready")
        return _bundle


def is_ready() -> bool:
    return _bundle is not None