import type { Upload, User } from '../types';
import { api } from '../api';

export function DayPopover({
  date,
  user,
  items,
  onClose,
  onChanged,
}: {
  date: string;
  user: User;
  items: Upload[];
  onClose: () => void;
  onChanged: () => void;
}) {
  async function handleDelete(id: string) {
    if (!confirm('Delete this upload? Scores will adjust.')) return;
    await api.delete(user, id);
    onChanged();
  }

  async function handleRescore(id: string) {
    await api.rescore(user, id);
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-20 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-xl p-5 space-y-3 border border-[var(--color-border)]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            {user === 'kia' ? 'Kia' : 'Mohamad'} — {date}
          </h3>
          <button onClick={onClose} className="text-[var(--color-muted)]" aria-label="Close">✕</button>
        </div>
        <ul className="space-y-3">
          {items.map((u) => (
            <li key={u.id} className="flex gap-3 items-start">
              {u.thumbnail && (
                <img src={u.thumbnail} alt="" className="w-20 h-12 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={u.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--color-text)] underline truncate block"
                >
                  {u.title ?? u.youtube_url}
                </a>
                {u.note && <p className="text-xs text-[var(--color-muted)] mt-1">{u.note}</p>}
                <div className="flex gap-3 text-xs mt-1">
                  <span className="text-[var(--color-text)]">
                    Quality: {u.quality_score ?? '—'} / 3
                  </span>
                  <span className="text-[var(--color-muted)]">+{u.upload_score} upload</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {u.quality_score === null && (
                  <button
                    onClick={() => handleRescore(u.id)}
                    className="text-xs px-2 py-1 rounded bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]"
                  >
                    Retry score
                  </button>
                )}
                <button
                  onClick={() => handleDelete(u.id)}
                  className="text-xs px-2 py-1 rounded text-red-400 hover:bg-[var(--color-bg)]"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
