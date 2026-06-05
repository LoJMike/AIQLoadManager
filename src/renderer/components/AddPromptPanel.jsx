import { useState, useEffect, useRef, useMemo } from 'react';

// requiredPlan: null = available on all tiers; 'starter' = Starter+; 'pro' = Pro only
const ROUTING_MODES = [
  { value: 'auto',     label: 'Auto (scored best match)',  requiredPlan: 'starter' },
  { value: 'balance',  label: 'Balance (round-robin)',     requiredPlan: 'starter' },
  { value: 'cheapest', label: 'Cheapest provider',         requiredPlan: 'pro'     },
  { value: 'fastest',  label: 'Fastest (Groq first)',      requiredPlan: 'pro'     },
  { value: 'freeTier', label: 'Free tier only',            requiredPlan: null      },
  { value: 'manual',   label: 'Manual (pick provider)',    requiredPlan: null      },
];

const TIER_LABEL = { starter: 'Starter', pro: 'Pro' };

// ── RoutingModeSelector ────────────────────────────────────────────────────────
// Custom dropdown that shows all 6 modes. Locked modes are dimmed, unclickable,
// and display a tooltip naming the tier that unlocks them.
function RoutingModeSelector({ value, onChange, availableModes }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = ROUTING_MODES.find(m => m.value === value) ?? ROUTING_MODES[5]; // default: manual

  return (
    <div ref={ref} className="routing-select-wrap">
      <button
        type="button"
        className="routing-select-trigger"
        onClick={() => setOpen(o => !o)}
      >
        {current.label}
        <span className="routing-select-caret">▾</span>
      </button>

      {open && (
        <div className="routing-select-menu">
          {ROUTING_MODES.map(m => {
            const locked = !availableModes.includes(m.value);
            const tierName = locked ? (TIER_LABEL[m.requiredPlan] ?? '') : null;
            const isSelected = m.value === value;
            const tierClass = tierName === 'Pro' ? 'pro' : 'starter';
            return (
              <div
                key={m.value}
                className={`routing-select-option ${locked ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
                title={locked ? `Requires ${tierName} — upgrade to unlock` : undefined}
                onClick={() => { if (!locked) { onChange(m.value); setOpen(false); } }}
              >
                <span>{m.label}</span>
                {locked && (
                  <span className={`tier-lock-badge ${tierClass}`}>🔒 {tierName}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      <label>Prompt type <span className="label-hint">(optional — helps routing &amp; prioritisation)</span></label>
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

  // ── Pre-flight model validation state ──────────────────────────────────
  // 'idle' | 'checking' | 'ready' | 'unreachable' | 'empty'
  const [modelCheck,       setModelCheck]   = useState('idle');
  const [liveModels,       setLiveModels]   = useState(null); // null = not yet checked

  // Feature flags — default true while the app is in skeleton/preview mode
  const canCompare      = license?.flags?.compareMode  ?? true;
  const canBatch        = license?.flags?.batchImport  ?? true;
  const availableModes  = license?.flags?.routingModes ?? ROUTING_MODES.map(m => m.value);

  // Local providers — these need live model validation
  const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'jan', 'localai', 'llamacpp']);

  // If the currently selected routing mode is not available on this tier, reset to 'manual'
  useEffect(() => {
    if (availableModes.length && !availableModes.includes(form.routingMode)) {
      set('routingMode', 'manual');
    }
  }, [availableModes]);

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

  // Pre-flight: when Manual mode + local provider is selected, ping the server
  // and get the real installed model list.
  useEffect(() => {
    if (form.routingMode !== 'manual' || !form.provider || !LOCAL_PROVIDERS.has(form.provider)) {
      setModelCheck('idle');
      setLiveModels(null);
      return;
    }

    let cancelled = false;
    setModelCheck('checking');
    setLiveModels(null);

    api.refreshLocalModels(form.provider)
      .then(result => {
        if (cancelled) return;
        if (!result.reachable) {
          setModelCheck('unreachable');
        } else if (!result.models || result.models.length === 0) {
          setModelCheck('empty');
        } else {
          setModelCheck('ready');
          setLiveModels(result.models);
          // Reset model selection if the previously chosen model no longer exists
          // in the live list (e.g. the user switched Ollama profiles).
          if (form.model && !result.models.find(m => m.id === form.model)) {
            set('model', '');
          }
        }
      })
      .catch(() => {
        if (!cancelled) setModelCheck('unreachable');
      });

    return () => { cancelled = true; };
  }, [form.provider, form.routingMode]);

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

  // Use live-discovered models for local providers when available;
  // fall back to the provider's static model list for cloud providers.
  const availableModels = useMemo(() => {
    if (!form.provider) return [];
    if (liveModels) return liveModels;
    return providers.find(p => p.name === form.provider)?.models || [];
  }, [form.provider, liveModels, providers]);

  // The model that will actually be used: explicit selection or first in list
  const resolvedModel = form.model || availableModels[0]?.id || null;

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

      <div className="mode-toggle">
        <button className={!bulk && !compareMode ? 'primary' : 'secondary'} onClick={() => setMode('single')}>Single prompt</button>
        <button className={compareMode ? 'primary' : 'secondary'} onClick={() => setMode('compare')} title="Pro — send same prompt to multiple providers, see responses side by side">
          ⚖ Compare <span className="tier-badge">Pro</span>
        </button>
        <button className={bulk ? 'primary' : 'secondary'} onClick={() => setMode('bulk')}>Bulk (one per line)</button>
      </div>

      {compareMode ? (
        /* ── Compare mode ── */
        <form onSubmit={handleSubmit}>
          <div className="card card-spaced">
            <div className="form-group">
              <div className="label-row">
                <label>Prompt *</label>
                {form.prompt.trim() && (
                  <span className="token-hint">
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
          <div className="card card-spaced">
            <div className="compare-provider-header">
              <div className="card-section-title" style={{ marginBottom: 0 }}>Providers to compare</div>
              {compareSel.length > 0 && (
                <span className="compare-sel-count">{compareSel.length} selected</span>
              )}
            </div>

            {!canCompare ? (
              <div className="feature-gate feature-gate-pro">
                <div className="feature-gate-title">⚖ Compare mode is a Pro feature</div>
                <div className="feature-gate-body">
                  Upgrade to Pro to send the same prompt to multiple providers simultaneously and view responses side by side.
                </div>
                <button type="button" className="primary"
                  onClick={() => window.aiQueue.openExternal('https://example.com/upgrade')}>
                  Upgrade to Pro →
                </button>
              </div>
            ) : configuredProviders.length < 2 ? (
              <div className="empty-state" style={{ padding: '10px 0' }}>
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
                  <div className="compare-hint">Select at least 2 providers to compare.</div>
                )}
              </>
            )}
          </div>

          {/* Options card */}
          <div className="card card-spaced">
            <div className="card-section-title">Options</div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Label <span className="label-hint">(optional)</span></label>
                <input placeholder="e.g. Compare coding task" value={form.label} onChange={e => set('label', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Max tokens per provider</label>
                <input type="number" min={64} max={32000} value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>System prompt <span className="label-hint">(optional — same for all providers)</span></label>
              <textarea placeholder="You are a helpful assistant…" value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={2} />
            </div>
          </div>

          <button type="submit" className="primary"
            disabled={submitting || !form.prompt.trim() || !canCompare || compareSel.length < 2}>
            {submitting ? 'Queuing compare…' : `⚖ Compare across ${compareSel.length || '?'} providers`}
          </button>
          <div className="compare-footer">
            Responses run in parallel. Results appear in the Queue tab when all providers reply.
          </div>
        </form>

      ) : bulk ? (
        /* ── Bulk mode ── */
        <div className="card">
          {!canBatch ? (
            /* Starter gate */
            <div className="feature-gate feature-gate-starter">
              <div className="feature-gate-title">⊞ Batch import is a Starter feature</div>
              <div className="feature-gate-body">
                Upgrade to Starter to queue multiple prompts at once — paste one per line and send them all in a single click.
              </div>
              <button type="button" className="primary btn-starter-gradient"
                onClick={() => window.aiQueue.openExternal('https://example.com/upgrade')}>
                Upgrade to Starter →
              </button>
            </div>
          ) : (
            <>
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
                  <RoutingModeSelector
                    value={form.routingMode}
                    onChange={v => set('routingMode', v)}
                    availableModes={availableModes}
                  />
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
            </>
          )}
        </div>

      ) : (
        /* ── Single prompt mode ── */
        <form onSubmit={handleSubmit}>

          <div className="card card-spaced">
            <div className="form-group">
              <div className="label-row">
                <label>Prompt *</label>
                {form.prompt.trim() && (
                  <span className="token-hint">
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

          <div className="card card-spaced">
            <div className="form-group">
              <label>Label <span className="label-hint">(optional — shown in queue)</span></label>
              <input
                placeholder="e.g. Weekly summary task"
                value={form.label}
                onChange={e => set('label', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>System prompt <span className="label-hint">(optional)</span></label>
              <textarea
                placeholder="You are a helpful assistant specialised in…"
                value={form.systemPrompt}
                onChange={e => set('systemPrompt', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="card card-spaced">
            <div className="card-section-title">Routing</div>
            <div className="form-row form-row-2" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label>Routing mode</label>
                <RoutingModeSelector
                  value={form.routingMode}
                  onChange={v => set('routingMode', v)}
                  availableModes={availableModes}
                />
              </div>

              {/* Derived task type read-out (informational only) */}
              <div className="form-group">
                <label>Task type <span className="label-hint">(derived from tags)</span></label>
                <div className="readonly-field">{taskType}</div>
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
                    <label>
                      Model
                      {modelCheck === 'checking' && (
                        <span className="label-hint"> — checking…</span>
                      )}
                      {modelCheck === 'ready' && liveModels && (
                        <span className="label-hint" style={{ color: 'var(--success)' }}> — {liveModels.length} installed</span>
                      )}
                    </label>
                    <select value={form.model} onChange={e => set('model', e.target.value)} disabled={!form.provider || modelCheck === 'unreachable'}>
                      <option value="">
                        {resolvedModel && form.model === '' ? `— default (${resolvedModel}) —` : '— default —'}
                      </option>
                      {availableModels.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                    </select>
                  </div>

                  {/* ── Pre-flight validation banner ── */}
                  {form.provider && LOCAL_PROVIDERS.has(form.provider) && modelCheck !== 'idle' && (
                    <div className={`preflight-banner preflight-${modelCheck}`} style={{ gridColumn: '1 / -1' }}>
                      {modelCheck === 'checking' && (
                        <>⏳ Checking {providers.find(p => p.name === form.provider)?.displayName ?? form.provider}…</>
                      )}
                      {modelCheck === 'unreachable' && (
                        <>
                          🔴 <strong>{providers.find(p => p.name === form.provider)?.displayName ?? form.provider} is not running.</strong>
                          {' '}Start the server before queuing, or the item will error immediately.
                        </>
                      )}
                      {modelCheck === 'empty' && (
                        <>
                          ⚠️ <strong>No models found.</strong>
                          {' '}The server is running but has no models loaded. Pull one first:
                          {form.provider === 'ollama' && (
                            <code style={{ display: 'block', marginTop: 4, fontSize: 11 }}>ollama pull llama3.2</code>
                          )}
                        </>
                      )}
                      {modelCheck === 'ready' && (
                        <>
                          ✅ <strong>
                            {form.model
                              ? `${availableModels.find(m => m.id === form.model)?.name ?? form.model} — verified`
                              : `Default: ${resolvedModel ?? '—'}`}
                          </strong>
                          {' '}— found in your local server.
                        </>
                      )}
                    </div>
                  )}
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

          <div className="card card-spaced">
            <div className="card-section-title">Destination</div>
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
    </div>
  );
}
