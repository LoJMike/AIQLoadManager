const { BaseProvider } = require('./baseProvider');

class OpenAIProvider extends BaseProvider {
  constructor(usageTracker, store) {
    super('openai', usageTracker, store);
  }

  validateApiKey(key) { return typeof key === 'string' && key.startsWith('sk-'); }

  _initClient(key) {
    this.apiKey = key;
    try {
      const { OpenAI } = require('openai');
      this.client = new OpenAI({ apiKey: key });
    } catch {
      this.client = { _mock: true };
    }
  }

  getModels() {
    return [
      { id: 'gpt-4o',          name: 'GPT-4o',        contextWindow: 128_000, inputCost: 2.50,  outputCost: 10.00, tier: 'premium' },
      { id: 'gpt-4o-mini',     name: 'GPT-4o Mini',   contextWindow: 128_000, inputCost: 0.15,  outputCost: 0.60,  tier: 'fast' },
      { id: 'gpt-4.1',         name: 'GPT-4.1',       contextWindow: 128_000, inputCost: 2.00,  outputCost: 8.00,  tier: 'standard' },
      { id: 'gpt-4.1-mini',    name: 'GPT-4.1 Mini',  contextWindow: 128_000, inputCost: 0.40,  outputCost: 1.60,  tier: 'fast' },
      { id: 'o4-mini',         name: 'o4-mini',        contextWindow: 128_000, inputCost: 1.10,  outputCost: 4.40,  tier: 'reasoning' },
    ];
  }

  getRateLimits() {
    return { rpm: 500, rpd: null, tpm: 200_000, tpd: null };
  }

  getDefaultModel() { return 'gpt-4o-mini'; }

  async sendMessage({ prompt, systemPrompt, model, maxTokens = 1024, conversationId, projectId, queueItemId }) {
    if (!this.client) throw new Error('OpenAI API key not configured');

    const convId = conversationId || this.newConvId(projectId);
    const history = this.getHistory(convId);
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push(...history, { role: 'user', content: prompt });
    const usedModel = model || this.getDefaultModel();

    let response, inputTokens = 0, outputTokens = 0;

    if (this.client._mock) {
      await new Promise(r => setTimeout(r, 500));
      response = `[OpenAI Mock] Received: "${prompt.slice(0, 60)}"`;
      inputTokens = Math.ceil(prompt.length / 4);
      outputTokens = Math.ceil(response.length / 4);
    } else {
      try {
        const res = await this.client.chat.completions.create({
          model: usedModel, max_tokens: maxTokens, messages,
        });
        response = res.choices[0]?.message?.content || '';
        inputTokens = res.usage?.prompt_tokens || 0;
        outputTokens = res.usage?.completion_tokens || 0;
      } catch (err) {
        throw this._normaliseError(err);
      }
    }

    this.appendHistory(convId, prompt, response);
    this._recordUsage(inputTokens, outputTokens, usedModel, queueItemId);

    return { response, conversationId: convId, usage: { inputTokens, outputTokens }, model: usedModel, provider: this.name };
  }
}

module.exports = { OpenAIProvider };
