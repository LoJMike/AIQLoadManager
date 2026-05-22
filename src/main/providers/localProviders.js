/**
 * Local AI Providers — Ollama & LM Studio
 *
 * Both expose an OpenAI-compatible REST API on localhost, so we use
 * the same `openai` SDK pattern as openaiCompatProviders.js, just
 * pointed at a local port instead of a cloud endpoint.
 *
 * Key differences from cloud providers:
 *   - No API key required — just run the app locally
 *   - $0.00 cost for every request
 *   - No rate limits (bounded only by your hardware)
 *   - Models are discovered dynamically from the running server
 *   - If the server is not running, sendMessage throws a clear error
 *
 * Ollama:    https://ollama.com         — port 11434
 * LM Studio: https://lmstudio.ai       — port 1234
 */

'use strict';

const { BaseProvider } = require('./baseProvider');

// ── Popular default model lists ────────────────────────────────────────────
// These are shown before dynamic discovery completes.
// Users can pull/load any model they want — the list refreshes on sendMessage.

const OLLAMA_DEFAULT_MODELS = [
  { id: 'llama3.2',        name: 'Llama 3.2 (3B)',        contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'llama3.1:8b',     name: 'Llama 3.1 (8B)',        contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'mistral',         name: 'Mistral 7B',            contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'phi4',            name: 'Phi-4 (14B)',            contextWindow: 16_384,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'gemma3',          name: 'Gemma 3 (4B)',           contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'qwen2.5',         name: 'Qwen 2.5 (7B)',          contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'deepseek-r1:8b',  name: 'DeepSeek-R1 (8B)',       contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'codellama',       name: 'Code Llama (7B)',         contextWindow: 16_384,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
];

const LM_STUDIO_DEFAULT_MODELS = [
  { id: 'local-model',           name: 'Active Model',            contextWindow: 4_096,   inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'llama-3.1-8b',         name: 'Llama 3.1 8B',            contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'mistral-7b',           name: 'Mistral 7B',              contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'phi-4',                name: 'Phi-4 14B',               contextWindow: 16_384,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'gemma-3-12b',          name: 'Gemma 3 12B',             contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'qwen2.5-7b',           name: 'Qwen 2.5 7B',             contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'deepseek-r1-distill',  name: 'DeepSeek-R1 Distilled',   contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'codestral-22b',        name: 'Codestral 22B',           contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
];

// ── Shared OpenAI-compat send logic ───────────────────────────────────────

async function sendViaLocal(provider, opts) {
  const { prompt, systemPrompt, model, maxTokens = 2048, conversationId, projectId, queueItemId } = opts;

  const convId    = conversationId || provider.newConvId(projectId);
  const history   = provider.getHistory(convId);
  const messages  = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history, { role: 'user', content: prompt });
  const usedModel = model || provider.getDefaultModel();

  let response, inputTokens = 0, outputTokens = 0;

  try {
    const res = await provider.client.chat.completions.create({
      model: usedModel, max_tokens: maxTokens, messages,
    });
    response     = res.choices[0]?.message?.content || '';
    inputTokens  = res.usage?.prompt_tokens     || Math.ceil(prompt.length / 4);
    outputTokens = res.usage?.completion_tokens || Math.ceil(response.length / 4);
  } catch (err) {
    // Give a clear, actionable error when the local server is not running
    const msg = err?.message || String(err);
    if (
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed')  ||
      msg.includes('connect error') ||
      err?.cause?.code === 'ECONNREFUSED'
    ) {
      throw new Error(
        `${provider.displayName} is not running. ` +
        `Please start it and try again. (${provider._baseURL})`
      );
    }
    throw provider._normaliseError(err);
  }

  provider.appendHistory(convId, prompt, response);
  provider._recordUsage(inputTokens, outputTokens, usedModel, queueItemId);

  return {
    response,
    conversationId: convId,
    usage: { inputTokens, outputTokens },
    model: usedModel,
    provider: provider.name,
  };
}

// ── Base class for local providers ─────────────────────────────────────────

class LocalBaseProvider extends BaseProvider {
  constructor(name, baseURL, displayName, defaultModels, usageTracker, store) {
    super(name, usageTracker, store);

    this._baseURL      = baseURL;
    this.displayName   = displayName;
    this._models       = [...defaultModels];
    this._modelsFetched = false;

    // Always initialise — no API key needed for local providers
    if (!this.client) {
      try { this._initClient('local'); } catch (_) {}
    }
  }

  // No API key needed — any truthy value passes validation
  validateApiKey() { return true; }

  _initClient(_key) {
    try {
      const { OpenAI } = require('openai');
      this.client = new OpenAI({ apiKey: 'local', baseURL: `${this._baseURL}/v1` });
    } catch {
      this.client = null;
    }
  }

  // Local providers are always "configured" — just need the server running
  isConfigured() { return !!this.client; }

  hasFreeFreeTier() { return true; }

  // Effectively unlimited — bounded by hardware, not a rate-limit policy
  getRateLimits() { return { rpm: 9999, rpd: null, tpm: null, tpd: null }; }

  getModels() { return this._models; }

  getDefaultModel() { return this._models[0]?.id || 'unknown'; }

  // Override to be a no-op — there is no key to remove for a local provider
  removeApiKey() { /* intentional no-op */ }

  // ── Dynamic model discovery ──────────────────────────────────────────────

  async _refreshModels() {
    try {
      const fetched = await this._fetchRemoteModels();
      if (fetched && fetched.length > 0) {
        this._models = fetched;
        this._modelsFetched = true;
      }
    } catch (_) {
      // Server not running or returned unexpected data — keep defaults
    }
  }

  // Subclasses override this to hit their specific endpoint
  async _fetchRemoteModels() { return null; }

  async sendMessage(opts) {
    // Refresh model list on first actual use (best-effort, non-blocking on error)
    if (!this._modelsFetched) {
      await this._refreshModels();
    }
    return sendViaLocal(this, opts);
  }
}

// ── Ollama ──────────────────────────────────────────────────────────────────

class OllamaProvider extends LocalBaseProvider {
  constructor(usageTracker, store) {
    super(
      'ollama',
      'http://localhost:11434',
      'Ollama',
      OLLAMA_DEFAULT_MODELS,
      usageTracker,
      store
    );
  }

  // Ollama uses /api/tags — returns { models: [{ name, size, ... }] }
  async _fetchRemoteModels() {
    const res  = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.models) || data.models.length === 0) return null;

    return data.models.map(m => ({
      id:            m.name,
      name:          m.name,
      contextWindow: 131_072,   // Ollama doesn't always report this; safe default
      inputCost:     0,
      outputCost:    0,
      tier:          'local',
      free:          true,
      size:          m.size,    // bytes — useful for display
    }));
  }
}

// ── LM Studio ───────────────────────────────────────────────────────────────

class LMStudioProvider extends LocalBaseProvider {
  constructor(usageTracker, store) {
    super(
      'lmstudio',
      'http://localhost:1234',
      'LM Studio',
      LM_STUDIO_DEFAULT_MODELS,
      usageTracker,
      store
    );
  }

  // LM Studio exposes a standard OpenAI /v1/models endpoint
  async _fetchRemoteModels() {
    const res  = await fetch('http://localhost:1234/v1/models');
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.data) || data.data.length === 0) return null;

    return data.data.map(m => ({
      id:            m.id,
      name:          m.id,
      contextWindow: m.context_window || m.context_length || 4_096,
      inputCost:     0,
      outputCost:    0,
      tier:          'local',
      free:          true,
    }));
  }
}

module.exports = { OllamaProvider, LMStudioProvider };
