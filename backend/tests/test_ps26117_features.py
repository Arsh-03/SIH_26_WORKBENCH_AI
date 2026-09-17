import sys
from pathlib import Path
project_root = str(Path(__file__).resolve().parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import pytest
from backend.app.services.sandbox_service import sandbox_service
from backend.app.services.audit_pdf_service import audit_pdf_service
from backend.app.services.vector_store import (
    vector_store_service,
    tokenize_text,
    compute_bm25_score
)

@pytest.mark.anyio
async def test_sandbox_cgroup_isolation():
    res = await sandbox_service.execute_python_code('print("Sovereign Isolation Check")')
    assert res.exit_code == 0
    assert "Sovereign Isolation Check" in res.stdout
    assert res.isolation_mode in ["LINUX_CGROUP_RLIMIT", "DOCKER_NETWORK_NONE"]

@pytest.mark.anyio
async def test_sandbox_ipywidgets_calculation():
    code = (
        "import numpy as np\n"
        "from ipywidgets import interact\n\n"
        "def calculate_mawp_degradation(P, R, S, E, CA):\n"
        "    return (P * R) / (S * E - 0.6 * P) + CA\n\n"
        "res = calculate_mawp_degradation(3600, 47.24, 17000, 1.0, 0.118)\n"
        "print(f'CALCULATED_MAWP_DEG: {res:.2f}')\n"
    )
    res = await sandbox_service.execute_code(code=code, language="python")
    assert res.exit_code == 0
    assert "CALCULATED_MAWP_DEG" in res.stdout

def test_audit_pdf_generation():
    pdf_bytes = audit_pdf_service.generate_certificate_pdf(
        session_id="test_sess_mrpl_401",
        user_prompt_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        user_prompt_text="Recalibrate PRV-102 setpoint",
        tools_invoked=["rag_search", "sandbox_execute", "validator_agent"],
        citations=[{"document_id": "SOP-401_Industrial_Boiler_Operations.md", "snippet": "MAWP is 160 bar"}],
        duration_ms=380,
        compliance_status="COMPLIANCE_VERIFIED"
    )
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF")

def test_bm25_industrial_tag_scoring():
    query_tokens = tokenize_text("Verify PRV-102 recalibration limits per SOP-401")
    relevant_tokens = tokenize_text("MRPL SOP-401 Section 3: Safety relief valve PRV-102 reset to 120 bar")
    irrelevant_tokens = tokenize_text("Standard office cleaning protocol and meeting room reservation")

    score_rel = compute_bm25_score(query_tokens, relevant_tokens)
    score_irrel = compute_bm25_score(query_tokens, irrelevant_tokens)

    assert score_rel > score_irrel
    assert score_rel > 10.0
