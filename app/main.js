// A make.fun frontend: the board of live bounties, a page for each bounty,
// that bounty's leaderboard, and an account's public profile, on hash routes.
//
//   #/                              the board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     its leaderboard
//   #/profile/<handle>              a public profile
//
// window.__shotReady is false while a page loads and true once its data is
// on screen, so a screenshot script knows when to capture.
//
// The router swaps only #app's innerHTML; the header and footer stay put, so
// moving between views never rebuilds the page. Board state (search, sort,
// page) and leaderboard pages live in memory and survive re-renders, and a
// 30-second tick refreshes every time-left label in place.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { board, bounty, leaderboard, profile } from './views.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');

// Board state kept across renders: searching or paging never resets it.
const boardState = { q: '', sort: 'pot', onlyOpen: true, page: 1 };
const leaderPages = new Map();

function errorPage(err) {
  return `<h1>Couldn’t load make.fun</h1><p>${err?.message ?? 'The API did not answer.'}</p><p><a href="#/">Back to the board</a> · <button type="button" onclick="location.reload()">Retry</button></p>`;
}

function wireBoard() {
  const q = document.getElementById('board-q');
  const sort = document.getElementById('board-sort');
  const open = document.getElementById('board-open');
  const prev = document.getElementById('board-prev');
  const next = document.getElementById('board-next');
  if (q) {
    q.addEventListener('input', () => {
      boardState.q = q.value;
      boardState.page = 1;
      rerenderBoard();
    });
  }
  if (sort) sort.addEventListener('change', () => { boardState.sort = sort.value; boardState.page = 1; rerenderBoard(); });
  if (open) open.addEventListener('change', () => { boardState.onlyOpen = open.checked; boardState.page = 1; rerenderBoard(); });
  if (prev) prev.addEventListener('click', () => { boardState.page -= 1; rerenderBoard(); });
  if (next) next.addEventListener('click', () => { boardState.page += 1; rerenderBoard(); });
}

// Re-render the board from the cached list without another request: the
// list is already in memory, so typing and paging stay instant.
let boardData = null;
async function rerenderBoard() {
  if (!boardData) boardData = await getBounties();
  app.innerHTML = board(boardData, boardState);
  wireBoard();
  const q = document.getElementById('board-q');
  if (q) {
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }
  window.__shotReady = true;
}

async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const leaderMatch = hash.match(/^#\/bounty\/([^/]+)\/leaderboard/);
  const bountyMatch = hash.match(/^#\/bounty\/([^/]+)/);
  const profileMatch = hash.match(/^#\/profile\/([^/]+)/);
  try {
    if (leaderMatch) {
      const slug = decodeURIComponent(leaderMatch[1]);
      const data = await getLeaderboard(slug);
      const page = leaderPages.get(slug) ?? 1;
      document.title = `Leaderboard: ${data.competition?.title ?? slug} | make.fun bounties`;
      app.innerHTML = leaderboard(data, slug, page);
      const prev = document.getElementById('lb-prev');
      const next = document.getElementById('lb-next');
      if (prev) prev.addEventListener('click', () => { leaderPages.set(slug, page - 1); render(); });
      if (next) next.addEventListener('click', () => { leaderPages.set(slug, page + 1); render(); });
    } else if (bountyMatch) {
      const slug = decodeURIComponent(bountyMatch[1]);
      const b = await getBounty(slug);
      document.title = `${b.title} | make.fun bounties`;
      app.innerHTML = bounty(b);
    } else if (profileMatch) {
      const handle = decodeURIComponent(profileMatch[1]);
      const p = await getProfile(handle);
      document.title = `@${p.handle} | make.fun bounties`;
      app.innerHTML = profile(p);
    } else {
      document.title = 'make.fun bounties';
      boardData = await getBounties();
      app.innerHTML = board(boardData, boardState);
      wireBoard();
    }
  } catch (err) {
    document.title = 'make.fun bounties';
    app.innerHTML = errorPage(err);
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

// Tick the time-left labels in place every 30 seconds; no re-render, no
// extra API request.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    const iso = el.dataset.deadline;
    const label = timeLeft(iso);
    if (el.textContent.includes('(')) {
      el.textContent = el.textContent.replace(/\([^)]*\)$/, `(${label})`);
    } else {
      el.textContent = label;
    }
  });
}, 30000);

// Hide a broken avatar instead of showing a torn-image icon: some API
// avatar URLs 404. A capture-phase listener, no inline handlers.
document.getElementById('app').addEventListener('error', (event) => {
  const el = event.target;
  if (el instanceof HTMLImageElement) el.style.visibility = 'hidden';
}, true);

window.addEventListener('hashchange', render);
render();
