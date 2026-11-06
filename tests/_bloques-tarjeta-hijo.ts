// =============================================================================
// Hijo de tests/chat-bloques.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Confirma `crear_diseno_imagen` por el camino REAL de la tarjeta del chat (`confirmarDesdeTarjeta`, lib/mako-turno-app.ts:
// la sesión, la pendiente, el runner, el «Hecho: …» en el hilo) contra un PostgREST de mentira
// (tests/_postgrest-de-mentira.ts), en un node aparte con `--conditions=react-server` (esos módulos llevan `server-only`).
// Imprime lo que devolvió la tarjeta y lo que quedó guardado en `chart_chats`. Nada sale a la red: lo que no es la base
// se anota en `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'chart_sessions', 'chart_chats', 'mako_acciones_pendientes', 'image_disenos', 'app_settings', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 500;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'chart_chats') return { id: siguienteId++, created_at: ahoraIso(), bloques: null, ...f };
    if (tabla === 'mako_acciones_pendientes') return { id: siguienteId++, estado: 'pendiente', created_at: ahoraIso(), origen: null, resultado: null, resuelto_at: null, ...f };
    if (tabla === 'image_disenos') return { version: 1, miniatura: null, borrado_at: null, created_at: ahoraIso(), updated_at: ahoraIso(), ...f };
    return { ...f };
  },
});

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3; // el negocio de prueba (nunca el 1)
const SESION = 77;
const CHART_KEY = 'mako:persona-de-prueba';

async function main() {
  const { confirmarDesdeTarjeta } = await import('../lib/mako-turno-app');
  const { canalKeyDeSesion } = await import('../lib/mako-turno-app-reglas');
  // Una plantilla de MaKo (6/11/2026: las 10 de Doory se borraron, y son las reales las que acepta `crear_diseno_imagen`).
  const { PLANTILLAS_IMAGEN } = await import('../lib/image-editor/plantillas-reales');
  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
  db.chart_sessions.push({ id: SESION, workspace_id: WS, chart_key: CHART_KEY, titulo: 'Diseños', contexto: null, pinned: false, archived: false, created_at: ahoraIso(), updated_at: ahoraIso() });
  const persona = { ws: WS, rol: 'admin' as const, actor: 'Prueba', chartKey: CHART_KEY };
  const vence = new Date(Date.now() + 3_600_000).toISOString();
  const pendiente = (id: number, payload: Record<string, unknown>) => db.mako_acciones_pendientes.push({
    id, workspace_id: WS, grupo_jid: canalKeyDeSesion(SESION), tipo: 'crear_diseno_imagen', payload,
    resumen: 'Crear el diseño', estado: 'pendiente', vence_at: vence, created_at: new Date(Date.now() - 60_000).toISOString(),
  });

  const real = PLANTILLAS_IMAGEN[0];
  const slug = real?.id ?? '';
  pendiente(11, { titulo: 'Promo de octubre', tamano: 'publicacion_vertical' });
  pendiente(12, { titulo: 'Desde plantilla', plantilla: slug });
  const enBlanco = await confirmarDesdeTarjeta(persona, SESION, 11);
  const dePlantilla = await confirmarDesdeTarjeta(persona, SESION, 12);
  process.stdout.write(JSON.stringify({
    enBlanco, dePlantilla, slug, medida: [real?.ancho ?? 0, real?.alto ?? 0],
    guardados: db.chart_chats.map((m) => ({ session_id: m.session_id, role: m.role, content: m.content, bloques: m.bloques })),
    disenos: db.image_disenos.map((d) => d.id),
    red,
  }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
