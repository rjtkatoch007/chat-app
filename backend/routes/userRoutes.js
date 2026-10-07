const express = require("express");
const auth = require("../middleware/auth");
const { signup, login, getAllUsers } = require("../controllers/userController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

// Contacts are visible only to authenticated users.
router.get("/all", auth, getAllUsers);

module.exports = router;
