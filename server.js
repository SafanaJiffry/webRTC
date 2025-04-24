const express = require("express");
const http = require("http");
const users = {};

const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("New user connected:", socket.id);

    socket.on("set-username", (username) => {
        users[socket.id] = username;
    });
    

    socket.on("chat", (message) => {
        const sender = users[socket.id] || "Stranger";
        socket.broadcast.emit("chat", { sender, message });
    });
    

    socket.on("join", (room) => {
        socket.join(room);
        socket.to(room).emit("new-user", socket.id);
    });

    socket.on("offer", (data) => {
        socket.to(data.target).emit("offer", {
            sender: socket.id,
            sdp: data.sdp
        });
    });

    socket.on("answer", (data) => {
        socket.to(data.target).emit("answer", {
            sender: socket.id,
            sdp: data.sdp
        });
    });

    socket.on("candidate", (data) => {
        socket.to(data.target).emit("candidate", {
            sender: socket.id,
            candidate: data.candidate
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        delete users[socket.id];
        io.emit("user-disconnected", socket.id);
    });
    
});


  

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
 