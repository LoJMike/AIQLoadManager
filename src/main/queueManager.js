/**
 * COMPONENT 2: Queue Manager
 *
 * Manages a persistent queue of prompt inputs.
 * Each item can be routed to:
 *   - A new conversation
 *   - An existing project (by project ID / name)
 *   - A specific conversation ID
 *
 * Processing loop:
 *   - Checks usage capacity before each send
 *   - If at limit, waits until next slot opens
 *   - Sends in priority order (manual ordering supported)
 *   - Emits events back to the renderer via the push callback
 */

const path = require('path');
const { v4: uuidv4 } = require('./uuid');
const { app } = require('electron');

let Database;
try { Database = require('better-sqlite3'); } catch { Database = null; }

// Queue item statuses
const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

class QueueManager {
  /**
   * @param {AnthropicClient} anthropicClient
   * @param {UsageTracker} usageTracker
   * @param {Function} pushEvent - (eventName, data) => void  — sends to renderer
   */
  constructor(anthropicClient, usageTracker, pushEvent) {
    this.client = anthropicClient;
    this.tracker = usageTracker;
    this.push = pushEvent;

    this.paused = false;
    this.processing = false;
    this._timer = null;
    this._waitTimer = null;

    const dataPath = path.join(
      app ? app.getPath('userData') : '/tmp',
      'claude-queue.db'
    );

    if (Database) {
      // Reuse the same DB file as UsageTracker
      this.db = new Database(dataPath);
      this._initSchema();
      this._resetStuckItems();
    } else {
      this._memory = { queue: [], projects: [] };
      this.db = null;
    }
  }

  // ── Schema ─────────────────────────────────────────────────────────────────

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id            TEXT PRIMARY KEY,
        prompt        TEXT NOT NULL,
        system_prompt TEXT,
        project_id    TEXT,
        project_name  TEXT,
        conversation_id TEXT,
        target_type   TEXT DEFAULT 'new',
        status        TEXT DEFAULT 'pending',
        priority      INTEGER DEFAULT 0,
        created_at    INTEGER NOT NULL,
        scheduled_for INTEGER,
        started_at    INTEGER,
        completed_at  INTEGER,
        response      TEXT,
        error         TEXT,
        model         TEXT DEFAULT 'claude-sonnet-4-5',
        max_tokens    INTEGER DEFAULT 1024,
        label         TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status   ON queue_items(status);
      CREATE INDEX IF NOT EXISTS idx_queue_priority ON queue_items(priority DESC, created_at ASC);

      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        created_at  INTEGER NOT NULL,
        color       TEXT DEFAULT '#6366f1'
      );
    `);
  }

  /** Reset any items stuck in 'processing' from a crash */
  _resetStuckItems() {
    if (!this.db) return;
    this.db.prepare(`
      UPDATE queue_items SET status = 'pending', started_at = NULL
      WHERE status = 'processing'
    `).run();
  }

  // ── Queue CRUD ─────────────────────────────────────────────────────────────

  addItem({
    prompt,
    systemPrompt = null,
    projectId = null,
    projectName = null,
    conversationId = null,
    targetType = 'new',       // 'new' | 'project' | 'conversation'
    scheduledFor = null,      // ISO timestamp or null (send ASAP)
    model = 'claude-sonnet-4-5',
    maxTokens = 1024,
    label = null,
  }) {
    if (!prompt?.trim()) throw new Error('Prompt cannot be empty');

    const id = uuidv4();
    const now = Date.now();
    const scheduledMs = scheduledFor ? new Date(scheduledFor).getTime() : null;

    if (this.db) {
      this.db.prepare(`
        INSERT INTO queue_items
          (id, prompt, system_prompt, project_id, project_name, conversation_id,
           target_type, status, priority, created_at, scheduled_for, model, max_tokens, label)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?)
      `).run(id, prompt, systemPrompt, projectId, projectName, conversationId,
             targetType, now, scheduledMs, model, maxTokens, label);
    } else {
      this._memory.queue.push({
        id, prompt, system_prompt: systemPrompt, project_id: projectId,
        project_name: projectName, conversation_id: conversationId,
        target_type: targetType, status: STATUS.PENDING, priority: 0,
        created_at: now, scheduled_for: scheduledMs, model, max_tokens: maxTokens,
        label, started_at: null, completed_at: null, response: null, error: null,
      });
    }

    const item = this._getItem(id);
    this.push('queue-update', { action: 'added', item });
    return item;
  }

  removeItem(id) {
    if (this.db) {
      const item = this._getItem(id);
      if (item?.status === STATUS.PROCESSING) {
        throw new Error('Cannot remove an item currently being processed');
      }
      this.db.prepare('DELETE FROM queue_items WHERE id = ?').run(id);
    } else {
      this._memory.queue = this._memory.queue.filter(i => i.id !== id);
    }
    this.push('queue-update', { action: 'removed', id });
    return { success: true };
  }

  reorderItem(id, direction) {
    // direction: 'up' | 'down' — adjust priority
    const item = this._getItem(id);
    if (!item) throw new Error('Item not found');
    const delta = direction === 'up' ? 1 : -1;
    if (this.db) {
      this.db.prepare('UPDATE queue_items SET priority = priority + ? WHERE id = ?').run(delta, id);
    } else {
      item.priority += delta;
    }
    this.push('queue-update', { action: 'reordered', id });
    return this.getQueue();
  }

  clearCompleted() {
    if (this.db) {
      this.db.prepare("DELETE FROM queue_items WHERE status IN ('complete', 'cancelled')").run();
    } else {
      this._memory.queue = this._memory.queue.filter(
        i => i.status !== STATUS.COMPLETE && i.status !== STATUS.CANCELLED
      );
    }
    this.push('queue-update', { action: 'cleared' });
    return { success: true };
  }

  retryItem(id) {
    if (this.db) {
      this.db.prepare(`
        UPDATE queue_items
        SET status = 'pending', error = NULL, started_at = NULL, completed_at = NULL, response = NULL
        WHERE id = ? AND status IN ('error', 'cancelled')
      `).run(id);
    } else {
      const item = this._memory.queue.find(i => i.id === id);
      if (item) Object.assign(item, { status: STATUS.PENDING, error: null, response: null });
    }
    this.push('queue-update', { action: 'retry', id });
    return this._getItem(id);
  }

  getQueue() {
    if (this.db) {
      return this.db.prepare(`
        SELECT * FROM queue_items ORDER BY priority DESC, created_at ASC
      `).all();
    }
    return [...this._memory.queue].sort((a, b) =>
      b.priority - a.priority || a.created_at - b.created_at
    );
  }

  getState() {
    return {
      paused: this.paused,
      processing: this.processing,
    };
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  getProjects() {
    if (this.db) {
      return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    }
    return this._memory.projects;
  }

  addProject({ name, description = '', color = '#6366f1' }) {
    const id = uuidv4();
    const now = Date.now();
    if (this.db) {
      this.db.prepare(
        'INSERT INTO projects (id, name, description, created_at, color) VALUES (?, ?, ?, ?, ?)'
      ).run(id, name, description, now, color);
    } else {
      this._memory.projects.push({ id, name, description, created_at: now, color });
    }
    return this._getProject(id);
  }

  deleteProject(id) {
    if (this.db) {
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    } else {
      this._memory.projects = this._memory.projects.filter(p => p.id !== id);
    }
    return { success: true };
  }

  // ── Processing Loop ────────────────────────────────────────────────────────

  startProcessing() {
    if (this._timer) return;
    this._tick();
  }

  stopProcessing() {
    if (this._timer) clearTimeout(this._timer);
    if (this._waitTimer) clearTimeout(this._waitTimer);
    this._timer = null;
  }

  pause() {
    this.paused = true;
    this.push('queue-update', { action: 'paused' });
    return { paused: true };
  }

  resume() {
    this.paused = false;
    this.push('queue-update', { action: 'resumed' });
    this._tick();
    return { paused: false };
  }

  async _tick() {
    if (this.paused || this.processing) {
      this._timer = setTimeout(() => this._tick(), 2000);
      return;
    }

    const next = this._getNextPending();
    if (!next) {
      // Nothing to do — poll every 3s
      this._timer = setTimeout(() => this._tick(), 3000);
      return;
    }

    // Check if it's scheduled for the future
    if (next.scheduled_for && next.scheduled_for > Date.now()) {
      const delay = Math.min(next.scheduled_for - Date.now(), 30000);
      this._timer = setTimeout(() => this._tick(), delay);
      return;
    }

    // Check usage capacity
    const waitMs = this.tracker.msUntilNextSlot();
    if (waitMs > 0) {
      console.log(`[Queue] At usage limit. Waiting ${Math.ceil(waitMs / 1000)}s for next slot.`);
      this.push('usage-update', {
        waiting: true,
        waitMs,
        nextSlotTime: this.tracker.getStatus().nextSlotTime,
      });
      this._timer = setTimeout(() => this._tick(), Math.min(waitMs + 500, 60000));
      return;
    }

    // Send it
    await this._processItem(next);
    // Small gap between sends to avoid hammering
    this._timer = setTimeout(() => this._tick(), 1500);
  }

  async _processItem(item) {
    this.processing = true;
    this._setStatus(item.id, STATUS.PROCESSING, { started_at: Date.now() });
    this.push('queue-update', { action: 'processing', id: item.id });

    try {
      const result = await this.client.sendMessage({
        prompt: item.prompt,
        systemPrompt: item.system_prompt,
        model: item.model || 'claude-sonnet-4-5',
        maxTokens: item.max_tokens || 1024,
        projectId: item.project_id,
        conversationId: item.conversation_id,
        queueItemId: item.id,
      });

      this._setStatus(item.id, STATUS.COMPLETE, {
        completed_at: Date.now(),
        response: result.response,
      });

      this.push('item-complete', {
        id: item.id,
        label: item.label || item.prompt.slice(0, 60),
        response: result.response,
        usage: result.usage,
      });

      this.push('usage-update', this.tracker.getStatus());

    } catch (err) {
      const errMsg = err.message || String(err);
      this._setStatus(item.id, STATUS.ERROR, { error: errMsg });
      this.push('item-error', { id: item.id, error: errMsg });
      console.error(`[Queue] Error processing item ${item.id}:`, err);
    } finally {
      this.processing = false;
    }
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  _getNextPending() {
    if (this.db) {
      return this.db.prepare(`
        SELECT * FROM queue_items
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `).get() || null;
    }
    const sorted = this._memory.queue
      .filter(i => i.status === STATUS.PENDING)
      .sort((a, b) => b.priority - a.priority || a.created_at - b.created_at);
    return sorted[0] || null;
  }

  _getItem(id) {
    if (this.db) return this.db.prepare('SELECT * FROM queue_items WHERE id = ?').get(id);
    return this._memory.queue.find(i => i.id === id);
  }

  _getProject(id) {
    if (this.db) return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return this._memory.projects.find(p => p.id === id);
  }

  _setStatus(id, status, extra = {}) {
    if (this.db) {
      const fields = Object.keys(extra).map(k => `${k} = ?`).join(', ');
      const values = Object.values(extra);
      this.db.prepare(
        `UPDATE queue_items SET status = ?${fields ? ', ' + fields : ''} WHERE id = ?`
      ).run(status, ...values, id);
    } else {
      const item = this._memory.queue.find(i => i.id === id);
      if (item) Object.assign(item, { status, ...extra });
    }
  }
}

module.exports = { QueueManager, STATUS };
