// =============================================================================
// Hijo de tests/ticket-121-buscar-leads-aproximados.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre REAL, contra un PostgREST de mentira, `buscar_leads` (runMakoTool: lo que usan el doer de WhatsApp, el chat de la app y
// el registro). El ticket #121: una nota de voz pidió «Carolina Casab, que tiene agenda el miércoles 25 a las 15», la lead se
// llama «Carolina Cassab» y MaKo dijo «no aparece en la base». Los datos son inventados (el molde: tests/_leads-por-campana-hijo.ts).
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.
// =============================================================================

import { mock } from 'node:test';
import { crearPostgrest } from './_postgrest-de-mentira';

process.env.SUPABASE_URL = 'http://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';
process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba-suficientemente-largo';
process.env.APP_BASE_URL = 'https://mako.test';

const WS = 31, OTRO = 32;

const pg = crearPostgrest({
  tablas: ['leads', 'marketing_metrics_daily', 'app_settings', 'workspaces', 'funnels', 'funnel_config', 'lead_funnel', 'pagos', 'productos', 'credenciales', 'usuarios'],
});
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host);
  return new Response(JSON.stringify({ error: `red de mentira: ${u.host}` }), { status: 500 });
}) as typeof fetch;

const lead = (o: Record<string, unknown>) => ({
  workspace_id: WS, nombre: null, email: null, empresa: null, telefono: null, telefono_normalizado: null,
  created_at: '2026-11-19T15:00:00.000Z', estado_lead: 'abierto', pipeline_stage: null, closer: null, setter: null,
  meta_campaign_id: null, meta_campaign_name: null, meta_ad_id: null, meta_ad_name: null, utm_campaign: null, utm_content: null,
  adset_id_origen: null, origen_lead: null, fecha_junta_1: null, junta_1_at: null, fecha_junta_2: null, junta_2_at: null, ...o,
});
db.workspaces = [{ id: WS, nombre: 'Inmobiliaria Prueba', capa: 'completo', estado: 'activo' }, { id: OTRO, nombre: 'Otro', capa: 'completo', estado: 'activo' }];
db.app_settings = [{ id: 1, workspace_id: WS, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires', updated_at: '2026-11-01T00:00:00.000Z' }];
db.leads = [
  // La del ticket: doble «s», con su R1 el miércoles 25/11 a las 15:00 de Buenos Aires.
  lead({ id: 6381, nombre: 'Carolina Cassab', telefono: '+54 9 11 5555 0001', email: 'carolina.c@correo.test', fecha_junta_1: '2026-11-25', junta_1_at: '2026-11-25T18:00:00.000Z' }),
  // Otra Carolina, a la MISMA hora otro día: «carolina casab» no la puede traer.
  lead({ id: 2624, nombre: 'Carolina Benítez', telefono: '+54 9 11 5555 0002', email: 'carolina.b@correo.test', fecha_junta_1: '2026-11-23', junta_1_at: '2026-11-23T18:00:00.000Z' }),
  lead({ id: 6364, nombre: 'Rodrigo Paz', telefono: '+54 9 11 5555 0003', fecha_junta_1: '2026-11-23', junta_1_at: '2026-11-23T18:00:00.000Z' }),
  lead({ id: 6317, nombre: 'Lucía Fernández', telefono: '+54 9 11 5555 0004' }),
  // Un nombre de pila a una letra de otro (mariana ~ mariano): sólo puede volver como APROXIMADA.
  lead({ id: 7001, nombre: 'Mariana López', telefono: '+54 9 11 4444 1234', email: 'mariana@correo.test' }),
  // OTRO negocio, el mismo nombre: no puede salir nunca.
  { ...lead({ id: 9001, nombre: 'Carolina Casab', telefono: '+54 9 11 0000 0000' }), workspace_id: OTRO },
];

async function main() {
  mock.module('next/cache', { namedExports: { unstable_cache: (f: unknown) => f, revalidateTag: () => {}, revalidatePath: () => {}, updateTag: () => {} } });
  mock.module('next/headers', { namedExports: { cookies: async () => ({ get: () => undefined }), headers: async () => ({ get: () => null }) } });
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runMakoTool } = await import('../lib/mako-tools');
  const buscar = (texto: string) => runWithWorkspace(WS, async () => {
    const out = await runMakoTool('buscar_leads', { texto });
    const crudo = typeof out === 'string' ? out : (out as { content: string }).content;
    return { crudo, json: JSON.parse(crudo) as Record<string, unknown> };
  });
  const R: Record<string, unknown> = {};
  for (const [k, t] of Object.entries({
    casab: 'carolina casab', exacto: 'Carolina Cassab', carolina: 'carolina', mariano: 'Mariano López', marianoSolo: 'Mariano',
    karolina: 'Karolina Casab', telefono: '+54 9 11 5555 0009', email: 'carolina.c@correo.tst', alReves: 'cassab carolina',
    conTilde: 'carolína cassab', nadie: 'Pedro Inexistente',
  })) R[k] = await buscar(t);
  R.red = red;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}`); });
