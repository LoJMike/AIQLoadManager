# AI Queue Load Manager

Cross-platform desktop app (Windows 10/11 + macOS) for queuing, routing, and tracking
prompts across 9 AI providers — 7 cloud APIs plus Ollama and LM Studio for fully local, offline AI.

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
| **Prompt type tags** | 9 visual chip tags (Chat, Research, Code, Web Search, Writing, Analysis, Image, Translate, ⚡ Urgent) — drive routing and queue priority |
| **Live cost estimation** | Token count and per-provider cost estimate shown as you type, before queuing |
| **Provider comparison** | Ranked table of all configured providers with estimated cost and availability shown live in the Add Prompt panel |
| **Tag-based priority** | ⚡ Urgent bumps queue position on all plans; paid tier extends priority boosts to all tag types |
| **Projects & chats** | Named projects; continue existing conversation threads |
| **Persistent history** | Conversation history survives app restarts — stored in local SQLite, not memory |
| **Compare mode** | Pro — send the same prompt to multiple providers simultaneously; responses shown side-by-side |
| **Budget alerts** | Monthly USD cap per provider with visual progress |
| **Bulk input** | Paste many prompts (one per line) for batch queuing |

---

## Supported Providers

Providers are grouped into three tiers in the app's Connectors settings panel.

### 🖥️ Local AI — no API key, no internet, $0 per request

| Provider    | How to use                                    | Server URL                  |
|-------------|-----------------------------------------------|-----------------------------|
| Ollama      | `ollama pull llama3.2` then run Ollama        | `http://localhost:11434`    |
| LM Studio   | Load model → Developer tab → Start server     | `http://localhost:1234`     |

### ★ Free Cloud Tier — permanent free access, no credit card required

| Provider      | Free limits                    | Key format       |
|---------------|--------------------------------|------------------|
| Google Gemini | 15 RPM · 1,500 RPD · 1M TPM   | Any long string  |
| Groq          | 30 RPM · 14,400 RPD · 6K TPM  | `gsk_...`        |
| Mistral       | 2 RPM · 1B tokens/month        | Any long string  |

### 💳 Paid & Trial Cloud — pay-as-you-go with signup credits

| Provider   | Trial offer           | Key format    |
|------------|-----------------------|---------------|
| Anthropic  | Trial credits         | `sk-ant-...`  |
| OpenAI     | $5 credit (3 months)  | `sk-...`      |
| DeepSeek   | 5M free tokens        | `sk-...`      |
| xAI Grok   | $25 + $150/mo program | `xai-...`     |

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
# Output: dist-app\AI Queue Load Manager Setup.exe

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
    conversationStore.js     ← SQLite write-through for conversation history
    licenseChecker.js        ← License validation + feature flag helpers
    providers/
      baseProvider.js        ← Abstract base class
      providerRegistry.js    ← Manages all providers
      anthropicProvider.js   ← Claude SDK
      openaiProvider.js      ← GPT SDK
      geminiProvider.js      ← Gemini SDK
      openaiCompatProviders.js ← Groq, DeepSeek, Mistral, xAI Grok
      localProviders.js        ← Ollama, LM Studio (local/offline)
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

## Conversation history persistence

Conversation history is now written through to SQLite on every turn, so threads survive app restarts. Here's how it works:

- Each message (user and assistant) is stored as a row in the `conversations` table in `ai-queue.db` alongside queue and usage data.
- On startup, `ConversationStore.loadAll()` warms each provider's in-memory cache from the database — reads during prompt sending hit memory with no DB round-trip.
- The cap is 20 turns (40 messages) per conversation, matching the previous in-memory limit. Older messages are pruned from SQLite automatically.
- Clearing a conversation removes it from both memory and the database immediately.
- The new `window.aiQueue.getConversationHistory(provider, convId)` IPC call is available for UI components that want to display stored history.

**Roadmap:** the next step is cross-provider conversation context — when the router re-routes a conversation mid-thread (e.g. a provider hits rate limits), the stored history will be adapted to the new provider's message format and forwarded automatically.

---

## Live cost & token estimation

Before a prompt is queued, the Add Prompt panel shows:

- **Token counter** — updates on every keystroke using `⌈chars ÷ 4⌉` (±15% for English). Displayed as `~N tokens in · N max out` next to the textarea label.
- **Provider comparison table** — fires 500 ms after you stop typing. Shows every configured provider ranked by routing score with its estimated cost for this prompt, the best available model, and current availability (Ready / ⏳ waiting). The winning provider is highlighted in green.

Cost formula: `(inputTokens / 1_000_000 × inputRate) + (maxTokens / 1_000_000 × outputRate)` using the cheapest model for each provider. Local providers (Ollama, LM Studio) always show **Free**.

---

## Adding a new AI provider

1. Create `src/main/providers/myProvider.js` extending `BaseProvider`
2. Implement: `validateApiKey`, `_initClient`, `getModels`, `getRateLimits`, `sendMessage`
3. Register in `providers/providerRegistry.js`
4. Add rate limits to `RATE_LIMITS` in `multiUsageTracker.js`
5. Add pricing to `COST_TABLE` in `multiUsageTracker.js`

---

## Prompt tags

Each prompt can carry one or more tags. Tags do two things: they tell the router what *kind* of task the prompt is, and on paid tier they lift the prompt's queue priority.

| Tag | Emoji | Drives routing to… | Free priority boost | Paid priority boost |
|---|---|---|---|---|
| Chat | 💬 | General providers | — | +2 |
| Research | 🔬 | Anthropic, OpenAI, Gemini, Grok | — | +8 |
| Code | 💻 | Anthropic, OpenAI, Mistral, DeepSeek | — | +8 |
| Web Search | 🌐 | Research-strength providers | — | +6 |
| Writing | ✍️ | General providers | — | +4 |
| Analysis | 📊 | Research-strength providers | — | +6 |
| Image | 🖼️ | OpenAI (DALL-E), Gemini | — | +5 |
| Translate | 🌍 | General providers | — | +2 |
| **Urgent** | ⚡ | *(modifier — no routing effect)* | **+10** | **+20** |

Tags are multi-select. The first non-Urgent tag sets the routing `task_type`; Urgent stacks on top as a pure priority modifier. Priority weights are computed server-side — the UI only sends a tag ID array.

---

## Routing modes

| Mode       | Behaviour |
|------------|-----------|
| `auto`     | Scores all providers on capacity, cost, and task type — local AI gets +50 bonus. Task type is now derived from prompt tags. |
| `balance`  | Round-robins across configured providers |
| `cheapest` | Always picks lowest input-token cost (local = $0, always wins) |
| `fastest`  | Groq → DeepSeek → Mistral → Gemini → OpenAI → Anthropic → local |
| `freeTier` | Ollama / LM Studio first, then Gemini, Groq, Mistral |
| `manual`   | You explicitly pick provider + model per prompt |

---

## Version

Current version: **0.3.2**

| What changed | Version |
|---|---|
| Compare mode (Pro) — multi-provider fan-out, side-by-side results | 0.3.2 |
| Persistent conversation history (SQLite write-through) | 0.3.1 |
| Prompt type tags + tag-driven queue priority | 0.3.0 |
| Live token estimation + provider cost comparison | 0.3.0 |
| Licensing skeleton (free/pro feature flags, LicensePanel UI) | 0.2.0 → 0.1.43 |
| Neon glassmorphic UI redesign + custom title bar | 0.1.41 |

---

## Compare mode (Pro)

Send the same prompt to multiple providers simultaneously and compare responses side by side. Useful for:
- Benchmarking output quality across models before committing to one
- Spotting when providers disagree (great signal for ambiguous or subjective prompts)
- Finding the best provider for a specific task type

**How it works:** Select "⚖ Compare" in the Add tab, tick 2 or more configured providers, and queue. The queue fans out in parallel via `Promise.allSettled` — a single provider failure doesn't abort the rest. Results appear in the Queue tab as a side-by-side column view when all providers have replied. Each column shows the provider name, model used, response text, copy button, and token counts.

Compare mode requires a Pro license. No conversation history is injected — each provider gets a fresh context, keeping the comparison fair.

---

## Roadmap

| Feature | Tier | Notes |
|---|---|---|
| **Pro+ tier** | Pro+ | A higher tier above Pro for power users: Consensus mode, advanced chaining, priority support. Details TBD. |
| **Consensus mode** | Pro+ | After Compare mode collects responses from all providers, a meta-model synthesises the best answer, flags disagreements, or votes across outputs. Extends Compare mode's data model — no separate queue needed. |
| **Cross-provider conversation context** | Starter | When the router re-routes a conversation to a different provider (e.g. due to rate limits), the relevant history is adapted and forwarded automatically. No other tool does this — it's only possible because AIQ already sees all provider traffic. |
| Image generation | Starter | DALL-E 3, Flux, Ideogram, Stable Diffusion (local via ComfyUI) |
| Video generation | Pro | Runway, Pika, Kling — async job polling fits the queue model perfectly |
| Prompt template library | Starter | Named variables, fill-and-queue |
| Prompt chaining | Pro | Output of one item becomes input of the next |
| Batch CSV import | Starter | Upload CSV of prompts, queue all at once |
| Webhook output delivery | Pro | POST results to any URL on completion |
| Cost forecasting | Pro | Predict monthly spend from usage trends |
| iOS & Android companion | Starter+ | Monitor queue, add prompts, push notifications |

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
