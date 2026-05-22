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
 *   'freeTier' — local providers first (Ollama/LM Studio), then Gemini/Groq/Mistral
 *
 * Scoring (auto mode) — higher is better:
 *   +50  local provider (Ollama / LM Studio) — $0, no rate limits, fully offline
 *   +30  cloud provider with a permanent free tier (Gemini, Groq, Mistral)
 *   +20  provider has the most remaining RPM headroom
 *   +15  task type matches provider strength (coding → Anthropic/OpenAI, speed → Groq)
 *   -10  provider budget > 80% consumed this month
 *   -100 provider at rate limit right now (canSend = false)
 */

const FREE_TIER_PROVIDERS = new Set(['ollama', 'lmstudio', 'gemini', 'groq', 'mistral']);

// Local providers run entirely offline — no API key, no cost, no rate limits
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio']);

// Provider strengths for task-type routing
const TASK_STRENGTHS = {
  coding:    ['anthropic', 'openai', 'mistral', 'deepseek', 'groq', 'ollama', 'lmstudio'],
  research:  ['anthropic', 'openai', 'gemini',  'grok',    'ollama', 'lmstudio'],
  fast:      ['groq',      'deepseek', 'mistral', 'ollama', 'lmstudio'],
  graphics:  ['openai',    'gemini'],    // DALL-E / Gemini image gen (no local support)
  general:   ['openai',    'anthropic', 'gemini', 'grok', 'deepseek', 'mistral', 'groq', 'ollama', 'lmstudio'],
};

class QueueRouter {
  constructor(providerRegistry, multiUsageTracker) {
    this.registry = providerRegistry;
    this.tracker  = multiUsageTracker;

    // Round-robin cursor for 'balance' mode
    this._balanceCursor = 0;
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
      // Local models are hardware-bound — put them after cloud fast-tier providers
      const order = ['groq', 'deepseek', 'mistral', 'gemini', 'openai', 'anthropic', 'grok', 'ollama', 'lmstudio'];
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

  /** Get all configured providers that have capacity right now, with scores */
  _getCandidates(item) {
    const taskType = item.task_type || 'general';
    const taskStrengths = TASK_STRENGTHS[taskType] || TASK_STRENGTHS.general;
    const configured = this.registry.configured();

    return configured
      .filter(p => this.tracker.canSend(p.name))
      .map(p => {
        const status = this.tracker.getStatus(p.name);
        let score = 0;

        // Free tier bonus — local providers score highest (truly $0, no rate limits)
        if (LOCAL_PROVIDERS.has(p.name))                                    score += 50;
        else if (FREE_TIER_PROVIDERS.has(p.name) && p.hasFreeFreeTier?.()) score += 30;

        // RPM headroom (normalised 0-20)
        const rpmPct = status.headroom.rpm != null
          ? Math.min(20, Math.round((status.headroom.rpm / (status.limits.rpm || 1)) * 20))
          : 20;
        score += rpmPct;

        // Task type strength
        const strengthRank = taskStrengths.indexOf(p.name);
        if (strengthRank !== -1) score += Math.max(0, 15 - strengthRank * 3);

        // Budget penalty
        if (status.cost.budgetPct !== null && status.cost.budgetPct > 80) score -= 10;

        // Cost score (lower = cheaper — used by 'cheapest' mode)
        const models = p.getModels();
        const cheapest = models.reduce((best, m) => (!best || m.inputCost < best.inputCost) ? m : best, null);
        const costScore = cheapest != null ? cheapest.inputCost : 999;

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
    const configured    = this.registry.configured();

    return configured.map(p => {
      const status  = this.tracker.getStatus(p.name);
      const canSend = status.canSend;

      let score = 0;
      if (LOCAL_PROVIDERS.has(p.name))                                    score += 50;
      else if (FREE_TIER_PROVIDERS.has(p.name) && p.hasFreeFreeTier?.()) score += 30;

      const rpmPct = status.headroom.rpm != null
        ? Math.min(20, Math.round((status.headroom.rpm / (status.limits.rpm || 1)) * 20))
        : 20;
      score += rpmPct;

      const strengthRank = taskStrengths.indexOf(p.name);
      if (strengthRank !== -1) score += Math.max(0, 15 - strengthRank * 3);

      if (status.cost.budgetPct !== null && status.cost.budgetPct > 80) score -= 10;

      // Cheapest model for this provider (used for cost estimate)
      const models   = p.getModels();
      const cheapest = models.reduce(
        (best, m) => (!best || m.inputCost < best.inputCost) ? m : best, null
      );

      const budgetBlocked = status.cost.budgetBlocked || false;

      return {
        name:          p.name,
        score:         canSend ? score : score - 100,
        canSend,
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
