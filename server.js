const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve main app on room routes
app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('join-room', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const numClients = room ? room.size : 0;

        // Strict 1-on-1 Limit (Max 2 users)
        if (numClients >= 2) {
            socket.emit('room-full');
            return;
        }

        currentRoom = roomId;
        socket.join(roomId);
        
        const updatedRoom = io.sockets.adapter.rooms.get(roomId);
        const clientCount = updatedRoom ? updatedRoom.size : 1;

        socket.emit('room-joined', { roomId, isInitiator: clientCount === 1 });

        // Notify the first user that partner joined
        if (clientCount === 2) {
            socket.to(roomId).emit('peer-joined');
        }
    });

    // Signaling forwarding
    socket.on('signal', (data) => {
        if (currentRoom) {
            socket.to(currentRoom).emit('signal', data);
        }
    });

    // Handle Disconnects & Leaving
    socket.on('leave-room', () => {
        if (currentRoom) {
            socket.to(currentRoom).emit('peer-left');
            socket.leave(currentRoom);
            currentRoom = null;
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom) {
            socket.to(currentRoom).emit('peer-left');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`💖 Server running on http://localhost:${PORT}`);
});
