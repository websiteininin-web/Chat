const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS configuration
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Strict Zero-Logging & P2P Signaling Logic
io.on('connection', (socket) => {
    
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);

        socket.on('offer', (offer, targetId) => {
            socket.to(roomId).emit('offer', offer, socket.id);
        });

        socket.on('answer', (answer, targetId) => {
            socket.to(roomId).emit('answer', answer, socket.id);
        });

        socket.on('ice-candidate', (candidate) => {
            socket.to(roomId).emit('ice-candidate', candidate, socket.id);
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`P2P Signaling Server is running on port ${PORT}`);
});
