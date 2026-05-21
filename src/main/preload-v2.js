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
  getConversations:   (provider)              => ipcRenderer.invoke('get-conversations', provider),
  clearConversation:  (provider, convId)      => ipcRenderer.invoke('clear-conversation', { provider, convId }),

  // Routing preview
  previewRoute:       (item)          => ipcRenderer.invoke('preview-route', item),

  // Misc
  openExternal:       (url)           => ipcRenderer.invoke('open-external', url),

  // Push events (main → renderer)
  onQueueUpdate:  (cb) => { ipcRenderer.on('queue-update',  (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('queue-update');  },
  onUsageUpdate:  (cb) => { ipcRenderer.on('usage-update',  (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('usage-update');  },
  onItemComplete: (cb) => { ipcRenderer.on('item-complete', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('item-complete'); },
  onItemError:    (cb) => { ipcRenderer.on('item-error',    (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('item-error');    },
});
