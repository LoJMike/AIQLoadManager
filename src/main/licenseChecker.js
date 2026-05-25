'use strict';

// ─── licenseChecker.js ────────────────────────────────────────────────────────
//
// Manages license state for AIQ Load Manager.
//
// FIVE TIERS (matching landing-page.html and README.md):
//   free     — 5 providers (local only), 10 queue items, 1 project, Manual + Free Tier routing
//              50 cloud prompt runs/mo, 100K cloud tokens/mo, budget spend view-only
//   starter  — 8 providers (5 local + Gemini/Groq/Mistral), 100 queue items, 5 projects,
//              Auto + Balance routing, 500 cloud runs/mo, 1M cloud tokens/mo
//   pro      — All 12 providers, 500 queue items (soft cap), unlimited projects,
//              all 6 routing modes, 2,500 cloud runs/mo, 5M cloud tokens/mo
//   pro_plus — All 12 providers, unlimited queue, unlimited projects,
//              all 6 routing modes, 10,000 cloud runs/mo, 20M cloud tokens/mo,
//              consensus mode, priority support — COMING SOON
//   team     — All 12 providers, unlimited queue, unlimited projects,
//              all 6 routing modes, 25,000 cloud runs/mo, 60M cloud tokens/mo (pooled),
//              shared settings, admin controls — COMING SOON
//
// CURRENT STATE (skeleton / preview mode):
//   - Everyone is effectively on "free" plan with all flags set to TRUE
//   - Nothing is gated yet — flags will be tightened at launch
//   - Key entry is wired but no real API validation happens
//
// WHEN YOU'RE READY TO LAUNCH PAID TIERS:
//   1. Tighten FREE_FLAGS below (set the limits you want — see TODO comments)
//   2. Replace the stub in setKey() with a real LemonSqueezy API call.
//      The API response should include the plan name ('starter' | 'pro' | 'team').
//      Store both: store.set('licenseKey', key) + store.set('licensePlan', plan)
//   3. Add periodic re-validation (call _validateWithServer on app start)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Feature flag definitions ─────────────────────────────────────────────────
//
// Numeric limits use Infinity for "unlimited".
// routingModes: array of which modes are available for this tier.
// Boolean/string flags control feature access.
// monthlyCloudPrompts / monthlyCloudTokens: AIQ-side caps (not provider API limits).
//   These protect service margins — users still pay their providers directly.

const FREE_FLAGS = {
  // TODO: tighten these when launching paid tiers (target values in comments):
  // maxProviders: 5 local providers only (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp).
  //   No cloud providers on Free tier.
  maxProviders:          12,           // TODO → 5  (local only)
  maxQueueDepth:         Infinity,     // TODO → 10
  maxProjects:           Infinity,     // TODO → 1
  routingModes:          ['manual', 'freeTier', 'auto', 'balance', 'cheapest', 'fastest'], // TODO → ['manual', 'freeTier']
  costTracking:          true,         // TODO → false  (detailed cost per provider/model; Starter+)
  budgetView:            true,         // view estimated spend — available on ALL tiers
  budgetCaps:            true,         // TODO → false  (set monthly caps; Starter+ = false, Pro = true)
  tagSmartPriority:      true,         // TODO → false  (free: only ⚡ Urgent tag boosts)
  compareMode:           true,         // TODO → false
  batchImport:           true,         // TODO → false
  promptTemplates:       true,         // TODO → false  (Roadmap)
  usageExport:           'csv+json',   // TODO → false
  imageGeneration:       true,         // TODO → false  (Roadmap)
  videoGeneration:       true,         // TODO → false  (Roadmap)
  webhookDelivery:       true,         // TODO → false  (Roadmap)
  customRoutingRules:    true,         // TODO → false
  costForecasting:       true,         // TODO → false  (Roadmap)
  mobileApp:             true,         // TODO → false  (Roadmap)
  // AIQ-side monthly cloud caps (not provider API rate limits)
  monthlyCloudPrompts:   Infinity,     // TODO → 50
  monthlyCloudTokens:    Infinity,     // TODO → 100_000
  // New feature flags
  modelControl:          true,         // TODO → false  (per-provider default model; Pro+)
  digestExport:          true,         // TODO → false  (session digest export; Starter+)
  responseStylePresets:  true,         // available on all tiers
  projectHistory:        true,         // available on all tiers
  // Team-only flags
  sharedSettings:        false,
  adminControls:         false,
  teamCollaboration:     false,
};

const STARTER_FLAGS = {
  // 8 providers: 5 local (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp)
  //            + 3 free cloud (Gemini, Groq, Mistral)
  maxProviders:          8,
  maxQueueDepth:         100,
  maxProjects:           5,
  routingModes:          ['manual', 'freeTier', 'auto', 'balance'],
  costTracking:          true,
  budgetView:            true,
  budgetCaps:            false,        // Starter can view spend but not set caps
  tagSmartPriority:      false,        // only ⚡ Urgent tag boosts queue position
  compareMode:           false,
  batchImport:           true,
  promptTemplates:       true,         // Roadmap
  usageExport:           'csv',
  imageGeneration:       true,         // Roadmap
  videoGeneration:       false,
  webhookDelivery:       false,
  customRoutingRules:    false,
  costForecasting:       false,
  mobileApp:             true,         // Roadmap — included at no extra charge
  monthlyCloudPrompts:   500,
  monthlyCloudTokens:    1_000_000,
  // New feature flags
  modelControl:          false,        // per-provider default model (Pro+)
  digestExport:          true,         // session digest export — Starter+
  responseStylePresets:  true,         // all tiers
  projectHistory:        true,         // all tiers
  sharedSettings:        false,
  adminControls:         false,
  teamCollaboration:     false,
};

const PRO_FLAGS = {
  // All 12 providers: 5 local + 7 cloud (Gemini, Groq, Mistral, Claude, OpenAI, DeepSeek, xAI Grok)
  maxProviders:          12,
  maxQueueDepth:         500,          // soft cap — higher limits on the roadmap (Pro+)
  maxProjects:           Infinity,
  routingModes:          ['manual', 'freeTier', 'auto', 'balance', 'cheapest', 'fastest'],
  costTracking:          true,
  budgetView:            true,
  budgetCaps:            true,         // full budget caps + overage alerts
  tagSmartPriority:      true,         // all 9 tag types boost queue position
  compareMode:           true,
  batchImport:           true,
  promptTemplates:       true,         // Roadmap
  usageExport:           'csv+json',
  imageGeneration:       true,         // Roadmap
  videoGeneration:       true,         // Roadmap
  webhookDelivery:       true,         // Roadmap
  customRoutingRules:    true,
  costForecasting:       true,         // Roadmap
  mobileApp:             true,         // Roadmap — included at no extra charge
  monthlyCloudPrompts:   2_500,
  monthlyCloudTokens:    5_000_000,
  // New feature flags
  modelControl:          true,         // per-provider default model — Pro+
  digestExport:          true,         // session digest export — Pro+
  responseStylePresets:  true,         // all tiers
  projectHistory:        true,         // all tiers
  sharedSettings:        false,
  adminControls:         false,
  teamCollaboration:     false,
};

// COMING SOON — Pro+ tier flags (not yet enforced; defined for forward-compatibility)
const PRO_PLUS_FLAGS = {
  maxProviders:          12,
  maxQueueDepth:         Infinity,     // unlimited — key Pro+ differentiator over Pro's 500 soft cap
  maxProjects:           Infinity,
  routingModes:          ['manual', 'freeTier', 'auto', 'balance', 'cheapest', 'fastest'],
  costTracking:          true,
  budgetView:            true,
  budgetCaps:            true,
  tagSmartPriority:      true,
  compareMode:           true,
  consensusMode:         true,         // Roadmap — meta-model synthesis across Compare results
  batchImport:           true,
  promptTemplates:       true,
  usageExport:           'csv+json',
  imageGeneration:       true,
  videoGeneration:       true,
  webhookDelivery:       true,         // Roadmap
  customRoutingRules:    true,
  costForecasting:       true,         // Roadmap
  mobileApp:             true,
  prioritySupport:       true,         // Priority email support
  monthlyCloudPrompts:   10_000,
  monthlyCloudTokens:    20_000_000,   // 20M
  modelControl:          true,
  digestExport:          true,
  responseStylePresets:  true,
  projectHistory:        true,
  sharedSettings:        false,
  adminControls:         false,
  teamCollaboration:     false,
};

// COMING SOON — Team tier flags (not yet enforced; defined for forward-compatibility)
const TEAM_FLAGS = {
  maxProviders:          12,
  maxQueueDepth:         500,          // same soft cap as Pro; higher limits planned
  maxProjects:           Infinity,
  routingModes:          ['manual', 'freeTier', 'auto', 'balance', 'cheapest', 'fastest'],
  costTracking:          true,
  budgetView:            true,
  budgetCaps:            true,
  tagSmartPriority:      true,
  compareMode:           true,
  batchImport:           true,
  promptTemplates:       true,
  usageExport:           'csv+json',
  imageGeneration:       true,
  videoGeneration:       true,
  webhookDelivery:       true,
  customRoutingRules:    true,
  costForecasting:       true,
  mobileApp:             true,
  // Monthly caps are pooled across all seats
  monthlyCloudPrompts:   25_000,       // pooled across team
  monthlyCloudTokens:    60_000_000,   // 60M pooled across team
  // New feature flags
  modelControl:          true,
  digestExport:          true,
  responseStylePresets:  true,
  projectHistory:        true,
  // Team-only flags
  sharedSettings:        true,
  adminControls:         true,
  teamCollaboration:     true,
};

// Human-readable descriptions shown in the UI
const FLAG_LABELS = {
  maxProviders:          'AI providers',
  maxQueueDepth:         'Queue depth',
  maxProjects:           'Projects',
  routingModes:          'Routing modes',
  costTracking:          'Cost tracking per provider & model',
  budgetView:            'Budget spend visibility (view-only)',
  budgetCaps:            'Budget caps & overage alerts',
  tagSmartPriority:      'Tag-based smart priority (all tag types)',
  compareMode:           'Compare mode (A/B providers)',
  consensusMode:         'Consensus mode (meta-model synthesis across Compare results)',
  prioritySupport:       'Priority email support',
  batchImport:           'Batch CSV import',
  promptTemplates:       'Prompt template library',
  usageExport:           'Usage history export',
  imageGeneration:       'Image generation (DALL-E 3, Flux, Ideogram…)',
  videoGeneration:       'Video generation (Runway, Pika, Kling)',
  webhookDelivery:       'Webhook output delivery',
  customRoutingRules:    'Custom routing rules & cost thresholds',
  costForecasting:       'Cost forecasting & trend reports',
  mobileApp:             'iOS & Android companion app',
  monthlyCloudPrompts:   'Monthly cloud prompt runs',
  monthlyCloudTokens:    'Monthly cloud tokens',
  sharedSettings:        'Shared team settings',
  adminControls:         'Admin controls',
  teamCollaboration:     'Team collaboration',
  modelControl:          'Per-provider default model control',
  digestExport:          'Session digest export (HTML file)',
  responseStylePresets:  'Response style presets per provider',
  projectHistory:        'Per-project response history',
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
   *   { plan: 'free'|'starter'|'pro'|'pro_plus'|'team', flags: {...}, flagLabels: {...}, hasKey: boolean, checkedAt: number }
   */
  getLicense() {
    if (this._cache) return this._cache;

    const key      = this._store.get('licenseKey', null);
    const planType = this._store.get('licensePlan', null);  // 'starter' | 'pro' | 'pro_plus' | 'team' | null

    // stub: any stored key → use stored plan type, or default to 'pro' if plan not stored
    const plan = key ? (planType || 'pro') : 'free';

    const flagsByPlan = { free: FREE_FLAGS, starter: STARTER_FLAGS, pro: PRO_FLAGS, pro_plus: PRO_PLUS_FLAGS, team: TEAM_FLAGS };

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
   * @param {string} [planType] - 'starter' | 'pro' | 'team' (default 'pro' for backward compat)
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

    if (!['starter', 'pro', 'pro_plus', 'team'].includes(planType)) {
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

module.exports = { LicenseChecker, FREE_FLAGS, STARTER_FLAGS, PRO_FLAGS, PRO_PLUS_FLAGS, TEAM_FLAGS, FLAG_LABELS };
