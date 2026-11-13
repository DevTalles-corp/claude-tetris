const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');

// Requerimiento: contador de piezas colocadas "PIEZAS" en el panel lateral (issue #18).
// La evidencia se guarda con capturar(), en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=18 npm test

// Etiqueta del panel cuyo texto es `texto` (SCORE, LINES, LEVEL, PIEZAS).
const etiqueta = (page, texto) => page.locator('.panel-section', { has: page.locator('.label', { hasText: texto }) }).locator('.label');
const valor = (page, id) => page.locator(`#${id}`);

test('la etiqueta PIEZAS se muestra en el panel con el mismo estilo que SCORE, LINES y LEVEL', async ({ page }) => {
  await page.goto('/');
  await expect(etiqueta(page, 'PIEZAS')).toHaveText('PIEZAS');
  await expect(valor(page, 'pieces')).toBeVisible();

  // Mismo estilo: las cuatro etiquetas comparten clases y propiedades calculadas.
  const estilos = await page.evaluate(() => {
    const leer = (texto) => {
      const el = [...document.querySelectorAll('.panel .label')].find((l) => l.textContent === texto);
      const cs = getComputedStyle(el);
      return { clase: el.className, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, color: cs.color, fontWeight: cs.fontWeight };
    };
    return ['SCORE', 'LINES', 'LEVEL', 'PIEZAS'].map(leer);
  });
  for (const estilo of estilos) {
    expect(estilo).toEqual(estilos[0]);
  }
  await capturar(page, 'panel-etiqueta-piezas');
});

test('el contador empieza en 0 al cargar la página', async ({ page }) => {
  await page.goto('/');
  await expect(valor(page, 'pieces')).toHaveText('0');
  await capturar(page, 'contador-inicia-en-cero');
});

test('el contador suma 1 cada vez que una pieza se fija en el tablero', async ({ page }) => {
  await page.goto('/');
  await expect(valor(page, 'pieces')).toHaveText('0');

  // Espacio hace caer la pieza y la fija en el tablero.
  await page.keyboard.press('Space');
  await expect(valor(page, 'pieces')).toHaveText('1');

  await page.keyboard.press('Space');
  await expect(valor(page, 'pieces')).toHaveText('2');
  await capturar(page, 'contador-suma-al-fijar');
});

test('el contador vuelve a 0 al reiniciar la partida', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(valor(page, 'pieces')).toHaveText('3');

  // Pausa para que el overlay con el botón Reiniciar quede visible.
  await page.keyboard.press('KeyP');
  await page.locator('#restart-btn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(valor(page, 'pieces')).toHaveText('0');
  await capturar(page, 'contador-reinicia-en-cero');
});
