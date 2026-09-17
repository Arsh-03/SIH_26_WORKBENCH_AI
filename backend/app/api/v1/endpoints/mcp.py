import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user, get_current_user_optional
from backend.app.database import get_db
from backend.app.models.schemas import McpApprovalDecision, McpApprovalResponse, McpServerHealth, McpServerHealthResponse
from backend.app.models.sql_models import McpApprovalAudit, User
from backend.app.services.mcp_service import decide_approval, get_approval, server_health

router = APIRouter()


@router.get("/servers", response_model=McpServerHealthResponse)
async def get_mcp_servers():
    return {"servers": server_health(), "checked_at": datetime.datetime.utcnow().isoformat() + "Z"}


@router.get("/servers/{server_id}", response_model=McpServerHealth)
async def get_mcp_server_health(server_id: str):
    server = next((item for item in server_health() if item["server_id"] == server_id), None)
    if not server:
        raise HTTPException(status_code=404, detail=f"Unknown MCP server: {server_id}")
    return server


@router.get("/approvals")
async def list_mcp_approvals(
    session_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = select(McpApprovalAudit).order_by(McpApprovalAudit.requested_at.desc()).limit(limit)
    if session_id:
        query = query.where(McpApprovalAudit.session_id == session_id)
    if current_user:
        query = query.where((McpApprovalAudit.user_id == current_user.id) | (McpApprovalAudit.user_id.is_(None)))
    result = await db.execute(query)
    rows = result.scalars().all()
    return [{"approval_id": row.id, "tool_call_id": row.tool_call_id, "server": row.server, "tool_name": row.tool_name, "status": row.status, "expires_at": row.expires_at.isoformat() + "Z", "failure_reason": row.failure_reason} for row in rows]


@router.post("/approvals/{tool_call_id}/decision", response_model=McpApprovalResponse)
async def decide_mcp_approval(
    tool_call_id: str,
    decision: McpApprovalDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    approval = await get_approval(db, tool_call_id)
    if not approval:
        raise HTTPException(status_code=404, detail="MCP approval request not found")
    updated = await decide_approval(db, approval, approved=decision.approved, user=current_user)
    return {"approval_id": updated.id, "tool_call_id": updated.tool_call_id, "status": updated.status, "failure_reason": updated.failure_reason, "decided_at": updated.decided_at.isoformat() + "Z" if updated.decided_at else None}