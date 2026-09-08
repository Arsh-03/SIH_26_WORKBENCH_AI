import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_REASONING = os.getenv("MODEL_REASONING", "llama3.1:8b")
MODEL_CODE = os.getenv("MODEL_CODE", "qwen2.5-coder:7b")
MODEL_MATH = os.getenv("MODEL_MATH", "llama3.1:8b")
MODEL_DOCS = os.getenv("MODEL_DOCS", "qwen2.5:7b-instruct-q4_K_M")
MODEL_VISION = os.getenv("MODEL_VISION", "qwen2-vl:7b-instruct-q4_K_M")
MODEL_CHAT = os.getenv("MODEL_CHAT", "llama3.1:8b")
MODEL_EMBEDDINGS = os.getenv("MODEL_EMBEDDINGS", "bge-m3")
SANDBOX_TIMEOUT_SECONDS = int(os.getenv("SANDBOX_TIMEOUT_SECONDS", 10))
SANDBOX_MEMORY_LIMIT_MB = int(os.getenv("SANDBOX_MEMORY_LIMIT_MB", 512))

