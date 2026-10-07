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
const logoutButton = document.getElementById("logoutButton");
const chatSearch = document.getElementById("chatSearch");
const chatList = document.getElementById("chatList");

let loggedInUser = null;
let allMessages = [];
let selectedUserId = null;
let lastRenderedSignature = "";
let isFirstMessageLoad = true;
let chatSocket = null;

const initials = (name) => name?.trim().charAt(0).toUpperCase() || "U";

const handleUnauthorized = () => {
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

// Ask the backend for the real user represented by the JWT.
const loadLoggedInUser = async () => {
  const response = await fetch(`${API_URL}/message/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    handleUnauthorized();
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to identify logged-in user");
  }

  loggedInUser = data.user;
  localStorage.setItem("user", JSON.stringify(loggedInUser));

  myName.textContent = loggedInUser.name;
  myEmail.textContent = loggedInUser.email;
  myAvatar.textContent = initials(loggedInUser.name);

  console.log("Logged-in user from backend:", loggedInUser);

  return loggedInUser;
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
    sender.textContent = message.senderName || `User ${message.senderId}`;
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

const renderMessages = () => {
  const filteredMessages = selectedUserId === null
    ? allMessages
    : allMessages.filter((message) => Number(message.senderId) === Number(selectedUserId));

  const wasNearBottom =
    messageArea.scrollHeight - messageArea.scrollTop - messageArea.clientHeight < 120;

  messageArea.innerHTML = "";

  if (filteredMessages.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-chat-state";
    emptyState.textContent = selectedUserId === null
      ? "No messages yet. Send your first message!"
      : "No messages with this user yet.";
    messageArea.appendChild(emptyState);
    return;
  }

  filteredMessages.forEach((message) => {
    messageArea.appendChild(createMessageElement(message));
  });

  if (isFirstMessageLoad || wasNearBottom) {
    scrollToBottom();
  }
};

const renderChatList = () => {
  const users = new Map();

  allMessages.forEach((message) => {
    const id = Number(message.senderId);
    if (!users.has(id)) {
      users.set(id, {
        id,
        name: message.senderName || `User ${id}`,
        lastMessage: message.message,
        lastTime: message.createdAt
      });
    } else {
      const existing = users.get(id);
      existing.lastMessage = message.message;
      existing.lastTime = message.createdAt;
    }
  });

  chatList.innerHTML = "";

  // Always show the current user's own chat if they have no messages yet.
  if (loggedInUser && !users.has(Number(loggedInUser.id))) {
    users.set(Number(loggedInUser.id), {
      id: Number(loggedInUser.id),
      name: loggedInUser.name,
      lastMessage: "No messages yet",
      lastTime: null
    });
  }

  users.forEach((user) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "chat-item";
    item.dataset.name = user.name;
    item.dataset.userId = user.id;

    if (selectedUserId !== null && Number(selectedUserId) === Number(user.id)) {
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
    name.textContent = Number(user.id) === Number(loggedInUser.id)
      ? `${user.name} (You)`
      : user.name;

    const time = document.createElement("time");
    time.textContent = user.lastTime ? formatTime(user.lastTime) : "";

    const preview = document.createElement("div");
    preview.className = "chat-preview";
    preview.textContent = user.lastMessage;

    top.append(name, time);
    content.append(top, preview);
    item.append(avatar, content);

    item.addEventListener("click", () => {
      selectedUserId = Number(user.id);
      contactName.textContent = Number(user.id) === Number(loggedInUser.id)
        ? `${user.name} (You)`
        : user.name;
      contactAvatar.textContent = initials(user.name);
      contactStatus.textContent = `User ID: ${user.id}`;
      renderChatList();
      renderMessages();
    });

    chatList.appendChild(item);
  });
};

const connectSocketIO = () => {
  if (typeof io === "undefined") {
    console.error("Socket.IO client library was not loaded.");
    showMessageStatus("Socket.IO client could not be loaded", "error");
    return;
  }

  chatSocket = io("http://localhost:3000", {
    auth: {
      token
    }
  });

  chatSocket.on("connect", () => {
    console.log("[Socket.IO] Connected to http://localhost:3000");
  });

  chatSocket.on("authenticated", (data) => {
    console.log("[Socket.IO] Authenticated as:", data.user);
  });

  chatSocket.on("connect_error", (error) => {
    console.error("[Socket.IO] Connection error:", error.message);
    showMessageStatus("Real-time connection unavailable", "error");
  });

  chatSocket.on("new_message", (incoming) => {
    if (!incoming) return;

    const exists = allMessages.some(
      (message) => Number(message.id) === Number(incoming.id)
    );

    if (exists) return;

    allMessages.push(incoming);
    allMessages.sort((a, b) => {
      const timeDifference = new Date(a.createdAt) - new Date(b.createdAt);
      return timeDifference || Number(a.id) - Number(b.id);
    });

    lastRenderedSignature = allMessages
      .map((message) => `${message.id}:${message.senderId}:${message.createdAt}:${message.message}`)
      .join("|");

    renderChatList();
    renderMessages();

    console.log("[Socket.IO] New live message received:", incoming);
  });

  chatSocket.on("disconnect", (reason) => {
    console.warn("[Socket.IO] Disconnected:", reason);
  });
};

// Fetch ALL messages from MySQL.
const loadMessages = async () => {
  try {
    const response = await fetch(`${API_URL}/message/all`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load messages");
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];
    const signature = messages
      .map((message) => `${message.id}:${message.senderId}:${message.createdAt}:${message.message}`)
      .join("|");

    if (signature === lastRenderedSignature) {
      return;
    }

    allMessages = messages;
    lastRenderedSignature = signature;

    renderChatList();
    renderMessages();
    isFirstMessageLoad = false;
  } catch (error) {
    console.error("Load messages error:", error);
    if (isFirstMessageLoad) {
      showMessageStatus("Unable to load saved messages", "error");
    }
  }
};

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  const sendButton = messageForm.querySelector(".send-btn");
  sendButton.disabled = true;
  messageInput.disabled = true;

  try {
    if (!chatSocket || !chatSocket.connected) {
      throw new Error("Real-time chat connection is not ready");
    }

    chatSocket.emit("send_message", { message: text }, (result) => {
      if (!result?.success) {
        showMessageStatus(result?.message || "Unable to send message", "error");
        return;
      }

      console.log("Message saved through Socket.IO:", result.chatMessage);
      messageInput.value = "";
    });
  } catch (error) {
    console.error("Send message error:", error);
    showMessageStatus(error.message || "Unable to send message", "error");
  } finally {
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
});

chatSearch.addEventListener("input", () => {
  const search = chatSearch.value.toLowerCase().trim();
  document.querySelectorAll(".chat-item").forEach((item) => {
    item.hidden = !item.dataset.name.toLowerCase().includes(search);
  });
});

logoutButton.addEventListener("click", () => {
  if (chatSocket) {
    chatSocket.disconnect();
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
});

(async () => {
  try {
    await loadLoggedInUser();
    await loadMessages();
    connectSocketIO();
  } catch (error) {
    console.error("Chat initialization error:", error);
    showMessageStatus(error.message || "Unable to initialize chat", "error");
  }
})();
