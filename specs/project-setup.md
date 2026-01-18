# Project Setup Specification

## Structure

```
n8n_chat/
├── specs/           # Documentation
└── app/             # React + Vite + Convex
    ├── src/         # React components
    ├── convex/      # Backend functions
    └── ...
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Convex (functions + database) |
| AI | Claude API (called from Convex) |
| Workflow Engine | n8n API (called from Convex) |

## Convex Functions

All external API calls happen server-side in Convex:

```
convex/
├── chat.ts          # Chat message handling
├── workflows.ts     # n8n API integration
└── ai.ts            # Claude API calls
```

## Environment Variables

```env
# Convex (auto-configured)
CONVEX_DEPLOYMENT=...

# Set in Convex dashboard (not .env)
ANTHROPIC_API_KEY=...
N8N_API_URL=https://<instance>.app.n8n.cloud/api/v1
N8N_API_KEY=...
```

## Initialization

Search web for latest Convex + Vite + React setup instructions. Key steps:

1. `npm create vite@latest app -- --template react-ts`
2. `cd app && npm install convex`
3. `npx convex dev` (creates convex/ folder, sets up project)

## Run

From root directory:
```bash
make dev      # Runs both frontend + backend
make install  # Install dependencies
```

Or manually:
```bash
cd app
npm run dev   # Runs both frontend + backend
```

---

*Status: Draft*
*Last updated: 2026-01-18*
