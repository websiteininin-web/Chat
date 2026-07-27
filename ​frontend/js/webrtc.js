let peerConnection;
let localStream;
let dataChannel;

// Google ke free STUN servers (Internet par ek dusre ko dhundhne ke liye)
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

async function initWebRTC() {
    // 1. Camera aur Mic ka access lena
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
    } catch (error) {
        console.error("Camera/Mic access denied:", error);
        alert("Please allow camera and mic access for the video call.");
    }

    // 2. Direct P2P Connection banana
    peerConnection = new RTCPeerConnection(servers);

    // Apni video/audio dusre ko bhejna
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // 3. Dost ki video aane par screen par dikhana
    peerConnection.ontrack = (event) => {
        document.getElementById('remote-video').srcObject = event.streams[0];
    };

    // 4. Data Channel banana (Secure Chat aur Files bhejne ke liye)
    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannel(dataChannel);
        
        // Connection Offer banana
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, currentRoomId);
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }

    // 5. Network path (ICE) milne par server ke through share karna
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
}

// --- SIGNALING MESSAGES HANDLE KARNA ---
socket.on('user-connected', async (userId) => {
    console.log("Friend joined!");
});

socket.on('offer', async (offer) => {
    if (!peerConnection) await initWebRTC();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer, currentRoomId);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});

socket.on('user-disconnected', () => {
    document.getElementById('remote-video').srcObject = null;
    alert("Friend left the chat!");
});

// --- CHAT AUR FILE SEND KARNE KA LOGIC ---
function setupDataChannel(channel) {
    channel.onmessage = (event) => {
        displayMessage("Friend", event.data);
    };
}

document.getElementById('send-btn').addEventListener('click', () => {
    const input = document.getElementById('message-input');
    const msg = input.value;
    
    // Agar text hai aur connection open hai toh bhej do
    if (msg && dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(msg);
        displayMessage("You", msg);
        input.value = "";
    }
});

// Screen par message dikhane wala function
function displayMessage(sender, message) {
    const box = document.getElementById('messages-box');
    box.innerHTML += `<p><b style="color: #58a6ff;">${sender}:</b> ${message}</p>`;
    box.scrollTop = box.scrollHeight; // Auto-scroll
}
