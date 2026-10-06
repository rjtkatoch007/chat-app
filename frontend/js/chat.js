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

const currentTime = () => new Date().toLocaleTimeString([], {
  hour: "numeric",
  minute: "2-digit"
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const wrapper = document.createElement("div");
  wrapper.className = "message sent";
  wrapper.innerHTML = `<div class="bubble"></div>`;

  const bubble = wrapper.querySelector(".bubble");
  bubble.textContent = text;

  const time = document.createElement("time");
  time.textContent = `${currentTime()} ✓✓`;
  bubble.appendChild(time);

  messageArea.appendChild(wrapper);
  messageInput.value = "";
  scrollToBottom();
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

scrollToBottom();
