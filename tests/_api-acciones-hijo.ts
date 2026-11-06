// =============================================================================
// Hijo de tests/api-mako-acciones-1710.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre los runners REALES de `sacar_lead_de_secuencia` (chatbot.run.ts), `guardar_landing` con productos y
// `listar_landings` (landing.run.ts) contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts) con DOS
// negocios, en un node aparte con `--conditions=react-server` (esos módulos llevan `server-only`).
// Lo que se mira es lo que QUEDA ESCRITO y que lo de otro negocio no existe. Nada sale a la red: lo que no es la base
// se anota en `ia` y tiene que dar vacío. `after()` (next/server) GUARDA la función en vez de correrla.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
const despues: Array<() => unknown> = [];
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === 'next/server') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, after: (fn: () => unknown) => { despues.push(fn); } };
  }
  return cargarOriginal.call(this, pedido, padre, esMain);
};

const TABLAS = ['workspaces', 'leads', 'funnels', 'productos', 'nutricion_secuencias', 'nutricion_inscripciones', 'lead_audit', 'app_settings', 'landing_analyses', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 9000;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'lead_audit') return { id: siguienteId++, created_at: ahoraIso(), ...f };
    return { ...f };
  },
});

/** Lo que salió a la red y no fue a la base: tiene que ser nada. */
const ia: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  ia.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS_A = 3; // el negocio que opera
const WS_B = 9; // el otro: sus ids no existen para A

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  // Por el REGISTRO (runners.ts): importar un .run.ts suelto cae en un ciclo (runners.ts → chatbot.run → runners.ts).
  const { runnerDe } = await import('../lib/api-mako/runners');
  const db = pg.db;
  const out: Record<string, unknown> = {};

  type Ctx = { ws: number; canal: 'whatsapp'; canalKey: string; alcance: 'ejecutar'; rol: 'admin'; actor: string };
  type R = {
    preparar?: (i: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>;
    ejecutar?: (p: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>;
    leer?: (i: Record<string, unknown>, c: Ctx) => Promise<string | { content: string }>;
  };
  const ctx = (ws: number): Ctx => ({ ws, canal: 'whatsapp', canalKey: 'wa:prueba', alcance: 'ejecutar', rol: 'admin', actor: 'Martín' });
  const enA = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_A, fn);
  const sacar = runnerDe('sacar_lead_de_secuencia') as unknown as R;
  const guardarLanding = runnerDe('guardar_landing') as unknown as R;
  const listarLandings = runnerDe('listar_landings') as unknown as R;

  const texto = (r: string | { content: string }): string => (typeof r === 'string' ? r : r.content);
  const reset = () => {
    pg.vaciar(); ia.length = 0; despues.length = 0;
    db.workspaces.push({ id: WS_A, nombre: 'A', slug: 'a', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.workspaces.push({ id: WS_B, nombre: 'B', slug: 'b', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.leads.push({ id: 101, workspace_id: WS_A, nombre: 'Ana', created_at: ahoraIso() });
    db.leads.push({ id: 102, workspace_id: WS_A, nombre: 'Beto', created_at: ahoraIso() });
    db.leads.push({ id: 202, workspace_id: WS_B, nombre: 'Berta', created_at: ahoraIso() });
    db.nutricion_secuencias.push({ id: 11, workspace_id: WS_A, nombre: 'Bienvenida', clave: 'bienvenida', activa: true });
    db.nutricion_secuencias.push({ id: 12, workspace_id: WS_A, nombre: 'Seguimiento', clave: 'seguimiento', activa: true });
    db.nutricion_secuencias.push({ id: 21, workspace_id: WS_B, nombre: 'De B', clave: 'de-b', activa: true });
    db.funnels.push({ id: 1, workspace_id: WS_A, nombre: 'Funnel principal', canal: 'llamada', es_default: true, declarado: true, activo: true, orden: 0 });
    db.funnels.push({ id: 2, workspace_id: WS_A, nombre: 'Mentoría', canal: 'llamada', es_default: false, declarado: true, activo: true, orden: 1 });
    db.funnels.push({ id: 3, workspace_id: WS_A, nombre: 'Archivado', canal: 'llamada', es_default: false, declarado: true, activo: false, orden: 2 });
    db.funnels.push({ id: 77, workspace_id: WS_B, nombre: 'De B', canal: 'llamada', es_default: true, declarado: true, activo: true, orden: 0 });
  };
  const insc = (id: number, lead: number, sec: number, estado: string, extra: Fila = {}) =>
    db.nutricion_inscripciones.push({ id, workspace_id: WS_A, lead_id: lead, secuencia_id: sec, estado, paso_actual: 1, proximo_envio_at: '2026-10-18T10:00:00Z', ...extra });
  const fila = (id: number) => structuredClone(db.nutricion_inscripciones.find((f) => f.id === id) ?? null);
  const historial = (lead: number): string[] => db.lead_audit.filter((h) => h.lead_id === lead).map((h) => String(h.valor_nuevo ?? h.valor ?? ''));
  const confirmar = async (r: R, input: Record<string, unknown>) => {
    const prep = await enA(() => r.preparar!(input, ctx(WS_A)));
    if ('error' in prep) return { prep, ejec: null };
    return { prep, ejec: await enA(() => r.ejecutar!(prep.payload as Record<string, unknown>, ctx(WS_A))) };
  };

  // ── SACAR A UN LEAD DE UNA SECUENCIA ───────────────────────────────────────────────────────
  {
    reset();
    insc(1, 101, 11, 'activa'); insc(2, 102, 11, 'activa'); insc(3, 101, 12, 'activa');
    const r = await confirmar(sacar, { leadId: 101, secuenciaId: 11 });
    out.sacarActiva = { prep: r.prep, ejec: r.ejec, suya: fila(1), otroLead: fila(2), otraSecuencia: fila(3), historial: historial(101) };
  }
  {
    reset();
    insc(1, 101, 11, 'respondio'); insc(2, 102, 12, 'handoff');
    const a = await confirmar(sacar, { leadId: 101, secuenciaId: 11 });
    const b = await confirmar(sacar, { leadId: 102, secuenciaId: 12 });
    out.sacarRespondioYHandoff = { a: a.ejec, b: b.ejec, filaA: fila(1), filaB: fila(2) };
  }
  {
    reset();
    insc(1, 101, 11, 'completada', { desenlace: 'logrado' }); insc(2, 102, 11, 'cancelada'); insc(3, 101, 12, 'cuarentena');
    out.sacarYaEstaba = {
      completada: await enA(() => sacar.preparar!({ leadId: 101, secuenciaId: 11 }, ctx(WS_A))),
      cancelada: await enA(() => sacar.preparar!({ leadId: 102, secuenciaId: 11 }, ctx(WS_A))),
      noEstaba: await enA(() => sacar.preparar!({ leadId: 102, secuenciaId: 12 }, ctx(WS_A))),
      desconocido: await enA(() => sacar.preparar!({ leadId: 101, secuenciaId: 12 }, ctx(WS_A))),
      filas: [fila(1), fila(2), fila(3)],
    };
  }
  {
    reset();
    insc(1, 101, 11, 'activa'); db.nutricion_inscripciones.push({ id: 9, workspace_id: WS_B, lead_id: 202, secuencia_id: 21, estado: 'activa', paso_actual: 0, proximo_envio_at: '2026-10-18T10:00:00Z' });
    out.sacarAjeno = {
      leadAjeno: await enA(() => sacar.preparar!({ leadId: 202, secuenciaId: 11 }, ctx(WS_A))),
      secuenciaAjena: await enA(() => sacar.preparar!({ leadId: 101, secuenciaId: 21 }, ctx(WS_A))),
      ambosAjenos: await enA(() => sacar.preparar!({ leadId: 202, secuenciaId: 21 }, ctx(WS_A))),
      deB: fila(9),
    };
  }
  {
    // Entre el «proponer» y el «sí» la inscripción terminó sola: no se toca.
    reset();
    insc(1, 101, 11, 'activa');
    const prep = await enA(() => sacar.preparar!({ leadId: 101, secuenciaId: 11 }, ctx(WS_A)));
    db.nutricion_inscripciones.find((f) => f.id === 1)!.estado = 'completada';
    const ejec = await enA(() => sacar.ejecutar!(prep.payload as Record<string, unknown>, ctx(WS_A)));
    out.sacarCambioEnElMedio = { ejec, fila: fila(1), historial: historial(101) };
  }

  // ── LOS PRODUCTOS DE UNA LANDING ───────────────────────────────────────────────────────────
  const URL_L = 'https://mi-sitio.com/oferta';
  const configGuardada = (): unknown => {
    const s = db.app_settings.find((x) => x.workspace_id === WS_A && x.key === 'landing.config');
    try { return s ? JSON.parse(String(s.value)) : null; } catch { return s?.value ?? null; }
  };
  {
    reset();
    const lista = await enA(() => listarLandings.leer!({}, ctx(WS_A)));
    out.listarSinNada = JSON.parse(texto(lista));
    const r = await confirmar(guardarLanding, { url: URL_L, productos: ['2'] });
    out.landingConProductos = { prep: r.prep, ejec: r.ejec, config: configGuardada() };
    // Guardar la misma página SIN `productos` no se los saca (la trampa del mapper campo por campo).
    const sin = await confirmar(guardarLanding, { url: URL_L });
    out.landingSinProductos = { config: configGuardada(), resumen: (sin.prep as { resumen?: string }).resumen ?? null };
    const lista2 = await enA(() => listarLandings.leer!({}, ctx(WS_A)));
    out.listarDespues = JSON.parse(texto(lista2));
    // Una lista vacía los saca todos.
    const vacia = await confirmar(guardarLanding, { url: URL_L, productos: [] });
    out.landingVaciaProductos = { prep: vacia.prep, config: configGuardada() };
  }
  {
    reset();
    const ajeno = await enA(() => guardarLanding.preparar!({ url: URL_L, productos: ['77'] }, ctx(WS_A)));
    const archivado = await enA(() => guardarLanding.preparar!({ url: URL_L, productos: ['3'] }, ctx(WS_A)));
    const basura = await enA(() => guardarLanding.preparar!({ url: URL_L, productos: ['uno'] }, ctx(WS_A)));
    out.landingProductosMalos = { ajeno, archivado, basura, config: configGuardada() };
  }
  {
    // LA PÁGINA DE GRACIAS (6/11/2026): marcarla, que guardar otra cosa no la desmarque, y desmarcarla.
    reset();
    const marcar = await confirmar(guardarLanding, { url: URL_L, productos: ['2'], gracias: true });
    const conGracias = configGuardada();
    const otraCosa = await confirmar(guardarLanding, { url: URL_L, conversion: 'agenda' });
    const sigue = configGuardada();
    const desmarcar = await confirmar(guardarLanding, { url: URL_L, gracias: false });
    const sinProductos = await enA(() => guardarLanding.preparar!({ url: 'https://mi-sitio.com/gracias', gracias: true }, ctx(WS_A)));
    const basura = await enA(() => guardarLanding.preparar!({ url: URL_L, gracias: 'si' }, ctx(WS_A)));
    out.landingGracias = {
      resumen: (marcar.prep as { resumen?: string }).resumen ?? null, conGracias, otraCosa: !!otraCosa.ejec, sigue,
      desmarcadoResumen: (desmarcar.prep as { resumen?: string }).resumen ?? null, final: configGuardada(),
      sinProductos: (sinProductos as { resumen?: string }).resumen ?? null, basura,
    };
  }
  out.ia = [...ia];
  process.stdout.write(`\n@@JSON@@${JSON.stringify(out)}@@FIN@@\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
