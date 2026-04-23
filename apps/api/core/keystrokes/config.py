"""Constants and paths for the keystroke synthesizer.

All tunables live here so Loader/synthesize don't need to know about env vars.
"""
import os
from pathlib import Path

#Model architecture
BASE_MODEL = "microsoft/deberta-v3-base"
NUM_CONTINUOUS = 3
MAX_TOKEN_LENGTH = 512
CHAR_EMBED_DIM = 32

#physical bounds (match training preprocessing) ---
FEATURE_BOUNDS = {
    "DwellTime":    (0.0, 300.0),
    "FlightTime":   (0.0, 900.0),
    "typing_speed": (0.0, 490.0),
}

# Weight download / cache
CACHE_DIR    = Path(os.getenv("KEYSTROKE_CACHE_DIR", "/data/keystroke"))
WEIGHTS_URL  = os.getenv("KEYSTROKE_WEIGHTS_URL", "")
STATS_URL    = os.getenv("KEYSTROKE_STATS_URL", "")
WEIGHTS_PATH = CACHE_DIR / "best_model.pt"
STATS_PATH   = CACHE_DIR / "cont_stats.json"

