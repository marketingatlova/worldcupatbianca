const API_URL   = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID   = "2009984765-j723B1C4";

let userProfile      = null;
let currentMatchData = null;

/* ── Vote sheet state ── */
let voteTeamSide = null;
let votePoints   = 100;
const STEP       = 100;
const MIN_PTS    = 100;

/* ── Helpers ── */
const fmt = (n) => Number(n).toLocaleString('en-US');

const FLAG = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Canada":"🇨🇦","Switzerland":"🇨🇭",
  "USA":"🇺🇸","Australia":"🇦🇺","Brazil":"🇧🇷","Morocco":"🇲🇦",
  "Germany":"🇩🇪","France":"🇫🇷","England":"🇬🇧","Spain":"🇪🇸",
  "Argentina":"🇦🇷","Portugal":"🇵🇹","Italy":"🇮🇹","Netherlands":"🇳🇱"
};
const getFlag = (name) => FLAG[name] || "🏳️";

/* ══════════════════════════════════════════
   LIFF & AUTH
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
    show('loading-screen', false);
    show('auth-screen', true);
  }
}

async function fetchUserData(lineId, displayName, pictureUrl) {
  try {
    const res  = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'getUser', lineId, displayName, pictureUrl }) });
    const data = await res.json();
    userProfile = { lineId, ...data };
    show('loading-screen', false);
    if (data.isRegistered) {
      showDashboard();
      fetchLeaderboard();
      fetchNextMatch();
    } else {
      show('auth-screen', true);
    }
  } catch {
    document.getElementById('loading-screen').innerHTML =
      '<span class="load-ball">⚠️</span><p class="load-text">Connection Error — Refresh</p>';
  }
}

function verifyPhone() {
  const phone = document.getElementById('phone-input').value;
  if (phone.length < 9) return alert("Invalid number.");
  userProfile = userProfile || {};
  userProfile.isRegistered = true;
  showDashboard();
  fetchLeaderboard();
  fetchNextMatch();
}

/* ── Screen helpers ── */
function show(id, on) {
  const el = document.getElementById(id);
  if (on) el.classList.add('active');
  else    el.classList.remove('active');
}

function showDashboard() {
  show('auth-screen', false);
  show('dashboard-screen', true);
  const pts = userProfile.availableFootballs || 0;
  const str = userProfile.currentStreak || 0;
  document.getElementById('user-footballs').innerText = fmt(pts);
  document.getElementById('user-streak').innerText    = str;
  document.getElementById('user-rank').innerText      = str >= 5 ? 'MVP' : str >= 3 ? 'CAPTAIN' : 'RESERVE';
}

/* ══════════════════════════════════════════
   MATCH
══════════════════════════════════════════ */
async function fetchNextMatch() {
  try {
    const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'getNextMatch' }) });
    currentMatchData = await res.json();
    if (currentMatchData.status === "success") {
      const d = new Date(currentMatchData.kickoff);
      document.getElementById('next-match-time').innerText =
        d.toLocaleString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      document.getElementById('name-a').innerText = currentMatchData.teamA;
      document.getElementById('flag-a').innerText = getFlag(currentMatchData.teamA);
      document.getElementById('name-b').innerText = currentMatchData.teamB;
      document.getElementById('flag-b').innerText = getFlag(currentMatchData.teamB);
      startCountdown(currentMatchData.kickoff);
    } else {
      document.getElementById('next-match-time').innerText = "Tournament Ended";
    }
  } catch(e) { console.error(e); }
}

/* ══════════════════════════════════════════
   VOTE BOTTOM SHEET
   openVoteSheet() — called only when a flag is tapped
══════════════════════════════════════════ */
function openVoteSheet(side) {
  if (!currentMatchData || currentMatchData.status !== "success") return;

  voteTeamSide = side;
  votePoints   = MIN_PTS;

  const teamName = side === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const balance  = userProfile?.availableFootballs || 0;

  document.getElementById('sheet-flag').innerText      = getFlag(teamName);
  document.getElementById('sheet-team-name').innerText = teamName.toUpperCase();
  document.getElementById('sheet-balance').innerText   = fmt(balance) + ' pts';

  refreshStepper();
  clearQuickPills();

  /* Show overlay + sheet */
  document.getElementById('vote-overlay').classList.add('open');
  document.getElementById('vote-sheet').classList.add('open');
  document.body.style.overflow = 'hidden';  /* prevent background scroll */
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
  if (next < MIN_PTS)   return;
  if (next > balance)   return;
  votePoints = next;
  refreshStepper();
  clearQuickPills();
}

function setPoints(amount) {
  const balance = userProfile?.availableFootballs || 0;
  if (amount > balance) return;
  votePoints = amount;
  refreshStepper();
  /* Highlight matching pill */
  document.querySelectorAll('.quick-pill').forEach(p => {
    const val = parseInt(p.innerText.replace(/,/g, ''));
    p.classList.toggle('active', val === amount);
  });
}

function refreshStepper() {
  const balance = userProfile?.availableFootballs || 0;
  document.getElementById('step-number').innerText = fmt(votePoints);
  const btn = document.getElementById('vote-confirm-btn');
  btn.disabled = (votePoints > balance || votePoints < MIN_PTS);
  /* Visual feedback on minus button */
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
  const pts          = votePoints;

  closeVoteSheet();

  try {
    const res    = await fetch(API_URL, { method:'POST', body: JSON.stringify({
      action: 'submitVote', lineId: userProfile.lineId, matchName, team: selectedTeam, points: pts
    })});
    const result = await res.json();
    if (result.status === "success") {
      const newTotal = result.newTotal;
      document.getElementById('user-footballs').innerText = fmt(newTotal);
      userProfile.availableFootballs = newTotal;
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ ${result.message}`);
    }
  } catch { alert("Network error."); }
}

/* ══════════════════════════════════════════
   CLAIM / ADD POINTS
══════════════════════════════════════════ */
function toggleClaimForm() {
  const f = document.getElementById('claim-form');
  f.style.display = (!f.style.display || f.style.display === 'none') ? 'block' : 'none';
}

async function submitClaim() {
  const amount     = document.getElementById('spend-amount').value;
  const billNumber = document.getElementById('bill-number').value;
  const passcode   = document.getElementById('staff-passcode').value;
  const msg        = document.getElementById('claim-message');
  const btn        = document.getElementById('claim-btn');

  if (!amount || !billNumber || !passcode) return alert("All fields are required.");
  btn.innerText     = "Verifying…";
  msg.style.display = "none";

  try {
    const res    = await fetch(API_URL, { method:'POST', body: JSON.stringify({
      action: 'addPoints', lineId: userProfile.lineId, amount, passcode, billNumber
    })});
    const result = await res.json();
    msg.style.display = "block";
    if (result.status === "success") {
      msg.style.color = "#1A4D2E";
      msg.innerText   = result.message;
      document.getElementById('user-footballs').innerText = fmt(result.newTotal);
      userProfile.availableFootballs = result.newTotal;
      document.getElementById('spend-amount').value   = "";
      document.getElementById('bill-number').value    = "";
      document.getElementById('staff-passcode').value = "";
      setTimeout(toggleClaimForm, 2000);
    } else {
      msg.style.color = "#C0392B";
      msg.innerText   = result.message;
    }
  } catch {
    msg.style.display = "block";
    msg.innerText = "Network error.";
  }
  btn.innerText = "Authorize Points";
}

/* ══════════════════════════════════════════
   LEADERBOARD
══════════════════════════════════════════ */
async function fetchLeaderboard() {
  try {
    const res   = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'getLeaderboard' }) });
    const users = await res.json();
    const list  = document.getElementById('leaderboard-list');
    list.innerHTML = "";

    const medals = ["🥇","🥈","🥉","4","5"];
    const colors  = ["#E8A020","#9BA5B4","#B87333","rgba(26,77,46,.32)","rgba(26,77,46,.32)"];

    users.forEach((u, i) => {
      list.innerHTML += `
        <div class="lb-row">
          <div class="lb-left">
            <span class="lb-pos" style="color:${colors[i]}">${medals[i]}</span>
            <img src="${u.pic}" class="lb-avatar" alt="">
            <span class="lb-name">${u.name}</span>
          </div>
          <span class="lb-score">🔥${u.streak} &nbsp;·&nbsp; ${fmt(u.points)} pts</span>
        </div>`;
    });
  } catch(e) { console.error(e); }
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
    const d = Math.floor(dist / 86400000);
    const h = Math.floor((dist % 86400000) / 3600000);
    const m = Math.floor((dist % 3600000) / 60000);
    const s = Math.floor((dist % 60000) / 1000);
    document.getElementById("countdown-timer").innerHTML = `${d}d ${h}h ${m}m ${s}s`;
  }, 1000);
}
