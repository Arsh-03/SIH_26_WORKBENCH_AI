import os
import math
import logging
from typing import List, Dict, Any, Optional
from backend.app.config import settings

logger = logging.getLogger("vector_store")

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1)) or 1e-9
    norm2 = math.sqrt(sum(b * b for b in v2)) or 1e-9
    return dot / (norm1 * norm2)

class VectorStoreService:
    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIR
        os.makedirs(self.persist_directory, exist_ok=True)
        self.chroma_available = False
        self.client = None
        self._in_memory_store: Dict[str, List[Dict[str, Any]]] = {}

        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            try:
                self.client = chromadb.PersistentClient(
                    path=self.persist_directory,
                    settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True)
                )
                self.chroma_available = True
            except Exception as e:
                logger.warning(f"Failed PersistentClient ChromaDB: {e}. Trying EphemeralClient.")
                self.client = chromadb.EphemeralClient(
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
                self.chroma_available = True
        except ImportError:
            logger.info("ChromaDB library not found. Operating in Native Embedded Vector Store mode.")

    def _get_collection_name(self, workspace_id: str) -> str:
        clean_ws = "".join(c if c.isalnum() or c in "-_" else "_" for c in workspace_id)
        if len(clean_ws) < 3:
            clean_ws = f"ws_{clean_ws}"
        return f"ws_{clean_ws}"[:63]

    def get_or_create_collection(self, workspace_id: str):
        if self.chroma_available and self.client:
            col_name = self._get_collection_name(workspace_id)
            return self.client.get_or_create_collection(
                name=col_name,
                metadata={"workspace_id": workspace_id, "hnsw:space": "cosine"}
            )
        return None

    def add_chunks(
        self,
        workspace_id: str,
        chunk_ids: List[str],
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
    ) -> None:
        """Add text chunks and their embeddings to the workspace collection."""
        if self.chroma_available and self.client:
            try:
                collection = self.get_or_create_collection(workspace_id)
                collection.upsert(
                    ids=chunk_ids,
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas
                )
                return
            except Exception as e:
                logger.warning(f"Chroma upsert failed: {e}. Falling back to native store.")

        # Native in-memory/embedded fallback store
        if workspace_id not in self._in_memory_store:
            self._in_memory_store[workspace_id] = []

        for i, cid in enumerate(chunk_ids):
            self._in_memory_store[workspace_id].append({
                "id": cid,
                "document": documents[i],
                "embedding": embeddings[i],
                "metadata": metadatas[i] if i < len(metadatas) else {}
            })

    def query_chunks(
        self,
        workspace_id: str,
        query_embedding: List[float],
        top_k: int = 3,
        document_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Query vector database for similar chunks with optional document ID filtering."""
        if self.chroma_available and self.client:
            try:
                collection = self.get_or_create_collection(workspace_id)
                where_filter = None
                if document_ids and len(document_ids) > 0:
                    if len(document_ids) == 1:
                        where_filter = {"document_id": document_ids[0]}
                    else:
                        where_filter = {"document_id": {"$in": document_ids}}

                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k, max(1, collection.count())),
                    where=where_filter,
                    include=["documents", "metadatas", "distances"]
                )

                matches = []
                if results and "ids" in results and results["ids"]:
                    ids_list = results["ids"][0]
                    docs_list = results["documents"][0] if results.get("documents") else []
                    meta_list = results["metadatas"][0] if results.get("metadatas") else []
                    dist_list = results["distances"][0] if results.get("distances") else []

                    for i in range(len(ids_list)):
                        dist = dist_list[i] if i < len(dist_list) else 0.0
                        score = round(max(0.0, 1.0 - float(dist)), 3)
                        meta = meta_list[i] if i < len(meta_list) else {}
                        matches.append({
                            "chunk_id": ids_list[i],
                            "document_id": meta.get("document_id", ""),
                            "page_number": meta.get("page_number", 1),
                            "score": score,
                            "content": docs_list[i] if i < len(docs_list) else ""
                        })

                if matches:
                    return matches
            except Exception as e:
                logger.error(f"Error querying Chroma vector store: {e}")

        # Native query fallback
        items = self._in_memory_store.get(workspace_id, [])
        scored = []
        for it in items:
            if document_ids and it["metadata"].get("document_id") not in document_ids:
                continue
            sim = cosine_similarity(query_embedding, it["embedding"])
            scored.append({
                "chunk_id": it["id"],
                "document_id": it["metadata"].get("document_id", ""),
                "page_number": it["metadata"].get("page_number", 1),
                "score": round(sim, 3),
                "content": it["document"]
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]


vector_store_service = VectorStoreService()
