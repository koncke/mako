// =============================================================================
// Hijo de tests/hilo-del-superadmin.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El caso REAL del 11/11/2026 en el grupo «MaKo · SuperAdmin», en orden y por la entrada real:
//   20:18 ART  MaKo (un cron, `avisarAMartin`): el comprobante de Código Inmobiliario para revisar.
//   20:25      Martín: «Si perfecto, dalo de alta».
//   20:26      Martín: «Y dime cuanto va a pagar codigo inmobiliario el mes entrante con todos los clientes».
// Lo que corre de verdad: `avisarAMartin` → `enviarAlGrupoSuperAdmin` (con su memoria), y `manejarEntranteDoer` → la cola, el
// candado, el clasificador y el turno. Los modelos son de mentira: el clasificador contesta la clase que dio Haiku esa noche, y del
// turno se ANOTA lo que le llega (el historial, el system y las herramientas). La base, un PostgREST de mentira con el candado.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.MAKO_DOER_VENTANA_MS = '0';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.EVOLUTION_WEBHOOK_SECRET = 'secreto-del-webhook';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
process.env.RESEND_API_KEY = 're_de_prueba';
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'MAKO_EQUIPO_NOMBRES', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4']) delete process.env[k];

const SA = '120363413270045136@g.us';
const VOZ = 'mako_superadmin_x';
const PLATAFORMA = 9;
const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;
const MARTIN = '5493764673479@s.whatsapp.net';
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage', 'errores_app', 'tickets',
    'tickets_eventos', 'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'agencia_clientes', 'agencias', 'notificaciones', 'grupo_mensajes', 'grupo_invitados',
    'usuarios', 'workspace_miembros', 'notif_destinatarios', 'evolution_instancias', 'insistencias'],
  defaults: (t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...(t === 'mako_doer_buffer' ? { estado: 'pendiente' } : {}), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
  candado: true,
});
let clase = '';
const CODIGO = '120363429866357487@g.us';
const JOAN = '5491100000013@s.whatsapp.net';
/** El chat de cada grupo como lo guardó la línea (el store de Evolution). */
const storeDe: Record<string, unknown[]> = {};
const S = (msAtras: number) => Math.floor((Date.now() - msAtras) / 1000);
const deMaKo = (id: string, texto: string, msAtras: number, jid: string) => ({ key: { id, fromMe: true, remoteJid: jid }, messageTimestamp: S(msAtras), messageType: 'conversation', message: { conversation: texto }, source: 'web' });
/** Lo que contesta el turno de mentira: lo que haría MaKo con el contexto (una pregunta concreta, nunca «¿a quién le doy de alta?»). */
let respuesta = 'Listo.';
const alTurno: Array<{ system: string; mensajes: string; tools: string[] }> = [];
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const cuerpo = typeof init.body === 'string' ? init.body : '';
  red.push({ host: u.host, camino: u.pathname, cuerpo });
  // El store de la línea (`chatDelGrupo`): lo que la escena puso para ese grupo, con los fromMe.
  if (u.host === 'evolution.test' && u.pathname.startsWith('/chat/findMessages/')) {
    const jid = String((JSON.parse(cuerpo || '{}') as { where?: { key?: { remoteJid?: string } } }).where?.key?.remoteJid ?? '');
    return json(200, { messages: { records: storeDe[jid] ?? [] } });
  }
  if (u.host === 'evolution.test') return json(200, { key: { id: `env-${red.length}` } });
  if (u.host === 'api.resend.com') return json(200, { id: `mail-${red.length}` });
  if (u.host === 'api.anthropic.com') {
    const b = JSON.parse(cuerpo || '{}') as { system?: unknown; messages?: Array<{ role: string; content: unknown }>; tools?: Array<{ name?: string }> };
    // El system llega como texto o, con la caché de prompt (lib/anthropic.ts), como bloques.
    const system = typeof b.system === 'string' ? b.system : Array.isArray(b.system) ? (b.system as Array<{ text?: string }>).map((x) => x.text ?? '').join('\n') : '';
    // El clasificador se reconoce por su formato de salida (lib/mako-intencion-ia.ts, SYSTEM_DE_CLASE).
    if (system.includes('{"clase":"PREGUNTA|ACCION')) return json(200, { id: 'm0', type: 'message', role: 'assistant', model: 'claude-haiku-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: clase }], usage: { input_tokens: 9, output_tokens: 9 } });
    alTurno.push({ system, mensajes: (b.messages ?? []).map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n---\n'), tools: (b.tools ?? []).map((t) => String(t.name ?? '')) });
    return json(200, { id: 'm1', type: 'message', role: 'assistant', model: 'claude-haiku-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: respuesta }], usage: { input_tokens: 9, output_tokens: 9 } });
  }
  return json(500, { error: { message: `red de mentira: ${u.href}` } });
}) as typeof fetch;

async function main() {
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' },
    { id: 13, capa: 'agencia', nombre: 'Código Inmobiliario', estado: 'activo' }, { id: 31, capa: 'cliente', nombre: 'Giselle', estado: 'activo' },
    { id: 32, capa: 'cliente', nombre: 'Pablo Chavez', estado: 'activo' }, { id: 33, capa: 'cliente', nombre: 'Marcela', estado: 'activo' },
    { id: 34, capa: 'cliente', nombre: 'Nico Sellers', estado: 'activo' }, { id: 10, capa: 'cliente', nombre: 'Leila', estado: 'activo' });
  pg.db.agencias.push({ ws: 13 });
  for (const c of [31, 32, 33, 34]) pg.db.agencia_clientes.push({ id: ++n, agencia_ws: 13, cliente_ws: c, estado: 'aprobado', created_at: '2026-10-20T12:00:00.000Z' });
  pg.db.app_settings.push({ workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: SA }, { workspace_id: 1, key: 'mako.voz.instancia', value: VOZ }, { workspace_id: 1, key: 'mako.doer.grupos', value: JSON.stringify([SA]) }, { workspace_id: 13, key: 'mako.grupo_jid', value: CODIGO });
  const { cifrarSecreto } = await import('../lib/credenciales');
  pg.db.credenciales.push({ workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' });

  const { avisarAMartin } = await import('../lib/agencia-mes');
  const { avisoDeComprobanteParaRevisar } = await import('../lib/agencia-mes-reglas');
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};

  // 20:18 — el aviso del cron, con el texto que arma el código (los números de esa noche).
  const aviso = avisoDeComprobanteParaRevisar({
    agencia: 'Código Inmobiliario', agenciaWs: 13, porque: 'calza exacto con más de una cosa',
    lectura: 'Binance, 15.67 USDT, orden N.º 465149562572922880, del 11/11.',
    debe: 'mensualidad de noviembre US$125,34 · entrada de Giselle (cuenta 31) US$37,60 · entrada de Pablo Chavez (cuenta 32) US$37,60 · entrada de Marcela (cuenta 33) US$34,47 · entrada de Nico Sellers (cuenta 34) US$15,67',
  });
  await avisarAMartin(aviso);
  // El aviso también está en el chat de la línea, con el MISMO id: no se repite en el historial.
  const idDelAviso = String(pg.db.mako_doer_conv[0]?.wa_message_id ?? '');
  storeDe[SA] = [deMaKo(idDelAviso, aviso, 7 * 60_000, SA)];
  out.aviso = { texto: aviso, enLaMemoria: pg.db.mako_doer_conv.map((f) => ({ ws: f.workspace_id, jid: f.grupo_jid, role: f.role, content: String(f.content) })) };

  const deMartin = (id: string, texto: string) => manejarEntranteDoer(VOZ, {
    key: { remoteJid: SA, id, fromMe: false, participant: '104857516154969@lid', participantAlt: MARTIN, addressingMode: 'lid' },
    message: { conversation: texto }, pushName: 'Martin Koncke', messageTimestamp: Math.floor(Date.now() / 1000),
  } as never);
  const turno = async (k: string, c: string, id: string, texto: string, dice: string) => {
    clase = c; respuesta = dice; alTurno.splice(0);
    const r = await deMartin(id, texto);
    out[k] = { r, salio: red.filter((x) => x.camino.includes('/message/sendText/')).map((x) => String((JSON.parse(x.cuerpo || '{}') as { text?: string }).text ?? '')).slice(-1), alTurno: alTurno.map((x) => ({ ...x })), clases: pg.db.anthropic_usage.filter((f) => f.feature === 'clase-doer').map((f) => String(f.motivo ?? '')).slice(-1) };
  };
  // 20:25 — la clase que dio Haiku esa noche: accion («Solicita dar de alta algo»).
  await turno('siDalo', JSON.stringify({ clase: 'ACCION', resumen: 'Solicita dar de alta algo', reenviado: false }), 'MK-2025', 'Si perfecto, dalo de alta', '¿Marco pagada la entrada de Nico Sellers, US$15,67, con la orden 465149562572922880?');
  // 20:26 — y la pregunta: pregunta.
  await turno('cuantoPaga', JSON.stringify({ clase: 'PREGUNTA', resumen: 'Pregunta cuánto va a pagar Código Inmobiliario el mes entrante', reenviado: false, negocio: 'Código Inmobiliario' }), 'MK-2026', 'Y dime cuanto va a pagar codigo inmobiliario el mes entrante con todos los clientes', 'Código Inmobiliario paga en diciembre US$X: su plan y sus 4 clientes.');
  // ── 23:33 UTC, grupo de Código: el equipo de MaKo (el Cerebro, con /message/sendText por la línea de MaKo, sin pasar por el turno ni
  // por la memoria) le pide a Joan el correo; Joan contesta sólo el correo. Lo del equipo de antes, firmado, va marcado como del equipo.
  storeDe[CODIGO] = [
    deMaKo('3EB02DF0B9BB2201319A73', 'Listo: entró el pago de la entrada de Sellers (15,67 USDT, orden 465149562572922880). Su cuenta ya está aprobada y activa.\n\n— Equipo de MaKo', 90_000, CODIGO),
    deMaKo('3EB0A39DBC326D3AB7F1DC', 'Una cosa más sobre *Sellers*: el correo del administrador quedó cargado como «ceo@sellersoficial.con» (con «.con» al final), así que el acceso a MaKo probablemente no le llegó. ¿Me pasan el correo bien escrito?', 30_000, CODIGO),
    { key: { id: '3EB0CC6C022FF351A1B400', fromMe: false, remoteJid: CODIGO, participant: '70000000000013@lid', participantAlt: JOAN }, pushName: 'Joan Dowd', messageTimestamp: S(1000), messageType: 'conversation', message: { conversation: 'ceo@sellersoficial.com' } },
  ];
  clase = JSON.stringify({ clase: 'PREGUNTA', resumen: 'Envía un correo electrónico', reenviado: false }); respuesta = 'Gracias, Joan: se lo paso al equipo.'; alTurno.splice(0);
  const rJoan = await manejarEntranteDoer(VOZ, { key: { remoteJid: CODIGO, id: '3EB0CC6C022FF351A1B400', fromMe: false, participant: '70000000000013@lid', participantAlt: JOAN, addressingMode: 'lid' }, message: { conversation: 'ceo@sellersoficial.com' }, pushName: 'Joan Dowd', messageTimestamp: S(1000) } as never);
  out.correoDeJoan = { r: rJoan, alTurno: alTurno.map((x) => ({ ...x })) };
  out.memoriaFinal =pg.db.mako_doer_conv.map((f) => ({ ws: f.workspace_id, role: f.role, content: String(f.content).slice(0, 80) }));
  process.stdout.write(`@@HILO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@HILO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
