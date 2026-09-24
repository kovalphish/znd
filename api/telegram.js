const { loadUsers, saveUsers, loadPays, savePays } = require("./store");

const BOT = process.env.TELEGRAM_BOT_TOKEN;

async function tg(method, payload) {
  const res = await fetch("https://api.telegram.org/bot" + BOT + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

async function apply(payId, ok) {
  const pays = await loadPays();
  const p = pays.find((x) => x.id === payId);
  if (!p) return "Заявка не найдена";
  if (p.status !== "pending") return "Уже обработана";
  p.status = ok ? "ok" : "no";
  await savePays(pays);
  const users = await loadUsers();
  const u = users.find((x) => x.id === p.userId) || users.find((x) => x.email === p.email);
  if (!u) return "Игрок не найден";
  u.notes = u.notes || [];
  if (p.type === "deposit") {
    if (ok) {
      u.balance = Math.round((Number(u.balance || 0) + Number(p.amount)) * 100) / 100;
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
      u.balance = Math.round((Number(u.balance || 0) + Number(p.amount)) * 100) / 100;
      u.notes.unshift({ text: "Вывод отменён: " + Number(p.amount).toFixed(2), type: "no", at: Date.now() });
    }
  }
  await saveUsers(users);
  return (ok ? "Пополнено " : "Отказано ") + Number(p.amount).toFixed(2) + " · " + (u.name || "");
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    res.status(200).send("telegram webhook live");
    return;
  }
  const body = parseBody(req);
  const cb = body.callback_query;
  if (cb && cb.data && BOT) {
    const raw = String(cb.data);
    const ok = raw.startsWith("ok");
    const id = raw.split(":")[1] || raw.slice(3);
    let text = "Ошибка";
    try {
      text = await apply(id, ok);
    } catch (e) {
      text = String(e.message || e);
    }
    await tg("answerCallbackQuery", {
      callback_query_id: cb.id,
      text,
      show_alert: true
    });
    if (cb.message) {
      await tg("editMessageReplyMarkup", {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        reply_markup: { inline_keyboard: [] }
      });
      await tg("editMessageText", {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        text: (cb.message.text || "Заявка") + "\n\n" + text
      });
    }
  }
  res.status(200).json({ ok: true });
};
