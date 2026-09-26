const { loadUsers, saveUsers } = require("./store");

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  try {
    const body = await readBody(req);
    const email = String(body.email || "").toLowerCase();
    const users = await loadUsers();
    const u = users.find((x) => x.email === email);
    if (!u) {
      res.status(404).json({ error: "no user" });
      return;
    }
    const seq = Number(body.seq) || 0;
    const bal = Math.max(0, Math.round(Number(body.balance) * 100) / 100);
    if (seq >= Number(u.balSeq || 0)) {
      u.balance = bal;
      u.balSeq = seq;
      await saveUsers(users);
    }
    res.status(200).json({ balance: u.balance, balSeq: u.balSeq || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
