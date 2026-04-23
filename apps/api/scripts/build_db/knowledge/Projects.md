# Projects

## Keystroke Synthesizer
A personal deep learning project that learns individual human typing behaviors and generates synthetic keystroke dynamics from any text input. Justin is most proud of this project — it took many training attempts and a lot of fine-tuning before it started working, and the payoff was huge.

- Built with a DeBERTa-v3-base transformer (Microsoft) and heteroscedastic regression
- Predicts dwell time (how long each key is held), flight time (time between keystrokes), and typing speed (characters per minute) at the per-character level
- Uses heteroscedastic loss (Gaussian NLL + KL divergence) so the model predicts both a mean and variance per keystroke — giving realistic variation instead of robotic identical timings
- KL annealing: trained the model to focus on accurate means first, then gradually calibrate variance over 8 epochs
- Includes KeyForge, a desktop Tkinter app that can generate keystroke CSVs or actually replay keystrokes live into any window at a realistic human rate
- Trained on the KLiCKe competition dataset (Kaggle) — real text/keystroke timing pairs
- Built with PyTorch, Hugging Face Transformers, and custom data pipeline (handles backspace edit-replay, z-score normalization, character-to-token offset mapping)
- Submitted SLURM jobs to a computing cluster for training
- GitHub: https://github.com/JustinV200/Keystroke-Synthesizer

## JustinAI (This Website)
The RAG-powered chatbot you're talking to right now. Justin built his personal portfolio site with a FastAPI backend, SQLite knowledge base, HuggingFace sentence embeddings, and Groq (LLaMA 3.3 70B) as the LLM. The frontend is vanilla JS/CSS with a dark theme. The chatbot retrieves relevant chunks from a knowledge base about Justin and answers visitor questions.

## AIECODE
An agile project management platform focused on education and students. Justin is on the development team.
- Redesigned the SQL schema and moved arithmetic into SQL views, substantially speeding up the website
- Maintains the SQL database
- Developed REST API endpoints for AIE5, the next iteration of the platform
- Starting next semester: predictive analysis of student outcomes based on agile sprint data

## ReGen
An automated document intelligence pipeline Justin built with his collaborator Ben Warring. It ingests documents or web pages, extracts structured data using LLMs, analyzes patterns across sources, and generates polished reports rendered with Quarto.

- Accepts URLs, PDFs, Word docs, Excel files, CSVs, and plain text as input
- Pipeline: parse → chunk → LLM map-reduce extraction → per-source analysis → topic clustering → cross-source synthesis → section-by-section report generation → Quarto render
- Generates self-contained HTML, PDF, or DOCX reports — no extra folders needed
- Three report modes: brief, standard, and detailed, with scaling depth
- Provider-agnostic LLM integration via litellm (works with GPT-3.5-turbo, GPT-4o, or any supported model)
- Includes an Edit Mode agent that references saved JSONs from the pipeline to edit the final report on user request
- Built with Python, litellm, PyMuPDF, pdfplumber, trafilatura, pandas, matplotlib/seaborn, and Quarto
- GitHub: https://github.com/JustinV200/ReGen

## AutoVideoProducer
A fully automated, multi-channel YouTube Shorts pipeline Justin built as an independent project in June 2025. It scrapes trending stories with GPT-4o, generates narration with OpenAI TTS, auto-syncs gameplay background footage via FFmpeg, renders vertical 1080×1920 MP4s with Remotion (React), and uploads to five YouTube channels on a rolling schedule — all driven from a single .env file.

- Five YouTube channels run in parallel with independent OAuth clients
- GPT-4o (Responses API) generates channel-specific scripts with history-aware de-duplication to avoid repeating topics
- OpenAI TTS (shimmer voice) generates narration audio; Whisper transcribes it to word-timed captions
- FFmpeg trims gameplay source clips at random start offsets for variety
- Remotion + React renders the final composition; uploads via YouTube Data API v3
- 5-hour spacing per channel with automatic quota rescheduling
- Built primarily in Java 17 (Maven multi-module) with a TypeScript/React Remotion renderer
- GitHub: https://github.com/JustinV200/AutoVideoProducer

## Battle for Rome 2 (Legacy, 2020)
A fully-playable 2D side-scrolling action game Justin built in Python using Pygame during his sophomore year of high school (2020), before any formal CS coursework. It's a legacy project preserved to show where he started — the code is messy and unoptimized, but it's a real, playable game he built entirely on his own.

- Melee and ranged combat (sword and gun), multi-phase boss fights (Julius Caesar, Cleopatra, Hannibal, etc.)
- Platforming physics with parallax backgrounds, health bars, room transitions, and upgrade paths
- Background music and sound effects
- Object-oriented design with separate classes for projectiles, platforms, enemies, and environments
- Built with Python and Pygame
- GitHub: https://github.com/JustinV200/BattleForRome2-Legacy2020

