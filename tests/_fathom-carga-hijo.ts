// =============================================================================
// Hijo de tests/fathom-sin-friccion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/plan-propuesta.ts, lib/reunion-cruce.ts y compañía llevan `server-only`: este archivo corre
// en un node aparte con `--conditions=react-server` (molde: tests/_plan-kanban-hijo.ts) y le
// contesta al test con un JSON. Corre CINCO escenarios en un solo proceso (cada uno vacía la base):
//   · `carga`: «Cargar» un borrador en los dos tableros — cuántas IA, qué score, qué proyecto.
//   · `cruce`: el cruce del server (lib/reunion-cruce.ts) — sella, no sella si falla, respeta el reloj.
//   · `cron`: `procesarReunionesNuevas` entero, con la lista de Fathom y la extracción de mentira —
//     el borrador sale cruzado y sellado, y las que no leyó quedan anotadas.
//   · `segundoPlano`: la RUTA /api/plan-fathom de verdad — `extraer` contesta antes de leer.
//   · `descartadas`: las reuniones que el cron no leyó quedan escritas y se listan.
//
// Para llamar a la ruta sin Next: `after()` (next/server) y `getUsuarioActual` (@/lib/auth) se
// cambian en `Module._load` ANTES de cargar nada. `after()` GUARDA la función en vez de correrla:
// así se ve qué contestó la ruta ANTES de que la lectura empiece, y después se la corre a mano.
//
// No hay base ni red: `fetch` es de mentira. Lo que va a `supa.test` contesta como PostgREST
// sobre tablas en memoria; TODO lo demás es una llamada a un proveedor de IA (Gemini, Groq,
// OpenAI, Anthropic, la red de la plataforma…) y se CUENTA, con su host, antes de contestar un
// 500. Esa cuenta es la medición del pedido (16/10/2026, Martín: «Quiero que elimines eso y toda
// la fricción»): cuántas llamadas de IA hace «Cargar» de un borrador de reunión. Tiene que ser 0.
//
// Las claves de los proveedores se ponen de mentira en el env para que la cascada de IA INTENTE
// llamar: sin clave, una llamada se cortaría antes del `fetch` y la cuenta daría 0 sobre el código
// viejo también — que es justo el guard que no mide nada.
//
// El PostgREST de mentira entiende lo que estas funciones usan: `eq.`, `neq.`, `in.(…)`, `is.null`,
// `not.is.null`, `gte./lte./gt./lt.`, `order`, `limit`, `select` (devuelve la fila entera),
// GET / POST (insert o upsert con `on_conflict`, `Prefer: resolution=ignore-duplicates`) / PATCH /
// DELETE, `count=exact` con HEAD, y `Accept: application/vnd.pgrst.object+json` (`.single()`).
// =============================================================================

type Fila = Record<string, unknown>;

// ── next/server y @/lib/auth, de mentira (ver la cabecera) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
/** Lo que la ruta dejó para `after()`: se corre a mano, cuando el escenario lo dice. */
const despues: Array<() => unknown> = [];
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === 'next/server') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, after: (fn: () => unknown) => { despues.push(fn); } };
  }
  if (pedido === '@/lib/auth') return { getUsuarioActual: async () => ({ id: 1, nombre: 'Martín', email: 'martin@mako.test', rol: 'admin' }) };
  // EL CRUCE DE MENTIRA. `cruzarCandidatas` (lib/mako-guardian.ts) es UNA llamada de IA; acá se
  // reemplaza por una que CUENTA (va a `ia`, igual que un `fetch` a un proveedor) y contesta lo que
  // el escenario diga, o tira el mismo error que tira la cascada cuando nadie contesta. Así se
  // prueba lo que hace el server con el cruce —sellar, no sellar, el reloj— sin depender de qué
  // proveedor tenga clave. El resto del módulo es el real.
  if (pedido === './mako-guardian' || pedido === '@/lib/mako-guardian') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return {
      ...real,
      cruzarCandidatas: async (candidatas: unknown[], existentes: unknown[], _motivo?: string, hastaMs?: number) => {
        ia.push('cruzarCandidatas');
        crucesPedidos.push({ candidatas: candidatas.length, universo: existentes.length, conReloj: typeof hastaMs === 'number' });
        // MIENTRAS EL MODELO PIENSA (16/10/2026): lo que vería un modal que sondea en este momento.
        if (alCruzar) await alCruzar();
        if (!respuestaCruce) throw new Error('mako-guardian: gemini no contestó y esta feature no se degrada ni se paga (sin respuesta).');
        return { cruces: respuestaCruce };
      },
    };
  }
  // FATHOM DE MENTIRA PARA EL CRON: la lista de reuniones y la extracción (decenas de llamadas
  // de IA por tramos) se reemplazan SÓLO cuando el escenario las carga; si no, son las reales.
  if (pedido === './plan-fathom' || pedido === '@/lib/plan-fathom') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, (...a: unknown[]) => unknown>;
    return {
      ...real,
      listReunionesRecientes: async (...a: unknown[]) => (reunionesFalsas ? { reuniones: reunionesFalsas, nextCursor: null } : real.listReunionesRecientes(...a)),
      // `null` de la mentira = la real (un escenario puede mezclar las dos: R5 lee una de verdad).
      extraerTareasDeReunion: async (...a: unknown[]) => ((extraccionFalsa ? await extraccionFalsa(Number(a[0])) : null) ?? real.extraerTareasDeReunion(...a)),
    };
  }
  return cargarOriginal.call(this, pedido, padre, esMain);
};
/** La lista de Fathom y la extracción de mentira del escenario `cron` (`null` = las reales). */
let reunionesFalsas: Fila[] | null = null;
let extraccionFalsa: ((recordingId: number) => unknown) | null = null;
/** Se corre ADENTRO del cruce de mentira, mientras «el modelo piensa» (`null` = nada). */
let alCruzar: (() => Promise<void>) | null = null;
/** Fathom «tose» en estas rutas: las grabaciones contestan 503 (pasajero) en vez del 404 de siempre. */
let fathomCaido: (ruta: string) => boolean = () => false;
/** Lo que contesta el cruce de mentira (`null` = no contesta, como un 429 sin respaldo). */
let respuestaCruce: Array<{ i: number; accion: 'enriquece'; idExistente: string; razon: string; confianza: 'alta' | 'media' }> | null = null;
const crucesPedidos: Array<{ candidatas: number; universo: number; conReloj: boolean }> = [];

const TABLAS = ['workspaces', 'plan_propuestas', 'experimento_tareas', 'tarea_categorias', 'plan_tareas', 'plan_proyectos',
  'plan_dependencias', 'leads', 'app_settings', 'usuarios', 'credenciales', 'anthropic_usage', 'plan_reuniones_descartadas'] as const;
const db: Record<string, Fila[]> = Object.fromEntries(TABLAS.map((t) => [t, [] as Fila[]]));
let siguienteId = 1000;
/** Las llamadas que NO fueron a la base: cada una es un intento de hablar con una IA. */
let ia: string[] = [];
/** Tablas que el código pidió y el mock no conoce (para no medir en falso: se reportan). */
const sinMock = new Set<string>();

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });

type Filtro = (f: Fila) => boolean;
function filtros(u: URL): Filtro[] {
  const out: Filtro[] = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'order', 'limit', 'columns', 'offset'].includes(k)) continue;
    const val = (f: Fila) => f[k];
    if (v.startsWith('eq.')) { const x = v.slice(3); out.push((f) => String(val(f)) === x); }
    else if (v.startsWith('neq.')) { const x = v.slice(4); out.push((f) => String(val(f)) !== x); }
    else if (v.startsWith('in.(')) {
      const xs = v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
      out.push((f) => xs.includes(String(val(f))));
    }
    else if (v === 'is.null') out.push((f) => val(f) == null);
    else if (v === 'not.is.null') out.push((f) => val(f) != null);
    else if (/^(gte|lte|gt|lt)\./.test(v)) {
      const [op, ...resto] = v.split('.');
      const x = resto.join('.');
      out.push((f) => {
        const a = String(val(f) ?? '');
        return op === 'gte' ? a >= x : op === 'lte' ? a <= x : op === 'gt' ? a > x : a < x;
      });
    }
    else throw new Error(`filtro sin mock: ${k}=${v}`);
  }
  return out;
}

function ordenar(filas: Fila[], order: string | null): Fila[] {
  if (!order) return filas;
  const claves = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' }; });
  return filas.slice().sort((a, b) => {
    for (const { col, desc } of claves) {
      const x = a[col] as number | string, y = b[col] as number | string;
      if (x === y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : 1) * (desc ? -1 : 1);
    }
    return 0;
  });
}

const defaults = (tabla: string, f: Fila): Fila => {
  const ahora = new Date().toISOString();
  if (tabla === 'experimento_tareas') {
    return { id: siguienteId++, estado: 'por_hacer', progreso: 0, orden: 0, score: 0, prioridad: 'media', categorias: [], checklist: [], historial: [], recurrente: false, motivo_atorada: null, hecho_at: null, notas: '', created_at: ahora, updated_at: ahora, ...f };
  }
  if (tabla === 'tarea_categorias') return { id: siguienteId++, created_at: ahora, ...f };
  if (tabla === 'plan_tareas') return { estado: 'por_hacer', orden: 0, motivo_atorada: null, created_at: ahora, ...f };
  if (tabla === 'plan_propuestas') return { estado: 'pendiente', tareas: [], notas: [], eliminar: [], cerrar: [], aplicadas: [], cruzado_at: null, created_at: ahora, ...f };
  if (tabla === 'plan_reuniones_descartadas') return { id: siguienteId++, leida_at: null, created_at: ahora, ...f };
  return { ...f };
};

async function postgrest(u: URL, init: RequestInit): Promise<Response> {
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (!(tabla in db)) { sinMock.add(tabla); return json(200, []); }
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(init.headers);
  const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
  const prefer = h.get('Prefer') ?? '';
  const devolver = (filas: Fila[], status = 200) => {
    if (!uno) return json(status, filas, { 'content-range': `0-${Math.max(0, filas.length - 1)}/${filas.length}` });
    if (filas.length !== 1) return json(406, { code: 'PGRST116', message: `JSON object requested, ${filas.length} rows returned` });
    return json(status, filas[0]);
  };
  const fs = filtros(u);
  const cumple = (f: Fila) => fs.every((fn) => fn(f));
  if (metodo === 'GET' || metodo === 'HEAD') {
    let filas = ordenar(db[tabla].filter(cumple), u.searchParams.get('order'));
    const limit = Number(u.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit > 0) filas = filas.slice(0, limit);
    if (metodo === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `*/${filas.length}` } });
    return devolver(filas.map((f) => ({ ...f })));
  }
  const representar = prefer.includes('return=representation');
  if (metodo === 'DELETE') {
    const quedan = db[tabla].filter((f) => !cumple(f));
    const borradas = db[tabla].filter(cumple);
    db[tabla] = quedan;
    return representar ? devolver(borradas) : json(204, undefined);
  }
  const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
  if (metodo === 'PATCH') {
    const tocadas = db[tabla].filter(cumple);
    for (const f of tocadas) Object.assign(f, cuerpo);
    return representar ? devolver(tocadas.map((f) => ({ ...f }))) : json(204, undefined);
  }
  if (metodo === 'POST') {
    const conflicto = (u.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean);
    const ignorar = prefer.includes('resolution=ignore-duplicates');
    const out: Fila[] = [];
    for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
      const previa = conflicto.length ? db[tabla].find((f) => conflicto.every((c) => String(f[c]) === String(fila[c]))) : undefined;
      // Como PostgREST: con `ignore-duplicates` la fila que ya estaba NO vuelve (ON CONFLICT DO
      // NOTHING). `cambiarSettingSi` —el candado de lectura— cuenta con eso para saber quién ganó.
      if (previa) { if (!ignorar) { Object.assign(previa, fila); out.push({ ...previa }); } }
      else { const nueva = defaults(tabla, fila); db[tabla].push(nueva); out.push({ ...nueva }); }
    }
    return representar ? devolver(out, 201) : json(201, undefined);
  }
  return json(405, { message: `método sin mock: ${metodo}` });
}


/** Las llamadas a la API de Fathom (no son IA: se cuentan aparte). */
let fathom: string[] = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return postgrest(u, init);
  // Fathom: la lista de reuniones viene vacía y una grabación no tiene ni resumen ni transcripción
  // (la lectura termina «sin compromisos» sin llamar a ninguna IA).
  if (u.host === 'api.fathom.ai') {
    fathom.push(u.pathname.replace('/external/v1', ''));
    if (u.pathname.endsWith('/meetings')) return json(200, { items: [], next_cursor: null });
    return fathomCaido(u.pathname) ? json(503, { error: 'Fathom tose' }) : json(404, { error: 'no está' });
  }
  ia.push(u.host + u.pathname);
  return json(500, { error: { message: 'IA de mentira: este test no deja llamar a ningún proveedor' } });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
// La clave de Fathom del dueño (ws 1 cae al env, lib/credenciales.ts): sin ella la lista de reuniones
// ni se pide.
process.env.FATHOM_API_KEY = 'fathom-de-mentira';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
// Claves de mentira: que la cascada INTENTE (ver la cabecera).
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY', 'MISTRAL_API_KEY', 'DEEPSEEK_API_KEY']) {
  process.env[k] = `clave-de-mentira-${k.toLowerCase()}`;
}

// ⚠️ LOS DOS ESCENARIOS CORREN EN EL WORKSPACE 1, y la capa decide el tablero. `credWs` sólo cae a las
// claves del env para `OWNER_WS` (= 1, lib/credenciales.ts): en cualquier otro workspace la cascada no
// encuentra clave, se rinde ANTES del `fetch` y la cuenta da 0 también sobre el código viejo. Medido el
// 16/10/2026: con los workspaces 3 y 9 el código viejo daba `ia: []` con cinco llamadas de IA en el log.
const WS_CLIENTE = 1;
const WS_DUENO = 1;

async function main() {
  const modo = process.argv[2] ?? 'todo';
  const { runWithWorkspace } = await import('../lib/workspace');
  const reset = () => { for (const t of Object.keys(db)) db[t] = []; ia = []; fathom = []; respuestaCruce = null; crucesPedidos.length = 0; despues.length = 0; reunionesFalsas = null; extraccionFalsa = null; alCruzar = null; fathomCaido = () => false; };
  const out: Record<string, unknown> = {};

  const sembrarWorkspace = (capa: 'completo' | 'superadmin') => {
    db.workspaces.push({ id: 1, nombre: capa === 'superadmin' ? 'MaKo' : 'Cliente', slug: 'ws', estado: 'activo', capa });
  };
  const borrador = (ws: number, id: string, tareas: Fila[], extra: Fila = {}) =>
    db.plan_propuestas.push(defaults('plan_propuestas', { id, workspace_id: ws, origen: 'fathom', ref: `fathom:${id}`, resumen: '', tareas, fuente_titulo: 'Junta del lunes', ...extra }));

  if (modo === 'carga' || modo === 'todo') {
    const pp = await import('../lib/plan-propuesta');

    // ── EL CLIENTE (experimento_tareas) ───────────────────────────────────────
    reset(); sembrarWorkspace('completo');
    db.tarea_categorias.push(defaults('tarea_categorias', { workspace_id: WS_CLIENTE, id: 77, nombre: 'Anuncios', emoji: '📣', color: '#111', orden: 1 }));
    db.experimento_tareas.push(defaults('experimento_tareas', { workspace_id: WS_CLIENTE, id: 500, titulo: 'Rehacer el creativo de la campaña de octubre', estado: 'por_hacer', score: 70, orden: 1, origen: 'manual' }));
    borrador(WS_CLIENTE, 'propcli', [
      // va a un proyecto que YA existe (por el nombre que propuso la extracción)
      { titulo: 'Subir los tres videos nuevos', detalle: 'Los de la sesión del martes.', prioridad: 'alta', proyecto: 'Anuncios' },
      // propone un proyecto que NO existe y no es del catálogo → a la bandeja
      { titulo: 'Escribir el guion del webinar', detalle: 'Con la estructura que se habló.', prioridad: 'media', proyecto: 'Webinar Diciembre Especial' },
      // sin proyecto → a la bandeja
      { titulo: 'Llamar al contador por la factura', prioridad: 'baja' },
      // YA está en el tablero → amplía, no se duplica (dedup `mismaTarea`)
      { titulo: 'Rehacer el creativo de la campaña de octubre', detalle: 'Mauricio pidió otro gancho.' },
    ]);
    // El borrador NO está cruzado (`cruzado_at` null): «Agregar» no espera al cruce, carga igual.
    const sinCruzarAntes = db.plan_propuestas.find((p) => p.id === 'propcli')?.cruzado_at == null;
    const t0 = Date.now();
    const rCli = await runWithWorkspace(WS_CLIENTE, () => pp.aplicarPropuestas([{ id: 'propcli' }]));
    const msCli = Date.now() - t0;
    const catDe = (ids: unknown) => ((ids as number[]) ?? []).map((id) => db.tarea_categorias.find((c) => c.id === id)?.nombre ?? `?${id}`);
    out.cliente = {
      r: rCli, ms: msCli, ia: [...ia], sinCruzarAntes,
      creadas: db.experimento_tareas.filter((t) => t.id !== 500).map((t) => ({ titulo: t.titulo, score: t.score, estado: t.estado, proyectos: catDe(t.categorias) })),
      categorias: db.tarea_categorias.map((c) => c.nombre),
      ampliada: String(db.experimento_tareas.find((t) => t.id === 500)?.detalle ?? ''),
      borrador: db.plan_propuestas.find((p) => p.id === 'propcli')?.estado,
    };

    // ── EL DUEÑO (plan_tareas) ────────────────────────────────────────────────
    reset(); sembrarWorkspace('superadmin');
    db.plan_proyectos.push({ workspace_id: WS_DUENO, id: 'pcrm', pid: 'P1', name: 'Feature: CRM', emoji: '🧲', color: '#000', score: 80, detalle: '', historial: [], orden: 1 });
    db.plan_tareas.push(defaults('plan_tareas', { workspace_id: WS_DUENO, id: 'tvieja', num: 1, title: 'Arreglar el filtro de etapas del CRM', progress: 0, score: 60, labels: ['pcrm'], historial: [], checklist: [], recurrente: false, deadline: '' }));
    borrador(WS_DUENO, 'propdue', [
      { titulo: 'Sumar el campo de origen al lead', detalle: 'Para medir de dónde viene.', prioridad: 'alta', proyecto: 'Feature: CRM' },
      { titulo: 'Diseñar el tablero de la ventana', prioridad: 'media', proyecto: 'Ventana Mágica Inventada' },
      { titulo: 'Revisar los permisos del equipo' },
      { titulo: 'Arreglar el filtro de etapas del CRM', detalle: 'Se rompe con etapas vacías.' },
    ]);
    const t1 = Date.now();
    const rDue = await runWithWorkspace(WS_DUENO, () => pp.aplicarPropuestas([{ id: 'propdue' }]));
    const msDue = Date.now() - t1;
    const proyDe = (labels: unknown) => ((labels as string[]) ?? []).map((id) => db.plan_proyectos.find((p) => p.id === id)?.name ?? `?${id}`);
    out.dueno = {
      r: rDue, ms: msDue, ia: [...ia],
      creadas: db.plan_tareas.filter((t) => t.id !== 'tvieja').map((t) => ({ titulo: t.title, score: t.score, estado: t.estado, proyectos: proyDe(t.labels) })),
      proyectos: db.plan_proyectos.map((p) => p.name),
      ampliada: String(db.plan_tareas.find((t) => t.id === 'tvieja')?.detalle ?? ''),
    };
  }

  if (modo === 'cruce' || modo === 'todo') {
    const pp = await import('../lib/plan-propuesta');
    const rc = await import('../lib/reunion-cruce');
    const sembrar = () => {
      reset(); sembrarWorkspace('completo');
      db.experimento_tareas.push(defaults('experimento_tareas', { workspace_id: WS_CLIENTE, id: 500, titulo: 'Rehacer el creativo de la campaña de octubre', estado: 'por_hacer', score: 70, orden: 1, origen: 'manual' }));
      db.experimento_tareas.push(defaults('experimento_tareas', { workspace_id: WS_CLIENTE, id: 501, titulo: 'Ordenar las métricas del mes', estado: 'por_hacer', score: 40, orden: 2, origen: 'manual' }));
    };
    const tareasCruce = () => [
      { titulo: 'Rehacer el creativo de octubre', detalle: 'Otro gancho.' },        // 0 → alta contra 500
      { titulo: 'Revisar las métricas del mes', detalle: 'Las de Meta.' },          // 1 → media contra 501
      { titulo: 'Escribir el guion del webinar' },                                  // 2 → nueva
      { titulo: 'Mandar el contrato', esDeOtro: true, dueno: 'Ana' },               // de otra persona: no entra
    ];
    const fila = (id: string) => db.plan_propuestas.find((p) => p.id === id) as Fila;
    const resumenTareas = (id: string) => ((fila(id).tareas as Fila[]) ?? []).map((t) => ({ titulo: t.titulo, enriquece: t.enriquece ?? null, incluir: t.incluir ?? null }));

    // 1) El cron cruza un borrador recién creado: una llamada, sella, marca lo que ya está.
    sembrar();
    borrador(WS_CLIENTE, 'pc1', tareasCruce());
    respuestaCruce = [
      { i: 0, accion: 'enriquece', idExistente: '500', razon: 'es el mismo creativo', confianza: 'alta' },
      { i: 1, accion: 'enriquece', idExistente: '501', razon: 'se parece', confianza: 'media' },
    ];
    const r1 = await runWithWorkspace(WS_CLIENTE, () => rc.cruzarBorrador('pc1', { hasta: Date.now() + 280_000 }));
    out.cruceOk = { r: r1, ia: ia.length, pedido: crucesPedidos[0] ?? null, cruzadoAt: fila('pc1').cruzado_at ?? null, tareas: resumenTareas('pc1') };

    // 2) La IA falla: NO se sella (lo reintenta el barrido) y las tareas quedan como estaban.
    sembrar();
    borrador(WS_CLIENTE, 'pc2', tareasCruce());
    const r2 = await runWithWorkspace(WS_CLIENTE, () => rc.cruzarBorrador('pc2', { hasta: Date.now() + 280_000 }));
    out.cruceFalla = { r: r2, ia: ia.length, cruzadoAt: fila('pc2').cruzado_at ?? null, tareas: resumenTareas('pc2') };

    // 3) Sin reloj: no se arranca una llamada que no va a terminar.
    sembrar();
    borrador(WS_CLIENTE, 'pc3', tareasCruce());
    respuestaCruce = [];
    const r3 = await runWithWorkspace(WS_CLIENTE, () => rc.cruzarBorrador('pc3', { hasta: Date.now() + 5_000 }));
    out.cruceSinReloj = { r: r3, ia: ia.length, cruzadoAt: fila('pc3').cruzado_at ?? null };

    // 4) Tablero vacío y ningún otro borrador: nada contra qué cruzar → se sella SIN IA.
    reset(); sembrarWorkspace('completo');
    borrador(WS_CLIENTE, 'pc4', tareasCruce());
    const r4 = await runWithWorkspace(WS_CLIENTE, () => rc.cruzarBorrador('pc4', { hasta: Date.now() + 280_000 }));
    out.cruceVacio = { r: r4, ia: ia.length, cruzadoAt: fila('pc4').cruzado_at ?? null };

    // 5) El barrido del cron: cruza los pendientes SIN sello y no vuelve a pagar los sellados.
    sembrar();
    borrador(WS_CLIENTE, 'pb1', [{ titulo: 'Rehacer el creativo de octubre' }]);
    borrador(WS_CLIENTE, 'pb2', [{ titulo: 'Escribir el guion del webinar' }], { cruzado_at: '2026-10-16T10:00:00Z' });
    respuestaCruce = [];
    const r5 = await runWithWorkspace(WS_CLIENTE, () => rc.cruzarPendientes({ hasta: Date.now() + 280_000 }));
    out.barrido = { r: r5, ia: ia.length, pb1: fila('pb1').cruzado_at ?? null, pb2: fila('pb2').cruzado_at ?? null };

    // 6) Y «Agregar» sobre un borrador sin cruzar carga igual (el anti-duplicado del server hace lo suyo).
    sembrar();
    borrador(WS_CLIENTE, 'pc6', [{ titulo: 'Rehacer el creativo de la campaña de octubre', detalle: 'Otro gancho.' }, { titulo: 'Escribir el guion del webinar' }]);
    const r6 = await runWithWorkspace(WS_CLIENTE, () => pp.aplicarPropuestas([{ id: 'pc6' }]));
    out.cargaSinCruce = { r: r6, ia: ia.length, tareas: db.experimento_tareas.length };
  }

  if (modo === 'segundoPlano' || modo === 'todo') {
    const pp = await import('../lib/plan-propuesta');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ruta = require('../app/api/plan-fathom/route') as { POST: (req: Request) => Promise<Response> };
    const post = (body: Record<string, unknown>) => runWithWorkspace(WS_DUENO, async () => {
      const res = await ruta.POST(new Request('http://app.test/api/plan-fathom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      return { status: res.status, j: await res.json() as Record<string, unknown> };
    });
    const candado = (rid: number) => String(db.app_settings.find((s) => s.key === `mako.reunion.leyendo.${rid}`)?.value ?? '');
    const borr = (id: string) => db.plan_propuestas.find((p) => p.id === id) as Fila | undefined;

    reset(); sembrarWorkspace('superadmin');
    // a) `extraer` sin caché: contesta YA, con el borrador en 'procesando' y la lectura guardada
    //    para `after()`. Ni Fathom ni la IA se tocaron antes de contestar.
    const t0 = Date.now();
    const a = await post({ action: 'extraer', recordingId: 4242, titulo: 'Junta del lunes', proyectos: [] });
    const msA = Date.now() - t0;
    const idA = String(a.j.borradorId ?? '');
    out.extraer = {
      status: a.status, j: a.j, ms: msA, despues: despues.length, fathomAntes: fathom.length, iaAntes: ia.length,
      estado: borr(idA)?.estado ?? null, candado: candado(4242) ? (candado(4242) === 'libre' ? 'libre' : 'tomado') : '',
    };
    // b) Otra vez la misma reunión mientras se lee: el mismo borrador, sin una segunda lectura.
    const b = await post({ action: 'extraer', recordingId: 4242, titulo: 'Junta del lunes', proyectos: [] });
    out.extraerOtraVez = { j: b.j, despues: despues.length };
    // c) Corre lo que quedó para `after()`: Fathom no trae nada → «sin compromisos», y el candado se suelta.
    for (const fn of despues.splice(0)) await fn();
    out.trasLeer = { estado: borr(idA)?.estado ?? null, resumen: borr(idA)?.resumen ?? null, candado: candado(4242), ia: ia.length, fathom: fathom.length };
    // d) El sondeo del modal lo ve terminado y SIN compromisos (no es un error).
    const e = await post({ action: 'estado-borrador', id: idA, conReunion: true });
    out.sondeo = { estado: e.j.estado, sinCompromisos: e.j.sinCompromisos ?? null };
    // e) `cruzar` (el cruce del navegador) ya no existe: 400 y ninguna IA.
    const iaAntesCruzar = ia.length;
    const c = await post({ action: 'cruzar', candidatas: [{ titulo: 'x' }], existentes: [{ id: '1', titulo: 'x' }] });
    out.cruzarViejo = { status: c.status, ia: ia.length - iaAntesCruzar };
    // f) La carrera: el modal dejó la fila en 'procesando' y el CRON termina primero la misma
    //    reunión → la llena (antes devolvía el id y el borrador quedaba vacío para siempre).
    reset(); sembrarWorkspace('superadmin');
    const idF = await runWithWorkspace(WS_DUENO, () => pp.crearPropuesta({ ref: 'fathom:777', origen: 'fathom', estado: 'procesando', tareas: [], resumen: 'Leyendo…' }));
    const idF2 = await runWithWorkspace(WS_DUENO, () => pp.crearPropuesta({ ref: 'fathom:777', origen: 'fathom', tareas: [{ titulo: 'Mandar la propuesta' }], resumen: 'MaKo leyó la reunión.' }));
    out.carrera = { mismo: idF === idF2, estado: borr(idF)?.estado ?? null, n: ((borr(idF)?.tareas as unknown[]) ?? []).length };
  }

  if (modo === 'descartadas' || modo === 'todo') {
    const rd = await import('../lib/reunion-descartadas');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ruta = require('../app/api/plan-fathom/route') as { POST: (req: Request) => Promise<Response> };
    const post = (body: Record<string, unknown>) => runWithWorkspace(WS_DUENO, async () => {
      const res = await ruta.POST(new Request('http://app.test/api/plan-fathom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      return { status: res.status, j: await res.json() as Record<string, unknown> };
    });
    reset(); sembrarWorkspace('superadmin');
    const reunion = (id: number, tipo: string, dia: string) => ({ recordingId: id, titulo: `Reunión ${id}`, fecha: `2026-10-${dia}T15:00:00Z`, url: null, tipo: tipo as 'ventas', motivo: `motivo ${id}` });
    const anotadas = await runWithWorkspace(WS_DUENO, () => rd.registrarDescartadas([
      reunion(11, 'ventas', '14'), reunion(12, 'otra', '15'),
      reunion(13, 'equipo', '15'), // las que van al plan NO se anotan como descartadas
    ]));
    const falla = await runWithWorkspace(WS_DUENO, () => rd.registrarNoLeida(reunion(14, 'equipo', '13'), 'No pude leer 2 tramo(s)'));
    // Idempotente: la corrida siguiente vuelve a verlas y no las reescribe (ni les cambia el motivo).
    const otraVez = await runWithWorkspace(WS_DUENO, () => rd.registrarDescartadas([{ ...reunion(11, 'ventas', '14'), motivo: 'otro motivo' }]));
    const lista = await runWithWorkspace(WS_DUENO, () => rd.listarDescartadas());
    // Una de ellas (la 12) ya tiene borrador: la leyó otro camino → la ruta no la ofrece.
    borrador(WS_DUENO, '12', [{ titulo: 'Algo' }]);
    const r = await post({ action: 'reuniones' });
    const enRuta = ((r.j.descartadas as Fila[] | null) ?? []).map((x) => ({ id: x.recordingId, tipo: x.tipo, motivo: x.motivo }));
    // «Leer igual» = `extraer`: sale de la lista (queda `leida_at`, no se borra).
    await post({ action: 'extraer', recordingId: 11, titulo: 'Reunión 11', proyectos: [] });
    const r2 = await post({ action: 'reuniones' });
    out.descartadas = {
      anotadas, falla, otraVez, filas: db.plan_reuniones_descartadas.length,
      motivo11: db.plan_reuniones_descartadas.find((f) => Number(f.recording_id) === 11)?.motivo ?? null,
      lista: (lista ?? []).map((x) => ({ id: x.recordingId, tipo: x.tipo })),
      okRuta: r.j.ok ?? null, errRuta: r.j.error ?? null,
      enRuta, trasLeer: ((r2.j.descartadas as Fila[] | null) ?? []).map((x) => x.recordingId),
      leida11: db.plan_reuniones_descartadas.find((f) => Number(f.recording_id) === 11)?.leida_at != null,
    };
  }

  if (modo === 'cron' || modo === 'todo') {
    const auto = await import('../lib/reunion-auto');
    reset(); sembrarWorkspace('completo');
    db.experimento_tareas.push(defaults('experimento_tareas', { workspace_id: WS_CLIENTE, id: 500, titulo: 'Rehacer el creativo de la campaña de octubre', estado: 'por_hacer', score: 70, orden: 1, origen: 'manual' }));
    const reunion = (id: number, titulo: string, tipo: string, motivo: string) => ({
      recordingId: id, titulo, fecha: '2026-10-15T15:00:00Z', durMin: 30, url: `https://fathom.video/calls/${id}`, involucrados: [],
      tipo, motivo, participantes: [], host: { nombre: 'Martín', email: 'martin@mako.test' },
    });
    reunionesFalsas = [
      reunion(901, 'Junta de equipo', 'equipo', 'ana@mako.test es de tu equipo.'),
      reunion(902, 'Demo con un prospecto', 'ventas', 'juan@x.com está en tu CRM como prospecto: es una llamada de ventas.'),
      reunion(903, 'Junta del martes', 'equipo', 'ana@mako.test es de tu equipo.'),
    ];
    const cand = (titulo: string) => ({ titulo, detalle: '', prioridad: 'media', proyectoId: null, proyectoNombre: '', dueño: '', dueñoEmail: '', esDeOtro: false });
    extraccionFalsa = (rid: number) => (rid === 901
      ? { tareas: [cand('Rehacer el creativo de octubre'), cand('Escribir el guion del webinar')], dudas: [], partesFallidas: 0, transcript: 'texto', participantes: [] }
      // la 903 se lee y FALLA entera (la IA no contestó): antes no dejaba ningún rastro
      : { tareas: [], dudas: [], partesFallidas: 2, transcript: '', participantes: [] });
    respuestaCruce = [{ i: 0, accion: 'enriquece', idExistente: '500', razon: 'el mismo creativo', confianza: 'alta' }];
    // ¿Existía ya el borrador mientras el modelo cruzaba? (16/10/2026: no tiene que existir: se cruza
    // ANTES de que se vea, y nace sellado.)
    let borradorDuranteElCruce: boolean | null = null;
    alCruzar = async () => { borradorDuranteElCruce = db.plan_propuestas.some((p) => p.ref === 'fathom:901'); };
    const r = await runWithWorkspace(WS_CLIENTE, () => auto.procesarReunionesNuevas(WS_CLIENTE, { hasta: Date.now() + 280_000 }));
    alCruzar = null;
    const b901 = db.plan_propuestas.find((p) => p.ref === 'fathom:901');
    out.cron = {
      borradorDuranteElCruce,
      r: { miradas: r.miradas, alPlan: r.alPlan, conTareas: r.conTareas, cruzados: r.cruzados ?? 0, descartadasAnotadas: r.descartadasAnotadas ?? null },
      cruces: crucesPedidos.length,
      b901: b901 ? { estado: b901.estado, cruzado: b901.cruzado_at != null, primera: ((b901.tareas as Fila[]) ?? [])[0]?.enriquece ?? null, incluir0: ((b901.tareas as Fila[]) ?? [])[0]?.incluir ?? null } : null,
      noLeidas: db.plan_reuniones_descartadas.map((f) => ({ id: Number(f.recording_id), tipo: f.tipo, motivo: String(f.motivo ?? '') })),
      candados: db.app_settings.filter((s) => String(s.key).startsWith('mako.reunion.leyendo.')).map((s) => String(s.value)),
    };
  }

  // ── LA REVISIÓN ADVERSARIAL (16/10/2026): las lecturas que se cruzan, se mueren o se pisan ──────
  if (modo === 'revision' || modo === 'todo') {
    const pp = await import('../lib/plan-propuesta');
    const auto = await import('../lib/reunion-auto');
    const rd = await import('../lib/reunion-descartadas');
    const cw = await import('../lib/cron-workspaces');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ruta = require('../app/api/plan-fathom/route') as { POST: (req: Request) => Promise<Response> };
    const post = (body: Record<string, unknown>) => runWithWorkspace(WS_CLIENTE, async () => {
      const res = await ruta.POST(new Request('http://app.test/api/plan-fathom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      return { status: res.status, j: await res.json() as Record<string, unknown> };
    });
    const cron = () => runWithWorkspace(WS_CLIENTE, () => auto.procesarReunionesNuevas(WS_CLIENTE, { hasta: Date.now() + 280_000 }));
    const borr = (ref: string) => db.plan_propuestas.find((p) => p.ref === ref) as Fila | undefined;
    const reunion = (id: number) => ({ recordingId: id, titulo: `Junta ${id}`, fecha: '2026-10-16T15:00:00Z', durMin: 30, url: null, involucrados: [], tipo: 'equipo', motivo: 'equipo', participantes: [], host: { nombre: 'Martín', email: 'martin@mako.test' } });
    const cand = (titulo: string) => ({ titulo, detalle: 'algo', prioridad: 'media', proyectoId: null, proyectoNombre: '', dueño: '', dueñoEmail: '', esDeOtro: false });
    const FLUJO = 'Montar la automatización del flujo post-agenda';
    const AUDIOS = 'Configurar la automatización del envío de audios post-agendamiento';
    const conFlujo = () => db.experimento_tareas.push(defaults('experimento_tareas', { workspace_id: WS_CLIENTE, id: 500, titulo: FLUJO, estado: 'por_hacer', score: 70, orden: 1, origen: 'manual' }));
    const cruceDelFlujo = [{ i: 0, accion: 'enriquece' as const, idExistente: '500', razon: 'es el mismo flujo', confianza: 'alta' as const }];
    const vencerCandado = (rid: number) => { const k = db.app_settings.find((s) => s.key === `mako.reunion.leyendo.${rid}`); if (k) k.value = new Date(Date.now() - 400_000).toISOString(); };
    const enriquece0 = (f?: Fila) => ((((f?.tareas as Fila[]) ?? [])[0]?.enriquece as Fila | undefined)?.id as string | undefined) ?? null;

    // R1) La carrera sin compromisos: el cron (o el webhook) lee la 4242 y, MIENTRAS, el modal pide
    //     leerla: deja su fila «procesando» y no consigue el candado. El cron no encuentra nada.
    reset(); sembrarWorkspace('completo');
    reunionesFalsas = [reunion(4242)];
    let respModal: Record<string, unknown> | null = null;
    extraccionFalsa = async () => {
      respModal = (await post({ action: 'extraer', recordingId: 4242, titulo: 'Junta 4242', proyectos: [] })).j;
      return { tareas: [], dudas: [], partesFallidas: 0, transcript: 'texto', participantes: [] };
    };
    await cron();
    const id1 = String(borr('fathom:4242')?.id ?? '');
    const s1 = await post({ action: 'estado-borrador', id: id1 });
    out.r1 = { modal: respModal, encoladas: despues.length, estado: borr('fathom:4242')?.estado ?? null, sondeo: s1.j.estado, sinCompromisos: s1.j.sinCompromisos ?? null };

    // R2) La lectura del modal se MUERE (Vercel la corta): no corre ni su `catch` ni su `finally`.
    reset(); sembrarWorkspace('completo');
    const m2 = (await post({ action: 'extraer', recordingId: 4343, titulo: 'Junta 4343', proyectos: [] })).j;
    despues.length = 0; // nunca corre
    vencerCandado(4343);
    // a) Tocar la fila «Leyendo…» otra vez (el modal ahora llama a `extraer`): la RELANZA.
    const m2b = (await post({ action: 'extraer', recordingId: 4343, titulo: 'Junta 4343', proyectos: [] })).j;
    const relanzadas = despues.length;
    despues.length = 0; // y se vuelve a morir
    vencerCandado(4343);
    // b) Nadie la toca: la próxima corrida del cron la lee y llena ESA fila.
    reunionesFalsas = [reunion(4343)];
    extraccionFalsa = async () => ({ tareas: [cand('Mandar la propuesta al cliente')], dudas: [], partesFallidas: 0, transcript: 't', participantes: [] });
    const c2 = await cron();
    out.r2 = {
      mismoBorrador: m2b.borradorId === m2.borradorId, relanzadas,
      cron: { nuevas: c2.nuevas, conTareas: c2.conTareas }, mismaFila: borr('fathom:4343')?.id === m2.borradorId,
      estado: borr('fathom:4343')?.estado ?? null, n: ((borr('fathom:4343')?.tareas as unknown[]) ?? []).length, filas: db.plan_propuestas.length,
    };

    // R3) Leer a mano: el modal NUNCA ve el borrador «pendiente» sin cruzar.
    reset(); sembrarWorkspace('completo'); conFlujo();
    extraccionFalsa = async () => ({ tareas: [cand(AUDIOS), cand('Escribir el guion del webinar')], dudas: [], partesFallidas: 0, transcript: 't', participantes: [] });
    respuestaCruce = cruceDelFlujo;
    const m3 = (await post({ action: 'extraer', recordingId: 4444, titulo: 'Junta 4444', proyectos: [] })).j;
    const id3 = String(m3.borradorId);
    let duranteElCruce: Record<string, unknown> | null = null;
    alCruzar = async () => { const e = (await post({ action: 'estado-borrador', id: id3, conReunion: true })).j; duranteElCruce = { estado: e.estado }; };
    for (const fn of despues.splice(0)) await fn();
    alCruzar = null;
    const e3 = (await post({ action: 'estado-borrador', id: id3, conReunion: true })).j;
    const vista = { estado: e3.estado, cruzado: !!e3.cruzadoAt, enriquece0: (((e3.guardadas as Fila[]) ?? [])[0]?.enriquece as Fila | undefined)?.id ?? null };
    out.r3 = { duranteElCruce, vista, cruces: crucesPedidos.length };

    // R4) «Volver a analizar» una reunión cuyo borrador YA estaba sellado: la lectura nueva se cruza.
    reset(); sembrarWorkspace('completo'); conFlujo();
    borrador(WS_CLIENTE, '4545', [{ titulo: 'Otra cosa' }], { estado: 'aplicada', cruzado_at: '2026-10-15T10:00:00Z', aplicadas: [{ titulo: 'Otra cosa', tareaId: '9' }] });
    extraccionFalsa = async () => ({ tareas: [cand(AUDIOS)], dudas: [], partesFallidas: 0, transcript: 't', participantes: [] });
    respuestaCruce = cruceDelFlujo;
    await post({ action: 'extraer', recordingId: 4545, titulo: 'Junta 4545', proyectos: [], reanalizar: true });
    for (const fn of despues.splice(0)) await fn();
    const b4 = borr('fathom:4545');
    const r4 = { estado: b4?.estado ?? null, cruces: crucesPedidos.length, selloViejo: b4?.cruzado_at === '2026-10-15T10:00:00Z', cruzado: b4?.cruzado_at != null, enriquece0: enriquece0(b4) };
    // …y si esta vez el cruce NO sale (el modelo no contesta): el sello viejo tampoco se queda, para
    // que el barrido del cron lo cruce.
    reset(); sembrarWorkspace('completo'); conFlujo();
    borrador(WS_CLIENTE, '4546', [{ titulo: 'Otra cosa' }], { estado: 'aplicada', cruzado_at: '2026-10-15T10:00:00Z' });
    extraccionFalsa = async () => ({ tareas: [cand(AUDIOS)], dudas: [], partesFallidas: 0, transcript: 't', participantes: [] });
    respuestaCruce = null;
    await post({ action: 'extraer', recordingId: 4546, titulo: 'Junta 4546', proyectos: [], reanalizar: true });
    for (const fn of despues.splice(0)) await fn();
    out.r4 = { ...r4, trasFallarElCruce: { estado: borr('fathom:4546')?.estado ?? null, cruzadoAt: borr('fathom:4546')?.cruzado_at ?? null } };

    // R5) Fathom TOSE (503) cuando se lee la 4747: no es «sin compromisos». Y la 4848 —que un
    //     intento anterior dejó en «Sin leer»— se lee bien y vacía: sale de la lista.
    reset(); sembrarWorkspace('completo');
    reunionesFalsas = [reunion(4747), reunion(4848)];
    fathomCaido = (ruta) => ruta.includes('/4747/');
    extraccionFalsa = async (rid) => (rid === 4848 ? { tareas: [], dudas: [], partesFallidas: 0, transcript: 'texto', participantes: [] } : null);
    await runWithWorkspace(WS_CLIENTE, () => rd.registrarNoLeida(reunion(4848), 'No pude leer 2 tramo(s): la IA no contestó. La reintento sola.'));
    const c5 = await cron();
    const vista5 = (rid: number) => db.app_settings.some((s) => s.key === `mako.reunion.auto.${rid}`);
    const fila5 = (rid: number) => db.plan_reuniones_descartadas.find((f) => Number(f.recording_id) === rid);
    out.r5 = {
      errores: c5.errores, cerrada4747: vista5(4747), sinLeer4747: fila5(4747)?.tipo ?? null,
      cerrada4848: vista5(4848), leida4848: fila5(4848)?.leida_at != null,
    };

    // R6) El cruce terminó con el modal ABIERTO: su autosave y su «Agregar» traen SU copia, sin la marca.
    reset(); sembrarWorkspace('completo'); conFlujo();
    borrador(WS_CLIENTE, 'p6', [
      { titulo: AUDIOS, detalle: 'algo', enriquece: { id: '500', razon: 'ya está en tu plan como «Montar…»', confianza: 'alta' }, incluir: false },
      { titulo: 'Escribir el guion del webinar', detalle: 'algo' },
    ], { cruzado_at: '2026-10-16T12:00:00Z' });
    const g6 = await runWithWorkspace(WS_CLIENTE, () => pp.guardarRevision('p6', [{ titulo: AUDIOS, detalle: 'algo' }, { titulo: 'Escribir el guion del webinar', detalle: 'algo', incluir: false }]));
    const trasAutosave = enriquece0(db.plan_propuestas.find((p) => p.id === 'p6'));
    const a6 = await runWithWorkspace(WS_CLIENTE, () => pp.aplicarPropuestas([{ id: 'p6', tareas: [{ titulo: AUDIOS, detalle: 'Con los audios de bienvenida.' }] }]));
    out.r6 = { guardo: g6, trasAutosave, ampliadas: a6.ampliadas, creadas: a6.ids.length, tablero: db.experimento_tareas.map((t) => t.titulo) };

    // R7) El webhook: la MISMA vara que el cron (activo y con Fathom conectado).
    reset();
    db.workspaces.push({ id: 1, nombre: 'Activo', slug: 'a', estado: 'activo', capa: 'completo' });
    db.workspaces.push({ id: 2, nombre: 'Pausado', slug: 'p', estado: 'pausado', capa: 'completo' });
    db.workspaces.push({ id: 3, nombre: 'Sin Fathom', slug: 's', estado: 'activo', capa: 'completo' });
    // Los TRES campos de Fathom (lib/metodo-catalogo.ts) para el ws 1, que cae al env (OWNER_WS).
    const antesEnv = { host: process.env.FATHOM_HOST_EMAIL, secreto: process.env.FATHOM_WEBHOOK_SECRET };
    process.env.FATHOM_HOST_EMAIL = 'martin@mako.test';
    process.env.FATHOM_WEBHOOK_SECRET = 'whsec_de_mentira';
    const activo = await cw.wsEnLaRonda('fathom', 1);
    // El MISMO workspace, con Fathom conectado, pausado: no le toca (sin esto, el 2 da «no» sólo
    // porque no tiene claves, y la vara del estado no se probaba).
    db.workspaces[0].estado = 'pausado';
    const conFathomPausado = await cw.wsEnLaRonda('fathom', 1);
    out.r7 = {
      activo, conFathomPausado, pausado: await cw.wsEnLaRonda('fathom', 2),
      sinFathom: await cw.wsEnLaRonda('fathom', 3), noExiste: await cw.wsEnLaRonda('fathom', 99),
    };
    process.env.FATHOM_HOST_EMAIL = antesEnv.host;
    process.env.FATHOM_WEBHOOK_SECRET = antesEnv.secreto;
    if (antesEnv.host === undefined) delete process.env.FATHOM_HOST_EMAIL;
    if (antesEnv.secreto === undefined) delete process.env.FATHOM_WEBHOOK_SECRET;
  }

  out.sinMock = [...sinMock];
  process.stdout.write('@@RESULTADO@@' + JSON.stringify(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
