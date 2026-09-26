document.addEventListener("DOMContentLoaded", () => {
  const start = document.getElementById("crash-start");
  const cash = document.getElementById("crash-cash");
  const multEl = document.getElementById("crash-mult");
  const result = document.getElementById("crash-result");
  const stakeInput = document.getElementById("crash-stake");
  const log = document.getElementById("crash-log");
  const canvas = document.getElementById("crash-graph");
  if (!start) return;
  const ctx = canvas ? canvas.getContext("2d") : null;
  let live = false;
  let mult = 1;
  let stake = 0;
  let raf = 0;
  let crashAt = 1;
  let t0 = 0;
  let pts = [];

  function size() {
    if (!canvas) return;
    const box = canvas.parentElement;
    const w = Math.max(280, box.clientWidth - 8);
    canvas.width = w * 2;
    canvas.height = 360;
    canvas.style.width = w + "px";
    canvas.style.height = "180px";
    draw(false);
  }
  size();
  window.addEventListener("resize", size);

  function xy(i, maxT, maxM, w, h) {
    const p = pts[i];
    const padL = 56;
    const padB = 36;
    const padT = 20;
    const padR = 16;
    const x = padL + (p.t / Math.max(maxT, 0.01)) * (w - padL - padR);
    const y = h - padB - ((p.m - 1) / Math.max(maxM - 1, 0.2)) * (h - padT - padB);
    return [x, y];
  }

  function draw(boom) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, w, h);

    const maxT = Math.max(4, pts.length ? pts[pts.length - 1].t : 4);
    const maxM = Math.max(2, pts.reduce((m, p) => Math.max(m, p.m), 1) * 1.15);

    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#666";
    ctx.font = "22px Manrope, sans-serif";
    for (let i = 1; i <= 4; i++) {
      const m = 1 + ((maxM - 1) * i) / 4;
      const y = 20 + (1 - i / 4) * (h - 56);
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(w - 12, y);
      ctx.stroke();
      ctx.fillText("x" + m.toFixed(1), 8, y + 8);
    }

    if (pts.length < 2) return;
    const color = boom ? "#ff6a5c" : "#b6ff3b";
    ctx.beginPath();
    pts.forEach((_, i) => {
      const [x, y] = xy(i, maxT, maxM, w, h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const last = xy(pts.length - 1, maxT, maxM, w, h);
    const first = xy(0, maxT, maxM, w, h);
    ctx.lineTo(last[0], h - 36);
    ctx.lineTo(first[0], h - 36);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, boom ? "rgba(255,106,92,.35)" : "rgba(182,255,59,.32)");
    g.addColorStop(1, "rgba(16,16,16,0)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((_, i) => {
      const [x, y] = xy(i, maxT, maxM, w, h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(last[0], last[1], 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick(now) {
    if (!live) return;
    const t = (now - t0) / 1000;
    mult = Math.pow(Math.E, 0.18 * t);
    pts.push({ t, m: mult });
    if (multEl) multEl.textContent = "x" + mult.toFixed(2);
    draw(false);
    if (mult >= crashAt) {
      live = false;
      cash.disabled = true;
      start.disabled = false;
      if (multEl) multEl.classList.add("boom");
      draw(true);
      result.className = "result lose";
      result.textContent = "Слёт на x" + crashAt.toFixed(2);
      pushLog(log, "слёт x" + crashAt.toFixed(2) + " · -" + stake.toFixed(2));
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  start.addEventListener("click", () => {
    if (live) return;
    if (!gameEnabled("crash")) { result.className = "result lose"; result.textContent = "Игра отключена."; return; }
    stake = parseStake(stakeInput);
    if (stake == null) return;
    if (getBalance() < stake) { result.className = "result lose"; result.textContent = "Недостаточно средств."; return; }
    addBalance(-stake);
    live = true;
    mult = 1;
    pts = [{ t: 0, m: 1 }];
    t0 = performance.now();
    if (multEl) multEl.classList.remove("boom");
    start.disabled = true;
    cash.disabled = false;
    const win = chanceWin("crash");
    crashAt = win ? (1.6 + Math.random() * 4.8) : (1.05 + Math.random() * 0.45);
    result.className = "result";
    result.textContent = "График растёт. Заберите сами.";
    raf = requestAnimationFrame(tick);
  });

  cash.addEventListener("click", () => {
    if (!live) return;
    live = false;
    cancelAnimationFrame(raf);
    const pay = Math.round(stake * mult * 100) / 100;
    addBalance(pay);
    cash.disabled = true;
    start.disabled = false;
    result.className = "result win";
    result.textContent = "Забрано x" + mult.toFixed(2) + " · " + pay.toFixed(2);
    pushLog(log, "out x" + mult.toFixed(2) + " · +" + pay.toFixed(2));
  });
});
