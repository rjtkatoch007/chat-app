# Chat App

Vanilla JavaScript frontend + Node.js/Express/Sequelize/MySQL backend with JWT authentication and Socket.IO private one-to-one chat rooms.

## Structure

- `frontend/` - HTML, CSS and vanilla JavaScript UI
- `backend/` - Express API, Sequelize models, JWT authentication and Socket.IO server

## Backend setup

1. Create a MySQL database named `chatapp`.
2. Copy `backend/.env.example` to `backend/.env` and update the MySQL credentials and JWT secret.
3. From `backend/` run:

```bash
npm install
npm run dev
```

The API and Socket.IO server run on `http://localhost:3000`.

## Frontend setup

From `frontend/` run:

```bash
npm install
npm start
```

Open `http://localhost:5500/index.html`.

## Authentication

### POST `/user/signup`

```json
{
  "name": "Rajat",
  "email": "rajat@example.com",
  "phone": "9876543210",
  "password": "secret123"
}
```

Passwords are hashed with bcrypt before storage.

### POST `/user/login`

Use either email or phone in `identifier`:

```json
{
  "identifier": "rajat@example.com",
  "password": "secret123"
}
```

Successful login returns a JWT token. The frontend stores that token in `localStorage`.

## Socket.IO authentication

The same JWT used by the REST API is reused for Socket.IO. The browser connects with:

```js
io("http://localhost:3000", {
  auth: { token }
});
```

The backend verifies the JWT in `io.use(...)`, loads the user from MySQL and attaches the verified identity to:

```js
socket.user
socket.userId
```

Socket events therefore never trust a client-supplied `senderId`.

## Private one-to-one Socket.IO rooms

The project now implements the private-chat room feature demonstrated in the reference video.

### 1. Load real contacts

The authenticated frontend calls:

```text
GET /user/all
```

The response contains registered users other than the logged-in user. The left sidebar can therefore search by name or email instead of displaying hardcoded users.

### 2. Select a contact

When a user selects another user, the frontend emits:

```js
socket.emit("join_chat", {
  recipientId: selectedUserId
});
```

The backend verifies that the target user exists and joins the socket to a deterministic room:

```text
private_chat:<smallerUserId>:<largerUserId>
```

For example, users 2 and 5 use:

```text
private_chat:2:5
```

This means both sides of the same conversation always enter the same room.

### 3. Send a private message

The frontend emits:

```js
socket.emit("send_message", {
  message: "Hello",
  recipientId: selectedUserId
});
```

The backend checks that the authenticated socket has joined the corresponding room, then saves:

- `sender_id` from `socket.userId`
- `recipient_id` from the requested recipient
- `message`

Finally it emits only to that room:

```js
io.to(roomName).emit("new_message", savedMessage);
```

Therefore unrelated users do not receive the private message.

### 4. Leave a private room

When needed, the server supports:

```js
socket.emit("leave_chat");
```

Opening another conversation automatically leaves the previous private room and joins the new one.

### 5. Reconnection

If Socket.IO reconnects, the frontend automatically rejoins the currently selected private room.

## Chat message database design

The `chat_messages` table contains:

| Column | Purpose |
|---|---|
| `id` | Unique message ID |
| `sender_id` | Authenticated user who sent the message |
| `recipient_id` | User receiving the private message |
| `message` | Message text |
| `createdAt` | Message creation time |
| `updatedAt` | Last update time |

`recipient_id` was added as a nullable field so an existing database containing older broadcast-style messages can still start successfully. New private messages always have a recipient.

Because the app already runs `sequelize.sync({ alter: true })`, restart the backend after this version is installed so Sequelize can add the new `recipient_id` column.

## Private conversation API

### GET `/message/all?userId=<id>`

Requires:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

The backend returns only messages exchanged between the authenticated user and the selected user.

### POST `/message/send`

The REST endpoint remains available for compatibility:

```json
{
  "recipientId": 2,
  "message": "Hello!"
}
```

The sender is always taken from the verified JWT. The Socket.IO frontend uses the real-time `send_message` event instead.

## Security rules

- JWT is verified before a Socket.IO connection is accepted.
- The database user is loaded from the verified JWT ID.
- `senderId` is never trusted from the browser.
- A socket can send only after joining the corresponding private room.
- The server determines the actual room name.
- Passwords are never returned by contact APIs.
- Private messages are emitted to the relevant room rather than globally.

## Reference-video features covered

- Socket.IO connection
- Socket.IO JWT authentication
- Identification of the authenticated socket user
- Real database users in the contact list
- Search by user name/email
- Private one-to-one chat room
- Join room when a contact is selected
- Leave the previous room when changing contacts
- Database persistence for private messages
- Real-time message delivery only to the private room
- Conversation reload from MySQL after refresh
- Automatic room rejoin after Socket.IO reconnection
