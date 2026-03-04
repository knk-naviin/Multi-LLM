benchmark_scores = {
    "math": {
        "gpt": 92,
        "claude": 90,
        "gemini": 85,
    },
    "coding": {
        "gpt": 88,
        "claude": 84,
        "gemini": 78,
    },
    "reasoning": {
        "gpt": 90,
        "claude": 91,
        "gemini": 84,
    },
    "creative": {
        "gpt": 80,
        "claude": 82,
        "gemini": 90,
    },
    "chat": {
        "gpt": 86,
        "claude": 88,
        "gemini": 84,
    },
    "general": {
        "gpt": 85,
        "claude": 87,
        "gemini": 83,
    },
}

# Provider-level priors for expected user satisfaction.
model_priors = {
    "gpt": {"reliability": 0.92, "cost_efficiency": 0.70},
    "claude": {"reliability": 0.91, "cost_efficiency": 0.75},
    "gemini": {"reliability": 0.86, "cost_efficiency": 0.95},
}
