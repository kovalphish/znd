const { loadUsers, saveUsers } = require("./store");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@znd.local").toLowerCase();
const ADMIN_PASS = process.env.ADMIN_PASS || "znd-admin-2026";

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const body = await readBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  const pass = String(body.pass || "");
  const name = String(body.name || "").trim();
  try {
    const users = await loadUsers();
    if (!users.some((u) => u.email === ADMIN_EMAIL)) {
      users.push({
        id: "admin",
        name: "Admin",
        email: ADMIN_EMAIL,
        pass: ADMIN_PASS,
        balance: 0,
        notes: [],
        admin: true
      });
    }
    if (body.mode === "login") {
      const u = users.find((x) => x.email === email && x.pass === pass);
      if (!u) {
        res.status(401).json({ error: "auth" });
        return;
      }
      res.status(200).json(u);
      return;
    }
    if (users.some((x) => x.email === email)) {
      res.status(409).json({ error: "exists" });
      return;
    }
    const u = {
      id: "u" + Date.now().toString(36),
      name: name || "player",
      email,
      pass,
      balance: 0,
      notes: [],
      depTries: 0,
      admin: email === ADMIN_EMAIL
    };
    users.push(u);
    await saveUsers(users);
    res.status(200).json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
