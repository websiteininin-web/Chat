let pc;
let dataChannel;
let localStream;
let iceCandidateQueue = []; // 🟢 RACE CONDITION FIX: Rasta bacha kar rakhne ke liye!

// 🟢 5 Google STUN Servers add kiye taaki Mobile Data par bhi easily connect ho
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};

window.initWebRTC = async function() {
    pc = new RTCPeerConnection(configuration);

    if (isInitiator) {
        // Creator channel banayega
        dataChannel = pc.createDataChannel('anonymous-chat');
        setupDataChannel(dataChannel);
        
        // 🟢 EXPLICIT OFFER: Ab hum connection ka wait nahi karenge, direct request bhejenge
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', pc.localDescription, currentRoomId);
        } catch (err) {
            console.error("Error creating initial offer:", err);
        }
    } else {
        // Joiner channel receive karega
        pc.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }

    // Video/Voice on karne ke liye backup logic
    pc.onnegotiationneeded = async () => {
        try {
            if (pc.signalingState !== "stable") return;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', pc.localDescription, currentRoomId);
        } catch (err) {
            console.error("Negotiation Error:", err);
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };

    pc.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        document.getElementById('video-section').style.display = "flex";
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
    };
};

socket.on('offer', async (offer) => {
    if (!pc) await window.initWebRTC(); 
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // 🟢 Agar ICE candidates pehle aa gaye the, toh ab unhe set karo
        while(iceCandidateQueue.length) {
            await pc.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.shift()));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', pc.localDescription, currentRoomId);
    } catch (e) {
        console.error("Error handling offer:", e);
    }
});

socket.on('answer', async (answer) => {
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // 🟢 Queue System Check for Answer
        while(iceCandidateQueue.length) {
            await pc.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.shift()));
        }
    } catch (e) {
        console.error("Error handling answer:", e);
    }
});

socket.on('ice-candidate', async (candidate) => {
    if (!pc || !pc.remoteDescription) {
        // 🟢 RACE CONDITION FIX: Agar connection ready nahi hai, toh packet delete mat karo, queue me dalo!
        iceCandidateQueue.push(candidate);
    } else {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding ICE candidate', e);
        }
    }
});

function setupDataChannel(channel) {
    channel.onopen = () => {
        console.log("Data Channel is OPEN!");
        if (window.unlockUI) window.unlockUI();
    };
    
    channel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        displayMessage("Peer", data.content, data.type, data.fileName);
        if (window.saveMessageLocally) window.saveMessageLocally("Peer", data);
    };
}

// ---- MESSAGE & FILE SENDING LOGIC ----
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
    } else if (!dataChannel || dataChannel.readyState !== "open") {
        alert("⚠️ Connection not fully established yet. Please wait.");
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

// ---- CAMERA / MIC PERMISSIONS ----
document.getElementById('start-video-btn').addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('video-section').style.display = "flex";
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        document.getElementById('start-video-btn').style.display = "none";
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

