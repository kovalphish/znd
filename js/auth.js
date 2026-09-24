function requireAuth() {
  return Boolean(currentUser());
}

function refreshHeader() {
  const u = currentUser();
  const guest = document.getElementById("guest-actions");
  const userBox = document.getElementById("user-actions");
  const nameEl = document.getElementById("user-name");
  if (guest) guest.hidden = Boolean(u);
  if (userBox) userBox.hidden = !u;
  if (nameEl) nameEl.textContent = u ? u.name : "";
  setBalance(u ? u.balance : 0);
  renderNotes();
}

function renderNotes() {
  const box = document.getElementById("note-list");
  const badge = document.getElementById("note-badge");
  if (!box) return;
  const u = currentUser();
  const notes = u?.notes || [];
  const unread = notes.filter((n) => !n.read).length;
  if (badge) {
    badge.hidden = unread === 0;
    badge.textContent = String(unread);
  }
  box.innerHTML = notes.length
    ? notes.map((n) => {
        const d = new Date(n.at || Date.now());
        const time = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + "  " + d.toLocaleDateString();
        return '<div class="note ' + (n.type || "") + '"><div>' + n.text + '</div><small>' + time + "</small></div>";
      }).join("")
    : '<div class="hint">История пуста</div>';
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-user-form");
  const regForm = document.getElementById("reg-user-form");

  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pass = document.getElementById("login-pass").value;
    const err = document.getElementById("login-user-error");
    const u = loadUsers().find((x) => x.email === email && x.pass === pass);
    if (!u) {
      err.textContent = "Неверная почта или пароль.";
      return;
    }
    setSession(u.id);
    refreshHeader();
    openScreen("home");
  });

  regForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const pass = document.getElementById("reg-pass").value;
    const err = document.getElementById("reg-user-error");
    if (!name || !email || pass.length < 4) {
      err.textContent = "Имя, почта и пароль от 4 символов.";
      return;
    }
    if (loadUsers().some((x) => x.email === email)) {
      err.textContent = "Эта почта уже зарегистрирована.";
      return;
    }
    const u = { id: uid("u"), name, email, pass, balance: START_BALANCE, notes: [] };
    upsertUser(u);
    setSession(u.id);
    refreshHeader();
    openScreen("home");
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    setSession(null);
    refreshHeader();
    openScreen("auth");
  });

  document.getElementById("open-account")?.addEventListener("click", () => {
    fillPayCard();
    renderNotes();
    openScreen("account");
  });

  function uniqueSums(base) {
    base = Math.max(50, Math.floor(Number(base) || 0));
    const kops = [];
    while (kops.length < 6) {
      const k = Math.floor(Math.random() * 99) + 1;
      const rub = kops.length >= 4 ? 1 : 0;
      const key = rub + "-" + k;
      if (kops.includes(key)) continue;
      kops.push(key);
    }
    return kops.map((key) => {
      const [rub, k] = key.split("-").map(Number);
      return Math.round((base + rub + k / 100) * 100) / 100;
    });
  }

  function sendDeposit(amount) {
    const u = currentUser();
    const msg = document.getElementById("dep-msg");
    if (!u) return;
    if (u.bannedUntil && Date.now() < u.bannedUntil) {
      if (msg) msg.textContent = "Временный бан.";
      return;
    }
    u.depTries = (Number(u.depTries) || 0) + 1;
    if (u.depTries > 5) {
      u.bannedUntil = Date.now() + 6 * 60 * 60 * 1000;
      upsertUser(u);
      addNote(u.id, "Временный бан: слишком много заявок без перевода", "no");
      if (msg) msg.textContent = "Временный бан на 6 часов.";
      toast("Временный бан", "no");
      notifyTelegram("Бан: " + u.name + " / " + u.email + " — больше 5 заявок без перевода");
      return;
    }
    upsertUser(u);
    const pays = loadPays();
    pays.unshift({
      id: uid("p"),
      userId: u.id,
      name: u.name,
      email: u.email,
      amount,
      type: "deposit",
      status: "pending",
      at: Date.now()
    });
    savePays(pays);
    addNote(u.id, "Заявка на пополнение: " + amount.toFixed(2), "wait");
    if (msg) msg.textContent = "Заявка: " + amount.toFixed(2);
    renderNotes();
    toast("Заявка " + amount.toFixed(2), "wait");
    notifyTelegram("Пополнение\n" + u.name + "\n" + u.email + "\nсумма " + amount.toFixed(2));
    postRequest({ type: "deposit", amount, name: u.name, email: u.email });
  }

  document.getElementById("dep-open")?.addEventListener("click", () => {
    const modal = document.getElementById("dep-modal");
    const base = Number(document.getElementById("dep-base").value);
    const msg = document.getElementById("dep-msg");
    if (!Number.isFinite(base) || base < 50) {
      msg.textContent = "Минимум 50.";
      return;
    }
    const u = currentUser();
    if (u && u.bannedUntil && Date.now() < u.bannedUntil) {
      msg.textContent = "Временный бан. Новые заявки недоступны.";
      toast("Временный бан", "no");
      return;
    }
    const grid = document.getElementById("dep-sums");
    grid.innerHTML = uniqueSums(base).map((v) =>
      '<button type="button" class="sum-btn" data-sum="' + v + '">' + v.toFixed(2) + "</button>"
    ).join("");
    modal.hidden = false;
  });
  document.getElementById("dep-close")?.addEventListener("click", () => {
    document.getElementById("dep-modal").hidden = true;
  });
  document.getElementById("dep-sums")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sum]");
    if (!btn) return;
    sendDeposit(Number(btn.dataset.sum));
    document.getElementById("dep-modal").hidden = true;
  });

  document.getElementById("wd-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = currentUser();
    const amount = Number(document.getElementById("wd-amount").value);
    const phone = document.getElementById("wd-phone").value.trim();
    const bank = document.getElementById("wd-bank").value.trim();
    const msg = document.getElementById("wd-msg");
    if (!u || !Number.isFinite(amount) || amount < 500) {
      msg.textContent = "Минимум 500.";
      return;
    }
    if (!phone || !bank) {
      msg.textContent = "Укажите телефон и банк.";
      return;
    }
    if (getBalance() < amount) {
      msg.textContent = "Недостаточно средств.";
      return;
    }
    setBalance(getBalance() - amount);
    const pays = loadPays();
    pays.unshift({
      id: uid("p"),
      userId: u.id,
      name: u.name,
      email: u.email,
      amount,
      phone,
      bank,
      type: "withdraw",
      status: "pending",
      at: Date.now()
    });
    savePays(pays);
    addNote(u.id, "Заявка на вывод: " + amount.toFixed(2), "wait");
    msg.textContent = "Заявка отправлена.";
    renderNotes();
    toast("Заявка на вывод отправлена", "wait");
    notifyTelegram("Вывод\n" + u.name + "\n" + u.email + "\nсумма " + amount.toFixed(2) + "\nтел. " + phone + "\nбанк " + bank);
    postRequest({ type: "withdraw", amount, name: u.name, email: u.email, phone, bank });
  });

  document.querySelectorAll("[data-auth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-auth]").forEach((b) => b.classList.toggle("on", b === btn));
      document.getElementById("login-user-form").classList.toggle("on", btn.dataset.auth === "login");
      document.getElementById("reg-user-form").classList.toggle("on", btn.dataset.auth === "reg");
    });
  });

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b === btn));
      document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.id === "pane-" + btn.dataset.tab));
      if (btn.dataset.tab === "notes") renderNotes();
    });
  });

  refreshHeader();
  openScreen(currentUser() ? "home" : "auth");
});

function fillPayCard() {
  const cfg = loadConfig();
  const num = document.getElementById("pay-card-number");
  const name = document.getElementById("pay-card-name");
  if (num) num.textContent = cfg.pay.cardNumber || "не задан";
  if (name) name.textContent = cfg.pay.cardName || "не задано";
}


function postRequest(payload) {
  if (location.protocol === "file:") return;
  fetch("/api/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}
