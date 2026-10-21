// =============================================================================
// Hijo de tests/plan-columnas-propias.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/todo.ts, lib/plan-board.ts y lib/plan-mover.ts llevan `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server` (el precedente es tests/_plan-kanban-hijo.ts, de donde sale el PostgREST de mentira) y le
// contesta al test con un JSON.
//
// Lo que se prueba es la columna PROPIA de una tarea (mig 0317, lib/plan-columnas.ts) en la FILA, en las dos bases:
//   · CON la columna: mover escribe `columna`, y mover a la de siempre la vuelve null;
//   · SIN la columna (la base contesta PGRST204, como antes de aplicar la 0317): mover anda igual, sin `columna`;
//   · el teléfono (`moverEnTablero`): a una propia, el Deshacer vuelve a la de antes, y una que ya no existe se rechaza.
// =============================================================================

type Fila = Record<string, unknown>;

const db: Record<string, Fila[]> = { experimento_tareas: [], plan_tareas: [], app_settings: [] };
let siguienteId = 1000;
/** ¿La base tiene la columna `columna`? false = antes de la mig 0317. */
let conColumna = true;
let escrituras: string[] = [];

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function filtros(u: URL): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'order', 'limit', 'columns', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.')) out.push([k, v.slice(3)]);
    else throw new Error(`filtro sin mock: ${k}=${v}`);
  }
  return out;
}
const cumple = (f: Fila, fs: Array<[string, string]>) => fs.every(([k, v]) => String(f[k]) === v);

async function postgrest(u: URL, init: RequestInit): Promise<Response> {
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (!(tabla in db)) return json(404, { message: `tabla sin mock: ${tabla}` });
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(init.headers);
  const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
  const devolver = (filas: Fila[], status = 200) => {
    if (!uno) return json(status, filas);
    if (filas.length !== 1) return json(406, { code: 'PGRST116', message: `JSON object requested, ${filas.length} rows returned` });
    return json(status, filas[0]);
  };
  const fs = filtros(u);
  if (metodo === 'GET') {
    // Lo que contesta la base cuando un `select` NOMBRA una columna que la tabla no tiene (`*` no la nombra).
    if (!conColumna && /(^|,)\s*columna\s*(,|$)/.test(u.searchParams.get('select') ?? '')) return json(400, { code: '42703', message: `column ${tabla}.columna does not exist` });
    let filas = db[tabla].filter((f) => cumple(f, fs));
    const limit = Number(u.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit > 0) filas = filas.slice(0, limit);
    return devolver(filas.map((f) => ({ ...f })));
  }
  const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila;
  if (metodo === 'PATCH') {
    escrituras.push(`PATCH ${tabla} ${Object.keys(cuerpo).sort().join(',')}`);
    // Lo que contesta PostgREST cuando el patch nombra una columna que la tabla no tiene.
    if (!conColumna && 'columna' in cuerpo) return json(400, { code: 'PGRST204', message: `Could not find the 'columna' column of '${tabla}' in the schema cache` });
    const tocadas = db[tabla].filter((f) => cumple(f, fs));
    for (const f of tocadas) Object.assign(f, cuerpo);
    return (h.get('Prefer') ?? '').includes('return=representation') ? devolver(tocadas.map((f) => ({ ...f }))) : json(204, undefined);
  }
  return json(405, { message: `método sin mock: ${metodo}` });
}

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return postgrest(u, init);
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 9;
const PROPIA = 'c_revision1';

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const todo = await import('../lib/todo');
  const plan = await import('../lib/plan-board');
  const mover = await import('../lib/plan-mover');
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);
  const cli = (id: number, extra: Fila = {}): Fila => ({ id, workspace_id: WS, titulo: `t${id}`, estado: 'en_curso', progreso: 40, orden: 1, score: 0, prioridad: 'media', categorias: [], checklist: [], historial: [], recurrente: false, motivo_atorada: null, hecho_at: null, ...extra });
  const due = (id: string, extra: Fila = {}): Fila => ({ id, workspace_id: WS, num: 1, title: id, estado: 'en_curso', progress: 40, orden: 1, motivo_atorada: null, historial: [], labels: [], ...extra });
  const reset = (columna: boolean) => {
    for (const t of Object.keys(db)) db[t] = [];
    escrituras = []; conColumna = columna;
    db.app_settings.push({ workspace_id: WS, key: 'plan.columnas', value: JSON.stringify({ v: 2, nombres: {}, propias: [{ id: PROPIA, nombre: 'En revisión', estado: 'en_curso' }] }) });
  };
  const out: Record<string, unknown> = {};

  // ── CON la columna ──────────────────────────────────────────────────────────
  reset(true);
  db.experimento_tareas.push(cli(siguienteId++));
  const idCli = Number(db.experimento_tareas[0].id);
  const a = await enWs(() => todo.moverTarea(idCli, 'en_curso', undefined, { columna: PROPIA }));
  const enPropia = db.experimento_tareas[0].columna;
  const b = await enWs(() => todo.moverTarea(idCli, 'en_curso', undefined, { columna: null }));
  db.plan_tareas.push(due('p1'));
  const c = await enWs(() => plan.moverPlanTarea('p1', 'en_curso', undefined, { columna: PROPIA }));
  const enPropiaDueno = db.plan_tareas[0].columna;
  // Mover sin columna (MaKo, el selector de otro estado): a la de siempre, y la columna se BORRA.
  await enWs(() => plan.moverPlanTarea('p1', 'en_curso'));
  out.conColumna = {
    cliente: { ok: a.ok, columna: enPropia, devuelta: a.ok ? a.tarea.columna : null, vuelta: db.experimento_tareas[0].columna, okVuelta: b.ok },
    dueno: { ok: c.ok, columna: enPropiaDueno, devuelta: c.ok ? c.tarea.columna : null, vuelta: db.plan_tareas[0].columna },
    escrituras: [...escrituras],
  };

  // ── SIN la columna (antes de la mig 0317) ───────────────────────────────────
  reset(false);
  db.experimento_tareas.push(cli(siguienteId++));
  const idCli2 = Number(db.experimento_tareas[0].id);
  const d = await enWs(() => todo.moverTarea(idCli2, 'en_seguimiento', undefined, { columna: PROPIA, motivo: 'el cliente' })).catch((e: Error) => ({ ok: false as const, error: e.message }));
  db.plan_tareas.push(due('p2'));
  const e = await enWs(() => plan.moverPlanTarea('p2', 'en_seguimiento', undefined, { columna: PROPIA })).catch((x: Error) => ({ ok: false as const, error: x.message }));
  const cliente = { ok: d.ok, estado: db.experimento_tareas[0].estado, tieneColumna: 'columna' in db.experimento_tareas[0] };
  // El teléfono, sin la columna: lee la fila con `*` y mueve igual.
  const tel = await enWs(() => mover.moverEnTablero('cliente', String(idCli2), 'hecho'));
  out.sinColumna = {
    telefono: { ok: tel.ok, estado: db.experimento_tareas[0].estado },
    cliente,
    dueno: { ok: e.ok, estado: db.plan_tareas[0].estado, tieneColumna: 'columna' in db.plan_tareas[0] },
    escrituras: [...escrituras],
  };

  // ── El teléfono (`moverEnTablero`) ──────────────────────────────────────────
  reset(true);
  db.experimento_tareas.push(cli(siguienteId++));
  const idTel = String(db.experimento_tareas[0].id);
  const f = await enWs(() => mover.moverEnTablero('cliente', idTel, PROPIA));
  const trasMover = { columna: db.experimento_tareas[0].columna, estado: db.experimento_tareas[0].estado, historial: (db.experimento_tareas[0].historial as Array<{ text: string }>)[0]?.text };
  const g = f.ok ? await enWs(() => mover.moverEnTablero('cliente', idTel, f.antes, { entryId: f.entryId })) : null;
  const trasDeshacer = { columna: db.experimento_tareas[0].columna, estado: db.experimento_tareas[0].estado };
  const h = await enWs(() => mover.moverEnTablero('cliente', idTel, 'c_noexiste9'));
  out.telefono = { mover: f, trasMover, deshacer: g?.ok ?? null, trasDeshacer, inexistente: h };

  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
