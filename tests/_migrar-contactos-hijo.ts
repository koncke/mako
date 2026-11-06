// =============================================================================
// Hijo de tests/migrar-contactos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La migración de la agencia de Thiago (6/11/2026) sobre el código REAL —`createLead` (lib/leads.ts), la operación
// `migrar_contactos` por el camino de un token detallado (`aplicarEnElActo`, lib/api-mako/flujo.ts) y la cohorte de una
// automatización (`leadsDeCohorte`, lib/nutricion.ts)— contra un PostgREST de mentira, en un node aparte con
// `--conditions=react-server`. Nada sale a la red: lo que no es la base se anota en `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

const TABLAS = [
  'workspaces', 'leads', 'funnels', 'lead_funnel', 'usuarios', 'app_settings', 'propuestas', 'mako_acciones_pendientes',
  'lead_events', 'lead_audit', 'crm_lead_etiquetas', 'webhook_routing', 'agencia_clientes', 'agencias', 'api_llamadas',
] as const;
let siguienteId = 5000;
const ahoraIso = () => new Date().toISOString();
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'leads') return { id: siguienteId++, estado_lead: 'abierto', created_at: ahoraIso(), updated_at: ahoraIso(), ...f };
    if (tabla === 'mako_acciones_pendientes') return { id: `pend-${siguienteId++}`, estado: 'pendiente', created_at: ahoraIso(), ...f };
    return { id: siguienteId++, created_at: ahoraIso(), ...f };
  },
  // El índice único de la 0405: la red de dos altas a la vez con el mismo id del CRM viejo.
  unicos: [{
    tabla: 'leads', nombre: 'leads_ws_id_externo_uq', columnas: ['workspace_id', 'migrado_de', 'id_externo'],
    donde: (f: Fila) => f.id_externo != null,
  }],
});

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3; // el de prueba (nunca el 1)
const OTRO = 4; // otro negocio: lo de acá no lo ve

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { createLead } = await import('../lib/leads');
  const { esLeadYaMigrado } = await import('../lib/migracion-leads');
  const { leadsDeCohorte } = await import('../lib/nutricion');
  const { porId } = await import('../lib/api-mako/registro');
  const { aplicarEnElActo } = await import('../lib/api-mako/flujo');
  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.workspaces.push({ id: OTRO, nombre: 'Otro', slug: 'otro', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.funnels.push({ id: 70, workspace_id: WS, nombre: 'Ventas', canal: null, data: {}, declarado: true, es_default: true, activo: true, orden: 0 });
  // Un lead de siempre (entró por la landing) y uno que ya está con el email de un migrado.
  db.leads.push({ id: 101, workspace_id: WS, nombre: 'Vivo', email: 'vivo@ejemplo.test', estado_lead: 'abierto', pipeline_stage: 'lead', origen_lead: 'landing', created_at: ahoraIso() });
  db.leads.push({ id: 102, workspace_id: WS, nombre: 'Rosa Prado', email: 'rosa@ejemplo.test', estado_lead: 'abierto', pipeline_stage: 'lead', origen_lead: 'landing', created_at: ahoraIso() });
  // En OTRO negocio, alguien con el mismo id del CRM viejo: no cuenta para éste.
  db.leads.push({ id: 201, workspace_id: OTRO, nombre: 'Ajeno', email: 'ajeno@ejemplo.test', estado_lead: 'abierto', id_externo: 'ghl-1', migrado_de: 'GoHighLevel', created_at: ahoraIso() });

  const out: Record<string, unknown> = {};

  // ── 1. createLead: el mismo id dos veces ────────────────────────────────────
  await runWithWorkspace(WS, async () => {
    const a = await createLead({ nombre: 'Ana Ruiz', email: 'ana@ejemplo.test', id_externo: 'x-1', migrado_de: 'HubSpot', fecha_original: '2025-03-14T00:00:00.000Z', utm_source: 'fb', origen_lead: 'migracion' });
    const fila = db.leads.find((l) => l.id === a.id) ?? {};
    let segunda: string;
    try { await createLead({ nombre: 'Ana Ruiz', telefono: '5491100000000', id_externo: 'x-1', migrado_de: 'HubSpot', permitirDuplicado: true }); segunda = 'creó otra'; }
    catch (e) { segunda = esLeadYaMigrado(e) ? `ya migrado #${e.leadId}` : `otro error: ${e instanceof Error ? e.message : e}`; }
    // El mismo id, de OTRO CRM viejo: es otra persona.
    const b = await createLead({ nombre: 'Ana de otro CRM', email: 'ana2@ejemplo.test', id_externo: 'x-1', migrado_de: 'Pipedrive' });
    out.alta = {
      creado: a.id, idExterno: fila.id_externo, migradoDe: fila.migrado_de, fechaOriginal: fila.fecha_original, utm: fila.utm_source, origen: fila.origen_lead,
      segunda, otroCrm: b.id !== a.id,
    };
  });

  // ── 2. La operación entera, como la llama un token detallado con escritura en el CRM ─────────────
  const def = porId('migrar_contactos');
  if (!def || def.tipo !== 'accion') throw new Error('falta migrar_contactos');
  const ctx = { ws: WS, canal: 'http' as const, canalKey: `http:${WS}`, alcance: 'ejecutar' as const, rol: 'admin' as const, permisos: { crm: 'escritura' as const }, actor: 'API · token «Migración»' };
  const lote = {
    crmAnterior: 'GoHighLevel',
    contactos: [
      { idExterno: 'ghl-1', nombre: 'Luis Gómez', email: 'luis@ejemplo.test', etapa: 'lead', fechaOriginal: '2025-01-02', utm_campaign: 'verano' },
      { idExterno: 'ghl-2', nombre: 'Marta Sol', telefono: '+34 600 000 000', etapa: 'Lead entrante' },
      { idExterno: 'ghl-3', nombre: 'Rosa Prado', email: 'rosa@ejemplo.test' },            // ya estaba por email (el 102)
      { idExterno: 'ghl-4', nombre: 'Cerrado Ya', email: 'cerrado@ejemplo.test', etapa: 'ganado' }, // final: afuera
      { idExterno: 'ghl-5', nombre: 'Sin Contacto' },                                         // sin contacto: afuera
      { idExterno: 'ghl-1', nombre: 'Luis Repetido', email: 'luis2@ejemplo.test' },           // id repetido en el lote
    ],
  };
  const r1 = await runWithWorkspace(WS, () => aplicarEnElActo(def, lote, ctx, { ws: WS, origen: 'api:t_prueba' }));
  const migrados = db.leads.filter((l) => l.workspace_id === WS && l.migrado_de === 'GoHighLevel');
  const r2 = await runWithWorkspace(WS, () => aplicarEnElActo(def, lote, ctx, { ws: WS, origen: 'api:t_prueba' }));
  out.operacion = {
    r1: { ok: r1.ok, resumen: r1.resumen, datos: r1.datos ?? null },
    r2: { ok: r2.ok, resumen: r2.resumen },
    migrados: migrados.map((l) => ({ id: l.id, nombre: l.nombre, idExterno: l.id_externo, etapa: l.pipeline_stage, origen: l.origen_lead, fechaOriginal: l.fecha_original ?? null, utm: l.utm_campaign ?? null })),
    rosa: { idExterno: db.leads.find((l) => l.id === 102)?.id_externo ?? null, origen: db.leads.find((l) => l.id === 102)?.origen_lead ?? null },
    totalEnWs: db.leads.filter((l) => l.workspace_id === WS).length,
    ajenoIntacto: db.leads.filter((l) => l.workspace_id === OTRO).length === 1,
  };

  // ── 3. La cohorte de «Un Lead Entró» (las parados en «lead»): el migrado NO, el de siempre SÍ ─────
  out.cohorte = await runWithWorkspace(WS, async () => ({
    etapa: await leadsDeCohorte('etapa_actual', 'lead', null),
    sinVentana: await leadsDeCohorte('etapa_actual', 'lead', null, null, null, { sinVentana: true }),
  }));
  // ── 4. El alta en lote de siempre (`proponer_leads`), aplicada en el acto: las UTM que manda Claude llegan al lead ─────
  const defLote = porId('proponer_leads');
  if (!defLote || defLote.tipo !== 'accion') throw new Error('falta proponer_leads');
  const r4 = await runWithWorkspace(WS, () => aplicarEnElActo(defLote, { leads: [{ nombre: 'Con Campaña', email: 'campana@ejemplo.test', utm_source: 'ig', utm_campaign: 'otoño' }] }, ctx, { ws: WS, origen: 'api:t_prueba' }));
  const conCampana = db.leads.find((l) => l.email === 'campana@ejemplo.test');
  out.lote = { ok: r4.ok, utm_source: conCampana?.utm_source ?? null, utm_campaign: conCampana?.utm_campaign ?? null };

  out.ids = { vivo: 101, rosa: 102, migrados: migrados.map((l) => l.id) };
  out.red = red;
  process.stdout.write('@@RESULTADO@@' + JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
