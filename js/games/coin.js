document.addEventListener("DOMContentLoaded", () => {
  const play = document.getElementById("coin-play");
  const coin = document.getElementById("coin-mesh");
  const result = document.getElementById("coin-result");
  const side = document.getElementById("coin-side");
  const stakeInput = document.getElementById("coin-stake");
  const log = document.getElementById("coin-log");
  if (!play || !coin) return;
  document.querySelectorAll(".side-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("on", b === btn));
      side.value = btn.dataset.side;
    });
  });

  let busy = false;
  let angle = 0;

  coin.style.transform = "rotateY(0deg)";

  play.addEventListener("click", async () => {
    if (busy) return;
    if (!gameEnabled("coin")) {
      result.className = "result lose";
      result.textContent = "Игра отключена администратором.";
      return;
    }
    const stake = parseStake(stakeInput);
    if (stake == null) return;
    if (getBalance() < stake) {
      result.className = "result lose";
      result.textContent = "Недостаточно средств.";
      return;
    }

    busy = true;
    play.disabled = true;
    addBalance(-stake);
    result.className = "result";
    result.textContent = "Монета в воздухе.";

    const pick = side.value;
    const win = chanceWin("coin");
    const outcome = win ? pick : pick === "heads" ? "tails" : "heads";
    const extra = outcome === "heads" ? 0 : 180;
    const from = angle;
    angle = from + 1800 + ((extra - (from % 360) + 360) % 360);

    coin.getAnimations().forEach((a) => a.cancel());
    const anim = coin.animate(
      [
        { transform: "rotateY(" + from + "deg)" },
        { transform: "rotateY(" + angle + "deg)" }
      ],
      { duration: 2000, easing: "cubic-bezier(.15,.7,.12,1)", fill: "forwards" }
    );
    try { await anim.finished; } catch (e) {}
    try { coin.style.transform = "rotateY(" + angle + "deg)"; } catch (e) {}

    try {
      if (win) {
        addBalance(stake * 2);
        result.className = "result win";
        result.textContent = "Выигрыш +" + (stake * 2).toFixed(2);
        toast("Выигрыш +" + (stake * 2).toFixed(2), "ok");
      } else {
        result.className = "result lose";
        result.textContent = "Проигрыш -" + stake.toFixed(2);
        toast("Проигрыш -" + stake.toFixed(2), "no");
      }
      pushLog(log, (win ? "Победа" : "Поражение") + " · " + (outcome === "heads" ? "орёл" : "решка") + " · " + stake.toFixed(2));
    } finally {
      busy = false;
      play.disabled = false;
    }
  });
});
