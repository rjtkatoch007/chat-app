const signupForm = document.getElementById("signupForm");
const signupButton = document.getElementById("signupButton");
const message = document.getElementById("message");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value;

  signupButton.disabled = true;
  signupButton.textContent = "Creating account...";
  message.className = "mt-3";
  message.textContent = "";

  try {
    const response = await fetch("http://localhost:3000/user/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Signup failed");
    }

    message.className = "alert alert-success mt-3";
    message.textContent = "Account created successfully. Redirecting to login...";
    signupForm.reset();

    setTimeout(() => {
      window.location.href = "./login.html";
    }, 800);
  } catch (error) {
    message.className = "alert alert-danger mt-3";
    message.textContent = error.message || "Unable to connect to server.";
  } finally {
    signupButton.disabled = false;
    signupButton.textContent = "Create account";
  }
});
