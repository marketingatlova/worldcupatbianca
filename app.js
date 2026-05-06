const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID = "2009984765-j723B1C4";

let userProfile      = null;
let currentMatchData = null;
let voteTeamSide     = null;
let votePoints       = 100;
const MIN_PTS        = 100;

/* ── Helpers ── */
const fmt     = (n) => Number(n).toLocaleString('en-US');
const post    = (body) => fetch(API_URL, { method:'POST', body: JSON.stringify(body) }).then(r => r.json());
const showEl  = (id, on) => { const el = document.getElementById(id); if(on) el.classList.add('active'); else el.classList.remove('active'); };
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
};

const FLAG = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Canada":"🇨🇦","Switzerland":"🇨🇭",
  "USA":"🇺🇸","Australia":"🇦🇺","Brazil":"🇧🇷","Morocco":"🇲🇦",
  "Germany":"🇩🇪","France":"🇫🇷","England":"🇬🇧","Spain":"🇪🇸",
  "Argentina":"🇦🇷","Portugal":"🇵🇹","Italy":"🇮🇹","Netherlands":"🇳🇱",
  "Japan":"🇯🇵","Croatia":"🇭🇷","Belgium":"🇧🇪","Denmark":"🇩🇰",
  "Colombia":"🇨🇴","Uruguay":"🇺🇾","Ghana":"🇬🇭","Chile":"🇨🇱",
  "Nigeria":"🇳🇬","Ecuador":"🇪🇨","Saudi Arabia":"🇸🇦","South Korea":"🇰🇷",
  "Senegal":"🇸🇳","Curaçao":"🏳️"
};
const getFlag = (name) => FLAG[name] || "🏳️";


/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", initializeLiff);

async function initializeLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });
    if (liff.isLoggedIn()) {
      const p = await liff.getProfile();
      fetchUserData(p.userId, p.displayName, p.pictureUrl);
    } else {
      liff.login();
    }
  } catch {
    showEl('loading-screen', false);
    showEl('auth-screen', true);
  }
}

async function fetchUserData(lineId, displayName, pictureUrl) {
  try {
    const data = await post({ action:'getUser', lineId, displayName, pictureUrl });
    userProfile = { lineId, ...data };
    showEl('loading-screen', false);
    if (data.isRegistered) {
      showDashboard();
      fetchLeaderboard();
      fetchNextMatch();
    } else {
      showEl('auth-screen', true);
    }
  } catch {
    document.getElementById('loading-screen').innerHTML =
      '<span class="load-ball">⚠️</span><p class="load-text">Connection Error — Refresh</p>';
  }
}

async function submitPhone() {
  const phone = document.getElementById('phone-input').value.trim();
  const err   = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-btn');
  err.style.display = 'none';
  if (phone.length < 9) { err.innerText = "Please enter a valid phone number."; err.style.display='block'; return; }
  btn.innerText = "Saving…"; btn.disabled = true;
  try {
    const result = await post({ action:'registerPhone', lineId:userProfile.lineId, phone });
    if (result.status === 'success') {
      userProfile = { ...userProfile, ...result, isRegistered:true };
      showEl('auth-screen', false);
      showDashboard(); fetchLeaderboard(); fetchNextMatch();
    } else {
      err.innerText = result.message || "Something went wrong."; err.style.display='block';
    }
  } catch { err.innerText = "Network error."; err.style.display='block'; }
  btn.innerText = "Continue"; btn.disabled = false;
}

function showDashboard() {
  showEl('auth-screen', false);
  showEl('dashboard-screen', true);
  updateStatCard();
}

function updateStatCard() {
  const pts = userProfile.availableFootballs || 0;
  const str = userProfile.currentStreak || 0;
  document.getElementById('user-footballs').innerText = fmt(pts);
  document.getElementById('user-streak').innerText    = str;
  document.getElementById('user-rank').innerText      = str >= 5 ? 'MVP' : str >= 3 ? 'CAPTAIN' : 'RESERVE';

  // Streak glow animation when on a run
  const statCard   = document.getElementById('stat-card');
  const streakChip = document.getElementById('streak-chip');
  if (str >= 2) {
    statCard.classList.add('on-streak');
    streakChip.classList.add('on-streak');
  } else {
    statCard.classList.remove('on-streak');
    streakChip.classList.remove('on-streak');
  }
}


/* ══════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  document.getElementById('tab-' + tab).classList.add('active');
  const tabIndex = { home:0, history:1, table:2 };
  document.querySelectorAll('.nav-tab')[tabIndex[tab]].classList.add('active');

  if (tab === 'history') fetchHistory();
  if (tab === 'table')   fetchLeaderboard();
}


/* ══════════════════════════════════════════
   MATCH
══════════════════════════════════════════ */
async function fetchNextMatch() {
  try {
    const md = await post({ action:'getNextMatch', lineId:userProfile.lineId });
    currentMatchData = md;
    if (md.status === "success") {
      const d = new Date(md.kickoff);
      document.getElementById('next-match-time').innerText =
        d.toLocaleString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      document.getElementById('name-a').innerText = md.teamA;
      document.getElementById('flag-a').innerText = getFlag(md.teamA);
      document.getElementById('name-b').innerText = md.teamB;
      document.getElementById('flag-b').innerText = getFlag(md.teamB);
      startCountdown(md.kickoff);
      applyVotedState(md.userVote, md.teamA, md.teamB);
    } else {
      document.getElementById('next-match-time').innerText = "Tournament Ended";
    }
  } catch(e) { console.error(e); }
}

function applyVotedState(userVote, teamA, teamB) {
  const btnA = document.getElementById('btn-teamA');
  const btnB = document.getElementById('btn-teamB');
  const statusRow = document.getElementById('voted-status-row');
  const hintText  = document.getElementById('vote-hint-text');
  btnA.classList.remove('voted-for','voted-against');
  btnB.classList.remove('voted-for','voted-against');
  statusRow.classList.remove('show');
  if (!userVote) { hintText.innerText = "Tap a team flag to place your prediction"; return; }
  if (userVote === teamA) { btnA.classList.add('voted-for'); btnB.classList.add('voted-against'); }
  else                    { btnB.classList.add('voted-for'); btnA.classList.add('voted-against'); }
  document.getElementById('voted-status-text').innerText = `You picked ${userVote}`;
  statusRow.classList.add('show');
  hintText.innerText = "You've placed your prediction for this match";
}

function handleTeamTap(side) {
  if (!currentMatchData || currentMatchData.status !== "success") return;
  if (currentMatchData.userVote) return;
  openVoteSheet(side);
}


/* ══════════════════════════════════════════
   VOTE SHEET
══════════════════════════════════════════ */
function openVoteSheet(side) {
  voteTeamSide = side;
  votePoints   = MIN_PTS;
  const teamName = side === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const balance  = userProfile?.availableFootballs || 0;
  document.getElementById('sheet-flag').innerText      = getFlag(teamName);
  document.getElementById('sheet-team-name').innerText = teamName.toUpperCase();
  document.getElementById('sheet-balance').innerText   = fmt(balance) + ' pts';
  refreshStepper(); clearQuickPills();
  document.getElementById('vote-overlay').classList.add('open');
  document.getElementById('vote-sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVoteSheet() {
  document.getElementById('vote-overlay').classList.remove('open');
  document.getElementById('vote-sheet').classList.remove('open');
  document.body.style.overflow = '';
  clearQuickPills();
}

function adjustPoints(delta) {
  const balance = userProfile?.availableFootballs || 0;
  const next    = votePoints + delta;
  if (next < MIN_PTS || next > balance) return;
  votePoints = next; refreshStepper(); clearQuickPills();
}

function setPoints(amount) {
  const balance = userProfile?.availableFootballs || 0;
  if (amount > balance) return;
  votePoints = amount; refreshStepper();
  document.querySelectorAll('.quick-pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.innerText.replace(/,/g,'')) === amount);
  });
}

function refreshStepper() {
  const balance = userProfile?.availableFootballs || 0;
  document.getElementById('step-number').innerText = fmt(votePoints);
  const btn = document.getElementById('vote-confirm-btn');
  btn.disabled = (votePoints > balance || votePoints < MIN_PTS);
  const minusBtn = document.querySelectorAll('.step-btn')[0];
  if (minusBtn) minusBtn.style.opacity = votePoints <= MIN_PTS ? '0.3' : '1';
}

function clearQuickPills() {
  document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
}

async function confirmVote() {
  if (!voteTeamSide || !currentMatchData) return;
  const selectedTeam = voteTeamSide === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const matchName    = `${currentMatchData.teamA} vs ${currentMatchData.teamB}`;
  closeVoteSheet();
  try {
    const result = await post({ action:'submitVote', lineId:userProfile.lineId, matchName, team:selectedTeam, points:votePoints });
    if (result.status === "success") {
      userProfile.availableFootballs = result.newTotal;
      document.getElementById('user-footballs').innerText = fmt(result.newTotal);
      currentMatchData.userVote = selectedTeam;
      applyVotedState(selectedTeam, currentMatchData.teamA, currentMatchData.teamB);
    } else {
      alert(`❌ ${result.message}`);
    }
  } catch { alert("Network error."); }
}


/* ══════════════════════════════════════════
   HISTORY TAB
══════════════════════════════════════════ */
async function fetchHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="history-empty"><span class="empty-icon">⏳</span>Loading…</div>';

  try {
    const history = await post({ action:'getUserHistory', lineId:userProfile.lineId });

    if (!history || history.length === 0) {
      list.innerHTML = `<div class="history-empty">
        <span class="empty-icon">📋</span>
        No predictions yet.<br>Tap a team flag on the Match tab to make your first prediction!
      </div>`;
      renderHistorySummary([]);
      return;
    }

    renderHistorySummary(history);
    renderHistoryList(history);
  } catch(e) {
    list.innerHTML = '<div class="history-empty"><span class="empty-icon">⚠️</span>Could not load history.</div>';
  }
}

function renderHistorySummary(history) {
  const total = history.length;
  const wins  = history.filter(h => h.outcome === 'won').length;
  // Net = sum of all deltas (won items give net +200, lost give -100)
  const net   = history.reduce((sum, h) => {
    if (h.outcome === 'pending') return sum;
    return sum + h.pointsDelta;
  }, 0);

  document.getElementById('hs-total-votes').innerText = total;
  document.getElementById('hs-wins').innerText        = wins;

  const netEl = document.getElementById('hs-net');
  netEl.innerText = (net >= 0 ? '+' : '') + fmt(net);
  netEl.className = 'hs-num ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : '');
}

function renderHistoryList(history) {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  const OUTCOME_ICON  = { won:'🏆', lost:'❌', pending:'⏳', draw:'🤝' };
  const OUTCOME_LABEL = { won:'Correct!', lost:'Wrong Pick', pending:'Awaiting Result', draw:'Draw' };

  history.forEach((h, i) => {
    const icon    = OUTCOME_ICON[h.outcome]  || '⏳';
    const label   = OUTCOME_LABEL[h.outcome] || '—';
    const deltaSign = h.outcome === 'won' ? '+' : h.outcome === 'lost' ? '' : '';
    const deltaClass = h.outcome === 'won' ? 'pos' : h.outcome === 'lost' ? 'neg' : 'neu';
    const deltaStr   = h.outcome === 'pending' ? '—'
                     : (h.pointsDelta >= 0 ? '+' : '') + fmt(h.pointsDelta);
    const winnerStr  = h.winner ? ` · ${h.winner} won` : (h.outcome === 'pending' ? ' · Pending' : '');

    const card = document.createElement('div');
    card.className = `hist-card outcome-${h.outcome}`;
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
      <div class="hist-icon ${h.outcome}">
        <span>${icon}</span>
      </div>
      <div class="hist-body">
        <div class="hist-match">${h.matchName}</div>
        <div class="hist-pick">${getFlag(h.votedFor)} Picked ${h.votedFor}${winnerStr}</div>
        <div class="hist-date">${fmtDate(h.timestamp)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
        <div class="hist-delta ${deltaClass}">${deltaStr}</div>
        <div class="hist-outcome-badge ${h.outcome}">${label}</div>
      </div>`;
    list.appendChild(card);
  });
}


/* ══════════════════════════════════════════
   WIN CELEBRATION
   Shown when: just voted AND has streak >= 1
   OR when returning to app and streak >= 3
══════════════════════════════════════════ */
function triggerCelebration(opts = {}) {
  const {
    title    = '🏆 Correct!',
    sub      = 'Your prediction was right',
    pts      = '+200',
    emoji    = '🏆',
    streakN  = 0
  } = opts;

  document.getElementById('win-toast-emoji').innerText = emoji;
  document.getElementById('win-toast-title').innerText = title;
  document.getElementById('win-toast-sub').innerText   = sub;
  document.getElementById('win-toast-pts').innerText   = pts;

  spawnConfetti();
  document.getElementById('win-celebration').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCelebration() {
  document.getElementById('win-celebration').classList.remove('show');
  document.body.style.overflow = '';
  document.getElementById('confetti-container').innerHTML = '';
}

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#E8A020','#FAB31E','#2ECC71','#1A4D2E','#FFF1DA','#F39C12','#27AE60','#F1C40F'];
  const count  = 70;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size  = Math.random() * 8 + 5;
    const left  = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const dur   = Math.random() * 1.5 + 1.5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = Math.random() > 0.5 ? '50%' : '2px';

    piece.style.cssText = `
      left:${left}%;
      width:${size}px; height:${size}px;
      background:${color};
      border-radius:${shape};
      animation-duration:${dur}s;
      animation-delay:${delay}s;
    `;
    container.appendChild(piece);
  }
}

/* Check if user just got a result they won (call after history loads) */
function checkForWinCelebration(history) {
  if (!history || history.length === 0) return;
  const streak = userProfile.currentStreak || 0;

  // Find the most recent settled entry
  const settled = history.filter(h => h.outcome === 'won' || h.outcome === 'lost');
  if (settled.length === 0) return;

  const latest = settled[0]; // already sorted newest first

  // Only celebrate if the most recent result was a WIN
  // and we haven't shown it this session
  const celebKey = `celebrated_${userProfile.lineId}_${latest.timestamp}`;
  if (latest.outcome === 'won' && !sessionStorage.getItem(celebKey)) {
    sessionStorage.setItem(celebKey, '1');
    const streakMsg = streak >= 3 ? `🔥 ${streak} match win streak!` : `Keep it up!`;
    const pts = '+' + fmt(200); // net gain per win
    setTimeout(() => triggerCelebration({
      emoji:   streak >= 3 ? '🔥' : '🏆',
      title:   streak >= 3 ? `${streak} IN A ROW!` : 'Correct Pick!',
      sub:     `${getFlag(latest.votedFor)} ${latest.votedFor} won! ${streakMsg}`,
      pts,
    }), 600);
  }
}


/* ══════════════════════════════════════════
   LEADERBOARD
══════════════════════════════════════════ */
async function fetchLeaderboard() {
  try {
    const users = await post({ action:'getLeaderboard' });
    const list  = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    if (!users || users.length === 0) {
      list.innerHTML = '<p style="font-size:.78rem;color:rgba(26,77,46,.4);text-align:center;padding:8px 0;">No players yet</p>';
      return;
    }
    const medals    = ["🥇","🥈","🥉","4","5"];
    const colors    = ["#E8A020","#9BA5B4","#B87333","rgba(26,77,46,.32)","rgba(26,77,46,.32)"];
    const maxPts    = users[0].points || 1;
    users.forEach((u, i) => {
      const barPct = Math.max(8, Math.round((u.points / maxPts) * 100));
      list.innerHTML += `
        <div class="lb-row${i===0?' lb-first':''}">
          <div class="lb-left">
            <span class="lb-pos" style="color:${colors[i]}">${medals[i]}</span>
            <img src="${u.pic}" class="lb-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=235E44&color=FFF1DA'" alt="">
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <span class="lb-name">${u.name}</span>
              <div class="lb-bar-wrap"><div class="lb-bar" style="width:${barPct}%"></div></div>
            </div>
          </div>
          <div class="lb-right">
            <span class="lb-pts">${fmt(u.points)}</span>
            <span class="lb-streak">🔥 ${u.streak} streak</span>
          </div>
        </div>`;
    });
  } catch(e) { console.error(e); }
}


/* ══════════════════════════════════════════
   CLAIM
══════════════════════════════════════════ */
function toggleClaimForm() {
  const f = document.getElementById('claim-form');
  f.style.display = (!f.style.display || f.style.display==='none') ? 'block' : 'none';
}

async function submitClaim() {
  const amount     = document.getElementById('spend-amount').value;
  const billNumber = document.getElementById('bill-number').value;
  const passcode   = document.getElementById('staff-passcode').value;
  const msg        = document.getElementById('claim-message');
  const btn        = document.getElementById('claim-btn');
  if (!amount||!billNumber||!passcode) return alert("All fields are required.");
  btn.innerText = "Verifying…"; msg.style.display = "none";
  try {
    const result = await post({ action:'addPoints', lineId:userProfile.lineId, amount, passcode, billNumber });
    msg.style.display = "block";
    if (result.status === "success") {
      msg.style.color = "#1A4D2E"; msg.innerText = result.message;
      userProfile.availableFootballs = result.newTotal;
      document.getElementById('user-footballs').innerText = fmt(result.newTotal);
      document.getElementById('spend-amount').value=document.getElementById('bill-number').value=document.getElementById('staff-passcode').value="";
      setTimeout(toggleClaimForm, 2000);
    } else { msg.style.color="#C0392B"; msg.innerText=result.message; }
  } catch { msg.style.display="block"; msg.innerText="Network error."; }
  btn.innerText = "Authorize Points";
}


/* ══════════════════════════════════════════
   COUNTDOWN
══════════════════════════════════════════ */
let countdownInterval;
function startCountdown(targetDate) {
  if (countdownInterval) clearInterval(countdownInterval);
  const end = new Date(targetDate).getTime();
  countdownInterval = setInterval(() => {
    const dist = end - Date.now();
    if (dist < 0) {
      clearInterval(countdownInterval);
      document.getElementById("countdown-timer").innerHTML = "MATCH IN PROGRESS";
      return;
    }
    const d=Math.floor(dist/86400000), h=Math.floor((dist%86400000)/3600000),
          m=Math.floor((dist%3600000)/60000), s=Math.floor((dist%60000)/1000);
    document.getElementById("countdown-timer").innerHTML = `${d}d ${h}h ${m}m ${s}s`;
  }, 1000);
}


/* ══════════════════════════════════════════
   HISTORY with celebration check on load
   Override fetchHistory to also check wins
══════════════════════════════════════════ */
const _origFetchHistory = fetchHistory;
// Patch: after history loads, check for win celebration
async function fetchHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="history-empty"><span class="empty-icon">⏳</span>Loading…</div>';
  try {
    const history = await post({ action:'getUserHistory', lineId:userProfile.lineId });
    if (!history || history.length === 0) {
      list.innerHTML = `<div class="history-empty">
        <span class="empty-icon">📋</span>
        No predictions yet.<br>Tap a team flag on the Match tab to make your first prediction!
      </div>`;
      renderHistorySummary([]);
      return;
    }
    renderHistorySummary(history);
    renderHistoryList(history);
    checkForWinCelebration(history);
  } catch(e) {
    list.innerHTML = '<div class="history-empty"><span class="empty-icon">⚠️</span>Could not load history.</div>';
  }
}
