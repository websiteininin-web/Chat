const socket = io("https://chat-vx5l.onrender.com");

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
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const statusIcon = document.getElementById('status-icon');
const saveChatToggle = document.getElementById('save-chat-toggle');

// 🟢 GLOBAL VARIABLES (Taaki webrtc.js inhe easily padh sake)
window.currentRoomId = null;
window.roomPassword = null;
window.isInitiator = false;

window.unlockUI = function() {
    statusIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    statusIcon.style.color = "#28a745"; 
    statusText.innerText = "Connected Securely! 🟢";
    statusText.style.color = "#28a745";

    mediaControls.style.display = "block";
    chatSection.style.display = "block";
};

createRoomBtn.addEventListener('click', () => {
    window.currentRoomId = Math.random().toString(36).substring(2, 10);
    window.roomPassword = Math.floor(1000 + Math.random() * 9000).toString();
    window.isInitiator = true;

    const roomLink = window.location.origin + window.location.pathname + "?room=" + window.currentRoomId;

    roomLinkDisplay.innerText = roomLink;
    roomPasswordDisplay.innerText = window.roomPassword;
    
    createRoomBtn.style.display = "none";
    roomInfo.style.display = "block";
    connectionStatus.style.display = "block";
    
    socket.emit('join-room', window.currentRoomId, socket.id);
});

const urlParams = new URLSearchParams(window.location.search);
const joinedRoom = urlParams.get('room');

if (joinedRoom) {
    window.currentRoomId = joinedRoom;
    window.isInitiator = false;
    setupSection.style.display = "none";
    joinSection.style.display = "block"; 
}

joinRoomBtn.addEventListener('click', () => {
    const enteredPassword = joinPasswordInput.value.trim();
    if (!enteredPassword) {
        alert("⚠️ Please enter the Room Password!");
        return;
    }
    
    window.roomPassword = enteredPassword; 
    joinSection.style.display = "none";
    connectionStatus.style.display = "block";
    statusText.innerText = "Connecting to peer...";

    socket.emit('join-room', window.currentRoomId, socket.id);
});

socket.on('user-connected', (userId) => {
    if (window.isInitiator && typeof window.initWebRTC === "function") {
        statusText.innerText = "Friend found, establishing secure P2P...";
        window.initWebRTC();
    }
});

saveChatToggle.addEventListener('change', () => {
    if (!saveChatToggle.checked) {
        localStorage.removeItem(`chat_${window.currentRoomId}`);
        alert("🛡️ 1000% Anonymous Mode ON: Chat history deleted.");
    } else {
        alert("💾 Save Mode ON: Chat will be saved locally.");
    }
});

window.saveMessageLocally = function(sender, message) {
    if (!saveChatToggle.checked) return;
    let history = JSON.parse(localStorage.getItem(`chat_${window.currentRoomId}`)) || [];
    history.push({ sender, message });
    localStorage.setItem(`chat_${window.currentRoomId}`, JSON.stringify(history));
};

