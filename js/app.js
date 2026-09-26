document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.open;
      if (btn.dataset.case) window.ZND_CASE = btn.dataset.case;
      if (id !== "auth" && !currentUser()) {
        openScreen("auth");
        toast("Сначала войдите в аккаунт");
        return;
      }
      openScreen(id);
    });
  });
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => openScreen("home"));
  });
  document.getElementById("brand-home")?.addEventListener("click", (e) => {
    e.preventDefault();
    openScreen(currentUser() ? "home" : "auth");
  });

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!currentUser()) { openScreen("auth"); return; }
      const id = btn.dataset.nav;
      if (id === "notes") renderNotes();
      if (id === "account") fillPayCard();
      if (id === "admin-desk") loadAdminDesk();
      openScreen(id);
    });
  });

  document.querySelectorAll("[data-home]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-home]").forEach((b) => b.classList.toggle("on", b === btn));
      document.getElementById("home-games")?.classList.toggle("on", btn.dataset.home === "games");
      document.getElementById("home-cases")?.classList.toggle("on", btn.dataset.home === "cases");
    });
  });
});

function openScreen(id) {
  const target = document.getElementById(id);
  if (!target) return;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  target.classList.add("active");
  const bar = document.getElementById("tabbar");
  if (bar) bar.style.display = id === "auth" ? "none" : "grid";
  document.querySelectorAll("[data-nav]").forEach((b) => {
    b.classList.toggle("on", b.dataset.nav === id || (id === "account" && b.dataset.nav === "account"));
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function parseStake(input) {
  const n = Number(input.value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function pushLog(box, text) {
  if (!box) return;
  const row = document.createElement("div");
  row.textContent = text;
  box.prepend(row);
  while (box.children.length > 6) box.lastChild.remove();
}

function toast(text, type) {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast " + (type || "");
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 280);
  }, 3200);
}
