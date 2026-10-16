// =============================================================================
// Hijo de tests/plan-repriorizar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/plan-repriorizar.ts lleva `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server` y le contesta al test con un JSON (molde: tests/_fathom-carga-hijo.ts).
// Corre las funciones REALES —arrancar, avanzar por tandas, el sondeo del tablero, el cron y los
// runners de la API de MaKo— contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts).
//
// Lo único de mentira es el MODELO: `puntuarNuevas`, `asignarTareasAProyectos` y `puntuarProyectos`
// (lib/mako-guardian.ts) se cambian en `Module._load` por funciones que ANOTAN qué les llegó (qué
// tareas, contra qué vara, en qué momento del trabajo) y contestan lo que el escenario diga, o tiran
// el error de la cascada cuando nadie contesta. Todo lo demás que salga a la red se cuenta en `ia`
// (tiene que dar 0: el trabajo no habla con ningún proveedor por fuera del Perro de siempre).
// `after()` (next/server) GUARDA la función en vez de correrla: así se ve qué contestó el sondeo
// antes de que la tanda empiece, y después se la corre a mano.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
const despues: Array<() => unknown> = [];

type LlamadaPuntuar = { ids: string[]; titulos: string[]; vara: string[]; varaScores: number[]; motivo: string; conCapacidades: boolean | undefined; hechasAlLlamar: number | null };
const llamadas = {
  puntuar: [] as LlamadaPuntuar[],
  rutear: [] as Array<{ titulos: string[]; destinos: string[] }>,
  proyectos: 0,
};
/** ¿Falla la llamada n (0, 1, …) a `puntuarNuevas`? */
let fallaPuntuar: (n: number) => boolean = () => false;
let trabajoEnCurso: number | null = null;
/** Ids por los que el modelo de mentira contesta AUNQUE no se los pregunten (un modelo que inventa un
 *  id o arrastra uno de otra corrida): la SEGUNDA capa del candado tiene que frenarlos al escribir. */
let colar: string[] = [];

Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === 'next/server') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, after: (fn: () => unknown) => { despues.push(fn); } };
  }
  if (pedido === '@/lib/auth') return { getUsuarioActual: async () => ({ id: 1, nombre: 'Martín', email: 'martin@mako.test', rol: 'admin' }), getSesionAdmin: async () => ({ id: 1, nombre: 'Martín', email: 'martin@mako.test', rol: 'admin' }) };
  if (pedido === './mako-guardian' || pedido === '@/lib/mako-guardian') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return {
      ...real,
      puntuarNuevas: async (nuevas: Array<{ id: string; titulo: string }>, existentes: Array<{ titulo: string; score: number }>, _contexto: string, motivo?: string, opts?: { conCapacidades?: boolean }) => {
        const n = llamadas.puntuar.length;
        const fila = trabajoEnCurso == null ? null : pg.db.plan_repriorizaciones.find((f) => f.id === trabajoEnCurso);
        llamadas.puntuar.push({
          ids: nuevas.map((x) => x.id), titulos: nuevas.map((x) => x.titulo), vara: existentes.map((e) => e.titulo), varaScores: existentes.map((e) => e.score),
          motivo: motivo ?? '', conCapacidades: opts?.conCapacidades, hechasAlLlamar: fila ? Number(fila.hechas) : null,
        });
        if (fallaPuntuar(n)) throw new Error('mako-guardian: gemini no contestó (HTTP 429) y esta feature no se degrada ni se paga');
        // Un número por tarea, distinto y estable: 40 + la posición en la tanda.
        const extra = colar.map((id) => ({ id, score: 3, razon: 'colado', impacto: 1, esfuerzo: 1 }));
        return { tareas: [...nuevas.map((x, i) => ({ id: x.id, score: 40 + i, razon: `juicio de ${x.titulo}`, impacto: 50, esfuerzo: 20 })), ...extra], faltantes: [], usage: { model: 'gemini-de-mentira', inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0, costUsd: 0 } };
      },
      asignarTareasAProyectos: async (tareas: Array<{ titulo: string }>, destinos: Array<{ nombre: string }>) => {
        llamadas.rutear.push({ titulos: tareas.map((t) => t.titulo), destinos: destinos.map((d) => d.nombre) });
        const asign: Array<{ i: number; destino: string; razon: string }> = [];
        const nuevos: Array<{ nombre: string; que: string; porQue: string; tareas: number[] }> = [];
        tareas.forEach((t, i) => {
          const s = t.titulo.toLowerCase();
          if (s.includes('anuncio')) asign.push({ i, destino: 'Anuncios', razon: 'es publicidad' });
          else if (s.includes('reels')) asign.push({ i, destino: 'Contenido orgánico', razon: 'es orgánico' });
          else if (s.includes('crm')) asign.push({ i, destino: 'Feature: CRM', razon: 'es del CRM' });
          else if (s.includes('webinar')) nuevos.push({ nombre: 'Webinar Inventado', que: '', porQue: 'no había uno', tareas: [i] });
        });
        return { asign, nuevos };
      },
      puntuarProyectos: async (proyectos: Array<{ id: string }>) => {
        llamadas.proyectos++;
        return { proyectos: proyectos.map((p, i) => ({ id: p.id, score: 90 - i * 7, razon: `le gana a otro (${p.id})` })) };
      },
    };
  }
  // El norte y los objetivos: lecturas de settings que no son de este test.
  if (pedido === '@/lib/fase-store' || pedido === './fase-store') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, faseNegocioTexto: async () => '' };
  }
  if (pedido === '@/lib/objectives' || pedido === './objectives') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, objetivosContextoTexto: async () => '' };
  }
  return cargarOriginal.call(this, pedido, padre, esMain);
};

const TABLAS = ['workspaces', 'experimento_tareas', 'tarea_categorias', 'plan_tareas', 'plan_proyectos', 'plan_dependencias',
  'plan_repriorizaciones', 'leads', 'app_settings', 'usuarios', 'credenciales', 'anthropic_usage', 'mako_acciones_pendientes'] as const;
let siguienteId = 5000;
const ahoraIso = () => new Date().toISOString();
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'experimento_tareas') return { id: siguienteId++, estado: 'por_hacer', progreso: 0, orden: 0, score: 0, score_manual: false, prioridad: 'media', categorias: [], checklist: [], historial: [], recurrente: false, origen: 'mako', retro_id: null, experimento_id: null, detalle: null, created_at: ahoraIso(), updated_at: ahoraIso(), ...f };
    if (tabla === 'tarea_categorias') return { id: siguienteId++, created_at: ahoraIso(), historial: [], ...f };
    if (tabla === 'plan_tareas') return { estado: 'por_hacer', progress: 0, score: 0, score_base: null, score_manual: false, labels: [], historial: [], recurrente: false, detalle: '', created_at: ahoraIso(), ...f };
    if (tabla === 'plan_repriorizaciones') {
      return { id: siguienteId++, estado: 'corriendo', fase: 'tareas', ids: [], total: 0, hechas: 0, puntuadas: 0, ruteadas: 0, fijadas: 0, sin_puntuar: 0, intentos: 0, vuelta: 0, tomada_hasta: null, error: null, modelo: null, cambios: [], actor: '', origen: 'tablero', created_at: ahoraIso(), updated_at: ahoraIso(), terminado_at: null, ...f };
    }
    return { ...f };
  },
  // El índice único parcial de la mig 0297: un trabajo corriendo por tablero.
  unicos: [{ tabla: 'plan_repriorizaciones', columnas: ['workspace_id', 'tablero'], donde: (f) => f.estado === 'corriendo', nombre: 'ux_plan_repriorizaciones_uno_por_tablero' }],
});

/** Lo que salió a la red y no fue a la base: tiene que ser nada. */
const ia: string[] = [];
/** La base, mirada desde afuera: cuántos inserts chocaron con el índice único (409) y cuántas veces
 *  alguien quiso TOMAR una tanda y perdió el compare-and-set (PATCH con `vuelta=eq.` sin filas). */
const base = { choques: 0, casPerdidos: 0, ocultarCorriendo: 0 };
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    const metodo = (init.method ?? 'GET').toUpperCase();
    const tabla = u.pathname.replace('/rest/v1/', '');
    // LA CARRERA, a propósito: la lectura «¿hay uno corriendo?» contesta que no (como cuando dos
    // pedidos leen antes de que el otro escriba), y lo único que queda es el índice único.
    if (tabla === 'plan_repriorizaciones' && metodo === 'GET' && u.searchParams.get('estado') === 'eq.corriendo' && base.ocultarCorriendo > 0) {
      base.ocultarCorriendo--;
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0' } });
    }
    const r = await pg.responder(u, init);
    if (tabla === 'plan_repriorizaciones') {
      if (r.status === 409) base.choques++;
      if (metodo === 'PATCH' && u.searchParams.has('vuelta') && String(init.body ?? '').includes('"tomada_hasta"') && String(init.body ?? '').includes('"vuelta"')) {
        const filas = await r.clone().json().catch(() => null);
        if (Array.isArray(filas) && filas.length === 0) base.casPerdidos++;
      }
    }
    return r;
  }
  ia.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS_CLI = 3;
const WS_DUE = 9;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const rp = await import('../lib/plan-repriorizar');
  const out: Record<string, unknown> = {};
  const db = pg.db;
  const reset = () => {
    pg.vaciar(); llamadas.puntuar.length = 0; llamadas.rutear.length = 0; llamadas.proyectos = 0;
    fallaPuntuar = () => false; trabajoEnCurso = null; despues.length = 0; ia.length = 0; colar = [];
    base.choques = 0; base.casPerdidos = 0; base.ocultarCorriendo = 0;
    db.workspaces.push({ id: WS_CLI, nombre: 'Cliente', slug: 'cli', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.workspaces.push({ id: WS_DUE, nombre: 'MaKo', slug: 'mako', estado: 'activo', capa: 'superadmin', created_at: ahoraIso() });
  };
  const tarea = (f: Fila) => db.experimento_tareas.push({ workspace_id: WS_CLI, estado: 'por_hacer', progreso: 0, orden: 0, score_manual: false, prioridad: 'media', categorias: [79], checklist: [], historial: [], recurrente: false, origen: 'mako', retro_id: null, experimento_id: null, detalle: 'algo', created_at: ahoraIso(), updated_at: ahoraIso(), ...f });
  const sembrarCliente = (nPlan = 45, extras = true) => {
    db.tarea_categorias.push({ workspace_id: WS_CLI, id: 77, nombre: 'Anuncios', color: '#111', emoji: '🎯', created_at: '2026-01-01T00:00:00Z' });
    db.tarea_categorias.push({ workspace_id: WS_CLI, id: 78, nombre: 'Sin proyecto', color: '#999', emoji: '📥', created_at: '2026-01-02T00:00:00Z' });
    db.tarea_categorias.push({ workspace_id: WS_CLI, id: 79, nombre: 'Ventas', color: '#222', emoji: '💰', created_at: '2026-01-03T00:00:00Z' });
    // Las del plan: las últimas cinco nacieron libres (score 0).
    for (let i = 1; i <= nPlan; i++) tarea({ id: 1000 + i, titulo: `Tarea ${i}`, score: i > nPlan - 5 ? 0 : 10 + i });
    if (!extras) return;
    tarea({ id: 2001, titulo: 'Retro: subir el precio', origen: 'retro', retro_id: 5, score: 60 });
    tarea({ id: 2002, titulo: 'Paso del experimento', experimento_id: 8, score: 55 });
    tarea({ id: 2003, titulo: 'Ya cerrada', estado: 'hecho', progreso: 100, score: 50 });
    tarea({ id: 2004, titulo: 'No cumple el criterio', estado: 'no_cumple', score: 45 });
    tarea({ id: 2005, titulo: 'Fijada a mano', score: 88, score_manual: true, score_razon: 'La fijaste a mano' });
    tarea({ id: 2006, titulo: 'Fijada en la bandeja: anuncio de octubre', score: 77, score_manual: true, categorias: [78] });
    tarea({ id: 2007, titulo: 'Mandar el anuncio nuevo', score: 0, categorias: [78] });
    tarea({ id: 2008, titulo: 'Grabar tres reels', score: 0, categorias: [78] });
    tarea({ id: 2009, titulo: 'Armar el webinar', score: 0, categorias: [78] });
    tarea({ id: 2010, titulo: 'Reunión semanal', recurrente: true, score: 40 });
  };
  const fila = (id: number) => db.plan_repriorizaciones.find((f) => f.id === id) as Fila;
  const et = (id: number) => db.experimento_tareas.find((t) => t.id === id) as Fila;
  const enCli = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_CLI, fn);
  const enDue = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_DUE, fn);
  const lejos = () => Date.now() + 10 * 60_000;

  // ── 1) EL CLIENTE: arrancar, uno a la vez, el sondeo empuja, tandas, lo fijado, la bandeja ──────
  {
    reset(); sembrarCliente();
    // El modelo «contesta» también por las dos fijadas: una vive en la bandeja y está en juego (se
    // rutea), así que lo único que la protege al escribir es la segunda capa.
    colar = ['2005', '2006'];
    const r1 = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'Ana', origen: 'tablero' }));
    trabajoEnCurso = r1.trabajo.id;
    const r2 = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'Beto', origen: 'tablero' }));
    const foto = (fila(r1.trabajo.id).ids as string[]).slice();
    // El SONDEO del tablero: contesta el estado y deja la tanda siguiente en `after()`.
    const antesDespues = despues.length;
    const sondeo = await enCli(() => rp.accionDelTablero('cliente', 'repriorizar-estado', { desde: 0 }, { inicio: Date.now(), relojMs: 10 * 60_000, actor: async () => '' }));
    const agendadas = despues.length - antesDespues;
    const iaAntesDeCorrer = llamadas.puntuar.length;
    // Corre lo que dejó el sondeo (con su pausa de verdad entre tandas).
    for (const fn of despues.splice(0)) await fn();
    const f = fila(r1.trabajo.id);
    const desdeFinal = await enCli(() => rp.verRepriorizacion('cliente', Number(f.cambios && (f.cambios as unknown[]).length)));
    const cambios = (f.cambios as Array<Record<string, unknown>>);
    const hist = (id: number) => ((et(id).historial as Array<{ id: string; actor: string; text: string }>) ?? []);
    out.cliente = {
      r1: { id: r1.trabajo.id, yaCorria: r1.yaCorria, total: r1.trabajo.total, estado: r1.trabajo.estado },
      r2: { id: r2.trabajo.id, yaCorria: r2.yaCorria },
      foto,
      sondeo: { ok: sondeo?.ok, estado: sondeo?.trabajo?.estado, agendadas, iaAntesDeCorrer },
      llamadas: llamadas.puntuar.map((l) => ({ ids: l.ids, vara: l.vara, varaScores: l.varaScores, hechasAlLlamar: l.hechasAlLlamar, motivo: l.motivo })),
      rutear: structuredClone(llamadas.rutear),
      final: { estado: f.estado, hechas: f.hechas, total: f.total, puntuadas: f.puntuadas, ruteadas: f.ruteadas, fijadas: f.fijadas, sinPuntuar: f.sin_puntuar, error: f.error, modelo: f.modelo, intentos: f.intentos, terminado: !!f.terminado_at, actor: f.actor },
      tareas: Object.fromEntries([1001, 1045, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010].map((id) => [id, {
        score: et(id).score, scoreManual: et(id).score_manual, razon: et(id).score_razon ?? null, categorias: et(id).categorias,
        entradas: hist(id).filter((h) => h.id.startsWith('rp')).map((h) => ({ id: h.id, actor: h.actor, text: h.text })),
      }])),
      categorias: db.tarea_categorias.map((c) => c.nombre),
      cambios: { n: cambios.length, ids: cambios.map((c) => String(c.id)), conScore: cambios.filter((c) => c.score != null).length, ejemplo: cambios.find((c) => c.id === '1001') ?? null },
      desdeFinal: { n: desdeFinal?.cambios.length ?? null, nCambios: desdeFinal?.nCambios ?? null },
      ia: [...ia],
    };
  }

  // ── 2) LA CARRERA: dos «Re-priorizar» que llegan juntos ─────────────────────────────────────────
  {
    reset(); sembrarCliente(10, false);
    const a = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'A', origen: 'tablero' }));
    // El segundo LEE «no hay ninguno» (la carrera) y choca al insertar: le tiene que volver el primero.
    base.ocultarCorriendo = 1;
    // Si el choque TIRA en vez de devolver el que corre, se anota (no se cae el hijo entero).
    const b = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'B', origen: 'api' }))
      .catch((e: unknown) => ({ trabajo: { id: -1 }, yaCorria: false, error: e instanceof Error ? e.message : String(e) }));
    out.carrera = {
      ids: [a.trabajo.id, b.trabajo.id], yaCorria: [a.yaCorria, b.yaCorria], choques: base.choques,
      error: 'error' in b ? b.error : null,
      corriendo: db.plan_repriorizaciones.filter((f) => f.estado === 'corriendo').length,
      filas: db.plan_repriorizaciones.length,
    };
  }

  // ── 3) UNA TANDA FALLA: se reintenta ESA tanda, el error queda en la fila ──────────────────────
  {
    reset(); sembrarCliente(45, false);
    const r = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'Ana', origen: 'tablero' }));
    trabajoEnCurso = r.trabajo.id;
    fallaPuntuar = (n) => n === 1; // la segunda llamada (tanda 2) falla UNA vez
    const p1 = await enCli(() => rp.avanzarRepriorizacion(r.trabajo.id, { hasta: lejos(), pausaMs: 0 }));
    const tras1 = { ...fila(r.trabajo.id) };
    const p2 = await enCli(() => rp.avanzarRepriorizacion(r.trabajo.id, { hasta: lejos(), pausaMs: 0 }));
    const llamadasTras2 = llamadas.puntuar.length;
    // Pasó la espera.
    fila(r.trabajo.id).tomada_hasta = new Date(Date.now() - 1000).toISOString();
    const p3 = await enCli(() => rp.avanzarRepriorizacion(r.trabajo.id, { hasta: lejos(), pausaMs: 0 }));
    const fin = fila(r.trabajo.id);
    const segunda = llamadas.puntuar[1]?.ids ?? [];
    const reintento = llamadas.puntuar[2]?.ids ?? [];
    out.fallaUnaVez = {
      p1, p2, p3,
      tras1: { estado: tras1.estado, hechas: tras1.hechas, intentos: tras1.intentos, error: tras1.error, esperaMs: tras1.tomada_hasta ? Date.parse(String(tras1.tomada_hasta)) - Date.now() : null },
      llamadasTras2,
      mismaTandaReintentada: segunda.length > 0 && JSON.stringify(segunda) === JSON.stringify(reintento),
      fin: { estado: fin.estado, hechas: fin.hechas, total: fin.total, intentos: fin.intentos, error: fin.error },
    };

    // Y si NO contesta nunca: al tercer intento se corta, con el error escrito.
    reset(); sembrarCliente(30, false);
    const r2 = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'Ana', origen: 'tablero' }));
    trabajoEnCurso = r2.trabajo.id;
    fallaPuntuar = () => true;
    const estados: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      fila(r2.trabajo.id).tomada_hasta = null;
      await enCli(() => rp.avanzarRepriorizacion(r2.trabajo.id, { hasta: lejos(), pausaMs: 0 }));
      const f = fila(r2.trabajo.id);
      estados.push({ estado: f.estado, intentos: f.intentos, hechas: f.hechas });
    }
    const f2 = fila(r2.trabajo.id);
    out.fallaSiempre = { estados, llamadas: llamadas.puntuar.length, error: f2.error, terminado: !!f2.terminado_at, scoresIntactos: db.experimento_tareas.every((t) => !((t.historial as Array<{ id: string }>) ?? []).some((h) => h.id.startsWith('rp'))) };
  }

  // ── 4) DOS DRENAJES A LA VEZ (el sondeo y el cron): ninguna tanda se procesa dos veces ──────────
  {
    reset(); sembrarCliente(45, false);
    const r = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'Ana', origen: 'tablero' }));
    trabajoEnCurso = r.trabajo.id;
    const [a, b] = await Promise.all([
      enCli(() => rp.avanzarRepriorizacion(r.trabajo.id, { hasta: lejos(), pausaMs: 0 })),
      enCli(() => rp.avanzarRepriorizacion(r.trabajo.id, { hasta: lejos(), pausaMs: 0 })),
    ]);
    const todas = llamadas.puntuar.flatMap((l) => l.ids);
    out.dosDrenajes = { tandas: [a.tandas, b.tandas], llamadas: llamadas.puntuar.length, ids: todas.length, distintas: new Set(todas).size, estado: fila(r.trabajo.id).estado, hechas: fila(r.trabajo.id).hechas, casPerdidos: base.casPerdidos };
  }

  // ── 5) EL CRON: drena aunque nadie mire; sin reloj, no arranca una tanda ───────────────────────
  {
    reset(); sembrarCliente(25, false);
    const r = await enCli(() => rp.iniciarRepriorizacion({ tablero: 'cliente', actor: 'MaKo', origen: 'api' }));
    trabajoEnCurso = r.trabajo.id;
    const sinReloj = await rp.drenarRepriorizaciones({ hasta: Date.now() + 10_000, pausaMs: 0 });
    const llamadasSinReloj = llamadas.puntuar.length;
    const conReloj = await rp.drenarRepriorizaciones({ hasta: lejos(), pausaMs: 0 });
    out.cron = { sinReloj, llamadasSinReloj, conReloj, estado: fila(r.trabajo.id).estado, hechas: fila(r.trabajo.id).hechas };
  }

  // ── 6) EL DUEÑO: lo fijado, la bandeja, el cierre (reparto + proyectos) ─────────────────────────
  {
    reset();
    db.plan_proyectos.push({ workspace_id: WS_DUE, id: 'pcrm', name: 'Feature: CRM', score: 80, historial: [], score_manual: false, recurrente: false, detalle: '' });
    db.plan_proyectos.push({ workspace_id: WS_DUE, id: 'pdash', name: 'Dashboard', score: 60, historial: [], score_manual: false, recurrente: false, detalle: '' });
    db.plan_proyectos.push({ workspace_id: WS_DUE, id: 'pbandeja', name: 'Sin proyecto', score: 1, historial: [], score_manual: false, recurrente: false, detalle: '' });
    const pt = (f: Fila) => db.plan_tareas.push({ workspace_id: WS_DUE, estado: 'por_hacer', progress: 0, score_base: null, score_manual: false, labels: ['pdash'], historial: [], recurrente: false, detalle: 'algo', deadline: '', created_at: ahoraIso(), ...f });
    for (let i = 1; i <= 25; i++) pt({ id: `t${i}`, num: i, title: `Pantalla ${i}`, score: 10 + i * 3 });
    pt({ id: 'tfija', num: 90, title: 'Fijada por el dueño', score: 95, score_manual: true });
    pt({ id: 'tbandeja', num: 91, title: 'Arreglar el filtro del CRM', score: 0, labels: ['pbandeja'] });
    pt({ id: 'tcerrada', num: 92, title: 'Cerrada', score: 50, progress: 100, estado: 'hecho' });
    pt({ id: 'trec', num: 93, title: 'Reunión de los miércoles', score: 70, recurrente: true });
    const r = await enDue(() => rp.iniciarRepriorizacion({ tablero: 'dueno', actor: 'Martín', origen: 'tablero' }));
    trabajoEnCurso = r.trabajo.id;
    const av = await enDue(() => rp.avanzarRepriorizacion(r.trabajo.id, { hasta: lejos(), pausaMs: 0 }));
    const f = fila(r.trabajo.id);
    const t = (id: string) => db.plan_tareas.find((x) => x.id === id) as Fila;
    const cambios = (f.cambios as Array<Record<string, unknown>>);
    out.dueno = {
      total: r.trabajo.total, foto: r.trabajo.total, av,
      final: { estado: f.estado, fase: f.fase, hechas: f.hechas, puntuadas: f.puntuadas, ruteadas: f.ruteadas, fijadas: f.fijadas, error: f.error },
      llamadas: llamadas.puntuar.map((l) => ({ n: l.ids.length, motivo: l.motivo, conCapacidades: l.conCapacidades, tieneFija: l.ids.includes('tfija'), tieneRec: l.ids.includes('trec'), tieneCerrada: l.ids.includes('tcerrada') })),
      proyectosJuzgados: llamadas.proyectos,
      rutear: structuredClone(llamadas.rutear),
      tfija: { score: t('tfija').score, manual: t('tfija').score_manual, entradas: ((t('tfija').historial as Array<{ id: string }>) ?? []).filter((h) => h.id.startsWith('rp')).length },
      tbandeja: { labels: t('tbandeja').labels, score: t('tbandeja').score, base: t('tbandeja').score_base },
      t1: { score: t('t1').score, base: t('t1').score_base, razon: t('t1').score_razon, manual: t('t1').score_manual },
      trec: { score: t('trec').score },
      cambiosP: cambios.filter((c) => c.k === 'p').length,
      cambiosT: cambios.filter((c) => c.k === 't').length,
      cambioT1: cambios.filter((c) => c.id === 't1').map((c) => ({ score: c.score, scoreBase: c.scoreBase ?? null })),
      ia: [...ia],
    };
  }

  // ── 7) LA API DE MAKO: repriorizar_plan y ver_repriorizacion_plan ──────────────────────────────
  {
    reset(); sembrarCliente(12, false);
    const { RUNNERS } = await import('../lib/api-mako/areas/plan.run');
    const ctx = { ws: WS_CLI, canal: 'whatsapp', canalKey: 'g@test', alcance: 'ejecutar', rol: 'admin', actor: 'martin@mako.test' } as never;
    const run = RUNNERS.repriorizar_plan as { preparar: (i: Record<string, unknown>, c: never) => Promise<Record<string, unknown>>; ejecutar: (p: Record<string, unknown>, c: never) => Promise<Record<string, unknown>> };
    const ver = RUNNERS.ver_repriorizacion_plan as { leer: (i: Record<string, unknown>, c: never) => Promise<string | { content: string }> };
    const leer = async () => { const x = await enCli(() => ver.leer({}, ctx)); return JSON.parse(typeof x === 'string' ? x : x.content); };
    const antes = await leer();
    const prep = await enCli(() => run.preparar({}, ctx));
    const ej = await enCli(() => run.ejecutar((prep.payload ?? {}) as Record<string, unknown>, ctx));
    const prep2 = await enCli(() => run.preparar({}, ctx));
    const despuesDe = await leer();
    out.api = { antes, prep, ej, prep2, despues: despuesDe, agendadas: despues.length, filas: db.plan_repriorizaciones.map((f) => ({ origen: f.origen, actor: f.actor, total: f.total })) };
  }

  // ── 8) EL CANDADO DEL CLIENTE, POR LA RUTA DE VERDAD (/api/todo) ─────────────────────────────
  // `score_manual` (mig 0143) existía en `experimento_tareas` y nadie lo escribía: el slider lo manda
  // en `editar`, el guardado de la tarjeta (`editPatch`) NO — y la puerta (`TareaBody`) lo deja pasar.
  {
    reset(); sembrarCliente(3, false);
    const ruta = await import('../app/api/todo/route');
    const post = async (body: Record<string, unknown>) => {
      const res = await enCli(() => ruta.POST(new Request('http://app.test/api/todo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never));
      return { status: res.status, j: await res.json() as Record<string, unknown> };
    };
    const fijar = await post({ action: 'editar', id: 1001, patch: { score: 90, prioridad: 'alta', score_razon: 'La fijaste a mano', score_manual: true } });
    const trasFijar = et(1001).score_manual;
    // Lo que manda el guardado de la tarjeta (editPatch): sin `score_manual`.
    const guardar = await post({ action: 'editar', id: 1001, patch: { titulo: 'Tarea 1 corregida', score: 90, score_razon: 'Prioridad fijada a mano', prioridad: 'alta' } });
    const trasGuardar = et(1001).score_manual;
    const soltar = await post({ action: 'editar', id: 1001, patch: { score_manual: false, score_razon: null } });
    const trasSoltar = et(1001).score_manual;
    // Y «Re-priorizar todo» por la ruta del tablero: contesta el trabajo y deja la tanda en `after()`.
    const antes = despues.length;
    const arrancar = await post({ action: 'repriorizar' });
    const estado = await post({ action: 'repriorizar-estado', desde: 0 });
    out.rutaCliente = {
      fijar: fijar.status, trasFijar, guardar: guardar.status, trasGuardar, soltar: soltar.status, trasSoltar,
      arrancar: { status: arrancar.status, ok: arrancar.j.ok, total: (arrancar.j.trabajo as Record<string, unknown> | undefined)?.total ?? null, actor: db.plan_repriorizaciones[0]?.actor ?? null },
      estado: { status: estado.status, estado: (estado.j.trabajo as Record<string, unknown> | undefined)?.estado ?? null },
      agendadas: despues.length - antes,
    };
  }

  out.sinMock = [...pg.sinMock];
  process.stdout.write('@@RESULTADO@@' + JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { process.stderr.write(String(e?.stack ?? e)); process.exit(1); });
