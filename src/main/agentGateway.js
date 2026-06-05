"use strict";

// ─── agentGateway.js ─────────────────────────────────────────────────────────
//
// OpenAI-compatible HTTP gateway that lets any agent framework route prompts
// through AIQ's provider registry, queue router, and cost tracker.
//
// Listening at:  http://localhost:<port>/v1  (default port: 8787)
//
// Endpoints:
//   GET  /v1/models                — list all configured providers + models
//   POST /v1/chat/completions      — route a chat completion through AIQ
//
// Usage (any OpenAI-compatible client):
//   const openai = new OpenAI({
//     apiKey: 'aiq-gateway',
//     baseURL: 'http://localhost:8787/v1',
//   });
//   const res = await openai.chat.completions.create({
//     model: 'auto',          // or 'fastest', 'cheapest', 'groq', 'anthropic', etc.
//     messages: [{ role: 'user', content: 'Hello!' }],
//   });
//
// Model field routing:
//   'auto'      — AIQ picks the best available provider (default routing)
//   'fastest'   — picks lowest-latency provider
//   'cheapest'  — picks lowest-cost provider
//   'balance'   — round-robins across configured providers
//   'freeTier'  — local + free cloud providers only
//   '<provider>'      — manual: sends to that specific provider (e.g. 'groq', 'anthropic')
//   '<provider>/<model>' — manual: specific provider + model (e.g. 'openai/gpt-4o')
// ─────────────────────────────────────────────────────────────────────────────

const http = require("http");

const ROUTING_MODES = new Set(["auto", "fastest", "cheapest", "balance", "freeTier", "manual"]);
const DEFAULT_PORT  = 8787;
const GATEWAY_VERSION = "0.6.0";

class AgentGateway {
  /**
   * @param {import('./providers/providerRegistry').ProviderRegistry} registry
   * @param {import('./multiUsageTracker').MultiUsageTracker}         tracker
   * @param {import('./queueRouter').QueueRouter}                     router
   */
  constructor(registry, tracker, router) {
    this.registry = registry;
    this.tracker  = tracker;
    this.router   = router;
    this._server  = null;
    this._port    = DEFAULT_PORT;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Start the HTTP gateway on the given port.
   * Resolves with the port number when listening.
   *
   * @param {number} [port=8787]
   * @returns {Promise<number>}
   */
  start(port = DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
      if (this._server) {
        resolve(this._port);
        return;
      }

      this._port = port;
      this._server = http.createServer((req, res) => {
        this._handleRequest(req, res).catch((err) => {
          // Last-resort error handler — prevents unhandled rejection crashes
          console.error("[AgentGateway] Unhandled error:", err);
          if (!res.headersSent) {
            this._sendError(res, 500, "internal_server_error", err.message || "Internal server error");
          }
        });
      });

      this._server.on("error", (err) => {
        console.error("[AgentGateway] Server error:", err.message);
        if (err.code === "EADDRINUSE") {
          reject(new Error(`Port ${port} is already in use. Change the gateway port in Settings.`));
        } else {
          reject(err);
        }
      });

      this._server.listen(port, "127.0.0.1", () => {
        console.log(`[AgentGateway] Listening on http://127.0.0.1:${port}/v1`);
        resolve(port);
      });
    });
  }

  /**
   * Gracefully stop the HTTP gateway.
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this._server) { resolve(); return; }
      this._server.close(() => {
        this._server = null;
        console.log("[AgentGateway] Stopped.");
        resolve();
      });
    });
  }

  /**
   * True when the gateway is running.
   * @returns {boolean}
   */
  isRunning() {
    return !!this._server?.listening;
  }

  /**
   * Returns status info for the IPC layer.
   * @returns {{ running: boolean, port: number, url: string }}
   */
  getStatus() {
    return {
      running: this.isRunning(),
      port:    this._port,
      url:     this.isRunning() ? `http://127.0.0.1:${this._port}/v1` : null,
    };
  }

  // ── Request dispatch ────────────────────────────────────────────────────────

  /**
   * Route an incoming HTTP request to the correct handler.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse}  res
   */
  async _handleRequest(req, res) {
    // CORS — allow any localhost agent framework to call us
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url?.split("?")[0] ?? "";

    if (req.method === "GET" && url === "/v1/models") {
      return this._handleModels(req, res);
    }

    if (req.method === "POST" && url === "/v1/chat/completions") {
      const body = await this._readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return this._sendError(res, 400, "invalid_request_error", "Request body must be valid JSON.");
      }
      return this._handleChatCompletions(req, res, parsed);
    }

    // Unknown endpoint
    this._sendError(
      res, 404, "invalid_request_error",
      `Unknown endpoint: ${req.method} ${url}. Supported: GET /v1/models, POST /v1/chat/completions`
    );
  }

  // ── GET /v1/models ──────────────────────────────────────────────────────────

  /**
   * Returns all configured providers and their models in OpenAI list format.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse}  res
   */
  _handleModels(req, res) {
    const data = [];

    // Virtual routing-mode models (always available)
    for (const mode of ["auto", "fastest", "cheapest", "balance", "freeTier"]) {
      data.push({
        id:       mode,
        object:   "model",
        created:  0,
        owned_by: "aiq-gateway",
      });
    }

    // Real provider models (only for configured providers)
    for (const provider of this.registry.configured()) {
      for (const model of provider.getModels()) {
        data.push({
          id:       `${provider.name}/${model.id}`,
          object:   "model",
          created:  0,
          owned_by: provider.name,
        });
      }
    }

    this._sendJSON(res, 200, { object: "list", data });
  }

  // ── POST /v1/chat/completions ───────────────────────────────────────────────

  /**
   * Handle a chat completions request, routing it through AIQ.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse}  res
   * @param {object}               body  — parsed JSON request body
   */
  async _handleChatCompletions(req, res, body) {
    const { model = "auto", messages, max_tokens, stream } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return this._sendError(res, 400, "invalid_request_error", "messages array is required and must not be empty.");
    }

    // Streaming: inform caller it is not yet supported
    if (stream) {
      return this._sendError(
        res, 400, "invalid_request_error",
        "Streaming (stream: true) is not yet supported by the AIQ Agent Gateway. Set stream: false."
      );
    }

    // Parse the model field to determine routing mode + optional provider/model override
    const { routingMode, providerName, modelId } = this._parseModelField(model);

    // Rebuild prompt from messages array
    const { systemPrompt, userPrompt } = this._extractPrompt(messages);

    if (!userPrompt) {
      return this._sendError(res, 400, "invalid_request_error", "No user message found in messages array.");
    }

    // Build a synthetic queue item for the router
    const item = {
      routing_mode: routingMode,
      provider:     providerName ?? null,
      model:        modelId ?? null,
      system_prompt: systemPrompt ?? null,
      task_type:    "general",
    };

    let routeDecision;
    try {
      routeDecision = this.router.route(item);
    } catch (routeErr) {
      return this._sendError(res, 503, "service_unavailable", routeErr.message);
    }

    if (routeDecision?.wait) {
      return this._sendError(
        res, 429, "rate_limit_error",
        `All providers are rate-limited. Retry after ${Math.ceil(routeDecision.waitMs / 1000)}s.`,
        { retry_after: Math.ceil(routeDecision.waitMs / 1000) }
      );
    }

    const chosenProvider = routeDecision.provider;
    const chosenModel    = routeDecision.model || undefined;

    let result;
    try {
      result = await this.registry.sendMessage(chosenProvider, {
        prompt:      userPrompt,
        systemPrompt: systemPrompt ?? undefined,
        model:       chosenModel,
        maxTokens:   max_tokens ?? 1024,
      });
    } catch (sendErr) {
      return this._sendError(res, 500, "internal_server_error", sendErr.message);
    }

    // Wrap in OpenAI-format response
    const responseBody = {
      id:      `chatcmpl-aiq-${Date.now()}`,
      object:  "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model:   result.model || chosenModel || chosenProvider,
      choices: [{
        index:         0,
        message:       { role: "assistant", content: result.response ?? "" },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens:     result.usage?.inputTokens  ?? 0,
        completion_tokens: result.usage?.outputTokens ?? 0,
        total_tokens:      (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
      },
      // AIQ extension fields (non-standard, prefixed with x_aiq_)
      x_aiq_provider:      result.provider,
      x_aiq_routing_mode:  routingMode,
      x_aiq_gateway_version: GATEWAY_VERSION,
    };

    this._sendJSON(res, 200, responseBody);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Parse the OpenAI `model` field into AIQ routing instructions.
   *
   * Accepted formats:
   *   "auto"                → routingMode = 'auto'
   *   "fastest"             → routingMode = 'fastest'
   *   "groq"                → routingMode = 'manual', providerName = 'groq'
   *   "openai/gpt-4o"       → routingMode = 'manual', providerName = 'openai', modelId = 'gpt-4o'
   *
   * @param {string} model
   * @returns {{ routingMode: string, providerName: string|null, modelId: string|null }}
   */
  _parseModelField(model) {
    if (!model || model === "auto") {
      return { routingMode: "auto", providerName: null, modelId: null };
    }

    // Named routing modes
    if (ROUTING_MODES.has(model)) {
      return { routingMode: model, providerName: null, modelId: null };
    }

    // "provider/model" or "provider" pattern
    const slash = model.indexOf("/");
    if (slash !== -1) {
      const provider = model.slice(0, slash);
      const mid      = model.slice(slash + 1);
      return { routingMode: "manual", providerName: provider, modelId: mid || null };
    }

    // Just a provider name
    return { routingMode: "manual", providerName: model, modelId: null };
  }

  /**
   * Extract a system prompt and the last user message from an OpenAI messages array.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @returns {{ systemPrompt: string|null, userPrompt: string|null }}
   */
  _extractPrompt(messages) {
    let systemPrompt = null;
    let userPrompt   = null;

    for (const msg of messages) {
      if (msg.role === "system" && msg.content) {
        systemPrompt = msg.content;
      }
    }

    // Last user message is the prompt
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user" && messages[i].content) {
        userPrompt = messages[i].content;
        break;
      }
    }

    return { systemPrompt, userPrompt };
  }

  /**
   * Read the full request body as a string.
   *
   * @param {http.IncomingMessage} req
   * @returns {Promise<string>}
   */
  _readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end",  () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  /**
   * Write a JSON response.
   *
   * @param {http.ServerResponse} res
   * @param {number}              statusCode
   * @param {object}              body
   */
  _sendJSON(res, statusCode, body) {
    const json = JSON.stringify(body);
    res.writeHead(statusCode, {
      "Content-Type":   "application/json",
      "Content-Length": Buffer.byteLength(json),
    });
    res.end(json);
  }

  /**
   * Write an OpenAI-format error response.
   *
   * @param {http.ServerResponse} res
   * @param {number}              statusCode
   * @param {string}              type       - OpenAI error type string
   * @param {string}              message
   * @param {object}              [extra]    - extra fields merged into the error object
   */
  _sendError(res, statusCode, type, message, extra = {}) {
    this._sendJSON(res, statusCode, {
      error: { type, message, ...extra },
    });
  }
}

module.exports = { AgentGateway, DEFAULT_PORT };
