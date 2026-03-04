from pathlib import Path
import sys

from google import genai

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

for model in client.models.list():
    print(model.name)
