import os

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_REASONING = "qwen2.5:7b-instruct-q4_K_M"
MODEL_VISION = "qwen2-vl:7b-instruct-q4_K_M"
MODEL_EMBEDDINGS = "nomic-embed-text:v1.5"
MODEL_CODE = "qwen2.5-coder:7b-instruct-q4_K_M"
SANDBOX_TIMEOUT_SECONDS = 10
SANDBOX_MEMORY_LIMIT_MB = 512
