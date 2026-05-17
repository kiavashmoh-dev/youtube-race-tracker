import { useState } from 'react';
import { api, ApiError } from '../api';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many attempts. Try again in an hour.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Incorrect password.');
      } else {
        setError('Login failed. Check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">YouTube Race Tracker</h1>
        <p className="text-sm text-[var(--color-muted)]">Enter the shared password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full px-3 py-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-kia)]"
          placeholder="Password"
          aria-label="Password"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full py-2 rounded-md bg-[var(--color-kia)] text-[#0d0d0d] font-medium disabled:opacity-50"
        >
          {submitting ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
