const { loadUsers } = require("./store");

module.exports = async (req, res) => {
  const email = String((req.query && req.query.email) || "").toLowerCase();
  if (!email) {
    res.status(400).json({ error: "email" });
    return;
  }
  try {
    const users = await loadUsers();
    const u = users.find((x) => x.email === email);
    if (!u) {
      res.status(404).json({ error: "no user" });
      return;
    }
    res.status(200).json({
      id: u.id,
      name: u.name,
      email: u.email,
      balance: u.balance || 0,
      balSeq: u.balSeq || 0,
      notes: u.notes || [],
      admin: Boolean(u.admin),
      bannedUntil: u.bannedUntil || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
