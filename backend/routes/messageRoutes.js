const express = require("express");
const auth = require("../middleware/auth");
const {
  getLoggedInUser,
  sendMessage,
  getAllMessages
} = require("../controllers/messageController");

const router = express.Router();

// Every message API requires a valid login token.
router.use(auth);

// Shows the user represented by the JWT and verifies that the user exists.
router.get("/me", getLoggedInUser);

// Save a new message.
router.post("/send", sendMessage);

// Get every message stored in the database.
router.get("/all", getAllMessages);

module.exports = router;
