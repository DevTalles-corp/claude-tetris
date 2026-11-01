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
  '#f06292', // + - pink
  '#4db6ac', // U - teal
  '#dce775', // Y - lime
  '#a1887f', // single - brown
  '#90a4ae', // hueca 3x3 - blue grey
  '#ef5350', // power-up bomba
  '#fdd835', // power-up rayo
  '#ab47bc', // power-up tinte
  '#5c6bc0', // power-up gravedad
  '#81d4fa', // power-up congelar
  '#ffffff', // comodín (se dibuja en arcoíris, ver drawBlock)
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
  [[0,8,0],[8,8,8],[0,8,0]],                  // +
  [[9,0,9],[9,9,9],[0,0,0]],                  // U
  [[0,0,0,0],[10,10,10,10],[0,10,0,0],[0,0,0,0]], // Y
  [[11]],                                      // single (recompensa tras un Tetris)
  [[12,12,12],[12,0,12],[12,12,12]],          // 3x3 hueca (reto al subir de nivel)
  [[13]],                                      // power-up bomba
  [[14]],                                      // power-up rayo
  [[15]],                                      // power-up tinte
  [[16]],                                      // power-up gravedad
  [[17]],                                      // power-up congelar
  null,                                        // comodín: solo valor de celda, nunca pieza
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const STANDARD_TYPES = 7;          // índices 1–7
const PENTOMINO_TYPES = [8, 9, 10];
const PENTOMINO_CHANCE = 0.1;
const SINGLE = 11, HOLLOW = 12;

const BOMB = 13, BOLT = 14, DYE = 15, GRAVITY = 16, FREEZE = 17, WILD = 18;
const POWERUP_TYPES = [BOMB, BOLT, DYE, GRAVITY, FREEZE];
const POWERUP_ICONS = { [BOMB]: '💣', [BOLT]: '⚡', [DYE]: '🎨', [GRAVITY]: '⬇', [FREEZE]: '❄' };
const POWERUP_EVERY_LINES = 5;
const FREEZE_MS = 5000;
const POWERUP_BLOCK_SCORE = 10;    // puntos por bloque destruido por un power-up

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

let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, pieceQueue, freezeLeft;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const type = Math.random() < PENTOMINO_CHANCE
    ? PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)]
    : Math.floor(Math.random() * STANDARD_TYPES) + 1;
  return makePiece(type);
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

// Quita de cada columna las celdas que cumplan shouldRemove y deja caer lo de encima.
function compactColumns(shouldRemove) {
  let removed = 0;
  for (let c = 0; c < COLS; c++) {
    const kept = [];
    for (let r = 0; r < ROWS; r++) {
      if (shouldRemove(board[r][c])) removed++;
      else kept.push(board[r][c]);
    }
    const pad = ROWS - kept.length;
    for (let r = 0; r < ROWS; r++) board[r][c] = r < pad ? 0 : kept[r - pad];
  }
  return removed;
}

function clearCell(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return 0;
  board[r][c] = 0;
  return 1;
}

function mostCommonColor() {
  const counts = {};
  let best = 0;
  for (const row of board)
    for (const v of row)
      if (v && v !== WILD) {
        counts[v] = (counts[v] || 0) + 1;
        if (!best || counts[v] > counts[best]) best = v;
      }
  return best;
}

// Aplica el efecto del power-up en la celda donde se fijó. Las filas que borra
// un efecto no cuentan como líneas (no suben nivel ni generan más power-ups).
function applyPowerUp(type, cx, cy) {
  let destroyed = 0;
  switch (type) {
    case BOMB:
      for (let r = cy - 1; r <= cy + 1; r++)
        for (let c = cx - 1; c <= cx + 1; c++)
          destroyed += clearCell(r, c);
      break;
    case BOLT:
      for (let r = 0; r < ROWS; r++) if (r !== cy) destroyed += clearCell(r, cx);
      destroyed += board[cy].filter(v => v).length;
      board.splice(cy, 1);
      board.unshift(new Array(COLS).fill(0));
      break;
    case DYE: {
      const below = cy + 1 < ROWS ? board[cy + 1][cx] : 0;
      const target = below && below !== WILD ? below : mostCommonColor();
      if (target)
        for (const row of board)
          for (let c = 0; c < COLS; c++)
            if (row[c] === target) row[c] = WILD;
      break;
    }
    case GRAVITY:
      compactColumns(v => v === 0);
      break;
    case FREEZE:
      freezeLeft = FREEZE_MS;
      break;
  }
  score += destroyed * POWERUP_BLOCK_SCORE;
  updateHUD();
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
    const prevLevel = level;
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    // Piezas forzadas: se juegan después de la que ya se ve en el preview.
    if (cleared === 4) pieceQueue.push(makePiece(SINGLE));
    if (level > prevLevel) pieceQueue.push(makePiece(HOLLOW));
    if (Math.floor(lines / POWERUP_EVERY_LINES) > Math.floor(prevLines / POWERUP_EVERY_LINES))
      pieceQueue.push(makePiece(POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]));
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    // Los comodines desaparecen al limpiar cualquier línea; al compactar
    // pueden completarse filas nuevas, así que se vuelve a comprobar.
    const wilds = compactColumns(v => v === WILD);
    score += wilds * POWERUP_BLOCK_SCORE;
    updateHUD();
    if (wilds) clearLines();
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
  // Un power-up no se queda en el tablero: solo aplica su efecto.
  if (POWERUP_TYPES.includes(current.type)) applyPowerUp(current.type, current.x, current.y);
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = pieceQueue.shift() ?? randomPiece();
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
  const color = colorIndex === WILD
    ? `hsl(${(performance.now() / 8 + (x + y) * 30) % 360}, 75%, 60%)`
    : COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  const icon = POWERUP_ICONS[colorIndex];
  if (icon) {
    context.fillStyle = '#ffffff';
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
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

  // congelar: velo azul y cuenta atrás
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(129, 212, 250, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4fc3f7';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`❄ ${Math.ceil(freezeLeft / 1000)} s`, canvas.width / 2, 8);
  }
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
  const dt = ts - lastTime;
  lastTime = ts;
  // Congelar detiene la gravedad; la pausa no lo consume (togglePause reinicia lastTime).
  if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);
  else dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() no puede cancelar el frame en curso: no reprogramar tras game over.
  if (!gameOver) animId = requestAnimationFrame(loop);
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
  pieceQueue = [];
  freezeLeft = 0;
  lastTime = performance.now();
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

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeToggle.textContent = theme === 'light' ? '☾ Modo oscuro' : '☀ Modo claro';
  // El bucle está detenido en pausa/game over: redibujar manualmente.
  if (current) draw();
  if (next) drawNext();
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', theme); } catch (e) { /* almacenamiento no disponible */ }
  applyTheme(theme);
  themeToggle.blur(); // evita que Space active el botón
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) { /* ignorar */ }
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
