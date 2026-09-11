"""
Document Presets and Structured Templates for Sovereign Engineering Workbench
Provides pre-configured technical document templates with structured placeholders.
"""

from typing import Dict, Any, List

DOCUMENT_PRESETS: Dict[str, Dict[str, Any]] = {
    "engineering_design_spec": {
        "id": "engineering_design_spec",
        "name": "Engineering Design Specification",
        "description": "Formal technical specification covering architectural design, algorithmic complexity, data structures, and verification protocols.",
        "badge": "SPEC-IEEE-830",
        "template": """# Engineering Design Specification: {title}

**Document Reference:** SEW-EDS-{doc_ref}  
**Classification:** SOVEREIGN ENCLAVE CONFIDENTIAL  
**Author:** {author_name} ({author_title})  
**Target Environment:** Air-Gapped High-Assurance Enclave  
**Date:** {date}  

---

## 1. Executive Summary & Objective
{objective}

## 2. System Architecture & Component Design
- **Core Engine:** Localized Inference Node
- **Isolation Boundary:** Zero outbound egress enforced via kernel netfilter
- **Execution Sandbox:** Isolated process enclave with memory/CPU cgroups

```text
+-----------------------------------------------------------+
|               SOVEREIGN SECURE ENCLAVE                    |
|  +--------------------+        +-----------------------+  |
|  | Frontend Terminal  | <----> | FastAPI Local Gateway |  |
|  +--------------------+        +-----------------------+  |
|                                            |              |
|                                            v              |
|                                +-----------------------+  |
|                                | Local Reasoning Engine|  |
|                                +-----------------------+  |
+-----------------------------------------------------------+
```

## 3. Algorithmic Complexity & Data Structures
- **Time Complexity:** $\mathcal{{O}}(N \log N)$ average query routing time.
- **Space Complexity:** $\mathcal{{O}}(K)$ where $K$ represents local context cache vectors.
- **Key Invariants:** All intermediate tensor allocations must stay within physical VRAM limits.

## 4. Verification & Validation Protocol
1. **Unit Verification:** Assert memory allocation zero-leak invariants.
2. **Integration Testing:** Validate local IPC socket latency under 15ms.
3. **Safety Analysis:** Verify zero network socket establishment on external adapters.

## 5. Compliance & Regulatory Standards
- **ISO/IEC 27001:** Enclave isolation controls
- **ASME / NIST SP 800-53:** Access Control and Cryptographic Boundary Verification
"""
    },
    "incident_post_mortem": {
        "id": "incident_post_mortem",
        "name": "Incident Post-Mortem & RCA",
        "description": "Comprehensive operational root-cause analysis, chronological timeline, impact metrics, and corrective actions.",
        "badge": "OPS-RCA-REV1",
        "template": """# Incident Post-Mortem: {title}

**Incident Identifier:** INC-{doc_ref}  
**Severity Level:** SEV-1 (CRITICAL DEGRADATION)  
**Lead Investigator:** {author_name} ({author_title})  
**Status:** RESOLVED / CLOSED  
**Date of Incident:** {date}  

---

## 1. Incident Overview & Impact Summary
- **Impact Duration:** {impact_duration}
- **Affected Subsystems:** Hardware Acceleration, Inference Gateway
- **User Impact:** Degraded token stream throughput during peak cycle

## 2. Chronological Incident Timeline
| Time (UTC) | Event Description | Detected By | Mitigation Step |
| :--- | :--- | :--- | :--- |
| **00:00:00** | Initial thermal threshold reached on primary GPU | Telemetry Daemon | Fan duty cycle escalated |
| **00:04:15** | Memory allocation spike detected in scratchpad buffer | VRAM Monitor | Process throttled |
| **00:08:30** | Fallback compute enclave engaged | Failover Sentinel | Service restored to nominal |

## 3. Root Cause Analysis (5 Whys)
1. **Why did the failure occur?** Context window allocation exceeded the allocated 16GB VRAM slab.
2. **Why was memory exceeded?** Batch size concurrency limit was set higher than single-card capacity.
3. **Why was concurrency set higher?** Auto-scaling configuration didn't account for air-gapped memory boundaries.
4. **Why was it not caught in staging?** Synthetic tests utilized quantized embeddings.
5. **Root Cause:** Inadequate dynamic VRAM headroom enforcement under peak concurrent requests.

## 4. Immediate & Long-Term Corrective Actions
- [x] **Immediate:** Enforce strict dynamic VRAM threshold at 85% utilization with automatic offloading.
- [ ] **Long-Term:** Implement local token rate smoothing and predictive memory paging.
"""
    },
    "standard_operating_procedure": {
        "id": "standard_operating_procedure",
        "name": "Standard Operating Procedure (SOP)",
        "description": "Authoritative procedural guide with prerequisite safety checks, sequential operational steps, and ISO references.",
        "badge": "SOP-ENG-STD",
        "template": """# Standard Operating Procedure: {title}

**SOP Reference Code:** SOP-AIRGAP-{doc_ref}  
**Revision:** 2.0 (AIR-GAP CERTIFIED)  
**Author:** {author_name} ({author_title})  
**Effective Date:** {date}  

---

## 1. Purpose & Scope
This Standard Operating Procedure establishes the mandatory protocol for {objective} within the Sovereign Engineering Workbench enclave.

## 2. Safety & Environmental Prerequisites
> **MANDATORY NOTICE:** Before beginning operations, verify that physical ethernet links to external wide-area networks are disconnected and hardware cryptographic switches are enabled.

- [ ] Verify GPU temperature below 65°C
- [ ] Ensure local host RAM availability > 8.0 GB
- [ ] Confirm air-gap verification sentinel returns `AIR_GAP_PASSED`

## 3. Step-by-Step Execution Procedure
1. **Step 1: Session Initialization**  
   Spawn clean local session buffer with SHA-256 session salt.
2. **Step 2: Model Weights Verification**  
   Execute local checksum verification on weights stored in `./models/`.
3. **Step 3: Sandbox Environment Allocation**  
   Spin up isolated subprocess namespace with read-only rootfs mount.
4. **Step 4: Output Verification & Signature**  
   Package generated code and documentation with cryptographic manifest.

## 4. Exceptions & Emergency Protocol
In case of unexpected telemetry alarms:
- Immediately terminate active subprocess instances via SIGTERM.
- Export crash telemetry logs into `./backend/storage/artifacts/incident_dump.json`.
"""
    },
    "executive_briefing": {
        "id": "executive_briefing",
        "name": "Executive & Strategic Briefing",
        "description": "High-level strategic briefing highlighting core operational findings, resource trade-offs, and decisive recommendations.",
        "badge": "EXEC-BRIEF-C3",
        "template": """# Executive Briefing: {title}

**Memo Reference:** EXB-{doc_ref}  
**Prepared By:** {author_name} ({author_title})  
**Audience:** Director of Mission Critical Infrastructure  
**Date:** {date}  

---

## 1. Strategic Objective
{objective}

## 2. Key Findings & Performance Metrics
- **On-Premise Inference Latency:** 94% reduction in round-trip latency compared to cloud relays.
- **Zero-Egress Security Compliance:** 100% data residency maintained within facility perimeter.
- **Cost Reduction:** Eliminated per-token API licensing costs across engineering division.

## 3. Resource & Hardware Estimation
| Resource Category | Current Allocation | Recommended Scaling |
| :--- | :--- | :--- |
| **Compute Acceleration** | 1x NVIDIA RTX 4090 (24GB) | 2x PCIe RTX 4090 Enclave Nodes |
| **System Memory** | 32 GB DDR5 | 64 GB DDR5 Low-Latency |
| **Local Storage** | 1 TB NVMe Tier-1 | 2 TB Gen4 NVMe Dedicated |

## 4. Key Recommendations
1. Approve expansion of on-premise hardware cluster for secondary engineering units.
2. Formalize air-gapped document generation SOP as division-wide standard.
"""
    }
}


def list_presets() -> List[Dict[str, Any]]:
    """Returns a list of all available document presets metadata."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "badge": p["badge"]
        }
        for p in DOCUMENT_PRESETS.values()
    ]


def get_preset_template(preset_id: str, context: Dict[str, Any] = None) -> str:
    """Retrieves and populates a preset markdown template."""
    preset = DOCUMENT_PRESETS.get(preset_id)
    if not preset:
        preset = DOCUMENT_PRESETS["engineering_design_spec"]

    ctx = {
        "title": "System Component Design",
        "doc_ref": "8902",
        "author_name": "Lead AI Architect",
        "author_title": "Lead Operations Engineer",
        "date": "Today",
        "objective": "Design and verify high-performance air-gapped computational architectures.",
        "impact_duration": "14 minutes",
    }
    if context:
        ctx.update(context)

    return preset["template"].format(**ctx)
