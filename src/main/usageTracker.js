/**
 * COMPONENT 1: Usage Tracker
 *
 * Tracks every message sent to Claude with timestamps.
 * Maintains a rolling 5-hour window to estimate remaining capacity.
 * Persists data to SQLite so it survives app restarts.
 *
 * Claude Pro plan limits (approximate, as of 2025):
 *   - ~45 messages per 5-hour rolling window (claude.ai web)
 *   - API usage is separate and controlled by your own rate limits
 *
 * Since Anthropic doesn't expose a usage API for claude.ai,
 * this tracker counts messages YOU send through this app.
 * For direct API usage, it tracks tokens consumed.
 */

const path = require('path');
const { app } = require('electron');

// We lazy-require better-sqlite3 so tests can mock it
let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = null;
}

// Plan limits config — adjust to match your actual plan
const PLAN_LIMITS = {
  pro: { messages: 45, windowHours: 5 },
  team: { messages: 100, windowHours: 5 },
  api: { messages: Infinity, windowHours: 5 }, // API uses token limits instead
};

class UsageTracker {
  constructor(dbPath = null) {
    const dataPath = dbPath || path.join(
      app ? app.getPath('userData') : '/tmp',
      'claude-queue.db'
    );

    if (Database) {
      this.db = new Database(dataPath);
      this._initSchema();
    } else {
      // Fallback in-memory store for environments without SQLite
      this._memory = { messages: [], settings: { plan: 'pro', dailyReset: null } };
      this.db = null;
    }

    this.plan = this._getSetting('plan') || 'pro';
    this.customLimit = parseInt(this._getSetting('customLimit') || '0', 10);
  }

  // ── Schema ────────────────────────────────────────────────────────────────

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id          TEXT PRIMARY KEY,
        timestamp   INTEGER NOT NULL,
        model       TEXT,
        input_tokens  INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        project_id  TEXT,
        queue_item_id TEXT,
        status      TEXT DEFAULT 'sent'
      );

      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  // ── Core Tracking ─────────────────────────────────────────────────────────

  /**
   * Record a message that was just sent.
   * Returns the full updated status object.
   */
  recordMessage({ id, model = 'claude-sonnet-4-5', inputTokens = 0, outputTokens = 0, projectId = null, queueItemId = null }) {
    const timestamp = Date.now();
    const msgId = id || require('./uuid').v4();

    if (this.db) {
      this.db.prepare(`
        INSERT INTO messages (id, timestamp, model, input_tokens, output_tokens, project_id, queue_item_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, timestamp, model, inputTokens, outputTokens, projectId, queueItemId);
    } else {
      this._memory.messages.push({ id: msgId, timestamp, model, input_tokens: inputTokens, output_tokens: outputTokens });
    }

    return this.getStatus();
  }

  /**
   * Get current usage status.
   * Returns everything the GUI needs to render the usage dashboard.
   */
  getStatus() {
    const now = Date.now();
    const windowMs = PLAN_LIMITS[this.plan]?.windowHours * 60 * 60 * 1000 || 5 * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    const recentMessages = this._getMessagesAfter(windowStart);
    const limit = this.customLimit || PLAN_LIMITS[this.plan]?.messages || 45;
    const used = recentMessages.length;
    const remaining = Math.max(0, limit - used);
    const pct = Math.min(100, Math.round((used / limit) * 100));

    // Find when the OLDEST message in window will expire (= next slot opens)
    let nextSlotMs = null;
    let nextSlotTime = null;
    if (used >= limit && recentMessages.length > 0) {
      const oldest = recentMessages[0]; // sorted ASC
      nextSlotMs = (oldest.timestamp + windowMs) - now;
      nextSlotTime = new Date(oldest.timestamp + windowMs).toISOString();
    }

    // Window resets fully when oldest message leaves the window
    const windowResetTime = recentMessages.length > 0
      ? new Date(recentMessages[0].timestamp + windowMs).toISOString()
      : null;

    // Token stats for API users
    const tokenStats = recentMessages.reduce((acc, m) => {
      acc.inputTokens += (m.input_tokens || 0);
      acc.outputTokens += (m.output_tokens || 0);
      return acc;
    }, { inputTokens: 0, outputTokens: 0 });

    return {
      plan: this.plan,
      limit,
      used,
      remaining,
      pct,
      isAtLimit: used >= limit,
      nextSlotMs,
      nextSlotTime,
      windowResetTime,
      windowHours: PLAN_LIMITS[this.plan]?.windowHours || 5,
      windowStart: new Date(windowStart).toISOString(),
      tokenStats,
      timestamp: now,
    };
  }

  /**
   * Get recent message history for the log view.
   */
  getHistory(limit = 50) {
    if (this.db) {
      return this.db.prepare(`
        SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?
      `).all(limit);
    }
    return [...this._memory.messages].reverse().slice(0, limit);
  }

  /**
   * Manually set the plan type.
   */
  setPlan(plan) {
    if (!PLAN_LIMITS[plan]) throw new Error(`Unknown plan: ${plan}`);
    this.plan = plan;
    this._setSetting('plan', plan);
    return this.getStatus();
  }

  /**
   * Set a custom message limit (overrides plan default).
   */
  setCustomLimit(n) {
    this.customLimit = parseInt(n, 10);
    this._setSetting('customLimit', String(this.customLimit));
    return this.getStatus();
  }

  /**
   * Reset all tracked messages (for testing / manual reset).
   */
  reset() {
    if (this.db) {
      this.db.prepare('DELETE FROM messages').run();
    } else {
      this._memory.messages = [];
    }
    return this.getStatus();
  }

  /**
   * How many ms until the next message slot opens.
   * Returns 0 if there's capacity now.
   */
  msUntilNextSlot() {
    const status = this.getStatus();
    if (!status.isAtLimit) return 0;
    return status.nextSlotMs || 0;
  }

  /**
   * Can we send right now?
   */
  canSend() {
    return !this.getStatus().isAtLimit;
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  _getMessagesAfter(timestampMs) {
    if (this.db) {
      return this.db.prepare(
        'SELECT * FROM messages WHERE timestamp >= ? ORDER BY timestamp ASC'
      ).all(timestampMs);
    }
    return this._memory.messages
      .filter(m => m.timestamp >= timestampMs)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  _getSetting(key) {
    if (this.db) {
      const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row?.value ?? null;
    }
    return this._memory.settings[key] ?? null;
  }

  _setSetting(key, value) {
    if (this.db) {
      this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    } else {
      this._memory.settings[key] = value;
    }
  }
}

module.exports = { UsageTracker, PLAN_LIMITS };
