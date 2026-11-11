// =============================================================================
// Hijo de tests/linea-demora.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La entrada REAL del grupo (`manejarEntranteDoer`, lib/mako-doer-in.ts) con lo que WhatsApp entregó tarde el 10/11/2026: un
// mensaje de un día antes (el comprobante del ticket #80 volvió a entrar por otra línea), su re-entrega, uno de 78 minutos (las
// notas de Patricia) y uno sin hora. Forma REAL de Evolution v2 (`messageTimestamp` en segundos, arriba). Contra un PostgREST de
// mentira; lo que sale a Evolution se ANOTA y contesta 200.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';

const JID = '120363000000000013@g.us';
const SA = '120363000000000099@g.us';
const WS = 13;
const LINEA = 'mako_superadmin_x';
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage', 'errores_app', 'tickets', 'tickets_eventos', 'mako_acciones_pendientes'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
});
const red: Array<{ camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  return new Response(JSON.stringify({ key: { id: `env-${red.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const JOAN = '5491100000013@s.whatsapp.net';
const hace = (min: number) => Math.floor((Date.now() - min * 60_000) / 1000);

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Código Inmobiliario' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push(
    { workspace_id: WS, key: 'mako.grupo_jid', value: JID },
    { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA },
    { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: SA },
  );
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};
  const cola = () => pg.db.mako_doer_buffer.length;
  const alSuperAdmin = () => red.filter((x) => x.camino.includes('/message/sendText/') && x.cuerpo.includes(SA)).map((x) => String((JSON.parse(x.cuerpo) as { text?: string }).text ?? ''));
  const reacciones = () => red.filter((x) => x.camino.includes('/message/sendReaction/')).length;
  const de = (id: string, texto: string, ts?: number, linea = LINEA) => manejarEntranteDoer(linea, { key: { remoteJid: JID, id, participant: JOAN }, message: { conversation: texto }, pushName: 'Joan', ...(ts ? { messageTimestamp: ts } : {}) } as never);
  const paso = async (k: string, f: () => Promise<unknown>) => {
    red.splice(0);
    const antes = cola();
    const r = await f();
    out[k] = { r, entro: cola() > antes, superAdmin: alSuperAdmin(), reacciones: reacciones() };
  };

  // 1. Un día de atraso (el #80): no se atiende; va a SuperAdmin.
  await paso('unDia', () => de('JO-1', 'Mako te mando el comprobante de la entrada de Patricia', hace(1416)));
  // 2. La re-entrega del mismo por la OTRA línea del grupo: ni otro aviso ni a la cola.
  await paso('reentrega', () => de('JO-1', 'Mako te mando el comprobante de la entrada de Patricia', hace(1416), 'mako_ws9'));
  // 3. 78 minutos (las notas de Patricia): llega tarde, pero se atiende.
  await paso('unaHora', () => de('JO-2', 'Mako, agrega una nota al lead Beatriz Reyero: PH en Flores, no respondió', hace(78)));
  // 4. Sin hora (un payload sin messageTimestamp): nunca se frena por no saber.
  await paso('sinHora', () => de('JO-3', 'Mako, ¿cuántos leads entraron hoy?'));
  process.stdout.write(`@@DEMORA@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@DEMORA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
