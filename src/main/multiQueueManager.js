/**
 * MultiQueueManager — synchronous open(), uses node:sqlite built-in
 */

'use strict';

const path = require('path');
const { app } = require('electron');
const { openDatabase } = require('./db');
const { v4: uuidv4 } = require('./uuid');

const STATUS = {
  PENDING: 'pending', PROCESSING: 'processing',
  COMPLETE: 'complete', ERROR: 'error', CANCELLED: 'cancelled',
};

class MultiQueueManager {
  constructor(providerRegistry, multiUsageTracker, queueRouter, pushEvent) {
    this.registry   = providerRegistry;
    this.tracker    = multiUsageTracker;
    this.router     = queueRouter;
    this.push       = pushEvent;
    this.paused     = false;
    this.processing = false;
    this._timer     = null;
    this.db         = null;
  }

  /** Synchronous open — call before using */
  open(dbPath) {
    const p = dbPath || path.join(
      app ? app.getPath('userData') : require('os').tmpdir(),
      'ai-queue.db'
    );
    this.db = openDatabase(p);
    this._initSchema();
    this._resetStuck();
    return this;
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id              TEXT PRIMARY KEY,
        label           TEXT,
        prompt          TEXT NOT NULL,
        system_prompt   TEXT,
        provider        TEXT,
        routing_mode    TEXT DEFAULT 'auto',
        task_type       TEXT DEFAULT 'general',
        model           TEXT,
        max_tokens      INTEGER DEFAULT 1024,
        project_id      TEXT,
        project_name    TEXT,
        conversation_id TEXT,
        status          TEXT DEFAULT 'pending',
        priority        INTEGER DEFAULT 0,
        created_at      INTEGER NOT NULL,
        scheduled_for   INTEGER,
        started_at      INTEGER,
        completed_at    INTEGER,
        response        TEXT,
        used_provider   TEXT,
        used_model      TEXT,
        input_tokens    INTEGER DEFAULT 0,
        output_tokens   INTEGER DEFAULT 0,
        cost_usd        REAL DEFAULT 0,
        error           TEXT,
        routing_reason  TEXT
      );
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        color       TEXT DEFAULT '#6366f1',
        created_at  INTEGER NOT NULL
      )
    `);
  }

  _resetStuck() {
    this.db.prepare(
      "UPDATE queue_items SET status='pending', started_at=NULL WHERE status='processing'"
    ).run();
  }

  // ── Queue CRUD ──────────────────────────────────────────────────────────────

  addItem({ prompt, label=null, systemPrompt=null, provider=null, routingMode='auto',
            taskType='general', model=null, maxTokens=1024, projectId=null,
            projectName=null, conversationId=null, scheduledFor=null }) {
    if (!prompt?.trim()) throw new Error('Prompt cannot be empty');
    const id  = uuidv4();
    const now = Date.now();
    const scheduledMs = scheduledFor ? new Date(scheduledFor).getTime() : null;

    this.db.prepare(
      `INSERT INTO queue_items
       (id,label,prompt,system_prompt,provider,routing_mode,task_type,model,max_tokens,
        project_id,project_name,conversation_id,status,priority,created_at,scheduled_for)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending',0,?,?)`
    ).run(id, label, prompt, systemPrompt, provider, routingMode, taskType, model,
          maxTokens, projectId, projectName, conversationId, now, scheduledMs);

    const item = this._getItem(id);
    this.push('queue-update', { action: 'added', item });
    return item;
  }

  removeItem(id) {
    const item = this._getItem(id);
    if (item?.status === STATUS.PROCESSING) throw new Error('Cannot remove item being processed');
    this.db.prepare('DELETE FROM queue_items WHERE id=?').run(id);
    this.push('queue-update', { action: 'removed', id });
    return { success: true };
  }

  retryItem(id) {
    this.db.prepare(
      "UPDATE queue_items SET status='pending',error=NULL,started_at=NULL,completed_at=NULL,response=NULL,used_provider=NULL,used_model=NULL WHERE id=? AND status IN ('error','cancelled')"
    ).run(id);
    this.push('queue-update', { action: 'retry', id });
    return this._getItem(id);
  }

  clearCompleted() {
    this.db.prepare("DELETE FROM queue_items WHERE status IN ('complete','cancelled')").run();
    this.push('queue-update', { action: 'cleared' });
  }

  reorderItem(id, direction) {
    this.db.prepare('UPDATE queue_items SET priority=priority+? WHERE id=?').run(
      direction === 'up' ? 1 : -1, id
    );
    this.push('queue-update', { action: 'reordered', id });
    return this.getQueue();
  }

  getQueue() {
    return this.db.prepare('SELECT * FROM queue_items ORDER BY priority DESC, created_at ASC').all();
  }

  getState() { return { paused: this.paused, processing: this.processing }; }

  // ── Projects ────────────────────────────────────────────────────────────────

  getProjects() {
    return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  }

  addProject({ name, description = '', color = '#6366f1' }) {
    const id = uuidv4(), now = Date.now();
    this.db.prepare(
      'INSERT INTO projects (id,name,description,color,created_at) VALUES (?,?,?,?,?)'
    ).run(id, name, description, color, now);
    return this.db.prepare('SELECT * FROM projects WHERE id=?').get(id);
  }

  deleteProject(id) {
    this.db.prepare('DELETE FROM projects WHERE id=?').run(id);
    return { success: true };
  }

  // ── Processing Loop ─────────────────────────────────────────────────────────

  startProcessing() { if (!this._timer) this._tick(); }
  stopProcessing()  { if (this._timer) clearTimeout(this._timer); this._timer = null; }

  pause()  { this.paused = true;  this.push('queue-update', { action: 'paused'  }); return { paused: true  }; }
  resume() { this.paused = false; this.push('queue-update', { action: 'resumed' }); this._tick(); return { paused: false }; }

  async _tick() {
    if (this.paused || this.processing) {
      this._timer = setTimeout(() => this._tick(), 2000);
      return;
    }

    const next = this.db.prepare(
      "SELECT * FROM queue_items WHERE status='pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
    ).get();

    if (!next) { this._timer = setTimeout(() => this._tick(), 3000); return; }

    if (next.scheduled_for && next.scheduled_for > Date.now()) {
      this._timer = setTimeout(() => this._tick(), Math.min(next.scheduled_for - Date.now(), 30_000));
      return;
    }

    const decision = this.router.route(next);
    if (decision.wait) {
      const waitMs = Math.min(decision.waitMs || 5000, 60_000);
      this.push('usage-update', { waiting: true, waitMs, reason: decision.reason, allStatus: this.tracker.getStatusAll() });
      this._timer = setTimeout(() => this._tick(), waitMs + 500);
      return;
    }

    await this._processItem(next, decision);
    this._timer = setTimeout(() => this._tick(), 1500);
  }

  async _processItem(item, decision) {
    this.processing = true;
    this._set(item.id, { status: STATUS.PROCESSING, started_at: Date.now() });
    this.push('queue-update', { action: 'processing', id: item.id, provider: decision.provider });

    try {
      const result = await this.registry.sendMessage(decision.provider, {
        prompt:         item.prompt,
        systemPrompt:   item.system_prompt,
        model:          decision.model || item.model,
        maxTokens:      item.max_tokens || 1024,
        conversationId: item.conversation_id,
        projectId:      item.project_id,
        queueItemId:    item.id,
      });

      this._set(item.id, {
        status:         STATUS.COMPLETE,
        completed_at:   Date.now(),
        response:       result.response,
        used_provider:  result.provider,
        used_model:     result.model,
        input_tokens:   result.usage?.inputTokens  || 0,
        output_tokens:  result.usage?.outputTokens || 0,
        routing_reason: decision.reason,
      });

      this.push('item-complete', {
        id: item.id, label: item.label || item.prompt.slice(0, 60),
        provider: result.provider, model: result.model,
        response: result.response, usage: result.usage,
      });
      this.push('usage-update', { allStatus: this.tracker.getStatusAll() });

    } catch (err) {
      const msg = err.message || String(err);
      this._set(item.id, { status: STATUS.ERROR, error: msg });
      this.push('item-error', { id: item.id, provider: decision.provider, error: msg });
      console.error('[Queue] error on', item.id, ':', msg);
    } finally {
      this.processing = false;
    }
  }

  _getItem(id) {
    return this.db.prepare('SELECT * FROM queue_items WHERE id=?').get(id);
  }

  _set(id, fields) {
    const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
    this.db.prepare(`UPDATE queue_items SET ${sets} WHERE id=?`).run(...Object.values(fields), id);
  }
}

module.exports = { MultiQueueManager, STATUS };
