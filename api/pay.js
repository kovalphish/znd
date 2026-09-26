const { loadPays } = require("./store");

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "");
  try {
    const pays = await loadPays();
    const p = pays.find((x) => x.id === id);
    if (!p) {
      res.status(404).json({ error: "no pay" });
      return;
    }
    res.status(200).json(p);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
