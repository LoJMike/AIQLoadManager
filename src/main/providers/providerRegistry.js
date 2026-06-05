/**
 * ProviderRegistry
 *
 * Single source of truth. Instantiates every provider once,
 * exposes them by name, and handles IPC serialisation.
 *
 * To add a new provider:
 *   1. Create a class in providers/ extending BaseProvider
 *   2. Import and register it here in PROVIDER_CLASSES
 *   3. Add its npm package to package.json dependencies
 *   4. Done — the UI and queue router pick it up automatically.
 */

const { AnthropicProvider }                                        = require('./anthropicProvider');
const { OpenAIProvider }                                           = require('./openaiProvider');
const { GeminiProvider }                                           = require('./geminiProvider');
const {
  GroqProvider, DeepSeekProvider, MistralProvider, GrokProvider,
  FireworksProvider, TogetherProvider, MiniMaxProvider, CerebasProvider, CohereProvider,
} = require('./openaiCompatProviders');
const { OllamaProvider, LMStudioProvider, JanProvider, LocalAIProvider, LlamaCppProvider } = require('./localProviders');

const PROVIDER_CLASSES = {
  // Cloud — paid API (per-token billing)
  anthropic: AnthropicProvider,
  openai:    OpenAIProvider,
  gemini:    GeminiProvider,
  groq:      GroqProvider,
  deepseek:  DeepSeekProvider,
  mistral:   MistralProvider,
  grok:      GrokProvider,
  // Phase 1 additions (v0.6.0)
  fireworks: FireworksProvider,
  together:  TogetherProvider,
  minimax:   MiniMaxProvider,
  cerebras:  CerebasProvider,
  cohere:    CohereProvider,
  // Local — runs on user's hardware; no API key, no cost
  ollama:    OllamaProvider,
  lmstudio:  LMStudioProvider,
  jan:       JanProvider,
  localai:   LocalAIProvider,
  llamacpp:  LlamaCppProvider,
};

// Human-readable metadata (logo colour used by the GUI)
const PROVIDER_META = {
  anthropic: { displayName: 'Claude (Anthropic)', color: '#d97757', icon: 'ti-robot',         website: 'https://anthropic.com'        },
  openai:    { displayName: 'OpenAI (ChatGPT)',   color: '#10a37f', icon: 'ti-brand-openai',  website: 'https://platform.openai.com'  },
  gemini:    { displayName: 'Google Gemini',      color: '#4285f4', icon: 'ti-brand-google',  website: 'https://ai.google.dev'        },
  groq:      { displayName: 'Groq',               color: '#f55036', icon: 'ti-bolt',          website: 'https://console.groq.com'     },
  deepseek:  { displayName: 'DeepSeek',           color: '#4d6bfe', icon: 'ti-brain',         website: 'https://platform.deepseek.com'},
  mistral:   { displayName: 'Mistral AI',         color: '#ff7000', icon: 'ti-wind',          website: 'https://mistral.ai'           },
  grok:      { displayName: 'xAI Grok',           color: '#1da1f2', icon: 'ti-brand-x',       website: 'https://console.x.ai'         },
  // Phase 1 additions (v0.6.0)
  fireworks: { displayName: 'Fireworks AI',        color: '#ff4d00', icon: 'ti-flame',          website: 'https://fireworks.ai'                              },
  together:  { displayName: 'Together AI',         color: '#0066ff', icon: 'ti-users-group',    website: 'https://together.ai'                               },
  minimax:   { displayName: 'MiniMax',             color: '#6d28d9', icon: 'ti-sparkles',       website: 'https://platform.minimax.io'                       },
  cerebras:  { displayName: 'Cerebras',            color: '#f59e0b', icon: 'ti-cpu',            website: 'https://inference.cerebras.ai'                     },
  cohere:    { displayName: 'Cohere',              color: '#39d353', icon: 'ti-message-dots',   website: 'https://cohere.com'                                },
  // Local providers
  ollama:    { displayName: 'Ollama (Local)',      color: '#ffffff', icon: 'ti-server',          website: 'https://ollama.com',           local: true },
  lmstudio:  { displayName: 'LM Studio (Local)',  color: '#a855f7', icon: 'ti-cpu',           website: 'https://lmstudio.ai',          local: true },
  jan:       { displayName: 'Jan.ai (Local)',      color: '#6366f1', icon: 'ti-device-desktop',website: 'https://jan.ai',              local: true },
  localai:   { displayName: 'LocalAI',            color: '#22c55e', icon: 'ti-server-bolt',   website: 'https://localai.io',           local: true },
  llamacpp:  { displayName: 'llama.cpp (Local)',   color: '#f59e0b', icon: 'ti-terminal-2',   website: 'https://github.com/ggerganov/llama.cpp', local: true },
};

class ProviderRegistry {
  constructor(multiUsageTracker, store, convStore = null) {
    this.tracker = multiUsageTracker;
    this.store   = store;
    this.providers = {};

    for (const [name, ProviderClass] of Object.entries(PROVIDER_CLASSES)) {
      const provider = new ProviderClass(multiUsageTracker, store);
      // Attach SQLite conversation persistence if available — no change needed
      // in any concrete provider class; BaseProvider handles it via attachConvStore().
      if (convStore) provider.attachConvStore(convStore);
      this.providers[name] = provider;
    }
  }

  // ── Access ──────────────────────────────────────────────────────────────

  get(name) {
    if (!this.providers[name]) throw new Error(`Unknown provider: ${name}`);
    return this.providers[name];
  }

  all() { return Object.values(this.providers); }

  configured() {
    return Object.values(this.providers).filter(p => p.isConfigured());
  }

  names() { return Object.keys(this.providers); }

  // ── Default model control (Pro+) ──────────────────────────────────────

  /**
   * Set (or clear) a custom default model for a provider.
   * @param {string}      name  - provider name
   * @param {string|null} model - model ID, or null/'' to clear
   */
  setDefaultModel(name, model) {
    this.get(name).setDefaultModel(model || null);
  }

  /**
   * Returns a map of { providerName: modelId } for providers that have a
   * custom default model set. Providers without one are omitted.
   */
  getDefaultModels() {
    const result = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      if (provider._customDefaultModel) {
        result[name] = provider._customDefaultModel;
      }
    }
    return result;
  }

  // ── Reachability (local providers) ───────────────────────────────────────

  /**
   * Returns a map of local provider names to reachability booleans.
   * Delegates to the QueueRouter's cache — call only after the router exists.
   * Stored on the registry so the IPC layer can reach it without importing
   * the router directly.
   *
   * @param {import('../queueRouter').QueueRouter} router
   * @returns {Object.<string, boolean>}
   */
  getLocalReachability(router) {
    if (!router || typeof router.getReachabilityStatus !== 'function') return {};
    return router.getReachabilityStatus();
  }

  // ── Live model discovery (local providers only) ──────────────────────────

  /**
   * Trigger on-demand model discovery for a local provider.
   * Returns the live model list plus flags for reachability and whether
   * discovery succeeded. Used by pre-flight validation in the Add tab.
   *
   * @param {string} name
   * @returns {Promise<{ fetched: boolean, reachable: boolean, models: object[] }>}
   */
  async refreshLocalModels(name) {
    const provider = this.get(name);
    if (typeof provider.refreshModels !== 'function') {
      return { fetched: true, reachable: true, models: provider.getModels() };
    }
    return provider.refreshModels();
  }

  // ── Port management (local providers only) ─────────────────────────────

  /**
   * Set the port for a local provider. Throws if the provider is not local
   * (i.e. does not have a setLocalPort method) or if the port is invalid.
   */
  setLocalPort(providerName, port) {
    const provider = this.get(providerName);
    if (typeof provider.setLocalPort !== 'function') {
      throw new Error(`${providerName} is not a local provider — port cannot be changed`);
    }
    return provider.setLocalPort(port);
  }

  /**
   * Returns current and default ports for every local provider.
   * Used by the UI to populate the port fields in Settings.
   */
  getLocalPorts() {
    const result = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      if (typeof provider.getCurrentPort === 'function') {
        result[name] = {
          current: provider.getCurrentPort(),
          default: provider.getDefaultPort(),
        };
      }
    }
    return result;
  }

  // ── IPC-safe serialisation ─────────────────────────────────────────────

  /** Returns a plain object safe to send over IPC to the renderer */
  getProviderSummaries() {
    return Object.entries(this.providers).map(([name, provider]) => ({
      name,
      ...PROVIDER_META[name],
      configured:      provider.isConfigured(),
      models:          provider.getModels(),
      rateLimits:      provider.getRateLimits(),
      hasFreeFreeTier: provider.hasFreeFreeTier?.() || false,
      conversations:   provider.listConversations(),
      defaultModel:    provider._customDefaultModel || null,
      // Include port info for local providers so the UI can show/edit it
      ...(typeof provider.getCurrentPort === 'function' && {
        currentPort: provider.getCurrentPort(),
        defaultPort: provider.getDefaultPort(),
      }),
    }));
  }

  getProviderSummary(name) {
    const provider = this.get(name);
    return {
      name,
      ...PROVIDER_META[name],
      configured:      provider.isConfigured(),
      models:          provider.getModels(),
      rateLimits:      provider.getRateLimits(),
      hasFreeFreeTier: provider.hasFreeFreeTier?.() || false,
      conversations:   provider.listConversations(),
      defaultModel:    provider._customDefaultModel || null,
      ...(typeof provider.getCurrentPort === 'function' && {
        currentPort: provider.getCurrentPort(),
        defaultPort: provider.getDefaultPort(),
      }),
    };
  }

  /**
   * Attempt to send a message via a specific provider.
   * If no model is specified in opts, falls back to the provider's custom default model.
   */
  async sendMessage(providerName, opts) {
    const provider = this.get(providerName);
    if (!provider.isConfigured()) {
      throw new Error(`Provider "${providerName}" is not configured (no API key)`);
    }
    // Resolve model: explicit opts.model wins, then custom default, then provider's own default
    const resolvedModel = opts.model || provider._customDefaultModel || null;
    return provider.sendMessage({ ...opts, model: resolvedModel });
  }
}

module.exports = { ProviderRegistry, PROVIDER_META, PROVIDER_CLASSES };
