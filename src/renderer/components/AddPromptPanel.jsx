import { useState, useEffect } from 'react';

const ROUTING_MODES = [
  { value: 'auto',     label: 'Auto (scored best match)' },
  { value: 'balance',  label: 'Balance (round-robin)' },
  { value: 'cheapest', label: 'Cheapest provider' },
  { value: 'fastest',  label: 'Fastest (Groq first)' },
  { value: 'freeTier', label: 'Free tier only' },
  { value: 'manual',   label: 'Manual (pick provider)' },
];

const TASK_TYPES = [
  { value: 'general',  label: 'General' },
  { value: 'coding',   label: 'Coding' },
  { value: 'research', label: 'Research' },
  { value: 'fast',     label: 'Fast response' },
  { value: 'graphics', label: 'Graphics / image' },
];

const EMPTY = {
  prompt: '', label: '', systemPrompt: '',
  routingMode: 'auto', provider: '', taskType: 'general',
  model: '', maxTokens: 1024,
  projectId: '', conversationId: '',
  scheduledFor: '',
};

export default function AddPromptPanel({ providers, projects, onSubmit }) {
  const [form,        setForm]        = useState(EMPTY);
  const [conversations, setConvs]    = useState([]);
  const [routePreview, setPreview]   = useState(null);
  const [submitting,  setSubmitting] = useState(false);
  const [bulk,        setBulk]       = useState(false);
  const [bulkText,    setBulkText]   = useState('');

  const api = window.aiQueue;

  // When provider changes, load its conversations
  useEffect(() => {
    if (form.provider) {
      api.getConversations(form.provider).then(setConvs).catch(() => setConvs([]));
    } else {
      setConvs([]);
    }
  }, [form.provider]);

  // Live route preview when key fields change
  useEffect(() => {
    if (!form.prompt.trim()) { setPreview(null); return; }
    const t = setTimeout(async () => {
      const p = await api.previewRoute({
        prompt: form.prompt,
        provider: form.provider || null,
        routing_mode: form.routingMode,
        task_type: form.taskType,
        model: form.model || null,
      });
      setPreview(p);
    }, 500);
    return () => clearTimeout(t);
  }, [form.prompt, form.provider, form.routingMode, form.taskType, form.model]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const availableModels = form.provider
    ? providers.find(p => p.name === form.provider)?.models || []
    : [];

  const configuredProviders = providers.filter(p => p.configured);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.prompt.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        prompt:         form.prompt,
        label:          form.label || null,
        systemPrompt:   form.systemPrompt || null,
        provider:       form.routingMode === 'manual' ? form.provider : (form.provider || null),
        routingMode:    form.routingMode,
        taskType:       form.taskType,
        model:          form.model || null,
        maxTokens:      parseInt(form.maxTokens) || 1024,
        projectId:      form.projectId || null,
        projectName:    projects.find(p => p.id === form.projectId)?.name || null,
        conversationId: form.conversationId || null,
        scheduledFor:   form.scheduledFor || null,
      });
      setForm(f => ({ ...EMPTY, routingMode: f.routingMode, taskType: f.taskType }));
      setPreview(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkSubmit() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSubmitting(true);
    for (const line of lines) {
      await onSubmit({
        prompt:      line,
        routingMode: form.routingMode,
        taskType:    form.taskType,
        provider:    form.routingMode === 'manual' ? form.provider : null,
        projectId:   form.projectId || null,
        maxTokens:   parseInt(form.maxTokens) || 1024,
      });
    }
    setBulkText('');
    setSubmitting(false);
  }

  return (
    <div>
      <div className="panel-title">Add to Queue</div>
      <div className="panel-sub">Schedule one or more prompts across your AI providers</div>

      {/* Bulk / Single toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={bulk ? 'secondary' : 'primary'} onClick={() => setBulk(false)}>Single prompt</button>
        <button className={bulk ? 'primary' : 'secondary'} onClick={() => setBulk(true)}>Bulk (one per line)</button>
      </div>

      {bulk ? (
        <div className="card">
          <div className="form-group">
            <label>Prompts — one per line</label>
            <textarea
              rows={10}
              placeholder={"Summarise this week's news\nWrite a unit test for the login function\nExplain quantum entanglement simply"}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
          </div>
          <div className="form-row form-row-3" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Routing mode</label>
              <select value={form.routingMode} onChange={e => set('routingMode', e.target.value)}>
                {ROUTING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Task type</label>
              <select value={form.taskType} onChange={e => set('taskType', e.target.value)}>
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Project (optional)</label>
              <select value={form.projectId} onChange={e => set('projectId', e.target.value)}>
                <option value="">— none —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <button className="primary" onClick={handleBulkSubmit} disabled={submitting || !bulkText.trim()}>
            {submitting ? 'Adding…' : `Add ${bulkText.split('\n').filter(l => l.trim()).length} prompts`}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Prompt *</label>
              <textarea
                placeholder="What would you like Claude / GPT / Gemini to do?"
                value={form.prompt}
                onChange={e => set('prompt', e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="form-group">
              <label>Label (optional — shown in queue)</label>
              <input
                placeholder="e.g. Weekly summary task"
                value={form.label}
                onChange={e => set('label', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>System prompt (optional)</label>
              <textarea
                placeholder="You are a helpful assistant specialised in…"
                value={form.systemPrompt}
                onChange={e => set('systemPrompt', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Routing
            </div>
            <div className="form-row form-row-2" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label>Routing mode</label>
                <select value={form.routingMode} onChange={e => set('routingMode', e.target.value)}>
                  {ROUTING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Task type</label>
                <select value={form.taskType} onChange={e => set('taskType', e.target.value)}>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {form.routingMode === 'manual' && (
                <>
                  <div className="form-group">
                    <label>Provider</label>
                    <select value={form.provider} onChange={e => { set('provider', e.target.value); set('model', ''); }}>
                      <option value="">— select —</option>
                      {configuredProviders.map(p => <option key={p.name} value={p.name}>{p.displayName}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Model</label>
                    <select value={form.model} onChange={e => set('model', e.target.value)} disabled={!form.provider}>
                      <option value="">— default —</option>
                      {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Route preview */}
            {routePreview && (
              <div className={`route-preview ${routePreview.wait ? 'wait' : 'ok'}`}>
                {routePreview.wait
                  ? `⏳ All providers at limit — will wait ~${Math.ceil((routePreview.waitMs || 0) / 1000)}s`
                  : `→ Will route to ${routePreview.provider}${routePreview.model ? ` / ${routePreview.model}` : ''} — ${routePreview.reason}`
                }
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Destination
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Project (optional)</label>
                <select value={form.projectId} onChange={e => set('projectId', e.target.value)}>
                  <option value="">— new conversation —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Continue conversation (ID)</label>
                <select value={form.conversationId} onChange={e => set('conversationId', e.target.value)} disabled={conversations.length === 0}>
                  <option value="">— start new —</option>
                  {conversations.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Schedule for (optional)</label>
                <input type="datetime-local" value={form.scheduledFor} onChange={e => set('scheduledFor', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Max tokens</label>
                <input type="number" min={64} max={32000} value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} />
              </div>
            </div>
          </div>

          <button type="submit" className="primary" disabled={submitting || !form.prompt.trim()}>
            {submitting ? 'Adding to queue…' : 'Add to Queue'}
          </button>
        </form>
      )}

      <style>{`
        .route-preview {
          margin-top: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
        }
        .route-preview.ok   { background: rgba(52,211,153,0.08); color: var(--success); border: 1px solid rgba(52,211,153,0.2); }
        .route-preview.wait { background: rgba(251,191,36,0.08);  color: var(--warning); border: 1px solid rgba(251,191,36,0.2); }
      `}</style>
    </div>
  );
}
