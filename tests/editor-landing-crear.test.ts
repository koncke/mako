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
//   4. T4 (tanda 2, punto 6: «Al momento de crear nuevo tengo que elegir si crear landing,
//      presentación...»): con una PRESENTACIÓN el alta lleva `formato` y proporción (y
//      sobrevive al saneo del server), todo pedido a la IA lleva `params.formato`, cada
//      plantilla nace con SU formato, la caja manda el tipo en la URL, la pantalla dice
//      «diapositiva», y la caja usa el micrófono (`BotonDictar`) y el ejemplo que se escribe
//      solo (`useEjemploQueSeEscribe`) de «Nueva automatización» IMPORTADOS, no copiados.
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
//
// ── Roturas de la sección 4 (T4, 12/10/2026, mismo arnés —restaura de memoria y compara el
//    sha256—; base en verde: 26 pasan, 0 fallan; al final, 26 / 0 otra vez). Cada una tumba
//    UN test, el que la persigue ──
//   · B14 tipoValido acepta cualquier «presentaci…» (también «PRESENTACION»)   -> 25 / 1
//   · B15 paramsDeTipo no suelta la landing de base en una presentación        -> 25 / 1
//   · B16 paramsDeTipo pone `formato` sólo en presentación (queda pegado)      -> 25 / 1
//   · B17 configDeCreacion sin `formato` en presentación (nace página)          -> 25 / 1
//   · B18 pedidoDePlantilla ignora el formato de la plantilla                   -> 25 / 1
//   · B19 rutaCaja no lleva el tipo                                             -> 25 / 1
//   · B20 rutaCaja manda el pedido en la URL aunque entró en la sesión          -> 25 / 1
//   · B21 rotuloTanda ignora el tipo («Sección 7» en una presentación)          -> 25 / 1
//   · B22 textoSecciones ignora el tipo                                          -> 25 / 1
//   · B23 las secciones se piden con los parámetros crudos (sin formato)         -> 25 / 1
//   · B24 el esquema de «pegar» con los parámetros crudos                        -> 25 / 1
//   · B25 el alta arma su config a mano, sin configDeCreacion                    -> 25 / 1
//   · B26 «Sobre cuál» se dibuja también en una presentación                     -> 25 / 1
//   · B27 la página no le pasa el tipo de la query al generador                  -> 25 / 1
//   · B28 la caja COPIA un botón de dictado en vez de importar BotonDictar       -> 25 / 1
//   · B29 el campo de la caja sin `key={tipo}` (el ejemplo queda trabado)        -> 25 / 1
//   · B30 la plantilla de la caja con su propio alta (sin formato)               -> 25 / 1
//     (el test de `pedidoDePlantilla` sigue verde ahí: por eso se lee el fuente)
//   · B31 enviar desde la caja sin el tipo                                       -> 25 / 1
//   · B32 la miniatura de la plantilla sin el formato (sin forma de diapositiva) -> 25 / 1
//   · B33 un ejemplo de 87 caracteres para el placeholder                        -> 25 / 1
//
// ── TANDA 6 (14/10/2026). Martín: «La sección de "Importar con IA" no debería ser otra ruta, todo siempre
//    en la misma ruta». Crear se abre A LA DERECHA del Panel y /landing-generator/crear redirige ahí, así
//    que `rutaCaja`/`rutaPaso` y `dejarCaja` se fueron (B19, B20, B31 ya no tienen qué romper): el pedido
//    de la caja viaja EN MEMORIA (`ArranqueIA`) y lo que va en la URL lo fijan los tests de la derecha
//    (tests/editor-landing-panel.test.ts y tests/editor-landing-crear-panel.test.ts). Cuatro tests de acá
//    se reescribieron con eso; el mismo arnés (restaura de memoria, compara el sha256), base 26 / 0 y al
//    final 26 / 0 otra vez:
//   · B34 Crear siembra «Sobre cuál» con el `base` crudo del arranque          -> 25 / 1
//   · B35 /crear redirige sin `rutaConWs` (el super admin cae en su cuenta)     -> 25 / 1
//   · B36 la caja manda el pedido sin el tipo (siempre landing)                -> 24 / 2
//     (lo cazan «a dónde manda la caja» y «la caja ¿Qué vas a crear hoy?»)
//   · B37 la derecha deja el pedido de la caja en la URL (un F5 lo repide)     -> 25 / 1
//   · B38 vuelve «Importar desde URL» a Crear                                   -> 25 / 1
//   · B39 el «+» de la caja vuelve a ofrecer «Usar plantilla»                   -> 25 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  baseDelDeepLink, colocarTanda, completarConEsquema, contenidoGenerado, correrTandas, guardarSiCompleta, nuevaGeneracion,
  objetivoValido, rotuloTanda, todasListas, type DepsGeneracion, type EstadoGen, type ResultadoTanda,
} from '../app/landing-generator/crear/CrearConIA';
import { agregarSeccion, esquemaParaEnviar, moverSeccion, quitarSeccion, textoSecciones } from '../app/landing-generator/crear/EditorEsquema';
import {
  EJEMPLOS_CAJA, configDeCreacion, cuantas, paramsDeTipo, pedidoDePlantilla, plantillasDe, termino, tipoValido,
} from '../app/landing-generator/crear/tipo';
import { derechaDeQuery, queryDeDerecha } from '../app/landing-generator/panel-reglas';
import { PARAMS_DEFAULT } from '../lib/editor-landing/ia-reglas';
import { sanearConfig } from '../lib/editor-landing/validar';
import { mezclarConfig } from '../lib/editor-landing/server-reglas';
import { PLANTILLAS } from '../lib/editor-landing/plantillas';
import { PLANTILLAS_PRESENTACION } from '../lib/editor-landing/plantillas-presentaciones';
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
  // Tanda 6: el deep link llega como `arranque.base` (la derecha del Panel, `derechaDeQuery`).
  assert.match(src, /const baseInicial = baseDelDeepLink\(arranque\?\.base, analizadas\);/);
  assert.match(src, /basadoEnUrl: baseInicial,/);
  assert.doesNotMatch(src, /basadoEnUrl: (props\.url|arranque\?\.base)/);
  // Las analizadas las lee el Panel (después del guard) y se las pasa a Crear, que se monta a su derecha.
  const panel = fuente('app/landing-generator/page.tsx');
  assert.match(panel, /listarAnalizadas\(\)/);
  assert.match(panel, /derechaDeQuery\(consultaDerecha\(sp\), docs, bases\)/);
  assert.doesNotMatch(panel, /landing-generator\/crear/, 'el Panel ya no reenvía a otra ruta');
  const inicio = fuente('app/landing-generator/Inicio.tsx');
  assert.match(inicio, /<CrearConIA\s+analizadas=\{analizadas\}/);
  assert.match(inicio, /arranque=\{derecha\.arranque \?\? null\}/);
  // /landing-generator/crear REDIRIGE al Panel con su query (y el ?ws= de la pestaña).
  const page = fuente('app/landing-generator/crear/page.tsx');
  assert.match(page, /redirect\(await rutaConWs\(destinoCrear\(await searchParams\)\)\);/);
  assert.doesNotMatch(page, /<CrearConIA|listarAnalizadas/, 'la ruta volvió a dibujar Crear');
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. T4 (tanda 2): Landing | Presentación, la caja con el micrófono y las plantillas
// ─────────────────────────────────────────────────────────────────────────────

const ORIGEN = { modo: 'ia' as const, pedido: 'algo', objetivo: 'agendar' as const, basadoEnUrl: null };

test('el tipo de la query: sólo «presentacion» crea una presentación; lo demás, una landing', () => {
  assert.equal(tipoValido('presentacion'), 'presentacion');
  for (const v of ['landing', 'PRESENTACION', 'presentación', '', null, undefined, 'pagina']) assert.equal(tipoValido(v), 'landing', String(v));
});

test('los parámetros de la IA: una presentación pide diapositivas y suelta la landing de base', () => {
  const p = { ...PARAMS_DEFAULT, basadoEnUrl: 'https://ejemplo.com/landing', cantidad: 6 };
  const pres = paramsDeTipo(p, 'presentacion');
  assert.equal(pres.formato, 'presentacion');
  assert.equal(pres.basadoEnUrl, null, 'el diagnóstico de una página no viaja en una presentación');
  assert.equal(pres.cantidad, 6);
  const land = paramsDeTipo(p, 'landing');
  assert.equal(land.formato, 'pagina');
  assert.equal(land.basadoEnUrl, 'https://ejemplo.com/landing');
  // Volver de Presentación a Landing no deja el formato pegado.
  assert.equal(paramsDeTipo({ ...p, formato: 'presentacion' }, 'landing').formato, 'pagina');
});

test('el alta de la IA: una presentación nace presentación (y sobrevive al saneo del server)', () => {
  const c = configDeCreacion('presentacion', 'pewter', ORIGEN);
  assert.equal(c.formato, 'presentacion');
  assert.equal(c.proporcion, '16:9');
  assert.equal(c.tema, 'pewter');
  assert.deepEqual(c.origen, ORIGEN);
  // El camino del server (crearEn): mezclar con el default y sanear.
  const guardada = sanearConfig(mezclarConfig(c)).config;
  assert.equal(guardada.formato, 'presentacion');
  assert.equal(guardada.proporcion, '16:9');
  const l = configDeCreacion('landing', 'pewter', ORIGEN);
  assert.equal(l.formato, 'pagina');
  assert.equal('proporcion' in l, false);
  assert.equal(sanearConfig(mezclarConfig(l)).config.formato, 'pagina');
});

test('las plantillas de cada tipo, y el alta de cada una con SU formato', () => {
  assert.equal(plantillasDe('presentacion'), PLANTILLAS_PRESENTACION);
  // Una landing ofrece DISEÑOS, y el copy (el objetivo) se elige después (12/10/2026; el cruce
  // diseño × objetivo lo fija tests/editor-landing-disenos.test.ts).
  assert.ok(plantillasDe('landing').every((p) => p.pideObjetivo), 'una landing ofrece diseños');
  assert.ok(PLANTILLAS_PRESENTACION.length >= 12, `hay ${PLANTILLAS_PRESENTACION.length} presentaciones`);
  for (const p of PLANTILLAS_PRESENTACION) {
    const r = pedidoDePlantilla(p);
    assert.equal(r.accion, 'crear');
    assert.equal(r.titulo, p.nombre);
    assert.equal(r.config?.formato, 'presentacion', p.id);
    assert.equal(r.config?.proporcion, p.proporcion, p.id);
    assert.equal(r.config?.tema, p.tema);
    assert.deepEqual(r.config?.origen, { modo: 'plantilla', plantilla: p.id });
    assert.ok((r.contenido?.paginas[0]?.doc.content?.length ?? 0) > 0, `${p.id} sin diapositivas`);
    assert.equal(sanearConfig(mezclarConfig(r.config)).config.formato, 'presentacion', `${p.id} nace página`);
  }
  for (const p of PLANTILLAS) {
    const r = pedidoDePlantilla(p);
    assert.equal(r.config?.formato, 'pagina', p.id);
    assert.equal(r.config && 'proporcion' in r.config, false, p.id);
    assert.deepEqual(r.config?.origen, { modo: 'plantilla', plantilla: p.id });
  }
});

test('a dónde manda la caja: a la derecha del Panel con el tipo; el pedido EN MEMORIA, nunca en la URL', () => {
  // Tanda 6: la caja no navega. Le pasa al Panel el paso, el TIPO y el pedido (`onAccion`), y el Panel abre
  // Crear a su derecha (Inicio.tsx, `alAccion`).
  const caja = fuente('app/landing-generator/CajaCrear.tsx');
  assert.match(caja, /onAccion\(\{ que: 'ia', paso: 'generar', tipo, arranque: \{ prompt: p, modo \} \}\);/);
  assert.match(caja, /onAccion\(\{ que: 'ia', paso: 'pegar', tipo, arranque: \{ modo, prompt: pedido\.trim\(\), archivo: /);
  assert.doesNotMatch(caja, /router\.push|dejarCaja|rutaCaja|rutaPaso/, 'la caja volvió a navegar a otra ruta');
  // La URL guarda el paso y el tipo (un F5 vuelve ahí), pero NO el pedido: se paga, y un F5 no lo repide.
  const conPedido = { tipo: 'ia' as const, paso: 'generar' as const, doc: 'presentacion' as const, arranque: { prompt: 'mi pitch', modo: 'express' as const } };
  const q = new URLSearchParams(queryDeDerecha('?ws=3&desde=caja&modo=express&prompt=mi+pitch', conPedido));
  assert.equal(q.get('paso'), 'generar');
  assert.equal(q.get('tipo'), 'presentacion');
  assert.equal(q.get('ws'), '3');
  for (const k of ['prompt', 'desde', 'modo']) assert.equal(q.get(k), null, `«${k}» quedó en la URL`);
  assert.equal(new URLSearchParams(queryDeDerecha('', { tipo: 'ia', paso: 'importar', doc: 'landing' })).get('tipo'), null);
  // El link VIEJO de la caja (una pestaña con la pantalla de antes, redirigida desde /crear): el tipo y el
  // modo viajan; el pedido, de la sesión (`tomarCaja`) o, si no entró ahí, de la URL.
  assert.deepEqual(derechaDeQuery({ desde: 'caja', modo: 'express', tipo: 'presentacion' }, [], []),
    { tipo: 'ia', paso: 'generar', doc: 'presentacion', arranque: { sesion: true, modo: 'express' } });
  assert.deepEqual(derechaDeQuery({ desde: 'caja', prompt: '  algo  ' }, [], []),
    { tipo: 'ia', paso: 'generar', doc: 'landing', arranque: { sesion: true, modo: 'plan', prompt: 'algo' } });
  const crear = fuente('app/landing-generator/crear/CrearConIA.tsx');
  assert.match(crear, /\? tomarCaja\(\) \?\? \(arranque\.prompt \? \{ prompt: arranque\.prompt, modo: arranque\.modo \?\? 'plan' \} : null\)/);
});

test('la palabra: «diapositiva» en una presentación, «sección» en una landing', () => {
  assert.equal(rotuloTanda([6], 'presentacion'), 'Diapositiva 7');
  assert.equal(rotuloTanda([3, 4, 5], 'presentacion'), 'Diapositivas 4–6');
  assert.equal(textoSecciones(1, 'presentacion'), '1 diapositiva en total');
  assert.equal(textoSecciones(8, 'presentacion'), '8 diapositivas en total');
  assert.equal(textoSecciones(8), '8 secciones en total');
  assert.equal(cuantas(1, 'presentacion'), '1 diapositiva');
  assert.equal(cuantas(3, 'landing'), '3 secciones');
  assert.equal(termino('presentacion', { plural: true, mayuscula: true }), 'Diapositivas');
});

test('el generador manda el tipo en TODO pedido a la IA y en el alta', () => {
  const src = fuente('app/landing-generator/crear/CrearConIA.tsx');
  // Los dos esquemas (generar y pegar: tanda 6, «Importar» es sólo un archivo y su texto va a Pegar) y las
  // secciones pasan por paramsDeTipo. «Importar desde URL» se fue: eso es Analizar o Replicar landing.
  assert.equal((src.match(/accion: 'esquema', modo: '(generar|pegar)'[^\n]*params: paramsDeTipo\(v\.params, v\.tipo\)/g) ?? []).length, 2);
  assert.doesNotMatch(src, /modo: 'importar'|urlImportar|Importar desde URL/, 'volvió «Importar desde URL»');
  assert.match(src, /accion: 'secciones', esquema: esq, indices, params: paramsDeTipo\(vivo\.current\.params, tipoGen\.current\)/);
  assert.doesNotMatch(src, /params: (v|vivo\.current)\.params[,\s}]/, 'un pedido con los parámetros crudos no lleva el formato');
  // El alta sale de configDeCreacion con el tipo CONGELADO de la generación.
  assert.match(src, /configDeCreacion\(tipoGen\.current, v\.temaId,/);
  assert.match(src, /if \(!docRef\.current\) \{ tipoGen\.current = vivo\.current\.tipo;/);
  // El tipo de la query se valida, y el Panel se lo pasa (la derecha `ia` lo trae validado: `derechaDeQuery`).
  assert.match(src, /useState<TipoCrear>\(\(\) => tipoValido\(props\.tipo\)\)/);
  assert.match(fuente('app/landing-generator/Inicio.tsx'), /tipo=\{derecha\.doc\}/);
  assert.equal(derechaDeQuery({ paso: 'pegar', tipo: 'presentacion' }, [], []).tipo, 'ia');
  // «Sobre cuál» sólo se dibuja en una landing.
  assert.match(src, /\{tipo === 'landing' && \(\s*<>\s*<Desplegable\s+etiqueta="Sobre cuál"/);
  // Y la caja de «Generar» tiene el micrófono de la casa.
  assert.match(src, /<BotonDictar titulo="Dictar el pedido" valor=\{prompt\}/);
});

test('la caja «¿Qué vas a crear hoy?»: el micrófono y el ejemplo de «Nueva automatización», importados', () => {
  const src = fuente('app/landing-generator/CajaCrear.tsx');
  assert.match(src, /export default function CajaCrear\(/);
  // DECIMOCUARTA TANDA DE AUTOMATIONS (12/10/2026): la caja salió a CajaPedido.tsx, la MISMA que monta el modal «Nueva
  // automatización». El micrófono y el ejemplo siguen IMPORTADOS (en la caja), no copiados.
  // (Y el título, desde la decimoquinta tanda de Automations: es de la caja, `TITULO_CAJA`.)
  // (Tanda 6: también `ChipCaja`, el chip del archivo adjunto y del link pegado, el mismo de /automations.)
  assert.match(src, /import \{ CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, TITULO_CAJA \} from '\.\/CajaPedido';/);
  const caja = fuente('app/landing-generator/CajaPedido.tsx');
  assert.match(caja, /import \{ BotonDictar \} from '@\/app\/plan\/board\/CrearTareaModal';/);
  assert.match(caja, /import \{ useEjemploQueSeEscribe \} from '@\/app\/automations\/CrearConIA';/);
  assert.match(caja, /<BotonDictar titulo="Dictar el pedido" valor=\{p\.valor\}/);
  // Reusar, no copiar: ni el reconocimiento ni la grabación viven acá.
  for (const x of [src, caja]) {
    assert.doesNotMatch(x, /SpeechRecognition|MediaRecorder|getUserMedia|useDictar\(/);
    assert.doesNotMatch(x, /function useEjemploQueSeEscribe/);
  }
  assert.match(fuente('app/automations/ChatMako.tsx'), /import \{ CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA \} from '@\/app\/landing-generator\/CajaPedido';/);
  // El ejemplo se escribe con la lista del tipo, y el campo vuelve a empezar al cambiar de tipo.
  assert.match(src, /reinicio=\{tipo\}\s+ejemplos=\{EJEMPLOS_CAJA\[tipo\]\}/);
  // Decimoquinta tanda de Automations (punto 6): se mueve mientras la caja no tiene el foco y está vacía (`mover`).
  assert.match(caja, /const ejemplo = useEjemploQueSeEscribe\(mover, ejemplos\);/);
  assert.match(caja, /<CampoPedido\s+key=\{p\.reinicio \?\? ''\}/);
  // Enviar: el pedido al Panel con el tipo (tanda 6, ver «a dónde manda la caja»); una plantilla: su alta y
  // abrirla. Un DISEÑO de landing pregunta antes el objetivo («¿De qué quieres crearla?»).
  assert.match(src, /onAccion\(\{ que: 'ia', paso: 'generar', tipo, arranque: \{ prompt: p, modo \} \}\);/);
  assert.match(src, /const lista = plantillasDe\(tipo\);/);
  assert.match(src, /if \(p\.pideObjetivo\) \{ setEligiendo\(p\); return; \}\s*void crear\(p\.id, pedidoDePlantilla\(p\)\);/);
  assert.match(src, /const alta = pedidoDeDiseno\(eligiendo, objetivo\);/);
  assert.match(src, /<DialogoObjetivo ocupado=\{!!creando\} onElegir=\{conObjetivo\} onCerrar=\{cerrarEleccion\} \/>/);
  assert.match(src, /const r = await pedirDocs\(alta\);/);
  assert.match(src, /irDuro\(`\/landing-generator\/\$\{r\.doc\.id\}`, ws\);/);
  // Tanda 6, punto 4: el «+» sólo adjunta (un archivo o una imagen); «Usar plantilla» es la grilla de abajo y
  // «Del generador anterior», la galería de Plantillas del Panel.
  const mas = src.slice(src.indexOf('<MenuFlotante ancla={menuMas}'), src.indexOf('</MenuFlotante>', src.indexOf('<MenuFlotante ancla={menuMas}')));
  assert.deepEqual([...mas.matchAll(/texto="([^"]+)"/g)].map((m) => m[1]), ['Importar archivo', 'Subir imagen']);
  assert.doesNotMatch(src, /Usar plantilla"|Del generador anterior|DialogoBorradores|Importar archivo o URL/, 'volvió una opción vieja del «+»');
  // Las miniaturas con la forma del documento (la diapositiva, en una presentación).
  assert.match(src, /<MiniaturaLanding tarjeta=\{m\[p\.id\] \?\? null\} tema=\{temaPorId\(p\.tema\)\} formato=\{formatoDe\(p\)\} proporcion=\{p\.proporcion\} \/>/);
});

test('los ejemplos que se escriben solos: cortos y de los dos tipos', () => {
  for (const t of ['landing', 'presentacion'] as const) {
    assert.ok(EJEMPLOS_CAJA[t].length >= 3, t);
    for (const e of EJEMPLOS_CAJA[t]) assert.ok(e.length <= 70, `${t}: «${e}» es largo para un placeholder`);
  }
});
