# Swastik Ai Frontend (Next.js)

## Run

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

App runs on `http://localhost:3000`.

## Features

- Modern glossy SaaS UI built with Tailwind CSS
- Chat/About/Settings routes
- Private route protection (`/settings`) via middleware + auth cookie
- Guest mode chat (no storage)
- Signed-in mode with folder creation + recent chat history
- JWT auth flows (email/password + Google sign-in)
- Markdown/code-formatted responses with model-used footer
- ChatGPT-style loading text + dot loader
- Typewriter animation for short one-line assistant replies
