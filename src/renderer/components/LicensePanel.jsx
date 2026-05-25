import { useState, useEffect, Fragment } from 'react';

// ─── Plan metadata ─────────────────────────────────────────────────────────────

const PLAN_META = {
  free:     { label: 'Free',     color: 'var(--text3)',   glow: 'none' },
  starter:  { label: 'Starter',  color: '#a78bfa',        glow: '0 0 12px rgba(167,139,250,0.4)' },
  pro:      { label: 'Pro',      color: 'var(--accent)',  glow: '0 0 12px var(--accent)' },
  pro_plus: { label: 'Pro+',     color: '#f59e0b',        glow: '0 0 12px rgba(245,158,11,0.4)' },
  team:     { label: 'Team',     color: '#22d3ee',        glow: '0 0 12px rgba(34,211,238,0.4)' },
};

// Feature rows for the comparison table
// Each entry: { label, free, starter, pro, pro_plus, team }
// Values can be strings, '✓', or '–'
const FEATURE_ROWS = [
  {
    category: 'AI Providers',
    rows: [
      { label: 'AI providers (total)',           free: '5 (local only)', starter: '8',          pro: 'All 12',         pro_plus: 'All 12',        team: 'All 12'             },
      { label: 'Local AI (Ollama, LM Studio, Jan.ai, LocalAI, llama.cpp)', free: '✓', starter: '✓', pro: '✓',         pro_plus: '✓',             team: '✓'                  },
      { label: 'Free cloud tier (Gemini, Groq, Mistral)', free: '–',     starter: '✓',          pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Paid cloud (Claude, OpenAI, DeepSeek, xAI Grok)', free: '–', starter: '–',      pro: '✓',              pro_plus: '✓',             team: '✓'                  },
    ],
  },
  {
    category: 'Usage Limits (AIQ-side caps)',
    rows: [
      { label: 'Monthly cloud prompt runs',      free: '50/mo',         starter: '500/mo',      pro: '2,500/mo',       pro_plus: '10,000/mo',     team: '25,000/mo (pooled)' },
      { label: 'Monthly cloud tokens',           free: '100K/mo',       starter: '1M/mo',       pro: '5M/mo',          pro_plus: '20M/mo',        team: '60M/mo (pooled)'    },
    ],
  },
  {
    category: 'Queue',
    rows: [
      { label: 'Max queue depth',                free: '10 items',      starter: '100 items',   pro: '500 (soft cap)', pro_plus: 'Unlimited',     team: '500 (soft cap)'     },
      { label: '⚡ Urgent priority boost',       free: '✓',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Tag-based smart priority',       free: '–',             starter: '–',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Batch CSV import',               free: '–',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
    ],
  },
  {
    category: 'Routing',
    rows: [
      { label: 'Manual routing',                 free: '✓',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Free Tier routing',              free: '✓',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Auto & Balance routing',         free: '–',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Cheapest & Fastest routing',     free: '–',             starter: '–',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Custom routing rules',           free: '–',             starter: '–',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
    ],
  },
  {
    category: 'Cost & Analytics',
    rows: [
      { label: 'Basic usage dashboard',          free: '✓',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Budget spend visibility',        free: 'View-only',     starter: 'View-only',   pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Cost tracking per provider',     free: '–',             starter: '✓',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Budget caps & alerts',           free: '–',             starter: '–',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Usage history export',           free: '–',             starter: 'CSV',         pro: 'CSV + JSON',     pro_plus: 'CSV + JSON',    team: 'CSV + JSON'         },
      { label: 'Cost forecasting',               free: '–',             starter: '–',           pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
    ],
  },
  {
    category: 'Productivity',
    rows: [
      { label: 'Projects',                       free: '1',             starter: '5',           pro: 'Unlimited',      pro_plus: 'Unlimited',     team: 'Unlimited'          },
      { label: 'Prompt template library',        free: '–',             starter: '✓ Roadmap',   pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
      { label: 'Compare mode (A/B)',             free: '–',             starter: '–',           pro: '✓',              pro_plus: '✓',             team: '✓'                  },
      { label: 'Consensus mode',                 free: '–',             starter: '–',           pro: '–',              pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
      { label: 'Prompt chaining',                free: '–',             starter: '–',           pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
      { label: 'Webhook output delivery',        free: '–',             starter: '–',           pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
    ],
  },
  {
    category: 'Team',
    rows: [
      { label: 'Shared settings & config',       free: '–',             starter: '–',           pro: '–',              pro_plus: '–',             team: '✓ Roadmap'          },
      { label: 'Admin controls & user mgmt',     free: '–',             starter: '–',           pro: '–',              pro_plus: '–',             team: '✓ Roadmap'          },
      { label: 'Team collaboration features',    free: '–',             starter: '–',           pro: '–',              pro_plus: '–',             team: '✓ Roadmap'          },
    ],
  },
  {
    category: 'Media Generation',
    rows: [
      { label: 'Image generation',               free: '–',             starter: '✓ Roadmap',   pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
      { label: 'Video generation',               free: '–',             starter: '–',           pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
    ],
  },
  {
    category: 'Support',
    rows: [
      { label: 'Priority email support',         free: '–',             starter: '–',           pro: '–',              pro_plus: '✓',             team: '✓'                  },
    ],
  },
  {
    category: 'Mobile',
    rows: [
      { label: 'iOS & Android companion',        free: '–',             starter: '✓ Roadmap',   pro: '✓ Roadmap',      pro_plus: '✓ Roadmap',     team: '✓ Roadmap'          },
    ],
  },
];

const PRICING = {
  free:     { monthly: '$0',            sub: 'No credit card needed'   },
  starter:  { monthly: '$9 / mo',       sub: 'Cancel any time'         },
  pro:      { monthly: '$19 / mo',      sub: 'Cancel any time'         },
  pro_plus: { monthly: '$34 / mo',      sub: 'Coming soon'             },
  team:     { monthly: '$49 / user/mo', sub: 'Coming soon'             },
};

// ─── LicensePanel ─────────────────────────────────────────────────────────────

export function LicensePanel({ showToast }) {
  const api = window.aiQueue;

  const [license,  setLicense]  = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy,     setBusy]     = useState(false);

  // Load license on mount
  useEffect(() => {
    api.getLicense().then(setLicense).catch(console.error);
  }, []);

  const plan = license?.plan ?? 'free';
  const meta = PLAN_META[plan] ?? PLAN_META.free;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleActivate() {
    if (!keyInput.trim()) return;
    setBusy(true);
    try {
      const result = await api.setLicenseKey(keyInput.trim());
      if (result.success) {
        setLicense(result.license);
        setKeyInput('');
        const newPlan = result.license?.plan ?? 'pro';
        const planLabel = PLAN_META[newPlan]?.label ?? 'Pro';
        showToast?.(`License activated — welcome to ${planLabel}!`, 'success');
      } else {
        showToast?.(`License error: ${result.error}`, 'error');
      }
    } catch (e) {
      showToast?.('Failed to activate license.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      const result = await api.removeLicenseKey();
      setLicense(result.license);
      showToast?.('License removed. Reverted to free plan.', 'info');
    } catch (e) {
      showToast?.('Failed to remove license.', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const planColClass = (tier) => {
    if (plan !== tier) return '';
    if (tier === 'starter') return 'plan-col-starter';
    if (tier === 'pro') return 'plan-col-pro';
    if (tier === 'pro_plus') return 'plan-col-pro-plus';
    if (tier === 'team') return 'plan-col-team';
    return 'plan-col-active';
  };

  return (
    <div>
      <div className="panel-header-row">
        <div>
          <div className="panel-title">License</div>
          <div className="panel-sub">Manage your AIQ Load Manager plan</div>
        </div>
        <div
          className="plan-badge"
          style={{ borderColor: meta.color, color: meta.color, boxShadow: meta.glow }}
        >
          {meta.label.toUpperCase()}
        </div>
      </div>

      <div className="plan-cards-row">
        {['free', 'starter', 'pro', 'pro_plus', 'team'].map(p => {
          const m = PLAN_META[p];
          const pr = PRICING[p];
          const isActive = plan === p;
          const isComingSoon = p === 'pro_plus' || p === 'team';
          return (
            <div
              key={p}
              className={`plan-card ${isActive ? 'active' : 'inactive'}`}
              style={{
                borderColor: isActive ? m.color : isComingSoon ? `${m.color}30` : undefined,
                boxShadow: isActive ? m.glow : undefined,
                opacity: isComingSoon ? 0.75 : 1,
              }}
            >
              <div className="plan-card-tier" style={{ color: m.color }}>{m.label.toUpperCase()}</div>
              <div className="plan-card-price">{pr.monthly}</div>
              <div className="plan-card-sub">{pr.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="glass-card card-spaced" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="license-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th className={`center ${planColClass('free')}`}>Free</th>
              <th className={`center ${planColClass('starter')}`}>Starter</th>
              <th className={`center ${planColClass('pro')}`}>Pro</th>
              <th className={`center ${planColClass('pro_plus')}`} style={{ color: '#f59e0b' }}>Pro+ <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>Soon</span></th>
              <th className={`center ${planColClass('team')}`} style={{ color: '#22d3ee' }}>Team <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>Soon</span></th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map(section => (
              <Fragment key={section.category}>
                <tr className="category-row">
                  <td colSpan={6}>{section.category}</td>
                </tr>
                {section.rows.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={cellClass(row.free, plan === 'free')}>{row.free}</td>
                    <td className={cellClass(row.starter, plan === 'starter')}>{row.starter}</td>
                    <td className={cellClass(row.pro, plan === 'pro')}>{row.pro}</td>
                    <td className={cellClass(row.pro_plus, plan === 'pro_plus')}>{row.pro_plus}</td>
                    <td className={cellClass(row.team, plan === 'team')}>{row.team}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {plan === 'free' ? (
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="feature-gate-body" style={{ marginBottom: 14 }}>
            Have a license key? Enter it below to unlock Starter or Pro features.
          </div>
          <div className="license-key-row">
            <input
              className="license-key-input"
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              disabled={busy}
            />
            <button className="primary" onClick={handleActivate} disabled={busy || !keyInput.trim()}>
              {busy ? 'Activating…' : 'Activate'}
            </button>
          </div>

          <div className="license-cta-row">
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="feature-gate-body" style={{ marginBottom: 6 }}>Don't have a key yet?</div>
              <div className="plan-card-sub">Store coming soon — subscriptions only, cancel any time</div>
            </div>
            <button className="primary btn-starter-gradient" onClick={() => api.openExternal('https://example.com/upgrade')}>
              ✦ Get Starter — $9/mo
            </button>
            <button className="primary btn-pro-gradient" onClick={() => api.openExternal('https://example.com/upgrade-pro')}>
              ✦ Get Pro — $19/mo
            </button>
            <button className="primary" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', opacity: 0.8 }} onClick={() => api.openExternal('https://example.com/upgrade-pro-plus')} title="Coming soon">
              ✦ Pro+ — $34/mo (Coming soon)
            </button>
            <button className="primary" style={{ background: 'linear-gradient(135deg,#22d3ee,#0891b2)', opacity: 0.8 }} onClick={() => api.openExternal('https://example.com/upgrade-team')} title="Coming soon">
              ✦ Team — $49/user/mo (Coming soon)
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="license-active-msg">✓ {PLAN_META[plan]?.label} license is active</div>
          <div className="license-key-mask">License key: ••••••••••••••••</div>
          <button className="secondary" onClick={handleRemove} disabled={busy} style={{ fontSize: 12 }}>
            {busy ? 'Removing…' : 'Remove license'}
          </button>
        </div>
      )}
    </div>
  );
}

function cellClass(value, isActivePlan) {
  const isDash = value === '–';
  const isRoadmap = typeof value === 'string' && value.includes('Roadmap');
  const parts = ['center'];
  if (isDash || isRoadmap) parts.push('dim');
  else if (isActivePlan) parts.push('active-col');
  return parts.join(' ');
}
