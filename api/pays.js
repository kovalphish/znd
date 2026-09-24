const { loadPays } = require("./store");

module.exports = async (req, res) => {
  try {
    const pays = await loadPays();
    res.status(200).json(pays.filter((p) => p.status === "pending"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
