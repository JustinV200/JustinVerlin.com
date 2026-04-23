"""Model architecture: DeBERTa encoder + char embedding + mean/logvar heads.

Copied from KeyForge/Synthesize/TextToKeystrokeModelMultiHead.py in the
Keystroke-Synthesizer repo so we can load the checkpoint without vendoring
the whole training pipeline.
"""
import torch
import torch.nn as nn
from transformers import AutoModel

from .config import CHAR_EMBED_DIM


class TextToKeystrokeModelMultiHead(nn.Module):
    """DeBERTa encoder + char embedding + shared backbone + mean/logvar heads."""

    def __init__(self, base_model: str, num_continuous: int = 3):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base_model)
        hidden = self.encoder.config.hidden_size

        self.char_embed = nn.Embedding(256, CHAR_EMBED_DIM)
        nn.init.normal_(self.char_embed.weight, mean=0.0, std=0.05)

        self.backbone = nn.Sequential(
            nn.Linear(hidden + CHAR_EMBED_DIM, 768), nn.LayerNorm(768),
            nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(768, 256), nn.ReLU(),
        )
        self.mean_head = nn.Linear(256, num_continuous)
        self.logvar_head = nn.Linear(256, num_continuous)
        nn.init.normal_(self.logvar_head.weight, mean=0.0, std=0.1)
        nn.init.constant_(self.logvar_head.bias, 0.0)

    def forward(self, input_ids, attention_mask, token_to_char_idx=None, char_ids=None):
        x = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        hidden = x.last_hidden_state  # [B, T_tok, H]

        if token_to_char_idx is not None:
            safe_idx = token_to_char_idx.clamp(0, hidden.size(1) - 1)
            hidden = torch.gather(
                hidden, 1,
                safe_idx.unsqueeze(-1).expand(-1, -1, hidden.size(-1)),
            )

        if char_ids is not None:
            char_emb = self.char_embed(char_ids)
            hidden = torch.cat([hidden, char_emb], dim=-1)
        else:
            pad = torch.zeros(*hidden.shape[:-1], CHAR_EMBED_DIM,
                              device=hidden.device, dtype=hidden.dtype)
            hidden = torch.cat([hidden, pad], dim=-1)

        shared = self.backbone(hidden)
        return self.mean_head(shared), self.logvar_head(shared)
