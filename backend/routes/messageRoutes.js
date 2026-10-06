const express = require("express");
const auth = require("../middleware/auth");
const {
  sendMessage,
  getMyMessages
} = require("../controllers/messageController");

const router = express.Router();

// All message APIs require a logged-in user.
router.use(auth);

router.post("/send", sendMessage);
router.get("/my-messages", getMyMessages);

module.exports = router;
