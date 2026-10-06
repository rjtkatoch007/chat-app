const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = document.getElementById("identifier").value.trim();
  const password = document.getElementById("password").value;

  if (!identifier || !password) return;

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";
  message.className = "mt-3";
  message.textContent = "";

  try {
    const response = await fetch("http://localhost:3000/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    message.className = "alert alert-success mt-3";
    message.textContent = "Login successful. Opening chat...";

    setTimeout(() => {
      window.location.href = "./chat.html";
    }, 500);
  } catch (error) {
    message.className = "alert alert-danger mt-3";
    message.textContent = error.message || "Unable to connect to server.";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
});
