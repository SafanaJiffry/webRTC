const username = prompt("Enter your name:");
const socket = io();
socket.emit("set-username", username);

// Correct element references
const videoContainer = document.getElementById("video-grid");
const muteButton = document.getElementById("muteBtn");
const videoButton = document.getElementById("cameraBtn");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendBtn");
const chatBox = document.getElementById("chat-box");

const peers = {};
let localStream;

const localVideo = document.getElementById("localVideo");

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;

        socket.emit("join", "music-jam-room");

        socket.on("new-user", (userId) => {
            const peer = createPeer(userId, stream);
            peers[userId] = peer;
        });

        socket.on("offer", async (data) => {
            const peer = createPeer(data.sender, stream, false);
            peers[data.sender] = peer;
            await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("answer", { target: data.sender, sdp: peer.localDescription });
        });

        socket.on("answer", async (data) => {
            const peer = peers[data.sender];
            await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        });

        socket.on("candidate", (data) => {
            const peer = peers[data.sender];
            if (peer) {
                peer.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        socket.on("user-disconnected", (userId) => {
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }
            document.getElementById(userId)?.remove();
        });

    })
    .catch(error => console.error("Error accessing media devices:", error));

function createPeer(userId, stream, initiator = true) {
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (event) => {
        let remoteVideo = document.getElementById(userId);
        if (!remoteVideo) {
            remoteVideo = document.createElement("video");
            remoteVideo.id = userId;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            videoContainer.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("candidate", { target: userId, candidate: event.candidate });
        }
    };

    if (initiator) {
        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            socket.emit("offer", { target: userId, sdp: offer });
        });
    }

    return peer;
}

// ========== Mute and Camera Toggle ==========

let isAudioMuted = false;
let isVideoMuted = false;

muteButton.addEventListener("click", () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioMuted = !isAudioMuted;
        audioTrack.enabled = !isAudioMuted;
        muteButton.textContent = isAudioMuted ? "Unmute" : "Mute";
    }
});

videoButton.addEventListener("click", () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoMuted = !isVideoMuted;
        videoTrack.enabled = !isVideoMuted;
        videoButton.textContent = isVideoMuted ? "Camera On" : "Camera Off";
    }
});

// ========== Chat ==========

sendButton.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message !== "") {
        socket.emit("chat", message);
        appendMessage(`You: ${message}`);
        messageInput.value = "";
    }
});

socket.on("chat", (data) => {
    appendMessage(`${data.sender}: ${data.message}`);
});

function appendMessage(msg) {
    const msgElement = document.createElement("div");
    msgElement.textContent = msg;
    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}
