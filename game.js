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
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - nut (silver)
  '#ff5252', // powerup: bomba (red-orange)
  '#fff176', // powerup: rayo (bright yellow)
  '#ff6ec7', // powerup: tinte (pink/magenta)
  '#26a69a', // powerup: gravedad (teal)
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - nut (hollow center)
  [[9,9],[9,9]],                               // powerup: bomba
  [[10,10],[10,10]],                           // powerup: rayo
  [[11,11],[11,11]],                           // powerup: tinte
  [[12,12],[12,12]],                           // powerup: gravedad
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Cada cuántas líneas limpiadas aparece una pieza especial (el tipo es aleatorio entre las 4).
const POWERUP_LINE_INTERVAL = 5;
const POWERUP_FREEZE_MS = 5000;
// Disparador alternativo: si el tablero tiene este número de filas "atascadas"
// (con al menos 1 bloque y al menos 2 huecos) también aparece un powerup.
const POWERUP_CLUTTER_ROWS = 11;
const POWERUP_CLUTTER_MIN_GAPS = 2;

const POWERUPS = [
  {
    id: 'bomb',
    type: 9,
    name: 'Bomba',
    color: '#ff5252',
    icon: '💣',
    desc: 'Al aterrizar, destruye un área de 3x3 bloques a su alrededor.',
  },
  {
    id: 'lightning',
    type: 10,
    name: 'Rayo',
    color: '#fff176',
    icon: '⚡',
    desc: 'Al aterrizar, limpia por completo la fila o la columna donde cae (al azar).',
  },
  {
    id: 'tint',
    type: 11,
    name: 'Tinte',
    color: '#ff6ec7',
    icon: '🎨',
    desc: 'Convierte todos los bloques de un color al azar en comodines: cualquier fila que tenga un comodín se limpia, aunque tenga huecos.',
  },
  {
    id: 'gravity',
    type: 12,
    name: 'Gravedad',
    color: '#26a69a',
    icon: '🧊',
    desc: 'Compacta los huecos del tablero (los bloques caen) y congela la caída automática durante 5 segundos.',
  },
];

const GRID_LINE_COLORS = {
  dark: '#22222e',
  light: '#d0d0dc',
};

// Cada skin define cómo se dibuja el relleno base de un bloque (fillBlock).
// El contorno dorado de comodín y el icono de powerup se dibujan por fuera,
// igual para todas las skins (ver drawBlock).
const SKINS = {
  retro: {
    label: 'Retro',
    fillBlock(context, x, y, size, color) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neon',
    fillBlock(context, x, y, size, color) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      context.save();
      context.shadowBlur = size * 0.6;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.restore();
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255,255,255,0.2)';
      context.fillRect(px, py, s, 4);
    },
  },
  pastel: {
    label: 'Pastel',
    fillBlock(context, x, y, size, color) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      const radius = Math.min(6, s / 3);
      const paintRect = () => {
        if (typeof context.roundRect === 'function') {
          context.beginPath();
          context.roundRect(px, py, s, s, radius);
          context.fill();
        } else {
          context.fillRect(px, py, s, s);
        }
      };
      context.fillStyle = color;
      paintRect();
      // aclara el color superponiendo blanco translúcido
      context.fillStyle = 'rgba(255,255,255,0.4)';
      paintRect();
    },
  },
  pixel: {
    label: 'Pixel Art',
    fillBlock(context, x, y, size, color) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // patrón de textura tipo pixel-art/dithering
      const tile = Math.max(2, Math.floor(s / 5));
      for (let ty = 0, row = 0; ty < s; ty += tile, row++) {
        for (let tx = 0, col = 0; tx < s; tx += tile, col++) {
          const w = Math.min(tile, s - tx);
          const h = Math.min(tile, s - ty);
          context.fillStyle = (row + col) % 2 === 0
            ? 'rgba(0,0,0,0.15)'
            : 'rgba(255,255,255,0.15)';
          context.fillRect(px + tx, py + ty, w, h);
        }
      }
    },
  },
};

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
const skinSelect = document.getElementById('skin-select');
const powerupBanner = document.getElementById('powerup-banner');
const powerupLegendEl = document.getElementById('powerup-legend');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const startLevelSelect = document.getElementById('start-level-select');


let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, theme;
let powerupCounter, pendingPowerup, freezeUntil, powerupBannerTimeout;
let bestCombo;
// Se inicializa de forma síncrona (no solo vía initSkin()) para que la primera
// pieza dibujada por init() ya use la skin persistida, sin depender del orden
// de las llamadas de arranque al final del archivo.
let skin = (function readStoredSkin() {
  const stored = localStorage.getItem('tetris-skin');
  return isValidSkin(stored) ? stored : 'retro';
})();

function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('tetris-theme', t);
  themeToggle.checked = t === 'light';
}

function initTheme() {
  const stored = document.documentElement.getAttribute('data-theme');
  applyTheme(stored === 'light' ? 'light' : 'dark');
}

function isValidSkin(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SKINS, name);
}

function applySkin(name) {
  skin = isValidSkin(name) ? name : 'retro';
  localStorage.setItem('tetris-skin', skin);
  if (skinSelect) skinSelect.value = skin;
}

function initSkin() {
  const stored = localStorage.getItem('tetris-skin');
  applySkin(isValidSkin(stored) ? stored : 'retro');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPowerupPiece() {
  const pu = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
  const shape = PIECES[pu.type].map(row => [...row]);
  return {
    type: pu.type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
    powerUp: pu.id,
  };
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

function removeRow(r) {
  board.splice(r, 1);
  board.unshift(new Array(COLS).fill(0));
}

function registerClearedLines(count, scoreGain) {
  lines += count;
  score += scoreGain;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  powerupCounter += count;
  if (powerupCounter >= POWERUP_LINE_INTERVAL) {
    powerupCounter -= POWERUP_LINE_INTERVAL;
    pendingPowerup = true;
  }
  bestCombo = Math.max(bestCombo, count);
  updateHUD();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    const full = board[r].every(v => v !== 0);
    const hasWildcard = board[r].some(v => v < 0);
    if (full || hasWildcard) {
      removeRow(r);
      cleared++;
      r++;
    }
  }
  if (cleared) {
    registerClearedLines(cleared, (LINE_SCORES[cleared] || 0) * level);
  }
}

function explodeArea(cx, cy) {
  for (let r = cy - 1; r <= cy + 1; r++)
    for (let c = cx - 1; c <= cx + 1; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
}

function strikeLine(piece) {
  const mode = Math.random() < 0.5 ? 'row' : 'col';
  if (mode === 'row') {
    const row = Math.min(ROWS - 1, piece.y + Math.floor(piece.shape.length / 2));
    removeRow(row);
    registerClearedLines(1, (LINE_SCORES[1] || 0) * level);
  } else {
    const col = Math.min(COLS - 1, piece.x + Math.floor(piece.shape[0].length / 2));
    for (let r = 0; r < ROWS; r++) board[r][col] = 0;
    score += 100 * level;
    updateHUD();
  }
}

function tintColor() {
  const present = new Set();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] > 0) present.add(board[r][c]);
  if (present.size === 0) return;
  const colors = [...present];
  const chosen = colors[Math.floor(Math.random() * colors.length)];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === chosen) board[r][c] = -chosen;
}

function compactBoard() {
  for (let c = 0; c < COLS; c++) {
    const colVals = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c] !== 0) colVals.push(board[r][c]);
    for (let r = ROWS - 1, i = colVals.length - 1; r >= 0; r--, i--) {
      board[r][c] = i >= 0 ? colVals[i] : 0;
    }
  }
}

function showPowerupBanner(id) {
  const pu = POWERUPS.find(p => p.id === id);
  if (!pu) return;
  powerupBanner.textContent = `${pu.icon} ¡${pu.name} activado!`;
  powerupBanner.style.background = pu.color;
  powerupBanner.classList.remove('hidden');
  powerupBanner.classList.add('show');
  clearTimeout(powerupBannerTimeout);
  powerupBannerTimeout = setTimeout(() => {
    powerupBanner.classList.remove('show');
    powerupBanner.classList.add('hidden');
  }, 1800);
}

function applyPowerUp(piece) {
  const cx = piece.x + Math.floor(piece.shape[0].length / 2);
  const cy = piece.y + Math.floor(piece.shape.length / 2);
  switch (piece.powerUp) {
    case 'bomb':
      explodeArea(cx, cy);
      break;
    case 'lightning':
      strikeLine(piece);
      break;
    case 'tint':
      tintColor();
      break;
    case 'gravity':
      compactBoard();
      freezeUntil = performance.now() + POWERUP_FREEZE_MS;
      break;
  }
  showPowerupBanner(piece.powerUp);
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

function countClutteredRows() {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    let filled = 0;
    for (let c = 0; c < COLS; c++) if (board[r][c] !== 0) filled++;
    const empty = COLS - filled;
    if (filled >= 1 && empty >= POWERUP_CLUTTER_MIN_GAPS) count++;
  }
  return count;
}

function maybeQueuePowerupFromClutter() {
  if (!pendingPowerup && countClutteredRows() >= POWERUP_CLUTTER_ROWS) {
    pendingPowerup = true;
  }
}

function lockPiece() {
  if (current.powerUp) {
    applyPowerUp(current);
    // El tinte deja los comodines visibles un instante; se limpian en el siguiente lock.
    if (current.powerUp !== 'tint') clearLines();
  } else {
    merge();
    clearLines();
  }
  maybeQueuePowerupFromClutter();
  spawn();
}

function spawn() {
  current = next;
  if (pendingPowerup) {
    next = randomPowerupPiece();
    pendingPowerup = false;
  } else {
    next = randomPiece();
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const isWildcard = colorIndex < 0;
  const color = COLORS[Math.abs(colorIndex)];
  context.globalAlpha = alpha ?? 1;
  const skinDef = SKINS[skin] || SKINS.retro;
  skinDef.fillBlock(context, x, y, size, color);
  if (isWildcard) {
    context.strokeStyle = '#ffd700';
    context.lineWidth = 2;
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  }
  const pu = colorIndex >= 9 ? POWERUPS.find(p => p.type === colorIndex) : null;
  if (pu) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(pu.icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_LINE_COLORS[theme] || GRID_LINE_COLORS.dark;
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

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLeaderboard(entries) {
  entries.sort((a, b) => b.score - a.score);
  const truncated = entries.slice(0, LEADERBOARD_MAX);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(truncated));
  } catch (e) {
    // Storage unavailable/full (private browsing, quota, blocked, etc.) — keep going
    // so the caller's UI update still runs instead of leaving the overlay stuck.
  }
  return truncated;
}

function isNewRecord(candidateScore) {
  const entries = loadLeaderboard();
  if (entries.length < LEADERBOARD_MAX) return true;
  return candidateScore > entries[entries.length - 1].score;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard() {
  const entries = loadLeaderboard();
  if (entries.length === 0) {
    leaderboardListEl.innerHTML = '<li class="leaderboard-empty">Sin puntuaciones todavía</li>';
    return;
  }
  leaderboardListEl.innerHTML = entries.map((e, i) => `
    <li>
      <span class="leaderboard-rank">${i + 1}</span>
      <span class="leaderboard-name">${escapeHtml(e.name)}</span>
      <span class="leaderboard-score">${e.score.toLocaleString()}</span>
      <span class="leaderboard-meta">${e.lines} líneas · combo x${e.combo}</span>
    </li>
  `).join('');
}

function saveScoreToLeaderboard() {
  const rawName = playerNameInput.value.trim();
  const name = rawName || '???';
  const entries = loadLeaderboard();
  entries.push({ name, score, lines, combo: bestCombo });
  saveLeaderboard(entries);
  renderLeaderboard();
  overlayRecordEl.classList.add('hidden');
  overlaySaveEl.classList.add('hidden');
  overlaySavedMsg.classList.remove('hidden');
}

function resetLeaderboard() {
  if (!confirm('¿Seguro que quieres borrar todos los récords?')) return;
  try {
    localStorage.removeItem(LEADERBOARD_KEY);
  } catch (e) {
    // Storage unavailable — nothing to clear, still refresh the (already empty) view below.
  }
  renderLeaderboard();
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  overlaySavedMsg.classList.add('hidden');
  playerNameInput.value = '';
  if (isNewRecord(score)) {
    overlayRecordEl.classList.remove('hidden');
    overlaySaveEl.classList.remove('hidden');
  } else {
    overlayRecordEl.classList.add('hidden');
    overlaySaveEl.classList.add('hidden');
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeUntil && ts < freezeUntil) {
    dropAccum = 0;
  } else {
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
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function getStoredStartLevel() {
  const stored = parseInt(localStorage.getItem('tetris-start-level'), 10);
  return stored >= 1 && stored <= 10 ? stored : 1;
}

function init(startLevel) {
  board = createBoard();
  score = 0;
  lines = 0;
  level = Number.isInteger(startLevel) && startLevel >= 1 && startLevel <= 10 ? startLevel : getStoredStartLevel();
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  powerupCounter = 0;
  pendingPowerup = false;
  freezeUntil = 0;
  clearTimeout(powerupBannerTimeout);
  powerupBanner.classList.remove('show');
  powerupBanner.classList.add('hidden');
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
  bestCombo = 0;
  overlayRecordEl.classList.add('hidden');
  overlaySaveEl.classList.add('hidden');
  overlaySavedMsg.classList.add('hidden');
}

function renderPowerupLegend() {
  powerupLegendEl.innerHTML = POWERUPS.map(pu => `
    <li>
      <span class="powerup-swatch" style="background:${pu.color}">${pu.icon}</span>
      <span class="powerup-info">
        <strong>${pu.name}</strong>
        <small>${pu.desc}</small>
      </span>
    </li>
  `).join('');
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
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
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));
saveScoreBtn.addEventListener('click', saveScoreToLeaderboard);
resetLeaderboardBtn.addEventListener('click', resetLeaderboard);
if (skinSelect) skinSelect.addEventListener('change', () => applySkin(skinSelect.value));
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  const lvl = parseInt(startLevelSelect.value, 10) || 1;
  init(lvl);
});
toggleControlsBtn.addEventListener('click', () => {
  const nowHidden = pauseControlsList.classList.toggle('hidden');
  toggleControlsBtn.setAttribute('aria-expanded', String(!nowHidden));
});
startLevelSelect.addEventListener('change', () => {
  localStorage.setItem('tetris-start-level', startLevelSelect.value);
});

function initStartLevelSelect() {
  startLevelSelect.value = String(getStoredStartLevel());
}

initTheme();
renderPowerupLegend();
init();
renderLeaderboard();
initSkin();
initStartLevelSelect();
