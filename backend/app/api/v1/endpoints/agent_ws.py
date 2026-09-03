import json
import logging
import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.database import AsyncSessionLocal
from backend.app.models.sql_models import AgentSession, Workspace
from backend.app.models.schemas import AgentRunRequest
from backend.app.services.agent_engine import agent_engine

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
            if action == "run_agent":
                # Validate payload with Pydantic
                try:
                    run_req = AgentRunRequest(**data)
                except Exception as val_err:
                    await websocket.send_json({"error": f"Schema validation error: {str(val_err)}"})
                    continue

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

                    sess = await db_session.get(AgentSession, session_id)
                    if not sess:
                        sess = AgentSession(
                            id=session_id,
                            workspace_id=run_req.workspace_id,
                            title=run_req.prompt[:50]
                        )
                        db_session.add(sess)
                        await db_session.commit()

                    async def send_frame(frame_dict: dict):
                        await websocket.send_json(frame_dict)

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
