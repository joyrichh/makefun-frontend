// The four pages, each a function from API data to HTML. Every view is a
// plain string: the router swaps only #app's innerHTML, so moving between
// views never rebuilds the header, nav or footer, and the ticking clock
// below updates time-left labels in place instead of re-rendering.

import { date, entries, esc, money, num, shortAddr, stillOpen, timeLeft, winRate } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee` : 'Free entry');

/** One board row: title, live pot, fee, time left, entries, open/closed badge. */
function boardRow(b) {
  const open = stillOpen(b);
  return `
      <li class="card${open ? '' : ' closed'}">
        <a class="card-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
        <p class="card-meta">${esc(b.category ?? '')}${b.category && b.sponsor?.name ? ' · ' : ''}${esc(b.sponsor?.name ?? '')}</p>
        <p class="card-pot">${pot(b)}<span class="card-pot-label"> live pot</span></p>
        <p class="card-facts">
          <span class="fee">${fee(b)}</span>
          <span class="time" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
          <span>${entries(b.submissionCount)}</span>
        </p>
        <p class="card-status">${open ? '<span class="badge open">Open — taking entries</span>' : '<span class="badge closed">Closed — past deadline</span>'}</p>
      </li>`;
}

/**
 * The board. `state` carries the search text, sort and page the router keeps
 * across renders, so typing or paging never loses its place.
 * Only `pageSize` rows are shown at a time; the rest is one click away.
 */
export function board(data, state = {}) {
  const pageSize = 8;
  const q = (state.q ?? '').trim().toLowerCase();
  const sort = state.sort ?? 'pot';
  const onlyOpen = state.onlyOpen ?? true;
  let items = (data.items ?? []).slice();
  if (onlyOpen) items = items.filter(stillOpen);
  if (q) {
    items = items.filter((b) => `${b.title ?? ''} ${b.category ?? ''} ${b.slug ?? ''}`.toLowerCase().includes(q));
  }
  const sorts = {
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0),
    deadline: (a, b) => new Date(a.deadline) - new Date(b.deadline),
    entries: (a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0),
  };
  items.sort(sorts[sort] ?? sorts.pot);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, state.page ?? 1), pages);
  const shown = items.slice((page - 1) * pageSize, page * pageSize);
  const openCount = (data.items ?? []).filter(stillOpen).length;
  const total = (data.items ?? []).length;
  return `
    <h1>Open bounties</h1>
    <p class="lede">${openCount} taking entries now · ${total} listed · live pots include entry fees paid in.</p>
    <form class="controls" id="board-controls" action="#/" onsubmit="return false">
      <label class="search">Search <input id="board-q" type="search" placeholder="Search bounties…" value="${esc(state.q ?? '')}"></label>
      <label>Sort
        <select id="board-sort">
          <option value="pot"${sort === 'pot' ? ' selected' : ''}>Largest pot</option>
          <option value="deadline"${sort === 'deadline' ? ' selected' : ''}>Closing soonest</option>
          <option value="entries"${sort === 'entries' ? ' selected' : ''}>Most entries</option>
        </select>
      </label>
      <label class="check"><input id="board-open" type="checkbox"${onlyOpen ? ' checked' : ''}> Open only</label>
    </form>
    <ul class="board">${shown.map(boardRow).join('') || '<li class="empty">No bounties match — clear the search or uncheck “Open only”.</li>'}</ul>
    <nav class="pager" aria-label="Board pages">
      <button type="button" id="board-prev" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${page} of ${pages} · ${items.length} ${items.length === 1 ? 'bounty' : 'bounties'}</span>
      <button type="button" id="board-next" ${page >= pages ? 'disabled' : ''}>Next →</button>
    </nav>`;
}

/** The rewards table: each place and what it pays right now (base + fee share). */
function rewardsTable(b) {
  const rows = (b.rewardsNow ?? []).map(
    (r) => `<tr><td>${num(r.place)}</td><td>${money(r.amountUsd)}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td></tr>`,
  );
  if (!rows.length && b.rewards) {
    return Object.entries(b.rewards)
      .map(([place, amount]) => `<tr><td>${esc(place)}</td><td>${money(amount)}</td><td>${money(amount)}</td><td>$0</td></tr>`)
      .join('');
  }
  return rows.join('');
}

/** One bounty: summary, live pot, rewards table, dates, status, rules, description. */
export function bounty(b) {
  const open = stillOpen(b);
  const rewards = rewardsTable(b);
  return `
    <p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a></p>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary ?? '')}</p>
    <p>${open ? '<span class="badge open">Open — taking entries</span>' : '<span class="badge closed">Closed — past deadline</span>'} <span class="muted">${esc(b.status ?? '')}</span></p>
    <dl class="facts">
      <dt>Live pot</dt><dd><strong>${pot(b)}</strong>${b.entryFeesUsd && Number(b.entryFeesUsd) > 0 ? ` <span class="muted">(includes ${money(b.entryFeesUsd)} in entry fees)</span>` : ''}</dd>
      <dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd>
      <dt>Deadline</dt><dd><span class="time" data-deadline="${esc(b.deadline)}">${date(b.deadline)} (${timeLeft(b.deadline)})</span></dd>
      <dt>Opened</dt><dd>${date(b.opensAt ?? b.publishedAt)}</dd>
      <dt>Entries</dt><dd>${entries(b.submissionCount)}</dd>
      <dt>Category</dt><dd>${esc(b.category ?? '—')}</dd>
      <dt>Sponsor</dt><dd>${esc(b.sponsor?.name ?? '—')}${b.sponsor?.isVerified ? ' ✓' : ''}</dd>
      ${b.skills?.length ? `<dt>Skills</dt><dd>${b.skills.map((s) => esc(s)).join(', ')}</dd>` : ''}
    </dl>
    ${rewards ? `<h2>Rewards</h2><div class="rewards-wrap"><table class="rewards"><thead><tr><th>Place</th><th>Pays now</th><th>Base prize</th><th>Fee share</th></tr></thead><tbody>${rewards}</tbody></table></div>` : ''}
    <h2>Description</h2>
    <div class="description">${esc(b.description ?? '')}</div>
    ${b.rules ? `<h2>Rules</h2><div class="description">${esc(b.rules)}</div>` : ''}`;
}

/** One leaderboard row: rank, entrant (linked to their profile), title, win rate. */
function leaderRow(e) {
  const v = e.values ?? {};
  const rate = winRate(v.judge);
  const low = winRate(v.judge_low);
  const high = winRate(v.judge_high);
  const avatar = e.image ? `https://make.fun${e.image}` : null;
  return `
      <tr>
        <td class="rank">${num(e.rank)}</td>
        <td><a class="entrant" href="#/profile/${encodeURIComponent(e.handle)}">${avatar ? `<img class="avatar" crossorigin="anonymous" src="${esc(avatar)}" alt="" loading="lazy" width="28" height="28">` : ''}${esc(e.handle)}</a></td>
        <td class="entry-title">${esc(e.title ?? '')}</td>
        <td class="rate"><strong>${rate}</strong>${low !== '—' ? ` <span class="muted">(${low}–${high})</span>` : ''}</td>
        <td>${e.status ?? ''}</td>
      </tr>`;
}

/**
 * A bounty's leaderboard, paginated 25 rows at a time. The API answers the
 * whole table in one request (cached + ETag-revalidated); only a page of
 * rows ever reaches the DOM.
 */
export function leaderboard(data, slug, page = 1) {
  const pageSize = 25;
  const comp = data.competition ?? {};
  const entriesList = data.entries ?? [];
  const pages = Math.max(1, Math.ceil(entriesList.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const shown = entriesList.slice((safePage - 1) * pageSize, safePage * pageSize);
  return `
    <p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(slug)}">Bounty →</a></p>
    <h1>Leaderboard</h1>
    <p class="lede">${esc(comp.title ?? slug)} · ${entriesList.length.toLocaleString('en-US')} entries · ${esc(data.phase?.title ?? '')} phase${data.phase?.ends_at ? ` · ends ${date(data.phase.ends_at)}` : ''}</p>
    <div class="leader-wrap"><table class="leader">
      <thead><tr><th>#</th><th>Entrant</th><th>Entry</th><th>Judge win rate</th><th>Status</th></tr></thead>
      <tbody>${shown.map(leaderRow).join('') || '<tr><td colspan="5">No entries yet.</td></tr>'}</tbody>
    </table></div>
    <nav class="pager" aria-label="Leaderboard pages">
      <button type="button" id="lb-prev" ${safePage <= 1 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${safePage} of ${pages}</span>
      <button type="button" id="lb-next" ${safePage >= pages ? 'disabled' : ''}>Next →</button>
    </nav>`;
}

/** An account's public profile: avatar, handle, record, wallet, entries. */
export function profile(p) {
  const rec = p.record ?? {};
  const avatar = p.image ?? p.avatar ?? null;
  const solutions = p.solutions ?? [];
  return `
    <p class="crumbs"><a href="#/">← All bounties</a></p>
    <div class="profile-head">
      ${avatar ? `<img class="avatar big" crossorigin="anonymous" src="${esc(avatar)}" alt="${esc(p.handle)}’s avatar" width="72" height="72">` : ''}
      <div>
        <h1>@${esc(p.handle)}</h1>
        ${p.display_name ? `<p class="lede">${esc(p.display_name)}</p>` : ''}
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        <p class="muted">Joined ${date(p.joined_at)}${p.github_login ? ` · GitHub ${esc(p.github_login)}` : ''}</p>
      </div>
    </div>
    <dl class="facts">
      <dt>Competitions entered</dt><dd>${num(rec.competitions_entered)}</dd>
      <dt>Placements</dt><dd>${num(rec.competitions_placed)}${rec.best_placement ? ` · best #${num(rec.best_placement)}` : ''}</dd>
      <dt>Wins</dt><dd>${num(rec.competitions_won)} · ${num(rec.podium_finishes)} podium finishes</dd>
      <dt>Prize money won</dt><dd>${money(rec.prize_usd)}</dd>
      ${p.wallet?.address ? `<dt>Wallet</dt><dd><a href="${esc(p.wallet.explorer_url ?? `https://solscan.io/account/${p.wallet.address}`)}">${shortAddr(p.wallet.address)}</a></dd>` : ''}
    </dl>
    <h2>Entries</h2>
    ${solutions.length ? `<ul class="board">${solutions.map((s) => `<li class="card"><a class="card-title" href="#/bounty/${encodeURIComponent(s.competition_slug ?? s.slug ?? '')}">${esc(s.competition_title ?? s.title ?? '')}</a><p class="card-facts"><span>${esc(s.status ?? '')}</span><span>${s.placement ? `Placed #${num(s.placement)}` : ''}</span></p></li>`).join('')}</ul>` : '<p class="muted">No entries listed on this profile yet.</p>'}`;
}
