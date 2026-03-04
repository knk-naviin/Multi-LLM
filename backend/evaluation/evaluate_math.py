import json
import os
import time
from datasets import load_dataset
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models.gpt import call_gpt
from models.gemini import call_gemini

dataset = load_dataset("gsm8k", "main")

def extract_number(text):
    import re
    numbers = re.findall(r"\d+", text)
    return numbers[-1] if numbers else None


def evaluate_model(model_call, limit=5):
    correct = 0

    for i in range(limit):
        sample = dataset["test"][i]
        question = sample["question"]
        answer = sample["answer"]

        try:
            output = model_call(question)
            predicted = extract_number(output)

            if predicted and predicted in answer:
                correct += 1

        except Exception as e:
            print("Error during model call:", e)

        time.sleep(12)  # Respect Gemini free tier

    return round((correct / limit) * 100, 2)


print("Evaluating GPT...")
gpt_score = evaluate_model(call_gpt)

print("Evaluating Gemini...")
gemini_score = evaluate_model(call_gemini)

benchmark_scores = {
    "math": {
        "gpt": gpt_score,
        "gemini": gemini_score
    }
}

output_dir = BACKEND_ROOT / "artifacts" / "benchmarks"
output_dir.mkdir(parents=True, exist_ok=True)
with (output_dir / "generated_scores.json").open("w") as f:
    json.dump(benchmark_scores, f, indent=4)

print("✅ Benchmark scores saved!")
print("GPT Score:", gpt_score)
print("Gemini Score:", gemini_score)
