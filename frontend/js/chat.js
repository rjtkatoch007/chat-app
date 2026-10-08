const API_URL = "http://localhost:3000";
const token = localStorage.getItem("token");
if (!token) { window.location.href = "./login.html"; throw new Error("User is not logged in"); }

const $ = (id) => document.getElementById(id);
const myName = $("myName"), myEmail = $("myEmail"), myAvatar = $("myAvatar"), contactName = $("contactName"), contactAvatar = $("contactAvatar"), contactStatus = $("contactStatus");
const messageArea = $("messageArea"), messageForm = $("messageForm"), messageInput = $("messageInput"), sendButton = messageForm.querySelector(".send-btn"), mediaInput = $("mediaInput"), mediaButton = $("mediaButton");
const emailSearchForm = $("emailSearchForm"), emailSearch = $("emailSearch"), chatList = $("chatList"), logoutButton = $("logoutButton");
let loggedInUser = null, selectedUser = null, selectedGroup = null, selectedRoomId = null, conversationMessages = [], chatSocket = null;
const recentChats = new Map(), groups = new Map();
let groupModal, joinModal;

const initials = (name) => name?.trim().charAt(0).toUpperCase() || "U";
const createPrivateRoomId = (a, b) => { const values = [a, b].map((x) => String(x || "").trim().toLowerCase()); if (!values[0] || !values[1] || values[0] === values[1]) return null; values.sort(); return `private_${values[0]}__${values[1]}`; };
const groupRoomId = (id) => id ? `group:${id}` : null;
const authHeaders = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
const handleUnauthorized = () => { chatSocket?.disconnect(); localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "./login.html"; };
const showMessageStatus = (text, type = "info") => { let el = $("messageStatus"); if (!el) { el = document.createElement("div"); el.id = "messageStatus"; el.className = "message-status"; messageForm.before(el); } el.textContent = text; el.dataset.type = type; if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 3500); };
const formatTime = (v) => v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const scrollToBottom = () => { messageArea.scrollTop = messageArea.scrollHeight; };

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (response.status === 401) return handleUnauthorized();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

const renderMessages = () => {
  messageArea.innerHTML = "";
  if (!selectedUser && !selectedGroup) { messageArea.innerHTML = '<div class="empty-chat-state">Choose a private chat or group.</div>'; return; }
  if (!conversationMessages.length) { const e = document.createElement("div"); e.className = "empty-chat-state"; e.textContent = selectedGroup ? `No messages in ${selectedGroup.name} yet.` : `No messages with ${selectedUser.name} yet.`; messageArea.appendChild(e); return; }
  conversationMessages.forEach((m) => {
    const mine = Number(m.senderId) === Number(loggedInUser.id), wrapper = document.createElement("div"), bubble = document.createElement("div");
    wrapper.className = `message ${mine ? "sent" : "received"}`; wrapper.dataset.messageId = m.id; bubble.className = "bubble";
    if (selectedGroup && !mine) { const sender = document.createElement("strong"); sender.className = "message-sender"; sender.textContent = m.senderName || "Unknown"; bubble.appendChild(sender); }
    if (m.mediaUrl) {
      const media = document.createElement("div");
      media.className = "media-attachment";
      const type = String(m.mediaType || "").toLowerCase();
      if (type.startsWith("image/")) {
        const image = document.createElement("img");
        image.src = m.mediaUrl; image.alt = m.mediaName || "Shared image"; image.loading = "lazy";
        media.appendChild(image);
      } else if (type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = m.mediaUrl; video.controls = true; video.preload = "metadata";
        media.appendChild(video);
      } else {
        const link = document.createElement("a");
        link.href = m.mediaUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = `📎 ${m.mediaName || "Download file"}`; link.className = "file-attachment";
        media.appendChild(link);
      }
      bubble.appendChild(media);
      if (m.mediaName && type.startsWith("image/")) { const caption = document.createElement("div"); caption.className = "media-caption"; caption.textContent = m.mediaName; bubble.appendChild(caption); }
    }
    if (m.message) { const text = document.createElement("div"); text.textContent = m.message; bubble.appendChild(text); }
    const time = document.createElement("time"); time.textContent = formatTime(m.createdAt) + (mine ? " ✓✓" : ""); bubble.appendChild(time); wrapper.appendChild(bubble); messageArea.appendChild(wrapper);
  });
  scrollToBottom();
};

const renderChatList = () => {
  chatList.innerHTML = "";
  const title = document.createElement("div"); title.className = "list-section-title"; title.textContent = "Groups"; chatList.appendChild(title);
  if (!groups.size) { const empty = document.createElement("div"); empty.className = "chat-preview px-2 pb-2"; empty.textContent = "No groups yet."; chatList.appendChild(empty); }
  groups.forEach((group) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "chat-item"; if (selectedGroup?.id === group.id) button.classList.add("active");
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = "👥";
    const content = document.createElement("div"); content.className = "chat-item-content"; const top = document.createElement("div"); top.className = "chat-item-top"; const name = document.createElement("strong"); name.textContent = group.name; const time = document.createElement("time"); time.textContent = "Group"; const preview = document.createElement("div"); preview.className = "chat-preview"; preview.textContent = `${group.memberCount || 0} members`;
    top.append(name, time); content.append(top, preview); button.append(avatar, content); button.addEventListener("click", () => openGroupChat(group)); chatList.appendChild(button);
  });
  const sep = document.createElement("div"); sep.className = "list-section-title mt-2"; sep.textContent = "Private chats"; chatList.appendChild(sep);
  if (!recentChats.size) { const empty = document.createElement("div"); empty.className = "chat-preview px-2 pb-2"; empty.textContent = "Your searched users appear here."; chatList.appendChild(empty); }
  recentChats.forEach((user) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "chat-item"; if (selectedUser?.id === user.id) button.classList.add("active");
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = initials(user.name); const content = document.createElement("div"); content.className = "chat-item-content"; const top = document.createElement("div"); top.className = "chat-item-top"; const name = document.createElement("strong"); name.textContent = user.name; const time = document.createElement("time"); time.textContent = user.lastMessage ? formatTime(user.lastMessage.createdAt) : ""; const preview = document.createElement("div"); preview.className = "chat-preview"; preview.textContent = user.lastMessage?.message || user.email; top.append(name, time); content.append(top, preview); button.append(avatar, content); button.addEventListener("click", () => openPrivateChat(user)); chatList.appendChild(button);
  });
};

async function loadLoggedInUser() { const data = await api("/message/me", { headers: { Authorization: `Bearer ${token}` } }); loggedInUser = data.user; myName.textContent = loggedInUser.name; myEmail.textContent = loggedInUser.email; myAvatar.textContent = initials(loggedInUser.name); }
async function loadGroups() { const data = await api("/group"); groups.clear(); (data.groups || []).forEach((g) => groups.set(g.id, g)); renderChatList(); }
async function searchUserByEmail(email) { return (await api(`/user/search?email=${encodeURIComponent(email)}`)).user; }
async function loadPrivateConversation(user) { const data = await api(`/message/all?userId=${encodeURIComponent(user.id)}`); conversationMessages = data.messages || []; selectedRoomId = data.roomId || createPrivateRoomId(loggedInUser.email, user.email); renderMessages(); }
async function loadGroupConversation(group) { const data = await api(`/group/${encodeURIComponent(group.id)}/messages`); conversationMessages = data.messages || []; selectedRoomId = groupRoomId(group.id); renderMessages(); }

function joinPrivateRoom(user) { return new Promise((resolve, reject) => { if (!chatSocket?.connected) return reject(new Error("Socket.IO connection is not ready")); const roomId = createPrivateRoomId(loggedInUser.email, user.email); chatSocket.emit("join_room", { roomId, recipientId: user.id }, (result) => result?.success ? resolve(result) : reject(new Error(result?.message || "Unable to join private room"))); }); }
function joinGroupRoom(group) { return new Promise((resolve, reject) => { if (!chatSocket?.connected) return reject(new Error("Socket.IO connection is not ready")); chatSocket.emit("join_group", { groupId: group.id }, (result) => result?.success ? resolve(result) : reject(new Error(result?.message || "Unable to join group"))); }); }

async function openPrivateChat(user) {
  try { selectedGroup = null; selectedUser = user; contactName.textContent = user.name; contactAvatar.textContent = initials(user.name); contactStatus.textContent = user.email; messageInput.disabled = sendButton.disabled = true; renderChatList(); await joinPrivateRoom(user); await loadPrivateConversation(user); messageInput.disabled = sendButton.disabled = false; messageInput.focus(); } catch (e) { showMessageStatus(e.message, "error"); }
}
async function openGroupChat(group) {
  try { selectedUser = null; selectedGroup = group; contactName.textContent = group.name; contactAvatar.textContent = "👥"; contactStatus.textContent = `${group.memberCount || 0} members • invite code available to group members`; messageInput.disabled = sendButton.disabled = true; renderChatList(); await joinGroupRoom(group); await loadGroupConversation(group); messageInput.disabled = sendButton.disabled = false; messageInput.focus(); } catch (e) { showMessageStatus(e.message, "error"); }
}

async function uploadMediaFile(file) {
  if (!file) return;
  if (!selectedUser && !selectedGroup) { showMessageStatus("Open a private chat or group first", "error"); mediaInput.value = ""; return; }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chatType", selectedGroup ? "group" : "private");
  if (selectedGroup) formData.append("groupId", selectedGroup.id);
  else formData.append("recipientId", selectedUser.id);

  const previousDisabled = [mediaButton, messageInput, sendButton].map((el) => el.disabled);
  mediaButton.disabled = messageInput.disabled = sendButton.disabled = true;
  showMessageStatus(`Uploading ${file.name}...`, "info");
  try {
    const response = await fetch(`${API_URL}/media/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    if (response.status === 401) return handleUnauthorized();
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Media upload failed");
    showMessageStatus("Media sent", "info");
  } catch (error) {
    showMessageStatus(error.message, "error");
  } finally {
    mediaInput.value = "";
    [mediaButton, messageInput, sendButton].forEach((el, i) => { el.disabled = previousDisabled[i]; });
  }
}

function connectSocketIO() {
  chatSocket = io(API_URL, { auth: { token }, reconnection: true, reconnectionAttempts: Infinity });
  chatSocket.on("connect", async () => { try { if (selectedGroup) await joinGroupRoom(selectedGroup); else if (selectedUser) await joinPrivateRoom(selectedUser); } catch (e) { console.error(e); } });
  chatSocket.on("authenticated", ({ user }) => console.log("[Socket.IO] Authenticated", user));
  chatSocket.on("connect_error", (e) => showMessageStatus(`Socket.IO: ${e.message}`, "error"));
  chatSocket.on("new_message", (incoming) => { if (!selectedUser || incoming.roomId !== selectedRoomId || conversationMessages.some((m) => Number(m.id) === Number(incoming.id))) return; conversationMessages.push(incoming); conversationMessages.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt)); recentChats.set(selectedUser.id, { ...selectedUser, lastMessage: incoming }); renderChatList(); renderMessages(); });
  chatSocket.on("new_group_message", (incoming) => { if (!selectedGroup || incoming.groupId !== selectedGroup.id || conversationMessages.some((m) => Number(m.id) === Number(incoming.id))) return; conversationMessages.push(incoming); conversationMessages.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt)); renderMessages(); });
  chatSocket.on("new_media_message", (incoming) => { if (!selectedUser || incoming.roomId !== selectedRoomId || conversationMessages.some((m) => Number(m.id) === Number(incoming.id))) return; conversationMessages.push(incoming); conversationMessages.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt)); recentChats.set(selectedUser.id, { ...selectedUser, lastMessage: incoming }); renderChatList(); renderMessages(); });
  chatSocket.on("new_group_media_message", (incoming) => { if (!selectedGroup || incoming.groupId !== selectedGroup.id || conversationMessages.some((m) => Number(m.id) === Number(incoming.id))) return; conversationMessages.push(incoming); conversationMessages.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt)); renderMessages(); });
  chatSocket.on("group_member_joined", ({ groupId, userName }) => { if (selectedGroup?.id === groupId) showMessageStatus(`${userName} joined the group`); });
  chatSocket.on("group_member_left", ({ groupId, userName }) => { if (selectedGroup?.id === groupId) showMessageStatus(`${userName} left the group`); });
}

emailSearchForm.addEventListener("submit", async (event) => { event.preventDefault(); try { const user = await searchUserByEmail(emailSearch.value.trim().toLowerCase()); recentChats.set(user.id, { ...user, lastMessage: null }); emailSearch.value = user.email; renderChatList(); await openPrivateChat(user); } catch (e) { showMessageStatus(e.message, "error"); } });
messageForm.addEventListener("submit", (event) => {
  event.preventDefault(); const text = messageInput.value.trim(); if (!text || !chatSocket?.connected) return;
  const eventName = selectedGroup ? "send_group_message" : "send_message"; const payload = selectedGroup ? { groupId: selectedGroup.id, message: text } : { roomId: selectedRoomId, recipientId: selectedUser.id, message: text };
  chatSocket.emit(eventName, payload, (result) => { if (!result?.success) showMessageStatus(result?.message || "Unable to send message", "error"); else messageInput.value = ""; });
});
messageInput.addEventListener("input", () => { if (!chatSocket?.connected) return; if (selectedGroup) chatSocket.emit("typing", { groupId: selectedGroup.id, isTyping: messageInput.value.length > 0 }); else if (selectedRoomId) chatSocket.emit("typing", { roomId: selectedRoomId, isTyping: messageInput.value.length > 0 }); });
mediaButton.addEventListener("click", () => mediaInput.click());
mediaInput.addEventListener("change", () => uploadMediaFile(mediaInput.files?.[0]));
logoutButton.addEventListener("click", () => handleUnauthorized());

$("newGroupButton").addEventListener("click", () => { if (!groupModal) groupModal = new bootstrap.Modal($("groupModal")); $("groupName").value = ""; $("groupEmails").value = ""; groupModal.show(); });
$("joinGroupButton").addEventListener("click", () => { if (!joinModal) joinModal = new bootstrap.Modal($("joinModal")); $("inviteCode").value = ""; joinModal.show(); });
$("groupForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const emails = $("groupEmails").value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean); const data = await api("/group", { method: "POST", body: JSON.stringify({ name: $("groupName").value, emails }) }); groups.set(data.group.id, data.group); groupModal.hide(); renderChatList(); await openGroupChat(data.group); showMessageStatus(`Group created. Invite code: ${data.group.inviteCode}`); } catch (e) { showMessageStatus(e.message, "error"); } });
$("joinForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const data = await api(`/group/join/${encodeURIComponent($("inviteCode").value.trim())}`, { method: "POST" }); groups.set(data.group.id, data.group); joinModal.hide(); renderChatList(); await openGroupChat(data.group); showMessageStatus(`Joined ${data.group.name}`); } catch (e) { showMessageStatus(e.message, "error"); } });

(async function init() { try { await loadLoggedInUser(); await loadGroups(); connectSocketIO(); } catch (e) { console.error(e); showMessageStatus(e.message, "error"); } })();
