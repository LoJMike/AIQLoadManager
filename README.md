# AI Queue Load Manager

Cross-platform desktop app (Windows 10/11 + macOS) for queuing, routing, and tracking
prompts across 12 AI providers — 7 cloud APIs plus Ollama, LM Studio, Jan.ai, LocalAI, and llama.cpp for fully local, offline AI.

**GitHub:** https://github.com/LoJMike/AIQLoadManager  
**Current version:** v0.5.0 (testing release)  
**Version history:** [CHANGELOG.md](CHANGELOG.md)

---

## Pricing Tiers

All plans are **monthly subscriptions** — cancel any time. No lifetime deals, no usage surcharges on top of your API costs. The monthly cloud prompt and token limits below are AIQ-side caps to keep the service sustainable; you still pay your AI providers directly at their published rates.

| | Free | Starter | Pro | Pro+ *(Coming soon)* | Team *(Coming soon)* |
|---|---|---|---|---|---|
| **Price** | $0 forever | $9/mo | $19/mo | $34/mo | $49/user/mo |
| **AI providers** | 5 (local only) | 8 (local + free cloud) | All 12 | All 12 | All 12 |
| **Monthly cloud prompt runs** | — | 500 | 2,500 | 10,000 | 25,000 (pooled) |
| **Monthly cloud tokens** | — | 1M | 5M | 20M | 60M (pooled) |
| **Max queue depth** | 10 items | 100 items | 500 (soft cap) | Unlimited | Unlimited |
| **Projects** | 1 | 5 | Unlimited | Unlimited | Unlimited |
| **Routing modes** | Manual, Free Tier | + Auto, Balance | + Cheapest, Fastest | All modes | All modes |
| **Budget spend visibility** | View-only | View-only | ✓ | ✓ | ✓ |
| **Budget caps & alerts** | — | — | ✓ | ✓ | ✓ |
| **Cost tracking per provider** | — | ✓ | ✓ | ✓ | ✓ |
| **⚡ Urgent priority boost** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Tag-based smart priority (all tags)** | — | — | ✓ | ✓ | ✓ |
| **Batch CSV import** | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Usage export** | — | CSV *(Roadmap)* | CSV + JSON *(Roadmap)* | CSV + JSON *(Roadmap)* | CSV + JSON *(Roadmap)* |
| **Response style presets** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Per-project response history** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Session digest export (HTML)** | — | ✓ | ✓ | ✓ | ✓ |
| **Per-provider default model** | — | — | — | ✓ | ✓ |
| **Prompt template library** | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Document context injection** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Email digest** | — | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Compare mode (A/B providers)** | — | — | ✓ | ✓ | ✓ |
| **Consensus mode** | — | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Prompt chaining** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Scheduled-items calendar view** | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Usage Insights panel** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Usage heatmap calendar** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Prompt habit analysis** | — | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **AI-powered prompt optimization** | — | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Image generation** | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Video generation** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Webhook output delivery** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Cost forecasting** | — | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Priority email support** | — | — | — | ✓ | ✓ |
| **Linux native app** | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **iOS & Android companion** | — | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* | ✓ *(Roadmap)* |
| **Shared settings & admin controls** | — | — | — | — | ✓ *(Coming soon)* |
| **100% local — no cloud sync** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Anonymous usage analytics — opt out in Settings** | ✓ | ✓ | ✓ | ✓ | ✓ |

**Provider breakdown:** Free = 5 local AI providers (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp) — no API key needed, $0 per request. Starter adds the 3 permanent free cloud tiers (Gemini, Groq, Mistral). Pro unlocks all 4 paid cloud providers (Claude, OpenAI, DeepSeek, xAI Grok) plus everything below. **Pro+** is for solo power users who need 4× the throughput, unlimited queue depth, Consensus mode, and priority support. **Team** adds shared settings and admin controls for multi-user organisations.

---

## Features

| Feature | Tier | Detail |
|---|---|---|
| **Multi-provider GUI** | All | Dark industrial dashboard with per-provider usage cards |
| **Usage tracking** | All | Token in/out, requests/min, requests/day, cost estimate per provider |
| **Rate limit awareness** | All | Knows each provider's RPM/RPD/TPM limits; waits automatically |
| **Prompt queue** | All | Priority ordering, scheduling, auto-retry on transient errors (up to 3 attempts) |
| **Standing instructions** | All | Global system prompt prepended to every queued prompt — set once in Settings, applies across all providers |
| **Prompt type tags** | All | 9 visual chip tags (Chat, Research, Code, Web Search, Writing, Analysis, Image, Translate, ⚡ Urgent) — drive routing and queue priority |
| **Live cost estimation** | All | Token count and per-provider cost estimate shown as you type, before queuing |
| **Provider comparison table** | All | Ranked table of all configured providers with estimated cost and availability shown live in the Add Prompt panel |
| **⚡ Urgent priority boost** | All | Jumps the queue on any plan |
| **Projects & chats** | All | Named projects; continue existing conversation threads |
| **Persistent history** | All | Conversation history survives app restarts — stored in local SQLite |
| **Smart routing** | Starter+ | 4 modes on Starter (Manual, Free Tier, Auto, Balance); all 6 on Pro (+ Cheapest, Fastest) |
| **Cost tracking** | Starter+ | Detailed cost per provider & model |
| **Tag-based smart priority** | Pro | All 9 tag types boost queue position |
| **🌐 Web search** | All | Tag a prompt Web Search — live results from Tavily or SearXNG are injected into the system prompt before the AI call. Works with every model including local ones. |
| **Compare mode** | Pro | Send the same prompt to multiple providers simultaneously; responses shown side-by-side |
| **Budget caps & alerts** | Pro | Monthly USD cap per provider with visual progress |
| **Batch CSV import** | Starter+ *(Roadmap)* | Upload a CSV of prompts and queue them all at once |
| **Response style presets** | All | Per-provider tone/format presets — Normal, Concise, Caveman, Bullet-only, ELI5, or Custom. Set in Settings → provider card. Appended to every prompt sent to that provider. |
| **Per-provider default model** | Pro+ | Override the default model used for any provider when no model is specified in the queue item. Set in Settings → provider card. |
| **Per-project response history** | All | View all completed prompts and responses for any project — click "View history" on any project card in the Projects tab. |
| **Session digest export** | Starter+ | Export all completed queue items as a self-contained HTML file with summary stats, per-item prompt/response, and token costs. Opens natively after saving. |
| **Anonymous usage analytics** | All | PostHog — routing mode usage, provider config, prompt counts. No prompt content, no keys, no personal data. Opt-out toggle in Settings → Analytics. |
| **Support tab** | All | In-app support page with product homepage link, how-it-works guide, bug report shortcut (version and OS pre-filled), feature request link, and GitHub Discussions. Replaces the old nav-bar Report button. |

---

## Supported Providers

Providers are grouped into three tiers in the app's Connectors settings panel.

### 🖥️ Local AI — no API key, no internet, $0 per request

All ports are configurable in Settings → Connectors. Each local provider card shows a **Setup guide ↗** link that opens the official getting-started documentation in your browser.

| Provider    | How to use                                              | Default port |
|-------------|---------------------------------------------------------|--------------|
| Ollama      | `ollama pull llama3.2` then run Ollama                  | `11434`      |
| LM Studio   | Load model → Developer tab → Start server               | `1234`       |
| Jan.ai      | Download model → Settings → Start Local API             | `1337`       |
| LocalAI     | `docker run -p 8080:8080 localai/localai:latest`        | `8080`       |
| llama.cpp   | `llama-server -m model.gguf --port 8181 --ctx-size 4096`| `8181`       |

> **Note:** LocalAI and llama.cpp both default near port 8080 — llama.cpp ships with default 8181 here to avoid conflict.
> Change either port in Settings → Connectors if you need them to coexist.

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

Each prompt can carry one or more tags. Tags do two things: they tell the router what *kind* of task the prompt is, and on paid tier they lift the prompt's queue priority.

| Tag | Emoji | Drives routing to… | Free / Starter boost | Pro boost |
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

All-tag priority boosts (the non-Urgent column) require a **Pro** license. On Free and Starter, only ⚡ Urgent boosts queue position. Tags are multi-select — the first non-Urgent tag sets the routing `task_type`; Urgent stacks on top as a pure priority modifier.

---

## Web search

Tag any prompt with 🌐 **Web Search** and the queue will fetch live results before sending — no tool-calling support required. Search context is injected as a system prompt prefix, so it works with every model, including fully local ones.

### Backends

| Backend | Cost | Setup |
|---|---|---|
| **Tavily** | 1,000 free searches/month, no credit card | Sign up at [app.tavily.com](https://app.tavily.com) → copy your `tvly-…` key → paste in Settings → Web Search |
| **SearXNG** | Free, completely self-hosted | `docker run -p 8888:8080 -e SEARXNG_SEARCH_FORMATS="html,json" searxng/searxng` |

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

| Mode       | Tier         | Behaviour |
|------------|--------------|-----------|
| `manual`   | All          | You explicitly pick provider + model per prompt |
| `freeTier` | All          | Local providers first (Ollama / LM Studio / Jan.ai / LocalAI / llama.cpp), then Gemini, Groq, Mistral |
| `auto`     | Starter, Pro | Scores all providers on capacity, cost, and task type — all local AI providers get a +50 bonus ($0 cost, no rate limits). Task type derived from prompt tags. |
| `balance`  | Starter, Pro | Round-robins across configured providers |
| `cheapest` | Pro          | Always picks lowest input-token cost (local = $0, always wins) |
| `fastest`  | Pro          | Groq → DeepSeek → Mistral → Gemini → OpenAI → Anthropic → local |

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
| **Consensus mode** | Pro+ | After Compare mode collects responses from all providers, a meta-model synthesises the best answer, flags disagreements, or votes across outputs. Extends Compare mode's data model — no separate queue needed. Ships with the Pro+ tier launch. |
| **Document context injection** | Pro | Attach local files (PDF, DOCX, TXT) as context that is injected into the system prompt for every prompt in a project. No cloud upload — files are read locally. |
| **Email digest** | Pro+ | Schedule automated email digests of completed session activity — daily or weekly, delivered to any address. Free tier digest is file-export only. |
| **Cross-provider conversation context** | Starter | When the router re-routes a conversation to a different provider (e.g. due to rate limits), the relevant history is adapted and forwarded automatically. No other tool does this — it's only possible because AIQ already sees all provider traffic. |
| **In-app diagnostic bug reports** | All | Upgrade the sidebar "Report a Bug" button to auto-attach diagnostics: app version, OS, configured providers, recent error log entries, and current queue state — all pre-filled into the GitHub issue body so bug reports arrive with full context, not just a title. |
| Image generation | Starter | DALL-E 3, Flux, Ideogram, Stable Diffusion (local via ComfyUI) |
| Video generation | Pro | Runway, Pika, Kling — async job polling fits the queue model perfectly |
| Prompt template library | Starter | Named variables, fill-and-queue |
| Prompt chaining | Pro | Output of one item becomes input of the next |
| Batch CSV import | Starter | Upload CSV of prompts, queue all at once |
| Webhook output delivery | Pro | POST results to any URL on completion |
| Cost forecasting | Pro | Predict monthly spend from usage trends |
| iOS & Android companion | Starter | Monitor queue, add prompts, push notifications. Included at no extra charge. |
| **Custom routing rules** | Pro | Cost and model threshold rules that override the automatic routing decision — e.g. "never use Claude if cost exceeds $0.02" or "always use GPT-4o for Code prompts". Builds on the existing 6 routing modes. |
| **Usage export (CSV / JSON)** | Starter+ | Export raw usage data — token counts, costs, timestamps, provider/model — as CSV (Starter) or CSV + JSON (Pro+). Different from the session digest HTML export. |
| **Scheduled-items calendar view** | Starter | Week/month grid of all upcoming scheduled queue items. Click any item to preview, edit, or cancel it. Drag to reschedule. Pairs with the usage heatmap to give a full past/future time view of your queue activity. |
| **Usage Insights panel** | Pro | New Insights sidebar panel: time-series charts of prompts/day, cost/day, and tokens/day; provider distribution; tag type breakdown; busiest-hours heatmap. All powered by existing local SQLite data — no new backend infrastructure needed. |
| **Usage heatmap calendar** | Pro | GitHub-style contribution graph showing prompt volume and cost by day over the last 90 days. Lives inside the Insights panel alongside the scheduled-items calendar, giving a unified past/forward view of queue activity. |
| **Prompt habit analysis** | Pro+ | Pattern observations that surface routing efficiency suggestions based on your actual usage — e.g. "You route 90% of Research prompts to Claude but Gemini costs 4× less for those queries." Runs entirely against local data, no prompt content analysed externally. |
| **AI-powered prompt optimization** | Pro+ | A local model (Ollama or LM Studio) reviews your prompt patterns and suggests rewrites and routing changes that cut cost or improve output quality. Requires a local provider to be configured. No prompt content ever leaves the machine. |
| **Linux native app** | All | AppImage (runs on any distro without installation — no root required) + `.deb` for Debian/Ubuntu. The `electron-builder` config is already in place and a `build:linux` script is ready. Needs testing on a Linux runner before public release. |

---

## Purchasing & Licensing

AIQ Load Manager uses **[Lemon Squeezy](https://www.lemonsqueezy.com)** as its payment and subscription vendor (Merchant of Record). Lemon Squeezy handles checkout, global tax compliance (VAT/GST/sales tax), subscriptions, and license key issuance — no separate tax setup required.

### Products to create in Lemon Squeezy

| Product | Type | Price | Lemon Squeezy product name |
|---|---|---|---|
| Starter Monthly | Subscription | $9.00/mo | `AIQ Load Manager — Starter` |
| Pro Monthly | Subscription | $19.00/mo | `AIQ Load Manager — Pro` |
| Pro+ Monthly | Subscription | $34.00/mo | `AIQ Load Manager — Pro+` *(Coming soon)* |
| Team Monthly | Subscription | $49.00/user/mo | `AIQ Load Manager — Team` *(Coming soon)* |

Enable **License Keys** on every product (1 key per order). Free tier users download directly from GitHub Releases — no checkout needed. All plans are monthly subscriptions — no lifetime deals are offered.

### Newsletter opt-in

In Lemon Squeezy dashboard → **Store Settings → Checkout**, enable "Show newsletter opt-in checkbox". Buyers can opt in at checkout; their emails appear in the Customers tab and are exportable to your mailing list tool.

### Landing page checkout integration

`website/index.html` uses **Lemon.js** (Lemon Squeezy's mini JS library) to open checkout as an overlay popup. The `CHECKOUT_URLS` block near the bottom of the file holds the four product checkout URLs — replace the placeholder strings with your real URLs after creating products in Lemon Squeezy:

```js
const CHECKOUT_URLS = {
  starter:  'https://your-store.lemonsqueezy.com/checkout/buy/xxxx',  // $9/mo subscription
  pro:      'https://your-store.lemonsqueezy.com/checkout/buy/xxxx',  // $19/mo subscription
  pro_plus: 'https://your-store.lemonsqueezy.com/checkout/buy/xxxx',  // $34/mo subscription (coming soon)
};
```

### License key validation (TODO)

`src/main/licenseChecker.js` currently stubs license validation (any stored key = pro). When ready to enforce licensing, replace the stub with a real call to the [Lemon Squeezy License API](https://docs.lemonsqueezy.com/api/license-api):

```
POST https://api.lemonsqueezy.com/v1/licenses/validate
Content-Type: application/x-www-form-urlencoded
license_key=XXXX&instance_id=YYYY
```

The API does not require a Bearer token. Validate that the returned `store_id`, `product_id`, and `variant_id` match your products (hard-code these values in `licenseChecker.js`). Store the `instance_id` locally so activation/deactivation can be tracked per machine.

### Testing without real money

Create a 100% discount code in Lemon Squeezy (Dashboard → Discounts → New) with a limited number of uses and a short expiry. Testers go through the normal checkout flow, enter the code, and receive a real license key — no payment required.

---

## Data storage

All data is local — no cloud sync.

| Platform | Location |
|---|---|
| Windows | `%APPDATA%\ai-queue-manager\ai-queue.db` |
| macOS | `~/Library/Application Support/ai-queue-manager/ai-queue.db` |

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
