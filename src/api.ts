import type { Upload, UploadsResponse, User } from './types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;

if (!WORKER_URL) {
  throw new Error('VITE_WORKER_URL is not set. Add it to .env.local or the build environment.');
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 401) {
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
  login: (password: string) => call<{ ok: true }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
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
};
