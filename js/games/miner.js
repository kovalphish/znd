document.addEventListener("DOMContentLoaded", () => {
  const board = document.getElementById("mines-board");
  const startBtn = document.getElementById("miner-start");
  const cashBtn = document.getElementById("miner-cash");
  const result = document.getElementById("miner-result");
  const stakeInput = document.getElementById("miner-stake");
  const minesInput = document.getElementById("miner-count");
  const log = document.getElementById("miner-log");
  if (!board) return;

  const SIZE = 5;
  let live = false;
  let stake = 0;
  let opened = 0;
  let mult = 1;

  function currentPayout() {
    return Math.round(stake * mult * 100) / 100;
  }

  function renderEmpty() {
    board.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    board.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const b = document.createElement("button");
      b.className = "cell";
      b.disabled = true;
      board.appendChild(b);
    }
  }

  function begin() {
    if (!gameEnabled("miner")) {
      result.className = "result lose";
      result.textContent = "Игра отключена администратором.";
      return;
    }
    const s = parseStake(stakeInput);
    if (s == null) return;
    if (getBalance() < s) {
      result.className = "result lose";
      result.textContent = "Недостаточно средств.";
      return;
    }
    stake = s;
    opened = 0;
    mult = 1;
    live = true;
    addBalance(-stake);
    cashBtn.disabled = true;
    startBtn.disabled = true;
    result.className = "result";
    result.textContent = "Открывайте клетки. Можно забрать выигрыш.";

    board.innerHTML = "";
    board.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const b = document.createElement("button");
      b.className = "cell";
      b.addEventListener("click", () => reveal(b));
      board.appendChild(b);
    }
  }

  function reveal(cell) {
    if (!live || cell.disabled) return;
    const safe = chanceWin("miner");
    cell.disabled = true;
    if (!safe) {
      cell.classList.add("mine");
      cell.textContent = "X";
      live = false;
      startBtn.disabled = false;
      cashBtn.disabled = true;
      result.className = "result lose";
      result.textContent = "Мина. Потеря ставки " + stake.toFixed(2);
      pushLog(log, "Мина · -" + stake.toFixed(2));
      [...board.children].forEach((c) => (c.disabled = true));
      return;
    }
    opened += 1;
    const mines = Math.max(1, Math.min(10, Number(minesInput.value) || 3));
    const left = SIZE * SIZE - opened;
    const risk = mines / Math.max(1, left + mines);
    mult = Math.round((mult * (1 + risk * 1.35)) * 100) / 100;
    cell.classList.add("safe");
    cell.textContent = mult.toFixed(2);
    cashBtn.disabled = false;
    result.className = "result";
    result.textContent = "Множитель x" + mult.toFixed(2) + " · к выплате " + currentPayout().toFixed(2);
  }

  function cashout() {
    if (!live || opened === 0) return;
    const pay = currentPayout();
    addBalance(pay);
    live = false;
    startBtn.disabled = false;
    cashBtn.disabled = true;
    [...board.children].forEach((c) => (c.disabled = true));
    result.className = "result win";
    result.textContent = "Забрано " + pay.toFixed(2);
    pushLog(log, "Вывод x" + mult.toFixed(2) + " · +" + pay.toFixed(2));
  }

  startBtn.addEventListener("click", begin);
  cashBtn.addEventListener("click", cashout);
  renderEmpty();
});
