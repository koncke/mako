// =============================================================================
// La red de plataforma del Dashboard (lib/graficos-ia-red.ts) sigue el orden de `chatCheapCascade`
// =============================================================================
// Regla del 16/10/2026 (AGENTS.md, la sección de la red de plataforma): los datos de los clientes de un cliente
// nunca van a un proveedor que entrena con lo que recibe. Esta red NO pasa por `chatCheapCascade`, así que el
// corte de la cascada no la cubre: la aplica ella. El orden: el crédito de Claude de la plataforma (no entrena),
// después el corte si el pedido lleva datos de clientes, y recién ahí las keys gratis (el plan gratis de Gemini
// entrena). «Conclusiones de MaKo» lleva la marca `pii`: una caja de un pop-up lee el transcript de una llamada.
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada de memoria (base 4/0):
//   · el corte por datos de clientes que no corta (sin el `return null`)            -> 3 / 1
//   · el corte sin mirar la marca del catálogo (`pii ?? false`)                      -> 3 / 1
//   · sin el crédito de Claude primero                                               -> 3 / 1
//   · «dashboard-conclusiones» sin la marca `pii` en el catálogo                      -> 3 / 1
//
// Correr: npx tsx --test tests/graficos-ia-red.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RED = sinComentarios(readFileSync(join(RAIZ, 'lib', 'graficos-ia-red.ts'), 'utf8'));
const cuerpo = RED.slice(RED.indexOf('export async function porLaRedDePlataforma('));

test('la red del Dashboard: primero el crédito de Claude, después el corte por datos de clientes, después las keys gratis', () => {
  assert.ok(cuerpo.length > 500, `el cuerpo mide ${cuerpo.length}: ¿se movió la función?`);
  const credito = cuerpo.indexOf('conCreditoDeLaPlataforma(');
  const corte = cuerpo.indexOf('if (llevaDatosDeClientes(p.feature, p.pii)) {');
  const gratis = cuerpo.indexOf('provsGratisDePlataforma(');
  assert.ok(credito > 0, 'falta el crédito de Claude de la plataforma');
  assert.ok(corte > credito, 'el corte por datos de clientes va DESPUÉS del crédito de Claude');
  assert.ok(gratis > corte, 'las keys gratis van DESPUÉS del corte');
});

test('con datos de clientes la red termina antes de las keys gratis', () => {
  const desde = cuerpo.indexOf('if (llevaDatosDeClientes(p.feature, p.pii)) {');
  const rama = cuerpo.slice(desde, cuerpo.indexOf('\n  }', desde));
  assert.match(rama, /return null;/, 'el corte tiene que devolver null');
});

test('el corte lee la marca `pii` del catálogo cuando quien llama no la dice', () => {
  assert.match(RED, /export const llevaDatosDeClientes = \(feature: string, pii\?: boolean\): boolean =>\s*pii \?\? CATALOGO_MODELOS\.some\(\(f\) => f\.feature === feature && f\.pii === true\);/);
});

test('«Conclusiones de MaKo» lleva la marca `pii`; las otras dos IA del Dashboard, no', () => {
  const marca = (f: string) => CATALOGO_MODELOS.find((x) => x.feature === f)?.pii;
  assert.equal(marca('dashboard-conclusiones'), true);
  assert.equal(marca('dashboard-analista'), false);
  assert.equal(marca('dashboard-hoja-ia'), false);
});
