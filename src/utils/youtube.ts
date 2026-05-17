const YT_ID = /^[a-zA-Z0-9_-]{11}$/;

export function parseVideoId(input: string): string | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return YT_ID.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return YT_ID.test(id) ? id : null;
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})$/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}
