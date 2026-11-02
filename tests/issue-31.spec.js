const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');
const { jugar } = require('./helpers/bot-tetris');
const { fijarSemilla } = require('./helpers/semilla');

// Requerimiento: partida reproducible con semilla fija y récord de líneas del bot (issue #31).
// La evidencia se guarda en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=31 npm test

const VENTANA = { width: 560, height: 800 };
test.use({ viewport: VENTANA });

const SEMILLA = 26;
// Tope de la medición del récord: si el bot no pierde antes, se corta aquí.
const TOPE_MS = 90 * 1000;

// Formas de las primeras `n` piezas, fijando cada una con Espacio.
async function secuencia(page, n) {
  const formas = [];
  for (let i = 0; i < n; i++) {
    formas.push(await page.evaluate(() => JSON.stringify(current.shape)));
    await page.keyboard.press('Space');
  }
  return formas;
}

test('con la misma semilla las piezas salen en el mismo orden', async ({ browser }) => {
  const partidas = [];
  for (let i = 0; i < 2; i++) {
    const page = await browser.newPage({ viewport: VENTANA, colorScheme: 'dark' });
    await fijarSemilla(page, SEMILLA);
    await page.goto('/');
    partidas.push(await secuencia(page, 10));
    if (i === 1) await capturar(page, 'misma-secuencia-de-piezas');
    await page.close();
  }
  expect(partidas[1]).toEqual(partidas[0]);
});

test('récord: líneas que logra el bot antes de perder', async ({ page }) => {
  // Medición, no regresión: solo corre en la ejecución de este issue.
  test.skip(process.env.ISSUE !== '31', 'El récord solo se mide con ISSUE=31');
  test.setTimeout(TOPE_MS + 60 * 1000);

  await fijarSemilla(page, SEMILLA);
  await page.goto('/');
  const inicio = Date.now();
  const final = await jugar(page, () => Date.now() - inicio >= TOPE_MS);

  const segundos = Math.round((Date.now() - inicio) / 1000);
  const motivo = final.gameOver ? 'GAME OVER' : `tope de ${TOPE_MS / 1000} s`;
  const resumen = `${final.lineas} líneas, nivel ${final.nivel}, ${final.piezas} piezas en ${segundos} s (fin: ${motivo}, semilla ${SEMILLA})`;
  test.info().annotations.push({ type: 'récord', description: resumen });
  console.log(`RÉCORD: ${resumen}`);
  await capturar(page, 'record-final');
  // El overlay de GAME OVER tapa el panel. Se oculta con un estilo solo para la foto:
  // quitar la clase no basta, porque el bucle del juego sigue corriendo tras el GAME OVER
  // y vuelve a mostrarlo (ver Gotchas en CLAUDE.md).
  await page.addStyleTag({ content: '#overlay { display: none !important; }' });
  await capturar(page, 'record-panel');

  expect(final.lineas).toBeGreaterThanOrEqual(30);
});
