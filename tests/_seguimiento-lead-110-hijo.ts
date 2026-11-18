// =============================================================================
// Hijo de tests/seguimiento-lead-110.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Ticket #110 (Marcela, 18/11/2026): «agendar llamar en dos semanas» deja DOS propuestas en el mismo turno —la nota en la ficha y el
// evento del Calendario— y el «sí» que sigue tiene que confirmar las dos. Por las funciones REALES de la API (`ejecutarOperacion` para
// proponer y para `confirmar_accion`, que es por donde pasa el «sí» del grupo: `PENDIENTES_POR_REGISTRO`, lib/mako-doer-in.ts) sobre un
// PostgREST de mentira (tests/_postgrest-de-mentira.ts). Sin modelos y sin red. Datos inventados.
// Corre con `--conditions=react-server`. Escribe una línea `@@SEG@@<json>` por escena.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 900;
const pg = crearPostgrest({
  tablas: [
    'workspaces', 'app_settings', 'mako_acciones_pendientes', 'leads', 'lead_audit', 'calendario_eventos', 'usuarios', 'anthropic_usage',
    'errores_app', 'tickets', 'propuestas', 'workspace_miembros', 'push_suscripciones',
  ],
  defaults: (t, f) => ({ id: ++n, ...(t === 'mako_acciones_pendientes' ? { created_at: new Date().toISOString(), estado: 'pendiente' } : {}), ...f }),
});
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

const WS = 23;
const JID = '120363000000000110@g.us';
const QUIEN = '5491100000110@s.whatsapp.net';
const salida = (nombre: string, datos: unknown) => console.log(`@@SEG@@${JSON.stringify({ nombre, ...(datos as object) })}`);

function base(): void {
  pg.vaciar();
  pg.db.workspaces.push({ id: WS, nombre: 'Inmobiliaria de prueba', capa: 'completo', estado: 'activo' });
  pg.db.leads.push({ id: 501, workspace_id: WS, nombre: 'Valery Prueba', telefono: '5491100000501', pipeline_stage: 'nuevo' });
}

/** El contexto de un turno del grupo: el del doer (lib/mako-doer-in.ts, `ctxApi`). */
const turno = (turnStart: number, mensajeUsuario: string) => ({
  ws: WS, canal: 'whatsapp', canalKey: JID, alcance: 'ejecutar', rol: 'admin', turnStart, mensajeUsuario, actor: 'Marcela',
  enElGrupo: { quien: QUIEN, aMaKo: true },
});

const PEDIDO = 'Mako agrega una nota al lead valery que quede agendada en su ficha del CRM, la nota dice : agendar llamar en dos semanas para coordinar reunión (estaban terminando de hacer unos arreglos en la casa de Villa del Parque)';
const NOTA = { leadId: 501, texto: 'Agendar llamar en dos semanas para coordinar reunión (estaban terminando de hacer unos arreglos en la casa de Villa del Parque).' };
const EVENTO = { titulo: 'Llamar a Valery Prueba', tipo: 'llamada', fecha: '2026-12-02', hora: '10:00', duracionMin: 15, notas: 'Lead: Valery Prueba. Coordinar la reunión.' };

async function main() {
  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { runWithWorkspace } = await import('../lib/workspace');
  const correr = (id: string, input: Record<string, unknown>, ctx: Record<string, unknown>) =>
    runWithWorkspace(WS, () => ejecutarOperacion(id, input, ctx as never, 'json'));
  const estados = () => pg.db.mako_acciones_pendientes.map((p) => ({ id: p.id, tipo: p.tipo, estado: p.estado }));
  const lo = () => ({
    notas: pg.db.lead_audit.filter((a) => a.campo === 'Nota').map((a) => ({ lead: a.lead_id, valor: a.valor_nuevo })),
    eventos: pg.db.calendario_eventos.map((e) => ({ titulo: e.titulo, tipo: e.tipo, inicio: e.inicio, dia_completo: e.dia_completo, notas: e.notas })),
  });

  // ── 1. LA TANDA: las dos en el MISMO turno; el «sí» del turno siguiente, sin id, confirma las dos ──
  base();
  const t1 = Date.now() - 120_000;
  const propNota = await correr('agregar_nota_lead', NOTA, turno(t1, PEDIDO));
  const propEvento = await correr('crear_evento_calendario', EVENTO, turno(t1, PEDIDO));
  const payloads = pg.db.mako_acciones_pendientes.map((p) => p.payload);
  const si = await correr('confirmar_accion', {}, turno(Date.now() + 5_000, 'sí'));
  salida('tanda', { propNota, propEvento, payloads, si, estados: estados(), ...lo() });

  // ── 2. DE DOS TURNOS DISTINTOS: el «sí» sin id es ambiguo, se pregunta cuál y no se ejecuta nada ──
  base();
  await correr('agregar_nota_lead', NOTA, turno(Date.now() - 300_000, PEDIDO));
  await correr('crear_evento_calendario', EVENTO, turno(Date.now() - 120_000, 'y agéndame llamarla'));
  const siAmbiguo = await correr('confirmar_accion', {}, turno(Date.now() + 5_000, 'sí'));
  salida('dos-turnos', { si: siAmbiguo, estados: estados(), ...lo() });

  // ── 3. EN EL MISMO TURNO QUE LAS PROPUSO: el candado anti auto-confirm, para cada una ──
  base();
  const t3 = Date.now() - 1_000;
  await correr('agregar_nota_lead', NOTA, turno(t3, PEDIDO));
  await correr('crear_evento_calendario', EVENTO, turno(t3, PEDIDO));
  const siSolo = await correr('confirmar_accion', {}, turno(t3, PEDIDO));
  salida('mismo-turno', { si: siSolo, estados: estados(), ...lo() });

  // ── 4. CON UN ID: ésa sola, aunque haya otra de su tanda ──
  base();
  const t4 = Date.now() - 120_000;
  await correr('agregar_nota_lead', NOTA, turno(t4, PEDIDO));
  await correr('crear_evento_calendario', EVENTO, turno(t4, PEDIDO));
  const idEvento = pg.db.mako_acciones_pendientes.find((p) => p.tipo === 'crear_evento_calendario')?.id;
  const siUna = await correr('confirmar_accion', { id: idEvento }, turno(Date.now() + 5_000, 'sí, el evento'));
  salida('con-id', { si: siUna, estados: estados(), ...lo() });

  salida('red', { red });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
