# Swastik Ai Backend (FastAPI)

## Run

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

## Notes

- API-only backend (frontend is in `../frontend`).
- JWT auth + Google sign-in + folder/chats persist in MongoDB.
- `benchmarkModel` routes prompts to GPT, Gemini, or Claude.
- Utility scripts and training/evaluation assets are under:
  - `backend/scripts/`
  - `backend/classifier/`
  - `backend/evaluation/`
  - `backend/artifacts/`

## Important env keys

- `MONGODB_URI`
- `MONGODB_DB`
- `FRONTEND_ORIGINS`
- `JWT_SECRET`
- `JWT_EXPIRE_HOURS`
- `GOOGLE_CLIENT_ID`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `CLAUDE_MODELS`
