import { useState, useEffect, useCallback } from 'react';
import UsageDashboard from './components/UsageDashboard';
import AddPromptPanel from './components/AddPromptPanel';
import { QueuePanel, SettingsPanel, ProjectsPanel, TitleBar, LicensePanel } from './components/index.js';
import NavIcon from './components/NavIcons.jsx';
import AppHeader from './components/AppHeader.jsx';
import RightRail from './components/RightRail.jsx';
import './App.css';
import './teamify-shell.css';

const NAV = [
  { id: 'usage',    label: 'Usage'    },
  { id: 'queue',    label: 'Queue'    },
  { id: 'add',      label: 'Add'      },
  { id: 'projects', label: 'Projects' },
  { id: 'settings', label: 'Settings' },
  { id: 'license',  label: 'License'  },
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
  const [toast,         setToast]         = useState(null);
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

  useEffect(() => {
    loadAll();

    const offQueue  = api.onQueueUpdate(async () => {
      setQueue(await api.getQueue());
      setQueueState(await api.getQueueState());
    });
    const offUsage  = api.onUsageUpdate(({ allStatus }) => {
      if (allStatus) setUsageAll(allStatus);
    });
    const offDone    = api.onItemComplete(({ label, provider }) => {
      showToast('Done: "' + (label || '').slice(0, 40) + '" via ' + provider, 'success');
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

    return () => {
      offQueue(); offUsage(); offDone(); offError(); offCompare();
      clearInterval(usageTimer);
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

  function handleFontScaleChange(delta) {
    setFontScaleIdx(i => Math.max(0, Math.min(FONT_SCALES.length - 1, i + delta)));
  }

  function handleNavigate(targetTab, itemId) {
    setTab(targetTab);
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
      <TitleBar title="AIQ Load Manager" />

      <div className={shellClass} style={{ '--ui-scale': uiScale }}>
        <nav className="sidebar" aria-label="Main navigation">
          <div className="sidebar-nav">
            {NAV.map(n => (
              <button
                key={n.id}
                type="button"
                className={'nav-item-v ' + (tab === n.id ? 'active' : '')}
                onClick={() => setTab(n.id)}
                title={n.label}
              >
                <span className="nav-icon-wrap">
                  <NavIcon name={n.id} size={28} />
                  {n.id === 'queue' && pendingCount > 0 && (
                    <span className="nav-badge-v">{pendingCount}</span>
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
              {queueState.paused ? 'Resume' : 'Pause'}
            </button>
            <div className="provider-dots">
              {providers.map(p => (
                <span
                  key={p.name}
                  className={'provider-dot ' + (p.configured ? 'on' : 'off')}
                  title={p.displayName}
                  aria-label={p.displayName + (p.configured ? ' — configured' : ' — no API key')}
                  style={p.configured ? { background: p.color } : undefined}
                />
              ))}
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
              {tab === 'queue'    && <QueuePanel queue={queue} providers={providers} onRefresh={loadAll} highlightId={highlightId} />}
              {tab === 'add'      && <AddPromptPanel providers={providers} projects={projects} onSubmit={handleAddPrompt} license={license} />}
              {tab === 'projects' && <ProjectsPanel projects={projects} providers={providers} onRefresh={loadAll} />}
              {tab === 'settings' && <SettingsPanel providers={providers} onRefresh={loadAll} showToast={showToast} />}
              {tab === 'license'  && <LicensePanel showToast={showToast} />}
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
        <div className={'toast toast-' + toast.type} role="status">{toast.msg}</div>
      )}
    </div>
  );
}
