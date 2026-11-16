// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every answer is cached and revalidated: make.fun's ETags are bound to the
// minute, so a repeat request inside the same minute answers 304 and costs
// no body. We keep the ETag + body in memory and in sessionStorage, send
// If-None-Match on every repeat, and only parse a fresh body on a 200.
// A view therefore costs at most one small request, usually zero bytes.

const API = 'https://make.fun/api';

// In-memory cache: path -> { etag, body, at }. sessionStorage mirrors it so a
// reload or a second tab in the same session still revalidates instead of
// refetching a full body.
const mem = new Map();

function storeKey(path) {
  return `mf:${path}`;
}

function readCache(path) {
  const hit = mem.get(path);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(storeKey(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    mem.set(path, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(path, entry) {
  mem.set(path, entry);
  try {
    sessionStorage.setItem(storeKey(path), JSON.stringify(entry));
  } catch {
    // Storage full or unavailable: the in-memory copy still serves this page.
  }
}

async function get(path) {
  const cached = readCache(path);
  const headers = {};
  if (cached?.etag) headers['If-None-Match'] = cached.etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && cached) return cached.body;
  if (!res.ok) {
    // A stale body beats an error screen when the network hiccups.
    if (cached) return cached.body;
    throw new Error(`make.fun API ${res.status} for ${path}`);
  }
  const body = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) writeCache(path, { etag, body, at: Date.now() });
  return body;
}

/** The open bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { competition, phase, columns, entries: [...] }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
