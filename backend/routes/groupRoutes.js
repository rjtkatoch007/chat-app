const express = require("express");
const auth = require("../middleware/auth");
const { createGroup, listGroups, joinGroup, getGroupMessages } = require("../controllers/groupController");

const router = express.Router();
router.use(auth);
router.get("/", listGroups);
router.post("/", createGroup);
router.post("/join/:inviteCode", joinGroup);
router.get("/:groupId/messages", getGroupMessages);
module.exports = router;
