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
  '#9fa8da', // J - light indigo blue
  '#ffb74d', // L - orange
  '#f48fb1', // Ring - pink
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // Ring (hueco central)
];

const RING = 8;
const RING_CHANCE = 0.05; // probabilidad de la pieza anillo; las otras 7 se reparten el resto

const LINE_SCORES =[0, 100, 300, 500, 800];

const BOLT_SCORE_STEP = 2000; // puntos necesarios para cargar un rayo
const BOLT_MS = 500;          // duración del efecto del rayo

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const boltEl = document.getElementById('bolt');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
let gridColor = '#22222e';

// Records locales
const RECORDS_KEY = 'tetrisRecords';
const BESTS_KEY = 'tetrisBests';
const MAX_RECORDS = 5;
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startRecordsEl = document.getElementById('start-records');
const overlayRecordsEl = document.getElementById('overlay-records');
const recordEntry = document.getElementById('record-entry');
const recordMsg = document.getElementById('record-msg');
const recordName = document.getElementById('record-name');
const recordSave = document.getElementById('record-save');
const overlayResetBtn = document.getElementById('overlay-reset-records');
let combo = 0, bestCombo = 0;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bolt, nextBoltAt;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < RING_CHANCE ? RING : Math.floor(Math.random() * 7) + 1;
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
    if (combo > bestCombo) bestCombo = combo;
  } else {
    combo = 0;
  }
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
  if (tryStartBolt()) return; // spawn() se llama al terminar el rayo
  spawn();
}

function tryStartBolt() {
  if (score < nextBoltAt) return false;
  const candidates = [];
  for (let r = 0; r < ROWS; r++)
    if (board[r].some(v => v)) candidates.push({ kind: 'row', index: r });
  for (let c = 0; c < COLS; c++)
    if (board.some(row => row[c])) candidates.push({ kind: 'col', index: c });
  if (!candidates.length) return false; // tablero vacío: el rayo queda pendiente
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  bolt = { ...pick, t: 0 };
  nextBoltAt = (Math.floor(score / BOLT_SCORE_STEP) + 1) * BOLT_SCORE_STEP;
  canvas.classList.add('shake');
  updateHUD();
  return true;
}

function finishBolt() {
  if (bolt.kind === 'row') {
    board.splice(bolt.index, 1);
    board.unshift(new Array(COLS).fill(0));
  } else {
    for (let r = 0; r < ROWS; r++) board[r][bolt.index] = 0;
  }
  bolt = null;
  canvas.classList.remove('shake');
  updateHUD();
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
  boltEl.textContent = Math.max(0, nextBoltAt - score).toLocaleString();
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

  if (bolt) {
    drawBolt();
    return;
  }

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

function drawBolt() {
  const p = Math.min(bolt.t / BOLT_MS, 1);
  const isRow = bolt.kind === 'row';
  const bx = isRow ? 0 : bolt.index * BLOCK;
  const by = isRow ? bolt.index * BLOCK : 0;
  const bw = isRow ? COLS * BLOCK : BLOCK;
  const bh = isRow ? BLOCK : ROWS * BLOCK;

  ctx.save();

  // franja parpadeante
  ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#fff176';
  ctx.globalAlpha = (1 - p) * (0.5 + Math.random() * 0.5);
  ctx.fillRect(bx, by, bw, bh);

  // rayo en zigzag con chisporroteo
  const len = isRow ? bw : bh;
  const mid = (isRow ? by : bx) + BLOCK / 2;
  const steps = 14;
  ctx.globalAlpha = 1 - p * 0.6;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#ffeb3b';
  ctx.shadowBlur = 20;
  for (const [color, width] of [['#fff59d', 5], ['#ffffff', 2]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const along = (len * i) / steps;
      const off = mid + (i === 0 || i === steps ? 0 : (Math.random() - 0.5) * BLOCK * 1.2);
      if (isRow) ctx.lineTo(along, off);
      else ctx.lineTo(off, along);
    }
    ctx.stroke();
  }

  // destello general al inicio
  if (p < 0.25) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.35 * (1 - p * 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // texto
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 1 - p;
  ctx.fillStyle = '#fff59d';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('¡RAYO!', canvas.width / 2, canvas.height / 2);

  ctx.restore();
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

  commitBests();

  if (qualifies(score)) {
    // Mientras se pide el nombre no se puede reiniciar ni borrar records (se perdería la puntuación)
    recordMsg.textContent = '¡Entraste en el top 5! Escribe tu nombre';
    recordName.value = 'Jugador';
    recordEntry.classList.remove('hidden');
    overlayRecordsEl.classList.add('hidden');
    restartBtn.style.display = 'none';
    overlayResetBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
    recordName.focus();
    recordName.select();
  } else {
    recordEntry.classList.add('hidden');
    overlayRecordsEl.classList.remove('hidden');
    overlayResetBtn.classList.remove('hidden');
    renderRecords(overlayRecordsEl, null);
    overlay.classList.remove('hidden');
  }
}

// Guarda mejor combo / líneas máximas de la partida en curso
function commitBests() {
  const bests = loadBests();
  bests.maxCombo = Math.max(bests.maxCombo, bestCombo);
  bests.maxLines = Math.max(bests.maxLines, lines || 0);
  saveBests(bests);
}

// ---- Records (localStorage) ----
function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter(r => r && typeof r === 'object' && Number.isFinite(r.score))
      .map(r => ({
        name: String(r.name ?? '').slice(0, 12),
        score: r.score,
        lines: Number.isFinite(r.lines) ? r.lines : 0,
        combo: Number.isFinite(r.combo) ? r.combo : 0,
        date: String(r.date ?? ''),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
  } catch (e) {
    return [];
  }
}

function saveRecords(list) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(list)); } catch (e) {}
}

function loadBests() {
  try {
    const d = JSON.parse(localStorage.getItem(BESTS_KEY));
    return {
      maxCombo: d && Number.isFinite(d.maxCombo) ? d.maxCombo : 0,
      maxLines: d && Number.isFinite(d.maxLines) ? d.maxLines : 0,
    };
  } catch (e) {
    return { maxCombo: 0, maxLines: 0 };
  }
}

function saveBests(b) {
  try { localStorage.setItem(BESTS_KEY, JSON.stringify(b)); } catch (e) {}
}

function qualifies(s) {
  if (s <= 0) return false;
  const list = loadRecords();
  return list.length < MAX_RECORDS || s > list[list.length - 1].score;
}

function submitRecord() {
  if (recordEntry.classList.contains('hidden')) return; // evita doble guardado
  const entry = {
    name: recordName.value.trim().slice(0, 12) || 'Jugador',
    score,
    lines,
    combo: bestCombo,
    date: new Date().toISOString().slice(0, 10),
  };
  const list = loadRecords();
  let idx = list.findIndex(r => r.score < entry.score);
  if (idx === -1) idx = list.length;
  list.splice(idx, 0, entry);
  list.length = Math.min(list.length, MAX_RECORDS);
  saveRecords(list);
  recordEntry.classList.add('hidden');
  overlayRecordsEl.classList.remove('hidden');
  overlayResetBtn.classList.remove('hidden');
  restartBtn.style.display = '';
  renderRecords(overlayRecordsEl, idx < MAX_RECORDS ? idx : null);
  restartBtn.focus();
}

function renderRecords(container, highlight) {
  container.textContent = '';
  const list = loadRecords();
  const bests = loadBests();
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'hs-empty';
    p.textContent = 'Aún no hay records';
    container.appendChild(p);
  } else {
    const table = document.createElement('table');
    table.className = 'hs-table';
    const head = table.insertRow();
    for (const h of ['#', 'NOMBRE', 'PUNTOS', 'LÍN', 'COMBO']) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    list.forEach((r, i) => {
      const tr = table.insertRow();
      if (i === highlight) tr.className = 'hs-new';
      tr.title = r.date;
      for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.combo]) {
        tr.insertCell().textContent = v;
      }
    });
    container.appendChild(table);
  }
  const b = document.createElement('div');
  b.className = 'hs-bests';
  const c = document.createElement('span');
  c.textContent = `Mejor combo: ${bests.maxCombo}`;
  const l = document.createElement('span');
  l.textContent = `Líneas máx.: ${bests.maxLines}`;
  b.append(c, l);
  container.appendChild(b);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(BESTS_KEY);
  } catch (e) {}
  renderRecords(startRecordsEl, null);
  if (!overlayRecordsEl.classList.contains('hidden')) renderRecords(overlayRecordsEl, null);
}

function showStartScreen() {
  renderRecords(startRecordsEl, null);
  startScreen.classList.remove('hidden');
  startBtn.focus();
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
  const dt = ts - lastTime;
  lastTime = ts;
  if (bolt) {
    bolt.t += dt;
    if (bolt.t >= BOLT_MS) finishBolt();
  } else {
    dropAccum += dt;
  }
  if (!bolt && dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  if (current && !gameOver) commitBests(); // partida abandonada con Reiniciar
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  bolt = null;
  nextBoltAt = BOLT_SCORE_STEP;
  combo = 0;
  bestCombo = 0;
  startScreen.classList.add('hidden');
  recordEntry.classList.add('hidden');
  overlayRecordsEl.classList.add('hidden');
  overlayResetBtn.classList.add('hidden');
  restartBtn.style.display = '';
  canvas.classList.remove('shake');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Escribir en un campo de texto no debe disparar teclas del juego
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  // Pantalla de inicio: Enter empieza la partida (si el foco está en un botón, su click ya lo hace)
  if (!startScreen.classList.contains('hidden')) {
    if (e.code === 'Enter' && e.target.tagName !== 'BUTTON') init();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver || bolt) return;
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

startBtn.addEventListener('click', init);
recordSave.addEventListener('click', submitRecord);
recordName.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); submitRecord(); }
});
document.getElementById('start-reset-records').addEventListener('click', resetRecords);
document.getElementById('overlay-reset-records').addEventListener('click', resetRecords);

function setTheme(theme, save = true) {
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#22222e';
  const isLight = theme === 'light';
  themeBtn.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  if (save) {
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  // Redibujar para que el cambio se vea también en pausa o game over
  if (current) { draw(); drawNext(); }
}

themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Espacio active el botón
});

setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', false);

// El juego empieza desde la pantalla de inicio (botón Jugar o Enter)
showStartScreen();
