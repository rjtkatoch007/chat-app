const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  ChatMessage,
  GroupMessage,
  ArchivedChatMessage,
  ArchivedGroupMessage
} = require("../models");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 500;
let archiveRunInProgress = false;

const dateValue = (value) => value == null ? null : new Date(value).getTime();

// A conflicting archive ID must never cause a different row to be deleted.
const rowsMatch = (source, archived) => {
  const keys = [
    "id", "senderId", "recipientId", "groupId", "message", "mediaUrl",
    "mediaKey", "mediaName", "mediaType", "mediaSize", "createdAt", "updatedAt"
  ];
  return keys.every((key) => {
    if (!(key in source) && !(key in archived)) return true;
    const a = source[key];
    const b = archived[key];
    if (key === "createdAt" || key === "updatedAt") return dateValue(a) === dateValue(b);
    if (a == null || b == null) return a == null && b == null;
    return String(a) === String(b);
  });
};

async function archiveModelBatch({ sourceModel, archiveModel, cutoff, batchSize }) {
  return sequelize.transaction(async (transaction) => {
    const rows = await sourceModel.findAll({
      where: { createdAt: { [Op.lt]: cutoff } },
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      limit: batchSize,
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!rows.length) return 0;

    const copies = rows.map((row) => row.get({ plain: true }));
    const ids = copies.map((row) => row.id);

    // ignoreDuplicates makes retries safe; below we verify the existing/copy row
    // matches the source before any source rows are removed.
    await archiveModel.bulkCreate(copies, {
      transaction,
      ignoreDuplicates: true,
      validate: true
    });

    const archivedRows = await archiveModel.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
      raw: true
    });
    const archivedById = new Map(archivedRows.map((row) => [String(row.id), row]));
    for (const source of copies) {
      const archived = archivedById.get(String(source.id));
      if (!archived || !rowsMatch(source, archived)) {
        throw new Error(`Archive verification failed for ${sourceModel.tableName} message id=${source.id}; source row was retained`);
      }
    }

    const deletedCount = await sourceModel.destroy({
      where: { id: { [Op.in]: ids } },
      transaction
    });
    if (deletedCount !== ids.length) {
      throw new Error(`Expected to delete ${ids.length} rows from ${sourceModel.tableName}, deleted ${deletedCount}; transaction rolled back`);
    }
    return deletedCount;
  });
}

async function archiveOldMessages(options = {}) {
  if (archiveRunInProgress) {
    console.log("[message-archiver] A run is already in progress; skipping overlapping run.");
    return { skipped: true, privateArchived: 0, groupArchived: 0 };
  }

  archiveRunInProgress = true;
  const cutoff = options.cutoff ? new Date(options.cutoff) : new Date(Date.now() - DAY_MS);
  const batchSize = Math.max(1, Math.min(5000, Number(options.batchSize) || Number(process.env.ARCHIVE_BATCH_SIZE) || DEFAULT_BATCH_SIZE));
  let privateArchived = 0;
  let groupArchived = 0;

  try {
    // Each batch commits atomically; large histories don't require one giant transaction.
    while (true) {
      const count = await archiveModelBatch({ sourceModel: ChatMessage, archiveModel: ArchivedChatMessage, cutoff, batchSize });
      privateArchived += count;
      if (count < batchSize) break;
    }
    while (true) {
      const count = await archiveModelBatch({ sourceModel: GroupMessage, archiveModel: ArchivedGroupMessage, cutoff, batchSize });
      groupArchived += count;
      if (count < batchSize) break;
    }

    const result = { skipped: false, cutoff, privateArchived, groupArchived };
    console.log(`[message-archiver] Complete. Private=${privateArchived}, group=${groupArchived}, cutoff=${cutoff.toISOString()}`);
    return result;
  } catch (error) {
    console.error("[message-archiver] Failed. Any failing batch was rolled back; its source messages were retained.", error);
    throw error;
  } finally {
    archiveRunInProgress = false;
  }
}

function getNextRunDate(now = new Date()) {
  const hour = Math.max(0, Math.min(23, Number(process.env.ARCHIVE_CRON_HOUR ?? 2)));
  const minute = Math.max(0, Math.min(59, Number(process.env.ARCHIVE_CRON_MINUTE ?? 0)));
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function startArchiveScheduler() {
  let stopped = false;
  let timer = null;

  const scheduleNext = () => {
    if (stopped) return;
    const next = getNextRunDate();
    const delay = Math.max(1000, next.getTime() - Date.now());
    console.log(`[message-archiver] Next nightly run: ${next.toString()} (server timezone)`);
    timer = setTimeout(async () => {
      try {
        await archiveOldMessages();
      } catch (error) {
        // Keep the server running and retry on the next scheduled night.
        console.error("[message-archiver] Nightly run failed:", error.message);
      } finally {
        scheduleNext();
      }
    }, delay);
    // Do not keep a process alive only because of the timer (server itself keeps it alive).
    if (typeof timer.unref === "function") timer.unref();
  };

  scheduleNext();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

module.exports = { archiveOldMessages, startArchiveScheduler, DAY_MS };
