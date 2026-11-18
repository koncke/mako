#!/usr/bin/env node
// =============================================================================
// prueba-de-carga — cuánto aguantan las pantallas con mucha gente a la vez. SOLO PIDE (GET) y NUNCA va a producción sin pedirlo.
//   node scripts/prueba-de-carga.mjs --base http://localhost:3000 --rutas /dashboard,/plan --pedidos 40 --concurrencia 4 \
//     --cookie-archivo <archivo con el header Cookie de una sesión>   [--seco] [--ya] [--tope-ms 30000] [--json <salida.json>]
// El hermano de scripts/medir-rendimiento.mts: aquél mide cada LECTURA del server por separado; éste pide la pantalla ENTERA,
// varias a la vez, como la pide el navegador (hasta el último byte del HTML), y da el p50/p95/p99 y los errores de cada ruta.
//
// POR QUÉ EXISTE (18/11/2026, O27 de docs/pendientes-verificados-17-11.md): a Teo se le prometió una prueba de «velocidad con
// mucha información» y no había ninguna en el repo. Las cifras que hay (docs/hallazgos-infra.md, «La sesión se leía 19 veces»)
// son de un solo pedido a la vez.
//
// LO QUE NO SE NEGOCIA:
//   · A dónde va se decide EN POSITIVO: sin `--contra-produccion` sólo corre contra la máquina propia (localhost, 127.x, ::1,
//     *.localhost). hola-mako.com, una URL de Vercel (las previews leen la MISMA base) o cualquier otro host se rechazan.
//   · Dice cuánto va a pedir ANTES de arrancar, y espera 3 s para cortarlo con Ctrl+C (`--seco` sólo lo dice; `--ya` no espera).
//   · Topes duros aunque se pida producción: 20 a la vez y 2.000 pedidos en total.
//   · La cookie NO se imprime nunca, ni en la pantalla ni en el `--json` (se pasa por archivo para que no quede en el historial).
//   · ⚠️ localhost TAMBIÉN lee la base de producción (.env.local apunta ahí: AGENTS.md, «Local Dev Environment»): una carga alta
//     contra el `next dev` propio cae igual sobre la base de todos los clientes. Por eso los topes valen también ahí.
//   · Un 307 a /login no es una pantalla rápida: es una sesión que falta («sin-sesion»). Se cuenta aparte y no entra al p50.
//
// Salida: 0 todos contestaron bien · 1 hubo errores (se listan por tipo) · 2 no corrió (argumentos, o el destino no se permite).
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TOPE_CONCURRENCIA = 20;
export const TOPE_PEDIDOS = 2000;
export const PEDIDOS_POR_DEFECTO = 20;
export const CONCURRENCIA_POR_DEFECTO = 4;
export const TOPE_MS_POR_DEFECTO = 30_000;
export const BANDERA_PRODUCCION = '--contra-produccion';

/** ¿El host es esta misma máquina? Lo único a lo que se le pide sin `--contra-produccion`. */
export function esLocal(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h === '0.0.0.0' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/** Lee `--clave valor` y `--clave=valor`; las banderas sueltas valen `true`. */
function leerArgs(args) {
  /** @type {Record<string, string | true>} */
  const a = {};
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (!x.startsWith('--')) continue;
    const igual = x.indexOf('=');
    if (igual > 0) { a[x.slice(2, igual)] = x.slice(igual + 1); continue; }
    const sig = args[i + 1];
    if (sig !== undefined && !sig.startsWith('--')) { a[x.slice(2)] = sig; i++; } else a[x.slice(2)] = true;
  }
  return a;
}

const entero = (v, def) => (v === undefined || v === true ? def : Number(v));

/**
 * El plan de la corrida, o por qué no corre. Puro: lo prueba un test (`leer` lee el archivo de la cookie).
 * @param {string[]} args
 * @param {{ env?: Record<string, string | undefined>, leer?: (ruta: string) => string }} [deps]
 * @returns {{ ok: true, plan: Plan } | { ok: false, error: string }}
 *
 * @typedef {{ base: string, rutas: { ruta: string, url: string }[], pedidosPorRuta: number, total: number, concurrencia: number,
 *   topeMs: number, cookie: string | null, produccion: boolean, seco: boolean, ya: boolean, json: string | null }} Plan
 */
export function armarPlan(args, { env = process.env, leer = (r) => readFileSync(r, 'utf8') } = {}) {
  const a = leerArgs(args);
  if (typeof a.base !== 'string') return { ok: false, error: 'falta --base (por ejemplo http://localhost:3000)' };
  let base;
  try { base = new URL(a.base); } catch { return { ok: false, error: `--base no es una URL: «${a.base}»` }; }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return { ok: false, error: '--base tiene que ser http o https' };
  const produccion = !esLocal(base.hostname);
  if (produccion && a[BANDERA_PRODUCCION.slice(2)] !== true) {
    return { ok: false, error: `${base.hostname} no es esta máquina: sin ${BANDERA_PRODUCCION} sólo se pide a localhost. `
      + 'hola-mako.com y las URLs de Vercel (también las previews) leen la base de TODOS los clientes.' };
  }
  if (typeof a.rutas !== 'string' || !a.rutas.trim()) return { ok: false, error: 'falta --rutas (por ejemplo /dashboard,/plan)' };
  /** @type {{ ruta: string, url: string }[]} */
  const rutas = [];
  for (const ruta of a.rutas.split(',').map((s) => s.trim()).filter(Boolean)) {
    // Un guard de ORIGEN se escribe con `origin`, nunca con un prefijo (AGENTS.md): `//otro.com` o `/.//otro.com` salen a otro host.
    if (!ruta.startsWith('/') || ruta.startsWith('//')) return { ok: false, error: `la ruta «${ruta}» tiene que empezar con una sola /` };
    let u;
    try { u = new URL(ruta, base); } catch { return { ok: false, error: `la ruta «${ruta}» no es válida` }; }
    if (u.origin !== base.origin || u.pathname.startsWith('//')) return { ok: false, error: `la ruta «${ruta}» sale de ${base.origin}` };
    rutas.push({ ruta, url: u.href });
  }
  if (!rutas.length) return { ok: false, error: 'falta --rutas (por ejemplo /dashboard,/plan)' };
  const pedidosPorRuta = entero(a.pedidos, PEDIDOS_POR_DEFECTO);
  const concurrenciaPedida = entero(a.concurrencia, CONCURRENCIA_POR_DEFECTO);
  const topeMs = entero(a['tope-ms'], TOPE_MS_POR_DEFECTO);
  if (!Number.isInteger(pedidosPorRuta) || pedidosPorRuta < 1) return { ok: false, error: '--pedidos tiene que ser un entero de 1 o más' };
  if (!Number.isInteger(concurrenciaPedida) || concurrenciaPedida < 1) return { ok: false, error: '--concurrencia tiene que ser un entero de 1 o más' };
  if (!Number.isInteger(topeMs) || topeMs < 100 || topeMs > 120_000) return { ok: false, error: '--tope-ms va de 100 a 120000' };
  if (concurrenciaPedida > TOPE_CONCURRENCIA) return { ok: false, error: `--concurrencia ${concurrenciaPedida} pasa el tope de ${TOPE_CONCURRENCIA}` };
  const total = pedidosPorRuta * rutas.length;
  if (total > TOPE_PEDIDOS) return { ok: false, error: `${total} pedidos pasan el tope de ${TOPE_PEDIDOS}: baja --pedidos o quita rutas` };
  let cookie = null;
  if (typeof a['cookie-archivo'] === 'string') {
    try { cookie = leer(a['cookie-archivo']).trim(); } catch (e) { return { ok: false, error: `no pude leer --cookie-archivo: ${e instanceof Error ? e.message : e}` }; }
  } else if (typeof a.cookie === 'string') cookie = a.cookie.trim();
  else if (env.MAKO_CARGA_COOKIE) cookie = env.MAKO_CARGA_COOKIE.trim();
  // Lo que se pega desde las herramientas del navegador a veces trae el nombre del header adelante.
  if (cookie) cookie = cookie.replace(/^cookie:\s*/i, '');
  return {
    ok: true,
    plan: {
      base: base.origin, rutas, pedidosPorRuta, total, concurrencia: Math.min(concurrenciaPedida, total), topeMs,
      cookie: cookie || null, produccion, seco: a.seco === true, ya: a.ya === true, json: typeof a.json === 'string' ? a.json : null,
    },
  };
}

/** Lo que se le dice a la persona ANTES de pedir nada. Nunca trae la cookie. Puro. */
export function textoDelPlan(plan) {
  const lineas = [
    `Voy a pedir ${plan.total} veces a ${plan.base}: ${plan.pedidosPorRuta} por ruta × ${plan.rutas.length} ruta(s), `
      + `de a ${plan.concurrencia} a la vez, con un tope de ${Math.round(plan.topeMs / 1000)} s por pedido.`,
    `Rutas: ${plan.rutas.map((r) => r.ruta).join(', ')}`,
    plan.cookie
      ? `Con la cookie de una sesión (${plan.cookie.length} caracteres; no se imprime).`
      : 'SIN cookie: las pantallas con sesión van a contestar 307 a /login (se cuentan como «sin-sesion»).',
    plan.produccion
      ? `⚠️ CONTRA ${plan.base} (${BANDERA_PRODUCCION}): la carga cae sobre la base y las funciones de TODOS los clientes.`
      : '⚠️ localhost también lee la base de producción (.env.local): la carga cae igual sobre la base de todos.',
  ];
  return lineas.join('\n');
}

/**
 * El percentil `p` (0-100) por rango más cercano: el valor que deja `p` % de las muestras a su izquierda. null sin muestras.
 * No toca el arreglo que recibe. Puro.
 */
export function percentil(valores, p) {
  const v = valores.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const rango = Math.ceil((p / 100) * v.length);
  return v[Math.min(v.length - 1, Math.max(0, rango - 1))];
}

/**
 * Qué fue un pedido. Puro.
 * @param {{ status?: number | null, location?: string | null, error?: string | null }} r
 * @returns {'ok' | 'sin-sesion' | 'redireccion' | 'http-4xx' | 'http-5xx' | 'tope' | 'red'}
 */
export function clasificar(r) {
  if (r.error === 'tope') return 'tope';
  if (r.error) return 'red';
  const s = Number(r.status);
  if (s >= 200 && s < 300) return 'ok';
  if (s >= 300 && s < 400) return /(^|\/)login(\b|$)/.test(String(r.location || '')) ? 'sin-sesion' : 'redireccion';
  if (s >= 400 && s < 500) return 'http-4xx';
  return 'http-5xx';
}

/** Los pedidos en orden, ALTERNANDO las rutas: cada una recibe carga mezclada con las otras, no todas juntas al final. Puro. */
export function ordenDePedidos(plan) {
  const orden = [];
  for (let i = 0; i < plan.pedidosPorRuta; i++) for (const r of plan.rutas) orden.push({ ruta: r.ruta, url: r.url, i });
  return orden;
}

const redondo = (n) => (n == null ? null : Math.round(n));

/**
 * El resumen por ruta. Los tiempos son SÓLO de los que contestaron 2xx: un 307 a /login es rapidísimo y un timeout no tiene
 * tiempo propio (es el tope), así que mezclarlos mentiría en las dos direcciones. Lo demás se cuenta en `errores`. Puro.
 * @param {{ ruta: string, tipo: ReturnType<typeof clasificar>, ms: number | null, ttfbMs: number | null, bytes: number }[]} resultados
 */
export function resumir(resultados) {
  /** @type {Map<string, typeof resultados>} */
  const por = new Map();
  for (const r of resultados) { if (!por.has(r.ruta)) por.set(r.ruta, []); por.get(r.ruta).push(r); }
  const filas = [...por.entries()].map(([ruta, rs]) => {
    const ok = rs.filter((r) => r.tipo === 'ok');
    const ms = ok.map((r) => r.ms);
    /** @type {Record<string, number>} */
    const errores = {};
    for (const r of rs) if (r.tipo !== 'ok') errores[r.tipo] = (errores[r.tipo] ?? 0) + 1;
    return {
      ruta, pedidos: rs.length, ok: ok.length, errores,
      p50: redondo(percentil(ms, 50)), p95: redondo(percentil(ms, 95)), p99: redondo(percentil(ms, 99)),
      min: redondo(ms.length ? Math.min(...ms) : null), max: redondo(ms.length ? Math.max(...ms) : null),
      ttfbP50: redondo(percentil(ok.map((r) => r.ttfbMs), 50)),
      kbMedio: ok.length ? Math.round(ok.reduce((s, r) => s + r.bytes, 0) / ok.length / 1024) : null,
    };
  });
  return filas;
}

/** La tabla que se imprime al final. Puro. */
export function tablaDeResumen(filas, duracionMs) {
  const c = (v) => (v == null ? '—' : String(v));
  const lineas = ['ruta | pedidos | ok | p50 ms | p95 ms | p99 ms | máx ms | 1er byte p50 | KB | errores', '---|---|---|---|---|---|---|---|---|---'];
  for (const f of filas) {
    const err = Object.entries(f.errores).map(([k, n]) => `${k}: ${n}`).join(', ') || '—';
    lineas.push(`${f.ruta} | ${f.pedidos} | ${f.ok} | ${c(f.p50)} | ${c(f.p95)} | ${c(f.p99)} | ${c(f.max)} | ${c(f.ttfbP50)} | ${c(f.kbMedio)} | ${err}`);
  }
  if (duracionMs != null) lineas.push('', `Duró ${(duracionMs / 1000).toFixed(1)} s.`);
  return lineas.join('\n');
}

/**
 * Corre la carga: `concurrencia` trabajadores que toman de la misma fila. Lee cada respuesta HASTA EL ÚLTIMO BYTE (un HTML en
 * streaming no terminó cuando llegan los headers) y no sigue redirecciones (un 307 a /login se ve como lo que es).
 * @param {Plan} plan
 * @param {{ fetch?: typeof globalThis.fetch, ahora?: () => number }} [deps]
 */
export async function correrCarga(plan, { fetch: pedir = globalThis.fetch, ahora = () => performance.now() } = {}) {
  const orden = ordenDePedidos(plan);
  const resultados = [];
  let sig = 0;
  /** @type {Record<string, string>} */
  const headers = { 'user-agent': 'MaKoPruebaDeCarga/1.0', accept: 'text/html,*/*' };
  if (plan.cookie) headers.cookie = plan.cookie;
  async function trabajador() {
    for (;;) {
      const p = orden[sig++];
      if (!p) return;
      const t0 = ahora();
      let ttfbMs = null;
      let status = null;
      let location = null;
      let bytes = 0;
      let error = null;
      try {
        const res = await pedir(p.url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(plan.topeMs) });
        ttfbMs = ahora() - t0;
        status = res.status;
        location = res.headers.get('location');
        bytes = (await res.arrayBuffer()).byteLength;
      } catch (e) {
        const nombre = e instanceof Error ? e.name : '';
        error = nombre === 'TimeoutError' || nombre === 'AbortError' ? 'tope' : 'red';
      }
      const ms = error ? null : ahora() - t0;
      resultados.push({ ruta: p.ruta, i: p.i, status, tipo: clasificar({ status, location, error }), ms, ttfbMs, bytes });
    }
  }
  await Promise.all(Array.from({ length: plan.concurrencia }, trabajador));
  return resultados;
}

async function main() {
  const r = armarPlan(process.argv.slice(2));
  if (!r.ok) { process.stderr.write(`  ✖ prueba de carga: ${r.error}\n`); return 2; }
  const { plan } = r;
  process.stdout.write(`${textoDelPlan(plan)}\n`);
  if (plan.seco) { process.stdout.write('(--seco: no se pidió nada)\n'); return 0; }
  if (!plan.ya) {
    process.stdout.write('Arranco en 3 s: Ctrl+C para cortar.\n');
    await new Promise((res) => setTimeout(res, 3000));
  }
  const t0 = performance.now();
  const resultados = await correrCarga(plan);
  const filas = resumir(resultados);
  const duracion = performance.now() - t0;
  process.stdout.write(`\n${tablaDeResumen(filas, duracion)}\n`);
  if (plan.json) {
    // Sin la cookie: el plan se copia sin ella.
    const { cookie: _sinCookie, ...planSinCookie } = plan;
    writeFileSync(plan.json, JSON.stringify({ plan: { ...planSinCookie, conCookie: !!plan.cookie }, resumen: filas, duracionMs: Math.round(duracion) }, null, 2));
    process.stdout.write(`Resultados en ${plan.json}\n`);
  }
  const conErrores = filas.some((f) => f.ok < f.pedidos);
  if (filas.some((f) => f.errores['sin-sesion'])) process.stdout.write('⚠️ Hubo 307 a /login: la cookie falta o venció (pásala con --cookie-archivo).\n');
  return conErrores ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { process.stderr.write(`  ✖ prueba de carga: ${e?.message ?? e}\n`); process.exit(2); });
}
