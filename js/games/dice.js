document.addEventListener("DOMContentLoaded", () => {
  const play = document.getElementById("dice-play");
  const result = document.getElementById("dice-result");
  const cube = document.getElementById("dice-cube");
  const stakeInput = document.getElementById("dice-stake");
  const log = document.getElementById("dice-log");
  const pickInput = document.getElementById("dice-pick");
  if (!play || !cube) return;

  const pose = {
    1: "rotateX(0deg) rotateY(0deg)",
    2: "rotateX(0deg) rotateY(-90deg)",
    3: "rotateX(-90deg) rotateY(0deg)",
    4: "rotateX(90deg) rotateY(0deg)",
    5: "rotateX(0deg) rotateY(90deg)",
    6: "rotateX(180deg) rotateY(0deg)"
  };

  document.querySelectorAll("[data-dice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-dice]").forEach((b) => b.classList.toggle("on", b === btn));
      pickInput.value = btn.dataset.dice;
    });
  });

  play.addEventListener("click", async () => {
    if (!gameEnabled("dice")) { result.className = "result lose"; result.textContent = "Игра отключена."; return; }
    const stake = parseStake(stakeInput);
    if (stake == null) return;
    if (getBalance() < stake) { result.className = "result lose"; result.textContent = "Недостаточно средств."; return; }
    const pick = Number(pickInput.value) || 1;
    addBalance(-stake);
    const win = chanceWin("dice");
    let roll = pick;
    if (!win) roll = ((pick + Math.floor(Math.random() * 5)) % 6) + 1;

    play.disabled = true;
    cube.getAnimations().forEach((a) => a.cancel());
    const anim = cube.animate(
      [
        { transform: "rotateX(0deg) rotateY(0deg) rotateZ(0deg)" },
        { transform: "rotateX(420deg) rotateY(280deg) rotateZ(120deg)" },
        { transform: "rotateX(780deg) rotateY(640deg) rotateZ(40deg)" },
        { transform: pose[roll] }
      ],
      { duration: 900, easing: "cubic-bezier(.15,.7,.2,1)", fill: "forwards" }
    );
    try { await anim.finished; } catch (e) {}
    cube.style.transform = pose[roll];

    if (win && roll === pick) {
      const pay = stake * 5;
      addBalance(pay);
      result.className = "result win";
      result.textContent = "x5 · +" + pay.toFixed(2);
    } else {
      result.className = "result lose";
      result.textContent = "Выпало " + roll;
    }
    pushLog(log, roll + " · ставка " + stake.toFixed(2));
    play.disabled = false;
  });
});
