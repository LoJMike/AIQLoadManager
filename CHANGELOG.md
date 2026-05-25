# Changelog

All notable changes to AI Queue Load Manager are recorded here, newest first.
Each entry describes what changed in plain language — no jargon.

---

## [0.4.0]

- Added **Pro+ tier** (coming soon, $34/mo) — positioned between Pro and Team for solo power users who need higher throughput, unlimited queue depth, Consensus mode, and priority support without team overhead.
- Pro+ limits: 10,000 cloud prompt runs/month and 20M tokens/month (4× Pro), unlimited queue depth (vs Pro's 500 soft-cap).
- Pro+ exclusive features: Consensus mode (meta-model synthesis across Compare results, Roadmap), priority email support.
- Raised **Team tier** price from $39 to $49/user/month; increased Team limits to 25,000 prompts and 60M tokens pooled (to maintain a clear step up from Pro+).
- Updated `licenseChecker.js` — added `PRO_PLUS_FLAGS` object with full flag set; `getLicense()` and `setKey()` now handle `'pro_plus'` plan type.
- Updated `LicensePanel.jsx` — Pro+ added to plan cards, pricing table, and feature comparison table with amber (#f59e0b) colour. Added Pro+ upgrade CTA button.
- Updated `README.md` — pricing table, roadmap, and Purchasing & Licensing section updated.
- Updated `landing-page.html` — Pro+ pricing card (amber/gold, COMING SOON badge) added between Pro and Team; Pro+ column added to full feature compare table; roadmap card updated; CHECKOUT_URLS block extended with `pro_plus` placeholder.

## [0.3.7]

- Added built-in **🐛 Report a Bug** button in the sidebar — opens a pre-filled GitHub issue in the browser with app version and OS already filled in.
- Roadmap: Option 3 (diagnostic auto-attach — configured providers, recent error log, queue state) planned for a future release.

## [0.3.6]

- Added **Web Search** support (Tavily and SearXNG backends).
- Live search results are injected into the system prompt before the AI call, so every model — including fully local ones — can answer web-grounded questions.
- Configure the backend and API key in **Settings → Connectors → 🌐 Web Search**.

## [0.3.5]

- Added **LocalAI** and **llama.cpp** as two new local providers — provider count goes from 10 to 12.
- All 5 local providers (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp) now have configurable ports in Settings → Connectors.
- llama.cpp defaults to port 8181 to avoid collision with LocalAI (8080).

## [0.3.4]

- Added **Jan.ai** as a third local provider.
- Free tier now covers 3 local providers (Ollama, LM Studio, Jan.ai) plus 3 permanent free cloud tiers (Gemini, Groq, Mistral).

## [0.3.3]

- Aligned pricing tiers: Free / Starter / Pro.
- Added `STARTER_FLAGS` feature-flag set.
- Redesigned **LicensePanel** with a 3-column layout.

## [0.3.2]

- Added **Compare mode** (Pro) — send the same prompt to multiple providers simultaneously and view responses side by side.
- Fan-out runs in parallel via `Promise.allSettled`; a single provider failure doesn't abort the others.

## [0.3.1]

- **Persistent conversation history** — messages are now written through to SQLite on every turn, so threads survive app restarts.
- `ConversationStore.loadAll()` warms the in-memory cache from the database on startup; the 20-turn / 40-message cap is preserved.
- New IPC call: `window.aiQueue.getConversationHistory(provider, convId)`.

## [0.3.0]

- Added **prompt type tags** (Chat, Research, Code, Web Search, Writing, Analysis, Image, Translate, ⚡ Urgent) — 9 visual chips that drive routing decisions and queue priority.
- Added **live token estimation** — updates on every keystroke in the Add Prompt panel.
- Added **provider cost comparison table** — fires 500 ms after you stop typing; shows every configured provider ranked by routing score with estimated cost and availability.

## [0.2.0] → [0.1.43]

- Licensing skeleton: free/pro feature flags and LicensePanel UI.

## [0.1.41]

- Neon glassmorphic UI redesign.
- Custom title bar replacing the default OS chrome.
