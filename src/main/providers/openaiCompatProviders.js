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

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('sk-'); }
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

module.exports = { GroqProvider, DeepSeekProvider, MistralProvider, GrokProvider };
