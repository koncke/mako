// =============================================================================
// Hijo de tests/linea-sorda.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `vigilarSorderaDeLaVoz` REAL (lib/canal-vigilante.ts) con el 11/11/2026: la voz (`mako_superadmin_muylqv8r`) MANDA (avisos a las
// 14:03, 14:07 y 20:39 UTC) y lo último que le llegó de una persona es de las 12:14 (Patricia, ws22). Evolution, Resend y la base son de
// mentira; lo que sale a la red se ANOTA. Cuatro corridas: la sordera (15:20), 10 min después, a los 20 min del reinicio, y cuando
// vuelve a entrar un mensaje de una persona.
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
// La voz del 11/11: lo último de una persona a las 12:14 y MaKo mandando después.
const storeVoz: unknown[] = [persona('P-1214', '2026-11-11T12:14:14Z', PATRICIA, 'Patricia'), propio('M-1403', '2026-11-11T14:03:34Z', CODIGO), propio('M-1407', '2026-11-11T14:07:52Z', CODIGO), propio('M-2039', '2026-11-11T20:39:01Z', CODIGO)];
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test' && u.pathname.includes('/instance/fetchInstances')) return r(200, [{ name: VOZ, ownerJid: `${NUM_VOZ}@s.whatsapp.net` }]);
  if (u.host === 'evolution.test' && u.pathname.includes(`/chat/findMessages/${VOZ}`)) return r(200, { messages: { records: storeVoz } });
  if (u.host === 'evolution.test' && u.pathname.includes('/chat/findMessages/')) return r(200, { messages: { records: [] } }); // la línea de Martín, sorda también
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
    const r = await vigilarSorderaDeLaVoz(Date.parse(iso));
    out[k] = {
      r,
      reinicios: red.filter((x) => x.camino.includes('/instance/restart/')).map((x) => x.camino),
      mails: red.filter((x) => x.host === 'api.resend.com').map((x) => String((JSON.parse(x.cuerpo || '{}') as { subject?: string }).subject ?? '')),
      whatsapp: red.filter((x) => x.camino.includes('/message/send')).length,
      campanita: pg.db.notificaciones.map((f) => String(f.titulo)),
      marca: pg.db.app_settings.find((s) => s.key === 'mako.voz.sorda')?.value ?? null,
    };
  };
  await corrida('antes', '2026-11-11T14:10:00Z');   // 1 h 56 min sin una persona: todavía no
  await corrida('sorda', '2026-11-11T15:20:00Z');   // 3 h 6 min: sorda → reinicia y avisa con el QR
  await corrida('diezMin', '2026-11-11T15:30:00Z'); // sigue: nada (el reinicio puede tardar)
  await corrida('veinteMin', '2026-11-11T15:41:00Z'); // a los 20 min sigue sorda: el QR otra vez
  storeVoz.push(persona('J-2200', '2026-11-11T22:00:00Z', CODIGO, 'Joan Dowd'));
  await corrida('volvio', '2026-11-11T22:05:00Z');  // entró una persona: se cierra y se avisa
  process.stdout.write(`@@SORDA@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@SORDA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
