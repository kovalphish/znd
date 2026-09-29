const { loadUsers, saveUsers, loadPays, savePays } = require("./store");

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

async function tg(method, payload) {
  if (!BOT) return { ok: false, description: "Нет TELEGRAM_BOT_TOKEN" };
  const res = await fetch("https://api.telegram.org/bot" + BOT + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({ ok: false, description: "Telegram вернул не JSON" }));
  return data;
}

function chats() {
  const raw = [process.env.TELEGRAM_CHAT_ID, process.env.TELEGRAM_CHAT_ID_2]
    .filter(Boolean)
    .join(",");
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

async function handleStart(chatId) {
  await tell("connecting", chatId);
  const errors = [];
  if (!BOT) errors.push("нет TELEGRAM_BOT_TOKEN в Vercel");
  const list = chats();
  if (!list.length) errors.push("нет TELEGRAM_CHAT_ID в Vercel");
  const me = BOT ? await tg("getMe", {}) : { ok: false };
  if (BOT && !me.ok) errors.push("токен бота не работает: " + (me.description || "getMe fail"));
  try {
    await loadUsers();
    await loadPays();
  } catch (e) {
    errors.push("база: " + (e.message || e));
  }
  if (list.length && !list.includes(String(chatId))) {
    errors.push("этот чат не в списке админов. id чата: " + chatId);
  }
  if (errors.length) {
    await tell("not connect\n" + errors.join("\n"), chatId);
    return;
  }
  await tell("connect\nchat " + chatId, chatId);
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

async function apply(payId, ok) {
  if (!payId) throw new Error("В кнопке нет id заявки");
  const pays = await loadPays();
  const p = pays.find((x) => x.id === payId);
  if (!p) throw new Error("Заявка не найдена в базе: " + payId);
  if (p.status !== "pending") throw new Error("Заявка уже обработана: " + p.status);
  p.status = ok ? "ok" : "no";
  await savePays(pays);
  const users = await loadUsers();
  const u = users.find((x) => x.id === p.userId) || users.find((x) => x.email === p.email);
  if (!u) throw new Error("Игрок не найден: " + (p.email || p.userId));
  u.notes = u.notes || [];
  if (p.type === "deposit") {
    if (ok) {
      u.balance = Math.round((Number(u.balance || 0) + Number(p.amount)) * 100) / 100; u.balSeq = (Number(u.balSeq) || 0) + 1;
      u.balSeq = (Number(u.balSeq) || 0) + 1;
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
      u.balance = Math.round((Number(u.balance || 0) + Number(p.amount)) * 100) / 100; u.balSeq = (Number(u.balSeq) || 0) + 1;
      u.balSeq = (Number(u.balSeq) || 0) + 1;
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
  try {
    const body = parseBody(req);
    const msg = body.message || body.edited_message;
    if (msg && msg.chat && typeof msg.text === "string" && msg.text.trim().toLowerCase().startsWith("/start")) {
      await handleStart(msg.chat.id);
      res.status(200).json({ ok: true });
      return;
    }
    const cb = body.callback_query;
    if (!cb) {
      res.status(200).json({ ok: true });
      return;
    }
    const chatId = cb.message && cb.message.chat ? cb.message.chat.id : CHAT;
    if (!BOT) {
      await tell("Ошибка: на Vercel нет TELEGRAM_BOT_TOKEN", chatId);
      res.status(200).json({ ok: true });
      return;
    }
    const raw = String(cb.data || "");
    const okAct = raw.startsWith("ok");
    const id = raw.split(":")[1] || "";
    let text;
    try {
      text = await apply(id, okAct);
    } catch (e) {
      text = "Ошибка: " + (e.message || e);
      await tell(text, chatId);
    }
    const ans = await tg("answerCallbackQuery", {
      callback_query_id: cb.id,
      text,
      show_alert: true
    });
    if (!ans.ok) {
      await tell("Не удалось ответить на кнопку: " + (ans.description || JSON.stringify(ans)), chatId);
    }
    if (cb.message) {
      const edited = await tg("editMessageText", {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        text: (cb.message.text || "Заявка") + "\n\n" + text
      });
      if (!edited.ok) {
        await tell("Кнопка нажата, но сообщение не обновилось: " + (edited.description || ""), chatId);
      }
    }
  } catch (e) {
    try { await tell("Сбой webhook: " + (e.message || e)); } catch (_) {}
  }
  res.status(200).json({ ok: true });
};
