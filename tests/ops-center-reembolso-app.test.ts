// =============================================================================
// «Devolvele el pago a Carlos» llega a reembolsar_cobro en el chat de la app (22/10/2026, el rojo del tren 1)
// =============================================================================
// Después de OC1 (la selección propia del chat de la app), tests/ops-center-bateria.test.ts dio `pagos-cuenta` 34/100 con piso 35:
// «devolvele el pago a Carlos» dejó de llegar a `reembolsar_cobro`. El área y la pista estaban bien (el clasificador ve el objeto
// «reembolso»); lo que la frenaba era la puerta de las destructivas (lib/relevancia-app.ts → puertaDeDestructivas): la abre un pedido
// de QUITAR (`pideQuitar`), y «devolver» no es un verbo de quitar. Ahora la abre también DEVOLVER PLATA, sólo con su objeto.
//   1. devolver plata abre la puerta; devolver una llamada, o quejarse de un cobro, no;
//   2. la regla del objeto «reembolso» es UNA, la del clasificador y la de la puerta.
// (Que llegue entre las herramientas del chat lo mide la batería: tests/ops-center-bateria.test.ts, `pagos-cuenta` 35/100.)
//
// Correr: node --import tsx --test tests/ops-center-reembolso-app.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OBJETO_REEMBOLSO, pideQuitar } from '../lib/mako-intencion-app';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. devolver PLATA abre la puerta de las destructivas; devolver una llamada o quejarse de un cobro, no', () => {
  for (const t of ['devolvele el pago a Carlos', 'devuélvele la plata a Ana', 'hacele la devolución a Pedro', 'quiero el reembolso del cobro de Juan']) {
    assert.equal(pideQuitar(t), true, t);
  }
  for (const t of ['devolvele la llamada a Juan', 'me cobraron dos veces', 'cuánto me pagaron este mes', 'devolveme el mensaje de ayer']) {
    assert.equal(pideQuitar(t), false, t);
  }
});

test('2. la regla del objeto «reembolso» es UNA: la usan el clasificador y la puerta', () => {
  assert.ok(OBJETO_REEMBOLSO.test('devolvele el pago a carlos'));
  const clasificador = sinComentarios(leer('lib/mako-intencion.ts'));
  assert.match(clasificador, /import \{ OBJETO_REEMBOLSO, [^}]*\} from '\.\/mako-intencion-app';/);
  assert.doesNotMatch(clasificador, /const OBJETO_REEMBOLSO =/, 'sin una copia');
  assert.match(sinComentarios(leer('lib/mako-intencion-app.ts')), /return QUITAR_EN_EL_TEXTO\.test\(n\) \|\| \/\\bde\\s\+baja\\b\/\.test\(n\) \|\| OBJETO_REEMBOLSO\.test\(n\);/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 2/0):
//   · la puerta sin el objeto reembolso              → 0/2 (1, 2), y la batería sola 2/1 (pagos-cuenta 34/100)
//   · devolver suelto (sin su objeto) abre la puerta → 0/2 (1, 2)
