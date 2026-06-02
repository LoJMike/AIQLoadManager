# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
**This file is safe to commit to Git** — it contains no secrets, only instructions.

# AI Queue Load Manager — Claude Code Instructions

This file tells Claude Code how this project works, what to do, and what never to touch.
Claude reads this file automatically on every session.

---

## Project Identity — Keep These in Sync

Every field below must always match the others. When one changes, update all of them.

| Field                                        | Current value                                    |
|----------------------------------------------|--------------------------------------------------|
| **Project name (display — full)**            | `AI Queue Load Manager`                          |
| **Project name (display — short)**           | `AIQ Load Manager`                               |
| **`package.json` → `"name"`**                | `aiq-load-manager`                               |
| **`package.json` → `"productName"`** (build) | `AI Queue Load Manager`                          |
| **`package.json` → `"version"`**             | `0.5.0`                                          |
| **GitHub repo**                              | https://github.com/LoJMike/AIQLoadManager        |
| **Local path (Windows)**                     | `C:\Users\mikel\Desktop\AIQLoadManager Project`  |

### Rules for keeping names in sync

- `"name"` in `package.json` must be **lowercase, hyphens only, no spaces** → `aiq-load-manager`
- `"productName"` in the `"build"` section is the **human-readable installer name** → `AI Queue Load Manager`
- **Short name** for space-constrained contexts (tooltips, badges, nav) → `AIQ Load Manager`
- **When the project is renamed**, update ALL of:
  - `package.json` → `name`, `productName`, `description`
  - `CLAUDE.md` → this identity table
  - `DESIGN.md` → brand identity table
  - `README.md` → title
- **Bump `"version"`** in `package.json` with every meaningful change: `major.minor.patch`
  - `patch` (0.1.40 → 0.1.41): bug fixes
  - `minor` (0.1.40 → 0.2.0): new features
  - `major` (0.1.40 → 1.0.0): breaking changes

---

## My Background

- I am not a professional developer. Explain things simply.
- Avoid jargon. If you use a technical term, define it briefly inline.
- **Always explain what you are about to do BEFORE doing it.**
- Ask for confirmation before any irreversible action (deleting files, force-pushing to Git, dropping database tables, etc.).
- Break large tasks into small confirmed steps. If something is unclear, ask — never guess.

---

## What This Project Is

A cross-platform Electron desktop app (Windows 10/11 + macOS) that:
- Queues prompts across 7 AI providers: Claude, OpenAI, Gemini, Groq, DeepSeek, Mistral, xAI Grok
- Tracks token usage and rate limits per provider in real time
- Routes prompts intelligently (auto / balance / cheapest / fastest / freeTier / manual modes)
- Persists everything locally via `node:sqlite` (built-in, no npm package)
- GUI: Electron + React + Vite, dark monospace theme

---

## Tech Stack

| Layer       | Technology                                                                                     |
|-------------|-----------------------------------------------------------------------------------------------|
| Desktop shell | Electron 36                                                                                 |
| Frontend    | React 18 + Vite 6                                                                              |
| Database    | `node:sqlite` (Node 22+ built-in — no npm package)                                            |
| Key storage | `electron-store` v8 (CommonJS)                                                                 |
| AI SDKs     | `@anthropic-ai/sdk`, `openai` (Groq/DeepSeek/Mistral/Grok share it), `@google/generative-ai` |
| IPC         | Electron contextBridge — main ↔ renderer via `window.aiQueue.*`                               |
| Analytics   | `posthog-node` (main process) + PostHog JS snippet (landing page) — anonymous, opt-out        |

---

## Project Structure

```
C:\Users\mikel\Desktop\AIQLoadManager Project\
  package.json
  vite.config.js            ← root: src/renderer, outDir: ../../dist
  .npmrc
  CLAUDE.md                 ← this file
  stubs/
    boolean/                ← local stub replacing deprecated boolean@3.2.0
  src/
    main/                   ← Electron main process (Node.js, CommonJS)
      index-v2.js           ← ACTIVE entry point (package.json "main")
      preload-v2.js         ← ACTIVE IPC bridge
      db.js                 ← node:sqlite wrapper
      store.js              ← electron-store v8 wrapper
      uuid.js               ← crypto.randomUUID() wrapper
      multiUsageTracker.js  ← token/rate/cost tracking + COST_TABLE + RATE_LIMITS
      multiQueueManager.js  ← queue CRUD + async processing loop
      queueRouter.js        ← routing decision engine (6 modes)
      providers/
        baseProvider.js           ← abstract base class (key storage, conversation history)
        providerRegistry.js       ← instantiates all providers
        anthropicProvider.js
        openaiProvider.js
        geminiProvider.js
        openaiCompatProviders.js  ← Groq, DeepSeek, Mistral, xAI Grok
    renderer/               ← React frontend (Vite + React 18)
      App.jsx               ← root component + sidebar nav
      App.css               ← dark monospace theme (CSS custom properties)
      main.jsx              ← React entry point
      index.html            ← Vite HTML template
      components/
        UsageDashboard.jsx
        AddPromptPanel.jsx
        QueueSettingsProjects.jsx
        index.js            ← re-exports all components
```

---

## Website / Landing Page

All public-facing web files live in `docs/` (GitHub Pages source folder):

```
docs/
  index.html               ← Landing page
  privacy.html             ← Privacy policy (linked from footer)
  terms.html               ← Terms of service (linked from footer)
  refund.html              ← Refund policy (linked from footer)
  landing-page-orig.html   ← Archive of the original design
  screenshots/             ← App screenshots used on the landing page (PNG, 2× retina)
    README.md              ← Screenshot capture guide and filename conventions
  assets/                  ← Logos, fonts, standalone CSS
```

**Rules for the docs folder:**
- The landing page is self-contained HTML — no build step required
- Screenshots go in `docs/screenshots/` — see `README.md` there for naming conventions
- The Paddle checkout URLs live in the `CHECKOUT_URLS` object in the `<script>` block at the bottom of `index.html` — replace placeholder strings with real Paddle product URLs before going live
- Do **not** move `mockups/` into `docs/` — mockups are development references, not public assets
- GitHub Pages is configured to serve from the `/docs` folder on `main` branch

---

## Legacy Files — DO NOT EDIT

These older files still exist but are **not used** by the running app. The `-v2` versions replaced them. Never edit these:

| File | Replaced by |
|---|---|
| `src/main/index.js` | `index-v2.js` |
| `src/main/preload.js` | `preload-v2.js` |
| `src/main/queueManager.js` | `multiQueueManager.js` |
| `src/main/usageTracker.js` | `multiUsageTracker.js` |
| `src/main/anthropicClient.js` | `providers/anthropicProvider.js` |

---

## How to Run in Development

See `DEVELOPER.md` (never committed — local only).

Quick reference:
```powershell
cd "C:\Users\mikel\Desktop\AIQLoadManager Project"

# Option A — single command (starts Vite + Electron together)
npm run dev:win

# Option B — two terminals
# Terminal 1: npm run dev:renderer
# Terminal 2: npm run start:win
```

Electron loads from `http://localhost:3000` in dev mode and opens DevTools automatically.

---

## How to Build Installers

See `DEVELOPER.md` for full process. Quick reference:
```powershell
npm run build:win    # → dist-app\AI Queue Load Manager Setup.exe
npm run build:mac    # → dist-app/AI Queue Load Manager.dmg
```

---

## Work Log

- The file `WORKLOG.md` tracks all session history — **never committed to Git**
- **At the start of every session**, read `WORKLOG.md` to understand where things left off
- **At the end of every session**, update `WORKLOG.md` with what was completed and next steps
- **Always check `WORKLOG.md` for the current version number before making any changes**
- **Always ask for user approval before changing the version number**
- **Always record every version change in `WORKLOG.md`**

## Changelog

- The file `CHANGELOG.md` records all notable changes per session or release
- Write entries in clear, human-readable language — e.g. "Added X; fixed bug in Y; updated Z"
- Add a new entry at the top of `CHANGELOG.md` whenever a version is bumped or a meaningful feature/fix ships
- Keep entries concise: one bullet per distinct change, grouped under the version number

---

## Git Workflow

```powershell
git checkout -b feature/short-description
# ... make changes ...
git add .
git commit -m "feat(scope): description of change"
git push origin feature/short-description
# Open PR on GitHub → merge to main
```

### Commit message format — Conventional Commits

```
type(scope): short imperative description
```

| Type       | When to use                               |
|------------|-------------------------------------------|
| `feat`     | New feature                               |
| `fix`      | Bug fix                                   |
| `refactor` | Code change that is not a fix or feature  |
| `perf`     | Performance improvement                   |
| `style`    | Formatting only (no logic change)         |
| `test`     | Adding or fixing tests                    |
| `docs`     | Documentation only                        |
| `chore`    | Build process, dependency updates, config |
| `security` | Security fix or hardening                 |

### Branch naming

- `feature/short-description`
- `fix/short-description`
- `chore/short-description`
- `security/short-description`

### Git rules

- Never commit directly to `main` or `master` — always use a feature branch
- Squash WIP commits before merging; history on `main` should be clean and meaningful
- Every PR must have a description explaining **what** changed and **why**, not just what
- Never commit: `node_modules/`, `.env*`, `dist/`, `dist-app/`, `build/`, `.DS_Store`, `Thumbs.db`, `DEVELOPER.md`, `WORKLOG.md`

---

## Key Rules for Claude Code

### NEVER do these

**Project-specific**
- Never hardcode API keys anywhere in source files
- Never commit `.env` files or any file containing real API keys
- Never install `better-sqlite3` — fails on Node 24; use `node:sqlite` only
- Never install `uuid` — use `./uuid.js` which wraps `crypto.randomUUID()`
- Never install `sql.js` — replaced by the `node:sqlite` built-in
- Never add `await` to `tracker.open()` or `queue.open()` — they are synchronous
- Never change `electron-store` above v8 — v9+ is ESM-only and breaks CommonJS
- Never remove the `overrides` block from `package.json` — it suppresses deprecation warnings
- Never remove `stubs/boolean/` — it replaces the abandoned `boolean` npm package
- Never set `package.json` `"name"` to mixed case or add spaces
- Never update `"name"`, `"productName"`, or `"version"` without also updating this file's identity table
- Never edit the legacy files listed in the Legacy Files section above
- Never use `ipcRenderer` directly in components — always through `window.aiQueue.*`

**Security**
- Never hardcode API keys, tokens, passwords, or connection strings anywhere in source files
- Never write developer-only instructions in `README.md` — it is public on GitHub
- Never commit `DEVELOPER.md` — it is local only and listed in `.gitignore`
- Never disable Supabase RLS (Row Level Security) on any table — not even temporarily
- Never query Supabase from the client using the service role key — that key is server-only
- Never use `innerHTML` with user-controlled content — sanitize first to prevent XSS

**Code quality**
- Never use deprecated libraries, packages, or APIs — check current official docs before adding any dependency
- Never leave a `.catch()` empty or swallow errors silently
- Never define a function more than once — search the codebase before writing any new function
- Never use `<style>` tags in HTML or `style=` inline attributes — CSS lives in separate `.css` files only
- Never duplicate a CSS rule — extract a shared utility class if two elements share styles
- Never make real network calls from unit tests — mock all external services
- Never skip or comment out failing tests — fix or delete them with a documented reason
- Never commit with linting errors or warnings — zero tolerance

**Efficiency**
- Never rewrite or refactor code that was not part of the current task
- Never add features, options, or abstractions that were not explicitly requested
- Never rename variables, functions, or files as a side effect of another task — renames ripple through imports and cause cascading fixes
- Never assume a file's current contents — always read the file before editing it
- Never produce boilerplate, placeholder functions, or TODO stubs unless explicitly asked
- Never repeat the full task description back before answering — one-line summary at most, then proceed
- Never split a single logical change across multiple responses when one would do
- Never ask multiple clarifying questions at once — ask one, wait for the answer, then ask the next if needed
- Never continue down a wrong approach — stop and report immediately if the plan needs to change
- Never guess at a file path, function name, or variable name — read the relevant file first
- Never silently truncate output if a file exceeds the context window — say so immediately

### ALWAYS do these

**Project-specific**
- Run `npm install` after any `package.json` change
- Keep `node:sqlite` usage confined to `db.js` — other files use the wrapper only
- Test in dev mode before building installers
- Use PowerShell syntax for all Windows commands (not CMD)
- When bumping the version: update `package.json` `"version"` AND the identity table in this file

**Documentation**
- Keep `README.md` user-facing only — no internal commands, credentials, or architecture notes
- Write all developer-only instructions in `DEVELOPER.md`
- Read `WORKLOG.md` at the start of every session before doing anything else
- Add a JSDoc comment above every function: purpose, parameters, return value

**Security**
- Scan every file for hardcoded secrets before finalizing
- Add `.env*`, `DEVELOPER.md`, and `WORKLOG.md` to `.gitignore` before the first commit
- Run `npm audit` before every release; fix critical and high severity issues immediately
- Enable RLS on every Supabase table at creation time — never add a table without a policy

**Efficiency**
- Read the relevant source file before editing it — never edit from memory or assumption
- State the plan in a short paragraph and wait for approval before writing code on any task with more than 3 steps
- Make the smallest change that satisfies the requirement
- Finish a task completely or clearly state where you stopped and why — never leave work silently half-done
- Confirm destructive actions (delete, overwrite, drop table) with a one-line summary before executing
- Ask one clarifying question when a request is ambiguous, rather than guessing and proceeding
- Run the full test suite before every commit

---

## Architecture — How the Pieces Connect

### Startup sequence (`index-v2.js`)

All objects are created synchronously before the window opens:

```
createStore()
  → MultiUsageTracker.open()
  → ProviderRegistry(tracker, store)
  → QueueRouter(registry, tracker)
  → MultiQueueManager(registry, tracker, router, push)
  → MultiQueueManager.open()
  → createWindow()
  → setupIPC()
  → queue.startProcessing()
```

### Shared SQLite database

Both `MultiUsageTracker` and `MultiQueueManager` open the **same file** (`ai-queue.db` in Electron's userData folder). Each manages its own tables:

| Class | Tables owned |
|---|---|
| `MultiUsageTracker` | `messages`, `settings` |
| `MultiQueueManager` | `queue_items`, `projects` |

### IPC pattern

All renderer ↔ main communication goes through:
- `preload-v2.js` — defines `window.aiQueue.*` methods
- `index-v2.js` — registers `ipcMain.handle(...)` handlers
- Never use `ipcRenderer` directly in components — always through `window.aiQueue`

**Push events (main → renderer):**

| Event | Payload | Purpose |
|---|---|---|
| `queue-update` | `{ action, item?, id? }` | Item added / removed / reordered / paused |
| `usage-update` | `{ allStatus, waiting?, waitMs? }` | Rate limit status changed |
| `item-complete` | `{ id, provider, model, response, usage }` | Item finished |
| `item-error` | `{ id, provider, error }` | Item failed |

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
| `fastest` | Groq → DeepSeek → Mistral → Gemini → OpenAI → Anthropic |
| `freeTier` | Prefers Gemini, Groq, Mistral first |

### Conversation history

`BaseProvider` stores conversation history **in memory only** (a `Map` of `convId → messages[]`), capped at 20 turns (40 messages). It is **not persisted** to SQLite — restarting the app clears all conversation context.

---

## Database Pattern

`db.js` exposes a synchronous API mirroring `better-sqlite3`:

```js
const db = openDatabase(dbPath);
db.exec('CREATE TABLE IF NOT EXISTS …');
db.prepare('SELECT * FROM foo WHERE id = ?').get(id);    // → object | undefined
db.prepare('SELECT * FROM foo').all();                    // → object[]
db.prepare('INSERT INTO foo VALUES (?, ?)').run(a, b);   // → { changes: 1 }
```

Results are plain objects (null-prototype stripped for IPC compatibility).

---

## Supabase & Database Provider Rules

- **Always enable Row Level Security (RLS) on every table** — enable at creation time, never after the fact
- **Never disable RLS** — not for debugging, not temporarily, not ever in production
- Every table must have at least one RLS policy before any data is written to it
- Use the **anon key** on the client; use the **service role key** only in server-side/edge functions
- Never expose the Supabase service role key in client-side code, browser env vars, or any committed file
- Scope RLS policies to the authenticated user: `auth.uid() = user_id` pattern
- For multi-tenant data, always filter by `organization_id` or equivalent in every policy
- Use Supabase Edge Functions for any operation requiring elevated privileges — never elevate on the client
- Audit RLS policies whenever a new role or user type is added to the app
- Test RLS by querying as an anonymous user and as a different authenticated user to confirm data isolation

---

## Documentation Rules

### README.md — public, committed to Git

User-facing project overview only. Must contain: what the app does, screenshots or demo link, download/install link, license.

**README.md must NEVER contain:** API keys or credentials, internal architecture notes, developer setup instructions, database schema, deployment secrets, or server addresses.

### DEVELOPER.md — private, never committed

Developer-only reference. Listed in `.gitignore`. Contains: how to run in development, how to build, required env vars and where to get them, database setup, deployment process, architecture decisions, debugging tips.

### CLAUDE.md — instructions for Claude, committed to Git

Safe to commit. Contains no secrets — only coding rules and project structure guidance for Claude Code.

### WORKLOG.md — session history, never committed

Tracks what was done each Claude Code session. Local only, listed in `.gitignore`.

### CHANGELOG.md — release notes, committed to Git

Human-readable release history. Safe to commit. No secrets.

---

## Code Structure & Reusability

- Define functions exactly once — always reference existing functions rather than redefining them
- Before writing any new function, search the codebase for an existing implementation that can be reused or extended
- Consolidate duplicate logic immediately when discovered
- Use barrel files (`index.js`) to centralize exports — `src/renderer/components/index.js` already does this; maintain the pattern
- Prefer composition over inheritance; build complex behavior from small, focused units

---

## HTML / CSS Architecture

- Always separate CSS into dedicated `.css` files — no `<style>` tags in HTML, no `style=` inline attributes
- Define styles at the highest appropriate scope — `App.css` holds the global dark monospace theme via CSS custom properties in `:root`; component-level overrides go in component-scoped files
- Use CSS custom properties (variables) for all colors, spacing, and typography — already established in `App.css`
- Never duplicate a CSS rule; extract shared utility classes when two components share styles
- Use semantic HTML elements (`nav`, `main`, `section`, `article`) — avoid div-soup

---

## React-Specific Rules

- One component per file; filename matches the component name exactly (PascalCase)
- Never define a component inside another component — always hoist to module scope
- Keep components pure where possible; isolate side effects in `useEffect` or custom hooks
- Extract repeated JSX patterns into named components immediately — never copy/paste JSX blocks
- All components are exported from `src/renderer/components/index.js` — maintain this barrel export
- Never use inline `style=` in JSX — all styles go in `.css` files
- PropTypes or TypeScript interfaces required for every component's props
- Memoize expensive calculations with `useMemo`; stable callbacks with `useCallback`

---

## Vanilla JavaScript Rules (Main Process)

- Use ES2020+ syntax; never use `var` — always `const` or `let`
- Prefer `async`/`await` over raw Promise chains or callbacks
- Always handle promise rejections — never leave `.catch()` empty or unhandled
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of verbose null checks
- Never mutate function arguments or shared state directly
- The main process is CommonJS (`require`) — never use `import`/`export` in `src/main/`

---

## Code Quality

- Write clean, minimal code — no unnecessary nesting, redundant conditions, or dead code
- Follow single-responsibility principle: each function/module does one thing
- Keep functions under 40 lines; extract logic into named helpers if longer
- Remove all commented-out code and debug artifacts before finalizing
- Define magic numbers and strings as named constants at the top of the file (see `COST_TABLE`, `RATE_LIMITS` in `multiUsageTracker.js` as the existing pattern)
- Write defensive code: check for `null` / `undefined` before accessing nested properties
- Prefer explicit over implicit — clear code beats clever code

---

## Naming Conventions

| Context                          | Convention           | Example                      |
|----------------------------------|----------------------|------------------------------|
| JS variables & functions         | camelCase            | `getUserById`                |
| JS classes                       | PascalCase           | `BaseProvider`               |
| React components & files         | PascalCase           | `UsageDashboard.jsx`         |
| JS constants                     | SCREAMING_SNAKE_CASE | `COST_TABLE`, `RATE_LIMITS`  |
| CSS classes & custom properties  | kebab-case           | `--color-primary`, `.btn-lg` |
| Boolean variables/props          | question form        | `isLoading`, `hasError`      |
| Event handlers                   | `handle` prefix      | `handleSubmit`               |
| Callback props                   | `on` prefix          | `onSubmit`                   |

---

## Annotations & Readability

- Add a JSDoc comment above every function: purpose, parameters, return value
- Use section header comments to divide files into logical blocks
- Annotate non-obvious logic, regex, or algorithms with a plain-English explanation
- Mark all temporary workarounds: `// TODO: reason`
- Keep annotations updated — a wrong comment is worse than no comment
- Every file should open with a one-line comment stating what it is and what it does

---

## Dependencies & Libraries

- Never use deprecated libraries, packages, or APIs — check current official docs before adding any dependency
- Prefer native Node/browser APIs over third-party packages when native is sufficient
- Before adding a dependency, audit: last updated, open issues, download count, known CVEs
- Pin all dependency versions — never use wildcard (`*`) or loose ranges
- Keep the dependency footprint minimal — if a package does one small thing, implement it natively instead
- Never import an entire library when only one function is needed
- Run `npm audit` before every release; fix critical and high severity issues immediately

---

## Security

- Before finalizing any file, scan for hardcoded API keys, tokens, passwords, connection strings, or secrets
- All secrets must live in environment variables (`.env`) — never committed to source control
- Always add `.env`, `.env.local`, `.env.*` to `.gitignore` before the first commit
- Commit a `.env.example` with all required variable names but no values
- Encrypt sensitive data at rest; never store plaintext credentials in config files or databases
- Validate and sanitize ALL user inputs on both client and server — treat all external data as untrusted
- Parameterize all database queries — never concatenate user input into SQL queries
- Use HTTPS for all external requests; never fall back to HTTP
- Apply least-privilege to all API keys, service accounts, and IAM roles
- Rate-limit all public-facing API endpoints
- Log security-relevant events (auth failures, permission denials) but never log sensitive data

---

## Testing

- Every function gets at least one unit test; every edge case and error path gets its own test
- Test files live adjacent to the source file: `Button.jsx` → `Button.test.jsx`
- Follow AAA structure: **Arrange, Act, Assert** — one assertion concept per test
- Mock all external services, APIs, and databases in unit tests — never make real network calls
- Integration tests cover critical user flows end-to-end; unit tests cover individual logic units
- Test names describe scenario and outcome: `should return null when input is empty`
- Minimum 80% code coverage; 100% on all security-critical and payment-related code
- Never skip or comment out failing tests — fix them or delete them with a documented reason
- Run the full test suite before every commit

---

## Linting & Formatting

- ESLint and Prettier configs must be committed to the repo
- Zero linting errors or warnings in committed code — warnings are treated as errors
- Use an `.editorconfig` at the root to enforce consistent indentation and line endings

---

## Performance

- Never block the main thread (Electron main process) with synchronous heavy computation
- Lazy-load routes and large components in React using `React.lazy` and `Suspense`
- Avoid premature optimization — profile first, then optimize the measured bottleneck
- Memoize only when profiling shows a real benefit — unnecessary memoization adds complexity

---

## Accessibility (a11y)

- Every interactive element must be keyboard-navigable and have a visible focus state
- All images require descriptive `alt` text; decorative images use `alt=""`
- Use ARIA attributes only when semantic HTML is insufficient
- Color contrast must meet WCAG 2.1 AA minimum (4.5:1 for text, 3:1 for large text and UI)
- Forms must have associated `<label>` for every input — never rely on `placeholder` as a label

---

## Efficiency & Session Rules

These rules exist to reduce wasted tokens, avoid rework, and keep sessions focused.

### Before writing any code

- Read `WORKLOG.md` before every session — never ask what was last worked on
- Read the relevant source files before editing them — never assume their current content
- Search the codebase for existing functions before writing new ones
- If a task has more than 3 steps, list all steps first and wait for approval before starting
- If the request is ambiguous, ask one clarifying question before writing any code

### While writing code

- Make the smallest change that satisfies the requirement — never refactor unrelated code in the same pass
- Never rewrite a working function unless explicitly asked
- Never rename variables, restructure files, or change formatting in the same commit as a logic change
- Edit only the files required for the current task — do not touch adjacent files
- If unsure whether a change is needed, ask — do not make a speculative edit
- If a library or API is required and its current availability is uncertain, say so before proceeding

### Before responding

- Never produce a response longer than the task requires
- Never repeat instructions back verbatim — one-line summary, then proceed
- Never add unrequested features, error handling, or abstractions — do exactly what was asked, nothing more
- If a file exceeds the context window, say so immediately rather than silently producing incomplete output

### Avoiding rework

- Never partially complete a task without clearly stating where you stopped and why
- If the approach turns out to be wrong mid-task, stop and say so rather than continuing and fixing later
- Confirm destructive actions (delete, overwrite, drop table) with a one-line summary before executing
- Never guess at a file path, function name, or variable name — read the file first
- Ask one clarifying question when something is ambiguous — never batch multiple questions, never guess

---

## Common Tasks for Claude Code

### Add a new AI provider
1. Create `src/main/providers/myProvider.js` extending `BaseProvider`
2. Implement: `validateApiKey`, `_initClient`, `getModels`, `getRateLimits`, `sendMessage`
3. Add to `PROVIDER_CLASSES` and `PROVIDER_META` in `providerRegistry.js`
4. Add rate limits to `RATE_LIMITS` in `multiUsageTracker.js`
5. Add per-token costs to `COST_TABLE` in `multiUsageTracker.js` — format: `{ 'model-id': [inputUsdPerMToken, outputUsdPerMToken] }`

### Add a new queue routing mode
1. Edit `queueRouter.js` — add case to the `route()` method
2. Add the new mode to the `ROUTING_MODES` array in `AddPromptPanel.jsx`

### Add a new UI panel
1. Create `src/renderer/components/MyPanel.jsx`
2. Export from `src/renderer/components/index.js`
3. Import and add to the `NAV` array and tab switch in `App.jsx`

### Fix a deprecation warning
1. Check which package pulls it in: `npm ls <package-name>`
2. Add an override to `package.json` `overrides` block
3. If no clean npm replacement exists, create a stub in `stubs/<package>/`

---

## Dependencies Rationale

| Package | Why pinned / why chosen |
|---|---|
| `electron-store@^8.2.0` | Last CommonJS version — v9+ is ESM-only and breaks `require()` |
| `node:sqlite` | Built into Node 22+; zero deps, synchronous API, no npm package needed |
| `crypto.randomUUID()` | Built into Node 16+; replaces `uuid` npm package entirely |
| `stubs/boolean` | `boolean@3.2.0` abandoned, no v4; local stub replaces it silently |
| `openai` SDK for 4 providers | Groq, DeepSeek, Mistral, xAI Grok all expose OpenAI-compatible APIs |

---

## .gitignore — Required Entries

Verify these are present before every `git push`:

```
# Secrets & credentials
.env
.env.local
.env.*
!.env.example

# Developer-only docs — local only
DEVELOPER.md
WORKLOG.md

# Dependencies & build output
node_modules/
dist/
dist-app/
build/
out/

# OS & editor noise
.DS_Store
Thumbs.db
Desktop.ini
*.swp
.idea/

# Logs
*.log
npm-debug.log*
```
