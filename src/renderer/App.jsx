import { useState, useEffect, useCallback } from 'react';
import UsageDashboard from './components/UsageDashboard';
import AddPromptPanel from './components/AddPromptPanel';
import { QueuePanel, SettingsPanel, ProjectsPanel, TitleBar, LicensePanel } from './components/index.js';
import './App.css';

const NAV = [
  { id: 'usage',    label: 'Usage',    icon: '⬡' },
  { id: 'queue',    label: 'Queue',    icon: '⋮⋮' },
  { id: 'add',      label: 'Add',      icon: '+' },
  { id: 'projects', label: 'Projects', icon: '⌂' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'license',  label: 'License',  icon: '◈' },
];

export default function App() {
  const [tab,        setTab]        = useState('usage');
  const [providers,  setProviders]  = useState([]);
  const [usageAll,   setUsageAll]   = useState({});
  const [queue,      setQueue]      = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [queueState, setQueueState] = useState({ paused: false, processing: false });
  const [license,    setLicense]    = useState(null);
  const [toast,      setToast]      = useState(null);

  const api = window.aiQueue;

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
      showToast(`✓ "${(label || '').slice(0, 40)}" done via ${provider}`, 'success');
    });
    const offError   = api.onItemError(({ error }) => {
      showToast(`✗ ${(error || '').slice(0, 80)}`, 'error');
    });
    const offCompare = api.onCompareComplete(({ label, results }) => {
      const ok = (results || []).filter(r => r.response).length;
      const n  = (results || []).length;
      showToast(`⚖ "${(label || '').slice(0, 35)}" — ${ok}/${n} providers responded`, 'success');
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
    showToast(`Queued: "${(item.prompt || '').slice(0, 50)}"`, 'success');
  };

  const handlePauseResume = async () => {
    if (queueState.paused) await api.resumeQueue();
    else await api.pauseQueue();
    setQueueState(await api.getQueueState());
  };

  const pendingCount = queue.filter(i => i.status === 'pending').length;

  return (
    <div className="app-root">
    <TitleBar title="AIQ Load Manager" />
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? 'active' : ''}`}
              onClick={() => setTab(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {n.id === 'queue' && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className={`pause-btn ${queueState.paused ? 'paused' : ''}`}
            onClick={handlePauseResume}
          >
            {queueState.paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <div className="provider-dots">
            {providers.map(p => (
              <span
                key={p.name}
                className={`provider-dot ${p.configured ? 'on' : 'off'}`}
                title={`${p.displayName}: ${p.configured ? 'configured' : 'no API key'}`}
                style={p.configured ? { background: p.color } : undefined}
              />
            ))}
          </div>
        </div>
      </nav>

      <main className="main-panel">
        {tab === 'usage'    && <UsageDashboard  providers={providers} usageAll={usageAll} />}
        {tab === 'queue'    && <QueuePanel      queue={queue} providers={providers} onRefresh={loadAll} />}
        {tab === 'add'      && <AddPromptPanel  providers={providers} projects={projects} onSubmit={handleAddPrompt} license={license} />}
        {tab === 'projects' && <ProjectsPanel   projects={projects} providers={providers} onRefresh={loadAll} />}
        {tab === 'settings' && <SettingsPanel   providers={providers} onRefresh={loadAll} showToast={showToast} />}
        {tab === 'license'  && <LicensePanel   showToast={showToast} />}
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
    </div>
  );
}
