// =============================================================================
// Cómo se ve el curso de un producto: el color, los títulos y las portadas (mig 0214)
// =============================================================================
// Pedido de Martín (07/10/2026): «Permite personalizar cosas, como colores (el verde), las
// portadas, los titulos solo con darle click». Lo que se EJECUTA: las reglas puras
// (lib/curso-estilo.ts) y los dos adaptadores con un estilo puesto. Lo que se LEE del fuente: que
// las acciones exijan admin y producto propio, que renombrar no escriba la fila entera, que la
// etapa se renombre por el camino del editor de etapas, y la tabla con su candado.
//
// ── Roturas (07/10/2026) ─────────────────────────────────────────────────────
// Con todo en su lugar: 21 pass / 0 fail (el del menú se sumó al final: sin la espera de la
// posición, 20 / 1). Rompiendo UNA cosa por vez sobre el archivo real
// (restaurado de memoria y comprobado con md5), cada rotura tumbó SU test:
//   · `acentoLegible` sin aclarar (contraste < 0)                       → 18 / 2
//   · `armarEstilo` sin sanear lo que lee                                → 19 / 1
//   · el título sin tope · la portada sin `saneaPortada`                 → 19 / 1 · 18 / 2
//   · `guardarEstiloCursoAction` sin `productoPropio`                    → 19 / 1
//   · `renombrarEtapaCursoAction` con la lectura que cae al default      → 19 / 1
//     (08/10/2026: se fue; lo mismo lo cuida `renombrarModulo`, lib/curso-modulos-datos.ts. Rotura:
//     `modulosDelCurso(productoId)` sin `estricta` → 21 / 1 «las acciones de los módulos…»; y
//     `estiloQueViaja` mandando la portada de una clase cerrada → 21 / 1 «sólo le viajan las
//     portadas…». Sobre 22, scratchpad/nucleo/romper.mjs, restaurado de memoria.)
//   · `renombrarClase` con un upsert de la fila                          → 19 / 1
//   · la 0214 sin el `revoke`                                            → 19 / 1
//   · el editor y el portal poniendo la miniatura encima del degradado   → 19 / 1 cada uno
//   · la portada editando como <button>                                  → 19 / 1
//   · la lámina con el lima fijo                                         → 19 / 1
// Y las de lo que encontró la revisión adversarial del mismo día (5 guardas de acá daban VERDE
// sobre su propio bug: miraban la portada que no se edita, un fixture sin el caso, el archivo con
// comentarios, el CSS sin lo de adentro de un @media). Cada una, 32 / 1 sobre los dos archivos:
//   · las portadas leídas con `mapa[key]` (la etapa «Constructor») · `__proto__` como key
//   · el portal mandando todas las portadas de clase · borrar una clase sin borrar su portada
//   · `TENANT_TABLES` con la línea comentada · una regla sin acotar adentro de un @media
//   · el color: sin cancelar el pendiente · volviendo a lo de pantalla y no a lo confirmado
//   · un `color-mix` de vuelta · el tope de 60 en el curso contra el de 40 del kanban
// 08/10/2026, el TURNO de cada ajuste (la respuesta vieja que pisaba lo tipeado en una lámina;
// scratchpad/editor/roturas.mjs). Sin romper 24 / 0; cada rotura dio 23 / 1 en su test:
//   · la respuesta del server pintada sin mirar el turno · volver a lo de PANTALLA y no a lo confirmado
//   · un solo turno para todos los ajustes (el color esperaría al título)
// 08/10/2026, la DISPOSICIÓN de la lección («Texto al costado / Texto abajo», paso LECCIÓN;
// scratchpad/leccion/romper.mjs, restaurado de memoria con md5). Sin romper 24 / 0; cada rotura dio
// 23 / 1 en «la disposición de la lección…»:
//   · el saneo guardando «costado» (el default tiene que BORRAR la fila) · el saneo con `trim()` y
//     minúsculas (« abajo» o «ABAJO» no son un valor de la pantalla) · `disposicionDe` fijo al costado

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACENTO_DEFAULT, acentoLegible, ajusteDe, ajusteValido, armarEstilo, claveDe, conAjuste, contraste, disposicionDe, estiloVacio,
  portadaDeClase, portadaDeEtapa, sanearAjuste, soloDeClases, tapaDe, valorDe, varsDeAcento,
} from '../lib/curso-estilo';
import { nuevaClaveEtapa } from '../lib/servicio-etapas';
import { CSS_UGC } from '../app/_cursos/estilos';
import type { Clase } from '../lib/curso';
import type { ProductoVista, ModuloVista, ClaseVista } from '../lib/curso-portal';
import { estiloQueViaja } from '../lib/curso-portal';
import { clasesDelEditor, modulosDelEditor, SIN_ETAPA } from '../app/customer-success/curso/modelo-ugc';
import { clasesDelPortal, modulosDelPortal } from '../app/compartido/curso/[token]/modelo-ugc';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TINTA = '#16150F';
const PICSUM = 'https://picsum.photos/id/10/800/450';

// ── Las claves ───────────────────────────────────────────────────────────────

test('cada ajuste tiene UNA clave, y una clave inventada no es un ajuste', () => {
  for (const a of [
    { tipo: 'acento' }, { tipo: 'titulo' }, { tipo: 'resumen' }, { tipo: 'portada' },
    { tipo: 'portada-etapa', etapa: 'bienvenida' }, { tipo: 'portada-clase', clase: 12 }, { tipo: 'disposicion' },
  ] as const) {
    assert.deepEqual(ajusteDe(claveDe(a)), a);
  }
  assert.equal(ajusteDe('color'), null);
  assert.equal(ajusteDe('portada:etapa:Con Espacios'), null, 'la key de una etapa es un slug de la entrega');
  assert.equal(ajusteDe('portada:clase:0'), null);
  assert.equal(ajusteValido({ tipo: 'portada-clase', clase: -3 }), null);
  assert.equal(ajusteValido({ tipo: 'titulo; drop table' }), null);
});

// ── Lo que se guarda ─────────────────────────────────────────────────────────

test('el color: se normaliza, y uno oscuro se ACLARA hasta que la tinta se lea encima', () => {
  assert.equal(sanearAjuste({ tipo: 'acento' }, '#ffd43b'), '#FFD43B');
  assert.equal(sanearAjuste({ tipo: 'acento' }, 'abc'), '#AABBCC');
  assert.equal(sanearAjuste({ tipo: 'acento' }, 'rojo'), null);
  const marino = sanearAjuste({ tipo: 'acento' }, '#0B1F4D')!;
  assert.notEqual(marino, '#0B1F4D');
  assert.ok(contraste(marino, TINTA) >= 4.5, `con ${marino} la tinta no se lee (${contraste(marino, TINTA).toFixed(2)})`);
  assert.equal(acentoLegible(ACENTO_DEFAULT), ACENTO_DEFAULT, 'el lima de la casa ya se lee: no se toca');
});

test('los textos: una línea, con tope, y vacío es volver al default', () => {
  assert.equal(sanearAjuste({ tipo: 'titulo' }, '  Negocio   que\nEscala  '), 'Negocio que Escala');
  assert.equal(sanearAjuste({ tipo: 'titulo' }, '   '), null);
  assert.equal(sanearAjuste({ tipo: 'titulo' }, 'x'.repeat(500))!.length, 80);
  assert.equal(sanearAjuste({ tipo: 'resumen' }, 'y'.repeat(900))!.length, 280);
});

test('la disposición de la lección (item 16): sólo «abajo» se guarda; al costado es el default y BORRA la fila', () => {
  const d = { tipo: 'disposicion' } as const;
  assert.equal(sanearAjuste(d, 'abajo'), 'abajo');
  // Volver al costado no guarda «costado»: borra la fila, como todo default de la mig 0214.
  for (const otro of ['costado', 'ABAJO', ' abajo', 'derecha', '', null, 1, {}]) {
    assert.equal(sanearAjuste(d, otro), null, `guardó ${JSON.stringify(otro)}`);
  }
  // Lo que se LEE también se sanea: una fila rota vuelve al costado, y la pantalla dibuja eso.
  assert.equal(armarEstilo([{ clave: 'disposicion', valor: 'abajo' }]).disposicion, 'abajo');
  assert.equal(armarEstilo([{ clave: 'disposicion', valor: 'arriba' }]).disposicion, null);
  assert.equal(disposicionDe(armarEstilo([{ clave: 'disposicion', valor: 'abajo' }])), 'abajo');
  assert.equal(disposicionDe(estiloVacio()), 'costado');
  assert.equal(disposicionDe(null), 'costado');
  // La pantalla lo aplica antes de que conteste el server, y lo vuelve a sacar con `null`.
  assert.equal(conAjuste(estiloVacio(), d, 'abajo').disposicion, 'abajo');
  assert.equal(conAjuste({ ...estiloVacio(), disposicion: 'abajo' }, d, null).disposicion, null);
  assert.equal(valorDe({ ...estiloVacio(), disposicion: 'abajo' }, d), 'abajo');
});

test('las portadas: un degradado del catálogo o una foto de un origen permitido; nada más', () => {
  const p = { tipo: 'portada' } as const;
  assert.equal(sanearAjuste(p, 'grad:menta'), 'grad:menta');
  assert.equal(sanearAjuste(p, 'grad:inventado'), null);
  assert.equal(sanearAjuste(p, PICSUM), PICSUM);
  assert.equal(sanearAjuste(p, 'https://picsum.photos@evil.tld/x.png'), null, 'el origen real es evil.tld');
  assert.equal(sanearAjuste(p, 'javascript:alert(1)'), null);
  assert.equal(sanearAjuste({ tipo: 'portada-etapa', etapa: 'bienvenida' }, 'http://picsum.photos/x'), null, 'sólo https');
});

test('lo que se LEE también se sanea: una fila vieja o rota vuelve al default', () => {
  const e = armarEstilo([
    { clave: 'acento', valor: '#000000' },
    { clave: 'titulo', valor: 'Mi curso' },
    { clave: 'portada', valor: 'https://evil.tld/x.png' },
    { clave: 'portada:etapa:bienvenida', valor: 'grad:menta' },
    { clave: 'portada:clase:7', valor: PICSUM },
    { clave: 'inventada', valor: 'x' },
  ]);
  assert.ok(e.acento && contraste(e.acento, TINTA) >= 4.5, 'un negro guardado se dibuja aclarado');
  assert.equal(e.titulo, 'Mi curso');
  assert.equal(e.portada, null, 'un origen que no se acepta no llega al navegador del alumno');
  assert.deepEqual(e.portadasEtapa, { bienvenida: 'grad:menta' });
  assert.deepEqual(e.portadasClase, { 7: PICSUM });
});

test('el acento pinta en .ugc, y el lima de siempre no toca nada', () => {
  assert.equal(varsDeAcento(null), undefined);
  assert.equal(varsDeAcento(ACENTO_DEFAULT), undefined);
  const v = varsDeAcento('#FFD43B')!;
  assert.equal(v['--lime'], '#FFD43B');
  assert.equal(v['--u-lime'], '#FFD43B');
  assert.ok(v['--lamina-sticker'] && v['--lamina-brocha'], 'la lámina de cada etapa sigue al acento');
});

test('una portada guardada es una FOTO o un DEGRADADO para el dibujo', () => {
  assert.deepEqual(tapaDe(PICSUM), { tapa: PICSUM });
  assert.ok(tapaDe('grad:menta').fondo?.startsWith('linear-gradient('));
  assert.deepEqual(tapaDe(null), {});
});

// ── Los dos adaptadores, con un estilo puesto ────────────────────────────────

const clase = (id: number, etapa: string, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa, orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase', minutos: null,
  videoTipo: 'youtube', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
} as Clase);

test('editor: la portada elegida le gana a la lámina y a la miniatura del video', () => {
  const estilo = { ...estiloVacio(), portadasEtapa: { a: 'grad:menta' }, portadasClase: { 2: PICSUM, 4: 'grad:menta' } };
  const etapas = [{ key: 'a', label: 'A' }];
  const porEtapa = { a: [clase(1, 'a'), clase(2, 'a'), clase(4, 'a')] };
  const [m] = modulosDelEditor(etapas, porEtapa, [], estilo);
  assert.ok(m.fondo?.startsWith('linear-gradient('));
  assert.equal(m.portada, null);
  const cs = clasesDelEditor(etapas, porEtapa, [], estilo);
  assert.match(cs[0].tapa ?? '', /i\.ytimg\.com/, 'sin portada elegida, la miniatura del video');
  assert.equal(cs[1].tapa, PICSUM);
  // Una clase CON VIDEO y un degradado elegido: el degradado, sin la miniatura encima (la tarjeta
  // pinta el fondo sólo cuando no hay tapa). La primera versión del fixture no tenía este caso y
  // la rotura pasaba en verde (revisión del 07/10/2026).
  assert.ok(cs[2].fondo?.startsWith('linear-gradient('));
  assert.equal(cs[2].tapa, null);
  const huerfana = modulosDelEditor(etapas, porEtapa, [clase(3, 'borrada')], estilo).find((x) => x.key === SIN_ETAPA);
  assert.equal(huerfana?.sinEdicion, true, '«Sin etapa» no se renombra ni se le agregan clases');
});

test('portal: el alumno ve las portadas que eligió el equipo', () => {
  const cv = (id: number): ClaseVista => ({
    id, titulo: `C${id}`, descripcion: '', minutos: null, video: { tipo: 'youtube', id: 'dQw4w9WgXcQ' }, pct: null,
    tarea: '', campos: [], tieneTarea: false, obligatoria: false, estado: 'pendiente', valores: {},
    descripcionHtml: '', hecha: false, completa: false,
  });
  const e: ModuloVista = {
    key: 'a', label: 'A', vinculado: true, etapa: 'actual', abierto: true, clases: [cv(1), cv(2)],
    cuantas: 2, obligatorias: 0, enviadas: 0, tareas: 0, tareasEnviadas: 0, completo: false,
  };
  const p: ProductoVista = {
    productoId: 1, nombre: 'P', modulos: [e],
    estilo: { ...estiloVacio(), portadasEtapa: { a: PICSUM }, portadasClase: { 1: 'grad:menta' } },
  };
  assert.equal(modulosDelPortal(p)[0].portada, PICSUM);
  const [c1, c2] = clasesDelPortal(p);
  assert.ok(c1.ugc.fondo?.startsWith('linear-gradient('));
  assert.equal(c1.ugc.tapa, null, 'con un degradado elegido no se pone encima la miniatura del video');
  assert.match(c2.ugc.tapa ?? '', /i\.ytimg\.com/);
});

test('una etapa llamada «Constructor» no tumba el portal: las portadas se leen como PROPIAS del mapa', () => {
  const key = nuevaClaveEtapa('Constructor', []);
  assert.equal(key, 'constructor');
  // Como llega al navegador: un objeto común después de viajar por RSC.
  const e = JSON.parse(JSON.stringify(armarEstilo([])));
  assert.equal(portadaDeEtapa(e, key), null, 'sin portada elegida es null, no la función Object');
  assert.equal(valorDe(e, { tipo: 'portada-etapa', etapa: key }), null);
  assert.deepEqual(tapaDe(e.portadasEtapa[key]), {}, 'tapaDe no tira con algo que no es un string');
  assert.equal(portadaDeClase(e, 0), null);
  assert.equal(ajusteDe('portada:etapa:__proto__'), null, '__proto__ le cambiaría el prototipo al mapa');
  const conPortada = armarEstilo([{ clave: 'portada:etapa:constructor', valor: 'grad:menta' }]);
  assert.equal(portadaDeEtapa(conPortada, 'constructor'), 'grad:menta');
});

test('al alumno sólo le viajan las portadas de las clases que ve (no las de una etapa con candado ni las de una clase borrada)', () => {
  const e = { ...estiloVacio(), portadasClase: { 1: PICSUM, 9: 'grad:menta' } };
  assert.deepEqual(soloDeClases(e, new Set([1, 2])).portadasClase, { 1: PICSUM });
  // Desde el 08/10/2026 (D2) el recorte es `estiloQueViaja`: las clases ABIERTAS (una cerrada viaja
  // con su título y nada más, tampoco su portada) y las portadas de los módulos que VIAJAN.
  const mod = (key: string, clases: ModuloVista['clases']): ModuloVista => ({
    key, label: key, vinculado: true, abierto: true, clases, cuantas: clases.length,
    obligatorias: 0, enviadas: 0, tareas: 0, tareasEnviadas: 0, completo: false,
  });
  const abierta = { id: 1, titulo: 'C1' } as ClaseVista;
  const viaja = estiloQueViaja(
    { ...estiloVacio(), portadasClase: { 1: PICSUM, 2: 'grad:menta' }, portadasEtapa: { a: PICSUM, escondido: 'grad:menta' } },
    [mod('a', [abierta, { id: 2, titulo: 'C2', cerrada: true, motivo: 'Lo abre tu equipo' }])],
  );
  assert.deepEqual(viaja.portadasClase, { 1: PICSUM }, 'la portada de una clase cerrada no viaja');
  assert.deepEqual(viaja.portadasEtapa, { a: PICSUM }, 'la de un módulo que no viaja, tampoco');
  const portal = sinComentarios(leer('lib/curso-portal.ts'));
  assert.match(portal, /estilo: estiloQueViaja\(estilos\.get\(productoId\) \?\? estiloVacio\(\), modulos\)/);
  assert.match(sinComentarios(leer('app/customer-success/curso/vista/page.tsx')), /estilo: estiloQueViaja\(/);
  assert.match(sinComentarios(leer('lib/curso-admin.ts')), /from\('curso_estilo'\)\.delete\(\)\.eq\('clave', `portada:clase:\$\{c\.id\}`\)/,
    'borrar una clase borra su portada');
});

test('los tintes del acento van como variables calculadas, no con color-mix (un navegador viejo dejaba la tapa sin fondo)', () => {
  const v = varsDeAcento('#FFD43B')!;
  assert.equal(v['--u-lime-a22'], 'rgba(255, 212, 59, 0.22)');
  const css = CSS_UGC;
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /color-mix/);
  assert.match(css, /--u-lime-a22: rgba\(205, 241, 59, \.22\)/, 'el lima por default de cada tinte');
});

test('el color: un toque en la paleta cancela el «otro» pendiente, y un guardado que falla vuelve a lo CONFIRMADO', () => {
  const src = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  const i = src.indexOf('const guardarAjuste = async');
  const f = src.slice(i, src.indexOf('const probarAcento', i));
  assert.ok(f.length > 200, 'no encontré guardarAjuste');
  assert.match(f, /if \(a\.tipo === 'acento'\) window\.clearTimeout\(timerAcento\.current\)/);
  // Lo que se vuelve es lo que el server CONFIRMÓ, nunca lo de pantalla (un tono a mitad de camino).
  assert.match(f, /const volver = \(\) => \{ if \(vigente\(\)\) poner\(valorDe\(confirmados\.current\[pid\]/);
  assert.doesNotMatch(f, /valorDe\(estilos\[/);
  assert.equal((f.match(/\bvolver\(\);/g) ?? []).length, 2, 'los DOS caminos de error vuelven a lo confirmado');
});

test('una respuesta VIEJA no pisa lo que se está tipeando: cada ajuste lleva su turno (08/10/2026)', () => {
  // La revisión de las láminas lo midió en un arnés: «Uno» y después «Uno dos» en el aire, la respuesta
  // de «Uno» llegando última, y el campo quedaba en «Uno» con «Uno dos» guardado.
  const src = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  const i = src.indexOf('const guardarAjuste = async');
  const f = src.slice(i, src.indexOf('const probarAcento', i));
  assert.match(f, /const clave = `\$\{pid\}:\$\{claveDe\(a\)\}`;/, 'el turno es POR AJUSTE: el color no espera al título');
  assert.match(f, /const turno = \(turnos\.current\[clave\] \?\? 0\) \+ 1;\s*turnos\.current\[clave\] = turno;/);
  assert.match(f, /const vigente = \(\) => turnos\.current\[clave\] === turno;/);
  // Lo confirmado se anota SIEMPRE (es lo que hay en la base); la pantalla, sólo con el último pedido.
  assert.match(f, /confirmados\.current = \{ \.\.\.confirmados\.current, \[pid\]: conAjuste\(/);
  assert.match(f, /if \(vigente\(\)\) poner\(r\.valor\);/);
  assert.doesNotMatch(f, /\n\s*poner\(r\.valor\);/, 'una respuesta sin turno pisa lo que se está tipeando');
});

test('el nombre de una etapa tiene UN tope, el del editor de etapas del kanban', () => {
  // Desde el 08/10/2026 (D1) el nombre de un MÓDULO —vinculado o suelto— lo valida `nombreDeModulo`
  // (lib/curso-modulos.ts), con el tope del kanban: un suelto que se vincula es una columna.
  const mods = sinComentarios(leer('lib/curso-modulos.ts'));
  assert.match(mods, /import \{[^}]*\bTOPE_NOMBRE_ETAPA\b[^}]*\} from '\.\/servicio-etapas'/);
  assert.match(mods, /if \(nombre\.length > TOPE_NOMBRE_ETAPA\)/);
  for (const r of ['lib/curso-modulos.ts', 'app/customer-success/curso/actions.ts', 'app/customer-success/curso/modulos-actions.ts']) {
    assert.doesNotMatch(sinComentarios(leer(r)), /const TOPE_NOMBRE_ETAPA/, r);
  }
  assert.match(sinComentarios(leer('app/customer-success/EtapasEntregaModal.tsx')), /const MAX_LABEL = TOPE_NOMBRE_ETAPA;/);
});

// ── Lo que se lee del fuente ─────────────────────────────────────────────────

/** El cuerpo de una función exportada, hasta la siguiente. */
const cuerpo = (src: string, nombre: string) => {
  const i = src.indexOf(`export async function ${nombre}(`);
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const j = src.indexOf('\nexport ', i + 10);
  return src.slice(i, j < 0 ? undefined : j);
};

test('las acciones del estilo son de un ADMIN y de un producto PROPIO', () => {
  const src = sinComentarios(leer('app/customer-success/curso/actions.ts'));
  const estilo = cuerpo(src, 'guardarEstiloCursoAction');
  assert.ok(estilo.indexOf('await puedeEditar()') >= 0 && estilo.indexOf('await puedeEditar()') < estilo.indexOf('guardarAjusteEstilo('),
    'el permiso se mira ANTES de escribir');
  assert.match(estilo, /ajusteValido\(ajuste\)/);
  assert.match(estilo, /await productoPropio\(/);
  assert.match(estilo, /claseEsDelProducto\(a\.clase/, 'la portada de una clase se ata a una clase de ESE producto');
  assert.match(cuerpo(src, 'renombrarClaseAction'), /await puedeEditar\(\)[\s\S]*renombrarClase\(/);
  // `renombrarEtapaCursoAction` se fue (08/10/2026): renombrar un módulo vinculado ES renombrar su
  // etapa, y lo hace `renombrarModuloAction` → `renombrarModulo`. No puede volver una segunda puerta.
  assert.doesNotMatch(src, /renombrarEtapaCursoAction/);
});

test('las acciones de los módulos: admin y producto propio ANTES de escribir; renombrar una etapa es estricto y guarda sus fases', () => {
  const acc = sinComentarios(leer('app/customer-success/curso/modulos-actions.ts'));
  const puerta = acc.slice(acc.indexOf('async function puertaProducto('), acc.indexOf('const alKanban'));
  assert.ok(puerta.length > 60 && puerta.length < 400, `el recorte mide ${puerta.length}`);
  assert.match(puerta, /await puedeEditar\(\)[\s\S]*return productoPropio\(Number\(productoId\)\)/);
  const ren = cuerpo(acc, 'renombrarModuloAction');
  assert.ok(ren.indexOf('await puertaProducto(') >= 0 && ren.indexOf('await puertaProducto(') < ren.indexOf('renombrarModulo('), 'el permiso se mira ANTES de escribir');
  const datos = sinComentarios(leer('lib/curso-modulos-datos.ts'));
  const f = cuerpo(datos, 'renombrarModulo');
  assert.match(f, /modulosDelCurso\(productoId, \{ estricta: true \}\)/, 'con la lectura que cae al default se borrarían las etapas reales');
  assert.match(f, /guardarEtapasEntrega\(productoId, etapas, cfg\.fases\)/, 'sin las fases, se les borra el color');
  assert.doesNotMatch(f, /entregaDeProducto\(/);
});

test('renombrar una clase escribe SÓLO el título, nunca la fila entera', () => {
  const src = sinComentarios(leer('lib/curso-admin.ts'));
  const f = cuerpo(src, 'renombrarClase');
  assert.match(f, /\.update\(\{ titulo, updated_at:/);
  assert.doesNotMatch(f, /guardarClase\(|\.upsert\(/);
});

test('un ajuste es un upsert de UNA clave, y volver al default borra la fila', () => {
  const src = sinComentarios(leer('lib/curso-estilo-datos.ts'));
  const f = cuerpo(src, 'guardarAjusteEstilo');
  assert.match(f, /onConflict: 'workspace_id,producto_id,clave'/);
  assert.match(f, /if \(v == null\) \{[\s\S]*?\.delete\(\)/);
});

test('la tabla: una fila por ajuste, sin acceso público, y acotada por inquilino', () => {
  const sql = leer('supabase/migrations/0214_curso_estilo.sql');
  assert.match(sql, /create unique index if not exists curso_estilo_uk on curso_estilo \(workspace_id, producto_id, clave\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on curso_estilo from anon, authenticated/);
  // Sin comentarios y adentro de la lista: un `// 'curso_estilo',` comentado matcheaba igual.
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const i = ws.indexOf('const TENANT_TABLES');
  assert.ok(i >= 0, 'no encontré TENANT_TABLES');
  assert.match(ws.slice(i, ws.indexOf(']', i)), /'curso_estilo'/, 'sin TENANT_TABLES, getTenantDb no acota la tabla');
  const ti = sinComentarios(leer('lib/tablas-de-inquilino.ts'));
  const j = ti.indexOf('export const TABLAS_DE_INQUILINO');
  assert.match(ti.slice(j, ti.indexOf(']', j)), /'curso_estilo'/, 'el reset del cliente de prueba no la vaciaría');
});

test('editando, la portada no es un botón con textos adentro (un clic en el título abriría la clase)', () => {
  const src = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  // La de LECTURA es un botón y no tiene textos que se editen.
  const i = src.indexOf('className="ugc-hero"');
  const boton = src.slice(i, src.indexOf('</button>', i));
  assert.ok(boton.length > 100, 'no encontré la portada de lectura');
  assert.doesNotMatch(boton, /TextoEditable/);
  // La de EDICIÓN: se mira SU etiqueta. La primera versión de este test miraba sólo la de lectura y
  // dejaba pasar un <button className="ugc-hero ugc-hero--edicion"> (revisión del 07/10/2026).
  const e = src.indexOf('className="ugc-hero ugc-hero--edicion"');
  assert.ok(e >= 0, 'no encontré la portada de edición');
  const etiqueta = src.slice(src.lastIndexOf('<', e), e);
  assert.match(etiqueta, /^<div\b/, `la portada de edición es un ${etiqueta.trim()}`);
  assert.ok(src.indexOf('TextoEditable', e) > e, 'los textos de la portada de edición');
});

test('la lámina de cada etapa sigue al acento, con el lima de siempre como respaldo (Conocimientos no cambia)', () => {
  const src = leer('app/conocimientos/PortadaModulo.tsx');
  assert.match(src, /fillVar\('--lamina-brocha', LIMA_BROCHA\)/);
  assert.match(src, /fillVar\('--lamina-sticker', LIMA_STICKER\)/);
});

test('el menú de la marca se usa con el teclado: el foco entra cuando ya está ubicado, y sin el rol que promete flechas', () => {
  const src = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const i = src.indexOf('function MenuMarca(');
  const f = src.slice(i, src.indexOf('export function ItemMenuUgc', i));
  assert.ok(f.length > 300, 'no encontré MenuMarca');
  // Hasta medirse va oculto, y un elemento oculto no recibe el foco: se pide cuando hay posición.
  assert.match(f, /if \(!pos \|\| enfocado\.current\) return;[\s\S]*?\.focus\(\);[\s\S]*?\}, \[pos\]\);/);
  assert.doesNotMatch(f, /role="menu"/);
  assert.doesNotMatch(src, /role="menuitem"/);
  assert.match(src, /aria-controls=\{idMenuMarca\}/);
});
