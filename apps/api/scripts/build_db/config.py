import os
from dotenv import load_dotenv, find_dotenv


load_dotenv(find_dotenv())
#where markdown files are stored, set in .env file, default to "knowledge" if not set
KNOWLEDGE_DIR = os.getenv("KNOWLEDGE_DIR", "knowledge")
#model to get embeddings from
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"