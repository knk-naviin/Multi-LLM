import os
import pickle
import re
from dataclasses import dataclass
from typing import Dict, List

from benchmarks import benchmark_scores

MODEL_PATH = os.getenv("BENCHMARK_MODEL_PATH", "benchmark_model/benchmark_model.pkl")


def _domain_best_model() -> Dict[str, str]:
    output = {}
    for domain, model_scores in benchmark_scores.items():
        output[domain] = max(model_scores, key=model_scores.get)
    return output


DOMAIN_KEYWORDS = {
    "math": [
        "solve",
        "equation",
        "integral",
        "derivative",
        "probability",
        "algebra",
        "geometry",
        "calculus",
        "matrix",
    ],
    "coding": [
        "python",
        "javascript",
        "java",
        "bug",
        "code",
        "function",
        "api",
        "sql",
        "algorithm",
        "debug",
    ],
    "reasoning": [
        "why",
        "logic",
        "reason",
        "analyze",
        "compare",
        "tradeoff",
        "step by step",
        "deduce",
    ],
    "creative": [
        "poem",
        "story",
        "script",
        "creative",
        "lyrics",
        "novel",
        "brainstorm",
        "tagline",
    ],
    "chat": [
        "hello",
        "hi",
        "how are you",
        "chat",
        "talk",
        "joke",
        "casual",
    ],
}


@dataclass
class BenchmarkPrediction:
    selected_model: str
    confidence: float
    ranking: List[dict]
    domain_ranking: List[dict]
    source: str
    domain_hint: str


class BenchmarkModel:
    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.artifact = None
        self.vectorizer = None
        self.classifier = None
        self.domain_to_best_model = _domain_best_model()
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.model_path):
            return
        with open(self.model_path, "rb") as f:
            self.artifact = pickle.load(f)

        self.vectorizer = self.artifact.get("vectorizer")
        self.classifier = self.artifact.get("classifier")
        if self.artifact.get("domain_to_best_model"):
            self.domain_to_best_model = self.artifact["domain_to_best_model"]

    def reload(self) -> dict:
        self.artifact = None
        self.vectorizer = None
        self.classifier = None
        self._load()
        return self.status()

    def is_ready(self) -> bool:
        return self.vectorizer is not None and self.classifier is not None

    def status(self) -> dict:
        if not self.is_ready():
            return {
                "ready": False,
                "model_name": "benchmarkModel",
                "model_path": self.model_path,
                "reason": "artifact_not_found_or_invalid",
            }
        return {
            "ready": True,
            "model_name": self.artifact.get("model_name", "benchmarkModel"),
            "version": self.artifact.get("version"),
            "model_path": self.model_path,
            "created_at_utc": self.artifact.get("created_at_utc"),
            "metrics": self.artifact.get("metrics"),
            "per_domain_count": self.artifact.get("per_domain_count"),
        }

    def _detect_domain_hint(self, prompt: str) -> str:
        text = re.sub(r"\s+", " ", prompt.lower().strip())
        for domain, keywords in DOMAIN_KEYWORDS.items():
            if any(keyword in text for keyword in keywords):
                return domain
        return "general"

    def _fallback_prediction(self, prompt: str) -> BenchmarkPrediction:
        domain_hint = self._detect_domain_hint(prompt)
        best = self.domain_to_best_model.get(domain_hint, self.domain_to_best_model["general"])
        scores = benchmark_scores.get(domain_hint, benchmark_scores["general"])
        ranking = [
            {"model": name, "score": float(score), "probability": round(float(score) / 100.0, 4)}
            for name, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
        ]

        return BenchmarkPrediction(
            selected_model=best,
            confidence=0.55,
            ranking=ranking,
            domain_ranking=[{"domain": domain_hint, "probability": 0.55}],
            source="benchmarkModel-fallback",
            domain_hint=domain_hint,
        )

    def predict(self, prompt: str) -> BenchmarkPrediction:
        if not self.is_ready():
            return self._fallback_prediction(prompt)

        try:
            features = self.vectorizer.transform([prompt])
            domain_probabilities = self.classifier.predict_proba(features)[0]
            domains = list(self.classifier.classes_)
            domain_probs = {
                domain: float(prob) for domain, prob in zip(domains, domain_probabilities.tolist())
            }
            keyword_domain_hint = self._detect_domain_hint(prompt)
            if keyword_domain_hint in domain_probs and keyword_domain_hint != "general":
                # Blend lexical intent signal with ML probabilities for sharper routing.
                domain_probs[keyword_domain_hint] += 0.20
                total = sum(domain_probs.values()) or 1.0
                domain_probs = {domain: prob / total for domain, prob in domain_probs.items()}

            ranked_domains = sorted(domain_probs.items(), key=lambda x: x[1], reverse=True)
            top_domain, top_domain_prob = ranked_domains[0]
            top_domain_scores = benchmark_scores.get(top_domain, benchmark_scores["general"])
            selected_model = self.domain_to_best_model.get(top_domain, "gpt")
            ranking = [
                {
                    "model": model_name,
                    "benchmark_score": float(score),
                    "probability": round(float(score) / 100.0, 6),
                }
                for model_name, score in sorted(
                    top_domain_scores.items(), key=lambda x: x[1], reverse=True
                )
            ]
            domain_ranking = [
                {"domain": domain, "probability": round(float(prob), 6)}
                for domain, prob in ranked_domains
            ]

            return BenchmarkPrediction(
                selected_model=selected_model,
                confidence=round(float(top_domain_prob), 6),
                ranking=ranking,
                domain_ranking=domain_ranking,
                source="benchmarkModel",
                domain_hint=top_domain,
            )
        except Exception:
            return self._fallback_prediction(prompt)


benchmark_model = BenchmarkModel()
