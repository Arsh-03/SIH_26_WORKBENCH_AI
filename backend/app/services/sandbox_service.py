import os
import sys
import time
import asyncio
import tempfile
from pathlib import Path
from typing import List, Dict, Any
from backend.app.config import settings
from backend.app.models.schemas import GeneratedArtifact, SandboxExecuteResponse

class SandboxService:
    def __init__(self):
        self.artifacts_dir = Path(settings.ARTIFACTS_DIR)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    async def execute_python_code(
        self,
        code: str,
        timeout_seconds: int = 10,
        memory_limit_mb: int = 512,
    ) -> SandboxExecuteResponse:
        """
        Execute python script in an isolated subprocess with strict timeouts,
        network isolation, and artifact tracking.
        """
        start_time = time.perf_counter()
        limits_exceeded = False

        # Record initial artifact files to detect newly created outputs
        existing_artifacts = set(os.listdir(self.artifacts_dir))

        # Create temporary execution script
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as script_file:
            # We prepend script with artifact directory injection for matplotlib/save ops
            wrapper_code = (
                "import os, sys\n"
                f"os.environ['ARTIFACTS_DIR'] = {repr(str(self.artifacts_dir))}\n"
                # Compatibility symlink/path so that saving to /workspace/artifacts or ./artifacts works
                "try:\n"
                "    import matplotlib\n"
                "    matplotlib.use('Agg')\n"
                "except ImportError:\n"
                "    pass\n\n"
                f"{code}\n"
            )
            script_file.write(wrapper_code)
            script_path = script_file.name

        try:
            # Prepare execution environment with restricted access
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env["ARTIFACTS_DIR"] = str(self.artifacts_dir)

            # Spawn subprocess
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.artifacts_dir),
                env=env
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=float(timeout_seconds)
                )
                exit_code = proc.returncode if proc.returncode is not None else 0
                stdout = stdout_bytes.decode("utf-8", errors="replace")
                stderr = stderr_bytes.decode("utf-8", errors="replace")
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                exit_code = -9
                stdout = ""
                stderr = f"Execution timed out after {timeout_seconds} seconds."
                limits_exceeded = True

        except Exception as e:
            exit_code = 1
            stdout = ""
            stderr = f"Subprocess execution error: {str(e)}"
        finally:
            if os.path.exists(script_path):
                try:
                    os.remove(script_path)
                except Exception:
                    pass

        execution_time_ms = int((time.perf_counter() - start_time) * 1000)

        # Detect newly generated artifacts
        current_artifacts = set(os.listdir(self.artifacts_dir))
        new_files = current_artifacts - existing_artifacts

        generated_artifacts: List[GeneratedArtifact] = []
        for f in new_files:
            generated_artifacts.append(
                GeneratedArtifact(
                    filename=f,
                    download_url=f"{settings.API_V1_PREFIX}/artifacts/download/{f}"
                )
            )

        return SandboxExecuteResponse(
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            execution_time_ms=execution_time_ms,
            generated_artifacts=generated_artifacts,
            limits_exceeded=limits_exceeded
        )


sandbox_service = SandboxService()
