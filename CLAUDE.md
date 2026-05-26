# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Queue Load Manager — Claude Code Instructions

This file tells Claude Code how this project works, what to do, and what never to touch.
Claude reads this file automatically on every session.

---

## Project identity — keep these in sync

These three values must always match each other. When one changes, update all three.

| Field | Current value |
|---|---|
| **Project name (display — full)** | `AI Queue Load Manager` |
| **Project name (display — short)** | `AIQ Load Manager` |
| **`package.json` → `"name"`** | `aiq-load-manager` |
| **`package.json` → `"productName"`** (build section) | `AI Queue Load Manager` |
| **`package.json` → `"version"`** | `0.5.0` |
| **GitHub repo** | https://github.com/LoJMike/AIQLoadManager |
| **Local path (Windows)** | `C:\Users\mikel\Desktop\AIQLoadManager Project` |

### Rules for keeping names in sync

- `"name"` in package.json must be **lowercase, hyphens allowed, no spaces** (npm requirement) → `aiq-load-manager`
- `"productName"` in the `"build"` section is the **human-readable installer name** → `AI Queue Load Manager`
- **Short name** for space-constrained contexts (tooltips, badges, nav) → `AIQ Load Manager`
- **When the user renames the project**, update ALL of: `package.json` `name`, `package.json` `productName`, `package.json` `description`, `CLAUDE.md` project identity table, `DESIGN.md` brand identity table, and `README.md` title
- **Bump `"version"`** in `package.json` with every meaningful change: `major.minor.patch`
  - `patch` (0.1.40 → 0.1.41): bug fixes
  - `minor` (0.1.40 → 0.2.0): new features
  - `major` (0.1.40 → 1.0.0): breaking changes

---

## My Background
- I am not a professional developer. Explain things simply.
- Avoid jargon. If you use a technical term, define it briefly.
- Ask me before doing anything irreversible (deleting files, force-pushing to Git, etc.)
- Always explain what you're about to do BEFORE doing it.
- Break large tasks into small confirmed steps. If something is unclear, ask — don't guess.

---

## What this project is

A cross-platform Electron desktop app (Windows 10/11 + macOS) that:
- Queues prompts across 7 AI providers: Claude, OpenAI, Gemini, Groq, DeepSeek, Mistral, xAI Grok
- Tracks token usage and rate limits per provider in real time
- Routes prompts intelligently (auto/balance/cheapest/fastest/freeTier/manual modes)
- Persists everything locally via `node:sqlite` (built-in, no npm package)
- GUI: Electron + React + Vite, dark monospace theme

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 36 |
| Frontend | React 18 + Vite 6 |
| Database | `node:sqlite` (Node 22+ built-in — no npm package) |
| Key storage | `electron-store` v8 (CommonJS) |
| AI SDKs | `@anthropic-ai/sdk`, `openai` (Groq/DeepSeek/Mistral/Grok share it), `@google/generative-ai` |
| IPC | Electron contextBridge — main ↔ renderer via `window.aiQueue.*` |
| Analytics | `posthog-node` (app, main process) + PostHog JS snippet (landing page) — anonymous, opt-out |

---

## Project structure

```
C:\Users\mikel\Desktop\AIQLoadManager Project\
  package.json
  vite.config.js          ← root: src/renderer, outDir: ../../dist
  .npmrc
  CLAUDE.md               ← this file
  stubs/
    boolean/              ← local stub replacing deprecated boolean@3.2.0
  src/
    main/                 ← Electron main process (Node.js, CommonJS)
      index-v2.js         ← ACTIVE entry point (package.json "main")
      preload-v2.js       ← ACTIVE IPC bridge
      db.js               ← node:sqlite wrapper
      store.js            ← electron-store v8 wrapper
      uuid.js             ← crypto.randomUUID() wrapper
      multiUsageTracker.js  ← token/rate/cost tracking + COST_TABLE + RATE_LIMITS
      multiQueueManager.js  ← queue CRUD + async processing loop
      queueRouter.js        ← routing decision engine (6 modes)
      providers/
        baseProvider.js      ← abstract base class (key storage, conversation history)
        providerRegistry.js  ← instantiates all providers
        anthropicProvider.js
        openaiProvider.js
        geminiProvider.js
        openaiCompatProviders.js  ← Groq, DeepSeek, Mistral, xAI Grok
    renderer/             ← React frontend (Vite + React 18)
      App.jsx             ← root component + sidebar nav
      App.css             ← dark monospace theme (CSS custom properties)
      main.jsx            ← React entry point
      index.html          ← Vite HTML template
      components/
        UsageDashboard.jsx
        AddPromptPanel.jsx
        QueueSettingsProjects.jsx
        index.js          ← re-exports all components
```

---

## Website / landing page

All public-facing web files live in `website/`:

```
website/
  index.html          ← Landing page (was landing-page.html in root)
  landing-page-orig.html ← Archive of the original design
  screenshots/        ← App screenshots used on the landing page (PNG, 2× retina)
    README.md         ← Screenshot capture guide and filename conventions
  assets/             ← Future: logos, fonts, standalone CSS
```

**Rules for the website folder:**
- The landing page is self-contained HTML — no build step required
- Screenshots go in `website/screenshots/` — see `README.md` there for naming conventions and capture instructions
- The Lemon Squeezy checkout URLs live in the `<script>` block at the bottom of `index.html` — replace the `PASTE_..._CHECKOUT_URL_HERE` placeholders before going live
- Do **not** move `mockups/` into `website/` — mockups are development references, not public assets

---

### Legacy files — DO NOT EDIT

These older files still exist but are **not used** by the running app. The `-v2` versions replaced them. Never edit these:
- `src/main/index.js` (replaced by `index-v2.js`)
- `src/main/preload.js` (replaced by `preload-v2.js`)
- `src/main/queueManager.js` (replaced by `multiQueueManager.js`)
- `src/main/usageTracker.js` (replaced by `multiUsageTracker.js`)
- `src/main/anthropicClient.js` (replaced by `providers/anthropicProvider.js`)

---

## How to run in development

```powershell
cd "C:\Users\mikel\Desktop\AIQLoadManager Project"

# Option A — single command (starts Vite + Electron together)
npm run dev:win

# Option B — two separate terminals
# Terminal 1
npm run dev:renderer

# Terminal 2
npm run start:win
```

Electron loads from `http://localhost:3000` in dev mode and opens DevTools automatically.

## How to build installers

```powershell
npm run build:win      # → dist-app\AI Queue Load Manager Setup.exe
npm run build:mac      # → dist-app/AI Queue Load Manager.dmg
```

---

## Architecture — how the pieces connect

### Startup sequence (`index-v2.js`)

All objects are created synchronously before the window opens:

```
createStore()  →  MultiUsageTracker.open()  →  ProviderRegistry(tracker, store)
→  QueueRouter(registry, tracker)  →  MultiQueueManager(registry, tracker, router, push)
→  MultiQueueManager.open()  →  createWindow()  →  setupIPC()  →  queue.startProcessing()
```

### Shared SQLite database

Both `MultiUsageTracker` and `MultiQueueManager` open the **same file** (`ai-queue.db` in Electron's userData folder). Each manages its own tables:
- `MultiUsageTracker` owns: `messages`, `settings`
- `MultiQueueManager` owns: `queue_items`, `projects`

### IPC pattern

All renderer ↔ main communication goes through:
- `src/main/preload-v2.js` — defines `window.aiQueue.*` methods
- `src/main/index-v2.js` — registers `ipcMain.handle(...)` handlers
- Never use `ipcRenderer` directly in components — always through `window.aiQueue`

**Push events (main → renderer)** — subscribed in components via `window.aiQueue.on*`:

| Event | Payload | Purpose |
|---|---|---|
| `queue-update` | `{ action, item?, id? }` | item added/removed/reordered/paused |
| `usage-update` | `{ allStatus, waiting?, waitMs? }` | rate limit status changed |
| `item-complete` | `{ id, provider, model, response, usage }` | item finished |
| `item-error` | `{ id, provider, error }` | item failed |

### Queue processing loop

`MultiQueueManager._tick()` polls every 1.5–3 s. On each tick:
1. Fetches the highest-priority pending item
2. Calls `QueueRouter.route(item)` → gets `{ provider, model, reason }` or `{ wait: true, waitMs }`
3. If wait → schedules next tick after `waitMs`
4. If ready → calls `ProviderRegistry.sendMessage(provider, params)` → records usage → pushes events

### Routing modes

| Mode | Behaviour |
|---|---|
| `auto` | Scores all configured providers (free tier, RPM headroom, task type, budget) |
| `manual` | Uses the provider/model the user explicitly chose |
| `balance` | Round-robins across all providers with capacity |
| `cheapest` | Picks lowest input-cost provider |
| `fastest` | Prefers Groq → DeepSeek → Mistral → Gemini → OpenAI → Anthropic |
| `freeTier` | Prefers Gemini, Groq, Mistral first |

### Conversation history

`BaseProvider` stores conversation history **in memory only** (a `Map` of `convId → messages[]`), capped at 20 turns (40 messages). It is **not persisted** to SQLite — restarting the app clears all conversation context.

---

## Key rules for Claude Code

### NEVER do these
- Never hardcode API keys anywhere in source files
- Never commit `.env` files or any file containing real API keys
- Never install `better-sqlite3` — fails on Node 24. Use `node:sqlite` only.
- Never install `uuid` — use `./uuid.js` which wraps `crypto.randomUUID()`
- Never install `sql.js` — replaced by `node:sqlite` built-in
- Never add `await` to `tracker.open()` or `queue.open()` — they are synchronous
- Never change `electron-store` above v8 — v9+ is ESM-only and breaks CommonJS
- Never remove the `overrides` block from `package.json` — it suppresses deprecation warnings
- Never remove `stubs/boolean/` — it replaces the abandoned `boolean` npm package
- Never change `package.json` `"name"` to mixed case or add spaces
- Never update `"name"`, `"productName"`, or `"version"` without also updating this CLAUDE.md identity table
- Never edit the legacy files listed above (`index.js`, `preload.js`, `queueManager.js`, etc.)

### Always do these
- Run `npm install` after any `package.json` change
- Keep `node:sqlite` usage confined to `db.js` — other files use the wrapper only
- Test in dev mode before building installers
- Use PowerShell syntax for any Windows commands (not CMD)
- When bumping the version: update `package.json` `"version"` AND the identity table in this file
- **Always check `WORKLOG.md` for the current version number before making any changes**
- **Always ask for user approval before changing the version number**
- **Always record every version change in `WORKLOG.md`**

### Database pattern
`db.js` exposes a synchronous API mirroring `better-sqlite3`:
```js
const db = openDatabase(dbPath);
db.exec('CREATE TABLE IF NOT EXISTS …');
db.prepare('SELECT * FROM foo WHERE id=?').get(id);    // → object | undefined
db.prepare('SELECT * FROM foo').all();                  // → object[]
db.prepare('INSERT INTO foo VALUES (?,?)').run(a, b);  // → { changes: 1 }
```
Results are plain objects (null-prototype stripped for IPC compatibility).

---

## Common tasks for Claude Code

### Add a new AI provider
1. Create `src/main/providers/myProvider.js` extending `BaseProvider`
2. Implement: `validateApiKey`, `_initClient`, `getModels`, `getRateLimits`, `sendMessage`
3. Add to `PROVIDER_CLASSES` and `PROVIDER_META` in `providerRegistry.js`
4. Add rate limits to `RATE_LIMITS` in `multiUsageTracker.js`
5. Add per-token costs to `COST_TABLE` in `multiUsageTracker.js` — format: `{ 'model-id': [inputUsdPerMToken, outputUsdPerMToken] }`

### Add a new queue routing mode
- Edit `queueRouter.js` — add case to the `route()` method
- Add the new mode to `ROUTING_MODES` array in `AddPromptPanel.jsx`

### Add a new UI panel
- Create `src/renderer/components/MyPanel.jsx`
- Export from `src/renderer/components/index.js`
- Import and add to the `NAV` array and tab switch in `App.jsx`

### Fix a deprecation warning
- Check which package pulls it in: `npm ls <package-name>`
- Add an override to `package.json` `overrides` block
- If no clean npm replacement exists, create a stub in `stubs/<package>/`

---

## Git workflow

```powershell
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: description of change"
git push origin feature/my-feature
# Open PR on GitHub → merge to main
```

Commit message prefixes: `feat:` `fix:` `refactor:` `docs:` `chore:`

---

## Dependencies rationale

| Package | Why pinned / why chosen |
|---|---|
| `electron-store@^8.2.0` | Last CommonJS version. v9+ is ESM-only and breaks `require()`. |
| `node:sqlite` | Built into Node 22+. Zero deps, synchronous API. |
| `crypto.randomUUID()` | Built into Node 16+. Replaces `uuid` npm package entirely. |
| `stubs/boolean` | `boolean@3.2.0` abandoned, no v4. Local stub replaces it silently. |
| `openai` SDK for 4 providers | Groq, DeepSeek, Mistral, xAI Grok all expose OpenAI-compatible APIs. |

---

## Work Log
- The file WORKLOG.md tracks all session history
- At the start of each session, read WORKLOG.md to understand where we left off
- At the end of each session, update WORKLOG.md with what was completed and next steps

## Changelog
- The file CHANGELOG.md records all notable changes per session or release
- Write entries in clear, human-readable language — e.g. "Added X; fixed bug in Y; updated API docs"
- Add a new entry at the top of CHANGELOG.md whenever a version is bumped or a meaningful feature/fix ships
- Keep entries concise: one bullet per distinct change, grouped under the version number
