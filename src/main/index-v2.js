"use strict";

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const { createStore } = require("./store");
const { MultiUsageTracker } = require("./multiUsageTracker");
const { ConversationStore } = require("./conversationStore");
const { ProviderRegistry } = require("./providers/providerRegistry");
const { QueueRouter } = require("./queueRouter");
const {
  MultiQueueManager,
  tagsToTaskType,
  computePriority,
} = require("./multiQueueManager");
const { LicenseChecker } = require("./licenseChecker");
const { WebSearchService } = require("./webSearch");
const { PostHog } = require("posthog-node");

// ─── PostHog anonymous analytics ─────────────────────────────────────────────
// Tracks anonymous feature usage only. No prompt content, no API keys,
// no personal data. Users can opt out in Settings → Analytics.
const POSTHOG_KEY = "phc_yeEQLSv5BFKx64KbZuhRBXiR9gHp6TBLWWnNwFUVLuJ5";
const POSTHOG_HOST = "https://us.i.posthog.com";

let posthog;
let _deviceId;
let _store; // set in whenReady so track() can check opt-out at call time

function track(event, props = {}) {
  try {
    if (!posthog || !_store || _store.get("analytics.enabled") === false)
      return;
    posthog.capture({
      distinctId: _deviceId,
      event,
      properties: {
        app_version: app.getVersion(),
        platform: process.platform,
        ...props,
      },
    });
  } catch (_) {} // never crash the app over analytics
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Response style preset helpers ───────────────────────────────────────────

const PRESET_TEXTS = {
  concise:
    "Respond as concisely as possible. No preamble, no padding, no filler. Get straight to the point.",
  caveman:
    "CAVEMAN MODE: Only use short simple words. Short sentences. No big words. No long explanations. Direct answer only.",
  bullet:
    "Respond using bullet points only. Never write prose paragraphs. Each bullet must be one idea, one line.",
  eli5: "Explain like I am 5 years old. Use the simplest words possible. Very short sentences. No jargon or technical terms.",
};

/**
 * Compute the style instruction text for a given preset + optional custom text.
 * Returns null if preset is 'normal' or nothing is set.
 *
 * @param {{ preset: string, customText?: string }} opts
 * @returns {string|null}
 */
function computeStyleText({ preset, customText } = {}) {
  if (!preset || preset === "normal") return null;
  if (preset === "custom") return (customText || "").trim() || null;
  return PRESET_TEXTS[preset] || null;
}

// ─── Digest export helper ─────────────────────────────────────────────────────

/**
 * Generate an HTML digest report from an array of completed queue items.
 *
 * @param {object[]} items    - rows from getQueueForExport()
 * @param {object}   opts
 * @param {string}   [opts.title]   - report title
 * @returns {string}  - full HTML string
 */
function generateDigestHtml(
  items,
  { title = "AIQ Load Manager — Session Digest" } = {},
) {
  const now = new Date().toLocaleString();
  const count = items.length;
  const totalIn = items.reduce((s, i) => s + (i.input_tokens || 0), 0);
  const totalOut = items.reduce((s, i) => s + (i.output_tokens || 0), 0);
  const totalCost = items.reduce((s, i) => s + (i.cost_usd || 0), 0);

  const rows = items
    .map((item) => {
      const ts = item.completed_at
        ? new Date(item.completed_at).toLocaleString()
        : "—";
      const label = item.label || item.prompt.slice(0, 80);
      const provider = item.used_provider || item.provider || "—";
      const model = item.used_model || item.model || "—";
      const prompt = escHtml(item.prompt);
      let response = item.response || "";
      // Compare mode stores a JSON array
      try {
        const arr = JSON.parse(response);
        if (Array.isArray(arr)) {
          response = arr
            .map(
              (r) =>
                `<strong>${escHtml(r.provider)}/${escHtml(r.model || "")}:</strong><br>${escHtml(r.response || r.error || "")}`,
            )
            .join('<hr style="border-color:#2a2a3a;margin:8px 0">');
        } else {
          response = escHtml(response);
        }
      } catch (_) {
        response = escHtml(response);
      }

      return `
    <div class="item">
      <div class="item-meta">
        <span class="ts">${escHtml(ts)}</span>
        <span class="badge">${escHtml(provider)}</span>
        <span class="badge model">${escHtml(model)}</span>
        ${item.project_name ? `<span class="badge project">${escHtml(item.project_name)}</span>` : ""}
      </div>
      <div class="item-label">${escHtml(label)}</div>
      <details>
        <summary>Prompt</summary>
        <pre class="pre">${prompt}</pre>
      </details>
      <details open>
        <summary>Response</summary>
        <div class="response">${response}</div>
      </details>
      <div class="item-tokens">
        Tokens: ${item.input_tokens || 0} in / ${item.output_tokens || 0} out
        ${item.cost_usd ? ` · $${item.cost_usd.toFixed(6)}` : ""}
      </div>
    </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #08080f; color: #e0e0f0; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; padding: 24px; }
  h1 { color: #a78bfa; font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .summary { background: #111128; border: 1px solid #2a2a4a; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; gap: 32px; flex-wrap: wrap; }
  .summary-stat { display: flex; flex-direction: column; }
  .summary-stat .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .summary-stat .value { color: #a78bfa; font-size: 22px; font-weight: bold; }
  .item { background: #0d0d1f; border: 1px solid #1e1e3a; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .item-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .ts { color: #555; font-size: 12px; }
  .badge { background: #1e1e3a; color: #a78bfa; border-radius: 4px; padding: 2px 8px; font-size: 11px; }
  .badge.model { color: #67e8f9; }
  .badge.project { color: #86efac; }
  .item-label { font-weight: bold; color: #e0e0f0; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  details { margin: 8px 0; }
  summary { cursor: pointer; color: #6366f1; font-size: 12px; user-select: none; }
  .pre { background: #080818; border: 1px solid #1e1e3a; border-radius: 4px; padding: 12px; white-space: pre-wrap; word-break: break-word; color: #c0c0d0; margin: 6px 0 0; font-size: 13px; }
  .response { background: #080818; border: 1px solid #1e1e3a; border-radius: 4px; padding: 12px; white-space: pre-wrap; word-break: break-word; color: #d0d0e8; margin: 6px 0 0; font-size: 13px; }
  .item-tokens { color: #555; font-size: 11px; margin-top: 8px; }
  hr { border: none; border-top: 1px solid #1e1e3a; margin: 16px 0; }
</style>
</head>
<body>
<h1>${escHtml(title)}</h1>
<div class="meta">Generated: ${escHtml(now)} · ${count} item${count === 1 ? "" : "s"}</div>
<div class="summary">
  <div class="summary-stat"><span class="label">Completed Items</span><span class="value">${count}</span></div>
  <div class="summary-stat"><span class="label">Input Tokens</span><span class="value">${totalIn.toLocaleString()}</span></div>
  <div class="summary-stat"><span class="label">Output Tokens</span><span class="value">${totalOut.toLocaleString()}</span></div>
  <div class="summary-stat"><span class="label">Est. Cost</span><span class="value">$${totalCost.toFixed(4)}</span></div>
</div>
${rows || '<p style="color:#555">No completed items found.</p>'}
</body>
</html>`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;"); // prevents attribute injection via single quotes
}

// ─────────────────────────────────────────────────────────────────────────────

let mainWindow;
let tracker, convStore, registry, router, queue, license, webSearch;

function createWindow() {
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1025,
    minWidth: 1440,
    minHeight: 900,
    icon: path.join(
      __dirname,
      "../renderer/assets/AIQLoadManager_logo_badge.png",
    ),
    ...(isMac
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 11 } }
      : { frame: false }),
    backgroundColor: "#08080f",
    webPreferences: {
      preload: path.join(__dirname, "preload-v2.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  // All synchronous — no awaits needed
  const store = createStore();
  _store = store;

  // ── PostHog setup ──────────────────────────────────────────────────────────
  // Generate or load a stable anonymous device ID — never tied to a real person.
  if (!store.get("analytics.deviceId")) {
    store.set("analytics.deviceId", require("crypto").randomUUID());
  }
  _deviceId = store.get("analytics.deviceId");

  posthog = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1, // send events immediately (no batching in desktop app)
    flushInterval: 0,
  });
  // ──────────────────────────────────────────────────────────────────────────

  license = new LicenseChecker(store);
  webSearch = new WebSearchService(store);

  tracker = new MultiUsageTracker();
  tracker.open(); // sync

  convStore = new ConversationStore();
  convStore.open(); // sync — same ai-queue.db, WAL mode handles concurrency

  registry = new ProviderRegistry(tracker, store, convStore);
  router = new QueueRouter(registry, tracker);

  queue = new MultiQueueManager(registry, tracker, router, (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, data);
    }
  });
  queue.open(); // sync
  queue.setWebSearch(webSearch); // attach search enrichment

  // Load persisted standing instructions so they survive app restarts
  const savedInstructions = store.get("standingInstructions") || null;
  if (savedInstructions) queue.setStandingInstructions(savedInstructions);

  // Load persisted response style presets (providerName → { preset, customText })
  const savedStyles = store.get("responseStyles") || {};
  const styleMap = {};
  for (const [provider, cfg] of Object.entries(savedStyles)) {
    const text = computeStyleText(cfg);
    if (text) styleMap[provider] = text;
  }
  queue.setProviderStyles(styleMap);

  // Load persisted per-provider default models
  const savedDefaultModels = store.get("defaultModels") || {};
  for (const [provider, model] of Object.entries(savedDefaultModels)) {
    try {
      registry.setDefaultModel(provider, model);
    } catch (_) {}
  }

  createWindow();
  setupIPC();
  queue.startProcessing();

  // Fire app_launched after everything is ready
  track("app_launched", { plan: license.getLicense().plan });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  queue?.stopProcessing();
  posthog?.shutdown().catch(() => {}); // flush any queued events before exit
});

function setupIPC() {
  ipcMain.handle("get-providers", () => registry.getProviderSummaries());
  ipcMain.handle("get-provider", (_, name) =>
    registry.getProviderSummary(name),
  );
  ipcMain.handle("set-api-key", (_, { provider, key }) => {
    const result = registry.get(provider).setApiKey(key);
    track("provider_configured", { provider });
    return result;
  });
  ipcMain.handle("remove-api-key", (_, provider) => {
    registry.get(provider).removeApiKey();
    return { success: true };
  });

  ipcMain.handle("get-usage-all", () => tracker.getStatusAll());
  ipcMain.handle("get-usage", (_, name) => tracker.getStatus(name));
  ipcMain.handle("get-history", (_, { provider, limit }) =>
    tracker.getHistory(provider, limit),
  );
  ipcMain.handle("set-budget", (_, { provider, usd }) => {
    tracker.setBudget(provider, usd);
    return tracker.getStatus(provider);
  });
  ipcMain.handle("get-budgets", () => tracker.getBudgets());

  ipcMain.handle("add-to-queue", (_, raw) => {
    // Explicitly destructure only expected fields — prevents prototype pollution
    // and stops the renderer from injecting unexpected columns into the DB.
    const {
      prompt,
      label,
      systemPrompt,
      provider,
      routingMode,
      model,
      maxTokens,
      projectId,
      projectName,
      conversationId,
      scheduledFor,
    } = raw || {};

    const tags = Array.isArray(raw?.tags)
      ? raw.tags.filter((t) => typeof t === "string")
      : [];
    const lic = license.getLicense();
    const isPaid = lic.plan === "starter" || lic.plan === "pro";
    const taskType = tagsToTaskType(tags) || "general";
    const priority = computePriority(tags, isPaid);

    // Enforce queue depth limit for the current plan
    const maxDepth = lic.flags.maxQueueDepth;
    if (Number.isFinite(maxDepth)) {
      const currentDepth = queue
        .getQueue()
        .filter(
          (i) => i.status === "pending" || i.status === "processing",
        ).length;
      if (currentDepth >= maxDepth) {
        throw new Error(
          `Queue limit reached (${maxDepth} items on your current plan). Clear some items or upgrade.`,
        );
      }
    }

    // Compare mode requires a Pro license (not available on Starter)
    const compareProviders = Array.isArray(raw?.compareProviders)
      ? raw.compareProviders
      : null;
    if (
      compareProviders &&
      compareProviders.length >= 2 &&
      !lic.flags.compareMode
    ) {
      throw new Error(
        "Compare mode requires a Pro license. Upgrade in the License tab.",
      );
    }

    const result = queue.addItem({
      prompt,
      label,
      systemPrompt,
      provider,
      routingMode,
      model,
      maxTokens,
      projectId,
      projectName,
      conversationId,
      scheduledFor,
      tags,
      taskType,
      priority,
      compareProviders,
    });
    track("prompt_queued", {
      routing_mode: routingMode || "auto",
      tag_count: tags.length,
      is_compare: !!compareProviders,
      is_urgent: tags.includes("urgent"),
    });
    return result;
  });

  // Expose tag metadata to the renderer so it can render chips without
  // needing to duplicate the tag list on the frontend.
  ipcMain.handle("get-prompt-tags", () => {
    // Visual/display config for each tag — the priority weights are intentionally
    // kept server-side only so the renderer cannot inflate priority values.
    return [
      {
        id: "chat",
        label: "Chat",
        emoji: "💬",
        taskType: "general",
        color: "#6366f1",
      },
      {
        id: "research",
        label: "Research",
        emoji: "🔬",
        taskType: "research",
        color: "#3b82f6",
      },
      {
        id: "code",
        label: "Code",
        emoji: "💻",
        taskType: "coding",
        color: "#10b981",
      },
      {
        id: "web_search",
        label: "Web Search",
        emoji: "🌐",
        taskType: "research",
        color: "#0ea5e9",
      },
      {
        id: "writing",
        label: "Writing",
        emoji: "✍️",
        taskType: "general",
        color: "#8b5cf6",
      },
      {
        id: "analysis",
        label: "Analysis",
        emoji: "📊",
        taskType: "research",
        color: "#f59e0b",
      },
      {
        id: "image",
        label: "Image",
        emoji: "🖼️",
        taskType: "graphics",
        color: "#ec4899",
      },
      {
        id: "translate",
        label: "Translate",
        emoji: "🌍",
        taskType: "general",
        color: "#14b8a6",
      },
      {
        id: "urgent",
        label: "Urgent",
        emoji: "⚡",
        taskType: null,
        color: "#f97316",
      },
    ];
  });
  ipcMain.handle("get-queue", () => queue.getQueue());
  ipcMain.handle("remove-from-queue", (_, id) => queue.removeItem(id));
  ipcMain.handle("reorder-queue", (_, { id, direction }) =>
    queue.reorderItem(id, direction),
  );
  ipcMain.handle("clear-completed", () => queue.clearCompleted());
  ipcMain.handle("retry-item", (_, id) => queue.retryItem(id));
  ipcMain.handle("pause-queue", () => queue.pause());
  ipcMain.handle("resume-queue", () => queue.resume());
  ipcMain.handle("get-queue-state", () => queue.getState());

  ipcMain.handle("get-projects", () => queue.getProjects());
  ipcMain.handle("add-project", (_, p) => queue.addProject(p));
  ipcMain.handle("delete-project", (_, id) => queue.deleteProject(id));

  ipcMain.handle("get-conversations", (_, provider) =>
    registry.get(provider).listConversations(),
  );
  ipcMain.handle("get-conversation-history", (_, { provider, convId }) =>
    registry.get(provider).getHistory(convId),
  );
  ipcMain.handle("clear-conversation", (_, { provider, convId }) => {
    registry.get(provider).clearConversation(convId);
    return { success: true };
  });

  ipcMain.handle("preview-route", (_, item) => {
    try {
      const winner = router.route(item);

      // Estimate tokens from prompt character count (~4 chars per token)
      const inputTokens = Math.ceil((item.prompt?.length || 0) / 4);
      const outputTokens = item.maxTokens || 1024;

      // Full ranked candidate list with per-provider cost estimates
      const candidates = router.previewCandidates(item).map((c) => ({
        ...c,
        estimatedCost: tracker.estimateCost(
          c.name,
          c.bestModel,
          inputTokens,
          outputTokens,
        ),
      }));

      return { ...winner, candidates, inputTokens, outputTokens, error: null };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle("open-external", (_, url) => {
    // Only allow safe web schemes — block file://, javascript:, app:// etc.
    // An XSS in the renderer (e.g. via a crafted AI response) could otherwise
    // open arbitrary local files or trigger shell-protocol handlers on Windows.
    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        console.warn(
          "[security] open-external blocked unsafe scheme:",
          parsed.protocol,
          url.slice(0, 80),
        );
        return;
      }
    } catch (_) {
      console.warn("[security] open-external blocked malformed URL");
      return;
    }
    shell.openExternal(url);
  });

  // Local provider port configuration
  ipcMain.handle("get-local-ports", () => registry.getLocalPorts());
  ipcMain.handle("set-local-port", (_, { provider, port }) =>
    registry.setLocalPort(provider, port),
  );

  // Web search configuration
  ipcMain.handle("get-search-config", () => webSearch.getConfig());
  ipcMain.handle("set-search-backend", (_, backend) =>
    webSearch.setBackend(backend),
  );
  ipcMain.handle("set-search-key", (_, key) => webSearch.setTavilyKey(key));
  ipcMain.handle("remove-search-key", () => webSearch.removeTavilyKey());
  ipcMain.handle("set-searxng-url", (_, url) => webSearch.setSearxngUrl(url));

  // License
  ipcMain.handle("get-license", () => license.getLicense());
  ipcMain.handle("set-license-key", (_, key) => license.setKey(key));
  ipcMain.handle("remove-license-key", () => license.removeKey());

  // Standing instructions — global system prompt prepended to every queued prompt
  ipcMain.handle(
    "get-standing-instructions",
    () => _store.get("standingInstructions") || "",
  );
  ipcMain.handle("set-standing-instructions", (_, text) => {
    const trimmed = (text || "").trim();
    if (trimmed) {
      _store.set("standingInstructions", trimmed);
    } else {
      _store.delete("standingInstructions");
    }
    queue.setStandingInstructions(trimmed || null);
    return { success: true };
  });

  // ── Response style presets ─────────────────────────────────────────────────
  ipcMain.handle(
    "get-provider-styles",
    () => _store.get("responseStyles") || {},
  );

  ipcMain.handle(
    "set-provider-style",
    (_, { provider, preset, customText }) => {
      const styles = _store.get("responseStyles") || {};
      if (!preset || preset === "normal") {
        delete styles[provider];
      } else {
        styles[provider] = { preset, customText: customText || "" };
      }
      _store.set("responseStyles", styles);

      // Recompute and push updated style map to queue manager
      const styleMap = {};
      for (const [p, cfg] of Object.entries(styles)) {
        const text = computeStyleText(cfg);
        if (text) styleMap[p] = text;
      }
      queue.setProviderStyles(styleMap);
      return { success: true };
    },
  );

  // ── Per-provider default model (Pro+) ──────────────────────────────────────
  ipcMain.handle("get-default-models", () => _store.get("defaultModels") || {});

  ipcMain.handle("set-default-model", (_, { provider, model }) => {
    const lic = license.getLicense();
    if (!lic.flags.modelControl) {
      throw new Error(
        "Default model control requires a Pro license or higher.",
      );
    }
    const defaults = _store.get("defaultModels") || {};
    if (model) {
      defaults[provider] = model;
    } else {
      delete defaults[provider];
    }
    _store.set("defaultModels", defaults);
    registry.setDefaultModel(provider, model || null);
    return { success: true };
  });

  // ── Project history ────────────────────────────────────────────────────────
  ipcMain.handle("get-project-history", (_, projectId) =>
    queue.getProjectHistory(projectId),
  );

  // ── Digest export (Starter+) ───────────────────────────────────────────────
  ipcMain.handle("export-digest", async (_, opts = {}) => {
    const lic = license.getLicense();
    if (!lic.flags.digestExport) {
      throw new Error("Digest export requires a Starter license or higher.");
    }

    const items = queue.getQueueForExport(opts);
    const html = generateDigestHtml(items, {
      title: opts.title || "AIQ Load Manager — Session Digest",
    });

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Save Session Digest",
      defaultPath: `aiq-digest-${new Date().toISOString().slice(0, 10)}.html`,
      filters: [{ name: "HTML Files", extensions: ["html"] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    fs.writeFileSync(filePath, html, "utf8");
    shell.openPath(filePath);
    return { success: true, filePath };
  });

  // Analytics opt-out
  ipcMain.handle(
    "get-analytics-enabled",
    () => _store.get("analytics.enabled") !== false,
  );
  ipcMain.handle("set-analytics-enabled", (_, enabled) => {
    _store.set("analytics.enabled", enabled);
    return { success: true };
  });

  // App version — read from package.json via Electron so the renderer never
  // needs a hardcoded string that can drift out of sync.
  ipcMain.handle("get-app-version", () => app.getVersion());

  // Window controls (used by custom title bar)
  ipcMain.handle("window-minimize", () => mainWindow?.minimize());
  ipcMain.handle("window-maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
    return mainWindow?.isMaximized() ?? false;
  });
  ipcMain.handle("window-close", () => mainWindow?.close());
}
