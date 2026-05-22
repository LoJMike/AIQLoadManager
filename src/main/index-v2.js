'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const { createStore }        = require('./store');
const { MultiUsageTracker }  = require('./multiUsageTracker');
const { ConversationStore }  = require('./conversationStore');
const { ProviderRegistry }   = require('./providers/providerRegistry');
const { QueueRouter }        = require('./queueRouter');
const { MultiQueueManager, tagsToTaskType, computePriority } = require('./multiQueueManager');
const { LicenseChecker }     = require('./licenseChecker');

let mainWindow;
let tracker, convStore, registry, router, queue, license;

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1000, minHeight: 640,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 11 } }
      : { frame: false }),
    backgroundColor: '#08080f',
    webPreferences: {
      preload: path.join(__dirname, 'preload-v2.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // All synchronous — no awaits needed
  const store = createStore();

  license  = new LicenseChecker(store);   // reads from electron-store

  tracker   = new MultiUsageTracker();
  tracker.open();                           // sync

  convStore = new ConversationStore();
  convStore.open();                         // sync — same ai-queue.db, WAL mode handles concurrency

  registry = new ProviderRegistry(tracker, store, convStore);
  router   = new QueueRouter(registry, tracker);

  queue = new MultiQueueManager(registry, tracker, router, (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, data);
    }
  });
  queue.open();                            // sync

  createWindow();
  setupIPC();
  queue.startProcessing();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => queue?.stopProcessing());

function setupIPC() {
  ipcMain.handle('get-providers',      ()                       => registry.getProviderSummaries());
  ipcMain.handle('get-provider',       (_, name)                => registry.getProviderSummary(name));
  ipcMain.handle('set-api-key',        (_, { provider, key })   => registry.get(provider).setApiKey(key));
  ipcMain.handle('remove-api-key',     (_, provider)            => { registry.get(provider).removeApiKey(); return { success: true }; });

  ipcMain.handle('get-usage-all',      ()                       => tracker.getStatusAll());
  ipcMain.handle('get-usage',          (_, name)                => tracker.getStatus(name));
  ipcMain.handle('get-history',        (_, { provider, limit }) => tracker.getHistory(provider, limit));
  ipcMain.handle('set-budget',         (_, { provider, usd })   => { tracker.setBudget(provider, usd); return tracker.getStatus(provider); });
  ipcMain.handle('get-budgets',        ()                       => tracker.getBudgets());

  ipcMain.handle('add-to-queue', (_, item) => {
    const tags     = Array.isArray(item.tags) ? item.tags : [];
    const isPaid   = license.getLicense().plan === 'pro';
    const taskType = tagsToTaskType(tags) || item.taskType || 'general';
    const priority = computePriority(tags, isPaid);

    // Compare mode requires a Pro license
    const compareProviders = Array.isArray(item.compareProviders) ? item.compareProviders : null;
    if (compareProviders && compareProviders.length >= 2 && !isPaid) {
      throw new Error('Compare mode requires a Pro license. Upgrade in the License tab.');
    }

    return queue.addItem({ ...item, tags, taskType, priority, compareProviders });
  });

  // Expose tag metadata to the renderer so it can render chips without
  // needing to duplicate the tag list on the frontend.
  ipcMain.handle('get-prompt-tags', () => {
    // Visual/display config for each tag — the priority weights are intentionally
    // kept server-side only so the renderer cannot inflate priority values.
    return [
      { id: 'chat',       label: 'Chat',       emoji: '💬', taskType: 'general',  color: '#6366f1' },
      { id: 'research',   label: 'Research',   emoji: '🔬', taskType: 'research', color: '#3b82f6' },
      { id: 'code',       label: 'Code',       emoji: '💻', taskType: 'coding',   color: '#10b981' },
      { id: 'web_search', label: 'Web Search', emoji: '🌐', taskType: 'research', color: '#0ea5e9' },
      { id: 'writing',    label: 'Writing',    emoji: '✍️',  taskType: 'general',  color: '#8b5cf6' },
      { id: 'analysis',   label: 'Analysis',   emoji: '📊', taskType: 'research', color: '#f59e0b' },
      { id: 'image',      label: 'Image',      emoji: '🖼️',  taskType: 'graphics', color: '#ec4899' },
      { id: 'translate',  label: 'Translate',  emoji: '🌍', taskType: 'general',  color: '#14b8a6' },
      { id: 'urgent',     label: 'Urgent',     emoji: '⚡', taskType: null,       color: '#f97316' },
    ];
  });
  ipcMain.handle('get-queue',          ()                       => queue.getQueue());
  ipcMain.handle('remove-from-queue',  (_, id)                  => queue.removeItem(id));
  ipcMain.handle('reorder-queue',      (_, { id, direction })   => queue.reorderItem(id, direction));
  ipcMain.handle('clear-completed',    ()                       => queue.clearCompleted());
  ipcMain.handle('retry-item',         (_, id)                  => queue.retryItem(id));
  ipcMain.handle('pause-queue',        ()                       => queue.pause());
  ipcMain.handle('resume-queue',       ()                       => queue.resume());
  ipcMain.handle('get-queue-state',    ()                       => queue.getState());

  ipcMain.handle('get-projects',       ()                       => queue.getProjects());
  ipcMain.handle('add-project',        (_, p)                   => queue.addProject(p));
  ipcMain.handle('delete-project',     (_, id)                  => queue.deleteProject(id));

  ipcMain.handle('get-conversations',       (_, provider)              => registry.get(provider).listConversations());
  ipcMain.handle('get-conversation-history', (_, { provider, convId }) => registry.get(provider).getHistory(convId));
  ipcMain.handle('clear-conversation',       (_, { provider, convId }) => { registry.get(provider).clearConversation(convId); return { success: true }; });

  ipcMain.handle('preview-route',      (_, item)                => {
    try {
      const winner = router.route(item);

      // Estimate tokens from prompt character count (~4 chars per token)
      const inputTokens  = Math.ceil((item.prompt?.length || 0) / 4);
      const outputTokens = item.maxTokens || 1024;

      // Full ranked candidate list with per-provider cost estimates
      const candidates = router.previewCandidates(item).map(c => ({
        ...c,
        estimatedCost: tracker.estimateCost(c.name, c.bestModel, inputTokens, outputTokens),
      }));

      return { ...winner, candidates, inputTokens, outputTokens, error: null };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('open-external',      (_, url)                 => shell.openExternal(url));

  // License
  ipcMain.handle('get-license',        ()        => license.getLicense());
  ipcMain.handle('set-license-key',    (_, key)  => license.setKey(key));
  ipcMain.handle('remove-license-key', ()        => license.removeKey());

  // Window controls (used by custom title bar)
  ipcMain.handle('window-minimize',    ()  => mainWindow?.minimize());
  ipcMain.handle('window-maximize',    ()  => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
    return mainWindow?.isMaximized() ?? false;
  });
  ipcMain.handle('window-close',       ()  => mainWindow?.close());
}
