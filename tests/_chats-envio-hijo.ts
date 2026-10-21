// =============================================================================
// Hijo de tests/chats-mako-envio.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/borrador-camino.ts y lib/api-mako/areas/chats.run.ts llevan `server-only`: este archivo corre en un node aparte
// con `--conditions=react-server` (el PostgREST de mentira sale de tests/_plan-columnas-hijo.ts, con `like`, `is` y
// `order`) y le contesta al test con un JSON. Lo que se EJECUTA (revisión del 21/10/2026):
//   · el texto nuevo de `enviar_borrador_whatsapp` reusa SÓLO un borrador de texto de la MISMA línea (no la nota de voz
//     de una secuencia, no el de otra línea); si no hay, crea uno;
//   · la puerta única (`enviarBorradorPorSuCanal`) frena a un bloqueado en CUALQUIER forma del número;
//   · la tarjeta muestra el número AL QUE SALE, con el país de la línea.
// Ningún caso llega a Evolution: o frena el bloqueo, o la línea está desconectada.
// =============================================================================

// Un módulo y no un script global: sin esto TypeScript lo junta con los demás hijos y chocan (TS2300/TS2451).
export {};

type Fila = Record<string, unknown>;

const WS = 9;
const db: Record<string, Fila[]> = { wa_borradores: [], wa_bloqueados: [], evolution_instancias: [] };
let siguienteId = 100;
let pedidos: string[] = [];

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function filtros(u: URL): Array<(f: Fila) => boolean> {
  const out: Array<(f: Fila) => boolean> = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'order', 'limit', 'columns', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.')) out.push((f) => String(f[k]) === v.slice(3));
    else if (v === 'is.null') out.push((f) => f[k] == null);
    else if (v.startsWith('like.')) {
      const re = new RegExp(`^${v.slice(5).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);
      out.push((f) => re.test(String(f[k] ?? '')));
    } else throw new Error(`filtro sin mock: ${k}=${v}`);
  }
  return out;
}

function ordenar(filas: Fila[], orden: string | null): Fila[] {
  if (!orden) return filas;
  const claves = orden.split(',').map((x) => { const [c, dir] = x.split('.'); return { c, desc: dir === 'desc' }; });
  return [...filas].sort((a, b) => {
    for (const { c, desc } of claves) {
      const x = a[c] as never, y = b[c] as never;
      if (x === y) continue;
      return (x < y ? -1 : 1) * (desc ? -1 : 1);
    }
    return 0;
  });
}

async function postgrest(u: URL, init: RequestInit): Promise<Response> {
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (!(tabla in db)) return json(404, { message: `tabla sin mock: ${tabla}` });
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(init.headers);
  const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
  const fs = filtros(u);
  pedidos.push(`${metodo} ${tabla} ${[...u.searchParams].filter(([k]) => k !== 'select').map(([k, v]) => `${k}=${v}`).join('&')}`);
  if (metodo === 'GET') {
    let filas = ordenar(db[tabla].filter((f) => fs.every((ok) => ok(f))), u.searchParams.get('order'));
    const limit = Number(u.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit > 0) filas = filas.slice(0, limit);
    if (!uno) return json(200, filas.map((f) => ({ ...f })));
    return filas.length === 1 ? json(200, { ...filas[0] }) : json(406, { code: 'PGRST116', message: `JSON object requested, ${filas.length} rows returned` });
  }
  if (metodo === 'POST') {
    const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
    for (const f of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) db[tabla].push({ id: siguienteId++, created_at: new Date(Date.now() + siguienteId).toISOString(), ...f });
    return json(201, undefined);
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

const LOCAL = '2233550684';
const CON_PAIS = '542233550684';
const CON_9 = '5492233550684';

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { RUNNERS } = await import('../lib/api-mako/areas/chats.run');
  const { enviarBorradorPorSuCanal } = await import('../lib/borrador-camino');
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);
  const ctx = { ws: WS, canal: 'app' as const, canalKey: 'app:prueba', alcance: 'proponer' as const, rol: 'admin' as const };
  const run = RUNNERS.enviar_borrador_whatsapp as { preparar: (i: Fila, c: typeof ctx) => Promise<Fila>; ejecutar: (p: Fila, c: typeof ctx) => Promise<Fila> };
  let t = 0;
  const borrador = (telefono: string, extra: Fila = {}): Fila => ({ id: siguienteId++, workspace_id: WS, telefono, texto: 'Hola', estado: 'pendiente', instance_name: null, audio_id: null, adjunto_id: null, created_at: `2026-10-21T10:00:0${t++}Z`, ...extra });
  const reset = (bloqueado: string | null) => {
    for (const k of Object.keys(db)) db[k] = [];
    pedidos = []; t = 0;
    if (bloqueado) db.wa_bloqueados.push({ id: 1, workspace_id: WS, telefono: bloqueado });
    // Las dos líneas DESCONECTADAS: un borrador que pasa el bloqueo no llega a Evolution.
    db.evolution_instancias.push(
      { id: 1, workspace_id: WS, instance_name: `mako_ws${WS}`, numero: '5492235550000', estado: 'desconectado', es_default: true },
      { id: 2, workspace_id: WS, instance_name: `mako_ws${WS}_2`, numero: '5491100000000', estado: 'desconectado', es_default: false },
    );
  };
  /** El borrador que la puerta fue a leer: el que se eligió mandar. */
  const elegido = () => pedidos.filter((p) => p.startsWith('GET wa_borradores')).map((p) => Number(/(?:^| |&)id=eq\.(\d+)/.exec(p)?.[1])).filter((n) => n > 0).at(-1) ?? null;
  const out: Record<string, unknown> = {};

  // ── El texto nuevo: qué borrador reusa ──────────────────────────────────────
  const reuso = async (linea: string | null, filas: Fila[], numero = CON_PAIS) => {
    reset(null);
    db.wa_borradores.push(...filas);
    const r = await enWs(() => run.ejecutar({ nombre: 'Ana', numero: `+${numero}`, texto: 'Hola', ...(linea ? { linea } : {}) }, ctx));
    const nuevos = db.wa_borradores.filter((f) => !filas.includes(f));
    return { elegido: elegido(), creados: nuevos.map((f) => ({ id: f.id, instance_name: f.instance_name ?? null, audio_id: f.audio_id ?? null, origen: f.origen })), resumen: r.resumen };
  };
  const deVoz = borrador(LOCAL, { audio_id: 7 });
  const deArchivo = borrador(CON_PAIS, { adjunto_id: 3 });
  const deOtraLinea = borrador(CON_PAIS, { instance_name: `mako_ws${WS}_2` });
  const deTexto = borrador(LOCAL);
  out.reuso = {
    // la nota de voz, el archivo y el de otra línea NO; el de texto de la misma línea (sin línea) SÍ
    conTexto: await reuso(null, [deVoz, deArchivo, deOtraLinea, deTexto]).then((x) => ({ ...x, esperado: deTexto.id })),
    // sin uno de texto de su línea: crea uno nuevo, sin audio, sin línea
    sinTexto: await reuso(null, [deVoz, deArchivo, deOtraLinea]),
    // con la línea 2: el de la línea 2
    otraLinea: await reuso(`mako_ws${WS}_2`, [deVoz, deTexto, deOtraLinea]).then((x) => ({ ...x, esperado: deOtraLinea.id })),
    // otro país con los mismos 10 dígitos (+1 551 234 5678 contra +52 1 55 1234 5678): NO es el mismo; el 521 y el 52, sí
    otroPais: await reuso(null, [borrador('15512345678')], '5215512345678'),
    mismoMexico: await reuso(null, [borrador('525512345678')], '5215512345678').then((x) => ({ ...x, esperado: Number(db.wa_borradores[0]?.id) })),
  };

  // ── La puerta única: el bloqueo en las dos formas del número ────────────────
  const puerta = async (bloqueado: string | null, telefonoDelBorrador: string) => {
    reset(bloqueado);
    const b = borrador(telefonoDelBorrador);
    db.wa_borradores.push(b);
    return enWs(() => enviarBorradorPorSuCanal(Number(b.id), 'prueba@hola-mako.com'));
  };
  out.puerta = {
    bloqueoConPais: await puerta(CON_PAIS, LOCAL),
    bloqueoCon9: await puerta(CON_9, LOCAL),
    bloqueoLocal: await puerta(LOCAL, CON_9),
    otroNumero: await puerta('5491199998888', LOCAL),
  };

  // ── La tarjeta del borrador por id: el número al que sale ───────────────────
  const tarjeta = async (bloqueado: string | null, telefono: string) => {
    reset(bloqueado);
    const b = borrador(telefono);
    db.wa_borradores.push(b);
    return enWs(() => run.preparar({ borradorId: Number(b.id) }, ctx));
  };
  out.tarjeta = {
    local: await tarjeta(null, LOCAL),
    conPais: await tarjeta(null, CON_PAIS),
    bloqueado: await tarjeta(CON_9, LOCAL),
  };

  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
