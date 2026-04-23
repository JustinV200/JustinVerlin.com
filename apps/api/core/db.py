import sqlite3
import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

#path to the database, set with an environment variable, default to "knowledge.db" if not set
DB_PATH = os.getenv("DB_PATH", "knowledge.db")

def get_db():
    #connect to the database and return the connection
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    #initialize the database with the necessary tables
    #create all tables if they don't exist
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS documents (
            id        INTEGER PRIMARY KEY,
            source    TEXT UNIQUE NOT NULL,
            category  TEXT
        );
        CREATE TABLE IF NOT EXISTS chunks (
            id          INTEGER PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            content     TEXT NOT NULL,
            section     TEXT,
            embedding   BLOB NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
    """)
    conn.commit()
    conn.close()