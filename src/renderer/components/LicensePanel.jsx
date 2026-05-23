import { useState, useEffect, Fragment } from 'react';

// ─── Plan metadata ─────────────────────────────────────────────────────────────

const PLAN_META = {
  free:    { label: 'Free',    color: 'var(--text3)',   glow: 'none' },
  starter: { label: 'Starter', color: '#a78bfa',        glow: '0 0 12px rgba(167,139,250,0.4)' },
  pro:     { label: 'Pro',     color: 'var(--accent)',  glow: '0 0 12px var(--accent)' },
};

// Feature rows for the comparison table
// Each entry: { label, free, starter, pro }
// Values can be strings, '✓', or '–'
const FEATURE_ROWS = [
  {
    category: 'AI Providers',
    rows: [
      { label: 'AI providers (total)',      free: '2',         starter: '4',          pro: 'All 9'           },
    ],
  },
  {
    category: 'Queue',
    rows: [
      { label: 'Max queue depth',          free: '10 items',  starter: '100 items',  pro: 'Unlimited'       },
      { label: '⚡ Urgent priority boost', free: '✓',         starter: '✓',          pro: '✓'               },
      { label: 'Tag-based smart priority', free: '–',         starter: '–',          pro: '✓'               },
      { label: 'Batch CSV import',         free: '–',         starter: '✓',          pro: '✓'               },
    ],
  },
  {
    category: 'Routing',
    rows: [
      { label: 'Manual routing',           free: '✓',         starter: '✓',          pro: '✓'               },
      { label: 'Free Tier routing',        free: '✓',         starter: '✓',          pro: '✓'               },
      { label: 'Auto & Balance routing',   free: '–',         starter: '✓',          pro: '✓'               },
      { label: 'Cheapest & Fastest routing', free: '–',       starter: '–',          pro: '✓'               },
      { label: 'Custom routing rules',     free: '–',         starter: '–',          pro: '✓'               },
    ],
  },
  {
    category: 'Cost & Analytics',
    rows: [
      { label: 'Basic usage dashboard',    free: '✓',         starter: '✓',          pro: '✓'               },
      { label: 'Cost tracking per provider', free: '–',       starter: '✓',          pro: '✓'               },
      { label: 'Budget caps & alerts',     free: '–',         starter: '–',          pro: '✓'               },
      { label: 'Usage history export',     free: '–',         starter: 'CSV',        pro: 'CSV + JSON'      },
      { label: 'Cost forecasting',         free: '–',         starter: '–',          pro: '✓ Roadmap'       },
    ],
  },
  {
    category: 'Productivity',
    rows: [
      { label: 'Projects',                 free: '1',         starter: '5',          pro: 'Unlimited'       },
      { label: 'Prompt template library',  free: '–',         starter: '✓ Roadmap',  pro: '✓ Roadmap'       },
      { label: 'Compare mode (A/B)',       free: '–',         starter: '–',          pro: '✓'               },
      { label: 'Prompt chaining',          free: '–',         starter: '–',          pro: '✓ Roadmap'       },
      { label: 'Webhook output delivery',  free: '–',         starter: '–',          pro: '✓ Roadmap'       },
    ],
  },
  {
    category: 'Media Generation',
    rows: [
      { label: 'Image generation',         free: '–',         starter: '✓ Roadmap',  pro: '✓ Roadmap'       },
      { label: 'Video generation',         free: '–',         starter: '–',          pro: '✓ Roadmap'       },
    ],
  },
  {
    category: 'Mobile',
    rows: [
      { label: 'iOS & Android companion',  free: '–',         starter: '✓ Roadmap',  pro: '✓ Roadmap'       },
    ],
  },
];

const PRICING = {
  free:    { monthly: '$0',  lifetime: 'Free forever'     },
  starter: { monthly: '$6 / mo',  lifetime: '$39 one-time — save 46%' },
  pro:     { monthly: '$14 / mo', lifetime: '$79 one-time — save 53%' },
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
        {['free', 'starter', 'pro'].map(p => {
          const m = PLAN_META[p];
          const pr = PRICING[p];
          const isActive = plan === p;
          return (
            <div
              key={p}
              className={`plan-card ${isActive ? 'active' : 'inactive'}`}
              style={{
                borderColor: isActive ? m.color : undefined,
                boxShadow: isActive ? m.glow : undefined,
              }}
            >
              <div className="plan-card-tier" style={{ color: m.color }}>{m.label.toUpperCase()}</div>
              <div className="plan-card-price">{pr.monthly}</div>
              <div className="plan-card-sub">{pr.lifetime}</div>
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
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map(section => (
              <Fragment key={section.category}>
                <tr className="category-row">
                  <td colSpan={4}>{section.category}</td>
                </tr>
                {section.rows.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={cellClass(row.free, plan === 'free')}>{row.free}</td>
                    <td className={cellClass(row.starter, plan === 'starter')}>{row.starter}</td>
                    <td className={cellClass(row.pro, plan === 'pro')}>{row.pro}</td>
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
              <div className="plan-card-sub">Store coming soon — pricing TBD</div>
            </div>
            <button className="primary btn-starter-gradient" onClick={() => api.openExternal('https://example.com/upgrade')}>
              ✦ Get Starter — $6/mo
            </button>
            <button className="primary btn-pro-gradient" onClick={() => api.openExternal('https://example.com/upgrade-pro')}>
              ✦ Get Pro — $14/mo
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
