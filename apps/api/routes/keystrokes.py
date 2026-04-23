from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.keystrokes import synthesize, is_ready
from core.limiter import limiter

router = APIRouter()

MAX_LEN = 280


class KeystrokeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_LEN)
    seed: int | None = None


@router.post("/keystroke")
@limiter.limit("100/hour")
def keystroke(req: KeystrokeRequest, request: Request):
    try:
        return synthesize(req.text, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # e.g. missing env vars, download failure
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/keystroke/status")
def status():
    return {"ready": is_ready()}