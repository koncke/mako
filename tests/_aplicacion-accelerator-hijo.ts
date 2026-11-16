// =============================================================================
// Hijo de tests/aplicacion-accelerator.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La aplicación a MaKo Accelerator ENTERA, sobre un PostgREST de mentira: corren REALES `POST /api/accelerator/aplicar` y
// `aplicarAlAccelerator` (lib/aplicacion-accelerator-servidor.ts: el lead, su historial, «Quieren entrar»), y lo que se le
// manda a Martín se arma con el render de verdad de un correo (lib/email-html.ts). Sólo el envío del correo y el workspace van de
// mentira. Es lo que en producción no se puede probar sin dejar un lead y un correo de verdad.
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`. Imprime el resultado como JSON.

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
db.workspaces = [{ id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' }];

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

type Correo = { to: string; tag: string; asunto: string; preheader: string; cuerpo: string };
const correos: Correo[] = [];
let correo: 'sale' | 'tira' | 'no-sale' = 'sale';
stub('lib/invitaciones.ts', {
  avisarDePlataforma: async (m: Correo) => {
    if (correo === 'tira') throw new Error('Resend no contestó');
    if (correo === 'no-sale') return { enviado: false, error: 'remitente de prueba' };
    correos.push(m);
    return { enviado: true };
  },
});
// Si la ruta (o lo que llama) leyera la sesión, esto lo cuenta: no tiene que pasar nunca.
let lecturasDeSesion = 0;
stub('lib/auth.ts', {
  getSesionAdmin: async () => { lecturasDeSesion++; return null; },
  getUsuarioActual: async () => { lecturasDeSesion++; return null; },
});

const LLENA = {
  nombre: 'Ana', apellido: 'Pérez', whatsapp: '+54 9 11 5555-0101', email: 'Ana@EstudioAna.com',
  negocio: 'Estudio Ana', rubro: 0, red: 'https://www.instagram.com/ana.coach/', antiguedad: 3, clientes: 2, ticket: 2, audiencia: 1,
  facturacion: 1, equipo: 1, implementa: 0, situacion: 0, canal: [0, 2], tecnologia: 1,
  queHaces: 'Acompaño a coaches de salud a armar su programa grupal.\n\nY lo venden por encima de US$ 2.000.',
  meta: 'Llegar a US$ 20.000 por mes con el programa grupal.',
  // Lo que escribe cualquiera en un formulario público, y va a un correo.
  obstaculo: 'Me frena <script>alert(1)</script> y <img src=x onerror=alert(2)> todo lo demás.',
  porQue: 'Porque ya validé la oferta con 14 clientes y ejecuto rápido.',
  horas: 1, inversion: 1, decision: 0, empezar: 0, compromiso: true,
};

async function main() {
  const { getSupabaseServer } = await import('../lib/supabase');
  stub('lib/workspace.ts', {
    runWithWorkspace: async (_ws: number, f: () => unknown) => f(),
    getTenantDb: async () => getSupabaseServer(),
    getWorkspaceActual: async () => 9,
    wsSuperAdmin: async () => 9,
    getWorkspace: async () => db.workspaces[0],
  });
  const { POST } = await import('../app/api/accelerator/aplicar/route');
  const { NextRequest } = await import('next/server');
  const { renderEmailHtml } = await import('../lib/email-html');
  const { TEXTO_NO_SE_GUARDO } = await import('../lib/aplicacion-accelerator-servidor');

  let ip = 0;
  const aplicar = async (body: unknown, o: { origin?: string | null; ip?: string; crudo?: string; largo?: string } = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': o.ip ?? `10.0.0.${++ip}` };
    if (o.origin !== null) headers.origin = o.origin ?? 'https://hola-mako.com';
    if (o.largo) headers['content-length'] = o.largo;
    const r = await POST(new NextRequest('https://hola-mako.com/api/accelerator/aplicar', { method: 'POST', headers, body: o.crudo ?? JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  const filas = () => ({ leads: db.leads.length, audit: db.lead_audit.length, pedidos: db.pedidos_ingreso.length, correos: correos.length });
  const out: Record<string, unknown> = {};

  // ── Califica: el lead, su historial, «Quieren entrar» y el correo ──
  out.califica = await aplicar({ respuestas: LLENA, web: '', origen: { landing: 'accelerator', utm_source: 'fb', utm_campaign: 'acc-nov', fbclid: 'IwAR123', otra: 'x' } });
  out.lead = db.leads.map((l) => ({ nombre: l.nombre, email: l.email, telefono: l.telefono, origen_lead: l.origen_lead, utm_source: l.utm_source, utm_campaign: l.utm_campaign, fbclid: l.fbclid }));
  out.historial = db.lead_audit.map((a) => ({ lead: a.lead_id, campo: a.campo, valor: a.valor_nuevo, autor: a.autor }));
  out.pedido = db.pedidos_ingreso.map((f) => ({ email: f.email, nombre: f.nombre, origen: f.origen, detalle: f.detalle, whatsapp: f.whatsapp, lead_id: f.lead_id }));
  out.correo = correos[0] ?? null;
  out.html = correos[0] ? renderEmailHtml({ subject: correos[0].asunto, bodyText: correos[0].cuerpo, preheader: correos[0].preheader, fromName: 'MaKo' }) : '';

  // ── No califica (factura menos de US$ 5.000): llega igual, y el correo lo dice ──
  out.noCalifica = await aplicar({ respuestas: { ...LLENA, email: 'beto@ejemplo.com', nombre: 'Beto', facturacion: 0 }, web: '' });
  out.correoNoCalifica = correos[1] ? { asunto: correos[1].asunto, preheader: correos[1].preheader, cuerpo: correos[1].cuerpo } : null;

  // ── Lo que NO entra, y no deja nada ──
  const antes = filas();
  out.trampa = await aplicar({ respuestas: { ...LLENA, email: 'bot@ejemplo.com' }, web: 'https://spam.example' });
  out.otroSitio = await aplicar({ respuestas: { ...LLENA, email: 'ajeno@ejemplo.com' } }, { origin: 'https://sitio-ajeno.com' });
  out.sinOrigin = await aplicar({ respuestas: { ...LLENA, email: 'sin@ejemplo.com' } }, { origin: null });
  out.whatsappMal = await aplicar({ respuestas: { ...LLENA, email: 'wa@ejemplo.com', whatsapp: '12345' } });
  out.indiceFuera = await aplicar({ respuestas: { ...LLENA, email: 'idx@ejemplo.com', facturacion: 9 } });
  out.muyLargaCampo = await aplicar({ respuestas: { ...LLENA, email: 'largo@ejemplo.com', meta: 'a'.repeat(2001) } });
  out.cuerpoDeclaradoGrande = await aplicar({ respuestas: LLENA }, { largo: String(70 * 1024) });
  out.cuerpoGrande = await aplicar(null, { crudo: JSON.stringify({ respuestas: LLENA, relleno: 'x'.repeat(70 * 1024) }) });
  out.noEsJson = await aplicar(null, { crudo: '{"respuestas": ' });
  out.nadaNuevo = JSON.stringify(filas()) === JSON.stringify(antes);

  // ── Topes: por email (4 por hora, desde IPs distintas) y por IP (10 por hora) ──
  const porEmail = [];
  for (let i = 0; i < 5; i++) porEmail.push((await aplicar({ respuestas: { ...LLENA, email: 'insiste@ejemplo.com' } })).status);
  out.porEmail = porEmail;
  const porIp = [];
  for (let i = 0; i < 11; i++) porIp.push((await aplicar({ respuestas: { ...LLENA, email: `ip${i}@ejemplo.com` }, web: 'bot' }, { ip: '203.0.113.9' })).status);
  out.porIp = porIp;

  // ── Nunca se pierde ──
  correo = 'tira';
  out.conElCorreoCaido = await aplicar({ respuestas: { ...LLENA, email: 'sin-correo@ejemplo.com' } });
  out.leadSinCorreo = db.leads.some((l) => l.email === 'sin-correo@ejemplo.com');
  correo = 'sale';
  pg.faltan.add('leads');
  const correosAntes = correos.length;
  out.conLaBaseCaida = await aplicar({ respuestas: { ...LLENA, email: 'sin-base@ejemplo.com' } });
  out.correoSinBase = correos.slice(correosAntes).map((c) => c.cuerpo);
  correo = 'no-sale';
  out.conTodoCaido = await aplicar({ respuestas: { ...LLENA, email: 'nada@ejemplo.com' } });
  out.textoNoSeGuardo = TEXTO_NO_SE_GUARDO;
  pg.faltan.delete('leads');
  correo = 'sale';

  out.lecturasDeSesion = lecturasDeSesion;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
