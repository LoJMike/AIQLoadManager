'use strict';

// ─── licenseChecker.js ────────────────────────────────────────────────────────
//
// Manages license state for AIQ Load Manager.
//
// CURRENT STATE (skeleton / preview mode):
//   - Everyone is effectively on "free" plan
//   - All feature flags are TRUE — nothing is gated yet
//   - Key entry is wired but no real API validation happens
//
// WHEN YOU'RE READY TO LAUNCH PAID TIERS:
//   1. Tighten FREE_FLAGS below (set the limits you want)
//   2. Replace the stub in setKey() with a real LemonSqueezy API call
//   3. Add periodic re-validation (call _validateWithServer on app start)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Feature flag definitions ─────────────────────────────────────────────────

const FREE_FLAGS = {
  // TODO: when launching paid tier, tighten these:
  allProviders:       true,   // TODO → false  (free: 2 providers max)
  unlimitedQueue:     true,   // TODO → false  (free: 10 items max)
  advancedRouting:    true,   // TODO → false  (free: manual routing only)
  fullUsageDashboard: true,   // TODO → false  (free: hide cost history)
  multipleProjects:   true,   // TODO → false  (free: 1 project max)
};

const PRO_FLAGS = {
  allProviders:       true,
  unlimitedQueue:     true,
  advancedRouting:    true,
  fullUsageDashboard: true,
  multipleProjects:   true,
};

// Human-readable descriptions shown in the UI
const FLAG_LABELS = {
  allProviders:       'All 7 AI providers',
  unlimitedQueue:     'Unlimited queue items',
  advancedRouting:    'Advanced routing modes (auto, balance, cheapest…)',
  fullUsageDashboard: 'Full usage & cost history',
  multipleProjects:   'Multiple projects',
};

// ─── LicenseChecker class ─────────────────────────────────────────────────────

class LicenseChecker {
  /**
   * @param {object} store  - electron-store instance (from store.js)
   */
  constructor(store) {
    this._store = store;
    this._cache = null;   // { plan, flags, hasKey, checkedAt }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the current license state.
   * Cached after first call; call clearCache() to force a re-read.
   *
   * Returns:
   *   { plan: 'free'|'pro', flags: {...}, hasKey: boolean, checkedAt: number }
   */
  getLicense() {
    if (this._cache) return this._cache;

    const key  = this._store.get('licenseKey', null);
    const plan = key ? 'pro' : 'free';   // stub: stored key → pro

    this._cache = {
      plan,
      flags:      plan === 'pro' ? { ...PRO_FLAGS } : { ...FREE_FLAGS },
      flagLabels: FLAG_LABELS,
      hasKey:     !!key,
      checkedAt:  Date.now(),
    };

    return this._cache;
  }

  /**
   * Saves a license key and refreshes the license state.
   * TODO: validate against LemonSqueezy API before saving.
   *
   * Returns: { success: boolean, license?: object, error?: string }
   */
  setKey(key) {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'No key provided.' };
    }

    const trimmed = key.trim();
    if (trimmed.length < 8) {
      return { success: false, error: 'Key is too short.' };
    }

    // ── TODO: replace this stub with a real LemonSqueezy validate call ──────
    // const result = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ license_key: trimmed }),
    // });
    // if (!result.ok) return { success: false, error: 'Invalid license key.' };
    // ────────────────────────────────────────────────────────────────────────

    this._store.set('licenseKey', trimmed);
    this._cache = null;   // bust cache
    return { success: true, license: this.getLicense() };
  }

  /**
   * Removes the stored license key and reverts to free plan.
   */
  removeKey() {
    this._store.delete('licenseKey');
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

module.exports = { LicenseChecker, FREE_FLAGS, PRO_FLAGS, FLAG_LABELS };
