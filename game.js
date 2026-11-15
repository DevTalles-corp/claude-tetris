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
  '#90b4f5', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // U - pink
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
  [[8,0,8],[8,8,8],[0,0,0]],                  // U
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
const holdCanvas = document.getElementById('hold-canvas');
const peekCanvas = document.getElementById('peek-canvas');
const peekSection = document.getElementById('peek-section');
const energyEl = document.getElementById('energy');
const skillBtns = document.querySelectorAll('[data-skill]');
const themeToggle = document.getElementById('theme-toggle');

let gridColor = '#22222e';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toLight = theme === 'dark';
  themeToggle.textContent = toLight ? '☀️' : '🌙';
  const label = toLight ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
}

const ENERGY_PER_LINE = 25, ENERGY_MAX = 100, SLOW_MS = 10000, QUEUE_LEN = 4;
let energy, queue, held, lastLock, peekLeft, slowLeft;
let startLevel = 1;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(exclude) {
  // Con `exclude` sortea entre los demás tipos (nunca devuelve ese).
  const n = PIECES.length - 1 - (exclude ? 1 : 0);
  let type = Math.floor(Math.random() * n) + 1;
  if (exclude && type >= exclude) type++;
  return makePiece(type);
}

function makePiece(type) {
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
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
    updateHUD();
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
  lastLock = { board: board.map(r => [...r]), type: current.type, score, lines, level };
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = queue.shift();
  queue.push(randomPiece());
  if (peekLeft > 0) peekLeft--;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  energyEl.value = energy;
  skillBtns.forEach(b => { b.disabled = energy < ENERGY_MAX; });
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
  ctx.strokeStyle = gridColor;
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

// Dibuja una pieza centrada en un recuadro de 4x4 bloques, desplazado `slot` recuadros hacia abajo.
function drawMini(context, shape, size, slot = 0) {
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2) + slot * 4;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawMini(nextCtx, next.shape, 30);
  const hctx = holdCanvas.getContext('2d');
  hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (held) drawMini(hctx, held.shape, 30);
  peekSection.hidden = peekLeft <= 0;
  if (peekLeft > 0) {
    const pctx = peekCanvas.getContext('2d');
    pctx.clearRect(0, 0, peekCanvas.width, peekCanvas.height);
    [next, ...queue].forEach((p, i) => drawMini(pctx, p.shape, 10, i));
  }
}

// Habilidades: devuelven false si no se pueden aplicar (no se gasta energía).
const SKILLS = [
  () => { peekLeft = 6; drawNext(); },
  () => {
    const p = randomPiece(current.type);
    p.y = current.y;
    if (collide(p.shape, p.x, p.y)) return false;
    current = p;
  },
  () => { slowLeft = SLOW_MS; },
  () => {
    if (!lastLock) return false;
    board = lastLock.board;
    ({ score, lines, level } = lastLock);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    queue.unshift(next);
    queue.pop();
    next = current;
    current = makePiece(lastLock.type);
    lastLock = null;
    drawNext();
  },
  () => {
    if (!held) { held = current; spawn(); return; }
    const p = makePiece(held.type);
    if (collide(p.shape, p.x, p.y)) return false;
    held = makePiece(current.type);
    current = p;
    drawNext();
  },
];

function useSkill(i) {
  if (paused || gameOver || energy < ENERGY_MAX) return;
  if (SKILLS[i]() === false) return;
  energy = 0;
  updateHUD();
  draw();
}

// ---- Records locales (localStorage: `records` = top 5 [{name, score}], `recordStats` = {combo, lines}) ----
const MAX_RECORDS = 5;
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsOver = document.getElementById('records-over');
const recordsStart = document.getElementById('records-start');
const startOverlay = document.getElementById('start-overlay');
let combo = 0, maxCombo = 0;

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch (e) { return fallback; }
}
function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignorar */ } }
const loadRecords = () => {
  const r = loadJSON('records', []);
  return Array.isArray(r) ? r.filter(x => x && typeof x.score === 'number' && typeof x.name === 'string').slice(0, MAX_RECORDS) : [];
};
const loadStats = () => {
  const s = loadJSON('recordStats', {});
  return { combo: Number(s.combo) || 0, lines: Number(s.lines) || 0 };
};

// Rellena `box` con la tabla; `hi` = índice a resaltar. Todo con textContent.
function renderRecords(box, hi = -1) {
  const recs = loadRecords(), st = loadStats();
  box.replaceChildren();
  const ol = document.createElement('ol');
  if (!recs.length) ol.textContent = 'Sin records todavía';
  recs.forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${r.name} — ${r.score.toLocaleString()}`;
    if (i === hi) li.className = 'me';
    ol.append(li);
  });
  const stats = document.createElement('div');
  stats.className = 'stats';
  stats.textContent = `Mejor combo: ${st.combo} · Líneas máx.: ${st.lines}`;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset-records';
  reset.textContent = 'Resetear records';
  reset.addEventListener('click', () => {
    try { localStorage.removeItem('records'); localStorage.removeItem('recordStats'); } catch (e) { /* ignorar */ }
    renderRecords(box);
  });
  box.append(ol, stats, reset);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  const st = loadStats();
  saveJSON('recordStats', { combo: Math.max(st.combo, maxCombo), lines: Math.max(st.lines, lines) });
  const recs = loadRecords();
  const qualifies = score > 0 && (recs.length < MAX_RECORDS || score > recs[recs.length - 1].score);
  nameForm.hidden = !qualifies;
  renderRecords(recordsOver);
  recordsOver.hidden = false;
  overlay.classList.remove('hidden');
  if (qualifies) nameInput.focus();
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = nameInput.value.trim().slice(0, 12) || 'Anónimo';
  const recs = loadRecords();
  const entry = { name, score };
  recs.push(entry);
  recs.sort((a, b) => b.score - a.score); // estable: empates quedan tras el existente
  const top = recs.slice(0, MAX_RECORDS);
  saveJSON('records', top);
  nameInput.value = '';
  nameForm.hidden = true;
  renderRecords(recordsOver, top.indexOf(entry));
  restartBtn.focus();
});

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
  }
  pauseMenu.hidden = !paused;
  if (!paused) document.activeElement.blur();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  slowLeft = Math.max(0, slowLeft - dt);
  if (dropAccum >= dropInterval * (slowLeft > 0 ? 2.5 : 1)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() puede terminar el juego dentro de este frame; no reprogramar el loop
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  pauseMenu.hidden = true;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  energy = 0;
  combo = maxCombo = 0;
  nameForm.hidden = recordsOver.hidden = true;
  startOverlay.classList.add('hidden');
  held = lastLock = null;
  peekLeft = slowLeft = 0;
  queue = Array.from({ length: QUEUE_LEN }, () => randomPiece());
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!current) return; // aún no se pulsó "Jugar"
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  if (e.code >= 'Digit1' && e.code <= 'Digit5') { useSkill(+e.code.slice(5) - 1); return; }
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

skillBtns.forEach(b => b.addEventListener('click', () => { useSkill(+b.dataset.skill); b.blur(); }));
restartBtn.addEventListener('click', init);

// ---- Menú de pausa ----
const pauseMenu = document.getElementById('pause-menu');
const pmLevel = document.getElementById('pm-level');
for (let i = 1; i <= 10; i++) pmLevel.add(new Option(i, i));
document.getElementById('pm-resume').addEventListener('click', togglePause);
document.getElementById('pm-restart').addEventListener('click', () => { init(); document.activeElement.blur(); });
document.getElementById('pm-controls').addEventListener('click', () => {
  const l = document.getElementById('pm-controls-list'); l.hidden = !l.hidden;
  document.activeElement.blur();
});
pmLevel.addEventListener('change', () => { startLevel = +pmLevel.value; pmLevel.blur(); });

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) { /* ignorar */ }
  themeToggle.blur(); // evita que Espacio/Enter reactive el botón
  if (board && current) { draw(); drawNext(); } // redibuja en pausa/game over
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

renderRecords(recordsStart);
document.getElementById('start-btn').addEventListener('click', init);
