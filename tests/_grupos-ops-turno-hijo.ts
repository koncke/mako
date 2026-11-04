// =============================================================================
// Hijo de tests/grupos-ops-turno.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// MaKo sobre un mensaje de la app, de punta a punta: el POST real con su sesión, el autollamado al cron real SIN sesión, `manejarEntranteDeLaApp`, la cola, el candado, el clasificador y el turno. Los modelos son
// de mentira (la escena pone la clase y la respuesta) y se anota lo que les llega: lo que importa es lo que un invitado NO le hace leer al modelo.

process.env.MAKO_DOER_VENTANA_MS = '0';
// ⚠️ ANTES DEL ARNÉS: el candado corto, para probar que se renueva sin esperar 150 s.
process.env.MAKO_DOER_CANDADO_MS = '500';
import { db, pg, comoPersona, correrDespues, decirResultado, escena, escenaNueva, red, aEvolution, alModelo, pedidosDeSesion, sesionDe, storage, usuario, CREDITO2, OPENAI_NEGOCIO, PLATAFORMA } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10, SIN_GRUPO = 12, AJENO = 13;
const JID = '120363000000000010@g.us', JID_SUPER = '120363000000000009@g.us';
const LINEA = 'mako_superadmin_x';
const ANA = usuario(101, 'ana@fiesta.test', 'Ana', WS, 'admin');
const BOB = usuario(102, 'bob@fiesta.test', 'Bob', WS, 'admin');
/** Entra recién en la última escena (la pregunta a MaKo). */
const CARLA = usuario(105, 'carla@fiesta.test', 'Carla', WS, 'admin');
const JOAN = usuario(201, 'joan@ajeno.test', 'Joan', AJENO, 'admin');
const SOLA = usuario(301, 'sola@singrupo.test', 'Sola', SIN_GRUPO, 'admin');
const OTRA_DEL_SIN_GRUPO = usuario(302, 'otra@singrupo.test', 'Otra', SIN_GRUPO, 'admin');
const CON_NUMERAL = usuario(203, 'x#m@ajeno.test', 'Numeral', AJENO, 'closer');

const clase = (c: string, resumen = 'lo que pide') => JSON.stringify({ clase: c, resumen, reenviado: false });
const filas = (ws = WS) => db.grupo_mensajes.filter((f) => f.workspace_id === ws);
const deMaKo = (ws = WS) => filas(ws).filter((f) => f.autor_tipo === 'mako').map((f) => f.texto);
function limpiar() {
  for (const t of ['grupo_mensajes', 'mako_doer_conv', 'mako_doer_buffer', 'mako_doer_lock', 'mako_acciones_pendientes', 'tickets', 'ticket_eventos', 'insistencias', 'flujo_corridas']) db[t].splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.doer.') && !String(f.key).startsWith('mako.equipo') && f.key !== 'mako.onboarding.answers' && f.key !== 'mako.onboarding.schema');
}

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' }, { id: WS, capa: 'cliente', nombre: 'Fiesta', estado: 'activo' },
    { id: SIN_GRUPO, capa: 'cliente', nombre: 'Sin Grupo', estado: 'activo' }, { id: AJENO, capa: 'cliente', nombre: 'Ajeno', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: JID_SUPER }, { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA });
  db.usuarios.push(ANA, BOB, JOAN, SOLA, CON_NUMERAL, usuario(901, 'martin@mako.test', 'Martín', PLATAFORMA, null, { rol: 'admin' }));
  const invitar = (ws: number, u: Record<string, unknown>) => db.grupo_invitados.push({ workspace_id: ws, email: u.email, usuario_id: u.id, invito_usuario_id: 101, desde_id: 0, invitado_at: '2026-01-01T00:00:00.000Z', abrio_at: '2026-01-01T00:00:00.000Z', avisado_at: null, salio_at: null });
  invitar(WS, JOAN); invitar(WS, CON_NUMERAL);
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales.push(
    { workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, WS, 'OPENAI_API_KEY'), servicio: 'openai' },
    { workspace_id: SIN_GRUPO, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, SIN_GRUPO, 'OPENAI_API_KEY'), servicio: 'openai' },
    { workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' },
  );

  const { NextRequest } = await import('next/server');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');
  const cron = await import('../app/api/cron/grupo-turno/route');
  const { manejarEntranteDoer, manejarEntranteDeLaApp, flushHuerfanos } = await import('../lib/mako-doer-in');
  const { msgDeFila } = await import('../lib/grupo-reglas');
  const { pendientes } = await import('../lib/mako-doer-buffer');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { encolarTurno, SinLaPersona } = await import('../lib/ia-pc');
  const { runnerDelRegistro } = await import('../lib/api-mako/ejecutar');
  const { porId } = await import('../lib/api-mako/registro');
  escena.cron = (req: Request) => cron.POST(new NextRequest(req.url, { method: req.method, headers: req.headers, body: (req as unknown as { body?: BodyInit }).body, duplex: 'half' } as never));

  const postear = (u: Record<string, unknown>, ws: number, body: Record<string, unknown>) => comoPersona(sesionDe(u), async () => {
    const r = await mensajes.POST(new NextRequest(`https://hola-mako.com/api/grupos/${ws}/mensajes`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ ws: String(ws) }) });
    return { status: r.status, body: await r.json() as Record<string, any> };
  });
  /** Una persona escribe y corre lo de después de responder: el push y el autollamado al turno. */
  const escribir = async (u: Record<string, unknown>, texto: string, ws = WS, extra: Record<string, unknown> = {}) => {
    const r = await postear(u, ws, { texto, ...extra });
    await correrDespues();
    return r;
  };
  /** Un mensaje de WhatsApp, con la forma de Evolution v2. */
  const deWhatsApp = (id: string, t: string, alt = '5491100000099@s.whatsapp.net') => ({
    key: { id, fromMe: false, remoteJid: JID, participant: '70000000000099@lid', addressingMode: 'lid', participantAlt: alt },
    message: { conversation: t }, instance: LINEA, pushName: 'Pedro en WhatsApp', messageTimestamp: Math.floor(Date.now() / 1000),
  });
  const pendiente = (id: number, tipo: string, payload: Record<string, unknown>, jid = JID, ws = WS) => db.mako_acciones_pendientes.push({
    id, workspace_id: ws, grupo_jid: jid, tipo, payload, resumen: 'Pausar la campaña Verano', estado: 'pendiente', vence_at: new Date(Date.now() + 3600_000).toISOString(), origen: 'hola-mako', created_at: new Date(Date.now() - 60_000).toISOString(),
  });
  const conConfirmar = (id: number) => ({ herramienta: { nombre: 'confirmar_accion', args: { id } }, respuesta: 'Hecho.' });
  const estadoDe = (id: number) => db.mako_acciones_pendientes.find((p) => p.id === id)?.estado;
  const lo = () => alModelo().map((m) => ({ tools: m.tools.length, nombres: m.tools, sys: m.system, mensajes: m.mensajes, deHerramientas: m.deHerramientas }));
  const out: Record<string, unknown> = {};

  // ── De punta a punta ──
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hoy no entró ningún lead.' });
  const e2e = await escribir(ANA, 'mako, ¿cuántos leads entraron hoy?');
  const sesiones = pedidosDeSesion.filter((s) => s !== null).length;
  out.e2e = {
    status: e2e.status, filas: filas().map((f) => ({ autor: f.autor_tipo, canal: f.canal, texto: f.texto, reaccion: f.reaccion, usuario: f.usuario_id })),
    evolution: aEvolution(), cola: db.mako_doer_buffer.map((f) => ({ estado: f.estado, id: f.wa_message_id, ws: f.workspace_id, jid: f.grupo_jid })), conv: db.mako_doer_conv.map((f) => ({ role: f.role, jid: f.grupo_jid, id: f.wa_message_id })),
    modelo: lo().map((m) => ({ tools: m.tools, voz: /grupo de MaKo/.test(m.sys), whatsapp: /grupo de WhatsApp/.test(m.sys) })), sesiones,
  };
  // El cron sin el secreto, y un mensaje que no es de una persona.
  out.cron = {
    sinAuth: (await cron.POST(new NextRequest('https://hola-mako.com/api/cron/grupo-turno', { method: 'POST', body: JSON.stringify({ ws: WS, id: 1 }) }))).status,
    filaQueNoExiste: (await cron.POST(new NextRequest('https://hola-mako.com/api/cron/grupo-turno', { method: 'POST', body: JSON.stringify({ ws: WS, id: 999999 }), headers: { authorization: 'Bearer secreto-del-cron' } }))).status,
    deOtroNegocio: await (async () => {
      const id = Number(filas()[0].id);
      return (await cron.POST(new NextRequest('https://hola-mako.com/api/cron/grupo-turno', { method: 'POST', body: JSON.stringify({ ws: AJENO, id }), headers: { authorization: 'Bearer secreto-del-cron' } }))).status;
    })(),
  };

  // ── Lo de un invitado, ADENTRO DE SU PROPIA SESIÓN: la cola es del negocio del grupo, no del suyo ──
  limpiar(); escenaNueva({ clase: clase('CHARLA') });
  await escribir(JOAN, 'mako, buenas');
  out.colaDelInvitado = db.mako_doer_buffer.map((f) => ({ ws: f.workspace_id, jid: f.grupo_jid, participante: (f.payload as { key?: { participant?: string } }).key?.participant }));

  // ── ⛔ UN INVITADO NO LEE DATOS DEL NEGOCIO. Primero el control: con quien administra, las semillas llegan al modelo ──
  const sembrar = () => {
    limpiar();
    db.app_settings.push(
      { workspace_id: WS, key: 'mako.onboarding.schema', value: JSON.stringify([{ key: 'negocio', label: 'Negocio', fields: [{ key: 'secreto', label: 'Secreto' }] }]) },
      { workspace_id: WS, key: 'mako.onboarding.answers', value: JSON.stringify({ secreto: 'SEMILLA-PERFIL' }) },
      { workspace_id: WS, key: 'mako.equipo.grupo', value: JSON.stringify([{ at: new Date().toISOString(), texto: 'SEMILLA-EQUIPO' }]) },
    );
    db.objectives.splice(0);
    db.objectives.push({ id: 1, workspace_id: WS, anio: 2026, quarter: null, estado: 'activo', titulo: 'SEMILLA-OBJETIVO', meta_valor: 1000, unidad: 'usd', orden: 1, metrica: 'manual', valor_manual: 123 });
    db.tickets.push({ id: 880, workspace_id: WS, titulo: 'SEMILLA-TICKET', descripcion: 'd', estado: 'nuevo', respuesta: null, usuario_email: 'bob@fiesta.test', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), canal: 'whatsapp', contexto: {} });
    pendiente(881, 'proponer_estado_campana', { campana: 'x' });
    db.mako_acciones_pendientes[0].resumen = 'SEMILLA-PENDIENTE';
    db.mako_doer_conv.push(
      { id: 882, workspace_id: WS, grupo_jid: JID, role: 'user', content: 'SEMILLA-CHARLA-RECIENTE', wa_message_id: null, created_at: new Date(Date.now() - 3600_000).toISOString() },
      { id: 883, workspace_id: WS, grupo_jid: JID, role: 'assistant', content: 'SEMILLA-RESPUESTA-RECIENTE', wa_message_id: null, created_at: new Date(Date.now() - 3500_000).toISOString() },
      { id: 884, workspace_id: WS, grupo_jid: JID, role: 'user', content: 'SEMILLA-CHARLA-VIEJA', wa_message_id: null, created_at: new Date(Date.now() - 3 * 24 * 3600_000).toISOString() },
    );
  };
  // Y nombra Google Calendar (ticket #42, de main): si el negocio lo tiene conectado es un dato del negocio (`ctxGoogle`).
  const PIDE_NUMEROS = 'mako, pensá cómo vamos con el objetivo del trimestre, resumime lo que se habló esta semana y decime si tenemos Google Calendar conectado';
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'cómo vamos'), respuesta: 'Vamos bien.' });
  await escribir(ANA, PIDE_NUMEROS);
  const control = lo();
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'cómo vamos'), respuesta: 'No tengo ese dato aquí.' });
  await escribir(JOAN, PIDE_NUMEROS);
  const invitado = lo();
  const convTrasInvitado = db.mako_doer_conv.map((f) => f.content);
  out.datos = { control, invitado, convTrasInvitado, reaccion: filas().find((f) => f.autor_tipo === 'persona')?.reaccion, respuesta: deMaKo() };

  // ── ⛔ Sin herramientas, el pedido del invitado no se delega ni entra por la vía libre del negocio ──
  limpiar(); escenaNueva({ clase: clase('ACCION', 'Armar una landing nueva'), respuesta: 'Listo, ya quedó la landing.' });
  await escribir(JOAN, 'mako, armame una landing nueva y cargá estas tareas al plan');
  const tDelegado = db.tickets.map((t) => ({ tipo: t.tipo, despacho: t.despacho, contexto: t.contexto, triage: t.triage }));
  limpiar(); escenaNueva({ clase: clase('TICKET', 'Desde ayer ya no carga el CRM') });
  await escribir(JOAN, 'mako, desde ayer ya no carga el CRM');
  const tInvitado = db.tickets.map((t) => ({ rol: t.rol, email: t.usuario_email, canal: t.canal, despacho: t.despacho, auto: (t.triage as { autoArreglo?: boolean }).autoArreglo, estado: t.estado }));
  const dichoInvitado = deMaKo();
  limpiar(); escenaNueva({ clase: clase('TICKET', 'Desde ayer ya no carga el CRM') });
  await escribir(ANA, 'mako, desde ayer ya no carga el CRM');
  const tAdmin = db.tickets.map((t) => ({ rol: t.rol, email: t.usuario_email, canal: t.canal, despacho: t.despacho, auto: (t.triage as { autoArreglo?: boolean }).autoArreglo, actor: t.usuario_email }));
  out.tickets = { tDelegado, tInvitado, tAdmin, dichoInvitado, dichoAdmin: deMaKo() };

  // ── ⛔ Lo que pide un invitado no entra a la memoria: el «dale» del dueño no lo ejecuta ──
  limpiar(); escenaNueva({ clase: clase('ACCION', 'Mandar un mensaje a los leads'), respuesta: 'Eso no lo puedo hacer aquí.' });
  await escribir(JOAN, 'mako, mandales a todos los leads este mensaje: SEMILLA-DEL-INVITADO');
  escenaNueva({ clase: clase('ACCION', 'Sí'), respuesta: 'Listo.' });
  await escribir(ANA, 'mako, sí, dale');
  out.memoria = { conv: db.mako_doer_conv.map((f) => f.content), alModeloDelDueno: lo().map((m) => m.mensajes + m.sys) };

  // ── ⛔ Un invitado no escribe en el negocio por detrás: con la IA caída, su «anotá» no va al Plan, y su «sí» a una oferta abierta no arranca la guía ──
  const PIDE_ANOTAR = 'mako, anotá: llamar a Pedro\n1. una cosa\n2. otra cosa';
  limpiar(); escenaNueva({ clase: null, iaCaida: true });
  db.plan_propuestas.splice(0);
  await escribir(JOAN, PIDE_ANOTAR);
  const planInvitado = db.plan_propuestas.length;
  limpiar(); escenaNueva({ clase: null, iaCaida: true });
  db.plan_propuestas.splice(0);
  await escribir(ANA, PIDE_ANOTAR);
  const planAdmin = db.plan_propuestas.length;
  const { claveAyuda, ofertaDeAyuda } = await import('../lib/doer-ayuda');
  const conOferta = () => { limpiar(); db.app_settings.push({ workspace_id: WS, key: claveAyuda(JID), value: JSON.stringify(ofertaDeAyuda(['fathom'], Date.now())) }); };
  conOferta(); escenaNueva({ clase: clase('CHARLA'), respuesta: 'Hola.' });
  await escribir(JOAN, 'sí');
  const ayudaInvitado = deMaKo();
  conOferta(); escenaNueva({ clase: clase('CHARLA'), respuesta: 'Hola.' });
  await escribir(ANA, 'sí');
  out.porDetras = { planInvitado, planAdmin, ayudaInvitado, ayudaAdmin: deMaKo() };

  // ── El tope de un invitado: el mensaje queda, sin turno ──
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  for (let i = 0; i < 61; i++) db.grupo_mensajes.push({ id: 5000 + i, workspace_id: WS, autor_tipo: 'persona', usuario_id: 201, autor_nombre: 'Joan', canal: 'app', texto: 'x', adjunto: null, responde_a: null, reaccion: null, aviso_tipo: null, wa_message_id: null, wa_at: null, cliente_id: null, created_at: new Date().toISOString() });
  const conTope = await escribir(JOAN, 'mako, una más');
  const colaConTope = db.mako_doer_buffer.length;
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  for (let i = 0; i < 61; i++) db.grupo_mensajes.push({ id: 5000 + i, workspace_id: WS, autor_tipo: 'persona', usuario_id: 101, autor_nombre: 'Ana', canal: 'app', texto: 'x', adjunto: null, responde_a: null, reaccion: null, aviso_tipo: null, wa_message_id: null, wa_at: null, cliente_id: null, created_at: new Date().toISOString() });
  await escribir(ANA, 'mako, una más');
  out.topeDelDia = { status: conTope.status, colaConTope, colaDeQuienAdministra: db.mako_doer_buffer.length };

  // ── La clave: sin poder leerla, la fila queda y no se encola; el grupo de la plataforma usa su jid ──
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.', fallar: new Set(['app_settings:GET']) });
  const sinClave = await postear(ANA, WS, { texto: 'mako, ¿qué tal?' });
  const filasSinClave = filas().length;
  const colaSinClave = db.mako_doer_buffer.length;
  await correrDespues();
  limpiar(); escenaNueva({ clase: clase('CHARLA') });
  const MARTIN = db.usuarios.find((u) => u.id === 901)!;
  await escribir(MARTIN, 'mako, buenas', PLATAFORMA);
  out.clave = { sinClave: sinClave.status, filasSinClave, colaSinClave, plataforma: db.mako_doer_buffer.map((f) => f.grupo_jid), evolution: aEvolution() };

  // ── Las letras: no se creen lo que dice el mensaje ──
  const dejarEnCola = async (u: Record<string, unknown>, texto: string, letra: 'm' | 'i') => {
    const r = await postear(u, WS, { texto, sigue: true });
    await correrDespues();
    const fila = db.grupo_mensajes.find((f) => f.id === r.body.mensaje.id)!;
    const payload = msgDeFila(fila as never, { clave: JID, email: String(u.email), letra, nombre: String(u.nombre) });
    const enCola = db.mako_doer_buffer.find((f) => f.wa_message_id === `app:${fila.id}`)!;
    enCola.payload = payload;
    return payload;
  };
  // Dice `#m`, y en la base ya no está invitado: el sacado entre el POST y el turno.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  const m1 = await dejarEnCola(JOAN, 'mako, ¿cuántos leads hay?', 'm');
  const inv = db.grupo_invitados.find((f) => f.email === JOAN.email)!;
  inv.salio_at = new Date().toISOString();
  await manejarEntranteDeLaApp(WS, m1 as never);
  const sacado = lo().map((m) => m.tools);
  inv.salio_at = null;
  // Una lectura que falla: sin herramientas.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  const m2 = await dejarEnCola(ANA, 'mako, ¿cuántos leads hay?', 'm');
  escena.fallar.add('usuarios:GET');
  await manejarEntranteDeLaApp(WS, m2 as never);
  const lecturaRota = lo().map((m) => m.tools);
  escena.fallar.delete('usuarios:GET');
  // El email con `#m`.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  const numeral = await escribir(CON_NUMERAL, 'mako, ¿cuántos leads hay?');
  const conNumeral = lo().map((m) => m.tools);
  out.letras = { sacado, lecturaRota, conNumeral, numeralStatus: numeral.status };

  // ── Las mismas confirmaciones ──
  const PIDIO_ANA = 'ana@fiesta.test#m@app.mako';
  // «ok, esperá» no ejecuta lo que mueve plata.
  limpiar(); escenaNueva({ ...conConfirmar(700), clase: null });
  pendiente(700, 'proponer_estado_campana', { campana: 'x', __pidio: PIDIO_ANA });
  await escribir(ANA, 'ok, esperá que lo reviso');
  const okEspera = { estado: estadoDe(700), salida: lo().flatMap((m) => m.deHerramientas) };
  // El «sí» de otra persona, en plata: lo pide a MaKo.
  limpiar(); escenaNueva({ ...conConfirmar(701), clase: null });
  pendiente(701, 'proponer_estado_campana', { campana: 'x', __pidio: PIDIO_ANA });
  await escribir(BOB, 'sí');
  const siDeOtro = { estado: estadoDe(701), salida: lo().flatMap((m) => m.deHerramientas) };
  // El «sí» de quien pidió.
  limpiar(); escenaNueva({ ...conConfirmar(702), clase: null });
  pendiente(702, 'proponer_estado_campana', { campana: 'x', __pidio: PIDIO_ANA });
  await escribir(ANA, 'sí');
  const siDeQuienPidio = estadoDe(702);
  // «@MaKo sí», de otro.
  limpiar(); escenaNueva({ ...conConfirmar(703), clase: null });
  pendiente(703, 'proponer_estado_campana', { campana: 'x', __pidio: PIDIO_ANA });
  await escribir(BOB, '@MaKo sí');
  const siAMaKo = estadoDe(703);
  // Nació en WhatsApp, con el jid: «sí, MaKo» desde la app ejecuta.
  limpiar(); escenaNueva({ ...conConfirmar(704), clase: null });
  pendiente(704, 'proponer_estado_campana', { campana: 'x', __pidio: '5491100000099@s.whatsapp.net' });
  await escribir(BOB, 'sí, MaKo');
  const nacioEnWhatsApp = estadoDe(704);
  // ⛔ Nació SÓLO en la app: un «dale» en WhatsApp no la confirma.
  limpiar(); escenaNueva({ ...conConfirmar(705), clase: null });
  pendiente(705, 'proponer_estado_campana', { campana: 'x', __pidio: PIDIO_ANA, __soloApp: true });
  await manejarEntranteDoer(LINEA, deWhatsApp('WAdale1', 'dale') as never);
  await correrDespues();
  const daleEnWhatsApp = { estado: estadoDe(705), salida: lo().flatMap((m) => m.deHerramientas), evolution: aEvolution() };
  // Y lo que se propone en un turno sólo de la app queda marcado.
  limpiar(); escenaNueva({ clase: clase('ACCION', 'Pausar la campaña'), herramienta: { nombre: 'proponer_estado_campana', args: { campaignId: '123456', estado: 'PAUSED' } }, respuesta: '¿La pauso?' });
  await escribir(ANA, 'mako, pausá la campaña Verano');
  const propuestaSoloApp = db.mako_acciones_pendientes.map((p) => ({ soloApp: (p.payload as { __soloApp?: boolean }).__soloApp, pidio: (p.payload as { __pidio?: string }).__pidio, jid: p.grupo_jid }));
  out.confirmaciones = { okEspera, siDeOtro, siDeQuienPidio, siAMaKo, nacioEnWhatsApp, daleEnWhatsApp, propuestaSoloApp, salidaPropuesta: lo().flatMap((m) => m.deHerramientas) };

  // ── Sin grupo de WhatsApp: la misma regla de plata, y a Evolution nada ──
  db.usuarios.push(OTRA_DEL_SIN_GRUPO);
  limpiar(); escenaNueva({ ...conConfirmar(710), clase: null });
  pendiente(710, 'proponer_estado_campana', { campana: 'x', __pidio: 'sola@singrupo.test#m@app.mako' }, `app${SIN_GRUPO}@g.us`, SIN_GRUPO);
  await escribir(OTRA_DEL_SIN_GRUPO, 'sí', SIN_GRUPO);
  const sinGrupoOtro = { estado: estadoDe(710), salida: lo().flatMap((m) => m.deHerramientas) };
  limpiar(); escenaNueva({ ...conConfirmar(711), clase: null });
  pendiente(711, 'proponer_estado_campana', { campana: 'x', __pidio: 'sola@singrupo.test#m@app.mako' }, `app${SIN_GRUPO}@g.us`, SIN_GRUPO);
  await escribir(SOLA, 'sí', SIN_GRUPO);
  out.sinGrupo = { otro: sinGrupoOtro, quienPidio: estadoDe(711), evolution: aEvolution(), clave: db.mako_doer_buffer.map((f) => f.grupo_jid) };
  db.usuarios.splice(db.usuarios.indexOf(OTRA_DEL_SIN_GRUPO), 1);

  // ── Personas hablando entre ellas ──
  limpiar(); escenaNueva({ clase: clase('NO_REPLY', 'le contesta a otra persona'), respuesta: 'No debería salir.' });
  await escribir(ANA, 'che Bob, ¿me pasás el link de la reunión?');
  const noReply = { deMaKo: deMaKo(), reaccion: filas()[0].reaccion, llamadasAlTurno: lo().length, evolution: aEvolution() };
  limpiar(); escenaNueva({ clase: clase('CHARLA', 'un saludo') });
  await escribir(ANA, 'mako, gracias, buen día');
  const charla = { deMaKo: deMaKo(), reaccion: filas()[0].reaccion };
  // Sin quien clasifique, y sin nombrar a MaKo: no se mete.
  limpiar(); escenaNueva({ clase: null, respuesta: 'No debería salir.' });
  await escribir(ANA, 'Juan, mirá esto');
  const sinClase = { deMaKo: deMaKo(), llamadasAlTurno: lo().length, tickets: db.tickets.length };
  // Con una sola persona en el grupo, sí.
  limpiar(); escenaNueva({ clase: null, respuesta: 'Sí, hola.' });
  await escribir(SOLA, 'cuántos leads hay hoy', SIN_GRUPO);
  const unaSola = { deMaKo: deMaKo(SIN_GRUPO), clave: db.mako_doer_buffer.map((f) => f.grupo_jid), evolution: aEvolution() };
  out.personas = { noReply, charla, sinClase, unaSola };



  // ── Lotes ──
  // Dos mensajes de la app en la ventana: una sola respuesta. Con el mismo autor no se pierde quién.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Una sola respuesta.' });
  await escribir(ANA, 'mako, ¿cuántos leads hay?', WS, { sigue: true });
  await escribir(ANA, 'y cuántos cerraron');
  out.dosMensajes = { deMaKo: deMaKo(), llamadas: lo().length, evolution: aEvolution(), cola: db.mako_doer_buffer.map((f) => f.estado), mensajes: lo().map((m) => m.mensajes) };
  // Quien administra e invitado en el mismo lote: DOS turnos, y el texto del invitado no viaja en el que tiene herramientas.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Contesto.' });
  await escribir(JOAN, 'mako, SEMILLA-SALUDO-INVITADO', WS, { sigue: true });
  await escribir(ANA, 'mako, ¿cuántos leads hay?');
  out.loteMixto = lo().map((m) => ({ tools: m.tools, conInvitado: m.mensajes.includes('SEMILLA-SALUDO-INVITADO'), conAna: m.mensajes.includes('cuántos leads hay') }));
  // Huérfana: el proceso murió. El cron contesta en el hilo, sin Evolution.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Te contesto tarde.' });
  await escribir(ANA, 'mako, ¿sigues ahí?', WS, { sigue: true });
  for (const f of db.mako_doer_buffer) f.created_at = new Date(Date.now() - 5 * 60_000).toISOString();
  await flushHuerfanos();
  await correrDespues();
  out.huerfana = { deMaKo: deMaKo(), evolution: aEvolution(), cola: db.mako_doer_buffer.map((f) => f.estado) };
  // Huérfana de un invitado que dice ser quien administra: sin herramientas también en el cron.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hola.' });
  await dejarEnCola(JOAN, 'mako, ¿cuánto vendimos?', 'm');
  for (const f of db.mako_doer_buffer) f.created_at = new Date(Date.now() - 5 * 60_000).toISOString();
  await flushHuerfanos();
  await correrDespues();
  out.huerfanaInvitado = lo().map((m) => m.tools);
  // Lote mixto, con uno de WhatsApp: la respuesta va a los dos.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'A los dos.' });
  await escribir(ANA, 'mako, ¿qué tal?', WS, { sigue: true });
  await manejarEntranteDoer(LINEA, deWhatsApp('WAmixto', 'mako, y además esto') as never);
  await correrDespues();
  out.conWhatsApp = { deMaKo: deMaKo(), envios: aEvolution().filter((c) => c.includes('/message/sendText/')).length, llamadas: lo().length };
  // Un turno que murió a la mitad no se pierde callado.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería repetirse.' });
  await escribir(ANA, 'mako, ¿sigues ahí?', WS, { sigue: true });
  const colgado = db.mako_doer_buffer[0];
  colgado.created_at = new Date(Date.now() - 5 * 60_000).toISOString();
  db.app_settings.push({ workspace_id: 1, key: `mako.doer.last.${JID}`, value: colgado.wa_message_id });
  await flushHuerfanos();
  out.turnoMuerto = { deMaKo: deMaKo(), llamadas: lo().length, cola: db.mako_doer_buffer.map((f) => f.estado) };

  // ── ⚠️ El candado se renueva, y lo que se escribe mientras MaKo piensa se contesta sin el cron ──
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Te contesto.', demoraTurnoMs: 1400 });
  const posteoAna = await postear(ANA, WS, { texto: 'mako, ¿cuántos leads hay?', sigue: true });
  const filaAna = db.grupo_mensajes.find((f) => f.id === posteoAna.body.mensaje.id)!;
  const msgAna = msgDeFila(filaAna as never, { clave: JID, email: 'ana@fiesta.test', letra: 'm', nombre: 'Ana' });
  const turnoAna = manejarEntranteDeLaApp(WS, msgAna as never);
  // Bob escribe cuando el candado ya habría vencido sin renovarse (500 ms).
  await new Promise((r) => setTimeout(r, 900));
  const posteoBob = await postear(BOB, WS, { texto: 'mako, y los de ayer', sigue: true });
  const filaBob = db.grupo_mensajes.find((f) => f.id === posteoBob.body.mensaje.id)!;
  const msgBob = msgDeFila(filaBob as never, { clave: JID, email: 'bob@fiesta.test', letra: 'm', nombre: 'Bob' });
  const turnoBob = await manejarEntranteDeLaApp(WS, msgBob as never);
  await turnoAna;
  await correrDespues();
  out.candado = { turnoBob, deMaKo: deMaKo(), llamadas: lo().map((m) => m.mensajes.split('\n---\n').pop()), cola: db.mako_doer_buffer.map((f) => f.estado) };

  // ── Lo que escribe un invitado no acusa; lo de quien administra, sí ──
  const conInsistencia = () => { limpiar(); db.insistencias.push({ id: 900, workspace_id: WS, flujo_id: 'x', lead_id: null, texto: 'y', cada_min: 30, veces: 3, enviadas: 0, proxima_at: new Date().toISOString(), cerrada_at: null }); db.flujo_corridas.push({ id: 901, workspace_id: WS, estado: 'pendiente', respondio_at: null }); };
  const fotoAcuse = () => ({ cerrada: db.insistencias[0].cerrada_at != null, marcada: db.flujo_corridas[0].respondio_at != null });
  conInsistencia(); escenaNueva({ clase: clase('CHARLA') });
  await escribir(JOAN, 'ok');
  const acuseInvitado = fotoAcuse();
  conInsistencia(); escenaNueva({ clase: clase('CHARLA') });
  await escribir(ANA, 'ok');
  out.acuse = { invitado: acuseInvitado, admin: fotoAcuse() };

  // ── El archivo y la nota de voz, del bucket: Evolution no se toca ──
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const conArchivo = (ws: number, id: number, adjunto: Record<string, unknown>, extra: Record<string, unknown> = {}) => { db.grupo_mensajes.push({ id, workspace_id: ws, autor_tipo: 'persona', usuario_id: 101, autor_nombre: 'Ana', canal: 'app', texto: '', adjunto, responde_a: null, reaccion: null, aviso_tipo: null, wa_message_id: null, wa_at: null, cliente_id: null, created_at: new Date().toISOString(), ...extra }); };
  // Una nota de voz, sin IA que la escuche: la fila queda, y MaKo lo dice en el hilo.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), escucha: false, iaCaida: true });
  storage.set(`grupos/${WS}/nota.mp3`, Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0]));
  conArchivo(WS, 800, { tipo: 'audio', path: `grupos/${WS}/nota.mp3`, mime: 'audio/mpeg', secs: 3 });
  const notaMsg = msgDeFila(db.grupo_mensajes[0] as never, { clave: JID, email: 'ana@fiesta.test', letra: 'm', nombre: 'Ana' });
  await runWithWorkspace(WS, async () => { const { encolar } = await import('../lib/mako-doer-buffer'); await encolar(JID, { waId: 'app:800', texto: '', tieneAudio: true, payload: notaMsg }); });
  await manejarEntranteDeLaApp(WS, notaMsg as never);
  await correrDespues();
  out.notaSinIA = { filas: filas().map((f) => ({ autor: f.autor_tipo, texto: f.texto })), evolution: aEvolution() };
  // Una foto nombrando a MaKo: baja del bucket, no de Evolution.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Es una captura.' });
  storage.set(`grupos/${WS}/foto.png`, PNG);
  conArchivo(WS, 801, { tipo: 'imagen', path: `grupos/${WS}/foto.png`, mime: 'image/png' }, { texto: 'mako, qué dice esta foto' });
  const fotoMsg = msgDeFila(db.grupo_mensajes[0] as never, { clave: JID, email: 'ana@fiesta.test', letra: 'm', nombre: 'Ana' });
  await runWithWorkspace(WS, async () => { const { encolar } = await import('../lib/mako-doer-buffer'); await encolar(JID, { waId: 'app:801', texto: 'mako, qué dice esta foto', tieneMedia: true, payload: fotoMsg }); });
  await manejarEntranteDeLaApp(WS, fotoMsg as never);
  await correrDespues();
  out.foto = { evolution: aEvolution(), deMaKo: deMaKo(), viajo: lo().map((m) => m.mensajes.includes('image') || m.mensajes.includes('qué dice esta foto')) };
  // Citar una nota de voz espejada, sin línea que la baje: se escucha por su fila.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), transcripcion: 'SEMILLA-LO-QUE-DICE-EL-AUDIO', respuesta: 'Dice eso.' });
  storage.set(`grupos/${WS}/espejada.ogg`, Buffer.from('OggS audio'));
  conArchivo(WS, 802, { tipo: 'audio', path: `grupos/${WS}/espejada.ogg`, mime: 'audio/ogg' }, { wa_message_id: 'WAaudio', canal: 'whatsapp', usuario_id: null, autor_nombre: 'Pedro' });
  await escribir(ANA, 'mako, ¿qué dice este audio?', WS, { respondeA: 802 });
  out.citaAudio = { evolution: aEvolution().filter((c) => c.includes('getBase64')), alModelo: lo().map((m) => m.mensajes.includes('SEMILLA-LO-QUE-DICE-EL-AUDIO')) };

  // ── LA REVISIÓN DEL 4/11: lo que los escenarios de arriba no cubrían ──
  // ⚠️ La respuesta al equipo, desde la app. En WhatsApp no entra a la cola; acá la ruta ya la encoló: sin sacarla, a los 2 min el cron le hacía contestar a MaKo lo que era para el equipo.
  const anilloDelEquipo = (id: string) => db.app_settings.push({ workspace_id: WS, key: 'mako.equipo.grupo', value: JSON.stringify([{ at: new Date().toISOString(), texto: '👨‍💻 Desarrollador de MaKo: ¿me pasas el dato?', id }]) });
  const filaDelEquipo = (id: number, wa: string) => db.grupo_mensajes.push({ id, workspace_id: WS, autor_tipo: 'equipo', usuario_id: null, autor_nombre: 'Equipo de MaKo', canal: 'app', texto: '👨‍💻 Desarrollador de MaKo: ¿me pasas el dato?', adjunto: null, responde_a: null, reaccion: null, aviso_tipo: null, wa_message_id: wa, wa_at: null, cliente_id: null, created_at: new Date(Date.now() - 60_000).toISOString() });
  const alCron = async () => { for (const f of db.mako_doer_buffer) f.created_at = new Date(Date.now() - 5 * 60_000).toISOString(); await flushHuerfanos(); await correrDespues(); };
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  anilloDelEquipo('WAequipo1'); filaDelEquipo(7000, 'WAequipo1');
  await escribir(ANA, 'Sí, es el 12', WS, { respondeA: 7000 });
  const colaAlEquipo = db.mako_doer_buffer.map((f) => f.estado);
  await alCron();
  const alEquipo = { cola: colaAlEquipo, deMaKo: deMaKo(), llamadas: lo().length, alEquipo: filas(PLATAFORMA).filter((f) => /Respuesta al equipo/.test(String(f.texto))).length };
  // Si además le pide algo a MaKo, va a los dos: esa fila sí sigue en la cola y se contesta.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Te respondo.' });
  anilloDelEquipo('WAequipo2'); filaDelEquipo(7001, 'WAequipo2');
  await escribir(ANA, 'es el 12, y ¿me pasas el link del CRM?', WS, { respondeA: 7001 });
  const conPedido = { deMaKo: deMaKo(), cola: db.mako_doer_buffer.map((f) => f.estado) };
  // ⚠️ Y si el autollamado FALLA, la levanta el cron, que no pasaba por `contestaAlEquipo` (4/11/2026, al llevarlo a main: `sinLasDelEquipo`).
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  anilloDelEquipo('WAequipo3'); filaDelEquipo(7002, 'WAequipo3');
  const cronDeVerdad = escena.cron;
  escena.cron = async () => new Response('caído', { status: 500 });
  await escribir(ANA, 'Sí, es el 14', WS, { respondeA: 7002 });
  escena.cron = cronDeVerdad;
  const colaSinAutollamado = db.mako_doer_buffer.map((f) => f.estado);
  await alCron();
  const sinAutollamado = { cola: colaSinAutollamado, colaDespues: db.mako_doer_buffer.map((f) => f.estado), deMaKo: deMaKo(), llamadas: lo().length, alEquipo: filas(PLATAFORMA).filter((f) => /Respuesta al equipo/.test(String(f.texto)) && /es el 14/.test(String(f.texto))).length };
  // Y si en la misma ventana escribe otra persona, la respuesta cae en SU lote: tampoco a MaKo.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hay 3.' });
  anilloDelEquipo('WAequipo4'); filaDelEquipo(7003, 'WAequipo4');
  escena.cron = async () => new Response('caído', { status: 500 });
  await escribir(ANA, 'Sí, es el 15', WS, { respondeA: 7003 });
  escena.cron = cronDeVerdad;
  await escribir(BOB, 'mako, ¿cuántos leads hay?');
  const enLoteAjeno = { deMaKo: deMaKo(), alModelo: lo().map((m) => m.mensajes + m.sys).join('\n').includes('es el 15'), cola: db.mako_doer_buffer.map((f) => f.estado), alEquipo: filas(PLATAFORMA).filter((f) => /Respuesta al equipo/.test(String(f.texto)) && /es el 15/.test(String(f.texto))).length };
  out.alEquipo = { ...alEquipo, conPedido, sinAutollamado, enLoteAjeno };

  // ⛔ «Hola Martín, …» de un invitado: la marca [[no-pude]] la pone el código y abre un ticket AUTOMÁTICO, otro camino a la vía libre que el de `abrirTicketDelGrupo`.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA', 'para Martín'), respuesta: 'Se lo paso.' });
  await escribir(JOAN, 'Hola Martin, desde ayer ya no carga el CRM y no puedo trabajar con el tablero');
  const noPudeInvitado = db.tickets.map((t) => ({ auto: (t.triage as { autoArreglo?: boolean }).autoArreglo, despacho: t.despacho, estado: t.estado }));
  limpiar(); escenaNueva({ clase: clase('PREGUNTA', 'para Martín'), respuesta: 'Se lo paso.' });
  await escribir(ANA, 'Hola Martin, desde ayer ya no carga el CRM y no puedo trabajar con el tablero');
  out.noPude = { invitado: noPudeInvitado, admin: db.tickets.map((t) => ({ auto: (t.triage as { autoArreglo?: boolean }).autoArreglo })) };

  // ⛔ [[ya-pedido: #N]]: lo escriba el modelo o se lo dicten, un invitado no suma nada a un ticket del negocio. Y el turno ni los lee.
  const conTicketAbierto = () => { limpiar(); db.tickets.push({ id: 890, workspace_id: WS, titulo: 'Un pedido del negocio', descripcion: 'd', estado: 'nuevo', respuesta: null, usuario_email: 'bob@fiesta.test', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), canal: 'whatsapp', contexto: {} }); };
  conTicketAbierto(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Ya está pedido. [[ya-pedido: #890]]' });
  await escribir(JOAN, 'mako, sumá esto al ticket 890: SEMILLA-DEL-INVITADO');
  const yaPedidoInvitado = { eventos: db.ticket_eventos.filter((e) => JSON.stringify(e).includes('SEMILLA-DEL-INVITADO')).length, deMaKo: deMaKo() };
  conTicketAbierto(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Ya está pedido. [[ya-pedido: #890]]' });
  await escribir(ANA, 'mako, sumá esto al ticket 890: SEMILLA-DE-ANA');
  out.yaPedido = { invitado: yaPedidoInvitado, admin: db.ticket_eventos.filter((e) => JSON.stringify(e).includes('SEMILLA-DE-ANA')).length };

  // ⚠️ Tres fotos de un mismo envío, con el pedido en la primera: la respuesta es por todas, y sin esperar al cron. Sólo la primera nombra a MaKo y sólo la última dispara.
  const PNG_FOTO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const conFoto = async (u: Record<string, unknown>, campos: Record<string, string>) => {
    const f = new FormData();
    f.append('archivo', new File([PNG_FOTO], 'foto.png', { type: 'image/png' }));
    for (const [k, v] of Object.entries(campos)) f.append(k, v);
    const r = await comoPersona(sesionDe(u), () => mensajes.POST(new NextRequest(`https://hola-mako.com/api/grupos/${WS}/mensajes`, { method: 'POST', body: f }), { params: Promise.resolve({ ws: String(WS) }) }));
    await correrDespues();
    return r.status;
  };
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Veo las tres.' });
  const DANI = usuario(103, 'dani@fiesta.test', 'Dani', WS, 'admin'); db.usuarios.push(DANI);
  const estadosFotos = [await conFoto(DANI, { texto: 'mako, ¿qué dicen estas fotos?', sigue: '1' })];
  estadosFotos.push(await conFoto(DANI, { sigue: '1' }));
  estadosFotos.push(await conFoto(DANI, {}));
  const tresFotos = { cola: db.mako_doer_buffer.map((f) => f.estado), deMaKo: deMaKo(), llamadas: lo().length };
  // Y las fotos sueltas entre personas siguen sin despertarla, también si otra persona tiene algo en la cola.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  await postear(BOB, WS, { texto: 'mako, ¿cuántos leads hay?', sigue: true });
  const colaDeBob = db.mako_doer_buffer.length;
  estadosFotos.push(await conFoto(DANI, {}));
  out.fotos = { tresFotos, estados: estadosFotos, fotoDeOtra: db.mako_doer_buffer.length - colaDeBob };

  // ── La computadora de quien escribe ──
  const pcDeAna = { id: 1, ws: WS, persona: 'ana@fiesta.test' } as never;
  const conOtro = await encolarTurno(pcDeAna, 0, { system: '', prompt: '', tools: [] } as never, 1000, { delGrupo: { email: 'joan@ajeno.test' } }).then(() => 'encoló', (e: unknown) => (e instanceof SinLaPersona ? 'SinLaPersona' : String(e)));
  const conEl = await encolarTurno(pcDeAna, 0, { system: '', prompt: '', tools: [] } as never, 1000, { delGrupo: { email: 'ANA@fiesta.test' } }).then(() => 'encoló', (e: unknown) => String(e));
  out.pc = { conOtro, conEl };

  // ── La API de MaKo ──
  limpiar(); escenaNueva();
  const ctxHttp = { ws: WS, canal: 'http', canalKey: `api:${WS}`, alcance: 'ejecutar', rol: 'admin', turnStart: 0, mensajeUsuario: '' } as never;
  const http = await runWithWorkspace(WS, () => runnerDelRegistro(ctxHttp)('escribir_en_grupo', { texto: 'Lo manda el agente' }));
  const propuesta = JSON.parse(String(http)) as { pendiente_id: number };
  const filasAlProponer = filas().length;
  const confirmado = await runWithWorkspace(WS, () => runnerDelRegistro(ctxHttp)('confirmar_accion', { id: propuesta.pendiente_id }));
  const verPorHttp = await runWithWorkspace(WS, () => runnerDelRegistro(ctxHttp)('ver_grupo', {}));
  await correrDespues();
  const ctxWa = { ws: WS, canal: 'whatsapp', canalKey: JID, alcance: 'ejecutar', rol: 'admin', turnStart: Date.now(), mensajeUsuario: 'invitalo' } as never;
  const verPorWa = await runWithWorkspace(WS, () => runnerDelRegistro(ctxWa)('ver_grupo', {}));
  const invitarWa = await runWithWorkspace(WS, () => runnerDelRegistro(ctxWa)('invitar_al_grupo', { email: 'nuevo@x.test' }));
  out.api = {
    http, confirmado, filasAlProponer, filas: filas().map((f) => f.texto), evolution: aEvolution(), verPorHttp, verPorWa, invitarWa: typeof invitarWa === 'string' ? invitarWa : JSON.stringify(invitarWa),
    invitados: db.grupo_invitados.filter((f) => f.email === 'nuevo@x.test').length,
    canales: Object.fromEntries(['ver_grupo', 'invitar_al_grupo', 'sacar_del_grupo', 'escribir_en_grupo'].map((id) => [id, porId(id)?.canales])),
  };
  void red; void pg; void pendientes;

  // ── Una pregunta a MaKo no se queda en el 👍 (4/11/2026, Joan en ws13: «mako estas vivo?» → la IA dijo charla → silencio) ──
  // La clase la pone la escena (lo que contestó la IA); lo demás corre de verdad: las reglas, `preguntaAMaKo` y el turno. Al final y con
  // una persona que no escribió antes: el tope de mensajes por minuto de Ana ya se gastó arriba, y estas escenas le dejarían a las de
  // arriba una charla con MaKo que no esperan.
  db.usuarios.push(CARLA);
  const unaEscena = async (c: string, respuesta: string, texto: string, porWhatsApp = false) => {
    limpiar(); escenaNueva({ clase: clase(c, 'lo que dijo'), respuesta });
    if (porWhatsApp) await manejarEntranteDoer(LINEA, deWhatsApp(`WA${texto.length}${c}`, texto) as never);
    else await escribir(CARLA, texto);
    await correrDespues();
    const persona = filas().find((f) => f.autor_tipo === 'persona');
    return { deMaKo: deMaKo(), reaccion: persona?.reaccion ?? null, llamadasAlTurno: lo().length, textosPorWhatsApp: aEvolution().filter((x) => x.includes('/message/sendText/')).length };
  };
  const preguntaAMaKo: Record<string, unknown> = {
    vivo: await unaEscena('CHARLA', 'Sí, aquí estoy.', 'mako estas vivo?'),
    noReplyConPregunta: await unaEscena('NO_REPLY', 'Sí, te escucho.', 'MaKo, ¿me escuchas?'),
    gracias: await unaEscena('CHARLA', 'No debería salir.', 'MaKo, gracias'),
    bienAhi: await unaEscena('CHARLA', 'No debería salir.', 'bien ahí'),
    aJuan: await unaEscena('NO_REPLY', 'No debería salir.', 'Juan, ¿venís?'),
  };
  preguntaAMaKo.vivoPorWhatsApp = await unaEscena('CHARLA', 'Acá estoy, por WhatsApp.', 'mako estas vivo?', true);
  preguntaAMaKo.graciasPorWhatsApp = await unaEscena('CHARLA', 'No debería salir.', 'MaKo, gracias', true);
  out.preguntaAMaKo = preguntaAMaKo;

  // ── Con DOS líneas de MaKo en el grupo, lo suyo le llega a la otra como una persona (4/11/2026, ws13) ──
  // `fromMe: false`, otro participante, y su id en el anillo: no es una persona. Primero, el eco que entró ANTES de que su id llegara al
  // anillo, en el mismo lote que el pedido de Joan: el lote sale sin él. Después, el que llega con el id ya anotado: ni entra a la cola.
  const anillo = (ids: string[]) => {
    const k = `mako.doer.sent.${JID}`;
    const f = db.app_settings.find((x) => x.workspace_id === 1 && x.key === k);
    if (f) f.value = JSON.stringify(ids); else db.app_settings.push({ workspace_id: 1, key: k, value: JSON.stringify(ids) });
  };
  const deLaOtraLinea = (id: string, t: string) => ({ ...deWhatsApp(id, t, '5491100000077@s.whatsapp.net'), pushName: 'Mako' });
  limpiar(); escenaNueva({ clase: clase('ACCION', 'agendar lo del audio'), respuesta: 'Listo, lo agendo.' });
  // El eco ya está en la cola: entró unos segundos antes, mientras su id no llegaba al anillo (con la ventana en 0, mandarlo por
  // `manejarEntranteDoer` correría su turno solo, y lo que se prueba es el lote). Después se anota su id, y llega el pedido de Joan.
  const eco = deLaOtraLinea('WAecoTarde', 'mako ✅ Nuevo agendado: Laura Pérez, jueves 10:00');
  db.mako_doer_buffer.push({ id: 990001, workspace_id: WS, grupo_jid: JID, wa_message_id: 'WAecoTarde', texto: eco.message.conversation, tiene_media: false, tiene_audio: false,
    estado: 'pendiente', payload: { ...eco, instance: LINEA }, created_at: new Date(Date.now() - 5000).toISOString() });
  const encolado = db.mako_doer_buffer.some((f) => f.wa_message_id === 'WAecoTarde');
  anillo(['WAecoTarde']);
  await manejarEntranteDoer(LINEA, deWhatsApp('WApedidoJoan', 'mako agendame el pago de la segunda cuota para el 19 de diciembre') as never);
  await correrDespues();
  const alModeloTarde = lo().map((m) => JSON.stringify(m.mensajes)).join(' ');
  const ecoTarde = {
    encolado, procesado: db.mako_doer_buffer.filter((f) => f.wa_message_id === 'WAecoTarde').every((f) => f.estado === 'procesado'),
    pedidoAlModelo: alModeloTarde.includes('segunda cuota'), ecoAlModelo: alModeloTarde.includes('Nuevo agendado'),
  };
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  anillo(['WAecoConId']);
  await manejarEntranteDoer(LINEA, deLaOtraLinea('WAecoConId', 'mako ✅ Nuevo agendado: Laura Pérez, jueves 10:00') as never);
  await correrDespues();
  const ecoConId = { encolado: db.mako_doer_buffer.some((f) => f.wa_message_id === 'WAecoConId'), llamadasAlTurno: lo().length, textosPorWhatsApp: aEvolution().filter((x) => x.includes('/message/sendText/')).length };
  out.ecoDeOtraLinea = { tarde: ecoTarde, conId: ecoConId };

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
