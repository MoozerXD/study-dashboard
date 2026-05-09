const API = "";
const LANG_KEY = "studyLanguage";
const EN_TEXT = {
  "Учись с ИИ, проще и эффективнее": "Study with AI, more simply and effectively",
  "Войди в учебный кабинет, чтобы планировать задачи, следить за прогрессом и получать рекомендации.": "Sign in to plan tasks, track progress, and get recommendations.",
  "Создать аккаунт": "Create account",
  "Уже есть аккаунт?": "Already have an account?",
  "Войти": "Sign in",
  "Введите email": "Enter email",
  "Пароль": "Password",
  "Создайте пароль": "Create a password",
  "Создавая аккаунт, вы соглашаетесь с условиями сервиса": "By creating an account, you agree to the service terms",
  "Вход": "Sign in",
  "Впервые здесь?": "First time here?",
  "Введите пароль": "Enter password",
  "Оставаться в системе": "Stay signed in",
  "Забыли пароль?": "Forgot password?",
  "Сброс пароля": "Password reset",
  "Мы отправим инструкции на вашу почту": "We will send instructions to your email",
  "Сбросить пароль": "Reset password",
  "Вернуться ко входу": "Back to sign in",
  "Подтвердить email": "Confirm email",
  "Введите код подтверждения из письма": "Enter the confirmation code from the email",
  "Код подтверждения": "Confirmation code",
  "Введите код": "Enter code",
  "Подтвердить": "Confirm",
  "Отправить код ещё раз": "Send code again",
  "Почти готово": "Almost done",
  "Проверьте почту и подтвердите аккаунт": "Check your email and confirm your account",
  "У меня есть код": "I have a code",
  "Сменить язык": "Switch language",
};
const RU_TEXT = Object.fromEntries(Object.entries(EN_TEXT).map(([ru, en]) => [en, ru]));
Object.assign(RU_TEXT, {
  "Email sending is not configured yet. Dev confirmation code:": "Отправка email пока не настроена. Dev-код подтверждения:",
  "Email sending is not configured yet. Dev reset token:": "Отправка email пока не настроена. Dev-токен сброса:",
  "Account created. Check your email for the confirmation code.": "Аккаунт создан. Проверьте email и введите код подтверждения.",
  "Create an account first.": "Сначала создайте аккаунт.",
  "A new confirmation code was sent.": "Новый код подтверждения отправлен.",
  "Email confirmed. You can sign in now.": "Email подтвержден. Теперь можно войти.",
  "Password reset instructions were sent to your email.": "Инструкции по сбросу пароля отправлены на email.",
  "Reset token created. Use the dev token shown above.": "Токен сброса создан. Используйте dev-токен, показанный выше.",
  "Request failed": "Запрос не прошёл",
});

function currentLanguage() {
  return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ru";
}

function translateValue(value, targetLang = currentLanguage()) {
  const source = String(value ?? "");
  if (!source.trim()) return source;
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const text = source.trim();
  const dictionary = targetLang === "en" ? EN_TEXT : RU_TEXT;
  return dictionary[text] ? `${leading}${dictionary[text]}${trailing}` : source;
}

function updateLanguageToggle() {
  const lang = currentLanguage();
  document.documentElement.lang = lang;
  document.getElementById("authLanguageToggleBtn")?.setAttribute("aria-label", lang === "en" ? "Switch language" : "Сменить язык");
  document.querySelectorAll(".auth-language-label").forEach((label) => {
    label.textContent = lang.toUpperCase();
  });
}

function applyLanguage() {
  updateLanguageToggle();
  const lang = currentLanguage();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,textarea,input")) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    node.nodeValue = translateValue(node.nodeValue, lang);
  });
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((attr) => {
      if (element.hasAttribute(attr)) {
        element.setAttribute(attr, translateValue(element.getAttribute(attr), lang));
      }
    });
  });
}

function setLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang === "en" ? "en" : "ru");
  applyLanguage();
}

function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.querySelector(`[data-view="${view}"]`)?.classList.remove("hidden");
  applyLanguage();
}

function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = translateValue(msg || "");
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
    alert(`${translateValue("Email sending is not configured yet. Dev confirmation code:")} ${result.devCode}`);
    return;
  }
  if (result.delivery === "dev" && result.devToken) {
    alert(`${translateValue("Email sending is not configured yet. Dev reset token:")} ${result.devToken}`);
    return;
  }
  if (result.message || fallbackMessage) {
    alert(translateValue(result.message || fallbackMessage));
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
document.getElementById("authLanguageToggleBtn")?.addEventListener("click", () => {
  setLanguage(currentLanguage() === "en" ? "ru" : "en");
});
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
