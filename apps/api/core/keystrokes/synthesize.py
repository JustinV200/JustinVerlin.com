"""Run inference: text -> per-character keystroke timings."""
import numpy as np
import torch

from .config import FEATURE_BOUNDS, MAX_TOKEN_LENGTH
from .Loader import _ensure_loaded


def synthesize(text: str, seed: int | None = None) -> dict:
    text = text.strip()
    if not text:
        raise ValueError("text is empty")

    b = _ensure_loaded()
    tokenizer, model = b["tokenizer"], b["model"]
    cont_mean, cont_std, device = b["cont_mean"], b["cont_std"], b["device"]

    if seed is not None:
        torch.manual_seed(seed)

    enc = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=MAX_TOKEN_LENGTH,
        return_offsets_mapping=True,
    )
    offset_mapping = enc["offset_mapping"].squeeze(0)

    max_char_covered = int(offset_mapping[:, 1].max().item())
    char_len = min(len(text), max_char_covered)
    if char_len == 0:
        raise ValueError("tokenizer produced no covered characters")

    token_to_char_idx = torch.zeros(char_len, dtype=torch.long, device=device)
    for tok_idx in range(offset_mapping.shape[0]):
        start = int(offset_mapping[tok_idx, 0].item())
        end   = int(offset_mapping[tok_idx, 1].item())
        if start == end:
            continue
        for c in range(start, min(end, char_len)):
            token_to_char_idx[c] = tok_idx
    token_to_char_idx = token_to_char_idx.unsqueeze(0)

    char_ids = torch.tensor(
        [ord(ch) % 256 for ch in text[:char_len]],
        dtype=torch.long, device=device,
    ).unsqueeze(0)

    inputs = {
        "input_ids": enc["input_ids"].to(device),
        "attention_mask": enc["attention_mask"].to(device),
    }

    with torch.no_grad():
        mean_std, logvar_std = model(
            token_to_char_idx=token_to_char_idx, char_ids=char_ids, **inputs
        )
        mean = mean_std * cont_std + cont_mean
        variance = torch.exp(logvar_std) * (cont_std ** 2)
        std = torch.sqrt(variance.clamp(min=1e-8))
        sampled = torch.randn_like(mean) * std + mean

    preds = sampled.float().cpu().numpy()[0][:char_len]

    for idx, key in enumerate(["DwellTime", "FlightTime", "typing_speed"]):
        lo, hi = FEATURE_BOUNDS[key]
        preds[:, idx] = np.clip(preds[:, idx], lo, hi)

    dwell  = preds[:, 0].tolist()
    flight = preds[:, 1].tolist()
    cpm    = preds[:, 2].tolist()
    if flight:
        flight[0] = None  # no previous key for first char

    return {
        "chars":    list(text[:char_len]),
        "dwell_ms": dwell,
        "flight_ms": flight,
        "cpm":      cpm,
    }