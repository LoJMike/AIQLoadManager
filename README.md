# AI Queue Load Manager

**The AI routing layer for your entire desktop stack** — whether you're sending prompts yourself or running agents through Hermes, n8n, OpenClaw, LangGraph, or CrewAI.

Use AIQ as a **prompt queue app**: fire off prompts across 17 AI providers, track costs, and never hit a rate limit wall again.
Use AIQ as an **Agent Gateway**: point any OpenAI-compatible agent framework at `http://localhost:8787/v1` and AIQ handles routing, rate-limit queuing, cost tracking, and provider fallback transparently — no code changes in your agents.

**2 more providers coming** — Perplexity AI (v0.7.0) and OpenAI Codex (v0.8.0) are in active development. See the [Provider Roadmap](PROVIDER_ROADMAP.md) for details.

**GitHub:** https://github.com/LoJMike/AIQLoadManager  
**Current version:** v0.6.0  
**Version history:** [CHANGELOG.md](CHANGELOG.md)

---

## What's New in v0.6.0

| # | Change | Category |
|---|--------|----------|
| 1 | **5 new cloud providers** — Fireworks AI, Together AI, MiniMax, Cerebras, Cohere | Providers |
| 2 | **Agent Gateway** — OpenAI-compatible HTTP proxy at `localhost:8787/v1` for agent frameworks | Feature |
| 3 | **Results panel** — dedicated tab showing completed responses as full-text cards with search, filter, copy | Feature |
| 4 | **Results badge** — green unread count on the nav icon; clears when you open the tab; persists across restarts | Feature |
| 5 | **Live feature flag enforcement** — Free tier limits now active (5 providers, 10 queue items, Manual+FreeTier routing only) | Licensing |
| 6 | **Lemon Squeezy checkout live** — Get Starter and Get Pro buttons open real checkout pages | Licensing |
| 7 | **Pre-flight model validation** — selecting a local provider in Manual mode pings the server live, shows ✅/🔴/⚠️ banner, populates the model dropdown with actually-installed models | Local AI |
| 8 | **Local provider reachability cache** — background ping every 20 s; auto-routing skips offline local providers; provider dots turn amber when server is down | Local AI |
| 9 | **Windows localhost fix** — model discovery now uses the OpenAI SDK client (not native `fetch`) to avoid IPv6 resolution issues with `localhost` on Windows | Bug fix |
| 10 | **Queue stuck at "processing" fixed** — completed items now immediately flip status in the UI (missing `queue-update` event on completion) | Bug fix |
| 11 | **Retry delay** — auto-retries now wait 5–10 s (jittered) instead of retrying immediately | Improvement |
| 12 | **404 / model not found no longer retried** — model-not-installed errors fail fast instead of burning all 3 retry slots | Improvement |
| 13 | **Routing mode gate** — Free tier users who request Auto/Balance/etc. routing get a clear upgrade prompt instead of a silent fail | Improvement |

---

## Pricing Tiers

All plans are **monthly subscriptions** — cancel any time. No lifetime deals, no usage surcharges on top of your API costs. The monthly cloud prompt and token limits below are AIQ-side caps to keep the service sustainable; you still pay your AI providers directly at their published rates.

|                                                     | Free              | Starter                | Pro                    | Pro+ _(Coming soon)_   | Team _(Coming soon)_   |
| --------------------------------------------------- | ----------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| **Price**                                           | $0 forever        | $9/mo                  | $19/mo                 | $34/mo                 | $49/user/mo            |
| **AI providers**                                    | 5 (local only)    | 8 (local + free cloud) | All 12                 | All 12                 | All 12                 |
| **Monthly cloud prompt runs**                       | —                 | 500                    | 2,500                  | 10,000                 | 25,000 (pooled)        |
| **Monthly cloud tokens**                            | —                 | 1M                     | 5M                     | 20M                    | 60M (pooled)           |
| **Max queue depth**                                 | 10 items          | 100 items              | 500 (soft cap)         | Unlimited              | Unlimited              |
| **Projects**                                        | 1                 | 5                      | Unlimited              | Unlimited              | Unlimited              |
| **Routing modes**                                   | Manual, Free Tier | + Auto, Balance        | + Cheapest, Fastest    | All modes              | All modes              |
| **Budget spend visibility**                         | View-only         | View-only              | ✓                      | ✓                      | ✓                      |
| **Budget caps & alerts**                            | —                 | —                      | ✓                      | ✓                      | ✓                      |
| **Cost tracking per provider**                      | —                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **⚡ Urgent priority boost**                        | ✓                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **Tag-based smart priority (all tags)**             | —                 | —                      | ✓                      | ✓                      | ✓                      |
| **Batch CSV import**                                | —                 | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Usage export**                                    | —                 | CSV _(Roadmap)_        | CSV + JSON _(Roadmap)_ | CSV + JSON _(Roadmap)_ | CSV + JSON _(Roadmap)_ |
| **Response style presets**                          | ✓                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **Results panel**                                   | ✓                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **Per-project response history**                    | ✓                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **Session digest export (HTML)**                    | —                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **Per-provider default model**                      | —                 | —                      | —                      | ✓                      | ✓                      |
| **Prompt template library**                         | —                 | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Document context injection**                      | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Email digest**                                    | —                 | —                      | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Compare mode (A/B providers)**                    | —                 | —                      | ✓                      | ✓                      | ✓                      |
| **Consensus mode**                                  | —                 | —                      | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Prompt chaining**                                 | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Scheduled-items calendar view**                   | —                 | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Usage Insights panel**                            | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Usage heatmap calendar**                          | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Prompt habit analysis**                           | —                 | —                      | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **AI-powered prompt optimization**                  | —                 | —                      | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Image generation**                                | —                 | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Video generation**                                | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Webhook output delivery**                         | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Cost forecasting**                                | —                 | —                      | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Priority email support**                          | —                 | —                      | —                      | ✓                      | ✓                      |
| **Linux native app**                                | ✓ _(Roadmap)_     | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **iOS & Android companion**                         | —                 | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          | ✓ _(Roadmap)_          |
| **Shared settings & admin controls**                | —                 | —                      | —                      | —                      | ✓ _(Coming soon)_      |
| **100% local — no cloud sync**                      | ✓                 | ✓                      | ✓                      | ✓                      | ✓                      |
| **Anonymous usage analytics — opt out in Settings** | ✓                 | ✓                      | ✓                      | ✓                      | ✓                      |

**Provider breakdown:** Free = 5 local AI providers (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp) — no API key needed, $0 per request. Starter adds 3 permanent free cloud tiers (Gemini, Groq, Mistral) + free-trial tiers (Cerebras, Cohere). Pro unlocks all paid cloud providers (Claude, OpenAI, DeepSeek, xAI Grok, Fireworks AI, Together AI, MiniMax) plus everything below. **Pro+** is for solo power users who need 4× the throughput, unlimited queue depth, Consensus mode, and priority support. **Team** adds shared settings and admin controls for multi-user organisations.

---

## Features

| Feature                          | Tier                 | Detail                                                                                                                                                                                                     |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-provider GUI**           | All                  | Dark industrial dashboard with per-provider usage cards                                                                                                                                                    |
| **Usage tracking**               | All                  | Token in/out, requests/min, requests/day, cost estimate per provider                                                                                                                                       |
| **Rate limit awareness**         | All                  | Knows each provider's RPM/RPD/TPM limits; waits automatically                                                                                                                                              |
| **Prompt queue**                 | All                  | Priority ordering, scheduling, auto-retry on transient errors (up to 3 attempts)                                                                                                                           |
| **Standing instructions**        | All                  | Global system prompt prepended to every queued prompt — set once in Settings, applies across all providers                                                                                                 |
| **Prompt type tags**             | All                  | 9 visual chip tags (Chat, Research, Code, Web Search, Writing, Analysis, Image, Translate, ⚡ Urgent) — drive routing and queue priority                                                                   |
| **Live cost estimation**         | All                  | Token count and per-provider cost estimate shown as you type, before queuing                                                                                                                               |
| **Provider comparison table**    | All                  | Ranked table of all configured providers with estimated cost and availability shown live in the Add Prompt panel                                                                                           |
| **⚡ Urgent priority boost**     | All                  | Jumps the queue on any plan                                                                                                                                                                                |
| **Projects & chats**             | All                  | Named projects; continue existing conversation threads                                                                                                                                                     |
| **Persistent history**           | All                  | Conversation history survives app restarts — stored in local SQLite                                                                                                                                        |
| **Smart routing**                | Starter+             | 4 modes on Starter (Manual, Free Tier, Auto, Balance); all 6 on Pro (+ Cheapest, Fastest)                                                                                                                  |
| **Cost tracking**                | Starter+             | Detailed cost per provider & model                                                                                                                                                                         |
| **Tag-based smart priority**     | Pro                  | All 9 tag types boost queue position                                                                                                                                                                       |
| **🌐 Web search**                | All                  | Tag a prompt Web Search — live results from Tavily or SearXNG are injected into the system prompt before the AI call. Works with every model including local ones.                                         |
| **Compare mode**                 | Pro                  | Send the same prompt to multiple providers simultaneously; responses shown side-by-side                                                                                                                    |
| **Budget caps & alerts**         | Pro                  | Monthly USD cap per provider with visual progress                                                                                                                                                          |
| **Batch CSV import**             | Starter+ _(Roadmap)_ | Upload a CSV of prompts and queue them all at once                                                                                                                                                         |
| **Response style presets**       | All                  | Per-provider tone/format presets — Normal, Concise, Caveman, Bullet-only, ELI5, or Custom. Set in Settings → provider card. Appended to every prompt sent to that provider.                                |
| **Per-provider default model**   | Pro+                 | Override the default model used for any provider when no model is specified in the queue item. Set in Settings → provider card.                                                                            |
| **Results panel**                | All                  | Dedicated tab showing every completed response as a full-text card — search, filter by project or provider, copy with one click. Compare-mode responses shown side-by-side. Green badge on the nav icon counts unread results. |
| **Per-project response history** | All                  | View all completed prompts and responses for any project — click "View history" on any project card in the Projects tab.                                                                                   |
| **Session digest export**        | Starter+             | Export all completed queue items as a self-contained HTML file with summary stats, per-item prompt/response, and token costs. Opens natively after saving.                                                 |
| **Anonymous usage analytics**    | All                  | PostHog — routing mode usage, provider config, prompt counts. No prompt content, no keys, no personal data. Opt-out toggle in Settings → Analytics.                                                        |
| **Support tab**                  | All                  | In-app support page with product homepage link, how-it-works guide, bug report shortcut (version and OS pre-filled), feature request link, and GitHub Discussions. Replaces the old nav-bar Report button. |

---

## Use AIQ as an Agent Gateway

Any tool that speaks the OpenAI Chat Completions API can route through AIQ. Change one line of config — no code changes to your agents required.

| Your tool             | What to change                                          | What you get                                                       |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Hermes Agent**      | `base_url: http://localhost:8787/v1` in provider config | AIQ replaces Hermes's native routing with rate-limit-aware queuing |
| **n8n**               | OpenAI credential → `Base URL` field                    | Every AI Agent node LLM call queues through AIQ automatically      |
| **OpenClaw**          | Provider config → base URL                              | AIQ's cost tracking and fallback underneath OpenClaw's agent logic |
| **LangGraph**         | `ChatOpenAI(base_url="http://localhost:8787/v1", ...)`  | Full routing and retry for every LangGraph LLM call                |
| **CrewAI**            | `OPENAI_API_BASE=http://localhost:8787/v1` in `.env`    | Works with CrewAI v1.12+ native OpenAI-compatible providers        |
| **AutoGen / AG2**     | `base_url` in `OAI_CONFIG_LIST`                         | Queue-backed routing for all AutoGen agent conversations           |
| **OpenAI Agents SDK** | `AsyncOpenAI(base_url=..., api_key=...)`                | Any agentic workflow routes through AIQ                            |

**Model name routing** — pass these as the `model` field to invoke AIQ's routing modes without changing anything else in your agent:

| Model value         | AIQ behaviour                                              |
| ------------------- | ---------------------------------------------------------- |
| `aiq/auto`          | Score all providers on capacity, cost, and task type       |
| `aiq/cheapest`      | Always pick lowest input-token cost                        |
| `aiq/fastest`       | Cerebras → Groq → Fireworks → others                       |
| `aiq/free`          | Free-tier providers only (Gemini, Groq, Mistral, Cerebras) |
| `claude-3-5-sonnet` | Force Anthropic, specific model                            |
| `gpt-4o`            | Force OpenAI, specific model                               |

Streaming (`stream: true`) is fully supported. The Gateway runs locally — no agent traffic passes through our servers. Available on Starter and above. **Shipped in v0.6.0.**

---

## Supported Providers

Providers are grouped into three tiers in the app's Connectors settings panel.

### 🖥️ Local AI — no API key, no internet, $0 per request

All ports are configurable in Settings → Connectors. Each local provider card shows a **Setup guide ↗** link that opens the official getting-started documentation in your browser.

| Provider  | How to use                                               | Default port |
| --------- | -------------------------------------------------------- | ------------ |
| Ollama    | `ollama pull llama3.2` then run Ollama                   | `11434`      |
| LM Studio | Load model → Developer tab → Start server                | `1234`       |
| Jan.ai    | Download model → Settings → Start Local API              | `1337`       |
| LocalAI   | `docker run -p 8080:8080 localai/localai:latest`         | `8080`       |
| llama.cpp | `llama-server -m model.gguf --port 8181 --ctx-size 4096` | `8181`       |

> **Note:** LocalAI and llama.cpp both default near port 8080 — llama.cpp ships with default 8181 here to avoid conflict.
> Change either port in Settings → Connectors if you need them to coexist.

### ★ Free Cloud Tier — permanent free access, no credit card required

| Provider      | Free limits                  | Key format      |
| ------------- | ---------------------------- | --------------- |
| Google Gemini | 15 RPM · 1,500 RPD · 1M TPM  | Any long string |
| Groq          | 30 RPM · 14,400 RPD · 6K TPM | `gsk_...`       |
| Mistral       | 2 RPM · 1B tokens/month      | Any long string |

### 💳 Paid & Trial Cloud — pay-as-you-go with signup credits

| Provider  | Trial offer           | Key format   |
| --------- | --------------------- | ------------ |
| Anthropic | Trial credits         | `sk-ant-...` |
| OpenAI    | $5 credit (3 months)  | `sk-...`     |
| DeepSeek  | 5M free tokens        | `sk-...`     |
| xAI Grok  | $25 + $150/mo program | `xai-...`    |

### 🔜 Coming Soon — 7 new providers in active development

See [PROVIDER_ROADMAP.md](PROVIDER_ROADMAP.md) for full integration details, model lists, pricing, and implementation order.

See [PROVIDER_ROADMAP.md](PROVIDER_ROADMAP.md) for full integration details, model lists, pricing, and step-by-step implementation notes.

| Provider          | Highlight                                                      | Free tier    | Phase   | Status         |
| ----------------- | -------------------------------------------------------------- | ------------ | ------- | -------------- |
| **Fireworks AI**  | Fastest inference platform · hosts Llama, DeepSeek, Qwen       | $1 credit    | Phase 1 | ✅ v0.6.0      |
| **Together AI**   | 200+ open-source models · $25 signup credit                    | $25 credit   | Phase 1 | ✅ v0.6.0      |
| **MiniMax**       | MiniMax M3 — competitive with GPT-4o at $0.60/M input          | None         | Phase 1 | ✅ v0.6.0      |
| **Cerebras**      | Wafer-scale chip · Llama 3.3 70B at ~2,000 tokens/sec          | ✅ Free tier | Phase 1 | ✅ v0.6.0      |
| **Cohere**        | Enterprise-strength instruction-following · Command A/R models | ✅ Trial key | Phase 1 | ✅ v0.6.0      |
| **Perplexity AI** | Search-grounded responses with live web citations              | None         | Phase 2 | 🔜 v0.7.0      |
| **OpenAI Codex**  | Dedicated coding agent · shares your OpenAI API key            | None         | Phase 3 | 🔜 v0.8.0      |

**Phase 1** (~7–8 hours dev, all OpenAI-compatible): Add `FireworksProvider`, `TogetherProvider`, `MiniMaxProvider`, `CerebrasProvider`, `CohereProvider` to `openaiCompatProviders.js`. No new npm packages needed.

**Phase 2** (~1–2 hours): Add `PerplexityProvider` with custom `sendMessage` override to surface inline citations from `res.citations[]`.

**Phase 3** (~2 hours): New `codexProvider.js` using the Responses API (`/v1/responses`). Shares the existing OpenAI API key — auto-detects when OpenAI is already configured.

---

## Setup

### Prerequisites

- Node.js 22+ (https://nodejs.org) — Node 24 recommended
- Git (https://git-scm.com)
- PowerShell 5+ (built into Windows 10/11)

### Clone & install

```powershell
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

# Linux AppImage — run on Linux or via GitHub Actions CI
npm run build:linux
# Output: dist-app/AI Queue Load Manager.AppImage
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
      localProviders.js        ← Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp (local/offline)
    webSearch.js              ← Tavily + SearXNG web search service
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

Each prompt can carry one or more tags. Tags do two things: they tell the router what _kind_ of task the prompt is, and on paid tier they lift the prompt's queue priority.

| Tag        | Emoji | Drives routing to…                   | Free / Starter boost | Pro boost |
| ---------- | ----- | ------------------------------------ | -------------------- | --------- |
| Chat       | 💬    | General providers                    | —                    | +2        |
| Research   | 🔬    | Anthropic, OpenAI, Gemini, Grok      | —                    | +8        |
| Code       | 💻    | Anthropic, OpenAI, Mistral, DeepSeek | —                    | +8        |
| Web Search | 🌐    | Research-strength providers          | —                    | +6        |
| Writing    | ✍️    | General providers                    | —                    | +4        |
| Analysis   | 📊    | Research-strength providers          | —                    | +6        |
| Image      | 🖼️    | OpenAI (DALL-E), Gemini              | —                    | +5        |
| Translate  | 🌍    | General providers                    | —                    | +2        |
| **Urgent** | ⚡    | _(modifier — no routing effect)_     | **+10**              | **+20**   |

All-tag priority boosts (the non-Urgent column) require a **Pro** license. On Free and Starter, only ⚡ Urgent boosts queue position. Tags are multi-select — the first non-Urgent tag sets the routing `task_type`; Urgent stacks on top as a pure priority modifier.

---

## Web search

Tag any prompt with 🌐 **Web Search** and the queue will fetch live results before sending — no tool-calling support required. Search context is injected as a system prompt prefix, so it works with every model, including fully local ones.

### Backends

| Backend     | Cost                                      | Setup                                                                                                         |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Tavily**  | 1,000 free searches/month, no credit card | Sign up at [app.tavily.com](https://app.tavily.com) → copy your `tvly-…` key → paste in Settings → Web Search |
| **SearXNG** | Free, completely self-hosted              | `docker run -p 8888:8080 -e SEARXNG_SEARCH_FORMATS="html,json" searxng/searxng`                               |

> **Port note:** SearXNG's container port is 8080; it's mapped to host port 8888 to avoid conflict with LocalAI (which also defaults to 8080).

### How it works

1. A prompt tagged 🌐 Web Search enters the queue normally.
2. Before the AI call, `WebSearchService.search(prompt)` fires against the configured backend and returns up to 5 results (title, URL, snippet).
3. Results are formatted into a structured context block and prepended to the system prompt.
4. The enriched prompt is sent to whichever provider the router selects — no model-side changes needed.
5. If the search fails (network error, bad key, SearXNG offline), the queue item proceeds without context and logs a warning. Nothing is lost.

Configure the backend and keys in **Settings → Connectors → 🌐 Web Search**.

---

## Auto-retry on failure

When a queued prompt fails due to a transient error (network timeout, 5xx server error, or an unexpected rate-limit spike), the queue automatically resets it to `pending` and tries again — up to **3 attempts** by default. The retry count and last error message are stored in the database so you can see exactly what happened.

**Errors that trigger auto-retry:** network errors, timeouts, 5xx server errors, unexpected rate limit responses.

**Errors that do NOT trigger auto-retry:** invalid API key (401), spend-blocked provider ($0 budget), provider not configured. These are permanent failures that require user action and are surfaced immediately as errors.

After all retries are exhausted the item settles into `error` status, where you can still click ↺ to retry manually.

---

## Standing instructions

Standing instructions are a global system prompt that is automatically prepended to **every prompt you queue**, across all providers. Set them once in **Settings → Standing Instructions** and forget about them — every AI call will carry those rules without you having to type them each time.

Use standing instructions to set a consistent tone, language, output format, or any baseline rules that should apply to all your AI interactions — the equivalent of a `CLAUDE.md` or a custom system prompt, but for every provider at once.

**Example:**

```
Always reply in British English.
Keep responses concise — no more than 3 paragraphs unless asked.
Format all code with syntax highlighting.
You are a helpful assistant for a small software team.
```

Standing instructions are stored locally via `electron-store` and survive app restarts. They are prepended before any per-prompt system prompt, so per-prompt instructions can always override or extend them.

---

## Routing modes

| Mode       | Tier         | Behaviour                                                                                                                                                     |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual`   | All          | You explicitly pick provider + model per prompt                                                                                                               |
| `freeTier` | All          | Local providers first (Ollama / LM Studio / Jan.ai / LocalAI / llama.cpp), then Gemini, Groq, Mistral — and Cerebras + Cohere once added                      |
| `auto`     | Starter, Pro | Scores all providers on capacity, cost, and task type — all local AI providers get a +50 bonus ($0 cost, no rate limits). Task type derived from prompt tags. |
| `balance`  | Starter, Pro | Round-robins across configured providers                                                                                                                      |
| `cheapest` | Pro          | Always picks lowest input-token cost (local = $0, always wins)                                                                                                |
| `fastest`  | Pro          | Cerebras → Groq → Fireworks → DeepSeek → Mistral → Gemini → OpenAI → Anthropic → local _(Cerebras and Fireworks added when providers ship)_                   |

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

| Feature                                            | Tier     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Consensus mode**                                 | Pro+     | After Compare mode collects responses from all providers, a meta-model synthesises the best answer, flags disagreements, or votes across outputs. Extends Compare mode's data model — no separate queue needed. Ships with the Pro+ tier launch.                                                                                                                                                                                                                                           |
| **Document context injection**                     | Pro      | Attach local files (PDF, DOCX, TXT) as context that is injected into the system prompt for every prompt in a project. No cloud upload — files are read locally.                                                                                                                                                                                                                                                                                                                            |
| **Email digest**                                   | Pro+     | Schedule automated email digests of completed session activity — daily or weekly, delivered to any address. Free tier digest is file-export only.                                                                                                                                                                                                                                                                                                                                          |
| **Cross-provider conversation context**            | Starter  | When the router re-routes a conversation to a different provider (e.g. due to rate limits), the relevant history is adapted and forwarded automatically. No other tool does this — it's only possible because AIQ already sees all provider traffic.                                                                                                                                                                                                                                       |
| **In-app diagnostic bug reports**                  | All      | Upgrade the sidebar "Report a Bug" button to auto-attach diagnostics: app version, OS, configured providers, recent error log entries, and current queue state — all pre-filled into the GitHub issue body so bug reports arrive with full context, not just a title.                                                                                                                                                                                                                      |
| Image generation                                   | Starter  | DALL-E 3, Flux, Ideogram, Stable Diffusion (local via ComfyUI)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Video generation                                   | Pro      | Runway, Pika, Kling — async job polling fits the queue model perfectly                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Prompt template library                            | Starter  | Named variables, fill-and-queue                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Prompt chaining                                    | Pro      | Output of one item becomes input of the next                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Batch CSV import                                   | Starter  | Upload CSV of prompts, queue all at once                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Webhook output delivery                            | Pro      | POST results to any URL on completion                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Cost forecasting                                   | Pro      | Predict monthly spend from usage trends                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| iOS & Android companion                            | Starter  | Monitor queue, add prompts, push notifications. Included at no extra charge.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Custom routing rules**                           | Pro      | Cost and model threshold rules that override the automatic routing decision — e.g. "never use Claude if cost exceeds $0.02" or "always use GPT-4o for Code prompts". Builds on the existing 6 routing modes.                                                                                                                                                                                                                                                                               |
| **Usage export (CSV / JSON)**                      | Starter+ | Export raw usage data — token counts, costs, timestamps, provider/model — as CSV (Starter) or CSV + JSON (Pro+). Different from the session digest HTML export.                                                                                                                                                                                                                                                                                                                            |
| **Scheduled-items calendar view**                  | Starter  | Week/month grid of all upcoming scheduled queue items. Click any item to preview, edit, or cancel it. Drag to reschedule. Pairs with the usage heatmap to give a full past/future time view of your queue activity.                                                                                                                                                                                                                                                                        |
| **Usage Insights panel**                           | Pro      | New Insights sidebar panel: time-series charts of prompts/day, cost/day, and tokens/day; provider distribution; tag type breakdown; busiest-hours heatmap. All powered by existing local SQLite data — no new backend infrastructure needed.                                                                                                                                                                                                                                               |
| **Usage heatmap calendar**                         | Pro      | GitHub-style contribution graph showing prompt volume and cost by day over the last 90 days. Lives inside the Insights panel alongside the scheduled-items calendar, giving a unified past/forward view of queue activity.                                                                                                                                                                                                                                                                 |
| **Prompt habit analysis**                          | Pro+     | Pattern observations that surface routing efficiency suggestions based on your actual usage — e.g. "You route 90% of Research prompts to Claude but Gemini costs 4× less for those queries." Runs entirely against local data, no prompt content analysed externally.                                                                                                                                                                                                                      |
| **AI-powered prompt optimization**                 | Pro+     | A local model (Ollama or LM Studio) reviews your prompt patterns and suggests rewrites and routing changes that cut cost or improve output quality. Requires a local provider to be configured. No prompt content ever leaves the machine.                                                                                                                                                                                                                                                 |
| **Provider health scoring**                        | Pro      | v0.6.0 — Replaces binary UP/DOWN status with a rolling composite score per provider: latency (p50/p95), error rate %, token throughput (tokens/sec), and RPM headroom. Surfaced as a live gauge on each provider card in the Usage Dashboard. The router uses the score for weighted decisions in `auto` mode.                                                                                                                                                                             |
| **Provider latency & throughput metrics**          | All      | v0.6.0 — Display tokens/sec and average response time per provider in the Usage Dashboard. Cerebras and Groq are the showcase — seeing "Cerebras: ~1,800 tok/s vs. GPT-4o: ~45 tok/s" live makes the `fastest` routing mode tangible. Data is derived from existing queue completion events; no new backend infrastructure needed.                                                                                                                                                         |
| **Per-project budget allocation**                  | Pro      | v0.6.0 — Scope a monthly USD budget to a project rather than a provider. The cap spans all providers the project uses, so "this client gets $50/month of AI" works regardless of which provider processes each item. Pairs with cost tracking and usage export for a complete per-project cost picture.                                                                                                                                                                                    |
| **Dynamic cost-based routing**                     | Pro      | v0.7.0 — Extends `cheapest` mode and custom routing rules into a live cost/quality scoring engine. Define thresholds like "max $0.03/request" or "never use Claude for Chat prompts" and the router enforces them at dispatch time, dynamically selecting the cheapest provider that meets all active rules. Few competitors do this well. See [planning_docs/Missing Features That Could Differentiate AIQ.md](planning_docs/Missing%20Features%20That%20Could%20Differentiate%20AIQ.md). |
| **SLA enforcement engine**                         | Pro+     | v0.7.0 — Per-project SLA rules: maximum latency, maximum cost per request, minimum reliability score. When the winning provider fails an SLA check the router falls back to the next-best automatically. Rules are defined per project and stored locally. This is the "Cloudflare for AI inference" differentiator — highly competitive against LiteLLM.                                                                                                                                  |
| **Audit log & routing history**                    | Pro      | v0.7.0 — Append-only local log of every routing decision: which item was sent where, which routing mode fired, which rule matched, and what it cost. Stored in SQLite alongside existing usage data. Provides accountability for governance-conscious users and is the foundation for the full compliance tier later.                                                                                                                                                                      |
| **Cost allocation tags & chargeback export**       | Pro      | v0.8.0 — Assign a cost-center label (client, department, or team) to any project. Usage export includes the cost-center field so you can generate per-client or per-department spend reports from your own spreadsheet or BI tool. Enables chargeback billing for MSPs and freelancers without a full billing engine.                                                                                                                                                                      |
| **Agent Gateway — local OpenAI-compatible server** | All      | v0.6.0 — Expose a local HTTP endpoint (`localhost:8787/v1`) that any OpenAI-compatible framework can use as its base URL. Hermes, n8n, OpenClaw, LangGraph, CrewAI, AutoGen, OpenAI Agents SDK — all route through AIQ's queue, router, and cost tracker with one config change. Streaming supported.                                                                                                                                                                                      |
| **Agent/MCP routing (full)**                       | Pro+     | v1.0 — Extend the Gateway to handle full multi-step agentic runs including MCP tool calls, with per-run cost attribution and SLA enforcement. Builds on the v0.6.0 gateway foundation.                                                                                                                                                                                                                                                                                                     |
| **Linux native app**                               | All      | AppImage (runs on any distro without installation — no root required) + `.deb` for Debian/Ubuntu. The `electron-builder` config is already in place and a `build:linux` script is ready. Needs testing on a Linux runner before public release.                                                                                                                                                                                                                                            |

---

## Purchasing & Licensing

AIQ Load Manager uses **[Lemon Squeezy](https://www.lemonsqueezy.com)** as its payment and subscription vendor (Merchant of Record). Lemon Squeezy handles checkout, global tax compliance (VAT/GST/sales tax), subscriptions, and license key issuance — no separate tax setup required.

**Note — BYOK model:** AIQ Load Manager is desktop software. Users bring their own API keys from each AI provider. No prompts pass through our servers; no AI usage is resold.

### Products to create in Lemon Squeezy

| Product         | Type         | Price          | LS product name                           |
| --------------- | ------------ | -------------- | ----------------------------------------- |
| Starter Monthly | Subscription | $9.00/mo       | `AIQ Load Manager — Starter`              |
| Pro Monthly     | Subscription | $19.00/mo      | `AIQ Load Manager — Pro`                  |
| Pro+ Monthly    | Subscription | $34.00/mo      | `AIQ Load Manager — Pro+` _(Coming soon)_ |
| Team Monthly    | Subscription | $49.00/user/mo | `AIQ Load Manager — Team` _(Coming soon)_ |

Enable **License Keys** on every product (1 key per order, activation limit 2). Free tier users download directly from GitHub Releases — no checkout needed. All plans are monthly subscriptions — no lifetime deals are offered.

### Landing page checkout integration

`docs/index.html` uses Lemon.js to open checkout as an overlay popup. The `CHECKOUT_URLS` block near the bottom of the file holds the product checkout URLs — replace the placeholder strings with your real Lemon Squeezy checkout links after creating products in the dashboard:

```js
const CHECKOUT_URLS = {
  starter: "https://YOUR_STORE.lemonsqueezy.com/buy/VARIANT_UUID", // $9/mo
  pro: "https://YOUR_STORE.lemonsqueezy.com/buy/VARIANT_UUID", // $19/mo
  pro_plus: "https://YOUR_STORE.lemonsqueezy.com/buy/VARIANT_UUID", // $34/mo (coming soon)
};
```

Get these URLs from: **LS Dashboard → Store → Products → your product → Share → Checkout URL**.

### License key validation

`src/main/licenseChecker.js` calls the Lemon Squeezy Licenses API to activate and validate keys:

- **Activate** (on first key entry): `POST https://api.lemonsqueezy.com/v1/licenses/activate`
- **Validate** (on app start): `POST https://api.lemonsqueezy.com/v1/licenses/validate`
- **Deactivate** (on key removal): `POST https://api.lemonsqueezy.com/v1/licenses/deactivate`

Before going live, paste your LS Variant IDs into the `LS_VARIANT_PLAN_MAP` constant in `licenseChecker.js`. See `LEMONSQUEEZY_SETUP.md` for the full step-by-step.

### Testing without real money

In the Lemon Squeezy dashboard, create a **100% discount code** (Store → Discounts → New Discount → 100% off). Share the code with testers — they go through real checkout, pay $0, and receive a real license key that exercises the full activation flow. No test-mode toggle needed.

### Newsletter opt-in

In the Lemon Squeezy dashboard → **Store Settings → Checkout → "Show newsletter opt-in checkbox"**, enable the opt-in. No changes needed in `docs/index.html`. To pipe subscribers to an external list (Mailchimp, ConvertKit, etc.), use the LS webhooks or a Zapier integration.

---

## Data storage

All data is local — no cloud sync.

| Platform | Location                                                     |
| -------- | ------------------------------------------------------------ |
| Windows  | `%APPDATA%\ai-queue-manager\ai-queue.db`                     |
| macOS    | `~/Library/Application Support/ai-queue-manager/ai-queue.db` |

API keys are stored in the OS user data directory via `electron-store`.

---

## Bug reports & feature requests

AIQ Load Manager has a built-in **🐛 Report a Bug** button at the bottom of the sidebar. Clicking it opens GitHub Issues in your browser with a pre-filled template that includes your app version and OS — no copying and pasting required.

For feature requests, open an issue manually at [github.com/LoJMike/AIQLoadManager/issues](https://github.com/LoJMike/AIQLoadManager/issues) and use the title prefix `Feature:`.

**Tips for a great bug report:**

- Describe what you expected to happen and what actually happened
- Include steps to reproduce the issue
- Note which provider(s) were involved, if applicable

**Coming soon (roadmap):** the button will automatically attach diagnostics — configured providers, recent error log, queue state — so bug reports arrive with full context.

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

---

## License

Copyright (c) 2026 Mikel Hall. All Rights Reserved.

AI Queue Load Manager is proprietary software. The source code may not be copied,
modified, distributed, or reverse-engineered without prior written permission.
End users may install and run the compiled application under the applicable
subscription terms.

See [LICENSE.txt](LICENSE.txt) for the full terms.
