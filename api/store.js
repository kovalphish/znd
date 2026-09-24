const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

async function redis(command) {
  if (!url || !token) throw new Error("NO_KV");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const data = await res.json();
  return data.result;
}

async function getJson(key, fallback) {
  const raw = await redis(["GET", key]);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function setJson(key, value) {
  await redis(["SET", key, JSON.stringify(value)]);
}

async function loadUsers() { return getJson("znd:users", []); }
async function saveUsers(list) { return setJson("znd:users", list); }
async function loadPays() { return getJson("znd:pays", []); }
async function savePays(list) { return setJson("znd:pays", list); }

module.exports = { loadUsers, saveUsers, loadPays, savePays };

async function loadCfg() { return getJson("znd:cfg", { pay: { cardNumber: "", cardName: "" } }); }
async function saveCfg(v) { return setJson("znd:cfg", v); }
module.exports.loadCfg = loadCfg;
module.exports.saveCfg = saveCfg;
