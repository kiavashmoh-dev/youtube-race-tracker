import type { UploadsResponse } from '../types';

type Props = {
  uploads: UploadsResponse;
  month: string; // YYYY-MM
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onAdd: () => void;
};

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function monthTotals(uploads: UploadsResponse['kia'] | UploadsResponse['mohamad'], month: string) {
  const filtered = uploads.filter((u) => u.published_month === month);
  const points = filtered.reduce(
    (sum, u) => sum + (u.upload_score ?? 0) + (u.quality_score ?? 0),
    0
  );
  return { count: filtered.length, points };
}

function allTimePoints(uploads: UploadsResponse['kia']) {
  return uploads.reduce(
    (sum, u) => sum + (u.upload_score ?? 0) + (u.quality_score ?? 0),
    0
  );
}

export function Header({ uploads, month, onPrevMonth, onNextMonth, onAdd }: Props) {
  const kiaMonth = monthTotals(uploads.kia, month);
  const mohamadMonth = monthTotals(uploads.mohamad, month);
  const kiaAll = allTimePoints(uploads.kia);
  const mohamadAll = allTimePoints(uploads.mohamad);

  const gap = kiaMonth.points - mohamadMonth.points;
  let summary = `Tied at ${kiaMonth.points} in ${monthLabel(month)}`;
  if (gap > 0) summary = `Kia leads ${monthLabel(month)} by ${gap}`;
  if (gap < 0) summary = `Mohamad leads ${monthLabel(month)} by ${-gap}`;

  return (
    <header className="sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            aria-label="Previous month"
            className="px-2 py-1 rounded text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          >
            ←
          </button>
          <span className="font-semibold text-[var(--color-text)] min-w-[10ch] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={onNextMonth}
            aria-label="Next month"
            className="px-2 py-1 rounded text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          >
            →
          </button>
        </div>
        <div className="text-sm text-[var(--color-text)]">
          <div className="font-medium">
            <span className="text-[var(--color-kia)]">Kia {kiaAll}</span>
            <span className="text-[var(--color-muted)]"> · </span>
            <span className="text-[var(--color-mohamad)]">Mohamad {mohamadAll}</span>
          </div>
          <div className="text-xs text-[var(--color-muted)]">{summary}</div>
        </div>
        <button
          onClick={onAdd}
          className="px-3 py-2 rounded-md bg-[var(--color-kia)] text-[#0d0d0d] font-medium"
        >
          + Add Upload
        </button>
      </div>
    </header>
  );
}
