import os
from openai import OpenAI
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.rag import retrieve
from core.limiter import limiter

router = APIRouter()
MAX_INPUT_LENGTH = 500

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompt.txt")
with open(_PROMPT_PATH, encoding="utf-8") as _f:
    SYSTEM_PROMPT = _f.read().strip()

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []

@router.post("/chat")
@limiter.limit("20/hour")
def chat(req: ChatRequest, request: Request):
    if len(req.message) > MAX_INPUT_LENGTH:
        raise HTTPException(status_code=400, detail="Message too long (max 500 characters)")

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    chunks = retrieve(req.message)
    context = "\n\n---\n\n".join(chunks)
    latest = (
        f"Context about Justin:\n{context}\n\nQuestion: {req.message}"
        if chunks else req.message
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *req.history,
        {"role": "user", "content": latest},
    ]

    def generate():
        try:
            stream = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True,
                max_tokens=512,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"[error: {e}]"

    return StreamingResponse(generate(), media_type="text/plain")