const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID = "2009984765-j723B1C4"; 

let userProfile = null;
let currentMatchData = null;

const getFlagEmoji = (countryName) => {
    const flags = {
        "Mexico": "🇲🇽", "South Africa": "🇿🇦", "Canada": "🇨🇦", "Switzerland": "🇨🇭",
        "USA": "🇺🇸", "Australia": "🇦🇺", "Brazil": "🇧🇷", "Morocco": "🇲🇦",
        "Germany": "🇩🇪", "France": "🇫🇷", "England": "🇬🇧", "Spain": "🇪🇸",
        "Argentina": "🇦🇷", "Portugal": "🇵🇹", "Italy": "🇮🇹", "Netherlands": "🇳🇱"
    };
    return flags[countryName] || "🏳️";
};

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
});

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            fetchUserData(profile.userId, profile.displayName, profile.pictureUrl);
        } else {
            liff.login();
        }
    } catch (err) {
        document.getElementById('loading-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
    }
}

async function fetchUserData(lineId, displayName, pictureUrl) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUser', lineId: lineId, displayName: displayName, pictureUrl: pictureUrl })
        });
        const data = await response.json();
        userProfile = { lineId, ...data };
        
        document.getElementById('loading-screen').classList.remove('active');

        if (data.isRegistered) {
            showDashboard();
            fetchLeaderboard();
            fetchNextMatch(); 
        } else {
            document.getElementById('auth-screen').classList.add('active');
        }
    } catch (error) { 
        document.getElementById('loading-screen').innerHTML = "<h3 style='color:red;'>CONNECTION ERROR</h3><p>Please refresh.</p>";
    }
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
    fetchNextMatch();
}

async function fetchNextMatch() {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getNextMatch' })
        });
        currentMatchData = await res.json();
        
        if (currentMatchData.status === "success") {
            const dateObj = new Date(currentMatchData.kickoff);
            document.getElementById('next-match-time').innerText = dateObj.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});
            
            document.getElementById('name-a').innerText = currentMatchData.teamA;
            document.getElementById('flag-a').innerText = getFlagEmoji(currentMatchData.teamA);
            
            document.getElementById('name-b').innerText = currentMatchData.teamB;
            document.getElementById('flag-b').innerText = getFlagEmoji(currentMatchData.teamB);

            startCountdown(currentMatchData.kickoff);
        } else {
            document.getElementById('next-match-time').innerText = "Tournament Ended";
        }
    } catch (e) { console.error(e); }
}

async function castVote(teamSide) {
    if (!currentMatchData || currentMatchData.status !== "success") return;
    
    const selectedTeam = teamSide === 'teamA' ? currentMatchData.teamA : currentMatchData.teamB;
    const matchName = `${currentMatchData.teamA} vs ${currentMatchData.teamB}`;
    
    // Updated prompt for 100 points
    if (!confirm(`Spend 100 Points to vote for ${selectedTeam}?`)) return;

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'submitVote', lineId: userProfile.lineId, matchName: matchName, team: selectedTeam 
            })
        });
        const result = await res.json();
        
        if (result.status === "success") {
            alert(`✅ ${result.message}`);
            document.getElementById('user-footballs').innerText = result.newTotal;
            userProfile.availableFootballs = result.newTotal;
        } else {
            alert(`❌ ${result.message}`);
        }
    } catch (e) { alert("Network error processing vote."); }
}

function toggleClaimForm() {
    const form = document.getElementById('claim-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function submitClaim() {
    const amount = document.getElementById('spend-amount').value;
    const billNumber = document.getElementById('bill-number').value;
    const passcode = document.getElementById('staff-passcode').value;
    const msg = document.getElementById('claim-message');
    const btn = document.getElementById('claim-btn');

    if (!amount || !billNumber || !passcode) return alert("All fields are required.");

    btn.innerText = "VERIFYING...";
    msg.style.display = "none";

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addPoints', lineId: userProfile.lineId, amount: amount, passcode: passcode, billNumber: billNumber })
        });
        const result = await res.json();
        
        msg.style.display = "block";
        if (result.status === "success") {
            msg.style.color = "#235E44"; 
            msg.innerText = result.message;
            document.getElementById('user-footballs').innerText = result.newTotal;
            userProfile.availableFootballs = result.newTotal;
            
            document.getElementById('spend-amount').value = "";
            document.getElementById('bill-number').value = "";
            document.getElementById('staff-passcode').value = "";
            setTimeout(() => toggleClaimForm(), 2000); 
        } else {
            msg.style.color = "#ff6b6b";
            msg.innerText = result.message;
        }
    } catch (e) { msg.style.display = "block"; msg.innerText = "Error."; }
    btn.innerText = "AUTHORIZE POINTS";
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
        
        const medals = ["🥇", "🥈", "🥉", "4.", "5."];

        users.forEach((u, index) => {
            list.innerHTML += `
            <div class="lb-row">
                <div class="lb-left">
                    <span class="lb-rank" style="color: ${index < 3 ? '#FAB31E' : '#235E44'};">${medals[index]}</span>
                    <img src="${u.pic}" class="lb-avatar" alt="pic">
                    <span class="lb-name">${u.name}</span>
                </div>
                <span class="mono" style="font-size: 0.8rem; font-weight: 600;">🔥${u.streak} | ${u.points} PTS</span>
            </div>`;
        });
    } catch (e) { console.error(e); }
}

let countdownInterval;
function startCountdown(targetDate) {
    if (countdownInterval) clearInterval(countdownInterval);
    const countDownDate = new Date(targetDate).getTime();
    
    countdownInterval = setInterval(function() {
        const now = new Date().getTime();
        const distance = countDownDate - now;
        if (distance < 0) {
            clearInterval(countdownInterval);
            document.getElementById("countdown-timer").innerHTML = "MATCH IN PROGRESS";
            return;
        }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById("countdown-timer").innerHTML = `${d}d ${h}h ${m}m ${s}s`;
    }, 1000);
}
