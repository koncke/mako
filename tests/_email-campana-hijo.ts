// =============================================================================
// Hijo de los tests de la campaña de email por la API (4/11/2026) — NO es un test (no termina en .test.ts)
// =============================================================================
// La campaña de Mauricio (ws 1, un cliente): 14 emails, uno cada 24 h, a todos sus leads menos los ganados, armada
// desde su Claude con la API de MaKo. Este hijo corre el código REAL (los runners de la API, las libs y el motor) contra
// un PostgREST en memoria (tests/_postgrest-de-mentira.ts) y un Resend de mentira que anota lo que se le pide. Nada sale a
// la red real: lo que no es la base ni Resend se anota en `otros` y tiene que dar vacío.
//
// Corre con: node --conditions=react-server --import tsx tests/_email-campana-hijo.ts <escenario>
// Escenarios: 'dominio' (puntos 1 y 2: conectar el dominio, el seguimiento, el remitente y el reply_to); 'claves' (la key
// que administra dominios y la que manda, separadas: tests/resend-clave-admin.test.ts).
// Imprime el resultado después de la marca @@RESULTADO@@.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'srk-de-prueba';
process.env.RESEND_API_KEY = 're_de_la_plataforma';
// La que administra dominios (4/11/2026): aparte de la que manda, y sólo la lee lib/resend-dominios.ts.
process.env.RESEND_ADMIN_API_KEY = 're_admin_de_la_plataforma';
process.env.CREDENCIALES_SECRET = 'secreto-de-cifrado-de-prueba-suficientemente-largo';
process.env.UNSUBSCRIBE_SECRET = 'secreto-de-baja-de-prueba';

const ESC = process.argv[2] ?? 'dominio';
const ahora = () => new Date().toISOString();
let siguienteId = 7000;

const TABLAS = [
  'workspaces', 'app_settings', 'credenciales', 'usuarios', 'leads', 'funnels', 'lead_funnel', 'lead_audit', 'lead_events', 'lead_historial',
  'nutricion_secuencias', 'nutricion_inscripciones', 'nutricion_envios', 'email_broadcasts', 'email_broadcast_envios', 'notificaciones',
  'productos', 'pagos', 'wa_borradores', 'mako_acciones_pendientes',
] as const;
const pg = crearPostgrest({
  tablas: TABLAS,
  orCompleto: true,
  defaults: (tabla, f) => {
    const base: Fila = { id: siguienteId++, created_at: ahora(), updated_at: ahora() };
    if (tabla === 'app_settings' || tabla === 'credenciales') delete base.id;
    // Los defaults de la base (mig 0241): sin esto el compare-and-set de los CRON no encuentra la fila.
    if (tabla === 'nutricion_secuencias') Object.assign(base, { disparadores: null, disparadores_rev: 0, funnel_id: null, etiqueta_id: null, producto_id: null, etapas: null, cron: null, cron_proxima_at: null, archivada_at: null });
    return { ...base, ...f };
  },
  unicos: [
    { tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_pkey' },
    { tabla: 'lead_funnel', columnas: ['workspace_id', 'lead_id', 'funnel_id'], donde: () => true, nombre: 'lead_funnel_uk' },
  ],
});
const db = pg.db as Record<string, Fila[]>;

// ── Resend de mentira ──────────────────────────────────────────────────────────────────────
// Desde el 4/11/2026 (cada negocio con su cuenta de Resend) las CUENTAS están separadas: un dominio o un webhook es de la
// clave que lo creó, y otra clave no lo ve (404). `re_solo_envio` es una clave de sólo envío: manda, y /domains y /webhooks
// le contestan `restricted_api_key`, como Resend.
type Pedido = { metodo: string; path: string; body: Record<string, unknown> | null; clave: string | null };
const resend: Pedido[] = [];
const dominios = new Map<string, Fila>();
const webhooks = new Map<string, Fila>();
let estadoDelDominio = 'not_started';
const otros: string[] = [];
const CLAVE_SOLO_ENVIO = 're_solo_envio';
const json = (status: number, b: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...extra } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.resend.com') {
    const metodo = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) as Record<string, unknown> : null;
    const auth = new Headers(init.headers).get('authorization');
    const clave = auth?.replace(/^Bearer /, '') ?? null;
    resend.push({ metodo, path: u.pathname, body, clave });
    if (clave === CLAVE_SOLO_ENVIO && !u.pathname.startsWith('/emails')) {
      return json(401, { statusCode: 401, name: 'restricted_api_key', message: 'This API key is restricted to only send emails' });
    }
    if (u.pathname === '/domains' && metodo === 'POST') {
      const name = String(body?.name);
      const d: Fila = {
        id: `dom-${name}`, name, status: 'not_started', region: 'sa-east-1', open_tracking: false, click_tracking: false, cuenta: clave,
        records: [
          { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=MIGf', ttl: 'Auto', status: 'not_started' },
          { record: 'SPF', name: 'send', type: 'MX', value: 'feedback-smtp.sa-east-1.amazonses.com', priority: 10, ttl: 'Auto', status: 'not_started' },
        ],
      };
      dominios.set(String(d.id), d);
      return json(201, d);
    }
    if (u.pathname === '/domains' && metodo === 'GET') {
      return json(200, { object: 'list', data: [...dominios.values()].filter((d) => d.cuenta === clave).map((d) => ({ id: d.id, name: d.name, status: estadoDelDominio })) });
    }
    const m = /^\/domains\/([^/]+)(\/verify)?$/.exec(u.pathname);
    if (m) {
      const d = dominios.get(decodeURIComponent(m[1]));
      if (!d || d.cuenta !== clave) return json(404, { statusCode: 404, name: 'not_found', message: 'Domain not found' });
      if (m[2] && metodo === 'POST') return json(200, { object: 'domain', id: d.id });
      if (metodo === 'PATCH') {
        if (typeof body?.open_tracking === 'boolean') d.open_tracking = body.open_tracking;
        if (typeof body?.click_tracking === 'boolean') d.click_tracking = body.click_tracking;
        return json(200, { object: 'domain', id: d.id });
      }
      const { cuenta: _c, ...publico } = d;
      return json(200, { ...publico, status: estadoDelDominio, object: 'domain' });
    }
    if (u.pathname === '/webhooks' && metodo === 'GET') {
      return json(200, { object: 'list', has_more: false, data: [...webhooks.values()].filter((w) => w.cuenta === clave).map((w) => ({ id: w.id, endpoint: w.endpoint, status: w.status, events: w.events, created_at: ahora() })) });
    }
    if (u.pathname === '/webhooks' && metodo === 'POST') {
      const id = `wh-${webhooks.size + 1}`;
      const secreto = `whsec_${Buffer.from(`secreto-de-${clave}-${id}`).toString('base64')}`;
      webhooks.set(id, { id, endpoint: body?.endpoint, events: body?.events, status: 'enabled', signing_secret: secreto, cuenta: clave });
      return json(201, { object: 'webhook', id, signing_secret: secreto });
    }
    const w = /^\/webhooks\/([^/]+)$/.exec(u.pathname);
    if (w) {
      const wh = webhooks.get(decodeURIComponent(w[1]));
      if (!wh || wh.cuenta !== clave) return json(404, { statusCode: 404, name: 'not_found', message: 'Webhook not found' });
      if (metodo === 'PATCH') { Object.assign(wh, body ?? {}); return json(200, { object: 'webhook', id: wh.id }); }
      const { cuenta: _c, ...publico } = wh;
      return json(200, { object: 'webhook', created_at: ahora(), ...publico });
    }
    if (u.pathname === '/emails' && metodo === 'POST') return json(200, { id: `em-${resend.length}` });
    return json(404, { message: 'sin mock' });
  }
  otros.push(`${u.host}${u.pathname}`);
  return json(500, { error: 'sin red' });
}) as typeof fetch;

const PLATAFORMA = 9, NEGOCIO = 3, OTRO = 5;
/** La clave de la cuenta de Resend PROPIA del negocio (4/11/2026): sin ella, su email no sale. */
const CLAVE_NEGOCIO = 're_del_negocio';
/** La persona pega su clave en el modal de MaKo (Integraciones → Resend): queda cifrada en SU fila, como la guarda el modal. */
async function cuentaPropia(ws: number, valor = CLAVE_NEGOCIO): Promise<void> {
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales = db.credenciales.filter((f) => !(Number(f.workspace_id) === ws && f.clave === 'RESEND_API_KEY'));
  pg.db.credenciales = db.credenciales;
  db.credenciales.push({ workspace_id: ws, clave: 'RESEND_API_KEY', valor_enc: cifrarSecreto(valor, ws, 'RESEND_API_KEY'), servicio: 'email', updated_by: 'prueba', updated_at: ahora() });
}

type Ctx = { ws: number; canal: 'http'; canalKey: string; alcance: 'ejecutar'; rol: 'admin'; actor: string };
type Runner = {
  preparar?: (i: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>;
  ejecutar?: (p: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>;
  leer?: (i: Record<string, unknown>, c: Ctx) => Promise<string | { content: string }>;
};
const ctx = (ws: number): Ctx => ({ ws, canal: 'http', canalKey: 'http:prueba', alcance: 'ejecutar', rol: 'admin', actor: 'Mauricio' });
const setting = (ws: number, key: string) => db.app_settings.find((f) => Number(f.workspace_id) === ws && f.key === key)?.value ?? null;

async function escenarioDominio(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const marketing = await import('../lib/email-marketing');
  const conectar = runnerDe('conectar_dominio_email') as unknown as Runner;
  const remitente = runnerDe('fijar_remitente_email') as unknown as Runner;
  const verificar = runnerDe('verificar_dominio_envio') as unknown as Runner;
  const enNegocio = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const out: Record<string, unknown> = {};

  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  db.workspaces.push({ id: NEGOCIO, nombre: 'Elevate', capa: 'completo', estado: 'activo' });
  db.workspaces.push({ id: OTRO, nombre: 'Otro', capa: 'completo', estado: 'activo' });
  db.app_settings.push({ workspace_id: OTRO, key: 'resend_domain', value: 'de-otro.com' });

  // Lo que no se puede, antes de escribir: el dominio de MaKo, el de otro negocio y uno que no es un dominio.
  out.deMako = await enNegocio(() => conectar.preparar!({ dominio: 'hola-mako.com' }, ctx(NEGOCIO)));
  out.deOtro = await enNegocio(() => conectar.preparar!({ dominio: 'https://de-otro.com/x' }, ctx(NEGOCIO)));
  out.invalido = await enNegocio(() => conectar.preparar!({ dominio: 'no es un dominio' }, ctx(NEGOCIO)));
  // El remitente con un dominio de MaKo cargado (el ws 1 lo tuvo de cuando era la plataforma): tampoco.
  db.app_settings.push({ workspace_id: NEGOCIO, key: 'resend_domain', value: 'hola-mako.com' }, { workspace_id: NEGOCIO, key: 'resend_domain_id', value: 'dom-mako' });
  out.remitenteDeMako = await enNegocio(() => remitente.preparar!({ nombre: 'Mauricio', local: 'hola' }, ctx(NEGOCIO)));
  db.app_settings = db.app_settings.filter((f) => !(Number(f.workspace_id) === NEGOCIO && String(f.key).startsWith('resend_domain')));
  pg.db.app_settings = db.app_settings;
  // El estado dice si el negocio es la plataforma (el «De» del editor lo usa).
  const { estadoDominio } = await import('../lib/email-dominio');
  out.plataformaNegocio = (await enNegocio(() => estadoDominio(NEGOCIO))).plataforma;
  out.plataformaMaKo = (await runWithWorkspace(PLATAFORMA, () => estadoDominio(PLATAFORMA))).plataforma;
  out.resendAntes = resend.length;

  // Conectar el suyo: alta, seguimiento prendido y los registros DNS.
  const prep = await enNegocio(() => conectar.preparar!({ dominio: 'https://www.Elevate.com.mx/inicio' }, ctx(NEGOCIO)));
  out.prepConectar = prep;
  out.conectar = await enNegocio(() => conectar.ejecutar!(prep.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.dominioGuardado = setting(NEGOCIO, 'resend_domain');
  out.idGuardado = setting(NEGOCIO, 'resend_domain_id');
  out.altaEnResend = resend.filter((p) => p.path === '/domains' && p.metodo === 'POST').map((p) => p.body);
  out.patches = resend.filter((p) => p.metodo === 'PATCH').map((p) => ({ path: p.path, body: p.body }));
  out.dominioEnResend = structuredClone(dominios.get('dom-elevate.com.mx'));

  // El remitente, antes de verificar: no.
  out.remitenteSinVerificar = await enNegocio(() => remitente.preparar!({ nombre: 'Mauricio', local: 'hola' }, ctx(NEGOCIO)));
  // Verificar: si el seguimiento está apagado (un dominio de antes), lo prende.
  const d = dominios.get('dom-elevate.com.mx')!;
  d.open_tracking = false; d.click_tracking = false;
  estadoDelDominio = 'verified';
  const pv = await enNegocio(() => verificar.preparar!({}, ctx(NEGOCIO)));
  out.verificar = await enNegocio(() => verificar.ejecutar!(pv.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.trasVerificar = { open: d.open_tracking, click: d.click_tracking };
  // Un responderA inválido no pasa.
  out.responderAMalo = await enNegocio(() => remitente.preparar!({ nombre: 'Mauricio', local: 'hola', responderA: 'mauricio arroba gmail' }, ctx(NEGOCIO)));
  const pr = await enNegocio(() => remitente.preparar!({ nombre: 'Mauricio <x>', local: 'Hola', responderA: 'Mauricio.Personal@Gmail.com' }, ctx(NEGOCIO)));
  out.prepRemitente = pr;
  out.remitente = await enNegocio(() => remitente.ejecutar!(pr.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.from = setting(NEGOCIO, 'resend_from');
  out.replyTo = setting(NEGOCIO, 'resend_reply_to');

  // El reply_to viaja en lo que manda el negocio: el broadcast (y su prueba).
  db.email_broadcasts.push({ id: 41, workspace_id: NEGOCIO, asunto: 'Hola {nombre}', preheader: '', cuerpo: 'Texto', segmento: 'activos', estado: 'borrador' });
  db.leads.push({ id: 501, workspace_id: NEGOCIO, nombre: 'Ana', email: 'ana@cliente.test', estado_lead: 'abierto', email_opt_out: false, created_at: ahora() });
  resend.length = 0;
  out.prueba = await enNegocio(() => marketing.enviarBroadcastPrueba(41, 'mauricio@personal.test'));
  db.app_settings.push({ workspace_id: NEGOCIO, key: 'envio_email_enabled', value: 'true' });
  out.envio = await enNegocio(() => marketing.enviarBroadcast(41));
  out.emails = resend.filter((p) => p.path === '/emails').map((p) => ({ to: p.body?.to, from: p.body?.from, reply_to: p.body?.reply_to ?? null }));

  // Sacar el responderA: las respuestas vuelven al remitente.
  const sin = await enNegocio(() => remitente.preparar!({ nombre: 'Mauricio', local: 'hola', sinResponderA: true }, ctx(NEGOCIO)));
  out.sinResponderA = await enNegocio(() => remitente.ejecutar!(sin.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.replyToTrasSacar = setting(NEGOCIO, 'resend_reply_to');
  return out;
}

// ── Las keys de Resend (4/11/2026): cada negocio con la suya; la de administración de MaKo, sólo para el dominio de MaKo ──
// Se mira el `Authorization` de cada pedido a Resend: de quién es cada pedido lo dice la clave que lo firmó.
async function escenarioClaves(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const marketing = await import('../lib/email-marketing');
  const { sendEmail } = await import('../lib/resend');
  const { REMITENTE_MAKO } = await import('../lib/app-url');
  const conectar = runnerDe('conectar_dominio_email') as unknown as Runner;
  const verificar = runnerDe('verificar_dominio_envio') as unknown as Runner;
  const enNegocio = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const enPlataforma = <T,>(fn: () => Promise<T>) => runWithWorkspace(PLATAFORMA, fn);
  const out: Record<string, unknown> = {};
  const desde = (i: number) => resend.slice(i);
  const clavesDe = (ps: Pedido[], pref: string) => [...new Set(ps.filter((p) => p.path.startsWith(pref)).map((p) => p.clave))];

  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  db.workspaces.push({ id: NEGOCIO, nombre: 'Elevate', capa: 'completo', estado: 'activo' });

  // 1) La plataforma sin la de administración: no se administra el dominio de MaKo, el error es de MaKo y nada sale a Resend.
  const admin = process.env.RESEND_ADMIN_API_KEY;
  delete process.env.RESEND_ADMIN_API_KEY;
  let i = resend.length;
  out.platSinClave = await enPlataforma(() => conectar.preparar!({ dominio: 'hola-mako.com' }, ctx(PLATAFORMA)));
  out.platSinClavePedidos = desde(i).length;
  process.env.RESEND_ADMIN_API_KEY = admin;

  // 2) Con ella: el dominio de MaKo, con la de administración.
  i = resend.length;
  const pp = await enPlataforma(() => conectar.preparar!({ dominio: 'hola-mako.com' }, ctx(PLATAFORMA)));
  out.platConectar = await enPlataforma(() => conectar.ejecutar!(pp.payload as Record<string, unknown>, ctx(PLATAFORMA)));
  out.clavesPlataforma = clavesDe(desde(i), '/');

  // 3) El negocio con SU cuenta: el dominio, la verificación, el webhook y su email, con la suya. El aviso de MaKo, con la de MaKo.
  await cuentaPropia(NEGOCIO);
  i = resend.length;
  const prep = await enNegocio(() => conectar.preparar!({ dominio: 'elevate.com.mx' }, ctx(NEGOCIO)));
  out.conectar = await enNegocio(() => conectar.ejecutar!(prep.payload as Record<string, unknown>, ctx(NEGOCIO)));
  estadoDelDominio = 'verified';
  const pv = await enNegocio(() => verificar.preparar!({}, ctx(NEGOCIO)));
  out.verificar = await enNegocio(() => verificar.ejecutar!(pv.payload as Record<string, unknown>, ctx(NEGOCIO)));
  db.app_settings.push({ workspace_id: NEGOCIO, key: 'resend_from', value: 'Elevate <hola@elevate.com.mx>' });
  db.email_broadcasts.push({ id: 42, workspace_id: NEGOCIO, asunto: 'Hola {nombre}', preheader: '', cuerpo: 'Texto', segmento: 'activos', estado: 'borrador' });
  out.prueba = await enNegocio(() => marketing.enviarBroadcastPrueba(42, 'mauricio@personal.test'));
  const delNegocio = desde(i);
  i = resend.length;
  out.aviso = await enNegocio(() => sendEmail({ to: 'martin@prueba.test', from: REMITENTE_MAKO, subject: 'Aviso', html: '<p>Hola</p>', text: 'Hola' }));
  out.clavesNegocio = { administrar: [...new Set(delNegocio.filter((p) => !p.path.startsWith('/emails')).map((p) => p.clave))], envios: clavesDe(delNegocio, '/emails') };
  out.clavesAviso = clavesDe(desde(i), '/emails');
  out.otros = otros;
  return out;
}

// ── El CRM «Email Marketing» de la campaña: entrada, enviado, abrió, clic (y las terminales que suma el embudo) ─────────
const etapa = (key: string, label: string, kind: string) => ({ key, label, kind, dot: '#888888', tone: 'slate', band: 'pipeline' });
const PIPELINE_EMAIL = [etapa('em_entrada', 'Entrada', 'entrada'), etapa('em_enviado', 'Enviado', 'paso'), etapa('em_abrio', 'Abrió', 'paso'), etapa('em_clic', 'Hizo clic', 'paso')];
const CASA = 1, EMAIL = 20;
function sembrarCrm(ws: number) {
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  db.workspaces.push({ id: ws, nombre: 'Elevate', capa: 'completo', estado: 'activo' });
  db.funnels.push({ id: CASA, workspace_id: ws, nombre: 'Funnel principal', canal: 'llamada', es_default: true, declarado: true, activo: true, orden: 0, data: {} });
  db.funnels.push({ id: EMAIL, workspace_id: ws, nombre: 'Email Marketing', canal: 'llamada', es_default: false, declarado: true, activo: true, orden: 1, data: { pipeline: PIPELINE_EMAIL } });
  const lead = (id: number, estado: string, email: string | null, extra: Fila = {}) =>
    db.leads.push({ id, workspace_id: ws, nombre: `Lead ${id}`, email, telefono: null, estado_lead: estado, funnel_id: null, pipeline_stage: estado === 'ganado' ? 'ganado' : 'lead', created_at: '2026-06-01T10:00:00Z', ...extra });
  lead(601, 'abierto', 'a601@cliente.test');
  lead(602, 'abierto', 'a602@cliente.test');
  lead(603, 'ganado', 'g603@cliente.test');
  lead(604, 'abierto', null);
  lead(605, 'perdido', 'p605@cliente.test');
  lead(606, 'abierto', 'a606@cliente.test', { funnel_id: EMAIL, pipeline_stage: 'em_entrada' });   // su casa ya es el CRM de email
  db.lead_funnel.push({ id: 801, workspace_id: ws, lead_id: 602, funnel_id: EMAIL, etapa: 'em_abrio', etapa_desde: '2026-10-01T10:00:00Z', created_at: '2026-10-01T10:00:00Z' });
}

async function escenarioLote(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { etapasDeProducto } = await import('../lib/lead-funnel');
  const agregar = runnerDe('agregar_en_bloque_a_crm') as unknown as Runner;
  const en = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const out: Record<string, unknown> = {};
  sembrarCrm(NEGOCIO);
  out.etapas = (await en(() => etapasDeProducto(EMAIL))).map((e) => e.key);
  const casasAntes = structuredClone(db.leads.map((l) => ({ id: l.id, funnel_id: l.funnel_id, pipeline_stage: l.pipeline_stage })));

  out.sinNada = await en(() => agregar.preparar!({ haciaEmbudoId: EMAIL }, ctx(NEGOCIO)));
  out.estadoRaro = await en(() => agregar.preparar!({ haciaEmbudoId: EMAIL, todos: true, excluirEstados: ['vendido'] }, ctx(NEGOCIO)));
  out.crmAjeno = await en(() => agregar.preparar!({ haciaEmbudoId: 999, todos: true }, ctx(NEGOCIO)));
  const prep = await en(() => agregar.preparar!({ haciaEmbudoId: EMAIL, todos: true, excluirEstados: ['ganado'], soloConEmail: true }, ctx(NEGOCIO)));
  out.prep = prep;
  out.ejec = await en(() => agregar.ejecutar!(prep.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.filas = db.lead_funnel.filter((f) => Number(f.funnel_id) === EMAIL).map((f) => ({ lead: Number(f.lead_id), etapa: f.etapa })).sort((a, b) => a.lead - b.lead);
  out.casasIguales = JSON.stringify(casasAntes) === JSON.stringify(db.leads.map((l) => ({ id: l.id, funnel_id: l.funnel_id, pipeline_stage: l.pipeline_stage })));
  out.historial = db.lead_audit.filter((h) => h.campo === 'Funnel').map((h) => Number(h.lead_id)).sort();

  // Con una automatización ACTIVA en la entrada, no: les escribiría a todos en la próxima vuelta.
  db.nutricion_secuencias.push({ id: 71, workspace_id: NEGOCIO, nombre: 'Campaña', clave: 'campana', activa: true, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'em_entrada', funnel_id: EMAIL, pasos: [{ orden: 1, canal: 'email', delay_horas: 0, asunto: 'Hola', cuerpo: 'x' }] });
  out.conAutomatizacion = await en(() => agregar.preparar!({ haciaEmbudoId: EMAIL, leadIds: ['601'] }, ctx(NEGOCIO)));
  // Y si la prendieron entre el «sí» y el ejecutar, tampoco.
  out.ejecConAutomatizacion = await en(() => agregar.ejecutar!(prep.payload as Record<string, unknown>, ctx(NEGOCIO)));
  // Sin tiempo (por HTTP la ruta corta a los 60 s): no escribe nada y devuelve lo que quedó, para pedirlo de nuevo.
  const { agregarLoteAProducto } = await import('../lib/lead-funnel');
  const antes = db.lead_funnel.length;
  out.sinTiempo = await en(() => agregarLoteAProducto([604], EMAIL, 'prueba', { hasta: Date.now() - 1 }));
  out.sinTiempoEscribio = db.lead_funnel.length - antes;
  return out;
}

/** Suma al CRM de email a todos menos los ganados, con el runner real: lo que hace Mauricio antes de crear la secuencia. */
async function sumarAlCrm(): Promise<void> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const agregar = runnerDe('agregar_en_bloque_a_crm') as unknown as Runner;
  await runWithWorkspace(NEGOCIO, async () => {
    const p = await agregar.preparar!({ haciaEmbudoId: EMAIL, todos: true, excluirEstados: ['ganado'], soloConEmail: true }, ctx(NEGOCIO));
    await agregar.ejecutar!(p.payload as Record<string, unknown>, ctx(NEGOCIO));
  });
}

async function escenarioSecuencia(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { planificarInscripciones } = await import('../lib/nutricion');
  const crear = runnerDe('crear_secuencia_email') as unknown as Runner;
  const editar = runnerDe('editar_meta_secuencia_email') as unknown as Runner;
  const en = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const out: Record<string, unknown> = {};
  sembrarCrm(NEGOCIO);
  await sumarAlCrm();

  out.columnaQueNoEs = await en(() => crear.preparar!({ nombre: 'Campaña', funnelId: EMAIL, trigger: 'etapa_actual', etapa: 'no_existe' }, ctx(NEGOCIO)));
  out.crmAjeno = await en(() => crear.preparar!({ nombre: 'Campaña', funnelId: 999 }, ctx(NEGOCIO)));
  const prep = await en(() => crear.preparar!({ nombre: 'Campaña 14', funnelId: EMAIL }, ctx(NEGOCIO)));
  out.prep = prep;
  out.ejec = await en(() => crear.ejecutar!(prep.payload as Record<string, unknown>, ctx(NEGOCIO)));
  const id = Number((out.ejec as { datos?: { id?: number } }).datos?.id);
  const fila = () => db.nutricion_secuencias.find((f) => Number(f.id) === id)!;
  out.fila = (({ trigger_tipo, etapa, funnel_id, activa }) => ({ trigger_tipo, etapa, funnel_id, activa }))(fila());

  // Con pasos y activa: el barrido inscribe a los AGREGADOS abiertos de la columna de entrada.
  Object.assign(fila(), { activa: true, archivada_at: null, pasos: [{ id: 'm1', orden: 1, canal: 'email', delay_horas: 0, asunto: 'Hola', cuerpo: 'Uno' }, { id: 'm2', orden: 2, canal: 'email', delay_horas: 24, asunto: 'Dos', cuerpo: 'Dos' }] });
  out.plan = (await en(() => planificarInscripciones())).filter((p) => p.secuencia === fila().clave).map((p) => p.lead_id).sort();
  // Activa, no se le cambia el CRM: es cambiar a quién le escribe.
  out.cambiarCrmActiva = await en(() => editar.preparar!({ id, sinCrm: true }, ctx(NEGOCIO)));
  // Pausada, sí: y sin CRM, mira sólo la casa de cada lead, y los agregados no entran.
  fila().activa = false;
  const pe = await en(() => editar.preparar!({ id, sinCrm: true }, ctx(NEGOCIO)));
  out.prepSinCrm = pe;
  out.ejecSinCrm = await en(() => editar.ejecutar!(pe.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.filaSinCrm = { funnel_id: fila().funnel_id, etapa: fila().etapa };
  fila().activa = true;
  out.planSinCrm = (await en(() => planificarInscripciones())).filter((p) => p.secuencia === fila().clave).map((p) => p.lead_id).sort();
  // Y volver a atarla, por la misma puerta.
  fila().activa = false;
  const pv = await en(() => editar.preparar!({ id, funnelId: EMAIL }, ctx(NEGOCIO)));
  out.ejecVolver = await en(() => editar.ejecutar!(pv.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.filaVuelta = { funnel_id: fila().funnel_id, etapa: fila().etapa };
  return out;
}

/**
 * UNA VACÍA NO SE ACTIVA (10/11/2026, tests/activar-vacia.test.ts): la recién creada (sin tarjetas) no se prende ni por la
 * puerta del motor ni cuando MaKo propone activarla; con una tarjeta, ese freno ya no es el que contesta.
 */
async function escenarioVacia(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { setSecuenciaActiva } = await import('../lib/nutricion');
  const crear = runnerDe('crear_secuencia_email') as unknown as Runner;
  const toggle = runnerDe('proponer_toggle_nutricion') as unknown as Runner;
  const en = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  sembrarCrm(NEGOCIO);
  const prep = await en(() => crear.preparar!({ nombre: 'Vacía', funnelId: EMAIL }, ctx(NEGOCIO)));
  const ejec = await en(() => crear.ejecutar!(prep.payload as Record<string, unknown>, ctx(NEGOCIO)));
  const id = Number((ejec as { datos?: { id?: number } }).datos?.id);
  const fila = () => db.nutricion_secuencias.find((f) => Number(f.id) === id)!;
  // La de email nace con una tarjeta en blanco: la vacía es la que queda al borrarla (o la «Nueva» del lienzo, sin nada).
  fila().pasos = [];
  const out: Record<string, unknown> = { pasos: fila().pasos };
  out.motor = await en(() => setSecuenciaActiva(id, true)).then(() => 'activó', (e: unknown) => (e instanceof Error ? e.message : String(e)));
  out.activaTrasMotor = fila().activa;
  // Es un proponente de antes (`proponerLegado`): lo que contesta va como texto.
  out.propuesta = JSON.stringify(await en(() => (toggle as unknown as { proponerLegado: (i: unknown, c: unknown) => Promise<unknown> }).proponerLegado({ secuenciaId: id, activa: true }, ctx(NEGOCIO))));
  out.pendientes = db.mako_acciones_pendientes.length;
  Object.assign(fila(), { pasos: [{ id: 'm1', orden: 1, canal: 'email', delay_horas: 0, asunto: 'Hola', cuerpo: 'Uno' }] });
  out.conTarjeta = await en(() => setSecuenciaActiva(id, true)).then(() => 'activó', (e: unknown) => (e instanceof Error ? e.message : String(e)));
  return out;
}

/** El dominio del negocio verificado y su remitente puestos, con los runners reales: sin esto el motor no manda. */
async function conectarRemitente(): Promise<void> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const correr = async (id: string, input: Record<string, unknown>) => {
    const r = runnerDe(id) as unknown as Runner;
    const p = await r.preparar!(input, ctx(NEGOCIO));
    if (!p.payload) throw new Error(`${id}: ${JSON.stringify(p)}`);
    await r.ejecutar!(p.payload as Record<string, unknown>, ctx(NEGOCIO));
  };
  await runWithWorkspace(NEGOCIO, async () => {
    await correr('conectar_dominio_email', { dominio: 'elevate.com.mx' });
    estadoDelDominio = 'verified';
    await correr('verificar_dominio_envio', {});
    await correr('fijar_remitente_email', { nombre: 'Mauricio', local: 'hola', responderA: 'mauricio@personal.test' });
  });
  db.app_settings.push({ workspace_id: NEGOCIO, key: 'envio_email_enabled', value: 'true' });
}

// ── Los eventos de Resend, por la ruta REAL del webhook, firmados como los firma Svix ──────────────────────────────────
const SECRETO_WEBHOOK = `whsec_${Buffer.from('clave-del-webhook-de-prueba').toString('base64')}`;
process.env.RESEND_WEBHOOK_SECRET = SECRETO_WEBHOOK;
let eventoN = 0;
async function eventoDeResend(tipo: 'email.opened' | 'email.clicked' | 'email.bounced', emailId: string): Promise<{ status: number; body: unknown }> {
  const { createHmac } = await import('node:crypto');
  const { POST } = await import('../app/api/webhooks/resend/route');
  const data: Record<string, unknown> = { email_id: emailId, created_at: ahora() };
  if (tipo === 'email.bounced') data.bounce = { type: 'Permanent', subType: 'General', message: 'no existe' };
  const raw = JSON.stringify({ type: tipo, created_at: ahora(), data });
  const id = `msg_${++eventoN}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const firma = createHmac('sha256', Buffer.from(SECRETO_WEBHOOK.slice(6), 'base64')).update(`${id}.${ts}.${raw}`).digest('base64');
  const req = new Request('https://app.test/api/webhooks/resend', { method: 'POST', body: raw, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${firma}` } });
  const res = await POST(req as never);
  return { status: res.status, body: await res.json() };
}

/** Puntos 5 y 6: las columnas que siguen al email (al salir, al abrirlo, al hacer clic) y el corte al comprar. */
async function escenarioColumnas(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { procesarEnvios } = await import('../lib/nutricion');
  const crear = runnerDe('crear_secuencia_email') as unknown as Runner;
  const configurar = runnerDe('configurar_automatizacion') as unknown as Runner;
  const configuracion = runnerDe('configuracion_automatizacion') as unknown as Runner;
  const en = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const out: Record<string, unknown> = {};
  sembrarCrm(NEGOCIO);
  // 608: abierto, sumado al CRM de email; es el que compra en el medio de la campaña.
  db.leads.push({ id: 608, workspace_id: NEGOCIO, nombre: 'Lead 608', email: 'a608@cliente.test', telefono: null, estado_lead: 'abierto', funnel_id: null, pipeline_stage: 'lead', created_at: '2026-06-01T10:00:00Z' });
  await sumarAlCrm();
  await conectarRemitente();

  const pc = await en(() => crear.preparar!({ nombre: 'Campaña 14', funnelId: EMAIL }, ctx(NEGOCIO)));
  const id = Number(((await en(() => crear.ejecutar!(pc.payload as Record<string, unknown>, ctx(NEGOCIO)))) as { datos?: { id?: number } }).datos?.id);
  const fila = () => db.nutricion_secuencias.find((f) => Number(f.id) === id)!;
  // Otra automatización, sin CRM: no se le eligen columnas.
  db.nutricion_secuencias.push({ id: 72, workspace_id: NEGOCIO, clave: 'sin-crm', nombre: 'Sin CRM', activa: false, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'lead', funnel_id: null, pasos: [] });

  out.sinCrm = await en(() => configurar.preparar!({ secuenciaId: 72, columnasEmail: 'abrio=em_abrio' }, ctx(NEGOCIO)));
  out.columnaQueNoEs = await en(() => configurar.preparar!({ secuenciaId: id, columnasEmail: 'abrio=no_existe' }, ctx(NEGOCIO)));
  out.columnaDeCierre = await en(() => configurar.preparar!({ secuenciaId: id, columnasEmail: 'clic=ganado' }, ctx(NEGOCIO)));
  out.eventoQueNoEs = await en(() => configurar.preparar!({ secuenciaId: id, columnasEmail: 'compro=em_clic' }, ctx(NEGOCIO)));
  db.nutricion_secuencias = db.nutricion_secuencias.filter((f) => Number(f.id) !== 72);
  pg.db.nutricion_secuencias = db.nutricion_secuencias;
  const pcfg = await en(() => configurar.preparar!({ secuenciaId: id, columnasEmail: 'enviado=em_enviado, abrio=em_abrio, clic=em_clic' }, ctx(NEGOCIO)));
  out.prepColumnas = pcfg;
  out.ejecColumnas = await en(() => configurar.ejecutar!(pcfg.payload as Record<string, unknown>, ctx(NEGOCIO)));
  const leida = await en(() => configuracion.leer!({ secuenciaId: id }, ctx(NEGOCIO)));
  out.leidas = JSON.parse(typeof leida === 'string' ? leida : leida.content).columnas_email;

  // La campaña: dos emails, activa, con 601, 606 (su casa es el CRM de email) y 608 adentro.
  Object.assign(fila(), {
    activa: true,
    pasos: [
      { id: 'm1', orden: 1, canal: 'email', delay_horas: 0, asunto: 'Uno', cuerpo: 'Hola, uno.', siguiente: 'm2' },
      { id: 'm2', orden: 2, canal: 'email', delay_horas: 0, asunto: 'Dos', cuerpo: 'Hola, dos.', siguiente: null },
    ],
  });
  const pasado = new Date(Date.now() - 60_000).toISOString();
  const inscribir = (lead: number, secuencia: number, cuando: string) => db.nutricion_inscripciones.push({
    id: siguienteId++, workspace_id: NEGOCIO, lead_id: lead, secuencia_id: secuencia, estado: 'activa', paso_actual: 0, proximo_envio_at: cuando,
    inscripto_at: pasado, ultimo_paso_at: null, desenlace: null, desenlace_at: null, hilos: null, hilos_rev: 0, nodo_actual: null,
    conversacion_ultima_at: null, conversacion_cerrada_at: null, conversacion_cierre: null, reunion_at: null, created_at: pasado, updated_at: pasado,
  });
  for (const l of [601, 606, 608]) inscribir(l, id, pasado);
  // Y otra campaña del mismo CRM SIN columnas, con 608 adentro: el corte no la toca.
  db.nutricion_secuencias.push({ id: 73, workspace_id: NEGOCIO, clave: 'otra', nombre: 'Otra campaña', activa: true, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'em_entrada', funnel_id: EMAIL, pasos: [{ id: 'o1', orden: 1, canal: 'email', delay_horas: 0, asunto: 'Otra', cuerpo: 'Hola, otra.', siguiente: null }] });
  inscribir(608, 73, new Date(Date.now() + 86_400_000).toISOString());

  const posicion = (lead: number) => {
    const f = db.lead_funnel.find((x) => Number(x.lead_id) === lead && Number(x.funnel_id) === EMAIL);
    return f ? String(f.etapa) : `casa:${db.leads.find((l) => Number(l.id) === lead)?.pipeline_stage}`;
  };
  const emails = () => resend.filter((p) => p.path === '/emails').map((p) => ({ to: p.body?.to, asunto: p.body?.subject, reply_to: p.body?.reply_to ?? null }));
  resend.length = 0;
  const r1 = await en(() => procesarEnvios({ ignorarVentana: true }));
  out.run1 = { enviados: r1.enviados, fallos: r1.fallos, detalle: r1.detalle };
  out.emails1 = emails();
  out.tarjetas1 = { 601: posicion(601), 606: posicion(606), 608: posicion(608) };

  // Los eventos de Resend, con el id que guardó cada envío.
  const envioDe = (lead: number, secuencia = id) => String(db.nutricion_envios.find((e) => Number(e.lead_id) === lead && Number(e.secuencia_id) === secuencia && e.estado === 'enviado')?.proveedor_id);
  out.abrio601 = await eventoDeResend('email.opened', envioDe(601));
  out.tarjetaTrasAbrir = posicion(601);
  out.clic601 = await eventoDeResend('email.clicked', envioDe(601));
  out.tarjetaTrasClic = posicion(601);
  out.abrioOtraVez = await eventoDeResend('email.opened', envioDe(601));
  out.tarjetaTrasAbrirOtraVez = posicion(601);    // no vuelve a «Abrió»
  out.abrio606 = await eventoDeResend('email.opened', envioDe(606));
  out.tarjeta606 = posicion(606);                  // su casa es el CRM de email: se mueve la casa
  out.historial606 = db.lead_historial.concat(db.lead_audit).filter((h) => Number(h.lead_id) === 606).map((h) => h.autor ?? h.usuario ?? null);
  // Un email de una automatización SIN columnas: la tarjeta no se mueve.
  db.nutricion_envios.push({ id: siguienteId++, workspace_id: NEGOCIO, lead_id: 608, secuencia_id: 73, inscripcion_id: 0, paso: 1, canal: 'email', estado: 'enviado', proveedor_id: 'em-sin-columnas', created_at: ahora() });
  out.abrioSinColumnas = await eventoDeResend('email.opened', 'em-sin-columnas');
  out.tarjeta608SinColumnas = posicion(608);
  out.marcaSinColumnas = db.nutricion_envios.find((e) => e.proveedor_id === 'em-sin-columnas')?.abierto_at != null;

  // 608 compra: su tarjeta del CRM de email llega a Ganado. Y 606 gana como lead.
  db.lead_funnel.find((x) => Number(x.lead_id) === 608 && Number(x.funnel_id) === EMAIL)!.etapa = 'ganado';
  db.leads.find((l) => Number(l.id) === 606)!.estado_lead = 'ganado';
  // Desde Ganado, un clic no la mueve.
  out.clic608Ganado = await eventoDeResend('email.clicked', envioDe(608));
  out.tarjeta608 = posicion(608);

  // La corrida siguiente: el email dos le sale sólo a 601; a 606 y a 608 no, y su inscripción se cierra. La otra campaña sí.
  for (const i of db.nutricion_inscripciones) if (i.estado === 'activa') i.proximo_envio_at = pasado;
  resend.length = 0;
  const r2 = await en(() => procesarEnvios({ ignorarVentana: true }));
  out.run2 = { enviados: r2.enviados, omitidos: r2.omitidos, detalle: r2.detalle };
  out.emails2 = emails();
  out.inscripciones = db.nutricion_inscripciones.map((i) => ({ lead: Number(i.lead_id), secuencia: Number(i.secuencia_id) === id ? 'campaña' : 'otra', estado: i.estado })).sort((a, b) => a.lead - b.lead || a.secuencia.localeCompare(b.secuencia));
  out.rastros = db.nutricion_envios.filter((e) => e.estado === 'omitido').map((e) => ({ lead: Number(e.lead_id), error: e.error }));
  // 601 ya hizo clic: el email dos sale y lo abre, y su tarjeta no vuelve a «Enviado» ni a «Abrió».
  out.tarjeta601TrasEmailDos = posicion(601);
  const dos = String(db.nutricion_envios.filter((e) => Number(e.lead_id) === 601 && Number(e.secuencia_id) === id && e.estado === 'enviado').at(-1)?.proveedor_id);
  out.abrioEmailDos = await eventoDeResend('email.opened', dos);
  out.tarjeta601TrasAbrirDos = posicion(601);

  // Ticket #93 (13/11/2026): un rebote lleva la tarjeta a la columna «Rebotados» del CRM —sin elegirla en la automatización—
  // aunque esté ANTES en el tablero (601 ya hizo clic), y le da de baja el email (sale de la secuencia).
  const crm = db.funnels.find((x) => Number(x.id) === EMAIL)!;
  crm.data = { ...(crm.data as Fila), pipeline: [PIPELINE_EMAIL[0], etapa('em_rebotado', 'Rebotados', 'paso'), ...PIPELINE_EMAIL.slice(1)] };
  out.rebote601 = await eventoDeResend('email.bounced', dos);
  out.tarjeta601TrasRebote = posicion(601);
  out.baja601 = db.leads.find((l) => Number(l.id) === 601)?.email_opt_out ?? null;
  out.autorRebote = db.lead_historial.concat(db.lead_audit).filter((h) => Number(h.lead_id) === 601 && String(h.valor_nuevo ?? h.a ?? '').includes('em_rebotado')).map((h) => h.autor ?? h.usuario ?? null);
  return out;
}

async function eventoRebote(emailId: string, tipo: 'email.bounced' | 'email.complained', rebote: 'Permanent' | 'Transient' = 'Permanent'): Promise<{ status: number; body: unknown }> {
  const { createHmac } = await import('node:crypto');
  const { POST } = await import('../app/api/webhooks/resend/route');
  const data: Record<string, unknown> = { email_id: emailId, created_at: ahora() };
  if (tipo === 'email.bounced') data.bounce = { type: rebote, subType: 'General', message: 'no existe' };
  const raw = JSON.stringify({ type: tipo, created_at: ahora(), data });
  const id = `msg_${++eventoN}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const firma = createHmac('sha256', Buffer.from(SECRETO_WEBHOOK.slice(6), 'base64')).update(`${id}.${ts}.${raw}`).digest('base64');
  const res = await POST(new Request('https://app.test/api/webhooks/resend', { method: 'POST', body: raw, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${firma}` } }) as never);
  return { status: res.status, body: await res.json() };
}

/** Punto 7: la rampa del email en el motor, el freno por rebotes (por la ruta del webhook), los topes por la API y el aviso al activar. */
async function escenarioTopes(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { procesarEnvios, ritmoAlActivar } = await import('../lib/nutricion');
  const ver = runnerDe('ver_limites_envio') as unknown as Runner;
  const cambiar = runnerDe('cambiar_limites_envio') as unknown as Runner;
  const en = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const out: Record<string, unknown> = {};
  sembrarCrm(NEGOCIO);
  // 60 personas sumadas hoy a la entrada del CRM de email (agregados, como los suma `agregar_en_bloque_a_crm`).
  const ids = Array.from({ length: 60 }, (_, i) => 1000 + i);
  for (const id of ids) {
    db.leads.push({ id, workspace_id: NEGOCIO, nombre: `P ${id}`, email: `p${id}@cliente.test`, telefono: null, estado_lead: 'abierto', funnel_id: null, pipeline_stage: 'lead', created_at: '2026-06-01T10:00:00Z' });
    db.lead_funnel.push({ id: siguienteId++, workspace_id: NEGOCIO, lead_id: id, funnel_id: EMAIL, etapa: 'em_entrada', etapa_desde: ahora(), created_at: ahora() });
  }
  await conectarRemitente();
  const leerJson = async (r: Runner, i: Record<string, unknown> = {}) => { const x = await en(() => r.leer!(i, ctx(NEGOCIO))); return JSON.parse(typeof x === 'string' ? x : x.content); };
  out.verAntes = await leerJson(ver);

  // El aviso al activar una campaña de 14 emails a esas 60 (pausada, atada al CRM).
  const catorce = Array.from({ length: 14 }, (_, i) => ({ id: `e${i + 1}`, orden: i + 1, canal: 'email', delay_horas: i ? 24 : 0, asunto: `Email ${i + 1}`, cuerpo: 'Hola.', siguiente: i < 13 ? `e${i + 2}` : null }));
  const crear = runnerDe('crear_secuencia_email') as unknown as Runner;
  const pc14 = await en(() => crear.preparar!({ nombre: 'Campaña 14', funnelId: EMAIL }, ctx(NEGOCIO)));
  const id14 = Number(((await en(() => crear.ejecutar!(pc14.payload as Record<string, unknown>, ctx(NEGOCIO)))) as { datos?: { id?: number } }).datos?.id);
  Object.assign(db.nutricion_secuencias.find((f) => Number(f.id) === id14)!, { pasos: catorce });
  out.ritmo = await en(() => ritmoAlActivar(id14));
  // Activarla como la activa un token detallado (en el acto, `ejecutarAccion`): la respuesta trae el ritmo.
  const { ejecutarAccion } = await import('../lib/mako-doer-acciones');
  out.activar = await ejecutarAccion(NEGOCIO, 'nutricion_toggle', { secuenciaId: id14, activa: true });
  // Fuera del motor desde acá: es la campaña que se prende en la vida real, no ésta.
  Object.assign(db.nutricion_secuencias.find((f) => Number(f.id) === id14)!, { activa: false, archivada_at: ahora() });

  // La campaña corriendo: 60 vencidas, un email cada una. El primer día salen 50 (la rampa).
  db.nutricion_secuencias.push({ id: 91, workspace_id: NEGOCIO, clave: 'c1', nombre: 'Uno', activa: true, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'em_entrada', funnel_id: EMAIL, pasos: [{ id: 'u1', orden: 1, canal: 'email', delay_horas: 0, asunto: 'Uno', cuerpo: 'Hola.', siguiente: null }] });
  const pasado = new Date(Date.now() - 60_000).toISOString();
  for (const lead of ids) db.nutricion_inscripciones.push({
    id: siguienteId++, workspace_id: NEGOCIO, lead_id: lead, secuencia_id: 91, estado: 'activa', paso_actual: 0, proximo_envio_at: pasado,
    inscripto_at: pasado, ultimo_paso_at: null, desenlace: null, desenlace_at: null, hilos: null, hilos_rev: 0, nodo_actual: null,
    conversacion_ultima_at: null, conversacion_cerrada_at: null, conversacion_cierre: null, reunion_at: null, created_at: pasado, updated_at: pasado,
  });
  resend.length = 0;
  const r1 = await en(() => procesarEnvios({ ignorarVentana: true }));
  out.run1 = { enviados: r1.enviados, topeEmail: r1.detalle.filter((d) => d.nota === 'tope diario de email').length };
  out.emails1 = resend.filter((p) => p.path === '/emails').length;

  // Los rebotes llegan por el webhook. Desde el ticket #93 (13/11/2026) el freno mira los últimos 300 desde 100 enviados: a los
  // 50 de hoy se suman 50 de ayer, sin rebotes. Con 100, el 4.º rebote es el 4 % (nada), el 5.º el 5 % (avisa y el envío sigue)
  // y el 10.º el 10 % (apaga).
  const enviados = db.nutricion_envios.filter((e) => e.estado === 'enviado' && Number(e.secuencia_id) === 91);
  for (const e of enviados) db.nutricion_envios.push({ ...e, id: siguienteId++, proveedor_id: `ayer-${String(e.proveedor_id)}`, abierto_at: null, clic_at: null, rebotado_at: null, queja_at: null });
  const envio = () => setting(NEGOCIO, 'envio_email_enabled');
  out.temporal = await eventoRebote(String(enviados[0].proveedor_id), 'email.bounced', 'Transient');
  out.trasTemporal = { envio: envio(), baja: db.leads.find((l) => Number(l.id) === Number(enviados[0].lead_id))?.email_opt_out ?? null };
  for (let i = 1; i <= 4; i++) await eventoRebote(String(enviados[i].proveedor_id), 'email.bounced');
  out.trasCuatro = envio();
  out.quinto = await eventoRebote(String(enviados[5].proveedor_id), 'email.bounced');
  out.trasCinco = { envio: envio(), avisosRebotes: db.notificaciones.filter((n) => n.tipo === 'email-rebotes').length };
  for (let i = 6; i <= 9; i++) await eventoRebote(String(enviados[i].proveedor_id), 'email.bounced');
  out.trasNueve = envio();
  out.decimo = await eventoRebote(String(enviados[10].proveedor_id), 'email.bounced');
  out.trasDiez = envio();
  out.rebotados = db.nutricion_envios.filter((e) => e.rebotado_at != null).length;
  out.bajas = db.leads.filter((l) => l.email_opt_out === true).length;
  out.avisos = db.notificaciones.filter((n) => n.tipo === 'email-frenado').map((n) => ({ titulo: n.titulo, texto: n.texto ?? n.cuerpo ?? null }));
  out.avisosRebotes = db.notificaciones.filter((n) => n.tipo === 'email-rebotes').map((n) => ({ titulo: n.titulo, texto: n.texto ?? n.cuerpo ?? null }));
  out.verDespues = await leerJson(ver);

  // Cambiar los topes por la API: fuera de rango no; adentro, se guarda sólo lo que difiere.
  out.cambiarMal = await en(() => cambiar.preparar!({ emailDia: 900 }, ctx(NEGOCIO)));
  out.cambiarNada = await en(() => cambiar.preparar!({}, ctx(NEGOCIO)));
  // La rampa del número (5/11/2026, tests/rampa-whatsapp.test.ts): se propone con sus dos parámetros, y fuera de rango no.
  out.cambiarWa = await en(() => cambiar.preparar!({ waArranqueDia: 10, waArranqueSube: 15 }, ctx(NEGOCIO)));
  out.cambiarWaMal = await en(() => cambiar.preparar!({ waArranqueSube: 0 }, ctx(NEGOCIO)));
  const pc = await en(() => cambiar.preparar!({ emailDia: 200, emailArranqueDia: 40 }, ctx(NEGOCIO)));
  out.prepCambiar = pc;
  out.ejecCambiar = await en(() => cambiar.ejecutar!(pc.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.limitesGuardados = setting(NEGOCIO, 'mako.limites_envio');
  const pr = await en(() => cambiar.preparar!({ restaurar: true }, ctx(NEGOCIO)));
  out.ejecRestaurar = await en(() => cambiar.ejecutar!(pr.payload as Record<string, unknown>, ctx(NEGOCIO)));
  out.limitesRestaurados = setting(NEGOCIO, 'mako.limites_envio');
  return out;
}

// ── El camino ENTERO por la API, de «no tengo cuenta de Resend» a «listo» (4/11/2026) ──────────────────────────────────
// Martín: «todo esto es súper importante que lo pueda hacer por API… si detecta que no tiene [Resend] conectado, que le vaya
// guiando». Sólo llamadas a los runners de la API, en el orden que dice `siguiente`. Lo único que no es la API es pegar la
// clave: eso lo hace la persona en el modal de MaKo (la API no recibe claves), y acá se simula como lo guarda el modal.
async function escenarioCuenta(): Promise<Record<string, unknown>> {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const marketing = await import('../lib/email-marketing');
  const en = <T,>(fn: () => Promise<T>) => runWithWorkspace(NEGOCIO, fn);
  const r = (id: string) => runnerDe(id) as unknown as Runner;
  const estado = async () => {
    const x = await en(() => r('estado_email').leer!({}, ctx(NEGOCIO)));
    return JSON.parse(typeof x === 'string' ? x : x.content) as Record<string, unknown>;
  };
  const pasoA = (e: Record<string, unknown>) => ({ paso: e.paso, siguiente: e.siguiente, link: e.link_conectar, que_hacer: e.que_hacer, instruccion: e.instruccion });
  const correr = async (id: string, input: Record<string, unknown> = {}) => {
    const p = await en(() => r(id).preparar!(input, ctx(NEGOCIO)));
    if (!p.payload) return { preparar: p };
    return { preparar: p, ejecutar: await en(() => r(id).ejecutar!(p.payload as Record<string, unknown>, ctx(NEGOCIO))) };
  };
  const out: Record<string, unknown> = {};
  const camino: Array<Record<string, unknown>> = [];

  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  db.workspaces.push({ id: NEGOCIO, nombre: 'Elevate', capa: 'completo', estado: 'activo' });
  db.workspaces.push({ id: OTRO, nombre: 'Otro', capa: 'completo', estado: 'activo' });

  // 0) Sin cuenta: la guía lo dice, con el link al modal; conectar el dominio guía igual, y no se le pide nada a Resend.
  camino.push(pasoA(await estado()));
  let i = resend.length;
  out.conectarSinCuenta = (await correr('conectar_dominio_email', { dominio: 'elevate.com.mx' })).preparar;
  out.remitenteSinCuenta = (await correr('fijar_remitente_email', { nombre: 'Mauricio', local: 'hola' })).preparar;
  out.seguimientoSinCuenta = (await correr('conectar_seguimiento_email')).preparar;
  out.pedidosSinCuenta = resend.length - i;
  out.settingsSinCuenta = db.app_settings.filter((f) => Number(f.workspace_id) === NEGOCIO).map((f) => f.key);

  // 1) Pega la de MaKo (una copia vieja): no es suya.
  await cuentaPropia(NEGOCIO, 're_de_la_plataforma');
  camino.push(pasoA(await estado()));

  // 2) Pega una de sólo envío: la guía pide una «Full access», y conectar el dominio frena ANTES de proponer.
  await cuentaPropia(NEGOCIO, CLAVE_SOLO_ENVIO);
  camino.push(pasoA(await estado()));
  out.conectarSoloEnvio = (await correr('conectar_dominio_email', { dominio: 'elevate.com.mx' })).preparar;

  // 3) La suya, «Full access»: sin dominio → conectar_dominio_email (y con él, el webhook de SU cuenta).
  await cuentaPropia(NEGOCIO);
  camino.push(pasoA(await estado()));
  i = resend.length;
  out.conectar = await correr('conectar_dominio_email', { dominio: 'elevate.com.mx' });
  out.webhooksCreados = [...webhooks.values()].map((w) => ({ endpoint: w.endpoint, events: w.events, cuenta: w.cuenta }));
  out.clavesConectar = [...new Set(resend.slice(i).map((p) => p.clave))];
  out.secretoGuardado = db.credenciales.filter((f) => Number(f.workspace_id) === NEGOCIO && f.clave === 'RESEND_WEBHOOK_SECRET_PROPIO').length;
  camino.push(pasoA(await estado()));                    // dns_pendiente → verificar_dominio_envio
  estadoDelDominio = 'verified';
  out.verificar = await correr('verificar_dominio_envio');
  // Sin el secreto guardado, la guía pide el seguimiento (un dominio conectado antes del 4/11): conectar_seguimiento_email.
  const guardado = db.credenciales.filter((f) => Number(f.workspace_id) === NEGOCIO && f.clave === 'RESEND_WEBHOOK_SECRET_PROPIO');
  db.credenciales = db.credenciales.filter((f) => !guardado.includes(f));
  pg.db.credenciales = db.credenciales;
  camino.push(pasoA(await estado()));                    // sin_seguimiento
  out.seguimiento = await correr('conectar_seguimiento_email');
  out.webhooksTrasSeguimiento = webhooks.size;            // reusó el que había: no creó otro
  camino.push(pasoA(await estado()));                    // sin_remitente → fijar_remitente_email
  out.remitente = await correr('fijar_remitente_email', { nombre: 'Mauricio', local: 'hola', responderA: 'mauricio@personal.test' });
  camino.push(pasoA(await estado()));                    // envio_apagado → activar_envio_real_email (lo confirma la persona)
  out.activarPrep = (await en(() => r('activar_envio_real_email').preparar!({ on: true }, ctx(NEGOCIO))));
  // La persona confirma en MaKo: la pantalla de /mako/revisar corre el `ejecutar` de la propuesta.
  out.activar = await en(() => r('activar_envio_real_email').ejecutar!({ on: true }, ctx(NEGOCIO)));
  camino.push(pasoA(await estado()));                    // listo
  out.camino = camino;

  // 4) Su email sale con SU clave, desde su dominio.
  db.email_broadcasts.push({ id: 43, workspace_id: NEGOCIO, asunto: 'Hola', preheader: '', cuerpo: 'Texto', segmento: 'activos', estado: 'borrador' });
  i = resend.length;
  out.prueba = await en(() => marketing.enviarBroadcastPrueba(43, 'mauricio@personal.test'));
  out.envio = resend.slice(i).filter((p) => p.path === '/emails').map((p) => ({ clave: p.clave, from: p.body?.from }));

  // 5) Sus eventos llegan por el webhook de SU cuenta, firmados con SU secreto, y tocan sólo SUS filas.
  const secreto = String([...webhooks.values()][0]?.signing_secret ?? '');
  const base = 'https://app.test/api/webhooks/resend';
  db.nutricion_envios.push({ id: 9101, workspace_id: NEGOCIO, lead_id: 501, secuencia_id: null, proveedor_id: 'em-del-negocio', abierto_at: null, clic_at: null, rebotado_at: null, queja_at: null, estado: 'enviado' });
  db.nutricion_envios.push({ id: 9102, workspace_id: OTRO, lead_id: 502, secuencia_id: null, proveedor_id: 'em-de-otro', abierto_at: null, clic_at: null, rebotado_at: null, queja_at: null, estado: 'enviado' });
  db.leads.push({ id: 502, workspace_id: OTRO, nombre: 'Lead de otro', email: 'b@otro.test', estado_lead: 'abierto', email_opt_out: false, created_at: ahora() });
  out.eventoSuyo = await eventoFirmado(secreto, `${base}?cuenta=${NEGOCIO}`, { type: 'email.opened', data: { email_id: 'em-del-negocio' } });
  out.abiertoSuyo = db.nutricion_envios.find((f) => Number(f.id) === 9101)?.abierto_at != null;
  out.eventoAjeno = await eventoFirmado(secreto, `${base}?cuenta=${NEGOCIO}`, { type: 'email.bounced', data: { email_id: 'em-de-otro', bounce: { type: 'Permanent' } } });
  out.ajenoIntacto = { rebote: db.nutricion_envios.find((f) => Number(f.id) === 9102)?.rebotado_at ?? null, baja: db.leads.find((l) => Number(l.id) === 502)?.email_opt_out };
  out.firmaDeOtro = await eventoFirmado(SECRETO_WEBHOOK, `${base}?cuenta=${NEGOCIO}`, { type: 'email.opened', data: { email_id: 'em-del-negocio' } });
  out.suyoSinCuenta = await eventoFirmado(secreto, base, { type: 'email.opened', data: { email_id: 'em-del-negocio' } });
  out.cuentaSinSecreto = await eventoFirmado(secreto, `${base}?cuenta=${OTRO}`, { type: 'email.opened', data: { email_id: 'em-de-otro' } });
  out.cuentaMala = await eventoFirmado(secreto, `${base}?cuenta=abc`, { type: 'email.opened', data: { email_id: 'em-del-negocio' } });
  // El secreto no sale nunca: ni en lo que contesta la API ni en lo que lee la persona.
  out.secretoEnLaSalida = JSON.stringify({ camino, ...out }).includes(secreto.slice(6, 30));

  // 6) Un dominio que vivía en OTRA cuenta (la de MaKo, antes del 4/11): la guía lo dice y manda a conectarlo de nuevo.
  dominios.set('dom-viejo.com', { id: 'dom-viejo.com', name: 'viejo.com', status: 'verified', records: [], cuenta: 're_de_la_plataforma' });
  db.app_settings = db.app_settings.filter((f) => !(Number(f.workspace_id) === NEGOCIO && String(f.key).startsWith('resend_domain')));
  db.app_settings.push({ workspace_id: NEGOCIO, key: 'resend_domain', value: 'viejo.com' }, { workspace_id: NEGOCIO, key: 'resend_domain_id', value: 'dom-viejo.com' });
  pg.db.app_settings = db.app_settings;
  out.enOtraCuenta = pasoA(await estado());
  return out;
}

async function eventoFirmado(secreto: string, url: string, evt: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const { createHmac } = await import('node:crypto');
  const { POST } = await import('../app/api/webhooks/resend/route');
  const raw = JSON.stringify({ created_at: ahora(), ...evt, data: { created_at: ahora(), ...(evt.data as object) } });
  const id = `msg_${++eventoN}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const llave = secreto.startsWith('whsec_') ? Buffer.from(secreto.slice(6), 'base64') : Buffer.from('');
  const firma = createHmac('sha256', llave).update(`${id}.${ts}.${raw}`).digest('base64');
  const req = new Request(url, { method: 'POST', body: raw, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${firma}` } });
  const res = await POST(req as never);
  return { status: res.status, body: await res.json() };
}

// ── El ws1 deja de ser la fuente de la clave de correo de MaKo (4/11/2026) ───────────────────────────────────────────────
// La hidratación del arranque, corrida de verdad contra la base de mentira. 'antes': la plataforma todavía no tiene su
// fila (sigue la del ws1, como hasta hoy). 'despues': la mudanza corrió y Mauricio pegó la suya. 'caida': la lectura de la
// plataforma falla: la del ws1 NO se toma (podría ser ya la de Mauricio).
async function escenarioWs1(caso: 'antes' | 'despues' | 'caida'): Promise<Record<string, unknown>> {
  const cred = await import('../lib/credenciales');
  const { cuentaDeCorreo } = await import('../lib/email-cuenta');
  const { runWithWorkspace, OWNER_WS } = await import('../lib/workspace');
  const { sendEmail } = await import('../lib/resend');
  const { REMITENTE_MAKO } = await import('../lib/app-url');
  delete process.env.RESEND_API_KEY;                     // como en producción: la de MaKo sale de una fila, no de Vercel
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  db.workspaces.push({ id: OWNER_WS, nombre: 'Mauricio', capa: 'completo', estado: 'activo' });
  const fila = (ws: number, clave: string, valor: string) => db.credenciales.push({ workspace_id: ws, clave, valor_enc: cred.cifrarSecreto(valor, ws, clave), servicio: 'email', updated_by: 'prueba', updated_at: ahora() });
  if (caso === 'despues') { fila(PLATAFORMA, 'RESEND_API_KEY', 're_de_la_plataforma'); fila(OWNER_WS, 'RESEND_API_KEY', 're_de_mauricio'); }
  else fila(OWNER_WS, 'RESEND_API_KEY', 're_de_mako_en_el_ws1');
  db.app_settings.push({ workspace_id: OWNER_WS, key: 'resend_domain', value: 'mauricio.com' }, { workspace_id: OWNER_WS, key: 'resend_from', value: 'Mauricio <hola@mauricio.com>' });
  if (caso === 'caida') {
    const real = globalThis.fetch;
    globalThis.fetch = (async (e: RequestInfo | URL, init?: RequestInit) => {
      const u = new URL(typeof e === 'string' ? e : e instanceof URL ? e.href : (e as Request).url);
      if (u.host === 'supa.test' && u.pathname.endsWith('/credenciales') && u.search.includes(`workspace_id=eq.${PLATAFORMA}`)) return json(500, { message: 'base caída' });
      return real(e, init);
    }) as typeof fetch;
  }
  await cred.credencialesListas();
  const out: Record<string, unknown> = {
    entorno: process.env.RESEND_API_KEY ?? null,
    fuenteCorreo: await cred.wsDelEntorno('RESEND_API_KEY'),
    fuenteIA: await cred.wsDelEntorno('GEMINI_API_KEY'),
    fuenteMeta: await cred.wsDelEntorno('META_ACCESS_TOKEN'),
    cuentaWs1: (await cuentaDeCorreo(OWNER_WS)).tipo,
    filasWs1: db.credenciales.filter((f) => Number(f.workspace_id) === OWNER_WS).map((f) => f.clave),
  };
  if (caso === 'despues') {
    const i = resend.length;
    out.aviso = await runWithWorkspace(OWNER_WS, () => sendEmail({ to: 'martin@prueba.test', from: REMITENTE_MAKO, subject: 'Aviso', html: '<p>Hola</p>', text: 'Hola' }));
    out.claveAviso = resend.slice(i).map((p) => p.clave);
    const j = resend.length;
    out.suyo = await runWithWorkspace(OWNER_WS, () => sendEmail({ to: 'lead@cliente.test', subject: 'Hola', html: '<p>Hola</p>', text: 'Hola' }));
    out.claveSuyo = resend.slice(j).map((p) => p.clave);
  }
  return out;
}

async function main() {
  const escenarios: Record<string, () => Promise<Record<string, unknown>>> = {
    dominio: escenarioDominio, claves: escenarioClaves, lote: escenarioLote, secuencia: escenarioSecuencia, columnas: escenarioColumnas, topes: escenarioTopes,
    cuenta: escenarioCuenta, vacia: escenarioVacia, 'ws1-antes': () => escenarioWs1('antes'), 'ws1-despues': () => escenarioWs1('despues'), 'ws1-caida': () => escenarioWs1('caida'),
  };
  const fn = escenarios[ESC];
  if (!fn) throw new Error(`escenario desconocido: ${ESC}`);
  // Desde el 4/11/2026 el email de un negocio sale SÓLO con su cuenta de Resend: la campaña de Mauricio la tiene.
  if (['dominio', 'lote', 'secuencia', 'columnas', 'topes'].includes(ESC)) await cuentaPropia(NEGOCIO);
  const out = await fn();
  out.otros = otros;
  out.sinMock = [...pg.sinMock];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
