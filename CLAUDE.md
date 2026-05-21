# AIQLoadManager — Claude Code Instructions

This file tells Claude Code how this project works, what to do, and what never to touch.
Claude reads this file automatically on every session.

---

## Repository & local paths

| | |
|---|---|
| **GitHub** | https://github.com/LoJMike/AIQLoadManager |
| **Local (Windows)** | `C:\Users\mikel\Desktop\AIQLoadManager Project` |
| **Clone command** | `git clone https://github.com/LoJMike/AIQLoadManager.git "AIQLoadManager Project"` |

---

## What this project is

A cross-platform Electron desktop app (Windows 10/11 + macOS) that:
- Queues prompts across 7 AI providers: Claude, OpenAI, Gemini, Groq, DeepSeek, Mistral, xAI Grok
- Tracks token usage and rate limits per provider in real time
- Routes prompts intelligently (auto/balance/cheapest/fastest/freeTier/manual modes)
- Persists everything locally via `node:sqlite` (built-in, no npm package)
- GUI: Electron + React + Vite, dark monospace theme
- Status: In development (private)
- Started: [05/20/2026]

---

## My Background
- I am not a professional developer. Explain things simply.
- Avoid jargon. If you use a technical term, define it briefly.
- Ask me before doing anything irreversible (deleting files, force-pushing to Git, etc.)

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

---

## Project structure

```
C:\Users\mikel\Desktop\AIQLoadManager Project\
  package.json
  vite.config.js
  .npmrc
  .gitignore
  CLAUDE.md                          ← this file
  README.md
  stubs/
    boolean/                         ← local stub replacing deprecated boolean@3.2.0
      index.js
      package.json
  .github/
    workflows/
      ci.yml                         ← GitHub Actions CI
  src/
    main/                            ← Electron main process (Node.js)
      index-v2.js                    ← Entry point, bootstraps everything
      preload-v2.js                  ← IPC bridge exposed to renderer
      db.js                          ← node:sqlite wrapper (exec/prepare/run/get/all)
      store.js                       ← electron-store v8 wrapper
      uuid.js                        ← crypto.randomUUID() wrapper (no npm dep)
      multiUsageTracker.js           ← Per-provider token/rate/cost tracking
      multiQueueManager.js           ← Queue CRUD + async processing loop
      queueRouter.js                 ← Routing decision engine (6 modes)
      providers/
        baseProvider.js              ← Abstract base class
        providerRegistry.js          ← Instantiates + exposes all providers
        anthropicProvider.js         ← Claude (Anthropic SDK)
        openaiProvider.js            ← OpenAI (GPT models)
        geminiProvider.js            ← Google Gemini
        openaiCompatProviders.js     ← Groq, DeepSeek, Mistral, xAI Grok
    renderer/                        ← React frontend
      App.jsx                        ← Root component, sidebar nav
      App.css                        ← Dark monospace theme (CSS vars)
      main.jsx                       ← React entry point
      index.html                     ← Vite HTML template
      components/
        UsageDashboard.jsx           ← Per-provider usage cards
        AddPromptPanel.jsx           ← Single + bulk prompt form
        QueueSettingsProjects.jsx    ← Queue view + Settings + Projects
        index.js                     ← Re-exports named components
```

---

## How to run in development

```powershell
cd "C:\Users\mikel\Desktop\AIQLoadManager Project"

# Terminal 1 — Vite renderer (hot reload)
npm run dev:renderer

# Terminal 2 — Electron (new PowerShell window)
npm run start:win
```

## How to build installers

```powershell
npm run build:win      # → dist-app\AI Queue Manager Setup.exe
npm run build:mac      # → dist-app/AI Queue Manager.dmg
```

---

## Key rules for Claude Code

### NEVER do these
- Never hardcode API keys anywhere in source files
- Never commit `.env` files or any file containing real API keys
- Never install `better-sqlite3` — it fails on Node 24 + VS2026. Use `node:sqlite` only.
- Never install `uuid` — use `./uuid.js` which wraps `crypto.randomUUID()`
- Never install `sql.js` — replaced by `node:sqlite` built-in
- Never add `await` to `tracker.open()` or `queue.open()` — they are synchronous
- Never change `electron-store` above v8 — v9+ is ESM-only and breaks CommonJS
- Never remove the `overrides` block from `package.json` — it kills all deprecation warnings
- Never remove `stubs/boolean/` — it replaces the abandoned `boolean` npm package
- Never use deprecated or out of date files

### Always do these
- Always explain what you're about to do BEFORE doing it
- Break large tasks into small confirmed steps
- If something is unclear, ask me — don't guess
- Keep code well-commented so I can understand it later
- Prefer simple solutions over clever ones
- When in doubt about destructive operations, STOP and ask
- Run `npm install` after any `package.json` change
- Keep `node:sqlite` usage confined to `db.js` — other files use the wrapper only
- Test in dev mode before building installers
- Use PowerShell syntax for any Windows commands (not CMD — e.g. `Remove-Item -Recurse -Force` not `rmdir /s /q`)
- When adding a new AI provider: extend `BaseProvider`, register in `providerRegistry.js`, add rate limits to `RATE_LIMITS` in `multiUsageTracker.js`, add pricing to `COST_TABLE`

### IPC pattern
All renderer ↔ main communication goes through:
- `src/main/preload-v2.js` — defines `window.aiQueue.*` methods
- `src/main/index-v2.js` — registers `ipcMain.handle(...)` handlers
- Never use `ipcRenderer` directly in components — always through `window.aiQueue`

### Database pattern
`db.js` exposes a synchronous API mirroring `better-sqlite3`:
```js
const db = openDatabase(dbPath);                                    // sync
db.exec('CREATE TABLE IF NOT EXISTS …');
db.prepare('SELECT * FROM foo WHERE id=?').get(id);                // → object | undefined
db.prepare('SELECT * FROM foo').all();                             // → object[]
db.prepare('INSERT INTO foo VALUES (?,?)').run(a, b);             // → { changes: 1 }
```
Results are plain objects (null-prototype stripped for IPC compatibility).

---

## Common tasks for Claude Code

### Add a new AI provider
1. Create `src/main/providers/myProvider.js` extending `BaseProvider`
2. Implement: `validateApiKey`, `_initClient`, `getModels`, `getRateLimits`, `sendMessage`
3. Add to `PROVIDER_CLASSES` and `PROVIDER_META` in `providerRegistry.js`
4. Add rate limits to `RATE_LIMITS` in `multiUsageTracker.js`
5. Add per-token costs to `COST_TABLE` in `multiUsageTracker.js`

### Add a new queue routing mode
- Edit `queueRouter.js` — add case to the `route()` method
- Add the new mode to `ROUTING_MODES` array in `AddPromptPanel.jsx`

### Add a new UI panel
- Create `src/renderer/components/MyPanel.jsx`
- Export it from `src/renderer/components/index.js`
- Import and add to `NAV` array and tab switch in `App.jsx`

### Fix a deprecation warning
- Check which package pulls it in: `npm ls <package-name>`
- Add an override to `package.json` `overrides` block
- If no clean npm replacement exists, create a stub in `stubs/<package>/`

---

## Git workflow

```powershell
# Clone fresh (first time)
cd "C:\Users\mikel\Desktop"
git clone https://github.com/LoJMike/AIQLoadManager.git "AIQLoadManager Project"
cd "AIQLoadManager Project"
npm install

# Daily workflow
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
| `node:sqlite` | Built into Node 22+. Zero deps, zero warnings, synchronous API. |
| `crypto.randomUUID()` | Built into Node 16+. Replaces `uuid` npm package entirely. |
| `glob` override `11.0.2` | Exact pin — 11.1.0+ added self-deprecation warnings |
| `stubs/boolean` | `boolean@3.2.0` abandoned, no v4 exists. Local stub replaces it silently. |
| `openai` SDK for 4 providers | Groq, DeepSeek, Mistral, xAI Grok all expose OpenAI-compatible APIs. One SDK handles all four. |

---

## Work Log
- The file WORKLOG.md tracks all session history
- At the start of each session, read WORKLOG.md to understand where we left off
- At the end of each session, update WORKLOG.md with what was completed and next steps