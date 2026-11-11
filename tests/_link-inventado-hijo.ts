// =============================================================================
// Hijo de tests/links-con-ws.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El TURNO real del grupo (`manejarEntranteDoer`: la cola, el candado, el turno) con un modelo de mentira que escribe el link
// con el dominio inventado del 28/10/2026 («hola-malo.com/crm/2761», a Código Inmobiliario). Lo que sale a Evolution y lo que
// queda en la memoria se ANOTAN. La base, un PostgREST de mentira con el candado.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

// El turno NO espera el reloj: la ventana de silencio de verdad (8-20 s por escena, y acá son varias) hacía que este
// archivo tardara MINUTOS y el vigía de tandas de tests-afectados matara la tanda entera con 99 — ver
// lib/mako-doer-buffer.ts, «EL RELOJ DE LA VENTANA». El lote se junta igual: ya está en la cola cuando el turno espera.
process.env.MAKO_DOER_VENTANA_MS = '0';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

const JID = '120363000000000013@g.us';
const WS = 13;
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage',
    'errores_app', 'tickets', 'tickets_eventos', 'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...(t === 'mako_doer_buffer' ? { estado: 'pendiente', workspace_id: WS } : {}), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
  candado: true,
});
// Con el voseo que le salió a Joan el 11/11 («¿Querés que…?»): lo que MaKo escribe sale en tú (lib/al-tuteo.ts).
const DIJO = 'Aquí está la ficha: hola-malo.com/crm/2761. Conecta Meta en https://www.holamako.com/integraciones y mira el local en google.com/maps. ¿Querés que la revise?';
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test') return r(200, { key: { id: `env-${red.length}` } });
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) {
    return r(200, { id: 'c1', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: DIJO }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Código Inmobiliario' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID });
  const { cifrarSecreto } = await import('../lib/credenciales');
  const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;
  pg.db.credenciales.push({ workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, WS, 'OPENAI_API_KEY'), servicio: 'openai' });
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');
  const r = await manejarEntranteDoer('mako-voz', { key: { remoteJid: JID, id: 'JO-1', participant: '5491100000013@s.whatsapp.net' }, message: { conversation: 'MaKo, pásame el link de la ficha de Tomás Terra' }, pushName: 'Joan' } as never);
  const salio = red.filter((x) => x.camino.includes('/message/sendText/')).map((x) => String((JSON.parse(x.cuerpo || '{}') as { text?: string }).text ?? ''));
  const memoria = pg.db.mako_doer_conv.filter((c) => c.role === 'assistant').map((c) => String(c.content));
  process.stdout.write(`@@LINK@@${JSON.stringify({ r, salio, memoria })}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@LINK@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
