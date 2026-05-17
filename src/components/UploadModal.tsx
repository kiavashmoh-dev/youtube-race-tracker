import { useState } from 'react';
import { api, ApiError } from '../api';
import { parseVideoId } from '../utils/youtube';
import type { User } from '../types';

const LAST_USER_KEY = 'yt-tracker:last-user';

export function UploadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(LAST_USER_KEY)) as User | null;
  const [user, setUser] = useState<User>(stored === 'mohamad' ? 'mohamad' : 'kia');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlValid = !!parseVideoId(url);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!urlValid) {
      setError("That doesn't look like a YouTube URL.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.create(user, url, note);
      localStorage.setItem(LAST_USER_KEY, user);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Already scored — this video was uploaded earlier.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md bg-[var(--color-surface)] rounded-xl p-6 space-y-4 border border-[var(--color-border)]"
      >
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Add Upload</h2>

        <div className="flex gap-2">
          {(['kia', 'mohamad'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUser(u)}
              className={`flex-1 py-2 rounded-md border ${
                user === u
                  ? 'border-transparent text-[#0d0d0d] font-medium'
                  : 'border-[var(--color-border)] text-[var(--color-text)]'
              }`}
              style={{
                background: user === u
                  ? (u === 'kia' ? 'var(--color-kia)' : 'var(--color-mohamad)')
                  : 'transparent',
              }}
            >
              I am {u === 'kia' ? 'Kia' : 'Mohamad'}
            </button>
          ))}
        </div>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          autoFocus
          required
          className="w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-kia)]"
        />

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder="Optional note for the AI scorer"
          maxLength={200}
          className="w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-kia)]"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !urlValid}
            className="px-4 py-2 rounded-md bg-[var(--color-kia)] text-[#0d0d0d] font-medium disabled:opacity-50"
          >
            {submitting ? 'Scoring…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}
