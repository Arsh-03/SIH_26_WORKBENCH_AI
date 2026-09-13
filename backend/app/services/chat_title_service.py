import re
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.sql_models import DBChatSession, AgentSession
from backend.app.services.ollama_client import ollama_client

logger = logging.getLogger("chat_title_service")


def clean_heuristic_title(prompt: str) -> str:
    """
    Extracts a concise, professional 2-5 word chat title from a prompt by stripping
    conversational filler, question starters, and trailing clauses.
    """
    if not prompt:
        return "New Conversation"

    # Remove code blocks, markdown symbols, and normalize whitespace
    text = re.sub(r'[`*_#~>\[\]]', ' ', prompt).strip()
    text = re.sub(r'\s+', ' ', text)

    # If the text was truncated with ellipsis, strip it
    text = re.sub(r'[\.…]+$', '', text).strip()

    # Match specific domain phrases first for immediate recognition
    lower = text.lower()
    if "temperature control" in lower or ("temperature" in lower and "regulation" in lower):
        return "Temperature Control Regulations"
    if "mandatory inspection" in lower or ("inspection" in lower and "interval" in lower):
        return "Inspection Intervals & Compliance"
    if "asme section viii" in lower or ("asme" in lower and "pressure" in lower):
        return "ASME Pressure Vessel Specs"
    if "sop-401" in lower or ("boiler" in lower and "maintenance" in lower):
        return "SOP-401 Boiler Maintenance"
    if "safety" in lower and "air-gap" in lower:
        return "Air-Gap & Safety Policy"
    if "mawp" in lower or "working pressure" in lower:
        return "Pressure Vessel MAWP Limits"

    # Remove common question & conversational prefixes
    patterns = [
        r'^(?:can you|could you|please|kindly)\s+(?:help me\s+)?(?:to\s+)?(?:explain|show|tell me|give me|write|find|calculate|check|list|detail|summarize)\s+(?:about\s+|on\s+)?',
        r'^(?:what|where|when|why|how|which|who)\s+(?:is|are|was|were|do|does|did|can|should|would|to)\s+(?:the\s+|a\s+|an\s+)?',
        r'^(?:tell me about|explain|describe|show me|give me|list)\s+(?:the\s+|a\s+|an\s+)?',
        r'^(?:i want to|i need to|i would like to)\s+(?:know|understand|see|find|check)\s+(?:about\s+|on\s+)?',
    ]
    for p in patterns:
        text = re.sub(p, '', text, flags=re.IGNORECASE).strip()

    # Remove trailing question mark and generic enterprise suffixes
    text = re.sub(r'[\?\.\!]+$', '', text).strip()
    text = re.sub(r'\s+(?:of the company|in our company|for our company|for the company|please)$', '', text, flags=re.IGNORECASE).strip()

    words = text.split()
    if not words:
        words = prompt.split()

    # Cap at 4 to 5 words
    chosen_words = words[:5]
    title = " ".join(chosen_words).strip()
    
    # Capitalize each word properly
    return title.title() if title else "Engineering Inquiry"


async def generate_ai_chat_title(prompt: str, response_snippet: str = "") -> str:
    """
    Uses the local LLM to generate a concise, high-relevance 2-4 word title for a conversation.
    Falls back gracefully to the clean heuristic title.
    """
    fallback = clean_heuristic_title(prompt)
    if not prompt or len(prompt.strip()) < 5:
        return fallback

    title_prompt = (
        f"User query: {prompt[:250]}\n"
        f"Context snippet: {response_snippet[:250] if response_snippet else 'None'}\n\n"
        "TASK: Create a clean, concise 2 to 4 word title that categorizes this technical chat topic.\n"
        "RULES: Respond ONLY with the title. No quotes, no prefix like 'Title:', no punctuation, no other text."
    )

    try:
        raw_res = await ollama_client.generate_chat(
            messages=[{"role": "user", "content": title_prompt}],
            temperature=0.2,
        )
        if raw_res:
            cleaned = re.sub(r'["\':`*#_]', '', raw_res).strip()
            cleaned = re.sub(r'^(?:Title|Topic|Subject|Chat Name)\s*:\s*', '', cleaned, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r'[\.\?!]+$', '', cleaned).strip()
            words = cleaned.split()
            if 1 <= len(words) <= 6 and not any(bad in cleaned.lower() for bad in ["here is", "sure", "sorry", "cannot"]):
                return " ".join(words[:5]).title()
    except Exception as e:
        logger.debug(f"AI chat title generation failed: {e}")

    return fallback


async def update_session_title(
    db: AsyncSession,
    session_id: str,
    new_title: str
) -> bool:
    """Updates the chat title in SQLite database."""
    try:
        chat_sess = await db.get(DBChatSession, session_id)
        if chat_sess:
            chat_sess.title = new_title
        agent_sess = await db.get(AgentSession, session_id)
        if agent_sess:
            agent_sess.title = new_title
        await db.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to update session title for {session_id}: {e}")
        return False
