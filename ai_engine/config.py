import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_REASONING = "llama3.1:8b"
MODEL_VISION = "qwen2-vl:7b-instruct-q4_K_M"
MODEL_EMBEDDINGS = "bge-m3"
MODEL_CODE = "qwen2.5-coder:7b"
SANDBOX_TIMEOUT_SECONDS = 10
SANDBOX_MEMORY_LIMIT_MB = 512
