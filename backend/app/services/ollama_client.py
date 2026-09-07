import hashlib
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from backend.app.config import settings

logger = logging.getLogger("ollama_client")

class OllamaClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.reasoning_model = settings.REASONING_MODEL
        self.vision_model = settings.VISION_MODEL
        self.embedding_model = settings.EMBEDDING_MODEL

    DEFAULT_HEADERS = {
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "Sovereign-Workbench-Client/1.0"
    }

    async def check_health(self) -> Dict[str, Any]:
        """Check if local Ollama server is running and get loaded/available models."""
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    return {"running": True, "available_models": models}

        except Exception as e:
            logger.debug(f"Ollama server not reachable: {e}")
        return {"running": False, "available_models": []}

    def _generate_fallback_embedding(self, text: str, dimensions: int = 768) -> List[float]:
        """Deterministic high-dimensional embedding fallback when Ollama embedding model is offline."""
        # Generates deterministic normalized 768-dim float vector using hash seeds
        h = hashlib.sha256(text.encode("utf-8")).digest()
        vec = []
        for i in range(dimensions):
            byte_val = h[i % len(h)]
            float_val = (byte_val - 128) / 128.0 + (i * 0.001 % 0.1)
            vec.append(float_val)
        # Normalize
        norm = sum(x * x for x in vec) ** 0.5 or 1.0
        return [round(x / norm, 6) for x in vec]

    async def get_embedding(self, text: str) -> List[float]:
        """Fetch dense embeddings from local nomic-embed-text or fallback."""
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=10.0) as client:
                payload = {
                    "model": self.embedding_model,
                    "prompt": text
                }
                res = await client.post(f"{self.base_url}/api/embeddings", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    if "embedding" in data:
                        return data["embedding"]
        except Exception as e:
            logger.debug(f"Ollama embedding request failed: {e}. Using deterministic fallback vector.")
        return self._generate_fallback_embedding(text, settings.EMBEDDING_DIMENSIONS)

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        model: Optional[str] = None
    ) -> str:
        """Call local Ollama chat API."""
        target_model = model or self.reasoning_model
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=60.0) as client:
                payload = {
                    "model": target_model,
                    "messages": messages,
                    "options": {
                        "temperature": temperature
                    },
                    "stream": False
                }
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Ollama chat error with model {target_model}: {e}")
        return ""

    async def analyze_image(
        self,
        image_base64: str,
        prompt: str,
        model: Optional[str] = None
    ) -> str:
        """Analyze image with local Qwen2-VL model."""
        target_model = model or self.vision_model
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=60.0) as client:
                payload = {
                    "model": target_model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "stream": False
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("response", "")
        except Exception as e:
            logger.error(f"Ollama vision analysis error: {e}")
        return ""



ollama_client = OllamaClient()
