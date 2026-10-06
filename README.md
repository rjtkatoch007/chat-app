# Chat App

Vanilla JavaScript frontend + Node.js/Express/Sequelize/MySQL backend.

## Structure

- `frontend/` - HTML, CSS and vanilla JavaScript UI
- `backend/` - Express API, Sequelize models, authentication and chat-message APIs

## Backend setup

1. Create a MySQL database named `chatapp`.
2. Copy `backend/.env.example` to `backend/.env` and update the MySQL credentials and JWT secret.
3. From `backend/` run:

```bash
npm install
npm run dev
```

The API runs on `http://localhost:3000`.

## Frontend setup

From `frontend/` run:

```bash
npm install
npm start
```

Open `http://localhost:5500/index.html`.

## Authentication APIs

### POST `/user/signup`

```json
{
  "name": "Rajat",
  "email": "rajat@example.com",
  "phone": "9876543210",
  "password": "secret123"
}
```

Passwords are hashed with bcrypt before they are stored.

### POST `/user/login`

Use either email or phone in `identifier`:

```json
{
  "identifier": "rajat@example.com",
  "password": "secret123"
}
```

Successful login returns a JWT token. The frontend stores that token in `localStorage` and sends it as a Bearer token for protected APIs.

## Chat message database design

The `chat_messages` table is created automatically by Sequelize and contains:

| Column | Type | Purpose |
|---|---|---|
| `id` | INTEGER | Unique message ID |
| `sender_id` | INTEGER | ID of the user who sent the message; foreign key to `users.id` |
| `message` | TEXT | Actual chat message |
| `createdAt` | DATETIME | Message creation time |
| `updatedAt` | DATETIME | Last update time |

A `User` has many sent messages and each `ChatMessage` belongs to one `User`.

## Chat message APIs

All message APIs require the JWT returned by login.

### POST `/message/send`

Headers:

```text
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "message": "Hello! How are you?"
}
```

The backend gets the sender ID from the verified JWT (`req.user.id`), so the frontend cannot choose or spoof the sender ID.

Example response:

```json
{
  "message": "Chat message saved successfully",
  "chatMessage": {
    "id": 1,
    "senderId": 1,
    "message": "Hello! How are you?",
    "createdAt": "2026-10-06T05:30:00.000Z"
  }
}
```


## Frontend integration

When the user presses the send button:

1. `chat.js` reads the message input.
2. It sends `POST /message/send` with the JWT in the `Authorization` header.
3. The backend verifies the JWT.
4. The backend uses `req.user.id` as `senderId`.
5. Sequelize inserts the message into `chat_messages`.
6. The API returns the saved message and timestamp.
7. The frontend adds the saved message to the chat UI.
8. When the page is refreshed, `GET /message/my-messages` loads the stored messages again.

The current scope stores messages against the sender. Receiver/conversation IDs can be added in the next phase when one-to-one chats are implemented.

## Chat Messages

All message endpoints require the JWT returned by login.

- `GET /message/me` - identifies the currently logged-in user from the JWT and database.
- `POST /message/send` - saves `{ "message": "Hello" }` with the logged-in user's ID as `senderId`.
- `GET /message/all` - returns every stored message with `id`, `senderId`, `message`, and `createdAt`.

The chat frontend calls `/message/me` to identify the actual logged-in user, then calls `/message/all` when the chat page loads. It polls `/message/all` every 2 seconds with `setInterval`, so new database messages appear without manually refreshing the page. The sidebar and conversation are built from database data; there are no hard-coded Alex/Priya/Rahul users or fake messages.
