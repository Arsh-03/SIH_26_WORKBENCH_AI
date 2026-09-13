import json
import logging
import datetime
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.database import AsyncSessionLocal
from backend.app.models.sql_models import AgentSession, Workspace, DBChatSession, DBChatMessage
from backend.app.models.schemas import AgentRunRequest
from backend.app.services.agent_engine import agent_engine
from backend.app.core.auth import decode_access_token

router = APIRouter()
logger = logging.getLogger("agent_ws")

@router.websocket("/ws/{session_id}")
async def agent_websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Real-time bilateral socket driving sovereign autonomous agent actions and canvas state synchronization.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected with session ID: {session_id}")

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception as e:
                await websocket.send_json({"error": f"Invalid JSON payload: {str(e)}"})
                continue

            action = data.get("action")
            if not action and "prompt" in data:
                action = "run_agent"

            if action == "run_agent":
                # Validate payload with Pydantic
                try:
                    run_req = AgentRunRequest(**data)
                except Exception as val_err:
                    await websocket.send_json({"error": f"Schema validation error: {str(val_err)}"})
                    continue

                # Extract user_id from auth token if present
                user_id = None
                token_str = data.get("token") or data.get("auth_token")
                if token_str:
                    payload = decode_access_token(token_str)
                    if payload:
                        user_id = payload.get("sub")

                async with AsyncSessionLocal() as db_session:
                    # Ensure workspace and session exist in database
                    ws = await db_session.get(Workspace, run_req.workspace_id)
                    if not ws:
                        ws = Workspace(
                            id=run_req.workspace_id,
                            name=f"Workspace {run_req.workspace_id}",
                            description="Auto-created for agent session"
                        )
                        db_session.add(ws)
                        await db_session.commit()

                    from backend.app.services.chat_title_service import clean_heuristic_title, generate_ai_chat_title

                    initial_title = clean_heuristic_title(run_req.prompt)

                    sess = await db_session.get(AgentSession, session_id)
                    if not sess:
                        sess = AgentSession(
                            id=session_id,
                            workspace_id=run_req.workspace_id,
                            title=initial_title
                        )
                        db_session.add(sess)
                        await db_session.commit()
                    elif sess.title and (sess.title.endswith("…") or sess.title.endswith("...") or sess.title.lower().startswith("what are the")):
                        sess.title = initial_title
                        await db_session.commit()

                    # Ensure DBChatSession exists
                    chat_sess = await db_session.get(DBChatSession, session_id)
                    if not chat_sess:
                        chat_sess = DBChatSession(
                            id=session_id,
                            user_id=user_id,
                            workspace_id=run_req.workspace_id,
                            title=initial_title,
                            preview=run_req.prompt[:80],
                            model="llama3.1:8b",
                            created_at=datetime.datetime.utcnow(),
                            updated_at=datetime.datetime.utcnow(),
                        )
                        db_session.add(chat_sess)
                        await db_session.commit()
                    else:
                        if user_id and not chat_sess.user_id:
                            chat_sess.user_id = user_id
                        # Heal past truncated titles
                        if not chat_sess.title or chat_sess.title.endswith("…") or chat_sess.title.endswith("...") or chat_sess.title.lower().startswith("what are the"):
                            chat_sess.title = initial_title
                        chat_sess.updated_at = datetime.datetime.utcnow()
                        await db_session.commit()

                    # Save user message to DBChatMessage only if not identical to the most recent message
                    from sqlalchemy import select
                    last_msg_stmt = (
                        select(DBChatMessage)
                        .where(DBChatMessage.session_id == session_id)
                        .order_by(DBChatMessage.created_at.desc())
                        .limit(1)
                    )
                    last_res = await db_session.execute(last_msg_stmt)
                    last_db_msg = last_res.scalars().first()

                    if not last_db_msg or last_db_msg.sender != "user" or last_db_msg.text != run_req.prompt:
                        user_msg = DBChatMessage(
                            id=f"user_{uuid.uuid4().hex[:12]}",
                            session_id=session_id,
                            sender="user",
                            text=run_req.prompt,
                            timestamp_label=datetime.datetime.utcnow().strftime("%I:%M %p"),
                            created_at=datetime.datetime.utcnow(),
                        )
                        db_session.add(user_msg)
                        await db_session.commit()

                    collected_thoughts = []

                    async def send_frame(frame_dict: dict):
                        await websocket.send_json(frame_dict)
                        # Collect reasoning steps
                        if frame_dict.get("event") == "thought" and frame_dict.get("content"):
                            collected_thoughts.append(frame_dict.get("content"))
                        elif frame_dict.get("event") == "tool_call":
                            collected_thoughts.append(f"Tool: {frame_dict.get('tool_name', 'tool')}")

                        # Save final answer to DBChatMessage
                        if frame_dict.get("event") == "final_answer":
                            try:
                                metrics = frame_dict.get("metrics", {})
                                artifact_dict = frame_dict.get("artifact")
                                model_msg = DBChatMessage(
                                    id=f"model_{uuid.uuid4().hex[:12]}",
                                    session_id=session_id,
                                    sender="model",
                                    text=frame_dict.get("content", ""),
                                    timestamp_label=datetime.datetime.utcnow().strftime("%I:%M %p"),
                                    model_used=metrics.get("model_used", "llama3.1:8b"),
                                    model_capability=metrics.get("model_capability", "general_chat"),
                                    routing_reason=metrics.get("routing_reason", "Dynamic Model Router allocation"),
                                    thinking_duration=f"{metrics.get('execution_time_ms', 420)}ms (Sovereign Enclave)",
                                    thinking_steps=json.dumps(collected_thoughts) if collected_thoughts else None,
                                    artifact=json.dumps(artifact_dict) if artifact_dict else None,
                                    created_at=datetime.datetime.utcnow(),
                                )
                                db_session.add(model_msg)
                                if chat_sess:
                                    chat_sess.preview = frame_dict.get("content", "")[:80]
                                    chat_sess.updated_at = datetime.datetime.utcnow()
                                await db_session.commit()

                                # Generate AI-refined chat title
                                try:
                                    refined_title = await generate_ai_chat_title(
                                        prompt=run_req.prompt,
                                        response_snippet=frame_dict.get("content", "")[:250]
                                    )
                                    if refined_title and chat_sess and refined_title != chat_sess.title:
                                        chat_sess.title = refined_title
                                        if sess:
                                            sess.title = refined_title
                                        await db_session.commit()
                                        await websocket.send_json({
                                            "event": "chat_renamed",
                                            "session_id": session_id,
                                            "title": refined_title
                                        })
                                except Exception as title_err:
                                    logger.debug(f"AI title generation error: {title_err}")
                            except Exception as save_err:
                                logger.error(f"Failed to auto-save model answer to DB: {save_err}")

                    await agent_engine.run_agent_loop(
                        session_id=session_id,
                        request=run_req,
                        db=db_session,
                        send_frame=send_frame
                    )
            elif action == "ping":
                await websocket.send_json({"event": "pong", "timestamp": datetime.datetime.utcnow().isoformat() + "Z"})
            else:
                await websocket.send_json({"error": f"Unknown action: {action}"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Unexpected WebSocket error for session {session_id}: {e}")

