const express = require('express'); // 'Const' ki jagah 'const' aayega
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Frontend folder ka rasta (path)
const frontendPath = path.join(__dirname, '../frontend');

// 1. CSS/JS files ko load karne ke liye
app.use(express.static(frontendPath));

// 2. ERROR FIX: Agar koi URL khule, toh direct index.html bhej do (Cannot GET / error solved)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// CORS configuration
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Strict Zero-Logging & P2P Signaling Logic (Memory Leak Fixed)
io.on('connection', (socket) => {
    
    // 1. Room join karne par socket object me roomId save kar liya
    socket.on('join-room', (roomId, userId) => {
        socket.roomId = roomId; 
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
    });

    // 2. Saare listeners ab join-room ke bahar hain (Duplicate Events ka issue khatam)
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
    console.log(`P2P Signaling Server is running on port ${PORT}`);
});
