"use strict";

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
  maxProviders: 12, // TODO → 5  (local only)
  maxQueueDepth: Infinity, // TODO → 10
  maxProjects: Infinity, // TODO → 1
  routingModes: [
    "manual",
    "freeTier",
    "auto",
    "balance",
    "cheapest",
    "fastest",
  ], // TODO → ['manual', 'freeTier']
  costTracking: true, // TODO → false  (detailed cost per provider/model; Starter+)
  budgetView: true, // view estimated spend — available on ALL tiers
  budgetCaps: true, // TODO → false  (set monthly caps; Starter+ = false, Pro = true)
  tagSmartPriority: true, // TODO → false  (free: only ⚡ Urgent tag boosts)
  compareMode: true, // TODO → false
  batchImport: true, // TODO → false
  promptTemplates: true, // TODO → false  (Roadmap)
  usageExport: "csv+json", // TODO → false
  imageGeneration: true, // TODO → false  (Roadmap)
  videoGeneration: true, // TODO → false  (Roadmap)
  webhookDelivery: true, // TODO → false  (Roadmap)
  customRoutingRules: true, // TODO → false
  costForecasting: true, // TODO → false  (Roadmap)
  mobileApp: true, // TODO → false  (Roadmap)
  // AIQ-side monthly cloud caps (not provider API rate limits)
  monthlyCloudPrompts: Infinity, // TODO → 50
  monthlyCloudTokens: Infinity, // TODO → 100_000
  // New feature flags
  modelControl: true, // TODO → false  (per-provider default model; Pro+)
  digestExport: true, // TODO → false  (session digest export; Starter+)
  responseStylePresets: true, // available on all tiers
  projectHistory: true, // available on all tiers
  // Team-only flags
  sharedSettings: false,
  adminControls: false,
  teamCollaboration: false,
};

const STARTER_FLAGS = {
  // 8 providers: 5 local (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp)
  //            + 3 free cloud (Gemini, Groq, Mistral)
  maxProviders: 8,
  maxQueueDepth: 100,
  maxProjects: 5,
  routingModes: ["manual", "freeTier", "auto", "balance"],
  costTracking: true,
  budgetView: true,
  budgetCaps: false, // Starter can view spend but not set caps
  tagSmartPriority: false, // only ⚡ Urgent tag boosts queue position
  compareMode: false,
  batchImport: true,
  promptTemplates: true, // Roadmap
  usageExport: "csv",
  imageGeneration: true, // Roadmap
  videoGeneration: false,
  webhookDelivery: false,
  customRoutingRules: false,
  costForecasting: false,
  mobileApp: true, // Roadmap — included at no extra charge
  monthlyCloudPrompts: 500,
  monthlyCloudTokens: 1_000_000,
  // New feature flags
  modelControl: false, // per-provider default model (Pro+)
  digestExport: true, // session digest export — Starter+
  responseStylePresets: true, // all tiers
  projectHistory: true, // all tiers
  sharedSettings: false,
  adminControls: false,
  teamCollaboration: false,
};

const PRO_FLAGS = {
  // All 12 providers: 5 local + 7 cloud (Gemini, Groq, Mistral, Claude, OpenAI, DeepSeek, xAI Grok)
  maxProviders: 12,
  maxQueueDepth: 500, // soft cap — higher limits on the roadmap (Pro+)
  maxProjects: Infinity,
  routingModes: [
    "manual",
    "freeTier",
    "auto",
    "balance",
    "cheapest",
    "fastest",
  ],
  costTracking: true,
  budgetView: true,
  budgetCaps: true, // full budget caps + overage alerts
  tagSmartPriority: true, // all 9 tag types boost queue position
  compareMode: true,
  batchImport: true,
  promptTemplates: true, // Roadmap
  usageExport: "csv+json",
  imageGeneration: true, // Roadmap
  videoGeneration: true, // Roadmap
  webhookDelivery: true, // Roadmap
  customRoutingRules: true,
  costForecasting: true, // Roadmap
  mobileApp: true, // Roadmap — included at no extra charge
  monthlyCloudPrompts: 2_500,
  monthlyCloudTokens: 5_000_000,
  // New feature flags
  modelControl: true, // per-provider default model — Pro+
  digestExport: true, // session digest export — Pro+
  responseStylePresets: true, // all tiers
  projectHistory: true, // all tiers
  sharedSettings: false,
  adminControls: false,
  teamCollaboration: false,
};

// COMING SOON — Pro+ tier flags (not yet enforced; defined for forward-compatibility)
const PRO_PLUS_FLAGS = {
  maxProviders: 12,
  maxQueueDepth: Infinity, // unlimited — key Pro+ differentiator over Pro's 500 soft cap
  maxProjects: Infinity,
  routingModes: [
    "manual",
    "freeTier",
    "auto",
    "balance",
    "cheapest",
    "fastest",
  ],
  costTracking: true,
  budgetView: true,
  budgetCaps: true,
  tagSmartPriority: true,
  compareMode: true,
  consensusMode: true, // Roadmap — meta-model synthesis across Compare results
  batchImport: true,
  promptTemplates: true,
  usageExport: "csv+json",
  imageGeneration: true,
  videoGeneration: true,
  webhookDelivery: true, // Roadmap
  customRoutingRules: true,
  costForecasting: true, // Roadmap
  mobileApp: true,
  prioritySupport: true, // Priority email support
  monthlyCloudPrompts: 10_000,
  monthlyCloudTokens: 20_000_000, // 20M
  modelControl: true,
  digestExport: true,
  responseStylePresets: true,
  projectHistory: true,
  sharedSettings: false,
  adminControls: false,
  teamCollaboration: false,
};

// COMING SOON — Team tier flags (not yet enforced; defined for forward-compatibility)
const TEAM_FLAGS = {
  maxProviders: 12,
  maxQueueDepth: 500, // same soft cap as Pro; higher limits planned
  maxProjects: Infinity,
  routingModes: [
    "manual",
    "freeTier",
    "auto",
    "balance",
    "cheapest",
    "fastest",
  ],
  costTracking: true,
  budgetView: true,
  budgetCaps: true,
  tagSmartPriority: true,
  compareMode: true,
  batchImport: true,
  promptTemplates: true,
  usageExport: "csv+json",
  imageGeneration: true,
  videoGeneration: true,
  webhookDelivery: true,
  customRoutingRules: true,
  costForecasting: true,
  mobileApp: true,
  // Monthly caps are pooled across all seats
  monthlyCloudPrompts: 25_000, // pooled across team
  monthlyCloudTokens: 60_000_000, // 60M pooled across team
  // New feature flags
  modelControl: true,
  digestExport: true,
  responseStylePresets: true,
  projectHistory: true,
  // Team-only flags
  sharedSettings: true,
  adminControls: true,
  teamCollaboration: true,
};

// Human-readable descriptions shown in the UI
const FLAG_LABELS = {
  maxProviders: "AI providers",
  maxQueueDepth: "Queue depth",
  maxProjects: "Projects",
  routingModes: "Routing modes",
  costTracking: "Cost tracking per provider & model",
  budgetView: "Budget spend visibility (view-only)",
  budgetCaps: "Budget caps & overage alerts",
  tagSmartPriority: "Tag-based smart priority (all tag types)",
  compareMode: "Compare mode (A/B providers)",
  consensusMode: "Consensus mode (meta-model synthesis across Compare results)",
  prioritySupport: "Priority email support",
  batchImport: "Batch CSV import",
  promptTemplates: "Prompt template library",
  usageExport: "Usage history export",
  imageGeneration: "Image generation (DALL-E 3, Flux, Ideogram…)",
  videoGeneration: "Video generation (Runway, Pika, Kling)",
  webhookDelivery: "Webhook output delivery",
  customRoutingRules: "Custom routing rules & cost thresholds",
  costForecasting: "Cost forecasting & trend reports",
  mobileApp: "iOS & Android companion app",
  monthlyCloudPrompts: "Monthly cloud prompt runs",
  monthlyCloudTokens: "Monthly cloud tokens",
  sharedSettings: "Shared team settings",
  adminControls: "Admin controls",
  teamCollaboration: "Team collaboration",
  modelControl: "Per-provider default model control",
  digestExport: "Session digest export (HTML file)",
  responseStylePresets: "Response style presets per provider",
  projectHistory: "Per-project response history",
};

// ─── Lemon Squeezy configuration ─────────────────────────────────────────────
//
// SETUP REQUIRED before going live:
//   1. Create your products in Lemon Squeezy Dashboard → Store → Products
//   2. Enable "License Keys" on each product (1 key per order, activation limit 2)
//   3. Copy the Variant ID for each product (Dashboard → Product → Variants → copy ID)
//   4. Paste those IDs into LS_VARIANT_PLAN_MAP below — replace the 0 placeholders
//
// Finding your Variant ID:
//   Dashboard → Store → Products → click your product → Variants tab → the number
//   in the URL (e.g. /variants/123456) is the Variant ID.
//
// Variant IDs are numeric. Map each to the internal plan name used in this file.
// ─────────────────────────────────────────────────────────────────────────────

const LS_API_BASE = "https://api.lemonsqueezy.com/v1/licenses";

// Map Lemon Squeezy Variant IDs → internal plan names.
// Replace the 0 values with your real Variant IDs from the LS Dashboard.
const LS_VARIANT_PLAN_MAP = {
  1735713: "starter", // TODO: replace 0 with Starter ($9/mo) Variant ID
  1735683: "pro", // TODO: replace 0 with Pro ($19/mo) Variant ID
  0: "pro_plus", // TODO: replace 0 with Pro+ ($34/mo) Variant ID
  0: "team", // TODO: replace 0 with Team ($49/user/mo) Variant ID
};

// Fallback: parse the plan from the LS product name if variant ID is not in the map.
// Product names must contain one of these strings (case-insensitive).
const LS_PRODUCT_NAME_PLAN_MAP = [
  { match: "pro+", plan: "pro_plus" },
  { match: "pro plus", plan: "pro_plus" },
  { match: "team", plan: "team" },
  { match: "pro", plan: "pro" },
  { match: "starter", plan: "starter" },
];

/**
 * Maps a Lemon Squeezy API response to an internal plan name.
 *
 * @param {object} meta  - The `meta` field from a LS Licenses API response.
 * @returns {'starter'|'pro'|'pro_plus'|'team'|null}
 */
function _resolvePlan(meta) {
  if (!meta) return null;

  // 1. Try exact variant ID match first (most reliable)
  const variantId = meta.variant_id;
  if (variantId && LS_VARIANT_PLAN_MAP[variantId]) {
    return LS_VARIANT_PLAN_MAP[variantId];
  }

  // 2. Fallback: parse product name
  const productName = (meta.product_name || "").toLowerCase();
  for (const { match, plan } of LS_PRODUCT_NAME_PLAN_MAP) {
    if (productName.includes(match)) return plan;
  }

  return null;
}

// ─── LicenseChecker class ─────────────────────────────────────────────────────

class LicenseChecker {
  /**
   * @param {object} store  - electron-store instance (from store.js)
   */
  constructor(store) {
    this._store = store;
    this._cache = null; // { plan, flags, flagLabels, hasKey, checkedAt }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the current license state from the local store (synchronous).
   * Cached after first call; call clearCache() to force a re-read.
   *
   * Returns:
   *   { plan, flags, flagLabels, hasKey, instanceId, checkedAt }
   */
  getLicense() {
    if (this._cache) return this._cache;

    const key = this._store.get("licenseKey", null);
    const planType = this._store.get("licensePlan", null);
    const instanceId = this._store.get("licenseInstanceId", null);

    // Any stored key with a plan type is treated as valid until server re-validation
    const plan = key && planType ? planType : "free";

    const flagsByPlan = {
      free: FREE_FLAGS,
      starter: STARTER_FLAGS,
      pro: PRO_FLAGS,
      pro_plus: PRO_PLUS_FLAGS,
      team: TEAM_FLAGS,
    };

    this._cache = {
      plan,
      flags: { ...(flagsByPlan[plan] ?? FREE_FLAGS) },
      flagLabels: FLAG_LABELS,
      hasKey: !!key,
      instanceId: instanceId ?? null,
      checkedAt: Date.now(),
    };

    return this._cache;
  }

  /**
   * Activates a Lemon Squeezy license key against the LS API.
   * On success, stores the key, resolved plan, and LS instance ID locally.
   *
   * This is an async method — await it from index-v2.js IPC handler.
   *
   * @param {string} key - Lemon Squeezy license key (UUID format from receipt email)
   * @returns {Promise<{ success: boolean, license?: object, error?: string }>}
   */
  async setKey(key) {
    if (!key || typeof key !== "string") {
      return { success: false, error: "No key provided." };
    }

    const trimmed = key.trim();
    if (trimmed.length < 8) {
      return { success: false, error: "License key is too short." };
    }

    // Build a stable machine identifier for the activation instance name.
    // Using the stored machine ID if present, or generate and store one.
    let machineId = this._store.get("machineId", null);
    if (!machineId) {
      const { randomUUID } = require("crypto");
      machineId = randomUUID();
      this._store.set("machineId", machineId);
    }

    // ── Lemon Squeezy: Activate License ──────────────────────────────────────
    // Docs: https://docs.lemonsqueezy.com/api/license-keys#activate-a-license
    //
    // POST https://api.lemonsqueezy.com/v1/licenses/activate
    // Content-Type: application/x-www-form-urlencoded
    // Body: license_key=KEY&instance_name=MACHINE_ID
    //
    // Success response (HTTP 200):
    // {
    //   "activated": true,
    //   "error": null,
    //   "license_key": { "id", "status", "key", "activation_limit", "activation_usage", ... },
    //   "instance": { "id", "name", "created_at" },
    //   "meta": { "store_id", "product_id", "product_name", "variant_id", "variant_name",
    //             "order_id", "customer_id", "customer_name", "customer_email" }
    // }
    //
    // Already-activated response (HTTP 400):
    // { "activated": false, "error": "...", "license_key": { ... } }
    // ─────────────────────────────────────────────────────────────────────────

    let activationData;
    try {
      const body = new URLSearchParams({
        license_key: trimmed,
        instance_name: `AIQ-${machineId.slice(0, 8)}`,
      });

      const res = await fetch(`${LS_API_BASE}/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      activationData = await res.json();
    } catch (err) {
      return {
        success: false,
        error: `Network error — could not reach Lemon Squeezy. Check your internet connection. (${err.message})`,
      };
    }

    // Key is already activated on this or another machine — try validate instead
    if (!activationData.activated && activationData.error) {
      const errMsg = (activationData.error || "").toLowerCase();

      if (
        errMsg.includes("already activated") ||
        errMsg.includes("activation limit")
      ) {
        // Key exists but this instance is already registered — validate to get plan
        const validateResult = await this._validateKey(trimmed);
        if (validateResult.success) {
          this._cache = null;
          return { success: true, license: this.getLicense() };
        }
      }

      return {
        success: false,
        error: activationData.error || "License key is invalid or has expired.",
      };
    }

    if (!activationData.activated) {
      return {
        success: false,
        error: "License activation failed. Check your key and try again.",
      };
    }

    // Determine plan from the activation response
    const plan = _resolvePlan(activationData.meta);
    if (!plan) {
      return {
        success: false,
        error:
          "Could not determine plan from license key. Contact support at mike@conxion.biz.",
      };
    }

    // Persist key, plan, and instance ID (instance ID is needed for deactivation)
    this._store.set("licenseKey", trimmed);
    this._store.set("licensePlan", plan);
    this._store.set("licenseInstanceId", activationData.instance?.id ?? null);
    this._cache = null;

    return { success: true, license: this.getLicense() };
  }

  /**
   * Validates the stored license key against the LS API (for on-startup checks).
   * Falls back to the locally stored plan if the network call fails.
   * Call this once from index-v2.js after the window is ready.
   *
   * @returns {Promise<{ success: boolean, license: object, error?: string }>}
   */
  async validateStoredKey() {
    const key = this._store.get("licenseKey", null);
    if (!key) return { success: false, error: "No stored license key." };
    return this._validateKey(key);
  }

  /**
   * Deactivates the stored license key on the LS API and removes it locally.
   * Reverts to free plan.
   *
   * @returns {Promise<{ success: boolean, license: object, error?: string }>}
   */
  async removeKey() {
    const key = this._store.get("licenseKey", null);
    const instanceId = this._store.get("licenseInstanceId", null);

    if (key && instanceId) {
      // ── Lemon Squeezy: Deactivate License ──────────────────────────────────
      // POST https://api.lemonsqueezy.com/v1/licenses/deactivate
      // Body: license_key=KEY&instance_id=INSTANCE_ID
      // ───────────────────────────────────────────────────────────────────────
      try {
        const body = new URLSearchParams({
          license_key: key,
          instance_id: instanceId,
        });
        await fetch(`${LS_API_BASE}/deactivate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: body.toString(),
        });
      } catch (_) {
        // Non-fatal — remove locally even if network call fails
      }
    }

    this._store.delete("licenseKey");
    this._store.delete("licensePlan");
    this._store.delete("licenseInstanceId");
    this._cache = null;
    return { success: true, license: this.getLicense() };
  }

  /**
   * Force-clears the in-memory cache (call after store changes externally).
   */
  clearCache() {
    this._cache = null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /**
   * Validates a key against the LS API without consuming an activation slot.
   * Updates the locally stored plan if it has changed.
   *
   * @param {string} key
   * @returns {Promise<{ success: boolean, license?: object, error?: string }>}
   */
  async _validateKey(key) {
    // ── Lemon Squeezy: Validate License ──────────────────────────────────────
    // POST https://api.lemonsqueezy.com/v1/licenses/validate
    // Body: license_key=KEY
    //
    // Response:
    // { "valid": true|false, "error": null|string,
    //   "license_key": { "status": "active"|"inactive"|"expired"|"disabled", ... },
    //   "meta": { "product_id", "product_name", "variant_id", ... } }
    // ─────────────────────────────────────────────────────────────────────────
    let data;
    try {
      const body = new URLSearchParams({ license_key: key });
      const res = await fetch(`${LS_API_BASE}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });
      data = await res.json();
    } catch (err) {
      // Network failure — don't revoke the local license, just return current state
      return { success: true, license: this.getLicense() };
    }

    if (!data.valid || data.license_key?.status !== "active") {
      // Key is no longer valid — revert to free
      this._store.delete("licenseKey");
      this._store.delete("licensePlan");
      this._store.delete("licenseInstanceId");
      this._cache = null;
      return {
        success: false,
        error: data.error || "License key is no longer active.",
        license: this.getLicense(),
      };
    }

    // Update locally stored plan in case the subscription tier changed
    const plan = _resolvePlan(data.meta);
    if (plan && plan !== this._store.get("licensePlan")) {
      this._store.set("licensePlan", plan);
      this._cache = null;
    }

    return { success: true, license: this.getLicense() };
  }
}

module.exports = {
  LicenseChecker,
  FREE_FLAGS,
  STARTER_FLAGS,
  PRO_FLAGS,
  PRO_PLUS_FLAGS,
  TEAM_FLAGS,
  FLAG_LABELS,
};
