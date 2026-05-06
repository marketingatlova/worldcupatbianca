// Replace this with your exact Google Apps Script URL from Step 2
const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID = "2009984765-j723B1C4"; 

let userProfile = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    startCountdown("June 12, 2026 02:00:00"); // First Match
});

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            fetchUserData(profile.userId, profile.displayName);
        } else {
            liff.login();
        }
    } catch (err) {
        console.error("LIFF failed", err);
    }
}

async function fetchUserData(lineId, displayName) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUser', lineId: lineId, displayName: displayName })
        });
        const data = await response.json();
        userProfile = { lineId, ...data };
        
        if (data.isRegistered) {
            showDashboard();
            fetchLeaderboard(); // Load the global scores
        } else {
            document.getElementById('auth-screen').classList.add('active');
        }
    } catch (error) { console.error("Error:", error); }
}

function showDashboard() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    
    document.getElementById('user-footballs').innerText = userProfile.availableFootballs || 0;
    document.getElementById('user-streak').innerText = userProfile.currentStreak || 0;
    
    let rank = "RESERVE";
    if (userProfile.currentStreak >= 3) rank = "CAPTAIN";
    if (userProfile.currentStreak >= 5) rank = "MVP";
    document.getElementById('user-rank').innerText = rank;
}

function verifyPhone() {
    const phone = document.getElementById('phone-input').value;
    if (phone.length < 9) return alert("Invalid number.");
    userProfile.isRegistered = true;
    showDashboard();
    fetchLeaderboard();
}

async function submitClaim() {
    const amount = document.getElementById('spend-amount').value;
    const passcode = document.getElementById('staff-passcode').value;
    const msg = document.getElementById('claim-message');
    const btn = document.getElementById('claim-btn');

    if (!amount || !passcode) return alert("Enter amount and passcode.");

    btn.innerText = "VERIFYING...";
    msg.style.display = "none";

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addPoints', lineId: userProfile.lineId, amount: amount, passcode: passcode })
        });
        const result = await res.json();
        
        msg.style.display = "block";
        if (result.status === "success") {
            msg.style.color = "#FAB31E";
            msg.innerText = result.message;
            document.getElementById('user-footballs').innerText = result.newTotal;
            document.getElementById('spend-amount').value = "";
            document.getElementById('staff-passcode').value = "";
        } else {
            msg.style.color = "#ff6b6b";
            msg.innerText = result.message;
        }
    } catch (e) { msg.style.display = "block"; msg.innerText = "Error."; }
    btn.innerText = "AUTHORIZE";
}

async function fetchLeaderboard() {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getLeaderboard' })
        });
        const users = await res.json();
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        
        users.forEach((u, index) => {
            list.innerHTML += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(35,94,68,0.5); padding: 8px 0; font-size: 0.85rem;">
                <span><span style="color: #FAB31E;">${index + 1}.</span> ${u.name}</span>
                <span class="mono">🔥${u.streak} | ${u.points} PTS</span>
            </div>`;
        });
    } catch (e) { console.error(e); }
}

function startCountdown(targetDate) {
    const countDownDate = new Date(targetDate).getTime();
    setInterval(function() {
        const now = new Date().getTime();
        const distance = countDownDate - now;
        if (distance < 0) {
            document.getElementById("countdown-timer").innerHTML = "KICKOFF!";
            return;
        }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById("countdown-timer").innerHTML = `${d}d ${h}h ${m}m ${s}s`;
    }, 1000);
}
