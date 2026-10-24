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
// Verificado ROMPIÉNDOLO (24/10/2026, base 4 / 0), de a una y restaurando a mano:
//   · `leerFija` con `!== 'no'` (el default de antes, abierta)                         → 3 / 1
//   · la clave vuelve a `mk-nav-fija`                                                  → 3 / 1
//   · `useState(true)` para `fijaGuardada`                                             → 3 / 1
//   · `setFija` sin `guardarFija(v)`                                                   → 3 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerFija } from '../app/_components/Sidebar';

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

test('la flecha la despliega y eso se guarda (salvo en las pantallas que la pliegan solas, donde vale por la visita)', () => {
  assert.match(fuente, /if \(plegadaAca\) \{ setAbiertaAca\(v\); if \(!v\) setExpanded\(false\); return; \}\s*setFijaEstado\(v\); guardarFija\(v\);/);
  assert.match(fuente, /window\.localStorage\.setItem\(FIJA, v \? 'si' : 'no'\)/);
  assert.match(fuente, /onClick=\{\(\) => setFija\(!fija\)\}/, 'la flecha');
});

test('Web Generator sigue la regla de todas las tabs (no la de las pantallas que la pliegan en cada visita)', async () => {
  const { pliegaLaBarra } = await import('../app/_components/Sidebar');
  // Martín pidió «como en todas las tabs» y que desplegarla no se impida: con la regla de visita, se volvería a plegar cada vez.
  assert.equal(pliegaLaBarra('/web-generator'), false);
});
