// =============================================================================
// Hijo de tests/linea-sorda.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `vigilarSorderaDeLaVoz` REAL (lib/canal-vigilante.ts) con el 11/11/2026: la voz (`mako_superadmin_muylqv8r`, vinculada con el QR de
// las 02:51:07) MANDA (14:03 y 14:07 a Código, 20:39) y lo último que le llegó de una persona es de las 12:14 (Patricia, ws22). Cada
// envío está dos veces en el store, como lo guarda Evolution. Evolution, Resend y la base son de mentira; lo que sale a la red se
// ANOTA. Corridas: antes de los envíos (13:30), la ráfaga (14:10), 10 min después, a las 3 h, cuando vuelve a entrar una persona, y
// tras re-vincularla (21:50:20) con la tarde sin nadie que escriba.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.RESEND_API_KEY = 're_de_prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';

const VOZ = 'mako_superadmin_muylqv8r';
const NUM_VOZ = '5491125052605';
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'notificaciones', 'evolution_instancias', 'notif_destinatarios', 'usuarios', 'workspace_miembros'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const S = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const propio = (id: string, iso: string, jid: string) => ({ key: { id, fromMe: true, remoteJid: jid }, messageTimestamp: S(iso), messageType: 'conversation', message: { conversation: 'aviso' } });
const persona = (id: string, iso: string, jid: string, quien: string) => ({ key: { id, fromMe: false, remoteJid: jid, participant: `${id}@lid`, participantAlt: '5491100000022@s.whatsapp.net' }, pushName: quien, messageTimestamp: S(iso), messageType: 'conversation', message: { conversation: 'hola' } });
const CODIGO = '120363429866357487@g.us', PATRICIA = '120363431445507386@g.us';
const storeVoz: unknown[] = [persona('P-1214', '2026-11-11T12:14:14Z', PATRICIA, 'Patricia'),
  propio('M-1403', '2026-11-11T14:03:34Z', CODIGO), propio('M-1403', '2026-11-11T14:03:34Z', CODIGO),
  propio('M-1407', '2026-11-11T14:07:52Z', CODIGO), propio('M-1407', '2026-11-11T14:07:52Z', CODIGO),
  propio('M-2039', '2026-11-11T20:39:01Z', CODIGO), propio('M-2039', '2026-11-11T20:39:01Z', CODIGO)];
const storeOtra: unknown[] = [];
let ahoraDeLaPrueba = 0;
const vinculo ={ createdAt: '2026-11-11T02:51:07.000Z', disconnectionAt: '2026-11-11T02:40:30.000Z' };
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test' && u.pathname.includes('/instance/fetchInstances')) return r(200, [{ name: VOZ, ownerJid: `${NUM_VOZ}@s.whatsapp.net`, connectionStatus: 'open', ...vinculo }]);
  // El store guarda lo que ya pasó: lo de después de «ahora» todavía no existe.
  if (u.host === 'evolution.test' && u.pathname.includes(`/chat/findMessages/${VOZ}`)) return r(200, { messages: { records: storeVoz.filter((m) => (m as { messageTimestamp: number }).messageTimestamp * 1000 <= ahoraDeLaPrueba) } });
  // La línea de Martín (`mako_ws9`): vacía (sorda también) salvo en la escena del 13/11, la de sus grupos personales.
  if (u.host === 'evolution.test' && u.pathname.includes('/chat/findMessages/')) return r(200, { messages: { records: storeOtra.filter((m) => (m as { messageTimestamp: number }).messageTimestamp * 1000 <= ahoraDeLaPrueba) } });
  if (u.host === 'evolution.test') return r(200, { instance: { state: 'open' } });
  if (u.host === 'api.resend.com') return r(200, { id: `mail-${red.length}` });
  return r(500, { error: 'red de mentira' });
}) as typeof fetch;

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push({ workspace_id: 1, key: 'mako.voz.instancia', value: VOZ });
  pg.db.evolution_instancias.push({ id: ++n, workspace_id: 9, instance_name: 'mako_ws9', es_default: true });
  const { vigilarSorderaDeLaVoz } = await import('../lib/canal-vigilante');
  const out: Record<string, unknown> = {};
  const corrida = async (k: string, iso: string) => {
    red.splice(0);
    ahoraDeLaPrueba = Date.parse(iso);
    const r = await vigilarSorderaDeLaVoz(ahoraDeLaPrueba);
    out[k] = {
      r,
      reinicios: red.filter((x) => x.camino.includes('/instance/restart/')).length,
      mails: red.filter((x) => x.host === 'api.resend.com').map((x) => String((JSON.parse(x.cuerpo || '{}') as { subject?: string }).subject ?? '')),
      whatsapp: red.filter((x) => x.camino.includes('/message/send')).length,
      campanita: pg.db.notificaciones.map((f) => String(f.titulo)),
      marca: pg.db.app_settings.find((s) => s.key === 'mako.voz.sorda')?.value ?? null,
    };
  };
  await corrida('antes', '2026-11-11T13:30:00Z');     // 1 h 16 min sin una persona y sin envíos: nada
  await corrida('sorda', '2026-11-11T14:10:00Z');     // la ráfaga: 2 a Código y no entró nada → avisa con el QR
  await corrida('diezMin', '2026-11-11T14:20:00Z');   // sigue: nada (no repite)
  await corrida('tresHoras', '2026-11-11T17:10:00Z'); // a las 3 h sigue sorda: el QR otra vez
  storeVoz.push(persona('J-2200', '2026-11-11T22:00:00Z', CODIGO, 'Joan Dowd'));
  await corrida('volvio', '2026-11-11T22:05:00Z');    // entró una persona: se cierra y se avisa
  // Re-vinculada a las 21:50:20 (Martín cerró la sesión desde el teléfono y escaneó), y sin Joan: lo de la tarde es del otro dispositivo.
  storeVoz.pop();
  vinculo.disconnectionAt = '2026-11-11T21:50:20.391Z';
  await corrida('reVinculada', '2026-11-11T23:30:00Z');
  // ── La noche del 12/11 (lo que pasó de verdad): Mauricio escribió a las 00:40 UTC (21:40 de Argentina), MaKo mandó a la 01:04, 02:50 y
  // 03:31 (avisos de los crons), y desde ahí no entró nada: el mensaje de Mauricio de las 05:44 no llegó. La regla de las 3 h recién
  // podía decidir a las 03:40 UTC, de noche. Va después de todo y sobre la misma vinculación (21:50:20). ──
  const noche: Record<string, unknown> = {};
  const MAURICIO = '120363421096661065@g.us';
  storeVoz.push(persona('MB-0040', '2026-11-12T00:40:48Z', MAURICIO, 'Mauricio Bustos Eguía'), propio('MK-0104', '2026-11-12T01:04:00Z', MAURICIO),
    propio('MK-0250', '2026-11-12T02:50:00Z', MAURICIO), propio('MK-0331', '2026-11-12T03:31:00Z', CODIGO));
  const enLaNoche = async (k: string, iso: string) => { await corrida(`noche:${k}`, iso); noche[k] = out[`noche:${k}`]; delete out[`noche:${k}`]; };
  await enLaNoche('antesDeLas9', '2026-11-12T08:50:00Z'); // 05:50 de Argentina: no decide
  await enLaNoche('alas9', '2026-11-12T12:00:00Z');       // 09:00: la marca, con el QR
  await enLaNoche('alas2330', '2026-11-13T02:30:00Z');    // 23:30: fuera de horario, la marca QUEDA
  storeVoz.push(persona('MB-0544', '2026-11-12T05:44:00Z', MAURICIO, 'Mauricio Bustos Eguía')); // la tanda: llega un día tarde, con su hora
  await enLaNoche('tanda', '2026-11-13T06:00:00Z');
  storeVoz.push(persona('MB-1300', '2026-11-13T13:00:00Z', MAURICIO, 'Mauricio Bustos Eguía'));
  await enLaNoche('volvio', '2026-11-13T13:05:00Z');      // escribió alguien después de la marca: volvió
  // Marcada sobre la vinculación de las 21:50:20 y re-vinculada a las 20:00 del 13 (otro QR), sin nadie que escriba todavía: la marca es
  // de un dispositivo que ya no existe. Se limpia (el panel no soltaría la línea nueva) y sin el «volvió»: nadie lo probó.
  const fila = pg.db.app_settings.find((s) => s.key === 'mako.voz.sorda');
  if (fila) fila.value = JSON.stringify({ desde: '2026-11-13T14:00:00.000Z', avisadaAt: '2026-11-13T14:00:00.000Z', linea: VOZ, vinculadaDesde: Date.parse('2026-11-11T21:50:20.391Z'), motivo: 'x' });
  vinculo.disconnectionAt = '2026-11-13T20:00:00.000Z';
  await enLaNoche('reVinculadaConMarca', '2026-11-13T23:00:00Z');
  out.nocheDel12 = noche;
  // ── 13/11 18:20 (lo que pasó de verdad): la línea de Martín ve mensajes de sus grupos PERSONALES, donde la voz no está. No es
  // sordera. Un mensaje en un grupo de MaKo que la voz no tiene, sí. Sobre la vinculación de las 20:00 del 13, sin envíos de MaKo. ──
  const otraLinea: Record<string, unknown> = {};
  pg.db.app_settings.push({ workspace_id: 1, key: 'mako.grupo_jid', value: CODIGO }, { workspace_id: 9, key: 'mako.superadmin.grupo_jid', value: PATRICIA });
  const PERSONAL = '120363000000000001@g.us';
  storeOtra.push(persona('A1', '2026-11-13T22:10:00Z', PERSONAL, 'Amigo'), persona('A2', '2026-11-13T22:20:00Z', PERSONAL, 'Amigo'),
    persona('A3', '2026-11-13T23:00:00Z', PERSONAL, 'Amiga'));
  await corrida('otra:personales', '2026-11-13T23:30:00Z');
  otraLinea.personales = out['otra:personales']; delete out['otra:personales'];
  storeOtra.push(persona('C9', '2026-11-13T23:10:00Z', CODIGO, 'Joan Dowd'));
  await corrida('otra:deMaKo', '2026-11-13T23:30:00Z');
  otraLinea.deMaKo = out['otra:deMaKo']; delete out['otra:deMaKo'];
  out.otraLinea = otraLinea;
  process.stdout.write(`@@SORDA@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@SORDA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
