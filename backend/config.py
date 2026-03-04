import os
from pathlib import Path
from dotenv import load_dotenv

# Always load backend/.env regardless of current working directory.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Silence HuggingFace tokenizer fork warning in multi-worker/multiprocess runs.
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")

# MongoDB / app persistence
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "swastik_ai")
SESSION_EXPIRE_DAYS = int(os.getenv("SESSION_EXPIRE_DAYS", "7"))
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-jwt-secret-in-production")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
CORS_ALLOW_ORIGIN_REGEX = os.getenv(
    "CORS_ALLOW_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
)

# Routing controls
ROUTING_BENCHMARK_WEIGHT = float(os.getenv("ROUTING_BENCHMARK_WEIGHT", "0.70"))
ROUTING_RELIABILITY_WEIGHT = float(os.getenv("ROUTING_RELIABILITY_WEIGHT", "0.20"))
ROUTING_COST_WEIGHT = float(os.getenv("ROUTING_COST_WEIGHT", "0.10"))
BENCHMARK_MODEL_PATH = os.getenv("BENCHMARK_MODEL_PATH", "benchmark_model/benchmark_model.pkl")

# Gemini rate limits (requests per minute)
GEMINI_REQUESTS_PER_MINUTE = int(os.getenv("GEMINI_REQUESTS_PER_MINUTE", "10"))

# Claude model candidates (tried in order until one succeeds)
CLAUDE_MODELS = [
    model.strip()
    for model in os.getenv(
        "CLAUDE_MODELS",
        "claude-3-5-sonnet-latest,claude-3-5-haiku-latest,claude-3-opus-latest",
    ).split(",")
    if model.strip()
]

if not JWT_SECRET or JWT_SECRET == "change-this-jwt-secret-in-production":
    raise RuntimeError("JWT_SECRET is required and must be changed from the default value.")

if JWT_EXPIRE_HOURS <= 0:
    raise RuntimeError("JWT_EXPIRE_HOURS must be a positive integer.")

if not GOOGLE_CLIENT_ID.strip():
    raise RuntimeError("GOOGLE_CLIENT_ID is required for Google sign-in.")
