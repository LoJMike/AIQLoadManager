/**
 * Local AI Providers — Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp
 *
 * All five expose an OpenAI-compatible REST API on localhost, so we use
 * the same `openai` SDK pattern as openaiCompatProviders.js, pointed at
 * a local port instead of a cloud endpoint.
 *
 * Key differences from cloud providers:
 *   - No API key required — just run the app locally
 *   - $0.00 cost for every request
 *   - No rate limits (bounded only by your hardware)
 *   - Models are discovered dynamically from the running server
 *   - If the server is not running, sendMessage throws a clear error
 *
 * Port defaults (all configurable in Settings → Connectors):
 *   Ollama:    http://localhost:11434
 *   LM Studio: http://localhost:1234
 *   Jan.ai:    http://localhost:1337
 *   LocalAI:   http://localhost:8080
 *   llama.cpp: http://localhost:8181  ← different from LocalAI to avoid conflict
 */

'use strict';

const { BaseProvider } = require('./baseProvider');

// ── Popular default model lists ────────────────────────────────────────────
// Shown before dynamic discovery completes.

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

const JAN_DEFAULT_MODELS = [
  { id: 'mistral-ins-7b-q4',           name: 'Mistral 7B Instruct (Q4)',    contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'llama3.2-3b-instruct',        name: 'Llama 3.2 3B Instruct',       contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'llama3.1-8b-instruct',        name: 'Llama 3.1 8B Instruct',       contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'phi-3.5-mini-instruct',       name: 'Phi-3.5 Mini Instruct',        contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'gemma2-2b-instruct',          name: 'Gemma 2 2B Instruct',          contextWindow: 8_192,   inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'qwen2.5-7b-instruct',         name: 'Qwen 2.5 7B Instruct',         contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'deepseek-r1-distill-qwen-7b', name: 'DeepSeek-R1 Distill Qwen 7B', contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'codestral-7b-v0.1',           name: 'Codestral 7B',                 contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
];

const LOCALAI_DEFAULT_MODELS = [
  { id: 'mistral-7b-instruct-v0.1.Q4_K_M',  name: 'Mistral 7B Instruct',     contextWindow: 32_768,  inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'llama-3.1-8b-instruct',            name: 'Llama 3.1 8B Instruct',   contextWindow: 131_072, inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'phi-2',                            name: 'Phi-2',                    contextWindow: 2_048,   inputCost: 0, outputCost: 0, tier: 'local', free: true },
  { id: 'orca-mini-3b',                     name: 'Orca Mini 3B',             contextWindow: 2_048,   inputCost: 0, outputCost: 0, tier: 'local', free: true },
];

// llama.cpp loads one model at a time — no useful static defaults
const LLAMACPP_DEFAULT_MODELS = [
  { id: 'loaded-model', name: 'Active Model (detect on use)', contextWindow: 4_096, inputCost: 0, outputCost: 0, tier: 'local', free: true },
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
//
// Constructor now takes a numeric defaultPort rather than a full URL string.
// The actual port used is read from the store on startup (user may have
// overridden it in Settings), falling back to defaultPort.

class LocalBaseProvider extends BaseProvider {
  constructor(name, defaultPort, displayName, defaultModels, usageTracker, store) {
    super(name, usageTracker, store);

    this._defaultPort  = defaultPort;
    this.displayName   = displayName;
    this._models       = [...defaultModels];
    this._modelsFetched = false;

    // Load user-saved port override; fall back to the compiled default
    const savedPort    = store?.get(`localPort.${name}`);
    this._currentPort  = (savedPort && Number.isInteger(savedPort)) ? savedPort : defaultPort;
    this._baseURL      = `http://localhost:${this._currentPort}`;

    // Always initialise — no API key needed for local providers
    if (!this.client) {
      try { this._initClient('local'); } catch (_) {}
    }
  }

  // ── Port management ────────────────────────────────────────────────────────

  getCurrentPort() { return this._currentPort; }
  getDefaultPort() { return this._defaultPort; }

  /**
   * Change the port at runtime. Saves to store, re-initialises the HTTP
   * client with the new base URL, and resets model discovery so the next
   * sendMessage re-discovers models from the new address.
   */
  setLocalPort(port) {
    const p = parseInt(port, 10);
    if (!p || p < 1 || p > 65535) throw new Error('Invalid port number (must be 1–65535)');
    this.store?.set(`localPort.${this.name}`, p);
    this._currentPort  = p;
    this._baseURL      = `http://localhost:${p}`;
    this._modelsFetched = false;
    try { this._initClient('local'); } catch (_) {}
    return { success: true, port: p };
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

  getModels()       { return this._models; }
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

  /**
   * Default model discovery using the OpenAI-compatible /v1/models endpoint.
   * Uses `this.client.models.list()` (same SDK path as sendMessage) so it
   * inherits the SDK's HTTP client and avoids the native-fetch / localhost
   * IPv6 resolution issue on Windows.
   *
   * Subclasses override to add provider-specific display-name cleanup.
   */
  async _fetchRemoteModels() {
    if (!this.client) return null;
    const list = await this.client.models.list();
    if (!Array.isArray(list?.data) || list.data.length === 0) return null;
    return list.data.map(m => ({
      id:            m.id,
      name:          m.id,
      contextWindow: 4_096,
      inputCost:     0,
      outputCost:    0,
      tier:          'local',
      free:          true,
    }));
  }

  /**
   * Quick reachability ping using the SDK client.
   * Resolves true if the server responds within 3 s; false otherwise.
   * Used by QueueRouter's background reachability monitor.
   *
   * @returns {Promise<boolean>}
   */
  async checkReachable() {
    if (!this.client) return false;
    try {
      await Promise.race([
        this.client.models.list(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ping timeout')), 3_000)
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Public on-demand model refresh — called by the pre-flight validation
   * IPC handler when the user selects a local provider in Manual routing mode.
   * Returns the current model list plus a flag indicating whether models were
   * live-discovered (true) or are still the hardcoded fallback list (false).
   *
   * @returns {Promise<{ fetched: boolean, models: object[], reachable: boolean }>}
   */
  async refreshModels() {
    let reachable = false;
    try {
      const fetched = await this._fetchRemoteModels();
      if (fetched && fetched.length > 0) {
        this._models = fetched;
        this._modelsFetched = true;
        reachable = true;
      } else if (fetched !== null) {
        // Server responded but returned no models
        reachable = true;
      }
    } catch (_) {
      // Server unreachable — keep defaults, reachable stays false
    }
    return {
      fetched:   this._modelsFetched,
      reachable,
      models:    this._models,
    };
  }

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
    super('ollama', 11434, 'Ollama', OLLAMA_DEFAULT_MODELS, usageTracker, store);
  }

  // Ollama supports /v1/models (OpenAI-compatible) — use SDK client to avoid
  // native-fetch localhost resolution issues on Windows.
  async _fetchRemoteModels() {
    if (!this.client) return null;
    const list = await this.client.models.list();
    if (!Array.isArray(list?.data) || list.data.length === 0) return null;
    return list.data.map(m => ({
      id:            m.id,
      name:          m.id,
      contextWindow: 131_072,
      inputCost:     0,
      outputCost:    0,
      tier:          'local',
      free:          true,
    }));
  }
}

// ── LM Studio ───────────────────────────────────────────────────────────────

class LMStudioProvider extends LocalBaseProvider {
  constructor(usageTracker, store) {
    super('lmstudio', 1234, 'LM Studio', LM_STUDIO_DEFAULT_MODELS, usageTracker, store);
  }

  async _fetchRemoteModels() {
    if (!this.client) return null;
    const list = await this.client.models.list();
    if (!Array.isArray(list?.data) || list.data.length === 0) return null;
    return list.data.map(m => ({
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

// ── Jan.ai ──────────────────────────────────────────────────────────────────

class JanProvider extends LocalBaseProvider {
  constructor(usageTracker, store) {
    super('jan', 1337, 'Jan.ai', JAN_DEFAULT_MODELS, usageTracker, store);
  }

  async _fetchRemoteModels() {
    if (!this.client) return null;
    const list = await this.client.models.list();
    if (!Array.isArray(list?.data) || list.data.length === 0) return null;
    return list.data.map(m => ({
      id:            m.id,
      name:          m.name || m.id,
      contextWindow: m.context_window || m.context_length || 4_096,
      inputCost:     0,
      outputCost:    0,
      tier:          'local',
      free:          true,
    }));
  }
}

// ── LocalAI ─────────────────────────────────────────────────────────────────
//
// LocalAI is an open-source, self-hosted server that mimics the OpenAI API.
// It can run many backends (llama.cpp, whisper, diffusion models).
// Model IDs often include the filename/extension, e.g. "mistral-7b.Q4_K_M.gguf".
// Default port: 8080.

class LocalAIProvider extends LocalBaseProvider {
  constructor(usageTracker, store) {
    super('localai', 8080, 'LocalAI', LOCALAI_DEFAULT_MODELS, usageTracker, store);
  }

  async _fetchRemoteModels() {
    if (!this.client) return null;
    const list = await this.client.models.list();
    if (!Array.isArray(list?.data) || list.data.length === 0) return null;
    return list.data.map(m => {
      // Strip file extension and quantisation tags from display name
      const displayName = m.id
        .replace(/\.(gguf|bin|ggml|pt|ot)$/i, '')
        .replace(/[-_.]/g, ' ')
        .replace(/\bq[48]_k_[ms]\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return {
        id:            m.id,
        name:          displayName || m.id,
        contextWindow: m.context_window || 4_096,
        inputCost:     0,
        outputCost:    0,
        tier:          'local',
        free:          true,
      };
    });
  }
}

// ── llama.cpp server ─────────────────────────────────────────────────────────
//
// llama.cpp's built-in HTTP server exposes an OpenAI-compatible API.
// It loads ONE model at startup — you can't swap models via API.
// The /props endpoint exposes n_ctx (context window) and other config.
// Default port: 8181 (avoids conflict with LocalAI's 8080 default).

class LlamaCppProvider extends LocalBaseProvider {
  constructor(usageTracker, store) {
    super('llamacpp', 8181, 'llama.cpp', LLAMACPP_DEFAULT_MODELS, usageTracker, store);
  }

  async _fetchRemoteModels() {
    // Use SDK client (same path as sendMessage) to avoid native-fetch issues.
    // llama.cpp loads one model at a time — the list will have one entry.
    if (!this.client) return null;
    const list = await this.client.models.list();
    if (!Array.isArray(list?.data) || list.data.length === 0) return null;

    return list.data.map(m => {
      // Model ID is often the full file path — extract the basename for display
      const basename    = m.id.replace(/\\/g, '/').split('/').pop() || m.id;
      const displayName = basename
        .replace(/\.(gguf|bin|ggml)$/i, '')
        .replace(/[-_.]/g, ' ')
        .trim();
      return {
        id:            m.id,          // keep full path as ID for the API call
        name:          displayName || basename,
        contextWindow: 4_096,         // llama.cpp doesn't report n_ctx over /v1/models
        inputCost:     0,
        outputCost:    0,
        tier:          'local',
        free:          true,
      };
    });
  }
}

module.exports = {
  OllamaProvider,
  LMStudioProvider,
  JanProvider,
  LocalAIProvider,
  LlamaCppProvider,
};
