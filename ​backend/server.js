const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS configuration - Taki frontend securely backend se connect ho sake
const io = new Server(server, {
    cors: {
        origin: "*", // Security vector: Deployment ke time isko apne frontend URL se replace karenge
        methods: ["GET", "POST"]
    }
});

// Strict Zero-Logging & P2P Signaling Logic
io.on('connection', (socket) => {
    
    // 1. User ko ek anonymous room mein join karwana
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        // Room mein pehle se maujud dusre user ko naye connection ka alert dena
        socket.to(roomId).emit('user-connected', userId);

        // 2. WebRTC Offer (Pehla device dusre ko direct connect karne ka offer bhejta hai)
        socket.on('offer', (offer, targetId) => {
            socket.to(roomId).emit('offer', offer, socket.id);
        });

        // 3. WebRTC Answer (Dusra device offer accept karke answer deta hai)
        socket.on('answer', (answer, targetId) => {
            socket.to(roomId).emit('answer', answer, socket.id);
        });

        // 4. ICE Candidates (Internet par direct rasta/path dhundhne ka data pass karna)
        socket.on('ice-candidate', (candidate) => {
            socket.to(roomId).emit('ice-candidate', candidate, socket.id);
        });

        // 5. Disconnection par chat automatically close/alert karna
        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

// Server ko port 3000 par run karna
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`P2P Signaling Server is running on port ${PORT}`);
});
