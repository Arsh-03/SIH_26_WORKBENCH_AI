# 🛡️ SIH 2026 Problem Statement 26117 — Gap Analysis & Step-by-Step Implementation Plan

> **Target Specification**: Smart India Hackathon 2026 — PS ID: **26117**  
> **Title**: Sovereign On-Premise Agentic AI Workbench using Open-Weight Multimodal LLMs for Confidential Industrial Work  
> **Sponsoring Body**: Ministry of Petroleum & Natural Gas (MoPNG) / Mangalore Refinery and Petrochemicals Limited (MRPL)  
> **Evaluation Date**: September 2026  
> **Current Baseline Match**: **85.2%**  
> **Target Match Post-Implementation**: **98.5%+**

---

## 1. Problem Statement Dossier & Official Mandates

### 1.1 Overview
* **Problem Statement ID**: `26117` (SIH26117)
* **Category**: Software
* **Theme**: Smart Automation / Industrial Sovereign AI
* **Primary Stakeholder**: Mangalore Refinery and Petrochemicals Limited (MRPL) / MoPNG
* **Operating Constraint**: Highly confidential, air-gapped industrial environment (Refinery units: CDU, VDU, Hydrocracker, Hydrogen Generation, Steam Boilers). **Zero cloud egress** to public LLM APIs (OpenAI, Anthropic, Google) is legally and operationally permissible due to critical national infrastructure regulations and trade secret preservation.

### 1.2 Core Mandates & Evaluation Dimensions
1. **Absolute Data Sovereignty & Air-Gap Compliance**:
   - Total host isolation: All model weights, embeddings, databases, and runtimes operate strictly on local workstation or private intranet edge GPU nodes.
   - Zero outbound WAN packet egress with deterministic network interception and cryptographic auditing.
2. **Poly-Model Dynamic Routing (Open-Weight SLMs)**:
   - No single monolithic model can handle all refinery tasks efficiently within workstation VRAM bounds (8GB–24GB).
   - Dynamic routing to specialized Small Language Models (SLMs): Qwen-2.5-Coder for calculations/simulations, Qwen2-VL for P&IDs/CAD schematics, DeepSeek-R1-Distill / LLaMA 3.1 for SOP reasoning, and dense embeddings (BGE-M3 / Nomic-Embed-Text).
3. **Multimodal Industrial Perception**:
   - Ingestion and 2D spatial extraction of scanned P&IDs (Piping and Instrumentation Diagrams), equipment nameplates, ultrasonic thickness inspection logs, and technical PDFs.
   - 2D coordinate bounding box extraction `[ymin, xmin, ymax, xmax]` linking visual elements to engineering tags (e.g., `CV-401`, `PRV-102`, `B-401`).
4. **Agentic Orchestration & Deterministic State Graphs**:
   - Dynamic planning and execution via LangGraph state machines (Supervisor, RAG Worker, Code/Sandbox Runner, Vision Worker, and Compliance Validator).
   - Deterministic execution guarantees to prevent AI hallucinations, prompt drift, and unverified math calculations.
5. **Air-Gapped Code Sandbox & Physical Simulation**:
   - Safe execution of Python scripts computing ASME Section VIII Div 1 pressure vessel limits, SOP-401 MAWP thermal degradation curves, and Larson-Miller creep life.
   - Strict hardware quotas (CPU, memory, execution timeouts) and network-isolated execution.
6. **Regulatory Compliance, Grounding & Cryptographic Auditability**:
   - Strict inline citation enforcement (`[1]`, `[2]`) mapping to authoritative MRPL SOPs and standards.
   - Cryptographic SHA-256 prompt hashing, tool execution provenance, and exportable compliance certificates for refinery safety committees.

---

## 2. Match Percentage Scorecard & Current Benchmark

### Detailed Evaluation Matrix

| # | Dimension | Weight | Current Score | Weighted Score | Status & Evidence in Codebase |
|---|---|:---:|:---:|:---:|---|
| **1** | **Data Sovereignty & Air-Gap Enforcement** | 15% | **90%** | **13.50%** | `ZeroEgressInterceptorMiddleware`, `verify_network_isolation()`, local Ollama integration, zero external WAN packet checking. |
| **2** | **Poly-Model Dynamic Routing** | 10% | **88%** | **8.80%** | `DynamicModelRouter`, `ModelRegistry`, warm model affinity, capability profiles (Coding, Math, Docs, Vision, Chat). |
| **3** | **Multimodal Blueprints, P&ID & CV** | 15% | **80%** | **12.00%** | Dual-environment (`.venv-cv` Python 3.11) PaddleOCR 2.7.3 + Qwen2-VL spatial fusion with IoB/IoU candidate ranking. |
| **4** | **Agentic DAG & Orchestration** | 15% | **85%** | **12.75%** | LangGraph supervisor planning, dynamic multi-agent pipeline, bilateral WebSocket step frame streaming. |
| **5** | **Air-Gapped Code Sandbox** | 10% | **80%** | **8.00%** | Subprocess runner with preflight AST/regex destructive command killer, artifact auto-detection, memory/timeout limits. |
| **6** | **Sovereign Industrial RAG & SOPs** | 10% | **85%** | **8.50%** | PyMuPDF/PaddleOCR ingestion, recursive chunking, ChromaDB vector store, SQLite metadata, company docs management UI. |
| **7** | **Compliance Verification & Auditing** | 10% | **82%** | **8.20%** | `ComplianceValidator` checking ASME Sec VIII & SOP-401 bounds, SHA-256 prompt hashing, `AuditLog` table. |
| **8** | **Industrial UX & Split-View Canvas** | 10% | **92%** | **9.20%** | Darkroom Studio UI, `InteractivePidCanvas` with digital twin sliders (MAWP, UG-27, creep), physics cards, audio voice input. |
| **9** | **Confidential Enclave RBAC & Security** | 5% | **85%** | **4.25%** | JWT authentication, bcrypt hashing, role profiles (Operator, Engineer, Researcher), session segregation. |
| | **AGGREGATE TOTAL** | **100%** | — | **85.20%** | **Solid Production Baseline (Ready for Final Winning Polish)** |

---

## 3. High-Value Accomplishments in the Current Codebase

1. **Isolated Dual-Environment CV Pipeline**:
   - Solved the known Python 3.14 C-extension binary incompatibility with PaddleOCR by creating a separate `.venv-cv` (Python 3.11) runner managed dynamically via `CVClient` JSON IPC.
2. **Deterministic Spatial Fusion Algorithm**:
   - `vision_service.py` calculates both Intersection-over-BBox ($\text{IoB} \ge 0.50$) and Intersection-over-Union ($\text{IoU} \ge 0.20$) to bind OCR text tags directly to Qwen2-VL detected component bounding boxes.
3. **Interactive Digital Twin P&ID Canvas**:
   - `InteractivePidCanvas.tsx` features real-time dynamic calculation of effective MAWP, minimum required wall thickness per ASME Section VIII UG-27 ($t = \frac{PR}{SE - 0.6P}$), and Larson-Miller parameter creep life estimation.
4. **Real-time Bilateral WebSocket Protocol**:
   - Full event contract supporting `thought`, `tool_call`, `tool_result`, and `final_answer` with automatic simulated fallback if backend connection drops.
5. **ASME & MRPL Compliance Validator Agent**:
   - `validator_agent.py` validates inline citation mapping against authoritative chunk IDs and detects engineering rule violations prior to delivering the final response.

---

## 4. Gap Analysis: Missing Items Required for 98%+ Match

To achieve a decisive competitive advantage in SIH 2026, the following 5 critical features must be added:

```mermaid
graph TD
    subgraph Gaps [Identified Missing Capabilities]
        G1[Gap 1: Live Bounding Box Overlay on Canvas / PDF Viewer]
        G2[Gap 2: Human-in-the-Loop Safety Sign-Off Workflow]
        G3[Gap 3: True Docker Container Sandbox with Hard Physical Isolation]
        G4[Gap 4: 1-Click Cryptographically Signed PDF Audit Certificate]
        G5[Gap 5: Hybrid Sparse BM25 + Dense ChromaDB Vector Search]
    end

    G1 -->|Target: Frontend Artifact Studio| F1[Interactive Blueprint SVG Overlay]
    G2 -->|Target: AI Engine + WebSocket| F2[Operator Authorization Modal & Interlock]
    G3 -->|Target: Backend Sandbox Service| F3[Docker run --network none]
    G4 -->|Target: Backend Audit API| F4[Official Tamper-Evident Audit Report]
    G5 -->|Target: Vector Store Service| F5[Reciprocal Rank Fusion RRF]
```

---

## 5. Step-by-Step Implementation Specifications

### Step 1: Live 2D Spatial Bounding Box Overlay for Blueprints & P&IDs
* **Objective**: When a user inspects an uploaded blueprint, schematic, or P&ID in the Split-View Artifact Studio, the frontend must render interactive vector bounding boxes `[ymin, xmin, ymax, xmax]` directly over the image, with tags, confidence scores, and hover highlights.
* **Files to Modify / Create**:
  - `frontend/src/components/artifact/BoundingBoxOverlay.tsx` (New component)
  - `frontend/src/components/artifact/ArtifactPanel.tsx` (Integrate overlay into the image / PDF viewer tab)
* **Implementation Logic**:
  1. Parse `DetectedElement` array (`element_id`, `label`, `tag_code`, `bounding_box_2d`, `confidence`).
  2. Compute percentage-based coordinates relative to natural image dimensions:
     - $\text{top} = \frac{y_{\min}}{\text{height}} \times 100\%$
     - $\text{left} = \frac{x_{\min}}{\text{width}} \times 100\%$
     - $\text{width} = \frac{x_{\max} - x_{\min}}{\text{width}} \times 100\%$
     - $\text{height} = \frac{y_{\max} - y_{\min}}{\text{height}} \times 100\%$
  3. Render styled SVG/HTML interactive rectangles with color-coding:
     - Red/Amber for Critical Equipment (`Boiler`, `PRV`, `Reactor`)
     - Cyan for Valves (`Control Valve`, `Check Valve`)
     - Emerald for Sensors (`Pressure Indicator`, `Flow Meter`)
  4. Include click-to-focus and parameter popovers.

---

### Step 2: Human-in-the-Loop (HITL) Interlock & Safety Authorization
* **Objective**: In a mission-critical refinery (MRPL), autonomous AI must not generate execution documents or modify operating thresholds without a certified engineer's physical sign-off.
* **Files to Modify / Create**:
  - `backend/app/services/agent_engine.py` (Add safety critical gatekeeper)
  - `frontend/src/components/chat/HitlApprovalCard.tsx` (New interactive confirmation card)
  - `frontend/src/components/chat/MessageBlock.tsx` (Render HITL card when triggered)
* **Implementation Logic**:
  1. When prompt involves high-risk actions (e.g. recalibrating PRV setpoints, operating boilers above 480°C, overriding safety interlocks), the agent emits a `hitl_approval_required` WebSocket event before continuing.
  2. The UI renders an amber warning card showing:
     - Proposed Parameter Modification
     - Safety Guideline Reference (e.g. SOP-401 Section 3)
     - Digital Signature Checkbox & "Authorize Action" button
  3. Once authorized by the operator, the frontend sends `{ action: "hitl_approve", token: "..." }` and the state machine resumes to compile the final approval memo.

---

### Step 3: Hardened Linux Docker Container Sandbox (`--network none`)
* **Objective**: Upgrade the subprocess sandbox to run inside an isolated Docker container with zero physical networking when Docker is available on the host, falling back to hardened subprocess execution if Docker is unavailable.
* **Files to Modify**:
  - `backend/app/services/sandbox_service.py`
* **Docker Run Flags**:
  ```bash
  docker run --rm \
    --network none \
    --memory 512m \
    --cpus 1.0 \
    --pids-limit 64 \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    -v /path/to/artifacts:/workspace/artifacts:rw \
    -v /path/to/script.py:/workspace/script.py:ro \
    python:3.11-slim python3 /workspace/script.py
  ```
* **Implementation Logic**:
  1. Check if Docker daemon is responsive (`docker info`).
  2. If responsive, execute code within a transient container with `--network none` (physical air-gap at kernel level).
  3. If Docker is not installed or unavailable, seamlessly invoke the existing preflight-screened subprocess runner.

---

### Step 4: 1-Click Cryptographically Signed PDF Audit Certificate Export
* **Objective**: Provide an official, tamper-evident regulatory compliance certificate that engineers and safety auditors can download and present to regulatory boards.
* **Files to Modify / Create**:
  - `backend/app/services/audit_pdf_service.py` (New PDF compilation service using ReportLab / WeasyPrint / PyMuPDF)
  - `backend/app/api/v1/endpoints/audit.py` (Add `GET /api/v1/audit/export-certificate/{session_id}`)
  - `frontend/src/routes/SettingsPage.tsx` & `frontend/src/components/chat/MessageBlock.tsx` (Add "Download Audit Certificate" button)
* **Certificate Content**:
  - Official MRPL Sovereign AI Workbench Header & Badge
  - Cryptographic Verification Block:
    - Session ID & Timestamp
    - SHA-256 Digest of Engineer Query
    - SHA-256 Digest of Synthesized Response
    - Tools Executed & Sandbox Exit Codes
    - Retrieved SOP Chunk IDs & Page Numbers
    - Zero External WAN Egress Certification (`0 bytes transmitted`)
  - Digital Stamp & Verification Signature Hash.

---

### Step 5: Hybrid Sparse (BM25) + Dense (ChromaDB) Vector Retrieval
* **Objective**: Guarantee 100% precision when engineers query specific alphanumeric refinery tags (`PRV-102`, `B-401`, `SOP-401`, `UG-27`) while maintaining broad semantic reasoning for general queries.
* **Files to Modify**:
  - `backend/app/services/vector_store.py`
* **Implementation Logic**:
  1. Maintain an in-memory BM25 index over document chunk tokens.
  2. On query execution, retrieve Top-$K$ dense vectors from ChromaDB and Top-$K$ sparse BM25 matches.
  3. Combine rankings using Reciprocal Rank Fusion (RRF):
     $$\text{RRF\_Score}(d) = \sum_{m \in \{\text{dense}, \text{bm25}\}} \frac{1}{60 + \text{rank}_m(d)}$$
  4. Deduplicate and return the highest-scoring authoritative chunks.

---

## 6. Execution & Rollout Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Visual Grounding & Interactive Bounding Box Overlay                   │
│ • Create BoundingBoxOverlay.tsx in frontend                                    │
│ • Hook into ArtifactPanel image & PDF rendering tab                            │
│ • Add tag filter pills and hover inspector tooltips                            │
├────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Human-in-the-Loop (HITL) Safety Interlock                             │
│ • Add safety constraint check in agent_engine.py                               │
│ • Create HitlApprovalCard.tsx in frontend                                      │
│ • Enable bilateral WS handshake for operator sign-off                          │
├────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Hardened Docker Air-Gap Sandbox Container                             │
│ • Add Docker execution mode in sandbox_service.py with --network none          │
│ • Verify zero-network execution and timeout containment                        │
├────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: 1-Click Cryptographically Signed PDF Audit Certificate Export         │
│ • Implement audit_pdf_service.py using ReportLab / PyMuPDF                     │
│ • Register /api/v1/audit/export-certificate/{session_id} route                 │
│ • Add download triggers in UI                                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Hybrid BM25 + Dense Retrieval (RRF)                                   │
│ • Implement lightweight BM25 ranker in vector_store.py                         │
│ • Blend rankings via Reciprocal Rank Fusion for perfect tag retrieval          │
└────────────────────────────────────────────────────────────────────────────────┘
```
