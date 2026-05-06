const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID = "2009984765-j723B1C4";

let userProfile      = null;
let currentMatchData = null;
let voteTeamSide     = null;
let votePoints       = 100;
const MIN_PTS        = 100;

/* ── Helpers ── */
const fmt    = (n) => Number(n).toLocaleString('en-US');
const post   = (b) => fetch(API_URL, { method:'POST', body:JSON.stringify(b) }).then(r => r.json());
const showEl = (id, on) => document.getElementById(id).classList[on ? 'add' : 'remove']('active');
const fmtDate= (iso) => {
  try { return new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return ''; }
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
const getFlag = (n) => FLAG[n] || "🏳️";


/* ══════════════════════════════════════════
   LIFF INIT
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
      fetchNextMatch();
      fetchLeaderboard();
    } else {
      showEl('auth-screen', true);
    }
  } catch {
    document.getElementById('loading-screen').innerHTML =
      '<span class="load-ball">⚠️</span><p class="load-text">Connection Error</p>';
  }
}

async function submitPhone() {
  const phone = document.getElementById('phone-input').value.trim();
  const err   = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-btn');
  err.style.display = 'none';
  if (phone.length < 9) {
    err.innerText = "Please enter a valid phone number.";
    err.style.display = 'block';
    return;
  }
  btn.innerText = "Saving…"; btn.disabled = true;
  try {
    const res = await post({ action:'registerPhone', lineId:userProfile.lineId, phone });
    if (res.status === 'success') {
      userProfile = { ...userProfile, ...res, isRegistered:true };
      showEl('auth-screen', false);
      showDashboard();
      fetchNextMatch();
      fetchLeaderboard();
    } else {
      err.innerText = res.message || "Error. Try again.";
      err.style.display = 'block';
    }
  } catch {
    err.innerText = "Network error."; err.style.display = 'block';
  }
  btn.innerText = "Continue"; btn.disabled = false;
}


/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
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
  document.getElementById('user-rank').innerText      =
    str >= 5 ? 'MVP' : str >= 3 ? 'CAPTAIN' : 'RESERVE';

  const card  = document.getElementById('stat-card');
  const chip  = document.getElementById('streak-chip');
  if (str >= 2) {
    card.classList.add('on-streak');
    chip.classList.add('on-streak');
  } else {
    card.classList.remove('on-streak');
    chip.classList.remove('on-streak');
  }
}


/* ══════════════════════════════════════════
   TAB SWITCHING
   panel IDs: panel-match | panel-history | panel-table
   button IDs: tbtn-match | tbtn-history  | tbtn-table
══════════════════════════════════════════ */
function switchTab(tab) {
  // Hide all panels
  ['match','history','table'].forEach(t => {
    document.getElementById('panel-' + t).classList.remove('active');
    document.getElementById('tbtn-'  + t).classList.remove('active');
  });
  // Show selected
  document.getElementById('panel-' + tab).classList.add('active');
  document.getElementById('tbtn-'  + tab).classList.add('active');

  // Lazy-load content
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
      document.getElementById('name-a').innerText  = md.teamA;
      document.getElementById('flag-a').innerText  = getFlag(md.teamA);
      document.getElementById('name-b').innerText  = md.teamB;
      document.getElementById('flag-b').innerText  = getFlag(md.teamB);
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
  const row  = document.getElementById('voted-status-row');
  const hint = document.getElementById('vote-hint-text');

  btnA.classList.remove('voted-for','voted-against');
  btnB.classList.remove('voted-for','voted-against');
  row.classList.remove('show');

  if (!userVote) {
    hint.innerText = "Tap a team flag to place your prediction";
    return;
  }

  if (userVote === teamA) {
    btnA.classList.add('voted-for');
    btnB.classList.add('voted-against');
  } else {
    btnB.classList.add('voted-for');
    btnA.classList.add('voted-against');
  }

  document.getElementById('voted-status-text').innerText = `You picked ${userVote}`;
  row.classList.add('show');
  hint.innerText = "You've placed your prediction for this match";
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
  const team    = side === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const balance = userProfile?.availableFootballs || 0;
  document.getElementById('sheet-flag').innerText      = getFlag(team);
  document.getElementById('sheet-team-name').innerText = team.toUpperCase();
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
  const bal = userProfile?.availableFootballs || 0;
  const nxt = votePoints + delta;
  if (nxt < MIN_PTS || nxt > bal) return;
  votePoints = nxt; refreshStepper(); clearQuickPills();
}

function setPoints(amt) {
  const bal = userProfile?.availableFootballs || 0;
  if (amt > bal) return;
  votePoints = amt; refreshStepper();
  document.querySelectorAll('.quick-pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.innerText.replace(/,/g,'')) === amt);
  });
}

function refreshStepper() {
  const bal = userProfile?.availableFootballs || 0;
  document.getElementById('step-number').innerText = fmt(votePoints);
  document.getElementById('vote-confirm-btn').disabled = (votePoints > bal || votePoints < MIN_PTS);
  const minus = document.querySelectorAll('.step-btn')[0];
  if (minus) minus.style.opacity = votePoints <= MIN_PTS ? '0.3' : '1';
}

function clearQuickPills() {
  document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
}

async function confirmVote() {
  if (!voteTeamSide || !currentMatchData) return;
  const team  = voteTeamSide === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const match = `${currentMatchData.teamA} vs ${currentMatchData.teamB}`;
  closeVoteSheet();
  try {
    const res = await post({ action:'submitVote', lineId:userProfile.lineId, matchName:match, team, points:votePoints });
    if (res.status === "success") {
      userProfile.availableFootballs = res.newTotal;
      document.getElementById('user-footballs').innerText = fmt(res.newTotal);
      currentMatchData.userVote = team;
      applyVotedState(team, currentMatchData.teamA, currentMatchData.teamB);
    } else {
      alert(`❌ ${res.message}`);
    }
  } catch { alert("Network error."); }
}


/* ══════════════════════════════════════════
   HISTORY
══════════════════════════════════════════ */
async function fetchHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="history-empty"><span class="empty-icon">⏳</span>Loading…</div>';

  try {
    const history = await post({ action:'getUserHistory', lineId:userProfile.lineId });

    if (!history || history.length === 0) {
      list.innerHTML = `<div class="history-empty">
        <span class="empty-icon">📋</span>
        No predictions yet.<br>Tap a team on the Match tab to start!
      </div>`;
      renderHistorySummary([]);
      return;
    }

    renderHistorySummary(history);
    renderHistoryCards(history);
    checkForWinCelebration(history);

  } catch(e) {
    console.error(e);
    list.innerHTML = '<div class="history-empty"><span class="empty-icon">⚠️</span>Could not load history.</div>';
  }
}

function renderHistorySummary(history) {
  const total = history.length;
  const wins  = history.filter(h => h.outcome === 'won').length;
  const net   = history.reduce((sum, h) => {
    if (h.outcome === 'pending') return sum;
    return sum + (h.pointsDelta || 0);
  }, 0);

  document.getElementById('hs-total').innerText = total || '0';
  document.getElementById('hs-wins').innerText  = wins  || '0';

  const netEl = document.getElementById('hs-net');
  netEl.innerText = (net >= 0 ? '+' : '') + fmt(net);
  netEl.className = 'hs-num ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : '');
}

function renderHistoryCards(history) {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  const ICON  = { won:'🏆', lost:'❌', pending:'⏳', draw:'🤝' };
  const LABEL = { won:'Correct!', lost:'Wrong Pick', pending:'Pending', draw:'Draw' };

  history.forEach((h, i) => {
    const icon       = ICON[h.outcome]  || '⏳';
    const label      = LABEL[h.outcome] || '—';
    const settled    = h.outcome !== 'pending';
    const deltaStr   = !settled ? '—'
                     : (h.pointsDelta >= 0 ? '+' : '') + fmt(h.pointsDelta);
    const deltaClass = h.outcome === 'won' ? 'pos' : h.outcome === 'lost' ? 'neg' : 'neu';
    const winnerNote = h.winner
                     ? ` · ${h.winner} won`
                     : h.outcome === 'pending' ? ' · Awaiting result' : '';

    const card = document.createElement('div');
    card.className = `hist-card outcome-${h.outcome}`;
    card.style.animationDelay = `${i * 0.045}s`;
    card.innerHTML = `
      <div class="hist-icon ${h.outcome}">${icon}</div>
      <div class="hist-body">
        <div class="hist-match">${h.matchName}</div>
        <div class="hist-pick">${getFlag(h.votedFor)} Picked ${h.votedFor}${winnerNote}</div>
        <div class="hist-date">${fmtDate(h.timestamp)}</div>
      </div>
      <div class="hist-right">
        <div class="hist-delta ${deltaClass}">${deltaStr}</div>
        <div class="hist-badge ${h.outcome}">${label}</div>
      </div>`;
    list.appendChild(card);
  });
}


/* ══════════════════════════════════════════
   WIN CELEBRATION
══════════════════════════════════════════ */
function checkForWinCelebration(history) {
  if (!history || history.length === 0) return;
  const settled = history.filter(h => h.outcome === 'won' || h.outcome === 'lost');
  if (settled.length === 0) return;

  const latest   = settled[0]; // newest first
  const streak   = userProfile.currentStreak || 0;
  const key      = `cel_${userProfile.lineId}_${latest.timestamp}`;

  if (latest.outcome === 'won' && !sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    const streakMsg = streak >= 3 ? `🔥 ${streak} in a row!` : 'Keep it up!';
    setTimeout(() => triggerCelebration({
      emoji: streak >= 3 ? '🔥' : '🏆',
      title: streak >= 3 ? `${streak} IN A ROW!` : 'Correct Pick!',
      sub:   `${getFlag(latest.votedFor)} ${latest.votedFor} won! ${streakMsg}`,
      pts:   '+' + fmt(200),
    }), 500);
  }
}

function triggerCelebration({ emoji='🏆', title='Correct!', sub='', pts='+200' } = {}) {
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
  const c = document.getElementById('confetti-container');
  c.innerHTML = '';
  const colors = ['#E8A020','#FAB31E','#2ECC71','#1A4D2E','#F1C40F','#27AE60','#FFF1DA'];
  for (let i = 0; i < 65; i++) {
    const p   = document.createElement('div');
    p.className = 'confetti-piece';
    const sz  = Math.random() * 8 + 5;
    p.style.cssText = `
      left:${Math.random()*100}%;
      width:${sz}px; height:${sz}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>.5?'50%':'2px'};
      animation-duration:${Math.random()*1.5+1.5}s;
      animation-delay:${Math.random()*.8}s;`;
    c.appendChild(p);
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
    const medals = ["🥇","🥈","🥉","4","5"];
    const colors = ["#E8A020","#9BA5B4","#B87333","rgba(26,77,46,.32)","rgba(26,77,46,.32)"];
    const maxPts = users[0].points || 1;
    users.forEach((u, i) => {
      const bar = Math.max(8, Math.round((u.points / maxPts) * 100));
      list.innerHTML += `
        <div class="lb-row${i===0?' lb-first':''}">
          <div class="lb-left">
            <span class="lb-pos" style="color:${colors[i]}">${medals[i]}</span>
            <img src="${u.pic}" class="lb-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=235E44&color=FFF1DA'" alt="">
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <span class="lb-name">${u.name}</span>
              <div class="lb-bar-wrap"><div class="lb-bar" style="width:${bar}%"></div></div>
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
  const amt  = document.getElementById('spend-amount').value;
  const bill = document.getElementById('bill-number').value;
  const pass = document.getElementById('staff-passcode').value;
  const msg  = document.getElementById('claim-message');
  const btn  = document.getElementById('claim-btn');
  if (!amt||!bill||!pass) return alert("All fields required.");
  btn.innerText = "Verifying…"; msg.style.display = "none";
  try {
    const res = await post({ action:'addPoints', lineId:userProfile.lineId, amount:amt, passcode:pass, billNumber:bill });
    msg.style.display = "block";
    if (res.status === "success") {
      msg.style.color = "#1A4D2E"; msg.innerText = res.message;
      userProfile.availableFootballs = res.newTotal;
      document.getElementById('user-footballs').innerText = fmt(res.newTotal);
      document.getElementById('spend-amount').value = document.getElementById('bill-number').value = document.getElementById('staff-passcode').value = "";
      setTimeout(toggleClaimForm, 2000);
    } else { msg.style.color="#C0392B"; msg.innerText=res.message; }
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
    document.getElementById("countdown-timer").innerHTML=`${d}d ${h}h ${m}m ${s}s`;
  }, 1000);
}
