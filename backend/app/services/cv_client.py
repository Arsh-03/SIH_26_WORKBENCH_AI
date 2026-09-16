import os
import sys
import json
import uuid
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

from backend.app.config import settings, ROOT_DIR
from backend.app.models.schemas import (
    CVRunnerResponse,
    CVPageResult,
    CVTextBlock,
)

logger = logging.getLogger("cv_client")


class CVClient:
    """
    Subprocess bridge between Main Backend (Python 3.14) and
    Isolated CV Worker (.venv-cv, Python 3.11).
    """

    def __init__(
        self,
        venv_python_path: Optional[str] = None,
        default_timeout_seconds: int = 120
    ):
        self.venv_python_path = Path(venv_python_path or settings.VENV_CV_PYTHON).resolve()
        self.default_timeout_seconds = default_timeout_seconds

    async def run_cv_runner(
        self,
        input_path: str,
        confidence: float = 0.50,
        use_gpu: bool = False,
        model_dir: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ) -> CVRunnerResponse:
        """
        Executes .venv-cv/Scripts/python.exe -m backend.cv_engine.runner
        via subprocess, passes input file path and output JSON path,
        parses the Phase 1A JSON result contract, cleans up temporary files,
        and returns typed response.
        """
        start_time_local = asyncio.get_event_loop().time()
        timeout = timeout_seconds or self.default_timeout_seconds

        # 1. Verify CV Python Executable exists
        if not self.venv_python_path.exists():
            error_msg = f"Isolated CV virtual environment python executable not found at: {self.venv_python_path}"
            logger.error(error_msg)
            return CVRunnerResponse(
                status="error",
                processing_time_ms=0,
                total_pages=0,
                pages=[],
                errors=[error_msg]
            )

        # 2. Resolve Input Path
        resolved_input = Path(input_path).resolve()
        if not resolved_input.exists():
            error_msg = f"Input file not found for CV analysis: {input_path}"
            logger.error(error_msg)
            return CVRunnerResponse(
                status="error",
                processing_time_ms=0,
                total_pages=0,
                pages=[],
                errors=[error_msg]
            )

        # 3. Generate Unique Temp Output JSON File Path
        temp_dir = Path(settings.TEMP_DIR)
        temp_dir.mkdir(parents=True, exist_ok=True)
        unique_id = uuid.uuid4().hex
        temp_json_path = temp_dir / f"cv_output_{unique_id}.json"

        # 4. Build Command Array
        cmd = [
            str(self.venv_python_path),
            "-m",
            "backend.cv_engine.runner",
            "--input",
            str(resolved_input),
            "--output",
            str(temp_json_path),
            "--confidence",
            str(confidence),
        ]

        if model_dir:
            cmd.extend(["--model-dir", str(model_dir)])
        if use_gpu:
            cmd.append("--use-gpu")

        # 5. Environment & Working Directory
        # Subprocess cwd MUST be ROOT_DIR (where backend package resides)
        cwd = str(ROOT_DIR)
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        logger.info(f"Invoking CV runner subprocess from cwd={cwd}: {' '.join(cmd)}")

        stdout_text = ""
        stderr_text = ""
        exit_code = -1

        try:
            # Spawn process asynchronously
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
                env=env
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=float(timeout)
                )
                exit_code = proc.returncode if proc.returncode is not None else 0
                stdout_text = stdout_bytes.decode("utf-8", errors="replace")
                stderr_text = stderr_bytes.decode("utf-8", errors="replace")
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                logger.error(f"CV worker subprocess timed out after {timeout} seconds.")
                return CVRunnerResponse(
                    status="error",
                    processing_time_ms=int((asyncio.get_event_loop().time() - start_time_local) * 1000),
                    total_pages=0,
                    pages=[],
                    errors=[f"CV worker subprocess timed out after {timeout} seconds."]
                )

        except Exception as e:
            # Fallback to thread-pool synchronous execution if asyncio process creation encounters OS limits
            logger.warning(f"Async subprocess creation failed ({e}), attempting thread-pool fallback execution...")
            def _run_sync():
                return subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=float(timeout),
                    cwd=cwd,
                    env=env
                )
            try:
                sub_res = await asyncio.to_thread(_run_sync)
                exit_code = sub_res.returncode
                stdout_text = sub_res.stdout
                stderr_text = sub_res.stderr
            except Exception as e2:
                logger.error(f"Thread-pool subprocess execution failed: {e2}")
                return CVRunnerResponse(
                    status="error",
                    processing_time_ms=int((asyncio.get_event_loop().time() - start_time_local) * 1000),
                    total_pages=0,
                    pages=[],
                    errors=[f"Subprocess execution failed: {str(e2)}"]
                )

        # 6. Parse JSON Payload from Temporary Output File or Stdout
        try:
            raw_data: Optional[Dict[str, Any]] = None

            if temp_json_path.exists():
                try:
                    with open(temp_json_path, "r", encoding="utf-8") as f:
                        raw_data = json.load(f)
                except Exception as e:
                    logger.warning(f"Could not read output JSON file: {e}")

            # Fallback to stdout JSON parsing if temp JSON file is missing/empty
            if raw_data is None and stdout_text.strip():
                try:
                    j_start = stdout_text.find("{")
                    j_end = stdout_text.rfind("}")
                    if j_start != -1 and j_end != -1:
                        raw_data = json.loads(stdout_text[j_start:j_end+1])
                except Exception:
                    pass

            if raw_data is None:
                err_detail = stderr_text.strip() or stdout_text.strip() or f"Exit code: {exit_code}"
                return CVRunnerResponse(
                    status="error",
                    processing_time_ms=int((asyncio.get_event_loop().time() - start_time_local) * 1000),
                    total_pages=0,
                    pages=[],
                    errors=[f"Failed to parse CV runner JSON output. Detail: {err_detail}"]
                )

            # Convert raw dict to typed Pydantic CVRunnerResponse
            pages: list[CVPageResult] = []
            for p in raw_data.get("pages", []):
                blocks: list[CVTextBlock] = []
                for b in p.get("text_blocks", []):
                    blocks.append(
                        CVTextBlock(
                            block_id=str(b.get("block_id", "")),
                            text=str(b.get("text", "")),
                            confidence=float(b.get("confidence", 0.0)),
                            bounding_box_2d=list(b.get("bounding_box_2d", [0, 0, 0, 0]))
                        )
                    )
                pages.append(
                    CVPageResult(
                        page_number=int(p.get("page_number", 1)),
                        width=int(p.get("width", 1920)),
                        height=int(p.get("height", 1080)),
                        text_blocks=blocks,
                        tables=list(p.get("tables", []))
                    )
                )

            return CVRunnerResponse(
                status=str(raw_data.get("status", "success")),
                processing_time_ms=int(raw_data.get("processing_time_ms", 0)),
                total_pages=int(raw_data.get("total_pages", len(pages))),
                pages=pages,
                errors=list(raw_data.get("errors", []))
            )

        finally:
            # 7. ALWAYS clean up temporary JSON file
            if temp_json_path.exists():
                try:
                    temp_json_path.unlink()
                    logger.debug(f"Cleaned up temporary CV output file: {temp_json_path}")
                except Exception as e:
                    logger.warning(f"Failed to remove temp CV output file {temp_json_path}: {e}")


cv_client = CVClient()
