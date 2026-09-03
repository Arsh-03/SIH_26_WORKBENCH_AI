import os
import requests
from dotenv import load_dotenv

def test_ngrok_tunnel_is_working():
    # Load environment variables from .env
    load_dotenv()
    
    # Get the URL from the environment, defaulting to the one in .env if not set
    # Alternatively we can just import OLLAMA_BASE_URL from ai_engine.config,
    # but the environment should already have it due to load_dotenv.
    # Let's import from config to be consistent with the app.
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from ai_engine.config import OLLAMA_BASE_URL
    
    # Ensure the URL is valid
    assert OLLAMA_BASE_URL.startswith("http"), "OLLAMA_BASE_URL must start with http or https"
    assert "ngrok" in OLLAMA_BASE_URL, "OLLAMA_BASE_URL should contain 'ngrok'"
    
    # Make a simple GET request to the root or a known endpoint to see if it's reachable
    # Ollama root usually returns a 200 OK with "Ollama is running"
    try:
        response = requests.get(OLLAMA_BASE_URL, timeout=10)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    except requests.exceptions.RequestException as e:
        assert False, f"Failed to connect to the ngrok tunnel: {e}"
