// =============================================================================
// La clave de Anthropic del NEGOCIO, y la frontera con la de la plataforma
// =============================================================================
// Decisión de Martín del 15/10/2026 (opción A de la Ticketera `clientes-usan-su-claude`):
// el crédito de API de Claude Max del cliente entra por su clave propia, y MaKo la usa
// primero para sus funciones de texto. El veto del 13/8 («que ya no se pueda gastar con
// Claude directamente, que se prohíba») sigue cerrando la plata de MaKo.
//
// Todo el riesgo está en la frontera: una clave de la PLATAFORMA que pase por la puerta del
// negocio es el gasto de MaKo sin lista blanca. Este test la prueba por los dos lados:
//   · la regla, ejecutándola (evaluarClaveDelNegocio, pura);
//   · el cableado, leyendo el fuente: de dónde sale la clave, con qué se compara y cuál
//     llega al `fetch`.
//
// Correr: npx tsx --test tests/veto-claude-clave-negocio.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA. Base: 11 pasan, 0 fallan.
//   - el veto deja de comparar contra las claves de la plataforma          → 10/1
//   - la comparación sin trim (una copia con un espacio de más pasaba)      → 10/1
//   - la clave del negocio leída con credWs, que cae al env del dueño       → 10/1
//   - la lista de la plataforma sin el env                                  → 10/1
//   - el fetch con otra clave que la que verificó el veto                   → 10/1
//   - el Plan deja de estar excluido                                        → 10/1
//   - una clave «PENDING…» pasa como cargada                                → 10/1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluarClaveDelNegocio, evaluarPermiso, FEATURES_DEL_PLAN, CLAUDE_CON_CLAVE_DEL_NEGOCIO } from '../lib/veto-claude';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` primero y los bloques después, y NADA más. Una versión con un paso que borra
// las líneas que empiezan con `*` (el interior de un JSDoc) se lleva también los ` */` que los
// cierran, y el recorte de bloques queda abierto hasta el próximo cierre: sobre lib/ai-cheap.ts
// se comía la cascada entera (medido el 16/10/2026).
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const NEGOCIO = 'sk-ant-api03-del-negocio-0001';
const ENV = 'sk-ant-api03-plataforma-env';
const DUENO = 'sk-ant-api03-plataforma-fila-del-dueno';
const PLATAFORMA = 'sk-ant-api03-plataforma-fila-ws-plataforma';
const PLAT = [ENV, DUENO, PLATAFORMA];

test('la clave del negocio, distinta de la de la plataforma, pasa con el modelo barato', () => {
  const v = evaluarClaveDelNegocio({ feature: 'productos', clave: NEGOCIO, clavesPlataforma: PLAT });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.permiso.clave, NEGOCIO, 'el permiso tiene que llevar la clave verificada, no otra');
  assert.equal(v.permiso.model, CLAUDE_CON_CLAVE_DEL_NEGOCIO.modelos[0]);
});

test('LA FRONTERA: ninguna copia de la clave de la plataforma pasa por la puerta del negocio', () => {
  for (const [donde, copia] of [['el env', ENV], ['la fila del dueño', DUENO], ['la fila de la plataforma', PLATAFORMA]] as const) {
    const v = evaluarClaveDelNegocio({ feature: 'productos', clave: copia, clavesPlataforma: PLAT });
    assert.equal(v.ok, false, `la copia de ${donde} pasó como si fuera del negocio: pagaría MaKo`);
  }
  // Pegada con espacios sigue siendo la misma clave.
  assert.equal(evaluarClaveDelNegocio({ feature: 'productos', clave: `  ${ENV}\n`, clavesPlataforma: PLAT }).ok, false);
  assert.equal(evaluarClaveDelNegocio({ feature: 'productos', clave: ENV, clavesPlataforma: [null, undefined, ` ${ENV} `] }).ok, false);
});

test('sin clave del negocio, o con una a medio cargar, no hay puerta', () => {
  for (const clave of [null, undefined, '', '   ', 'PENDING-verificacion']) {
    assert.equal(evaluarClaveDelNegocio({ feature: 'productos', clave, clavesPlataforma: PLAT }).ok, false, `pasó con ${JSON.stringify(clave)}`);
  }
});

test('el interruptor de pánico y la falta de feature también cierran la puerta del negocio', () => {
  assert.equal(evaluarClaveDelNegocio({ feature: 'productos', clave: NEGOCIO, clavesPlataforma: PLAT, pausa: true }).ok, false);
  assert.equal(evaluarClaveDelNegocio({ feature: '', clave: NEGOCIO, clavesPlataforma: PLAT }).ok, false);
});

test('el Plan nunca paga IA, ni con la clave del negocio', () => {
  assert.ok(FEATURES_DEL_PLAN.length >= 5);
  for (const f of FEATURES_DEL_PLAN) {
    assert.equal(evaluarClaveDelNegocio({ feature: f, clave: NEGOCIO, clavesPlataforma: PLAT }).ok, false, `${f} usaría el crédito del negocio`);
  }
});

test('con la clave del negocio no se compra otro modelo que el barato', () => {
  assert.equal(evaluarClaveDelNegocio({ feature: 'productos', model: 'claude-opus-4-8', clave: NEGOCIO, clavesPlataforma: PLAT }).ok, false);
});

test('la puerta 1 no cambió: una feature cualquiera sigue sin poder pagarle a Claude', () => {
  assert.equal(evaluarPermiso({ feature: 'productos' }).ok, false);
});

// ── El cableado ───────────────────────────────────────────────────────────────

/** El cuerpo de `conClaveDelNegocio`, hasta la función siguiente. */
function cuerpoDelIntento(): string {
  const src = leer('lib/anthropic.ts');
  const ini = src.indexOf('export async function conClaveDelNegocio(');
  assert.ok(ini > 0, 'no existe conClaveDelNegocio en lib/anthropic.ts');
  const fin = src.indexOf('\nexport async function ', ini + 10);
  const b = src.slice(ini, fin);
  // Contra un recorte desbocado: medido el 16/10/2026, unos 2.300 caracteres.
  assert.ok(b.length > 800 && b.length < 6000, `el recorte mide ${b.length}: está mirando otra cosa`);
  return sinComentarios(b);
}

test('la clave del negocio se lee SÓLO de su fila, nunca con credWs (que cae al env)', () => {
  const b = cuerpoDelIntento();
  assert.match(b, /credDelCliente\('ANTHROPIC_API_KEY'\)/);
  assert.doesNotMatch(b, /credWs\(/, 'credWs resuelve el env de la plataforma para el dueño: esa clave pasaría como del negocio');
});

test('se compara contra las TRES copias de la plataforma, leídas estrictas', () => {
  const b = cuerpoDelIntento();
  assert.match(b, /process\.env\.ANTHROPIC_API_KEY/, 'falta el env');
  assert.match(b, /credWsEstricta\('ANTHROPIC_API_KEY', OWNER_WS\)/, 'falta la fila del dueño');
  assert.match(b, /credWsEstricta\('ANTHROPIC_API_KEY', await wsSuperAdmin\(\)\)/, 'falta la fila de la plataforma');
  assert.match(b, /evaluarClaveDelNegocio\(/);
});

test('el fetch usa la clave que verificó el veto, y la URL del permiso', () => {
  const b = cuerpoDelIntento();
  assert.match(b, /'x-api-key': permiso\.clave/, 'el fetch tiene que usar permiso.clave, no volver a resolver otra');
  assert.match(b, /fetch\(permiso\.endpoint/);
});

test('la cascada de texto prueba la clave del negocio ANTES que los proveedores gratis', () => {
  const src = sinComentarios(leer('lib/ai-cheap.ts'));
  const ini = src.indexOf('export async function chatCheapCascade(');
  const intento = src.indexOf('conClaveDelNegocio(', ini);
  const bucle = src.indexOf('for (const prov of orden as ProvName[])', ini);
  assert.ok(intento > ini && bucle > ini, 'no encuentro el intento o el bucle de la cascada');
  assert.ok(intento < bucle, 'la clave del negocio quedó DESPUÉS de la cascada gratis');
});
