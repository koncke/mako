// =============================================================================
// Hijo de tests/respuesta-al-equipo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La entrada REAL del grupo (`manejarEntranteDoer`, lib/mako-doer-in.ts) con el caso de Leila (ws11, 28/10/2026), contra un
// PostgREST de mentira. Todo lo que sale a Evolution se ANOTA (la reacción, lo que se manda) y contesta 200.
//   A. el equipo pregunta por la línea de MaKo (el eco, firmado): entra al anillo del equipo;
//   B. Leila le contesta CITÁNDOLO: no es para MaKo (sin 👍, sin cola) y queda para el equipo;
//   C. lo mismo sin citar, dentro de la ventana: igual;
//   D. «mako, …» después de la pregunta del equipo: es para MaKo;
//   E. de control: MaKo ya habló después de la pregunta, y un mensaje sin nombrarla es para MaKo.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';

const JID = '120363000000000011@g.us';
const SA = '120363000000000099@g.us';
const WS = 11;
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

const LEILA = '5215500000000@s.whatsapp.net';
const RESPUESTA = 'Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000';

async function main() {
  const { FIRMA_DESARROLLADOR } = await import('../lib/aviso-arreglo-reglas');
  const PREGUNTA = `${FIRMA_DESARROLLADOR}\nLeila, para cargar el plan de Nadia: ¿cuántas quincenas eran y en qué moneda?`;
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Leila' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push(
    { workspace_id: WS, key: 'mako.grupo_jid', value: JID },
    { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA },
    { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: SA },
  );
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};
  const cola = () => pg.db.mako_doer_buffer.map((f) => String(f.wa_message_id));
  const reacciones = () => red.filter((x) => x.camino.includes('/message/sendReaction/')).length;
  const alSuperAdmin = () => red.filter((x) => x.camino.includes('/message/sendText/') && x.cuerpo.includes(SA)).map((x) => (JSON.parse(x.cuerpo) as { text: string }).text);
  const anillo = () => {
    const f = pg.db.app_settings.find((x) => x.workspace_id === WS && x.key === 'mako.equipo.grupo');
    return f ? (JSON.parse(String(f.value)) as Array<{ id?: string; texto: string }>).map((x) => x.id) : [];
  };

  // A. El equipo pregunta por la línea de MaKo: vuelve como eco, firmado.
  out.a = await manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id: 'EQ-1', fromMe: true }, message: { conversation: PREGUNTA } } as never);
  out.anillo = anillo();

  // B. Leila le contesta CITÁNDOLO.
  red.splice(0);
  out.b = await manejarEntranteDoer(LINEA, {
    key: { remoteJid: JID, id: 'LE-1', participant: LEILA },
    message: { extendedTextMessage: { text: RESPUESTA, contextInfo: { stanzaId: 'EQ-1', participant: LEILA, quotedMessage: { conversation: PREGUNTA } } } },
    pushName: 'Leila',
  } as never);
  out.bReacciones = reacciones();
  out.bCola = cola();
  out.bSuperAdmin = alSuperAdmin();

  // C. Lo mismo, sin citar, dentro de la ventana.
  red.splice(0);
  out.c = await manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id: 'LE-2', participant: LEILA }, message: { conversation: RESPUESTA }, pushName: 'Leila' } as never);
  out.cReacciones = reacciones();
  out.cCola = cola();
  out.cSuperAdmin = alSuperAdmin();

  // D. «mako, …» después de la pregunta del equipo: es para MaKo.
  red.splice(0);
  out.d = await manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id: 'LE-3', participant: LEILA }, message: { conversation: 'mako, ¿cuántos leads entraron hoy?' }, pushName: 'Leila' } as never);
  out.dCola = cola();

  // E. De control: MaKo habló DESPUÉS de la pregunta del equipo; un mensaje sin nombrarla es para MaKo.
  pg.db.mako_doer_conv.push({ id: ++n, workspace_id: WS, grupo_jid: JID, role: 'assistant', content: 'Hoy entraron 4 leads.', created_at: new Date(Date.now() + 1000).toISOString() });
  red.splice(0);
  out.e = await manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id: 'LE-4', participant: LEILA }, message: { conversation: 'y cuánto llevo cobrado de Nadia?' }, pushName: 'Leila' } as never);
  out.eCola = cola();
  process.stdout.write(`@@EQUIPO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@EQUIPO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
