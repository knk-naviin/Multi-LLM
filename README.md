# Swastik Ai Monorepo

## Structure

- `backend/` FastAPI API + benchmarkModel router + MongoDB persistence (JWT + Google auth, folders/chats)
- `frontend/` Next.js SaaS UI (private routes + responsive design, mobile drawer workflow)
- Root-level duplicate backend files were removed; backend source of truth is only `backend/`.

## Start Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Set your provider keys in `backend/.env` and keep `MONGODB_URI` pointed to your Atlas/local DB.

## Start Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend branding/runtime vars are in `frontend/.env.local` (`NEXT_PUBLIC_*`).

Then open `http://localhost:3000/chat`.
