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

// Coloca una J arriba, la dibuja y devuelve el color (#rrggbb) del centro de su celda superior izquierda.
// Todo en un mismo evaluate: el bucle del juego sigue corriendo y, entre dos llamadas,
// la gravedad podría bajar la pieza y dejar vacía la celda medida.
// Si se pasa `color`, antes se reemplaza el color de la J (para el "antes").
async function dibujarJ(page, color) {
  return page.evaluate(([nuevo, size]) => {
    if (nuevo) COLORS[6] = nuevo;
    current = { shape: PIECES[6], x: 3, y: 0 };
    draw();
    const [r, g, b] = ctx.getImageData(3 * size + size / 2, size / 2, 1, 1).data;
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }, [color || null, TAMANO_BLOQUE]);
}

test('la pieza J se dibuja en azul pálido y las demás piezas no cambian', async ({ page }) => {
  await page.goto('/');

  expect(await page.evaluate(() => COLORS[6])).toBe(DESPUES);
  // Solo la J cambia: el resto de la paleta queda igual.
  expect(await page.evaluate(() => COLORS.slice(1))).toEqual([
    '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', DESPUES, '#ffb74d',
  ]);

  expect(await dibujarJ(page)).toBe(DESPUES);
  await capturar(page, 'j-azul-palido');
});

test('antes y después: la J índigo original frente a la nueva J azul pálido', async ({ page }) => {
  await page.goto('/');

  // "Antes": el mismo código de dibujo con el color anterior de la J.
  expect(await dibujarJ(page, ANTES)).toBe(ANTES);
  await capturar(page, 'antes-j-indigo');

  // "Después": el color actual del juego.
  expect(await dibujarJ(page, DESPUES)).toBe(DESPUES);
  await capturar(page, 'despues-j-azul-palido');
});
