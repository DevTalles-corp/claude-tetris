const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');

// Requerimiento: la pieza J pasa de índigo a azul pálido (issue #34).
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=34 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

const ANTES = '#7986cb';
const DESPUES = '#90caf9';
const TAMANO_BLOQUE = 30;

// Coloca una J en la esquina superior izquierda y la dibuja de inmediato, sin esperar al bucle.
async function ponerJ(page) {
  await page.evaluate(() => {
    current = { shape: PIECES[6], x: 3, y: 0 };
    draw();
  });
}

// Color (#rrggbb) de un píxel en el centro de la celda (columna, fila) del tablero.
async function colorDeCelda(page, columna, fila) {
  return page.evaluate(([c, f, size]) => {
    const [r, g, b] = ctx.getImageData(c * size + size / 2, f * size + size / 2, 1, 1).data;
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }, [columna, fila, TAMANO_BLOQUE]);
}

test('la pieza J se dibuja en azul pálido y las demás piezas no cambian', async ({ page }) => {
  await page.goto('/');

  expect(await page.evaluate(() => COLORS[6])).toBe(DESPUES);
  // Solo la J cambia: el resto de la paleta queda igual.
  expect(await page.evaluate(() => COLORS.slice(1))).toEqual([
    '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', DESPUES, '#ffb74d',
  ]);

  await ponerJ(page);
  expect(await colorDeCelda(page, 3, 0)).toBe(DESPUES);
  await capturar(page, 'j-azul-palido.png');
});

test('antes y después: la J índigo original frente a la nueva J azul pálido', async ({ page }) => {
  await page.goto('/');

  // "Antes": el mismo código de dibujo con el color anterior de la J.
  await page.evaluate((color) => { COLORS[6] = color; }, ANTES);
  await ponerJ(page);
  expect(await colorDeCelda(page, 3, 0)).toBe(ANTES);
  await capturar(page, 'antes-j-indigo.png');

  // "Después": el color actual del juego.
  await page.evaluate((color) => { COLORS[6] = color; }, DESPUES);
  await ponerJ(page);
  expect(await colorDeCelda(page, 3, 0)).toBe(DESPUES);
  await capturar(page, 'despues-j-azul-palido.png');
});
