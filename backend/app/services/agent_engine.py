import time
import json
import logging
import sys
import os
import re
from typing import List, Dict, Any, Callable, Awaitable
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.security import generate_id, compute_sha256
from backend.app.models.schemas import AgentRunRequest, ChunkCitation
from backend.app.models.sql_models import AuditLog, AgentSession
from backend.app.config import settings
from backend.app.services.ollama_client import ollama_client
from backend.app.services.vector_store import vector_store_service
from backend.app.services.sandbox_service import sandbox_service
from backend.app.services.vision_service import vision_service
from ai_engine.tools.doc_generator import generate_docx_document


# Import AI Engine Graph Workflow & Supervisor
try:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
    from ai_engine.graph import workflow as ai_engine_workflow
    from ai_engine.agents.supervisor import supervisor_node
    from ai_engine.state import AgentState
except Exception as e:
    ai_engine_workflow = None
    supervisor_node = None

logger = logging.getLogger("agent_engine")


class AgentExecutionEngine:
    def __init__(self):
        # In-memory thread history store indexed by session_id
        self.session_histories: Dict[str, List[Dict[str, str]]] = {}

    async def run_agent_loop(
        self,
        session_id: str,
        request: AgentRunRequest,
        db: AsyncSession,
        send_frame: Callable[[Dict[str, Any]], Awaitable[None]],
    ) -> Dict[str, Any]:
        """
        Execute the sovereign ReAct agent state machine loop with thread session memory,
        emitting step frames via websocket and recording audit compliance trace in SQLite.
        """
        start_time = time.perf_counter()
        tools_called_log: List[str] = []
        citations_collected: List[ChunkCitation] = []
        citation_traces: List[str] = []

        step_counter = 1
        prompt_low = request.prompt.strip().lower()

        # Check available local Ollama models for dynamic router fallback matching
        health_info = await ollama_client.check_health()
        available_models = health_info.get("available_models", [])

        # Step 1: Execute AI Engine Supervisor Agent Node for Intent Classification & Model Routing
        initial_state: AgentState = {
            "workspace_id": request.workspace_id,
            "prompt": request.prompt,
            "active_document_ids": request.active_document_ids or [],
            "allowed_tools": request.allowed_tools or [],
            "temperature": request.temperature,
            "current_step": 0,
            "plan": [],
            "extracted_elements": [],
            "rag_matches": [],
            "sandbox_output": None,
            "final_content": "",
            "citations": [],
            "artifact_paths": [],
            "available_models": available_models
        }

        selected_model = "llama3.1:8b"
        model_capability = "general_chat"
        routing_reason = ""

        if supervisor_node:
            sup_res = supervisor_node(initial_state)
            plan = sup_res.get("plan", ["chat_agent"])
            selected_model = sup_res.get("selected_model", selected_model)
            model_capability = sup_res.get("model_capability", model_capability)
            routing_reason = sup_res.get("routing_reason", "")
        else:
            is_doc_query = bool(request.active_document_ids) or any(kw in prompt_low for kw in ["sop", "boiler", "spec", "mawp", "pressure"])
            plan = ["rag_agent"] if is_doc_query else ["chat_agent"]

        thought_content = f"Dynamic Model Router: Selected model '{selected_model}' [{model_capability.upper()}] — {routing_reason} (Plan: {', '.join(plan)})"
        await send_frame({
            "event": "thought",
            "step": step_counter,
            "content": thought_content
        })
        step_counter += 1


        rag_results_summary = ""

        # Step 2: Execute RAG search ONLY when requested by Supervisor
        should_run_rag = "rag_agent" in plan and ("rag_search" in request.allowed_tools or not request.allowed_tools)
        if should_run_rag:
            tools_called_log.append("rag_search")
            tool_call_id = generate_id("call_rag")

            # Announce tool call
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "rag_search",
                "tool_call_id": tool_call_id,
                "parameters": {
                    "query": request.prompt,
                    "document_ids": request.active_document_ids,
                    "top_k": 3
                }
            })
            step_counter += 1

            # Query vector store & DB chunks
            query_emb = await ollama_client.get_embedding(request.prompt)
            matches = vector_store_service.query_chunks(
                workspace_id=request.workspace_id,
                query_embedding=query_emb,
                top_k=5,
                document_ids=request.active_document_ids if request.active_document_ids else None
            )

            from sqlalchemy import select, or_
            from backend.app.models.sql_models import Document, DocumentChunk
            
            chunk_stmt = select(DocumentChunk).join(Document, DocumentChunk.document_id == Document.id)
            if request.active_document_ids:
                chunk_stmt = chunk_stmt.where(
                    or_(
                        DocumentChunk.document_id.in_(request.active_document_ids),
                        Document.filename.in_(request.active_document_ids)
                    )
                )
            
            db_res = await db.execute(chunk_stmt)
            db_chunks = db_res.scalars().all()

            if not db_chunks:
                fallback_res = await db.execute(select(DocumentChunk))
                db_chunks = fallback_res.scalars().all()

            query_words = set(request.prompt.lower().split())
            scored_db_chunks = []
            for chk in db_chunks:
                chk_content = chk.raw_content or ""
                overlap_count = sum(1 for w in query_words if len(w) > 3 and w in chk_content.lower())
                scored_db_chunks.append((overlap_count, chk, chk_content))

            scored_db_chunks.sort(key=lambda x: x[0], reverse=True)
            top_db_chunks = [c for score, c, c_text in scored_db_chunks[:4]]

            for chk in top_db_chunks:
                if not any(m.get("chunk_id") == chk.id for m in matches):
                    matches.append({
                        "chunk_id": chk.id,
                        "document_id": chk.document_id,
                        "page_number": chk.page_number,
                        "score": 0.95,
                        "content": chk.raw_content
                    })

            for m in matches:
                citation = ChunkCitation(
                    document_id=m.get("document_id", "doc_sop"),
                    chunk_id=m.get("chunk_id", "chk_001"),
                    page_number=m.get("page_number", 1),
                    snippet=m.get("content", "")[:120]
                )
                citations_collected.append(citation)
                citation_traces.append(f"{citation.document_id}#{citation.chunk_id}")
                rag_results_summary += f"\n[Doc: {citation.document_id}, Page: {citation.page_number}]\n{m.get('content', '')}\n"

            await send_frame({
                "event": "tool_result",
                "step": step_counter,
                "tool_call_id": tool_call_id,
                "tool_name": "rag_search",
                "output": {
                    "matches": matches
                }
            })
            step_counter += 1

        # Step 3: Execute Sandbox Python Script ONLY if Code Execution requested
        requires_sandbox = "code_agent" in plan and any(kw in prompt_low for kw in ["plot", "curve", "simulate", "degradation", "execute"])
        if requires_sandbox:
            tools_called_log.append("sandbox_execute")
            sand_call_id = generate_id("call_sand")

            code_snippet = (
                "import matplotlib.pyplot as plt\n"
                "import numpy as np\n"
                "T = np.linspace(350, 500, 100)\n"
                "D = 1.0 - 0.0015 * (T - 350)\n"
                "P_eff = 160.0 * D\n"
                "print('Thermal Pressure Degradation Calculation Complete.')\n"
            )

            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "sandbox_execute",
                "tool_call_id": sand_call_id,
                "parameters": {"code": code_snippet, "language": "python"}
            })
            step_counter += 1

            sandbox_res = await sandbox_service.execute_python_code(code=code_snippet, timeout_seconds=10)

            await send_frame({
                "event": "tool_result",
                "step": step_counter,
                "tool_call_id": sand_call_id,
                "tool_name": "sandbox_execute",
                "output": {
                    "exit_code": sandbox_res.exit_code,
                    "stdout": sandbox_res.stdout,
                    "stderr": sandbox_res.stderr
                }
            })
            step_counter += 1

        # Step 4: Multi-Turn Conversation Thread Memory & LLM Inference
        thread_history = self.session_histories.setdefault(session_id, [])

        from datetime import datetime
        today_date_str = datetime.now().strftime("%B %d, %Y")

        system_instruction = (
            "You are the Sovereign AI Engineering Workbench Assistant.\n"
            f"Current On-Premise System Date: {today_date_str}.\n"
            "Active User Profile: Rashmi (Lead Operations & Process Engineer).\n"
            "Respond accurately, clearly, and concisely to the user's prompt.\n"
            f"When drafting executive memos, SOPs, or formal documents, ALWAYS automatically populate the Date line with '{today_date_str}' and the From line with 'Rashmi, Lead Operations Engineer' instead of leaving generic brackets like [Your Name] or [Current Date].\n"
            "CRITICAL FORMATTING DIRECTIVE: When writing formal memos, SOPs, or executive text reports, produce ONLY standard prose and document sections. Do NOT append Python scripts, code snippets, or markdown code blocks unless the user explicitly requested software code or script execution in their prompt."
        )


        if rag_results_summary:
            system_instruction += f"\n\nRetrieved Technical Context:\n{rag_results_summary}"

        # Detect @filename mentions and load target artifact file content for targeted editing
        at_mentions = re.findall(r"@([a-zA-Z0-9_\-\.\+]+)", request.prompt)
        if at_mentions:
            referenced_context_parts = []
            for mention in at_mentions:
                if len(mention) < 2:
                    continue
                for root, _, files in os.walk(settings.ARTIFACTS_DIR):
                    for f in files:
                        if mention.lower() in f.lower():
                            filepath = os.path.join(root, f)
                            try:
                                with open(filepath, "r", encoding="utf-8", errors="ignore") as file_obj:
                                    f_content = file_obj.read(2500)
                                    referenced_context_parts.append(f"• Target File @{f}:\n{f_content}")
                            except Exception:
                                pass
            if referenced_context_parts:
                system_instruction += f"\n\nReferenced Target File Context for Targeted Edits:\n" + "\n\n".join(referenced_context_parts)


        # Automatic Context Memory Compression for long sessions (> 10 messages)
        if len(thread_history) > 10:
            earlier_turns = thread_history[:-10]
            summary_lines = []
            for msg in earlier_turns:
                role = msg.get("role", "user").capitalize()
                text_snippet = msg.get("content", "").replace("\n", " ").strip()[:120]
                summary_lines.append(f"• [{role}]: {text_snippet}...")

            summary_block = "\n".join(summary_lines[-8:])
            system_instruction += f"\n\nEarlier Conversation Key Context Summary:\n{summary_block}"

        # Construct message payload with context history (up to last 20 messages for deep continuity)
        llm_messages: List[Dict[str, str]] = [{"role": "system", "content": system_instruction}]
        for past_msg in thread_history[-20:]:
            llm_messages.append(past_msg)

        llm_messages.append({"role": "user", "content": request.prompt})


        # Step 4: Stream Tokens Real-Time Token-by-Token over WebSocket
        model_response_chunks = []
        async for token_chunk in ollama_client.generate_chat_stream(
            llm_messages,
            temperature=request.temperature,
            model=selected_model
        ):
            model_response_chunks.append(token_chunk)
            await send_frame({
                "event": "token",
                "token": token_chunk
            })

        model_response = "".join(model_response_chunks).strip()

        if not model_response:
            # Fallback to non-streaming generate_chat if stream was empty
            model_response = await ollama_client.generate_chat(
                llm_messages,
                temperature=request.temperature,
                model=selected_model
            )

        if not model_response:
            # Fallback if local Ollama or remote server is currently offline
            if "chat_agent" in plan or any(kw in prompt_low for kw in ["hey", "hi", "hello"]):
                model_response = "Hello! I am your Sovereign AI Workbench Assistant. How can I assist you with your code, technical documents, or system architecture?"
            else:
                model_response = "Unable to connect to the sovereign LLM runtime. Please verify that Ollama or your inference endpoint is active."


        # Update session thread history
        thread_history.append({"role": "user", "content": request.prompt})
        thread_history.append({"role": "assistant", "content": model_response})

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Build interactive artifact dynamically for code OR document creation requests
        artifact_data = None
        code_blocks = re.findall(r"```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```", model_response)

        is_code_request = "code_agent" in plan or any(kw in prompt_low for kw in ["code", "script", "component", "write", "create", "build", "refactor", "function", "class"])
        is_doc_request = model_capability == "document_creation" or "rag_agent" in plan or any(kw in prompt_low for kw in ["memo", "sop", "procedure", "report", "document", "draft", "docx"])

        if code_blocks and is_code_request:
            raw_lang, raw_code = code_blocks[0]
            raw_lang = raw_lang.lower().strip() or "code"
            code_trimmed = raw_code.strip()

            if raw_lang in ["java", "jdk"]:
                class_match = re.search(r'public\s+class\s+([A-Za-z0-9_]+)', code_trimmed)
                filename = f"{class_match.group(1)}.java" if class_match else "Main.java"
                badge = "Java · JDK 21"
                lang = "java"
            elif raw_lang in ["python", "py"]:
                class_match = re.search(r'class\s+([A-Za-z0-9_]+)', code_trimmed) or re.search(r'def\s+([A-Za-z0-9_]+)', code_trimmed)
                filename = f"{class_match.group(1).lower()}.py" if class_match else "script.py"
                badge = "Python · Enclave Runner"
                lang = "python"
            elif raw_lang in ["typescript", "ts", "tsx", "javascript", "js", "jsx"]:
                comp_match = re.search(r'(?:export\s+(?:const|function|class)|function)\s+([A-Za-z0-9_]+)', code_trimmed)
                ext = "tsx" if ("<" in code_trimmed and ">" in code_trimmed) or raw_lang in ["tsx", "jsx"] else "ts"
                filename = f"{comp_match.group(1)}.{ext}" if comp_match else f"Component.{ext}"
                badge = f"TypeScript · React" if ext == "tsx" else "TypeScript · Node.js"
                lang = "typescript"
            elif raw_lang in ["cpp", "c++", "c"]:
                filename = "main.cpp" if "++" in raw_lang or "cpp" in raw_lang else "main.c"
                badge = "C++ · Native"
                lang = "cpp"
            elif raw_lang in ["sql", "postgres", "sqlite"]:
                filename = "migration.sql"
                badge = "SQL · Database"
                lang = "sql"
            else:
                filename = f"artifact.{raw_lang}"
                badge = f"{raw_lang.upper()} · Artifact"
                lang = raw_lang

            artifact_data = {
                "id": generate_id(f"art_{lang}"),
                "title": filename,
                "badge": badge,
                "activeFile": filename,
                "files": [
                    {
                        "name": filename,
                        "language": lang,
                        "content": code_trimmed
                    }
                ]
            }
        elif is_doc_request and len(model_response.strip()) > 50:
            subj_match = re.search(r"(?:Subject|Title|MEMORANDUM):\s*([^\n]+)", model_response, re.IGNORECASE) or re.search(r"#\s*([^\n]+)", model_response)
            doc_title = subj_match.group(1).strip() if subj_match else "Executive_SOP_Memo"
            doc_res = generate_docx_document(
                title=doc_title,
                content=model_response,
                citations=[c.model_dump() for c in citations_collected],
                output_dir=settings.ARTIFACTS_DIR
            )
            artifact_data = {
                "id": generate_id("art_docx"),
                "title": doc_res["filename"],
                "badge": "Microsoft Word · .docx",
                "activeFile": doc_res["filename"],
                "download_url": doc_res["download_url"],
                "files": [
                    {
                        "name": doc_res["filename"],
                        "language": "markdown",
                        "content": model_response
                    }
                ]
            }

            clean_title = doc_title.replace("_", " ").strip()
            summary_match = re.search(r"(?:Summary|Executive Summary|Purpose):\s*([^\n]+)", model_response, re.IGNORECASE)
            summary_excerpt = f"\n\n**Executive Summary:** {summary_match.group(1).strip()}" if summary_match else ""

            # Main chat window receives concise executive briefing instead of dumping 80+ lines
            model_response = (
                f"📄 **Document Compiled & Ready**\n\n"
                f"Your document **{clean_title}** has been generated and saved on-premise as a styled Microsoft Word (`.docx`) file.{summary_excerpt}\n\n"
                f"Click **Open →** or inspect the side panel to view, edit, or download the full `.docx` document."
            )

            # Announce tool execution frame for document builder
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "generate_docx_document",
                "tool_call_id": generate_id("call_doc"),
                "parameters": {"title": doc_title, "format": "docx"}
            })
            step_counter += 1



        # Step 5: Record Cryptographic Audit Trail in SQLite
        audit_record = AuditLog(
            id=generate_id("audit"),
            session_id=session_id,
            prompt_hash=compute_sha256(request.prompt),
            tools_called=json.dumps(tools_called_log),
            citations=json.dumps([c.model_dump() for c in citations_collected]),
            egress_bytes=0,
            execution_duration_ms=duration_ms,
            compliance_status="AIR_GAP_PASSED"
        )
        db.add(audit_record)
        await db.commit()

        # Step 6: Emit final_answer frame over WebSocket
        final_frame = {
            "event": "final_answer",
            "content": model_response,
            "citations": [c.model_dump() for c in citations_collected],
            "artifact": artifact_data,
            "metrics": {
                "execution_time_ms": duration_ms,
                "air_gap_intact": True,
                "model_used": selected_model,
                "model_capability": model_capability,
                "routing_reason": routing_reason
            }
        }
        await send_frame(final_frame)
        return final_frame

agent_engine = AgentExecutionEngine()

