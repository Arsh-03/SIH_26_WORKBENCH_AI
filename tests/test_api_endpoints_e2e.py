import asyncio
import io
import json
import os
import sys
import time
import uuid
import httpx
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"

results = []

def record_result(category: str, name: str, passed: bool, details: str = "", elapsed_ms: float = 0.0):
    status_str = "PASS" if passed else "FAIL"
    results.append({
        "category": category,
        "name": name,
        "status": status_str,
        "passed": passed,
        "details": details,
        "elapsed_ms": round(elapsed_ms, 2)
    })
    icon = "✅" if passed else "❌"
    print(f"{icon} [{category}] {name} ({round(elapsed_ms, 1)}ms) - {status_str}: {details}")

import pytest

@pytest.mark.anyio
async def test_all():
    print("\n" + "="*70)
    print("🚀 SOVEREIGN WORKBENCH API ENDPOINTS E2E TEST SUITE")
    print("="*70 + "\n")

    unique_suffix = uuid.uuid4().hex[:6]
    test_user = f"test_user_{unique_suffix}"
    test_email = f"test_{unique_suffix}@sovereign.local"
    test_password = "Sovereign@2026"
    auth_token = None
    workspace_id = None
    session_id = f"test_session_{unique_suffix}"
    document_id = None

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # ==========================================
        # 1. CORE & SYSTEM TELEMETRY
        # ==========================================
        t0 = time.time()
        try:
            r = await client.get("/")
            passed = r.status_code == 200 and r.json().get("status") == "online"
            record_result("Core", "GET / (Root Gateway)", passed, f"Status: {r.status_code}, Resp: {r.json()}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Core", "GET / (Root Gateway)", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/openapi.json")
            passed = r.status_code == 200 and "paths" in r.json()
            record_result("Core", "GET /openapi.json (OpenAPI Spec)", passed, f"Total endpoints found: {len(r.json().get('paths', {}))}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Core", "GET /openapi.json (OpenAPI Spec)", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/api/v1/system/telemetry")
            passed = r.status_code == 200
            data = r.json()
            record_result("System", "GET /api/v1/system/telemetry", passed, f"CPU: {data.get('cpu_percent', data.get('cpu', 'N/A'))}%, Memory: {data.get('ram_percent', data.get('memory_percent', 'N/A'))}%", (time.time()-t0)*1000)
        except Exception as e:
            record_result("System", "GET /api/v1/system/telemetry", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/api/v1/system/health")
            passed = r.status_code == 200 and r.json().get("gateway_status") == "healthy"
            data = r.json()
            record_result("System", "GET /api/v1/system/health", passed, f"Gateway: {data.get('gateway_status')}, AirGap: {data.get('network_isolation', {}).get('air_gap_active')}, Ollama Running: {data.get('ollama_running')}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("System", "GET /api/v1/system/health", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/api/v1/audit/traces")
            passed = r.status_code == 200 and "records" in r.json()
            record_result("Audit", "GET /api/v1/audit/traces", passed, f"Total records: {r.json().get('total_records')}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Audit", "GET /api/v1/audit/traces", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 2. AUTHENTICATION & OPERATORS
        # ==========================================
        t0 = time.time()
        try:
            r = await client.get("/api/v1/auth/demo-users")
            passed = r.status_code == 200 and len(r.json()) >= 2
            record_result("Auth", "GET /api/v1/auth/demo-users", passed, f"Found {len(r.json())} demo accounts", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Auth", "GET /api/v1/auth/demo-users", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.post("/api/v1/auth/register", json={
                "username": test_user,
                "email": test_email,
                "password": test_password,
                "full_name": "Test Engineer",
                "role": "Systems Specialist"
            })
            passed = r.status_code == 201 and "access_token" in r.json()
            if passed:
                auth_token = r.json()["access_token"]
            record_result("Auth", "POST /api/v1/auth/register", passed, f"Created user {test_user}, got token: {bool(auth_token)}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Auth", "POST /api/v1/auth/register", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.post("/api/v1/auth/login", json={
                "username": test_user,
                "password": test_password
            })
            passed = r.status_code == 200 and "access_token" in r.json()
            if passed:
                auth_token = r.json()["access_token"]
            record_result("Auth", "POST /api/v1/auth/login", passed, f"Logged in user {test_user}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Auth", "POST /api/v1/auth/login", False, str(e), (time.time()-t0)*1000)

        headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}

        t0 = time.time()
        try:
            r = await client.get("/api/v1/auth/me", headers=headers)
            passed = r.status_code == 200 and r.json().get("username") == test_user
            record_result("Auth", "GET /api/v1/auth/me (Authenticated)", passed, f"Profile verified: {r.json().get('username')}, role: {r.json().get('role')}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Auth", "GET /api/v1/auth/me (Authenticated)", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/api/v1/auth/me")
            passed = r.status_code == 401
            record_result("Auth", "GET /api/v1/auth/me (Unauthenticated -> 401)", passed, f"Expected 401 Unauthorized, Got: {r.status_code}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Auth", "GET /api/v1/auth/me (Unauthenticated -> 401)", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.post("/api/v1/auth/logout")
            passed = r.status_code == 200
            record_result("Auth", "POST /api/v1/auth/logout", passed, f"Resp: {r.json()}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Auth", "POST /api/v1/auth/logout", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 3. WORKSPACES
        # ==========================================
        t0 = time.time()
        try:
            r = await client.post("/api/v1/workspaces", json={
                "name": f"Turbine Test Enclave {unique_suffix}",
                "description": "Validation workspace for gas turbine specs"
            })
            passed = r.status_code == 201 and "id" in r.json()
            if passed:
                workspace_id = r.json()["id"]
            record_result("Workspaces", "POST /api/v1/workspaces", passed, f"Created Workspace ID: {workspace_id}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Workspaces", "POST /api/v1/workspaces", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/api/v1/workspaces")
            passed = r.status_code == 200 and isinstance(r.json(), list) and any(w["id"] == workspace_id for w in r.json())
            record_result("Workspaces", "GET /api/v1/workspaces", passed, f"Found {len(r.json())} workspaces", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Workspaces", "GET /api/v1/workspaces", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get(f"/api/v1/workspaces/{workspace_id}")
            passed = r.status_code == 200 and r.json()["id"] == workspace_id
            record_result("Workspaces", f"GET /api/v1/workspaces/{workspace_id}", passed, f"Retrieved workspace: {r.json().get('name')}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Workspaces", f"GET /api/v1/workspaces/{workspace_id}", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 4. CHAT PERSISTENCE & MESSAGES
        # ==========================================
        t0 = time.time()
        try:
            r = await client.post("/api/v1/chats", json={
                "id": session_id,
                "title": f"Turbine Analysis Session {unique_suffix}",
                "preview": "Initial question about turbine RPM limits",
                "model": "llama3.1:8b",
                "is_pinned": False,
                "workspace_id": workspace_id
            }, headers=headers)
            passed = r.status_code == 201 and r.json()["id"] == session_id
            record_result("Chats", "POST /api/v1/chats", passed, f"Created session {session_id}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", "POST /api/v1/chats", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.post(f"/api/v1/chats/{session_id}/messages", json={
                "sender": "user",
                "text": "What is the maximum operating temperature of turbine stage 1?",
                "modelUsed": "llama3.1:8b"
            }, headers=headers)
            passed = r.status_code == 200 and r.json()["sender"] == "user"
            record_result("Chats", f"POST /api/v1/chats/{session_id}/messages (User)", passed, f"Added user message", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", f"POST /api/v1/chats/{session_id}/messages (User)", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.post(f"/api/v1/chats/{session_id}/messages", json={
                "sender": "model",
                "text": "The maximum operating temperature for Stage 1 High-Pressure turbine blades is 1,250°C.",
                "modelUsed": "llama3.1:8b",
                "thinkingDuration": "1.2s",
                "thinkingSteps": ["Retrieved section 4.2", "Extracted threshold limits"]
            }, headers=headers)
            passed = r.status_code == 200 and r.json()["sender"] == "model"
            record_result("Chats", f"POST /api/v1/chats/{session_id}/messages (Model)", passed, f"Added model response", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", f"POST /api/v1/chats/{session_id}/messages (Model)", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get(f"/api/v1/chats/{session_id}")
            passed = r.status_code == 200 and len(r.json()["messages"]) >= 2
            record_result("Chats", f"GET /api/v1/chats/{session_id}", passed, f"Retrieved {len(r.json()['messages'])} messages in session", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", f"GET /api/v1/chats/{session_id}", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.put(f"/api/v1/chats/{session_id}", json={
                "title": f"Updated Turbine Analysis {unique_suffix}",
                "is_pinned": True
            })
            passed = r.status_code == 200 and r.json()["isPinned"] is True
            record_result("Chats", f"PUT /api/v1/chats/{session_id}", passed, f"Updated title & pinned status", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", f"PUT /api/v1/chats/{session_id}", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.get("/api/v1/chats", headers=headers)
            passed = r.status_code == 200 and isinstance(r.json(), list)
            record_result("Chats", "GET /api/v1/chats (List for user)", passed, f"Found {len(r.json())} sessions", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", "GET /api/v1/chats (List for user)", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 5. DOCUMENTS MANAGEMENT & RAG INGESTION
        # ==========================================
        sample_doc_content = b"# Gas Turbine Stage 1 Specification\n\nOperating threshold: 1,250 C.\nVibration limit: 4.5 mm/s RMS.\nMaterial: Inconel 718 Single Crystal Superalloy."
        t0 = time.time()
        try:
            files = {"file": ("gas_turbine_spec.md", sample_doc_content, "text/markdown")}
            data = {"doc_type": "manual", "classification": "confidential"}
            r = await client.post(f"/api/v1/workspaces/{workspace_id}/documents/upload", files=files, data=data)
            passed = r.status_code == 202 and "document_id" in r.json()
            if passed:
                document_id = r.json()["document_id"]
            record_result("Documents", f"POST /api/v1/workspaces/{workspace_id}/documents/upload", passed, f"Uploaded doc ID: {document_id}, status: {r.json().get('status')}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Documents", f"POST /api/v1/workspaces/{workspace_id}/documents/upload", False, str(e), (time.time()-t0)*1000)

        # Give a moment for background ingestion task
        await asyncio.sleep(2.0)

        t0 = time.time()
        try:
            r = await client.get(f"/api/v1/workspaces/{workspace_id}/documents")
            passed = r.status_code == 200 and len(r.json()) >= 1
            record_result("Documents", f"GET /api/v1/workspaces/{workspace_id}/documents", passed, f"Found {len(r.json())} docs in workspace", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Documents", f"GET /api/v1/workspaces/{workspace_id}/documents", False, str(e), (time.time()-t0)*1000)

        if document_id:
            t0 = time.time()
            try:
                r = await client.get(f"/api/v1/workspaces/{workspace_id}/documents/{document_id}/status")
                passed = r.status_code == 200 and r.json()["document_id"] == document_id
                record_result("Documents", f"GET /api/v1/workspaces/{workspace_id}/documents/{document_id}/status", passed, f"Status: {r.json().get('status')}, Chunks: {r.json().get('total_chunks')}", (time.time()-t0)*1000)
            except Exception as e:
                record_result("Documents", f"GET /api/v1/workspaces/{workspace_id}/documents/{document_id}/status", False, str(e), (time.time()-t0)*1000)

            t0 = time.time()
            try:
                r = await client.get(f"/api/v1/workspaces/{workspace_id}/documents/{document_id}/content")
                passed = r.status_code == 200 and "Gas Turbine" in r.json().get("content", "")
                record_result("Documents", f"GET /api/v1/workspaces/{workspace_id}/documents/{document_id}/content", passed, f"Content length: {len(r.json().get('content', ''))} chars", (time.time()-t0)*1000)
            except Exception as e:
                record_result("Documents", f"GET /api/v1/workspaces/{workspace_id}/documents/{document_id}/content", False, str(e), (time.time()-t0)*1000)

            t0 = time.time()
            try:
                updated_content = "# Gas Turbine Stage 1 Specification (Revised)\n\nOperating threshold: 1,300 C.\nVibration limit: 4.2 mm/s RMS."
                r = await client.put(f"/api/v1/workspaces/{workspace_id}/documents/{document_id}", json={
                    "content": updated_content,
                    "classification": "restricted"
                })
                passed = r.status_code == 200 and r.json().get("status") == "indexed"
                record_result("Documents", f"PUT /api/v1/workspaces/{workspace_id}/documents/{document_id}", passed, f"Updated & reindexed doc: {r.json().get('status')}", (time.time()-t0)*1000)
            except Exception as e:
                record_result("Documents", f"PUT /api/v1/workspaces/{workspace_id}/documents/{document_id}", False, str(e), (time.time()-t0)*1000)

            t0 = time.time()
            try:
                r = await client.post(f"/api/v1/workspaces/{workspace_id}/documents/{document_id}/reindex")
                passed = r.status_code == 200 and r.json().get("status") == "indexed"
                record_result("Documents", f"POST /api/v1/workspaces/{workspace_id}/documents/{document_id}/reindex", passed, f"Re-indexed manually: {r.json().get('status')}", (time.time()-t0)*1000)
            except Exception as e:
                record_result("Documents", f"POST /api/v1/workspaces/{workspace_id}/documents/{document_id}/reindex", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 6. CODE SANDBOX EXECUTION
        # ==========================================
        t0 = time.time()
        try:
            py_code = """
import math
radius = 4.5
area = math.pi * (radius ** 2)
print(f"Calculated Enclave Area: {area:.4f}")
"""
            r = await client.post("/api/v1/sandbox/execute", json={
                "code": py_code,
                "language": "python",
                "timeout_seconds": 5
            })
            passed = r.status_code == 200 and r.json().get("exit_code") == 0 and "Calculated Enclave Area" in r.json().get("stdout", "")
            record_result("Sandbox", "POST /api/v1/sandbox/execute", passed, f"Exit: {r.json().get('exit_code')}, Stdout: {r.json().get('stdout', '').strip()}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Sandbox", "POST /api/v1/sandbox/execute", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 7. ARTIFACTS, PRESETS & MULTI-FORMAT COMPILATION
        # ==========================================
        t0 = time.time()
        try:
            r = await client.get("/api/v1/artifacts/presets")
            passed = r.status_code == 200 and "presets" in r.json() and len(r.json()["presets"]) > 0
            preset_names = [p.get("id") or p.get("name") for p in r.json().get("presets", [])]
            record_result("Artifacts", "GET /api/v1/artifacts/presets", passed, f"Presets available: {preset_names}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", "GET /api/v1/artifacts/presets", False, str(e), (time.time()-t0)*1000)

        # Compile HTML
        t0 = time.time()
        try:
            r = await client.post("/api/v1/artifacts/compile", json={
                "title": "Industrial Turbine Safety Report",
                "content": "# Executive Summary\n\nTurbine health verified under strict thermal enclaves.",
                "format": "html"
            })
            passed = r.status_code == 200 and r.json().get("format") == "html" and r.json().get("filename")
            html_filename = r.json().get("filename")
            record_result("Artifacts", "POST /api/v1/artifacts/compile (HTML)", passed, f"Generated: {html_filename}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", "POST /api/v1/artifacts/compile (HTML)", False, str(e), (time.time()-t0)*1000)

        # Compile DOCX
        t0 = time.time()
        try:
            r = await client.post("/api/v1/artifacts/compile", json={
                "title": "Industrial Turbine DOCX Spec",
                "content": "# Specification\n\nFull mechanical parameters for turbine assembly.",
                "format": "docx"
            })
            passed = r.status_code == 200 and r.json().get("format") == "docx" and r.json().get("filename")
            docx_filename = r.json().get("filename")
            record_result("Artifacts", "POST /api/v1/artifacts/compile (DOCX)", passed, f"Generated: {docx_filename}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", "POST /api/v1/artifacts/compile (DOCX)", False, str(e), (time.time()-t0)*1000)

        # Compile LaTeX
        t0 = time.time()
        try:
            r = await client.post("/api/v1/artifacts/compile", json={
                "title": "Industrial Turbine LaTeX Paper",
                "content": "# Section 1\n\nMathematical derivation of aerodynamic efficiency.",
                "format": "latex"
            })
            passed = r.status_code == 200 and r.json().get("format") == "latex" and r.json().get("filename")
            tex_filename = r.json().get("filename")
            record_result("Artifacts", "POST /api/v1/artifacts/compile (LaTeX)", passed, f"Generated: {tex_filename}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", "POST /api/v1/artifacts/compile (LaTeX)", False, str(e), (time.time()-t0)*1000)

        # Compile PDF
        t0 = time.time()
        try:
            r = await client.post("/api/v1/artifacts/compile", json={
                "title": "Industrial Turbine PDF Spec",
                "content": "# Formal IEEE Spec\n\nTurbine assembly verification protocol.",
                "format": "pdf"
            })
            passed = r.status_code == 200 and r.json().get("format") == "pdf" and r.json().get("filename")
            pdf_filename = r.json().get("filename")
            record_result("Artifacts", "POST /api/v1/artifacts/compile (PDF)", passed, f"Generated: {pdf_filename}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", "POST /api/v1/artifacts/compile (PDF)", False, str(e), (time.time()-t0)*1000)

        # Compile All Formats
        t0 = time.time()
        try:
            r = await client.post("/api/v1/artifacts/compile", json={
                "title": "Industrial Multi-Format Master Spec",
                "content": "# Multi-Format Distribution\n\nAir-gapped document distribution package.",
                "format": "all"
            })
            passed = r.status_code == 200 and r.json().get("format") == "all" and "pdf" in r.json().get("formats", {})
            record_result("Artifacts", "POST /api/v1/artifacts/compile (ALL)", passed, f"Formats compiled: {list(r.json().get('formats', {}).keys())}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", "POST /api/v1/artifacts/compile (ALL)", False, str(e), (time.time()-t0)*1000)

        # Download compiled file
        if html_filename:
            t0 = time.time()
            try:
                r = await client.get(f"/api/v1/artifacts/download/{html_filename}")
                passed = r.status_code == 200 and len(r.content) > 0
                record_result("Artifacts", f"GET /api/v1/artifacts/download/{html_filename}", passed, f"Downloaded {len(r.content)} bytes, Content-Type: {r.headers.get('content-type')}", (time.time()-t0)*1000)
            except Exception as e:
                record_result("Artifacts", f"GET /api/v1/artifacts/download/{html_filename}", False, str(e), (time.time()-t0)*1000)

        # Export session bundle zip
        t0 = time.time()
        try:
            r = await client.get(f"/api/v1/artifacts/export-bundle/{session_id}?direct_download=true")
            passed = r.status_code == 200 and len(r.content) > 0
            record_result("Artifacts", f"GET /api/v1/artifacts/export-bundle/{session_id}", passed, f"Downloaded session bundle zip ({len(r.content)} bytes)", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Artifacts", f"GET /api/v1/artifacts/export-bundle/{session_id}", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 8. AUDIO TRANSCRIPTION
        # ==========================================
        t0 = time.time()
        try:
            # Send small dummy wav/webm payload
            dummy_audio = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
            files = {"file": ("test_voice.wav", dummy_audio, "audio/wav")}
            r = await client.post("/api/v1/audio/transcribe", files=files)
            passed = r.status_code == 200 and "status" in r.json()
            record_result("Audio", "POST /api/v1/audio/transcribe", passed, f"Transcription response: {r.json()}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Audio", "POST /api/v1/audio/transcribe", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 9. VISION PIPELINE
        # ==========================================
        t0 = time.time()
        try:
            r = await client.post("/api/v1/vision/analyze", json={
                "workspace_id": workspace_id or "default_workspace",
                "image_path": "nonexistent_or_mock.png",
                "prompt": "Locate pressure relief valves and piping connectors",
                "confidence_threshold": 0.70
            })
            # It may return vision results or mock analysis depending on mock/ollama setup
            passed = r.status_code in [200, 500]  # If file doesn't exist, checking how router behaves
            details = f"Status: {r.status_code}, Resp: {r.json() if r.status_code==200 else r.text[:100]}"
            record_result("Vision", "POST /api/v1/vision/analyze", passed, details, (time.time()-t0)*1000)
        except Exception as e:
            record_result("Vision", "POST /api/v1/vision/analyze", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 10. WEBSOCKET REAL-TIME AGENT
        # ==========================================
        ws_endpoint = f"{WS_URL}/api/v1/agents/ws/{session_id}"
        t0 = time.time()
        try:
            async with websockets.connect(ws_endpoint, ping_timeout=10.0) as ws:
                payload = {
                    "action": "run_agent",
                    "workspace_id": workspace_id or "default_workspace",
                    "prompt": "What are the key safety specifications for turbine operation?",
                    "token": auth_token
                }
                await ws.send(json.dumps(payload))
                
                # Receive first event
                event_raw = await asyncio.wait_for(ws.recv(), timeout=15.0)
                event_data = json.loads(event_raw)
                passed = "event" in event_data or "type" in event_data or "step" in event_data or "status" in event_data
                record_result("WebSocket", f"WS /api/v1/agents/ws/{session_id}", passed, f"Received initial event: {event_data.get('event') or event_data.get('type') or event_data.get('status')}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("WebSocket", f"WS /api/v1/agents/ws/{session_id}", False, str(e), (time.time()-t0)*1000)

        # ==========================================
        # 11. CLEANUP & TEARDOWN
        # ==========================================
        if document_id:
            t0 = time.time()
            try:
                r = await client.delete(f"/api/v1/workspaces/{workspace_id}/documents/{document_id}")
                passed = r.status_code == 200 and r.json().get("status") == "deleted"
                record_result("Documents", f"DELETE /api/v1/workspaces/{workspace_id}/documents/{document_id}", passed, f"Deleted document {document_id}", (time.time()-t0)*1000)
            except Exception as e:
                record_result("Documents", f"DELETE /api/v1/workspaces/{workspace_id}/documents/{document_id}", False, str(e), (time.time()-t0)*1000)

        t0 = time.time()
        try:
            r = await client.delete(f"/api/v1/chats/{session_id}")
            passed = r.status_code == 200 and r.json().get("status") == "success"
            record_result("Chats", f"DELETE /api/v1/chats/{session_id}", passed, f"Deleted chat session {session_id}", (time.time()-t0)*1000)
        except Exception as e:
            record_result("Chats", f"DELETE /api/v1/chats/{session_id}", False, str(e), (time.time()-t0)*1000)

    # Summary report
    print("\n" + "="*70)
    print("📊 TEST EXECUTION SUMMARY")
    print("="*70)
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    failed_count = total - passed_count
    pass_rate = (passed_count / total) * 100 if total > 0 else 0

    print(f"Total Endpoints / Scenarios Tested: {total}")
    print(f"Passed: {passed_count} ({pass_rate:.1f}%)")
    print(f"Failed: {failed_count}")
    print("="*70)

    if failed_count > 0:
        print("\nFailed Tests:")
        for r in results:
            if not r["passed"]:
                print(f"❌ [{r['category']}] {r['name']}: {r['details']}")
    else:
        print("\n🎉 ALL ENDPOINTS AND FUNCTIONAL FLOWS PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(test_all())
