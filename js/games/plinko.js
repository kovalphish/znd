document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("plinko-canvas");
  const play = document.getElementById("plinko-play");
  const stakeInput = document.getElementById("plinko-stake");
  const result = document.getElementById("plinko-result");
  const log = document.getElementById("plinko-log");
  const ballsInput = document.getElementById("plinko-balls");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const slots = [8, 3, 1.5, 0.7, 0.4, 0.2, 0.4, 0.7, 1.5, 3, 8];
  const rows = 8;
  let pins = [];
  let balls = [];
  let running = 0;

  function visible() {
    return document.getElementById("plinko")?.classList.contains("active");
  }

  let viewW = 320, viewH = 250, dpr = 1;

  function resize() {
    if (!visible()) return;
    const parent = canvas.parentElement;
    viewW = Math.max(280, Math.min(500, parent.clientWidth - 8));
    viewH = 250;
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    draw();
  }

  function layout() {
    pins = [];
    const top = 16;
    const gapY = 22;
    const gapX = viewW / 13;
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const startX = (viewW - (count - 1) * gapX) / 2;
      for (let i = 0; i < count; i++) {
        pins.push({ x: startX + i * gapX, y: top + r * gapY, r: 3.6 });
      }
    }
  }

  function slotIndexFromX(x) {
    const w = viewW / slots.length;
    return Math.max(0, Math.min(slots.length - 1, Math.floor(x / w)));
  }

  function chooseTarget() {
    const win = chanceWin("plinko");
    if (!win) {
      const mid = Math.floor(slots.length / 2);
      return mid + (Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1));
    }
    return Math.random() < 0.5 ? 0 : slots.length - 1;
  }

  function startBalls() {
    if (!gameEnabled("plinko")) {
      result.className = "result lose";
      result.textContent = "Игра отключена администратором.";
      return;
    }
    const stake = parseStake(stakeInput);
    if (stake == null) return;
    const count = Math.max(1, Math.min(10, Number(ballsInput?.value) || 1));
    const total = stake * count;
    if (getBalance() < total) {
      result.className = "result lose";
      result.textContent = "Недостаточно средств.";
      return;
    }
    addBalance(-total);
    resize();
    const slotW = viewW / slots.length;
    for (let i = 0; i < count; i++) {
      const target = chooseTarget();
      balls.push({
        x: viewW / 2 + (i - (count - 1) / 2) * 10,
        y: 8 - i * 12,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 0,
        r: 6.2,
        stake,
        targetX: slotW * target + slotW / 2,
        done: false
      });
      running += 1;
    }
    play.disabled = true;
    result.className = "result";
    result.textContent = "В игре шариков: " + count;
    loop();
  }

  function stepBall(ball) {
    ball.vy += 0.26;
    ball.vx += (ball.targetX - ball.x) * 0.008;
    ball.vx *= 0.986;
    ball.x += ball.vx;
    ball.y += ball.vy;

    for (const p of pins) {
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const dist = Math.hypot(dx, dy);
      const min = ball.r + p.r;
      if (dist < min && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = min - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 1.5 * dot * nx) * 0.72;
        ball.vy = (ball.vy - 1.5 * dot * ny) * 0.72;
      }
    }

    if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -0.35; }
    if (ball.x > viewW - ball.r) { ball.x = viewW - ball.r; ball.vx *= -0.35; }

    if (ball.y > viewH - 38) finishBall(ball);
  }

  function finishBall(ball) {
    if (ball.done) return;
    ball.done = true;
    running -= 1;
    const idx = slotIndexFromX(ball.x);
    const mult = slots[idx];
    const pay = Math.round(ball.stake * mult * 100) / 100;
    addBalance(pay);
    pushLog(log, "x" + mult + " · " + ball.stake.toFixed(2) + " -> " + pay.toFixed(2));
    if (running <= 0) {
      play.disabled = false;
      result.className = "result";
      result.textContent = "Серия завершена.";
      balls = balls.filter((b) => !b.done);
    }
  }

  function loop() {
    if (!visible()) return;
    balls.forEach((b) => { if (!b.done) stepBall(b); });
    balls = balls.filter((b) => !b.done || b.y < viewH + 20);
    draw();
    if (running > 0) requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.fillStyle = "#8d8d8d";
    pins.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const w = viewW / slots.length;
    slots.forEach((m, i) => {
      const hot = m >= 1.5;
      const x = i * w + 2;
      const y = viewH - 28;
      ctx.fillStyle = hot ? "#2a3d10" : "#1c1c1c";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w - 4, 24, 6);
      else ctx.rect(x, y, w - 4, 24);
      ctx.fill();
      ctx.fillStyle = hot ? "#b6ff3b" : "#d7d7d7";
      ctx.font = "700 11px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("x" + m, i * w + w / 2, y + 12);
    });

    balls.forEach((b) => {
      if (b.done) return;
      ctx.fillStyle = "#b6ff3b";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  play.addEventListener("click", startBalls);
  window.addEventListener("resize", resize);
  document.querySelectorAll("[data-open],[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => setTimeout(resize, 40));
  });
});
