const { loadUsers, saveUsers, loadPays, savePays } = require("./store");

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

async function tg(method, payload) {
  const res = await fetch("https://api.telegram.org/bot" + BOT + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function apply(payId, ok) {
  const pays = await loadPays();
  const p = pays.find((x) => x.id === payId);
  if (!p || p.status !== "pending") return "Заявка уже обработана";
  p.status = ok ? "ok" : "no";
  await savePays(pays);
  const users = await loadUsers();
  const u = users.find((x) => x.id === p.userId);
  if (u) {
    u.notes = u.notes || [];
    if (p.type === "deposit") {
      if (ok) {
        u.balance = Math.round((Number(u.balance) + Number(p.amount)) * 100) / 100;
        u.depTries = 0;
        u.bannedUntil = 0;
        u.notes.unshift({ text: "Платёж пополнен: " + Number(p.amount).toFixed(2), type: "ok", at: Date.now() });
      } else {
        u.notes.unshift({ text: "Платёж отменён: " + Number(p.amount).toFixed(2), type: "no", at: Date.now() });
      }
    } else if (p.type === "withdraw") {
      if (ok) {
        u.notes.unshift({ text: "Вывод подтверждён: " + Number(p.amount).toFixed(2), type: "ok", at: Date.now() });
      } else {
        u.balance = Math.round((Number(u.balance) + Number(p.amount)) * 100) / 100;
        u.notes.unshift({ text: "Вывод отменён: " + Number(p.amount).toFixed(2), type: "no", at: Date.now() });
      }
    }
    await saveUsers(users);
  }
  return (ok ? "Выдано " : "Отклонено ") + Number(p.amount).toFixed(2) + " · " + (p.name || "");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }
  const body = req.body || {};
  const cb = body.callback_query;
  if (cb && cb.data) {
    const [act, id] = String(cb.data).split(":");
    let text = "Ошибка";
    try {
      text = await apply(id, act === "ok");
    } catch (e) {
      text = e.message === "NO_KV" ? "Нет базы KV" : "Ошибка сервера";
    }
    await tg("answerCallbackQuery", { callback_query_id: cb.id, text });
    if (cb.message) {
      await tg("editMessageText", {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        text: (cb.message.text || "") + "\n\n" + text
      });
    }
  }
  res.status(200).json({ ok: true });
};
