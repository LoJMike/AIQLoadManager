const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aiQueue', {

  // Providers
  getProviders:       ()              => ipcRenderer.invoke('get-providers'),
  getProvider:        (name)          => ipcRenderer.invoke('get-provider', name),
  setApiKey:          (provider, key) => ipcRenderer.invoke('set-api-key', { provider, key }),
  removeApiKey:       (provider)      => ipcRenderer.invoke('remove-api-key', provider),

  // Usage & tracking
  getUsageAll:        ()                        => ipcRenderer.invoke('get-usage-all'),
  getUsage:           (provider)                => ipcRenderer.invoke('get-usage', provider),
  getHistory:         (provider, limit = 50)    => ipcRenderer.invoke('get-history', { provider, limit }),
  setBudget:          (provider, usd)           => ipcRenderer.invoke('set-budget', { provider, usd }),
  getBudgets:         ()                        => ipcRenderer.invoke('get-budgets'),

  // Queue
  addToQueue:         (item)          => ipcRenderer.invoke('add-to-queue', item),
  getQueue:           ()              => ipcRenderer.invoke('get-queue'),
  removeFromQueue:    (id)            => ipcRenderer.invoke('remove-from-queue', id),
  reorderQueue:       (id, direction) => ipcRenderer.invoke('reorder-queue', { id, direction }),
  clearCompleted:     ()              => ipcRenderer.invoke('clear-completed'),
  retryItem:          (id)            => ipcRenderer.invoke('retry-item', id),
  pauseQueue:         ()              => ipcRenderer.invoke('pause-queue'),
  resumeQueue:        ()              => ipcRenderer.invoke('resume-queue'),
  getQueueState:      ()              => ipcRenderer.invoke('get-queue-state'),

  // Projects
  getProjects:        ()              => ipcRenderer.invoke('get-projects'),
  addProject:         (p)             => ipcRenderer.invoke('add-project', p),
  deleteProject:      (id)            => ipcRenderer.invoke('delete-project', id),

  // Conversations
  getConversations:        (provider)         => ipcRenderer.invoke('get-conversations', provider),
  getConversationHistory:  (provider, convId) => ipcRenderer.invoke('get-conversation-history', { provider, convId }),
  clearConversation:       (provider, convId) => ipcRenderer.invoke('clear-conversation', { provider, convId }),

  // Routing preview & tag metadata
  previewRoute:       (item)          => ipcRenderer.invoke('preview-route', item),
  getPromptTags:      ()              => ipcRenderer.invoke('get-prompt-tags'),

  // License
  getLicense:         ()              => ipcRenderer.invoke('get-license'),
  setLicenseKey:      (key)           => ipcRenderer.invoke('set-license-key', key),
  removeLicenseKey:   ()              => ipcRenderer.invoke('remove-license-key'),

  // Local provider port configuration
  getLocalPorts:      ()                    => ipcRenderer.invoke('get-local-ports'),
  setLocalPort:       (provider, port)      => ipcRenderer.invoke('set-local-port', { provider, port }),

  // Web search configuration
  getSearchConfig:    ()                    => ipcRenderer.invoke('get-search-config'),
  setSearchBackend:   (backend)             => ipcRenderer.invoke('set-search-backend', backend),
  setSearchKey:       (key)                 => ipcRenderer.invoke('set-search-key', key),
  removeSearchKey:    ()                    => ipcRenderer.invoke('remove-search-key'),
  setSearxngUrl:      (url)                 => ipcRenderer.invoke('set-searxng-url', url),

  // Standing instructions — global system prompt for all queued prompts
  getStandingInstructions: ()        => ipcRenderer.invoke('get-standing-instructions'),
  setStandingInstructions: (text)    => ipcRenderer.invoke('set-standing-instructions', text),

  // Response style presets (per-provider) — all tiers
  getProviderStyles:  ()                             => ipcRenderer.invoke('get-provider-styles'),
  setProviderStyle:   (provider, preset, customText) => ipcRenderer.invoke('set-provider-style', { provider, preset, customText }),

  // Per-provider default model (Pro+)
  getDefaultModels:   ()                => ipcRenderer.invoke('get-default-models'),
  setDefaultModel:    (provider, model) => ipcRenderer.invoke('set-default-model', { provider, model }),

  // Project history — all tiers
  getProjectHistory:  (projectId)       => ipcRenderer.invoke('get-project-history', projectId),

  // Digest export — Starter+
  exportDigest:       (opts)            => ipcRenderer.invoke('export-digest', opts),

  // Analytics opt-out
  getAnalyticsEnabled: ()             => ipcRenderer.invoke('get-analytics-enabled'),
  setAnalyticsEnabled: (enabled)      => ipcRenderer.invoke('set-analytics-enabled', enabled),

  // Misc
  openExternal:       (url)           => ipcRenderer.invoke('open-external', url),

  // Window controls (custom title bar)
  windowMinimize:     ()              => ipcRenderer.invoke('window-minimize'),
  windowMaximize:     ()              => ipcRenderer.invoke('window-maximize'),
  windowClose:        ()              => ipcRenderer.invoke('window-close'),

  // App version — live from package.json, never hardcoded
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Push events (main → renderer).
  // Each on*() returns a specific cleanup function that removes only the handler
  // it registered — NOT removeAllListeners(), which would also remove handlers
  // registered by other components and cause silent data-loss bugs.
  onQueueUpdate: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('queue-update', h);
    return () => ipcRenderer.removeListener('queue-update', h);
  },
  onUsageUpdate: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('usage-update', h);
    return () => ipcRenderer.removeListener('usage-update', h);
  },
  onItemComplete: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('item-complete', h);
    return () => ipcRenderer.removeListener('item-complete', h);
  },
  onItemError: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('item-error', h);
    return () => ipcRenderer.removeListener('item-error', h);
  },
  onCompareComplete: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('item-compare-complete', h);
    return () => ipcRenderer.removeListener('item-compare-complete', h);
  },
});
