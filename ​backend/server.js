const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// 🚀 AUTO-HUNTER: Yeh function server par khud 'index.html' dhoondhega
function findFrontendFolder(dir) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                const found = findFrontendFolder(fullPath);
                if (found) return found;
            }
        } else if (file.toLowerCase() === 'index.html') {
            return dir; // Wo folder mil gaya jisme index.html hai!
        }
    }
    return null;
}

// Root folder se dhoondhna shuru karo
const rootDir = path.join(__dirname, '../');
const actualFrontendPath = findFrontendFolder(rootDir);

if (actualFrontendPath) {
    console.log("✅ Frontend folder mil gaya: ", actualFrontendPath);
    app.use(express.static(actualFrontendPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(actualFrontendPath, 'index.html'));
    });
} else {
    // Agar index.html GitHub par sach me nahi hai
    app.get('*', (req, res) => {
        res.send("<h2 style='color:red;'>❌ Error: GitHub repo me 'index.html' file nahi mili!</h2>");
    });
}

// CORS configuration
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// P2P Signaling Logic
io.on('connection', (socket) => {
    socket.on('join-room', (roomId, userId) => {
        socket.roomId = roomId; 
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
    });

    socket.on('offer', (offer, targetId) => {
        socket.to(targetId).emit('offer', offer);
    });

    socket.on('answer', (answer, targetId) => {
        socket.to(targetId).emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('ice-candidate', candidate);
        }
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('user-disconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`P2P Server running on port ${PORT}`);
});
