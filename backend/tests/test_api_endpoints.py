import sys
from pathlib import Path

# Add project root to sys.path so 'backend' package is resolvable
project_root = str(Path(__file__).resolve().parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import io
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db_sync

init_db_sync()
client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["air_gap_enforced"] is True

def test_system_health():
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    data = response.json()
    assert data["gateway_status"] == "healthy"
    assert data["network_isolation"]["air_gap_active"] is True
    assert data["network_isolation"]["bytes_sent_external"] == 0
    assert len(data["loaded_models"]) >= 3

def test_workspaces_crud():
    # 1. Create Workspace
    create_res = client.post(
        "/api/v1/workspaces",
        json={"name": "Alpha Enclave", "description": "High security workspace"}
    )
    assert create_res.status_code == 201
    ws_data = create_res.json()
    ws_id = ws_data["id"]
    assert ws_data["name"] == "Alpha Enclave"

    # 2. List Workspaces
    list_res = client.get("/api/v1/workspaces")
    assert list_res.status_code == 200
    workspaces = list_res.json()
    assert any(w["id"] == ws_id for w in workspaces)

    # 3. Get Workspace
    get_res = client.get(f"/api/v1/workspaces/{ws_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == ws_id

def test_document_upload_and_status():
    # Create workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Docs Workspace"})
    ws_id = ws_res.json()["id"]

    # Upload document
    file_content = b"Section 4.1: MAWP is rated at 160 bar up to 350 deg C. Degradation factor applies above 350 deg C."
    files = {
        "file": ("boiler_pressure_manual.txt", io.BytesIO(file_content), "text/plain")
    }
    data = {
        "doc_type": "manual",
        "classification": "confidential"
    }
    upload_res = client.post(f"/api/v1/workspaces/{ws_id}/documents/upload", data=data, files=files)
    assert upload_res.status_code == 202
    upload_data = upload_res.json()
    doc_id = upload_data["document_id"]
    assert upload_data["status"] == "queued"

    # Check status
    status_res = client.get(f"/api/v1/workspaces/{ws_id}/documents/{doc_id}/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["document_id"] == doc_id
    assert status_data["vector_dimensions"] == 768

def test_sandbox_execution():
    code = "import sys\nprint('MEAN:', 14.725)\n"
    payload = {
        "code": code,
        "language": "python",
        "timeout_seconds": 5,
        "memory_limit_mb": 256
    }
    res = client.post("/api/v1/sandbox/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["exit_code"] == 0
    assert "MEAN: 14.725" in data["stdout"]
    assert data["limits_exceeded"] is False

def test_vision_analyze():
    payload = {
        "workspace_id": "ws_alpha_01",
        "image_path": "storage/uploads/drawing.png",
        "prompt": "Identify all control valves and pressure indicators.",
        "confidence_threshold": 0.70
    }
    res = client.post("/api/v1/vision/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["detected_elements"]) > 0
    assert data["detected_elements"][0]["bounding_box_2d"] is not None

def test_audit_traces():
    res = client.get("/api/v1/audit/traces")
    assert res.status_code == 200
    data = res.json()
    assert "records" in data
    assert "total_records" in data

def test_websocket_agent():
    with client.websocket_connect("/api/v1/agents/ws/sess_test_01") as websocket:
        req = {
            "action": "run_agent",
            "workspace_id": "ws_test_ws",
            "prompt": "Extract MAWP and plot thermal stress degradation.",
            "active_document_ids": [],
            "allowed_tools": ["rag_search", "sandbox_execute"],
            "temperature": 0.1
        }
        websocket.send_json(req)

        # Receive thought frame
        f1 = websocket.receive_json()
        assert f1["event"] == "thought"

        # Receive tool call frame
        f2 = websocket.receive_json()
        assert f2["event"] == "tool_call"

        # Receive tool result frame
        f3 = websocket.receive_json()
        assert f3["event"] == "tool_result"

        # Receive tool call frame (sandbox)
        f4 = websocket.receive_json()
        assert f4["event"] == "tool_call"

        # Receive tool result frame (sandbox)
        f5 = websocket.receive_json()
        assert f5["event"] == "tool_result"

        # Receive final answer frame
        f6 = websocket.receive_json()
        assert f6["event"] == "final_answer"
        assert f6["metrics"]["air_gap_intact"] is True

if __name__ == "__main__":
    print("Running backend test suite...")
    test_root()
    print("✓ test_root passed")
    test_system_health()
    print("✓ test_system_health passed")
    test_workspaces_crud()
    print("✓ test_workspaces_crud passed")
    test_document_upload_and_status()
    print("✓ test_document_upload_and_status passed")
    test_sandbox_execution()
    print("✓ test_sandbox_execution passed")
    test_vision_analyze()
    print("✓ test_vision_analyze passed")
    test_audit_traces()
    print("✓ test_audit_traces passed")
    test_websocket_agent()
    print("✓ test_websocket_agent passed")
    print("\n=== ALL TESTS PASSED! ===")
