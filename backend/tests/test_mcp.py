from pathlib import Path
import sys
import uuid
from types import SimpleNamespace

project_root = str(Path(__file__).resolve().parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from fastapi.testclient import TestClient

from backend.app.database import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.schemas import McpApprovalContract
from backend.app.services.mcp_service import (
    MCP_CATALOG,
    create_approval,
    decide_approval,
    has_permission,
    record_execution_result,
    server_health,
)


client = TestClient(app)


def test_mcp_health_returns_all_local_servers():
    response = client.get("/api/v1/mcp/servers")
    assert response.status_code == 200
    payload = response.json()
    assert {server["server_id"] for server in payload["servers"]} == set(MCP_CATALOG)
    assert all(server["zero_egress"] is True for server in payload["servers"])
    assert all("capabilities" in server and "permissions" in server for server in payload["servers"])
    assert all(server["status"] in {"online", "offline"} for server in payload["servers"])
    assert all(server["version"] is not None or server["failure_reason"] for server in payload["servers"])


def test_mcp_server_specific_health_routes_are_typed_and_available():
    for server_id in ("smtp_mcp", "alert_mcp", "historian_mcp"):
        response = client.get(f"/api/v1/mcp/servers/{server_id}")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["server_id"] == server_id
        assert payload["status"] in {"online", "offline"}
        assert payload["zero_egress"] is True


def test_mcp_permission_policy_allows_operator_and_denies_researcher():
    assert has_permission(SimpleNamespace(role="Lead Operations Engineer"), "alert_mcp") is True
    assert has_permission(SimpleNamespace(role="Senior ML Researcher"), "alert_mcp") is False
    assert has_permission(None, "smtp_mcp") is False


def test_mcp_catalog_declares_required_capabilities():
    assert "send_shift_report" in MCP_CATALOG["smtp_mcp"]["capabilities"]
    assert "dispatch_alarm" in MCP_CATALOG["alert_mcp"]["capabilities"]
    assert "query_historian" in MCP_CATALOG["historian_mcp"]["capabilities"]


def test_mcp_approval_contract_matches_required_envelope():
    payload = {
        "action": "mcp_approval",
        "tool_call_id": "call_123",
        "approved": True,
        "tool_name": "alert_mcp.dispatch_alarm",
        "server": "alert_mcp",
        "parameters": {"target": "duty-engineer", "message": "Pressure alarm requires review"},
    }
    model = McpApprovalContract(**payload)
    assert model.action == "mcp_approval"
    assert model.server == "alert_mcp"
    assert model.approved is True


def test_mcp_approval_and_rejection_flow():
    import asyncio

    async def run_flow():
        async with AsyncSessionLocal() as db:
            approval = await create_approval(
                db,
                tool_call_id=f"approval_{uuid.uuid4().hex[:12]}",
                session_id="sess_approval_test",
                user_id="user_1",
                server="smtp_mcp",
                tool_name="smtp_mcp.send_shift_report",
                parameters={"to": "ops@example.com"},
            )
            approved = await decide_approval(
                db,
                approval,
                approved=True,
                user=SimpleNamespace(role="Lead Operations Engineer"),
            )
            assert approved.status == "approved"

            second = await create_approval(
                db,
                tool_call_id=f"approval_{uuid.uuid4().hex[:12]}",
                session_id="sess_approval_test",
                user_id="user_2",
                server="alert_mcp",
                tool_name="alert_mcp.dispatch_alarm",
                parameters={"target": "duty-engineer"},
            )
            rejected = await decide_approval(
                db,
                second,
                approved=False,
                user=SimpleNamespace(role="Senior ML Researcher"),
            )
            assert rejected.status == "rejected"
            assert "permission" in (rejected.failure_reason or "").lower()

    asyncio.run(run_flow())


def test_mcp_duplicate_decisions_are_ignored_after_first_commit():
    import asyncio

    async def run_flow():
        async with AsyncSessionLocal() as db:
            approval = await create_approval(
                db,
                tool_call_id=f"duplicate_{uuid.uuid4().hex[:12]}",
                session_id="sess_duplicate",
                user_id="user_1",
                server="historian_mcp",
                tool_name="historian_mcp.query_historian",
                parameters={"query": "SELECT * FROM telemetry"},
            )
            first = await decide_approval(
                db,
                approval,
                approved=True,
                user=SimpleNamespace(role="Lead Operations Engineer"),
            )
            second = await decide_approval(
                db,
                approval,
                approved=False,
                user=SimpleNamespace(role="Lead Operations Engineer"),
            )
            assert first.status == "approved"
            assert second.status == "approved"

    asyncio.run(run_flow())


def test_mcp_expired_approval_is_cancelled():
    import asyncio

    async def run_flow():
        async with AsyncSessionLocal() as db:
            approval = await create_approval(
                db,
                tool_call_id=f"expired_{uuid.uuid4().hex[:12]}",
                session_id="sess_expired",
                user_id="user_1",
                server="smtp_mcp",
                tool_name="smtp_mcp.send_engineering_email",
                parameters={"to": "ops@example.com"},
                ttl_seconds=-1,
            )
            updated = await decide_approval(
                db,
                approval,
                approved=True,
                user=SimpleNamespace(role="Lead Operations Engineer"),
            )
            assert updated.status == "cancelled"
            assert "expired" in (updated.failure_reason or "").lower()

    asyncio.run(run_flow())


def test_mcp_execution_result_is_persisted_as_audit_record():
    import asyncio

    async def run_flow():
        async with AsyncSessionLocal() as db:
            approval = await create_approval(
                db,
                tool_call_id=f"execution_{uuid.uuid4().hex[:12]}",
                session_id="sess_execution",
                user_id="user_1",
                server="alert_mcp",
                tool_name="alert_mcp.dispatch_alarm",
                parameters={"target": "duty-engineer"},
            )
            await decide_approval(
                db,
                approval,
                approved=True,
                user=SimpleNamespace(role="Lead Operations Engineer"),
            )
            completed = await record_execution_result(
                db,
                approval,
                completed=True,
                failure_reason=None,
            )
            assert completed.status == "completed"
            assert completed.completed_at is not None

    asyncio.run(run_flow())


def test_mcp_server_health_uses_real_status_values():
    health = server_health()
    assert {server["server_id"] for server in health} == set(MCP_CATALOG)
    assert all(server["status"] in {"online", "offline"} for server in health)
    assert all(server["capabilities"] for server in health)
    assert all(server["permissions"] for server in health)