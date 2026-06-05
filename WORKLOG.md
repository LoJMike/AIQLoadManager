# Work Log — AI Queue Load Manager

## Session 22 — 2026-06-05
**Goal:** Implement v0.6.0 — Phase 1 providers, Agent Gateway, live LS licensing enforcement, tighten feature flags.

**Completed:**
- [x] **Lemon Squeezy variant map bug fixed** — `LS_VARIANT_PLAN_MAP` had two duplicate `0:` keys (`pro_plus` and `team`), which JS silently collapsed. Replaced with commented-out placeholders. Starter (1735713) and Pro (1735683) variant IDs confirmed live.
- [x] **FREE_FLAGS tightened** — now reflects actual free tier limits: `maxProviders:5`, `maxQueueDepth:10`, `maxProjects:1`, `routingModes:['manual','freeTier']`, `compareMode:false`, `digestExport:false`, `monthlyCloudPrompts:50`, `monthlyCloudTokens:100_000`. All higher tiers unchanged.
- [x] **Routing mode gate** — `add-to-queue` IPC handler now checks `lic.flags.routingModes` and throws a clear upgrade error if the requested mode is not in the plan's allowed list.
- [x] **Queue depth gate** — already existed; confirmed correct.
- [x] **`agentGateway` flag** added to all 5 tier flag sets (Starter+ = true) and to `FLAG_LABELS`.
- [x] **5 Phase 1 providers added to `openaiCompatProviders.js`**: `FireworksProvider`, `TogetherProvider`, `MiniMaxProvider`, `CerebasProvider`, `CohereProvider`. All use the existing `sendViaOpenAICompat` shared function — no extra npm packages.
- [x] **Providers registered** in `providerRegistry.js` (PROVIDER_CLASSES + PROVIDER_META, 5 new entries each).
- [x] **COST_TABLE + RATE_LIMITS** updated in `multiUsageTracker.js` for all 5 new providers.
- [x] **Routing updated** in `queueRouter.js`: Cerebras + Fireworks added to `fastest` order (Cerebras leads); Cerebras + Cohere added to `FREE_TIER_PROVIDERS`; all 5 new providers added to relevant `TASK_STRENGTHS` lists.
- [x] **Agent Gateway** (`src/main/agentGateway.js`) — new file: OpenAI-compatible HTTP server on `localhost:8787/v1`. Endpoints: `GET /v1/models` (returns all configured providers/models), `POST /v1/chat/completions` (routes through QueueRouter → ProviderRegistry). Model field accepts routing mode names (`auto`, `fastest`, etc.) or `provider/model` strings. AIQ extension fields (`x_aiq_provider`, `x_aiq_routing_mode`) appended to every response.
- [x] **Gateway wired into `index-v2.js`**: imported, instantiated, auto-started on app launch if `agentGateway.enabled = true` + Starter license; stopped on `before-quit`.
- [x] **Gateway IPC handlers** added to `index-v2.js`: `get-gateway-status`, `start-gateway`, `stop-gateway`.
- [x] **Gateway IPC exposed** in `preload-v2.js`: `getGatewayStatus`, `startGateway`, `stopGateway`.
- [x] **Version bumped 0.5.0 → 0.6.0** in `package.json` and `CLAUDE.md`.
- [x] Updated `CHANGELOG.md` with v0.6.0 entry.
- [x] Confirmed retry count badge already exists in `QueueSettingsProjects.jsx` (lines 194–203). ✓
- [x] Confirmed LS `validateStoredKey()` called on app startup. ✓
- [x] Confirmed PostHog initialized with correct key and events tracked. ✓

**Decisions Made:**
- Agent Gateway is Starter+ — free tier users can't use it (enforced by `agentGateway` flag in licenseChecker).
- Gateway binds to `127.0.0.1` only (not `0.0.0.0`) — local access only, never exposed to the network.
- Streaming (`stream: true`) is not yet supported by the gateway — returns a clear 400 error rather than silently ignoring the flag.
- `CerebasProvider` leads the `fastest` routing order ahead of Groq — Cerebras wafer-scale chip achieves ~2,000 tokens/sec on Llama 70B.
- Duplicate LS variant key `0` for Pro+/Team was only a JS-level bug (silent overwrite); no data was corrupted. Pro+ and Team products don't exist yet so no functional impact.

**Next Steps:**
- [ ] Run `npm run dev:win` and test all new providers (enter API keys in Settings → Connectors)
- [ ] Test Agent Gateway: enable in Settings, run `curl http://localhost:8787/v1/models`, send a test completion
- [ ] Test LS license flow: enter a real Starter key, verify `getLicense().plan === 'starter'`, verify feature flags match
- [ ] Verify PostHog events appear in PostHog Live Events dashboard
- [ ] Add Agent Gateway UI toggle to Settings panel (QueueSettingsProjects.jsx)
- [ ] Add Pro+ variant ID to LS_VARIANT_PLAN_MAP once Pro+ product is created in LS Dashboard

**Files Changed:**
- `src/main/licenseChecker.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/main/agentGateway.js` *(new)*
- `src/main/providers/openaiCompatProviders.js`
- `src/main/providers/providerRegistry.js`
- `src/main/multiUsageTracker.js`
- `src/main/queueRouter.js`
- `package.json`
- `CLAUDE.md`
- `CHANGELOG.md`
- `WORKLOG.md`

---

## Session 21 — 2026-05-27
**Goal:** Migrate payment processor from Lemon Squeezy to Paddle after LS merchant application was rejected. Update all project files and policy pages.

**Completed:**
- [x] **Received Lemon Squeezy rejection** — LS declined the merchant application, citing our BYOK AI routing model as AI resale. Framing: AIQ routes prompts to users' own API accounts; no AI usage passes through our servers; no usage-based pricing. LS's automated review flagged it anyway.
- [x] **Selected Paddle as replacement MoR** — Paddle accepts desktop software/utility tools; BYOK model is well within their terms; similar fee structure (5% + $0.50 on the Paddle Billing entry plan).
- [x] **Drafted Paddle merchant application** (`Paddle_Merchant_Application.docx`) — 8-section Word document positioning AIQ as desktop software with BYOK model; includes comparison table (no AI resale, no usage-based pricing, local-only data flow); stored in project root.
- [x] **Created standalone policy pages** in `docs/` (GitHub Pages):
  - `privacy.html` — dark-themed, conxion visual communications entity, Paddle as payment processor
  - `terms.html` — dark-themed, NC governing law, Randolph County jurisdiction, Paddle as payment processor
  - `refund.html` — dark-themed, 14-day money-back guarantee, Paddle billing portal for cancellations
- [x] **Updated `docs/index.html`** — replaced modal popup links in footer with direct hrefs to privacy.html, terms.html, refund.html; removed all modal CSS, HTML, and JS
- [x] **Set up GitHub Pages** — renamed `website/` → `docs/`; configured GitHub Pages to serve from `/docs` on `main` branch
- [x] **Updated all project markdown files** — replaced all Lemon Squeezy references with Paddle equivalents in README.md, CLAUDE.md, CODE_REVIEW.md, planning_docs/prompts.md, WORKLOG.md; left Session 13 as historical record with explanatory note

**Decisions Made:**
- Paddle chosen over Gumroad (higher fees), FastSpring (complex onboarding), and self-hosting Stripe (no MoR — tax burden falls on us)
- Policy pages styled to match index.html dark theme with logo — Paddle requires real URLs, not modal popups
- Session 13 preserved as historical record rather than rewritten — context matters for understanding why the migration happened
- GitHub Pages serves from `/docs` on `main` — simplest setup, no separate `gh-pages` branch needed

**Next Steps:**
- [ ] Submit Paddle merchant application
- [ ] After approval: create 4 products in Paddle (Starter/Pro/Pro+/Team monthly subscriptions) with License Keys enabled
- [ ] Replace `CHECKOUT_URLS` placeholder strings in `docs/index.html` with real Paddle checkout links
- [ ] Replace the Lemon.js `<script>` tag in `docs/index.html` `<head>` with Paddle.js equivalent
- [ ] Replace the stub in `src/main/licenseChecker.js` with real Paddle License API validation call
- [ ] Set up Paddle → Zapier → PostHog webhook for `purchase_completed` analytics event
- [ ] Test full checkout flow in Paddle sandbox before going live

**Files Changed:**
- `docs/index.html`
- `docs/privacy.html` *(new)*
- `docs/terms.html` *(new)*
- `docs/refund.html` *(new)*
- `Paddle_Merchant_Application.docx` *(new)*
- `README.md`
- `CLAUDE.md`
- `CODE_REVIEW.md`
- `planning_docs/prompts.md`
- `WORKLOG.md`

---

## Session 20 — 2026-05-25
**Goal:** Fix dropdown menus being hidden behind cards; bump to v0.5.0 as our testing release; update CHANGELOG, WORKLOG, and README.

**Completed:**
- [x] **Dropdown z-index stacking fix** — Custom dropdown menus (e.g. Routing Mode selector in the Add Prompt panel) were being obscured by `.card` elements that came after them in the DOM. Root cause: `backdrop-filter: blur(10px)` on `.card` creates a CSS stacking context, confining the dropdown's `z-index: 200` to that card's layer. The next card (also z-index: 1) would then paint on top. Fix: added a single CSS rule to `App.css` using the `:has()` pseudo-class — `.card:has(.routing-select-menu) { z-index: 10; }` — which automatically elevates a card's stacking context the moment it contains an open dropdown menu. The dropdown div only exists in the DOM while open (React conditional render), so `:has()` fires exactly when needed. No JavaScript changes.
- [x] **Bumped version 0.4.0 → 0.5.0** in `package.json` and `CLAUDE.md`.
- [x] Updated `CHANGELOG.md`, `WORKLOG.md`, and `README.md`.

**Decisions Made:**
- v0.5.0 designated as our testing release milestone — no new features, just the dropdown fix and version housekeeping.
- CSS `:has()` chosen over JavaScript portal rendering or fixed positioning — far simpler, zero risk of layout side-effects, supported in Chromium 105+ (Electron uses Chromium 134+).

**Next Steps:**
- [ ] Run `npm run dev:win` and confirm the Routing Mode dropdown opens cleanly above the cards below it.
- [ ] Begin testing pass against all features before public release.
- [ ] Add date-range / project filter controls to Export Digest dialog.
- [ ] Show retry count badge on queue items in QueuePanel UI.

**Files Changed:**
- `src/renderer/App.css`
- `package.json`
- `CLAUDE.md`
- `CHANGELOG.md`
- `README.md`
- `WORKLOG.md`

---

## Session 19 — 2026-05-25
**Goal:** Add a dedicated Support tab to the left navigation, move the bug-report action there, and remove the Report button from the nav footer.

**Completed:**
- [x] **SupportPanel.jsx** — new component with four sections: Product Homepage (link to https://www.conxion.biz/aiqloadmanager/), How AIQ Load Manager Works (app overview with per-tab description), Report a Bug / Request a Feature (bug-report button with version+OS pre-filled, feature-request button), GitHub Discussions link.
- [x] **NavIcons.jsx** — added `support` icon (info circle with exclamation dot).
- [x] **App.jsx** — added `{ id: 'support', label: 'Support' }` to `NAV` array; imported and wired up `SupportPanel`; removed the `report-btn` block from the sidebar footer entirely.
- [x] **components/index.js** — exported `SupportPanel`.
- [x] **README.md** — added Support tab row to the Features table.
- [x] **WORKLOG.md** — this entry.

**Decisions Made:**
- Support tab placed at the bottom of the NAV list (after License) so it doesn't interrupt the main workflow tabs.
- Bug-report logic moved wholesale into SupportPanel; the sidebar footer now only shows Pause/Resume, provider dots — cleaner and less cluttered.
- Feature-request button added alongside the bug-report button since both live on GitHub Issues.

**Next Steps:**
- [ ] Add date-range / project filter controls to Export Digest dialog
- [ ] Show retry count badge on queue items in QueuePanel UI
- [ ] Document context injection — implement for Pro tier when ready (roadmap)
- [ ] Email digest — implement for Pro+ when ready (roadmap)

**Files Changed:**
- `src/renderer/components/SupportPanel.jsx` *(new)*
- `src/renderer/components/NavIcons.jsx`
- `src/renderer/components/index.js`
- `src/renderer/App.jsx`
- `README.md`
- `WORKLOG.md`

---

## Session 18 — 2026-05-25
**Goal:** Implement 4 new features (response style presets, per-provider default model, project history, digest export) and add 2 roadmap items (document context injection, email digest).

**Completed:**
- [x] **Feature 1 — Per-provider response style presets (all tiers):** Added 6 preset options per provider — Normal, Concise, Caveman, Bullet-only, ELI5, Custom. Style text is appended to the system prompt after standing instructions so user instructions still take precedence. `PRESET_TEXTS` map in `index-v2.js`; `computeStyleText()` helper; `providerStyles` property + `setProviderStyles()` in `MultiQueueManager`; style injected in `_processItem` after standing instructions; `responseStyle.*` persisted in `electron-store`, hot-loaded on startup. IPC handlers: `get-provider-styles` / `set-provider-style`. UI: Response Style section added to both local and cloud provider cards in Settings (preset buttons + custom textarea + Save button). Available on all tiers — no gate.
- [x] **Feature 2 — Document context injection (roadmap, Pro+):** Added to roadmap only. Not implemented. Marked in README and landing-page as a Pro-tier roadmap item.
- [x] **Feature 3 — Per-provider default model (Pro+ only):** `BaseProvider` gained `_customDefaultModel` property and `setDefaultModel()` method. `ProviderRegistry` gained `setDefaultModel(name, model)`, `getDefaultModels()`, and modified `sendMessage()` to resolve `opts.model → provider._customDefaultModel → null` in that order. `defaultModel` added to `getProviderSummaries()` and `getProviderSummary()`. Persisted in `electron-store` (`defaultModels.*`), hot-loaded on startup. IPC: `get-default-models` / `set-default-model` (license-gated to `modelControl` flag, Pro+). UI: Default Model dropdown in cloud provider cards — gated behind `licenseFlags.modelControl`; shows upgrade prompt on Free/Starter.
- [x] **Feature 4 — Per-project response history (all tiers):** `MultiQueueManager.getProjectHistory(projectId)` queries completed items for a project newest-first. IPC handler `get-project-history`. UI: "View history / Hide history" toggle button on each project card in ProjectsPanel; loads and displays response items lazily with provider/model/timestamp/snippet/tokens. Available on all tiers.
- [x] **Feature 5 — Digest file export (Starter+):** `MultiQueueManager.getQueueForExport({ since, until, projectId })` returns completed items with optional date/project filters. `generateDigestHtml()` helper in `index-v2.js` produces a styled dark-theme HTML report with summary stats (count, tokens, cost) and collapsible prompt/response sections; handles compare-mode JSON responses. `export-digest` IPC handler: license-gates to `digestExport` flag (Starter+), calls `dialog.showSaveDialog`, `fs.writeFileSync`, `shell.openPath`. Exposed in preload. UI: "Export Digest" button in QueuePanel header (hidden on Free tier), calls `exportDigest({})` and opens native save dialog.
- [x] **Feature 5 roadmap — Email digest (roadmap, Pro+):** Added to roadmap in README and landing-page.
- [x] **licenseChecker.js** — Added `modelControl`, `digestExport`, `responseStylePresets`, `projectHistory` flags to all 5 tier flag sets (FREE, STARTER, PRO, PRO_PLUS, TEAM) and to `FLAG_LABELS`.
- [x] Updated `README.md`, `landing-page.html`, `WORKLOG.md`

**Decisions Made:**
- Style text appended AFTER user system prompt (not prepended) — user instructions always win; style is a modifier.
- Default model resolution: `opts.model → _customDefaultModel → null` — explicit per-item selection always overrides the default.
- Default model set via `ProviderRegistry.sendMessage()` injection rather than modifying all 5+ concrete provider classes.
- Digest export uses `dialog.showSaveDialog` + `fs.writeFileSync` + `shell.openPath` — no extra npm packages.
- Project history loaded lazily (on button click), not on panel mount — avoids expensive queries for users with large histories.
- Compare-mode JSON responses rendered in both digest and history view as per-provider blocks.

**Next Steps:**
- [ ] Add date-range / project filter controls to Export Digest dialog (currently exports all completed items)
- [ ] Show retry count badge on queue items in QueuePanel UI
- [ ] Document context injection — implement for Pro tier when ready (roadmap)
- [ ] Email digest — implement for Pro+ when ready (roadmap)

**Files Changed:**
- `src/main/licenseChecker.js`
- `src/main/multiQueueManager.js`
- `src/main/providers/baseProvider.js`
- `src/main/providers/providerRegistry.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/App.jsx`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `README.md`
- `landing-page.html`
- `WORKLOG.md`

---

## Session 17 — 2026-05-24
**Goal:** Implement auto-retry on transient failures, global standing instructions, and local-provider setup guide links. Update README.md and landing-page.html to reflect new features.
**Completed:**
- [x] **Auto-retry** — added `retry_count` and `max_retries` columns to `queue_items` (schema + silent migrations for existing DBs). Added `_isRetryable(err)` classifier in `MultiQueueManager` that returns `true` for network errors, timeouts, and 5xx responses and `false` for auth failures, budget blocks, and "not configured" errors. In `_processItem` catch block, retryable failures now reset to `pending` with incremented `retry_count` (up to 3) instead of going straight to `error`. Manual `retryItem()` now also resets `retry_count` to 0 so the counter is fresh. Queue push event for auto-retry is `retry-auto` with `attempt`/`maxRetries` payload.
- [x] **Standing instructions** — `MultiQueueManager` gained `standingInstructions` property and `setStandingInstructions(text)` method. In `_processItem`, standing instructions are prepended to the final system prompt (before per-item system prompt). `index-v2.js` loads persisted instructions from `electron-store` on startup and calls `queue.setStandingInstructions()`. IPC handlers `get-standing-instructions` / `set-standing-instructions` added. Exposed in `preload-v2.js` contextBridge. UI added to `QueueSettingsProjects.jsx` SettingsPanel as a new "Standing Instructions" section with a textarea, Save/Clear buttons, character count, and an active-state indicator.
- [x] **Local provider setup guide links** — added `setupGuideLink` field to all 5 local providers in `PROVIDER_GUIDE` (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp). Added a second "Setup guide ↗" ghost button in the card header `sc-links` section for local providers (alongside the existing download link).
- [x] Updated `README.md` — new rows in Features table, dedicated "Auto-retry on failure" and "Standing instructions" sections with full documentation, updated local AI providers section noting setup guide links.
- [x] Updated `landing-page.html` — two new feature cards (🔁 Auto-retry, 📋 Standing instructions), two new rows in the full feature compare table (both marked ✓ across all tiers).
**Decisions Made:**
- Retryable vs. non-retryable split on HTTP status and error message pattern — no hard dependency on provider-specific error classes, so the logic works across all 12 providers without per-provider changes.
- Standing instructions stored in `electron-store` (not SQLite) so they survive app restarts and are available before the queue DB is opened; `queue.setStandingInstructions()` is called immediately on startup to hot-load the saved value.
- Setup guide links use official provider docs rather than third-party tutorials — less likely to go stale.
- No version bump for this session — these are additive features with no breaking changes. Version bump to happen when a more significant milestone is reached or on next release.
**Next Steps:**
- [ ] Show retry count in Queue panel UI (e.g., "Retry 2/3" badge on the item)
- [ ] Consider per-project standing instructions as a future enhancement (override global for a specific project)
- [ ] Create Pro+ product in Paddle when ready to launch
**Files Changed:**
- `src/main/multiQueueManager.js`
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `README.md`
- `landing-page.html`
- `WORKLOG.md`

---

## Session 16 — 2026-05-24
**Goal:** Add Pro+ tier (coming soon) across all files — app, README.md, landing-page.html. Bump to v0.4.0.
**Completed:**
- [x] Defined Pro+ tier: $34/mo, 10,000 cloud prompts/month, 20M tokens/month, unlimited queue depth, Consensus mode (Roadmap), priority email support — all Pro features included
- [x] Raised Team tier from $39 → $49/user/mo; increased Team limits to 25,000 prompts / 60M tokens pooled to maintain a clear step up from Pro+
- [x] Added `PRO_PLUS_FLAGS` to `licenseChecker.js`; updated `getLicense()`, `setKey()`, and `module.exports` to handle `'pro_plus'` plan type; added `consensusMode` and `prioritySupport` flag labels
- [x] Updated `LicensePanel.jsx` — Pro+ in `PLAN_META` (amber #f59e0b), `PRICING`, `FEATURE_ROWS` (new Consensus mode, Priority support rows with pro_plus column), plan cards loop, comparison table headers (5 columns), `planColClass()`, and upgrade CTA buttons
- [x] Updated `README.md` — 5-tier pricing table (Free/Starter/Pro/Pro+/Team), roadmap table (collapsed Pro+ placeholder + separate queue depth rows into a single Consensus mode row), Purchasing & Licensing products table, CHECKOUT_URLS example
- [x] Updated `landing-page.html` — Pro+ pricing card (amber, COMING SOON badge) inserted between Pro and Team; Pro+ column added to full feature compare table (all sections); roadmap card updated from "Increased queue depth" to "Pro+ tier"; CHECKOUT_URLS block extended with `pro_plus` placeholder; top comment block updated
- [x] Bumped version 0.3.7 → 0.4.0 in `package.json` and `CLAUDE.md`
- [x] Added `## [0.4.0]` entry to `CHANGELOG.md`
**Decisions Made:**
- Pro+ at $34/mo fills the gap between Pro ($19) and Team ($49/user × 5 seats min = $245+); gives solo power users a path that doesn't force them into team overhead
- Team raised to $49 to make the collaboration premium clear and prevent "Team solo" confusion with Pro+
- Pro+ is "Coming soon" — no checkout URL yet; waitlist CTA links to FAQ for now
- Consensus mode is the headline Pro+ feature (ships with the tier); it's why Pro+ exists as a distinct tier rather than just bumped limits
- `consensusMode` and `prioritySupport` added as explicit flags in licenseChecker.js so feature gates can be wired without further schema changes
**Next Steps:**
- [ ] Create Pro+ product in Paddle when ready to launch (same flow as Starter/Pro)
- [ ] Wire `consensusMode` flag to the Compare mode result panel once Consensus mode implementation begins
- [ ] Add waitlist email capture for Pro+ (e.g. a Mailchimp embed or Paddle post-purchase webhook)
**Files Changed:**
- `src/main/licenseChecker.js`
- `src/renderer/components/LicensePanel.jsx`
- `README.md`
- `landing-page.html`
- `CHANGELOG.md`
- `CLAUDE.md`
- `package.json`
- `WORKLOG.md`

---

## Session 15 — 2026-05-24
**Goal:** Integrate PostHog analytics into the Electron app (main process) and landing page; add anonymous usage analytics with opt-out toggle in Settings; update all privacy claims across the app and marketing copy.
**Completed:**
- [x] Installed `posthog-node` SDK (user must run `npm install posthog-node` in project folder)
- [x] Added PostHog init to `src/main/index-v2.js`: anonymous device ID via `crypto.randomUUID()` stored in `electron-store`, `flushAt: 1` / `flushInterval: 0` for immediate send on desktop, `posthog.shutdown()` on `before-quit`
- [x] Added `track()` helper function in main process — checks `analytics.enabled` store flag before every call; never crashes the app (try/catch)
- [x] Wired 3 tracking events: `app_launched` (with plan), `provider_configured` (with provider name), `prompt_queued` (with routing_mode, tag_count, is_compare, is_urgent)
- [x] Added `get-analytics-enabled` / `set-analytics-enabled` IPC handlers in `index-v2.js`
- [x] Exposed `getAnalyticsEnabled` / `setAnalyticsEnabled` in `preload-v2.js` via contextBridge
- [x] Added Analytics toggle UI to `QueueSettingsProjects.jsx` SettingsPanel — shows current state, calls IPC on toggle, shows toast confirmation
- [x] Added PostHog JS browser snippet to `landing-page.html` `<head>` — auto-captures pageviews, sessions, referrers, geography; `person_profiles: 'identified_only'` (no anonymous profiles created)
- [x] Added `buy_button_clicked` custom event to landing page checkout buttons (captures plan + billing_type)
- [x] Updated all privacy claims: "No telemetry or analytics" → "Anonymous usage analytics — opt out any time in Settings" in landing-page.html feature card, compare table, FAQ, and README.md pricing/features tables
- [x] Added PostHog row to tech stack table in `CLAUDE.md`
- [x] Added anonymous analytics rows to README.md Pricing Tiers and Features tables
**Decisions Made:**
- PostHog chosen over Mixpanel/Amplitude: generous free tier (1M events/mo), combined web + app analytics, built-in Surveys for in-app NPS, EU/US hosting options, open source
- Main process only — renderer never touches PostHog directly; opt-out preference flows through IPC
- `person_profiles: 'identified_only'` on landing page — no anonymous visitor profiles, only PostHog Web Analytics aggregates
- In-app bug/suggestion tracking stays on GitHub Issues for now; PostHog Surveys earmarked for NPS and feature voting (free tier)
- `purchase_completed` event deferred: will use Zapier/Make to forward Paddle webhook to PostHog (no server required)
**Next Steps:**
- [ ] **REQUIRED before next dev run:** `cd "C:\Users\mikel\Desktop\AIQLoadManager Project" && npm install posthog-node`
- [ ] Verify events appear in PostHog Live Events dashboard after `npm run dev:win`
- [ ] Set up Paddle → Zapier → PostHog webhook for `purchase_completed` event
- [ ] Add PostHog Surveys for in-app NPS and feature request collection
- [ ] Continue Paddle setup (paste real checkout URLs, real license validation)
**Files Changed:**
- `src/main/index-v2.js`
- `src/main/preload-v2.js`
- `src/renderer/components/QueueSettingsProjects.jsx`
- `landing-page.html`
- `README.md`
- `CLAUDE.md`
- `WORKLOG.md`

---

## Session 14 — 2026-05-24
**Goal:** Add a built-in "Report a Bug" button to the app sidebar; add Option 3 (diagnostic auto-attach) to the roadmap; update README.md, landing-page.html, and WORKLOG.md.
**Completed:**
- [x] Confirmed `open-external` IPC handler already existed in `index-v2.js` (line 160) and `preload-v2.js` (line 60) — no main-process changes needed
- [x] Added `🐛 Report a Bug` button to `.sidebar-footer` in `App.jsx` — click handler builds a pre-filled GitHub issue URL with version (0.3.7) and OS (detected via `navigator.platform`) and calls `api.openExternal()` to open it in the user's browser; labels the issue `bug` automatically
- [x] Added `.report-btn` CSS to `App.css` — subtle muted style (transparent bg, dim border) with a soft red hover state to distinguish from the Pause button
- [x] Updated `README.md` — added `## Bug reports & feature requests` section documenting the sidebar button and manual feature request flow; added "In-app diagnostic bug reports" row to the Roadmap table; bumped version to 0.3.7
- [x] Updated `landing-page.html` — added new `🐛 Built-in bug reporting` feature card to the features grid
- [x] Bumped version to 0.3.7 in `README.md` version table (package.json and CLAUDE.md version bump deferred — no code-breaking change)
**Decisions Made:**
- Button placed in sidebar footer (below provider dots) — always visible regardless of which tab is active, consistent with the Pause button pattern
- URL pre-fills: issue title prefix `Bug: `, body template with Version/OS/What happened/Steps/Expected sections, and `labels=bug` query param — browser opens GitHub's new-issue form with everything ready; user just fills in the blanks
- OS detected client-side via `navigator.platform` (no extra IPC round-trip needed)
- Option 3 (auto-attach diagnostics: error log, provider config, queue state) recorded in roadmap but not implemented yet — requires a structured error log on the main process side first
**Next Steps:**
- [ ] Bump version in `package.json` and `CLAUDE.md` when next meaningful change lands (can batch with next feature)
- [ ] Build a structured error log in the main process (prerequisite for Option 3 / diagnostic auto-attach)
- [ ] Implement Option 3: upgrade the Report a Bug button to collect and pre-fill diagnostics automatically
- [ ] Continue Paddle setup (create products, paste checkout URLs, real license validation)
**Files Changed:**
- `src/renderer/App.jsx`
- `src/renderer/App.css`
- `README.md`
- `landing-page.html`
- `WORKLOG.md`

---

## Session 13 — 2026-05-23
> **⚠️ Historical note:** Lemon Squeezy subsequently rejected our merchant application, citing the BYOK AI routing model. The project migrated to **Paddle** as MoR. All forward-looking tasks below referencing Lemon Squeezy are superseded by Paddle equivalents. See Session 21 for details.

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
- Stored key = pro plan (stub). Real Paddle license validation marked with TODO comments
- License tab added to nav; upgrade URL is a placeholder (example.com/upgrade)
**Problems Encountered:**
- None
**Next Steps:**
- [ ] Run `npm run dev:win` to verify License tab renders correctly
- [ ] When ready to monetize: set up Paddle store, replace stub in licenseChecker.setKey() with real Paddle license API call, tighten FREE_FLAGS
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