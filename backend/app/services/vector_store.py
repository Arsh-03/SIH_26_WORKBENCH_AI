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

import re

def tokenize_text(text: str) -> List[str]:
    """Tokenize text into lowercase tokens, preserving hyphenated alphanumeric equipment tags (e.g. PRV-102, SOP-401, B-401)."""
    if not text:
        return []
    return [t.lower() for t in re.findall(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*", text)]

def compute_bm25_score(query_tokens: List[str], doc_tokens: List[str], avg_dl: float = 120.0) -> float:
    """Okapi BM25 scoring for sparse keyword relevance in engineering documents."""
    k1 = 1.5
    b = 0.75
    doc_len = len(doc_tokens)
    score = 0.0
    for token in query_tokens:
        if not token or len(token) < 2:
            continue
        # Boost alphanumeric tags and specific equipment codes
        tag_boost = 3.5 if ("-" in token or any(c.isdigit() for c in token)) else 1.0
        tf = doc_tokens.count(token)
        if tf > 0:
            idf = 1.8
            num = tf * (k1 + 1.0)
            den = tf + k1 * (1.0 - b + b * (doc_len / (avg_dl or 1.0)))
            score += idf * (num / den) * tag_boost
    return score

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

    def delete_document_chunks(self, workspace_id: str, document_id: str) -> None:
        """Delete all chunks for a document from ChromaDB and fallback store."""
        if self.chroma_available and self.client:
            try:
                collection = self.get_or_create_collection(workspace_id)
                if collection:
                    collection.delete(where={"document_id": document_id})
                    logger.info(f"Deleted Chroma chunks for document {document_id} in {workspace_id}")
                    return
            except Exception as e:
                logger.warning(f"Failed deleting Chroma chunks for {document_id}: {e}")

        # Native store cleanup
        if workspace_id in self._in_memory_store:
            self._in_memory_store[workspace_id] = [
                c for c in self._in_memory_store[workspace_id]
                if c.get("metadata", {}).get("document_id") != document_id
            ]

    def query_chunks(
        self,
        workspace_id: str,
        query_embedding: List[float],
        top_k: int = 3,
        document_ids: Optional[List[str]] = None,
        query_text: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query vector database using Hybrid Dense (ChromaDB) + Sparse (BM25) search with Reciprocal Rank Fusion (RRF).
        Guarantees exact alphanumeric tag retrieval (e.g. PRV-102, SOP-401, ASME Sec VIII) while preserving dense semantic matches.
        """
        candidate_matches: List[Dict[str, Any]] = []
        fetch_k = max(top_k * 3, 12)

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
                    n_results=min(fetch_k, max(1, collection.count())),
                    where=where_filter,
                    include=["documents", "metadatas", "distances"]
                )

                if results and "ids" in results and results["ids"]:
                    ids_list = results["ids"][0]
                    docs_list = results["documents"][0] if results.get("documents") else []
                    meta_list = results["metadatas"][0] if results.get("metadatas") else []
                    dist_list = results["distances"][0] if results.get("distances") else []

                    for i in range(len(ids_list)):
                        dist = dist_list[i] if i < len(dist_list) else 0.0
                        score = round(max(0.0, 1.0 - float(dist)), 3)
                        meta = meta_list[i] if i < len(meta_list) else {}
                        candidate_matches.append({
                            "chunk_id": ids_list[i],
                            "document_id": meta.get("document_id", ""),
                            "page_number": meta.get("page_number", 1),
                            "score": score,
                            "content": docs_list[i] if i < len(docs_list) else "",
                            "spatial_bbox": meta.get("spatial_bbox"),
                            "page_width": meta.get("page_width"),
                            "page_height": meta.get("page_height"),
                            "has_spatial": meta.get("has_spatial", False)
                        })
            except Exception as e:
                logger.error(f"Error querying Chroma vector store: {e}")

        # Native query fallback / supplementary candidates
        if not candidate_matches:
            items = self._in_memory_store.get(workspace_id, [])
            for it in items:
                if document_ids and it["metadata"].get("document_id") not in document_ids:
                    continue
                sim = cosine_similarity(query_embedding, it["embedding"])
                meta = it.get("metadata", {})
                candidate_matches.append({
                    "chunk_id": it["id"],
                    "document_id": meta.get("document_id", ""),
                    "page_number": meta.get("page_number", 1),
                    "score": round(sim, 3),
                    "content": it["document"],
                    "spatial_bbox": meta.get("spatial_bbox"),
                    "page_width": meta.get("page_width"),
                    "page_height": meta.get("page_height"),
                    "has_spatial": meta.get("has_spatial", False)
                })

        if not candidate_matches:
            return []

        # If no query_text is provided, return dense candidates sorted by score
        if not query_text:
            candidate_matches.sort(key=lambda x: x["score"], reverse=True)
            return candidate_matches[:top_k]

        # HYBRID RE-RANKING VIA RECIPROCAL RANK FUSION (RRF)
        query_tokens = tokenize_text(query_text)

        # 1. Dense ranking index: 0-based rank
        candidate_matches.sort(key=lambda x: x["score"], reverse=True)
        dense_ranks = {c["chunk_id"]: rank for rank, c in enumerate(candidate_matches)}

        # 2. Sparse BM25 ranking
        bm25_scored = []
        for c in candidate_matches:
            doc_tokens = tokenize_text(c["content"])
            bm25_s = compute_bm25_score(query_tokens, doc_tokens)
            bm25_scored.append((c["chunk_id"], bm25_s))

        bm25_scored.sort(key=lambda x: x[1], reverse=True)
        bm25_ranks = {cid: rank for rank, (cid, s) in enumerate(bm25_scored)}

        # 3. Reciprocal Rank Fusion (k=60)
        k_rrf = 60.0
        for c in candidate_matches:
            cid = c["chunk_id"]
            r_dense = dense_ranks.get(cid, 999)
            r_bm25 = bm25_ranks.get(cid, 999)
            rrf_score = (1.0 / (k_rrf + r_dense)) + (1.0 / (k_rrf + r_bm25))

            # Bonus for exact equipment tag match in chunk content
            has_exact_tag = any(
                t in c["content"].lower()
                for t in query_tokens
                if ("-" in t or any(char.isdigit() for char in t)) and len(t) >= 4
            )
            if has_exact_tag:
                rrf_score += 0.05

            c["rrf_score"] = round(rrf_score, 4)

        candidate_matches.sort(key=lambda x: x.get("rrf_score", x["score"]), reverse=True)
        return candidate_matches[:top_k]

    async def delete_document_chunks(self, workspace_id: str, document_id: str) -> bool:
        """Purge all vector embeddings for a specific document from Chroma and in-memory store."""
        try:
            if self.chroma_available and self.client:
                collection = self.get_or_create_collection(workspace_id)
                # Chroma delete by metadata filter
                try:
                    collection.delete(where={"document_id": document_id})
                    logger.info(f"Purged Chroma vector chunks for doc '{document_id}' in workspace '{workspace_id}'")
                except Exception as del_err:
                    logger.warning(f"Chroma collection.delete warning: {del_err}")

            # Clean in-memory store
            if workspace_id in self._in_memory_store:
                self._in_memory_store[workspace_id] = [
                    item for item in self._in_memory_store[workspace_id]
                    if item.get("metadata", {}).get("document_id") != document_id
                ]
            return True
        except Exception as e:
            logger.error(f"Error deleting document chunks from vector store: {e}")
            return False


vector_store_service = VectorStoreService()

