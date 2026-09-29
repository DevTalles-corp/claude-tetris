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
  '#64b5f6', // J - light blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - nut/tuerca
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - nut/tuerca (con hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Power-ups: aparecen en la pieza `next` cada POWERUP_LINE_INTERVAL líneas
// eliminadas (acumuladas). El efecto se resuelve una sola vez, al encajar la
// pieza (ver resolvePowerUp), y solo afecta a `board` — nunca se guarda un
// valor especial en las celdas, así que el invariante "1-8 = tipo/color/
// ocupado" de las celdas del tablero no cambia.
const POWERUPS = {
  bomb:     { emoji: '💣', color: '#ff5252', label: 'Bomba' },     // destruye un área 3×3
  rayo:     { emoji: '⚡', color: '#fff176', label: 'Rayo' },      // limpia toda(s) la(s) fila(s) que toca
  tinte:    { emoji: '🎨', color: '#e040fb', label: 'Tinte' },     // elimina del tablero un color al azar
  gravedad: { emoji: '🌀', color: '#8d6e63', label: 'Gravedad' },  // compacta huecos en cada columna
  congelar: { emoji: '❄️', color: '#4fc3f7', label: 'Congelar' },  // pausa la caída automática 5s
};
const POWERUP_LINE_INTERVAL = 5;

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
const themeToggle = document.getElementById('theme-toggle');
const highscoreListEl = document.getElementById('highscore-list');
const overlayHighscores = document.getElementById('overlay-highscores');
const overlayHighscoreListEl = document.getElementById('overlay-highscore-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo;
let gridLineColor;
let pendingPowerUp, freezeUntil, announceUntil, announceText;

const THEME_KEY = 'tetris-theme';
const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';

// Records locales (localStorage). `highscores` es un array de hasta 5
// { name, score } ordenado descendente; bestCombo/maxLines son máximos
// históricos independientes de qué partida los produjo, así que viven en
// claves propias en vez de dentro de highscores.
let highscores, bestCombo, maxLines;
let awaitingNameEntry = false;

function loadHighscores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    if (Array.isArray(raw)) {
      return raw
        .filter(e => e && typeof e.name === 'string' && typeof e.score === 'number')
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }
  } catch (e) { /* localStorage corrupto o vacío: se ignora */ }
  return [];
}

function saveHighscores() {
  // try/catch: setItem puede lanzar (Safari en modo privado, cuota superada,
  // iframe sin acceso a storage...). Sin esto una excepción aquí interrumpe
  // lockPiece() antes de que llegue a spawn() y el juego se queda colgado.
  try { localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(highscores)); } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

function loadStoredNumber(key) {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveBestCombo() {
  try { localStorage.setItem(BEST_COMBO_KEY, String(bestCombo)); } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

function saveMaxLines() {
  try { localStorage.setItem(MAX_LINES_KEY, String(maxLines)); } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

function qualifiesForHighscore(s) {
  if (highscores.length < 5) return true;
  return s > highscores[highscores.length - 1].score;
}

function renderHighscoreList(listEl, highlightIndex) {
  listEl.innerHTML = '';
  if (!highscores.length) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin puntuaciones aún';
    listEl.appendChild(li);
    return;
  }
  highscores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'highscore-row';
    if (i === highlightIndex) li.classList.add('highscore-highlight');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'highscore-name';
    nameSpan.textContent = `${i + 1}. ${entry.name}`;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'highscore-value';
    scoreSpan.textContent = entry.score.toLocaleString();
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    listEl.appendChild(li);
  });
}

function renderHighscores(highlightIndex = -1) {
  renderHighscoreList(highscoreListEl, highlightIndex);
  renderHighscoreList(overlayHighscoreListEl, highlightIndex);
}

function renderStats() {
  bestComboEl.textContent = bestCombo;
  maxLinesEl.textContent = maxLines;
}

function showNameEntry() {
  awaitingNameEntry = true;
  nameEntry.classList.remove('hidden');
  nameInput.value = '';
  nameInput.focus();
}

function submitHighscore() {
  if (!awaitingNameEntry) return;
  awaitingNameEntry = false;
  const name = (nameInput.value.trim() || 'Jugador').slice(0, 12);
  // Re-lee de localStorage justo antes de mezclar: si otra pestaña guardó una
  // entrada mientras esta partida estaba en curso, no la pisamos con nuestra
  // copia en memoria (posiblemente desactualizada).
  highscores = loadHighscores();
  highscores.push({ name, score });
  highscores.sort((a, b) => b.score - a.score);
  highscores = highscores.slice(0, 5);
  saveHighscores();
  nameEntry.classList.add('hidden');
  const idx = highscores.findIndex(e => e.name === name && e.score === score);
  renderHighscores(idx);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === 'light';
  gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function powerUpPiece() {
  const piece = randomPiece();
  const keys = Object.keys(POWERUPS);
  piece.powerUp = keys[Math.floor(Math.random() * keys.length)];
  return piece;
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

// Elimina las filas indicadas (índices en `board`, en cualquier orden) y
// aplica la puntuación/nivel/hito de power-up correspondientes. La usan
// tanto clearLines (filas completas) como el Rayo (fuerza el borrado de
// filas aunque no estén completas).
function clearRows(rowIndices) {
  const toClear = new Set(rowIndices);
  const cleared = toClear.size;
  if (!cleared) return;
  board = board.filter((_, r) => !toClear.has(r));
  while (board.length < ROWS) board.unshift(new Array(COLS).fill(0));

  const prevMilestone = Math.floor(lines / POWERUP_LINE_INTERVAL);
  lines += cleared;
  if (Math.floor(lines / POWERUP_LINE_INTERVAL) > prevMilestone) pendingPowerUp = true;
  score += (LINE_SCORES[cleared] || 0) * level;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  updateHUD();
}

function clearLines() {
  const full = [];
  for (let r = 0; r < ROWS; r++)
    if (board[r].every(v => v !== 0)) full.push(r);
  clearRows(full);
}

// Aplica el efecto de una pieza especial justo después de encajarla
// (`current` sigue siendo la pieza que acaba de fijarse). Solo muta
// `board`/`freezeUntil`; nunca escribe un valor de celda fuera de 0-8.
function resolvePowerUp(type) {
  const piece = current;
  switch (type) {
    case 'bomb': {
      // Centro de la bomba = centro de las celdas realmente ocupadas (no del
      // bounding box de la matriz), para que quede centrada en la I tumbada.
      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c]) {
            minR = Math.min(minR, r); maxR = Math.max(maxR, r);
            minC = Math.min(minC, c); maxC = Math.max(maxC, c);
          }
      const cy = piece.y + Math.round((minR + maxR) / 2);
      const cx = piece.x + Math.round((minC + maxC) / 2);
      for (let r = cy - 1; r <= cy + 1; r++)
        for (let c = cx - 1; c <= cx + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      break;
    }
    case 'rayo': {
      const rows = new Set();
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c]) rows.add(piece.y + r);
      clearRows([...rows]);
      break;
    }
    case 'tinte': {
      const present = new Set();
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c]) present.add(board[r][c]);
      if (present.size) {
        const colors = [...present];
        const target = colors[Math.floor(Math.random() * colors.length)];
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === target) board[r][c] = 0;
      }
      break;
    }
    case 'gravedad': {
      for (let c = 0; c < COLS; c++) {
        const colVals = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) colVals.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--) board[r][c] = colVals.length ? colVals.pop() : 0;
      }
      break;
    }
    case 'congelar':
      freezeUntil = performance.now() + 5000;
      break;
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
  const linesBefore = lines;
  if (current.powerUp) resolvePowerUp(current.powerUp);
  clearLines();
  // Combo = número de encajes consecutivos que limpiaron al menos una línea
  // (un lock puede disparar clearRows() dos veces vía Rayo + clearLines, así
  // que comparamos `lines` antes/después de todo el proceso en vez de
  // enganchar el contador dentro de clearRows()).
  if (lines > linesBefore) {
    combo++;
    if (combo > bestCombo) {
      bestCombo = combo;
      saveBestCombo();
      renderStats();
    }
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = pendingPowerUp ? powerUpPiece() : randomPiece();
  pendingPowerUp = false;
  if (current.powerUp) {
    const p = POWERUPS[current.powerUp];
    announceText = `${p.emoji} ¡Pieza especial: ${p.label}!`;
    announceUntil = performance.now() + 2500;
  }
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

function drawBlock(context, x, y, colorIndex, size, alpha, overrideColor) {
  if (!colorIndex) return;
  const color = overrideColor || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
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
  const glow = current.powerUp ? POWERUPS[current.powerUp].color : null;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; }
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, glow);
  ctx.shadowBlur = 0;

  // indicador de congelación
  if (freezeUntil > 0) {
    const remaining = Math.max(0, (freezeUntil - performance.now()) / 1000);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(4, 4, 168, 26);
    ctx.fillStyle = POWERUPS.congelar.color;
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`❄ Congelado ${remaining.toFixed(1)}s`, 10, 22);
  }

  // aviso grande y temporal cuando aparece una pieza especial (2.5s), para
  // que el power-up sea imposible de pasar por alto además del brillo en
  // la vista previa.
  if (announceUntil > 0) {
    if (performance.now() >= announceUntil) {
      announceUntil = 0;
    } else {
      ctx.font = 'bold 18px sans-serif';
      const textWidth = ctx.measureText(announceText).width;
      const boxW = textWidth + 28, boxH = 36;
      const boxX = (canvas.width - boxW) / 2, boxY = 50;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(announceText, canvas.width / 2, boxY + 24);
      ctx.textAlign = 'left';
    }
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  const glow = next.powerUp ? POWERUPS[next.powerUp].color : null;
  if (glow) { nextCtx.shadowColor = glow; nextCtx.shadowBlur = 10; }
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, glow);
  nextCtx.shadowBlur = 0;
  if (next.powerUp) {
    // Fondo opaco + fillStyle explícito: sin esto el emoji hereda el
    // fillStyle translúcido que deja el último drawBlock (el highlight
    // "rgba(255,255,255,0.12)"), y en fuentes sin glifo de color a todo
    // color se ve casi invisible.
    nextCtx.fillStyle = 'rgba(0,0,0,0.55)';
    nextCtx.fillRect(0, 0, 28, 28);
    nextCtx.fillStyle = '#ffffff';
    nextCtx.font = 'bold 20px sans-serif';
    nextCtx.textAlign = 'left';
    nextCtx.fillText(POWERUPS[next.powerUp].emoji, 3, 22);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');

  if (lines > maxLines) {
    maxLines = lines;
    saveMaxLines();
  }
  renderStats();

  if (qualifiesForHighscore(score)) {
    showNameEntry();
  } else {
    awaitingNameEntry = false;
    nameEntry.classList.add('hidden');
  }
  // El TOP 5 solo debe verse en el overlay de Game Over, no en el de PAUSA
  // (que reutiliza el mismo #overlay pero no llama a esta función) — se
  // vuelve a ocultar en init() al reiniciar.
  overlayHighscores.classList.remove('hidden');
  renderHighscores();
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
  // Congelar solo pausa la caída automática; mover/rotar/soft-drop/hard-drop
  // del jugador siguen funcionando con normalidad durante los 5s.
  if (freezeUntil > 0 && ts < freezeUntil) {
    dropAccum = 0;
  } else {
    freezeUntil = 0;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  if (gameOver) return; // lockPiece() pudo terminar el juego en este mismo frame; no programar otro
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
  pendingPowerUp = false;
  freezeUntil = 0;
  announceUntil = 0;
  announceText = '';
  combo = 0;
  awaitingNameEntry = false;
  nameEntry.classList.add('hidden');
  overlayHighscores.classList.add('hidden');
  renderHighscores();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    submitHighscore();
  }
});
nameInput.addEventListener('blur', submitHighscore);
saveScoreBtn.addEventListener('click', submitHighscore);

resetRecordsBtn.addEventListener('click', () => {
  const confirmed = confirm('¿Seguro que quieres borrar los records?');
  // confirm() bloquea el hilo principal (y por tanto rAF) mientras está
  // abierto; el botón es alcanzable con una partida en curso, así que sin
  // resembrar lastTime/dropAccum el próximo tick de loop() vería el tiempo
  // real transcurrido como un `dt` enorme y provocaría una caída/lock
  // instantáneo de la pieza actual en cuanto se cierre el diálogo (mismo
  // motivo por el que togglePause() resiembra lastTime al reanudar).
  lastTime = performance.now();
  dropAccum = 0;
  if (!confirmed) return;
  highscores = [];
  bestCombo = 0;
  maxLines = 0;
  localStorage.removeItem(HIGHSCORES_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  renderHighscores();
  renderStats();
});

applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
highscores = loadHighscores();
bestCombo = loadStoredNumber(BEST_COMBO_KEY);
maxLines = loadStoredNumber(MAX_LINES_KEY);
renderHighscores();
renderStats();
init();
