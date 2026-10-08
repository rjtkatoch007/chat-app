const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const { uploadMedia, MAX_FILE_SIZE } = require("../controllers/mediaController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 }
});

router.use(auth);
router.post("/upload", (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: `File is too large. Maximum is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.` });
      return res.status(400).json({ message: error.message });
    }
    if (error) return next(error);
    next();
  });
}, uploadMedia);

module.exports = router;
