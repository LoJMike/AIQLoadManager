/**
 * MultiUsageTracker — uses node:sqlite built-in (Node 22+, zero npm deps)
 * open() is now synchronous.
 */

'use strict';

const path = require('path');
const { app } = require('electron');
const { openDatabase } = require('./db');
const { v4: uuidv4 } = require('./uuid');

const COST_TABLE = {
  anthropic: { 'claude-opus-4-6': [5.00, 25.00], 'claude-sonnet-4-6': [3.00, 15.00], 'claude-haiku-4-5': [1.00, 5.00] },
  openai:    { 'gpt-4o': [2.50, 10.00], 'gpt-4o-mini': [0.15, 0.60], 'gpt-4.1': [2.00, 8.00], 'gpt-4.1-mini': [0.40, 1.60], 'o4-mini': [1.10, 4.40] },
  gemini:    { 'gemini-2.5-pro': [1.25, 10.00], 'gemini-2.0-flash': [0.10, 0.40], 'gemini-1.5-flash': [0.075, 0.30] },
  groq:      { 'llama-3.3-70b-versatile': [0.59, 0.79], 'llama-3.1-8b-instant': [0.05, 0.08], 'mixtral-8x7b-32768': [0.24, 0.24] },
  deepseek:  { 'deepseek-chat': [0.14, 0.28], 'deepseek-reasoner': [0.55, 2.19] },
  mistral:   { 'mistral-large-latest': [2.00, 6.00], 'mistral-small-latest': [0.10, 0.30], 'codestral-latest': [0.30, 0.90], 'open-mistral-7b': [0.04, 0.04] },
  grok:      { 'grok-4': [3.00, 15.00], 'grok-4.1-fast': [0.20, 0.50], 'grok-3-mini': [0.30, 0.50] },
  // Phase 1 additions (v0.6.0)
  fireworks: {
    'accounts/fireworks/models/llama-v3p3-70b-instruct': [0.90, 0.90],
    'accounts/fireworks/models/llama-v3p1-8b-instruct':  [0.20, 0.20],
    'accounts/fireworks/models/deepseek-v3':             [0.90, 0.90],
    'accounts/fireworks/models/qwen2p5-72b-instruct':    [0.90, 0.90],
  },
  together: {
    'meta-llama/Llama-3.3-70B-Instruct-Turbo':          [0.88, 0.88],
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo':      [0.18, 0.18],
    'deepseek-ai/DeepSeek-V3':                           [0.60, 1.70],
    'Qwen/Qwen2.5-72B-Instruct-Turbo':                  [1.20, 1.20],
    'mistralai/Mixtral-8x7B-Instruct-v0.1':             [0.60, 0.60],
  },
  minimax: {
    'MiniMax-M3':   [0.60, 2.40],
    'MiniMax-M2.5': [0.15, 1.15],
    'MiniMax-M2':   [0.26, 1.00],
  },
  cerebras: {
    'llama-3.3-70b': [0.85, 1.20],
    'llama-3.1-8b':  [0.10, 0.10],
    'qwen-3-32b':    [0.40, 0.80],
  },
  cohere: {
    'command-a-03-2025':   [2.50, 10.00],
    'command-r-plus':      [2.50, 10.00],
    'command-r':           [0.15,  0.60],
    'command-r7b-12-2024': [0.04,  0.15],
  },
  // Local providers — all models are $0.00 (any unrecognised model falls back to [0,0])
  ollama:    {},
  lmstudio:  {},
  jan:       {},
  localai:   {},
  llamacpp:  {},
};

const RATE_LIMITS = {
  anthropic: { rpm: 50,   rpd: null,   tpm: 100_000   },
  openai:    { rpm: 500,  rpd: null,   tpm: 200_000   },
  gemini:    { rpm: 15,   rpd: 1500,   tpm: 1_000_000 },
  groq:      { rpm: 30,   rpd: 14_400, tpm: 6_000     },
  deepseek:  { rpm: 60,   rpd: null,   tpm: 100_000   },
  mistral:   { rpm: 2,    rpd: null,   tpm: null       },
  grok:      { rpm: 60,   rpd: null,   tpm: 500_000   },
  // Phase 1 additions (v0.6.0)
  fireworks: { rpm: 600,  rpd: null,   tpm: null       },
  together:  { rpm: 600,  rpd: null,   tpm: null       },
  minimax:   { rpm: 60,   rpd: null,   tpm: null       },
  cerebras:  { rpm: 30,   rpd: null,   tpm: null       }, // free tier; 240 rpm paid
  cohere:    { rpm: 20,   rpd: null,   tpm: null       }, // trial; 10,000 rpm production
  // Local providers — effectively unlimited (hardware-bound, not policy-bound)
  ollama:    { rpm: 9999, rpd: null,   tpm: null       },
  lmstudio:  { rpm: 9999, rpd: null,   tpm: null       },
  jan:       { rpm: 9999, rpd: null,   tpm: null       },
  localai:   { rpm: 9999, rpd: null,   tpm: null       },
  llamacpp:  { rpm: 9999, rpd: null,   tpm: null       },
};

class MultiUsageTracker {
  constructor() {
    this.db          = null;
    this._budgets    = {};
    this._statusCache = new Map();  // provider → { data, expiresAt }
  }

  /** Synchronous open — call before using */
  open(dbPath) {
    const p = dbPath || path.join(
      app ? app.getPath('userData') : require('os').tmpdir(),
      'ai-queue.db'
    );
    this.db = openDatabase(p);
    this._initSchema();
    this._loadBudgets();
    return this;
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id              TEXT PRIMARY KEY,
        provider        TEXT NOT NULL,
        model           TEXT,
        timestamp       INTEGER NOT NULL,
        input_tokens    INTEGER DEFAULT 0,
        output_tokens   INTEGER DEFAULT 0,
        cost_usd        REAL    DEFAULT 0,
        queue_item_id   TEXT,
        conversation_id TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  _loadBudgets() {
    try {
      const rows = this.db.prepare(
        "SELECT key, value FROM settings WHERE key LIKE ?"
      ).all('budget.%');
      for (const row of rows) {
        const val = parseFloat(row.value);
        // null = no limit stored; 0 = explicitly blocked; positive = cap
        this._budgets[row.key.replace('budget.', '')] = isNaN(val) ? null : val;
      }
    } catch (_) {}
  }

  recordMessage(provider, { model, inputTokens = 0, outputTokens = 0, queueItemId = null, conversationId = null }) {
    const id        = uuidv4();
    const timestamp = Date.now();
    const costUsd   = this._estimateCost(provider, model, inputTokens, outputTokens);

    this.db.prepare(
      'INSERT INTO messages (id,provider,model,timestamp,input_tokens,output_tokens,cost_usd,queue_item_id,conversation_id) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(id, provider, model, timestamp, inputTokens, outputTokens, costUsd, queueItemId, conversationId);

    // Invalidate cached status so the next canSend/getStatus reflects this message
    this._statusCache.delete(provider);

    return { id, provider, costUsd };
  }

  getStatusAll() {
    const result = {};
    for (const name of Object.keys(RATE_LIMITS)) result[name] = this.getStatus(name);
    return result;
  }

  getStatus(provider) {
    // Short-lived cache (1 s) — getStatus is called for every provider on every
    // router tick and every IPC getUsageAll. Without caching this fires 36+ queries
    // per second at full usage. Invalidated immediately on recordMessage/setBudget.
    const now     = Date.now();
    const cached  = this._statusCache.get(provider);
    if (cached && cached.expiresAt > now) return cached.data;

    const limits  = RATE_LIMITS[provider] || {};
    const oneMin  = 60_000, oneDay = 86_400_000, oneMonth = 2_592_000_000;

    const lastMin   = this.db.prepare('SELECT * FROM messages WHERE provider=? AND timestamp>=? ORDER BY timestamp ASC').all(provider, now - oneMin);
    const lastDay   = this.db.prepare('SELECT * FROM messages WHERE provider=? AND timestamp>=?').all(provider, now - oneDay);
    const lastMonth = this.db.prepare('SELECT * FROM messages WHERE provider=? AND timestamp>=?').all(provider, now - oneMonth);

    const rpmUsed    = lastMin.length;
    const rpdUsed    = lastDay.length;
    const tokLastMin = lastMin.reduce((s, m) => s + (m.input_tokens || 0) + (m.output_tokens || 0), 0);
    const costMonth  = lastMonth.reduce((s, m) => s + (m.cost_usd || 0), 0);
    const totalIn    = lastMonth.reduce((s, m) => s + (m.input_tokens || 0), 0);
    const totalOut   = lastMonth.reduce((s, m) => s + (m.output_tokens || 0), 0);

    const rpmHead = limits.rpm ? Math.max(0, limits.rpm - rpmUsed)    : Infinity;
    const rpdHead = limits.rpd ? Math.max(0, limits.rpd - rpdUsed)    : Infinity;
    const tpmHead = limits.tpm ? Math.max(0, limits.tpm - tokLastMin) : Infinity;
    const rateOk   = rpmHead > 0 && rpdHead > 0 && tpmHead > 0;

    // Budget block: $0 budget on a paid provider = hard block (no requests sent)
    const budgetBlocked = this.isBudgetBlocked(provider);
    const canSend = rateOk && !budgetBlocked;

    let nextSlotMs = 0;
    if (!rateOk && lastMin.length > 0) {
      nextSlotMs = Math.max(0, (lastMin[0].timestamp + oneMin) - now);
    }

    // null = no limit set; 0 = hard block; positive = monthly cap in USD
    const budget    = this._budgets[provider] ?? null;
    const budgetPct = (budget !== null && budget > 0)
      ? Math.min(100, Math.round((costMonth / budget) * 100))
      : null;

    const result = {
      provider, canSend, nextSlotMs, limits,
      requests: { lastMin: rpmUsed, lastDay: rpdUsed },
      tokens:   { totalIn, totalOut, totalAll: totalIn + totalOut },
      cost:     { lastMonth: +costMonth.toFixed(6), budget, budgetPct, budgetBlocked },
      headroom: {
        rpm: rpmHead === Infinity ? null : rpmHead,
        rpd: rpdHead === Infinity ? null : rpdHead,
        tpm: tpmHead === Infinity ? null : tpmHead,
      },
      timestamp: now,
    };

    this._statusCache.set(provider, { data: result, expiresAt: now + 1_000 });
    return result;
  }

  getHistory(provider, limit = 50) {
    return this.db.prepare(
      'SELECT * FROM messages WHERE provider=? ORDER BY timestamp DESC LIMIT ?'
    ).all(provider, limit);
  }

  canSend(provider)         { return this.getStatus(provider).canSend; }
  msUntilNextSlot(provider) { const s = this.getStatus(provider); return s.canSend ? 0 : s.nextSlotMs; }

  /**
   * Returns true when a provider is hard-blocked because its budget is
   * explicitly set to $0.  Local providers (Ollama, LM Studio) are exempt —
   * they are always $0/request so blocking them by budget makes no sense.
   */
  isBudgetBlocked(provider) {
    if (this._budgets[provider] !== 0) return false;
    // Local providers cost $0/request regardless — $0 budget should not block them
    const costs = COST_TABLE[provider];
    if (!costs) return false;
    return Object.values(costs).some(([inRate = 0]) => inRate > 0);
  }

  /**
   * Set a monthly spend budget.
   *   null / '' / undefined  →  remove limit entirely
   *   0                      →  hard-block spending on this provider
   *   positive number        →  soft monthly cap in USD
   */
  setBudget(provider, usd) {
    this._statusCache.delete(provider);   // budget change must invalidate cached status
    if (usd === null || usd === undefined || usd === '') {
      // No limit — remove the stored entry
      this._budgets[provider] = null;
      this.db.prepare("DELETE FROM settings WHERE key=?").run(`budget.${provider}`);
    } else {
      const amount = parseFloat(usd);
      if (isNaN(amount)) {
        this._budgets[provider] = null;
        this.db.prepare("DELETE FROM settings WHERE key=?").run(`budget.${provider}`);
      } else {
        this._budgets[provider] = amount;
        this.db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(
          `budget.${provider}`, String(amount)
        );
      }
    }
  }

  getBudgets() { return { ...this._budgets }; }

  _estimateCost(provider, model, inputTokens, outputTokens) {
    const [inRate = 0, outRate = 0] = COST_TABLE[provider]?.[model] || [];
    return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
  }

  /**
   * Public cost estimator — same maths as _estimateCost but callable from
   * outside the class (e.g. IPC handlers, tests).
   *
   * @param {string} provider      - e.g. 'anthropic'
   * @param {string} model         - e.g. 'claude-haiku-4-5'
   * @param {number} inputTokens   - estimated input tokens (use charCount/4 as proxy)
   * @param {number} outputTokens  - max output tokens (from queue item)
   * @returns {number}             - estimated cost in USD
   */
  estimateCost(provider, model, inputTokens, outputTokens) {
    return this._estimateCost(provider, model, inputTokens, outputTokens);
  }
}

module.exports = { MultiUsageTracker, RATE_LIMITS, COST_TABLE };
