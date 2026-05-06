// Hardcoded to your exact Google Sheet engine
const API_URL = "https://script.google.com/macros/s/AKfycbxszwMiMyv94ERtlM7vp8i0FJ4Jg81BWXj6_dQm8u3yA_Y8su2CIngGqPIHV9EW2Bhe/exec";

// Your real Bianca LIFF ID
const LIFF_ID = "2009984765-j723B1C4"; 

let userProfile = null;

// Initialize the app the moment it loads
document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
});

// The secure LINE connection
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            // Send their LINE ID to your Google Sheet to check their status
            fetchUserData(profile.userId, profile.displayName);
        } else {
            // Force login if opened outside the LINE app
            liff.login();
        }
    } catch (err) {
        console.error("LIFF Initialization failed", err);
    }
}

// Talk to your Google Apps Script
async function fetchUserData(lineId, displayName) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'getUser', 
                lineId: lineId, 
                displayName: displayName 
            })
        });
        
        const data = await response.json();
        userProfile = { lineId, ...data };
        
        // Router Logic: Phone Verification vs Dashboard
        if (data.isRegistered) {
            showDashboard();
        } else {
            document.getElementById('auth-screen').classList.add('active');
        }
    } catch (error) {
        console.error("System Error:", error);
    }
}

// Display the main UI
function showDashboard() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    
    // Injecting data from your Google Sheet into the UI
    document.getElementById('user-footballs').innerText = userProfile.availableFootballs || 0;
    document.getElementById('user-streak').innerText = userProfile.currentStreak || 0;
    
    // Dynamic Ranking System
    let rank = "RESERVE";
    if (userProfile.currentStreak >= 3) rank = "CAPTAIN";
    if (userProfile.currentStreak >= 5) rank = "MVP";
    document.getElementById('user-rank').innerText = rank;
}

// Temporary UI verification (Backend logic to save this to Sheets comes in Phase 3)
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
