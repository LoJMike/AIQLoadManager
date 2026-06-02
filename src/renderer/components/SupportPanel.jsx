// ─── SupportPanel ─────────────────────────────────────────────────────────────

export function SupportPanel({ appVersion }) {
  const api = window.aiQueue;

  const os  = navigator.platform.includes('Win') ? 'Windows'
             : navigator.platform.includes('Mac') ? 'macOS'
             : navigator.platform;
  const ver = appVersion || 'unknown';

  function openExternal(url) {
    api.openExternal(url);
  }

  async function openBugReport() {
    // Gather live diagnostics — configured providers, plan, recent errors.
    // Fails silently so a broken API call never blocks the bug report.
    let diagSection = `**Version:** ${ver}\n**OS:** ${os}`;
    try {
      const [providers, queue, lic] = await Promise.all([
        api.getProviders(),
        api.getQueue(),
        api.getLicense(),
      ]);
      const configured = providers
        .filter(p => p.configured)
        .map(p => p.displayName || p.name)
        .join(', ') || 'None';
      const plan       = lic?.plan || 'free';
      const errorItems = queue.filter(i => i.status === 'error');
      const recentErrs = errorItems.slice(0, 3)
        .map(i => `  - [${i.used_provider || '?'}] ${(i.error || 'unknown error').slice(0, 120)}`)
        .join('\n');
      diagSection = [
        `**Version:** ${ver}`,
        `**OS:** ${os}`,
        `**Plan:** ${plan}`,
        `**Configured providers:** ${configured}`,
        `**Queue errors (recent):** ${errorItems.length}`,
        recentErrs ? `\`\`\`\n${recentErrs}\n\`\`\`` : '',
      ].filter(Boolean).join('\n');
    } catch (_) { /* keep basic diagSection */ }

    const title = encodeURIComponent('Bug: ');
    const body  = encodeURIComponent(
      `${diagSection}\n\n**What happened:**\n\n\n**Steps to reproduce:**\n\n1. \n2. \n\n**Expected behaviour:**\n\n`
    );
    api.openExternal(
      `https://github.com/LoJMike/AIQLoadManager/issues/new?title=${title}&body=${body}&labels=bug`
    );
  }

  return (
    <div>
      <div className="panel-header-row">
        <div>
          <div className="panel-title">Support</div>
          <div className="panel-sub">Get help, report issues, and stay up to date</div>
        </div>
      </div>

      {/* ── Homepage & Docs ─────────────────────────────────────────────────── */}
      <div className="glass-card card-spaced" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
          <span style={{ color: 'var(--text1)', fontWeight: 600, fontSize: '0.95rem' }}>Product homepage</span>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: '0.87rem', lineHeight: 1.6, marginBottom: 16 }}>
          Visit the AI Queue Load Manager homepage for news, release notes, pricing, and getting-started guides.
        </p>
        <button
          className="primary"
          onClick={() => openExternal('https://www.conxion.biz/aiqloadmanager/')}
        >
          Open Homepage ↗
        </button>
      </div>

      {/* ── Documentation ───────────────────────────────────────────────────── */}
      <div className="glass-card card-spaced" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 4h16v16H4z" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
          <span style={{ color: 'var(--text1)', fontWeight: 600, fontSize: '0.95rem' }}>How AIQ Load Manager works</span>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: '0.87rem', lineHeight: 1.6 }}>
          AIQ Load Manager queues your prompts across multiple AI providers — Claude, OpenAI, Gemini, Groq,
          DeepSeek, Mistral, and xAI Grok — and routes them automatically based on your chosen strategy
          (Auto, Balance, Cheapest, Fastest, Free Tier, or Manual). Token usage and rate limits are tracked
          in real time so your requests never hit provider caps unexpectedly.
        </p>
        <ul style={{ color: 'var(--text2)', fontSize: '0.87rem', lineHeight: 1.8, marginTop: 12, paddingLeft: 18 }}>
          <li><strong style={{ color: 'var(--text1)' }}>Usage tab</strong> — live token and rate-limit meters per provider</li>
          <li><strong style={{ color: 'var(--text1)' }}>Queue tab</strong> — view, reorder, pause, retry, and export queued items</li>
          <li><strong style={{ color: 'var(--text1)' }}>Add tab</strong> — compose and submit new prompts</li>
          <li><strong style={{ color: 'var(--text1)' }}>Projects tab</strong> — organise prompts into named projects with their own history</li>
          <li><strong style={{ color: 'var(--text1)' }}>Settings tab</strong> — enter API keys, configure routing, set standing instructions</li>
          <li><strong style={{ color: 'var(--text1)' }}>License tab</strong> — view your plan and activate a license key</li>
        </ul>
      </div>

      {/* ── Report a Bug ────────────────────────────────────────────────────── */}
      <div className="glass-card card-spaced" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <ellipse cx="12" cy="14" rx="5" ry="6" />
            <circle cx="12" cy="6" r="3" />
            <path d="M9 4L7 2M15 4L17 2" />
            <path d="M7 10H3M7 14.5H3M7 18.5H3" />
            <path d="M17 10H21M17 14.5H21M17 18.5H21" />
          </svg>
          <span style={{ color: 'var(--text1)', fontWeight: 600, fontSize: '0.95rem' }}>Report a bug or request a feature</span>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: '0.87rem', lineHeight: 1.6, marginBottom: 16 }}>
          Found something broken or have an idea? Open a GitHub issue — your app version and OS are
          pre-filled automatically so you don't have to look them up.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="primary"
            style={{ background: 'linear-gradient(135deg, var(--danger), #c0392b)' }}
            onClick={openBugReport}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
              <ellipse cx="12" cy="14" rx="5" ry="6" />
              <circle cx="12" cy="6" r="3" />
              <path d="M9 4L7 2M15 4L17 2" />
              <path d="M7 10H3M7 14.5H3M7 18.5H3" />
              <path d="M17 10H21M17 14.5H21M17 18.5H21" />
            </svg>
            Report a Bug ↗
          </button>
          <button
            className="secondary"
            onClick={() => openExternal('https://github.com/LoJMike/AIQLoadManager/issues/new?template=feature_request.md&labels=enhancement')}
          >
            Request a Feature ↗
          </button>
        </div>
        <div style={{ marginTop: 12, color: 'var(--text3)', fontSize: '0.78rem' }}>
          App version: <span style={{ color: 'var(--text2)' }}>{ver}</span> &nbsp;·&nbsp; OS: <span style={{ color: 'var(--text2)' }}>{os}</span>
          &nbsp;·&nbsp; Configured providers, plan, and recent errors are auto-attached to the report.
        </div>
      </div>

      {/* ── Community & Feedback ─────────────────────────────────────────────── */}
      <div className="glass-card card-spaced" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span style={{ color: 'var(--text1)', fontWeight: 600, fontSize: '0.95rem' }}>GitHub discussions &amp; community</span>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: '0.87rem', lineHeight: 1.6, marginBottom: 16 }}>
          Ask questions, share workflows, and connect with other AIQ Load Manager users on the GitHub
          Discussions board.
        </p>
        <button
          className="secondary"
          onClick={() => openExternal('https://github.com/LoJMike/AIQLoadManager/discussions')}
        >
          Open Discussions ↗
        </button>
      </div>
    </div>
  );
}
