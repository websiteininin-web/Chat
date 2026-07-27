// 1. Signaling Server se connect karna
const socket = io("http://localhost:3000");

// HTML ke Buttons aur Sections ko pakadna
const createRoomBtn = document.getElementById('create-room-btn');
const roomLinkDisplay = document.getElementById('room-link-display');
const setupSection = document.getElementById('setup-section');
const videoSection = document.getElementById('video-section');
const chatSection = document.getElementById('chat-section');

let currentRoomId = null;
let isInitiator = false;

// 2. Room Banane ka Logic (Jab "Create Room" button dabega)
createRoomBtn.addEventListener('click', () => {
    // Ek random secret Room ID generate karna
    currentRoomId = Math.random().toString(36).substring(2, 10);
    isInitiator = true; 
    
    // Dost ko bhejne ke liye Link banana
    const roomLink = window.location.origin + window.location.pathname + "?room=" + currentRoomId;
    roomLinkDisplay.innerHTML = `Send this secret link to your friend:<br><br><b>${roomLink}</b>`;
    
    // Server ko batana ki is naye room me join kar lo
    socket.emit('join-room', currentRoomId, socket.id);
    
    // Chat aur Video UI dikhana
    videoSection.style.display = "flex";
    chatSection.style.display = "flex";
    
    // Call Start karne ka function
    if (typeof initWebRTC === "function") initWebRTC();
});

// 3. Link se Join karne ka Logic (Jab Dost link open karega)
const urlParams = new URLSearchParams(window.location.search);
const joinedRoom = urlParams.get('room');

if (joinedRoom) {
    currentRoomId = joinedRoom;
    isInitiator = false;
    
    // Link banane wala button hata do
    setupSection.style.display = "none";
    
    // Server ko batana ki is room me join kar lo
    socket.emit('join-room', currentRoomId, socket.id);
    
    // Chat aur Video UI dikhana
    videoSection.style.display = "flex";
    chatSection.style.display = "flex";
    
    // Call Start karne ka function
    if (typeof initWebRTC === "function") initWebRTC();
}
