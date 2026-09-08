import unittest
from ai_engine.router import DynamicModelRouter, ModelRegistry, ModelCapability, ModelProfile

class TestDynamicModelRouter(unittest.TestCase):
    def setUp(self):
        self.router = DynamicModelRouter()

    def test_classify_coding_prompt(self):
        prompt = "Write a Python script using matplotlib to plot thermal degradation curve"
        res = self.router.route_query(prompt)
        self.assertEqual(res["capability"], ModelCapability.CODING.value)
        self.assertEqual(res["selected_model"], "qwen2.5-coder:7b")

    def test_classify_math_prompt(self):
        prompt = "Calculate the MAWP equation and derive thermal degradation factor integral"
        res = self.router.route_query(prompt)
        self.assertEqual(res["capability"], ModelCapability.MATH_REASONING.value)
        self.assertEqual(res["selected_model"], "llama3.1:8b")

    def test_classify_doc_prompt(self):
        prompt = "Draft an executive summary memo for boiler maintenance SOP procedure"
        res = self.router.route_query(prompt, active_document_ids=["doc_sop_01.pdf"])
        self.assertEqual(res["capability"], ModelCapability.DOCUMENT_CREATION.value)

    def test_classify_vision_prompt(self):
        prompt = "Inspect this schematic P&ID diagram image and run OCR analysis"
        res = self.router.route_query(prompt, has_images=True)
        self.assertEqual(res["capability"], ModelCapability.VISION_OCR.value)
        self.assertEqual(res["selected_model"], "qwen2-vl:7b-instruct-q4_K_M")

    def test_fallback_when_model_missing(self):
        prompt = "Write a Python script"
        # Simulate local Ollama instance having only llama3.1:8b installed
        available_models = ["llama3.1:8b", "bge-m3"]
        res = self.router.route_query(prompt, available_models=available_models)
        self.assertEqual(res["selected_model"], "llama3.1:8b")
        self.assertIn("qwen2.5-coder:7b", res["fallback_chain"])
        self.assertIn("llama3.1:8b", res["fallback_chain"])

    def test_pluggable_registry(self):
        registry = ModelRegistry()
        custom_profile = ModelProfile(
            name="deepseek-r1:8b",
            capability=ModelCapability.MATH_REASONING,
            description="Custom DeepSeek Reasoning Model",
            recommended_temp=0.0,
            fallback_model="llama3.1:8b"
        )
        registry.register_model(custom_profile)
        router = DynamicModelRouter(registry)
        res = router.route_query("Calculate physics equation")
        self.assertEqual(res["selected_model"], "deepseek-r1:8b")

if __name__ == "__main__":
    unittest.main()
