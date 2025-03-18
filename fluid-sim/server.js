const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files from public directory
app.use(express.static('public'));

// Serve Three.js files from node_modules
app.use('/js/lib', express.static('node_modules/three/build/'));
app.use('/js/lib', express.static('node_modules/three/examples/jsm/controls/'));

io.on('connection', (socket) => {
    console.log('User connected');
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
    
    socket.on('simulation-seed', (seed) => {
        socket.broadcast.emit('receive-simulation', seed);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
