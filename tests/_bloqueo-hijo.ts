// =============================================================================
// Hijo de tests/bloqueo-identidad.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/evolution-block.ts lleva `server-only`: este archivo corre en un node aparte con `--conditions=react-server` (el
// PostgREST de mentira sale de tests/_chats-envio-hijo.ts, con `like`, `in` y DELETE) y le contesta al test con un JSON.
// Ejecuta la regla de identidad de un bloqueo donde se guarda y se lee: bloquear con una forma del número y preguntar con
// otra, desbloquear con una y que se vayan todas, y marcar la lista de una (lo que muestran /whatsapp y /chats).
// =============================================================================

// Un módulo y no un script global: sin esto TypeScript lo junta con los demás hijos y chocan (TS2300/TS2451).
export {};

type Fila = Record<string, unknown>;

const WS = 9;
const db: Record<string, Fila[]> = { wa_bloqueados: [], wa_ocultos: [] };
let siguienteId = 1;

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function filtros(u: URL): Array<(f: Fila) => boolean> {
  const out: Array<(f: Fila) => boolean> = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'order', 'limit', 'columns', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.')) out.push((f) => String(f[k]) === v.slice(3));
    else if (v.startsWith('like.')) {
      const re = new RegExp(`^${v.slice(5).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);
      out.push((f) => re.test(String(f[k] ?? '')));
    } else if (v.startsWith('in.(') && v.endsWith(')')) {
      const vals = v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, ''));
      out.push((f) => vals.includes(String(f[k])));
    } else throw new Error(`filtro sin mock: ${k}=${v}`);
  }
  return out;
}

async function postgrest(u: URL, init: RequestInit): Promise<Response> {
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (!(tabla in db)) return json(404, { message: `tabla sin mock: ${tabla}` });
  const metodo = (init.method ?? 'GET').toUpperCase();
  const fs = filtros(u);
  const cumple = (f: Fila) => fs.every((ok) => ok(f));
  if (metodo === 'GET') {
    let filas = db[tabla].filter(cumple);
    const limit = Number(u.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit > 0) filas = filas.slice(0, limit);
    return json(200, filas.map((f) => ({ ...f })));
  }
  if (metodo === 'POST') {
    const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
    for (const f of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
      // upsert con ignoreDuplicates por (workspace_id, telefono): una forma repetida no se escribe dos veces.
      if (!db[tabla].some((x) => x.workspace_id === f.workspace_id && x.telefono === f.telefono)) db[tabla].push({ id: siguienteId++, ...f });
    }
    return json(201, undefined);
  }
  if (metodo === 'DELETE') {
    db[tabla] = db[tabla].filter((f) => !cumple(f));
    return json(204, undefined);
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

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const b = await import('../lib/evolution-block');
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);
  const reset = () => { db.wa_bloqueados = []; db.wa_ocultos = []; };
  const tels = (t: string) => db[t].map((f) => String(f.telefono)).sort();
  const out: Record<string, unknown> = {};

  // ── Bloqueado desde /chats con el número del espejo; el CRM y los borradores lo tienen sin país ──────────────────────
  reset();
  await enWs(() => b.bloquearContacto('542233550684'));
  const pregunta = async (lista: string[]) => Object.fromEntries(await Promise.all(lista.map(async (t) => [t, await enWs(() => b.estaBloqueado(t))])));
  out.argentina = await pregunta(['2233550684', '542233550684', '5492233550684', '+54 9 223 355-0684', '2233550685', '']);
  const lista = await enWs(() => b.telefonosBloqueados());
  out.lista = Object.fromEntries(['2233550684', '5492233550684', '2233550685'].map((t) => [t, lista.has(t)]));

  // ── España (9 dígitos): las dos formas, en los dos sentidos; un 10 de otro país que termina igual, no ───────────────
  reset();
  await enWs(() => b.bloquearContacto('34612345678'));
  out.espanaConPais = await pregunta(['612345678', '34612345678', '0034612345678', '4612345678', '612345679']);
  reset();
  await enWs(() => b.bloquearContacto('612345678'));
  out.espanaSinPais = await pregunta(['34612345678', '612345678', '4612345678', '525612345678']);

  // ── Desbloquear con UNA forma libera TODAS (MaKo guarda las dos) ──────────────────────────────────────────────────
  reset();
  await enWs(() => b.bloquearContacto('2233550684'));
  await enWs(() => b.bloquearContacto('542233550684'));
  await enWs(() => b.bloquearContacto('5491100000000'));
  const antes = tels('wa_bloqueados');
  await enWs(() => b.desbloquearContacto('5492233550684'));
  out.desbloquear = { antes, despues: tels('wa_bloqueados'), sigue: await enWs(() => b.estaBloqueado('2233550684')) };

  // ── Ocultos: la misma regla ───────────────────────────────────────────────────────────────────────────────────────
  reset();
  await enWs(() => b.ocultarContacto('2233550684'));
  await enWs(() => b.ocultarContacto('542233550684'));
  const ocultos = await enWs(() => b.telefonosOcultos());
  const ocultoAntes = ocultos.has('5492233550684');
  await enWs(() => b.mostrarContacto('2233550684'));
  out.ocultos = { ocultoAntes, despues: tels('wa_ocultos') };

  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
