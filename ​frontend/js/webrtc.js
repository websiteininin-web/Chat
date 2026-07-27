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
        
        // FIX: Yahan se createOffer() hata diya gaya hai. 
        // Ab offer tab jayega jab dost sach me join karega (niche dekhein).
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
    
    // FIX: Jab dost join kar lega, tabhi Initiator offer banayega aur bhejega
    if (isInitiator && peerConnection) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, currentRoomId);
    }
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


// --- CHAT AUR FILE SEND KARNE KA LOGIC (ENCRYPTED) ---
function setupDataChannel(channel) {
    channel.onmessage = async (event) => {
        try {
            // FIX: Incoming message ko JSON me parse karna taaki pata chale Text hai ya Image
            const parsedData = JSON.parse(event.data);
            const decryptedData = await decryptMessage(parsedData.data, currentRoomId);

            if (parsedData.type === 'text') {
                displayMessage("Friend", decryptedData);
            } else if (parsedData.type === 'image') {
                displayImage("Friend", decryptedData);
            }
        } catch (error) {
            console.error("Data receive ya decrypt karne me error aaya", error);
        }
    };
}

document.getElementById('send-btn').addEventListener('click', async () => {
    const textInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    
    const msg = textInput.value;
    const file = fileInput.files[0];
    
    if (dataChannel && dataChannel.readyState === "open") {
        
        // 1. Text Message Bhejna
        if (msg) {
            const encryptedMsg = await encryptMessage(msg, currentRoomId);
            // JSON format me bhejenge taaki receiver ko type pata chale
            dataChannel.send(JSON.stringify({ type: 'text', data: encryptedMsg })); 
            displayMessage("You", msg); 
            textInput.value = "";
        }

        // 2. Image/File Bhejna (Naya Logic)
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64File = e.target.result;
                
                const encryptedFile = await encryptMessage(base64File, currentRoomId);
                dataChannel.send(JSON.stringify({ type: 'image', data: encryptedFile }));
                
                displayImage("You", base64File); 
            };
            reader.readAsDataURL(file);
            fileInput.value = ""; // Input clear kar dena
        }
    }
});

// Text UI me dikhane ke liye
function displayMessage(sender, message) {
    const box = document.getElementById('messages-box');
    box.innerHTML += `<p><b style="color: #58a6ff;">${sender}:</b> ${message}</p>`;
    box.scrollTop = box.scrollHeight; 
}

// Image UI me dikhane ke liye (Naya Function)
function displayImage(sender, base64Image) {
    const box = document.getElementById('messages-box');
    box.innerHTML += `<p><b style="color: #58a6ff;">${sender} sent an image:</b><br><img src="${base64Image}" style="max-width: 250px; border-radius: 8px; margin-top: 8px; border: 1px solid #30363d;"></p>`;
    box.scrollTop = box.scrollHeight;
}
