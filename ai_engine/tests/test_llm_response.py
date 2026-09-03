import os
import requests
from dotenv import load_dotenv

def test_llm_response():
    # Load environment variables from .env
    load_dotenv()
    
    # Import config variables
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from ai_engine.config import OLLAMA_BASE_URL, MODEL_REASONING
    
    # The Ollama generate endpoint
    endpoint = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
    
    payload = {
        "model": MODEL_REASONING,
        "prompt": "Say 'hello world' in lowercase and nothing else.",
        "stream": False
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=120)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        assert "response" in data, "Response json should contain 'response' field"
        assert len(data["response"]) > 0, "Response field shouldn't be empty"
        print(f"LLM Response: {data['response']}")
        
    except requests.exceptions.RequestException as e:
        assert False, f"Failed to connect or get response from the LLM endpoint: {e}"
