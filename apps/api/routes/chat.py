import os
from groq import Groq
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.rag import retrieve
from core.limiter import limiter

router = APIRouter()

MAX_INPUT_LENGTH = 500

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompt.txt")
#fetch prompts.txt, which contains the system prompt for the chat model and personality
with open(_PROMPT_PATH, encoding="utf-8") as _f:
    SYSTEM_PROMPT = _f.read().strip()


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


def _needs_retrieval(message: str, client: Groq) -> bool:
    #do we need to do a lookup, or is this just a greeting / small talk that needs no context?
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a routing assistant. Decide if the user's message requires "
                    "looking up facts about a person (YES) or if it's just chitchat / "
                    "a greeting / small talk that needs no factual context (NO). "
                    "Reply with exactly one word: YES or NO."
                ),
            },
            {"role": "user", "content": message},
        ],
        max_tokens=1,
    )
    return resp.choices[0].message.content.strip().upper() == "YES"


@router.post("/chat")
@limiter.limit("20/hour")
def chat(req: ChatRequest, request: Request):
    if len(req.message) > MAX_INPUT_LENGTH:
        raise HTTPException(status_code=400, detail="Message too long (max 500 characters)")

    client = Groq(api_key=os.environ["GROQ_API"])
    chunks = retrieve(req.message) if _needs_retrieval(req.message, client) else []
    context = "\n\n---\n\n".join(chunks)
    latest = (
        f"Context about Justin:\n{context}\n\nQuestion: {req.message}"
        if chunks
        else req.message
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *req.history,
        {"role": "user", "content": latest},
    ]

    def generate():
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True,
            max_tokens=512,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(generate(), media_type="text/plain")
