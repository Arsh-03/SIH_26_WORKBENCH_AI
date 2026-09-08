import hashlib
import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
import httpx
from backend.app.config import settings

logger = logging.getLogger("ollama_client")

class OllamaClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.reasoning_model = settings.REASONING_MODEL
        self.vision_model = settings.VISION_MODEL
        self.embedding_model = settings.EMBEDDING_MODEL
        self._cached_health: Optional[Dict[str, Any]] = None
        self._cached_health_time: float = 0.0

    DEFAULT_HEADERS = {
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "Sovereign-Workbench-Client/1.0"
    }

    async def generate_chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream token chunks line-by-line from local/remote Ollama chat API."""
        target_model = model or self.reasoning_model
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=90.0) as client:
                payload = {
                    "model": target_model,
                    "messages": messages,
                    "options": {
                        "temperature": temperature
                    },
                    "keep_alive": "15m",
                    "stream": True
                }
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    if response.status_code == 200:
                        async for line in response.aiter_lines():
                            line_str = line.strip()
                            if not line_str:
                                continue
                            try:
                                chunk = json.loads(line_str)
                                token = chunk.get("message", {}).get("content", "")
                                if token:
                                    yield token
                            except Exception:
                                continue
        except Exception as e:
            logger.error(f"Ollama chat streaming error with model {target_model}: {e}")

    async def check_health(self) -> Dict[str, Any]:

        """Check if local/remote Ollama server is running and get available models (cached 60s)."""
        import time
        now = time.time()
        if self._cached_health and (now - self._cached_health_time) < 60.0:
            return self._cached_health

        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    res_dict = {"running": True, "available_models": models}
                    self._cached_health = res_dict
                    self._cached_health_time = now
                    return res_dict

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
        """Call local/remote Ollama chat API with robust single-JSON and NDJSON streaming parsing."""
        target_model = model or self.reasoning_model
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=90.0) as client:
                payload = {
                    "model": target_model,
                    "messages": messages,
                    "options": {
                        "temperature": temperature
                    },
                    "keep_alive": "15m",
                    "stream": False
                }
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    # 1. Attempt standard single JSON parse
                    try:
                        data = res.json()
                        content = data.get("message", {}).get("content", "")
                        if content:
                            return content
                    except Exception:
                        pass

                    # 2. Robust fallback: Parse NDJSON / JSON-lines response chunks
                    text = res.text
                    content_parts = []
                    for line in text.strip().split("\n"):
                        line_str = line.strip()
                        if not line_str:
                            continue
                        try:
                            chunk = json.loads(line_str)
                            chunk_content = chunk.get("message", {}).get("content", "")
                            if chunk_content:
                                content_parts.append(chunk_content)
                        except Exception:
                            continue
                    if content_parts:
                        return "".join(content_parts)

        except Exception as e:
            logger.error(f"Ollama chat error with model {target_model}: {e}")
        return ""

    async def analyze_image(
        self,
        image_base64: str,
        prompt: str,
        model: Optional[str] = None
    ) -> str:
        """Analyze image with local Qwen2-VL model with robust single-JSON and NDJSON parsing."""
        target_model = model or self.vision_model
        try:
            async with httpx.AsyncClient(headers=self.DEFAULT_HEADERS, timeout=90.0) as client:
                payload = {
                    "model": target_model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "stream": False
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    # 1. Attempt standard single JSON parse
                    try:
                        data = res.json()
                        resp = data.get("response", "")
                        if resp:
                            return resp
                    except Exception:
                        pass

                    # 2. Robust fallback: Parse NDJSON / JSON-lines response chunks
                    text = res.text
                    content_parts = []
                    for line in text.strip().split("\n"):
                        line_str = line.strip()
                        if not line_str:
                            continue
                        try:
                            chunk = json.loads(line_str)
                            chunk_resp = chunk.get("response", "")
                            if chunk_resp:
                                content_parts.append(chunk_resp)
                        except Exception:
                            continue
                    if content_parts:
                        return "".join(content_parts)

        except Exception as e:
            logger.error(f"Ollama vision analysis error: {e}")
        return ""




ollama_client = OllamaClient()
