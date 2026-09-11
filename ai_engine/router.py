import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import ai_engine.config as cfg

logger = logging.getLogger("model_router")

class ModelCapability(str, Enum):
    CODING = "coding"
    MATH_REASONING = "math_reasoning"
    DOCUMENT_CREATION = "document_creation"
    VISION_OCR = "vision_ocr"
    GENERAL_CHAT = "general_chat"

@dataclass
class ModelProfile:
    name: str
    capability: ModelCapability
    description: str
    recommended_temp: float = 0.2
    fallback_model: str = cfg.MODEL_REASONING

class ModelRegistry:
    """
    Pluggable Registry for Sovereign On-Premise LLM/VLM Models.
    Permits runtime registration of new open-weights models without code modification.
    """
    def __init__(self):
        self._registry: Dict[ModelCapability, ModelProfile] = {}
        self._load_default_profiles()

    def _load_default_profiles(self):
        self._registry[ModelCapability.CODING] = ModelProfile(
            name=cfg.MODEL_CODE,
            capability=ModelCapability.CODING,
            description="Specialized local code generation & sandbox execution model (e.g. Qwen2.5-Coder / CodeLlama)",
            recommended_temp=0.1,
            fallback_model=cfg.MODEL_REASONING
        )
        self._registry[ModelCapability.MATH_REASONING] = ModelProfile(
            name=cfg.MODEL_MATH,
            capability=ModelCapability.MATH_REASONING,
            description="Deep mathematical reasoning, physics formulas & logic analysis model (e.g. LLaMA 3.1 / DeepSeek-R1)",
            recommended_temp=0.1,
            fallback_model=cfg.MODEL_REASONING
        )
        self._registry[ModelCapability.DOCUMENT_CREATION] = ModelProfile(
            name=cfg.MODEL_DOCS,
            capability=ModelCapability.DOCUMENT_CREATION,
            description="Technical document RAG, memo drafting & SOP text synthesis model (e.g. Qwen2.5 / Mistral)",
            recommended_temp=0.3,
            fallback_model=cfg.MODEL_REASONING
        )
        self._registry[ModelCapability.VISION_OCR] = ModelProfile(
            name=cfg.MODEL_VISION,
            capability=ModelCapability.VISION_OCR,
            description="Multimodal Vision Language Model for P&ID schematics, OCR & diagram analysis (e.g. Qwen2-VL)",
            recommended_temp=0.2,
            fallback_model=cfg.MODEL_REASONING
        )
        self._registry[ModelCapability.GENERAL_CHAT] = ModelProfile(
            name=cfg.MODEL_CHAT,
            capability=ModelCapability.GENERAL_CHAT,
            description="Lightweight conversational dialogue model (e.g. LLaMA 3.1 8B)",
            recommended_temp=0.7,
            fallback_model=cfg.MODEL_REASONING
        )

    def register_model(self, profile: ModelProfile) -> None:
        """Register or overwrite a model profile for a specific capability domain."""
        self._registry[profile.capability] = profile
        logger.info(f"Registered model '{profile.name}' for capability '{profile.capability.value}'")

    def get_profile(self, capability: ModelCapability) -> ModelProfile:
        return self._registry.get(
            capability,
            ModelProfile(
                name=cfg.MODEL_REASONING,
                capability=capability,
                description="Default sovereign reasoning model"
            )
        )

    def list_registered_models(self) -> List[Dict[str, Any]]:
        return [
            {
                "capability": cap.value,
                "model_name": profile.name,
                "description": profile.description,
                "fallback": profile.fallback_model
            }
            for cap, profile in self._registry.items()
        ]

class DynamicModelRouter:
    """
    Analyzes incoming user intent, query domain, active documents, and runtime Ollama model availability
    to dynamically route prompts to the optimal specialized local model using LLM classification with heuristic fallback.
    """
    def __init__(self, registry: Optional[ModelRegistry] = None):
        self.registry = registry or ModelRegistry()

    def classify_capability(
        self,
        prompt: str,
        active_document_ids: Optional[List[str]] = None,
        has_images: bool = False
    ) -> tuple[ModelCapability, str]:
        prompt_clean = prompt.strip().lower()

        # 1. Vision & Multimodal OCR query
        if has_images or any(kw in prompt_clean for kw in ["image", "photo", "diagram", "schematic", "ocr", "chart", "blueprint"]):
            return ModelCapability.VISION_OCR, "Prompt contains vision/diagram OCR inspection criteria"

        # 2. Document synthesis, formal reporting, Word (.docx) or code specification documentation
        doc_keywords = ["doc", "document", "docx", "memo", "sop", "spec", "specification", "manual", "procedure", "report", "draft", "save as doc", "save the output", "save in doc"]
        if (active_document_ids and len(active_document_ids) > 0) or any(kw in prompt_clean for kw in doc_keywords):
            return ModelCapability.DOCUMENT_CREATION, "Prompt requests formal document creation, technical specification, or SOP synthesis"

        # 3. Code execution & software engineering
        code_keywords = [
            "python", "script", "code", "function", "class", "algorithm",
            "plot", "matplotlib", "numpy", "pandas", "refactor", "debug",
            "execute", "sandbox", "benchmark", "compile", "typescript", "java", "c++"
        ]
        if any(kw in prompt_clean for kw in code_keywords):
            return ModelCapability.CODING, "Prompt requests code generation, mathematical simulation or sandbox execution"

        # 4. Mathematical reasoning & physics formulas
        math_keywords = [
            "calculate", "equation", "formula", "mawp", "derivation", "thermal efficiency",
            "degradation factor", "integral", "derivative", "probability", "matrix", "algebra"
        ]
        if any(kw in prompt_clean for kw in math_keywords):
            return ModelCapability.MATH_REASONING, "Prompt requires rigorous mathematical derivation and formula calculations"

        # 5. General dialogue / greeting fallback
        return ModelCapability.GENERAL_CHAT, "General conversational prompt routed to standard dialogue model"

    async def classify_capability_llm(
        self,
        prompt: str,
        active_document_ids: Optional[List[str]] = None,
        has_images: bool = False
    ) -> tuple[ModelCapability, str]:
        """
        Uses a lightweight local LLM inference call to dynamically classify user intent into specialized capabilities.
        Falls back to rule-based classification if offline or unparseable.
        """
        if has_images:
            return ModelCapability.VISION_OCR, "Vision input detected for multimodal inspection"

        try:
            import json
            import re
            import asyncio
            from backend.app.services.ollama_client import ollama_client

            system_prompt = (
                "You are an AI Intent Router for an Engineering Workbench. "
                "Classify the user prompt into exactly ONE of the following capability categories:\n"
                "- document_creation: The user wants to create, draft, generate, or compile a document, formal report, Word (.docx) file, memo, SOP, or technical code specification (even if code/explanation is included in the document).\n"
                "- coding: The user wants pure executable code, script, bug fix, algorithm implementation, or refactoring in a programming language.\n"
                "- math_reasoning: The user wants mathematical derivations, calculations, physics formulas, or equation solving.\n"
                "- vision_ocr: The user wants image, diagram, blueprint, or OCR analysis.\n"
                "- general_chat: General conversation, greeting, conceptual explanation, or general knowledge inquiry.\n\n"
                "Respond ONLY with a valid JSON object in this exact format: {\"capability\": \"<category>\", \"reason\": \"<brief 1-sentence reason>\"}"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Active Documents: {active_document_ids or 'None'}\nUser Prompt: {prompt}"}
            ]

            # Fast classification with 5s timeout
            llm_text = await asyncio.wait_for(
                ollama_client.generate_chat(messages, temperature=0.0),
                timeout=5.0
            )

            # Parse JSON from response
            json_match = re.search(r"\{[\s\S]*?\}", llm_text)
            if json_match:
                parsed = json.loads(json_match.group(0))
                cap_str = str(parsed.get("capability", "")).lower().strip()
                reason_str = str(parsed.get("reason", "")).strip()

                cap_map = {
                    "document_creation": ModelCapability.DOCUMENT_CREATION,
                    "coding": ModelCapability.CODING,
                    "math_reasoning": ModelCapability.MATH_REASONING,
                    "vision_ocr": ModelCapability.VISION_OCR,
                    "general_chat": ModelCapability.GENERAL_CHAT
                }
                if cap_str in cap_map:
                    return cap_map[cap_str], f"LLM Router: {reason_str or 'Autonomous intent classification'}"

        except Exception as e:
            logger.debug(f"LLM routing classification failed/timed out ({e}), falling back to heuristic classification.")

        return self.classify_capability(prompt, active_document_ids, has_images)

    def route_query(
        self,
        prompt: str,
        active_document_ids: Optional[List[str]] = None,
        has_images: bool = False,
        available_models: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        capability, reason = self.classify_capability(prompt, active_document_ids, has_images)
        return self._build_routing_result(capability, reason, available_models)

    async def route_query_async(
        self,
        prompt: str,
        active_document_ids: Optional[List[str]] = None,
        has_images: bool = False,
        available_models: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        capability, reason = await self.classify_capability_llm(prompt, active_document_ids, has_images)
        return self._build_routing_result(capability, reason, available_models)

    def _build_routing_result(
        self,
        capability: ModelCapability,
        reason: str,
        available_models: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        profile = self.registry.get_profile(capability)
        target_model = profile.name
        fallback_chain = [target_model]

        if available_models and len(available_models) > 0:
            is_available = any(target_model.lower() in m.lower() or m.lower() in target_model.lower() for m in available_models)
            if not is_available:
                fallback_target = profile.fallback_model
                logger.warning(
                    f"Specialized model '{target_model}' for capability '{capability.value}' is not present in local Ollama instance. "
                    f"Cascading to fallback model '{fallback_target}'."
                )
                fallback_chain.append(fallback_target)
                target_model = fallback_target
                reason += f" (Note: Primary model '{profile.name}' offline; gracefully fell back to '{target_model}')"

        return {
            "capability": capability.value,
            "selected_model": target_model,
            "recommended_temp": profile.recommended_temp,
            "fallback_chain": fallback_chain,
            "routing_reason": reason
        }

# Global singleton router instance
dynamic_router = DynamicModelRouter()
