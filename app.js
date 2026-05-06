const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";
const LIFF_ID = "2009984765-j723B1C4"; 

let userProfile = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
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
        console.error("LIFF Initialization failed", err);
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
        } else {
            document.getElementById('auth-screen').classList.add('active');
        }
    } catch (error) {
        console.error("System Error:", error);
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
    if (phone.length < 9) {
        alert("Invalid format. Please enter a valid number.");
        return;
    }
    userProfile.isRegistered = true;
    userProfile.availableFootballs = 0; 
    showDashboard();
}

// NEW: The Logic to claim points
async function submitClaim() {
    const amount = document.getElementById('spend-amount').value;
    const passcode = document.getElementById('staff-passcode').value;
    const msgElement = document.getElementById('claim-message');
    const btn = document.getElementById('claim-btn');

    if (!amount || !passcode) {
        alert("Please enter both the amount and staff passcode.");
        return;
    }

    // Loading State
    btn.innerText = "VERIFYING...";
    msgElement.style.display = "none";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'addPoints', 
                lineId: userProfile.lineId, 
                amount: amount,
                passcode: passcode
            })
        });
        
        const result = await response.json();
        
        msgElement.style.display = "block";
        if (result.status === "success") {
            msgElement.style.color = "#D4AF37"; // Gold for success
            msgElement.innerText = result.message;
            document.getElementById('user-footballs').innerText = result.newTotal;
            
            // Clear inputs
            document.getElementById('spend-amount').value = "";
            document.getElementById('staff-passcode').value = "";
        } else {
            msgElement.style.color = "#ff6b6b"; // Red for error
            msgElement.innerText = result.message;
        }
    } catch (error) {
        msgElement.style.display = "block";
        msgElement.style.color = "#ff6b6b";
        msgElement.innerText = "Network Error. Please try again.";
    }
    
    btn.innerText = "VERIFY & ADD";
}
