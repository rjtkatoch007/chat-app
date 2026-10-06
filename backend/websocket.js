const { WebSocketServer, WebSocket } = require("ws");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

let wss = null;

const sendJson = (socket, payload) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

const setupWebSocket = (server) => {
  wss = new WebSocketServer({
    server,
    path: "/ws"
  });

  wss.on("connection", (socket) => {
    socket.isAuthenticated = false;
    socket.user = null;

    console.log("[WS] Client connected; waiting for authentication");

    // The browser sends the JWT as the first WebSocket message.
    const authenticateTimer = setTimeout(() => {
      if (!socket.isAuthenticated) {
        console.log("[WS] Closing unauthenticated connection");
        socket.close(1008, "Authentication required");
      }
    }, 5000);

    socket.on("message", async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());

        if (!socket.isAuthenticated) {
          if (payload.type !== "authenticate" || !payload.token) {
            socket.close(1008, "Invalid authentication message");
            return;
          }

          const decoded = jwt.verify(
            payload.token,
            process.env.JWT_SECRET
          );

          const user = await User.findByPk(decoded.id, {
            attributes: ["id", "name", "email", "phone"]
          });

          if (!user) {
            socket.close(1008, "User not found");
            return;
          }

          clearTimeout(authenticateTimer);
          socket.isAuthenticated = true;
          socket.user = user;

          console.log(
            `[WS] Authenticated user -> id=${user.id}, name=${user.name}`
          );

          sendJson(socket, {
            type: "authenticated",
            user: {
              id: user.id,
              name: user.name
            }
          });
          return;
        }

        // Messages are still saved through POST /message/send.
        // This WebSocket connection is responsible for real-time delivery.
      } catch (error) {
        console.error("[WS] Message handling error:", error.message);
        socket.close(1008, "Invalid WebSocket message");
      }
    });

    socket.on("close", () => {
      clearTimeout(authenticateTimer);
      if (socket.user) {
        console.log(
          `[WS] User disconnected -> id=${socket.user.id}, name=${socket.user.name}`
        );
      } else {
        console.log("[WS] Client disconnected before authentication");
      }
    });

    socket.on("error", (error) => {
      console.error("[WS] Socket error:", error.message);
    });
  });

  console.log("[WS] WebSocket server listening on ws://localhost:3000/ws");
  return wss;
};

const broadcastNewMessage = (chatMessage) => {
  if (!wss) return;

  const payload = JSON.stringify({
    type: "new_message",
    message: chatMessage
  });

  let delivered = 0;

  wss.clients.forEach((socket) => {
    if (socket.isAuthenticated && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      delivered += 1;
    }
  });

  console.log(
    `[WS] Broadcast message id=${chatMessage.id} to ${delivered} authenticated client(s)`
  );
};

module.exports = {
  setupWebSocket,
  broadcastNewMessage
};
