from benchmark_model import benchmark_model


def rank_models(prompt: str) -> dict:
    prediction = benchmark_model.predict(prompt)

    return {
        "selector": "benchmarkModel",
        "source": prediction.source,
        "domain": prediction.domain_hint,
        "domain_ranking": prediction.domain_ranking,
        "selected_model": prediction.selected_model,
        "confidence": prediction.confidence,
        "ranking": prediction.ranking,
    }


def select_model(prompt: str) -> str:
    return rank_models(prompt)["selected_model"]
