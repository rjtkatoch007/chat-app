const API_URL = "http://localhost:3000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
  throw new Error("User is not logged in");
}

const myName = document.getElementById("myName");
const myEmail = document.getElementById("myEmail");
const myAvatar = document.getElementById("myAvatar");
const contactName = document.getElementById("contactName");
const contactAvatar = document.getElementById("contactAvatar");
const contactStatus = document.getElementById("contactStatus");
const messageArea = document.getElementById("messageArea");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = messageForm.querySelector(".send-btn");
const emailSearchForm = document.getElementById("emailSearchForm");
const emailSearch = document.getElementById("emailSearch");
const chatList = document.getElementById("chatList");
const logoutButton = document.getElementById("logoutButton");

let loggedInUser = null;
let selectedUser = null;
let selectedRoomId = null;
let conversationMessages = [];
let chatSocket = null;
const recentChats = new Map();

const initials = (name) => name?.trim().charAt(0).toUpperCase() || "U";

// Both clients calculate the same room ID from the two user IDs.
const createRoomId = (userA, userB) => {
  const ids = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `private_${ids[0]}_${ids[1]}`;
};

const handleUnauthorized = () => {
  chatSocket?.disconnect();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
};

const showMessageStatus = (text, type = "info") => {
  let status = document.getElementById("messageStatus");
  if (!status) {
    status = document.createElement("div");
    status.id = "messageStatus";
    status.className = "message-status";
    messageForm.before(status);
  }
  status.textContent = text;
  status.dataset.type = type;
  if (text) setTimeout(() => { if (status.textContent === text) status.textContent = ""; }, 3000);
};

const formatTime = (dateValue) => dateValue
  ? new Date(dateValue).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  : "";

const scrollToBottom = () => { messageArea.scrollTop = messageArea.scrollHeight; };

const loadLoggedInUser = async () => {
  const response = await fetch(`${API_URL}/message/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) return handleUnauthorized();
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to identify logged-in user");

  loggedInUser = data.user;
  localStorage.setItem("user", JSON.stringify(loggedInUser));
  myName.textContent = loggedInUser.name;
  myEmail.textContent = loggedInUser.email;
  myAvatar.textContent = initials(loggedInUser.name);
};

const renderMessages = () => {
  messageArea.innerHTML = "";
  if (!selectedUser) {
    messageArea.innerHTML = '<div class="empty-chat-state">Search for a user email to start chatting.</div>';
    return;
  }
  if (!conversationMessages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-chat-state";
    empty.textContent = `No messages with ${selectedUser.name} yet.`;
    messageArea.appendChild(empty);
    return;
  }

  conversationMessages.forEach((message) => {
    const mine = Number(message.senderId) === Number(loggedInUser.id);
    const wrapper = document.createElement("div");
    wrapper.className = `message ${mine ? "sent" : "received"}`;
    wrapper.dataset.messageId = message.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (!mine) {
      const sender = document.createElement("strong");
      sender.className = "message-sender";
      sender.textContent = message.senderName || selectedUser.name;
      bubble.appendChild(sender);
    }

    const text = document.createElement("div");
    text.textContent = message.message;
    const time = document.createElement("time");
    time.textContent = mine ? `${formatTime(message.createdAt)} ✓✓` : formatTime(message.createdAt);
    bubble.append(text, time);
    wrapper.appendChild(bubble);
    messageArea.appendChild(wrapper);
  });
  scrollToBottom();
};

const renderRecentChats = () => {
  chatList.innerHTML = "";
  if (!recentChats.size) {
    chatList.innerHTML = '<div class="empty-chat-state">Your searched users will appear here.</div>';
    return;
  }

  [...recentChats.values()].forEach((user) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-item";
    if (selectedUser && Number(selectedUser.id) === Number(user.id)) button.classList.add("active");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = initials(user.name);

    const content = document.createElement("div");
    content.className = "chat-item-content";
    const top = document.createElement("div");
    top.className = "chat-item-top";
    const name = document.createElement("strong");
    name.textContent = user.name;
    const time = document.createElement("time");
    time.textContent = user.lastMessage ? formatTime(user.lastMessage.createdAt) : "";
    const preview = document.createElement("div");
    preview.className = "chat-preview";
    preview.textContent = user.lastMessage?.message || user.email;
    top.append(name, time);
    content.append(top, preview);
    button.append(avatar, content);
    button.addEventListener("click", () => openPrivateChat(user));
    chatList.appendChild(button);
  });
};

const searchUserByEmail = async (email) => {
  const response = await fetch(`${API_URL}/user/search?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) return handleUnauthorized();
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "User not found");
  return data.user;
};

const loadConversation = async (user) => {
  const response = await fetch(`${API_URL}/message/all?userId=${encodeURIComponent(user.id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) return handleUnauthorized();
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to load conversation");
  conversationMessages = Array.isArray(data.messages) ? data.messages : [];
  selectedRoomId = data.roomId || createRoomId(loggedInUser.id, user.id);
  renderMessages();
};

const joinRoom = (user) => new Promise((resolve, reject) => {
  if (!chatSocket?.connected) return reject(new Error("Socket.IO connection is not ready"));

  const roomId = createRoomId(loggedInUser.id, user.id);
  // Required assignment event: join_room sends the desired room ID to the server.
  chatSocket.emit("join_room", { roomId, recipientId: user.id }, (result) => {
    if (!result?.success) return reject(new Error(result?.message || "Unable to join room"));
    selectedRoomId = result.roomId;
    resolve(result);
  });
});

const openPrivateChat = async (user) => {
  try {
    selectedUser = user;
    contactName.textContent = user.name;
    contactAvatar.textContent = initials(user.name);
    contactStatus.textContent = user.email;
    messageInput.disabled = true;
    sendButton.disabled = true;
    renderRecentChats();

    await joinRoom(user);
    await loadConversation(user);

    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
  } catch (error) {
    console.error("Open private chat error:", error);
    showMessageStatus(error.message, "error");
  }
};

const connectSocketIO = () => {
  chatSocket = io(API_URL, { auth: { token } });

  chatSocket.on("connect", async () => {
    console.log("[Socket.IO] Connected:", chatSocket.id);
    if (selectedUser) {
      try { await joinRoom(selectedUser); } catch (error) { console.error(error); }
    }
  });

  chatSocket.on("authenticated", ({ user }) => console.log("[Socket.IO] Authenticated:", user));

  chatSocket.on("connect_error", (error) => {
    console.error("[Socket.IO] Connection error:", error.message);
    showMessageStatus("Socket.IO authentication/connection failed", "error");
  });

  // Required assignment event: receive new messages from the joined room.
  chatSocket.on("new_message", (incoming) => {
    if (!selectedUser || incoming.roomId !== selectedRoomId) return;
    if (conversationMessages.some((m) => Number(m.id) === Number(incoming.id))) return;

    conversationMessages.push(incoming);
    conversationMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    recentChats.set(selectedUser.id, { ...selectedUser, lastMessage: incoming });
    renderRecentChats();
    renderMessages();
  });
};

emailSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailSearch.value.trim().toLowerCase();
  if (!email) return;

  try {
    const user = await searchUserByEmail(email);
    recentChats.set(user.id, { ...user, lastMessage: null });
    renderRecentChats();
    emailSearch.value = user.email;
    await openPrivateChat(user);
  } catch (error) {
    showMessageStatus(error.message || "No user found with this email", "error");
  }
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !selectedUser || !selectedRoomId) return;
  if (!chatSocket?.connected) return showMessageStatus("Socket.IO is not connected", "error");

  sendButton.disabled = true;
  messageInput.disabled = true;

  chatSocket.emit("send_message", {
    roomId: selectedRoomId,
    recipientId: selectedUser.id,
    message: text
  }, (result) => {
    if (!result?.success) showMessageStatus(result?.message || "Unable to send message", "error");
    else messageInput.value = "";
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  });
});

logoutButton.addEventListener("click", () => {
  chatSocket?.disconnect();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
});

(async () => {
  try {
    await loadLoggedInUser();
    renderRecentChats();
    connectSocketIO();
  } catch (error) {
    console.error("Chat initialization error:", error);
    showMessageStatus(error.message || "Unable to initialize chat", "error");
  }
})();
