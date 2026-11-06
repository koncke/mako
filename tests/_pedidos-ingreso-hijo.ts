// =============================================================================
// Hijo de tests/pedidos-ingreso.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// «Quieren entrar» sobre un PostgREST de mentira. Corren REALES lib/pedidos-ingreso.ts, `POST /api/planes/comprar` con
// `pedirPlanSinPasarela` (el pedido entero: el lead, su historial, el aviso y la bandeja; la parte que no se puede probar en
// producción sin dejar un lead y un mail de verdad) y `/api/admin/pedidos-ingreso`. Sólo la sesión y el envío de mails van de
// mentira. Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.

import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'https://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';

const pg = crearPostgrest({
  tablas: ['pedidos_ingreso', 'usuarios', 'leads', 'lead_audit', 'app_settings', 'workspaces', 'credenciales', 'funnels', 'cobros', 'agencia_clientes', 'agencia_altas'],
  defaults: (tabla, f) => {
    const n = (pg.db[tabla]?.length ?? 0) + 1;
    return { id: n, ...(tabla === 'pedidos_ingreso' ? { intentos: 1, estado: 'pendiente' } : {}), ...f };
  },
});
const db = pg.db;
db.workspaces = [{ id: 9, nombre: 'MaKo', capa: 'agencia', estado: 'activo' }];
db.usuarios = [
  { id: 1, email: 'ya-tiene@ejemplo.com', nombre: 'Ya tiene', rol: 'cliente', estado: 'activo' },
  { id: 2, email: 'suspendido@ejemplo.com', nombre: 'Suspendido', rol: 'cliente', estado: 'suspendido' },
];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    // El PostgREST de mentira no entiende `ilike`: `leadDelComprador` busca el correo exacto, sin comodines.
    const correo = u.searchParams.get('email');
    if (correo?.startsWith('ilike.')) u.searchParams.set('email', `eq.${correo.slice(6)}`);
    return pg.responder(u, init);
  }
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. Un nombre que falta no carga el módulo. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

const mails: Array<{ to: string; tag: string; asunto: string; cuerpo: string }> = [];
let esAdmin = false;
let fallarMail = false;
stub('lib/invitaciones.ts', {
  avisarDePlataforma: async (m: { to: string; tag: string; asunto: string; cuerpo: string }) => {
    if (fallarMail) throw new Error('el correo no salió');
    mails.push(m);
    return { enviado: true };
  },
});
stub('lib/auth.ts', {
  getSesionAdmin: async () => (esAdmin ? { email: 'martin@ejemplo.com' } : null),
  getUsuarioActual: async () => null,
});

async function main() {
  const { getSupabaseServer } = await import('../lib/supabase');
  stub('lib/workspace.ts', {
    runWithWorkspace: async (_ws: number, f: () => unknown) => f(),
    getTenantDb: async () => getSupabaseServer(),
    getWorkspaceActual: async () => 9,
    wsSuperAdmin: async () => 9,
    getWorkspace: async () => db.workspaces[0],
  });
  const { registrarPedido, pedidosPendientes, descartarPedido } = await import('../lib/pedidos-ingreso');
  const { intentoDeGoogle, pedidoLimpio } = await import('../lib/pedidos-ingreso-reglas');
  const out: Record<string, unknown> = {};

  // ── Google ──
  const google = (email: string, extra: Record<string, unknown> = {}) => intentoDeGoogle({ email, email_verified: true, name: 'Ana Pérez', ...extra });
  out.primera = await registrarPedido(google('Ana@Ejemplo.com'));
  out.mailsTrasPrimera = mails.length;
  out.segunda = await registrarPedido(google('ana@ejemplo.com'));
  out.mailsTrasSegunda = mails.length;
  out.filaAna = { ...db.pedidos_ingreso.find((f) => f.email === 'ana@ejemplo.com') };
  out.sinVerificar = await registrarPedido(google('falso@ejemplo.com', { email_verified: false }));
  out.verificadoAusente = await registrarPedido(intentoDeGoogle({ email: 'ausente@ejemplo.com', name: 'X' }));
  out.yaTiene = await registrarPedido(google('ya-tiene@ejemplo.com'));
  out.suspendido = await registrarPedido(google('suspendido@ejemplo.com'));
  fallarMail = true;
  out.conElMailCaido = await registrarPedido(google('sin-mail@ejemplo.com'));
  fallarMail = false;
  out.filasGoogle = db.pedidos_ingreso.map((f) => f.email);

  // ── La bandeja ──
  out.bandeja = (await pedidosPendientes()).pedidos.map((f) => f.email);
  const sinMail = db.pedidos_ingreso.find((f) => f.email === 'sin-mail@ejemplo.com')!;
  out.descartar = await descartarPedido(Number(sinMail.id), 'martin@ejemplo.com');
  out.descartarInexistente = await descartarPedido(9999, 'martin@ejemplo.com');
  const mailsAntes = mails.length;
  out.insiste = await registrarPedido(google('sin-mail@ejemplo.com'));
  out.mailsAlInsistir = mails.length - mailsAntes;
  out.bandejaTrasDescartar = (await pedidosPendientes()).pedidos.map((f) => f.email);
  // Le dan de alta por el camino de siempre: sale solo de la bandeja.
  db.usuarios.push({ id: 3, email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'cliente', estado: 'activo' });
  out.bandejaTrasElAlta = (await pedidosPendientes()).pedidos.map((f) => f.email);

  // ── El pedido de /planes, entero, por la ruta real ──
  const { POST } = await import('../app/api/planes/comprar/route');
  const { NextRequest } = await import('next/server');
  const pedir = async (body: unknown, origin = 'https://hola-mako.com') => {
    const r = await POST(new NextRequest('https://hola-mako.com/api/planes/comprar', { method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  const mailsAntesPlanes = mails.length;
  out.pedidoOk = await pedir({ plan: 'pro', nombre: 'Gabi Prueba', email: 'gabi@ejemplo.com', whatsapp: '+54 9 11 1234-5678', quiero: true, origen: { landing: 'coaches' } });
  out.leadDelPedido = db.leads.map((l) => ({ email: l.email, telefono: l.telefono, origen_lead: l.origen_lead }));
  out.historial = db.lead_audit.map((a) => ({ campo: a.campo, valor: a.valor_nuevo, autor: a.autor }));
  out.mailsDelPedido = mails.slice(mailsAntesPlanes).map((m) => ({ to: m.to, tag: m.tag, asunto: m.asunto }));
  out.filaDelPedido = { ...db.pedidos_ingreso.find((f) => f.email === 'gabi@ejemplo.com') };
  const sinTablaAntes = JSON.stringify(db.leads);
  out.trampa = await pedir({ plan: 'pro', web: 'bot', nombre: 'Bot', email: 'bot@ejemplo.com', whatsapp: '5491112345678', quiero: true });
  out.sinWhatsapp = await pedir({ plan: 'pro', nombre: 'Sin', email: 'sin@ejemplo.com', quiero: true });
  out.otroOrigen = await pedir({ plan: 'pro', nombre: 'Otro', email: 'otro@ejemplo.com', whatsapp: '5491112345678', quiero: true }, 'https://sitio-ajeno.com');
  out.noCreoNada = JSON.stringify(db.leads) === sinTablaAntes;
  out.limpio = pedidoLimpio({ email: 'no-es-correo', origen: 'planes', verificado: false });

  // ── La ruta de la bandeja: sólo el super admin ──
  const ruta = await import('../app/api/admin/pedidos-ingreso/route');
  esAdmin = false;
  out.getSinAdmin = (await ruta.GET()).status;
  out.postSinAdmin = (await ruta.POST(new NextRequest('https://hola-mako.com/api/admin/pedidos-ingreso', { method: 'POST', body: JSON.stringify({ id: 1 }) }))).status;
  esAdmin = true;
  const g = await ruta.GET();
  out.getConAdmin = { status: g.status, emails: ((await g.json()).pedidos as Array<{ email: string }>).map((f) => f.email) };

  // ── Lo que espera a Martín, y a dónde lleva el aviso ──
  // Desde el 6/11/2026 «Quieren entrar» está en la portada de Admin (la copia de Polar): el link es /admin, sin `?tab=`.
  out.linkDelAviso = mails.some((m) => m.tag === 'pedido-ingreso' && /https?:\/\/\S+\/admin$/m.test(m.cuerpo) && !m.cuerpo.includes('/admin?tab='));
  db.agencia_clientes = [{ agencia_ws: 10, cliente_ws: 20, estado: 'pendiente' }];
  db.agencia_altas = [{ id: 1, agencia_ws: 10, cliente_ws: 20, email: 'x@ejemplo.com', estado: 'pendiente' }];
  const { cuantoEspera } = await import('../lib/pedidos-ingreso');
  out.espera = await cuantoEspera();

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
