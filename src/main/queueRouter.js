/**
 * QueueRouter
 *
 * Decides WHICH provider processes each queue item.
 *
 * Routing modes (per queue item):
 *   'auto'     — router scores all configured providers and picks best
 *   'manual'   — uses the provider/model the user explicitly selected
 *   'balance'  — round-robins across all configured providers with capacity
 *   'cheapest' — always picks lowest estimated cost per token
 *   'fastest'  — always picks lowest latency provider (Groq wins here)
 *   'freeTier' — local providers first, then free-tier cloud (Gemini/Groq/Mistral/Cerebras/Cohere)
 *
 * Scoring (auto mode) — higher is better:
 *   +50  local provider (Ollama / LM Studio / Jan.ai / LocalAI / llama.cpp) — $0, no rate limits, fully offline
 *   +30  cloud provider with a permanent free tier (Gemini, Groq, Mistral)
 *   +20  provider has the most remaining RPM headroom
 *   +15  task type matches provider strength (coding → Anthropic/OpenAI, speed → Groq)
 *   -10  provider budget > 80% consumed this month
 *   -100 provider at rate limit right now (canSend = false)
 */

// Free-tier: local providers + permanently free cloud tiers + free-trial providers
const FREE_TIER_PROVIDERS = new Set([
  'ollama', 'lmstudio', 'jan', 'localai', 'llamacpp', // fully local — always free
  'gemini', 'groq', 'mistral',                        // permanent free tiers
  'cerebras', 'cohere',                               // free/trial API keys available
]);

// Local providers run entirely offline — no API key, no cost, no rate limits
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'jan', 'localai', 'llamacpp']);

// Provider strengths for task-type routing
const TASK_STRENGTHS = {
  coding:    ['anthropic', 'openai', 'mistral', 'deepseek', 'cohere', 'groq', 'fireworks', 'together', 'ollama', 'lmstudio', 'jan', 'localai', 'llamacpp'],
  research:  ['anthropic', 'openai', 'gemini', 'grok', 'cohere', 'minimax', 'together', 'ollama', 'lmstudio', 'jan', 'localai', 'llamacpp'],
  fast:      ['cerebras', 'groq', 'fireworks', 'deepseek', 'mistral', 'together', 'ollama', 'lmstudio', 'jan', 'localai', 'llamacpp'],
  graphics:  ['openai', 'gemini'],  // DALL-E / Gemini image gen (no local support)
  general:   ['openai', 'anthropic', 'gemini', 'grok', 'deepseek', 'mistral', 'groq', 'fireworks', 'together', 'minimax', 'cerebras', 'cohere', 'ollama', 'lmstudio', 'jan', 'localai', 'llamacpp'],
};

// Reachability cache TTLs
const REACHABLE_TTL_MS   = 30_000; // re-check a healthy provider every 30 s
const UNREACHABLE_TTL_MS = 15_000; // retry an unreachable provider sooner (15 s)
const PING_INTERVAL_MS   = 20_000; // background ping loop cadence

class QueueRouter {
  constructor(providerRegistry, multiUsageTracker) {
    this.registry = providerRegistry;
    this.tracker  = multiUsageTracker;

    // Round-robin cursor for 'balance' mode
    this._balanceCursor = 0;

    // ── Reachability cache ─────────────────────────────────────────────────
    // Map<providerName, { reachable: boolean, expiresAt: number }>
    // Entries are written by background pings and read synchronously during
    // routing so route() stays synchronous.
    this._reachableCache  = new Map();
    this._pingInFlight    = new Set(); // prevents duplicate concurrent pings
    this._pingTimer       = null;
  }

  // ── Reachability monitor ───────────────────────────────────────────────────

  /**
   * Start the background ping loop.  Call once after the router is created.
   * Pings all local providers immediately, then every PING_INTERVAL_MS.
   */
  startReachabilityMonitor() {
    // Initial ping right away so the cache is warm before the first prompt
    this._pingAllLocal();
    this._pingTimer = setInterval(() => this._pingAllLocal(), PING_INTERVAL_MS);
  }

  /**
   * Stop the background ping loop.  Call on app quit.
   */
  stopReachabilityMonitor() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  /**
   * Returns the entire reachability cache as a plain object.
   * Exposed over IPC so the UI can dim offline provider dots.
   *
   * @returns {Object.<string, boolean>}  { providerName: reachable }
   */
  getReachabilityStatus() {
    const out = {};
    for (const [name, entry] of this._reachableCache) {
      out[name] = entry.reachable;
    }
    return out;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Ping every registered local provider, skipping those with in-flight pings. */
  _pingAllLocal() {
    for (const name of LOCAL_PROVIDERS) {
      if (this.registry.providers[name]) {
        this._pingProvider(name);
      }
    }
  }

  /**
   * Fire-and-forget async ping for a single provider.
   * Updates the cache when the ping resolves.
   *
   * @param {string} name
   */
  _pingProvider(name) {
    if (this._pingInFlight.has(name)) return; // already pinging
    this._pingInFlight.add(name);

    const provider = this.registry.providers[name];
    if (!provider || typeof provider.checkReachable !== 'function') {
      this._pingInFlight.delete(name);
      return;
    }

    provider.checkReachable()
      .then(reachable => {
        const ttl = reachable ? REACHABLE_TTL_MS : UNREACHABLE_TTL_MS;
        this._reachableCache.set(name, { reachable, expiresAt: Date.now() + ttl });
      })
      .catch(() => {
        this._reachableCache.set(name, {
          reachable:  false,
          expiresAt:  Date.now() + UNREACHABLE_TTL_MS,
        });
      })
      .finally(() => {
        this._pingInFlight.delete(name);
      });
  }

  /**
   * Synchronous cache lookup for routing.
   * Returns true (optimistic) if no cache entry exists yet and triggers a
   * background ping so the next routing decision has real data.
   *
   * @param {string} name
   * @returns {boolean}
   */
  _isReachable(name) {
    if (!LOCAL_PROVIDERS.has(name)) return true; // cloud providers always "reachable"

    const cached = this._reachableCache.get(name);

    if (!cached) {
      // Not yet checked — optimistic + kick off a background ping
      this._pingProvider(name);
      return true;
    }

    if (Date.now() > cached.expiresAt) {
      // Stale — use last known value and refresh in background
      this._pingProvider(name);
      return cached.reachable;
    }

    return cached.reachable;
  }

  /**
   * Choose the best provider for a queue item.
   *
   * @param {object} item - queue item (from queueManager)
   * @returns {{ provider: string, model: string|null, reason: string }}
   */
  route(item) {
    const mode = item.routing_mode || 'auto';

    // Manual override — user explicitly chose
    if (mode === 'manual' && item.provider) {
      const p = this.registry.get(item.provider);
      if (!p.isConfigured()) {
        throw new Error(`Provider "${item.provider}" is not configured (add API key in settings)`);
      }
      // Check reachability for local providers before committing to the item
      if (LOCAL_PROVIDERS.has(item.provider) && !this._isReachable(item.provider)) {
        throw new Error(
          `${item.provider} appears to be offline (server not responding). ` +
          `Start the server and retry, or switch to a cloud provider.`
        );
      }
      if (!this.tracker.canSend(item.provider)) {
        if (this.tracker.isBudgetBlocked(item.provider)) {
          throw new Error(
            `${item.provider} is spend-blocked (budget set to $0). ` +
            `Update the budget in Settings → Connectors to allow spending.`
          );
        }
        const waitMs = this.tracker.msUntilNextSlot(item.provider);
        return { wait: true, waitMs, reason: `${item.provider} at rate limit` };
      }
      return { provider: item.provider, model: item.model || null, reason: 'manual selection' };
    }

    const candidates = this._getCandidates(item);

    if (candidates.length === 0) {
      // All providers at limit — return wait info
      const waits = this.registry.configured()
        .map(p => ({ name: p.name, ms: this.tracker.msUntilNextSlot(p.name) }))
        .filter(x => x.ms > 0)
        .sort((a, b) => a.ms - b.ms);

      const shortest = waits[0];
      return {
        wait: true,
        waitMs: shortest?.ms || 5000,
        reason: shortest ? `All providers at limit; ${shortest.name} frees up soonest` : 'No providers configured',
      };
    }

    let chosen;
    if (mode === 'balance') {
      chosen = this._roundRobin(candidates);
    } else if (mode === 'cheapest') {
      chosen = candidates.sort((a, b) => a.costScore - b.costScore)[0];
    } else if (mode === 'fastest') {
      // Cerebras and Fireworks lead (wafer-scale / optimised inference); Groq next.
      // Local models are hardware-bound — put them after all cloud fast-tier providers.
      const order = ['cerebras', 'groq', 'fireworks', 'deepseek', 'mistral', 'gemini', 'together', 'openai', 'anthropic', 'grok', 'cohere', 'minimax', 'ollama', 'lmstudio', 'jan', 'localai', 'llamacpp'];
      candidates.sort((a, b) => {
        const ai = order.indexOf(a.name); const bi = order.indexOf(b.name);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      chosen = candidates[0];
    } else if (mode === 'freeTier') {
      // Local providers are always free and have no rate limits — prefer them first
      const local = candidates.filter(c => LOCAL_PROVIDERS.has(c.name));
      const free  = candidates.filter(c => FREE_TIER_PROVIDERS.has(c.name) && !LOCAL_PROVIDERS.has(c.name));
      if (local.length > 0)     chosen = local[0];
      else if (free.length > 0) chosen = free[0];
      else                      chosen = candidates[0];
    } else {
      // auto — score-based
      chosen = candidates.sort((a, b) => b.score - a.score)[0];
    }

    return {
      provider: chosen.name,
      model:    chosen.bestModel || item.model || null,
      reason:   `${mode} routing → ${chosen.name} (score: ${chosen.score})`,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Compute the numeric score for a single provider.
   * Single source of truth — used by both _getCandidates and previewCandidates
   * so the two never drift apart.
   *
   * @param {object} provider       - provider instance from registry
   * @param {object} status         - result of tracker.getStatus(provider.name)
   * @param {string[]} taskStrengths - ordered array of preferred provider names for this task type
   * @returns {{ score: number, costScore: number, cheapest: object|null }}
   */
  _scoreProvider(provider, status, taskStrengths) {
    let score = 0;

    // Free tier bonus — local providers score highest (truly $0, no rate limits)
    if (LOCAL_PROVIDERS.has(provider.name))                                          score += 50;
    else if (FREE_TIER_PROVIDERS.has(provider.name) && provider.hasFreeFreeTier?.()) score += 30;

    // RPM headroom (normalised 0-20)
    const rpmPct = status.headroom.rpm != null
      ? Math.min(20, Math.round((status.headroom.rpm / (status.limits.rpm || 1)) * 20))
      : 20;
    score += rpmPct;

    // Task type strength
    const strengthRank = taskStrengths.indexOf(provider.name);
    if (strengthRank !== -1) score += Math.max(0, 15 - strengthRank * 3);

    // Budget penalty
    if (status.cost.budgetPct !== null && status.cost.budgetPct > 80) score -= 10;

    // Cheapest model (used by 'cheapest' routing mode and cost estimates)
    const models   = provider.getModels();
    const cheapest = models.reduce((best, m) => (!best || m.inputCost < best.inputCost) ? m : best, null);
    const costScore = cheapest != null ? cheapest.inputCost : 999;

    return { score, costScore, cheapest };
  }

  /** Get all configured providers that have capacity right now, with scores */
  _getCandidates(item) {
    const taskType      = item.task_type || 'general';
    const taskStrengths = TASK_STRENGTHS[taskType] || TASK_STRENGTHS.general;

    return this.registry.configured()
      .filter(p => {
        if (!this.tracker.canSend(p.name)) return false;
        // Skip local providers that the reachability cache knows are offline
        if (!this._isReachable(p.name)) return false;
        return true;
      })
      .map(p => {
        const status                     = this.tracker.getStatus(p.name);
        const { score, costScore, cheapest } = this._scoreProvider(p, status, taskStrengths);
        return {
          name:      p.name,
          score,
          costScore,
          bestModel: cheapest?.id || null,
        };
      });
  }

  _roundRobin(candidates) {
    const idx = this._balanceCursor % candidates.length;
    this._balanceCursor++;
    return candidates[idx];
  }

  /**
   * Returns ALL configured providers scored and ranked — including those
   * currently at their rate limit.  Used by the UI to render a live
   * provider-comparison table before the user queues a prompt.
   *
   * Each entry includes inputRate / outputRate ($/M tokens) so the caller
   * can compute an estimated cost for any (inputTokens, outputTokens) pair.
   *
   * @param {object} item  - partial queue item (task_type used for scoring)
   * @returns {Array}
   */
  previewCandidates(item) {
    const taskType      = item.task_type || 'general';
    const taskStrengths = TASK_STRENGTHS[taskType] || TASK_STRENGTHS.general;

    return this.registry.configured().map(p => {
      const status                     = this.tracker.getStatus(p.name);
      const { score, cheapest }        = this._scoreProvider(p, status, taskStrengths);
      const canSend                    = status.canSend;
      const budgetBlocked              = status.cost.budgetBlocked || false;
      const reachable                  = this._isReachable(p.name);

      return {
        name:          p.name,
        score:         (canSend && reachable) ? score : score - 100,
        canSend:       canSend && reachable,
        reachable,
        budgetBlocked,
        waitMs:        canSend ? 0 : (status.nextSlotMs || 0),
        bestModel:     cheapest?.id   || null,
        bestModelName: cheapest?.name || null,
        inputRate:     cheapest?.inputCost  ?? 0,   // $/M tokens
        outputRate:    cheapest?.outputCost ?? 0,   // $/M tokens
      };
    }).sort((a, b) => b.score - a.score);
  }
}

module.exports = { QueueRouter, FREE_TIER_PROVIDERS, LOCAL_PROVIDERS, TASK_STRENGTHS };
