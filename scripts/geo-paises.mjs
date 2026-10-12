#!/usr/bin/env node
// =============================================================================
// geo-paises — la geometría de los mapas del Dashboard, servida desde NUESTRO dominio
// =============================================================================
// Toma Natural Earth (dominio público, sin atribución obligatoria) y deja en `public/geo/v1/`:
//
//   paises.json          el mundo por país (admin-0, escala 1:50m), sin la Antártida
//   admin1/<ISO2>.json   cada país por estado / provincia / departamento (admin-1, escala 1:10m)
//   indice.json          { ISO2: [nombres de sus regiones] }: con él `MapaGeo` adivina de qué país son
//                        unas regiones de Meta cuando el gráfico dice `pais: 'auto'` y nadie se lo dijo
//
// Uso:
//   node scripts/geo-paises.mjs --bajar <carpeta>    baja los dos archivos de Natural Earth v5.1.2 a esa
//                                                    carpeta (si no están) y genera
//   node scripts/geo-paises.mjs --fuente <carpeta>   genera desde una carpeta que ya los tiene
//   … --solo MX,AR,US                               genera sólo esos países (más paises.json e indice.json)
//
// Lo que no se ve en el código:
//   · ANTES se bajaba un GeoJSON de México de raw.githubusercontent EN EL NAVEGADOR de quien miraba (un
//     tercero, con caché de 5 minutos, sin versión ni licencia verificada). Ahora es un archivo nuestro,
//     versionado en la RUTA (`v1`): si la geometría cambia, va a `v2` y lo viejo no se pisa.
//   · SIMPLIFICADO POR PAÍS: el admin-1 crudo son 40 MB. La tolerancia sale del tamaño del país (su lado
//     mayor ÷ 1500), así la frontera entre dos provincias se corre menos de medio píxel en una tarjeta
//     de ~600 px y un país chico no queda hecho un triángulo. Cada anillo se simplifica por separado
//     (Douglas-Peucker); a esa escala la diferencia entre dos vecinos es invisible.
//   · d3-geo dibuja en la ESFERA y pide el anillo exterior en sentido horario (los agujeros al revés).
//     Con el sentido cambiado pinta el planeta entero MENOS el polígono, sin un error: acá se fuerza.
//   · Los códigos ISO 3166-2 de Natural Earth tienen alguno viejo (México DF es `MX-DIF`; hoy es
//     `MX-CMX`): CODIGO_ACTUAL los corrige, y lo que no trae un código válido usa el `adm1_code`.
//   · El tope de tamaño de cada archivo lo fija tests/geo-archivos.test.ts (medido al generarlos).

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'public', 'geo', 'v1');
const VERSION_NE = 'v5.1.2';
const ARCHIVOS = {
  admin0: 'ne_50m_admin_0_countries.geojson',
  admin1: 'ne_10m_admin_1_states_provinces.geojson',
};
const URL_NE = (archivo) => `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION_NE}/geojson/${archivo}`;

/** Códigos de Natural Earth que ya no son los de ISO 3166-2. */
const CODIGO_ACTUAL = { 'MX-DIF': 'MX-CMX' };
/** Regiones a las que Natural Earth les puso el código de OTRA (por su `adm1_code`): Bogotá viene como CO-CUN. */
const CODIGO_POR_ADM1 = { 'COL-1399': 'CO-DC' };
/**
 * El nombre que se DIBUJA cuando el de Natural Earth confunde: su `name_es` de la Ciudad de México es
 * «México» (el mismo que el estado vecino) y el de la Ciudad de Buenos Aires, «Buenos Aires» (el mismo que
 * la provincia). Sin esto, el tooltip diría el nombre de otra región.
 */
const NOMBRE_ACTUAL = { 'MX-CMX': 'Ciudad de México', 'AR-C': 'Ciudad de Buenos Aires', 'AR-B': 'Provincia de Buenos Aires' };
/**
 * Los otros nombres de Natural Earth que son de OTRA región y harían ambiguo el diccionario (una región
 * que se llama como dos no se ubica: lib/geo-regiones.ts). «Buenos Aires» a secas queda para la provincia.
 * ⚠️ NO MEDIDO contra Meta: cómo nombra Meta las regiones de Argentina se mide con la cuenta del ws13.
 */
const ALIAS_QUITAR = { 'MX-CMX': ['México', 'Mexico'], 'AR-C': ['Buenos Aires'] };

// ── Los argumentos ──────────────────────────────────────────────────────────────────────

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const bajar = argumento('--bajar');
const fuente = bajar ?? argumento('--fuente');
const solo = (argumento('--solo') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
if (!fuente) {
  console.error('Uso: node scripts/geo-paises.mjs --bajar <carpeta> | --fuente <carpeta> [--solo MX,AR]');
  process.exit(1);
}

async function bajarSiFalta(carpeta) {
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of Object.values(ARCHIVOS)) {
    const destino = join(carpeta, archivo);
    if (existsSync(destino) && statSync(destino).size > 0) { console.log(`· ya está ${archivo}`); continue; }
    console.log(`· bajando ${archivo} (Natural Earth ${VERSION_NE})…`);
    const r = await fetch(URL_NE(archivo));
    if (!r.ok || !r.body) throw new Error(`${archivo}: HTTP ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(destino));
  }
}

// ── La geometría: simplificar, cuantizar y orientar ─────────────────────────────────────

/** Distancia al cuadrado de p al segmento a-b (en grados: a esta escala alcanza el plano). */
function dist2Segmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Douglas-Peucker sin recursión (un anillo de Canadá tiene decenas de miles de puntos). */
function simplificar(puntos, tol) {
  if (puntos.length <= 4) return puntos;
  const tol2 = tol * tol;
  const quedan = new Uint8Array(puntos.length);
  quedan[0] = 1; quedan[puntos.length - 1] = 1;
  const pila = [[0, puntos.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let max = 0, k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = dist2Segmento(puntos[m], puntos[i], puntos[j]);
      if (d > max) { max = d; k = m; }
    }
    if (k > 0 && max > tol2) { quedan[k] = 1; pila.push([i, k], [k, j]); }
  }
  return puntos.filter((_, i) => quedan[i]);
}

/** El área con signo de un anillo (lon a la derecha, lat arriba, la fórmula del cordón): negativa = horario. */
function areaConSigno(anillo) {
  let s = 0;
  for (let i = 0; i < anillo.length; i++) {
    const [x1, y1] = anillo[i];
    const [x2, y2] = anillo[(i + 1) % anillo.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

function cuantizar(anillo, decimales) {
  const f = 10 ** decimales;
  const out = [];
  for (const [x, y] of anillo) {
    const p = [Math.round(x * f) / f, Math.round(y * f) / f];
    const u = out[out.length - 1];
    if (!u || u[0] !== p[0] || u[1] !== p[1]) out.push(p);
  }
  return out;
}

/**
 * Un anillo listo para d3-geo: simplificado, cuantizado, cerrado y con el sentido que pide la esfera
 * (exterior horario, agujero antihorario). Devuelve null si quedó degenerado.
 */
function anilloListo(anillo, tol, decimales, exterior) {
  let a = cuantizar(simplificar(anillo, tol), decimales);
  if (a.length && (a[0][0] !== a[a.length - 1][0] || a[0][1] !== a[a.length - 1][1])) a.push([...a[0]]);
  if (a.length < 4) return null;
  const area = areaConSigno(a);
  if (area === 0) return null;
  const horario = area < 0;
  if (exterior !== horario) a = a.reverse();
  return a;
}

/** Los polígonos de una geometría (Polygon o MultiPolygon) como lista de listas de anillos. */
function poligonosDe(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

function caja(poligonos) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pol of poligonos) for (const [x, y] of pol[0] ?? []) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/**
 * Simplifica una geometría con la tolerancia del país. Las islas más chicas que unos píxeles se van,
 * salvo el polígono más grande de cada región (una región no puede desaparecer del mapa).
 */
function geometriaLista(geom, tol, decimales) {
  const pols = poligonosDe(geom);
  const conArea = pols.map((pol) => ({ pol, area: Math.abs(areaConSigno(pol[0] ?? [])) }));
  const mayor = Math.max(0, ...conArea.map((x) => x.area));
  const minimo = (tol * 4) ** 2;
  const out = [];
  for (const { pol, area } of conArea) {
    if (area < minimo && area !== mayor) continue;
    // El polígono más grande no puede desaparecer: si con la tolerancia del mapa queda degenerado (un país
    // chico en el mapa del mundo), va con una tolerancia y una cuantización cien veces más finas.
    const ext = anilloListo(pol[0], tol, decimales, true) ?? (area === mayor ? anilloListo(pol[0], tol / 100, decimales + 2, true) : null);
    if (!ext) continue;
    const agujeros = pol.slice(1).filter((h) => Math.abs(areaConSigno(h)) >= minimo).map((h) => anilloListo(h, tol, decimales, false)).filter(Boolean);
    out.push([ext, ...agujeros]);
  }
  if (!out.length) return null;
  return out.length === 1 ? { type: 'Polygon', coordinates: out[0] } : { type: 'MultiPolygon', coordinates: out };
}

/** La tolerancia (en grados) y los decimales de un país, por su lado mayor. */
function escalaDe(poligonos) {
  const b = caja(poligonos);
  // Un país que cruza el antimeridiano (Rusia, Fiyi) mide casi 360 de ancho: el lado mayor real es menor,
  // pero tomarlo grande sólo simplifica de más un país que igual es enorme.
  const lado = Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.05);
  const tol = lado / 1500;
  const decimales = Math.min(5, Math.max(2, Math.ceil(-Math.log10(tol)) + 1));
  return { tol, decimales };
}

// ── Los nombres ─────────────────────────────────────────────────────────────────────────

const texto = (v) => (typeof v === 'string' && v.trim() && v.trim() !== '-99' ? v.trim() : null);
function nombresDe(p, campos) {
  const out = [];
  for (const c of campos) {
    const v = texto(p[c]);
    if (!v) continue;
    for (const parte of c === 'name_alt' ? v.split('|') : [v]) { const t = parte.trim(); if (t && !out.includes(t)) out.push(t); }
  }
  return out;
}
/** Sólo para comparar dos nombres del mismo país al elegir cuál se dibuja (no es el normalizador de la app). */
const plano = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const ISO2 = (v) => { const t = texto(v); return t && /^[A-Z]{2}$/.test(t) ? t : null; };

// ── El mundo ────────────────────────────────────────────────────────────────────────────

function generarPaises(admin0) {
  const features = [];
  for (const f of admin0.features) {
    const p = f.properties ?? {};
    const c = ISO2(p.ISO_A2) ?? ISO2(p.ISO_A2_EH) ?? ISO2(p.WB_A2);
    if (!c || c === 'AQ') continue;
    // El mundo se dibuja en una tarjeta: ~0,4° por píxel. Un décimo de grado alcanza de sobra.
    const geometry = geometriaLista(f.geometry, 0.1, 2);
    if (!geometry) continue;
    const nombres = nombresDe(p, ['NAME_ES', 'NAME', 'NAME_EN', 'NAME_LONG', 'ADMIN', 'FORMAL_EN', 'NAME_SORT']);
    features.push({ type: 'Feature', properties: { c, n: nombres[0] ?? c, a: nombres.slice(1) }, geometry });
  }
  features.sort((a, b) => a.properties.c.localeCompare(b.properties.c));
  return { type: 'FeatureCollection', features };
}

// ── Los países por región ───────────────────────────────────────────────────────────────

function generarAdmin1(admin1) {
  const porPais = new Map();
  for (const f of admin1.features) {
    const p = f.properties ?? {};
    const pais = ISO2(p.iso_a2);
    if (!pais) continue;
    (porPais.get(pais) ?? porPais.set(pais, []).get(pais)).push(f);
  }
  const salida = new Map();
  for (const [pais, lista] of porPais) {
    const { tol, decimales } = escalaDe(lista.flatMap((f) => poligonosDe(f.geometry)));
    const usados = new Set();
    const crudas = [];
    for (const f of lista) {
      const p = f.properties ?? {};
      const nombres = nombresDe(p, ['name_es', 'name', 'name_en', 'name_alt', 'woe_name', 'gn_name', 'name_local']);
      let c = CODIGO_POR_ADM1[texto(p.adm1_code) ?? ''] ?? texto(p.iso_3166_2);
      if (c) c = CODIGO_ACTUAL[c] ?? c;
      const valido = !!c && /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(c) && c.startsWith(`${pais}-`) && !usados.has(c);
      // Sin código ni nombre no es una región que alguien pueda nombrar (Natural Earth trae islotes así).
      if (!valido && !nombres.length) continue;
      if (!valido) c = texto(p.adm1_code) ?? `${pais}-${crudas.length + 1}`;
      if (usados.has(c)) continue;
      const geometry = geometriaLista(f.geometry, tol, decimales);
      if (!geometry) continue;
      usados.add(c);
      crudas.push({ c, nombres, geometry });
    }
    // El nombre que se dibuja: el primero que NO es también nombre de otra región del país (el `name_es` de
    // Natural Earth a veces repite el del vecino), salvo que haya uno corregido a mano.
    const deOtros = (c) => new Set(crudas.filter((x) => x.c !== c).flatMap((x) => x.nombres.map(plano)));
    const features = crudas.map(({ c, nombres: todos, geometry }) => {
      const quitar = new Set((ALIAS_QUITAR[c] ?? []).map(plano));
      const nombres = todos.filter((x) => !quitar.has(plano(x)));
      const otros = deOtros(c);
      const n = NOMBRE_ACTUAL[c] ?? nombres.find((x) => !otros.has(plano(x))) ?? nombres[0] ?? c;
      return { type: 'Feature', properties: { c, n, a: nombres.filter((x) => x !== n) }, geometry };
    });
    features.sort((a, b) => a.properties.c.localeCompare(b.properties.c));
    if (features.length) salida.set(pais, { type: 'FeatureCollection', features });
  }
  return salida;
}

// ── Correr ──────────────────────────────────────────────────────────────────────────────

if (bajar) await bajarSiFalta(bajar);
const leer = (archivo) => {
  const ruta = join(fuente, archivo);
  if (!existsSync(ruta)) throw new Error(`falta ${ruta}: bajalo con --bajar <carpeta>`);
  return JSON.parse(readFileSync(ruta, 'utf8'));
};

mkdirSync(join(SALIDA, 'admin1'), { recursive: true });
const escribir = (ruta, obj) => { writeFileSync(ruta, JSON.stringify(obj)); return statSync(ruta).size; };

const paises = generarPaises(leer(ARCHIVOS.admin0));
const kbMundo = escribir(join(SALIDA, 'paises.json'), paises) / 1024;
console.log(`paises.json: ${paises.features.length} países, ${kbMundo.toFixed(0)} KB`);

const regiones = generarAdmin1(leer(ARCHIVOS.admin1));
const elegidos = solo.length ? [...regiones.keys()].filter((c) => solo.includes(c)) : [...regiones.keys()];
if (!solo.length) {
  // Una corrida completa reemplaza todo: un país que Natural Earth dejó de traer no queda viejo.
  for (const f of readdirSync(join(SALIDA, 'admin1'))) if (f.endsWith('.json') && !regiones.has(f.slice(0, -5))) unlinkSync(join(SALIDA, 'admin1', f));
}
let total = 0, mayor = { c: '', kb: 0 };
for (const c of elegidos.sort()) {
  const kb = escribir(join(SALIDA, 'admin1', `${c}.json`), regiones.get(c)) / 1024;
  total += kb;
  if (kb > mayor.kb) mayor = { c, kb };
}
console.log(`admin1: ${elegidos.length} países, ${total.toFixed(0)} KB en total; el más pesado ${mayor.c} con ${mayor.kb.toFixed(0)} KB`);

// El índice para adivinar el país: los nombres de las regiones de cada uno (los que vienen en su archivo).
// Se sacan los repetidos que sólo cambian en mayúsculas o acentos: la comparación de verdad la hace
// `normalizarRegion` (lib/geo-regiones.ts) en el navegador, ésta sólo achica el archivo.
const indice = {};
for (const [c, fc] of [...regiones.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const vistos = new Map();
  for (const f of fc.features) for (const x of [f.properties.n, ...f.properties.a]) if (!vistos.has(plano(x))) vistos.set(plano(x), x);
  indice[c] = [...vistos.values()];
}
const kbIndice = escribir(join(SALIDA, 'indice.json'), indice) / 1024;
console.log(`indice.json: ${Object.keys(indice).length} países, ${kbIndice.toFixed(0)} KB`);
