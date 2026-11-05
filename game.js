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
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
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

let gridColor = '#22222e';
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  // refresca el canvas si el loop está detenido (pausa / game over)
  if (current && (paused || gameOver)) { draw(); drawNext(); }
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) {}
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
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
  trackCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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
  merge();
  clearLines();
  spawn();
}

function spawn() {
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

  // en game over la pieza nueva no cabe: no dibujarla encima del tablero
  if (gameOver) return;

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
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
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
  if (gameOver) return; // endGame ocurrió dentro de este frame: no re-programar
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  resetRecordsRun();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // escribir el nombre no debe disparar teclas de juego
  if (e.target instanceof HTMLInputElement) return;
  // pantalla de inicio: Enter empieza, T cambia el tema, el resto se ignora
  if (!started) {
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); startGame(); }
    else if (e.code === 'KeyT') toggleTheme();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('click', () => {
  toggleTheme();
  themeToggle.blur(); // evita que Space alterne el tema durante la partida
});

let savedTheme = 'dark';
try { if (localStorage.getItem('theme') === 'light') savedTheme = 'light'; } catch (e) {}
applyTheme(savedTheme);

// ---- Récords ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;

const startOverlay = document.getElementById('start-overlay');
const startRecords = document.getElementById('start-records');
const startBtn = document.getElementById('start-btn');
const goRecords = document.getElementById('go-records');
const goTable = document.getElementById('go-table');
const goMsg = document.getElementById('go-msg');
const goForm = document.getElementById('go-form');
const nameInput = document.getElementById('name-input');
const saveBtn = document.getElementById('save-btn');

let started = false;   // false hasta pulsar Jugar por primera vez
let combo = 0;         // locks consecutivos que limpian líneas
let maxCombo = 0;      // mejor combo de la partida actual
let pendingSave = false;

function loadRecords() {
  const rec = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.top)) {
      rec.top = data.top
        .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
        .map(e => ({ ...e, name: e.name.slice(0, 12), lines: Number(e.lines) || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS);
    }
    if (data) {
      rec.bestCombo = Number(data.bestCombo) || 0;
      rec.maxLines = Number(data.maxLines) || 0;
    }
  } catch (e) {}
  return rec;
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) {}
}

function trackCombo(cleared) {
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
}

function resetRecordsRun() {
  combo = 0;
  maxCombo = 0;
  pendingSave = false;
  goRecords.classList.add('hidden');
}

// ¿la puntuación entra en el top? devuelve el puesto (0-based) o -1
function qualifyingRank(rec, sc) {
  if (sc <= 0) return -1;
  const idx = rec.top.findIndex(e => sc > e.score);
  if (idx !== -1) return idx;
  return rec.top.length < MAX_RECORDS ? rec.top.length : -1;
}

// pinta tabla + mejor combo / líneas máximas dentro de container
function renderRecords(container, rec, highlightEntry) {
  container.textContent = '';
  const table = document.createElement('table');
  table.className = 'records-table';
  if (!rec.top.length) {
    const p = document.createElement('p');
    p.className = 'records-empty';
    p.textContent = 'Sin récords todavía';
    container.appendChild(p);
  } else {
    rec.top.forEach((e, i) => {
      const tr = document.createElement('tr');
      if (e === highlightEntry) tr.className = 'highlight';
      [`${i + 1}.`, e.name, e.score.toLocaleString(), `${e.lines} líneas`].forEach(t => {
        const td = document.createElement('td');
        td.textContent = t;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    container.appendChild(table);
  }
  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${rec.bestCombo} · Líneas máx.: ${rec.maxLines}`;
  container.appendChild(stats);
}

function showStartRecords() {
  renderRecords(startRecords, loadRecords(), null);
}

function startGame() {
  started = true;
  startOverlay.classList.add('hidden');
  startBtn.blur();
  init();
}

function showGameOverRecords() {
  const rec = loadRecords();
  // mejor combo y líneas máximas se actualizan siempre al terminar
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);

  const rank = qualifyingRank(rec, score);
  pendingSave = rank !== -1;
  goForm.classList.toggle('hidden', !pendingSave);
  goMsg.textContent = pendingSave ? `¡Entras en el top ${MAX_RECORDS}! Puesto ${rank + 1}` : '';
  nameInput.value = '';
  renderRecords(goTable, rec, null);
  goRecords.classList.remove('hidden');
  if (pendingSave) nameInput.focus();
}

function saveEntry() {
  if (!pendingSave) return;
  pendingSave = false;
  const rec = loadRecords();
  const entry = {
    name: nameInput.value.trim().slice(0, 12) || 'Anónimo',
    score,
    lines,
    level,
    date: new Date().toISOString(),
  };
  rec.top.push(entry);
  rec.top.sort((a, b) => b.score - a.score);
  rec.top = rec.top.slice(0, MAX_RECORDS);
  saveRecords(rec);
  goForm.classList.add('hidden');
  goMsg.textContent = '¡Récord guardado!';
  renderRecords(goTable, rec, entry);
  saveBtn.blur();
}

function clearRecords() {
  if (!confirm('¿Borrar todos los récords?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  showStartRecords();
  if (!goRecords.classList.contains('hidden')) {
    // solo refresca la tabla; no reabre el guardado ni re-escribe combo/líneas
    renderRecords(goTable, loadRecords(), null);
  }
}

startBtn.addEventListener('click', startGame);
saveBtn.addEventListener('click', saveEntry);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveEntry(); });
document.querySelectorAll('.clear-records-btn').forEach(b => {
  b.addEventListener('click', () => { clearRecords(); b.blur(); });
});

showStartRecords();

