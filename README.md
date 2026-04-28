# JustinVerlin.com

Personal portfolio site with a RAG-powered chatbot and a deep learning keystroke synthesis sandbox.
Live at **[justinverlin.com](https://justinverlin.com)**.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Static HTML / CSS / vanilla JS, served by nginx |
| Backend | FastAPI (Python 3.12) |
| Embeddings | `all-MiniLM-L6-v2` via `sentence-transformers` (downloaded from Hugging Face) |
| LLM | OpenAI `gpt-4o-mini`  |
| Storage | SQLite (knowledge chunks + embeddings as BLOBs) |
| ML Model | DeBERTa-v3 fine-tuned for heteroscedastic keystroke regression-> see my keystroke synthesizer project! |
| Reverse proxy / TLS | nginx + Let's Encrypt |
| Container runtime | Docker Compose |
| Hosting | DigitalOcean droplet |
| CI/CD | GitHub Actions → SSH deploy |

## Repository layout

```
.
├── apps/
│   ├── api/                       # FastAPI backend
│   │   ├── main.py                # App entrypoint, middleware, router registration
│   │   ├── prompt.txt             # System prompt for the chatbot
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   ├── core/
│   │   │   ├── db.py              # SQLite connection helper
│   │   │   ├── rag.py             # Embedding index load + cosine-similarity retrieval
│   │   │   ├── limiter.py         # Per-IP rate limiter (reads X-Real-IP)
│   │   │   └── keystrokes/        # DeBERTa-based keystroke synthesizer
│   │   ├── routes/
│   │   │   ├── chat.py            # POST /chat — RAG + LLM streaming
│   │   │   ├── keystrokes.py      # POST /keystroke, GET /keystroke/status
│   │   │   └── health.py          # GET /health
│   │   └── scripts/build_db/      # Knowledge base ingestion: chunk → embed → SQLite
│   │
│   └── web/                       # Static site
│       ├── nginx.conf             # TLS, security headers, /api/* proxy, pretty URLs
│       └── public/                # Document root served to browsers
│           ├── index.html, about.html, projects.html, ...
│           ├── css/styles.css
│           ├── js/{chat.js, keystroke.js}
│           └── assets/{fonts,images,resume}
│
├── data/
│   └── keystroke/                 # Trained model weights (.pt) + cont_stats.json
│
├── .github/workflows/deploy.yml   # CI/CD: push to main → SSH deploy
├── docker-compose.yml             # api + web services
└── README.md
```

## How the chatbot works

1. **Knowledge ingestion** ([apps/api/scripts/build_db/](apps/api/scripts/build_db/)) — markdown files in `knowledge/` are chunked, embedded with MiniLM, and written to SQLite as `(id, content, embedding BLOB)` rows.
2. **Index load** — at API startup, `load_index()` ([apps/api/core/rag.py](apps/api/core/rag.py)) reads every chunk into a normalized in-memory matrix.
3. **Query time** — incoming question is embedded, cosine similarity is taken against the matrix, top-k chunks are pulled.
4. **LLM call** — top chunks + system prompt + (sanitized) chat history + user message are sent to `gpt-4o-mini` with streaming enabled. Tokens are streamed back to the browser.

## How the keystroke sandbox works

Two modes in [keystroke.html](apps/web/public/keystroke.html):

- **Synthesize** — type a phrase, the model predicts per-character dwell time, flight time, and typing speed; the playback area types it out at a realistic human cadence.
- **Compare** — capture the user's real keystroke timings, ask the model to predict the same text, side-by-side stats + per-character chart.

Model is a DeBERTa-v3 backbone with a multi-head heteroscedastic regression head (mean + log-variance per character per metric). Loaded lazily on first request via `is_ready()` / `synthesize()` in [apps/api/core/keystrokes/](apps/api/core/keystrokes/).

## Local development

### Requirements
- Docker + Docker Compose
- Python 3.12 (only if rebuilding the knowledge DB)

### Setup
```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
```

### Build the knowledge DB (first time only)
```bash
cd apps/api/scripts/build_db
python build_index.py
```
This writes `data/knowledge.db`. The API container reads it via the `./data` volume mount.

### Run
```bash
docker compose up -d --build
```
- Frontend: http://localhost (nginx serves `apps/web/public`)
- API: reachable via nginx at `/api/*` only (port 8000 is not exposed publicly).

### Live reload
Static files (HTML/CSS/JS) and Python code are bind-mounted, so edits show up on refresh / uvicorn reload.

## API endpoints

All endpoints are proxied through nginx under `/api/*` in production. They map to FastAPI routes as follows:

| Public URL | FastAPI route | Method | Notes |
|---|---|---|---|
| `/api/chat` | `/chat` | POST | RAG + LLM, streaming text response. 50/hr per IP. |
| `/api/keystroke` | `/keystroke` | POST | Predict dwell/flight/CPM for input text. 100/hr per IP. |
| `/api/keystroke/status` | `/keystroke/status` | GET | `{ ready: bool }` — used for warm-up indicator. |

## Security

- HTTPS via Let's Encrypt (HTTP redirects to HTTPS in [nginx.conf](apps/web/nginx.conf)).
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- API container is **not** publicly exposed — only reachable through nginx via the docker network.
- Per-IP rate limiting via `slowapi`, keyed on `X-Real-IP` forwarded by nginx.
- Input validation via Pydantic (max length, type-checked fields).
- CORS restricted to `justinverlin.com` and `localhost:8080`.

## CI/CD

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. SSH into the droplet using a deploy key stored in GitHub secrets.
2. `git fetch && git reset --hard origin/main` (no merge conflicts from server-side edits).
3. `docker compose up -d --build --force-recreate api web`.
4. `docker image prune -f` to keep disk usage in check.

Required secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

Manual trigger available via **Actions → Deploy → Run workflow** on GitHub.

## Environment variables

See [.env.example](.env.example). Required:
- `OPENAI_API_KEY` — for the chatbot LLM calls
- `DB_PATH` — path to the knowledge SQLite (mounted at `/data/knowledge.db` in production)
- `KEYSTROKE_WEIGHTS_URL` / `KEYSTROKE_STATS_URL` — optional, for downloading model weights at container start
