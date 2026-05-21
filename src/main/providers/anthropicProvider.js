const { BaseProvider } = require('./baseProvider');

class AnthropicProvider extends BaseProvider {
  constructor(usageTracker, store) {
    super('anthropic', usageTracker, store);
  }

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('sk-ant-'); }

  _initClient(key) {
    this.apiKey = key;
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic.default({ apiKey: key });
    } catch {
      this.client = { _mock: true };
    }
  }

  getModels() {
    return [
      { id: 'claude-opus-4-6',   name: 'Claude Opus 4.6',   contextWindow: 1_000_000, inputCost: 5.00,  outputCost: 25.00,  tier: 'premium' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1_000_000, inputCost: 3.00,  outputCost: 15.00,  tier: 'standard' },
      { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  contextWindow: 200_000,   inputCost: 1.00,  outputCost: 5.00,   tier: 'fast' },
    ];
  }

  getRateLimits() {
    // Tier 1 API limits (approximate — varies by account tier)
    return { rpm: 50, rpd: null, tpm: 100_000, tpd: null };
  }

  getDefaultModel() { return 'claude-sonnet-4-6'; }

  async sendMessage({ prompt, systemPrompt, model, maxTokens = 1024, conversationId, projectId, queueItemId }) {
    if (!this.client) throw new Error('Anthropic API key not configured');

    const convId = conversationId || this.newConvId(projectId);
    const history = this.getHistory(convId);
    const messages = [...history, { role: 'user', content: prompt }];
    const usedModel = model || this.getDefaultModel();

    let response, inputTokens = 0, outputTokens = 0;

    if (this.client._mock) {
      await new Promise(r => setTimeout(r, 600));
      response = `[Anthropic Mock] Received: "${prompt.slice(0, 60)}"`;
      inputTokens = Math.ceil(prompt.length / 4);
      outputTokens = Math.ceil(response.length / 4);
    } else {
      try {
        const params = { model: usedModel, max_tokens: maxTokens, messages };
        if (systemPrompt) params.system = systemPrompt;
        const res = await this.client.messages.create(params);
        response = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
        inputTokens = res.usage?.input_tokens || 0;
        outputTokens = res.usage?.output_tokens || 0;
      } catch (err) {
        throw this._normaliseError(err);
      }
    }

    this.appendHistory(convId, prompt, response);
    this._recordUsage(inputTokens, outputTokens, usedModel, queueItemId);

    return { response, conversationId: convId, usage: { inputTokens, outputTokens }, model: usedModel, provider: this.name };
  }
}

module.exports = { AnthropicProvider };
