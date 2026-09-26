document.addEventListener("DOMContentLoaded", () => {
  const play = document.getElementById("limbo-play");
  const result = document.getElementById("limbo-result");
  const out = document.getElementById("limbo-out");
  const fill = document.getElementById("limbo-fill");
  const stakeInput = document.getElementById("limbo-stake");
  const targetInput = document.getElementById("limbo-target");
  const log = document.getElementById("limbo-log");
  if (!play) return;

  play.addEventListener("click", () => {
    if (!gameEnabled("limbo")) { result.className = "result lose"; result.textContent = "Игра отключена."; return; }
    const stake = parseStake(stakeInput);
    const target = Math.max(1.01, Number(targetInput.value) || 2);
    if (stake == null) return;
    if (getBalance() < stake) { result.className = "result lose"; result.textContent = "Недостаточно средств."; return; }
    addBalance(-stake);
    const win = chanceWin("limbo");
    let rolled;
    if (win) rolled = target + Math.random() * target;
    else rolled = 1 + Math.random() * (target - 1.01);
    rolled = Math.max(1, Math.round(rolled * 100) / 100);
    if (out) {
      out.classList.remove("pop");
      void out.offsetWidth;
      out.classList.add("pop");
      out.textContent = "x" + rolled.toFixed(2);
    }
    if (fill) {
      const pct = Math.min(100, (rolled / Math.max(target * 2, 4)) * 100);
      fill.style.width = pct + "%";
      fill.classList.toggle("hot", rolled >= target);
    }
    if (win && rolled >= target) {
      const pay = Math.round(stake * target * 100) / 100;
      addBalance(pay);
      result.className = "result win";
      result.textContent = "Цель x" + target.toFixed(2) + " взята";
    } else {
      result.className = "result lose";
      result.textContent = "Бросок ниже цели";
    }
    pushLog(log, "x" + rolled.toFixed(2) + " / цель x" + target.toFixed(2));
  });
});
