import { useState } from 'react';

const PROVIDER_COLORS = {
  anthropic: '#d97757', openai: '#10a37f', gemini: '#4285f4',
  groq: '#f55036', deepseek: '#4d6bfe', mistral: '#ff7000', grok: '#1da1f2',
};

/** Meter fill color per DESIGN.md threshold spectrum */
function meterColor(pct) {
  if (pct >= 90) return 'var(--meter-crit)';
  if (pct >= 80) return 'var(--meter-warn)';
  if (pct >= 60) return 'var(--meter-caution)';
  return 'var(--meter-ok)';
}

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

  const barColor = meterColor(rpmPct);
  const budgetBarColor = meterColor(budgetPct || 0);

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
              <div className="metric-value" style={{ fontSize: 18 }}>{rpmUsed}<span className="metric-inline-denom">/{rpmLimit || '∞'}</span></div>
            </div>
            <div>
              <div className="metric-label">Req / day</div>
              <div className="metric-value" style={{ fontSize: 18 }}>{rpdUsed}<span className="metric-inline-denom">/{rpdLimit || '∞'}</span></div>
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
            <div className="meter-row-label">
              <span>RPM usage</span><span>{rpmPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${rpmPct}%`, background: barColor }} />
            </div>
          </div>

          {budget > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="meter-row-label">
                <span>Budget</span><span>${costMonth.toFixed(2)} / ${budget}/mo</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${budgetPct || 0}%`, background: budgetBarColor }} />
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

export default function UsageDashboard({ providers, usageAll, queue = [] }) {
  const configured = providers.filter(p => p.configured).length;
  const totalCost  = Object.values(usageAll).reduce((s, u) => s + (u?.cost?.lastMonth || 0), 0);
  const totalReqs  = Object.values(usageAll).reduce((s, u) => s + (u?.requests?.lastDay || 0), 0);
  const anyLimited = providers.some(p => usageAll[p.name]?.canSend === false);

  const upNext = queue
    .filter(i => i.status === 'pending' || i.status === 'processing')
    .slice(0, 3);

  return (
    <div>
      <div className="panel-title">Usage Dashboard</div>
      <div className="panel-sub">Real-time token usage and rate limit tracking across all AI providers</div>

      {/* Summary row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="metric-label">Providers active</div>
          <div className="metric-value">{configured}<span className="metric-inline-denom">/{providers.length}</span></div>
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

      {upNext.length > 0 && (
        <>
          <h3 className="section-heading">Up next in queue</h3>
          <div className="events-row">
            {upNext.map(item => (
              <div
                key={item.id}
                className={'event-card' + (item.status === 'processing' ? ' highlight' : '')}
              >
                <h5>{item.label || (item.prompt || '').slice(0, 40) || 'Prompt'}</h5>
                <p>
                  {item.compare_providers ? 'Compare mode' : (item.routing_mode || 'auto')}
                  {item.used_provider && item.used_provider !== 'compare' ? ' · ' + item.used_provider : ''}
                </p>
                <div className="event-meta">
                  {item.status}
                  {item.scheduled_for ? ' · ' + new Date(item.scheduled_for).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
