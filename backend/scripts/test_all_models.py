import time
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models.gpt import call_gpt
from models.claude import call_claude
from models.gemini import call_gemini
from models.grok import call_grok


TEST_PROMPT = "Testing. Just say hello and nothing else."


def test_model(name, function):
    print(f"\n🚀 Testing {name}...")

    try:
        start = time.time()
        response = function(TEST_PROMPT)
        end = time.time()

        print("✅ Success")
        print("⏱ Time:", round(end - start, 2), "seconds")
        print("📦 Response:", response[:200])  # preview first 200 chars

    except Exception as e:
        print("❌ Failed")
        print("Error:", str(e))


if __name__ == "__main__":

    print("\n==============================")
    print("   MULTI-LLM MODEL TESTER")
    print("==============================")

    test_model("GPT (OpenAI)", call_gpt)
    test_model("Claude (Anthropic)", call_claude)
    test_model("Gemini (Google)", call_gemini)
    test_model("Grok (xAI)", call_grok)

    print("\n==============================")
    print("   TESTING COMPLETED")
    print("==============================")
