// =============================================================================
// Hijo de tests/optin-visita.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el POST REAL de app/api/track/optin (el opt-in del Pixel) contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts),
// en un node aparte con `--conditions=react-server` (la ruta trae `server-only`). El caso de O44 (18/11/2026): una persona que
// YA estaba en el CRM se vuelve a registrar con el mismo email; desde d4d759ce5 (14/11) eso no deja propuesta y se suma directo
// a su ficha, y la ficha se quedaba sin la llave de esa visita (`visitor_id`). Imprime un JSON con lo que contestó la ruta y lo
// que quedó en cada ficha. Nada sale a la red. Datos inventados.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['webhook_routing', 'workspaces', 'funnels', 'app_settings', 'leads', 'lead_funnel', 'lead_audit', 'propuestas', 'vsl_events'] as const;
let siguienteId = 800;
const pg = crearPostgrest({ tablas: TABLAS, defaults: (_t, f) => ({ id: siguienteId++, created_at: new Date().toISOString(), ...f }) });

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
const TOKEN = 'tok-landing-de-prueba';

async function main() {
  const { POST } = await import('../app/api/track/optin/route');
  const { normalizar } = await import('../lib/webhook-routing');
  const db = pg.db;
  const out: Record<string, unknown> = {};
  let ip = 10;

  const reset = () => {
    pg.vaciar(); red.length = 0;
    db.workspaces.push({ id: WS, nombre: 'Negocio de prueba', estado: 'activo', capa: 'completo' });
    db.webhook_routing.push({ servicio: 'landing', identificador: normalizar(TOKEN), workspace_id: WS });
    db.funnels.push({ id: 31, workspace_id: WS, nombre: 'Principal', es_default: true, orden: 0, activo: true, pipeline: null, entradas: ['landing'] });
    // Ana ya está en el CRM, sin visita atada; Bruno ya tiene la suya (otro dispositivo).
    db.leads.push({ id: 501, workspace_id: WS, nombre: 'Ana Prueba', email: 'ana@ejemplo.test', telefono: null, telefono_normalizado: null, visitor_id: null, funnel_id: null, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: '2026-11-01T00:00:00Z' });
    db.leads.push({ id: 502, workspace_id: WS, nombre: 'Bruno Prueba', email: 'bruno@ejemplo.test', telefono: null, telefono_normalizado: null, visitor_id: 'v-de-antes', funnel_id: null, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: '2026-11-01T00:00:00Z' });
  };
  const enviar = async (cuerpo: Record<string, unknown>) => {
    const req = new Request('https://hola-mako.com/api/track/optin', {
      method: 'POST', body: JSON.stringify({ token: TOKEN, pagina: 'https://mi-landing.test/gracias', ...cuerpo }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++ip}` },
    });
    const r = await POST(req as never);
    return { status: r.status, body: await r.json().catch(() => null) as Record<string, unknown> | null };
  };
  const visitaDe = (id: number) => db.leads.find((l) => l.id === id)?.visitor_id ?? null;

  // 1) Ana se vuelve a registrar con su email y la cookie de esta visita: se suma directo a su ficha, y la ficha queda con la visita.
  reset();
  out.ana = { r: await enviar({ nombre: 'Ana Prueba', email: 'ana@ejemplo.test', visitor_id: 'v-nueva' }), visita: visitaDe(501), leads: db.leads.length, propuestas: db.propuestas.length };
  // 2) Bruno ya tenía una visita (otro dispositivo): no se pisa.
  reset();
  out.bruno = { r: await enviar({ nombre: 'Bruno Prueba', email: 'bruno@ejemplo.test', visitor_id: 'v-otra' }), visita: visitaDe(502) };
  // 3) Sin cookie (un formulario que no la manda): no se escribe nada.
  reset();
  out.sinCookie = { r: await enviar({ nombre: 'Ana Prueba', email: 'ana@ejemplo.test' }), visita: visitaDe(501) };
  out.red = red;
  // Con marca: la ruta escribe sus propios console.log en el mismo stdout.
  process.stdout.write(`\n@@OPTIN@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
