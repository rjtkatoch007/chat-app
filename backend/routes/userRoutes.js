const express = require("express");
const auth = require("../middleware/auth");
const { signup, login, searchUserByEmail } = require("../controllers/userController");

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.get("/search", auth, searchUserByEmail);
module.exports = router;
