import json
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.database import get_db
from backend.app.models.sql_models import DBChatSession, DBChatMessage, User
from backend.app.models.schemas import (
    ChatSessionCreateRequest,
    ChatSessionUpdateRequest,
    ChatSessionSummaryResponse,
    ChatSessionDetailResponse,
    ChatMessagePayload,
)
from backend.app.core.auth import get_current_user_optional
from backend.app.services.chat_title_service import clean_heuristic_title

router = APIRouter()

def format_relative_time(dt: datetime) -> str:
    """Format datetime into human-friendly relative time."""
    if not dt:
        return "Just now"
    now = datetime.utcnow()
    diff = now - dt
    if diff.total_seconds() < 60:
        return "Just now"
    elif diff.total_seconds() < 3600:
        mins = int(diff.total_seconds() // 60)
        return f"{mins}m ago"
    elif diff.total_seconds() < 86400:
        hours = int(diff.total_seconds() // 3600)
        return f"{hours}h ago"
    else:
        days = int(diff.total_seconds() // 86400)
        return f"{days}d ago"

def serialize_message(msg: DBChatMessage) -> ChatMessagePayload:
    steps = None
    if msg.thinking_steps:
        try:
            steps = json.loads(msg.thinking_steps)
        except Exception:
            steps = None

    artifact = None
    if msg.artifact:
        try:
            artifact = json.loads(msg.artifact)
        except Exception:
            artifact = None

    return ChatMessagePayload(
        id=msg.id,
        sender=msg.sender,
        text=msg.text,
        timestamp=msg.timestamp_label or format_relative_time(msg.created_at),
        modelUsed=msg.model_used,
        modelCapability=msg.model_capability,
        routingReason=msg.routing_reason,
        thinkingDuration=msg.thinking_duration,
        thinkingSteps=steps,
        artifact=artifact,
    )

def serialize_session_summary(sess: DBChatSession, count: int) -> ChatSessionSummaryResponse:
    dt = sess.updated_at or sess.created_at
    created_at_str = sess.created_at.isoformat() if hasattr(sess.created_at, "isoformat") else str(sess.created_at)
    
    # Auto-clean truncated or question-like chat titles
    raw_title = sess.title or ""
    if (
        not raw_title
        or raw_title == "New Conversation"
        or raw_title.endswith("…")
        or raw_title.endswith("...")
        or raw_title.lower().startswith("what are the")
        or raw_title.lower().startswith("can you")
        or raw_title.lower().startswith("what is")
    ):
        clean_title = clean_heuristic_title(sess.preview or raw_title)
        if clean_title and clean_title != "New Conversation":
            raw_title = clean_title

    return ChatSessionSummaryResponse(
        id=sess.id,
        title=raw_title,
        preview=sess.preview or "",
        timestamp=format_relative_time(dt),
        model=sess.model or "llama3.1:8b",
        isPinned=bool(sess.is_pinned),
        messageCount=count,
        path=f"/chat/{sess.id}",
        workspace_id=sess.workspace_id or "default_workspace",
        created_at=created_at_str,
    )

@router.get("", response_model=List[ChatSessionSummaryResponse])
async def list_chats(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chat sessions strictly belonging to the currently authenticated user."""
    if not current_user:
        return []

    stmt = select(DBChatSession).where(
        DBChatSession.user_id == current_user.id
    ).options(selectinload(DBChatSession.messages)).order_by(DBChatSession.updated_at.desc())

    res = await db.execute(stmt)
    sessions = res.scalars().all()

    summaries = []
    has_updates = False
    for s in sessions:
        msg_count = len(s.messages) if s.messages else 0
        summary = serialize_session_summary(s, msg_count)
        # Self-heal past truncated titles in the database
        if summary.title and summary.title != s.title:
            s.title = summary.title
            has_updates = True
        summaries.append(summary)

    if has_updates:
        try:
            await db.commit()
        except Exception:
            pass

    return summaries

@router.post("", response_model=ChatSessionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    req: ChatSessionCreateRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Create a new chat session in the SQLite database."""
    session_id = req.id or f"chat_{int(datetime.utcnow().timestamp() * 1000)}"
    user_id = current_user.id if current_user else None

    # Check if session already exists
    existing = await db.get(DBChatSession, session_id)
    if existing:
        if user_id and not existing.user_id:
            existing.user_id = user_id
            await db.commit()
        return ChatSessionDetailResponse(
            id=existing.id,
            title=existing.title,
            preview=existing.preview or "",
            timestamp=format_relative_time(existing.updated_at or existing.created_at),
            model=existing.model,
            isPinned=bool(existing.is_pinned),
            messageCount=0,
            path=f"/chat/{existing.id}",
            workspace_id=existing.workspace_id,
            messages=[],
            created_at=existing.created_at.isoformat() if hasattr(existing.created_at, "isoformat") else str(existing.created_at),
        )

    new_session = DBChatSession(
        id=session_id,
        user_id=user_id,
        workspace_id=req.workspace_id or "default_workspace",
        title=req.title,
        preview=req.preview or "",
        model=req.model or "llama3.1:8b",
        is_pinned=1 if req.is_pinned else 0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    created_at_str = new_session.created_at.isoformat() if hasattr(new_session.created_at, "isoformat") else str(new_session.created_at)
    return ChatSessionDetailResponse(
        id=new_session.id,
        title=new_session.title,
        preview=new_session.preview or "",
        timestamp="Just now",
        model=new_session.model,
        isPinned=bool(new_session.is_pinned),
        messageCount=0,
        path=f"/chat/{new_session.id}",
        workspace_id=new_session.workspace_id,
        messages=[],
        created_at=created_at_str,
    )

@router.get("/{session_id}", response_model=ChatSessionDetailResponse)
async def get_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full conversation history for a specific chat session."""
    stmt = select(DBChatSession).where(DBChatSession.id == session_id).options(selectinload(DBChatSession.messages))
    res = await db.execute(stmt)
    sess = res.scalars().first()

    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found."
        )

    # Deduplicate consecutive identical messages in session if any exist
    deduped_msgs = []
    for m in sess.messages:
        if deduped_msgs and deduped_msgs[-1].sender == m.sender and (deduped_msgs[-1].text or "").strip() == (m.text or "").strip():
            continue
        deduped_msgs.append(m)

    serialized_msgs = [serialize_message(m) for m in deduped_msgs]
    dt = sess.updated_at or sess.created_at
    created_at_str = sess.created_at.isoformat() if hasattr(sess.created_at, "isoformat") else str(sess.created_at)

    return ChatSessionDetailResponse(
        id=sess.id,
        title=sess.title,
        preview=sess.preview or "",
        timestamp=format_relative_time(dt),
        model=sess.model or "llama3.1:8b",
        isPinned=bool(sess.is_pinned),
        messageCount=len(serialized_msgs),
        path=f"/chat/{sess.id}",
        workspace_id=sess.workspace_id or "default_workspace",
        messages=serialized_msgs,
        created_at=created_at_str,
    )

@router.put("/{session_id}", response_model=ChatSessionSummaryResponse)
async def update_chat_session(
    session_id: str,
    req: ChatSessionUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update title, pinned status, or preview of a chat session."""
    stmt = select(DBChatSession).where(DBChatSession.id == session_id).options(selectinload(DBChatSession.messages))
    res = await db.execute(stmt)
    sess = res.scalars().first()

    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found."
        )

    if req.title is not None:
        sess.title = req.title
    if req.is_pinned is not None:
        sess.is_pinned = 1 if req.is_pinned else 0
    if req.preview is not None:
        sess.preview = req.preview
    sess.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(sess)

    msg_count = len(sess.messages) if sess.messages else 0
    return serialize_session_summary(sess, msg_count)

@router.delete("/{session_id}")
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete a chat session and all its associated messages."""
    stmt = select(DBChatSession).where(DBChatSession.id == session_id)
    res = await db.execute(stmt)
    sess = res.scalars().first()

    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found."
        )

    await db.delete(sess)
    await db.commit()
    return {"status": "success", "deleted_session_id": session_id}

@router.post("/{session_id}/messages", response_model=ChatMessagePayload)
async def add_chat_message(
    session_id: str,
    payload: ChatMessagePayload,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Append a user or model message to the chat session in SQLite."""
    sess = await db.get(DBChatSession, session_id)
    if not sess:
        # Auto-create session if it does not exist
        title = clean_heuristic_title(payload.text)
        sess = DBChatSession(
            id=session_id,
            user_id=current_user.id if current_user else None,
            workspace_id="default_workspace",
            title=title or "New Conversation",
            preview=payload.text[:80],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(sess)
        await db.commit()

    # Update session preview and updated_at
    if current_user and not sess.user_id:
        sess.user_id = current_user.id
    sess.preview = payload.text[:80] + ("…" if len(payload.text) > 80 else "")
    sess.updated_at = datetime.utcnow()

    msg_id = payload.id or f"{payload.sender}_{uuid.uuid4().hex[:12]}"
    
    thinking_steps_json = None
    if payload.thinkingSteps:
        thinking_steps_json = json.dumps(payload.thinkingSteps)

    artifact_json = None
    if payload.artifact:
        artifact_json = json.dumps(payload.artifact)

    new_msg = DBChatMessage(
        id=msg_id,
        session_id=session_id,
        sender=payload.sender,
        text=payload.text,
        timestamp_label=payload.timestamp or datetime.utcnow().strftime("%I:%M %p"),
        model_used=payload.modelUsed or "llama3.1:8b",
        model_capability=payload.modelCapability,
        routing_reason=payload.routingReason,
        thinking_duration=payload.thinkingDuration,
        thinking_steps=thinking_steps_json,
        artifact=artifact_json,
        created_at=datetime.utcnow()
    )

    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)

    return serialize_message(new_msg)
