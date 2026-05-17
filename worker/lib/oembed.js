export async function fetchOembed(videoUrl, { fetch: fetchImpl = fetch } = {}) {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  const empty = { title: null, thumbnail: null, author: null };
  let res;
  try {
    res = await fetchImpl(oembed);
  } catch {
    return empty;
  }
  if (!res.ok) return empty;
  let data;
  try {
    data = await res.json();
  } catch {
    return empty;
  }
  return {
    title: data.title ?? null,
    thumbnail: data.thumbnail_url ?? null,
    author: data.author_name ?? null,
  };
}
