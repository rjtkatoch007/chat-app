# Chat App

Vanilla JavaScript frontend + Node.js/Express/Sequelize/MySQL backend.

## Structure

- `frontend/` - HTML, CSS and vanilla JavaScript UI
- `backend/` - Express API, Sequelize model and JWT authentication

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

## APIs

### POST `/user/signup`

```json
{
  "name": "Rajat",
  "email": "rajat@example.com",
  "phone": "9876543210",
  "password": "secret123"
}
```

### POST `/user/login`

Use either email or phone in `identifier`:

```json
{
  "identifier": "rajat@example.com",
  "password": "secret123"
}
```

Passwords are hashed with bcrypt. Successful login returns a JWT token.

## Chat UI

The current chat screen is a frontend foundation for future features. It includes a WhatsApp-style layout, chat list, search filter, message bubbles, timestamps, send behavior, automatic scroll-to-bottom and logout. Real-time messaging and persistent conversations can be added next with chat/message database models and WebSockets.
