# Chat App — Combined Frontend + Backend

This project combines the uploaded static HTML/CSS/JavaScript frontend with the Node.js/Express/Socket.IO backend. It includes private chat, group chat, private S3 media links, and nightly message archiving.

## Requirements

- Node.js 18+ (use a current LTS release)
- MySQL 8.x (or a compatible MySQL server)
- An AWS S3 bucket and IAM credentials if you want media uploads/downloads

## 1. Configure the backend

1. Create a MySQL database (default name in the example is `chatapp`).
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and a strong random `JWT_SECRET`.
4. For S3 media, set `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. The example is prefilled with region `eu-north-1` and bucket `expense-s3-bucket-zena`; change these if you intend to use a different bucket. Keep real credentials only in `backend/.env`; never put them in frontend files or commit them.
5. The S3 bucket must allow the configured IAM principal to upload and read objects. See `backend/config/aws/iam-policy.json` for a policy example.

## 2. Install and start the backend

In a terminal:

```bash
cd backend
npm install
npm start
```

The API and Socket.IO server use `http://localhost:3000` by default. Sequelize syncs the models at startup. Back up your database before using this on important or production data.

## 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:5500`. The supplied frontend currently targets the backend at `http://localhost:3000` in `js/login.js`, `js/signup.js`, and `js/chat.js`. If you change the backend host/port, update those values too. The chat page loads the Socket.IO browser client from a CDN and connects it to the backend origin.

## Message archiving

The backend starts a nightly archive scheduler by default at 02:00 in the server's local timezone. Configure `ARCHIVE_CRON_HOUR`, `ARCHIVE_CRON_MINUTE`, and `ARCHIVE_BATCH_SIZE` in `backend/.env`. To run an archive pass manually:

```bash
cd backend
npm run archive:old-messages
```

Review `backend/README_ARCHIVING.md` before enabling scheduled archiving in production. Test with a database backup and non-production data first.

## Project layout

- `frontend/` — static pages and browser JavaScript
- `backend/` — Express routes/controllers, Socket.IO handlers, Sequelize models, S3 media handling, and archive job

## Notes

- `node_modules/` is intentionally excluded from this ZIP; run `npm install` separately in each folder.
- Never share or commit `backend/.env`.
- Database and AWS connectivity cannot be verified without your own credentials and services.
