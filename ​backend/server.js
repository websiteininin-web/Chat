const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs'); // NAYA: File system module files check karne ke liye

const app = express();
const server = http.createServer(app);

// --- SMART DETECTIVE LOGIC ---
let frontendPath = path.join(__dirname, '../frontend');

// 1. Agar folder ka naam 'Frontend' (Capital F) hai, toh auto-fix karo
if (!fs.existsSync(frontendPath) && fs.existsSync(path.join(__dirname, '../Frontend'))) {
    frontendPath = path.join(__dirname, '../Frontend');
}

app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    // 2. Agar frontend folder sach me missing hai
    if (!fs.existsSync(frontendPath)) {
        return res.send(`<h2 style="color:red;">Error 404: 'frontend' folder server par nahi mila!</h2>`);
    }

    const indexPath = path.join(frontendPath, 'index.html');
    
    // 3. Agar index.html bilkul sahi jagah par hai, toh website kholo
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    } 
    
    // 4. BRAHMASTRA: Agar file ka naam galat hai, toh asli files screen par dikha do!
    const files = fs.readdirSync(frontendPath).join(', ');
    res.send(`
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: orange;">⚠️ Almost Done! Lekin 'index.html' nahi mili!</h2>
            <p>Aapke frontend folder ke andar Render ko yeh files mili hain:</p>
            <h3 style="color: blue;">[ ${files} ]</h3>
            <p>Upar likhe hue naam dhyan se dekhein. Agar file ka naam 'Index.html' ya 'chat.html' hai, toh kripya GitHub par usko rename karke exactly <b>index.html</b> (sab small) kar dein.</p>
        </div>
    `);
});

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
    console.log(`P2P Signaling Server is running on port ${PORT}`);
});
