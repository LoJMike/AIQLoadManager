# AIQ Load Manager — Product Roadmap

**Current version:** v0.5.0 (testing release, June 2026)
**Strategic positioning:** "Cloudflare + Datadog + FinOps for AI inference" — multi-provider routing, intelligent load balancing, cost optimization, SLA management, and governance. Directly competes with LiteLLM today while expanding into areas where LiteLLM is still weak.

---

## Version history at a glance

| Version | Theme | Est. release |
|---------|-------|--------------|
| **v0.5.0** | Current — 12 providers, routing, compare mode, web search, local AI | Live |
| **v0.6.0** | Provider expansion + health intelligence + Agent Gateway | ~August 2026 |
| **v0.7.0** | Intelligence layer — dynamic routing, SLA, audit | ~October 2026 |
| **v0.8.0** | Power-user features — consensus, chaining, chargeback | ~December 2026 |
| **v0.9.0** | Platform breadth — bulk tools, media, mobile, Linux | ~Q1 2027 |
| **v1.0** | Enterprise & agent routing | ~Q2 2027 |

---

## What's live in v0.5.0

These features are complete and shipping today.

### Providers (12 total)

**Local AI — Free, offline, no API key**
Ollama · LM Studio · Jan.ai · LocalAI · llama.cpp — all ports configurable, all models auto-discovered.

**Free cloud tier**
Google Gemini (15 RPM / 1,500 RPD / 1M TPM) · Groq (30 RPM / 14,400 RPD) · Mistral (2 RPM / 1B tokens/month)

**Paid cloud**
Anthropic Claude · OpenAI · DeepSeek · xAI Grok

### Core routing
Six modes: `manual` · `freeTier` · `auto` · `balance` · `cheapest` · `fastest`. Routing decisions are based on RPM headroom, cost-per-token, task type (from prompt tags), and provider availability.

### Queue & reliability
Priority ordering · ⚡ Urgent boost · auto-retry (3 attempts) · per-provider budget caps & alerts · rate-limit awareness with automatic wait-and-resume.

### Cost & usage tracking
Live token counter as you type · per-provider cost estimate before queuing · ranked provider comparison table · session digest HTML export.

### Intelligence & UI
Compare mode (side-by-side multi-provider) · 9 prompt tags that drive routing and priority · web search injection (Tavily / SearXNG, works with local models) · standing instructions · response style presets · per-project conversation history (SQLite-persisted).

---

## Phase 1 — v0.6.0 · Provider expansion + health intelligence
**Est. release: ~August 2026 · Dev effort: ~12–14 hours**

### 1.1 — Five new cloud providers
*All OpenAI-compatible. No new npm packages. Added to `openaiCompatProviders.js`.*

**Dev effort: ~7–8 hours (phases described in [PROVIDER_ROADMAP.md](PROVIDER_ROADMAP.md))**

| # | Provider | Key format | Free tier | Highlight | Dev effort |
|---|----------|------------|-----------|-----------|------------|
| 1 | **Fireworks AI** | `fw_` | $1 credit | Fastest inference · hosts Llama 3.3 70B, DeepSeek V3, Qwen 2.5 | ~30 min |
| 2 | **Together AI** | `sk-` | $25 credit | 200+ open-source models · most generous free credits | ~30 min |
| 3 | **MiniMax** | none standard | None | MiniMax M3 — GPT-4o quality at $0.60/M input | ~30 min |
| 4 | **Cerebras** | `csk-` | ✅ Free tier | Wafer-scale chip · Llama 3.3 70B at ~1,800–2,000 tok/s | ~30 min |
| 5 | **Cohere** | no standard | ✅ Trial key | Enterprise instruction-following · Command A/R models | ~1.5 hr |

**Routing mode updates shipped with these providers:**
- `fastest`: Cerebras → Groq → Fireworks → DeepSeek → Mistral → Gemini → OpenAI → Anthropic
- `freeTier`: Gemini → Groq → Mistral → Cerebras → Cohere → Together → Fireworks

### 1.2 — Provider health scoring (Pro)
Replaces binary UP/DOWN with a rolling composite score per provider:
- **Latency** — p50 and p95 response time from recent completions
- **Error rate %** — rolling window of failed vs. successful queue items
- **Token throughput** — tokens/sec derived from completion events
- **RPM headroom** — current RPM vs. the provider's limit

The composite score is surfaced as a live gauge on each provider card in the Usage Dashboard. The `auto` routing mode uses the score for weighted decisions — a fast-but-unreliable provider scores lower than a slightly slower but rock-solid one.

*Dev effort: ~2–3 hours. All data already flows through the queue completion pipeline; this is a metrics aggregation + UI layer.*

### 1.3 — Provider latency & throughput metrics (All tiers)
Tokens/sec and average response time displayed on each provider card. No new backend — derived from existing queue completion events. The `fastest` mode explanation becomes immediately tangible when users see live numbers like "Cerebras ~1,800 tok/s · GPT-4o ~45 tok/s".

*Dev effort: ~1 hour. Subset of 1.2 surfaced on all tiers.*

### 1.4 — Per-project budget allocation (Pro)
Budget caps scoped to a project rather than a provider. The monthly USD cap spans all providers used in that project — "this client gets $50/month of AI" works regardless of which provider handles each item. Pairs with cost tracking and usage export for a complete per-project cost picture.

*Dev effort: ~2 hours. Extends the existing per-provider budget model with a project-level aggregation layer.*

### 1.5 — Agent Gateway — OpenAI-compatible local server (All tiers)
AIQ exposes a local HTTP server (`localhost:8787`, configurable) that speaks the standard OpenAI Chat Completions API (`POST /v1/chat/completions`). Any AI agent framework that supports a custom `baseURL` — Hermes, LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, and others — can point at AIQ and immediately gain AIQ's full routing, rate-limit management, cost tracking, and provider fallback without any code changes on the agent side.

**How it works:**
- Incoming requests are enqueued as standard queue items and processed through the existing `QueueRouter` → `ProviderRegistry` pipeline
- The `model` field drives routing: pass `aiq/auto`, `aiq/cheapest`, `aiq/fastest`, or `aiq/free` to use AIQ's routing modes; pass a real model name (e.g. `claude-3-5-sonnet`) to force a specific provider
- Supports both synchronous and streaming (`stream: true`) responses via SSE
- Optional per-project API key for local auth — prevents any process on the machine from using the gateway without permission
- A new **Gateway** panel in the sidebar shows server status, active port, and a live request log

**OpenRouter as provider (added alongside):**
OpenRouter is added as a new provider (17th) using the existing `openai` SDK at `https://openrouter.ai/api/v1`. This gives access to 500+ models through a single API key and is the recommended backend for Hermes Agent users already on OpenRouter.

**Compatible agent frameworks:**

| Framework | How to connect |
|---|---|
| Hermes Agent (NousResearch) | Set `base_url: http://localhost:8787/v1` in provider config; use `aiq/auto` as model |
| LangGraph | Pass `base_url` and `api_key` to the `ChatOpenAI` constructor |
| CrewAI | Set `OPENAI_API_BASE=http://localhost:8787/v1` in `.env` |
| AutoGen / AG2 | Set `base_url` in `OAI_CONFIG_LIST` |
| OpenAI Agents SDK | Pass `base_url` to `AsyncOpenAI` client |
| OpenClaw | Set base URL to `http://localhost:8787/v1` in provider config; AIQ replaces OpenClaw's native multi-provider routing with rate-limit-aware queuing and cost tracking |
| n8n | In any OpenAI credential, change the `Base URL` field to `http://localhost:8787/v1`; all AI Agent node LLM calls route through AIQ automatically. Note: requires a recent n8n version; older self-hosted instances may need the HTTP Request node instead |

*Dev effort: ~8–10 hours. Local HTTP server using Node `http` built-in (no new npm package), SSE streaming layer, gateway UI panel, OpenRouter provider file.*

---

## Phase 2 — v0.7.0 · Intelligence layer
**Est. release: ~October 2026 · Dev effort: ~20–25 hours**

### 2.1 — Perplexity AI provider (All tiers)
Search-grounded responses with live web citations. Every Perplexity reply includes source URLs embedded inline.

*See [PROVIDER_ROADMAP.md](PROVIDER_ROADMAP.md) Phase 2 for full implementation notes including the `res.citations[]` custom `sendMessage` override.*

| Model | Context | Input $/M | Output $/M |
|-------|---------|-----------|------------|
| Sonar Pro (Search) | 200K | $3.00 | $15.00 |
| Sonar (Search) | 127K | $1.00 | $1.00 |
| Sonar Reasoning Pro | 127K | $2.00 | $8.00 |
| R1-1776 (no search) | 128K | $2.00 | $8.00 |

> ⚠️ Sonar models charge an additional $5/1,000 requests for web search on top of token costs. Documented in the UI tooltip.

*Dev effort: ~1.5 hours.*

### 2.2 — Dynamic cost-based routing (Pro)
Extends `cheapest` mode and custom routing rules into a live cost/quality scoring engine at dispatch time. Users define per-routing-mode or per-project thresholds:

```
"Never exceed $0.03 per request"
"Never use Claude for Chat-tagged prompts"
"Prefer providers with reliability score > 85%"
```

The router evaluates all active rules against every available provider and picks the cheapest that passes. Rules stack — cost threshold + reliability threshold + task-type restriction can all fire on the same item. Few competitors implement this at the rule level; most offer only a single cost-sort mode.

*Dev effort: ~4–5 hours. Extends `queueRouter.js` with a rule-evaluation pass before the existing scoring logic.*

### 2.3 — SLA enforcement engine (Pro+)
Per-project SLA rules that the router enforces automatically at dispatch time:

- **Max latency** — if the winning provider's p95 exceeds the threshold, fall back to the next-best
- **Max cost per request** — hard cap; provider is skipped if estimated cost exceeds it
- **Min reliability score** — provider must meet the health score floor from Phase 1.2

When a provider fails an SLA check the router falls back silently and logs the reason in the audit log (2.4). No user intervention needed. Rules are stored locally per project.

This is the primary "Cloudflare for AI inference" differentiator — the only desktop tool that enforces SLAs across providers. Highly competitive against LiteLLM, which has budget rules but no latency or reliability SLA enforcement.

*Dev effort: ~4–5 hours. Depends on Phase 1.2 health scores being available.*

### 2.4 — Audit log & routing history (Pro)
Append-only local log of every routing decision, stored in SQLite:

| Field | Description |
|-------|-------------|
| `item_id` | Queue item reference |
| `routed_to` | Provider + model selected |
| `routing_mode` | Which mode was active |
| `rule_matched` | Which custom rule or SLA triggered (if any) |
| `estimated_cost` | Cost estimate at dispatch |
| `actual_cost` | Cost recorded on completion |
| `latency_ms` | Actual response time |
| `fallback_from` | If a fallback occurred, which provider was skipped and why |

Surfaced as a new "Audit" tab or filter in the Queue panel. Provides accountability for governance-conscious users and is the foundation for a compliance reporting tier later.

*Dev effort: ~3 hours. SQLite schema extension + UI panel.*

### 2.5 — Cross-provider conversation context (Starter)
When the router re-routes a conversation mid-thread — due to rate limits, cost, or availability — the stored history is automatically adapted to the new provider's message format and forwarded. The conversation continues invisibly. No other tool can do this because no other tool routes across providers in the first place.

*Dev effort: ~3–4 hours. Extends `ConversationStore` + provider message-format adapters.*

### 2.6 — Usage Insights panel (Pro)
New Insights sidebar panel powered entirely by existing local SQLite data:
- Time-series charts: prompts/day, cost/day, tokens/day
- Provider and model distribution
- Tag-type breakdown
- Busiest-hours heatmap

### 2.7 — Usage heatmap calendar (Pro)
GitHub-style contribution graph showing prompt volume and cost by day over the last 90 days. Lives inside the Insights panel. Dark squares = high-activity days; colour shifts from tokens to cost.

---

## Phase 3 — v0.8.0 · Power-user features
**Est. release: ~December 2026 · Dev effort: ~25–30 hours**

### 3.1 — OpenAI Codex provider (Pro)
Dedicated coding agent using the Responses API (`/v1/responses`) rather than Chat Completions. Shares the user's existing OpenAI API key — auto-detected when OpenAI is already configured; no separate key entry needed.

*See [PROVIDER_ROADMAP.md](PROVIDER_ROADMAP.md) Phase 3 for full Responses API skeleton and UX notes.*

| Model | Context | Input $/M | Output $/M |
|-------|---------|-----------|------------|
| Codex Mini | 200K | $1.50 | $6.00 |

*Dev effort: ~2 hours. New `codexProvider.js` file.*

### 3.2 — Cost allocation & chargeback export (Pro)
Assign a cost-center label (client, department, or team) to any project. Usage exports include the cost-center field so per-client or per-department spend reports can be generated in any spreadsheet or BI tool. Enables chargeback billing for MSPs and freelancers without a full billing engine.

Generated report columns: `date · project · cost_center · provider · model · prompt_tokens · completion_tokens · cost_usd · tag_type`

*Dev effort: ~2–3 hours. Schema extension on projects table + export formatter.*

### 3.3 — Consensus mode (Pro+)
After Compare mode collects responses from all providers, a meta-model synthesises the best answer, flags where providers disagree, or runs a majority-vote across outputs. One click from Compare — no separate queue, no extra setup.

*Dev effort: ~4–5 hours. Extends Compare mode's data model in `multiQueueManager.js`.*

### 3.4 — Document context injection (Pro)
Attach local files (PDF, DOCX, TXT) as persistent context for a project. File content is injected into the system prompt for every prompt in that project. Files are read locally and never uploaded to any server.

*Dev effort: ~3–4 hours. File picker + system prompt injection layer.*

### 3.5 — Prompt chaining (Pro)
Use the output of one queue item as the input to the next. Build multi-step AI pipelines without writing code. Defined as a simple dependency graph on queue items.

*Dev effort: ~4–5 hours.*

### 3.6 — Webhook output delivery (Pro)
POST completed responses to any URL the moment they're ready. Connect AIQ to Zapier, Make, or a custom backend without polling.

*Dev effort: ~2 hours. POST handler on item completion event.*

### 3.7 — Cost forecasting (Pro)
Predict monthly AI spend from current usage trends. Warn before a budget is blown, not after.

### 3.8 — Prompt habit analysis (Pro+)
Pattern observations that surface routing efficiency suggestions from actual usage history — e.g. "You route 90% of Research prompts to Claude but Gemini costs 4× less for that tag type." Runs entirely against local SQLite data; no prompt content analysed externally.

### 3.9 — AI-powered prompt optimization (Pro+)
A local model (Ollama or LM Studio) reviews prompt patterns and suggests rewrites and routing changes that cut cost or improve output quality. Requires a local provider. All analysis runs on local hardware — no prompt content leaves the machine.

---

## Phase 4 — v0.9.0 · Platform breadth
**Est. release: ~Q1 2027 · Dev effort: ~25–30 hours**

### 4.1 — Batch CSV import (Starter)
Upload a CSV of prompts and queue them all at once. Each row maps to one queue item with full routing, tagging, and priority options. Ideal for bulk content generation, testing, or data processing.

### 4.2 — Prompt template library (Starter)
Save reusable prompt templates with named `{{variables}}`. Fill in the blanks and queue — no copy-paste gymnastics. Templates are stored locally per project.

### 4.3 — Scheduled-items calendar view (Starter)
Week/month grid of all upcoming scheduled queue items. Click any item to preview, edit, or cancel. Drag to reschedule. Pairs with the usage heatmap from Phase 2.7 to give a unified past/forward time view of queue activity.

### 4.4 — Email digest (Pro+)
Schedule automated email digests of completed session activity — daily or weekly. Free and Starter users can already export session digests as local HTML; Pro+ adds email delivery so a formatted summary arrives without opening the app.

### 4.5 — Image generation (Starter)
Queue image prompts to DALL-E 3, Flux, Ideogram, and Stable Diffusion (locally via ComfyUI — free). Each image is a standard queue item with cost tracking and routing. Batch-generate dozens while working on something else. Results auto-save to a chosen folder.

### 4.6 — Video generation (Pro)
Runway, Pika, and Kling take 2–10 minutes per clip and cost real money — exactly when a managed async queue with per-job cost tracking earns its keep. Submit a batch, walk away, come back to finished clips.

### 4.7 — Usage export — CSV & JSON (Starter+)
Export raw usage data (token counts, costs, timestamps, provider/model) as CSV on Starter or CSV + JSON on Pro and above. Distinct from the session digest HTML export.

### 4.8 — Linux native app (All tiers)
AppImage (runs on any distro, no root) + `.deb` for Debian/Ubuntu. The `electron-builder` config is already in place and `build:linux` is ready. Needs a round of testing on a Linux CI runner.

### 4.9 — iOS & Android companion (Starter+)
Queue prompts from a phone, receive push notifications on completion, monitor live costs. Included with Starter and above at no extra charge.

---

## Phase 5 — v1.0 · Enterprise & agent routing
**Est. release: ~Q2 2027 · Dev effort: ~30–40 hours**

### 5.1 — Agent & MCP routing (Pro+)
Route agentic task payloads — OpenAI Agents, LangGraph, CrewAI, AutoGen, MCP tool calls — through the queue the same way text prompts are routed today. The queue model already handles async workloads with retry, cost tracking, and provider fallback; this extends it to multi-step agent runs. Very few products currently do this well.

Target integrations:
- OpenAI Agents API
- LangGraph (LangChain)
- CrewAI
- AutoGen / AG2
- MCP (Model Context Protocol) tool calls

### 5.2 — Pro+ tier full launch
- Unlimited queue depth
- 10,000 cloud prompts/month
- 20M cloud tokens/month
- Consensus mode
- SLA enforcement engine
- Prompt habit analysis
- AI-powered prompt optimization
- Email digest
- Priority email support

### 5.3 — Team tier launch
- 25,000 pooled cloud prompts/month
- 60M pooled cloud tokens/month
- Shared settings across users
- Admin controls
- Team-level usage dashboards
- Cost center management per user/team
- $49/user/month

### 5.4 — Governance & compliance layer
Builds on the audit log from Phase 2.4:
- Model approval policies (whitelist/blacklist per project or team)
- Prompt retention controls (configurable retention window, auto-purge)
- Compliance reporting export (GDPR / SOC 2 aligned event log)
- Role-based access controls for Team tier

---

## Beyond v1.0 — later consideration

These items are on the horizon but not yet scheduled.

| Item | Notes |
|------|-------|
| **Predictive routing** | Use historical latency and cost patterns to pre-score providers before dispatch, rather than reacting to live headroom |
| **Kubernetes / operator deployment** | Self-hosted server mode for enterprise teams who want AIQ as infrastructure, not a desktop app |
| **Marketplace integrations** | Native connectors for Dify, LangChain, CrewAI, OpenWebUI — so AIQ acts as the routing and cost layer behind existing AI toolchains |
| **Enterprise cost center management** | Department/team/customer budget hierarchies with rollup reporting |
| **Chargeback billing** | Generate formatted invoices per cost center — useful for MSPs and internal IT chargebacks |

---

## Strategic context

AIQ Load Manager's strongest positioning is against **LiteLLM** — which is strong on routing and observability but still relatively weak on intelligent traffic engineering, per-project SLA enforcement, and AI FinOps tooling. The Phases 1–3 items above are designed to open that gap. Phases 4–5 expand the addressable market from solo developers into teams and enterprise infrastructure.

Items deliberately **not** on this roadmap: AI app building, workflow automation, and team collaboration features — that space belongs to Dify and similar tools. AIQ stays focused on the routing, load balancing, cost optimization, and governance layer.

---

*Last updated: 2026-06-03 · AIQ Load Manager v0.5.0*
*See also: [PROVIDER_ROADMAP.md](PROVIDER_ROADMAP.md) · [CHANGELOG.md](CHANGELOG.md)*
