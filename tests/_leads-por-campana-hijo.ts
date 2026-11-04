// =============================================================================
// Hijo de tests/leads-por-campana.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES, contra un PostgREST de mentira: `buscar_leads` (runMakoTool, lo que usa el doer de WhatsApp), el runner de
// `listar_leads` del registro, `listLeads` y los mapas de campañas de las métricas (lib/queries.ts). Ticket #56: «los leads de la
// campaña recon Finca Cortesin, con nombre y teléfono». Los datos son inventados.
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

const WS = 19, OTRO = 20;
const CAMP = '120200000000000001';   // «RECON - Finca Cortesín 2026», con leads
const CAMP_SIN = '120200000000000002'; // «Recon Sotogrande», en las métricas y sin leads
const AD = '120200000000000901';      // un anuncio de CAMP: el formulario de Meta trae el anuncio, no la campaña

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

let id = 1000;
const lead = (o: Record<string, unknown>) => ({
  id: ++id, workspace_id: WS, nombre: null, email: null, empresa: null, telefono: null, telefono_normalizado: null,
  created_at: '2026-10-20T15:00:00.000Z', estado_lead: 'abierto', pipeline_stage: null, closer: null, setter: null,
  meta_campaign_id: null, meta_campaign_name: null, meta_ad_id: null, meta_ad_name: null, utm_campaign: null, utm_content: null,
  adset_id_origen: null, origen_lead: null, ...o,
});
db.workspaces = [{ id: WS, nombre: 'Inmobiliaria Prueba', capa: 'completo', estado: 'activo' }, { id: OTRO, nombre: 'Otro', capa: 'completo', estado: 'activo' }];
db.leads = [
  // De la landing: `utm_campaign` es el ID de la campaña, no su nombre (así guarda la landing).
  lead({ nombre: 'Lucía Ferrer Díaz', telefono: '+34 611 222 333', utm_campaign: CAMP, origen_lead: 'calendly', created_at: '2026-10-28T10:00:00.000Z' }),
  lead({ nombre: 'Tomás Vidal', telefono: '+34 622 333 444', utm_campaign: CAMP, created_at: '2026-10-25T10:00:00.000Z' }),
  lead({ nombre: 'Elena Soler', telefono: '+34 633 444 555', utm_campaign: CAMP, created_at: '2026-10-22T10:00:00.000Z' }),
  lead({ nombre: 'Marcos Gil', email: 'marcos@correo.test', utm_campaign: CAMP, created_at: '2026-10-21T10:00:00.000Z' }),
  // Del formulario de Meta: trae el ANUNCIO; la campaña sale de las métricas.
  lead({ nombre: 'Inés Prado', telefono: '+34 644 555 666', meta_ad_id: AD, origen_lead: 'instant_form', created_at: '2026-10-30T10:00:00.000Z' }),
  lead({ nombre: 'Raúl Montes', telefono: '+34 655 666 777', meta_ad_id: AD, origen_lead: 'instant_form', created_at: '2026-10-19T10:00:00.000Z' }),
  // Otra campaña, sólo con el nombre escrito.
  lead({ nombre: 'Clara Nieto', telefono: '+34 666 777 888', meta_campaign_name: 'Prospección Marbella' }),
  // Sin campaña.
  lead({ nombre: 'Pablo Sanz', telefono: '+34 677 888 999' }),
  // OTRO negocio, la MISMA campaña: no puede salir.
  { ...lead({ nombre: 'Persona De Otro Negocio', telefono: '+34 600 000 000', utm_campaign: CAMP }), workspace_id: OTRO },
  // Veintidós con el mismo apellido: `buscar_leads` devuelve 20 y DICE los otros dos.
  ...Array.from({ length: 22 }, (_, i) => lead({ nombre: `Cliente Ruiz ${i + 1}`, telefono: `+34 690 000 ${String(100 + i)}` })),
];
db.marketing_metrics_daily = [
  { id: 1, workspace_id: WS, fecha: '2026-10-20', plataforma: 'meta', ad_id: AD, ad_name: 'Video recorrido', adset_id: '120200000000000501', campaign_id: CAMP, campaign_name: 'RECON - Finca Cortesín 2026' },
  { id: 2, workspace_id: WS, fecha: '2026-10-21', plataforma: 'meta', ad_id: '120200000000000902', ad_name: 'Carrusel', adset_id: '120200000000000502', campaign_id: CAMP_SIN, campaign_name: 'Recon Sotogrande' },
];

async function main() {
  mock.module('next/cache', { namedExports: { unstable_cache: (f: unknown) => f, revalidateTag: () => {}, revalidatePath: () => {}, updateTag: () => {} } });
  mock.module('next/headers', { namedExports: { cookies: async () => ({ get: () => undefined }), headers: async () => ({ get: () => null }) } });
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runMakoTool } = await import('../lib/mako-tools');
  const { RUNNERS } = await import('../lib/api-mako/areas/crm.run');
  const como = <T>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);
  const leer = (out: unknown) => JSON.parse(typeof out === 'string' ? out : (out as { content: string }).content) as Record<string, unknown>;
  const listar = RUNNERS.listar_leads as { leer: (i: Record<string, unknown>, c: Record<string, unknown>) => Promise<unknown> };
  const R: Record<string, unknown> = {};

  // 1. Lo de WhatsApp: el texto de Natalia, con el canal del código. La lista va aparte; el modelo, sólo cuántos.
  const aparte: string[] = [];
  R.whatsapp = await como(async () => leer(await runMakoTool('buscar_leads', { texto: 'Campaña recon Finca Cortesin' }, { aPersona: (t) => aparte.push(t) })));
  R.aparte = aparte;
  // 2. Sin el canal (la app sin dibujo, HTTP): las filas en lo que lee el modelo.
  R.sinCanal = await como(async () => leer(await runMakoTool('buscar_leads', { texto: 'recon finca cortesin' })));
  // 3. Una persona se busca como siempre, y con más de 20 se dice cuántos quedaron afuera.
  R.persona = await como(async () => leer(await runMakoTool('buscar_leads', { texto: 'Lucía' })));
  R.muchos = await como(async () => leer(await runMakoTool('buscar_leads', { texto: 'ruiz' })));
  // 4. Nadie se llama así y no habla de una campaña: el «no encontré» de siempre.
  R.nadie = await como(async () => leer(await runMakoTool('buscar_leads', { texto: 'Pedro Inexistente' })));
  // 5. Habla de una campaña que no existe: las que hay, para preguntar cuál.
  R.noExiste = await como(async () => leer(await runMakoTool('buscar_leads', { texto: 'campaña de Ibiza' })));
  // 6. listar_leads con `campana`: nombre parcial, sin fecha; con fecha, también filtra; una que existe y no tiene leads.
  R.listar = await como(async () => leer(await listar.leer({ campana: 'cortesin' }, { ws: WS, canal: 'app' })));
  R.listarConFecha = await como(async () => leer(await listar.leer({ campana: 'cortesin', desde: '2026-10-24' }, { ws: WS, canal: 'app' })));
  R.listarSinLeads = await como(async () => leer(await listar.leer({ campana: 'sotogrande' }, { ws: WS, canal: 'app' })));
  // 7. Sin campana, las filas de siempre traen el teléfono.
  R.listarComun = await como(async () => leer(await listar.leer({ limite: 100 }, { ws: WS, canal: 'app' })));

  // 8. EL TURNO REAL de WhatsApp (lib/doer-herramientas.ts con el clasificador), con los mensajes de Natalia. En producción la
  //    clase la puso la IA (`clase:actuar`, anthropic_usage del 4/11): las reglas solas dicen «capturar», así que se fuerza
  //    «actuar» como hizo el despacho. El tercero, solo y como seguimiento del segundo (`sigueElHilo`, lib/doer-hilo.ts).
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const { herramientasDelTurno } = await import('../lib/doer-herramientas');
  const { MAKO_TOOLS } = await import('../lib/mako-tools');
  const { MAKO_ACCION_TOOLS } = await import('../lib/mako-doer-acciones');
  const deSiempre = [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => ({ name: t.name, description: t.description }));
  const vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: WS, rol: 'admin', tabs: null } as const;
  const M2 = 'de TODOS los leads entrantes de la campaña, con nombre, apellido y numero de contacto';
  const M3 = 'de la campaña: Campaña recon Finca Cortesin';
  const turno = (texto: string, hilo?: string) => {
    const v = { ...clasificarIntencion(texto, { makoPregunto: true }), intencion: 'actuar' as const, dudosa: false, ...(hilo ? { sigueElHilo: true } : {}) };
    return herramientasDelTurno({ veredicto: v as never, texto, hilo: hilo ?? null, agendaAbierta: false, deSiempre, vista: vista as never, hayPendientes: false, contextoDelSi: null, sinCalendly: true })
      .tools.map((t) => t.name);
  };
  R.turno = { m2: turno(M2), m3: turno(M3), m3ConHilo: turno(M3, M2), descripcionBuscar: deSiempre.find((t) => t.name === 'buscar_leads')?.description ?? '' };

  R.red = red;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}`); });
