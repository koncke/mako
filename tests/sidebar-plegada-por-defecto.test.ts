// =============================================================================
// La sidebar principal arranca PLEGADA en todas las tabs, y desplegarla se recuerda (24/10/2026)
// =============================================================================
// Martín: «en web generator, como en todas las tabs, haz que por defecto al entrar se pliegue la sidebar principal, pero no
// impidas que se vuelva a desplegar si el usuario le da click en desplegar». Esto fija:
//   · sin nada guardado, plegada (el rail de íconos que se abre con el cursor); con «si», abierta y fija; un navegador sin
//     almacenamiento, plegada;
//   · la clave NUEVA (`mk-nav-fija-v2`): con la vieja, quien alguna vez la volvió a abrir tenía «si» y no vería el cambio;
//   · el primer cuadro ya plegado (`useState(false)`): si no, se dibujaba abierta y se plegaba al montar, en cada carga;
//   · la flecha la despliega y lo guarda (fuera de las pantallas que la pliegan solas: Ops Center, Automations, ventana chica,
//     MaKo abierto, que siguen con su «por defecto» de cada visita, tests/automations-sidebar-plegada.test.ts).
//
// LA REGRESIÓN (25/10/2026). Martín: «La sidebar principal en muchas tabs no funciona el botón de "desplegar" para mantenerla
// desplegada, eso debería funcionar siempre». `fija` era `guardada && (!plegadaAca || abiertaAca)`: con la guardada en «no»
// (el default nuevo), la flecha en Automations, el Ops Center, la ventana chica o con MaKo abierto no la dejaba abierta nunca.
// «desplegarla con la flecha…» recorre la barra como la usa una persona: desplegarla se recuerda SIEMPRE, en cualquier pantalla.
// Verificado ROMPIÉNDOLO (25/10/2026): la fórmula de antes en `barraFija` → 1 rojo (el último test); desplegar en una pantalla
// que pliega sin guardar → 1; plegar con MaKo abierto guardando «no» → 1.
//
// EL VELO DE LA GUÍA (10/11/2026). Martín, en Image: con «Contesta aquí para seguir.» a la vista, la barra se abría ENCIMA del
// chat de MaKo al pasarle el cursor, y por el hueco del velo se veía a medias. Mientras el velo señala, el rail no se abre al
// pasar (`seAbreAlPasar`); un toque afuera pausa la guía y después se abre. Verificado rompiéndolo: sin mirar el velo → 1 rojo.
//
// Verificado ROMPIÉNDOLO (24/10/2026, base 4 / 0), de a una y restaurando a mano:
//   · `leerFija` con `!== 'no'` (el default de antes, abierta)                         → 3 / 1
//   · la clave vuelve a `mk-nav-fija`                                                  → 3 / 1
//   · `useState(true)` para `fijaGuardada`                                             → 3 / 1
//   · `setFija` sin `guardarFija(v)`                                                   → 3 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerFija, barraFija, loQueGuardaLaFlecha, seAbreAlPasar } from '../app/_components/Sidebar';

const fuente = readFileSync(new URL('../app/_components/Sidebar.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function conAlmacen(guardado: string | null | 'rompe', fn: () => void) {
  const g = globalThis as { window?: unknown };
  const antes = g.window;
  const pedidas: string[] = [];
  g.window = { localStorage: { getItem: (k: string) => { pedidas.push(k); if (guardado === 'rompe') throw new Error('sin almacenamiento'); return guardado; } } };
  try { fn(); } finally { g.window = antes; }
  return pedidas;
}

test('sin nada guardado arranca plegada; con «si», abierta y fija; sin almacenamiento, plegada', () => {
  let r = true;
  const pedidas = conAlmacen(null, () => { r = leerFija(); });
  assert.equal(r, false, 'por defecto, plegada');
  assert.deepEqual(pedidas, ['mk-nav-fija-v2'], 'la clave nueva: con la vieja, quien la reabrió alguna vez no vería el cambio');
  conAlmacen('si', () => { r = leerFija(); });
  assert.equal(r, true, 'la desplegó: se recuerda');
  conAlmacen('no', () => { r = leerFija(); });
  assert.equal(r, false);
  conAlmacen('rompe', () => { r = leerFija(); });
  assert.equal(r, false);
});

test('el primer cuadro ya va plegado (no se dibuja abierta para plegarse al montar)', () => {
  assert.match(fuente, /const \[fijaGuardada, setFijaEstado\] = useState\(false\);/);
  assert.match(fuente, /useEffect\(\(\) => \{ setFijaEstado\(leerFija\(\)\); \}, \[\]\);/);
});

test('la flecha la despliega y eso se guarda (plegarla, salvo en las pantallas que la pliegan solas, donde vale por la visita)', () => {
  assert.match(fuente, /const guardar = loQueGuardaLaFlecha\(v, plegadaAca\);\s*if \(guardar != null\) \{ setFijaEstado\(guardar\); guardarFija\(guardar\); \}\s*if \(plegadaAca\) setAbiertaAca\(v\);/);
  assert.match(fuente, /const fija = barraFija\(fijaGuardada, plegadaAca, abiertaAca\);/);
  assert.match(fuente, /useEffect\(\(\) => \{ setAbiertaAca\(false\); \}, \[plegadaAca\]\);/);
  assert.match(fuente, /window\.localStorage\.setItem\(FIJA, v \? 'si' : 'no'\)/);
  assert.match(fuente, /onClick=\{\(\) => setFija\(!fija\)\}/, 'la flecha');
});

test('Web Generator sigue la regla de todas las tabs (no la de las pantallas que la pliegan en cada visita)', async () => {
  const { pliegaLaBarra } = await import('../app/_components/Sidebar');
  // Martín pidió «como en todas las tabs» y que desplegarla no se impida: con la regla de visita, se volvería a plegar cada vez.
  assert.equal(pliegaLaBarra('/web-generator'), false);
});

/** La barra como la ve una persona: lo guardado, si la pantalla la pliega sola y lo que la flecha hizo en esa visita. */
function barra(inicial: boolean) {
  let guardada = inicial, plegadaAca = false, abiertaAca = false;
  return {
    get fija() { return barraFija(guardada, plegadaAca, abiertaAca); },
    get guardada() { return guardada; },
    // Cambiar de pantalla (o abrir/cerrar MaKo): lo de la visita se olvida cuando cambia `plegadaAca`, como el useEffect.
    ir(pliega: boolean) { if (pliega !== plegadaAca) abiertaAca = false; plegadaAca = pliega; },
    flecha(v: boolean) { const g = loQueGuardaLaFlecha(v, plegadaAca); if (g != null) guardada = g; if (plegadaAca) abiertaAca = v; },
  };
}

test('desplegarla con la flecha la deja abierta en CUALQUIER pantalla, y la próxima tab la encuentra abierta', () => {
  // Arranca plegada en Automations (pliega sola), sin nada guardado: el caso de Martín.
  const b = barra(false);
  b.ir(true);
  assert.equal(b.fija, false, 'plegada al entrar');
  b.flecha(true);
  assert.equal(b.fija, true, 'la flecha en una pantalla que pliega sola no la dejaba abierta (la regresión del 24/10)');
  assert.equal(b.guardada, true, 'desplegarla se recuerda siempre');
  b.ir(false);
  assert.equal(b.fija, true, 'el CRM la encuentra abierta');

  // Con MaKo abierto se pliega sola; plegarla ahí es de ese rato, y al cerrarlo vuelve a su lugar.
  b.ir(true);
  assert.equal(b.fija, false, 'MaKo abierto la pliega');
  b.flecha(true); b.flecha(false);
  assert.equal(b.guardada, true, 'plegarla con MaKo abierto pisaba la preferencia');
  b.ir(false);
  assert.equal(b.fija, true, 'al cerrar MaKo vuelve abierta, como estaba');

  // En una tab común, plegarla también se recuerda.
  b.flecha(false);
  assert.equal(b.fija, false);
  assert.equal(b.guardada, false);
});

test('donde la barra se pliega sola, manda lo que hizo la flecha en esa visita, diga lo que diga lo guardado', () => {
  // Lo guardado puede decir «no» con la barra abierta en la visita: otra pestaña la plegó, o el navegador no guarda nada.
  assert.equal(barraFija(false, true, true), true, 'abierta en la visita y plegada en lo guardado: se plegaba');
  assert.equal(barraFija(true, true, false), false, 'pliega sola: plegada aunque lo guardado diga «si»');
  assert.equal(barraFija(true, false, false), true);
  assert.equal(barraFija(false, false, true), false);
  assert.equal(loQueGuardaLaFlecha(true, true), true);
  assert.equal(loQueGuardaLaFlecha(false, true), null);
  assert.equal(loQueGuardaLaFlecha(false, false), false);
});

test('mientras el velo de la guía señala una pregunta, el rail no se abre al pasarle el cursor', () => {
  assert.equal(seAbreAlPasar(false, false), true, 'plegada y sin velo: el cursor la abre, como siempre');
  assert.equal(seAbreAlPasar(false, true), false, 'con el velo, se abriría ENCIMA del chat que la guía está señalando');
  assert.equal(seAbreAlPasar(true, false), false, 'fija ya está abierta');
  assert.equal(seAbreAlPasar(true, true), false);
});
