const API_URL   = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID   = "2009984765-j723B1C4";

let userProfile      = null;
let currentMatchData = null;

// ── Vote sheet state ──────────────────────────────
let voteTeamSide   = null;   // 'teamA' | 'teamB'
let votePoints     = 100;
const STEP         = 100;
const MIN_POINTS   = 100;

// ── Helpers ───────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString('en-US');   // 5398 → "5,398"

const getFlagEmoji = (name) => ({
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Canada":"🇨🇦","Switzerland":"🇨🇭",
  "USA":"🇺🇸","Australia":"🇦🇺","Brazil":"🇧🇷","Morocco":"🇲🇦",
  "Germany":"🇩🇪","France":"🇫🇷","England":"🇬🇧","Spain":"🇪🇸",
  "Argentina":"🇦🇷","Portugal":"🇵🇹","Italy":"🇮🇹","Netherlands":"🇳🇱"
}[name] || "🏳️");

// ── LIFF init ─────────────────────────────────────
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
    document.getElementById('loading-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
  }
}

async function fetchUserData(lineId, displayName, pictureUrl) {
  try {
    const res  = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'getUser', lineId, displayName, pictureUrl }) });
    const data = await res.json();
    userProfile = { lineId, ...data };
    document.getElementById('loading-screen').classList.remove('active');
    if (data.isRegistered) { showDashboard(); fetchLeaderboard(); fetchNextMatch(); }
    else document.getElementById('auth-screen').classList.add('active');
  } catch {
    document.getElementById('loading-screen').innerHTML =
      `<div class="load-ball">⚠️</div><p class="load-text">Connection Error — Refresh</p>`;
  }
}

function showDashboard() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('dashboard-screen').classList.add('active');
  const pts = userProfile.availableFootballs || 0;
  const s   = userProfile.currentStreak || 0;
  document.getElementById('user-footballs').innerText = fmt(pts);
  document.getElementById('user-streak').innerText    = s;
  document.getElementById('user-rank').innerText      = s >= 5 ? 'MVP' : s >= 3 ? 'CAPTAIN' : 'RESERVE';
}

function verifyPhone() {
  const phone = document.getElementById('phone-input').value;
  if (phone.length < 9) return alert("Invalid number.");
  userProfile.isRegistered = true;
  showDashboard(); fetchLeaderboard(); fetchNextMatch();
}

// ── Match ─────────────────────────────────────────
async function fetchNextMatch() {
  try {
    const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'getNextMatch' }) });
    currentMatchData = await res.json();
    if (currentMatchData.status === "success") {
      const d = new Date(currentMatchData.kickoff);
      document.getElementById('next-match-time').innerText =
        d.toLocaleString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      document.getElementById('name-a').innerText = currentMatchData.teamA;
      document.getElementById('flag-a').innerText = getFlagEmoji(currentMatchData.teamA);
      document.getElementById('name-b').innerText = currentMatchData.teamB;
      document.getElementById('flag-b').innerText = getFlagEmoji(currentMatchData.teamB);
      startCountdown(currentMatchData.kickoff);
    } else {
      document.getElementById('next-match-time').innerText = "Tournament Ended";
    }
  } catch(e) { console.error(e); }
}

// ── Vote sheet ────────────────────────────────────
function openVoteSheet(teamSide) {
  if (!currentMatchData || currentMatchData.status !== "success") return;
  voteTeamSide = teamSide;
  votePoints   = MIN_POINTS;

  const teamName = teamSide === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const flag     = getFlagEmoji(teamName);
  const balance  = userProfile?.availableFootballs || 0;

  document.getElementById('sheet-flag').innerText      = flag;
  document.getElementById('sheet-team-name').innerText = teamName.toUpperCase();
  document.getElementById('sheet-balance').innerText   = fmt(balance) + ' pts';
  refreshStepper();

  document.getElementById('vote-overlay').classList.add('open');
  document.getElementById('vote-sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVoteSheet() {
  document.getElementById('vote-overlay').classList.remove('open');
  document.getElementById('vote-sheet').classList.remove('open');
  document.body.style.overflow = '';
  // Clear quick pill highlights
  document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
}

function adjustPoints(delta) {
  const balance = userProfile?.availableFootballs || 0;
  const newVal  = votePoints + delta;
  if (newVal < MIN_POINTS) return;
  if (newVal > balance)    return;
  votePoints = newVal;
  refreshStepper();
  document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
}

function setPoints(amount) {
  const balance = userProfile?.availableFootballs || 0;
  if (amount > balance) return;
  votePoints = amount;
  refreshStepper();
  // Highlight matching pill
  document.querySelectorAll('.quick-pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.innerText.replace(/,/g,'')) === amount);
  });
}

function refreshStepper() {
  const balance = userProfile?.availableFootballs || 0;
  document.getElementById('step-number').innerText = fmt(votePoints);
  const btn = document.getElementById('vote-confirm-btn');
  btn.disabled = votePoints > balance || votePoints < MIN_POINTS;
  // Dim minus button at minimum
  const minusBtn = document.querySelector('.step-btn');
  if (minusBtn) minusBtn.style.opacity = votePoints <= MIN_POINTS ? '0.3' : '1';
}

async function confirmVote() {
  if (!voteTeamSide || !currentMatchData) return;
  const selectedTeam = voteTeamSide === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
  const matchName    = `${currentMatchData.teamA} vs ${currentMatchData.teamB}`;
  closeVoteSheet();
  try {
    const res    = await fetch(API_URL, { method:'POST', body: JSON.stringify({
      action: 'submitVote', lineId: userProfile.lineId, matchName, team: selectedTeam, points: votePoints
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

// ── Legacy castVote (kept in case sheet is bypassed) ──
async function castVote(teamSide) { openVoteSheet(teamSide); }

// ── Claim ─────────────────────────────────────────
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
  btn.innerText      = "Verifying…";
  msg.style.display  = "none";
  try {
    const res    = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'addPoints', lineId: userProfile.lineId, amount, passcode, billNumber }) });
    const result = await res.json();
    msg.style.display = "block";
    if (result.status === "success") {
      msg.style.color = "#1A4D2E";
      msg.innerText   = result.message;
      const newTotal  = result.newTotal;
      document.getElementById('user-footballs').innerText = fmt(newTotal);
      userProfile.availableFootballs = newTotal;
      document.getElementById('spend-amount').value   = "";
      document.getElementById('bill-number').value    = "";
      document.getElementById('staff-passcode').value = "";
      setTimeout(toggleClaimForm, 2000);
    } else {
      msg.style.color = "#C0392B";
      msg.innerText   = result.message;
    }
  } catch { msg.style.display = "block"; msg.innerText = "Network error."; }
  btn.innerText = "Authorize Points";
}

// ── Leaderboard ───────────────────────────────────
async function fetchLeaderboard() {
  try {
    const res   = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'getLeaderboard' }) });
    const users = await res.json();
    const list  = document.getElementById('leaderboard-list');
    list.innerHTML = "";
    const medals = ["🥇","🥈","🥉","4","5"];
    const colors  = ["#E8A020","#9BA5B4","#B87333","rgba(26,77,46,.35)","rgba(26,77,46,.35)"];
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

// ── Countdown ─────────────────────────────────────
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
    const m = Math.floor((dist % 3600000)  / 60000);
    const s = Math.floor((dist % 60000)    / 1000);
    document.getElementById("countdown-timer").innerHTML = `${d}d ${h}h ${m}m ${s}s`;
  }, 1000);
}
