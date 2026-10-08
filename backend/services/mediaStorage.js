const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Always load the backend .env file explicitly, regardless of where
// `node app.js` is launched from (backend/, project root, IDE, etc.).
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const getConfig = () => ({
  bucket: String(process.env.AWS_S3_BUCKET || "").trim(),
  region: String(process.env.AWS_REGION || "").trim(),
  accessKeyId: String(process.env.AWS_ACCESS_KEY_ID || "").trim(),
  secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY || "").trim()
});

const getClient = () => {
  const { bucket, region, accessKeyId, secretAccessKey } = getConfig();

  if (!bucket || !region) {
    throw new Error(
      "AWS S3 is not configured. Set AWS_S3_BUCKET and AWS_REGION in backend/.env."
    );
  }

  return new S3Client({
    region,
    credentials: accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined
  });
};

const safeFileName = (name) => {
  const base = path.basename(String(name || "file"));
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
};

const uploadToS3 = async ({ file, folder }) => {
  const { bucket, region } = getConfig();

  // Validate on every upload so env changes are picked up after a restart
  // and the error clearly points to the expected .env location.
  const client = getClient();

  const extension = path.extname(file.originalname || "").toLowerCase();
  const key = `chat-media/${folder}/${crypto.randomUUID()}-${safeFileName(
    path.basename(file.originalname || `file${extension}`)
  )}`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || "application/octet-stream",
    ContentLength: file.size
  }));

  // Keep the bucket private. The stored URL is only a reference; clients
  // must use getPresignedDownloadUrl() to access the object.
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
  return { key, url };
};

const getPresignedDownloadUrl = async ({ key, contentType, fileName }) => {
  const { bucket } = getConfig();
  const client = getClient();
  if (!key) throw new Error("Media object key is missing");

  const safeName = safeFileName(fileName || "download");
  const type = String(contentType || "application/octet-stream").toLowerCase();
  const inline = type.startsWith("image/") || type.startsWith("video/") || type === "application/pdf" || type === "text/plain";
  const disposition = `${inline ? "inline" : "attachment"}; filename=\"${safeName}\"`;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: type,
    ResponseContentDisposition: disposition
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
};

module.exports = { uploadToS3, getPresignedDownloadUrl, safeFileName };
