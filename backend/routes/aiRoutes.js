const express = require("express");
const auth = require("../middleware/auth");
const { aiSuggestions } = require("../controllers/aiController");

const router = express.Router();
router.use(auth);
router.post("/suggestions", aiSuggestions);
module.exports = router;
