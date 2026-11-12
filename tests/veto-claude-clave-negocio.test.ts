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
// Y las dos del gasto, sumadas el mismo día (base 14/0):
//   - lib/costos-ia.ts vuelve a sumar lo del negocio como gasto de MaKo     → 13/1
//   - la marca va al FINAL del motivo (el corte a 200 la perdería)          → 13/1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluarClaveDelNegocio, evaluarPermiso, FEATURES_DEL_PLAN, CLAUDE_CON_CLAVE_DEL_NEGOCIO, MOTIVO_CLAVE_DEL_NEGOCIO, esDeLaClaveDelNegocio } from '../lib/veto-claude';

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

// Hasta el 22/10/2026: «el Plan nunca paga IA, ni con la clave del negocio». Desde ahí, la excepción de Martín, textual:
// «Sí, si es su clave». MaKo sigue sin pagar el Plan; el negocio, con SU clave, sí, y con el barato.
test('el Plan paga sólo con la clave que paga el negocio, y con el barato; nunca con el crédito de la plataforma', () => {
  assert.ok(FEATURES_DEL_PLAN.length >= 5);
  const CREDITO = 'sk-ant-api03-credito-de-max-zzzzzzzzzzzzzzzzzzzzzzzzz';
  for (const f of FEATURES_DEL_PLAN) {
    const v = evaluarClaveDelNegocio({ feature: f, clave: NEGOCIO, clavesPlataforma: PLAT, model: 'claude-sonnet-5', creditosPlataforma: [CREDITO] });
    assert.ok(v.ok && v.permiso.model === 'claude-haiku-4-5', `${f}: con su clave, sí, y con el barato aunque elija Sonnet`);
    assert.equal(evaluarClaveDelNegocio({ feature: f, clave: CREDITO, clavesPlataforma: PLAT, creditosPlataforma: [CREDITO] }).ok, false, `${f} pagaría con el crédito de Martín`);
    assert.equal(evaluarClaveDelNegocio({ feature: f, clave: NEGOCIO, clavesPlataforma: PLAT, creditosPlataforma: null }).ok, false, `${f}: sin poder comparar con el crédito, no`);
    assert.equal(evaluarClaveDelNegocio({ feature: f, clave: PLAT[0], clavesPlataforma: PLAT, creditosPlataforma: [] }).ok, false, `${f}: con una copia de la de MaKo, no`);
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
  // Desde el 20/10/2026 la FRONTERA (qué clave es del negocio y cuál de la plataforma) vive en `permisoDeLaClaveDelNegocio`,
  // que comparten la cascada de texto y el turno con herramientas (`chatClaudeTools`); el pedido, en `conClaveDelNegocio`.
  // El recorte toma las dos, que van juntas.
  const ini = src.indexOf('export async function permisoDeLaClaveDelNegocio(');
  const con = src.indexOf('export async function conClaveDelNegocio(');
  assert.ok(ini > 0 && con > ini, 'permisoDeLaClaveDelNegocio y después conClaveDelNegocio, en lib/anthropic.ts');
  const fin = src.indexOf('\nexport async function ', con + 10);
  const b = src.slice(ini, fin);
  // Contra un recorte desbocado: medido el 20/10/2026, unos 3.600 caracteres; el 22/10/2026, unos 8.100 (el modelo que
  // elige el negocio y el crédito de Martín, IA5, y las claves de la plataforma en su propia función, en el medio).
  // El 22/10/2026 a la noche, unos 10.800: el crédito asignado a un negocio (lib/credito-negocio.ts), al principio.
  // El 28/10/2026, unos 12.300: la cuenta del crédito de los grupos de WhatsApp (`cuentaDeLosGrupos`, lib/credito-negocio.ts).
  // El 11/11/2026, unos 14.000: la regla del crédito para la plataforma (`puedeUsarUnaCuentaDelCredito`) y el fallo de una
  // cuenta del crédito escrito en el Uso, no en la tarjeta del negocio (`anotarFalloDelCredito`).
  assert.ok(b.length > 800 && b.length < 15_500, `el recorte mide ${b.length}: está mirando otra cosa`);
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
  // La fila de la que sale el entorno de esta clave (`wsDelEntorno`). Hasta el 18/10/2026 era la del ws1 (`OWNER_WS`), y
  // así la clave propia de Mauricio nunca contaba como suya (Martín: «separá el ws1 de las claves de la plataforma»).
  // Y una fila que existe y no se descifra TAMBIÉN es «no pude leer» (`ilegibleTira`, revisión adversarial de IA15): con
  // `null`, una copia o el crédito de Martín pasaban por del negocio.
  assert.match(b, /credWsEstricta\('ANTHROPIC_API_KEY', await wsDelEntorno\('ANTHROPIC_API_KEY'\), \{ ilegibleTira: true \}\)/, 'falta la fila del entorno (con ilegibleTira)');
  assert.doesNotMatch(b, /credWsEstricta\('ANTHROPIC_API_KEY', OWNER_WS/, 'la fila del ws1 ya no es la de la plataforma');
  assert.match(b, /credWsEstricta\('ANTHROPIC_API_KEY', await wsSuperAdmin\(\), \{ ilegibleTira: true \}\)/, 'falta la fila de la plataforma (con ilegibleTira)');
  assert.match(b, /evaluarClaveDelNegocio\(/);
});

test('el fetch usa la clave que verificó el veto, y la URL del permiso', () => {
  const b = cuerpoDelIntento();
  assert.match(b, /'x-api-key': permiso\.clave/, 'el fetch tiene que usar permiso.clave, no volver a resolver otra');
  assert.match(b, /fetch\(permiso\.endpoint/);
});

// ── El gasto: lo del negocio no es de MaKo ──────────────────────────────────────

test('la marca del gasto del negocio se reconoce, y una fila de MaKo no', () => {
  assert.equal(esDeLaClaveDelNegocio(`${MOTIVO_CLAVE_DEL_NEGOCIO} · Armar el catálogo`), true);
  assert.equal(esDeLaClaveDelNegocio('Analizar la llamada de Ana'), false);
  // Al final del motivo NO cuenta: `insertUsage` corta a 200 y ahí se pierde.
  assert.equal(esDeLaClaveDelNegocio(`Armar el catálogo · ${MOTIVO_CLAVE_DEL_NEGOCIO}`), false);
  assert.equal(esDeLaClaveDelNegocio(null), false);
});

test('la llamada con la clave del negocio se registra con la marca PRIMERO', () => {
  const b = cuerpoDelIntento();
  assert.match(b, /recordUsage\([^)]*\[marcaDelGasto\(permiso\), /, 'la marca tiene que ir al principio del motivo');
  // Y la marca es la del negocio, salvo que su clave sea el crédito de Max de la plataforma (revisión del lote 2).
  // La cuenta del crédito de los grupos va primero, con su número (28/10/2026, tests/credito-grupos.test.ts 3).
  assert.match(sinComentarios(leer('lib/anthropic.ts')), /const marcaDelGasto = \(permiso: PermisoClaveDelNegocio\): string =>\s*permiso\.cuentaDelCredito \? `\$\{MOTIVO_CREDITO_PLATAFORMA\} \(cuenta \$\{permiso\.cuentaDelCredito\}\)`\s*: permiso\.esCredito \? MOTIVO_CREDITO_SU_CLAVE : MOTIVO_CLAVE_DEL_NEGOCIO;/);
  assert.match(leer('lib/veto-claude.ts'), /export const MOTIVO_CREDITO_SU_CLAVE = `\$\{MOTIVO_CREDITO_PLATAFORMA\} \(su clave es el crédito\)`;/, 'la marca del crédito tiene que empezar como la del crédito de la plataforma (costos-ia la saca del gasto de MaKo)');
});

test('el gasto de MaKo (lib/costos-ia.ts) no suma lo que pagó un negocio con su clave', () => {
  const src = sinComentarios(leer('lib/costos-ia.ts'));
  const ini = src.indexOf('function costoDe(');
  assert.ok(ini > 0, 'no encuentro costoDe');
  const cuerpo = src.slice(ini, src.indexOf('\n}', ini));
  assert.match(cuerpo, /if \(esDeLaClaveDelNegocio\(r\.motivo\)\) return 0;/, 'costoDe suma el crédito del negocio como gasto de MaKo');
  assert.match(src, /delNegocio: \{ llamadas: delNegocio\.length/, 'lo del negocio tiene que quedar aparte, no desaparecer');
});

test('la cascada de texto prueba la clave del negocio ANTES que los proveedores gratis', () => {
  const src = sinComentarios(leer('lib/ai-cheap.ts'));
  const ini = src.indexOf('export async function chatCheapCascade(');
  const intento = src.indexOf('conClaveDelNegocio(', ini);
  const bucle = src.indexOf('for (const prov of orden as ProvName[])', ini);
  assert.ok(intento > ini && bucle > ini, 'no encuentro el intento o el bucle de la cascada');
  assert.ok(intento < bucle, 'la clave del negocio quedó DESPUÉS de la cascada gratis');
});
