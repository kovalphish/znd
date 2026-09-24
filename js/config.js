const DEFAULT_CONFIG = {
  games: {
    coin: { enabled: true, winChance: 48 },
    plinko: { enabled: true, winChance: 45 },
    miner: { enabled: true, winChance: 46 }
  },
  pay: {
    cardNumber: "0000 0000 0000 0000",
    cardName: "ZND CARD"
  },
  telegram: { token: "", chatId: "" }
};

const CONFIG_KEY = "znd-config";
const USERS_KEY = "znd-users";
const SESSION_KEY = "znd-session";
const PAY_KEY = "znd-pays";
const ADMIN_SESSION = "znd-admin";
const START_BALANCE = 0;
const ADMIN_PASS = "znd-admin-2026";

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      games: { ...DEFAULT_CONFIG.games, ...(parsed.games || {}) },
      pay: { ...DEFAULT_CONFIG.pay, ...(parsed.pay || {}) },
      telegram: { ...DEFAULT_CONFIG.telegram, ...(parsed.telegram || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}
function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function currentUser() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return loadUsers().find((u) => u.id === id) || null;
}

function setSession(id) {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

function upsertUser(user) {
  const list = loadUsers();
  const i = list.findIndex((u) => u.id === user.id);
  if (i >= 0) list[i] = user;
  else list.push(user);
  saveUsers(list);
  return user;
}

function getBalance() {
  const u = currentUser();
  if (!u) return 0;
  return Number(u.balance) || 0;
}

function setBalance(v) {
  const u = currentUser();
  const n = Math.max(0, Math.round(v * 100) / 100);
  if (u) {
    u.balance = n;
    upsertUser(u);
  }
  document.querySelectorAll("[data-balance]").forEach((el) => {
    el.textContent = n.toFixed(2);
  });
  return n;
}

function addBalance(delta) {
  return setBalance(getBalance() + delta);
}

function setUserBalance(userId, v) {
  const list = loadUsers();
  const u = list.find((x) => x.id === userId);
  if (!u) return;
  u.balance = Math.max(0, Math.round(v * 100) / 100);
  saveUsers(list);
}

function loadPays() {
  try { return JSON.parse(localStorage.getItem(PAY_KEY) || "[]"); }
  catch { return []; }
}
function savePays(list) {
  localStorage.setItem(PAY_KEY, JSON.stringify(list));
}

function addNote(userId, text, type) {
  const list = loadUsers();
  const u = list.find((x) => x.id === userId);
  if (!u) return;
  u.notes = u.notes || [];
  u.notes.unshift({ id: "n" + Date.now(), text, type: type || "info", at: Date.now(), read: false });
  saveUsers(list);
}

function chanceWin(game) {
  const cfg = loadConfig();
  const item = cfg.games[game];
  if (!item || !item.enabled) return false;
  const p = Math.max(0, Math.min(100, Number(item.winChance) || 0)) / 100;
  return Math.random() < p;
}

function gameEnabled(game) {
  const cfg = loadConfig();
  return Boolean(cfg.games[game]?.enabled);
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}


async function notifyTelegram(text) {
  const cfg = loadConfig();
  const token = (cfg.telegram && cfg.telegram.token || "").trim();
  const chat = (cfg.telegram && cfg.telegram.chatId || "").trim();
  if (!token || !chat) return { ok: false, skip: true };
  try {
    const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text })
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false };
  }
}
