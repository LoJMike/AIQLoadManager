'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const { createStore }       = require('./store');
const { MultiUsageTracker } = require('./multiUsageTracker');
const { ProviderRegistry }  = require('./providers/providerRegistry');
const { QueueRouter }       = require('./queueRouter');
const { MultiQueueManager } = require('./multiQueueManager');

let mainWindow;
let tracker, registry, router, queue;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1000, minHeight: 640,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d0d0f',
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

  tracker  = new MultiUsageTracker();
  tracker.open();                          // sync

  registry = new ProviderRegistry(tracker, store);
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

  ipcMain.handle('add-to-queue',       (_, item)                => queue.addItem(item));
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

  ipcMain.handle('get-conversations',  (_, provider)            => registry.get(provider).listConversations());
  ipcMain.handle('clear-conversation', (_, { provider, convId }) => { registry.get(provider).clearConversation(convId); return { success: true }; });

  ipcMain.handle('preview-route',      (_, item)                => {
    try { return { ...router.route(item), error: null }; }
    catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('open-external',      (_, url)                 => shell.openExternal(url));
}
