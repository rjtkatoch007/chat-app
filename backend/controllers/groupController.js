const crypto = require("crypto");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { User, ChatGroup, GroupMember, GroupMessage } = require("../models");

const generateInviteCode = () => crypto.randomBytes(6).toString("base64url").toUpperCase();

const groupDto = (group, includeCode = false) => ({
  id: group.id,
  name: group.name,
  createdBy: group.createdBy,
  creatorName: group.creator?.name || null,
  memberCount: group.members?.length ?? undefined,
  inviteCode: includeCode ? group.inviteCode : undefined,
  createdAt: group.createdAt
});

const getMembership = (groupId, userId) => GroupMember.findOne({ where: { groupId, userId } });

const createGroup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const emails = Array.isArray(req.body.emails) ? req.body.emails : [];
    if (!name) return res.status(400).json({ message: "Group name is required" });
    if (name.length > 100) return res.status(400).json({ message: "Group name is too long" });

    const normalizedEmails = [...new Set(emails.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
    const users = normalizedEmails.length
      ? await User.findAll({ where: { email: { [Op.in]: normalizedEmails } }, attributes: ["id", "name", "email"] })
      : [];
    const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
    const missing = normalizedEmails.filter((email) => !foundEmails.has(email));
    if (missing.length) return res.status(404).json({ message: `User(s) not found: ${missing.join(", ")}` });

    const creator = await User.findByPk(req.user.id, { attributes: ["id", "name", "email"] });
    if (!creator) return res.status(401).json({ message: "Logged-in user was not found" });

    const memberIds = new Set([creator.id, ...users.map((u) => u.id)]);
    const group = await sequelize.transaction(async (transaction) => {
      let inviteCode = generateInviteCode();
      while (await ChatGroup.findOne({ where: { inviteCode }, transaction })) inviteCode = generateInviteCode();
      const created = await ChatGroup.create({ name, inviteCode, createdBy: creator.id }, { transaction });
      await GroupMember.bulkCreate([...memberIds].map((userId) => ({ groupId: created.id, userId })), { transaction });
      return created;
    });

    const result = await ChatGroup.findByPk(group.id, {
      include: [{ model: User, as: "creator", attributes: ["id", "name"] }, { model: GroupMember, as: "members", attributes: ["userId"] }]
    });
    res.status(201).json({ message: "Group created", group: groupDto(result, true) });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ message: "Unable to create group" });
  }
};

const listGroups = async (req, res) => {
  try {
    const memberships = await GroupMember.findAll({ where: { userId: req.user.id }, attributes: ["groupId"], raw: true });
    const groupIds = memberships.map((m) => m.groupId);
    if (!groupIds.length) return res.json({ groups: [] });
    const groups = await ChatGroup.findAll({
      where: { id: { [Op.in]: groupIds } }, order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "creator", attributes: ["id", "name"] }, { model: GroupMember, as: "members", attributes: ["userId"] }]
    });
    res.json({ groups: groups.map((g) => groupDto(g, false)) });
  } catch (error) {
    console.error("List groups error:", error);
    res.status(500).json({ message: "Unable to load groups" });
  }
};

const joinGroup = async (req, res) => {
  try {
    const inviteCode = String(req.params.inviteCode || "").trim().toUpperCase();
    if (!inviteCode) return res.status(400).json({ message: "Invite code is required" });
    const group = await ChatGroup.findOne({ where: { inviteCode } });
    if (!group) return res.status(404).json({ message: "Group not found" });
    await GroupMember.findOrCreate({ where: { groupId: group.id, userId: req.user.id }, defaults: { groupId: group.id, userId: req.user.id } });
    const result = await ChatGroup.findByPk(group.id, { include: [{ model: User, as: "creator", attributes: ["id", "name"] }, { model: GroupMember, as: "members", attributes: ["userId"] }] });
    res.json({ message: "Joined group", group: groupDto(result, false) });
  } catch (error) {
    console.error("Join group error:", error);
    res.status(500).json({ message: "Unable to join group" });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const groupId = String(req.params.groupId || "").trim();
    const membership = await getMembership(groupId, req.user.id);
    if (!membership) return res.status(403).json({ message: "You are not a member of this group" });
    const group = await ChatGroup.findByPk(groupId, { attributes: ["id", "name", "inviteCode", "createdBy"] });
    if (!group) return res.status(404).json({ message: "Group not found" });
    const messages = await GroupMessage.findAll({
      where: { groupId }, order: [["createdAt", "ASC"], ["id", "ASC"]],
      include: [{ model: User, as: "sender", attributes: ["id", "name"] }]
    });
    res.json({ group, messages: messages.map((m) => ({ id: m.id, groupId: m.groupId, senderId: m.senderId, senderName: m.sender?.name || "Unknown user", message: m.message, mediaUrl: m.mediaUrl || null, mediaName: m.mediaName || null, mediaType: m.mediaType || null, mediaSize: m.mediaSize || null, createdAt: m.createdAt })) });
  } catch (error) {
    console.error("Get group messages error:", error);
    res.status(500).json({ message: "Unable to fetch group messages" });
  }
};

module.exports = { createGroup, listGroups, joinGroup, getGroupMessages, getMembership };
