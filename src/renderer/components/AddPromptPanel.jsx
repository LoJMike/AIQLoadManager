import { useState, useEffect, useMemo } from 'react';

const ROUTING_MODES = [
  { value: 'auto',     label: 'Auto (scored best match)' },
  { value: 'balance',  label: 'Balance (round-robin)' },
  { value: 'cheapest', label: 'Cheapest provider' },
  { value: 'fastest',  label: 'Fastest (Groq first)' },
  { value: 'freeTier', label: 'Free tier only' },
  { value: 'manual',   label: 'Manual (pick provider)' },
];

/**
 * Prompt tag definitions — display config only.
 * Priority weights are computed server-side (main process) so the renderer
 * can never inflate queue priority by spoofing these values.
 *
 * `taskType` is passed to the router for provider selection.
 * `urgent` has no taskType — it is a priority modifier only.
 */
const PROMPT_TAGS = [
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

/** Derive routing task_type from selected tag IDs */
function tagsToTaskType(tagIds = []) {
  const TAG_TO_TASK = {
    chat: 'general', research: 'research', code: 'coding',
    web_search: 'research', writing: 'general', analysis: 'research',
    image: 'graphics', translate: 'general',
  };
  for (const id of tagIds) {
    if (TAG_TO_TASK[id]) return TAG_TO_TASK[id];
  }
  return 'general';
}

const EMPTY = {
  prompt: '', label: '', systemPrompt: '',
  routingMode: 'auto', provider: '',
  model: '', maxTokens: 1024,
  projectId: '', conversationId: '',
  scheduledFor: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Rough token approximation: ~4 chars per token (±15% for English prose) */
function estimateTokens(text) {
  return Math.max(1, Math.ceil((text || '').length / 4));
}

/** Format a USD cost value for display */
function fmtCost(usd) {
  if (usd === 0)      return '$0.00';
  if (usd < 0.000001) return '< $0.000001';
  if (usd < 0.001)    return `$${usd.toFixed(6)}`;
  if (usd < 0.01)     return `$${usd.toFixed(5)}`;
  if (usd < 1)        return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

/** Format a wait time in ms as a readable string */
function fmtWait(ms) {
  if (!ms || ms <= 0) return null;
  if (ms < 60_000) return `~${Math.ceil(ms / 1000)}s`;
  return `~${Math.ceil(ms / 60_000)}m`;
}

// ── Tag chip sub-component ─────────────────────────────────────────────────

function TagChips({ selectedTags, onToggle }) {
  return (
    <div>
      <label style={{ marginBottom: 8, display: 'block' }}>Prompt type <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional — helps routing &amp; prioritisation)</span></label>
      <div className="tag-chip-grid">
        {PROMPT_TAGS.map(tag => {
          const active = selectedTags.includes(tag.id);
          const isUrgent = tag.id === 'urgent';
          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip ${active ? 'active' : ''} ${isUrgent ? 'urgent' : ''}`}
              style={active ? { '--chip-color': tag.color } : {}}
              onClick={() => onToggle(tag.id)}
              title={isUrgent ? 'Marks this prompt as high-priority in the queue' : `Routes to ${tag.taskType || 'general'} providers`}
            >
              <span className="chip-emoji">{tag.emoji}</span>
              <span className="chip-label">{tag.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AddPromptPanel({ providers, projects, onSubmit, license }) {
  const [form,             setForm]         = useState(EMPTY);
  const [selectedTags,     setTags]         = useState([]);
  const [conversations,    setConvs]        = useState([]);
  const [routePreview,     setPreview]      = useState(null);
  const [submitting,       setSubmitting]   = useState(false);
  const [bulk,             setBulk]         = useState(false);
  const [bulkText,         setBulkText]     = useState('');
  const [compareMode,      setCompareMode]  = useState(false);
  const [compareSel,       setCompareSel]   = useState([]); // selected provider names

  const isPro = license?.plan === 'pro';

  // Live token estimate (pure maths — no debounce needed)
  const tokenEstimate = useMemo(() => estimateTokens(form.prompt), [form.prompt]);

  // Task type is derived from selected tags (drives router provider selection)
  const taskType = useMemo(() => tagsToTaskType(selectedTags), [selectedTags]);

  const api = window.aiQueue;

  function toggleTag(id) {
    setTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  function toggleCompareProvider(name) {
    setCompareSel(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function setMode(m) {
    setBulk(m === 'bulk');
    setCompareMode(m === 'compare');
  }

  // When provider changes, load its conversations
  useEffect(() => {
    if (form.provider) {
      api.getConversations(form.provider).then(setConvs).catch(() => setConvs([]));
    } else {
      setConvs([]);
    }
  }, [form.provider]);

  // Live route preview — fires 500 ms after the user stops changing key fields
  useEffect(() => {
    if (!form.prompt.trim()) { setPreview(null); return; }
    const t = setTimeout(async () => {
      const p = await api.previewRoute({
        prompt:       form.prompt,
        provider:     form.provider || null,
        routing_mode: form.routingMode,
        task_type:    taskType,
        model:        form.model || null,
        maxTokens:    parseInt(form.maxTokens) || 1024,
      });
      setPreview(p);
    }, 500);
    return () => clearTimeout(t);
  }, [form.prompt, form.provider, form.routingMode, taskType, form.model, form.maxTokens]);

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
      if (compareMode) {
        // Compare mode — fan out to selected providers, no routing/conversation context
        await onSubmit({
          prompt:          form.prompt,
          label:           form.label || null,
          systemPrompt:    form.systemPrompt || null,
          tags:            selectedTags,
          maxTokens:       parseInt(form.maxTokens) || 1024,
          compareProviders: compareSel,
          routingMode:     'compare',
        });
        setForm(f => ({ ...EMPTY }));
        setTags([]);
        setCompareSel([]);
      } else {
        // Normal single-prompt mode
        await onSubmit({
          prompt:         form.prompt,
          label:          form.label || null,
          systemPrompt:   form.systemPrompt || null,
          provider:       form.routingMode === 'manual' ? form.provider : (form.provider || null),
          routingMode:    form.routingMode,
          taskType,
          tags:           selectedTags,
          model:          form.model || null,
          maxTokens:      parseInt(form.maxTokens) || 1024,
          projectId:      form.projectId || null,
          projectName:    projects.find(p => p.id === form.projectId)?.name || null,
          conversationId: form.conversationId || null,
          scheduledFor:   form.scheduledFor || null,
        });
        setForm(f => ({ ...EMPTY, routingMode: f.routingMode }));
        setTags([]);
        setPreview(null);
      }
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
        taskType,
        tags:        selectedTags,
        provider:    form.routingMode === 'manual' ? form.provider : null,
        projectId:   form.projectId || null,
        maxTokens:   parseInt(form.maxTokens) || 1024,
      });
    }
    setBulkText('');
    setSubmitting(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="panel-title">Add to Queue</div>
      <div className="panel-sub">Schedule one or more prompts across your AI providers</div>

      {/* Mode toggle: Single / Compare / Bulk */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={!bulk && !compareMode ? 'primary' : 'secondary'} onClick={() => setMode('single')}>Single prompt</button>
        <button className={compareMode ? 'primary' : 'secondary'} onClick={() => setMode('compare')} title="Pro — send same prompt to multiple providers, see responses side by side">
          ⚖ Compare <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3 }}>Pro</span>
        </button>
        <button className={bulk ? 'primary' : 'secondary'} onClick={() => setMode('bulk')}>Bulk (one per line)</button>
      </div>

      {compareMode ? (
        /* ── Compare mode ── */
        <form onSubmit={handleSubmit}>
          {/* Prompt card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <label style={{ marginBottom: 0 }}>Prompt *</label>
                {form.prompt.trim() && (
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                    ~{tokenEstimate.toLocaleString()} tokens in · {(form.maxTokens || 1024).toLocaleString()} max out
                  </span>
                )}
              </div>
              <textarea
                placeholder="What would you like to compare across providers?"
                value={form.prompt}
                onChange={e => set('prompt', e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <TagChips selectedTags={selectedTags} onToggle={toggleTag} />
            </div>
          </div>

          {/* Provider selection card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Providers to compare
              </div>
              {compareSel.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{compareSel.length} selected</span>
              )}
            </div>

            {!isPro ? (
              /* Pro gate */
              <div style={{ padding: '14px 16px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>⚖ Compare mode is a Pro feature</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  Upgrade to Pro to send the same prompt to multiple providers simultaneously and view responses side by side.
                </div>
                <button type="button" className="primary" style={{ marginTop: 12, fontSize: 12 }}
                  onClick={() => window.aiQueue.openExternal('https://example.com/upgrade')}>
                  Upgrade to Pro →
                </button>
              </div>
            ) : configuredProviders.length < 2 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 0' }}>
                You need at least 2 configured providers to use Compare mode. Add API keys in Settings.
              </div>
            ) : (
              <>
                <div className="compare-provider-grid">
                  {configuredProviders.map(p => {
                    const selected = compareSel.includes(p.name);
                    return (
                      <button
                        key={p.name}
                        type="button"
                        className={`compare-provider-chip ${selected ? 'selected' : ''}`}
                        style={selected ? { '--chip-accent': p.color } : {}}
                        onClick={() => toggleCompareProvider(p.name)}
                      >
                        <span className="cpc-dot" style={{ background: p.color }} />
                        <span className="cpc-label">{p.displayName}</span>
                        {selected && <span className="cpc-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {compareSel.length === 1 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--warning)' }}>Select at least 2 providers to compare.</div>
                )}
              </>
            )}
          </div>

          {/* Options card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Options
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Label <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                <input placeholder="e.g. Compare coding task" value={form.label} onChange={e => set('label', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Max tokens per provider</label>
                <input type="number" min={64} max={32000} value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>System prompt <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional — same for all providers)</span></label>
              <textarea placeholder="You are a helpful assistant…" value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={2} />
            </div>
          </div>

          <button type="submit" className="primary"
            disabled={submitting || !form.prompt.trim() || !isPro || compareSel.length < 2}>
            {submitting ? 'Queuing compare…' : `⚖ Compare across ${compareSel.length || '?'} providers`}
          </button>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
            Responses run in parallel. Results appear in the Queue tab when all providers reply.
          </div>
        </form>

      ) : bulk ? (
        /* ── Bulk mode ── */
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

          <div className="form-group">
            <TagChips selectedTags={selectedTags} onToggle={toggleTag} />
          </div>

          <div className="form-row form-row-3" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Routing mode</label>
              <select value={form.routingMode} onChange={e => set('routingMode', e.target.value)}>
                {ROUTING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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
        /* ── Single prompt mode ── */
        <form onSubmit={handleSubmit}>

          {/* Prompt card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <label style={{ marginBottom: 0 }}>Prompt *</label>
                {form.prompt.trim() && (
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                    ~{tokenEstimate.toLocaleString()} tokens in · {(form.maxTokens || 1024).toLocaleString()} max out
                  </span>
                )}
              </div>
              <textarea
                placeholder="What would you like Claude / GPT / Gemini to do?"
                value={form.prompt}
                onChange={e => set('prompt', e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Tag chip selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <TagChips selectedTags={selectedTags} onToggle={toggleTag} />
            </div>
          </div>

          {/* Optional fields card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Label <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional — shown in queue)</span></label>
              <input
                placeholder="e.g. Weekly summary task"
                value={form.label}
                onChange={e => set('label', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>System prompt <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                placeholder="You are a helpful assistant specialised in…"
                value={form.systemPrompt}
                onChange={e => set('systemPrompt', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Routing card */}
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

              {/* Derived task type read-out (informational only) */}
              <div className="form-group">
                <label>Task type <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(derived from tags)</span></label>
                <div style={{ padding: '6px 10px', background: 'var(--bg4)', borderRadius: 'var(--radius)', border: '1px solid var(--border-dim)', fontSize: 13, color: 'var(--text2)' }}>
                  {taskType}
                </div>
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

            {/* Route preview + provider cost comparison */}
            {routePreview && !routePreview.error && (
              <div style={{ marginTop: 14 }}>
                <div className={`route-preview ${routePreview.wait ? 'wait' : 'ok'}`}>
                  {routePreview.wait
                    ? `⏳ All providers at limit — will wait ~${Math.ceil((routePreview.waitMs || 0) / 1000)}s`
                    : `→ Routing to ${routePreview.provider}${routePreview.model ? ` / ${routePreview.model}` : ''} — ${routePreview.reason}`
                  }
                </div>

                {routePreview.candidates && routePreview.candidates.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Cost estimate · {routePreview.inputTokens?.toLocaleString() ?? '?'} tokens in / {routePreview.outputTokens?.toLocaleString() ?? '?'} max out
                    </div>
                    <table className="candidates-table">
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th>Best model</th>
                          <th>Est. cost</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routePreview.candidates.map(c => {
                          const meta      = providers.find(p => p.name === c.name);
                          const isWinner  = !routePreview.wait && c.name === routePreview.provider;
                          const wait      = fmtWait(c.waitMs);
                          return (
                            <tr key={c.name} className={isWinner ? 'winner-row' : ''}>
                              <td>
                                {isWinner && <span style={{ color: 'var(--success)', marginRight: 5 }}>→</span>}
                                {meta?.displayName || c.name}
                              </td>
                              <td style={{ color: 'var(--text2)' }}>{c.bestModelName || '—'}</td>
                              <td style={{ fontFamily: 'monospace' }}>
                                {c.estimatedCost === 0
                                  ? <span style={{ color: 'var(--success)' }}>Free</span>
                                  : fmtCost(c.estimatedCost)
                                }
                              </td>
                              <td>
                                {c.canSend
                                  ? <span style={{ color: 'var(--success)' }}>Ready</span>
                                  : <span style={{ color: 'var(--warning)' }}>⏳ {wait || 'limited'}</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Destination card */}
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
        /* ── Compare provider chips ──────────────────────────── */
        .compare-provider-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .compare-provider-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 13px;
          border-radius: 8px;
          border: 1px solid var(--border-dim);
          background: var(--bg3);
          color: var(--text2);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .compare-provider-chip:hover {
          border-color: var(--border);
          background: var(--bg4);
          color: var(--text1);
        }
        .compare-provider-chip.selected {
          background: color-mix(in srgb, var(--chip-accent) 12%, transparent);
          border-color: color-mix(in srgb, var(--chip-accent) 55%, transparent);
          color: var(--text1);
          font-weight: 500;
        }
        .cpc-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .cpc-check {
          font-size: 11px;
          color: var(--success);
          font-weight: 700;
        }
        /* ── Tag chip grid ───────────────────────────────────── */
        .tag-chip-grid { display: flex; flex-wrap: wrap; gap: 7px; }
        .tag-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 20px;
          border: 1px solid var(--border-dim); background: var(--bg3);
          color: var(--text2); font-size: 12px; cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap; font-family: inherit;
        }
        .tag-chip:hover { border-color: var(--border); color: var(--text1); background: var(--bg4); }
        .tag-chip.active {
          background: color-mix(in srgb, var(--chip-color) 14%, transparent);
          border-color: color-mix(in srgb, var(--chip-color) 55%, transparent);
          color: var(--chip-color);
        }
        .tag-chip.urgent.active {
          background: rgba(249,115,22,0.12); border-color: rgba(249,115,22,0.55);
          color: #f97316; font-weight: 600;
        }
        .chip-emoji { font-size: 13px; line-height: 1; }
        .chip-label { font-weight: 500; }

        /* ── Route preview ───────────────────────────────────── */
        .route-preview { padding: 8px 12px; border-radius: 6px; font-size: 12px; }
        .route-preview.ok   { background: rgba(52,211,153,0.08); color: var(--success); border: 1px solid rgba(52,211,153,0.2); }
        .route-preview.wait { background: rgba(251,191,36,0.08);  color: var(--warning); border: 1px solid rgba(251,191,36,0.2); }

        /* ── Provider comparison table ───────────────────────── */
        .candidates-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        .candidates-table th {
          text-align: left; padding: 4px 8px; color: var(--text3);
          font-weight: 600; border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .candidates-table td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); white-space: nowrap; }
        .candidates-table tr:last-child td { border-bottom: none; }
        .candidates-table .winner-row td   { background: rgba(52,211,153,0.06); }
        .candidates-table .winner-row td:first-child { border-left: 2px solid var(--success); }
      `}</style>
    </div>
  );
}
