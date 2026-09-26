document.addEventListener("DOMContentLoaded", () => {
  const reel = document.getElementById("case-reel");
  const play = document.getElementById("case-open");
  const result = document.getElementById("case-result");
  const title = document.getElementById("case-title");
  const log = document.getElementById("case-log");
  if (!reel || !play) return;

  const CASES = {
    c50: { price: 50, name: "Кейс 50", low: [5, 8, 10, 15, 20, 25, 30], high: [50, 80, 100, 150] },
    c150: { price: 150, name: "Кейс 150", low: [10, 15, 20, 30, 40, 50, 70], high: [150, 250, 400, 600] },
    c250: { price: 250, name: "Кейс 250", name: "Кейс 250", low: [20, 30, 40, 50, 80, 100], high: [250, 400, 500, 750, 1000] }
  };
  CASES.c250.name = "Кейс 250";

  const CARD = 86;
  const WIN_I = 42;
  let busy = false;
  let key = "c50";

  function pick(def, win) {
    const pool = win ? def.high : def.low;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function card(v, hi) {
    const el = document.createElement("div");
    el.className = "case-card" + (hi ? " hi" : "");
    el.innerHTML = "<strong>" + v + "</strong><small>руб</small>";
    el.dataset.v = String(v);
    return el;
  }

  function fill(def, prize, win) {
    reel.innerHTML = "";
    reel.style.transition = "none";
    reel.style.transform = "translateX(0)";
    for (let i = 0; i < 70; i++) {
      const hi = Math.random() < 0.18;
      const v = i === WIN_I ? prize : pick(def, hi);
      reel.appendChild(card(v, i === WIN_I ? win : hi));
    }
  }

  function syncTitle() {
    key = window.ZND_CASE || key;
    const def = CASES[key] || CASES.c50;
    if (title) title.textContent = def.name;
    if (!reel.children.length) fill(def, def.low[0], false);
  }

  document.querySelectorAll("[data-case]").forEach((b) => {
    b.addEventListener("click", () => {
      window.ZND_CASE = b.dataset.case;
      syncTitle();
    });
  });

  play.addEventListener("click", async () => {
    if (busy) return;
    key = window.ZND_CASE || key;
    const def = CASES[key] || CASES.c50;
    if (!gameEnabled(key)) {
      result.className = "result lose";
      result.textContent = "Кейс отключён.";
      return;
    }
    if (getBalance() < def.price) {
      result.className = "result lose";
      result.textContent = "Недостаточно средств.";
      return;
    }
    addBalance(-def.price);
    const win = chanceWin(key);
    const prize = pick(def, win);
    fill(def, prize, win);
    busy = true;
    play.disabled = true;
    const windowEl = reel.parentElement;
    const mid = windowEl.clientWidth / 2;
    const target = mid - (WIN_I * CARD + CARD / 2);
    void reel.offsetWidth;
    reel.style.transition = "transform 4.6s cubic-bezier(.15,0,.1,1)";
    reel.style.transform = "translateX(" + target + "px)";
    await new Promise((r) => setTimeout(r, 4700));
    const winCard = reel.children[WIN_I];
    if (winCard) winCard.classList.add("hit");
    addBalance(prize);
    result.className = "result " + (prize >= def.price ? "win" : "lose");
    result.textContent = "Выпало " + prize.toFixed(0);
    pushLog(log, def.name + " · " + prize);
    busy = false;
    play.disabled = false;
  });

  syncTitle();
});
