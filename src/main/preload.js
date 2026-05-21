const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, typed API to the renderer
contextBridge.exposeInMainWorld('claudeQueue', {

  // API Key
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  getApiKeySet: () => ipcRenderer.invoke('get-api-key-set'),

  // Usage Tracker
  getUsageStatus: () => ipcRenderer.invoke('get-usage-status'),
  getUsageHistory: () => ipcRenderer.invoke('get-usage-history'),
  resetUsage: () => ipcRenderer.invoke('reset-usage'),

  // Queue
  addToQueue: (item) => ipcRenderer.invoke('add-to-queue', item),
  getQueue: () => ipcRenderer.invoke('get-queue'),
  removeFromQueue: (id) => ipcRenderer.invoke('remove-from-queue', id),
  reorderQueue: (id, direction) => ipcRenderer.invoke('reorder-queue', { id, direction }),
  clearCompleted: () => ipcRenderer.invoke('clear-completed'),
  retryItem: (id) => ipcRenderer.invoke('retry-item', id),
  pauseQueue: () => ipcRenderer.invoke('pause-queue'),
  resumeQueue: () => ipcRenderer.invoke('resume-queue'),
  getQueueState: () => ipcRenderer.invoke('get-queue-state'),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  addProject: (project) => ipcRenderer.invoke('add-project', project),
  deleteProject: (id) => ipcRenderer.invoke('delete-project', id),

  // Misc
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Push events FROM main process TO renderer
  onQueueUpdate: (cb) => {
    ipcRenderer.on('queue-update', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('queue-update');
  },
  onUsageUpdate: (cb) => {
    ipcRenderer.on('usage-update', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('usage-update');
  },
  onItemComplete: (cb) => {
    ipcRenderer.on('item-complete', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('item-complete');
  },
  onItemError: (cb) => {
    ipcRenderer.on('item-error', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('item-error');
  },
});
