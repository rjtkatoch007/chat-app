# Chat App

Vanilla JavaScript + Node.js/Express + Sequelize + MySQL + JWT + Socket.IO.

## Email-based private room chat

The chat page now follows the Socket.IO room assignment flow:

1. The logged-in user authenticates with the existing JWT.
2. The frontend provides an **email search box**.
3. The frontend calls `GET /user/search?email=<email>` to find the registered user.
4. A deterministic unique room ID is generated from both normalized email identifiers. The two emails are sorted alphabetically before combining:
   `private_<alphabetically-first-email>__<alphabetically-second-email>`.
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
7. The backend verifies the recipient exists, independently recalculates the room ID from the authenticated user's email and the recipient's email, saves the message to MySQL, and sends it only to that room:
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


## Group Chat + Socket.IO best practices

The project now supports authenticated group chat in addition to deterministic email-based private rooms.

### Group flow
1. Create a group with a name and registered member emails.
2. The server creates a UUID group ID and secure invite code, and persists memberships.
3. Share the invite code with another registered user.
4. A user joins with the invite code; membership is persisted before Socket.IO access is allowed.
5. Group messages are persisted in `group_messages` and broadcast only to `group:<groupId>`.

### Socket.IO practices used
- Authentication middleware runs before `connection`.
- Event handlers are separated into private/group modules.
- Server recalculates/validates room identity instead of trusting the client.
- Group membership is checked before `join_group` and `send_group_message`.
- Acknowledgement callbacks return explicit success/error results.
- Room-scoped broadcasts use `io.to(room).emit(...)`; join/leave notifications use `socket.to(room).emit(...)`.
- Reconnection re-joins the currently selected room from the client.
- A `Map<userId, Set<socketId>>` tracks active connections and is cleaned on disconnect.
- Message payloads are validated and length-limited before database writes.

### API
- `GET /group` — groups for the authenticated user
- `POST /group` — create group (`name`, `emails[]`)
- `POST /group/join/:inviteCode` — join group
- `GET /group/:groupId/messages` — group history (membership required)

Database startup uses Sequelize `sync({ alter: true })`, so the new group tables are created/updated alongside the existing tables.
