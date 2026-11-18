// =============================================================================
// Hijo de tests/api-mako-nucleo-1811.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre código REAL del núcleo de la API de MaKo contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts), en un node
// aparte con `--conditions=react-server` (los módulos llevan `server-only`). Nada sale a la red: lo que no es la base se anota en
// `ia`. Tres partes (F114, 18/11/2026):
//   1. la tool vieja `proponer_lead` (lib/mako-doer-acciones.ts) con `propuestas` SIN aplicar: `crearPropuesta` tira y la tool
//      tiene que devolver la falla como nuestra (`noCorrio`), no como una regla;
//   2. `crearPropuesta` (lib/propuestas.ts) con la misma `ref` sobre una propuesta APLICADA: una acción entra de nuevo, un lead no;
//   3. `cerrarConfirmadasColgadas` (lib/mako-pendientes.ts): cierra las 'confirmada' cortadas, por su reclamo o su vencimiento,
//      y no toca lo vigente ni lo resuelto.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

let siguiente = 500;
const pg = crearPostgrest({
  tablas: ['workspaces', 'app_settings', 'usuarios', 'leads', 'propuestas', 'mako_acciones_pendientes'],
  defaults: (tabla, f) => (tabla === 'mako_acciones_pendientes' ? { id: siguiente++, ...f } : { ...f }),
});

const ia: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  ia.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { crearRunnerAcciones } = await import('../lib/mako-doer-acciones');
  const { crearPropuesta } = await import('../lib/propuestas');
  const { cerrarConfirmadasColgadas } = await import('../lib/mako-pendientes');
  const out: Record<string, unknown> = {};

  // 1. La falla nuestra, con la tabla sin aplicar.
  pg.faltan.add('propuestas');
  const run = crearRunnerAcciones(WS, '120363000000000000@g.us', 0, 'anota a Ana López, su teléfono es 5215512345678');
  out.crudo = await runWithWorkspace(WS, () => run('proponer_lead', { nombre: 'Ana López', telefono: '5215512345678' }));
  out.regla = await runWithWorkspace(WS, () => run('proponer_lead', { nombre: '' }));
  pg.faltan.delete('propuestas');

  // 2. La misma `ref` sobre una propuesta ya APLICADA.
  const aplicar = (id: string) => { const f = pg.db.propuestas.find((p) => p.id === id); if (f) f.estado = 'aplicada'; };
  const accion1 = await crearPropuesta({ ws: WS, tipo: 'accion', datos: { operacion: 'pausar_campana' }, resumen: 'Pausar «Otoño»', ref: 'ref-accion', origen: 'app' });
  aplicar(accion1.id);
  const accion2 = await crearPropuesta({ ws: WS, tipo: 'accion', datos: { operacion: 'pausar_campana' }, resumen: 'Pausar «Otoño»', ref: 'ref-accion', origen: 'app' });
  const accion3 = await crearPropuesta({ ws: WS, tipo: 'accion', datos: { operacion: 'pausar_campana' }, resumen: 'Pausar «Otoño»', ref: 'ref-accion', origen: 'app' });
  const lead1 = await crearPropuesta({ ws: WS, tipo: 'lead', datos: { nombre: 'Ana' }, resumen: 'Ana', ref: 'ref-lead', origen: 'app' });
  aplicar(lead1.id);
  const lead2 = await crearPropuesta({ ws: WS, tipo: 'lead', datos: { nombre: 'Ana' }, resumen: 'Ana', ref: 'ref-lead', origen: 'app' });
  out.refs = { accion1, accion2, accion3, lead1, lead2 };

  // 3. Las confirmadas colgadas.
  const AHORA = Date.parse('2026-11-18T12:00:00Z');
  const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();
  const fila = (id: number, extra: Record<string, unknown>) => ({
    id, workspace_id: WS, grupo_jid: 'app:1', tipo: 'pausar_campana', payload: {}, resumen: `#${id}`, estado: 'confirmada',
    vence_at: hace(-60), resuelto_at: null, resultado: null, reclamada_at: null, created_at: hace(90), ...extra,
  });
  pg.db.mako_acciones_pendientes.push(
    fila(1, { reclamada_at: hace(45) }),                  // reclamada hace 45 min, sin resultado: cortada
    fila(2, { reclamada_at: hace(5) }),                   // reclamada hace 5 min: puede estar corriendo
    fila(3, { vence_at: hace(40) }),                      // de antes de la 0420 (sin hora del reclamo), vencida hace 40: cortada
    fila(4, { vence_at: hace(10) }),                      // sin hora del reclamo, vencida hace 10: todavía no
    fila(5, { reclamada_at: hace(45), estado: 'ejecutada', resuelto_at: hace(40) }), // ya terminó: no se toca
    fila(6, { reclamada_at: hace(45), estado: 'pendiente' }),                        // no se reclamó: no se toca
  );
  out.cerradas = await cerrarConfirmadasColgadas(AHORA);
  out.colgadas = pg.db.mako_acciones_pendientes.map((p) => ({ id: p.id, estado: p.estado, resultado: p.resultado }));
  // Sin la 0420 (la columna no existe todavía), cierra igual por el vencimiento.
  out.ia = [...ia];
  process.stdout.write(`\n@@JSON@@${JSON.stringify(out)}@@FIN@@\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
