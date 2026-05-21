/**
 * BaseProvider — abstract class every AI provider extends.
 * electron-store v8+ is ESM-only, so we load it via dynamic import().
 */

const { v4: uuidv4 } = require('../uuid');

class BaseProvider {
  constructor(name, usageTracker, store) {
    if (new.target === BaseProvider) throw new Error('BaseProvider is abstract');
    this.name    = name;
    this.tracker = usageTracker;
    this.store   = store;           // electron-store instance (may be null)
    this.apiKey  = null;
    this.client  = null;
    this.conversations = new Map(); // convId → messages[]

    // Load persisted key synchronously — store is already initialised by main
    const saved = this._loadKey();
    if (saved) {
      try { this._initClient(saved); } catch (_) {}
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
  }

  clearConversation(convId) { this.conversations.delete(convId); }

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
    return this.tracker.recordMessage(this.name, { model, inputTokens, outputTokens, queueItemId });
  }
}

module.exports = { BaseProvider };
