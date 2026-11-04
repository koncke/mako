#!/usr/bin/env node
// =============================================================================
// humo-produccion.mjs — ¿producción está viva? Páginas públicas y APIs reales, SIN ESCRIBIR NADA
// =============================================================================
// Pedido de Martín del 4/11/2026 («De la investigación de buenas prácticas… aplicalo»). Lo corre
// `.github/workflows/despues-del-deploy.yml` después de cada deploy de producción y cada 8 horas.
//
// ⚠️ QUÉ NO VE, Y ES CASI TODO (docs/hallazgos-infra.md → «Por qué tardaba horas»): de los 16 incidentes de octubre, una
// prueba así no habría visto NINGUNO. Las pantallas de verdad están detrás de la sesión (sin cookie redirigen a /login), y lo
// que se rompe en el navegador (un React #418, una pantalla en blanco por un hook detrás de un return) contesta 200 con el
// HTML del server. Esto es una ALARMA DE CAÍDA TOTAL: el sitio no contesta, las funciones no arrancan, la base no responde,
// el Pixel que cargan las landings de los clientes no sale. Nada más.
//
// ⚠️ SÓLO ALARMA, NUNCA ROLLBACK. Medido: un rollback habría servido en 2 de 16 incidentes, y un rollback automático sobre un
// falso rojo (un bache de la red del runner) saca de producción un arreglo bueno. Si esto da rojo, lo mira una persona.
//
// ⚠️ NO ESCRIBE: cada chequeo es un GET que contesta antes de tocar nada. /m.js con un id que NO existe hace una LECTURA a la
// base (wsPorIdentificadorEstricto) y contesta 404 «este Pixel no existe» — o 503 si la base no contesta: es el único chequeo
// que mira la base, y la mira por el camino que usan las landings de los clientes. El id es nuevo en cada corrida: el 404 se
// cachea 60 s en la CDN (CACHE_DESCONOCIDO) y un id repetido no llegaría a la base. /api/cron/* sin el secreto contesta 401
// en checkCronAuth, antes de su primera línea de trabajo. /api/v1 sin token contesta 401 antes de leer un token.
//
// Uso: node scripts/humo-produccion.mjs [--url https://hola-mako.com]   (o HUMO_URL). Salida: 0 vivo · 1 algo no contestó.
// Corre en el node que trae el runner (sin npm ci): sólo usa fetch y lo de node.
// =============================================================================

import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const URL_POR_DEFECTO = 'https://hola-mako.com';
const UA = 'mako-humo/1 (GitHub Actions; despues-del-deploy.yml)';

/**
 * Los chequeos. Cada uno: la ruta, el status que tiene que dar, y lo que tiene que traer el cuerpo (una marca estable, no un
 * texto de copy que alguien reescribe la semana que viene). `id` es lo que se lee en el resumen.
 * @param {string} pixelInexistente un id con la forma de un token del Pixel (FORMA_TOKEN de lib/pixel-cargador.ts) que no existe
 */
export function chequeos(pixelInexistente) {
  return [
    { id: 'portada', ruta: '/', status: 200, tipo: /text\/html/, cuerpo: /MaKo/i },
    { id: 'login', ruta: '/login', status: 200, tipo: /text\/html/, cuerpo: /<html/i },
    { id: 'privacidad', ruta: '/privacidad', status: 200, tipo: /text\/html/, cuerpo: /privacidad/i },
    { id: 'planes', ruta: '/planes', status: 200, tipo: /text\/html/, cuerpo: /<html/i },
    { id: 'robots', ruta: '/robots.txt', status: 200, tipo: /text\/plain/, cuerpo: /User-Agent/i },
    { id: 'sesion (api)', ruta: '/api/auth/me', status: 200, tipo: /json/, cuerpo: /"autenticado"\s*:\s*false/ },
    { id: 'api de MaKo sin token', ruta: '/api/v1', status: 401, tipo: /json/, cuerpo: /./ },
    { id: 'cron sin secreto', ruta: '/api/cron/tickets', status: 401, tipo: null, cuerpo: null },
    { id: 'Pixel + base', ruta: `/m.js?id=${pixelInexistente}`, status: 404, tipo: /javascript/, cuerpo: /este Pixel no existe/ },
  ];
}

/** Un id con la forma de un token del Pixel (`^[\w-]{8,64}$`) que no existe: «humo-» + 16 hex al azar. */
export const pixelDeHumo = () => `humo-${randomBytes(8).toString('hex')}`;

/** ¿La respuesta es la que el chequeo espera? Devuelve null si sí, o el porqué en una frase. Puro: lo prueba el test. */
export function juzgar(chequeo, { status, tipo, cuerpo }) {
  if (status !== chequeo.status) return `contestó ${status}, esperaba ${chequeo.status}`;
  if (chequeo.tipo && !chequeo.tipo.test(tipo ?? '')) return `contestó «${tipo || 'sin content-type'}», esperaba ${chequeo.tipo}`;
  if (chequeo.cuerpo && !chequeo.cuerpo.test(cuerpo ?? '')) return `el cuerpo no trae ${chequeo.cuerpo} (${String(cuerpo ?? '').slice(0, 80).replace(/\s+/g, ' ')}…)`;
  return null;
}

/**
 * Un chequeo, con UN reintento a los `esperaMs`: justo después de un deploy, el alias puede tardar unos segundos y un bache
 * de la red del runner no es una caída. Dos fallos seguidos, sí.
 */
export async function correrUno(base, chequeo, { esperaMs = 10_000, timeoutMs = 20_000, pedir = fetch } = {}) {
  let ultimo = '';
  for (let intento = 1; intento <= 2; intento++) {
    const t0 = Date.now();
    try {
      const r = await pedir(new URL(chequeo.ruta, base), { redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      const cuerpo = await r.text();
      const falla = juzgar(chequeo, { status: r.status, tipo: r.headers.get('content-type'), cuerpo });
      if (!falla) return { ...chequeo, ok: true, ms: Date.now() - t0, intento };
      ultimo = falla;
    } catch (e) {
      ultimo = `no contestó (${e?.name === 'TimeoutError' ? `más de ${timeoutMs / 1000} s` : String(e?.cause?.code ?? e?.message ?? e)})`;
    }
    if (intento === 1) await new Promise((r) => setTimeout(r, esperaMs));
  }
  return { ...chequeo, ok: false, porque: ultimo };
}

export async function correrHumo(base, opciones = {}) {
  const lista = chequeos(pixelDeHumo());
  return Promise.all(lista.map((c) => correrUno(base, c, opciones)));
}

async function main(argv) {
  const i = argv.indexOf('--url');
  const base = (i >= 0 ? argv[i + 1] : process.env.HUMO_URL) || URL_POR_DEFECTO;
  const resultados = await correrHumo(base);
  const mal = resultados.filter((r) => !r.ok);
  const lineas = [`### Humo de producción: ${mal.length ? `✖ ${mal.length} de ${resultados.length} no contestaron` : `✔ ${resultados.length} de ${resultados.length} vivos`} (${base})`, ''];
  for (const r of resultados) lineas.push(r.ok ? `- ✔ ${r.id} \`${r.ruta.replace(/\?id=.*/, '?id=…')}\` · ${r.ms} ms${r.intento > 1 ? ' (al segundo intento)' : ''}` : `- ✖ **${r.id}** \`${r.ruta.replace(/\?id=.*/, '?id=…')}\`: ${r.porque}`);
  if (mal.length) lineas.push('', 'Sólo es una alarma: nada se revirtió. Abrí la página y el deploy en Vercel antes de tocar nada. Esto no ve lo que está detrás de la sesión.');
  process.stdout.write(lineas.join('\n') + '\n');
  for (const r of mal) process.stdout.write(`::error::Humo de producción: ${r.id} (${r.ruta.replace(/\?id=.*/, '?id=…')}) ${r.porque}\n`);
  return mal.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`humo: error inesperado: ${e?.stack ?? e}\n`); process.exit(1); });
}
