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
  const navAdm = document.getElementById("nav-admin");
  const bar = document.getElementById("tabbar");
  const isAdm = Boolean(u && (u.admin || u.email === "admin@znd.local"));
  if (navAdm) navAdm.hidden = !isAdm;
  if (bar) bar.classList.toggle("has-admin", isAdm);
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
    apiAuth("login", { email, pass }).then((u) => {
      if (!u) {
        const local = loadUsers().find((x) => x.email === email && x.pass === pass);
        if (!local) { err.textContent = "Неверная почта или пароль."; return; }
        upsertUser(local);
        setSession(local.id);
      } else {
        upsertUser(u);
        setSession(u.id);
      }
      refreshHeader();
      openScreen("home");
    });
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
    apiAuth("reg", { name, email, pass }).then((u) => {
      const user = u || { id: uid("u"), name, email, pass, balance: START_BALANCE, notes: [] };
      upsertUser(user);
      setSession(user.id);
      refreshHeader();
      openScreen("home");
    });
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



function postRequest(payload) {
  if (location.protocol === "file:") return;
  fetch("/api/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}


function live() { return location.protocol !== "file:"; }

function apiAuth(mode, payload) {
  if (!live()) return Promise.resolve(null);
  return fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, ...payload })
  }).then((r) => r.ok ? r.json() : null).catch(() => null);
}

function syncUser() {
  const u = currentUser();
  if (!u || !live()) return;
  fetch("/api/user?email=" + encodeURIComponent(u.email))
    .then((r) => r.ok ? r.json() : null)
    .then((s) => {
      if (!s) return;
      const cur = currentUser();
      if (!cur) return;
      cur.balance = s.balance;
      cur.notes = s.notes || [];
      cur.admin = s.admin;
      upsertUser(cur);
      refreshHeader();
    }).catch(() => {});
}

function fillPayCard() {
  const num = document.getElementById("pay-card-number");
  const name = document.getElementById("pay-card-name");
  const local = loadConfig();
  if (num) num.textContent = local.pay.cardNumber || "не задан";
  if (name) name.textContent = local.pay.cardName || "не задано";
  if (!live()) return;
  fetch("/api/config").then((r) => r.ok ? r.json() : null).then((cfg) => {
    if (!cfg || !cfg.pay) return;
    if (num) num.textContent = cfg.pay.cardNumber || num.textContent;
    if (name) name.textContent = cfg.pay.cardName || name.textContent;
  }).catch(() => {});
}

function loadAdminDesk() {
  const box = document.getElementById("pay-list");
  if (!box || !live()) return;
  fetch("/api/pays").then((r) => r.ok ? r.json() : []).then((list) => {
    if (!list.length) { box.innerHTML = '<div class="hint">Заявок нет</div>'; return; }
    box.innerHTML = list.map((p) =>
      '<div class="pay-item"><div><strong>' + p.name + "</strong><br>" + p.email + "<br>" +
      p.type + " " + Number(p.amount).toFixed(2) + "</div></div>"
    ).join("");
  }).catch(() => {});
}


document.getElementById("save-admin-main")?.addEventListener("click", () => {
  const cardNumber = document.getElementById("adm-card-number").value.trim();
  const cardName = document.getElementById("adm-card-name").value.trim();
  const cfg = loadConfig();
  cfg.pay.cardNumber = cardNumber;
  cfg.pay.cardName = cardName;
  saveConfig(cfg);
  if (live()) {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardNumber, cardName })
    }).catch(() => {});
  }
  toast("Сохранено", "ok");
});

setInterval(syncUser, 3000);



function pullRemoteConfig() {
  if (!live()) return;
  fetch("/api/config").then((r) => r.ok ? r.json() : null).then((remote) => {
    if (!remote) return;
    const cfg = loadConfig();
    if (remote.pay) cfg.pay = Object.assign({}, cfg.pay, remote.pay);
    if (remote.games) {
      ["coin", "plinko", "miner"].forEach((g) => {
        cfg.games[g] = Object.assign({}, cfg.games[g], remote.games[g] || {});
      });
    }
    saveConfig(cfg);
    paintChances(cfg);
  }).catch(() => {});
}

function paintChances(cfg) {
  ["coin", "plinko", "miner"].forEach((g) => {
    const range = document.getElementById("chance-" + g);
    const val = document.getElementById("val-" + g);
    if (!range || !cfg.games[g]) return;
    if (document.activeElement !== range) range.value = cfg.games[g].winChance;
    if (val) val.textContent = cfg.games[g].winChance + "%";
  });
}

function pushChances() {
  const cfg = loadConfig();
  ["coin", "plinko", "miner"].forEach((g) => {
    const range = document.getElementById("chance-" + g);
    if (!range) return;
    cfg.games[g].winChance = Number(range.value);
    const val = document.getElementById("val-" + g);
    if (val) val.textContent = range.value + "%";
  });
  saveConfig(cfg);
  if (live()) {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ games: cfg.games })
    }).catch(() => {});
  }
}

document.querySelectorAll("#chance-coin,#chance-plinko,#chance-miner").forEach((el) => {
  el.addEventListener("input", pushChances);
});
setInterval(pullRemoteConfig, 2000);
