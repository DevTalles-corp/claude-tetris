'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#9e9e9e', // Nut - grey
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const startLevelSel = document.getElementById('start-level');
const MAX_START_LEVEL = 15;
let startLevel = 1;

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

// ---- Récords (localStorage) ----
const STORAGE_KEY = 'tetris-records';
const MAX_RECORDS = 5;

function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && Array.isArray(d.scores)) {
      return {
        scores: d.scores.slice(0, MAX_RECORDS),
        bestCombo: +d.bestCombo || 0,
        maxLines: +d.maxLines || 0,
      };
    }
  } catch (e) { /* datos corruptos o localStorage no disponible */ }
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function saveRecords(rec) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch (e) { /* ignorar */ }
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra.
function rankFor(rec, s) {
  if (s <= 0) return -1;
  const idx = rec.scores.findIndex(e => s > e.score);
  if (idx !== -1) return idx;
  return rec.scores.length < MAX_RECORDS ? rec.scores.length : -1;
}

function renderRecords(highlightIdx = -1, previewEntry = null) {
  const rec = loadRecords();
  const rows = rec.scores.slice();
  if (previewEntry && highlightIdx >= 0) rows.splice(highlightIdx, 0, previewEntry);
  recordsList.replaceChildren();
  for (let i = 0; i < MAX_RECORDS; i++) {
    const li = document.createElement('li');
    const e = rows[i];
    const left = document.createElement('span');
    const right = document.createElement('span');
    left.textContent = `${i + 1}. ${e ? e.name : '---'}`;
    right.textContent = e ? e.score.toLocaleString() : '0';
    li.append(left, right);
    if (!e) li.className = 'empty';
    if (i === highlightIdx) li.className = 'highlight';
    recordsList.appendChild(li);
  }
  recordsStats.textContent = `Mejor combo: ${rec.bestCombo} · Máx. líneas: ${rec.maxLines}`;
}

let started = false, combo, maxCombo, pendingRank = -1, pendingEntry = null;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalFor(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  if (gameOver) return;
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-color');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);

  pendingRank = rankFor(rec, score);
  if (pendingRank >= 0) {
    pendingEntry = { name: '...', score };
    nameInput.value = '';
    nameForm.classList.remove('hidden');
    renderRecords(pendingRank, pendingEntry);
    overlay.classList.remove('hidden');
    nameInput.focus();
  } else {
    nameForm.classList.add('hidden');
    renderRecords();
    overlay.classList.remove('hidden');
  }
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
  }
}

function showPauseMenu() {
  pauseMain.classList.remove('hidden');
  pauseControls.classList.add('hidden');
  pauseOverlay.classList.remove('hidden');
  document.getElementById('resume-btn').focus();
}

function hidePauseMenu() {
  pauseOverlay.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  combo = 0;
  maxCombo = 0;
  pendingRank = -1;
  pendingEntry = null;
  nameForm.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar';
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (!started || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('change', () => {
  if (themeToggle.checked) {
    document.body.classList.replace('light-theme', 'dark-theme');
  } else {
    document.body.classList.replace('dark-theme', 'light-theme');
  }
});

restartBtn.addEventListener('click', init);

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (pendingRank < 0) return;
  const name = nameInput.value.trim().slice(0, 10) || 'Jugador';
  const rec = loadRecords();
  // Recalcular posición por si los récords cambiaron (otra pestaña)
  const idx = rankFor(rec, pendingEntry.score);
  if (idx >= 0) {
    rec.scores.splice(idx, 0, { name, score: pendingEntry.score, lines, date: Date.now() });
    rec.scores = rec.scores.slice(0, MAX_RECORDS);
    saveRecords(rec);
  }
  pendingRank = -1;
  nameForm.classList.add('hidden');
  renderRecords(idx);
  restartBtn.focus();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignorar */ }
  pendingRank = -1;
  nameForm.classList.add('hidden');
  renderRecords();
});

// Pantalla de inicio: muestra récords y espera a que el jugador pulse Jugar.
function showStart() {
  board = createBoard();
  next = randomPiece();
  current = next;
  next = randomPiece();
  score = 0; lines = 0; level = 1;
  paused = false;
  gameOver = false;
  started = false;
  updateHUD();
  draw();
  drawNext();
  overlayTitle.textContent = 'TETRIS';
  overlayTitle.style.color = '';
  overlayScore.textContent = '';
  nameForm.classList.add('hidden');
  restartBtn.textContent = 'Jugar';
  renderRecords();
  overlay.classList.remove('hidden');
}

showStart();

for (let i = 1; i <= MAX_START_LEVEL; i++) {
  startLevelSel.add(new Option(i, i));
}
startLevelSel.addEventListener('change', () => {
  startLevel = parseInt(startLevelSel.value, 10);
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('pause-restart-btn').addEventListener('click', init);
document.getElementById('controls-btn').addEventListener('click', () => {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
  document.getElementById('controls-back-btn').focus();
});
document.getElementById('controls-back-btn').addEventListener('click', () => {
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
  document.getElementById('controls-btn').focus();
});

