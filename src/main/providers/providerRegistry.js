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
const { GroqProvider, DeepSeekProvider, MistralProvider, GrokProvider } = require('./openaiCompatProviders');

const PROVIDER_CLASSES = {
  anthropic: AnthropicProvider,
  openai:    OpenAIProvider,
  gemini:    GeminiProvider,
  groq:      GroqProvider,
  deepseek:  DeepSeekProvider,
  mistral:   MistralProvider,
  grok:      GrokProvider,
};

// Human-readable metadata (logo colour used by the GUI)
const PROVIDER_META = {
  anthropic: { displayName: 'Claude (Anthropic)', color: '#d97757', icon: 'ti-robot',     website: 'https://anthropic.com'      },
  openai:    { displayName: 'OpenAI (ChatGPT)',   color: '#10a37f', icon: 'ti-brand-openai', website: 'https://platform.openai.com' },
  gemini:    { displayName: 'Google Gemini',      color: '#4285f4', icon: 'ti-brand-google', website: 'https://ai.google.dev'       },
  groq:      { displayName: 'Groq',               color: '#f55036', icon: 'ti-bolt',       website: 'https://console.groq.com'    },
  deepseek:  { displayName: 'DeepSeek',           color: '#4d6bfe', icon: 'ti-brain',      website: 'https://platform.deepseek.com'},
  mistral:   { displayName: 'Mistral AI',         color: '#ff7000', icon: 'ti-wind',       website: 'https://mistral.ai'          },
  grok:      { displayName: 'xAI Grok',           color: '#1da1f2', icon: 'ti-brand-x',   website: 'https://console.x.ai'        },
};

class ProviderRegistry {
  constructor(multiUsageTracker, store) {
    this.tracker = multiUsageTracker;
    this.store   = store;
    this.providers = {};

    for (const [name, ProviderClass] of Object.entries(PROVIDER_CLASSES)) {
      this.providers[name] = new ProviderClass(multiUsageTracker, store);
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

  // ── IPC-safe serialisation ─────────────────────────────────────────────

  /** Returns a plain object safe to send over IPC to the renderer */
  getProviderSummaries() {
    return Object.entries(this.providers).map(([name, provider]) => ({
      name,
      ...PROVIDER_META[name],
      configured:    provider.isConfigured(),
      models:        provider.getModels(),
      rateLimits:    provider.getRateLimits(),
      hasFreeFreeTier: provider.hasFreeFreeTier?.() || false,
      conversations: provider.listConversations(),
    }));
  }

  getProviderSummary(name) {
    const provider = this.get(name);
    return {
      name,
      ...PROVIDER_META[name],
      configured:    provider.isConfigured(),
      models:        provider.getModels(),
      rateLimits:    provider.getRateLimits(),
      hasFreeFreeTier: provider.hasFreeFreeTier?.() || false,
      conversations: provider.listConversations(),
    };
  }

  /** Attempt to send a message via a specific provider */
  async sendMessage(providerName, opts) {
    const provider = this.get(providerName);
    if (!provider.isConfigured()) {
      throw new Error(`Provider "${providerName}" is not configured (no API key)`);
    }
    return provider.sendMessage(opts);
  }
}

module.exports = { ProviderRegistry, PROVIDER_META, PROVIDER_CLASSES };
