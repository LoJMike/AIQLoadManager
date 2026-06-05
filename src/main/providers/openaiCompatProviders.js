/**
 * OpenAI-Compatible Providers
 *
 * Groq, DeepSeek, Mistral, and xAI Grok all expose an OpenAI-compatible
 * chat completions API. We use the `openai` SDK with a custom baseURL,
 * making these trivial to add.
 *
 * Adding a new provider: copy one of the classes below, update
 * name/baseURL/models/rateLimits and export it.
 */

const { BaseProvider } = require('./baseProvider');

// ── Shared factory ──────────────────────────────────────────────────────────

function makeOpenAICompatClient(apiKey, baseURL) {
  try {
    const { OpenAI } = require('openai');
    return new OpenAI({ apiKey, baseURL });
  } catch {
    return { _mock: true };
  }
}

async function sendViaOpenAICompat(provider, opts) {
  const { prompt, systemPrompt, model, maxTokens = 1024, conversationId, projectId, queueItemId } = opts;
  if (!provider.client) throw new Error(`${provider.name} API key not configured`);

  const convId = conversationId || provider.newConvId(projectId);
  const history = provider.getHistory(convId);
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history, { role: 'user', content: prompt });
  const usedModel = model || provider.getDefaultModel();

  let response, inputTokens = 0, outputTokens = 0;

  if (provider.client._mock) {
    await new Promise(r => setTimeout(r, 400));
    response = `[${provider.name} Mock] Received: "${prompt.slice(0, 60)}"`;
    inputTokens = Math.ceil(prompt.length / 4);
    outputTokens = Math.ceil(response.length / 4);
  } else {
    try {
      const res = await provider.client.chat.completions.create({
        model: usedModel, max_tokens: maxTokens, messages,
      });
      response = res.choices[0]?.message?.content || '';
      inputTokens = res.usage?.prompt_tokens || 0;
      outputTokens = res.usage?.completion_tokens || 0;
    } catch (err) {
      throw provider._normaliseError(err);
    }
  }

  provider.appendHistory(convId, prompt, response);
  provider._recordUsage(inputTokens, outputTokens, usedModel, queueItemId);

  return { response, conversationId: convId, usage: { inputTokens, outputTokens }, model: usedModel, provider: provider.name };
}

// ── Groq ───────────────────────────────────────────────────────────────────

class GroqProvider extends BaseProvider {
  constructor(usageTracker, store) { super('groq', usageTracker, store); }

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('gsk_'); }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.groq.com/openai/v1');
  }

  getModels() {
    return [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128_000, inputCost: 0.59, outputCost: 0.79, tier: 'standard', free: true },
      { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B',  contextWindow: 128_000, inputCost: 0.05, outputCost: 0.08, tier: 'fast',     free: true },
      { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B',  contextWindow: 32_768,  inputCost: 0.24, outputCost: 0.24, tier: 'standard', free: true },
    ];
  }

  // Free tier: 30 RPM, 14,400 RPD, 6,000 TPM
  getRateLimits() { return { rpm: 30, rpd: 14_400, tpm: 6_000, tpd: null }; }
  hasFreeFreeTier() { return true; }
  getDefaultModel() { return 'llama-3.3-70b-versatile'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── DeepSeek ───────────────────────────────────────────────────────────────

class DeepSeekProvider extends BaseProvider {
  constructor(usageTracker, store) { super('deepseek', usageTracker, store); }

  validateApiKey(key) {
    // DeepSeek keys start with 'sk-' and are longer than the bare prefix, but
    // OpenAI keys also start with 'sk-'. A minimum length check prevents an
    // OpenAI key pasted here from passing silently (it'll still fail at the API
    // but the error message will be much clearer with this gate).
    return typeof key === 'string' && key.startsWith('sk-') && key.length > 20;
  }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.deepseek.com/v1');
  }

  getModels() {
    return [
      { id: 'deepseek-chat',    name: 'DeepSeek V3 (Chat)',     contextWindow: 64_000, inputCost: 0.14, outputCost: 0.28, tier: 'standard' },
      { id: 'deepseek-reasoner',name: 'DeepSeek R1 (Reasoner)', contextWindow: 64_000, inputCost: 0.55, outputCost: 2.19, tier: 'reasoning' },
    ];
  }

  // 5M free tokens on signup; pay-as-you-go after
  getRateLimits() { return { rpm: 60, rpd: null, tpm: 100_000, tpd: null }; }
  getDefaultModel() { return 'deepseek-chat'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── Mistral ────────────────────────────────────────────────────────────────

class MistralProvider extends BaseProvider {
  constructor(usageTracker, store) { super('mistral', usageTracker, store); }

  validateApiKey(key) { return typeof key === 'string' && key.length > 20; }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.mistral.ai/v1');
  }

  getModels() {
    return [
      { id: 'mistral-large-latest',  name: 'Mistral Large',  contextWindow: 128_000, inputCost: 2.00, outputCost: 6.00, tier: 'premium' },
      { id: 'mistral-small-latest',  name: 'Mistral Small',  contextWindow: 32_000,  inputCost: 0.10, outputCost: 0.30, tier: 'fast',    free: true },
      { id: 'codestral-latest',      name: 'Codestral',      contextWindow: 32_000,  inputCost: 0.30, outputCost: 0.90, tier: 'coding',  free: true },
      { id: 'open-mistral-7b',       name: 'Mistral 7B',     contextWindow: 32_000,  inputCost: 0.04, outputCost: 0.04, tier: 'fast',    free: true },
    ];
  }

  // Free Experiment tier: 2 RPM, 1B tokens/month
  getRateLimits() { return { rpm: 2, rpd: null, tpm: null, tpd: null, monthlyTokens: 1_000_000_000 }; }
  hasFreeFreeTier() { return true; }
  getDefaultModel() { return 'mistral-small-latest'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── xAI Grok ──────────────────────────────────────────────────────────────

class GrokProvider extends BaseProvider {
  constructor(usageTracker, store) { super('grok', usageTracker, store); }

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('xai-'); }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.x.ai/v1');
  }

  getModels() {
    return [
      { id: 'grok-4',       name: 'Grok 4',        contextWindow: 256_000,   inputCost: 3.00, outputCost: 15.00, tier: 'premium'   },
      { id: 'grok-4.1-fast',name: 'Grok 4.1 Fast', contextWindow: 2_000_000, inputCost: 0.20, outputCost: 0.50,  tier: 'fast'      },
      { id: 'grok-3-mini',  name: 'Grok 3 Mini',   contextWindow: 131_072,   inputCost: 0.30, outputCost: 0.50,  tier: 'standard'  },
    ];
  }

  // $25 signup credits + $150/mo via data sharing; pay-as-you-go API
  getRateLimits() { return { rpm: 60, rpd: null, tpm: 500_000, tpd: null }; }
  getDefaultModel() { return 'grok-4.1-fast'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── Fireworks AI ───────────────────────────────────────────────────────────
// Fastest inference platform. Hosts Llama, DeepSeek, Qwen, Gemma.
// Best candidate for 'fastest' routing mode alongside Groq/Cerebras.

class FireworksProvider extends BaseProvider {
  constructor(usageTracker, store) { super('fireworks', usageTracker, store); }

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('fw_'); }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.fireworks.ai/inference/v1');
  }

  getModels() {
    return [
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B',  contextWindow: 131_072, inputCost: 0.90, outputCost: 0.90, tier: 'standard' },
      { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',  name: 'Llama 3.1 8B',   contextWindow: 131_072, inputCost: 0.20, outputCost: 0.20, tier: 'fast'     },
      { id: 'accounts/fireworks/models/deepseek-v3',             name: 'DeepSeek V3',    contextWindow: 64_000,  inputCost: 0.90, outputCost: 0.90, tier: 'standard' },
      { id: 'accounts/fireworks/models/qwen2p5-72b-instruct',    name: 'Qwen 2.5 72B',   contextWindow: 32_768,  inputCost: 0.90, outputCost: 0.90, tier: 'standard' },
    ];
  }

  // $1 signup credit; pay-as-you-go after
  getRateLimits() { return { rpm: 600, rpd: null, tpm: null, tpd: null }; }
  getDefaultModel() { return 'accounts/fireworks/models/llama-v3p3-70b-instruct'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── Together AI ────────────────────────────────────────────────────────────
// 200+ open-source models; $25 signup credit. Best for variety and routing.

class TogetherProvider extends BaseProvider {
  constructor(usageTracker, store) { super('together', usageTracker, store); }

  // Together keys start with 'sk-' but are longer than a minimal OpenAI key
  validateApiKey(key) {
    return typeof key === 'string' && key.startsWith('sk-') && key.length > 32;
  }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.together.xyz/v1');
  }

  getModels() {
    return [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',      name: 'Llama 3.3 70B Turbo',  contextWindow: 131_072, inputCost: 0.88, outputCost: 0.88, tier: 'standard' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',  name: 'Llama 3.1 8B Turbo',   contextWindow: 131_072, inputCost: 0.18, outputCost: 0.18, tier: 'fast'     },
      { id: 'deepseek-ai/DeepSeek-V3',                       name: 'DeepSeek V3',          contextWindow: 64_000,  inputCost: 0.60, outputCost: 1.70, tier: 'standard' },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',              name: 'Qwen 2.5 72B Turbo',   contextWindow: 32_768,  inputCost: 1.20, outputCost: 1.20, tier: 'standard' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',         name: 'Mixtral 8x7B',         contextWindow: 32_768,  inputCost: 0.60, outputCost: 0.60, tier: 'fast'     },
    ];
  }

  // $25 signup credit; no ongoing free RPM tier
  getRateLimits() { return { rpm: 600, rpd: null, tpm: null, tpd: null }; }
  getDefaultModel() { return 'meta-llama/Llama-3.3-70B-Instruct-Turbo'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── MiniMax ────────────────────────────────────────────────────────────────
// High-quality frontier models. MiniMax-M3 is competitive with GPT-4o at
// ~$0.60/M input — excellent price/performance ratio.

class MiniMaxProvider extends BaseProvider {
  constructor(usageTracker, store) { super('minimax', usageTracker, store); }

  // MiniMax keys have no standard prefix — validate by length
  validateApiKey(key) { return typeof key === 'string' && key.length > 30; }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.minimax.io/v1');
  }

  getModels() {
    return [
      { id: 'MiniMax-M3',   name: 'MiniMax M3',   contextWindow: 1_000_000, inputCost: 0.60, outputCost: 2.40, tier: 'premium'  },
      { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', contextWindow: 1_000_000, inputCost: 0.15, outputCost: 1.15, tier: 'standard' },
      { id: 'MiniMax-M2',   name: 'MiniMax M2',   contextWindow: 1_000_000, inputCost: 0.26, outputCost: 1.00, tier: 'standard' },
    ];
  }

  // Pay-as-you-go; no free tier
  getRateLimits() { return { rpm: 60, rpd: null, tpm: null, tpd: null }; }
  getDefaultModel() { return 'MiniMax-M3'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── Cerebras ───────────────────────────────────────────────────────────────
// Wafer-scale chip with the fastest raw inference available (Llama 70B at
// ~2,000 tokens/sec). Best candidate for 'fastest' mode alongside Groq.

class CerebasProvider extends BaseProvider {
  constructor(usageTracker, store) { super('cerebras', usageTracker, store); }

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('csk-'); }
  _initClient(key) {
    this.apiKey = key;
    this.client = makeOpenAICompatClient(key, 'https://api.cerebras.ai/v1');
  }

  getModels() {
    return [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', contextWindow: 128_000, inputCost: 0.85, outputCost: 1.20, tier: 'fast',     free: true },
      { id: 'llama-3.1-8b',  name: 'Llama 3.1 8B',  contextWindow: 128_000, inputCost: 0.10, outputCost: 0.10, tier: 'fast',     free: true },
      { id: 'qwen-3-32b',    name: 'Qwen 3 32B',    contextWindow: 128_000, inputCost: 0.40, outputCost: 0.80, tier: 'standard', free: true },
    ];
  }

  // Free tier: 30 RPM, rate-limited but no $ required
  getRateLimits() { return { rpm: 30, rpd: null, tpm: null, tpd: null }; }
  hasFreeFreeTier() { return true; }
  getDefaultModel() { return 'llama-3.3-70b'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

// ── Cohere ─────────────────────────────────────────────────────────────────
// Enterprise-focused. Excellent at RAG, structured output, and document Q&A.
// NOTE: Cohere's OpenAI-compatible endpoint is at /compatibility/v1 (not /v1).

class CohereProvider extends BaseProvider {
  constructor(usageTracker, store) { super('cohere', usageTracker, store); }

  // Cohere keys have no standard prefix — validate by length
  validateApiKey(key) { return typeof key === 'string' && key.length > 20; }
  _initClient(key) {
    this.apiKey = key;
    // Note the non-standard path: /compatibility/v1 (not just /v1)
    this.client = makeOpenAICompatClient(key, 'https://api.cohere.com/compatibility/v1');
  }

  getModels() {
    return [
      { id: 'command-a-03-2025',   name: 'Command A',   contextWindow: 256_000, inputCost: 2.50, outputCost: 10.00, tier: 'premium'  },
      { id: 'command-r-plus',      name: 'Command R+',  contextWindow: 128_000, inputCost: 2.50, outputCost: 10.00, tier: 'premium'  },
      { id: 'command-r',           name: 'Command R',   contextWindow: 128_000, inputCost: 0.15, outputCost:  0.60, tier: 'standard' },
      { id: 'command-r7b-12-2024', name: 'Command R7B', contextWindow: 128_000, inputCost: 0.04, outputCost:  0.15, tier: 'fast',    free: true },
    ];
  }

  // Trial key: 20 RPM — production key: 10,000 RPM
  getRateLimits() { return { rpm: 20, rpd: null, tpm: null, tpd: null }; }
  hasFreeFreeTier() { return true; } // trial key is free with rate limits
  getDefaultModel() { return 'command-r'; }

  async sendMessage(opts) { return sendViaOpenAICompat(this, opts); }
}

module.exports = {
  GroqProvider, DeepSeekProvider, MistralProvider, GrokProvider,
  FireworksProvider, TogetherProvider, MiniMaxProvider, CerebasProvider, CohereProvider,
};
