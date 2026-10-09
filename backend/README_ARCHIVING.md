# Nightly message archiving

This backend now archives private and group messages older than 24 hours into separate MySQL tables:

- `chat_messages` -> `ArchivedChat`
- `group_messages` -> `ArchivedGroupChat`

The archive tables preserve original message IDs, sender/recipient or group IDs, message text, media metadata/S3 keys, and original timestamps. Chat-history endpoints merge active and archived rows, so the frontend can continue using the same response shape. The secure media endpoint checks the active table first and then the matching archive table, so old S3 attachments remain accessible through freshly generated presigned URLs.

## How the nightly schedule works

When the backend starts, `services/messageArchiver.js` schedules one run per night using the server's local timezone. The default run time is **02:00**. Set these optional values in `backend/.env` to change it:

```env
ARCHIVE_CRON_HOUR=2
ARCHIVE_CRON_MINUTE=0
ARCHIVE_BATCH_SIZE=500
```

Set the server's `TZ` environment variable (or configure the host timezone) if you need a specific timezone. The job is in-process, so the backend process must be running at the scheduled time. If the process is stopped during the scheduled time, the job will run at the next scheduled time after restart; you can run it manually to catch up.

## Manual run

From the `backend` directory, after configuring `.env` and starting the app at least once so Sequelize creates the archive tables, run:

```bash
npm run archive:old-messages
```

## Safety and performance details

- Messages are eligible when `createdAt` is earlier than the exact 24-hour cutoff at the time the job starts.
- The job processes at most `ARCHIVE_BATCH_SIZE` messages per transaction (default 500), rather than keeping one long transaction open for the whole history.
- For each batch, it copies messages, verifies every archived row against its source row, and only then deletes the source rows inside the same transaction. If copy verification or deletion fails, that batch rolls back and its source messages remain.
- Retries tolerate already-existing archive IDs only if the archived row matches the source exactly; mismatches abort the batch rather than deleting data.
- The scheduler prevents overlapping runs inside one Node.js process. Database transactions and verification protect batch integrity if a run is retried.
- The archive process never deletes S3 objects; it preserves their object keys and metadata.
- Archived tables have indexes on `createdAt` and the main conversation lookup columns.

On application startup, the existing `sequelize.sync({ alter: true })` call creates the new archive tables. As with any schema change, back up the database before deploying to production.
