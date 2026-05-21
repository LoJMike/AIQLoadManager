const { BaseProvider } = require('./baseProvider');

class GeminiProvider extends BaseProvider {
  constructor(usageTracker, store) {
    super('gemini', usageTracker, store);
  }

  validateApiKey(key) { return typeof key === 'string' && key.length > 20; }

  _initClient(key) {
    this.apiKey = key;
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      this.client = new GoogleGenerativeAI(key);
    } catch {
      this.client = { _mock: true };
    }
  }

  getModels() {
    return [
      { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   contextWindow: 2_000_000, inputCost: 1.25,  outputCost: 10.00, tier: 'premium' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1_000_000, inputCost: 0.10,  outputCost: 0.40,  tier: 'fast', free: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1_000_000, inputCost: 0.075, outputCost: 0.30,  tier: 'fast', free: true },
    ];
  }

  // Gemini free tier: 15 RPM, 1,500 RPD, 1M TPM on Flash models
  getRateLimits() {
    return { rpm: 15, rpd: 1500, tpm: 1_000_000, tpd: null };
  }

  hasFreeFreeTier() { return true; }
  getDefaultModel() { return 'gemini-2.0-flash'; }

  async sendMessage({ prompt, systemPrompt, model, maxTokens = 1024, conversationId, projectId, queueItemId }) {
    if (!this.client) throw new Error('Gemini API key not configured');

    const convId = conversationId || this.newConvId(projectId);
    const usedModel = model || this.getDefaultModel();

    let response, inputTokens = 0, outputTokens = 0;

    if (this.client._mock) {
      await new Promise(r => setTimeout(r, 700));
      response = `[Gemini Mock] Received: "${prompt.slice(0, 60)}"`;
      inputTokens = Math.ceil(prompt.length / 4);
      outputTokens = Math.ceil(response.length / 4);
    } else {
      try {
        const genModel = this.client.getGenerativeModel({
          model: usedModel,
          systemInstruction: systemPrompt || undefined,
          generationConfig: { maxOutputTokens: maxTokens },
        });

        // Build chat history in Gemini format
        const history = this.getHistory(convId).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const chat = genModel.startChat({ history });
        const result = await chat.sendMessage(prompt);
        response = result.response.text();

        const usageMeta = result.response.usageMetadata;
        inputTokens = usageMeta?.promptTokenCount || Math.ceil(prompt.length / 4);
        outputTokens = usageMeta?.candidatesTokenCount || Math.ceil(response.length / 4);
      } catch (err) {
        throw this._normaliseError(err);
      }
    }

    this.appendHistory(convId, prompt, response);
    this._recordUsage(inputTokens, outputTokens, usedModel, queueItemId);

    return { response, conversationId: convId, usage: { inputTokens, outputTokens }, model: usedModel, provider: this.name };
  }
}

module.exports = { GeminiProvider };
