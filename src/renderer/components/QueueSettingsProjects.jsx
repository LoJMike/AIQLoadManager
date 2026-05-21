// ─── QueuePanel ──────────────────────────────────────────────────────────────

import { useState } from 'react';

const STATUS_COLORS = {
  pending:    'var(--text3)',
  processing: 'var(--accent)',
  complete:   'var(--success)',
  error:      'var(--danger)',
  cancelled:  'var(--text3)',
};

export function QueuePanel({ queue, providers, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const api = window.aiQueue;

  const counts = {
    all:     queue.length,
    pending: queue.filter(i => i.status === 'pending').length,
    complete:queue.filter(i => i.status === 'complete').length,
    error:   queue.filter(i => i.status === 'error').length,
  };

  const visible = filter === 'all' ? queue : queue.filter(i => i.status === filter);

  async function remove(id)  { await api.removeFromQueue(id); onRefresh(); }
  async function retry(id)   { await api.retryItem(id); onRefresh(); }
  async function clearDone() { await api.clearCompleted(); onRefresh(); }
  async function reorder(id, dir) { await api.reorderQueue(id, dir); onRefresh(); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="panel-title">Prompt Queue</div>
          <div className="panel-sub">{counts.pending} pending · {counts.complete} complete · {counts.error} errors</div>
        </div>
        <button className="secondary" onClick={clearDone}>Clear completed</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['all','pending','complete','error'].map(s => (
          <button
            key={s}
            className={filter === s ? 'primary' : 'secondary'}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setFilter(s)}
          >
            {s} <span style={{ opacity: 0.7 }}>({counts[s]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 0', fontSize: 13 }}>
          {filter === 'all' ? 'Queue is empty — add prompts in the Add tab.' : `No ${filter} items.`}
        </div>
      )}

      {visible.map(item => (
        <div
          key={item.id}
          className={`queue-item ${item.status}`}
        >
          <div>
            <div className="qi-prompt">
              {item.label
                ? <><strong style={{ color: 'var(--accent)' }}>{item.label}</strong> — {item.prompt.slice(0, 120)}</>
                : item.prompt.slice(0, 140)
              }
              {item.prompt.length > 140 && '…'}
            </div>
            <div className="qi-meta">
              <span style={{ color: STATUS_COLORS[item.status], fontWeight: 600 }}>{item.status}</span>
              {item.used_provider && <span>via {item.used_provider}</span>}
              {item.routing_mode  && item.routing_mode !== 'auto' && <span>{item.routing_mode}</span>}
              {item.task_type     && <span>{item.task_type}</span>}
              {item.project_name  && <span>📁 {item.project_name}</span>}
              {item.scheduled_for && <span>🕐 {new Date(item.scheduled_for).toLocaleString()}</span>}
              {item.cost_usd > 0  && <span>${item.cost_usd.toFixed(6)}</span>}
              <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>
                {new Date(item.created_at).toLocaleTimeString()}
              </span>
            </div>

            {/* Expanded response */}
            {expanded === item.id && item.response && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 6, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {item.response}
              </div>
            )}

            {item.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)', background: 'rgba(248,113,113,0.07)', padding: '6px 10px', borderRadius: 5 }}>
                {item.error}
              </div>
            )}
          </div>

          <div className="qi-actions">
            {item.response && (
              <button className="ghost" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                {expanded === item.id ? '▲' : '▼'}
              </button>
            )}
            {item.status === 'pending' && (
              <>
                <button className="ghost" onClick={() => reorder(item.id, 'up')} title="Higher priority">↑</button>
                <button className="ghost" onClick={() => reorder(item.id, 'down')} title="Lower priority">↓</button>
              </>
            )}
            {(item.status === 'error' || item.status === 'cancelled') && (
              <button className="ghost" onClick={() => retry(item.id)} style={{ color: 'var(--warning)' }}>↺</button>
            )}
            {item.status !== 'processing' && (
              <button className="ghost" onClick={() => remove(item.id)} style={{ color: 'var(--danger)' }}>✕</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

export function SettingsPanel({ providers, onRefresh, showToast }) {
  const [keys, setKeys]       = useState({});
  const [budgets, setBudgets] = useState({});
  const api = window.aiQueue;

  async function saveKey(provider) {
    if (!keys[provider]) return;
    try {
      await api.setApiKey(provider, keys[provider]);
      setKeys(k => ({ ...k, [provider]: '' }));
      showToast(`API key saved for ${provider}`, 'success');
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function removeKey(provider) {
    await api.removeApiKey(provider);
    showToast(`Removed key for ${provider}`, 'info');
    onRefresh();
  }

  async function saveBudget(provider) {
    await api.setBudget(provider, parseFloat(budgets[provider]) || 0);
    showToast(`Budget set for ${provider}`, 'success');
  }

  return (
    <div>
      <div className="panel-title">Settings</div>
      <div className="panel-sub">Manage API keys and monthly budget limits per provider</div>

      {providers.map(p => (
        <div key={p.name} className="card" style={{ marginBottom: 12, borderColor: p.configured ? `${p.color}30` : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.configured ? p.color : '#3a3a3d' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{p.displayName}</span>
            <span className={`tag ${p.configured ? 'tag-success' : 'tag-muted'}`}>
              {p.configured ? 'configured' : 'not set'}
            </span>
            <a
              href="#"
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}
              onClick={e => { e.preventDefault(); api.openExternal(p.website); }}
            >
              {p.website} ↗
            </a>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label>API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  placeholder={p.configured ? '●●●●●●●● (replace)' : 'Paste API key…'}
                  value={keys[p.name] || ''}
                  onChange={e => setKeys(k => ({ ...k, [p.name]: e.target.value }))}
                />
                <button className="primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => saveKey(p.name)}>Save</button>
                {p.configured && <button className="secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => removeKey(p.name)}>Remove</button>}
              </div>
            </div>

            <div className="form-group">
              <label>Monthly budget (USD, 0 = no limit)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 10.00"
                  value={budgets[p.name] ?? ''}
                  onChange={e => setBudgets(b => ({ ...b, [p.name]: e.target.value }))}
                />
                <button className="secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => saveBudget(p.name)}>Set</button>
              </div>
            </div>
          </div>

          {/* Model list */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {p.models?.map(m => (
              <span key={m.id} className="tag tag-muted" style={{ fontSize: 10 }}>
                {m.name} · ${m.inputCost}/M in
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ProjectsPanel ────────────────────────────────────────────────────────────

export function ProjectsPanel({ projects, providers, onRefresh }) {
  const [name,  setName]  = useState('');
  const [desc,  setDesc]  = useState('');
  const [color, setColor] = useState('#6366f1');
  const api = window.aiQueue;

  const COLORS = ['#6366f1','#10a37f','#d97757','#f55036','#4285f4','#ff7000','#ec4899'];

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addProject({ name, description: desc, color });
    setName(''); setDesc('');
    onRefresh();
  }

  async function del(id) {
    await api.deleteProject(id);
    onRefresh();
  }

  return (
    <div>
      <div className="panel-title">Projects</div>
      <div className="panel-sub">Organise prompts into named projects. Each project keeps its conversation history.</div>

      <form onSubmit={add} className="card" style={{ marginBottom: 20 }}>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label>Project name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My Project" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label>Colour</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <button type="submit" className="primary">Create project</button>
      </form>

      {projects.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: 13 }}>
          No projects yet. Create one above to organise your prompts.
        </div>
      )}

      <div className="grid-2">
        {projects.map(p => (
          <div key={p.id} className="card" style={{ borderLeft: `3px solid ${p.color}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              <button className="ghost" style={{ color: 'var(--danger)' }} onClick={() => del(p.id)}>✕</button>
            </div>
            {p.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{p.description}</div>}
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Created {new Date(p.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
