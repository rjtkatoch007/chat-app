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

# Media Sharing with Amazon S3

The chat app now supports sharing images, videos, PDFs, ZIP files, text files, and common Word/Excel documents through Amazon S3.

## How media sharing works

1. A logged-in user opens a private chat or group.
2. The user clicks the paperclip button and selects a file.
3. The browser sends the file as `multipart/form-data` to `POST /media/upload` with the JWT.
4. The backend validates the authenticated sender, recipient/group membership, MIME type, and 25 MB size limit.
5. The backend uploads the file to S3 using the AWS SDK v3. AWS credentials are never sent to the browser.
6. The backend creates a media message in MySQL containing the S3 URL and metadata.
7. The backend broadcasts `new_media_message` for private rooms or `new_group_media_message` for group rooms through Socket.IO.
8. All connected members render the image/video/file immediately. Reloading the conversation loads the same media message from MySQL.

## 1. Create the S3 bucket

Create a bucket in the AWS region you want to use. Example region:

`ap-south-1`

Set `AWS_S3_BUCKET` to the bucket name.

### CORS

The backend performs the actual upload, so the browser does not need direct S3 upload permission. CORS is still included for the frontend origin so browser media URLs can be fetched cleanly. Use `backend/config/aws/s3-cors.json` as the starting policy and replace `http://localhost:5500` with your deployed frontend origin.

For a production deployment, do not use `*` for `AllowedOrigins`.

## 2. IAM user

Create a dedicated IAM user for the backend, with programmatic access, and attach a least-privilege policy based on:

`backend/config/aws/iam-policy.json`

Replace `YOUR_BUCKET` with your real bucket name.

The policy only grants:

- `s3:PutObject`
- on `arn:aws:s3:::YOUR_BUCKET/chat-media/*`

Do not commit the generated access key or secret key to Git.

## 3. Make shared media readable

The generated implementation stores a normal S3 object URL so other chat participants can open it. For this simple implementation, add a bucket policy based on:

`backend/config/aws/s3-bucket-policy.example.json`

It grants public `GetObject` only under `chat-media/*`.

**Security note:** public S3 objects are appropriate only for media you intentionally want accessible through a URL. For private/sensitive media, use private objects plus CloudFront or short-lived S3 presigned GET URLs instead.

If your bucket has S3 Block Public Access enabled, AWS will prevent the public-read policy from working. For private deployments, keep Block Public Access enabled and replace the direct public URL approach with presigned URLs.

## 4. Configure the backend

Copy:

`backend/.env.example` → `backend/.env`

Then set:

```env
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-real-bucket-name
AWS_ACCESS_KEY_ID=your_iam_access_key_id
AWS_SECRET_ACCESS_KEY=your_iam_secret_access_key
MEDIA_MAX_BYTES=26214400
```

The AWS variables are read only by the Node.js backend. Never place them in frontend JavaScript.

## 5. Install dependencies

From `backend/` run:

```bash
npm install
```

The media feature adds:

```text
@aws-sdk/client-s3
multer
```

This environment could not reach `registry.npmjs.org`, so the backend lockfile was intentionally removed rather than shipping a stale lockfile that does not match `package.json`. `npm install` will generate a fresh lockfile in your environment.

## 6. Run the application

Start the backend:

```bash
cd backend
npm start
```

Serve the frontend from your normal local web server, for example:

```bash
cd frontend
python -m http.server 5500
```

Then open:

`http://localhost:5500`

## Media API

### Upload

`POST /media/upload`

Authentication:

```text
Authorization: Bearer <JWT>
```

Multipart fields:

```text
file=<binary file>
chatType=private | group
recipientId=<user id>       # private only
groupId=<group UUID>        # group only
```

Maximum file size defaults to 25 MB.

## Socket.IO media events

Private chat:

```js
socket.on("new_media_message", (message) => {
  // message.mediaUrl contains the S3 object URL
});
```

Group chat:

```js
socket.on("new_group_media_message", (message) => {
  // message.mediaUrl contains the S3 object URL
});
```

The backend verifies the sender/recipient or group membership before uploading and broadcasting, so clients cannot use the media endpoint to inject an attachment into a room they do not belong to.


## Private S3 media access

Chat media is stored in S3 as private objects. The backend stores the S3 object key and generates a short-lived (1 hour) presigned GET URL only after verifying that the authenticated user is a participant in the private chat or a member of the group.

The IAM user used by the backend needs both `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::YOUR_BUCKET/chat-media/*`. Do not add a public `s3:GetObject` bucket policy.

The frontend never receives AWS access keys. It requests a signed URL from the authenticated backend when an image, video, PDF, TXT, ZIP, Word, or Excel attachment is rendered/opened.
