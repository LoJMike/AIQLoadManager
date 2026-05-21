# AIQLoadManager

Cross-platform desktop app (Windows 10/11 + macOS) for queuing, routing, and tracking
prompts across 7 AI providers — Claude, OpenAI, Gemini, Groq, DeepSeek, Mistral, and xAI Grok.

**GitHub:** https://github.com/LoJMike/AIQLoadManager  
**Local path:** `C:\Users\mikel\Desktop\AIQLoadManager Project`

---

## Features

| Feature | Detail |
|---|---|
| **Multi-provider GUI** | Dark industrial dashboard with per-provider usage cards |
| **Usage tracking** | Token in/out, requests/min, requests/day, cost estimate per provider |
| **Rate limit awareness** | Knows each provider's RPM/RPD/TPM limits; waits automatically |
| **Prompt queue** | Priority ordering, scheduling, retry on error |
| **Smart routing** | 6 modes: auto, balance, cheapest, fastest, freeTier, manual |
| **Projects & chats** | Named projects; continue existing conversation threads |
| **Budget alerts** | Monthly USD cap per provider with visual progress |
| **Bulk input** | Paste many prompts (one per line) for batch queuing |

---

## Supported Providers

| Provider     | Free tier          | Key format       |
|--------------|--------------------|------------------|
| Anthropic    | Trial credits      | `sk-ant-...`     |
| OpenAI       | $5 trial credit    | `sk-...`         |
| Google Gemini| **Permanent free** | Any long string  |
| xAI Grok     | $25 + $150/mo      | `xai-...`        |
| DeepSeek     | 5M free tokens     | `sk-...`         |
| Groq         | **Permanent free** | `gsk_...`        |
| Mistral      | **1B tokens/mo**   | Any long string  |

---

## Setup

### Prerequisites
- Node.js 22+ (https://nodejs.org) — Node 24 recommended
- Git (https://git-scm.com)
- PowerShell 5+ (built into Windows 10/11)

### Clone & install

```powershell
cd "C:\Users\mikel\Desktop"
git clone https://github.com/LoJMike/AIQLoadManager.git "AIQLoadManager Project"
cd "AIQLoadManager Project"
npm install
```

### Run in development

```powershell
# Terminal 1 — React renderer (hot reload on :3000)
npm run dev:renderer

# Terminal 2 — Electron main process (open a new PowerShell window)
npm run start:win
```

### Build installers

```powershell
# Windows installer (.exe)
npm run build:win
# Output: dist-app\AI Queue Manager Setup.exe

# macOS disk image (.dmg) — run on macOS only
npm run build:mac
```

---

## Project structure

```
src/
  main/
    index-v2.js              ← Electron main process + IPC
    preload-v2.js            ← Secure IPC bridge (window.aiQueue.*)
    db.js                    ← node:sqlite wrapper (zero npm deps)
    store.js                 ← electron-store v8 wrapper
    uuid.js                  ← crypto.randomUUID() wrapper
    multiUsageTracker.js     ← Per-provider token/rate tracking
    multiQueueManager.js     ← Queue CRUD + processing loop
    queueRouter.js           ← Routing decision engine
    providers/
      baseProvider.js        ← Abstract base class
      providerRegistry.js    ← Manages all providers
      anthropicProvider.js   ← Claude SDK
      openaiProvider.js      ← GPT SDK
      geminiProvider.js      ← Gemini SDK
      openaiCompatProviders.js ← Groq, DeepSeek, Mistral, xAI Grok
  renderer/
    App.jsx                  ← Shell with sidebar nav
    App.css                  ← Dark monospace theme
    components/
      UsageDashboard.jsx     ← Per-provider usage cards
      AddPromptPanel.jsx     ← Single + bulk prompt form
      QueueSettingsProjects.jsx ← Queue, Settings, Projects panels
stubs/
  boolean/                   ← Local replacement for deprecated boolean@3.2.0
```

---

## Adding a new AI provider

1. Create `src/main/providers/myProvider.js` extending `BaseProvider`
2. Implement: `validateApiKey`, `_initClient`, `getModels`, `getRateLimits`, `sendMessage`
3. Register in `providers/providerRegistry.js`
4. Add rate limits to `RATE_LIMITS` in `multiUsageTracker.js`
5. Add pricing to `COST_TABLE` in `multiUsageTracker.js`

---

## Routing modes

| Mode       | Behaviour |
|------------|-----------|
| `auto`     | Scores all providers on capacity, cost, and task type |
| `balance`  | Round-robins across configured providers |
| `cheapest` | Always picks lowest input-token cost |
| `fastest`  | Groq → DeepSeek → Mistral → Gemini → OpenAI → Anthropic |
| `freeTier` | Prefers Gemini, Groq, Mistral (permanent free tiers) |
| `manual`   | You explicitly pick provider + model per prompt |

---

## Data storage

All data is local — no cloud sync.

| Platform | Location |
|---|---|
| Windows | `%APPDATA%\ai-queue-manager\ai-queue.db` |
| macOS | `~/Library/Application Support/ai-queue-manager/ai-queue.db` |

API keys are stored in the OS user data directory via `electron-store`.

---

## Troubleshooting

### `rmdir /s /q` not recognised
You're in PowerShell. Use:
```powershell
Remove-Item -Recurse -Force node_modules
```

### `better-sqlite3` build failure
This project does NOT use `better-sqlite3`. It uses Node's built-in `node:sqlite` (Node 22+).
If you see this error, you have an old version of the project. Re-clone from GitHub.

### `vite` not recognised
Scripts use `node_modules/.bin/vite` explicitly. If you see this error, run:
```powershell
npm install
```

### Blank/white window on launch
Open Electron DevTools (F12) and check the Console tab for the specific error.
