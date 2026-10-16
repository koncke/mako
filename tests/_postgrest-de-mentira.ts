// =============================================================================
// Un PostgREST de mentira, sobre tablas en memoria — NO es un test (no termina en .test.ts)
// =============================================================================
// Para los «hijos» que corren funciones REALES del server (con `server-only`, en un node aparte con
// `--conditions=react-server`) sin base ni red. Nació el 16/10/2026 con «Re-priorizar todo»
// (tests/_plan-repriorizar-hijo.ts); antes había TRES copias de esto adentro de cada hijo
// (_plan-kanban-hijo, _fathom-carga-hijo, _cobros-conexion-hijo). Ésas siguen como están; el próximo
// hijo usa éste.
//
// Entiende lo que usan esas funciones: `eq.`, `neq.`, `in.(…)`, `is.null`, `not.is.null`,
// `gte./lte./gt./lt.` (numérico si los dos lados son números: «1009» > «999»), `order` (varias
// columnas), `limit`, GET / HEAD (`count`) / POST (insert o upsert con `on_conflict` y
// `resolution=ignore-duplicates`) / PATCH / DELETE, y `Accept: application/vnd.pgrst.object+json`
// (`.single()`). `select` devuelve la fila entera.
//
// Y los ÍNDICES ÚNICOS PARCIALES que el código usa para decidir (`unicos`): un insert que choca
// contesta 409 con `code: '23505'`, como Postgres. Sin eso, «uno a la vez» se probaría contra una
// base que no lo garantiza.
// =============================================================================

export type Fila = Record<string, unknown>;

export type UnicoParcial = { tabla: string; columnas: string[]; donde: (f: Fila) => boolean; nombre: string };

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });

const esNum = (v: unknown): boolean => v !== null && v !== '' && Number.isFinite(Number(v));
const comparar = (a: unknown, b: string): number => {
  if (esNum(a) && esNum(b)) return Number(a) - Number(b);
  const x = String(a ?? '');
  return x < b ? -1 : x > b ? 1 : 0;
};

export function crearPostgrest(o: {
  tablas: readonly string[];
  /** Los defaults de la base para una fila nueva (ids, timestamps, columnas con default). */
  defaults?: (tabla: string, f: Fila) => Fila;
  unicos?: UnicoParcial[];
}) {
  const db: Record<string, Fila[]> = Object.fromEntries(o.tablas.map((t) => [t, [] as Fila[]]));
  const sinMock = new Set<string>();
  const defaults = o.defaults ?? ((_t: string, f: Fila) => ({ ...f }));

  type Filtro = (f: Fila) => boolean;
  const filtros = (u: URL): Filtro[] => {
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
          if (val(f) == null) return false;
          const c = comparar(val(f), x);
          return op === 'gte' ? c >= 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c < 0;
        });
      }
      else throw new Error(`filtro sin mock: ${k}=${v}`);
    }
    return out;
  };

  const ordenar = (filas: Fila[], order: string | null): Fila[] => {
    if (!order) return filas;
    const claves = order.split(',').map((x) => { const [col, dir] = x.split('.'); return { col, desc: dir === 'desc' }; });
    return filas.slice().sort((a, b) => {
      for (const { col, desc } of claves) {
        const x = a[col], y = b[col];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        const c = esNum(x) && esNum(y) ? Number(x) - Number(y) : (String(x) < String(y) ? -1 : 1);
        return c * (desc ? -1 : 1);
      }
      return 0;
    });
  };

  async function responder(u: URL, init: RequestInit): Promise<Response> {
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
      return devolver(filas.map((f) => structuredClone(f)));
    }
    const representar = prefer.includes('return=representation');
    if (metodo === 'DELETE') {
      const borradas = db[tabla].filter(cumple);
      db[tabla] = db[tabla].filter((f) => !cumple(f));
      return representar ? devolver(borradas) : json(204, undefined);
    }
    const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
    if (metodo === 'PATCH') {
      const tocadas = db[tabla].filter(cumple);
      for (const f of tocadas) Object.assign(f, structuredClone(cuerpo as Fila));
      return representar ? devolver(tocadas.map((f) => structuredClone(f))) : json(204, undefined);
    }
    if (metodo === 'POST') {
      const conflicto = (u.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean);
      const ignorar = prefer.includes('resolution=ignore-duplicates');
      const out: Fila[] = [];
      for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
        const previa = conflicto.length ? db[tabla].find((f) => conflicto.every((c) => String(f[c]) === String(fila[c]))) : undefined;
        if (previa) { if (!ignorar) { Object.assign(previa, fila); out.push(structuredClone(previa)); } continue; }
        const nueva = defaults(tabla, structuredClone(fila));
        for (const un of (o.unicos ?? []).filter((x) => x.tabla === tabla && x.donde(nueva))) {
          const choca = db[tabla].some((f) => un.donde(f) && un.columnas.every((c) => String(f[c]) === String(nueva[c])));
          if (choca) return json(409, { code: '23505', message: `duplicate key value violates unique constraint "${un.nombre}"`, details: null, hint: null });
        }
        db[tabla].push(nueva);
        out.push(structuredClone(nueva));
      }
      return representar ? devolver(out, 201) : json(201, undefined);
    }
    return json(405, { message: `método sin mock: ${metodo}` });
  }

  return { db, sinMock, responder, vaciar: () => { for (const t of Object.keys(db)) db[t] = []; sinMock.clear(); } };
}
