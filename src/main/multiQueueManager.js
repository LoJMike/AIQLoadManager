/**
 * MultiQueueManager — synchronous open(), uses node:sqlite built-in
 */

'use strict';

/**
 * Priority boost per tag, split by license tier.
 *
 * Free tier  — only ⚡ Urgent gives a priority bump. All other tags are
 *              purely for routing and display.
 *
 * Paid tier  — every tag contributes to priority, so tagged prompts naturally
 *              jump ahead of untagged ones. Urgent doubles its boost.
 *
 * Priority is computed in the IPC layer (index-v2.js) so the renderer
 * cannot manipulate it directly — it only sends a `tags` string array.
 */
const TAG_PRIORITY = {
  free: {
    urgent: 10,
  },
  paid: {
    chat:       2,
    research:   8,
    code:       8,
    web_search: 6,
    writing:    4,
    analysis:   6,
    image:      5,
    translate:  2,
    urgent:     20,
  },
};

/**
 * Derive the routing task_type from a tags array.
 * The first tag that maps to a known task type wins; 'urgent' is a modifier
 * and has no task type of its own.
 */
const TAG_TO_TASK_TYPE = {
  chat:       'general',
  research:   'research',
  code:       'coding',
  web_search: 'research',
  writing:    'general',
  analysis:   'research',
  image:      'graphics',
  translate:  'general',
};

function tagsToTaskType(tags = []) {
  for (const tag of tags) {
    if (TAG_TO_TASK_TYPE[tag]) return TAG_TO_TASK_TYPE[tag];
  }
  return 'general';
}

/**
 * Compute a numeric priority value for a queue item.
 * @param {string[]} tags     - selected tag IDs
 * @param {boolean}  isPaid   - whether the user has an active paid license
 * @returns {number}
 */
function computePriority(tags = [], isPaid = false) {
  const weights = isPaid ? TAG_PRIORITY.paid : TAG_PRIORITY.free;
  return tags.reduce((sum, tag) => sum + (weights[tag] || 0), 0);
}

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
    this.registry    = providerRegistry;
    this.tracker     = multiUsageTracker;
    this.router      = queueRouter;
    this.push        = pushEvent;
    this.webSearch   = null;   // set via setWebSearch() after construction
    this.paused      = false;
    this.processing  = false;
    this._timer      = null;
    this.db          = null;
  }

  /** Attach the WebSearchService. Called from index-v2.js after both are constructed. */
  setWebSearch(service) { this.webSearch = service; }

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
        tags            TEXT DEFAULT '[]',
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
        error            TEXT,
        routing_reason   TEXT,
        compare_providers TEXT DEFAULT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        color       TEXT DEFAULT '#6366f1',
        created_at  INTEGER NOT NULL
      )
    `);

    // Migrations — silent ALTER TABLE for columns added in later versions
    try { this.db.exec("ALTER TABLE queue_items ADD COLUMN tags TEXT DEFAULT '[]'"); }             catch (_) {}
    try { this.db.exec("ALTER TABLE queue_items ADD COLUMN compare_providers TEXT DEFAULT NULL"); } catch (_) {}
  }

  _resetStuck() {
    this.db.prepare(
      "UPDATE queue_items SET status='pending', started_at=NULL WHERE status='processing'"
    ).run();
  }

  // ── Queue CRUD ──────────────────────────────────────────────────────────────

  addItem({ prompt, label=null, systemPrompt=null, provider=null, routingMode='auto',
            taskType='general', tags=[], model=null, maxTokens=1024, projectId=null,
            projectName=null, conversationId=null, scheduledFor=null, priority=0,
            compareProviders=null }) {
    if (!prompt?.trim()) throw new Error('Prompt cannot be empty');
    const id           = uuidv4();
    const now          = Date.now();
    const tagsJson     = JSON.stringify(Array.isArray(tags) ? tags : []);
    const scheduledMs  = scheduledFor ? new Date(scheduledFor).getTime() : null;
    const compareJson  = Array.isArray(compareProviders) && compareProviders.length >= 2
                           ? JSON.stringify(compareProviders) : null;

    this.db.prepare(
      `INSERT INTO queue_items
       (id,label,prompt,system_prompt,provider,routing_mode,task_type,tags,model,max_tokens,
        project_id,project_name,conversation_id,compare_providers,status,priority,created_at,scheduled_for)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`
    ).run(id, label, prompt, systemPrompt, provider, routingMode, taskType, tagsJson, model,
          maxTokens, projectId, projectName, conversationId, compareJson, priority, now, scheduledMs);

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

    // Compare items bypass the router — they fan out to multiple named providers directly
    if (next.compare_providers) {
      await this._processCompareItem(next);
      this._timer = setTimeout(() => this._tick(), 1500);
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

  /**
   * If the item has the web_search tag and a search backend is configured,
   * run a search and prepend the results to the system prompt.
   * Fails silently on search errors — the prompt still goes through unchanged.
   *
   * @param {object} item  — raw DB row
   * @returns {{ prompt: string, systemPrompt: string|null }}
   */
  async _enrichWithWebSearch(item) {
    let prompt       = item.prompt;
    let systemPrompt = item.system_prompt || null;

    if (!this.webSearch?.isConfigured()) return { prompt, systemPrompt };

    let tags = [];
    try { tags = JSON.parse(item.tags || '[]'); } catch (_) {}
    if (!tags.includes('web_search')) return { prompt, systemPrompt };

    try {
      const results = await this.webSearch.search(prompt);
      if (results && results.length > 0) {
        const context = this.webSearch.formatContext(results, prompt.slice(0, 150));
        systemPrompt  = systemPrompt ? `${context}\n\n${systemPrompt}` : context;
      }
    } catch (err) {
      // Log but don't fail the queue item — degraded gracefully
      console.warn('[WebSearch] search failed, proceeding without context:', err.message);
    }

    return { prompt, systemPrompt };
  }

  async _processItem(item, decision) {
    this.processing = true;
    this._set(item.id, { status: STATUS.PROCESSING, started_at: Date.now() });
    this.push('queue-update', { action: 'processing', id: item.id, provider: decision.provider });

    try {
      const { prompt, systemPrompt } = await this._enrichWithWebSearch(item);

      const result = await this.registry.sendMessage(decision.provider, {
        prompt,
        systemPrompt,
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

  /**
   * Fan-out a compare item to multiple providers in parallel.
   * Uses Promise.allSettled so a single provider failure doesn't abort the rest.
   * Response is stored as a JSON array: [{provider, model, response, usage, error}].
   */
  async _processCompareItem(item) {
    this.processing = true;
    let providers = [];
    try { providers = JSON.parse(item.compare_providers || '[]'); } catch (_) {}

    this._set(item.id, { status: STATUS.PROCESSING, started_at: Date.now() });
    this.push('queue-update', { action: 'processing', id: item.id, provider: 'compare' });

    // Enrich with web search context once — all providers get the same context block
    const { prompt, systemPrompt } = await this._enrichWithWebSearch(item);

    const settled = await Promise.allSettled(
      providers.map(providerName =>
        this.registry.sendMessage(providerName, {
          prompt,
          systemPrompt,
          model:       null,                // each provider uses its own default
          maxTokens:   item.max_tokens || 1024,
          queueItemId: item.id,
        })
      )
    );

    const results = settled.map((outcome, i) => {
      const providerName = providers[i];
      if (outcome.status === 'fulfilled') {
        return {
          provider: outcome.value.provider || providerName,
          model:    outcome.value.model,
          response: outcome.value.response,
          usage:    outcome.value.usage,
          error:    null,
        };
      }
      return {
        provider: providerName,
        model:    null,
        response: null,
        usage:    null,
        error:    outcome.reason?.message || String(outcome.reason),
      };
    });

    const succeeded = results.filter(r => r.response !== null);

    if (succeeded.length === 0) {
      const errMsg = results.map(r => `${r.provider}: ${r.error}`).join('; ');
      this._set(item.id, { status: STATUS.ERROR, error: `All providers failed — ${errMsg}` });
      this.push('item-error', { id: item.id, provider: 'compare', error: errMsg });
    } else {
      this._set(item.id, {
        status:        STATUS.COMPLETE,
        completed_at:  Date.now(),
        response:      JSON.stringify(results),
        used_provider: 'compare',
        used_model:    results.filter(r => r.model).map(r => r.model).join(', '),
        input_tokens:  results.reduce((s, r) => s + (r.usage?.inputTokens  || 0), 0),
        output_tokens: results.reduce((s, r) => s + (r.usage?.outputTokens || 0), 0),
      });
      this.push('item-compare-complete', {
        id:      item.id,
        label:   item.label || item.prompt.slice(0, 60),
        results,
      });
      this.push('usage-update', { allStatus: this.tracker.getStatusAll() });
    }

    this.processing = false;
  }

  _getItem(id) {
    return this.db.prepare('SELECT * FROM queue_items WHERE id=?').get(id);
  }

  _set(id, fields) {
    const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
    this.db.prepare(`UPDATE queue_items SET ${sets} WHERE id=?`).run(...Object.values(fields), id);
  }
}

module.exports = { MultiQueueManager, STATUS, TAG_PRIORITY, TAG_TO_TASK_TYPE, tagsToTaskType, computePriority };
