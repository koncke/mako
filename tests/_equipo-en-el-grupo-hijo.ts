// =============================================================================
// Hijo de tests/equipo-en-el-grupo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El closer y el setter de un negocio en SU grupo de la app (13/11/2026): entran, ven el hilo sin lo de quien administra, y MaKo les contesta con lo que su rol ve en
// la app. El POST real con su sesión, el cron real sin sesión y el turno real; los modelos, de mentira (tests/_grupos-ops-arnes.ts). Quien administra es el control.

process.env.MAKO_DOER_VENTANA_MS = '0';
import { db, comoPersona, correrDespues, decirResultado, escena, escenaNueva, alModelo, pushes, sesionDe, usuario, OPENAI_NEGOCIO, PLATAFORMA } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10;
const JID = '120363000000000010@g.us';
const ANA = usuario(101, 'ana@fiesta.test', 'Ana', WS, 'admin');
const CRIS = usuario(102, 'cris@fiesta.test', 'Cris', WS, 'closer');
const SOFI = usuario(103, 'sofi@fiesta.test', 'Sofi', WS, 'setter');
const AJENA = usuario(104, 'ajena@otro.test', 'Ajena', 11, 'closer');
const clase = (c: string, resumen = 'lo que pide') => JSON.stringify({ clase: c, resumen, reenviado: false });

function limpiar() {
  for (const t of ['grupo_mensajes', 'mako_doer_conv', 'mako_doer_buffer', 'mako_doer_lock', 'mako_acciones_pendientes', 'tickets', 'ticket_eventos', 'insistencias']) db[t].splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.doer.') && f.key !== 'mako.onboarding.answers' && f.key !== 'mako.onboarding.schema');
}
/** Lo del negocio que un closer no ve en su pantalla: si llega a su turno, el test lo dice. */
function sembrar() {
  limpiar();
  db.app_settings.push(
    { workspace_id: WS, key: 'mako.onboarding.schema', value: JSON.stringify([{ key: 'negocio', label: 'Negocio', fields: [{ key: 'secreto', label: 'Secreto' }] }]) },
    { workspace_id: WS, key: 'mako.onboarding.answers', value: JSON.stringify({ secreto: 'SEMILLA-PERFIL' }) },
  );
  db.objectives.splice(0);
  db.objectives.push({ id: 1, workspace_id: WS, anio: 2026, quarter: null, estado: 'activo', titulo: 'SEMILLA-OBJETIVO', meta_valor: 1000, unidad: 'usd', orden: 1, metrica: 'manual', valor_manual: 123 });
  db.tickets.push({ id: 880, workspace_id: WS, titulo: 'SEMILLA-TICKET', descripcion: 'd', estado: 'nuevo', respuesta: null, usuario_email: 'ana@fiesta.test', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), canal: 'whatsapp', contexto: {} });
  db.mako_acciones_pendientes.push({ id: 881, workspace_id: WS, grupo_jid: JID, tipo: 'proponer_estado_campana', payload: { campana: 'x' }, resumen: 'SEMILLA-PENDIENTE', estado: 'pendiente', vence_at: new Date(Date.now() + 3600_000).toISOString(), origen: 'hola-mako', created_at: new Date(Date.now() - 60_000).toISOString() });
  db.mako_doer_conv.push(
    { id: 882, workspace_id: WS, grupo_jid: JID, role: 'user', content: 'SEMILLA-CHARLA-DEL-DUENO', wa_message_id: null, created_at: new Date(Date.now() - 3600_000).toISOString() },
    { id: 883, workspace_id: WS, grupo_jid: JID, role: 'assistant', content: 'SEMILLA-RESPUESTA-AL-DUENO', wa_message_id: null, created_at: new Date(Date.now() - 3500_000).toISOString() },
  );
  db.grupo_mensajes.push(
    { id: 50, workspace_id: WS, autor_tipo: 'mako', usuario_id: null, autor_nombre: 'MaKo', canal: 'app', texto: 'Llegó un lead nuevo: Pedro.', adjunto: null, responde_a: null, reaccion: null, aviso_tipo: 'chatbot-aviso-equipo', wa_message_id: null, wa_at: null, cliente_id: null, created_at: new Date(Date.now() - 7200_000).toISOString() },
    { id: 51, workspace_id: WS, autor_tipo: 'equipo', usuario_id: null, autor_nombre: 'Equipo de MaKo', canal: 'app', texto: 'SEMILLA-RECIBO: Recibo de pago N.º 7.', adjunto: null, responde_a: null, reaccion: null, aviso_tipo: 'recibo', wa_message_id: null, wa_at: null, cliente_id: null, created_at: new Date(Date.now() - 7000_000).toISOString() },
  );
}

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' },
    { id: WS, capa: 'completo', nombre: 'Fiesta', estado: 'activo' }, { id: 11, capa: 'completo', nombre: 'Otro', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_superadmin_x' });
  db.usuarios.push(ANA, CRIS, SOFI, AJENA);
  db.push_suscripciones.push(
    { id: 1, usuario_id: 101, endpoint: 'https://push.test/ana', p256dh: 'p', auth: 'a', fallos: 0 },
    { id: 2, usuario_id: 102, endpoint: 'https://push.test/cris', p256dh: 'p', auth: 'a', fallos: 0 },
  );
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales.push({ workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, WS, 'OPENAI_API_KEY'), servicio: 'openai' });

  const { NextRequest } = await import('next/server');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');
  const cron = await import('../app/api/cron/grupo-turno/route');
  escena.cron = (req: Request) => cron.POST(new NextRequest(req.url, { method: req.method, headers: req.headers, body: (req as unknown as { body?: BodyInit }).body, duplex: 'half' } as never));
  const { copiarAlGrupo } = await import('../lib/grupo-app');
  const { REGISTRO } = await import('../lib/api-mako/registro');

  const leer = (u: Record<string, unknown>) => comoPersona(sesionDe(u), async () => {
    const x = await mensajes.GET(new NextRequest(`https://hola-mako.com/api/grupos/${WS}/mensajes`), { params: Promise.resolve({ ws: String(WS) }) });
    return { status: x.status, body: await x.json() as Record<string, any> };
  });
  const escribir = async (u: Record<string, unknown>, texto: string) => {
    const r = await comoPersona(sesionDe(u), async () => {
      const x = await mensajes.POST(new NextRequest(`https://hola-mako.com/api/grupos/${WS}/mensajes`, { method: 'POST', body: JSON.stringify({ texto }), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ ws: String(WS) }) });
      return x.status;
    });
    await correrDespues();
    return r;
  };
  const turnos = () => alModelo().map((m) => ({ tools: m.tools, todo: m.system + m.mensajes }));
  const out: Record<string, unknown> = {};
  const def = (id: string) => (REGISTRO as Array<{ id: string; gating?: { tab?: string; rolMinimo?: string }; datosDeGoogle?: true }>).find((d) => d.id === id);
  out.defs = Object.fromEntries((REGISTRO as Array<{ id: string; gating?: { tab?: string; rolMinimo?: string }; datosDeGoogle?: true }>).map((d) => [d.id, { tab: d.gating?.tab ?? null, admin: d.gating?.rolMinimo === 'admin', google: !!d.datosDeGoogle }]));
  void def;

  // 1. Quién entra y qué ve del hilo.
  sembrar(); escenaNueva({ clase: clase('PREGUNTA') });
  const hiloCris = await leer(CRIS);
  const hiloAna = await leer(ANA);
  out.hilo = {
    cris: hiloCris.status, crisTextos: (hiloCris.body.mensajes ?? []).map((m: { texto: string }) => m.texto),
    ana: hiloAna.status, anaTextos: (hiloAna.body.mensajes ?? []).map((m: { texto: string }) => m.texto),
    ajena: (await leer(AJENA)).status,
  };

  // 2. El control: quien administra pregunta por los leads.
  const PREGUNTA_LEADS = 'mako, ¿cuántos leads entraron hoy y qué dice la ficha de Pedro?';
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'leads de hoy'), respuesta: 'Entraron 2.' });
  await escribir(ANA, PREGUNTA_LEADS);
  out.ana = turnos();

  // 3. El closer, lo mismo.
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'leads de hoy'), respuesta: 'Entraron 2.' });
  const stCris = await escribir(CRIS, PREGUNTA_LEADS);
  out.cris = { status: stCris, turnos: turnos(), hilo: db.grupo_mensajes.filter((f) => f.workspace_id === WS && f.autor_tipo === 'mako' && Number(f.id) > 51).map((f) => f.texto),
    conv: db.mako_doer_conv.map((f) => ({ jid: f.grupo_jid, role: f.role })) };

  // 4. Lo de email: el setter lo ve, el closer no.
  const PREGUNTA_EMAIL = 'mako, ¿cómo van las secuencias de email y los broadcasts?';
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'secuencias de email'), respuesta: 'Van bien.' });
  await escribir(SOFI, PREGUNTA_EMAIL);
  out.sofiEmail = turnos();
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'secuencias de email'), respuesta: 'Van bien.' });
  await escribir(CRIS, PREGUNTA_EMAIL);
  out.crisEmail = turnos();
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'secuencias de email'), respuesta: 'Van bien.' });
  await escribir(ANA, PREGUNTA_EMAIL);
  out.anaEmail = turnos();

  // 5. Lo que el closer pide de plata o del dueño: sin herramientas de eso.
  const PREGUNTA_PLATA = 'mako, ¿cuánto facturamos este mes y cómo vamos con el objetivo? y mostrame la agenda de mañana';
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'facturación y agenda'), respuesta: 'Eso lo ve quien administra.' });
  await escribir(CRIS, PREGUNTA_PLATA);
  out.crisPlata = turnos();
  sembrar(); escenaNueva({ clase: clase('PREGUNTA', 'facturación y agenda'), respuesta: 'Facturaste mucho.' });
  await escribir(ANA, PREGUNTA_PLATA);
  out.anaPlata = turnos();

  // 6. El push: el recibo no le suena al closer; un aviso de un lead, sí.
  limpiar(); escenaNueva({});
  pushes.splice(0);
  await copiarAlGrupo(WS, { texto: 'Recibo de pago N.º 8.', de: 'equipo', avisoTipo: 'recibo' });
  await correrDespues();
  const pushRecibo = pushes.map((p) => p.endpoint);
  pushes.splice(0);
  await copiarAlGrupo(WS, { texto: 'Llegó un lead nuevo: Juan.', avisoTipo: 'chatbot-aviso-equipo' });
  await correrDespues();
  out.push = { recibo: pushRecibo, lead: pushes.map((p) => p.endpoint) };

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
