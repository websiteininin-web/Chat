// --- PREMIUM MAIN.JS ---
const socket = io("https://chat-vx5l.onrender.com");

// 1. UI Elements ko pakadna
const setupSection = document.getElementById('setup-section');
const createRoomBtn = document.getElementById('create-room-btn');
const roomInfo = document.getElementById('room-info');
const roomLinkDisplay = document.getElementById('room-link-display');
const roomPasswordDisplay = document.getElementById('room-password-display');

const joinSection = document.getElementById('join-section');
const joinPasswordInput = document.getElementById('join-password');
const joinRoomBtn = document.getElementById('join-room-btn');

const mediaControls = document.getElementById('media-controls');
const chatSection = document.getElementById('chat-section');
const videoSection = document.getElementById('video-section');
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const statusIcon = document.getElementById('status-icon');
const saveChatToggle = document.getElementById('save-chat-toggle');

// 2. Global Variables
let currentRoomId = null;
let roomPassword = null; // Ye password Crypto key ka kaam karega
let isInitiator = false;

// ---------------------------------------------------------
// 3. ROOM BANANE KA LOGIC (Creator)
// ---------------------------------------------------------
createRoomBtn.addEventListener('click', () => {
    currentRoomId = Math.random().toString(36).substring(2, 10);
    roomPassword = Math.floor(1000 + Math.random() * 9000).toString(); // 4-Digit Random PIN
    isInitiator = true;

    const roomLink = window.location.origin + window.location.pathname + "?room=" + currentRoomId;

    roomLinkDisplay.innerText = roomLink;
    roomPasswordDisplay.innerText = roomPassword;
    
    createRoomBtn.style.display = "none";
    roomInfo.style.display = "block";
    connectionStatus.style.display = "block";
    
    // Server ko join karne ka signal bhejo
    socket.emit('join-room', currentRoomId, socket.id);
});

// ---------------------------------------------------------
// 4. ROOM JOIN KARNE KA LOGIC (Friend)
// ---------------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
const joinedRoom = urlParams.get('room');

if (joinedRoom) {
    currentRoomId = joinedRoom;
    isInitiator = false;
    
    // Setup hatao, Password box dikhao
    setupSection.style.display = "none";
    joinSection.style.display = "block"; 
}

joinRoomBtn.addEventListener('click', () => {
    const enteredPassword = joinPasswordInput.value.trim();
    if (!enteredPassword) {
        alert("⚠️ Please enter the Room Password!");
        return;
    }
    
    roomPassword = enteredPassword; // Password save kar liya decryption ke liye
    joinSection.style.display = "none";
    connectionStatus.style.display = "block";
    statusText.innerText = "Connecting to peer...";

    // Server ko join karne ka signal bhejo
    socket.emit('join-room', currentRoomId, socket.id);
});

// ---------------------------------------------------------
// 5. CONNECTION SUCCESS & UI UPDATE
// ---------------------------------------------------------
socket.on('user-connected', (userId) => {
    // Green Connected Dot
    statusIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    statusIcon.style.color = "#28a745"; 
    statusText.innerText = "Connected Securely! 🟢";
    statusText.style.color = "#28a745";

    // Call Buttons aur Chat box dikhao
    mediaControls.style.display = "block";
    chatSection.style.display = "block";
    
    // Yahan hum webrtc connection shuru karenge (magar camera permission nahi mangenge)
    if (isInitiator && typeof initWebRTC === "function") {
        initWebRTC();
    }
});

// ---------------------------------------------------------
// 6. 1000% ANONYMOUS vs SAVE LOCALLY LOGIC
// ---------------------------------------------------------
saveChatToggle.addEventListener('change', () => {
    if (!saveChatToggle.checked) {
        // Agar untick kiya, toh browser ki memory turant permanently delete
        localStorage.removeItem(`chat_${currentRoomId}`);
        alert("🛡️ 1000% Anonymous Mode ON: Chat history deleted from your device.");
    } else {
        alert("💾 Save Mode ON: Chat will be saved locally on your phone/PC.");
    }
});

// Message backup function (Iska use webrtc.js me hoga)
window.saveMessageLocally = function(sender, message) {
    if (!saveChatToggle.checked) return; // Agar anonymous hai toh save mat karo
    
    let history = JSON.parse(localStorage.getItem(`chat_${currentRoomId}`)) || [];
    history.push({ sender, message });
    localStorage.setItem(`chat_${currentRoomId}`, JSON.stringify(history));
};
