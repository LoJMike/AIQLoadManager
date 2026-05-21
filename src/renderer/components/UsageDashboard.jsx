import { useState } from 'react';

const PROVIDER_COLORS = {
  anthropic: '#d97757', openai: '#10a37f', gemini: '#4285f4',
  groq: '#f55036', deepseek: '#4d6bfe', mistral: '#ff7000', grok: '#1da1f2',
};

function ProviderCard({ provider, usage }) {
  const color  = PROVIDER_COLORS[provider.name] || '#888';
  const status = usage || {};

  const rpmUsed    = status.requests?.lastMin  || 0;
  const rpmLimit   = status.limits?.rpm        || 0;
  const rpmPct     = rpmLimit > 0 ? Math.min(100, Math.round((rpmUsed / rpmLimit) * 100)) : 0;
  const rpdUsed    = status.requests?.lastDay  || 0;
  const rpdLimit   = status.limits?.rpd        || null;
  const costMonth  = status.cost?.lastMonth    || 0;
  const budget     = status.cost?.budget       || 0;
  const budgetPct  = status.cost?.budgetPct;
  const canSend    = status.canSend ?? true;
  const totalTok   = status.tokens?.totalAll   || 0;

  const barColor = rpmPct > 85 ? '#f87171' : rpmPct > 60 ? '#fbbf24' : color;

  return (
    <div className="card provider-card" style={{ borderColor: provider.configured ? `${color}30` : undefined }}>
      <div className="pc-header">
        <div className="pc-dot" style={{ background: provider.configured ? color : '#3a3a3d' }} />
        <span className="pc-name">{provider.displayName}</span>
        <span className={`tag ${!provider.configured ? 'tag-muted' : canSend ? 'tag-success' : 'tag-warning'}`}>
          {!provider.configured ? 'no key' : canSend ? 'ready' : 'limited'}
        </span>
      </div>

      {provider.configured ? (
        <>
          <div className="pc-stats">
            <div>
              <div className="metric-label">Req / min</div>
              <div className="metric-value" style={{ fontSize: 18 }}>{rpmUsed}<span style={{ fontSize: 12, color: 'var(--text3)' }}>/{rpmLimit || '∞'}</span></div>
            </div>
            <div>
              <div className="metric-label">Req / day</div>
              <div className="metric-value" style={{ fontSize: 18 }}>{rpdUsed}<span style={{ fontSize: 12, color: 'var(--text3)' }}>/{rpdLimit || '∞'}</span></div>
            </div>
            <div>
              <div className="metric-label">Tokens (30d)</div>
              <div className="metric-value" style={{ fontSize: 18 }}>{formatTokens(totalTok)}</div>
            </div>
            <div>
              <div className="metric-label">Cost (30d)</div>
              <div className="metric-value" style={{ fontSize: 18 }}>${costMonth.toFixed(4)}</div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              <span>RPM usage</span><span>{rpmPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${rpmPct}%`, background: barColor }} />
            </div>
          </div>

          {budget > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                <span>Budget</span><span>${costMonth.toFixed(2)} / ${budget}/mo</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${budgetPct || 0}%`, background: budgetPct > 80 ? '#f87171' : '#fbbf24' }} />
              </div>
            </div>
          )}

          {!canSend && status.nextSlotMs > 0 && (
            <div className="pc-wait">
              ⏳ Next slot in {Math.ceil(status.nextSlotMs / 1000)}s
            </div>
          )}
        </>
      ) : (
        <div className="pc-unconfigured">
          No API key — go to Settings to add one.
        </div>
      )}
    </div>
  );
}

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsageDashboard({ providers, usageAll }) {
  const configured = providers.filter(p => p.configured).length;
  const totalCost  = Object.values(usageAll).reduce((s, u) => s + (u?.cost?.lastMonth || 0), 0);
  const totalReqs  = Object.values(usageAll).reduce((s, u) => s + (u?.requests?.lastDay || 0), 0);
  const anyLimited = providers.some(p => usageAll[p.name]?.canSend === false);

  return (
    <div>
      <div className="panel-title">Usage Dashboard</div>
      <div className="panel-sub">Real-time token usage and rate limit tracking across all AI providers</div>

      {/* Summary row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="metric-label">Providers active</div>
          <div className="metric-value">{configured}<span style={{ fontSize: 13, color: 'var(--text3)' }}>/{providers.length}</span></div>
        </div>
        <div className="card">
          <div className="metric-label">Requests today</div>
          <div className="metric-value">{totalReqs.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="metric-label">Spend this month</div>
          <div className="metric-value">${totalCost.toFixed(4)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Status</div>
          <div className="metric-value" style={{ fontSize: 16 }}>
            <span className={`tag ${anyLimited ? 'tag-warning' : 'tag-success'}`}>
              {anyLimited ? 'some limited' : 'all clear'}
            </span>
          </div>
        </div>
      </div>

      {/* Per-provider cards */}
      <div className="grid-2">
        {providers.map(p => (
          <ProviderCard key={p.name} provider={p} usage={usageAll[p.name]} />
        ))}
      </div>

      <style>{`
        .provider-card { display: flex; flex-direction: column; gap: 14px; }
        .pc-header { display: flex; align-items: center; gap: 8px; }
        .pc-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .pc-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text1); }
        .pc-stats { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
        .pc-wait { font-size: 11px; color: var(--warning); background: rgba(251,191,36,0.08); padding: 6px 10px; border-radius: 6px; }
        .pc-unconfigured { font-size: 12px; color: var(--text3); font-style: italic; padding: 8px 0; }
      `}</style>
    </div>
  );
}
