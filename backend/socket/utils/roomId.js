const createPrivateRoomId = (emailA, emailB) => {
  const emails = [emailA, emailB].map((email) => String(email || "").trim().toLowerCase());
  if (!emails[0] || !emails[1] || emails[0] === emails[1]) return null;
  emails.sort();
  return `private_${emails[0]}__${emails[1]}`;
};

const createGroupRoomId = (groupId) => {
  const id = String(groupId || "").trim();
  return id ? `group:${id}` : null;
};

module.exports = { createPrivateRoomId, createGroupRoomId };
