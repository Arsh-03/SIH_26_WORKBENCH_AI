import os
import sys
import subprocess
import time

# Reconfigure stdout/stderr for UTF-8 compatibility on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def get_venv_python(root_dir):
    if sys.platform == "win32":
        venv_py = os.path.join(root_dir, ".venv", "Scripts", "python.exe")
    else:
        venv_py = os.path.join(root_dir, ".venv", "bin", "python")
    
    if os.path.exists(venv_py):
        return venv_py
    return sys.executable

def check_and_install_dependencies(root_dir, frontend_dir, python_exe):
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    # 1. Check frontend node_modules
    node_modules_path = os.path.join(frontend_dir, "node_modules")
    if not os.path.exists(node_modules_path):
        print("📦 'frontend/node_modules' missing. Running 'npm install'...")
        res = subprocess.run([npm_cmd, "install"], cwd=frontend_dir)
        if res.returncode != 0:
            print("⚠️ 'npm install' failed. Please run 'cd frontend && npm install' manually.")

    # 2. Check universal Python dependencies
    try:
        res = subprocess.run(
            [python_exe, "-c", "import aiosqlite, fastapi, uvicorn, docx, chromadb"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if res.returncode != 0:
            raise ImportError()
    except Exception:
        print("📦 Universal virtual environment missing required packages. Installing 'requirements.txt'...")
        req_file = os.path.join(root_dir, "requirements.txt")
        subprocess.run([python_exe, "-m", "pip", "install", "-r", req_file])

def check_ollama_status(python_exe):
    """Check if Ollama inference engine is reachable."""
    script = """
import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv()
base_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434').rstrip('/')
try:
    req = urllib.request.Request(
        f"{base_url}/api/tags",
        headers={
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'Sovereign-Workbench-Client/1.0'
        }
    )
    res = urllib.request.urlopen(req, timeout=5)
    if res.status == 200:
        data = json.loads(res.read().decode())
        models = [m.get('name') for m in data.get('models', [])]
        print(f"  [OLLAMA ONLINE] Target: {base_url} | Loaded Models: {models if models else 'None'}")
    else:
        print(f"  [OLLAMA WARNING] Endpoint {base_url} returned status {res.status}")
except Exception as e:
    print(f"  [OLLAMA OFFLINE] Could not connect to {base_url} ({e}).")
    print("  -> Note: Install Ollama from https://ollama.com/download and run 'ollama serve'")
    print("  -> Or set OLLAMA_BASE_URL in .env if using a remote server / ngrok tunnel.")
"""
    subprocess.run([python_exe, "-c", script])


def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    python_exe = get_venv_python(root_dir)

    print("==================================================")
    print("🚀 Sovereign Agentic AI Workbench - Unified Launcher")
    print(f"🐍 Python Executable: {python_exe}")
    print("==================================================")

    # Auto-verify dependencies
    check_and_install_dependencies(root_dir, frontend_dir, python_exe)

    # Check Ollama connection status
    print("\n🔍 Checking Ollama Inference Connection:")
    check_ollama_status(python_exe)

    processes = []

    try:
        # 1. Start Backend Gateway & AI Engine
        print("\n[1/2] 🐍 Starting Backend Gateway & AI Engine (http://localhost:8000)...")
        backend_cmd = [python_exe, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
        backend_proc = subprocess.Popen(backend_cmd, cwd=root_dir)
        processes.append(("Backend & AI Engine", backend_proc))

        time.sleep(3)

        # 2. Start Frontend UI
        print("\n[2/2] ⚛️ Starting Frontend Vite Studio (http://localhost:5173)...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)
        processes.append(("Frontend UI", frontend_proc))

        print("\n==================================================")
        print("✅ Universal Environment active! Servers running concurrently.")
        print("   - Frontend UI:  http://localhost:5173")
        print("   - API Gateway:  http://localhost:8000")
        print("   - API Docs:     http://localhost:8000/docs")
        print("Press Ctrl+C to stop all servers.")
        print("==================================================\n")

        # Keep running until Ctrl+C or process exit
        while True:
            time.sleep(1)
            for name, proc in processes:
                poll = proc.poll()
                if poll is not None:
                    print(f"⚠️ {name} process exited with code {poll}")

    except KeyboardInterrupt:
        print("\n🛑 Shutting down backend and frontend servers...")
        for name, proc in processes:
            print(f"Stopping {name}...")
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
        print("👋 All services stopped cleanly.")

if __name__ == "__main__":
    main()
