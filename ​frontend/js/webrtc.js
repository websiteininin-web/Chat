// --- PREMIUM WEBRTC.JS (ON-DEMAND MEDIA & CHAT) ---

let pc;
let dataChannel;
let localStream;

// Google ke Free STUN Servers (Alag-alag network par connect karne ke liye)
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// 1. WebRTC Connection Initialize Karna (Ye main.js se call hoga)
window.initWebRTC = function() {
    pc = new RTCPeerConnection(configuration);

    // Agar hum initiator hain, toh Data Channel (Chat ke liye) banayenge
    if (isInitiator) {
        dataChannel = pc.createDataChannel('anonymous-chat');
        setupDataChannel(dataChannel);
    } else {
        // Dost ke side par Data Channel receive hoga
        pc.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }

    // --- RENEGOTIATION MAGIC (For On-Demand Video/Audio) ---
    pc.onnegotiationneeded = async () => {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', pc.localDescription, currentRoomId);
        } catch (err) {
            console.error("Negotiation Error:", err);
        }
    };

    // --- ICE CANDIDATES HANDLE KARNA ---
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };

    // --- REMOTE VIDEO/AUDIO RECEIVE KARNA ---
    pc.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        document.getElementById('video-section').style.display = "flex";
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
    };
};

// 2. SIGNALING SERVER SE DATA RECEIVE KARNA
socket.on('offer', async (offer) => {
    if (!pc) initWebRTC();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', pc.localDescription, currentRoomId);
});

socket.on('answer', async (answer) => {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding ICE candidate', e);
    }
});

// ---------------------------------------------------------
// 3. ON-DEMAND CAMERA & MIC PERMISSIONS
// ---------------------------------------------------------
document.getElementById('start-video-btn').addEventListener('click', async () => {
    try {
        // Tabhi permission mangega jab ye button click hoga
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('video-section').style.display = "flex";
        
        // Tracks ko connection me add karo (Ye automatic samne wale ko video bhej dega)
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        document.getElementById('start-video-btn').disabled = true;
    } catch (err) {
        alert("Camera/Mic permission denied! Please allow access.");
    }
});

document.getElementById('start-voice-btn').addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        document.getElementById('start-voice-btn').disabled = true;
    } catch (err) {
        alert("Mic permission denied!");
    }
});

// ---------------------------------------------------------
// 4. DATA CHANNEL (CHAT & FILE SHARING FIX)
// ---------------------------------------------------------
function setupDataChannel(channel) {
    channel.onopen = () => console.log("Data Channel is OPEN!");
    
    channel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        displayMessage("Peer", data.content, data.type);
        
        // Agar backup on hai toh save karo
        if (window.saveMessageLocally) window.saveMessageLocally("Peer", data);
    };
}

// Message bhejne ka logic
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('message-input');
    const msg = input.value.trim();
    
    if (msg && dataChannel && dataChannel.readyState === "open") {
        const payload = { type: 'text', content: msg };
        
        // Data channel ke through bhejo
        dataChannel.send(JSON.stringify(payload));
        displayMessage("You", msg, "text");
        
        if (window.saveMessageLocally) window.saveMessageLocally("You", payload);
        input.value = "";
    }
}

// File bhejne ka logic (Storage access without extra permissions)
document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && dataChannel && dataChannel.readyState === "open") {
        const reader = new FileReader();
        
        // File ko Base64 URL me convert karke bhej rahe hain
        reader.onload = (e) => {
            const fileData = e.target.result;
            const payload = { type: 'file', content: fileData, fileName: file.name };
            
            dataChannel.send(JSON.stringify(payload));
            displayMessage("You", fileData, "file", file.name);
            
            if (window.saveMessageLocally) window.saveMessageLocally("You", payload);
        };
        reader.readAsDataURL(file);
    }
});

// UI me message dikhane ka function
function displayMessage(sender, content, type, fileName = "") {
    const box = document.getElementById('messages-box');
    const msgElement = document.createElement('div');
    msgElement.style.margin = "10px 0";
    msgElement.style.padding = "10px";
    msgElement.style.borderRadius = "8px";
    msgElement.style.maxWidth = "80%";
    
    if (sender === "You") {
        msgElement.style.background = "#005c4b";
        msgElement.style.marginLeft = "auto"; // Right side align
    } else {
        msgElement.style.background = "#202c33";
    }

    if (type === "text") {
        msgElement.innerHTML = `<strong>${sender}:</strong> ${content}`;
    } else if (type === "file") {
        // Agar Image hai toh render karo, warna Download link do
        if (content.startsWith('data:image')) {
            msgElement.innerHTML = `<strong>${sender}:</strong><br><img src="${content}" style="max-width: 100%; border-radius: 5px; margin-top: 5px;">`;
        } else {
            msgElement.innerHTML = `<strong>${sender} sent a file:</strong><br><a href="${content}" download="${fileName}" style="color: #4dabf7;">💾 Download ${fileName}</a>`;
        }
    }
    
    box.appendChild(msgElement);
    box.scrollTop = box.scrollHeight; // Auto-scroll to bottom
}

