// =============================================================================
// Hijo de los tests de la campaña de email por la API (4/11/2026) — NO es un test (no termina en .test.ts)
// =============================================================================
// La campaña de Mauricio (ws 1, un cliente): 14 emails, uno cada 24 h, a todos sus leads menos los ganados, armada
// desde su Claude con la API de MaKo. Este hijo corre el código REAL (los runners de la API, las libs y el motor) contra
// un PostgREST en memoria (tests/_postgrest-de-mentira.ts) y un Resend de mentira que anota lo que se le pide. Nada sale a
// la red real: lo que no es la base ni Resend se anota en `otros` y tiene que dar vacío.
//
// Corre con: node --conditions=react-server --import tsx tests/_email-campana-hijo.ts <escenario>
// Escenarios: 'dominio' (puntos 1 y 2: conectar el dominio, el seguimiento, el remitente y el reply_to).
// Imprime el resultado después de la marca @@RESULTADO@@.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'srk-de-prueba';
process.env.RESEND_API_KEY = 're_de_la_plataforma';
process.env.CREDENCIALES_SECRET = 'secreto-de-cifrado-de-prueba-suficientemente-largo';
process.env.UNSUBSCRIBE_SECRET = 'secreto-de-baja-de-prueba';

const ESC = process.argv[2] ?? 'dominio';
const ahora = () => new Date().toISOString();
let siguienteId = 7000;

const TABLAS = [
  'workspaces', 'app_settings', 'credenciales', 'usuarios', 'leads', 'funnels', 'lead_funnel', 'lead_audit', 'lead_events', 'lead_historial',
  'nutricion_secuencias', 'nutricion_inscripciones', 'nutricion_envios', 'email_broadcasts', 'email_broadcast_envios', 'notificaciones',
  'productos', 'pagos', 'wa_borradores',
] as const;
const pg = crearPostgrest({
  tablas: TABLAS,
  orCompleto: true,
  defaults: (tabla, f) => {
    const base: Fila = { id: siguienteId++, created_at: ahora(), updated_at: ahora() };
    if (tabla === 'app_settings' || tabla === 'credenciales') delete base.id;
    return { ...base, ...f };
  },
  unicos: [
    { tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_pkey' },
    { tabla: 'lead_funnel', columnas: ['workspace_id', 'lead_id', 'funnel_id'], donde: () => true, nombre: 'lead_funnel_uk' },
  ],
});
const db = pg.db as Record<string, Fila[]>;

// ── Resend de mentira ──────────────────────────────────────────────────────────────────────
type Pedido = { metodo: string; path: string; body: Record<string, unknown> | null };
const resend: Pedido[] = [];
const dominios = new Map<string, Fila>();
let estadoDelDominio = 'not_started';
const otros: string[] = [];
const json = (status: number, b: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...extra } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.resend.com') {
    const metodo = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) as Record<string, unknown> : null;
    resend.push({ metodo, path: u.pathname, body });
    if (u.pathname === '/domains' && metodo === 'POST') {
      const name = String(body?.name);
      const d: Fila = {
        id: `dom-${name}`, name, status: 'not_started', region: 'sa-east-1', open_tracking: false, click_tracking: false,
        records: [
          { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=MIGf', ttl: 'Auto', status: 'not_started' },
          { record: 'SPF', name: 'send', type: 'MX', value: 'feedback-smtp.sa-east-1.amazonses.com', priority: 10, ttl: 'Auto', status: 'not_started' },
        ],
      };
      dominios.set(String(d.id), d);
      return json(201, d);
    }
    const m = /^\/domains\/([^/]+)(\/verify)?$/.exec(u.pathname);
    if (m) {
      const d = dominios.get(decodeURIComponent(m[1]));
      if (!d) return json(404, { message: 'Domain not found' });
      if (m[2] && metodo === 'POST') return json(200, { object: 'domain', id: d.id });
      if (metodo === 'PATCH') {
        if (typeof body?.open_tracking === 'boolean') d.open_tracking = body.open_tracking;
        if (typeof body?.click_tracking === 'boolean') d.click_tracking = body.click_tracking;
        return json(200, { object: 'domain', id: d.id });
      }
      return json(200, { ...d, status: estadoDelDominio, object: 'domain' });
    }
    if (u.pathname === '/emails' && metodo === 'POST') return json(200, { id: `em-${resend.length}` });
    return json(404, { message: 'sin mock' });
  }
  otros.push(`${u.host}${u.pathname}`);
  return json(500, { error: 'sin red' });
}) as typeof fetch;

const PLATAFORMA = 9, NEGOCIO = 3, OTRO = 5;

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

async function main() {
  const escenarios: Record<string, () => Promise<Record<string, unknown>>> = { dominio: escenarioDominio, lote: escenarioLote };
  const fn = escenarios[ESC];
  if (!fn) throw new Error(`escenario desconocido: ${ESC}`);
  const out = await fn();
  out.otros = otros;
  out.sinMock = [...pg.sinMock];
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
