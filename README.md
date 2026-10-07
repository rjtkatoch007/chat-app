# Chat App

Vanilla JavaScript + Node.js/Express + Sequelize + MySQL + JWT + Socket.IO.

## Email-based private room chat

The chat page now follows the Socket.IO room assignment flow:

1. The logged-in user authenticates with the existing JWT.
2. The frontend provides an **email search box**.
3. The frontend calls `GET /user/search?email=<email>` to find the registered user.
4. A deterministic unique room ID is generated from both user IDs:
   `private_<smallerId>_<largerId>`.
5. The frontend joins that room with the custom Socket.IO event:
   ```js
   socket.emit("join_room", { roomId, recipientId }, callback);
   ```
6. Messages are sent with the room ID:
   ```js
   socket.emit("send_message", {
     roomId,
     recipientId,
     message
   });
   ```
7. The backend validates that the authenticated socket belongs to the requested room, saves the message to MySQL, and sends it only to that room:
   ```js
   io.to(roomId).emit("new_message", savedMessage);
   ```
8. The frontend listens for `new_message` and updates the conversation immediately.

The sender ID is never accepted from the browser. It comes from the JWT-authenticated `socket.userId`.

## Database

`chat_messages` contains `sender_id`, `recipient_id`, `message`, `createdAt`, and `updatedAt`.

The backend uses `sequelize.sync({ alter: true })`, so restart the backend after installing this version to add `recipient_id` to an existing database.

## Run

Backend:
```bash
cd backend
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm start
```

Backend: `http://localhost:3000`
Frontend: `http://localhost:5500`
