const API_URL = "http://localhost:3000";
const POLL_INTERVAL = 2000;

const token = localStorage.getItem("token");
const storedUser = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !storedUser) {
  window.location.href = "./login.html";
  throw new Error("User is not logged in");
}

const myName = document.getElementById("myName");
const myAvatar = document.getElementById("myAvatar");
const contactName = document.getElementById("contactName");
const contactAvatar = document.getElementById("contactAvatar");
const messageArea = document.getElementById("messageArea");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const logoutButton = document.getElementById("logoutButton");
const chatSearch = document.getElementById("chatSearch");

const initials = (name) => name?.trim().charAt(0).toUpperCase() || "U";

myName.textContent = storedUser.name || "My Account";
myAvatar.textContent = initials(storedUser.name);

const scrollToBottom = () => {
  messageArea.scrollTop = messageArea.scrollHeight;
};

const formatTime = (dateValue) => new Date(dateValue).toLocaleTimeString([], {
  hour: "numeric",
  minute: "2-digit"
});

const createMessageElement = (message) => {
  const isMine = Number(message.senderId) === Number(storedUser.id);

  const wrapper = document.createElement("div");
  wrapper.className = `message ${isMine ? "sent" : "received"}`;
  wrapper.dataset.messageId = message.id;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = message.message;

  const time = document.createElement("time");
  time.textContent = isMine
    ? `${formatTime(message.createdAt)} ✓✓`
    : formatTime(message.createdAt);

  bubble.appendChild(time);
  wrapper.appendChild(bubble);

  return wrapper;
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
      status.textContent = "";
    }, 2500);
  }
};

const handleUnauthorized = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
};

// Ask the backend who is actually logged in.
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

  // Keep localStorage synchronized with the database user.
  localStorage.setItem("user", JSON.stringify(data.user));
  myName.textContent = data.user.name;
  myAvatar.textContent = initials(data.user.name);

  return data.user;
};

let lastRenderedSignature = "";
let isFirstMessageLoad = true;

// Fetch ALL messages from the database.
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
      .map((message) => `${message.id}:${message.createdAt}:${message.message}`)
      .join("|");

    // Do not rebuild the UI when there is no change.
    if (signature === lastRenderedSignature) {
      return;
    }

    const wasNearBottom =
      messageArea.scrollHeight - messageArea.scrollTop - messageArea.clientHeight < 120;

    lastRenderedSignature = signature;
    messageArea.innerHTML = "";

    if (messages.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-chat-state";
      emptyState.textContent = "No messages yet. Send your first message!";
      messageArea.appendChild(emptyState);
      return;
    }

    messages.forEach((message) => {
      messageArea.appendChild(createMessageElement(message));
    });

    // Scroll on initial load and when already near the bottom.
    if (isFirstMessageLoad || wasNearBottom) {
      scrollToBottom();
    }

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
    const response = await fetch(`${API_URL}/message/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message: text })
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to send message");
    }

    messageInput.value = "";

    // Add the saved DB record immediately. The next polling request will
    // see the same record and will not duplicate it.
    lastRenderedSignature = "";
    await loadMessages();
  } catch (error) {
    console.error("Send message error:", error);
    showMessageStatus(error.message || "Unable to send message", "error");
  } finally {
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
});

document.querySelectorAll(".chat-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".chat-item").forEach((chat) => chat.classList.remove("active"));
    item.classList.add("active");

    const name = item.dataset.name;
    contactName.textContent = name;
    contactAvatar.textContent = initials(name);
  });
});

chatSearch.addEventListener("input", () => {
  const search = chatSearch.value.toLowerCase().trim();
  document.querySelectorAll(".chat-item").forEach((item) => {
    item.hidden = !item.dataset.name.toLowerCase().includes(search);
  });
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
});

// Initial user verification + initial messages.
(async () => {
  try {
    const user = await loadLoggedInUser();
    if (!user) return;

    console.log("Logged-in user:", user);
    await loadMessages();

    // Check the database every 2 seconds for new messages.
    setInterval(loadMessages, POLL_INTERVAL);
  } catch (error) {
    console.error("Chat initialization error:", error);
    showMessageStatus(error.message || "Unable to initialize chat", "error");
  }
})();
