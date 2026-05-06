const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID = "2009984765-j723B1C4";

let userProfile      = null;
let currentMatchData = null;

/* ── Vote sheet state ── */
let voteTeamSide = null;
let votePoints   = 100;
const MIN_PTS    = 100;

/* ── Helpers ── */
const fmt     = (n) => Number(n).toLocaleString('en-US');
const post    = (body) => fetch(API_URL, { method:'POST', body: JSON.stringify(body) }).then(r => r.json());
const showEl  = (id, on) => { const el = document.getElementById(id); if(on) el.classList.add('active'); else el.classList.remove('active'); };

const FLAG = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Canada":"🇨🇦","Switzerland":"🇨🇭",
  "USA":"🇺🇸","Australia":"🇦🇺","Brazil":"🇧🇷","Morocco":"🇲🇦",
  "Germany":"🇩🇪","France":"🇫🇷","England":"🇬🇧","Spain":"🇪🇸",
  "Argentina":"🇦🇷","Portugal":"🇵🇹","Italy":"🇮🇹","Netherlands":"🇳🇱",
  "Japan":"🇯🇵","Croatia":"🇭🇷","Belgium":"🇧🇪","Denmark":"🇩🇰",
  "Colombia":"🇨🇴","Uruguay":"🇺🇾","Ghana":"🇬🇭","Chile":"🇨🇱",
  "Nigeria":"🇳🇬","Ecuador":"🇪🇨","Saudi Arabia":"🇸🇦","South Korea":"🇰🇷",
  "Senegal":"🇸🇳","Morocco":"🇲🇦","Curaçao":"🏳️"
};
const getFlag = (name) => FLAG[name] || "🏳️";


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


/* ══════════════════════════════════════════
   USER DATA + PHONE GATE
══════════════════════════════════════════ */
async function fetchUserData(lineId, displayName, pictureUrl) {
  try {
    const data = await post({ action:'getUser', lineId, displayName, pictureUrl });
    userProfile = { lineId, ...data };
    showEl('loading-screen', false);

    if (data.isRegistered) {
      // Has phone — go straight to dashboard
      showDashboard();
      fetchLeaderboard();
      fetchNextMatch();
    } else {
      // No phone on file — show registration gate
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
  if (phone.length < 9) {
    err.innerText = "Please enter a valid phone number (min 9 digits).";
    err.style.display = 'block';
    return;
  }

  btn.innerText = "Saving…";
  btn.disabled  = true;

  try {
    const result = await post({ action:'registerPhone', lineId: userProfile.lineId, phone });
    if (result.status === 'success') {
      userProfile.isRegistered       = true;
      userProfile.availableFootballs = result.availableFootballs;
      userProfile.currentStreak      = result.currentStreak;
      showEl('auth-screen', false);
      showDashboard();
      fetchLeaderboard();
      fetchNextMatch();
    } else {
      err.innerText = result.message || "Something went wrong.";
      err.style.display = 'block';
    }
  } catch {
    err.innerText = "Network error — please try again.";
    err.style.display = 'block';
  }

  btn.innerText = "Continue";
  btn.disabled  = false;
}


/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
function showDashboard() {
  showEl('auth-screen', false);
  showEl('dashboard-screen', true);
  const pts = userProfile.availableFootballs || 0;
  const str = userProfile.currentStreak || 0;
  document.getElementById('user-footballs').innerText = fmt(pts);
  document.getElementById('user-streak').innerText    = str;
  document.getElementById('user-rank').innerText      = str >= 5 ? 'MVP' : str >= 3 ? 'CAPTAIN' : 'RESERVE';
}


/* ══════════════════════════════════════════
   MATCH + VOTED STATE
══════════════════════════════════════════ */
async function fetchNextMatch() {
  try {
    const md = await post({ action:'getNextMatch', lineId: userProfile.lineId });
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
  const btnA      = document.getElementById('btn-teamA');
  const btnB      = document.getElementById('btn-teamB');
  const statusRow = document.getElementById('voted-status-row');
  const hintText  = document.getElementById('vote-hint-text');

  // Reset
  btnA.classList.remove('voted-for', 'voted-against');
  btnB.classList.remove('voted-for', 'voted-against');
  statusRow.classList.remove('show');

  if (!userVote) {
    // Not voted — normal tappable state
    hintText.innerText = "Tap a team flag to place your prediction";
    return;
  }

  // Apply voted styles
  if (userVote === teamA) {
    btnA.classList.add('voted-for');
    btnB.classList.add('voted-against');
  } else {
    btnB.classList.add('voted-for');
    btnA.classList.add('voted-against');
  }

  // Show status pill
  document.getElementById('voted-status-text').innerText = `You picked ${userVote}`;
  statusRow.classList.add('show');
  hintText.innerText = "You've placed your prediction for this match";
}

/* Tap handler — block if already voted */
function handleTeamTap(side) {
  if (!currentMatchData || currentMatchData.status !== "success") return;
  if (currentMatchData.userVote) return;  // already voted — do nothing
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

  refreshStepper();
  clearQuickPills();

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
  votePoints = next;
  refreshStepper();
  clearQuickPills();
}

function setPoints(amount) {
  const balance = userProfile?.availableFootballs || 0;
  if (amount > balance) return;
  votePoints = amount;
  refreshStepper();
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
  const pts          = votePoints;

  closeVoteSheet();

  try {
    const result = await post({ action:'submitVote', lineId: userProfile.lineId, matchName, team: selectedTeam, points: pts });
    if (result.status === "success") {
      userProfile.availableFootballs = result.newTotal;
      document.getElementById('user-footballs').innerText = fmt(result.newTotal);
      // Mark voted on match card immediately
      currentMatchData.userVote = selectedTeam;
      applyVotedState(selectedTeam, currentMatchData.teamA, currentMatchData.teamB);
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ ${result.message}`);
    }
  } catch { alert("Network error."); }
}


/* ══════════════════════════════════════════
   CLAIM
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
  btn.innerText = "Verifying…";
  msg.style.display = "none";

  try {
    const result = await post({ action:'addPoints', lineId: userProfile.lineId, amount, passcode, billNumber });
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
   LEADERBOARD — competitive bar display
══════════════════════════════════════════ */
async function fetchLeaderboard() {
  try {
    const users = await post({ action:'getLeaderboard' });
    const list  = document.getElementById('leaderboard-list');
    list.innerHTML = "";

    if (!users || users.length === 0) {
      list.innerHTML = '<p style="font-size:.78rem;color:rgba(26,77,46,.4);text-align:center;padding:8px 0;">No players yet</p>';
      return;
    }

    const medals     = ["🥇","🥈","🥉","4","5"];
    const posColors  = ["#E8A020","#9BA5B4","#B87333","rgba(26,77,46,.32)","rgba(26,77,46,.32)"];
    const maxPts     = users[0].points || 1;  // for bar scaling

    users.forEach((u, i) => {
      const barPct = Math.max(8, Math.round((u.points / maxPts) * 100));
      const isFirst = i === 0;
      list.innerHTML += `
        <div class="lb-row${isFirst ? ' lb-first' : ''}">
          <div class="lb-left">
            <span class="lb-pos" style="color:${posColors[i]}">${medals[i]}</span>
            <img src="${u.pic}" class="lb-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=235E44&color=FFF1DA'" alt="">
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <span class="lb-name">${u.name}</span>
              <div class="lb-bar-wrap">
                <div class="lb-bar" style="width:${barPct}%"></div>
              </div>
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
