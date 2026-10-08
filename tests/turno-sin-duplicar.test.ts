// =============================================================================
// Un turno del doer no repite una acción cuando rota de proveedor.
// =============================================================================
// El bug (anterior al 07/10/2026, lo encontró la revisión adversarial del rediseño de la
// agenda y lo confirmó un refutador leyendo el código): el doer de WhatsApp vuelve a
// correr el turno ENTERO desde el mensaje original en cinco lugares —la siguiente cuenta
// del cliente, el reintento con la herramienta forzada, la red de plataforma, el escalado
// a Claude y el camino de Groq—, y `crearPendiente` hacía un INSERT sin mirar nada. Si el
// primer proveedor ya había propuesto una acción y después fallaba, quedaban DOS
// pendientes iguales: el «sí» contestaba «Hay 2 acciones pendientes, aclara cuál», y
// confirmadas las dos eran dos eventos y dos invitaciones al lead.
//
// Lo que fija este archivo:
//   1. el memo de acciones (lib/turno-sin-duplicar.ts): lo que una acción hizo en un
//      intento anterior se le devuelve al intento nuevo, sin volver a correr;
//   2. la red de datos: `crearPendiente` no guarda dos veces la misma pendiente en un turno;
//   3. el cableado: cada corrida del doer abre un intento nuevo, `runTool` consulta el
//      memo antes de ejecutar, y los dos que crean pendientes pasan el inicio del turno.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearMemoDeAcciones, firma, pendienteRepetida, MARGEN_RELOJ_MS } from '../lib/turno-sin-duplicar';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const esAccion = (n: string) => n.startsWith('proponer_') || n === 'confirmar_accion';

/** Un doer de juguete: un `runTool` con el memo, como el de lib/mako-doer-in.ts, sobre una
 *  acción que deja una pendiente por llamada. */
function doerDeJuguete() {
  const pendientes: number[] = [];
  const memo = crearMemoDeAcciones(esAccion);
  const runTool = async (name: string): Promise<string> => {
    const previo = memo.previo(name);
    if (previo) return previo.out as string;
    let out: string;
    if (name === 'buscar_leads') out = JSON.stringify([{ id: 7 }]);
    else { pendientes.push(pendientes.length + 1); out = JSON.stringify({ ok: true, pendiente_id: pendientes.length }); }
    memo.anotar(name, out);
    return out;
  };
  const nuevoIntento = () => { memo.nuevoIntento(); return runTool; };
  return { pendientes, nuevoIntento, runTool, memo };
}

// --- 1. El caso del bug -------------------------------------------------------------

test('el caso: el primer proveedor propone y se cae, el segundo vuelve a correr el turno → UNA pendiente', async () => {
  const d = doerDeJuguete();
  // Intento 1: busca el lead, propone, y el proveedor muere antes de contestar.
  const t1 = d.nuevoIntento();
  await t1('buscar_leads');
  const primera = JSON.parse(await t1('proponer_agendar_agenda')) as { pendiente_id: number };
  // Intento 2 (otra cuenta): corre el turno entero de nuevo.
  const t2 = d.nuevoIntento();
  await t2('buscar_leads');
  const segunda = JSON.parse(await t2('proponer_agendar_agenda')) as { pendiente_id: number };
  assert.equal(d.pendientes.length, 1, 'el reintento dejó otra pendiente');
  assert.equal(segunda.pendiente_id, primera.pendiente_id, 'el intento nuevo tiene que recibir la MISMA pendiente');
});

test('dentro de UN intento, dos llamadas a la misma acción corren las dos (dos leads distintos)', async () => {
  const d = doerDeJuguete();
  const t = d.nuevoIntento();
  await t('proponer_cambio_etapa');
  await t('proponer_cambio_etapa');
  assert.equal(d.pendientes.length, 2);
  // Y en el intento siguiente, las dos se devuelven en orden; una tercera sí corre.
  const t2 = d.nuevoIntento();
  assert.equal(JSON.parse(await t2('proponer_cambio_etapa')).pendiente_id, 1);
  assert.equal(JSON.parse(await t2('proponer_cambio_etapa')).pendiente_id, 2);
  await t2('proponer_cambio_etapa');
  assert.equal(d.pendientes.length, 3);
});

test('sin abrir un intento nuevo no se ataja nada: por eso cada corrida lo abre', async () => {
  const d = doerDeJuguete();
  d.nuevoIntento();
  await d.runTool('proponer_agendar_agenda');
  await d.runTool('proponer_agendar_agenda'); // el «mismo intento»: corre
  assert.equal(d.pendientes.length, 2);
});

test('lo que no hizo nada no se guarda: el intento siguiente lo intenta de verdad', () => {
  const memo = crearMemoDeAcciones(esAccion);
  memo.nuevoIntento();
  memo.previo('proponer_agendar_agenda');
  memo.anotar('proponer_agendar_agenda', JSON.stringify({ ok: false, error: 'el lead no tiene email' }));
  memo.previo('confirmar_accion');
  memo.anotar('confirmar_accion', { content: 'falló', isError: true });
  memo.nuevoIntento();
  assert.equal(memo.previo('proponer_agendar_agenda'), null);
  assert.equal(memo.previo('confirmar_accion'), null);
});

test('un «sí» ejecutado no se vuelve a ejecutar; una lectura nunca se guarda', () => {
  const memo = crearMemoDeAcciones(esAccion);
  memo.nuevoIntento();
  memo.previo('confirmar_accion');
  memo.anotar('confirmar_accion', '✅ Hecho: la reunión quedó el vie 10 oct, 16:00.');
  memo.previo('buscar_leads');
  memo.anotar('buscar_leads', '[]');
  memo.nuevoIntento();
  assert.deepEqual(memo.previo('confirmar_accion'), { out: '✅ Hecho: la reunión quedó el vie 10 oct, 16:00.' });
  assert.equal(memo.previo('buscar_leads'), null);
});

// --- 2. La red de datos -------------------------------------------------------------

test('la firma de un payload no depende del orden de las claves', () => {
  assert.equal(firma({ a: 1, b: { c: 2, d: [1, 2] } }), firma({ b: { d: [1, 2], c: 2 }, a: 1 }));
  assert.notEqual(firma({ a: [1, 2] }), firma({ a: [2, 1] }));
});

test('la misma pendiente en el mismo turno se reusa; otra o de antes, no', () => {
  const desde = Date.parse('2026-10-07T23:00:00Z');
  const filas = [
    { id: 4, payload: { leadId: 7, inicioIso: 'X' }, created_at: '2026-10-07T23:00:01Z' },
    { id: 5, payload: { inicioIso: 'X', leadId: 7 }, created_at: '2026-10-07T23:00:03Z' },
    { id: 3, payload: { leadId: 7, inicioIso: 'X' }, created_at: new Date(desde - MARGEN_RELOJ_MS - 1000).toISOString() },
  ];
  assert.equal(pendienteRepetida(filas, { inicioIso: 'X', leadId: 7 }, desde), 5, 'la más reciente del turno');
  assert.equal(pendienteRepetida(filas, { leadId: 8, inicioIso: 'X' }, desde), null, 'otro payload es otra pendiente');
  assert.equal(pendienteRepetida([filas[2]], { leadId: 7, inicioIso: 'X' }, desde), null, 'la de un turno anterior no se reusa');
});

// --- 3. El cableado -----------------------------------------------------------------

test('cada corrida del doer abre un intento nuevo: ninguna recibe `runTool` pelado', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const corridas = [...doer.matchAll(/chat(?:Cheap|Claude)Tools\(system, msgs, tools, ([^,]+),/g)].map((m) => m[1].trim());
  assert.ok(corridas.length >= 6, `encontré ${corridas.length} corridas: cambió la forma y este test ya no mira nada`);
  assert.deepEqual(corridas.filter((c) => c !== 'nuevoIntento()'), [], 'una corrida que no abre intento repite las acciones');
  assert.match(doer, /const nuevoIntento = \(\) => \{ memo\.nuevoIntento\(\); return runTool; \};/);
});

test('runTool consulta el memo ANTES de ejecutar y anota DESPUÉS', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const ini = doer.indexOf('const runTool = async (name: string, input: Record<string, unknown>) => {');
  assert.ok(ini > 0, 'no encontré runTool');
  const cuerpo = doer.slice(ini, doer.indexOf('const nuevoIntento', ini));
  const iPrevio = cuerpo.indexOf('const previo = memo.previo(name);');
  const iCorre = cuerpo.indexOf('PENDIENTES_POR_REGISTRO.has(name) ? runRegistro(name, input)');
  const iAnota = cuerpo.indexOf('memo.anotar(name, out);');
  assert.ok(iPrevio > 0 && iCorre > iPrevio && iAnota > iCorre, 'el orden tiene que ser: memo → ejecutar → anotar');
  assert.match(cuerpo.slice(iPrevio, iCorre), /if \(previo\) \{[\s\S]*return previo\.out/);
});

test('los dos que crean pendientes desde el doer pasan el inicio del turno, y crearPendiente lo usa antes de insertar', () => {
  assert.match(sinComentarios(leer('lib/api-mako/acciones.ts')), /crearPendiente\(ctx\.ws, \{[\s\S]{0,300}mismoTurnoDesde: ctx\.turnStart,/);
  assert.match(sinComentarios(leer('lib/mako-doer-acciones.ts')), /crearPendiente\(ws, \{[^}]*mismoTurnoDesde: turnStart \}\)/);
  const lib = sinComentarios(leer('lib/mako-pendientes.ts'));
  const cuerpo = lib.slice(lib.indexOf('export async function crearPendiente('), lib.indexOf('async function vencerExpiradas'));
  const iRepetida = cuerpo.indexOf('pendienteRepetida(');
  const iInsert = cuerpo.indexOf('.insert(');
  assert.ok(iRepetida > 0 && iInsert > iRepetida, 'la búsqueda de la repetida tiene que ir antes del insert');
  assert.match(cuerpo, /if \(repetida != null\) \{[\s\S]*return repetida;/);
});

// Probado rompiéndolo (07/10/2026), una rotura por vez y con todo en verde antes: 12
// roturas, todas con su fallo. El memo que no devuelve nada y el intento que no reinicia
// la cuenta tumban 3 cada uno (el caso del bug entre ellos); guardar los errores, la firma
// que depende del orden, reusar una pendiente de otro turno, una corrida con `runTool`
// pelado, un `nuevoIntento` que no abre intento, `runTool` sin consultar o sin anotar,
// el registro o las acciones viejas sin pasar el turno, y `crearPendiente` sin devolver la
// repetida: 1 cada una. Dos condiciones que ninguna rotura distinguía —comparar el intento
// de lo guardado y saltear las lecturas al consultar— eran redundantes y se sacaron.
