const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

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

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
  return { key, url };
};

module.exports = { uploadToS3, safeFileName };
