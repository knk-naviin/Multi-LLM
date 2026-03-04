import json
import os
import pickle
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from datasets import load_dataset
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from benchmarks import benchmark_scores

OUTPUT_PATH = os.getenv("BENCHMARK_MODEL_PATH", "benchmark_model/benchmark_model.pkl")
KAGGLE_DATA_PATH = os.getenv("KAGGLE_DATA_PATH", "dataset.json")
SAMPLES_PER_DOMAIN = int(os.getenv("BENCHMARK_SAMPLES_PER_DOMAIN", "300"))

# Benchmark-oriented sources (HF + optional Kaggle JSON)
DATASET_SPECS = [
    {
        "domain": "math",
        "path": "gsm8k",
        "name": "main",
        "split": "train",
        "fields": ["question"],
    },
    {
        "domain": "coding",
        "path": "mbpp",
        "name": "sanitized",
        "split": "train",
        "fields": ["prompt", "text"],
    },
    {
        "domain": "reasoning",
        "path": "boolq",
        "name": None,
        "split": "train",
        "fields": ["question"],
    },
    {
        "domain": "creative",
        "path": "roneneldan/TinyStories",
        "name": None,
        "split": "train",
        "fields": ["text", "story"],
    },
    {
        "domain": "chat",
        "path": "Anthropic/hh-rlhf",
        "name": None,
        "split": "train",
        "fields": ["chosen"],
    },
    {
        "domain": "general",
        "path": "ag_news",
        "name": None,
        "split": "train",
        "fields": ["text"],
    },
]


def _domain_to_best_model() -> Dict[str, str]:
    return {domain: max(scores, key=scores.get) for domain, scores in benchmark_scores.items()}


def _stringify_value(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else None
    if isinstance(value, list):
        if not value:
            return None
        if all(isinstance(x, str) for x in value):
            cleaned = " ".join(value).strip()
            return cleaned if cleaned else None
        return str(value)
    return str(value)


def _extract_prompt(row: dict, preferred_fields: List[str]) -> Optional[str]:
    for field in preferred_fields:
        if field in row:
            as_text = _stringify_value(row[field])
            if as_text:
                return as_text

    for fallback_field in ["prompt", "question", "text", "instruction", "query"]:
        if fallback_field in row:
            as_text = _stringify_value(row[fallback_field])
            if as_text:
                return as_text

    return None


def _iter_hf_prompts(spec: dict, max_rows: int) -> Iterable[str]:
    kwargs = {"split": spec["split"], "streaming": True}
    if spec.get("name"):
        kwargs["name"] = spec["name"]
    dataset = load_dataset(spec["path"], **kwargs)

    count = 0
    for row in dataset:
        prompt = _extract_prompt(row, spec["fields"])
        if not prompt:
            continue
        yield prompt
        count += 1
        if count >= max_rows:
            break


def _load_hf_samples(max_rows_per_domain: int) -> Dict[str, List[str]]:
    samples = defaultdict(list)

    for spec in DATASET_SPECS:
        domain = spec["domain"]
        try:
            for prompt in _iter_hf_prompts(spec, max_rows=max_rows_per_domain):
                samples[domain].append(prompt)
            print(f"[HF] {domain}: loaded {len(samples[domain])} samples from {spec['path']}")
        except Exception as exc:
            print(f"[HF] {domain}: failed to load {spec['path']} ({exc})")

    return samples


def _load_kaggle_samples(path: str) -> Dict[str, List[str]]:
    output = defaultdict(list)
    if not os.path.exists(path):
        return output
    if os.path.getsize(path) == 0:
        return output

    try:
        with open(path, "r") as f:
            data = json.load(f)
    except Exception as exc:
        print(f"[Kaggle] Failed to parse {path}: {exc}")
        return output

    if not isinstance(data, list):
        print(f"[Kaggle] Expected list in {path}, got {type(data).__name__}")
        return output

    for row in data:
        if not isinstance(row, dict):
            continue
        domain = (row.get("domain") or row.get("category") or "").strip().lower()
        if domain not in benchmark_scores:
            continue
        prompt = (
            _stringify_value(row.get("prompt"))
            or _stringify_value(row.get("text"))
            or _stringify_value(row.get("query"))
        )
        if not prompt:
            continue
        output[domain].append(prompt)

    for domain, rows in output.items():
        print(f"[Kaggle] {domain}: loaded {len(rows)} samples from {path}")
    return output


def _merge_samples(*datasets: Dict[str, List[str]]) -> Dict[str, List[str]]:
    merged = defaultdict(list)
    for data in datasets:
        for domain, prompts in data.items():
            merged[domain].extend(prompts)
    return merged


def _seed_fallback_samples() -> Dict[str, List[str]]:
    return {
        "math": [
            "Solve 35 * 27",
            "Find the derivative of x^3 + 2x",
            "Compute the integral of 2x",
        ],
        "coding": [
            "Write a Python function to reverse a list",
            "Fix this JavaScript bug in async code",
            "Implement binary search in Java",
        ],
        "reasoning": [
            "Compare two solutions and explain tradeoffs",
            "Why does this argument fail logically?",
            "Analyze the claim and provide reasoning steps",
        ],
        "creative": [
            "Write a short sci-fi story opening",
            "Create a poem about rain",
            "Generate 10 marketing taglines for coffee",
        ],
        "chat": [
            "Hi, how are you?",
            "Tell me a clean joke",
            "Let's talk about weekend plans",
        ],
        "general": [
            "Explain blockchain in simple words",
            "What is photosynthesis?",
            "Summarize benefits of exercise",
        ],
    }


def train_benchmark_model() -> None:
    domain_to_best_model = _domain_to_best_model()

    hf_samples = _load_hf_samples(SAMPLES_PER_DOMAIN)
    kaggle_samples = _load_kaggle_samples(KAGGLE_DATA_PATH)
    seed_samples = _seed_fallback_samples()

    all_samples = _merge_samples(seed_samples, hf_samples, kaggle_samples)

    texts: List[str] = []
    labels: List[str] = []
    per_domain_count = {}

    for domain, prompts in all_samples.items():
        if domain not in domain_to_best_model:
            continue
        # Keep cap per domain for balanced training
        capped_prompts = prompts[: max(SAMPLES_PER_DOMAIN, 50)]
        per_domain_count[domain] = len(capped_prompts)
        for prompt in capped_prompts:
            texts.append(prompt)
            labels.append(domain)

    unique_labels = sorted(set(labels))
    if len(texts) < 30 or len(unique_labels) < 2:
        raise RuntimeError(
            "Not enough data/classes to train benchmarkModel. "
            f"rows={len(texts)} classes={unique_labels}"
        )

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=60000, min_df=1)
    X = vectorizer.fit_transform(texts)

    X_train, X_valid, y_train, y_valid = train_test_split(
        X, labels, test_size=0.2, random_state=42, stratify=labels
    )

    clf = LogisticRegression(max_iter=1200, solver="lbfgs")
    clf.fit(X_train, y_train)

    train_acc = accuracy_score(y_train, clf.predict(X_train))
    valid_acc = accuracy_score(y_valid, clf.predict(X_valid))

    artifact = {
        "model_name": "benchmarkModel",
        "version": "1.0",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "vectorizer": vectorizer,
        "classifier": clf,
        "domain_to_best_model": domain_to_best_model,
        "per_domain_count": per_domain_count,
        "metrics": {
            "train_accuracy": round(float(train_acc), 4),
            "validation_accuracy": round(float(valid_acc), 4),
            "total_rows": len(texts),
            "labels": unique_labels,
        },
        "data_sources": {
            "huggingface_specs": DATASET_SPECS,
            "kaggle_data_path": KAGGLE_DATA_PATH,
        },
    }

    output_path = Path(OUTPUT_PATH)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        pickle.dump(artifact, f)

    print(f"Saved benchmarkModel to: {output_path}")
    print(f"Rows: {len(texts)} | Labels: {unique_labels}")
    print(
        "Metrics:",
        json.dumps(
            artifact["metrics"],
            indent=2,
        ),
    )


if __name__ == "__main__":
    train_benchmark_model()
