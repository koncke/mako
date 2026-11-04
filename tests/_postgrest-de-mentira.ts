// =============================================================================
// Un PostgREST de mentira, sobre tablas en memoria — NO es un test (no termina en .test.ts)
// =============================================================================
// Para los «hijos» que corren funciones REALES del server (con `server-only`, en un node aparte con
// `--conditions=react-server`) sin base ni red. Nació el 16/10/2026 con «Re-priorizar todo»
// (tests/_plan-repriorizar-hijo.ts); antes había TRES copias de esto adentro de cada hijo
// (_plan-kanban-hijo, _fathom-carga-hijo, _cobros-conexion-hijo). Ésas siguen como están; el próximo
// hijo usa éste.
//
// Entiende lo que usan esas funciones: `eq.`, `neq.`, `in.(…)`, `is.null`, `not.is.null`, `like.`/`not.like.` sueltos,
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
  /** El `or=(hasta.is.null,hasta.lt.…)` del candado del grupo (`reclamar`, lib/mako-doer-buffer.ts). Sin esto, `reclamar` pierde
   *  siempre (la entrada encola y se va): de eso dependen los hijos que no quieren correr el turno. */
  candado?: boolean;
  /** El `or=(…)` entero (29/10/2026, la entrega de los tickets al Cerebro): `ticketsSinEntregar` pide
   *  `aviso_estado.is.null,aviso_estado.in.(…),and(aviso_estado.eq.tomado,aviso_at.lt.…)`. Con esto, cada parte puede ser
   *  `eq`/`neq`/`is.null`/`in.(…)`/`lt`/`lte`/`gt`/`gte`/`like`, o un `and(…)`/`or(…)` anidado. Aparte de `candado` a propósito:
   *  sin él, el `or` del candado sigue tirando, y de eso dependen los hijos que no quieren correr el turno. */
  orCompleto?: boolean;
}) {
  const db: Record<string, Fila[]> = Object.fromEntries(o.tablas.map((t) => [t, [] as Fila[]]));
  const sinMock = new Set<string>();
  const defaults = o.defaults ?? ((_t: string, f: Fila) => ({ ...f }));

  type Filtro = (f: Fila) => boolean;
  /** Parte en las comas de AFUERA de los paréntesis (`a.in.(x,y),and(b.eq.1,c.lt.2)` → dos partes). */
  const trozos = (s: string): string[] => {
    const r: string[] = [];
    let hondo = 0, desde = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') hondo++;
      else if (s[i] === ')') hondo--;
      else if (s[i] === ',' && hondo === 0) { r.push(s.slice(desde, i)); desde = i + 1; }
    }
    r.push(s.slice(desde));
    return r;
  };
  /** Una condición del `or` completo (`orCompleto`). Como Postgres, una comparación con null no es verdad. */
  const condicion = (p: string): Filtro => {
    for (const [pre, todas] of [['and(', true], ['or(', false]] as const) {
      if (p.startsWith(pre) && p.endsWith(')')) {
        const xs = trozos(p.slice(pre.length, -1)).map(condicion);
        return todas ? (f) => xs.every((x) => x(f)) : (f) => xs.some((x) => x(f));
      }
    }
    const [col, op, ...r] = p.split('.');
    // Un valor entre comillas (`updated_at.gte."2026-10-29T…"`, lib/tickets-db.ts → `ticketsDelNegocio`) se compara sin ellas.
    const x = r.join('.').replace(/^"(.*)"$/, '$1');
    // `estado.not.in.(…)` (29/10/2026, los pedidos del negocio en el turno del grupo): como Postgres, un null no entra.
    if (op === 'not' && x.startsWith('in.(') && x.endsWith(')')) {
      const xs = x.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
      return (f) => f[col] != null && !xs.includes(String(f[col]));
    }
    // `suscripcion_estado.not.is.null` (30/10/2026, `FILTRO_SUSCRIPCION_DE_MAKO`, la lectura de quién está en prueba).
    if (op === 'not' && x === 'is.null') return (f) => f[col] != null;
    if (op === 'eq') return (f) => f[col] != null && String(f[col]) === x;
    if (op === 'neq') return (f) => f[col] != null && String(f[col]) !== x;
    if (op === 'is' && x === 'null') return (f) => f[col] == null;
    if (op === 'in' && /^\(.*\)$/.test(x)) {
      const xs = x.slice(1, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
      return (f) => f[col] != null && xs.includes(String(f[col]));
    }
    if (op === 'lt' || op === 'lte' || op === 'gt' || op === 'gte') {
      return (f) => {
        if (f[col] == null) return false;
        const c = comparar(f[col], x);
        return op === 'gte' ? c >= 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c < 0;
      };
    }
    if (op === 'like') {
      const re = new RegExp(`^${x.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.').replace(/[%*]/g, '.*')}$`);
      return (f) => f[col] != null && re.test(String(f[col]));
    }
    throw new Error(`filtro sin mock: or ${p}`);
  };
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
      // `id=not.in.(…)` suelto (4/11/2026, el motor saltea las secuencias cerradas y las filas ya vistas): como Postgres, un null no entra.
      else if (v.startsWith('not.in.(')) {
        const xs = v.slice(8, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
        out.push((f) => val(f) != null && !xs.includes(String(val(f))));
      }
      else if (v === 'is.null') out.push((f) => val(f) == null);
      else if (v === 'not.is.null') out.push((f) => val(f) != null);
      // Como Postgres: `IS TRUE` sólo el true; `NOT (… IS TRUE)` también el null (20/10/2026, el cobro condicional).
      else if (v === 'is.true') out.push((f) => val(f) === true);
      else if (v === 'is.false') out.push((f) => val(f) === false);
      else if (v === 'not.is.true') out.push((f) => val(f) !== true);
      else if (v === 'not.is.false') out.push((f) => val(f) !== false);
      else if (/^(gte|lte|gt|lt)\./.test(v)) {
        const [op, ...resto] = v.split('.');
        const x = resto.join('.');
        out.push((f) => {
          if (val(f) == null) return false;
          const c = comparar(val(f), x);
          return op === 'gte' ? c >= 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c < 0;
        });
      }
      // `.like('ref', 'np:11:%')` suelto (27/10/2026, los tickets automáticos y el tope del tercero): `%` y `*` son el comodín.
      else if (v.startsWith('like.') || v.startsWith('not.like.') || v.startsWith('ilike.')) {
        const no = v.startsWith('not.');
        const ilike = v.startsWith('ilike.');
        const patron = v.slice(ilike ? 6 : no ? 9 : 5);
        const re = new RegExp(`^${patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.').replace(/[%*]/g, '.*')}$`, ilike ? 'i' : '');
        out.push((f) => (val(f) != null && re.test(String(val(f)))) !== no);
      }
      else if (k === 'or' && /^\(.+\)$/.test(v) && o.orCompleto) {
        const xs = trozos(v.slice(1, -1)).map(condicion);
        out.push((f) => xs.some((x) => x(f)));
      }
      // `.or('clave.like.STRIPE_SECRET_KEY*,…')` (22/10/2026, las cuentas de una pasarela): `*` es el `%` de PostgREST.
      else if (k === 'or' && /^\(.+\)$/.test(v)) {
        // `is.null` y `lt` (28/10/2026), sólo con `candado`: el del grupo pelea `hasta.is.null,hasta.lt.<ahora>`.
        const partes = v.slice(1, -1).split(',').map((p) => { const [col, op, ...r] = p.split('.'); return { col, op, x: r.join('.') }; });
        const ops = o.candado ? ['like', 'eq', 'is', 'lt'] : ['like', 'eq'];
        if (partes.some((p) => !ops.includes(p.op) || (p.op === 'is' && p.x !== 'null'))) throw new Error(`filtro sin mock: ${k}=${v}`);
        const re = (x: string) => new RegExp(`^${x.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.').replace(/\*/g, '.*')}$`);
        out.push((f) => partes.some((p) => (p.op === 'eq' ? String(f[p.col]) === p.x
          : p.op === 'is' ? f[p.col] == null
          : p.op === 'lt' ? f[p.col] != null && String(f[p.col]) < p.x
          : re(p.x).test(String(f[p.col] ?? '')))));
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

  /**
   * `cobrar_cuota_con_resto` (supabase/migrations/0318, 0323 y 0347): la toma condicional de la cuota y su diferencia,
   * JUNTAS (una llamada de node no se intercala con otra: es la transacción). Copia del SQL, que fija
   * tests/pagos-cobro-idempotente.test.ts. Si el número choca con el índice único, no escribe NADA y contesta 23505.
   */
  function cobrarCuotaConResto(b: Fila): Response {
    const pagos = db.pagos ?? [];
    const c = pagos.find((p) => Number(p.id) === Number(b.p_pago) && Number(p.lead_id) === Number(b.p_lead) && Number(p.workspace_id) === Number(b.p_ws) && p.pagado !== true
      // Con el monto que se leyó (mig 0323, `p_original`); sin él, como la 0318.
      && (b.p_original == null || Number(p.monto_usd) === Number(b.p_original)));
    if (!c) return json(200, { tomada: false });
    const numero = Math.max(0, ...pagos.filter((p) => Number(p.lead_id) === Number(b.p_lead)).map((p) => Number(p.numero) || 0)) + 1;
    // Cobrada a medias en SU moneda, la diferencia queda en esa moneda: lo pactado menos lo cobrado (mig 0347). Antes de la toma.
    const iso = (m: unknown) => (m == null ? '' : String(m).toUpperCase());
    const pactado = Number(c.monto_original);
    const enSuMoneda = iso(c.moneda) !== '' && iso(c.moneda) !== 'USD' && pactado > 0 && b.p_moneda != null && iso(b.p_moneda) === iso(c.moneda)
      && b.p_monto_original != null && pactado - Number(b.p_monto_original) > 0;
    // La diferencia nace marcada con la cuota de la que sale (mig 0323, `resto_de`): no es una cuota del plan.
    const resto = defaults('pagos', {
      workspace_id: b.p_ws, lead_id: b.p_lead, numero, monto_usd: b.p_resto, fecha_esperada: b.p_vence, pagado: false, resto_de: c.id,
      ...(enSuMoneda ? { moneda: c.moneda, monto_original: pactado - Number(b.p_monto_original) } : {}),
    });
    for (const un of (o.unicos ?? []).filter((x) => x.tabla === 'pagos' && x.donde(resto))) {
      if (pagos.some((f) => un.donde(f) && un.columnas.every((col) => String(f[col]) === String(resto[col])))) {
        return json(409, { code: '23505', message: `duplicate key value violates unique constraint "${un.nombre}"`, details: null, hint: null });
      }
    }
    Object.assign(c, {
      pagado: true, fecha_pago: b.p_fecha, pago_hora: b.p_hora, monto_usd: b.p_monto ?? c.monto_usd,
      moneda: b.p_moneda != null ? b.p_moneda : b.p_limpiar_moneda ? null : c.moneda,
      monto_original: b.p_moneda != null ? b.p_monto_original : b.p_limpiar_moneda ? null : c.monto_original,
    });
    pagos.push(resto);
    return json(200, { tomada: true, resto: resto.id ?? null });
  }

  async function responder(u: URL, init: RequestInit): Promise<Response> {
    const tabla = u.pathname.replace('/rest/v1/', '');
    if (tabla === 'rpc/cobrar_cuota_con_resto' && 'pagos' in db) {
      return cobrarCuotaConResto(typeof init.body === 'string' ? (JSON.parse(init.body) as Fila) : {});
    }
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
