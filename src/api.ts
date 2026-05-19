import type { Upload, UploadsResponse, User } from './types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;
const TOKEN_KEY = 'yt-tracker:token';

if (!WORKER_URL) {
  throw new Error('VITE_WORKER_URL is not set. Add it to .env.local or the build environment.');
}

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage unavailable (private mode etc) — fall through; user re-logs each visit
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${WORKER_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    setToken(null);
    throw new ApiError('unauthorized', 401);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error; } catch {}
    throw new ApiError(detail || `HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const api = {
  login: async (password: string) => {
    const result = await call<{ ok: true; token: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setToken(result.token);
    return result;
  },
  list: () => call<UploadsResponse>('/api/uploads'),
  create: (user: User, youtube_url: string, note: string) =>
    call<Upload>('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ user, youtube_url, note }),
    }),
  delete: (user: User, id: string) =>
    call<{ ok: true }>(`/api/uploads/${id}?user=${user}`, { method: 'DELETE' }),
  rescore: (user: User, id: string) =>
    call<Upload>(`/api/uploads/${id}/rescore?user=${user}`, { method: 'POST' }),
  logout: () => setToken(null),
};
