const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { UsageTracker } = require('./usageTracker');
const { QueueManager } = require('./queueManager');
const { AnthropicClient } = require('./anthropicClient');

let mainWindow;
let usageTracker;
let queueManager;
let anthropicClient;

// ─── Window Setup ────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../public/icon.png'),
  });

  // In dev, load Vite dev server; in prod, load built files
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  usageTracker = new UsageTracker();
  anthropicClient = new AnthropicClient(usageTracker);
  queueManager = new QueueManager(anthropicClient, usageTracker, (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, data);
    }
  });

  createWindow();
  setupIPC();

  // Start the queue processor loop
  queueManager.startProcessing();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  queueManager.stopProcessing();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function setupIPC() {

  // ── API Key ──
  ipcMain.handle('set-api-key', async (_, key) => {
    return anthropicClient.setApiKey(key);
  });

  ipcMain.handle('get-api-key-set', async () => {
    return anthropicClient.isApiKeySet();
  });

  // ── Usage Tracker ──
  ipcMain.handle('get-usage-status', async () => {
    return usageTracker.getStatus();
  });

  ipcMain.handle('get-usage-history', async () => {
    return usageTracker.getHistory(50);
  });

  ipcMain.handle('reset-usage', async () => {
    return usageTracker.reset();
  });

  // ── Queue ──
  ipcMain.handle('add-to-queue', async (_, item) => {
    return queueManager.addItem(item);
  });

  ipcMain.handle('get-queue', async () => {
    return queueManager.getQueue();
  });

  ipcMain.handle('remove-from-queue', async (_, id) => {
    return queueManager.removeItem(id);
  });

  ipcMain.handle('reorder-queue', async (_, { id, direction }) => {
    return queueManager.reorderItem(id, direction);
  });

  ipcMain.handle('clear-completed', async () => {
    return queueManager.clearCompleted();
  });

  ipcMain.handle('retry-item', async (_, id) => {
    return queueManager.retryItem(id);
  });

  ipcMain.handle('pause-queue', async () => {
    return queueManager.pause();
  });

  ipcMain.handle('resume-queue', async () => {
    return queueManager.resume();
  });

  ipcMain.handle('get-queue-state', async () => {
    return queueManager.getState();
  });

  // ── Projects ──
  ipcMain.handle('get-projects', async () => {
    return queueManager.getProjects();
  });

  ipcMain.handle('add-project', async (_, project) => {
    return queueManager.addProject(project);
  });

  ipcMain.handle('delete-project', async (_, id) => {
    return queueManager.deleteProject(id);
  });

  // ── Misc ──
  ipcMain.handle('open-external', async (_, url) => {
    shell.openExternal(url);
  });
}
