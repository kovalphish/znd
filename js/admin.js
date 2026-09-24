document.addEventListener("DOMContentLoaded", () => {
  const login = document.getElementById("admin-login");
  const panel = document.getElementById("admin-panel");
  const form = document.getElementById("login-form");
  const err = document.getElementById("login-error");
  if (!form) return;

  if (sessionStorage.getItem(ADMIN_SESSION) === "1") showPanel();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = document.getElementById("admin-pass").value;
    if (pass === ADMIN_PASS) {
      sessionStorage.setItem(ADMIN_SESSION, "1");
      showPanel();
    } else {
      err.textContent = "Неверный пароль.";
    }
  });

  document.getElementById("save-admin")?.addEventListener("click", () => {
    const cfg = loadConfig();
    ["coin", "plinko", "miner"].forEach((g) => {
      cfg.games[g].winChance = Number(document.getElementById("chance-" + g).value);
      cfg.games[g].enabled = document.getElementById("on-" + g).checked;
      document.getElementById("val-" + g).textContent = cfg.games[g].winChance + "%";
    });
    cfg.pay.cardNumber = document.getElementById("adm-card-number").value.trim();
    cfg.pay.cardName = document.getElementById("adm-card-name").value.trim();
    cfg.telegram = cfg.telegram || { token: "", chatId: "" };
    cfg.telegram.token = document.getElementById("adm-tg-token").value.trim();
    cfg.telegram.chatId = document.getElementById("adm-tg-chat").value.trim();
    saveConfig(cfg);
    document.getElementById("admin-saved").textContent = "Настройки сохранены.";
  });

  function showPanel() {
    login.hidden = true;
    panel.hidden = false;
    const cfg = loadConfig();
    ["coin", "plinko", "miner"].forEach((g) => {
      const range = document.getElementById("chance-" + g);
      range.value = cfg.games[g].winChance;
      document.getElementById("val-" + g).textContent = cfg.games[g].winChance + "%";
      document.getElementById("on-" + g).checked = cfg.games[g].enabled;
      range.addEventListener("input", () => {
        document.getElementById("val-" + g).textContent = range.value + "%";
      });
    });
    document.getElementById("adm-card-number").value = cfg.pay.cardNumber;
    document.getElementById("adm-card-name").value = cfg.pay.cardName;
    document.getElementById("adm-tg-token").value = (cfg.telegram && cfg.telegram.token) || "";
    document.getElementById("adm-tg-chat").value = (cfg.telegram && cfg.telegram.chatId) || "";
    renderPays();
  }

  document.getElementById("pay-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pay]");
    if (!btn) return;
    decide(btn.dataset.id, btn.dataset.pay === "ok");
  });

  setInterval(() => {
    if (sessionStorage.getItem(ADMIN_SESSION) === "1") renderPays();
  }, 2000);
});

function renderPays() {
  const box = document.getElementById("pay-list");
  const badge = document.getElementById("pay-badge");
  if (!box) return;
  const pays = loadPays();
  const pending = pays.filter((p) => p.status === "pending");
  if (badge) {
    badge.hidden = pending.length === 0;
    badge.textContent = String(pending.length);
  }
  const count = document.getElementById("pay-count");
  if (count) count.textContent = String(pending.length);
  if (!pending.length) {
    box.innerHTML = '<div class="hint">Новых заявок нет.</div>';
    return;
  }
  box.innerHTML = pending.map((p) => {
    const kind = p.type === "withdraw" ? "вывод" : "пополнение";
    const extra = p.type === "withdraw"
      ? "<br>тел. " + (p.phone || "-") + " · банк " + (p.bank || "-")
      : "<br>точная сумма для сверки";
    return '<div class="pay-item">' +
      "<div><strong>" + p.name + "</strong><br>" + p.email + "<br>" +
      kind + " <strong>" + Number(p.amount).toFixed(2) + "</strong>" + extra + "</div>" +
      '<div class="pay-actions">' +
      '<button class="primary" data-pay="ok" data-id="' + p.id + '">Выдать</button>' +
      '<button class="secondary" data-pay="no" data-id="' + p.id + '">Отклонить</button>' +
      "</div></div>";
  }).join("");
}

function decide(id, ok) {
  const pays = loadPays();
  const p = pays.find((x) => x.id === id);
  if (!p || p.status !== "pending") return;
  p.status = ok ? "ok" : "no";
  savePays(pays);
  const users = loadUsers();
  const u = users.find((x) => x.id === p.userId);
  if (u) {
    if (p.type === "deposit") {
      if (ok) {
        u.balance = Math.round((Number(u.balance) + Number(p.amount)) * 100) / 100;
        u.depTries = 0;
        u.bannedUntil = 0;
        addNote(u.id, "Платёж пополнен: " + Number(p.amount).toFixed(2), "ok");
      } else {
        addNote(u.id, "Платёж отменён: " + Number(p.amount).toFixed(2), "no");
      }
    } else if (p.type === "withdraw") {
      if (ok) {
        addNote(u.id, "Вывод подтверждён: " + Number(p.amount).toFixed(2), "ok");
      } else {
        u.balance = Math.round((Number(u.balance) + Number(p.amount)) * 100) / 100;
        addNote(u.id, "Вывод отменён: " + Number(p.amount).toFixed(2) + ". Сумма возвращена", "no");
      }
    }
    saveUsers(users);
  }
  renderPays();
}
