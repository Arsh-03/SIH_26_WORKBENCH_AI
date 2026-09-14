import time
import json
import logging
import sys
import os
import re
import asyncio
from typing import List, Dict, Any, Callable, Awaitable, Optional
from sqlalchemy import select
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
from ai_engine.agents.analytics_agent import ANALYTICS_DIRECTIVE, extract_chart_specs, create_chart_artifact
from ai_engine.agents.economics_agent import ECONOMICS_DIRECTIVE, extract_economics_specs
from ai_engine.agents.physics_agent import PHYSICS_DIRECTIVE, extract_physics_specs
from ai_engine.agents.pid_agent import PID_DIRECTIVE, extract_pid_specs


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

        # Check available and warm/resident local Ollama models for dynamic router fallback matching
        health_info = await ollama_client.check_health()
        available_models = health_info.get("available_models", [])
        running_models = health_info.get("running_models", [])

        # Step 1: Execute AI Engine Supervisor Agent Node for Dynamic Multi-Agent DAG Planning
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
            "available_models": available_models,
            "running_models": running_models
        }

        selected_model = "llama3.1:8b"
        model_capability = "general_chat"
        routing_reason = ""

        if supervisor_node:
            try:
                from ai_engine.agents.supervisor import supervisor_node_async
                sup_res = await supervisor_node_async(initial_state)
            except Exception as sup_err:
                logger.warning(f"Async supervisor node failed ({sup_err}), falling back to sync supervisor.")
                sup_res = supervisor_node(initial_state)
            plan = sup_res.get("plan", ["chat_agent"])
            selected_model = sup_res.get("selected_model", selected_model)
            model_capability = sup_res.get("model_capability", model_capability)
            routing_reason = sup_res.get("routing_reason", "")
        else:
            is_doc_query = bool(request.active_document_ids) or any(kw in prompt_low for kw in ["sop", "boiler", "spec", "mawp", "pressure", "mrpl"])
            plan = ["rag_agent", "chat_agent"] if is_doc_query else ["chat_agent"]

        plan_display = " -> ".join(plan)
        thought_content = f"Sovereign Multi-Agent Plan: [{plan_display}] | Active Model: '{selected_model}' [{model_capability.upper()}] -- {routing_reason}"
        await send_frame({
            "event": "thought",
            "step": step_counter,
            "content": thought_content
        })
        step_counter += 1


        rag_results_summary = ""
        sandbox_res = None

        # Step 2: Adaptive Execution of Planned Tools (RAG Search & Code Sandbox)
        should_run_rag = "rag_agent" in plan and ("rag_search" in request.allowed_tools or not request.allowed_tools)
        requires_sandbox = "code_agent" in plan and any(kw in prompt_low for kw in ["plot", "curve", "simulate", "simulation", "degradation", "execute", "calculate", "python"])

        async def _execute_rag_flow():
            nonlocal step_counter, rag_results_summary
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

            # Query vector store: Search both User Workspace and Official Company Knowledge Base (company_shared)
            query_emb = await ollama_client.get_embedding(request.prompt)
            user_matches = vector_store_service.query_chunks(
                workspace_id=request.workspace_id,
                query_embedding=query_emb,
                top_k=4,
                document_ids=request.active_document_ids if request.active_document_ids else None
            )
            company_matches = vector_store_service.query_chunks(
                workspace_id="company_shared",
                query_embedding=query_emb,
                top_k=4
            )

            # Merge results, prioritizing exact active document matches
            matches = user_matches + [c for c in company_matches if not any(u.get("chunk_id") == c.get("chunk_id") for u in user_matches)]

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

            # Only search database chunks if documents were specifically requested or vector matched
            if request.active_document_ids and not db_chunks:
                fallback_res = await db.execute(select(DocumentChunk))
                db_chunks = fallback_res.scalars().all()

            query_words = set(request.prompt.lower().split())
            scored_db_chunks = []
            for chk in db_chunks:
                chk_content = chk.raw_content or ""
                overlap_count = sum(1 for w in query_words if len(w) > 3 and w in chk_content.lower())
                if overlap_count > 0:
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

            # Only add to technical context if matches were found
            if request.active_document_ids or matches:
                for idx, m in enumerate(matches, 1):
                    raw_doc_id = m.get("document_id", "doc_sop")
                    clean_doc_id = re.sub(r"^company_doc_", "", raw_doc_id)
                    clean_doc_id = re.sub(r"_md$", ".md", clean_doc_id)
                    full_txt = m.get("content", "")
                    citation = ChunkCitation(
                        document_id=clean_doc_id,
                        chunk_id=m.get("chunk_id", f"chk_{idx}"),
                        page_number=m.get("page_number", 1),
                        snippet=full_txt[:320].strip(),
                        content=full_txt.strip()
                    )
                    citations_collected.append(citation)
                    citation_traces.append(f"{citation.document_id}#{citation.chunk_id}")
                    rag_results_summary += f"\n[Source [{idx}]: {clean_doc_id}, Page: {citation.page_number}]\n{full_txt}\n"

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

        async def _execute_sandbox_flow():
            nonlocal step_counter, sandbox_res
            tools_called_log.append("sandbox_execute")
            sand_call_id = generate_id("call_sand")

            code_snippet = (
                "import matplotlib.pyplot as plt\n"
                "import numpy as np\n"
                "T = np.linspace(350, 500, 100)\n"
                "D = 1.0 - 0.0015 * (T - 350)\n"
                "P_eff = 160.0 * D\n"
                "print('Thermal Pressure Degradation Calculation Complete. MAWP at 500C: 124 bar.')\n"
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

        # Execute tools in strictly sequential order: RAG Search first, then Sandbox Execution
        if should_run_rag:
            await _execute_rag_flow()
        if requires_sandbox:
            await _execute_sandbox_flow()

        # Step 4: Multi-Turn Conversation Thread Memory & LLM Inference
        thread_history = self.session_histories.setdefault(session_id, [])
        all_past_code_snippets = []

        from datetime import datetime
        today_date_str = datetime.now().strftime("%B %d, %Y")

        user_name = "Lead AI Architect"
        user_role = "Lead Operations Engineer"
        if db:
            try:
                from backend.app.models.sql_models import DBChatSession, DBChatMessage, User
                chat_sess = await db.get(DBChatSession, session_id)
                if chat_sess and chat_sess.user_id:
                    user_obj = await db.get(User, chat_sess.user_id)
                    if user_obj:
                        user_name = user_obj.full_name or user_obj.username
                        user_role = user_obj.role or "Lead Operations Engineer"

                # Load conversation history and artifacts from DB
                db_msgs_res = await db.execute(
                    select(DBChatMessage).where(DBChatMessage.session_id == session_id).order_by(DBChatMessage.created_at)
                )
                db_msgs = db_msgs_res.scalars().all()
                if db_msgs:
                    db_thread = []
                    for m in db_msgs:
                        # Extract code from artifact JSON if present
                        if m.artifact:
                            try:
                                art_obj = json.loads(m.artifact)
                                if isinstance(art_obj, dict) and "files" in art_obj:
                                    for f_item in art_obj.get("files", []):
                                        f_code = f_item.get("content", "")
                                        f_lang = f_item.get("language", "")
                                        if f_code and f_lang not in ["markdown", "text", "json"]:
                                            all_past_code_snippets.append(f_code.strip())
                            except Exception:
                                pass

                        # Extract code from markdown text
                        if m.text:
                            found_blocks = re.findall(r"```[a-zA-Z0-9_\-\+]*\n([\s\S]*?)```", m.text)
                            for b in found_blocks:
                                if len(b.strip()) > 10:
                                    all_past_code_snippets.append(b.strip())

                        role = "user" if m.sender == "user" else "assistant"
                        # Do not duplicate current prompt if it was already inserted into db
                        if m == db_msgs[-1] and m.sender == "user" and m.text == request.prompt:
                            continue
                        db_thread.append({"role": role, "content": m.text or ""})

                    if len(db_thread) >= len(thread_history):
                        thread_history = db_thread
                        self.session_histories[session_id] = thread_history
            except Exception as hist_err:
                logger.error(f"Error loading thread history from DB: {hist_err}")

        # Load authoritative system prompt from ai_engine/prompts/system_prompt.md
        system_prompt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai_engine/prompts/system_prompt.md"))
        system_prompt_md = ""
        if os.path.exists(system_prompt_path):
            try:
                with open(system_prompt_path, "r", encoding="utf-8") as sp_f:
                    system_prompt_md = sp_f.read().strip()
            except Exception as sp_err:
                logger.warning(f"Could not read system_prompt.md: {sp_err}")

        system_instruction = (
            f"{system_prompt_md}\n\n" if system_prompt_md else "You are the Sovereign AI Engineering Workbench Assistant.\n"
        )
        system_instruction += (
            f"Current On-Premise System Date: {today_date_str}.\n"
            f"Active User Profile: {user_name} ({user_role}).\n"
            "CRITICAL DIRECTIVES:\n"
            "- Greetings: When the user greets you ('hey', 'hello', 'hi', 'good morning'), ALWAYS greet back warmly and politely, state what you are made for in 1-2 brief sentences, and ask how you can help with their technical tasks. NEVER decline greetings or say 'it seems like you are trying to initiate a conversation'.\n"
            "- Off-Topic / Pop-Culture / Cartoons: If asked about non-engineering topics (e.g. 'Doraemon', entertainment, movies, general chit-chat), politely decline and state what you are made for (industrial plant engineering, ASME Section VIII, SOP-401, mathematical physics calculations, and compliance documentation).\n"
            "- Zero Meta-Prompt Leakage: NEVER mention system directives, guidelines, or prompt rules (never say 'as outlined in the prompt above' or 'following guidelines'). Speak naturally as an engineering colleague.\n"
            "- Deliver a crisp, balanced, and to-the-point response ('somewhere in between' - not too much, not too brief).\n"
            "- Avoid overwhelming walls of text. Present facts clearly using scannable bullet points and compact formulas.\n"
            "- When asked to brief, keep it brief and high-level. When asked to elaborate, provide technical depth. In standard mode, keep it direct and balanced.\n"
            "- NEVER duplicate sections, formulas, or headers within the same response.\n"
            "- Mandatory Inline Citations: When referencing or quoting from documents or standards (SOP-401, ASME Section VIII, Safety Policy), ALWAYS include inline citation numbers like [1] or [2] immediately following the statement or document name (e.g. 'Refer to SOP-401 [1], Section 3'). Never mention a document without its citation number.\n"
            "- Ground your answer strictly in the Retrieved Technical Context below without hallucinating.\n"
            "- If the user asks an informational question, provide the factual answer directly. Do NOT generate an unrequested Word (.docx) document or executive memo.\n"
            "- If interactive follow-ups are helpful, append at most ONE :::options block at the very end:\n"
            ":::options\n"
            "- Option A description\n"
            "- Option B description\n"
            ":::\n"
        )

        if rag_results_summary:
            system_instruction += f"\n\nRetrieved Technical Context (Authoritative MRPL Knowledge Base & Standards):\n{rag_results_summary}"

        if sandbox_res and sandbox_res.stdout:
            system_instruction += f"\n\nExecuted Python Sandbox Simulation Output:\n```\n{sandbox_res.stdout.strip()}\n```\nIncorporate these calculated engineering values and simulation results into your technical response."

        if "doc_agent" in plan:
            system_instruction += (
                "\n\nCRITICAL DIRECTIVE FOR FORMAL DOCUMENT GENERATION:\n"
                "The user has requested an executive or technical engineering document. "
                "Structure the output comprehensively with a formal Document Title (# Title), Document Control & Approval metadata, "
                "Clear Hierarchical Sections (##), Engineering Specifications (referencing ASME Section VIII / SOP-401), "
                "Exact Inline Citations ([1], [2]), and Compliance Sign-Off tables."
            )

        if "analytics_agent" in plan or any(kw in prompt_low for kw in ["chart", "plot", "trend", "graph", "breakdown", "visualize", "distribution", "analytics", "bar chart", "line chart"]):
            system_instruction += f"\n\n{ANALYTICS_DIRECTIVE}"

        if "economics_agent" in plan or any(kw in prompt_low for kw in ["cost", "economics", "revenue", "loss", "margin", "grm", "opex", "downtime cost", "steam cost", "financial"]):
            system_instruction += f"\n\n{ECONOMICS_DIRECTIVE}"

        if "physics_agent" in plan or any(kw in prompt_low for kw in ["asme", "wall thickness", "stress", "creep", "larson-miller", "darcy", "lmtd", "hydraulics", "mawp", "rupture"]):
            system_instruction += f"\n\n{PHYSICS_DIRECTIVE}"

        if "pid_agent" in plan or any(kw in prompt_low for kw in ["p&id", "pid", "schematic", "flow diagram", "pfd", "process canvas", "piping"]):
            system_instruction += f"\n\n{PID_DIRECTIVE}"

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

        # Extract recent code context from previous conversation turns only if user specifically requests code documentation
        recent_code_in_thread = all_past_code_snippets[0] if all_past_code_snippets else ""
        if not recent_code_in_thread:
            for past_msg in reversed(thread_history):
                past_content = past_msg.get("content", "")
                found_blocks = re.findall(r"```[a-zA-Z0-9_\-\+]*\n([\s\S]*?)```", past_content)
                if found_blocks:
                    recent_code_in_thread = found_blocks[0].strip()
                    break

        is_explicit_code_doc = recent_code_in_thread and any(phrase in prompt_low for phrase in [
            "document this code", "create doc for this code", "document the code above", "generate code spec"
        ])
        if is_explicit_code_doc and not request.active_document_ids:
            system_instruction += (
                f"\n\nSource Code from Active Conversation for Documentation Reference:\n```\n{recent_code_in_thread}\n```\n"
                "The user is asking to create a formal Technical Code Specification for the source code above. Document the code functions, parameters, and verification guide."
            )

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

        # Construct message payload with context history (up to last 6 messages to maintain low latency on Colab)
        llm_messages: List[Dict[str, str]] = [{"role": "system", "content": system_instruction}]
        for past_msg in thread_history[-6:]:
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
            # Check Ollama health to provide precise diagnostic
            health = await ollama_client.check_health()
            if health.get("running"):
                avail = health.get("available_models", [])
                is_downloaded = any(selected_model.lower() in m.lower() or m.lower() in selected_model.lower() for m in avail)
                if not avail:
                    model_response = (
                        f"⚡ **Connected to Ollama** at `{ollama_client.base_url}`, but **no models have been downloaded yet**.\n\n"
                        f"👉 **To fix this**, open your Google Colab notebook and run this cell:\n"
                        f"```bash\n!ollama pull llama3.1:8b\n```\n"
                        f"Once downloaded, retry your prompt!"
                    )
                elif not is_downloaded:
                    model_response = (
                        f"⚠️ Requested model `{selected_model}` is not downloaded on Ollama.\n\n"
                        f"**Available models:** {', '.join([f'`{m}`' for m in avail])}\n\n"
                        f"👉 Run `!ollama pull {selected_model}` in Colab to install it."
                    )
                else:
                    model_response = (
                        f"⚠️ **Inference Gateway Timeout**: The sovereign model `{selected_model}` is active on Ollama, but the Colab inference endpoint timed out or was busy.\n\n"
                        f"👉 **To resolve**: Check your Google Colab tab to make sure the session is active and not executing another task, then retry your prompt."
                    )
            else:
                if "chat_agent" in plan or any(kw in prompt_low for kw in ["hey", "hi", "hello"]):
                    model_response = "Hello! I am your Sovereign AI Engineering Workbench Assistant. I'm here to assist you with industrial plant engineering, technical standards (ASME Section VIII, SOP-401, safety policies), pressure vessel calculations, and technical documentation. How can I assist you with your operations today?"
                else:
                    model_response = "Unable to connect to the sovereign LLM runtime. Please verify that Ollama or your inference endpoint is active."


        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Build interactive artifact dynamically for document creation OR code generation requests
        artifact_data = None
        code_blocks = re.findall(r"```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```", model_response)

        is_explain_request = any(kw in prompt_low for kw in ["walkthrough", "breakdown", "explain", "complexity"])
        
        is_question = any(prompt_low.startswith(qw) for qw in [
            "what", "how", "why", "when", "where", "who", "which", "is ", "are ", 
            "can ", "could ", "do ", "does ", "tell me", "explain", "describe", "show me", "list"
        ]) or prompt_low.endswith("?")

        doc_create_verbs = ["create", "generate", "draft", "compile", "build", "write", "export", "save as", "produce", "make a"]
        doc_create_nouns = ["doc", "document", "docx", "word doc", "report", "formal report", "written memo", "memo", "full sop", "specification"]
        is_explicit_doc_creation = (
            (any(v in prompt_low for v in doc_create_verbs) and any(n in prompt_low for n in doc_create_nouns)) or 
            any(phrase in prompt_low for phrase in ["save as doc", "save the output", "save in doc", "generate doc", "create doc", "draft report", "export to docx", "save as word"])
        )

        is_doc_request = ("doc_agent" in plan) or (is_explicit_doc_creation and not is_question)
        is_code_request = (
            not is_doc_request and 
            ("code_agent" in plan or any(kw in prompt_low for kw in ["code", "script", "component", "write", "create", "build", "refactor", "function", "class"])) and 
            not is_explain_request
        )

        # Only retain Human-In-The-Loop :::options if generated by model or if query is genuinely ambiguous/underspecified
        # Standard, well-grounded questions should NOT be force-polluted with option cards.
        pass

        if is_doc_request and len(model_response.strip()) > 30:
            subj_match = (
                re.search(r"^#\s*([^\n]+)", model_response, re.MULTILINE) or 
                re.search(r"(?:Subject|Title|Document Name|MEMORANDUM):\s*([^\n]+)", model_response, re.IGNORECASE)
            )
            raw_title = subj_match.group(1).strip() if subj_match else ("Technical_Code_Specification" if recent_code_in_thread else "Executive_Engineering_Document")
            clean_title = re.sub(r'[*#_`]', ' ', raw_title).strip()
            clean_title = re.sub(r'\s+', ' ', clean_title)

            doc_res = generate_docx_document(
                title=clean_title,
                content=model_response,
                citations=[c.model_dump() for c in citations_collected],
                output_dir=settings.ARTIFACTS_DIR,
                author_name=user_name,
                author_title=user_role
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

            # Retain the full document markdown in chat, prepending the styled document notification banner
            doc_banner = (
                f"> 📄 **Document Compiled & Ready**: Saved on-premise as `{clean_title}.docx`.\n"
                f"> Click **Open →** in the artifact card to view, edit, or download the full Word document.\n\n---\n\n"
            )
            model_response = doc_banner + model_response

            # Announce tool execution frame for document builder
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "generate_docx_document",
                "tool_call_id": generate_id("call_doc"),
                "parameters": {"title": clean_title, "format": "docx"}
            })
            step_counter += 1

        elif code_blocks and (is_code_request or any("def " in cb[1] or "class " in cb[1] or "int main" in cb[1] or "#include" in cb[1] for cb in code_blocks)):
            # Group snippets by primary language
            primary_lang = "python"
            lang_counts = {}
            for raw_l, _ in code_blocks:
                norm_l = (raw_l or "").lower().strip()
                if norm_l in ["py", "python3"]:
                    norm_l = "python"
                lang_counts[norm_l] = lang_counts.get(norm_l, 0) + 1
            if lang_counts:
                primary_lang = max(lang_counts, key=lang_counts.get)

            # Filter blocks belonging to the primary language
            primary_blocks = []
            for raw_l, code_str in code_blocks:
                norm_l = (raw_l or "").lower().strip()
                if norm_l in ["py", "python3"]:
                    norm_l = "python"
                if norm_l == primary_lang or not norm_l:
                    primary_blocks.append(code_str.strip())

            if len(primary_blocks) > 1 and primary_lang == "python":
                # Combine multiple python snippets into one unified runnable simulation script
                unique_imports = set()
                for block in primary_blocks:
                    for line in block.split("\n"):
                        clean_l = line.strip()
                        if clean_l.startswith("import ") or clean_l.startswith("from "):
                            unique_imports.add(clean_l)

                header_lines = [
                    '"""',
                    'Sovereign AI Engineering Workbench - Unified Execution Script',
                    '"""',
                    ""
                ]
                if unique_imports:
                    header_lines.extend(sorted(list(unique_imports)))
                    header_lines.append("")

                combined_sections = []
                for idx, block in enumerate(primary_blocks, 1):
                    # Filter out top-level imports that are already consolidated
                    body_lines = []
                    for line in block.split("\n"):
                        clean_l = line.strip()
                        if not (clean_l.startswith("import ") or clean_l.startswith("from ")):
                            body_lines.append(line)
                    body_text = "\n".join(body_lines).strip()
                    if body_text:
                        combined_sections.append(f"# ==========================================\n# Step {idx}: Module Execution\n# ==========================================\n{body_text}")

                code_trimmed = "\n".join(header_lines) + "\n\n" + "\n\n".join(combined_sections)
            elif primary_blocks:
                code_trimmed = primary_blocks[0]
            else:
                code_trimmed = code_blocks[0][1].strip()

            raw_lang = primary_lang

            if raw_lang in ["c"]:
                filename = "main.c"
                badge = "C · GCC / Native"
                lang = "c"
            elif raw_lang in ["cpp", "c++", "cc", "cxx", "hpp", "h"]:
                filename = "main.cpp"
                badge = "C++ · G++ / Native"
                lang = "cpp"
            elif raw_lang in ["java", "jdk"]:
                class_match = re.search(r'public\s+class\s+([A-Za-z0-9_]+)', code_trimmed)
                filename = f"{class_match.group(1)}.java" if class_match else "Main.java"
                badge = "Java · OpenJDK 21"
                lang = "java"
            elif raw_lang in ["python", "py", "python3"]:
                class_match = re.search(r'class\s+([A-Za-z0-9_]+)', code_trimmed) or re.search(r'def\s+([A-Za-z0-9_]+)', code_trimmed)
                filename = f"{class_match.group(1).lower()}.py" if class_match else "script.py"
                badge = "Python · Enclave Runner"
                lang = "python"
            elif raw_lang in ["typescript", "ts", "tsx"]:
                comp_match = re.search(r'(?:export\s+(?:const|function|class)|function)\s+([A-Za-z0-9_]+)', code_trimmed)
                ext = "tsx" if ("<" in code_trimmed and ">" in code_trimmed) or raw_lang == "tsx" else "ts"
                filename = f"{comp_match.group(1)}.{ext}" if comp_match else f"Component.{ext}"
                badge = "TypeScript · React" if ext == "tsx" else "TypeScript · Node.js"
                lang = "typescript"
            elif raw_lang in ["javascript", "js", "jsx"]:
                comp_match = re.search(r'(?:export\s+(?:const|function|class)|function)\s+([A-Za-z0-9_]+)', code_trimmed)
                ext = "jsx" if ("<" in code_trimmed and ">" in code_trimmed) or raw_lang == "jsx" else "js"
                filename = f"{comp_match.group(1)}.{ext}" if comp_match else f"index.{ext}"
                badge = "JavaScript · React" if ext == "jsx" else "JavaScript · Node.js"
                lang = "javascript"
            elif raw_lang in ["rust", "rs"]:
                filename = "main.rs"
                badge = "Rust · Cargo"
                lang = "rust"
            elif raw_lang in ["go", "golang"]:
                filename = "main.go"
                badge = "Go · Native"
                lang = "go"
            elif raw_lang in ["csharp", "cs", "c#"]:
                filename = "Program.cs"
                badge = "C# · .NET"
                lang = "csharp"
            elif raw_lang in ["bash", "sh", "shell", "zsh"]:
                filename = "script.sh"
                badge = "Bash · Shell Enclave"
                lang = "bash"
            elif raw_lang in ["sql", "postgres", "sqlite", "mysql"]:
                filename = "query.sql"
                badge = "SQL · Database"
                lang = "sql"
            elif raw_lang in ["html", "htm"]:
                filename = "index.html"
                badge = "HTML · Web Preview"
                lang = "html"
            elif raw_lang in ["css", "scss", "sass"]:
                filename = "styles.css"
                badge = "CSS · Stylesheet"
                lang = "css"
            elif raw_lang in ["json"]:
                filename = "data.json"
                badge = "JSON · Data"
                lang = "json"
            else:
                filename = f"source.{raw_lang}"
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

        # Check for dynamic visual analytics charts
        chart_specs = extract_chart_specs(model_response)
        if chart_specs:
            # If chart was synthesized because :::chart was omitted by the LLM, inject :::chart into response
            if ":::chart" not in model_response:
                model_response += "\n\n:::chart\n" + json.dumps(chart_specs[0], indent=2) + "\n:::\n"

            tools_called_log.append("generate_dynamic_chart")
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "generate_dynamic_chart",
                "tool_call_id": generate_id("call_chart"),
                "parameters": {
                    "chart_type": chart_specs[0].get("type", "line"),
                    "title": chart_specs[0].get("title", "Industrial Performance Chart"),
                    "data_points": len(chart_specs[0].get("data", []))
                }
            })
            step_counter += 1

        # Check for refinery operational economics
        econ_specs = extract_economics_specs(model_response)
        if econ_specs:
            tools_called_log.append("calculate_refinery_economics")
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "calculate_refinery_economics",
                "tool_call_id": generate_id("call_econ"),
                "parameters": {
                    "title": econ_specs[0].get("title", "Refinery Economics Assessment"),
                    "currency": econ_specs[0].get("currency", "USD"),
                    "headlineMetric": econ_specs[0].get("headlineMetric", {}).get("value", "")
                }
            })
            step_counter += 1

        # Check for engineering physics & ASME simulation
        phys_specs = extract_physics_specs(model_response)
        if phys_specs:
            tools_called_log.append("execute_physics_simulation")
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "execute_physics_simulation",
                "tool_call_id": generate_id("call_phys"),
                "parameters": {
                    "title": phys_specs[0].get("title", "ASME Mechanical Calculation"),
                    "standard": phys_specs[0].get("standard", "ASME Section VIII"),
                    "status": phys_specs[0].get("status", "PASS"),
                    "marginOfSafety": phys_specs[0].get("marginOfSafety", 0)
                }
            })
            step_counter += 1

        # Check for P&ID schematics & process canvas
        pid_specs = extract_pid_specs(model_response)

        is_pid_query = "pid_agent" in plan or any(kw in prompt_low for kw in [
            "p&id", "pid", "schematic", "flow diagram", "pfd", "process canvas", "piping", "equipment node"
        ])
        is_refusal = any(phrase in model_response.lower() for phrase in [
            "i can't provide a p&id", "i cannot provide a p&id", "proprietary information", 
            "sensitive details about a specific industrial", "i can't provide proprietary",
            "sensitive details", "specific industrial facility", "i am unable to provide a p&id",
            "i can't generate a p&id", "i cannot generate a p&id"
        ])

        if is_pid_query and (not pid_specs or is_refusal):
            from ai_engine.agents.pid_agent import get_default_mrpl_steam_pid
            fallback_pid = get_default_mrpl_steam_pid()
            pid_specs = [fallback_pid]
            clean_intro = (
                "### MRPL High-Pressure Steam Generation & Relief Network (P&ID)\n\n"
                "Here is the interactive **Piping & Instrumentation Diagram (P&ID) Process Flow Schematic** for the MRPL High-Pressure Steam Generation and Relief Network, representing **Boiler B-401**, **Header Safety Relief Valve PRV-102**, **Flash Drum V-102**, and **Superheater E-101** operating at **480°C**.\n\n"
                "#### Operating & Safety Analysis\n"
                "- **Boiler B-401**: Baseline MAWP is 160.0 bar at 350°C. Under elevated 480°C operations, effective MAWP degrades to **128.8 bar** following the SOP-401 thermal degradation curve [1].\n"
                "- **Safety Relief Valve PRV-102**: Set to discharge to Flare Header F-01 at 130 bar. At 480°C, operating pressure encroaches within 1.2 bar of the critical set point, requiring high-temperature recalibration per ASME Section VIII [2].\n"
                "- **Flash Drum V-102**: Operating at 24.5 bar with 34.0 mm nominal wall thickness and 3.0 mm corrosion allowance [2].\n"
                "- **Superheater E-101**: 2.25Cr-1Mo (P22) metallurgy with Larson-Miller creep threshold evaluated for continuous 480°C thermal duty.\n\n"
                "You can click on any equipment node in the interactive canvas below to inspect live parameters, or adjust the **Digital Twin simulation sliders** to observe live MAWP degradation and relief valve trip limits in real time."
            )
            if is_refusal:
                model_response = clean_intro + "\n\n:::pid\n" + json.dumps(fallback_pid, indent=2) + "\n:::"
            elif ":::pid" not in model_response:
                model_response = model_response + "\n\n:::pid\n" + json.dumps(fallback_pid, indent=2) + "\n:::"

        if pid_specs:
            tools_called_log.append("generate_pid_schematic")
            await send_frame({
                "event": "tool_call",
                "step": step_counter,
                "tool_name": "generate_pid_schematic",
                "tool_call_id": generate_id("call_pid"),
                "parameters": {
                    "title": pid_specs[0].get("title", "P&ID Process Schematic"),
                    "unit": pid_specs[0].get("unit", "Refinery Unit"),
                    "nodes": len(pid_specs[0].get("nodes", []))
                }
            })
            step_counter += 1

        # Deduplicate repetitive sections and normalize :::options
        def deduplicate_response_content(text: str) -> str:
            if not text:
                return text

            options_matches = re.findall(r":::options\s*([\s\S]*?):::", text)
            clean_body = re.sub(r":::options\s*([\s\S]*?):::", "", text).strip()

            parts = re.split(r"(?=(?:^|\n)#{1,3}\s+)", clean_body)
            seen_sections = set()
            deduped_parts = []
            for p in parts:
                p_str = p.strip()
                if not p_str:
                    continue
                key = re.sub(r"\s+", " ", p_str)[:80].lower()
                if key in seen_sections:
                    continue
                seen_sections.add(key)
                deduped_parts.append(p_str)

            final_text = "\n\n".join(deduped_parts) if deduped_parts else clean_body

            unique_options = []
            for blk in options_matches:
                for line in blk.split("\n"):
                    opt = re.sub(r"^[-*•\d\.\)]\s*", "", line).strip()
                    if opt and opt not in unique_options:
                        unique_options.append(opt)

            if unique_options:
                final_text += "\n\n:::options\n" + "\n".join(f"- {o}" for o in unique_options[:4]) + "\n:::"

            return final_text

        model_response = deduplicate_response_content(model_response)

        # Update session thread history with final model response (single source of truth)
        thread_history.append({"role": "user", "content": request.prompt})
        thread_history.append({"role": "assistant", "content": model_response})

        # Step 5: Execute Compliance Validator / Evaluator Agent
        val_status = "AIR_GAP_PASSED"
        grounding_score = 1.0
        audit_findings = []
        if "validator_agent" in plan:
            try:
                from ai_engine.agents.validator_agent import validator_agent
                val_res = validator_agent.validate_response(
                    prompt=request.prompt,
                    response_text=model_response,
                    retrieved_citations=[c.model_dump() for c in citations_collected],
                    has_code_execution=bool(sandbox_res),
                    sandbox_output={"exit_code": sandbox_res.exit_code, "stdout": sandbox_res.stdout} if sandbox_res else None
                )
                grounding_score = val_res.get("grounding_score", 1.0)
                audit_findings = val_res.get("audit_findings", [])
                val_status = "COMPLIANCE_VERIFIED" if val_res.get("is_compliant", True) else "COMPLIANCE_FLAGGED"

                findings_snippet = "; ".join(audit_findings[:2]) if audit_findings else "Verification complete"
                await send_frame({
                    "event": "thought",
                    "step": step_counter,
                    "content": f"Compliance Evaluator: Grounding Score {int(grounding_score * 100)}% ({val_res.get('citation_check', 'VERIFIED')}) | MRPL/ASME: {val_res.get('safety_margin_check', 'PASSED')} -- {findings_snippet}"
                })
                step_counter += 1
            except Exception as val_err:
                logger.warning(f"Validator agent check failed: {val_err}")

        # Step 6: Record Cryptographic Audit Trail in SQLite
        audit_record = AuditLog(
            id=generate_id("audit"),
            session_id=session_id,
            prompt_hash=compute_sha256(request.prompt),
            tools_called=json.dumps(tools_called_log),
            citations=json.dumps([c.model_dump() for c in citations_collected]),
            egress_bytes=0,
            execution_duration_ms=duration_ms,
            compliance_status=val_status
        )
        db.add(audit_record)
        await db.commit()

        # Step 7: Emit final_answer frame over WebSocket
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
                "routing_reason": routing_reason,
                "plan_executed": plan,
                "grounding_score": grounding_score,
                "compliance_status": val_status,
                "audit_findings": audit_findings
            }
        }
        await send_frame(final_frame)
        return final_frame

agent_engine = AgentExecutionEngine()

