// =============================================================================
// Hijo de tests/copywriter-guardar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `crear` y `guardar` (lib/copywriter/server.ts) REALES contra el PostgREST de mentira (tests/_postgrest-de-mentira.ts),
// en un node aparte con `--conditions=react-server` (traen `server-only`), en el workspace de prueba (el 3).
//
// EL LÍMITE DE URL (verificación del Cerebro del 28/10/2026): el fetch de mentira hace lo que hace PostgREST en prod
// (docs/hallazgos-infra.md, 12/10/2026): una URL de más de 8.000 caracteres no llega («fetch failed»). Con el
// compare-and-set por el VALOR, desde ~900 palabras el guion no se guardaba más, y desde ~40 guiones el árbol se congelaba.
// Imprime un JSON con lo que pasó en cada paso; el test lo lee.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TOPE_URL = 8_000;
const pg = crearPostgrest({ tablas: ['app_settings', 'workspaces'] });
let urlMasLarga = 0;
let fallarIndice = 0;
let cortarTrasEscribirIndice = 0;
const red: string[] = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const href = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const u = new URL(href);
  if (u.host !== 'supa.test') { red.push(u.host); return new Response('{}', { status: 500 }); }
  urlMasLarga = Math.max(urlMasLarga, href.length);
  if (href.length > TOPE_URL) throw new TypeError('fetch failed');
  const metodo = (init.method ?? 'GET').toUpperCase();
  // Una escritura del ÍNDICE que falla (para ver que `crear` no deja el documento huérfano).
  if (fallarIndice > 0 && metodo !== 'GET' && u.searchParams.get('key') === 'eq.mako.copywriter.indice') {
    fallarIndice -= 1;
    return new Response(JSON.stringify({ code: 'XX000', message: 'falla de mentira', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  // Una escritura del ÍNDICE que LLEGA y que el cliente no ve (un timeout después del PATCH): la fila queda puesta y
  // `cambiarSettingSi` tira. Es el caso B7: antes, `crear` leía ese fallo como «no se escribió» y borraba el documento.
  if (cortarTrasEscribirIndice > 0 && metodo !== 'GET' && u.searchParams.get('key') === 'eq.mako.copywriter.indice') {
    cortarTrasEscribirIndice -= 1;
    await pg.responder(u, init);
    throw new TypeError('fetch failed');
  }
  return pg.responder(u, init);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
const parrafo = (i: number) => ({ type: 'paragraph', content: [{ type: 'text', text: `Párrafo ${i}: si cada lunes arrancas la semana sin saber de dónde va a salir tu próximo cliente, esto es para ti, porque el sistema trae conversaciones todos los días.` }] });
const doc = (n: number) => ({ type: 'doc', content: Array.from({ length: n }, (_, i) => parrafo(i)) });

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { crear, guardar, abrir, listar } = await import('../lib/copywriter/server');
  pg.db.workspaces.push({ id: WS, nombre: 'Prueba' });
  const out: Record<string, unknown> = {};
  await runWithWorkspace(WS, async () => {
    // 1. Un guion de YouTube que crece: corto, 90 párrafos (más de 20 KB), y uno más. Antes, el tercero fallaba para siempre.
    const c = await crear({ tipo: 'youtube', titulo: 'Cómo armamos un embudo' });
    if (!c.ok) throw new Error(`crear: ${c.error}`);
    const id = c.pagina.id;
    const g1 = await guardar({ id, version: 1, contenido: doc(1) });
    const g2 = await guardar({ id, version: 2, contenido: doc(90) });
    const g3 = await guardar({ id, version: 3, contenido: doc(91) });
    out.bytesGuion = String(pg.db.app_settings.find((f) => f.key === `mako.copywriter.doc.${id}`)?.value ?? '').length;
    const g4 = await guardar({ id, version: 4, contenido: doc(1) });
    out.guardados = [g1, g2, g3, g4].map((g) => (g.ok ? `ok v${g.version}` : `${g.status} ${g.error}`));
    const a = await abrir(id);
    out.quedo = a.ok ? (a.doc.contenido.content?.length ?? 0) : a.error;

    // 2. El compare-and-set sigue: dos guardados a la vez con la MISMA versión → gana uno, el otro 409.
    const [x, y] = await Promise.all([guardar({ id, version: 5, contenido: doc(2) }), guardar({ id, version: 5, contenido: doc(3) })]);
    out.carrera = [x, y].map((g) => (g.ok ? 'ok' : String(g.status))).sort();

    // 3. Muchos guiones con títulos de 80 letras (lo que arma la caja del inicio): el índice pasa de 8 KB.
    let fallos = 0;
    for (let i = 0; i < 70; i++) {
      const r = await crear({ tipo: 'reel', titulo: `Reel ${i}: cómo vender sin descuentos y sin perseguir a nadie por mensaje directo` });
      if (!r.ok) fallos += 1;
    }
    const l = await listar();
    out.indice = { fallos, paginas: l.ok ? l.paginas.length : l.error };
    out.bytesIndice = String(pg.db.app_settings.find((f) => f.key === 'mako.copywriter.indice')?.value ?? '').length;

    // 3b. Tres «crear» a la vez: el índice se reintenta y quedan los TRES (si alguien diera por ganado un CAS perdido,
    //     su página no estaría).
    const tres = await Promise.all([1, 2, 3].map((i) => crear({ tipo: 'story', titulo: `A la vez ${i}` })));
    const l2 = await listar();
    out.aLaVez = tres.map((r) => (r.ok && l2.ok && l2.paginas.some((p) => p.id === r.pagina.id) ? 'en el árbol' : 'falta'));

    // 4. Si la escritura del índice falla, `crear` no deja el documento huérfano.
    const docsAntes = pg.db.app_settings.filter((f) => String(f.key).startsWith('mako.copywriter.doc.')).length;
    fallarIndice = 1;
    const h = await crear({ tipo: 'ad', titulo: 'Huérfano' });
    const docsDespues = pg.db.app_settings.filter((f) => String(f.key).startsWith('mako.copywriter.doc.')).length;
    out.huerfano = { ok: h.ok, docsAntes, docsDespues };

    // 5. B7 (6/11/2026): la escritura del índice LLEGA y el cliente ve un corte. La fila queda en el árbol, así que el
    //    documento NO es un huérfano y no se puede borrar: antes se borraba y la página de la lista abría «No existe»
    //    sobre un texto recién escrito. Hecho = la fila está, el documento está, y se puede abrir.
    cortarTrasEscribirIndice = 1;
    const b7 = await crear({ tipo: 'ad', titulo: 'Llegó igual' });
    const l3 = await listar();
    const fila = l3.ok ? l3.paginas.filter((p) => p.titulo === 'Llegó igual') : [];
    const ab = fila.length === 1 ? await abrir(fila[0].id) : null;
    out.cortado = {
      crear: b7.ok ? 'ok' : String(b7.status),
      filas: fila.length,
      abre: ab == null ? 'sin fila' : ab.ok ? 'abre' : `${ab.status} ${ab.error}`,
    };
  });
  out.urlMasLarga = urlMasLarga;
  out.red = red;
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e) })); process.exitCode = 1; });
