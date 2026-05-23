# Work Log — AI Queue Load Manager

## Session 13 — 2026-05-23
**Goal:** Select a purchase/subscription vendor, document the setup process, and integrate Lemon Squeezy checkout into the landing page.
**Completed:**
- [x] Researched and compared 4 vendors: Gumroad, Lemon Squeezy, Paddle, Stripe — fees, tax handling, subscription support, email/newsletter capability, and integration ease
- [x] Selected **Lemon Squeezy** as the vendor: 5% + $0.50 fee (half of Gumroad), full Merchant of Record tax handling, first-class subscription support, built-in newsletter opt-in up to 500 subscribers free
- [x] Documented full Lemon Squeezy account setup guide: store creation, 4 products to create (Starter Monthly/Lifetime, Pro Monthly/Lifetime), license key settings, newsletter opt-in config, API key for future license validation, test mode usage, and going live
- [x] Documented tester workflow: create 100% discount code with limited uses + expiry → testers go through real checkout, pay $0, receive a real license key
- [x] Integrated Lemon Squeezy into `landing-page.html`:
  - Added `<script src="https://assets.lemonsqueezy.com/lemon.js" defer>` to `<head>`
  - Added `class="lemonsqueezy-button"` to Starter and Pro buy buttons (triggers overlay checkout popup)
  - Added `id="starter-cta"` and `id="pro-cta"` to buy buttons
  - Updated Free tier "Download Free" buttons to link to GitHub Releases (`/releases/latest`)
  - Extended billing toggle script with `CHECKOUT_URLS` object — swaps button `href` automatically when Monthly ↔ Lifetime toggle changes
  - Added `PASTE_..._CHECKOUT_URL_HERE` placeholder strings marking the 4 URLs that need replacing once products are created in LS
  - Added developer comment block at the top of `landing-page.html` documenting all integration points, action items, and testing approach
- [x] Updated `README.md` — added `## Purchasing & Licensing` section: vendor rationale, products table, newsletter opt-in setup, checkout URL integration instructions, license key validation TODO (Lemon Squeezy License API endpoint + validation logic), and tester discount code workflow
**Decisions Made:**
- Lemon Squeezy chosen over Gumroad (10% fee too high), Paddle (more complex, better for scale), and Stripe (no Merchant of Record — tax burden falls on us)
- Checkout overlay approach chosen over redirect — visitors stay on the landing page; popup closes after purchase
- Billing toggle already existed for display — extended it to also swap `href` on the buy buttons, so the correct product variant always gets purchased regardless of which billing period is selected
- Free tier uses GitHub Releases as the download source — no checkout, no license key needed for free installs
- Newsletter opt-in configured on the Lemon Squeezy side (no landing page code needed) — opt-in checkbox is shown at checkout, unchecked by default (GDPR compliant)
**Next Steps:**
- [ ] Create a Lemon Squeezy account at lemonsqueezy.com
- [ ] Create the 4 products (Starter Monthly/Lifetime, Pro Monthly/Lifetime) with License Keys enabled
- [ ] Copy the 4 checkout URLs and paste them into the `CHECKOUT_URLS` block in `landing-page.html`
- [ ] Enable newsletter opt-in checkbox in LS Store Settings → Checkout
- [ ] Get the LS API key (Settings → API) and replace the stub in `src/main/licenseChecker.js` with a real Lemon Squeezy License API validation call
- [ ] Create a 100% discount code for beta testers
- [ ] Test the full checkout flow in LS Test Mode before going live
**Files Changed:**
- `landing-page.html`
- `README.md`
- `WORKLOG.md`

---

## Session 12 — 2026-05-23
**Goal:** Implement Tavily + SearXNG web search backends; update README and landing page with web search documentation; bump version to 0.3.6.
**Completed:**
- [x] Created `src/main/webSearch.js` — `WebSearchService` class with Tavily (cloud, POST to api.tavily.com/search) and SearXNG (self-hosted Docker, GET /search?format=json) backends
- [x] Tavily key validation: must start with `tvly-`; stored in electron-store as `searchKey.tavily`
- [x] SearXNG URL stored as `searchUrl.searxng`; defaults to `http://localhost:8888` (port 8888 avoids conflict with LocalAI's default 8080); handles `ECONNREFUSED` and HTTP 400 with specific error messages
- [x] `isConfigured()`, `getConfig()` (IPC-safe — never exposes raw key), `formatContext()` (formats up to 5 results into a system-prompt block)
- [x] Updated `MultiQueueManager` — added `this.webSearch = null`, `setWebSearch(service)`, and `_enrichWithWebSearch(item)` async helper; enrichment runs before the AI call in both `_processItem()` and `_processCompareItem()`; fails silently with a `console.warn` if search errors out
- [x] Updated `index-v2.js` — imported `WebSearchService`, instantiated after store, called `queue.setWebSearch(webSearch)` after `queue.open()`; added 5 IPC handlers: `get-search-config`, `set-search-backend`, `set-search-key`, `remove-search-key`, `set-searxng-url`
- [x] Updated `preload-v2.js` — exposed `getSearchConfig`, `setSearchBackend`, `setSearchKey`, `removeSearchKey`, `setSearxngUrl`
- [x] Updated `QueueSettingsProjects.jsx` — added full Web Search settings section below provider tier groups: backend picker (None / Tavily / SearXNG), Tavily API key input (show/hide toggle, Save/Remove buttons, links), SearXNG URL + Docker quickstart command, "How it works" limits grid
- [x] Updated `README.md` — added `## Web Search` section with backend table, RAG injection explanation, port note, failure behaviour; added web search row to Features table; updated project structure with `webSearch.js` and corrected `localProviders.js` comment; version bump 0.3.5 → 0.3.6
- [x] Updated `landing-page.html` — new "Real-time web search" feature card; web search row in full compare table; new FAQ item "How does the 🌐 Web Search tag work?"; updated Prompt type tags card description
- [x] Bumped version 0.3.5 → 0.3.6 in `package.json`, `CLAUDE.md`
**Decisions Made:**
- RAG injection approach (not tool-calling): search results are prepended to the system prompt as a formatted context block. Works with every model including fully local ones — no model-side function-calling support needed.
- Search enrichment runs once per item in `_enrichWithWebSearch()` before the AI call. For compare items, the same context block is sent to all providers — keeps the comparison fair.
- Silent failure: if the search backend errors (network down, bad key, SearXNG offline), the prompt is sent unchanged. Nothing is lost — the queue item proceeds normally.
- SearXNG host port 8888 (not 8080) — avoids conflict with LocalAI's default port.
- `getConfig()` never returns the raw Tavily key over IPC — returns `tavilyConfigured: bool` only.
**Files Changed:**
- `src/main/webSearch.js` (new)
- `src/main/multiQueueManager.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `package.json`
- `README.md`
- `CLAUDE.md`
- `landing-page.html`
- `WORKLOG.md`

---

## Session 11 — 2026-05-23
**Goal:** Integrate LocalAI and llama.cpp as full providers; add configurable port fields for all 5 local providers; update README and landing page with accurate counts and model info.
**Completed:**
- [x] Refactored `LocalBaseProvider` constructor to take `defaultPort` (number) instead of `baseURL` (string); port now loaded from store at startup via `localPort.{name}` key
- [x] Added `setLocalPort(port)` method to `LocalBaseProvider` — validates, saves to store, re-initialises OpenAI client, resets model discovery
- [x] Added `getCurrentPort()` and `getDefaultPort()` accessors
- [x] Updated all existing local providers (Ollama, LM Studio, Jan) to pass port number rather than URL string
- [x] Added `LocalAIProvider` class — port 8080, `/v1/models` discovery, display-name cleans GGUF extension/quantisation suffix from model IDs
- [x] Added `LlamaCppProvider` class — port 8181 (avoids conflict with LocalAI 8080), `/v1/models` + `/props` for accurate `n_ctx` context window, basenames file paths for display
- [x] Updated `providerRegistry.js` — imported both new providers, registered in PROVIDER_CLASSES + PROVIDER_META, added `setLocalPort(name, port)` and `getLocalPorts()` registry methods, included `currentPort`/`defaultPort` in `getProviderSummaries()` output
- [x] Updated `queueRouter.js` — added `localai` + `llamacpp` to LOCAL_PROVIDERS, FREE_TIER_PROVIDERS, all TASK_STRENGTHS categories, and the `fastest` provider order
- [x] Updated `multiUsageTracker.js` — added `localai: {}` and `llamacpp: {}` to COST_TABLE, added rate limits (rpm: 9999) to RATE_LIMITS
- [x] Added IPC handlers in `index-v2.js`: `get-local-ports` and `set-local-port`
- [x] Exposed `getLocalPorts()` and `setLocalPort()` in `preload-v2.js`
- [x] Updated `QueueSettingsProjects.jsx`:
  - PROVIDER_TIER_GROUPS local group now includes jan, localai, llamacpp
  - Added PROVIDER_GUIDE entries for jan, localai, llamacpp (setupText, quickstart, installLabel/Link, docsLink, localNote, limits)
  - Added `setupText` field to ollama and lmstudio guide entries; removed hardcoded provider.name switch
  - Added `portValue` / `setPortValue` state to `ProviderSettingsCard`
  - Replaced static "Server URL" display with a live port input field (shows current port, Save button, Reset to default button)
  - Added `onSavePort` prop to `ProviderSettingsCard`
  - Added `onSavePort(providerName, port)` handler to `SettingsPanel`
  - Passed `onSavePort` through `renderCard` to each card
  - Updated "Getting started" banner to mention Jan.ai alongside Ollama and LM Studio
- [x] Updated `README.md`: provider count 10→12, local provider table with 5 providers + port conflict note, routing descriptions, version 0.3.4→0.3.5
- [x] Updated `landing-page.html`: hero badge 9→12, added 3 new local provider pills, fixed "All 9"→"All 12" in pricing table, updated roadmap card, Free Tier routing description, FAQ answer
- [x] Bumped version 0.3.4→0.3.5 in package.json, README.md, CLAUDE.md
**Decisions Made:**
- llama.cpp default port set to 8181 (not 8080) to avoid conflicting with LocalAI's 8080 default out of the box
- Configurable port stored as `localPort.{providerName}` in electron-store; reuses existing store pattern used for API keys
- `currentPort` and `defaultPort` now included in every local provider's IPC summary so the UI can read them without a separate call
**Files Changed:**
- `src/main/providers/localProviders.js`
- `src/main/providers/providerRegistry.js`
- `src/main/queueRouter.js`
- `src/main/multiUsageTracker.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `package.json`
- `README.md`
- `CLAUDE.md`
- `landing-page.html`
- `WORKLOG.md`

---

## Session 10 — 2026-05-23
**Goal:** Add Jan.ai as a third local provider in the free tier. Display integration sketches for LocalAI and llama.cpp (not yet integrated).
**Completed:**
- [x] Added `JanProvider` class to `src/main/providers/localProviders.js` — extends `LocalBaseProvider`, port 1337, dynamic model discovery via `/v1/models`
- [x] Added Jan default model list (8 popular models matching Jan's typical model ID format)
- [x] Registered `jan: JanProvider` in `providerRegistry.js` — PROVIDER_CLASSES and PROVIDER_META (indigo colour, ti-device-desktop icon)
- [x] Added `'jan'` to `LOCAL_PROVIDERS` and `FREE_TIER_PROVIDERS` in `queueRouter.js`
- [x] Added `'jan'` to all four `TASK_STRENGTHS` categories (coding, research, fast, general) in `queueRouter.js`
- [x] Added `'jan'` to the `fastest` mode provider order (last, same as other local providers)
- [x] Added `jan: {}` to `COST_TABLE` in `multiUsageTracker.js` (all models $0.00)
- [x] Added `jan: { rpm: 9999, rpd: null, tpm: null }` to `RATE_LIMITS` in `multiUsageTracker.js`
- [x] Updated `README.md`: provider count 9→10, Free tier 2→3 providers, Local AI table, freeTier and auto routing descriptions, version history
- [x] Bumped version `0.3.3` → `0.3.4` in `package.json`, `README.md`, and `CLAUDE.md`
**Decisions Made:**
- Jan.ai placed last in the `fastest` order (same as Ollama/LM Studio) — local inference speed is hardware-dependent, not predictably "fast"
- Jan model IDs use Jan's native format (e.g. `mistral-ins-7b-q4`) rather than generic names, since that's what Jan's API returns
**Files Changed:**
- `src/main/providers/localProviders.js`
- `src/main/providers/providerRegistry.js`
- `src/main/queueRouter.js`
- `src/main/multiUsageTracker.js`
- `package.json`
- `README.md`
- `WORKLOG.md`

---

## Session 9 — 2026-05-22
**Goal:** Documentation accuracy cleanup pass — fix stale version numbers, remove shipped features from roadmap, add missing files to project structure, verify landing page.
**Completed:**
- [x] Fixed `README.md` version line: "Current version: **0.3.0**" → "Current version: **0.3.2**"
- [x] Removed "Response comparison mode" from README roadmap table — it shipped as Compare mode in 0.3.2, no longer a future item
- [x] Added `conversationStore.js` and `licenseChecker.js` to README project structure section (both files exist in `src/main/` but were missing from the tree)
- [x] Verified `landing-page.html` — Compare mode feature card, Pro+/Consensus roadmap cards, and feature comparison table all current and accurate, no changes needed
**Decisions Made:**
- Roadmap table should only list features not yet shipped; shipped features belong in the features table and the version history table
**Files Changed:**
- `README.md`

---

## Session 8 — 2026-05-22
**Goal:** Implement Compare mode (Pro) — fan-out same prompt to multiple providers, side-by-side results. Add Consensus mode + Pro+ tier to roadmap. Update README + landing page.
**Completed:**
- [x] Added `compare_providers TEXT DEFAULT NULL` column to `queue_items` schema in `multiQueueManager.js` + silent `ALTER TABLE` migration for existing DBs
- [x] Updated `addItem()` to accept `compareProviders: string[]` — stored as JSON; validated (length ≥ 2) before persisting
- [x] Added `_processCompareItem(item)` to `MultiQueueManager` — uses `Promise.allSettled` to fan out to all selected providers in parallel; partial failures (one provider down) don't abort the rest; stores results as a JSON array `[{provider, model, response, usage, error}]` in the `response` column
- [x] Updated `_tick()` — compare items detected by `item.compare_providers` and routed to `_processCompareItem()`, bypassing the router
- [x] Added Pro license gate in `add-to-queue` IPC handler in `index-v2.js` — throws clear error if compare mode requested without Pro
- [x] Added `item-compare-complete` push event to `preload-v2.js` as `onCompareComplete`
- [x] Updated `App.jsx` — wired `onCompareComplete` toast (`⚖ "label" — N/M providers responded`); passes `license` prop to `AddPromptPanel`
- [x] Added Compare mode UI to `AddPromptPanel.jsx` — three-way mode toggle (Single / ⚖ Compare / Bulk); provider checkbox grid (configured providers only with colour dot + checkmark); Pro gate card with upgrade CTA; disabled submit until 2+ providers selected; compare submit passes `compareProviders` array to IPC
- [x] Updated `QueueSettingsProjects.jsx` — `⚖ Compare` badge in queue item meta row; expanded view renders side-by-side columns (one per provider: name, model, response text, copy button, token counts, red border on error)
- [x] Added Compare mode section to `README.md` with architecture notes
- [x] Added Compare mode to README features table
- [x] Added Pro+ tier + Consensus mode to README roadmap
- [x] Updated `landing-page.html` — new Compare mode feature card; two new roadmap cards (Pro+ tier, Consensus mode); updated compare/features table row (replaced "Roadmap" label with live ✓ for Compare; added Consensus row as Pro+)
- [x] Bumped version `0.3.1` → `0.3.2` in `package.json` and `CLAUDE.md`
**Decisions Made:**
- `Promise.allSettled` chosen over `Promise.all` — a single provider being rate-limited or erroring should never abort the whole comparison. Each provider gets its own result slot.
- Compare items bypass the router entirely — user explicitly chose the providers, no routing logic needed. `used_provider` is set to `'compare'` in the DB.
- Response stored as JSON array in the existing `response TEXT` column — no schema change to the response column needed; the UI detects compare items by checking `item.compare_providers`.
- Pro gate is enforced server-side in the IPC handler, not just in the UI — the renderer can't spoof around it.
- Conversation history not injected for compare items — fresh context keeps the comparison fair across providers.
- Compare mode is Pro; Consensus mode (synthesis/voting across compare results) is Pro+ (roadmap).
- Pro+ tier added to roadmap as a concept — details/pricing TBD, placeholder for higher-tier features.
**Problems Encountered:**
- `AddPromptPanel.jsx` style block was duplicated after inserting compare mode branch — consolidated both `<style>` blocks into one.
- `package.json` write via file tools truncates at ~2242 bytes (filesystem/mount quirk) — used Python `json.dump` via bash for safe writes going forward.
**Next Steps:**
- [ ] Run `npm run dev:win` to test: (a) Compare toggle appears in Add tab, (b) Pro gate shows for free plan, (c) selecting 2+ providers enables submit, (d) compare item appears in queue with ⚖ badge, (e) expanded view shows side-by-side columns with copy buttons
- [ ] When Pro licensing is live: ensure `license.getLicense().plan === 'pro'` returns correctly so the compare gate works in production
- [ ] Consensus mode implementation (Pro+): read the stored `results[]` JSON, feed to a meta-provider, post-process the synthesis back as a special queue item
**Files Changed:**
- `src/main/multiQueueManager.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/App.jsx`
- `src/renderer/components/AddPromptPanel.jsx`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `README.md`
- `landing-page.html`
- `package.json` (version bump to 0.3.2)
- `CLAUDE.md` (version table updated to 0.3.2)

---

## Session 7 — 2026-05-22
**Goal:** Persist conversation history to SQLite; plan cross-provider context feature; update docs
**Completed:**
- [x] Created `src/main/conversationStore.js` — new `ConversationStore` class; `conversations` table with `conv_id / provider / role / content / turn_index / created_at`; WAL-safe alongside MultiUsageTracker and MultiQueueManager in the same `ai-queue.db`
- [x] Added `loadAll(provider)` — warms BaseProvider's in-memory Map on startup (one DB hit per provider, no overhead during prompt sending)
- [x] Added `appendTurn()` — write-through on every user+assistant turn; enforces 40-message cap in SQLite with same pruning logic as in-memory cap
- [x] Added `clearConversation()` and `clearProvider()` helpers
- [x] Updated `BaseProvider`: added `attachConvStore(convStore)` method — called by ProviderRegistry after construction, warms the in-memory Map and wires write-through with zero changes to any concrete provider class
- [x] Updated `appendHistory()` — now writes to DB via `convStore.appendTurn()` in addition to in-memory Map
- [x] Updated `clearConversation()` — now deletes from DB as well as memory
- [x] Updated `ProviderRegistry` — accepts optional `convStore` 3rd param; calls `provider.attachConvStore(convStore)` for each provider
- [x] Updated `index-v2.js` — creates and opens `ConversationStore` between `tracker.open()` and `ProviderRegistry` construction; passes to registry
- [x] Added `get-conversation-history` IPC handler — `(provider, convId) → messages[]`
- [x] Exposed `getConversationHistory(provider, convId)` in `preload-v2.js`
- [x] Updated `README.md` — added persistence to features table, new "Conversation history persistence" architecture section, added cross-provider context to roadmap, updated version history
- [x] Updated `landing-page.html` — updated Projects feature card to mention SQLite persistence; added new highlighted roadmap card for cross-provider conversation context
- [x] Synced version: `package.json` and `CLAUDE.md` bumped to `0.3.1` (previous sessions had bumped README/WORKLOG to 0.3.0 but never saved package.json; now all three are in sync at 0.3.1)
**Decisions Made:**
- `attachConvStore()` pattern chosen over passing `convStore` to every provider constructor — zero changes needed in any of the 9 concrete provider classes, no risk of accidentally breaking a provider
- In-memory Map remains the read path — no DB hit during actual prompt sending. DB is write-through only. `loadAll()` runs once at startup per provider.
- Same `ai-queue.db` file used by all three stores (tracker, queue, conversations) — WAL journal mode makes concurrent writes safe
- `getConversationHistory` IPC exposed but not yet wired to a UI component — it's available for the next session when we add a history viewer or use it in the cross-provider context feature
**Problems Encountered:**
- `package.json` version was still at `0.2.0` despite WORKLOG showing it was bumped to `0.3.0` in Sessions 4 & 5 — bumped forward to `0.3.1` to account for both
**Next Steps:**
- [ ] Run `npm run dev:win` to verify: (a) conversation history loads after app restart, (b) new `conversations` table created in `ai-queue.db`, (c) `getConversationHistory` IPC works from DevTools
- [ ] Cross-provider conversation context (roadmap item): when `QueueRouter.route()` selects a different provider than the one a `convId` was started on, adapt the stored history to the new provider's message format and inject it
- [ ] Consider a conversation history viewer in the UI — the IPC is ready, just needs a component
**Files Changed:**
- `src/main/conversationStore.js` (new)
- `src/main/providers/baseProvider.js`
- `src/main/providers/providerRegistry.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `README.md`
- `landing-page.html`
- `package.json` (version bump to 0.3.1)
- `CLAUDE.md` (version table updated to 0.3.1)

---

## Session 6 — 2026-05-22
**Goal:** Fix budget system — make $0 mean "block spending" instead of "no limit"
**Completed:**
- [x] Updated `_loadBudgets()` in `multiUsageTracker.js` — now stores `null` (no limit) vs `0` (block) instead of collapsing both to `0`
- [x] Added `isBudgetBlocked(provider)` helper — returns `true` when budget is exactly `0` AND the provider has non-zero cost rates. Local providers (Ollama, LM Studio) are always exempt
- [x] Updated `getStatus()` — `canSend` now incorporates `isBudgetBlocked()` as a hard gate alongside rate-limit checks
- [x] Updated `setBudget()` — `null`/`''`/`undefined` removes the budget entry (no limit); `0` stores `"0"` (block); positive number stores the cap. Uses `DELETE` for null, `INSERT OR REPLACE` for numeric
- [x] `getBudgets()` now returns `null` for uncapped providers instead of `0`
- [x] Updated `previewCandidates()` in `queueRouter.js` — adds `budgetBlocked` field to each candidate so the UI comparison table can surface it
- [x] Updated manual-routing error in `queueRouter.js` — throws a clear message explaining that the provider is spend-blocked and how to fix it
- [x] Updated `SettingsPanel` in `QueueSettingsProjects.jsx` — loads saved budgets on mount via `api.getBudgets()` so inputs show current values
- [x] Fixed `onSaveBudget()` — blank → sends `null`, `0` → sends `0`, positive → sends number (old code always sent a number, treating blank as `0`)
- [x] Added `⛔ spend blocked` badge to the provider card header when `savedBudget === 0`
- [x] Added a red inline warning block inside the budget section when a provider is blocked
- [x] Updated budget section help text — clearly explains that `0` = block, blank = no limit, positive = cap
- [x] Updated `budgetTip` for Groq, Gemini, Mistral — removed old "leave at $0" wording that now means "block spending"
**Decisions Made:**
- Three distinct budget states: `null` (no limit), `0` (block spending), positive number (monthly cap). Previously only two states existed (0 and positive), where 0 meant "no limit".
- Local providers (Ollama, LM Studio) are exempt from the $0 block because their per-token cost rates are always $0 — blocking them by budget makes no conceptual sense.
- The `canSend` field on `getStatus()` is the single source of truth — both the router's `_getCandidates()` filter and `previewCandidates()` already checked `canSend`, so the budget block automatically propagates everywhere.
- Existing users who had `budget.groq = "0"` stored in DB (meaning "no limit" under the old system) will now have Groq blocked after this update. This is a deliberate behavioral change — the old semantics were confusing and the user explicitly identified this as a bug.
**Problems Encountered:**
- None
**Next Steps:**
- [ ] Run `npm run dev:win` to verify: (a) $0 budget shows the ⛔ badge, (b) the provider is blocked from receiving prompts, (c) blank clears the limit, (d) local providers ignore the block
**Files Changed:**
- `src/main/multiUsageTracker.js`
- `src/main/queueRouter.js`
- `src/renderer/components/QueueSettingsProjects.jsx`

---

## Session 5 — 2026-05-22
**Goal:** Prompt type tag chips + tag-driven queue priority system
**Completed:**
- [x] Defined `TAG_PRIORITY` (free/paid weight tables) and `computePriority()` in `multiQueueManager.js`
- [x] Added `TAG_TO_TASK_TYPE` map and `tagsToTaskType()` helper — derives router task_type from selected tags
- [x] Added `tags TEXT DEFAULT '[]'` column to `queue_items` schema + silent `ALTER TABLE` migration for existing DBs
- [x] Updated `addItem()` to accept `tags` (stored as JSON) and `priority` (passed from IPC layer)
- [x] Extended `add-to-queue` IPC handler: extracts tags, checks `license.getLicense().plan`, calls `computePriority()`, derives `taskType` — renderer cannot spoof priority values
- [x] Added `get-prompt-tags` IPC handler returning display config (emoji, color, label) without priority weights
- [x] Added `getPromptTags` to `preload-v2.js`
- [x] Replaced task-type dropdown in `AddPromptPanel.jsx` with 9-chip visual tag grid (💬 Chat · 🔬 Research · 💻 Code · 🌐 Web Search · ✍️ Writing · 📊 Analysis · 🖼️ Image · 🌍 Translate · ⚡ Urgent)
- [x] Tags are multi-select; first content tag drives routing, Urgent is a priority-only modifier
- [x] `taskType` is now a `useMemo` derived value — no longer a form field
- [x] Tag chips render with per-tag accent color when active (CSS custom property `--chip-color` + `color-mix()`)
- [x] Added inline tag badge display on queue items in `QueueSettingsProjects.jsx` (parses JSON from DB)
- [x] Priority indicator (`↑ pri N`) shown on queue items with non-zero priority
- [x] Bumped version `0.2.0` → `0.3.0`
**Decisions Made:**
- Priority weights are intentionally server-side only — renderer sends `tags[]`, main process computes `priority`. Prevents UI manipulation of queue order.
- Free tier: only ⚡ Urgent boosts priority (+10). Paid tier: all tags add weight (Research/Code +8, Web Search/Analysis +6, Image +5, Writing +4, Chat/Translate +2, Urgent +20). Clear paid-tier value prop.
- `tagsToTaskType()` defined in both `multiQueueManager.js` (main) and `AddPromptPanel.jsx` (renderer) independently — avoids circular deps; tag IDs are the contract between them.
- `color-mix()` CSS function used for chip tinting — supported in Chromium 111+, Electron 36 uses Chromium 136 ✓
**Problems Encountered:**
- `license.isActive()` doesn't exist on `LicenseChecker` — caught during verification and corrected to `license.getLicense().plan === 'pro'`
**Next Steps:**
- [ ] Run `npm run dev:win` to visually test tag chips and priority badges
- [ ] When monetizing: the free/paid priority split is already wired — just ensure `LicenseChecker.setKey()` validates real keys and returns `plan: 'pro'`
- [ ] Consider adding a "priority preview" to the route-preview area showing estimated queue position
**Files Changed:**
- `src/main/multiQueueManager.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/AddPromptPanel.jsx`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `package.json` (version bump to 0.3.0)
- `CLAUDE.md` (version table)

---

## Session 4 — 2026-05-22
**Goal:** Live token estimation + per-provider cost comparison table before queuing
**Completed:**
- [x] Added public `estimateCost(provider, model, inputTokens, outputTokens)` method to `MultiUsageTracker` — delegates to the existing private `_estimateCost()`
- [x] Added `previewCandidates(item)` public method to `QueueRouter` — returns ALL configured providers (including rate-limited ones) ranked by score, with `bestModel`, `inputRate`, `outputRate`, `canSend`, `waitMs`
- [x] Extended `preview-route` IPC handler in `index-v2.js`: now computes `inputTokens = ceil(prompt.length / 4)`, calls `previewCandidates()`, attaches `estimatedCost` per provider via `tracker.estimateCost()`, returns `{ winner, candidates[], inputTokens, outputTokens }`
- [x] Added `maxTokens` to the `previewRoute()` IPC call from the renderer so output cost estimate reflects the user's actual max-tokens setting
- [x] Added live token counter in `AddPromptPanel.jsx`: `~N tokens in · N max out` shown in the prompt label row (instant, pure `useMemo`, no debounce or IPC)
- [x] Replaced single-line route-preview banner with a full provider comparison table: Provider · Best model · Est. cost · Status (Ready / ⏳ Xs)
- [x] Winner row highlighted with green left border and subtle green tint
- [x] `fmtCost()` helper formats costs intelligently ($0.00 → < $0.000001 → $0.000123 → $0.0023 etc.)
- [x] Local/free providers show "Free" in green instead of a dollar amount
**Decisions Made:**
- Token estimate uses `charCount / 4` (±15% for English) — accurate enough for cost preview without requiring a tokenizer npm package
- `previewCandidates()` is separate from `route()` so the actual routing logic is never affected by preview calls
- Cost is estimated against the cheapest available model per provider, not the default — shows best-case cost
**Problems Encountered:**
- None
**Next Steps:**
- [ ] Run `npm run dev:win` to verify comparison table renders and updates live
**Files Changed:**
- `src/main/multiUsageTracker.js`
- `src/main/queueRouter.js`
- `src/main/index-v2.js`
- `src/renderer/components/AddPromptPanel.jsx`

---

## Session 3 — 2026-05-22
**Goal:** Add licensing skeleton (feature flags, free/pro plans, LicensePanel UI)
**Completed:**
- [x] Created `src/main/licenseChecker.js` — LicenseChecker class, FREE_FLAGS/PRO_FLAGS, getLicense/setKey/removeKey
- [x] Wired LicenseChecker into `index-v2.js` startup + 3 IPC handlers (get-license, set-license-key, remove-license-key)
- [x] Exposed 3 new calls in `preload-v2.js` (getLicense, setLicenseKey, removeLicenseKey)
- [x] Created `src/renderer/components/LicensePanel.jsx` — plan badge, feature comparison table, key input, upgrade CTA
- [x] Exported LicensePanel from `components/index.js`
- [x] Added 'License' tab (◈) to NAV in `App.jsx`, license state loaded on startup
- [x] Bumped version 0.1.42 → 0.1.43
**Decisions Made:**
- All feature flags are TRUE for now (preview mode) — nothing is gated yet, app behavior unchanged
- Stored key = pro plan (stub). Real LemonSqueezy validation marked with TODO comments
- License tab added to nav; upgrade URL is a placeholder (example.com/upgrade)
**Problems Encountered:**
- None
**Next Steps:**
- [ ] Run `npm run dev:win` to verify License tab renders correctly
- [ ] When ready to monetize: set up LemonSqueezy store, replace stub in licenseChecker.setKey(), tighten FREE_FLAGS
- [ ] Optionally: add `license` prop to components that will enforce limits (e.g., AddPromptPanel queue cap)
**Files Changed:**
- `src/main/licenseChecker.js` (new)
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/LicensePanel.jsx` (new)
- `src/renderer/components/index.js`
- `src/renderer/App.jsx`
- `package.json` (version bump)
- `CLAUDE.md` (version table)

---

## Session Template (copy for each session)
### [Date] — Session [#]
**Goal:** [What I wanted to accomplish]
**Completed:**
- [ ] Task 1
- [ ] Task 2
**Decisions Made:**
- [Why I chose X over Y]
**Problems Encountered:**
- [What went wrong]
**Next Steps:**
- [ ] [What to do next session]
**Files Changed:**
- [List modified files]

---

## Session 2 — 2026-05-21
**Goal:** Neon Glassmorphic UI redesign + custom title bar
**Completed:**
- [x] Updated `BrowserWindow` config: `frame: false` on Windows, `titleBarStyle: 'hiddenInset'` on macOS
- [x] Added window control IPC handlers (minimize/maximize/close) in `index-v2.js`
- [x] Exposed `windowMinimize`, `windowMaximize`, `windowClose` via `preload-v2.js`
- [x] Created `src/renderer/components/TitleBar.jsx` — draggable, cross-platform
- [x] Updated `App.jsx`: wrapped in `app-root`, added `<TitleBar>`, removed old `sidebar-brand`
- [x] Full `App.css` redesign: neon purple/green palette, glass cards, glow effects, dot-grid background
- [x] Bumped version 0.1.40 → 0.1.41
**Decisions Made:**
- Kept solid dark background (no OS transparency) — user preference; glass effect applied only to cards via `backdrop-filter`
- macOS uses native traffic lights (`hiddenInset` + `trafficLightPosition`); Windows uses custom React buttons
- Removed sidebar brand section (redundant with title bar)
**Problems Encountered:**
- None
**Next Steps:**
- [ ] Run `npm run dev:win` to test the UI visually
- [ ] Optionally refine individual panel components (UsageDashboard cards, progress bars) to use neon green fills
**Files Changed:**
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/TitleBar.jsx` (new)
- `src/renderer/components/index.js`
- `src/renderer/App.jsx`
- `src/renderer/App.css`
- `package.json` (version bump)
- `CLAUDE.md` (version table)

---

## Session 1 — [Date]
**Goal:** Initial project setup
...