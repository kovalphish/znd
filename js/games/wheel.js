document.addEventListener("DOMContentLoaded", () => {
  const play = document.getElementById("wheel-play");
  const wheel = document.getElementById("wheel-disk");
  const result = document.getElementById("wheel-result");
  const stakeInput = document.getElementById("wheel-stake");
  const log = document.getElementById("wheel-log");
  if (!play || !wheel) return;
  const sectors = [0, 1.2, 0.5, 2, 0.2, 3, 0.5, 5];
  let angle = 0;
  let busy = false;

  play.addEventListener("click", async () => {
    if (busy) return;
    if (!gameEnabled("wheel")) { result.className = "result lose"; result.textContent = "Игра отключена."; return; }
    const stake = parseStake(stakeInput);
    if (stake == null) return;
    if (getBalance() < stake) { result.className = "result lose"; result.textContent = "Недостаточно средств."; return; }
    addBalance(-stake);
    busy = true;
    play.disabled = true;
    const win = chanceWin("wheel");
    const idx = win ? [3, 5, 7][Math.floor(Math.random() * 3)] : [0, 2, 4, 6][Math.floor(Math.random() * 4)];
    const slice = 360 / sectors.length;
    const from = angle;
    angle = from + 1800 + (360 - idx * slice - slice / 2);
    wheel.getAnimations().forEach((a) => a.cancel());
    const anim = wheel.animate(
      [
        { transform: "rotate(" + from + "deg)" },
        { transform: "rotate(" + angle + "deg)" }
      ],
      { duration: 3800, easing: "cubic-bezier(.44,-0.2,0,1.13)", fill: "forwards" }
    );
    try { await anim.finished; } catch (e) {}
    const mult = sectors[idx];
    const pay = Math.round(stake * mult * 100) / 100;
    addBalance(pay);
    result.className = "result " + (pay >= stake ? "win" : "lose");
    result.textContent = "x" + mult + " · " + pay.toFixed(2);
    pushLog(log, "x" + mult + " · " + stake.toFixed(2));
    busy = false;
    play.disabled = false;
  });
});
