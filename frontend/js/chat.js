const API_URL = "http://localhost:3000";

const token = localStorage.getItem("token");
const storedUser = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !storedUser) {
  window.location.href = "./login.html";
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
  const wrapper = document.createElement("div");
  wrapper.className = "message sent";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = message.message;

  const time = document.createElement("time");
  time.textContent = `${formatTime(message.createdAt)} ✓✓`;
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

const loadMessages = async () => {
  try {
    const response = await fetch(`${API_URL}/message/my-messages`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "./login.html";
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load messages");
    }

    messageArea.innerHTML = "";

    if (data.messages.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-chat-state";
      emptyState.textContent = "No messages yet. Send your first message!";
      messageArea.appendChild(emptyState);
      return;
    }

    data.messages.forEach((message) => {
      messageArea.appendChild(createMessageElement(message));
    });

    scrollToBottom();
  } catch (error) {
    console.error("Load messages error:", error);
    showMessageStatus("Unable to load saved messages", "error");
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
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "./login.html";
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to send message");
    }

    const emptyState = messageArea.querySelector(".empty-chat-state");
    if (emptyState) emptyState.remove();

    messageArea.appendChild(createMessageElement(data.chatMessage));
    messageInput.value = "";
    scrollToBottom();
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

loadMessages();
