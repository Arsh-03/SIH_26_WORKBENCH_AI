# 🚀 Production Deployment & Hardware Sizing Matrix
**Document Code:** `docs/07_PRODUCTION_DEPLOYMENT_MATRIX.md`  
**System:** Sovereign On-Premise AI Workbench (SIH26117)  
**Target:** Industrial Workstation Hardware Sizing, Air-Gapped Packaging, & OS Setup  

---

## 1. Hardware Sizing & Compatibility Matrix

The workbench is architected to run on standard engineering workstations without requiring multi-million dollar cloud clusters:

| Tier / Profile | Hardware Target | Supported Models | Performance Profile | Recommended Deployment |
|---|---|---|---|---|
| **Tier A (Enterprise)** | 1x NVIDIA RTX 4090 (24GB VRAM) or RTX A5000 | `qwen2.5:7b-instruct-q4` + `qwen2-vl:7b` + `nomic-embed` | Concurrent VLM + LLM active; 45–60 TPS; instant spatial OCR | Central Refinery Engineering Control Room |
| **Tier B (Standard)** | 1x NVIDIA RTX 4080 (16GB VRAM) or RTX 3090 | `qwen2.5:7b-instruct-q4` or `llama3.1:8b` + `nomic-embed` | Serialized VLM/LLM loading; 35–48 TPS | Field Specialist Workstation |
| **Tier C (Laptop / Edge)** | 1x NVIDIA RTX 4060 Mobile (8GB VRAM) | `qwen2.5:1.5b-instruct` + `nomic-embed` | Ultra-fast SLM; 70–90 TPS; PyMuPDF fast text path | Maintenance Tablet / Field Laptop |
| **Tier D (CPU Only)** | 16-Core Intel Core i7 / AMD Ryzen 9 + 32GB RAM | `qwen2.5:1.5b` (GGUF CPU) | 12–18 TPS; CPU PaddleOCR | Air-gapped fallback with zero GPU |

---

## 2. Air-Gapped Offline Deployment Bundle

In a true sovereign environment (e.g. Mangalore Refinery internal LAN), machines have **no internet connection**. The workbench is packaged into a self-contained offline deployment bundle:

```
sovereign-workbench-v1.0-offline/
├── bin/
│   ├── ollama-windows-amd64.exe
│   └── node-v20-win-x64/
├── wheels/
│   ├── main_backend_wheels/     # Pre-downloaded Python 3.14 wheels
│   └── cv_engine_wheels/        # Pre-downloaded Python 3.11 PaddleOCR wheels
├── models/
│   ├── qwen2.5-7b-q4.gguf
│   ├── qwen2-vl-7b-q4.gguf
│   └── nomic-embed-v1.5.gguf
├── frontend_dist/               # Pre-compiled React 19 production bundle
├── storage/                     # Initialized SQLite schema and vector store
├── install_offline.bat          # 1-Click Windows Air-Gap Installer
└── install_offline.sh           # 1-Click Linux Air-Gap Installer
```

---

## 3. One-Click Bootstrap Process (`start_all.py`)

The root directory contains `start_all.py`, an automated orchestration script that handles lifecycle management:

```bash
# Start all microservices in a single command
python start_all.py
```

### What `start_all.py` Manages:
1. **Ollama Daemon Probe**: Verifies `127.0.0.1:11434` is healthy and required model weights are present.
2. **Dual-Environment Validation**: Verifies both `.venv` (3.14) and `.venv-cv` (3.11) exist and can execute.
3. **Database Migration**: Ensures SQLite tables (`audit_log`, `chats`, `workspaces`, `telemetry`) are up to date.
4. **FastAPI Gateway Launch**: Starts Uvicorn server on `127.0.0.1:8000`.
5. **Frontend Preview**: Serves the compiled React 19 UI on `127.0.0.1:5173`.

---

## 4. Production Windows Service & Systemd Integration

For permanent plant room installation, the workbench runs as an auto-recovering background service:

### Linux Systemd Unit (`/etc/systemd/system/sovereign-ai.service`):
```ini
[Unit]
Description=Sovereign AI Workbench Gateway
After=network.target

[Service]
Type=simple
User=refinery_engineer
WorkingDirectory=/opt/sih_workbench
ExecStart=/opt/sih_workbench/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
Environment="AIRGAP_MODE=true"
Environment="OLLAMA_BASE_URL=http://127.0.0.1:11434"

[Install]
WantedBy=multi-user.target
```

### Windows Service Management:
Can be registered via `NSSM` (Non-Sucking Service Manager) for automated Windows workstation startup:
```powershell
nssm install SovereignAIWorkbench C:\Users\AITNS\Documents\SIH_26_WORKBENCH_AI\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
nssm set SovereignAIWorkbench AppDirectory C:\Users\AITNS\Documents\SIH_26_WORKBENCH_AI
nssm start SovereignAIWorkbench
```
