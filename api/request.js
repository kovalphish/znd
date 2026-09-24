const { loadUsers, saveUsers, loadPays, savePays } = require("./store");

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

async function tgSend(text, payId) {
  if (!BOT || !CHAT) return;
  const res = await fetch("https://api.telegram.org/bot" + BOT + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      reply_markup: payId && payId !== "ban" ? {
        inline_keyboard: [[
          { text: "Пополнить", callback_data: "ok:" + payId },
          { text: "Отказать", callback_data: "no:" + payId }
        ]]
      } : undefined
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    await fetch("https://api.telegram.org/bot" + BOT + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT,
        text: "Ошибка отправки заявки: " + (data.description || JSON.stringify(data))
      })
    });
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(req.body);
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const body = await readBody(req);
    const users = await loadUsers();
    let user = users.find((u) => u.email === String(body.email || "").toLowerCase());
    if (!user) {
      user = {
        id: "u" + Date.now().toString(36),
        name: body.name || "player",
        email: String(body.email || "").toLowerCase(),
        balance: 0,
        notes: [],
        depTries: 0
      };
      users.push(user);
    }
    if (body.type === "deposit") {
      if (user.bannedUntil && Date.now() < user.bannedUntil) {
        res.status(403).json({ error: "banned" });
        return;
      }
      user.depTries = (Number(user.depTries) || 0) + 1;
      if (user.depTries > 5) {
        user.bannedUntil = Date.now() + 6 * 60 * 60 * 1000;
        await saveUsers(users);
        await tgSend("Бан: " + user.name + " / " + user.email, "ban");
        res.status(403).json({ error: "banned" });
        return;
      }
    }
    if (body.type === "withdraw") {
      const amount = Number(body.amount);
      if (amount < 500) {
        res.status(400).json({ error: "min 500" });
        return;
      }
      if (Number(user.balance) < amount) {
        res.status(400).json({ error: "no funds" });
        return;
      }
      user.balance = Math.round((Number(user.balance) - amount) * 100) / 100;
    }
    const pay = {
      id: "p" + Date.now().toString(36),
      userId: user.id,
      name: user.name,
      email: user.email,
      amount: Number(body.amount),
      phone: body.phone || "",
      bank: body.bank || "",
      type: body.type,
      status: "pending",
      at: Date.now()
    };
    const pays = await loadPays();
    pays.unshift(pay);
    await savePays(pays);
    await saveUsers(users);
    const title = pay.type === "withdraw" ? "Вывод" : "Пополнение";
    const extra = pay.type === "withdraw" ? ("\nтел. " + pay.phone + "\nбанк " + pay.bank) : "";
    await tgSend(title + "\n" + pay.name + "\n" + pay.email + "\nсумма " + Number(pay.amount).toFixed(2) + extra, pay.id);
    res.status(200).json({ ok: true, pay, balance: user.balance });
  } catch (e) {
    const msg = e.message === "NO_KV" ? "Нет базы Upstash (KV)" : String(e.message || e);
    try {
      if (BOT && CHAT) {
        await fetch("https://api.telegram.org/bot" + BOT + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHAT, text: "Ошибка заявки: " + msg })
        });
      }
    } catch (_) {}
    res.status(500).json({ error: e.message === "NO_KV" ? "NO_KV" : "server" });
  }
};
