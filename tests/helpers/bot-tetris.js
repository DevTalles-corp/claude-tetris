// Estrategia de colocación para tests/issue-26.spec.js.
// Solo lee el estado del tablero y devuelve la siguiente tecla; no modifica el juego.
// Puntúa cada colocación con la fórmula clásica de Thiery y Scherrer:
// altura agregada, líneas completadas, huecos y rugosidad.

const PESOS = { altura: -0.510066, lineas: 0.760666, huecos: -0.35663, rugosidad: -0.184483 };

// Misma rotación que rotateCW() de game.js (horario).
function rotarCW(forma) {
  const filas = forma.length, cols = forma[0].length;
  const res = Array.from({ length: cols }, () => new Array(filas).fill(0));
  for (let r = 0; r < filas; r++)
    for (let c = 0; c < cols; c++)
      res[c][filas - 1 - r] = forma[r][c];
  return res;
}

function colisiona(tablero, forma, ox, oy) {
  for (let r = 0; r < forma.length; r++)
    for (let c = 0; c < forma[r].length; c++) {
      if (!forma[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= tablero[0].length || ny >= tablero.length) return true;
      if (ny >= 0 && tablero[ny][nx]) return true;
    }
  return false;
}

// Puntúa el tablero que queda al fijar la pieza en (x, y).
function evaluar(tablero, forma, x, y) {
  const filas = tablero.length, cols = tablero[0].length;
  const t = tablero.map(f => [...f]);
  for (let r = 0; r < forma.length; r++)
    for (let c = 0; c < forma[r].length; c++)
      if (forma[r][c]) t[y + r][x + c] = forma[r][c];

  let lineas = 0;
  let sinLlenas = t.filter(f => {
    const llena = f.every(v => v !== 0);
    if (llena) lineas++;
    return !llena;
  });
  while (sinLlenas.length < filas) sinLlenas.unshift(new Array(cols).fill(0));

  // Altura de cada columna y huecos (celdas vacías bajo un bloque).
  const alturas = [];
  let huecos = 0;
  for (let c = 0; c < cols; c++) {
    let alto = 0, cubierta = false;
    for (let r = 0; r < filas; r++) {
      if (sinLlenas[r][c]) {
        if (!cubierta) { alto = filas - r; cubierta = true; }
      } else if (cubierta) {
        huecos++;
      }
    }
    alturas.push(alto);
  }
  const agregada = alturas.reduce((a, b) => a + b, 0);
  let rugosidad = 0;
  for (let c = 0; c < cols - 1; c++) rugosidad += Math.abs(alturas[c] - alturas[c + 1]);

  return PESOS.altura * agregada + PESOS.lineas * lineas + PESOS.huecos * huecos + PESOS.rugosidad * rugosidad;
}

// Todas las colocaciones posibles, con las 4 orientaciones partiendo de la actual.
// k = giros CW necesarios desde la orientación actual; x = columna de la pieza.
function colocaciones(tablero, forma) {
  const res = [];
  let actual = forma;
  for (let k = 0; k < 4; k++) {
    for (let x = -2; x <= tablero[0].length; x++) {
      if (colisiona(tablero, actual, x, 0)) continue;
      let y = 0;
      while (!colisiona(tablero, actual, x, y + 1)) y++;
      const celdas = [];
      for (let r = 0; r < actual.length; r++)
        for (let c = 0; c < actual[r].length; c++)
          if (actual[r][c]) celdas.push(`${x + c},${y + r}`);
      res.push({ k, x, score: evaluar(tablero, actual, x, y), sig: celdas.sort().join(';') });
    }
    actual = rotarCW(actual);
  }
  return res;
}

// Mejor colocación. El desempate usa las celdas finales, así que el resultado
// no depende de la orientación desde la que se mire: no hay oscilaciones al girar.
function mejorJugada(tablero, forma) {
  let mejor = null;
  for (const c of colocaciones(tablero, forma)) {
    if (!mejor || c.score > mejor.score || (c.score === mejor.score && c.sig < mejor.sig)) mejor = c;
  }
  return mejor;
}

// Tecla a pulsar en este instante. `atascado` cuenta cuántas veces seguidas
// el estado no cambió tras una tecla; con 2 se fija la pieza con Espacio para no quedar trabados.
function siguienteTecla({ tablero, forma, x, atascado }) {
  if (atascado >= 2) return 'Space';
  const mejor = mejorJugada(tablero, forma);
  if (!mejor) return 'Space';
  if (mejor.k > 0) return 'ArrowUp';
  if (mejor.x < x) return 'ArrowLeft';
  if (mejor.x > x) return 'ArrowRight';
  return 'Space';
}

// Juega con el teclado hasta que `hasta(estado)` sea verdadero o haya GAME OVER.
// page.evaluate solo lee el estado; las jugadas se hacen con teclas, como una persona.
// Devuelve el último estado leído.
async function jugar(page, hasta) {
  let atascado = 0;
  let anterior = '';
  for (;;) {
    const estado = await page.evaluate(() => ({
      tablero: board.map(f => [...f]),
      forma: current.shape.map(f => [...f]),
      x: current.x,
      y: current.y,
      piezas: pieces,
      lineas: lines,
      nivel: level,
      gameOver,
    }));
    if (estado.gameOver || hasta(estado)) return estado;

    // Si la tecla anterior no cambió la pieza, cuenta como atasco (ver siguienteTecla).
    const clave = `${estado.piezas}|${estado.forma.join()}|${estado.x}|${estado.y}`;
    atascado = clave === anterior ? atascado + 1 : 0;
    anterior = clave;

    await page.keyboard.press(siguienteTecla({ tablero: estado.tablero, forma: estado.forma, x: estado.x, atascado }));
  }
}

module.exports = { siguienteTecla, mejorJugada, rotarCW, jugar };
