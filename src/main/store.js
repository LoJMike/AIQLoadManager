/**
 * store.js — electron-store v8 wrapper (CommonJS)
 *
 * Returns a store instance, or a plain in-memory fallback if unavailable.
 */

function createStore() {
  try {
    const Store = require('electron-store');
    return new Store({ name: 'ai-queue-config' });
  } catch (e) {
    console.warn('[store] electron-store unavailable:', e.message);
    const mem = {};
    return {
      get:    (key)      => mem[key],
      set:    (key, val) => { mem[key] = val; },
      delete: (key)      => { delete mem[key]; },
    };
  }
}

module.exports = { createStore };
