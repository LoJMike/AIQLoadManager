import { useMemo } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['S','M','T','W','T','F','S'];

function buildCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d) });
  return cells;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function RightRail({ queue, providers, onSelectQueueItem }) {
  const now = new Date();
  const calDays = useMemo(() => buildCalendarDays(now.getFullYear(), now.getMonth()), [now.getMonth(), now.getFullYear()]);

  const scheduledDays = useMemo(() => {
    const set = new Set();
    for (const item of queue) {
      if (!item.scheduled_for) continue;
      const d = new Date(item.scheduled_for);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [queue]);

  const activity = useMemo(() => {
    const items = [];
    for (const item of queue) {
      if (item.status === 'complete') {
        items.push({
          id: item.id,
          type: 'complete',
          provider: item.used_provider,
          label: item.label || item.prompt?.slice(0, 48) || 'Prompt',
          time: item.completed_at || item.created_at,
        });
      } else if (item.status === 'error') {
        items.push({
          id: item.id,
          type: 'error',
          provider: item.used_provider,
          label: item.label || item.prompt?.slice(0, 48) || 'Prompt',
          time: item.created_at,
        });
      } else if (item.status === 'processing') {
        items.push({
          id: item.id,
          type: 'processing',
          provider: item.used_provider,
          label: item.label || item.prompt?.slice(0, 48) || 'Prompt',
          time: item.created_at,
        });
      }
    }
    return items
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);
  }, [queue]);

  function providerColor(name) {
    if (name === 'compare') return 'var(--purple)';
    return providers.find(p => p.name === name)?.color || 'var(--bg4)';
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  function activityText(a) {
    const prov = a.provider === 'compare' ? 'Compare' : (providers.find(p => p.name === a.provider)?.displayName || a.provider || 'Queue');
    if (a.type === 'complete') return <><strong>{prov}</strong> completed &ldquo;{a.label}&rdquo;</>;
    if (a.type === 'error') return <><strong>{prov}</strong> failed on &ldquo;{a.label}&rdquo;</>;
    return <><strong>{prov}</strong> is processing &ldquo;{a.label}&rdquo;</>;
  }

  return (
    <aside className="right-rail">
      <section className="rail-section">
        <h3 className="rail-heading">{MONTHS[now.getMonth()]} {now.getFullYear()}</h3>
        <div className="cal-grid">
          {DOW.map(d => <span key={d} className="cal-dow">{d}</span>)}
          {calDays.map((cell, i) => {
            if (!cell.day) return <span key={`e-${i}`} className="cal-day empty" />;
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const isToday = sameDay(cell.date, now);
            const hasScheduled = scheduledDays.has(key);
            return (
              <span
                key={key}
                className={`cal-day ${isToday ? 'today' : ''} ${hasScheduled ? 'scheduled' : ''}`}
                title={hasScheduled ? 'Scheduled prompt(s)' : undefined}
              >
                {cell.day}
              </span>
            );
          })}
        </div>
      </section>

      <section className="rail-section">
        <h3 className="rail-heading">Activity</h3>
        <div className="activity-list">
          {activity.length === 0 && (
            <div className="activity-empty">No recent queue activity yet.</div>
          )}
          {activity.map(a => (
            <button
              key={a.id}
              type="button"
              className="activity-item"
              onClick={() => onSelectQueueItem?.(a.id)}
            >
              <span className="activity-dot" style={{ background: providerColor(a.provider) }} />
              <span className="activity-body">
                <span className="activity-text">{activityText(a)}</span>
                <span className="activity-time">{fmtTime(a.time)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
