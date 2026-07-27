let pc;
let dataChannel;
let localStream;
let iceCandidateQueue = []; 

// 🟢 NAYA: STUN + TURN Servers (Jio/Airtel/Wi-Fi Har Jagah Chalne Ke Liye)
const configuration = {
    iceServers: [
        // 1. Google ke STUN Servers (Direct Raste ke liye)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // 2. 🚀 FREE TURN SERVER (Agar direct rasta block ho jaye toh iska use hoga)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

window.initWebRTC = async function() {
    pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, window.currentRoomId);
        }
    };

    pc.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        document.getElementById('video-section').style.display = "flex";
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    if (window.isInitiator) {
        dataChannel = pc.createDataChannel('anonymous-chat');
        setupDataChannel(dataChannel);
        
        // 🟢 MANUAL OFFER (Crash nahi hoga)
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', pc.localDescription, window.currentRoomId);
        } catch (err) {
            console.error("Offer Error:", err);
        }
    } else {
        pc.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }
};

// 🟢 JAB CALL BUTTON DABEGA TAB YE FUNCTION CHALEGA
async function renegotiate() {
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', pc.localDescription, window.currentRoomId);
    } catch (err) {
        console.error("Renegotiation Error:", err);
    }
}

socket.on('offer', async (offer) => {
    if (!pc) await window.initWebRTC(); 
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        while(iceCandidateQueue.length) {
            await pc.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.shift()));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', pc.localDescription, window.currentRoomId);
    } catch (e) {
        console.error("Offer Receive Error:", e);
    }
});

socket.on('answer', async (answer) => {
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        while(iceCandidateQueue.length) {
            await pc.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.shift()));
        }
    } catch (e) {
        console.error("Answer Error:", e);
    }
});

socket.on('ice-candidate', async (candidate) => {
    if (!pc || !pc.remoteDescription) {
        iceCandidateQueue.push(candidate);
    } else {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('ICE Error', e);
        }
    }
});

function setupDataChannel(channel) {
    channel.onopen = () => {
        if (window.unlockUI) window.unlockUI();
    };
    
    channel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        displayMessage("Peer", data.content, data.type, data.fileName);
        if (window.saveMessageLocally) window.saveMessageLocally("Peer", data);
    };
}

// ---- MESSAGE & FILE SENDING ----
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('message-input');
    const msg = input.value.trim();
    
    if (msg && dataChannel && dataChannel.readyState === "open") {
        const payload = { type: 'text', content: msg };
        dataChannel.send(JSON.stringify(payload));
        displayMessage("You", msg, "text");
        if (window.saveMessageLocally) window.saveMessageLocally("You", payload);
        input.value = "";
    }
}

document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && dataChannel && dataChannel.readyState === "open") {
        const reader = new FileReader();
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

// ---- CALL PERMISSIONS & RENEGOTIATION ----
document.getElementById('start-video-btn').addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('video-section').style.display = "flex";
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        document.getElementById('start-video-btn').style.display = "none";
        
        renegotiate(); // 🟢 CALL CHALU KARNE KA SIGNAL BEJNA
    } catch (err) {
        alert("Camera/Mic permission denied!");
    }
});

document.getElementById('start-voice-btn').addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        document.getElementById('start-voice-btn').style.display = "none";
        
        renegotiate(); // 🟢 VOICE CHALU KARNE KA SIGNAL
    } catch (err) {
        alert("Mic permission denied!");
    }
});

function displayMessage(sender, content, type, fileName = "") {
    const box = document.getElementById('messages-box');
    const msgElement = document.createElement('div');
    msgElement.style.margin = "10px 0";
    msgElement.style.padding = "10px";
    msgElement.style.borderRadius = "8px";
    msgElement.style.maxWidth = "80%";
    msgElement.style.wordWrap = "break-word";
    
    if (sender === "You") {
        msgElement.style.background = "#005c4b";
        msgElement.style.marginLeft = "auto";
    } else {
        msgElement.style.background = "#202c33";
    }

    if (type === "text") {
        msgElement.innerHTML = `<strong>${sender}:</strong> ${content}`;
    } else if (type === "file") {
        if (content.startsWith('data:image')) {
            msgElement.innerHTML = `<strong>${sender}:</strong><br><img src="${content}" style="max-width: 100%; border-radius: 5px; margin-top: 5px;">`;
        } else {
            msgElement.innerHTML = `<strong>${sender} sent a file:</strong><br><a href="${content}" download="${fileName}" style="color: #4dabf7;">💾 Download ${fileName}</a>`;
        }
    }
    
    box.appendChild(msgElement);
    box.scrollTop = box.scrollHeight; 
}
