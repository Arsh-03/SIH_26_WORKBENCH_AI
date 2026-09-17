# 🛠️ Phase 1 Transformation: Core Hardening & Deterministic Governance
**Document Code:** `docs/future_updates/PHASE_1_TRANSFORMATION.md`  
**System:** Sovereign On-Premise AI Workbench (SIH26117)  
**Objective:** Transform from a naive prototype monolith into a decoupled, verified, and token-governed engineering engine.

---

## 1. Executive Summary

Phase 1 addresses the critical vulnerabilities of the initial prototype:
1. Eliminates LLM arithmetic hallucination on engineering formulas via **SymPy deterministic evaluation**.
2. Prevents out-of-memory (CUDA OOM) crashes via an explicit **Token Governor & Context Budgeter**.
3. Replaces static text streaming with **fine-grained WebSocket events** (thoughts, tool metrics, live TPS).
4. Establishes an **in-repo benchmark runner** to measure accuracy against ground-truth ASME test cases.

---

## 2. Detailed Technical Deliverables

### Deliverable 1.1: Token Governor & Multi-Model Tiering (`ai_engine/router.py`)
- **Problem:** Sending large conversation histories causes quadratic KV-cache memory spikes and slows inference.
- **Implementation:**
  - Build `TokenGovernor` class to calculate token consumption per message using `tiktoken` or model tokenizers.
  - Enforce context boundaries:
    - System prompt: 800 tokens.
    - Retrieved RAG chunks: 4,000 tokens maximum.
    - Conversation working memory: 8,000 tokens sliding window.
    - Output reserve: 3,584 tokens.
  - When history exceeds 8,000 tokens, trigger automated **extractive compaction** (summarizing earlier turns while retaining technical constants and equipment tags).
  - Add Tier 1 SLM routing for intent classification and JSON schema validation (`qwen2.5:1.5b-instruct` at >80 TPS).

### Deliverable 1.2: Deterministic Verification Loop (`ai_engine/agents/validator_agent.py`)
- **Problem:** LLMs cannot be trusted to perform ASME wall thickness or thermodynamics math directly.
- **Implementation:**
  - Enhance `ValidatorAgent` to intercept draft calculations before streaming to the user.
  - Implement unit validation (e.g., verifying MPa vs. PSI and converting automatically).
  - Assert mandatory safety margins:
    - Corrosion allowance: $c \ge 3.0\text{ mm}$ for refinery sour service.
    - Joint efficiency: $0.7 \le E \le 1.0$.
    - Allowable stress: Lookup cross-check against ASME Section II Part D tables.
  - If validation fails, inject structured error into `AgentState["validation_errors"]` to trigger an automated self-correction reflection cycle.

### Deliverable 1.3: Real-Time Hardware & Token Telemetry (`backend/app/services/telemetry.py`)
- **Problem:** Field operators and hackathon judges cannot see system load, TPS, or VRAM consumption.
- **Implementation:**
  - Implement continuous background telemetry sampler querying GPU metrics (via `nvidia-smi` or `pynvml`) and process memory (`psutil`).
  - Stream `telemetry_tick` events every 1.5 seconds over the existing WebSocket connection.
  - Display live indicators on the frontend status bar:
    - Active Tokens/sec (TPS)
    - GPU VRAM Utilization (%)
    - GPU Temperature (°C)
    - Air-Gap Security Status (🟢 0 Bytes Egress)

### Deliverable 1.4: Ground-Truth Benchmark Suite (`tests/benchmark/`)
- **Problem:** No empirical data proving system accuracy.
- **Implementation:**
  - Create `tests/benchmark/asme_dataset.json` containing 25 verified ASME Section VIII pressure vessel problems.
  - Create `tests/benchmark/runner.py` to execute test problems through the agent swarm and compute:
    - Mathematical Precision ($\Delta < 0.01\text{ mm}$)
    - Execution Latency (seconds per query)
    - Zero-Hallucination Rate (target: 0.0% error)

---

## 3. Step-by-Step Implementation Roadmap

```
Step 1: Router & Token Governor
├── Refactor `ai_engine/router.py` to include token budgeting
└── Add sliding-window extractive context compaction

Step 2: Validator Reflection Loop
├── Wire `ValidatorAgent` into `ai_engine/graph.py`
└── Add automated reflection cycle if validation fails

Step 3: WebSocket Telemetry Streaming
├── Wire `telemetry.py` into `backend/app/api/v1/endpoints/agent_ws.py`
└── Connect frontend `StatusBar.tsx` to display live TPS and VRAM

Step 4: Benchmark Verification
├── Populate `tests/benchmark/asme_dataset.json`
└── Run `python -m tests.benchmark.runner` and verify 100% pass rate
```

---

## 4. Phase 1 Acceptance Criteria

- [ ] **Zero Hallucination:** 25/25 ASME benchmark calculations match analytical ground truth within $\pm 0.01\text{ mm}$.
- [ ] **Context Stability:** 20-turn conversational stress test runs without CUDA OOM or context overflow.
- [ ] **Live Telemetry:** UI status bar displays real-time TPS and VRAM metrics updating continuously during generation.
- [ ] **Deterministic Reflection:** Injected mathematical errors (e.g. negative pressure) are caught by `ValidatorAgent` and self-corrected automatically.
