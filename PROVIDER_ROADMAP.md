# AIQ Load Manager — New Provider Integration Roadmap

**7 providers · estimated total: ~6–10 hours of focused dev time**

---

## Integration Complexity Key

| Tier | What it means | Effort |
|------|---------------|--------|
| 🟢 Easy | OpenAI-compatible API → new class in `openaiCompatProviders.js` | ~30–45 min each |
| 🟡 Medium | OpenAI-compatible but needs extra params or custom logic | ~1–2 hours |
| 🔴 Custom | Different API format → new dedicated provider file | ~2–3 hours |

---

## Provider Summary

| # | Provider | Tier | SDK needed | API Key prefix | Free tier |
|---|----------|------|------------|----------------|-----------|
| 1 | Fireworks AI | 🟢 Easy | `openai` (reuse) | `fw_` | ✅ $1 credit |
| 2 | Together AI | 🟢 Easy | `openai` (reuse) | `sk-` | ✅ $25 credit |
| 3 | MiniMax | 🟢 Easy | `openai` (reuse) | none standard | ❌ Pay-as-you-go |
| 4 | Cerebras | 🟢 Easy | `openai` (reuse) | `csk-` | ✅ Free tier |
| 5 | Cohere | 🟡 Medium | `openai` (reuse) | `sk-` | ✅ Trial key |
| 6 | Perplexity | 🟡 Medium | `openai` (reuse) | `pplx-` | ❌ Pay-as-you-go |
| 7 | Codex (OpenAI) | 🔴 Custom | `openai` (reuse) | `sk-` | ❌ ChatGPT plan |

> **Good news:** No new npm packages required. All 7 providers can be reached using the
> `openai` SDK already installed — just point `baseURL` at their endpoint.

---

## Phase 1 — Five Easy Wins (all in `openaiCompatProviders.js`)

These four providers are drop-in additions to the existing file. Copy a `GroqProvider`-style
class, update `name`, `baseURL`, `getModels()`, `getRateLimits()`, and you're done.

---

### Provider 1: Fireworks AI 🟢

**What it is:** Fastest inference platform. Hosts Llama, DeepSeek, Qwen, MiniMax, Gemma.
Ideal for the `fastest` routing mode.

**Base URL:** `https://api.fireworks.ai/inference/v1`
**API key prefix:** `fw_`
**Docs:** https://docs.fireworks.ai

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `accounts/fireworks/models/llama-v3p3-70b-instruct` | Llama 3.3 70B | 131,072 | 0.90 | 0.90 | standard |
| `accounts/fireworks/models/llama-v3p1-8b-instruct` | Llama 3.1 8B | 131,072 | 0.20 | 0.20 | fast |
| `accounts/fireworks/models/deepseek-v3` | DeepSeek V3 | 64,000 | 0.90 | 0.90 | standard |
| `accounts/fireworks/models/qwen2p5-72b-instruct` | Qwen 2.5 72B | 32,768 | 0.90 | 0.90 | standard |

**Rate limits:** 600 RPM, no RPD, no TPM cap (paid tier)
**Free tier:** $1 credit on signup; no free RPM tier

**Changes required:**
- `openaiCompatProviders.js` — add `FireworksProvider` class
- `providerRegistry.js` — import + add to `PROVIDER_CLASSES` and `PROVIDER_META`
- `multiUsageTracker.js` — add `fireworks` entry to `COST_TABLE` and `RATE_LIMITS`

---

### Provider 2: Together AI 🟢

**What it is:** 200+ open-source models (Llama, DeepSeek, Qwen, Mistral). Most generous
free credits ($25). Best for variety and open-model routing.

**Base URL:** `https://api.together.xyz/v1`
**API key prefix:** `sk-` (longer than OpenAI, but same prefix — validate by length)
**Docs:** https://docs.together.ai

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Llama 3.3 70B Turbo | 131,072 | 0.88 | 0.88 | standard |
| `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | Llama 3.1 8B Turbo | 131,072 | 0.18 | 0.18 | fast |
| `deepseek-ai/DeepSeek-V3` | DeepSeek V3 | 64,000 | 0.60 | 1.70 | standard |
| `Qwen/Qwen2.5-72B-Instruct-Turbo` | Qwen 2.5 72B Turbo | 32,768 | 1.20 | 1.20 | standard |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | Mixtral 8x7B | 32,768 | 0.60 | 0.60 | fast |

**Rate limits:** 600 RPM, no RPD, no TPM cap (paid tier)
**Free tier:** $25 signup credit; no ongoing free RPM tier

**Changes required:** Same 3-file pattern as Fireworks.

---

### Provider 3: MiniMax 🟢

**What it is:** High-quality Chinese frontier models. MiniMax M3 (released May 2026) is
competitive with GPT-4o at ~$0.60/M input — one of the best price/performance ratios available.

**Base URL:** `https://api.minimax.io/v1`
**API key prefix:** No standard prefix — validate by length (> 30 chars)
**Docs:** https://platform.minimax.io/docs

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `MiniMax-M3` | MiniMax M3 | 1,000,000 | 0.60 | 2.40 | premium |
| `MiniMax-M2.5` | MiniMax M2.5 | 1,000,000 | 0.15 | 1.15 | standard |
| `MiniMax-M2` | MiniMax M2 | 1,000,000 | 0.26 | 1.00 | standard |

**Rate limits:** 60 RPM, no RPD, no TPM cap
**Free tier:** None — pay-as-you-go only

**Changes required:** Same 3-file pattern.

---

### Provider 4: Cerebras 🟢

**What it is:** Wafer-scale AI chip company with the fastest raw inference on the market
(Llama 3.1 70B at ~2,000 tokens/sec). Best candidate for `fastest` routing mode alongside Groq.

**Base URL:** `https://api.cerebras.ai/v1`
**API key prefix:** `csk-`
**Docs:** https://inference-docs.cerebras.ai

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `llama-3.3-70b` | Llama 3.3 70B | 128,000 | 0.85 | 1.20 | fast |
| `llama-3.1-8b` | Llama 3.1 8B | 128,000 | 0.10 | 0.10 | fast |
| `qwen-3-32b` | Qwen 3 32B | 128,000 | 0.40 | 0.80 | standard |

**Rate limits:** 30 RPM free tier; 240 RPM paid
**Free tier:** ✅ Free tier available (30 RPM, rate-limited but no $$ required)

**Changes required:** Same 3-file pattern.

---

### Provider 5: Cohere 🟡

**What it is:** Enterprise-focused. Strong at RAG, structured output, and document Q&A.
The `Command A` and `Command R+` models are especially good at following instructions precisely.

**Base URL:** `https://api.cohere.com/compatibility/v1`

> ⚠️ Note: Cohere's OpenAI-compatible endpoint lives at `/compatibility/v1`, not `/v1`.
> This is the only difference from the standard pattern.

**API key prefix:** No standard prefix — validate by length (> 20 chars)
**Docs:** https://docs.cohere.com

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `command-a-03-2025` | Command A | 256,000 | 2.50 | 10.00 | premium |
| `command-r-plus` | Command R+ | 128,000 | 2.50 | 10.00 | premium |
| `command-r` | Command R | 128,000 | 0.15 | 0.60 | standard |
| `command-r7b-12-2024` | Command R7B | 128,000 | 0.04 | 0.15 | fast |

**Rate limits:** 20 RPM (trial key); 10,000 RPM (production key)
**Free tier:** ✅ Trial API key — free, rate-limited, no production use

**Extra consideration:** Cohere's trial key has a hard `production: false` restriction.
Consider adding a `isTrialKey` flag to the provider or just documenting it in the UI tooltip.

**Changes required:** Same 3-file pattern; note the non-standard base URL path.

---

## Phase 2 — Search-Augmented Provider

### Provider 6: Perplexity AI 🟡

**What it is:** Search-grounded responses. Every answer cites live web sources. Unique
capability not offered by any of your existing 7 providers — strong selling point.

**Base URL:** `https://api.perplexity.ai`
**API key prefix:** `pplx-`
**Docs:** https://docs.perplexity.ai

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `sonar-pro` | Sonar Pro (Search) | 200,000 | 3.00 | 15.00 | premium |
| `sonar` | Sonar (Search) | 127,072 | 1.00 | 1.00 | standard |
| `sonar-reasoning-pro` | Sonar Reasoning Pro | 127,072 | 2.00 | 8.00 | reasoning |
| `r1-1776` | R1-1776 (No Search) | 128,000 | 2.00 | 8.00 | reasoning |

> ⚠️ **Extra pricing:** Sonar models charge an additional $5/1,000 requests for web search
> on top of token costs. The COST_TABLE tracks token costs only — document this caveat
> in the UI tooltip for Perplexity.

**Rate limits:** 50 RPM, no RPD, no TPM cap
**Free tier:** None — Pro plan includes $5/mo credit

**Extra work (beyond the standard pattern):**

Perplexity's API accepts the standard chat completions format BUT supports extra optional
parameters that improve results:

```js
// In sendViaOpenAICompat or a Perplexity-specific override:
const res = await provider.client.chat.completions.create({
  model: usedModel,
  max_tokens: maxTokens,
  messages,
  // Perplexity extras (optional but recommended):
  search_domain_filter: [],        // restrict/exclude domains
  return_citations: true,          // include source URLs in response
  search_recency_filter: 'month',  // limit to recent results
});
// Citations come back in res.citations[] alongside the normal response text
```

Two implementation options:
- **Option A (simple):** Use `sendViaOpenAICompat` as-is. Works fine, just no citations.
- **Option B (better):** Override `sendMessage` in `PerplexityProvider` to pass the extra
  params and append citations to the response text. Recommended for a good user experience.

**Changes required:**
- `openaiCompatProviders.js` — add `PerplexityProvider` with custom `sendMessage` override
- `providerRegistry.js` — import + register
- `multiUsageTracker.js` — add to `COST_TABLE` and `RATE_LIMITS`

---

## Phase 3 — Custom API Provider

### Provider 7: OpenAI Codex 🔴

**What it is:** OpenAI's dedicated coding agent. Uses the **Responses API** (not Chat
Completions). Purpose-built for code generation, debugging, and refactoring tasks.

**API format difference:** Codex uses `/v1/responses`, not `/v1/chat/completions`.
The request/response shape is different enough to warrant a new provider file.

**Base URL:** `https://api.openai.com/v1` (same as OpenAI, different endpoint)
**API key:** Shares OpenAI `sk-` key — users who already have OpenAI configured can reuse it
**Docs:** https://developers.openai.com/codex

**Models to add:**

| Model ID | Display name | Context | Input $/M | Output $/M | Tier |
|----------|--------------|---------|-----------|------------|------|
| `codex-mini-latest` | Codex Mini | 200,000 | 1.50 | 6.00 | coding |

**Rate limits:** Same as OpenAI account limits

**New file needed:** `src/main/providers/codexProvider.js`

```js
// Skeleton — Responses API format
const res = await openaiClient.responses.create({
  model: 'codex-mini-latest',
  input: prompt,               // not "messages" array
  max_output_tokens: maxTokens,
  // No system prompt field — prefix instructions in input instead
});
const response = res.output_text;
const inputTokens  = res.usage?.input_tokens  || 0;
const outputTokens = res.usage?.output_tokens || 0;
```

**UX note:** Since Codex shares the OpenAI API key, consider auto-detecting this in the UI
("You already have OpenAI configured — Codex is ready to use") rather than asking for a
separate key.

**Changes required:**
- New file: `src/main/providers/codexProvider.js`
- `providerRegistry.js` — import + register as `'codex'`
- `multiUsageTracker.js` — add `codex` to `COST_TABLE` and `RATE_LIMITS`

---

## Routing Mode Updates

With these 7 providers added, update `queueRouter.js` priority lists:

```js
// fastest mode — add Cerebras and Fireworks at the top
'fastest': ['cerebras', 'groq', 'fireworks', 'deepseek', 'mistral', 'gemini', 'openai', 'anthropic'],

// freeTier mode — add Cerebras and Cohere
'freeTier': ['gemini', 'groq', 'mistral', 'cerebras', 'cohere', 'together', 'fireworks'],

// cheapest mode — queueRouter already scores by inputCost; no list change needed
```

---

## Implementation Order (recommended)

```
Step 1 — openaiCompatProviders.js
  Add: FireworksProvider, TogetherProvider, MiniMaxProvider, CerebasProvider
  (4 classes, ~30 min each = ~2 hours)

Step 2 — openaiCompatProviders.js (continued)
  Add: CohereProvider (non-standard base URL path)
  Add: PerplexityProvider (custom sendMessage with citations)
  (~1.5 hours)

Step 3 — New file: codexProvider.js
  Responses API format, shared OpenAI key, key-reuse UX
  (~2 hours)

Step 4 — providerRegistry.js
  Import all 7 new classes, add to PROVIDER_CLASSES + PROVIDER_META
  (~30 min)

Step 5 — multiUsageTracker.js
  Add all 7 entries to COST_TABLE + RATE_LIMITS
  (~20 min)

Step 6 — queueRouter.js
  Update fastest/freeTier priority lists
  (~15 min)

Step 7 — Test in dev mode
  Configure one key per provider → send a test prompt → verify usage recorded
  (~1 hour)
```

**Total estimated time: 7–8 hours**

---

## package.json — No New Dependencies Required

All 7 providers use the `openai` SDK already installed. No `npm install` needed.

The only potential addition: if you want Cohere's native SDK for future embedding/rerank
features (not needed for Phase 1 chat completion integration):
```
"cohere-ai": "^7.x.x"   ← optional, Phase 2 only
```

---

## COST_TABLE & RATE_LIMITS Entries to Add

Paste these into `multiUsageTracker.js` alongside the existing entries:

```js
// COST_TABLE additions
fireworks:  {
  'accounts/fireworks/models/llama-v3p3-70b-instruct': [0.90, 0.90],
  'accounts/fireworks/models/llama-v3p1-8b-instruct':  [0.20, 0.20],
  'accounts/fireworks/models/deepseek-v3':             [0.90, 0.90],
  'accounts/fireworks/models/qwen2p5-72b-instruct':    [0.90, 0.90],
},
together:   {
  'meta-llama/Llama-3.3-70B-Instruct-Turbo':           [0.88, 0.88],
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo':       [0.18, 0.18],
  'deepseek-ai/DeepSeek-V3':                           [0.60, 1.70],
  'Qwen/Qwen2.5-72B-Instruct-Turbo':                   [1.20, 1.20],
  'mistralai/Mixtral-8x7B-Instruct-v0.1':              [0.60, 0.60],
},
minimax:    {
  'MiniMax-M3':   [0.60, 2.40],
  'MiniMax-M2.5': [0.15, 1.15],
  'MiniMax-M2':   [0.26, 1.00],
},
cerebras:   {
  'llama-3.3-70b': [0.85, 1.20],
  'llama-3.1-8b':  [0.10, 0.10],
  'qwen-3-32b':    [0.40, 0.80],
},
cohere:     {
  'command-a-03-2025':    [2.50, 10.00],
  'command-r-plus':       [2.50, 10.00],
  'command-r':            [0.15,  0.60],
  'command-r7b-12-2024':  [0.04,  0.15],
},
perplexity: {
  'sonar-pro':            [3.00, 15.00],
  'sonar':                [1.00,  1.00],
  'sonar-reasoning-pro':  [2.00,  8.00],
  'r1-1776':              [2.00,  8.00],
},
codex:      {
  'codex-mini-latest':    [1.50,  6.00],
},

// RATE_LIMITS additions
fireworks:  { rpm: 600, rpd: null, tpm: null   },
together:   { rpm: 600, rpd: null, tpm: null   },
minimax:    { rpm: 60,  rpd: null, tpm: null   },
cerebras:   { rpm: 30,  rpd: null, tpm: null   },  // free tier; 240 rpm paid
cohere:     { rpm: 20,  rpd: null, tpm: null   },  // trial; 10,000 rpm production
perplexity: { rpm: 50,  rpd: null, tpm: null   },
codex:      { rpm: 500, rpd: null, tpm: 200_000 }, // inherits OpenAI limits
```

---

## PROVIDER_META Entries to Add

Paste into `providerRegistry.js` `PROVIDER_META` object:

```js
fireworks:  { displayName: 'Fireworks AI',   color: '#ff4d00', icon: 'ti-flame',       website: 'https://fireworks.ai'          },
together:   { displayName: 'Together AI',    color: '#0066ff', icon: 'ti-users-group',  website: 'https://together.ai'           },
minimax:    { displayName: 'MiniMax',        color: '#6d28d9', icon: 'ti-brand-minimax',website: 'https://platform.minimax.io'   },
cerebras:   { displayName: 'Cerebras',       color: '#f59e0b', icon: 'ti-cpu',          website: 'https://inference.cerebras.ai' },
cohere:     { displayName: 'Cohere',         color: '#39d353', icon: 'ti-message-dots',  website: 'https://cohere.com'            },
perplexity: { displayName: 'Perplexity AI',  color: '#20b2aa', icon: 'ti-world-search', website: 'https://perplexity.ai'         },
codex:      { displayName: 'OpenAI Codex',   color: '#10a37f', icon: 'ti-code',         website: 'https://developers.openai.com/codex' },
```

> Note: `ti-brand-minimax` may not exist in Tabler Icons — fall back to `ti-sparkles`
> if not found. Verify icon names at https://tabler.io/icons before committing.

---

*Last updated: 2026-06-02 · AIQ Load Manager v0.5.0*
