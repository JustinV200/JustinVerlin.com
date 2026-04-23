"""Keystroke synthesizer package.

Public API:
    synthesize(text, seed=None) -> dict   # run inference
    is_ready() -> bool                    # has the model loaded yet?
"""
from .synthesize import synthesize
from .Loader import is_ready

__all__ = ["synthesize", "is_ready"]
