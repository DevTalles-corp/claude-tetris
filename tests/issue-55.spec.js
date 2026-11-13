const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');

// Requerimiento: temas visuales / skins (Retro, Neón, Pastel, Pixel art) con selector,
// preferencia guardada en localStorage y cambio sin recargar (issue #55).
// Cada prueba parte con localStorage vacío. La gravedad se detiene dentro de cada escena
// (dropInterval = Infinity) para que las capturas no cambien; el cambio de estado y la
// medición del canvas van siempre en un mismo page.evaluate.
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=55 npm test

const VENTANA = { width: 560, height: 860 };
test.use({ viewport: VENTANA });

const B = 30; // BLOCK
const RETRO = [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d',
  '#f06292', '#4db6ac', '#d4e157', '#90a4ae', '#a1887f'];
const SKINS = ['retro', 'neon', 'pastel', 'pixel'];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test.beforeEach(async ({ page }) => {
  // Ayudas de la prueba en la página. Solo usan funciones y variables del juego.
  await page.addInitScript(() => {
    window.qa = {
      pixel(context, x, y) {
        return [...context.getImageData(x, y, 1, 1).data];
      },
      // Bloques fijos de los 12 colores, una T en el aire y su fantasma.
      escena() {
        dropInterval = Infinity;
        board = createBoard();
        for (let c = 0; c < 9; c++) board[ROWS - 1][c] = c + 1;
        board[ROWS - 2][0] = 10;
        board[ROWS - 2][1] = 11;
        board[ROWS - 2][2] = 12;
        current = { type: 3, shape: PIECES[3].map((f) => [...f]), x: 4, y: 3, rot: 0 };
        draw();
      },
      // Tablero vacío y una I en la fila 1 (columnas 3-6); su fantasma queda en la fila 19.
      piezaSola() {
        dropInterval = Infinity;
        board = createBoard();
        current = { type: 1, shape: PIECES[1].map((f) => [...f]), x: 3, y: 0, rot: 0 };
        draw();
      },
      // Estado de la partida que una skin no debe tocar.
      estado() {
        return JSON.stringify({ board, score, lines, level, pieces, x: current.x, y: current.y, siguiente: next.type, paused, gameOver });
      },
      // Mayor diferencia de color (RGBA) entre el interior de dos celdas del tablero.
      diferenciaCeldas(c1, r1, c2, r2) {
        const size = BLOCK;
        const a = ctx.getImageData(c1 * size, r1 * size, size, size).data;
        const b = ctx.getImageData(c2 * size, r2 * size, size, size).data;
        let max = 0;
        for (let y = 2; y < size - 2; y++)
          for (let x = 2; x < size - 2; x++)
            for (let k = 0; k < 4; k++) {
              const i = (y * size + x) * 4 + k;
              max = Math.max(max, Math.abs(a[i] - b[i]));
            }
        return max;
      },
    };
  });
});

// Abre el juego con localStorage vacío (y, si se indica, con una skin guardada).
async function abrir(page, skinGuardada) {
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.clear();
    if (s) localStorage.setItem('skin', s);
  }, skinGuardada || null);
  await page.reload();
}

test('TC-59 el selector ofrece las cuatro skins y empieza en Retro', async ({ page }) => {
  await abrir(page);
  const select = page.locator('#skin-select');
  await expect(select).toBeVisible();
  expect(await select.locator('option').allTextContents()).toEqual(['Retro', 'Neón', 'Pastel', 'Pixel art']);
  expect(await select.locator('option').evaluateAll((os) => os.map((o) => o.value))).toEqual(SKINS);
  await expect(select).toHaveValue('retro');
  const r = await page.evaluate(() => {
    qa.escena();
    return { skin: document.documentElement.dataset.skin, colores: COLORS.slice(), skins: Object.keys(SKINS) };
  });
  expect(r.skin).toBe('retro');
  expect(r.colores).toEqual(RETRO);
  expect(r.skins).toEqual(SKINS);
  await capturar(page, 'selector-de-skins');
});

test('TC-60 Retro se dibuja igual que antes de las skins, también al volver desde otra', async ({ page }) => {
  await abrir(page);
  const r = await page.evaluate((ORIGINAL) => {
    applySkin('neon');
    applySkin('retro');
    qa.escena();
    const real = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // El dibujo de antes de las skins, copiado tal cual, sobre un canvas aparte.
    const ref = document.createElement('canvas');
    ref.width = canvas.width;
    ref.height = canvas.height;
    const c2 = ref.getContext('2d');
    const bloque = (x, y, i, size, alpha) => {
      if (!i) return;
      c2.globalAlpha = alpha ?? 1;
      c2.fillStyle = ORIGINAL[i];
      c2.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      c2.fillStyle = 'rgba(255,255,255,0.12)';
      c2.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      c2.globalAlpha = 1;
    };
    c2.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
    c2.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) { c2.beginPath(); c2.moveTo(c * BLOCK, 0); c2.lineTo(c * BLOCK, ROWS * BLOCK); c2.stroke(); }
    for (let f = 1; f < ROWS; f++) { c2.beginPath(); c2.moveTo(0, f * BLOCK); c2.lineTo(COLS * BLOCK, f * BLOCK); c2.stroke(); }
    for (let f = 0; f < ROWS; f++) for (let c = 0; c < COLS; c++) bloque(c, f, board[f][c], BLOCK);
    const gy = ghostY();
    current.shape.forEach((fila, f) => fila.forEach((v, c) => { if (v) bloque(current.x + c, gy + f, v, BLOCK, 0.2); }));
    current.shape.forEach((fila, f) => fila.forEach((v, c) => bloque(current.x + c, current.y + f, v, BLOCK)));
    const esperado = c2.getImageData(0, 0, ref.width, ref.height).data;

    let distintos = 0;
    for (let i = 0; i < real.length; i++) if (real[i] !== esperado[i]) distintos++;
    return { distintos, colores: COLORS.slice(), fondo: qa.pixel(ctx, 8 * BLOCK + 15, 5 * BLOCK + 15) };
  }, RETRO);
  expect(r.distintos).toBe(0);
  expect(r.colores).toEqual(RETRO);
  expect(r.fondo[3]).toBe(0); // canvas transparente: el fondo sigue saliendo del CSS (--board-bg)
  await capturar(page, 'skin-retro');
});

test('TC-61 Neón: fondo negro y brillo con shadowBlur que no se filtra', async ({ page }) => {
  await abrir(page);
  await page.selectOption('#skin-select', 'neon');
  const r = await page.evaluate(() => {
    qa.piezaSola(); // I cian en la fila 1, columnas 3-6
    return {
      colores: COLORS.slice(),
      fondo: qa.pixel(ctx, 8 * BLOCK + 15, 10 * BLOCK + 15),
      borde: qa.pixel(ctx, 4 * BLOCK + 4, BLOCK + 15),
      nucleo: qa.pixel(ctx, 4 * BLOCK + 15, BLOCK + 15),
      brillo: qa.pixel(ctx, 3 * BLOCK - 2, BLOCK + 15), // 2 px fuera de la pieza, en una celda vacía
      sombra: [ctx.shadowBlur, nextCtx.shadowBlur],
    };
  });
  const cian = rgb(r.colores[1]);
  expect(r.colores[1]).toBe('#00f0ff');
  expect(r.colores).not.toEqual(RETRO);
  expect(r.fondo).toEqual([0, 0, 0, 255]);
  expect(r.borde.slice(0, 3)).toEqual(cian);
  // Núcleo tenue: el mismo color a un 35 % sobre negro
  expect(r.nucleo[1]).toBeGreaterThan(60);
  expect(r.nucleo[1]).toBeLessThan(120);
  // Brillo: la celda vacía junto a la pieza toma el color cian
  expect(r.brillo[1] + r.brillo[2]).toBeGreaterThan(40);
  expect(r.brillo[0]).toBeLessThan(r.brillo[2]);
  expect(r.sombra).toEqual([0, 0]);
  await page.evaluate(() => qa.escena());
  await capturar(page, 'skin-neon');
});

test('TC-62 Pastel: colores suaves y esquinas redondeadas', async ({ page }) => {
  await abrir(page);
  await page.selectOption('#skin-select', 'pastel');
  const r = await page.evaluate(() => {
    qa.piezaSola(); // celda (3, 1): esquina superior izquierda en (90, 30)
    const x = 3 * BLOCK, y = BLOCK;
    return {
      colores: COLORS.slice(),
      fondoSkin: SKINS.pastel.background,
      esquina: qa.pixel(ctx, x + 1, y + 1),
      ladoIzquierdo: qa.pixel(ctx, x + 1, y + 15),
      centro: qa.pixel(ctx, x + 15, y + 15),
    };
  });
  expect(r.colores[1]).toBe('#a8e6ef');
  expect(r.colores).not.toEqual(RETRO);
  expect(r.centro.slice(0, 3)).toEqual(rgb(r.colores[1]));
  expect(r.ladoIzquierdo.slice(0, 3)).toEqual(rgb(r.colores[1]));
  // La esquina queda fuera del bloque: se ve el fondo de la skin
  expect(r.esquina.slice(0, 3)).toEqual(rgb(r.fondoSkin));
  await page.evaluate(() => qa.escena());
  await capturar(page, 'skin-pastel');
});

test('TC-63 Pixel art: textura dibujada sobre cada bloque', async ({ page }) => {
  await abrir(page);
  await page.selectOption('#skin-select', 'pixel');
  const r = await page.evaluate(() => {
    qa.piezaSola(); // celda (4, 1); la textura empieza en (121, 31) con "píxeles" de 4 px
    const x = 4 * BLOCK + 1, y = BLOCK + 1;
    const p = (i, j) => qa.pixel(ctx, x + i * 4 + 2, y + j * 4 + 2);
    return { colores: COLORS.slice(), plano: p(2, 3), tramado: p(3, 3), luz: p(2, 0), sombra: p(2, 6) };
  });
  const suma = (px) => px[0] + px[1] + px[2];
  expect(r.colores[1]).toBe('#3cbcfc');
  expect(r.colores).not.toEqual(RETRO);
  expect(r.plano.slice(0, 3)).toEqual(rgb(r.colores[1]));
  expect(suma(r.tramado)).toBeLessThan(suma(r.plano)); // tramado en damero
  expect(suma(r.luz)).toBeGreaterThan(suma(r.plano)); // bisel claro arriba
  expect(suma(r.sombra)).toBeLessThan(suma(r.tramado)); // bisel oscuro abajo
  await page.evaluate(() => qa.escena());
  await capturar(page, 'skin-pixel-art');
});

test('TC-64 la pieza fantasma se ve en todas las skins', async ({ page }) => {
  await abrir(page);
  for (const skin of SKINS) {
    const r = await page.evaluate((s) => {
      applySkin(s);
      qa.piezaSola();
      // Fantasma de la I en la fila 19 (columnas 3-6); celda vacía de referencia: (8, 19)
      return { gy: ghostY(), diferencia: qa.diferenciaCeldas(4, 19, 8, 19), vacia: qa.diferenciaCeldas(8, 10, 8, 19) };
    }, skin);
    expect(r.gy, skin).toBe(18);
    expect(r.vacia, `${skin}: dos celdas vacías son iguales`).toBe(0);
    expect(r.diferencia, `${skin}: el fantasma se distingue del fondo`).toBeGreaterThan(30);
    await capturar(page, `fantasma-${skin}`);
  }
});

test('TC-65 la vista NEXT usa la misma skin', async ({ page }) => {
  await abrir(page);
  const medir = (s) => page.evaluate((skin) => {
    dropInterval = Infinity;
    next = { type: 2, shape: PIECES[2].map((f) => [...f]), x: 4, y: 0 }; // O en las celdas (1-2, 1-2)
    applySkin(skin); // redibuja también NEXT
    return {
      color: COLORS[2],
      fondo: qa.pixel(nextCtx, 5, 5),
      esquina: qa.pixel(nextCtx, 31, 31),
      centro: qa.pixel(nextCtx, 45, 45),
      borde: qa.pixel(nextCtx, 34, 45),
      sombra: nextCtx.shadowBlur,
    };
  }, s);

  const retro = await medir('retro');
  expect(retro.fondo[3]).toBe(0);
  expect(retro.centro.slice(0, 3)).toEqual(rgb('#ffd54f'));

  const neon = await medir('neon');
  expect(neon.fondo).toEqual([0, 0, 0, 255]);
  expect(neon.borde.slice(0, 3)).toEqual(rgb(neon.color));
  expect(neon.sombra).toBe(0);
  await capturar(page, 'next-neon');

  const pastel = await medir('pastel');
  expect(pastel.centro.slice(0, 3)).toEqual(rgb(pastel.color));
  expect(pastel.esquina.slice(0, 3)).toEqual(rgb('#2d2a3e'));

  const pixel = await medir('pixel');
  expect(pixel.fondo.slice(0, 3)).toEqual(rgb('#101020'));
  expect(pixel.centro.slice(0, 3)).not.toEqual(pixel.borde.slice(0, 3));
  await capturar(page, 'next-pixel-art');
});

test('TC-66 cambiar de skin no recarga la página ni cambia la partida', async ({ page }) => {
  await abrir(page);
  const antes = await page.evaluate(() => {
    qa.escena();
    window.sinRecargar = true;
    return qa.estado();
  });

  await page.selectOption('#skin-select', 'pastel');
  const r = await page.evaluate(() => ({
    marca: window.sinRecargar === true,
    estado: qa.estado(),
    foco: document.activeElement.id,
    skin: document.documentElement.dataset.skin,
    colores: COLORS.slice(),
    fondo: qa.pixel(ctx, 8 * BLOCK + 15, 5 * BLOCK + 15),
  }));
  expect(r.marca).toBe(true);
  expect(r.estado).toBe(antes);
  expect(r.foco).not.toBe('skin-select'); // el selector suelta el foco
  expect(r.skin).toBe('pastel');
  expect(r.colores[1]).toBe('#a8e6ef');
  expect(r.fondo.slice(0, 3)).toEqual(rgb('#2d2a3e'));

  // applySkin redibuja en el acto, sin esperar al siguiente frame del bucle
  const inmediato = await page.evaluate(() => {
    applySkin('neon');
    return qa.pixel(ctx, 8 * BLOCK + 15, 5 * BLOCK + 15);
  });
  expect(inmediato).toEqual([0, 0, 0, 255]);

  // Sin foco en el selector, las flechas vuelven a mover la pieza y no cambian la skin
  const x0 = await page.evaluate(() => current.x);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => current.x)).toBe(x0 - 1);
  await expect(page.locator('#skin-select')).toHaveValue('neon');
  await capturar(page, 'cambio-sin-recargar');
});

test('TC-67 la skin elegida se guarda y se aplica al recargar', async ({ page }) => {
  await abrir(page);
  await page.selectOption('#skin-select', 'neon');
  expect(await page.evaluate(() => localStorage.getItem('skin'))).toBe('neon');

  await page.reload();
  await expect(page.locator('#skin-select')).toHaveValue('neon');
  const r = await page.evaluate(() => {
    qa.escena();
    return {
      skin: document.documentElement.dataset.skin,
      color: COLORS[1],
      fondo: qa.pixel(ctx, 8 * BLOCK + 15, 5 * BLOCK + 15),
      fondoNext: qa.pixel(nextCtx, 117, 117), // celda (3, 3) de NEXT: ninguna pieza la ocupa
    };
  });
  expect(r).toEqual({ skin: 'neon', color: '#00f0ff', fondo: [0, 0, 0, 255], fondoNext: [0, 0, 0, 255] });
  await capturar(page, 'neon-tras-recargar');
});

test('TC-68 una skin guardada desconocida vuelve a Retro y las flechas no mueven la pieza con el selector enfocado', async ({ page }) => {
  await abrir(page, 'holograma');
  await expect(page.locator('#skin-select')).toHaveValue('retro');
  expect(await page.evaluate(() => [COLORS.slice(), localStorage.getItem('skin')])).toEqual([RETRO, 'retro']);

  await page.evaluate(() => qa.piezaSola());
  await page.focus('#skin-select');
  // Retro es la primera opción: ← y ↑ no cambian el selector, y el juego no debe usarlas.
  // Espacio abre la lista en vez de hacer un hard drop.
  const antes = await page.evaluate(() => qa.estado() + JSON.stringify(current.shape));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => qa.estado() + JSON.stringify(current.shape))).toBe(antes);
  await expect(page.locator('#skin-select')).toBeFocused();
  await capturar(page, 'skin-desconocida-vuelve-a-retro');
});
