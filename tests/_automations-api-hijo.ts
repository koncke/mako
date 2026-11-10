// =============================================================================
// Hijo de tests/automations-api.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Lo que la API de MaKo abrió de Automations el 10/11/2026, por las funciones REALES sobre un PostgREST de mentira:
// `renombrar_automatizacion` (un token detallado: `aplicarEnElActo`) y `espera_por_tarjeta` (`ejecutarOperacion`).
// Escribe una línea `@@AUT_API@@<json>` por escena.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 700;
const pg = crearPostgrest({
  tablas: ['workspaces', 'nutricion_secuencias', 'nutricion_inscripciones', 'mako_acciones_pendientes', 'app_settings', 'leads'],
  defaults: (t, f) => ({ id: ++n, ...(t === 'mako_acciones_pendientes' ? { created_at: new Date().toISOString(), estado: 'pendiente' } : {}), ...f }),
});
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  return pg.responder(u, init);
}).bind(null) as typeof fetch;

const WS = 3;
const ahora = () => new Date().toISOString();
function base(): void {
  pg.vaciar();
  pg.db.workspaces.push({ id: 9, nombre: 'Plataforma', capa: 'superadmin', estado: 'activo' }, { id: WS, nombre: 'Negocio de prueba', capa: 'completo', estado: 'activo' });
  pg.db.nutricion_secuencias.push({
    id: 41, workspace_id: WS, clave: 's41', nombre: 'Bienvenida', emoji: null, activa: true, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'nuevo',
    etapas: null, funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null, instance_name: null, estrategia: null,
    created_at: ahora(), updated_at: ahora(),
    pasos: [
      { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
      { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola, te escribo por lo que dejaste en el formulario', siguiente: null },
    ],
  }, {
    id: 42, workspace_id: 77, clave: 's42', nombre: 'De otro negocio', activa: true, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'nuevo', pasos: [], created_at: ahora(), updated_at: ahora(),
  });
}

const detallado = { ws: WS, canal: 'http', canalKey: `http:${WS}`, rol: 'admin', alcance: 'ejecutar', permisos: { chatbot: 'escritura' }, token: { id: 'tk', nombre: 'Claude' }, actor: 'API · token «Claude»', persona: 'duena@negocio-ficticio.com' };
const salida = (nombre: string, datos: unknown) => console.log(`@@AUT_API@@${JSON.stringify({ nombre, ...(datos as object) })}`);

async function main() {
  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { aplicarEnElActo } = await import('../lib/api-mako/flujo');
  const { porId } = await import('../lib/api-mako/registro');
  const { runWithWorkspace } = await import('../lib/workspace');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (id: string) => porId(id) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = detallado as any;

  // ── renombrar ──
  base();
  const r1 = await runWithWorkspace(WS, () => aplicarEnElActo(def('renombrar_automatizacion'), { secuenciaId: 41, nombre: '  Bienvenida   nueva ', emoji: '🎉' }, ctx, { ws: WS, origen: 'api:tk' }));
  const fila = pg.db.nutricion_secuencias.find((s) => s.id === 41);
  const igual = await runWithWorkspace(WS, () => aplicarEnElActo(def('renombrar_automatizacion'), { secuenciaId: 41, nombre: 'Bienvenida nueva' }, ctx, { ws: WS, origen: 'api:tk' }));
  const vacio = await runWithWorkspace(WS, () => aplicarEnElActo(def('renombrar_automatizacion'), { secuenciaId: 41 }, ctx, { ws: WS, origen: 'api:tk' }));
  const noEmoji = await runWithWorkspace(WS, () => aplicarEnElActo(def('renombrar_automatizacion'), { secuenciaId: 41, nombre: 'Otra', emoji: 'xx' }, ctx, { ws: WS, origen: 'api:tk' }));
  const ajeno = await runWithWorkspace(WS, () => aplicarEnElActo(def('renombrar_automatizacion'), { secuenciaId: 42, nombre: 'Robada' }, ctx, { ws: WS, origen: 'api:tk' }));
  salida('renombrar', { r1, nombreFila: fila?.nombre, emoji: fila?.emoji, igual, vacio, noEmoji, nombreTrasNoEmoji: pg.db.nutricion_secuencias.find((s) => s.id === 41)?.nombre, ajeno, nombre42: pg.db.nutricion_secuencias.find((s) => s.id === 42)?.nombre });

  // ── espera_por_tarjeta ──
  base();
  const vacia = await runWithWorkspace(WS, () => ejecutarOperacion('espera_por_tarjeta', { secuenciaId: 41 }, ctx, 'query'));
  // Dos leads esperando en el WhatsApp, con el envío de WhatsApp del negocio sin prender (el default de un cliente).
  pg.db.leads.push({ id: 901, workspace_id: WS, nombre: 'Lead Secreto Uno', telefono: '5215511112222' }, { id: 902, workspace_id: WS, nombre: 'Lead Secreto Dos', telefono: '5215511113333' });
  pg.db.nutricion_inscripciones.push(
    { id: 1, workspace_id: WS, lead_id: 901, secuencia_id: 41, estado: 'activa', paso_actual: 1, nodo_actual: 'm1', proximo_envio_at: ahora() },
    { id: 2, workspace_id: WS, lead_id: 902, secuencia_id: 41, estado: 'activa', paso_actual: 1, nodo_actual: 'm1', proximo_envio_at: ahora() },
  );
  const conDos = await runWithWorkspace(WS, () => ejecutarOperacion('espera_por_tarjeta', { secuenciaId: 41 }, ctx, 'query'));
  const otra = await runWithWorkspace(WS, () => ejecutarOperacion('espera_por_tarjeta', { secuenciaId: 42 }, ctx, 'query'));
  salida('espera', { vacia, conDos, otra });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
