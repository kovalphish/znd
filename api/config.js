const { loadCfg, saveCfg } = require("./store");
function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
}
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      res.status(200).json(await loadCfg());
      return;
    }
    const body = await readBody(req);
    const cfg = await loadCfg();
    cfg.pay = cfg.pay || {};
    cfg.games = cfg.games || {};
    if (body.cardNumber != null) cfg.pay.cardNumber = body.cardNumber;
    if (body.cardName != null) cfg.pay.cardName = body.cardName;
    if (body.games) {
      cfg.games = Object.assign({}, cfg.games, body.games);
    }
    await saveCfg(cfg);
    res.status(200).json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
