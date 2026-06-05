import { useState, useEffect, useCallback } from 'react';
import UsageDashboard from './components/UsageDashboard';
import AddPromptPanel from './components/AddPromptPanel';
import { QueuePanel, SettingsPanel, ProjectsPanel, TitleBar, LicensePanel, SupportPanel, ResultsPanel } from './components/index.js';
import NavIcon from './components/NavIcons.jsx';
import AppHeader from './components/AppHeader.jsx';
import RightRail from './components/RightRail.jsx';
import './App.css';
import './teamify-shell.css';

const NAV = [
  { id: 'usage',    label: 'Usage'    },
  { id: 'queue',    label: 'Queue'    },
  { id: 'add',      label: 'Add'      },
  { id: 'results',  label: 'Results'  },
  { id: 'projects', label: 'Projects' },
  { id: 'settings', label: 'Settings' },
  { id: 'license',  label: 'License'  },
  { id: 'support',  label: 'Support'  },
];

const FONT_SCALES = [0.85, 0.92, 1.0, 1.08, 1.15];
const DEFAULT_FONT_IDX = 2;
const BASE_UI_SCALE = 1.5; // +50% baseline typography

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

export default function App() {
  const [tab,           setTab]           = useState('usage');
  const [providers,     setProviders]     = useState([]);
  const [usageAll,      setUsageAll]      = useState({});
  const [queue,         setQueue]         = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [queueState,    setQueueState]    = useState({ paused: false, processing: false });
  const [license,       setLicense]       = useState(null);
  const [reachability,  setReachability]  = useState({}); // local provider reachability cache
  // Timestamp of the last time the user opened the Results tab — used to calculate
  // how many results are "new" (completed after that moment) for the badge.
  const [lastResultsView, setLastResultsView] = useState(
    () => readPref('aiq-last-results-view', 0)
  );
  const [toast,         setToast]         = useState(null);
  const [appVersion,    setAppVersion]    = useState('');
  const [theme,         setTheme]         = useState(() => readPref('aiq-theme', 'dark'));
  const [fontScaleIdx,  setFontScaleIdx]  = useState(() => readPref('aiq-font-idx', DEFAULT_FONT_IDX));
  const [railOpen,      setRailOpen]      = useState(() => readPref('aiq-rail-open', true));
  const [highlightId,   setHighlightId]   = useState(null);

  const api = window.aiQueue;
  const fontScale = FONT_SCALES[fontScaleIdx] ?? FONT_SCALES[DEFAULT_FONT_IDX];
  const uiScale   = BASE_UI_SCALE * fontScale;

  useEffect(() => { writePref('aiq-theme', theme); }, [theme]);
  useEffect(() => { writePref('aiq-font-idx', fontScaleIdx); }, [fontScaleIdx]);
  useEffect(() => { writePref('aiq-rail-open', railOpen); }, [railOpen]);

  const loadAll = useCallback(async () => {
    try {
      const [p, u, q, pr, qs, lic] = await Promise.all([
        api.getProviders(),
        api.getUsageAll(),
        api.getQueue(),
        api.getProjects(),
        api.getQueueState(),
        api.getLicense(),
      ]);
      setProviders(p   || []);
      setUsageAll(u    || {});
      setQueue(q       || []);
      setProjects(pr   || []);
      setQueueState(qs || { paused: false, processing: false });
      setLicense(lic   || null);
    } catch (e) {
      console.error('loadAll error:', e);
    }
  }, []);

  // Load the real version from package.json via Electron once on mount
  useEffect(() => {
    api.getAppVersion().then(v => { if (v) setAppVersion(v); }).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();

    const offQueue  = api.onQueueUpdate(async () => {
      setQueue(await api.getQueue());
      setQueueState(await api.getQueueState());
    });
    const offUsage  = api.onUsageUpdate(({ allStatus }) => {
      if (allStatus) setUsageAll(allStatus);
    });
    const offDone    = api.onItemComplete(async ({ label, provider }) => {
      showToast('Done: "' + (label || '').slice(0, 40) + '" via ' + provider + ' — see Results tab', 'success');
      // Belt-and-suspenders: refresh the queue so the item flips from
      // "processing" to "complete" in the UI even if queue-update was missed.
      try { setQueue(await api.getQueue()); } catch (_) {}
    });
    const offError   = api.onItemError(({ error }) => {
      showToast((error || '').slice(0, 80), 'error');
    });
    const offCompare = api.onCompareComplete(({ label, results }) => {
      const ok = (results || []).filter(r => r.response).length;
      const n  = (results || []).length;
      showToast('Compare "' + (label || '').slice(0, 35) + '" — ' + ok + '/' + n + ' responded', 'success');
    });

    const usageTimer = setInterval(async () => {
      try { setUsageAll(await api.getUsageAll()); } catch (_) {}
    }, 15_000);

    // Poll local provider reachability every 15 s so dots reflect online/offline state
    const reachabilityTimer = setInterval(async () => {
      try { setReachability(await api.getLocalReachability()); } catch (_) {}
    }, 15_000);
    // Also fetch once on mount
    api.getLocalReachability().then(setReachability).catch(() => {});

    return () => {
      offQueue(); offUsage(); offDone(); offError(); offCompare();
      clearInterval(usageTimer);
      clearInterval(reachabilityTimer);
    };
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAddPrompt = async (item) => {
    await api.addToQueue(item);
    setQueue(await api.getQueue());
    showToast('Queued: "' + (item.prompt || '').slice(0, 50) + '"', 'success');
  };

  const handlePauseResume = async () => {
    if (queueState.paused) await api.resumeQueue();
    else await api.pauseQueue();
    setQueueState(await api.getQueueState());
  };

  const pendingCount = queue.filter(i => i.status === 'pending').length;

  // Count results completed since the user last viewed the Results tab
  const unseenResultsCount = queue.filter(i =>
    i.status === 'complete' &&
    (i.completed_at || i.created_at || 0) > lastResultsView
  ).length;

  /** Switch tab; record view time when opening Results so the badge clears */
  function navigateTo(id) {
    setTab(id);
    if (id === 'results') {
      const now = Date.now();
      setLastResultsView(now);
      writePref('aiq-last-results-view', now);
    }
  }

  function handleFontScaleChange(delta) {
    setFontScaleIdx(i => Math.max(0, Math.min(FONT_SCALES.length - 1, i + delta)));
  }

  function handleNavigate(targetTab, itemId) {
    navigateTo(targetTab);
    if (itemId) setHighlightId(itemId);
  }

  function handleRailItemClick(id) {
    setTab('queue');
    setHighlightId(id);
  }

  const shellClass = [
    'app-shell',
    theme === 'light' ? 'theme-light' : 'theme-dark',
    railOpen ? 'rail-open' : 'rail-collapsed',
  ].join(' ');

  return (
    <div
      className="app-root"
      data-theme={theme}
    >
      <TitleBar title="AIQ Load Manager" theme={theme} />

      <div className={shellClass} style={{ '--ui-scale': uiScale }}>
        <nav className="sidebar" aria-label="Main navigation">
          <div className="sidebar-nav">
            {NAV.map(n => (
              <button
                key={n.id}
                type="button"
                className={'nav-item-v ' + (tab === n.id ? 'active' : '')}
                onClick={() => navigateTo(n.id)}
                title={n.label}
              >
                <span className="nav-icon-wrap">
                  <NavIcon name={n.id} size={21} />
                  {n.id === 'queue' && pendingCount > 0 && (
                    <span className="nav-badge-v">{pendingCount}</span>
                  )}
                  {n.id === 'results' && unseenResultsCount > 0 && (
                    <span className="nav-badge-v" style={{ background: 'var(--success)' }}>{unseenResultsCount}</span>
                  )}
                </span>
                <span className="nav-label-v">{n.label}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <button
              type="button"
              className={'pause-btn ' + (queueState.paused ? 'paused' : '')}
              onClick={handlePauseResume}
            >
              {queueState.paused ? (
                <>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
                    <polygon points="5 3 19 12 5 21" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
                    <rect x="5" y="4" width="5" height="16" rx="1" />
                    <rect x="14" y="4" width="5" height="16" rx="1" />
                  </svg>
                  Pause
                </>
              )}
            </button>
            <div className="provider-dots">
              {providers.map(p => {
                const isLocal    = ['ollama','lmstudio','jan','localai','llamacpp'].includes(p.name);
                const reachable  = isLocal ? (reachability[p.name] ?? true) : true;
                const isOffline  = p.configured && isLocal && !reachable;
                const dotClass   = p.configured ? (isOffline ? 'offline' : 'on') : 'off';
                const tip        = p.configured
                  ? (isOffline ? `${p.displayName} — server offline` : p.displayName + ' — ready')
                  : p.displayName + ' — no API key';
                return (
                  <span
                    key={p.name}
                    className={'provider-dot ' + dotClass}
                    title={tip}
                    aria-label={tip}
                    style={p.configured && !isOffline ? { background: p.color } : undefined}
                  />
                );
              })}
            </div>
          </div>
        </nav>

        <div className="content-column">
          <AppHeader
            queue={queue}
            projects={projects}
            theme={theme}
            onThemeToggle={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            onFontScaleChange={handleFontScaleChange}
            fontScaleIdx={fontScaleIdx}
            maxFontIdx={FONT_SCALES.length - 1}
            railOpen={railOpen}
            onRailToggle={() => setRailOpen(o => !o)}
            onAddPrompt={() => setTab('add')}
            onNavigate={handleNavigate}
            license={license}
          />

          <div className="content-row">
            <main className="main-panel">
              {tab === 'usage'    && <UsageDashboard providers={providers} usageAll={usageAll} queue={queue} />}
              {tab === 'queue'    && <QueuePanel queue={queue} providers={providers} onRefresh={loadAll} highlightId={highlightId} license={license} />}
              {tab === 'add'      && <AddPromptPanel providers={providers} projects={projects} onSubmit={handleAddPrompt} license={license} />}
              {tab === 'results'  && <ResultsPanel queue={queue} providers={providers} onRefresh={loadAll} />}
              {tab === 'projects' && <ProjectsPanel projects={projects} providers={providers} onRefresh={loadAll} license={license} />}
              {tab === 'settings' && <SettingsPanel providers={providers} onRefresh={loadAll} showToast={showToast} />}
              {tab === 'license'  && <LicensePanel showToast={showToast} />}
              {tab === 'support'  && <SupportPanel appVersion={appVersion} />}
            </main>

            {railOpen && (
              <RightRail
                queue={queue}
                providers={providers}
                onSelectQueueItem={handleRailItemClick}
              />
            )}
          </div>
        </div>
      </div>

      {toast && (
        // role="alert" + assertive for errors so screen readers interrupt immediately;
        // role="status" + polite for non-urgent messages.
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          className={'toast toast-' + toast.type}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
