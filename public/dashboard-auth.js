(function () {
  function getToken() {
    return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth.html#login";
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("unauthorized");
      const data = await res.json();
      const el = document.getElementById("userEmail");
      if (el && data?.user?.email) el.textContent = data.user.email;
    } catch {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      window.location.href = "/auth.html#login";
    }
  }

  document.addEventListener("DOMContentLoaded", checkAuth);
})();
