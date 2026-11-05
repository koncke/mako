// =============================================================================
// MaKo toma la iniciativa en Create: el ejemplo pregunta la oferta y la tarjeta reenvía la apertura (5/11/2026, T4 de
// docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «automáticamente, cuando se crea un copy, MaKo le pregunta… ¿quieres que lo adapte?», y la regla de las
// aperturas: la primera pregunta es de HECHO. Lo que se fija:
//   1. el primer mensaje del ejemplo (app/_crear/ejemplo.ts) pregunta lo MISMO que `pasoOferta` (lib/aperturas/comunes.ts), con
//      la frase del ejemplo delante: una sola regla para «¿Para cuál de tus ofertas es?» en todas las tabs;
//   2. `PantallaCrear` le pasa a la tarjeta del Cerebro la apertura de su tab (`ConversacionCerebro` ya la dibuja): es lo que usa
//      AI Avatar (T15).
//
// Correr: node --import tsx --test tests/iniciativa-create.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { primerMensajeDeEjemplo, quienDelEjemplo } from '../app/_crear/ejemplo';
import { pasoOferta } from '../lib/aperturas/comunes';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el primer mensaje del ejemplo pregunta lo mismo que pasoOferta, con la frase del ejemplo delante', () => {
  const casos = [[], [{ id: 3, nombre: 'Programa Cierre 90' }], [{ id: 3, nombre: 'Programa Cierre 90' }, { id: 4, nombre: 'Taller' }]];
  for (const ofertas of casos) {
    const m = primerMensajeDeEjemplo('image', 'Casa Norte', ofertas);
    const paso = pasoOferta({ superficie: 'image', ofertas, conApp: true, antes: quienDelEjemplo('Casa Norte') });
    assert.equal(m.texto, paso.texto, `${ofertas.length} ofertas: la misma pregunta`);
    assert.deepEqual(m.botones.slice(0, -1), paso.botones.filter((b) => b.tipo !== 'callar').map((b) => b.rotulo));
  }
});

test('2. PantallaCrear le pasa a la tarjeta del Cerebro la apertura de su tab', () => {
  const p = sinComentarios(leer('app/_crear/PantallaCrear.tsx'));
  assert.match(p, /apertura\?: ReactNode;/);
  assert.match(p, /<ConversacionCerebro tab=\{tab\} titulo="MaKo" antes=\{volver\} apertura=\{p\.apertura \?\? null\}/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · el ejemplo vuelve a «¿Lo adapto a tu negocio?»            → 1/1 (1)
//   · PantallaCrear no reenvía `apertura`                        → 1/1 (2)
