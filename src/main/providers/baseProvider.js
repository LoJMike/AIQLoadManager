/**
 * BaseProvider — abstract class every AI provider extends.
 * electron-store v8+ is ESM-only, so we load it via dynamic import().
 */

const { v4: uuidv4 } = require('../uuid');

class BaseProvider {
  constructor(name, usageTracker, store) {
    if (new.target === BaseProvider) throw new Error('BaseProvider is abstract');
    this.name      = name;
    this.tracker   = usageTracker;
    this.store     = store;           // electron-store instance (may be null)
    this.convStore = null;            // ConversationStore (wired in after construction)
    this.apiKey             = null;
    this.client             = null;
    this._customDefaultModel = null;  // per-provider default model override (Pro+)
    this.conversations = new Map();   // convId → messages[] (fast in-memory cache)

    // Load persisted key synchronously — store is already initialised by main
    const saved = this._loadKey();
    if (saved) {
      try { this._initClient(saved); } catch (_) {}
    }
  }

  /**
   * Called by ProviderRegistry after construction to attach SQLite persistence.
   * Warms the in-memory conversation cache from the database so history
   * survives across app restarts without any change to concrete providers.
   */
  attachConvStore(convStore) {
    this.convStore = convStore;
    const loaded = convStore.loadAll(this.name);
    for (const [convId, msgs] of loaded.entries()) {
      this.conversations.set(convId, msgs);
    }
  }

  // ── Key persistence ────────────────────────────────────────────────────────

  _loadKey() {
    try { return this.store?.get(`apiKey.${this.name}`) || null; } catch { return null; }
  }

  _saveKey(key) {
    try { this.store?.set(`apiKey.${this.name}`, key); } catch (_) {}
  }

  _deleteKey() {
    try { this.store?.delete(`apiKey.${this.name}`); } catch (_) {}
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setApiKey(key) {
    if (!this.validateApiKey(key)) throw new Error(`Invalid API key format for ${this.name}`);
    this._initClient(key);
    this._saveKey(key);
    return { success: true, provider: this.name };
  }

  /**
   * Set (or clear) the default model for this provider.
   * When set, this model is used when no model is explicitly specified in a queue item.
   * @param {string|null} model - model ID string, or null to clear
   */
  setDefaultModel(model) {
    this._customDefaultModel = model || null;
  }

  removeApiKey() {
    this.apiKey  = null;
    this.client  = null;
    this._deleteKey();
  }

  isConfigured()    { return !!this.client; }
  listConversations() { return Array.from(this.conversations.keys()); }

  // ── Conversation history ───────────────────────────────────────────────────

  getHistory(convId)  { return this.conversations.get(convId) || []; }

  appendHistory(convId, userMsg, assistantMsg) {
    const hist    = this.getHistory(convId);
    const updated = [
      ...hist,
      { role: 'user',      content: userMsg      },
      { role: 'assistant', content: assistantMsg },
    ].slice(-40); // cap at 20 turns
    this.conversations.set(convId, updated);

    // Write-through to SQLite so history survives restarts
    if (this.convStore) {
      this.convStore.appendTurn(this.name, convId, userMsg, assistantMsg);
    }
  }

  clearConversation(convId) {
    this.conversations.delete(convId);
    if (this.convStore) {
      this.convStore.clearConversation(this.name, convId);
    }
  }

  newConvId(projectId = null) {
    const prefix = projectId ? `${this.name}-proj-${projectId}` : `${this.name}-conv`;
    return `${prefix}-${uuidv4().slice(0, 8)}`;
  }

  // ── Abstract (must override) ───────────────────────────────────────────────

  validateApiKey(key) { throw new Error('Not implemented'); }
  _initClient(key)    { throw new Error('Not implemented'); }
  getModels()         { throw new Error('Not implemented'); }
  getRateLimits()     { throw new Error('Not implemented'); }
  async sendMessage() { throw new Error('Not implemented'); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _normaliseError(err) {
    const msg        = err?.message || String(err);
    const status     = err?.status  || err?.statusCode || null;
    const isRateLimit = status === 429 || /rate.?limit/i.test(msg);
    const isAuth     = status === 401 || /api.?key|unauthorized|forbidden/i.test(msg);
    const e          = new Error(msg);
    Object.assign(e, { status, isRateLimit, isAuth, raw: err });
    return e;
  }

  _recordUsage(inputTokens, outputTokens, model, queueItemId) {
    // Wrapped in try/catch: a DB write failure here (e.g. disk full) must never
    // cause the queue item to be marked as an error — the AI response was already
    // received and stored successfully.
    try {
      return this.tracker.recordMessage(this.name, { model, inputTokens, outputTokens, queueItemId });
    } catch (e) {
      console.error(`[${this.name}] usage recording failed (response still saved):`, e.message);
      return null;
    }
  }
}

module.exports = { BaseProvider };
