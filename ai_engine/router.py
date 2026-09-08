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
    to dynamically route prompts to the optimal specialized local model.
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

        # 2. Code execution & software engineering
        code_keywords = [
            "python", "script", "code", "function", "class", "algorithm",
            "plot", "matplotlib", "numpy", "pandas", "refactor", "debug",
            "execute", "sandbox", "benchmark", "compile", "typescript", "java", "c++"
        ]
        if any(kw in prompt_clean for kw in code_keywords):
            return ModelCapability.CODING, "Prompt requests code generation, mathematical simulation or sandbox execution"

        # 3. Mathematical reasoning & physics formulas
        math_keywords = [
            "calculate", "equation", "formula", "mawp", "derivation", "thermal efficiency",
            "degradation factor", "integral", "derivative", "probability", "matrix", "algebra"
        ]
        if any(kw in prompt_clean for kw in math_keywords):
            return ModelCapability.MATH_REASONING, "Prompt requires rigorous mathematical derivation and formula calculations"

        # 4. Document synthesis & RAG SOP query
        doc_keywords = ["sop", "spec", "boiler", "mawp", "asme", "document", "manual", "procedure", "memo", "report", "draft", "executive summary"]
        if (active_document_ids and len(active_document_ids) > 0) or any(kw in prompt_clean for kw in doc_keywords):
            return ModelCapability.DOCUMENT_CREATION, "Prompt references technical documentation, SOPs, or formal memo creation"

        # 5. General dialogue / greeting fallback
        return ModelCapability.GENERAL_CHAT, "General conversational prompt routed to standard dialogue model"

    def route_query(
        self,
        prompt: str,
        active_document_ids: Optional[List[str]] = None,
        has_images: bool = False,
        available_models: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        capability, reason = self.classify_capability(prompt, active_document_ids, has_images)
        profile = self.registry.get_profile(capability)

        target_model = profile.name
        fallback_chain = [target_model]

        # On-premise air-gap fallback: If available_models list is supplied (from Ollama health check)
        # and the primary specialized model is not downloaded, cascade to default reasoning model.
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
