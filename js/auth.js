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
  const isAdm = Boolean(u && (u.email === ADMIN_EMAIL || u.email === "admin"));
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
  seedAdmin();
  const loginForm = document.getElementById("login-user-form");
  const regForm = document.getElementById("reg-user-form");

  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailRaw = document.getElementById("login-email").value.trim();
    const email = emailRaw.toLowerCase();
    const pass = document.getElementById("login-pass").value;
    const err = document.getElementById("login-user-error");
    seedAdmin();
    const local = loadUsers().find((x) => x.email === email && x.pass === pass);
    const isAdmin = (email === ADMIN_EMAIL || email === "admin") && pass === ADMIN_PASS;
    if (isAdmin) {
      const adm = seedAdmin();
      upsertUser(adm);
      setSession(adm.id);
      refreshHeader();
      openScreen("home");
      return;
    }
    apiAuth("login", { email, pass }).then((u) => {
      if (!u && !local) { err.textContent = "Неверная почта или пароль."; return; }
      const user = u || local;
      upsertUser(user);
      setSession(user.id);
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
    showDepWait(amount.toFixed(2), "Ожидание");
    postRequest({ type: "deposit", amount, name: u.name, email: u.email }).then((data) => {
      if (data && data.pay && data.pay.id) watchPay(data.pay.id, amount);
    });
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
    document.getElementById("dep-step-sum").hidden = false;
    document.getElementById("dep-step-wait").hidden = true;
    modal.hidden = false;
  });
  document.getElementById("dep-close")?.addEventListener("click", () => {
    document.getElementById("dep-modal").hidden = true;
    if (typeof payWatch !== "undefined") clearInterval(payWatch);
  });
  document.getElementById("dep-sums")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sum]");
    if (!btn) return;
    sendDeposit(Number(btn.dataset.sum));
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
  if (location.protocol === "file:") return Promise.resolve(null);
  return fetch("/api/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then((r) => r.ok ? r.json() : null).catch(() => null);
}

function showDepWait(sum, title) {
  const modal = document.getElementById("dep-modal");
  if (!modal) return;
  modal.hidden = false;
  document.getElementById("dep-step-sum").hidden = true;
  document.getElementById("dep-step-wait").hidden = false;
  document.getElementById("dep-spinner").hidden = false;
  document.getElementById("dep-check").hidden = true;
  document.getElementById("dep-wait-title").textContent = title || "Ожидание";
  document.getElementById("dep-wait-text").textContent = "Сумма " + sum;
}

function showDepDone(sum) {
  const spin = document.getElementById("dep-spinner");
  const check = document.getElementById("dep-check");
  if (spin) spin.hidden = true;
  if (check) check.hidden = false;
  document.getElementById("dep-wait-title").textContent = "Пополнено";
  document.getElementById("dep-wait-text").textContent = sum;
}

let payWatch = 0;
function watchPay(id, amount) {
  clearInterval(payWatch);
  payWatch = setInterval(() => {
    fetch("/api/pay?id=" + encodeURIComponent(id))
      .then((r) => r.ok ? r.json() : null)
      .then((p) => {
        if (!p) return;
        if (p.status === "ok") {
          clearInterval(payWatch);
          showDepDone(Number(p.amount).toFixed(2));
          syncUser();
        } else if (p.status === "no") {
          clearInterval(payWatch);
          document.getElementById("dep-spinner").hidden = true;
          document.getElementById("dep-wait-title").textContent = "Отменено";
          document.getElementById("dep-wait-text").textContent = Number(p.amount).toFixed(2);
        }
      }).catch(() => {});
  }, 1500);
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
      const localSeq = Number(cur.balSeq) || 0;
      const remoteSeq = Number(s.balSeq) || 0;
      const recent = Date.now() - (Number(cur.balWrite) || 0) < 5000;
      if (Number(s.balance) > Number(cur.balance)) {
        cur.balance = s.balance;
        cur.balSeq = Math.max(localSeq, remoteSeq);
      } else if (!recent && remoteSeq >= localSeq) {
        cur.balance = s.balance;
        cur.balSeq = remoteSeq;
      }
      cur.notes = s.notes || [];
      cur.admin = s.email === ADMIN_EMAIL;
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
  paintChances(loadConfig());
  const box = document.getElementById("pay-list");
  if (!box) return;
  if (!live()) {
    box.innerHTML = '<div class="hint">Заявки появятся после деплоя</div>';
    return;
  }
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

document.getElementById("give-1000")?.addEventListener("click", () => {
  setBalance(1000);
  toast("Баланс 1000", "ok");
});

setInterval(syncUser, 3000);



function pullRemoteConfig() {
  if (!live()) return;
  if (document.getElementById("admin-desk")?.classList.contains("active")) return;
  fetch("/api/config").then((r) => r.ok ? r.json() : null).then((remote) => {
    if (!remote) return;
    const cfg = loadConfig();
    if (remote.pay) cfg.pay = Object.assign({}, cfg.pay, remote.pay);
    if (remote.games) {
      ["coin", "plinko", "miner", "dice", "crash", "wheel", "limbo", "c50", "c150", "c250"].forEach((g) => {
        cfg.games[g] = Object.assign({}, cfg.games[g] || {}, remote.games[g] || {});
      });
    }
    saveConfig(cfg);
  }).catch(() => {});
}

function paintChances(cfg) {
  ["coin", "plinko", "miner", "dice", "crash", "wheel", "limbo", "c50", "c150", "c250"].forEach((g) => {
    const range = document.getElementById("chance-" + g);
    const val = document.getElementById("val-" + g);
    if (!range || !cfg.games[g]) return;
    range.value = Math.max(0, Math.min(100, Number(cfg.games[g].winChance) || 0));
    if (val) val.textContent = range.value + "%";
  });
}

function pushChances() {
  const cfg = loadConfig();
  ["coin", "plinko", "miner", "dice", "crash", "wheel", "limbo", "c50", "c150", "c250"].forEach((g) => {
    const range = document.getElementById("chance-" + g);
    if (!range) return;
    if (!cfg.games[g]) cfg.games[g] = { enabled: true, winChance: 0 };
    let n = Number(range.value);
    if (!Number.isFinite(n)) n = 0;
    n = Math.max(0, Math.min(100, Math.round(n)));
    range.value = String(n);
    cfg.games[g].winChance = n;
    const val = document.getElementById("val-" + g);
    if (val) val.textContent = n + "%";
  });
  saveConfig(cfg);
  if (live()) {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ games: cfg.games })
    }).catch(() => {});
  }
  toast("Шансы сохранены", "ok");
}

document.querySelectorAll("#chance-coin,#chance-plinko,#chance-miner,#chance-dice,#chance-crash,#chance-wheel,#chance-limbo,#chance-c50,#chance-c150,#chance-c250").forEach((el) => {
  el.addEventListener("input", () => {
    const g = el.id.replace("chance-", "");
    const val = document.getElementById("val-" + g);
    const n = Math.max(0, Math.min(100, Number(el.value) || 0));
    if (val) val.textContent = n + "%";
  });
});
document.getElementById("save-chances")?.addEventListener("click", pushChances);
setInterval(pullRemoteConfig, 4000);
