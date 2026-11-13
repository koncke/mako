// =============================================================================
// Lo que la voz GUARDÓ y el webhook nunca vio (13/11/2026, Mauricio, ws1; lib/rescate-del-store.ts)
// =============================================================================
// Mauricio escribió en su grupo de MaKo el 12/11 (19:23–20:21 UTC) y el 13/11 (15:58–15:59). MaKo no le contestó, y no quedó
// rastro: ni cola, ni hilo de la app, ni una clasificación, ni el aviso de «llegó tarde». Los mensajes estaban en el store de
// Evolution de las dos líneas, pero entraron EN LOTE al re-vincularlas (17:12:27 y 17:13:37), como historial: Evolution los
// guarda y no manda `messages.upsert`. Lo que fija:
//   1. la hora de GUARDADO sale del id (cuid de Prisma), comprobada contra un `createdAt` real;
//   2. qué se rescata, con las filas REALES del store del 13/11: lo de una persona, que se lee, que el webhook no vio y que la
//      línea guardó hace poco; el autor se arma del @lid y el nombre de otra fila del grupo;
//   3. de punta a punta (tests/_rescate-del-store-hijo.ts): la vuelta del cron encola lo de 74 min, avisa a SuperAdmin lo de
//      22 h, espeja todo al hilo de la app, no repite, y `doer-flush` contesta UNA vez con los dos mensajes juntos;
//   4. el cableado: corre en el cron alerta-critica, y el modo `soloEncolar` corta ANTES del candado y del turno.
//
// Probado rompiéndolo (13/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { horaDeGuardado, queRescatar, tieneContenido, RECIENTE_MS, RESPIRO_MS, type RegistroDelStore } from '../lib/rescate-del-store';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const S = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const JID = '120363411646661065@g.us';

// Las filas del store de `mako_superadmin_muylqv8r` en el grupo de Mauricio, leídas el 13/11/2026 a las 18:50 UTC (sólo lectura):
// los ids (de Evolution y de WhatsApp), las horas y la forma son los de verdad; los textos, recortados.
const lote = (id: string, idStore: string, ts: string, texto: string | null): RegistroDelStore => ({
  id: idStore, key: { id, fromMe: false, remoteJid: JID }, pushName: '209130681839667', messageType: texto == null ? 'protocolMessage' : 'conversation',
  message: texto == null ? { protocolMessage: { type: 0 }, messageContextInfo: {} } : { conversation: texto }, messageTimestamp: S(ts),
});
const STORE: RegistroDelStore[] = [
  // Lo que SÍ llegó por el webhook (escrito el 12/11 a las 05:44, guardado a las 11:47): con su participant y su nombre.
  { id: 'cmwdhh9zqiu4do05rsnvvo4gn', key: { id: '3B38BD8EE406794AB38A', fromMe: false, remoteJid: JID, participant: '209130681839667@lid', participantAlt: '5216862168122@s.whatsapp.net' }, pushName: 'Mauricio Bustos Eguía', messageType: 'conversation', message: { conversation: 'mako por favor abre la capacidad de envol de correos diartios' }, messageTimestamp: S('2026-11-12T05:44:52Z') },
  // El historial trae OTRA fila del mismo mensaje (el mismo id de WhatsApp), sin participant.
  lote('3B38BD8EE406794AB38A', 'cmwf8ipdjmn7ho05rmdi3rmfw', '2026-11-12T05:44:52Z', 'mako por favor abre la capacidad de envol de correos diartios'),
  lote('3B200FF84805DFDAFC70', 'cmwf8ipdjmn7go05rulmbvdge', '2026-11-12T19:23:15Z', 'Asunto: Subir el tope de envío de email por día (hoy limitado a 500)'),
  lote('3B62C3A6EAE4D318FCD6', 'cmwf8ipdjmn7fo05rtjixtnzm', '2026-11-12T19:28:51Z', 'Mako me confirmas que esta conectado y llegando mi solicitud ?'),
  lote('3BE0210B53EADBCD2A08', 'cmwf8ipdjmn7eo05ro9kkuwap', '2026-11-12T20:21:57Z', 'alguna respuesta ?'),
  lote('2AB34FBF25628F530DF5', 'cmwf8ipdjmn7do05ricro531r', '2026-11-13T15:54:05Z', null),
  lote('3BE0B711A755D03C983C', 'cmwf8ipdjmn7co05rl7k1ikle', '2026-11-13T15:58:01Z', 'Los envios por correo son muy importantes apra el seguimiento de los leads'),
  lote('3BCB793D4ADA6C2873DD', 'cmwf8ipdjmn7bo05rmq0zms8z', '2026-11-13T15:59:10Z', 'Por ejemplo de los 67 nuevos leads, cuantos les enviamos ya correo, cuantos lo abrieron ?'),
  lote('3B0FE5CFF78DC80AB57E', 'cmwf8ipdjmn7ao05rw3ykwmt0', '2026-11-13T15:59:48Z', 'No tenemos una forma de darle seguimiento a los leads que no sea por correo'),
  // La copia de lo que mandó la propia línea, que el historial también trae.
  { id: 'cmwf8ipdkmn7io05rpfcymo0z', key: { id: '3EB024C8C2CA6B8F39C154', fromMe: true, remoteJid: JID }, pushName: 'Você', messageType: 'conversation', message: { conversation: '━━ 🔧 SISTEMA ━━' }, messageTimestamp: S('2026-11-12T02:50:43Z') },
];
// Lo que el webhook vio de ese grupo: el de las 05:44 (está en `grupo_mensajes`, lo escribió el espejo a las 11:47).
const VISTOS = new Set(['3B38BD8EE406794AB38A']);
const LOS_SEIS = ['3B200FF84805DFDAFC70', '3B62C3A6EAE4D318FCD6', '3BE0210B53EADBCD2A08', '3BE0B711A755D03C983C', '3BCB793D4ADA6C2873DD', '3B0FE5CFF78DC80AB57E'];

test('1. la hora de guardado sale del id: un cuid de Prisma, comprobado contra un createdAt real', () => {
  const ahora = Date.parse('2026-11-13T18:40:00Z');
  // El webhook del …2605: id cmwbivfnni3i3o05rva2c0yj9, createdAt 2026-11-11T02:51:12.515Z (GET /webhook/find, 13/11).
  assert.equal(new Date(horaDeGuardado('cmwbivfnni3i3o05rva2c0yj9', ahora)!).toISOString(), '2026-11-11T02:51:12.515Z');
  // El lote del historial de Mauricio en el …2605 y en el …3479.
  assert.equal(new Date(horaDeGuardado('cmwf8ipdjmn7co05rl7k1ikle', ahora)!).toISOString(), '2026-11-13T17:12:27.127Z');
  assert.equal(new Date(horaDeGuardado('cmwf8k7ejmor7o05r8nosti47', ahora)!).toISOString(), '2026-11-13T17:13:37.147Z');
  for (const x of ['3EB0912C23F04F40C74A3B', 'fc595603-3f12-466d-8771-f94dd308a29f', '', undefined, 'czzzzzzzzzzzzzzzzzzzzzzzz', 'c00000001abcdo05rl7k1ikle']) assert.equal(horaDeGuardado(x, ahora), null, String(x));
});

test('2. qué se rescata del store real: lo de Mauricio que el historial trajo, con su autor, en orden, y nada más', () => {
  // La primera vuelta del cron después de la re-vinculación (17:12:27).
  const a = queRescatar(STORE, { ahora: Date.parse('2026-11-13T17:20:00Z'), vistos: VISTOS });
  assert.deepEqual(a.map((m) => m.key?.id), LOS_SEIS,
    'el protocolo, la copia de MaKo (fromMe) y la segunda fila de lo que ya vio el webhook no; el orden es el de WhatsApp');
  for (const m of a) {
    assert.equal(m.key?.participant, '209130681839667@lid', 'el autor sale del @lid que el historial dejó como pushName');
    assert.equal(m.pushName, 'Mauricio Bustos Eguía', 'el nombre, de la fila que sí llegó por el webhook; nunca el número');
  }
  // Sin una fila con nombre, sin nombre: el número del @lid no se muestra como si fuera uno.
  assert.deepEqual(queRescatar(STORE.slice(1), { ahora: Date.parse('2026-11-13T17:20:00Z'), vistos: VISTOS }).map((m) => m.pushName), Array(6).fill(undefined));
  // Una hora después del guardado ya no es «hace poco»: el despliegue de las 18:40 no vuelve a tocar lo que contestó el equipo.
  assert.deepEqual(queRescatar(STORE, { ahora: Date.parse('2026-11-13T18:40:00Z'), vistos: VISTOS }), []);
  assert.equal(RECIENTE_MS, 60 * 60_000);
  // Recién guardado (menos de RESPIRO_MS): se le deja el lugar al webhook.
  assert.deepEqual(queRescatar(STORE, { ahora: Date.parse('2026-11-13T17:13:30Z'), vistos: VISTOS }), [], 'guardado hace 63 s');
  assert.equal(RESPIRO_MS, 3 * 60_000);
  // Todo visto: nada.
  assert.deepEqual(queRescatar(STORE, { ahora: Date.parse('2026-11-13T17:20:00Z'), vistos: new Set(STORE.map((m) => m.key?.id ?? '')) }), []);
  // Un id que no es cuid: la hora de WhatsApp, con un día de ventana (a las 19:30 del 13/11, lo de antes de las 19:30 del 12/11 no).
  const sinCuid = STORE.map((m) => ({ ...m, id: 'x' }));
  assert.deepEqual(queRescatar(sinCuid, { ahora: Date.parse('2026-11-13T19:30:00Z'), vistos: VISTOS }).map((m) => m.key?.id), LOS_SEIS.slice(2));
  // Lo que se lee: la regla del espejo.
  assert.equal(tieneContenido({ conversation: 'hola' }), true);
  assert.equal(tieneContenido({ extendedTextMessage: { text: 'hola' } }), true);
  assert.equal(tieneContenido({ audioMessage: {} }), true);
  for (const m of [{ protocolMessage: {}, messageContextInfo: {} }, { reactionMessage: { text: '👍' } }, { conversation: '  ' }, {}, null]) assert.equal(tieneContenido(m as never), false, JSON.stringify(m));
});

let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  if (fallo) throw fallo;
  try {
    const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_rescate-del-store-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
    return corrida;
  } catch (e) { fallo = e; throw e; }
}

test('3a. la vuelta del cron: lo de 74 min a la cola (sin turno), lo de 22 h a SuperAdmin, todo al hilo de la app', () => {
  const p = R().primera;
  assert.deepEqual(p.cola.map((c: any) => c.id), ['3BE0B711A755D03C983C', '3BCB793D4ADA6C2873DD'], JSON.stringify(p.r));
  for (const c of p.cola) {
    assert.equal(c.estado, 'pendiente', 'lo contesta doer-flush, no el cron que rescata');
    assert.equal(c.participant, '209130681839667@lid');
    assert.equal(c.nombre, 'Mauricio Bustos Eguía');
    assert.equal(c.instancia, 'mako_superadmin_muylqv8r', 'con la línea: el cron que destraba la cola la necesita');
  }
  assert.equal(p.modelo, 0, 'el cron que rescata no corre el turno');
  assert.deepEqual(p.alGrupo, [], 'nada al grupo todavía');
  assert.equal(p.superAdmin.length, 3, JSON.stringify(p.superAdmin));
  assert.match(p.superAdmin[0], /^📨 WhatsApp entregó con 22 h de atraso un mensaje de Mauricio Bustos Eguía en el grupo de Mauricio Bustos \(ws1\):\n«Asunto: Subir el tope/);
  assert.match(p.superAdmin[1], /«Mako me confirmas que esta conectado/);
  assert.match(p.superAdmin[2], /con 21 h de atraso .*\n«alguna respuesta \?»/);
  assert.deepEqual(p.hilo.map((h: any) => h.wa), ['3B38BD8EE406794AB38A', '3B200FF84805DFDAFC70', '3B62C3A6EAE4D318FCD6', '3BE0210B53EADBCD2A08', '3BE0B711A755D03C983C', '3BCB793D4ADA6C2873DD'],
    'lo rescatado se ve en la app; la segunda fila del de las 05:44 no (ya estaba)');
  for (const h of p.hilo) assert.deepEqual([h.autor, h.canal, h.nombre], ['persona', 'whatsapp', 'Mauricio Bustos Eguía']);
  assert.deepEqual(p.r.rescatados.map((x: any) => x.r), ['llegó tarde (22 h)', 'llegó tarde (22 h)', 'llegó tarde (21 h)', 'rescatado del store: en la cola', 'rescatado del store: en la cola']);
});

test('3b. la vuelta siguiente no repite nada: ni la cola, ni el hilo, ni el aviso', () => {
  const s = R().segunda;
  assert.deepEqual(s.r.rescatados, []);
  assert.deepEqual([s.superAdmin, s.colaN, s.hiloN], [0, 2, 6]);
});

test('3c. doer-flush le contesta a Mauricio UNA vez, con los dos mensajes en el mismo turno', () => {
  const f = R().flush;
  assert.equal(f.r.procesados, 1, JSON.stringify(f));
  assert.deepEqual(f.alGrupo, ['Mauricio, ya veo lo de tus correos.']);
  assert.equal(f.llamadas, 1);
  assert.match(f.leyo, /Los envios por correo son muy importantes/);
  assert.match(f.leyo, /de los 67 nuevos leads/);
  assert.deepEqual(f.cola.map((c: any) => c.estado), ['procesado', 'procesado']);
});

test('4. el cableado: corre en alerta-critica, y `soloEncolar` corta antes del candado y del turno', () => {
  const cron = sinComentarios(leer('app/api/cron/alerta-critica/route.ts'));
  assert.match(cron, /import \{ rescatarDelStore \} from '@\/lib\/mako-doer-in'/);
  assert.match(cron, /await rescatarDelStore\(\)\.catch\(/, 'nunca tira: el resto de la guardia corre igual');
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const buffer = doer.slice(doer.indexOf('async function bufferearYResponder('));
  const corte = buffer.indexOf('if (o.soloEncolar)');
  assert.ok(corte > 0 && corte > buffer.indexOf('await encolar(jid,') && corte < buffer.indexOf('await reclamar(jid, quien)'), 'encola, y corta antes de ganar el candado');
  const entrada = doer.slice(doer.indexOf('async function atenderEntranteDoer('), doer.indexOf('export async function rescatarDelStore('));
  assert.ok(entrada.indexOf('llegoTarde(') < entrada.indexOf('bufferearYResponder(') && /soloEncolar: o\.soloEncolar/.test(entrada), 'por las mismas puertas que la entrada');
});

// ── Probado rompiéndolo (13/11/2026, una rotura por vez, restaurada) ──────────────────────────────────────────────────────────
// · Sin `rescatarDelStore` en el cron ni en el doer (el código de antes): el hijo no arranca (no existe) y el 4 cae.
// · `queRescatar` con la hora de WhatsApp en vez de la de guardado: el 2 cae («una hora después» vuelve a dar los seis).
// · Sin `vistos` (el hilo y la cola): caen el 3a (la segunda fila del de las 05:44 se avisa como atrasada) y el 3b (la segunda
//   vuelta vuelve a avisar).
// · `soloEncolar` sin cortar (sigue al candado): caen el 3a, el 3b, el 3c y el 4 (el cron corre el turno y contesta él).
// · El espejo ANTES de la cola: sin cambio en el verde (orden, comentado en el código), por eso no se fija acá.
