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
const logoutButton = document.getElementById("logoutButton");
const chatSearch = document.getElementById("chatSearch");
const chatList = document.getElementById("chatList");

let loggedInUser = null;
let contacts = [];
let conversationMessages = [];
let selectedUserId = null;
let selectedUser = null;
let chatSocket = null;
let joinedRoom = null;

const initials = (name) => name?.trim().charAt(0).toUpperCase() || "U";

const handleUnauthorized = () => {
  if (chatSocket) chatSocket.disconnect();
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

  if (text) {
    setTimeout(() => {
      if (status.textContent === text) status.textContent = "";
    }, 3000);
  }
};

const formatTime = (dateValue) => {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const scrollToBottom = () => {
  messageArea.scrollTop = messageArea.scrollHeight;
};

const getLastMessageForUser = (userId) => {
  const relevant = conversationMessages.filter(
    (message) => Number(message.senderId) === Number(userId)
      || Number(message.recipientId) === Number(userId)
  );

  return relevant[relevant.length - 1] || null;
};

const createMessageElement = (message) => {
  const isMine = Number(message.senderId) === Number(loggedInUser.id);

  const wrapper = document.createElement("div");
  wrapper.className = `message ${isMine ? "sent" : "received"}`;
  wrapper.dataset.messageId = message.id;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (!isMine) {
    const sender = document.createElement("strong");
    sender.className = "message-sender";
    sender.textContent = message.senderName || selectedUser?.name || "User";
    bubble.appendChild(sender);
  }

  const text = document.createElement("div");
  text.textContent = message.message;
  bubble.appendChild(text);

  const time = document.createElement("time");
  time.textContent = isMine
    ? `${formatTime(message.createdAt)} ✓✓`
    : formatTime(message.createdAt);
  bubble.appendChild(time);

  wrapper.appendChild(bubble);
  return wrapper;
};

const renderMessages = (scroll = true) => {
  messageArea.innerHTML = "";

  if (!selectedUser) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-chat-state";
    emptyState.textContent = "Select a contact from the left to open a private chat.";
    messageArea.appendChild(emptyState);
    return;
  }

  if (conversationMessages.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-chat-state";
    emptyState.textContent = `No messages with ${selectedUser.name} yet. Say hello!`;
    messageArea.appendChild(emptyState);
    return;
  }

  conversationMessages.forEach((message) => {
    messageArea.appendChild(createMessageElement(message));
  });

  if (scroll) scrollToBottom();
};

const renderChatList = () => {
  const search = chatSearch.value.toLowerCase().trim();
  chatList.innerHTML = "";

  const filtered = contacts.filter((user) => {
    const haystack = `${user.name} ${user.email} ${user.phone}`.toLowerCase();
    return haystack.includes(search);
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-chat-state";
    empty.textContent = search ? "No users match your search." : "No other registered users yet.";
    chatList.appendChild(empty);
    return;
  }

  filtered.forEach((user) => {
    const lastMessage = getLastMessageForUser(user.id);

    const item = document.createElement("button");
    item.type = "button";
    item.className = "chat-item";
    item.dataset.name = user.name;
    item.dataset.email = user.email;
    item.dataset.userId = user.id;

    if (Number(selectedUserId) === Number(user.id)) {
      item.classList.add("active");
    }

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
    time.textContent = lastMessage ? formatTime(lastMessage.createdAt) : "";

    const preview = document.createElement("div");
    preview.className = "chat-preview";
    preview.textContent = lastMessage ? lastMessage.message : user.email;

    top.append(name, time);
    content.append(top, preview);
    item.append(avatar, content);

    item.addEventListener("click", () => openConversation(user));
    chatList.appendChild(item);
  });
};

const loadLoggedInUser = async () => {
  const response = await fetch(`${API_URL}/message/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    handleUnauthorized();
    return null;
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to identify logged-in user");

  loggedInUser = data.user;
  localStorage.setItem("user", JSON.stringify(loggedInUser));

  myName.textContent = loggedInUser.name;
  myEmail.textContent = loggedInUser.email;
  myAvatar.textContent = initials(loggedInUser.name);

  return loggedInUser;
};

const loadContacts = async () => {
  const response = await fetch(`${API_URL}/user/all`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    handleUnauthorized();
    return;
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to load users");

  contacts = Array.isArray(data.users) ? data.users : [];
  renderChatList();
};

const loadConversation = async (userId) => {
  const response = await fetch(`${API_URL}/message/all?userId=${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    handleUnauthorized();
    return;
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to load conversation");

  conversationMessages = Array.isArray(data.messages) ? data.messages : [];
  renderMessages(true);
  renderChatList();
};

const joinPrivateRoom = (user) => new Promise((resolve, reject) => {
  if (!chatSocket?.connected) {
    reject(new Error("Real-time connection is not ready"));
    return;
  }

  chatSocket.emit("join_chat", { recipientId: user.id }, (result) => {
    if (!result?.success) {
      reject(new Error(result?.message || "Unable to join private chat"));
      return;
    }

    joinedRoom = result.roomName;
    resolve(result);
  });
});

const openConversation = async (user) => {
  if (!user) return;

  try {
    selectedUser = user;
    selectedUserId = Number(user.id);

    contactName.textContent = user.name;
    contactAvatar.textContent = initials(user.name);
    contactStatus.textContent = user.email;
    messageInput.disabled = true;
    sendButton.disabled = true;

    renderChatList();
    renderMessages(false);

    await joinPrivateRoom(user);
    await loadConversation(user.id);

    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
    contactStatus.textContent = "Private chat • Socket.IO room connected";
  } catch (error) {
    console.error("Open conversation error:", error);
    showMessageStatus(error.message || "Unable to open private chat", "error");
  }
};

const connectSocketIO = () => {
  if (typeof io === "undefined") {
    showMessageStatus("Socket.IO client could not be loaded", "error");
    return;
  }

  chatSocket = io(API_URL, {
    auth: { token }
  });

  chatSocket.on("connect", () => {
    console.log(`[Socket.IO] Connected -> ${chatSocket.id}`);

    if (selectedUser) {
      joinPrivateRoom(selectedUser).catch((error) => {
        console.error("Room rejoin failed:", error);
      });
    }
  });

  chatSocket.on("authenticated", (data) => {
    console.log("[Socket.IO] Authenticated as:", data.user);
  });

  chatSocket.on("connect_error", (error) => {
    console.error("[Socket.IO] Connection error:", error.message);
    messageInput.disabled = true;
    sendButton.disabled = true;
    showMessageStatus("Socket.IO authentication/connection failed", "error");
  });

  chatSocket.on("new_message", (incoming) => {
    if (!incoming || !selectedUser || !loggedInUser) return;

    const isCurrentConversation =
      (Number(incoming.senderId) === Number(loggedInUser.id)
        && Number(incoming.recipientId) === Number(selectedUser.id))
      ||
      (Number(incoming.senderId) === Number(selectedUser.id)
        && Number(incoming.recipientId) === Number(loggedInUser.id));

    if (!isCurrentConversation) return;

    const exists = conversationMessages.some(
      (message) => Number(message.id) === Number(incoming.id)
    );

    if (exists) return;

    const wasNearBottom =
      messageArea.scrollHeight - messageArea.scrollTop - messageArea.clientHeight < 120;

    conversationMessages.push(incoming);
    conversationMessages.sort((a, b) => {
      const difference = new Date(a.createdAt) - new Date(b.createdAt);
      return difference || Number(a.id) - Number(b.id);
    });

    renderMessages(wasNearBottom);
    renderChatList();
  });

  chatSocket.on("disconnect", (reason) => {
    console.warn("[Socket.IO] Disconnected:", reason);
    messageInput.disabled = true;
    sendButton.disabled = true;
  });
};

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (!text || !selectedUser) return;

  if (!chatSocket?.connected || !joinedRoom) {
    showMessageStatus("Private chat connection is not ready", "error");
    return;
  }

  sendButton.disabled = true;
  messageInput.disabled = true;

  chatSocket.emit(
    "send_message",
    {
      message: text,
      recipientId: selectedUser.id
    },
    (result) => {
      if (!result?.success) {
        showMessageStatus(result?.message || "Unable to send message", "error");
      } else {
        messageInput.value = "";
      }

      sendButton.disabled = false;
      messageInput.disabled = false;
      messageInput.focus();
    }
  );
});

chatSearch.addEventListener("input", renderChatList);

logoutButton.addEventListener("click", () => {
  if (chatSocket) chatSocket.disconnect();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
});

(async () => {
  try {
    await loadLoggedInUser();
    await loadContacts();
    connectSocketIO();
  } catch (error) {
    console.error("Chat initialization error:", error);
    showMessageStatus(error.message || "Unable to initialize chat", "error");
  }
})();
