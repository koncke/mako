// =============================================================================
// Crear con IA (el generador de Gamma): tandas de 3, guardar AL FINAL, y el ?url=
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». La pantalla de crear
// (app/landing-generator/crear/CrearConIA.tsx) genera una landing en dos pasos, como
// Gamma: esquema → secciones. Lo que este archivo fija:
//
//   1. El TROCEO: las secciones se piden en tandas de a 3 índices (las mismas
//      `tandasDe` de la ruta, ia-reglas.ts): si la pantalla mandara 4, la ruta las
//      rechazaría (`indicesValidos`), y si mandara todas juntas, el pedido pasaría el
//      minuto que la ruta le da a una tanda.
//   2. GUARDAR AL FINAL Y CON TODO: `guardar` se llama UNA vez, cuando están todas las
//      secciones, en el orden del esquema. Con una tanda fallada no se guarda (abrir el
//      editor con secciones que faltan sin decirlo); reintentar ESA tanda no vuelve a
//      pedir las otras y, cuando entra, se guarda una vez.
//   3. El deep link del Landing Analyst (`?url=`) sólo preselecciona «Sobre cuál» si la
//      URL está entre las analizadas de ESTE negocio (una URL cualquiera en la query no
//      puede meter el diagnóstico de otra página en el prompt).
//
// Lo que no es puro (que la pantalla use estas funciones y no otras) se fija LEYENDO EL
// FUENTE, sin comentarios y con CRLF normalizado.
//
// ── Roturas (11/10/2026, arnés que restaura DE MEMORIA y compara el sha256 antes y
//    después; base en verde: 17 pasan, 0 fallan; al final, 17 / 0 otra vez) ──
//   · B1 todas las secciones en UNA tanda (nuevaGeneracion sin tandasDe)      -> 12 / 5
//   · B2 correrTandas sin `guardarSiCompleta` al final                        -> 13 / 4
//   · B3 guardarSiCompleta sin `todasListas` (guarda con huecos)              -> 15 / 2
//   · B4 colocarTanda pone las tarjetas de la tanda al revés                  -> 14 / 3
//   · B5 baseDelDeepLink devuelve la URL sin mirar la lista                    -> 16 / 1
//   · B6 la pantalla siembra «Sobre cuál» con `props.url` crudo               -> 16 / 1
//   · B7 correrTandas sin el candado de «ya pidiendo / ya lista»              -> 16 / 1
//   · B8 todas las tandas a la vez (sin TANDAS_A_LA_VEZ)                       -> 16 / 1
//   · B9 colocarTanda acepta una respuesta con otra cantidad                   -> 16 / 1
//   · B10 guardarSiCompleta sin el chequeo de «guardando» (doble guardado)     -> 16 / 1
//   · B11 completarConEsquema pisa también lo que ya llegó                     -> 16 / 1
//   · B12 el Panel redirige el ?url= sin `rutaConWs`                           -> 16 / 1
//   · B13 esquemaParaEnviar deja pasar las viñetas vacías                      -> 16 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  baseDelDeepLink, colocarTanda, completarConEsquema, contenidoGenerado, correrTandas, guardarSiCompleta, nuevaGeneracion,
  objetivoValido, rotuloTanda, todasListas, type DepsGeneracion, type EstadoGen, type ResultadoTanda,
} from '../app/landing-generator/crear/CrearConIA';
import { agregarSeccion, esquemaParaEnviar, moverSeccion, quitarSeccion } from '../app/landing-generator/crear/EditorEsquema';
import { temaSugerido } from '../app/landing-generator/crear/SelectorTemaCrear';
import { TEMAS } from '../lib/editor-landing/temas';
import { tarjeta, textoDe, titulo, type JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n'));

/** Una sección reconocible: su id dice de qué índice del esquema salió. */
const seccion = (i: number): JsonNodo => tarjeta([titulo(`Sección ${i}`, 2)], { id: `s${i}` });

/** El arnés: el estado en un «ref», un `pedir` que registra lo que se pidió y un `guardar` que cuenta. */
function arnes(total: number, opts: { falla?: (indices: number[], vez: number) => string | null; demora?: number } = {}) {
  let estado: EstadoGen = nuevaGeneracion(total);
  const pedidos: number[][] = [];
  const guardados: JsonNodo[][] = [];
  let enVuelo = 0;
  let maxEnVuelo = 0;
  const veces = new Map<string, number>();
  const deps: DepsGeneracion = {
    leer: () => estado,
    escribir: (e) => { estado = e; },
    pedir: async (indices): Promise<ResultadoTanda> => {
      pedidos.push([...indices]);
      enVuelo++;
      maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      await new Promise((r) => setTimeout(r, opts.demora ?? 1));
      enVuelo--;
      const clave = indices.join(',');
      const vez = (veces.get(clave) ?? 0) + 1;
      veces.set(clave, vez);
      const error = opts.falla?.(indices, vez) ?? null;
      return error ? { ok: false, error } : { ok: true, tarjetas: indices.map(seccion) };
    },
    guardar: async (tarjetas) => { guardados.push(tarjetas); return { ok: true }; },
  };
  return { deps, pedidos, guardados, get estado() { return estado; }, get maxEnVuelo() { return maxEnVuelo; } };
}

const todas = (e: EstadoGen) => e.tandas.map((_, k) => k);
const ids = (ts: JsonNodo[]) => ts.map((t) => t.attrs?.id);

// ─────────────────────────────────────────────────────────────────────────────
// 1. El troceo
// ─────────────────────────────────────────────────────────────────────────────

test('las secciones se piden en tandas de a 3 índices, en orden y sin repetir', () => {
  assert.deepEqual(nuevaGeneracion(8).tandas.map((t) => t.indices), [[0, 1, 2], [3, 4, 5], [6, 7]]);
  assert.deepEqual(nuevaGeneracion(3).tandas.map((t) => t.indices), [[0, 1, 2]]);
  assert.deepEqual(nuevaGeneracion(1).tandas.map((t) => t.indices), [[0]]);
  const veinte = nuevaGeneracion(20);
  assert.equal(veinte.tandas.length, 7);
  assert.ok(veinte.tandas.every((t) => t.indices.length >= 1 && t.indices.length <= 3));
  assert.deepEqual(veinte.tandas.flatMap((t) => t.indices), Array.from({ length: 20 }, (_, i) => i));
  assert.equal(veinte.tarjetas.length, 20);
  assert.ok(veinte.tarjetas.every((t) => t === null));
});

test('la generación pide exactamente las tandas, de a dos a la vez como mucho', async () => {
  const a = arnes(8, { demora: 5 });
  await correrTandas(todas(a.estado), a.deps);
  assert.deepEqual([...a.pedidos].sort((x, y) => x[0] - y[0]), [[0, 1, 2], [3, 4, 5], [6, 7]]);
  assert.ok(a.pedidos.every((p) => p.length <= 3), 'ningún pedido lleva más de 3 índices');
  assert.ok(a.maxEnVuelo <= 2, `hubo ${a.maxEnVuelo} pedidos a la vez`);
});

test('el rótulo de una tanda cuenta desde 1, como la ve la persona', () => {
  assert.equal(rotuloTanda([3, 4, 5]), 'Secciones 4–6');
  assert.equal(rotuloTanda([6]), 'Sección 7');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Guardar al final, con todas
// ─────────────────────────────────────────────────────────────────────────────

test('guarda UNA vez al final, con todas las secciones en el orden del esquema', async () => {
  const a = arnes(8, { demora: 3 });
  await correrTandas(todas(a.estado), a.deps);
  assert.equal(a.guardados.length, 1);
  assert.deepEqual(ids(a.guardados[0]), ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']);
  assert.equal(a.estado.guardado, 'listo');
  assert.ok(todasListas(a.estado));
});

test('con una tanda fallada NO guarda; reintentar esa tanda no repide las otras y guarda una vez', async () => {
  const a = arnes(8, { falla: (ind, vez) => (ind.includes(3) && vez === 1 ? 'La IA no contestó.' : null) });
  await correrTandas(todas(a.estado), a.deps);
  assert.equal(a.guardados.length, 0, 'guardó con una sección que falta');
  assert.deepEqual(a.estado.tandas.map((t) => t.estado), ['lista', 'error', 'lista']);
  assert.equal(a.estado.tandas[1].error, 'La IA no contestó.');
  assert.deepEqual(a.estado.tarjetas.map((t) => (t ? t.attrs?.id : null)), ['s0', 's1', 's2', null, null, null, 's6', 's7']);

  const antes = a.pedidos.length;
  await correrTandas([1], a.deps);
  assert.deepEqual(a.pedidos.slice(antes), [[3, 4, 5]], 'el reintento tiene que pedir SOLO la tanda fallada');
  assert.equal(a.guardados.length, 1);
  assert.deepEqual(ids(a.guardados[0]), ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']);
});

test('un doble clic en «Reintentar» pide la tanda una sola vez', async () => {
  const a = arnes(5, { falla: (ind, vez) => (ind.includes(0) && vez === 1 ? 'falló' : null), demora: 5 });
  await correrTandas(todas(a.estado), a.deps);
  const antes = a.pedidos.length;
  await Promise.all([correrTandas([0], a.deps), correrTandas([0], a.deps)]);
  assert.deepEqual(a.pedidos.slice(antes), [[0, 1, 2]]);
  assert.equal(a.guardados.length, 1);
});

test('una respuesta con otra cantidad de secciones es un error de esa tanda, no un hueco adivinado', () => {
  const e = nuevaGeneracion(3);
  const r = colocarTanda(e, 0, { ok: true, tarjetas: [seccion(0), seccion(1)] });
  assert.equal(r.tandas[0].estado, 'error');
  assert.ok(r.tarjetas.every((t) => t === null));
  const otra = colocarTanda(e, 0, { ok: true, tarjetas: [seccion(0), { type: 'paragraph' }, seccion(2)] });
  assert.equal(otra.tandas[0].estado, 'error');
});

test('guardar dos veces a la vez guarda una sola', async () => {
  const a = arnes(2);
  await correrTandas(todas(a.estado), { ...a.deps, guardar: async () => ({ ok: false, error: 'red caída' }) });
  assert.equal(a.estado.guardado, 'error');
  assert.equal(a.estado.errorGuardar, 'red caída');
  await Promise.all([guardarSiCompleta(a.deps), guardarSiCompleta(a.deps)]);
  assert.equal(a.guardados.length, 1);
  assert.equal(a.estado.guardado, 'listo');
});

test('«Completar con el esquema» rellena SÓLO lo que falta, con el texto aprobado, y guarda una vez', async () => {
  const a = arnes(5, { falla: (ind) => (ind.includes(3) ? 'sin cuota' : null) });
  await correrTandas(todas(a.estado), a.deps);
  assert.equal(a.guardados.length, 0);
  const esq = { titulo: 'L', secciones: [0, 1, 2, 3, 4].map((i) => ({ titulo: `Título ${i}`, puntos: i === 3 ? ['uno', 'dos'] : [] })) };
  a.deps.escribir(completarConEsquema(a.estado, esq));
  await guardarSiCompleta(a.deps);
  assert.equal(a.guardados.length, 1);
  const g = a.guardados[0];
  assert.deepEqual(g.slice(0, 3).map((t) => t.attrs?.id), ['s0', 's1', 's2'], 'lo que ya llegó no se toca');
  assert.match(textoDe(g[3]), /Título 3[\s\S]*uno[\s\S]*dos/);
  assert.match(textoDe(g[4]), /Título 4/);
});

test('el contenido guardado es la página de la landing creada (su id) con las secciones', () => {
  const c = contenidoGenerado('pabc123', [seccion(0), seccion(1)]);
  assert.equal(c.v, 1);
  assert.equal(c.paginas.length, 1);
  assert.equal(c.paginas[0].id, 'pabc123');
  assert.equal(c.paginas[0].ruta, '');
  assert.deepEqual(ids(c.paginas[0].doc.content), ['s0', 's1']);
});

test('la pantalla usa ESTAS funciones: tandas, guardado al final y el contenido de la landing creada', () => {
  const src = fuente('app/landing-generator/crear/CrearConIA.tsx');
  // La generación arranca con todas las tandas y corre por correrTandas.
  assert.match(src, /await correrTandas\(inicial\.tandas\.map\(\(_, k\) => k\), deps\(\)\)/);
  // Cada tanda le pide a la ruta EXACTAMENTE sus índices.
  assert.match(src, /accion: 'secciones', esquema: esq, indices,/);
  // El guardado manda el contenido armado con la página de la landing creada.
  assert.match(src, /accion: 'guardar', id: d\.id, version: d\.version, titulo: esq\.titulo, contenido: contenidoGenerado\(d\.paginaId, tarjetas\)/);
  // Reintentar = esa tanda sola; reintentar guardar = guardarSiCompleta.
  assert.match(src, /const reintentarTanda = \(k: number\) => \{ void correrTandas\(\[k\], deps\(\)\); \};/);
  assert.match(src, /const reintentarGuardar = \(\) => \{ void guardarSiCompleta\(deps\(\)\); \};/);
  // Y ningún otro camino llama a la ruta de guardar.
  assert.equal((src.match(/accion: 'guardar'/g) ?? []).length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. El deep link ?url=
// ─────────────────────────────────────────────────────────────────────────────

test('el ?url= sólo se aplica si está entre las analizadas de este negocio', () => {
  const analizadas = [{ url: 'https://ejemplo.com/landing' }, { url: 'https://otra.com' }];
  assert.equal(baseDelDeepLink('https://ejemplo.com/landing', analizadas), 'https://ejemplo.com/landing');
  assert.equal(baseDelDeepLink('  https://otra.com  ', analizadas), 'https://otra.com');
  assert.equal(baseDelDeepLink('https://ajena.com', analizadas), null);
  assert.equal(baseDelDeepLink('https://ejemplo.com/landing/', analizadas), null, 'un parecido no es la misma página');
  assert.equal(baseDelDeepLink('', analizadas), null);
  assert.equal(baseDelDeepLink(null, analizadas), null);
  assert.equal(baseDelDeepLink('https://ejemplo.com/landing', []), null);
});

test('el objetivo de la query sólo vale si es de la lista cerrada', () => {
  assert.equal(objetivoValido('vender'), 'vender');
  assert.equal(objetivoValido('cualquiera'), null);
  assert.equal(objetivoValido(null), null);
});

test('la pantalla siembra «Sobre cuál» con la URL VALIDADA, y la página le pasa las analizadas', () => {
  const src = fuente('app/landing-generator/crear/CrearConIA.tsx');
  assert.match(src, /const baseInicial = baseDelDeepLink\(props\.url, analizadas\);/);
  assert.match(src, /basadoEnUrl: baseInicial,/);
  assert.doesNotMatch(src, /basadoEnUrl: props\.url/);
  const page = fuente('app/landing-generator/crear/page.tsx');
  assert.match(page, /listarAnalizadas\(\)/);
  assert.match(page, /analizadas=\{analizadas\}/);
  assert.match(page, /url=\{uno\(sp\.url\)\}/);
  // El Panel reenvía el deep link a Crear (con el ?ws= de la pestaña).
  const panel = fuente('app/landing-generator/page.tsx');
  assert.match(panel, /redirect\(await rutaConWs\(`\/landing-generator\/crear\?\$\{q\.toString\(\)\}`\)\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// El esquema y el tema sugerido
// ─────────────────────────────────────────────────────────────────────────────

test('lo que viaja del esquema: sin viñetas vacías ni secciones en blanco', () => {
  const e = esquemaParaEnviar({
    titulo: '  Mi   landing ',
    secciones: [
      { titulo: ' Hero ', puntos: ['  promesa ', '', '   '] },
      { titulo: '', puntos: [''] },
      { titulo: '', puntos: ['sin título', 'otro punto'] },
    ],
  });
  assert.deepEqual(e, {
    titulo: 'Mi landing',
    secciones: [{ titulo: 'Hero', puntos: ['promesa'] }, { titulo: 'sin título', puntos: ['otro punto'] }],
  });
});

test('mover, quitar y agregar secciones respetan los bordes', () => {
  const e = { titulo: 't', secciones: [{ titulo: 'a', puntos: [] }, { titulo: 'b', puntos: [] }] };
  assert.deepEqual(moverSeccion(e, 0, 1).secciones.map((s) => s.titulo), ['b', 'a']);
  assert.equal(moverSeccion(e, 0, -1), e);
  assert.equal(quitarSeccion(quitarSeccion(e, 0), 0).secciones.length, 1, 'la última sección no se quita');
  assert.equal(agregarSeccion(e).secciones.length, 3);
});

test('el tema sugerido existe en el catálogo para cada objetivo', () => {
  for (const o of ['agendar', 'vender', 'registrar', 'descargar'] as const) {
    assert.ok(TEMAS.some((t) => t.id === temaSugerido(o)), `${o} → ${temaSugerido(o)}`);
  }
});
