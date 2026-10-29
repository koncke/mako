// =============================================================================
// Hijo de tests/audio-citado.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El TURNO real con una nota de voz citada que WhatsApp ya no entrega (la verificación de 5b7a1917d): la entrada del grupo
// (`manejarEntranteDoer`, el camino suelto: un mensaje, la cola, el candado, el turno) y el lote del cron (`flushHuerfanos`, dos
// mensajes). El payload es el de Leandro (ws10, 28/10/2026) en la forma REAL de Evolution v2, con un pedido al lado. Evolution
// no tiene el audio (404); lo demás que sale a la red se ANOTA. La base, un PostgREST de mentira con el candado.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
process.env.GROQ_API_KEY = `gsk_${'p'.repeat(48)}`;
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];

const JID = '120363000000000010@g.us';
const WS = 10;
const LINEA = 'mako-voz';
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage',
    'errores_app', 'tickets', 'tickets_eventos', 'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'no_pude', 'mako_turnos'],
  defaults: (t, f) => ({ id: ++n, created_at: new Date(Date.now() - (t === 'mako_doer_buffer' ? 300_000 : 0)).toISOString(), ...(t === 'mako_doer_buffer' ? { estado: 'pendiente', workspace_id: WS } : {}), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
  candado: true,
});
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test' && u.pathname.includes('getBase64FromMediaMessage')) return r(404, { error: 'no está' });
  if (u.host === 'evolution.test') return r(200, { key: { id: `env-${red.length}` } });
  // La IA del negocio (su GPT): contesta el turno.
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) {
    return r(200, { id: 'c1', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: '¿El pago de Fabi Pedraza fue por transferencia o en efectivo?' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const LEANDRO = '5491100000010@s.whatsapp.net';
const PEDIDO = 'No me respondiste lo de este audio. Y cárgame el pago de hoy de Fabi Pedraza, 423 MXN';
const conAudio = (id: string, texto: string) => ({
  key: { remoteJid: JID, id, participant: LEANDRO },
  message: { conversation: texto },
  contextInfo: { stanzaId: '2A81E060BE438F478D26', participant: LEANDRO, quotedMessage: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 94, ptt: true } } },
  pushName: 'Leandro',
});

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Leandro' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID });
  const { cifrarSecreto } = await import('../lib/credenciales');
  const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;
  pg.db.credenciales.push({ workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, WS, 'OPENAI_API_KEY'), servicio: 'openai' });
  const { manejarEntranteDoer, flushHuerfanos } = await import('../lib/mako-doer-in');
  const textos = () => red.filter((x) => x.camino.includes('/message/sendText/')).map((x) => String((JSON.parse(x.cuerpo || '{}') as { text?: string }).text ?? ''));
  const out: Record<string, unknown> = {};
  /** Lo último que le llegó al modelo de quien escribe, en cada llamada del turno. */
  const alModelo = () => red.filter((x) => x.host === 'api.openai.com').map((x) => {
    const ms = (JSON.parse(x.cuerpo) as { messages: Array<{ role: string; content: unknown }> }).messages.filter((m) => m.role === 'user');
    const c = ms[ms.length - 1]?.content;
    return typeof c === 'string' ? c : JSON.stringify(c);
  });

  // 1. El camino SUELTO: un mensaje que cita la nota de voz que Evolution ya no tiene, con un pedido al lado.
  out.suelto = await manejarEntranteDoer(LINEA, conAudio('LE-1', PEDIDO) as never);
  out.sueltoTextos = textos();
  out.sueltoIA = alModelo();
  out.sueltoRed = red.splice(0).map((x) => `${x.host}${x.camino}`);
  out.sueltoTickets = pg.db.tickets.map((t) => ({ ...t }));
  out.sueltoNoPude = pg.db.errores_app.map((t) => ({ ...t }));
  out.sueltoAyuda = pg.db.app_settings.filter((s) => /ayuda/i.test(String(s.key))).map((s) => s.key);
  out.sueltoConv = pg.db.mako_doer_conv.map((c) => ({ role: c.role, content: c.content }));

  // 2. El LOTE del cron: dos mensajes huérfanos; el primero cita la nota de voz (sin audio), el segundo es texto.
  pg.db.tickets.splice(0); pg.db.errores_app.splice(0); pg.db.mako_doer_conv.splice(0);
  pg.db.mako_doer_buffer.push(
    { id: ++n, workspace_id: WS, grupo_jid: JID, wa_message_id: 'LE-2', texto: 'No me respondiste lo de este audio', estado: 'pendiente', payload: { ...conAudio('LE-2', 'No me respondiste lo de este audio'), instance: LINEA }, created_at: new Date(Date.now() - 300_000).toISOString() },
    { id: ++n, workspace_id: WS, grupo_jid: JID, wa_message_id: 'LE-3', texto: 'y cárgame el pago de hoy de Fabi Pedraza, 423 MXN', estado: 'pendiente', payload: { key: { remoteJid: JID, id: 'LE-3', participant: LEANDRO }, message: { conversation: 'y cárgame el pago de hoy de Fabi Pedraza, 423 MXN' }, pushName: 'Leandro', instance: LINEA }, created_at: new Date(Date.now() - 290_000).toISOString() },
  );
  pg.db.mako_doer_lock.splice(0);
  out.lote = await flushHuerfanos();
  out.loteTextos = textos();
  out.loteIA = alModelo();
  out.loteRed = red.splice(0).map((x) => `${x.host}${x.camino}`);
  out.loteTickets = pg.db.tickets.map((t) => ({ ...t }));
  out.loteConv = pg.db.mako_doer_conv.map((c) => ({ role: c.role, content: c.content }));
  process.stdout.write(`@@TURNO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@TURNO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
