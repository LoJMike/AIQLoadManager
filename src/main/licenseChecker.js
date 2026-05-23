'use strict';

// ─── licenseChecker.js ────────────────────────────────────────────────────────
//
// Manages license state for AIQ Load Manager.
//
// THREE TIERS (matching landing-page.html):
//   free    — 2 providers, 10 queue items, 1 project, Manual + Free Tier routing
//   starter — 4 providers, 100 queue items, 5 projects, Auto + Balance routing
//   pro     — All 9 providers, unlimited queue/projects, all 6 routing modes
//
// CURRENT STATE (skeleton / preview mode):
//   - Everyone is effectively on "free" plan with all flags set to TRUE
//   - Nothing is gated yet — flags will be tightened at launch
//   - Key entry is wired but no real API validation happens
//
// WHEN YOU'RE READY TO LAUNCH PAID TIERS:
//   1. Tighten FREE_FLAGS below (set the limits you want — see TODO comments)
//   2. Replace the stub in setKey() with a real LemonSqueezy API call.
//      The API response should include the plan name ('starter' | 'pro').
//      Store both: store.set('licenseKey', key) + store.set('licensePlan', plan)
//   3. Add periodic re-validation (call _validateWithServer on app start)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Feature flag definitions ─────────────────────────────────────────────────
//
// Numeric limits use Infinity for "unlimited".
// routingModes: array of which modes are available for this tier.
// Boolean/string flags control feature access.

const FREE_FLAGS = {
  // TODO: tighten these when launching paid tiers (target values in comments):
  // maxProviders counts ALL configured providers — cloud + local (Ollama, LM Studio) combined.
  maxProviders:       9,            // TODO → 2  (e.g. Gemini + Groq, or Ollama + 1 cloud)
  maxQueueDepth:      Infinity,     // TODO → 10
  maxProjects:        Infinity,     // TODO → 1
  routingModes:       ['manual', 'freeTier', 'auto', 'balance', 'cheapest', 'fastest'], // TODO → ['manual', 'freeTier']
  costTracking:       true,         // TODO → false
  budgetCaps:         true,         // TODO → false
  tagSmartPriority:   true,         // TODO → false  (free: only ⚡ Urgent tag boosts)
  compareMode:        true,         // TODO → false
  batchImport:        true,         // TODO → false
  promptTemplates:    true,         // TODO → false  (Roadmap)
  usageExport:        'csv+json',   // TODO → false
  imageGeneration:    true,         // TODO → false  (Roadmap)
  videoGeneration:    true,         // TODO → false  (Roadmap)
  webhookDelivery:    true,         // TODO → false  (Roadmap)
  customRoutingRules: true,         // TODO → false
  costForecasting:    true,         // TODO → false  (Roadmap)
  mobileApp:          true,         // TODO → false  (Roadmap)
};

const STARTER_FLAGS = {
  maxProviders:       4,            // total including local (Ollama, LM Studio)
  maxQueueDepth:      100,
  maxProjects:        5,
  routingModes:       ['manual', 'freeTier', 'auto', 'balance'],
  costTracking:       true,
  budgetCaps:         false,
  tagSmartPriority:   false,        // only ⚡ Urgent tag boosts queue position
  compareMode:        false,
  batchImport:        true,
  promptTemplates:    true,         // Roadmap
  usageExport:        'csv',
  imageGeneration:    true,         // Roadmap
  videoGeneration:    false,
  webhookDelivery:    false,
  customRoutingRules: false,
  costForecasting:    false,
  mobileApp:          true,         // Roadmap — included at no extra charge
};

const PRO_FLAGS = {
  maxProviders:       9,            // all 7 cloud + Ollama + LM Studio = 9 total
  maxQueueDepth:      Infinity,
  maxProjects:        Infinity,
  routingModes:       ['manual', 'freeTier', 'auto', 'balance', 'cheapest', 'fastest'],
  costTracking:       true,
  budgetCaps:         true,
  tagSmartPriority:   true,         // all 9 tag types boost queue position
  compareMode:        true,
  batchImport:        true,
  promptTemplates:    true,         // Roadmap
  usageExport:        'csv+json',
  imageGeneration:    true,         // Roadmap
  videoGeneration:    true,         // Roadmap
  webhookDelivery:    true,         // Roadmap
  customRoutingRules: true,
  costForecasting:    true,         // Roadmap
  mobileApp:          true,         // Roadmap — included at no extra charge
};

// Human-readable descriptions shown in the UI
const FLAG_LABELS = {
  maxProviders:       'AI providers',
  maxQueueDepth:      'Queue depth',
  maxProjects:        'Projects',
  routingModes:       'Routing modes',
  costTracking:       'Cost tracking per provider & model',
  budgetCaps:         'Budget caps & overage alerts',
  tagSmartPriority:   'Tag-based smart priority (all tag types)',
  compareMode:        'Compare mode (A/B providers)',
  batchImport:        'Batch CSV import',
  promptTemplates:    'Prompt template library',
  usageExport:        'Usage history export',
  imageGeneration:    'Image generation (DALL-E 3, Flux, Ideogram…)',
  videoGeneration:    'Video generation (Runway, Pika, Kling)',
  webhookDelivery:    'Webhook output delivery',
  customRoutingRules: 'Custom routing rules & cost thresholds',
  costForecasting:    'Cost forecasting & trend reports',
  mobileApp:          'iOS & Android companion app',
};

// ─── LicenseChecker class ─────────────────────────────────────────────────────

class LicenseChecker {
  /**
   * @param {object} store  - electron-store instance (from store.js)
   */
  constructor(store) {
    this._store = store;
    this._cache = null;   // { plan, flags, flagLabels, hasKey, checkedAt }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the current license state.
   * Cached after first call; call clearCache() to force a re-read.
   *
   * Returns:
   *   { plan: 'free'|'starter'|'pro', flags: {...}, flagLabels: {...}, hasKey: boolean, checkedAt: number }
   */
  getLicense() {
    if (this._cache) return this._cache;

    const key      = this._store.get('licenseKey', null);
    const planType = this._store.get('licensePlan', null);  // 'starter' | 'pro' | null

    // stub: any stored key → use stored plan type, or default to 'pro' if plan not stored
    const plan = key ? (planType || 'pro') : 'free';

    const flagsByPlan = { free: FREE_FLAGS, starter: STARTER_FLAGS, pro: PRO_FLAGS };

    this._cache = {
      plan,
      flags:      { ...(flagsByPlan[plan] ?? FREE_FLAGS) },
      flagLabels: FLAG_LABELS,
      hasKey:     !!key,
      checkedAt:  Date.now(),
    };

    return this._cache;
  }

  /**
   * Saves a license key and plan type, then refreshes license state.
   * TODO: validate against LemonSqueezy API before saving.
   *
   * @param {string} key        - License key string
   * @param {string} [planType] - 'starter' | 'pro' (default 'pro' for backward compat)
   * Returns: { success: boolean, license?: object, error?: string }
   */
  setKey(key, planType = 'pro') {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'No key provided.' };
    }

    const trimmed = key.trim();
    if (trimmed.length < 8) {
      return { success: false, error: 'Key is too short.' };
    }

    if (!['starter', 'pro'].includes(planType)) {
      return { success: false, error: `Unknown plan type: ${planType}` };
    }

    // ── TODO: replace this stub with a real LemonSqueezy validate call ──────
    // const result = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ license_key: trimmed }),
    // });
    // if (!result.ok) return { success: false, error: 'Invalid license key.' };
    // const { plan } = await result.json();  // API returns the plan name
    // planType = plan;
    // ────────────────────────────────────────────────────────────────────────

    this._store.set('licenseKey', trimmed);
    this._store.set('licensePlan', planType);
    this._cache = null;   // bust cache
    return { success: true, license: this.getLicense() };
  }

  /**
   * Removes the stored license key and reverts to free plan.
   */
  removeKey() {
    this._store.delete('licenseKey');
    this._store.delete('licensePlan');
    this._cache = null;
    return { success: true, license: this.getLicense() };
  }

  /**
   * Force-clears the in-memory cache (call after store changes externally).
   */
  clearCache() {
    this._cache = null;
  }
}

module.exports = { LicenseChecker, FREE_FLAGS, STARTER_FLAGS, PRO_FLAGS, FLAG_LABELS };
