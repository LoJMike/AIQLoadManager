import { useState, useEffect } from 'react';

// ─── Plan metadata ─────────────────────────────────────────────────────────────

const PLAN_META = {
  free: { label: 'Free',  color: 'var(--text3)',  glow: 'none' },
  pro:  { label: 'Pro',   color: 'var(--accent)',  glow: '0 0 12px var(--accent)' },
};

const FEATURE_ROWS = [
  { key: 'allProviders',       free: '2 providers',     pro: 'All 7 providers'   },
  { key: 'unlimitedQueue',     free: 'Up to 10 items',  pro: 'Unlimited queue'   },
  { key: 'advancedRouting',    free: 'Manual only',     pro: 'Auto / balance / cheapest / fastest' },
  { key: 'fullUsageDashboard', free: 'Basic stats',     pro: 'Full cost history' },
  { key: 'multipleProjects',   free: '1 project',       pro: 'Unlimited projects' },
];

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
        showToast?.('License activated — welcome to Pro!', 'success');
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="panel-title">License</div>
          <div className="panel-sub">Manage your AIQ Load Manager plan</div>
        </div>

        {/* Plan badge */}
        <div style={{
          padding: '6px 18px',
          borderRadius: 20,
          border: `1px solid ${meta.color}`,
          color: meta.color,
          boxShadow: meta.glow,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.08em',
          fontFamily: 'var(--font-mono)',
        }}>
          {meta.label.toUpperCase()}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="glass-card" style={{ marginBottom: 24, padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle('left')}>Feature</th>
              <th style={thStyle('center')}>Free</th>
              <th style={{ ...thStyle('center'), color: 'var(--accent)' }}>Pro</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map(row => (
              <tr key={row.key}>
                <td style={tdStyle('left', true)}>{getLabelFor(row.key)}</td>
                <td style={tdStyle('center', true, plan === 'free')}>{row.free}</td>
                <td style={{ ...tdStyle('center', true, plan === 'pro'), color: 'var(--accent)' }}>{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* License key section */}
      {plan === 'free' ? (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
            Have a license key? Enter it below to unlock Pro features.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="key-input"
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              disabled={busy}
              style={{
                flex: 1,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text1)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                padding: '8px 12px',
                outline: 'none',
              }}
            />
            <button
              className="primary"
              onClick={handleActivate}
              disabled={busy || !keyInput.trim()}
            >
              {busy ? 'Activating…' : 'Activate'}
            </button>
          </div>

          {/* Upgrade CTA */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
              Don't have a key yet?
            </div>
            <button
              className="primary"
              style={{ background: 'linear-gradient(90deg, var(--accent), var(--success))', border: 'none' }}
              onClick={() => api.openExternal('https://example.com/upgrade')}
            >
              ✦ Upgrade to Pro
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              Store coming soon — pricing TBD
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 14 }}>
            ✓ Pro license is active
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            License key: ••••••••••••••••
          </div>
          <button
            className="secondary"
            onClick={handleRemove}
            disabled={busy}
            style={{ fontSize: 12 }}
          >
            {busy ? 'Removing…' : 'Remove license'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabelFor(key) {
  const labels = {
    allProviders:       'AI providers',
    unlimitedQueue:     'Queue size',
    advancedRouting:    'Routing modes',
    fullUsageDashboard: 'Usage dashboard',
    multipleProjects:   'Projects',
  };
  return labels[key] ?? key;
}

function thStyle(align) {
  return {
    textAlign: align,
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text3)',
    borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase',
  };
}

function tdStyle(align, stripe, active) {
  return {
    textAlign: align,
    padding: '10px 16px',
    fontSize: 13,
    color: active ? 'var(--text1)' : 'var(--text3)',
    fontWeight: active ? 500 : 400,
    borderBottom: '1px solid var(--border)',
  };
}
