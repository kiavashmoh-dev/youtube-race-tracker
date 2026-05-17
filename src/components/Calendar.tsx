import type { Upload, User } from '../types';

type Props = {
  user: User;
  uploads: Upload[];
  month: string; // YYYY-MM
  onDayClick: (date: string, items: Upload[]) => void;
};

function buildDays(month: string): Array<{ date: string; inMonth: boolean }> {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const dayOfWeek = (first.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const cells: Array<{ date: string; inMonth: boolean }> = [];

  for (let i = dayOfWeek; i > 0; i--) {
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() - i);
    cells.push({ date: d.toISOString().slice(0, 10), inMonth: false });
  }
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(y, m - 1, day));
    cells.push({ date: d.toISOString().slice(0, 10), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(cells[cells.length - 1].date + 'T00:00:00Z');
    last.setUTCDate(last.getUTCDate() + 1);
    cells.push({ date: last.toISOString().slice(0, 10), inMonth: false });
  }
  return cells;
}

function colorForScore(user: User, score: number | null): string {
  const base = user === 'kia' ? 'var(--color-kia)' : 'var(--color-mohamad)';
  if (score === 3) return base;
  if (score === 2) return `color-mix(in srgb, ${base} 65%, var(--color-surface))`;
  if (score === 1) return `color-mix(in srgb, ${base} 35%, var(--color-surface))`;
  return `color-mix(in srgb, ${base} 20%, var(--color-surface))`;
}

export function Calendar({ user, uploads, month, onDayClick }: Props) {
  const cells = buildDays(month);
  const byDate = new Map<string, Upload[]>();
  for (const u of uploads) {
    const d = u.uploaded_at.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(u);
  }

  const monthUploads = uploads.filter((u) => u.published_month === month);
  const points = monthUploads.reduce(
    (s, u) => s + (u.upload_score ?? 0) + (u.quality_score ?? 0),
    0
  );

  const label = user === 'kia' ? 'KIA' : 'MOHAMAD';
  const labelColor = user === 'kia' ? 'var(--color-kia)' : 'var(--color-mohamad)';

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4">
      <div className="text-xs font-semibold mb-3" style={{ color: labelColor, letterSpacing: '1px' }}>
        {label}
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-[var(--color-muted)] mb-1">
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const items = byDate.get(date) ?? [];
          const top = items[0];
          return (
            <button
              key={date}
              onClick={() => items.length && onDayClick(date, items)}
              disabled={items.length === 0}
              className={`aspect-square rounded-[4px] transition-all ${
                inMonth ? '' : 'opacity-40'
              } ${items.length ? 'cursor-pointer hover:ring-2 hover:ring-white/20' : 'cursor-default'}`}
              style={{
                background: items.length
                  ? colorForScore(user, top.quality_score)
                  : 'var(--color-bg)',
              }}
              aria-label={items.length ? `${items.length} upload(s) on ${date}` : date}
            />
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs text-[var(--color-muted)]">
        <span>{monthUploads.length} uploads</span>
        <span className="font-medium text-[var(--color-text)]">+{points} pts</span>
      </div>
    </div>
  );
}
