/**
 * ConversationStore — persists per-provider conversation histories to SQLite.
 *
 * Stores each message (user or assistant) as a numbered row so history
 * survives app restarts. Uses the same ai-queue.db file as MultiUsageTracker
 * and MultiQueueManager — WAL mode makes concurrent access safe.
 *
 * Design notes:
 *  - BaseProvider keeps an in-memory Map as the fast read path.
 *  - ConversationStore is the write-through persistence layer.
 *  - On startup, BaseProvider calls loadAll() once to warm the Map from DB.
 *  - Subsequent reads hit memory; writes go to both memory and DB.
 */

'use strict';

const path = require('path');
const { app } = require('electron');
const { openDatabase } = require('./db');

// Cap matches BaseProvider's in-memory cap (20 turns = 40 messages)
const MAX_MESSAGES = 40;

class ConversationStore {
  constructor() {
    this.db = null;
  }

  /**
   * Synchronous open — call before using.
   * Uses the same ai-queue.db path resolution as MultiUsageTracker.
   */
  open(dbPath) {
    const p = dbPath || path.join(
      app ? app.getPath('userData') : require('os').tmpdir(),
      'ai-queue.db'
    );
    this.db = openDatabase(p);
    this._initSchema();
    return this;
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        conv_id     TEXT    NOT NULL,
        provider    TEXT    NOT NULL,
        role        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        turn_index  INTEGER NOT NULL,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (conv_id, turn_index)
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conv_provider
        ON conversations (provider, conv_id)
    `);
  }

  /**
   * Load conversations for a provider from SQLite.
   * Returns a Map<convId, messages[]> — same shape as BaseProvider.conversations.
   * Called once at startup per provider to warm the in-memory cache.
   *
   * Only the 50 most-recently-active conversations are loaded. Loading every
   * historical conversation at startup could be thousands of rows for long-running
   * installs, most of which will never be referenced again.
   */
  loadAll(providerName) {
    const result = new Map();
    if (!this.db) return result;

    const rows = this.db.prepare(
      `SELECT conv_id, role, content
         FROM conversations
        WHERE provider = ?
          AND conv_id IN (
            SELECT conv_id FROM conversations
             WHERE provider = ?
             GROUP BY conv_id
             ORDER BY MAX(created_at) DESC
             LIMIT 50
          )
        ORDER BY conv_id, turn_index ASC`
    ).all(providerName, providerName);

    for (const row of rows) {
      if (!result.has(row.conv_id)) result.set(row.conv_id, []);
      result.get(row.conv_id).push({ role: row.role, content: row.content });
    }
    return result;
  }

  /**
   * Persist a completed user+assistant turn.
   * Automatically enforces the MAX_MESSAGES cap by pruning oldest rows.
   * All three writes run inside a single transaction — a crash mid-way can
   * no longer leave a conversation with the user message written but the
   * assistant reply missing.
   */
  appendTurn(providerName, convId, userMsg, assistantMsg) {
    if (!this.db) return;

    this.db.transaction(() => {
      // Determine the next available turn index for this conversation
      const last = this.db.prepare(
        `SELECT MAX(turn_index) AS max_idx
           FROM conversations
          WHERE conv_id = ? AND provider = ?`
      ).get(convId, providerName);

      const baseIdx = (last?.max_idx ?? -2) + 2; // two rows per turn

      this.db.prepare(
        `INSERT OR REPLACE INTO conversations
           (conv_id, provider, role, content, turn_index)
         VALUES (?, ?, 'user', ?, ?)`
      ).run(convId, providerName, userMsg, baseIdx);

      this.db.prepare(
        `INSERT OR REPLACE INTO conversations
           (conv_id, provider, role, content, turn_index)
         VALUES (?, ?, 'assistant', ?, ?)`
      ).run(convId, providerName, assistantMsg, baseIdx + 1);

      // Prune oldest rows so the conversation stays within the cap
      this.db.prepare(
        `DELETE FROM conversations
          WHERE conv_id = ? AND provider = ?
            AND turn_index NOT IN (
              SELECT turn_index
                FROM conversations
               WHERE conv_id = ? AND provider = ?
               ORDER BY turn_index DESC
               LIMIT ?
            )`
      ).run(convId, providerName, convId, providerName, MAX_MESSAGES);
    });
  }

  /** Delete all messages for a single conversation */
  clearConversation(providerName, convId) {
    if (!this.db) return;
    this.db.prepare(
      `DELETE FROM conversations WHERE conv_id = ? AND provider = ?`
    ).run(convId, providerName);
  }

  /** Delete all conversations for a provider (e.g. when API key is removed) */
  clearProvider(providerName) {
    if (!this.db) return;
    this.db.prepare(
      `DELETE FROM conversations WHERE provider = ?`
    ).run(providerName);
  }
}

module.exports = { ConversationStore };
