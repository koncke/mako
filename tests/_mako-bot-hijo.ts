// =============================================================================
// Hijo de tests/mako-bot.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El bot 1 a 1 por la entrada REAL (`manejarEntranteBot`: la ventana, quién es, la cola, el turno) sobre un PostgREST de mentira y un Evolution que anota. Lo que importa es
// por qué línea salió cada cosa: la voz de MaKo es `mako_ws9`, el WhatsApp personal de Martín, como en producción. Los números son de mentira.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';
import { decirYSalir } from './_salir-cuando-salio';

process.env.MAKO_DOER_VENTANA_MS = '0';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
process.env.GROQ_API_KEY = `gsk_${'p'.repeat(48)}`;
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MAKO_EQUIPO_NOMBRES', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4', 'ANTHROPIC_CREDITO_CUENTA5']) delete process.env[k];

const PLATAFORMA = 9, UNO = 10, AGENCIA = 13, GISELLE = 17, MARCELA = 23;
const LINEA = 'mako_bot', VOZ = 'mako_ws9';
const DESCONOCIDO = '5491155500001', LEANDRO = '5491100000010', JOAN = '5491100000020', SETTER = '5491100000030', MARTIN = '5491100000001';
/** Los mismos 10 dígitos que Leandro, en otro país: NO es Leandro. */
const OTRO_PAIS = '521100000010';
const jid = (t: string) => `${t}@s.whatsapp.net`;
const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage', 'errores_app', 'tickets', 'ticket_eventos',
    'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'no_pude', 'mako_turnos', 'usuarios', 'mako_bot_contactos', 'agencia_clientes', 'notificaciones', 'push_suscripciones', 'planes_mako'],
  defaults: (t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...(t === 'mako_doer_buffer' ? { estado: 'pendiente' } : {}), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['workspace_id', 'grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
  candado: true,
  orCompleto: true,
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;

const escena = { claude: 'Hola, soy MaKo.', turno: 'Tienes 3 leads nuevos.', usuariosCaido: false };
const red: Array<{ host: string; camino: string; cuerpo: string; clave?: string | null }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'supa.test') {
    if (escena.usuariosCaido && u.pathname.endsWith('/usuarios')) return r(500, { message: 'base caída' });
    return pg.responder(u, init);
  }
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '', clave: new Headers(init.headers).get('x-api-key') });
  if (u.host === 'evolution.test') return r(200, { key: { id: `env-${red.length}` } });
  if (u.host === 'api.anthropic.com') {
    if (new Headers(init.headers).get('x-api-key') !== CREDITO2) return r(500, { type: 'error', error: { type: 'api_error', message: 'Overloaded' } });
    return r(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude', stop_reason: 'end_turn', content: [{ type: 'text', text: escena.claude }], usage: { input_tokens: 9, output_tokens: 4 } });
  }
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) {
    return r(200, { id: 'c1', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: escena.turno }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

let id = 0;
const msg = (tel: string, texto: string, o: { ts?: number; pushName?: string } = {}) => ({
  key: { id: `in-${++id}`, fromMe: false, remoteJid: jid(tel) }, pushName: o.pushName ?? 'Alguien', messageType: 'conversation',
  message: { conversation: texto }, messageTimestamp: o.ts ?? Math.floor(Date.now() / 1000),
});

/** Lo que salió a WhatsApp, por línea y a quién. */
const enviados = () => red.filter((x) => x.host === 'evolution.test' && x.camino.includes('/message/')).map((x) => {
  const b = JSON.parse(x.cuerpo || '{}') as { number?: string; text?: string; reaction?: string; key?: { remoteJid?: string } };
  const partes = x.camino.split('/');
  return { que: partes[2], linea: decodeURIComponent(partes[3] ?? ''), a: b.number ?? b.key?.remoteJid ?? '', texto: b.text ?? b.reaction ?? '' };
});
/** Todo lo que WhatsApp llega a ver, también el «escribiendo…»: con la ventana cerrada, tampoco eso. */
const todoAWhatsApp = () => red.filter((x) => x.host === 'evolution.test' && (x.camino.includes('/message/') || x.camino.includes('/chat/sendPresence'))).map((x) => decodeURIComponent(x.camino));
const textos = () => enviados().filter((e) => e.que === 'sendText').map((e) => e.texto);
const pedidosClaude = () => red.filter((x) => x.host === 'api.anthropic.com').map((x) => JSON.parse(x.cuerpo || '{}') as { system?: string | Array<{ text: string }>; tools?: unknown[]; messages?: unknown[] });
const systemDe = (p: { system?: string | Array<{ text: string }> }) => (typeof p.system === 'string' ? p.system : (p.system ?? []).map((b) => b.text).join('\n'));
const pedidosTurno = () => red.filter((x) => x.host === 'api.openai.com').map((x) => JSON.parse(x.cuerpo || '{}') as { messages?: Array<{ role: string; content: unknown }>; tools?: unknown[] });

const BOT = [{ workspace_id: PLATAFORMA, key: 'mako.bot.activo', value: 'si' }, { workspace_id: PLATAFORMA, key: 'mako.bot.instancia', value: LINEA }];

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { manejarEntranteBot } = await import('../lib/mako-bot');
  const { enviarAlChat, reaccionarEnElChat, configDelBot } = await import('../lib/mako-salida');
  const { enviarAGrupoJid } = await import('../lib/mako-grupo');
  const { flushHuerfanos, manejarEntranteDoerChat } = await import('../lib/mako-doer-in');
  const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;

  const arrancar = (settings: Array<{ workspace_id: number; key: string; value: string }> = BOT) => {
    red.length = 0;
    db.workspaces = [
      { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' }, { id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: UNO, capa: 'cliente', nombre: 'Fiesta Music', estado: 'activo' },
      { id: AGENCIA, capa: 'agencia', nombre: 'Agencia Uno', estado: 'activo' }, { id: GISELLE, capa: 'cliente', nombre: 'Giselle Coaching', estado: 'activo' }, { id: MARCELA, capa: 'cliente', nombre: 'Marcela Bienes', estado: 'activo' },
    ];
    db.usuarios = [
      { id: 501, email: 'martin@mako.test', nombre: 'Martín', rol: 'admin', estado: 'activo', workspace_id: PLATAFORMA, rol_ws: null, perfil: { telefono: `+${MARTIN}` } },
      { id: 510, email: 'leandro@fiesta.test', nombre: 'Leandro', rol: 'usuario', estado: 'activo', workspace_id: UNO, rol_ws: 'admin', perfil: { telefono: `+${LEANDRO}` } },
      { id: 520, email: 'joan@agencia.test', nombre: 'Joan', rol: 'usuario', estado: 'activo', workspace_id: AGENCIA, rol_ws: 'admin', perfil: { telefono: JOAN } },
      { id: 530, email: 'setter@fiesta.test', nombre: 'Setter', rol: 'usuario', estado: 'activo', workspace_id: UNO, rol_ws: 'setter', perfil: { telefono: SETTER } },
    ];
    db.agencia_clientes = [{ agencia_ws: AGENCIA, cliente_ws: GISELLE, estado: 'aprobado' }, { agencia_ws: AGENCIA, cliente_ws: MARCELA, estado: 'aprobado' }];
    db.app_settings = [{ workspace_id: 1, key: 'mako.voz.instancia', value: VOZ }, ...settings];
    db.mako_bot_contactos = []; db.mako_doer_buffer = []; db.mako_doer_lock = []; db.mako_doer_conv = []; db.notificaciones = [];
    db.credenciales = [
      { workspace_id: UNO, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, UNO, 'OPENAI_API_KEY'), servicio: 'openai' },
      { workspace_id: GISELLE, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, GISELLE, 'OPENAI_API_KEY'), servicio: 'openai' },
      { workspace_id: MARCELA, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, MARCELA, 'OPENAI_API_KEY'), servicio: 'openai' },
      { workspace_id: AGENCIA, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, AGENCIA, 'OPENAI_API_KEY'), servicio: 'openai' },
      { workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' },
    ];
    escena.claude = 'Hola, soy MaKo.'; escena.turno = 'Tienes 3 leads nuevos.'; escena.usuariosCaido = false;
  };
  const out: Record<string, unknown> = {};

  // Apagado: sin los settings, sin ninguna línea.
  arrancar([]);
  out.apagado = { r: await manejarEntranteBot(LINEA, msg(DESCONOCIDO, 'hola')), enviados: enviados(), filas: db.mako_bot_contactos.length, config: await configDelBot() };

  // Le ponen la línea de un negocio: la del WhatsApp personal de Martín.
  arrancar([{ workspace_id: PLATAFORMA, key: 'mako.bot.activo', value: 'si' }, { workspace_id: PLATAFORMA, key: 'mako.bot.instancia', value: VOZ }]);
  out.lineaDeNegocio = { r: await manejarEntranteBot(VOZ, msg(MARTIN, 'hola')), enviados: enviados(), config: await configDelBot() };

  // Otra línea que no es la del bot.
  arrancar();
  out.otraLinea = { r: await manejarEntranteBot('mako_superadmin_x', msg(DESCONOCIDO, 'hola')), enviados: enviados(), filas: db.mako_bot_contactos.length };

  // Un mensaje viejo: la línea se está poniendo al día.
  arrancar();
  out.viejo = { r: await manejarEntranteBot(LINEA, msg(DESCONOCIDO, 'hola', { ts: Math.floor(Date.now() / 1000) - 3600 })), enviados: enviados(), filas: db.mako_bot_contactos.length };

  // Sin cuenta: ventas.
  arrancar();
  const ventas = await manejarEntranteBot(LINEA, msg(DESCONOCIDO, '¿Qué es MaKo?', { pushName: 'Ana' }));
  out.ventas = {
    r: ventas, enviados: enviados(), system: systemDe(pedidosClaude()[0] ?? {}), tools: pedidosClaude()[0]?.tools ?? [], fila: db.mako_bot_contactos[0] ?? null,
    conv: db.mako_doer_conv.map((c) => ({ ws: c.workspace_id, jid: c.grupo_jid, role: c.role })), feed: db.notificaciones.map((f) => ({ ws: f.workspace_id, tipo: f.tipo, descripcion: f.descripcion })),
    turnoDelNegocio: pedidosTurno().length,
  };
  // El segundo mensaje de la misma persona: sin otro aviso al equipo.
  const antes = db.notificaciones.length;
  await manejarEntranteBot(LINEA, msg(DESCONOCIDO, '¿Cuánto cuesta?'));
  out.ventasSegundo = { avisos: db.notificaciones.length - antes };

  // Pide una persona: la marca no se manda, y el equipo se entera.
  arrancar();
  escena.claude = 'Claro, le paso tu mensaje al equipo. [[humano]]';
  await manejarEntranteBot(LINEA, msg(DESCONOCIDO, 'quiero hablar con alguien'));
  out.pideHumano = { textos: textos(), tipos: db.notificaciones.map((f) => f.tipo) };

  // Quien tiene un negocio: el turno del doer con SUS datos, por la línea del bot.
  arrancar();
  const conocido = await manejarEntranteBot(LINEA, msg(LEANDRO, '¿Cuántos leads tengo hoy?', { pushName: 'Leandro' }));
  const pt = pedidosTurno()[pedidosTurno().length - 1];
  const systemTurno = JSON.stringify(pt?.messages?.filter((m) => m.role === 'system') ?? '');
  out.conocido = {
    r: conocido, enviados: enviados(), hayTurno: pedidosTurno().length > 0, systemDiceChat: systemTurno.includes('chat de WhatsApp de a dos'), systemDiceGrupo: systemTurno.includes('estás en un grupo de WhatsApp'),
    soloMako: systemTurno.includes('No eres un asistente general'), conv: db.mako_doer_conv.map((c) => ({ ws: c.workspace_id, jid: c.grupo_jid, role: c.role })),
    settingsDelChatEnElWs1: db.app_settings.filter((s) => s.workspace_id === 1 && String(s.key).includes(LEANDRO)).map((s) => s.key),
  };

  // ⛔ Otro país con los mismos 10 dígitos: no ve los datos de Leandro.
  arrancar();
  const otroPais = await manejarEntranteBot(LINEA, msg(OTRO_PAIS, '¿Cuántos leads tengo hoy?'));
  out.otroPais = { r: otroPais, turnoDelNegocio: pedidosTurno().length, tools: pedidosClaude()[0]?.tools ?? [] };

  // Del equipo, sin administrar: sin datos ni herramientas.
  arrancar();
  const equipo = await manejarEntranteBot(LINEA, msg(SETTER, '¿Cuánto facturamos este mes?'));
  out.equipo = { r: equipo, turnoDelNegocio: pedidosTurno().length, tools: pedidosClaude()[0]?.tools ?? [], system: systemDe(pedidosClaude()[0] ?? {}), textos: textos() };

  // Una agencia: varios negocios.
  arrancar();
  const a1 = await manejarEntranteBot(LINEA, msg(JOAN, '¿Cuántos leads tengo hoy?'));
  const lista1 = textos();
  const turnos1 = pedidosTurno().length;
  const a2 = await manejarEntranteBot(LINEA, msg(JOAN, 'y ayer?'));
  const lista2 = textos();
  const espera = (db.mako_bot_contactos[0]?.pregunta as { mensajes: unknown[] } | null)?.mensajes.length ?? 0;
  red.length = 0;
  const a3 = await manejarEntranteBot(LINEA, msg(JOAN, '2'));
  const elegido = db.mako_bot_contactos[0]?.ws_elegido;
  const conv3 = db.mako_doer_conv.filter((c) => c.role === 'user').map((c) => ({ ws: c.workspace_id, content: c.content }));
  const textos3 = textos();
  red.length = 0;
  const a4 = await manejarEntranteBot(LINEA, msg(JOAN, '¿y la semana pasada?'));
  const textos4 = textos();
  red.length = 0;
  const a5 = await manejarEntranteBot(LINEA, msg(JOAN, '¿Cómo va Marcela?'));
  out.agencia = {
    a1, lista1, turnos1, a2, lista2, espera, a3, elegido, conv3, textos3, a4, textos4, a5, textos5: textos(),
    elegidoFinal: db.mako_bot_contactos[0]?.ws_elegido, ws5: db.mako_doer_conv.filter((c) => c.role === 'user').map((c) => c.workspace_id),
  };

  // No se pudo leer de quién es: no se le vende nada, por si es un cliente.
  arrancar();
  escena.usuariosCaido = true;
  const caida = await manejarEntranteBot(LINEA, msg(LEANDRO, 'hola'));
  out.lecturaCaida = { r: caida, textos: textos(), claude: pedidosClaude().length };

  // Modo de prueba: sólo los números de la lista.
  arrancar([...BOT, { workspace_id: PLATAFORMA, key: 'mako.bot.solo', value: JSON.stringify([`+${MARTIN}`]) }]);
  const fuera = await manejarEntranteBot(LINEA, msg(DESCONOCIDO, 'hola'));
  const fueraEnviados = enviados();
  const dentro = await manejarEntranteBot(LINEA, msg(MARTIN, 'hola'));
  out.soloPrueba = { fuera, fueraEnviados, filasFuera: db.mako_bot_contactos.filter((f) => String(f.jid).startsWith(DESCONOCIDO)).length, dentro };

  // El tope del día.
  arrancar();
  const hoy = new Date().toISOString().slice(0, 10);
  db.mako_bot_contactos = [{ jid: jid(DESCONOCIDO), telefono: DESCONOCIDO, nombre: null, ultimo_entrante_at: new Date().toISOString(), primer_entrante_at: new Date().toISOString(), dia: hoy, turnos_dia: 40, tope_avisado: false }];
  const tope1 = await manejarEntranteBot(LINEA, msg(DESCONOCIDO, 'otra'));
  const tope1Textos = textos();
  const tope2 = await manejarEntranteBot(LINEA, msg(DESCONOCIDO, 'otra más'));
  out.tope = { tope1, tope1Textos, tope2, tope2Textos: textos(), claude: pedidosClaude().length };

  // LA PUERTA: nunca escribe primero.
  arrancar();
  const sinFila = await enviarAlChat(jid(DESCONOCIDO), 'hola, ¿cómo estás?');
  const sinFilaEnv = enviados();
  db.mako_bot_contactos = [{ jid: jid(DESCONOCIDO), ultimo_entrante_at: new Date(Date.now() - 25 * 3600_000).toISOString() }];
  const vieja = await enviarAlChat(jid(DESCONOCIDO), 'hola, ¿cómo estás?');
  const reaccionVieja = await reaccionarEnElChat(jid(DESCONOCIDO), { id: 'x' }, '👍');
  const viejaEnv = enviados();
  db.mako_bot_contactos = [{ jid: jid(DESCONOCIDO), ultimo_entrante_at: new Date(Date.now() - 23 * 3600_000).toISOString() }];
  const abierta = await enviarAlChat(jid(DESCONOCIDO), 'hola, te contesto');
  const abiertaEnv = enviados();
  out.puerta = { sinFila, sinFilaEnv, vieja, reaccionVieja, viejaEnv, abierta, abiertaEnv };

  // ⛔ EL TURNO DEL DOER CON LA VENTANA CERRADA: por ninguna línea, ni la voz, ni la del bot. Sale de acá sin pasar por la entrada, que es la que abre la ventana.
  arrancar();
  escena.turno = 'Tienes 3 leads nuevos.';
  const doerSinVentana = await manejarEntranteDoerChat(UNO, LINEA, msg(LEANDRO, '¿Cuántos leads tengo?') as never);
  out.doerSinVentana = { r: doerSinVentana, hayTurno: pedidosTurno().length > 0, enviados: enviados(), todo: todoAWhatsApp() };

  // Un grupo sigue saliendo por la voz, como hoy.
  arrancar();
  const alGrupo = await enviarAGrupoJid('120363000000000010@g.us', 'al grupo');
  out.alGrupo = { alGrupo, enviados: enviados() };

  // Bot apagado: con su línea y con la ventana abierta, no sale.
  arrancar([{ workspace_id: PLATAFORMA, key: 'mako.bot.instancia', value: LINEA }]);
  db.mako_bot_contactos = [{ jid: jid(DESCONOCIDO), ultimo_entrante_at: new Date().toISOString() }];
  out.puertaApagada = { r: await enviarAlChat(jid(DESCONOCIDO), 'hola'), enviados: enviados() };

  // La cola huérfana de un desconocido, en el workspace de la plataforma: NUNCA corre el doer con los datos de la plataforma.
  arrancar();
  db.mako_bot_contactos = [{ jid: jid(DESCONOCIDO), ultimo_entrante_at: new Date().toISOString() }];
  db.mako_doer_buffer = [{ id: ++n, workspace_id: PLATAFORMA, grupo_jid: jid(DESCONOCIDO), wa_message_id: 'h1', texto: '¿cuánto facturó MaKo?', estado: 'pendiente', created_at: new Date(Date.now() - 600_000).toISOString(), payload: { key: { id: 'h1', remoteJid: jid(DESCONOCIDO) }, instance: LINEA, message: { conversation: '¿cuánto facturó MaKo?' } } }];
  const huerfano = await flushHuerfanos();
  out.huerfano = { huerfano, turnoDelDoer: pedidosTurno().length, tools: pedidosClaude().map((p) => p.tools ?? []), system: systemDe(pedidosClaude()[0] ?? {}), enviados: enviados(), cola: db.mako_doer_buffer.map((b) => b.estado) };

  decirYSalir(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().catch((e) => decirYSalir(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`));
