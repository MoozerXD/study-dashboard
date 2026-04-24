const API = "";

function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.querySelector(`[data-view="${view}"]`)?.classList.remove("hidden");
}

function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || "";
}

function savePendingEmail(email) {
  localStorage.setItem("pendingEmail", email);
}

function getPendingEmail() {
  return localStorage.getItem("pendingEmail") || "";
}

function saveToken(token, keep) {
  if (!token) return;
  if (keep) localStorage.setItem("authToken", token);
  else sessionStorage.setItem("authToken", token);
}

function getToken() {
  return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
}

function showDeliveryMessage(result, fallbackMessage) {
  if (!result) return;
  if (result.delivery === "dev" && result.devCode) {
    alert(`Email sending is not configured yet. Dev confirmation code: ${result.devCode}`);
    return;
  }
  if (result.delivery === "dev" && result.devToken) {
    alert(`Email sending is not configured yet. Dev reset token: ${result.devToken}`);
    return;
  }
  if (result.message || fallbackMessage) {
    alert(result.message || fallbackMessage);
  }
}

async function api(path, method = "GET", body = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function route() {
  const pathView = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  const pathMap = {
    login: "login",
    register: "register",
    reset: "reset",
    confirm: "confirm",
    almost: "almost",
  };
  const hash = (location.hash || "").replace("#", "");
  const allowed = ["register", "login", "reset", "confirm", "almost"];
  show(allowed.includes(hash) ? hash : (pathMap[pathView] || "register"));
}

window.addEventListener("hashchange", route);
route();

document.getElementById("formRegister")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setErr("regError", "");

  const email = event.target.email.value.trim();
  const password = event.target.password.value.trim();

  try {
    const result = await api("/api/auth/register", "POST", { email, password });
    savePendingEmail(email);
    showDeliveryMessage(result, "Account created. Check your email for the confirmation code.");
    location.hash = "#almost";
  } catch (error) {
    setErr("regError", error.message);
  }
});

async function resendCode(errorId) {
  setErr(errorId, "");
  const email = getPendingEmail();
  if (!email) {
    setErr(errorId, "Create an account first.");
    return;
  }

  try {
    const result = await api("/api/auth/resend-code", "POST", { email });
    showDeliveryMessage(result, "A new confirmation code was sent.");
  } catch (error) {
    setErr(errorId, error.message);
  }
}

document.getElementById("btnResend")?.addEventListener("click", () => resendCode("confirmError"));
document.getElementById("btnResend2")?.addEventListener("click", () => resendCode("almostError"));

document.getElementById("formConfirm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setErr("confirmError", "");

  const email = getPendingEmail();
  const code = event.target.code.value.trim();
  if (!email) {
    setErr("confirmError", "Create an account first.");
    return;
  }

  try {
    await api("/api/auth/confirm-email", "POST", { email, code });
    alert("Email confirmed. You can sign in now.");
    location.hash = "#login";
  } catch (error) {
    setErr("confirmError", error.message);
  }
});

document.getElementById("formLogin")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setErr("loginError", "");

  const email = event.target.email.value.trim();
  const password = event.target.password.value.trim();
  const keep = document.getElementById("keepSigned")?.checked;

  try {
    const result = await api("/api/auth/login", "POST", { email, password });
    saveToken(result.token, keep);
    savePendingEmail(email);
    window.location.href = "/dashboard";
  } catch (error) {
    setErr("loginError", error.message);
  }
});

document.getElementById("formResetRequest")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setErr("resetError", "");

  const email = event.target.email.value.trim();

  try {
    const result = await api("/api/auth/request-password-reset", "POST", { email });
    showDeliveryMessage(result, "Password reset instructions were sent to your email.");
    setErr("resetError", result.delivery === "dev" ? "Reset token created. Use the dev token shown above." : "Password reset instructions were sent to your email.");
  } catch (error) {
    setErr("resetError", error.message);
  }
});
