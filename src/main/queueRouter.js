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
 *   'freeTier' — prefers providers with permanent free tiers (Gemini, Groq, Mistral)
 *
 * Scoring (auto mode) — higher is better:
 *   +30  provider has free tier capacity
 *   +20  provider has the most remaining RPM headroom
 *   +15  task type matches provider strength (coding → Anthropic/OpenAI, speed → Groq)
 *   -10  provider budget > 80% consumed this month
 *   -100 provider at rate limit right now (canSend = false)
 */

const FREE_TIER_PROVIDERS = new Set(['gemini', 'groq', 'mistral']);

// Provider strengths for task-type routing
const TASK_STRENGTHS = {
  coding:    ['anthropic', 'openai', 'mistral', 'deepseek', 'groq'],
  research:  ['anthropic', 'openai', 'gemini',  'grok'],
  fast:      ['groq',      'deepseek', 'mistral'],
  graphics:  ['openai',    'gemini'],    // DALL-E / Gemini image gen
  general:   ['openai',    'anthropic', 'gemini', 'grok', 'deepseek', 'mistral', 'groq'],
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
      const order = ['groq', 'deepseek', 'mistral', 'gemini', 'openai', 'anthropic', 'grok'];
      candidates.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
      chosen = candidates[0];
    } else if (mode === 'freeTier') {
      const free = candidates.filter(c => FREE_TIER_PROVIDERS.has(c.name));
      chosen = free.length > 0 ? free[0] : candidates[0];
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

        // Free tier bonus
        if (FREE_TIER_PROVIDERS.has(p.name) && p.hasFreeFreeTier?.()) score += 30;

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
        const costScore = cheapest?.inputCost || 999;

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
}

module.exports = { QueueRouter, FREE_TIER_PROVIDERS, TASK_STRENGTHS };
