/**
 * COMPONENT 3: Anthropic API Client
 *
 * Wraps the official @anthropic-ai/sdk.
 * Records every sent message into UsageTracker.
 * Supports conversation threading via stored message history.
 */

const path = require('path');
const { app } = require('electron');

let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch { Anthropic = null; }

let Store;
try { Store = require('electron-store'); } catch { Store = null; }

class AnthropicClient {
  constructor(usageTracker) {
    this.tracker = usageTracker;
    this.client = null;

    // Persist API key and conversation histories securely
    this.store = Store ? new Store({ name: 'claude-queue-config', encryptionKey: 'cq-local-key' }) : null;

    // In-memory conversation history map: conversationId → messages[]
    this.conversations = new Map();

    // Load persisted API key on startup
    const savedKey = this.store?.get('apiKey');
    if (savedKey) this._initClient(savedKey);
  }

  // ── API Key ────────────────────────────────────────────────────────────────

  setApiKey(key) {
    if (!key?.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key format (should start with sk-ant-)');
    }
    this._initClient(key);
    this.store?.set('apiKey', key);
    return { success: true };
  }

  isApiKeySet() {
    return !!this.client;
  }

  _initClient(key) {
    if (!Anthropic) {
      console.warn('[Client] @anthropic-ai/sdk not available — running in mock mode');
      this.client = { _mock: true, apiKey: key };
      return;
    }
    this.client = new Anthropic.default({ apiKey: key });
  }

  // ── Send Message ───────────────────────────────────────────────────────────

  /**
   * Send a prompt to Claude.
   *
   * @param {object} opts
   * @param {string} opts.prompt          - The user's message text
   * @param {string} [opts.systemPrompt]  - Optional system prompt
   * @param {string} [opts.model]         - Model ID
   * @param {number} [opts.maxTokens]     - Max response tokens
   * @param {string} [opts.projectId]     - For namespacing conversations
   * @param {string} [opts.conversationId]- Reuse an existing conversation thread
   * @param {string} [opts.queueItemId]   - Reference back to queue item
   *
   * @returns {{ response: string, usage: object, conversationId: string }}
   */
  async sendMessage({
    prompt,
    systemPrompt = null,
    model = 'claude-sonnet-4-5',
    maxTokens = 1024,
    projectId = null,
    conversationId = null,
    queueItemId = null,
  }) {
    if (!this.client) throw new Error('API key not set. Please configure your Anthropic API key.');

    // Build or continue conversation history
    const convId = conversationId || this._newConvId(projectId);
    const history = this.conversations.get(convId) || [];

    const messages = [
      ...history,
      { role: 'user', content: prompt },
    ];

    let response, inputTokens = 0, outputTokens = 0;

    if (this.client._mock) {
      // Mock mode — for development without an API key
      await new Promise(r => setTimeout(r, 800));
      response = `[Mock Response] I received your message: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`;
      inputTokens = Math.ceil(prompt.length / 4);
      outputTokens = Math.ceil(response.length / 4);
    } else {
      const apiParams = {
        model,
        max_tokens: maxTokens,
        messages,
      };
      if (systemPrompt) apiParams.system = systemPrompt;

      const apiResponse = await this.client.messages.create(apiParams);
      response = apiResponse.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
      inputTokens = apiResponse.usage?.input_tokens || 0;
      outputTokens = apiResponse.usage?.output_tokens || 0;
    }

    // Update conversation history (keep last 20 turns to avoid token bloat)
    const updatedHistory = [
      ...messages,
      { role: 'assistant', content: response },
    ].slice(-40); // 20 turns × 2 roles
    this.conversations.set(convId, updatedHistory);

    // Record usage
    this.tracker.recordMessage({
      model,
      inputTokens,
      outputTokens,
      projectId,
      queueItemId,
    });

    return {
      response,
      conversationId: convId,
      usage: { inputTokens, outputTokens },
    };
  }

  /**
   * Get all conversation IDs (for routing UI)
   */
  getConversationIds() {
    return Array.from(this.conversations.keys());
  }

  /**
   * Clear a conversation's history
   */
  clearConversation(convId) {
    this.conversations.delete(convId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _newConvId(projectId = null) {
    const { v4: uuidv4 } = require('./uuid');
    const prefix = projectId ? `project-${projectId}` : 'conv';
    return `${prefix}-${uuidv4().slice(0, 8)}`;
  }
}

module.exports = { AnthropicClient };
