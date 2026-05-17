export function buildPrompt({ title, note }) {
  const safeTitle = title || '(no title)';
  const safeNote = note ? `"${note}"` : '"none"';
  return [
    "You're rating a YouTube video's quality and value density on a 1–3 scale.",
    '',
    '1 = low value, weak hook, generic',
    '2 = solid, useful, well-executed',
    '3 = exceptional, dense with value, memorable',
    '',
    `Video title: "${safeTitle}"`,
    `Creator's note: ${safeNote}`,
    '',
    'Reply with ONLY the number 1, 2, or 3. No other text.',
  ].join('\n');
}

export function parseScore(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/[1-3]/);
  return match ? Number(match[0]) : null;
}

export async function scoreVideo({ title, note }, { apiKey, fetch: fetchImpl = fetch }) {
  const prompt = buildPrompt({ title, note });
  let res;
  try {
    res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const text = data?.content?.[0]?.text ?? '';
  return parseScore(text);
}
