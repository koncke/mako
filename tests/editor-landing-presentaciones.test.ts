// =============================================================================
// editor-landing-presentaciones — T3 de la tanda 2: presentaciones de diapositivas
// =============================================================================
// Pedido de Martín (11/10/2026, punto 5): «Falta la funcionalidad de crear presentaciones, no
// solo landings... Diapositivas, tal cual como lo hace gamma.» Decisión T3 de
// docs/diseno-editor-landing.md. Lo que estos tests cuidan:
//   · el CONTRATO: `config.formato` / `config.proporcion` (api-tipos.ts) saneados de su lista
//     cerrada (validar.ts) y escritos en la raíz del HTML (render.ts);
//   · la HOJA: la diapositiva con su forma (16:9 · 4:3), el alto como PISO (crece si no entra),
//     la guía de desbordamiento sólo en el editor y la vuelta a fluido en celular, en ese orden;
//   · el PPTX: el tamaño según la proporción y el texto que no entra sin cortarse arriba;
//   · la IA: las reglas de diapositivas llegan a los tres prompts sólo cuando se piden;
//   · las 12 PLANTILLAS: válidas sin un cambio, una idea por diapositiva (poco texto, un diseño
//     optimizado como mucho), sin nombres reales y en español neutro;
//   · y que la pantalla las use (Presentar como botón principal, la forma en Presentar).
// Se lee el fuente SIN comentarios (AGENTS.md: un guard que busca lo que NO tiene que estar se
// acusa a sí mismo por el párrafo que explica por qué no está).
//
// PROBADO ROMPIÉNDOLO (11/10/2026): al pie, con números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto.supabase.co';

import {
  PLANTILLAS_PRESENTACION, CATEGORIAS_PRESENTACION, armarPresentacion, plantillaPresentacionPorId,
  REGLAS_DIAPOSITIVAS_ESQUEMA, REGLAS_DIAPOSITIVAS_SECCIONES, REGLAS_DIAPOSITIVAS_EDITAR,
} from '../lib/editor-landing/plantillas-presentaciones';
import {
  CONFIG_DEFAULT, diapositivaFija, esPresentacion, formatoDe, proporcionDe, relacionDe, terminoTarjeta,
  type ConfigLanding,
} from '../lib/editor-landing/api-tipos';
import { sanearConfig, sanearContenido } from '../lib/editor-landing/validar';
import { REGLAS_PAGINA } from '../lib/editor-landing/ia-reglas';
import { htmlDePagina } from '../lib/editor-landing/render';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { TEMAS, temaPorId } from '../lib/editor-landing/temas';
import { NOMBRES_ICONO } from '../lib/editor-landing/iconos';
import { NODO, parrafo, tarjeta, textoDe, textoDeContenido, titulo, type JsonNodo, type LandingContenido, type Pagina } from '../lib/editor-landing/doc';
import { DIAPO_16x9, DIAPO_4x3, cajasDeDiseno, modeloDiapositiva, tamanoDiapo } from '../lib/editor-landing/exportar-pptx';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function* nodos(n: JsonNodo): Generator<JsonNodo> {
  yield n;
  for (const c of n.content ?? []) yield* nodos(c);
}
const diapositivas = (c: LandingContenido) => c.paginas.flatMap((p) => p.doc.content);
const palabras = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Gente y negocios REALES de este producto (la lista de tests/editor-landing-plantillas.test.ts). */
const REALES = [
  'Mauricio', 'Leila', 'Martín', 'Joan', 'Juan Francisco', 'Brigitte',
  'Código Inmobiliario', 'Negocio que Escala', 'MasteryHaus', 'Vértice', 'AvatarHype',
  'Francisco Ramos', 'Dental Ramos', 'Sergio Esquer', 'BG Trucking', 'Aspro', 'Bustos', 'Koncke',
];

// ─────────────────────────────────────────────────────────────────────────────
// El contrato: formato y proporción
// ─────────────────────────────────────────────────────────────────────────────

test('contrato: sin el campo es una página de 16:9; lo que no está en la lista no pasa (y se dice)', () => {
  assert.equal(CONFIG_DEFAULT.formato, 'pagina');
  assert.equal(CONFIG_DEFAULT.proporcion, '16:9');
  const vieja = sanearConfig({ tema: 'pewter' });
  assert.equal(vieja.config.formato, 'pagina');
  assert.equal(vieja.config.proporcion, '16:9');
  assert.deepEqual(vieja.descartes, []);
  const buena = sanearConfig({ formato: 'presentacion', proporcion: '4:3' });
  assert.equal(buena.config.formato, 'presentacion');
  assert.equal(buena.config.proporcion, '4:3');
  assert.deepEqual(buena.descartes, []);
  const mala = sanearConfig({ formato: 'carrusel', proporcion: '9:16' });
  assert.equal(mala.config.formato, 'pagina');
  assert.equal(mala.config.proporcion, '16:9');
  assert.equal(mala.descartes.length, 2, mala.descartes.join(' · '));
  // Idempotente: lo saneado vuelve igual.
  assert.deepEqual(sanearConfig(buena.config).config, buena.config);
});

test('contrato: las ayudas de la pantalla (término, forma fija, relación)', () => {
  const pres: Partial<ConfigLanding> = { formato: 'presentacion', proporcion: '16:9' };
  assert.equal(formatoDe(null), 'pagina');
  assert.equal(esPresentacion(pres), true);
  assert.equal(terminoTarjeta(pres), 'diapositiva');
  assert.equal(terminoTarjeta(pres, { plural: true, mayuscula: true }), 'Diapositivas');
  assert.equal(terminoTarjeta(CONFIG_DEFAULT, { plural: true }), 'secciones');
  assert.equal(proporcionDe({ proporcion: 'x' }), '16:9');
  assert.equal(diapositivaFija(pres), true);
  assert.equal(diapositivaFija({ formato: 'presentacion', proporcion: 'fluido' }), false);
  assert.equal(diapositivaFija({ formato: 'pagina', proporcion: '4:3' }), false, 'una página nunca tiene forma fija');
  assert.equal(relacionDe({ formato: 'presentacion', proporcion: '4:3' }), 4 / 3);
  assert.equal(relacionDe(pres), 16 / 9);
  assert.equal(relacionDe(CONFIG_DEFAULT), null);
});

test('render: la raíz de una presentación lleva el formato y la proporción; la de una página, no', () => {
  const pagina: Pagina = { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [tarjeta([titulo('Hola', 2), parrafo('Texto')])] } };
  const tema = temaPorId('pewter');
  const raiz = (html: string) => html.slice(0, html.indexOf('>') + 1);
  const pres = raiz(htmlDePagina(pagina, { ...CONFIG_DEFAULT, formato: 'presentacion', proporcion: '4:3' }, tema));
  assert.match(pres, /class="gm-doc"/);
  assert.match(pres, /data-formato="presentacion"/);
  assert.match(pres, /data-proporcion="4:3"/);
  const pag = raiz(htmlDePagina(pagina, CONFIG_DEFAULT, tema));
  assert.doesNotMatch(pag, /data-formato|data-proporcion/);
  // Un valor que no es de la lista no llega al HTML (el render vuelve a sanear).
  const raro = raiz(htmlDePagina(pagina, { ...CONFIG_DEFAULT, formato: 'presentacion', proporcion: '"><script>' as never }, tema));
  assert.match(raro, /data-proporcion="16:9"/);
});

// ─────────────────────────────────────────────────────────────────────────────
// La hoja
// ─────────────────────────────────────────────────────────────────────────────

/** Las reglas de la hoja cuyo selector nombra `parte`, con su posición. */
function reglas(parte: string): { sel: string; decl: string; i: number }[] {
  const out: { sel: string; decl: string; i: number }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS_CONTENIDO))) if (m[1].includes(parte)) out.push({ sel: m[1].trim(), decl: m[2], i: m.index });
  return out;
}

test('hoja: la diapositiva tiene la forma de su proporción y su alto es un PISO (crece si no entra)', () => {
  const r = reglas('[data-formato="presentacion"]');
  const base = r.find((x) => /aspect-ratio:\s*16 \/ 9/.test(x.decl) && x.sel.includes('.gm-tarjeta') && !x.sel.includes('fondo'));
  assert.ok(base, 'falta la regla de 16:9');
  assert.match(base.decl, /min-height:\s*auto/, 'sin min-height:auto un min-height explícito de la hoja le saca el crecimiento');
  assert.match(base.decl, /width:\s*min\(64\.5em/);
  assert.match(base.sel, /:not\(\[data-proporcion="fluido"\]\)/, 'una presentación «Fluida» no tiene forma');
  // Y el padre directo de una raíz suelta también la declara (Presentar, una miniatura).
  assert.match(base.sel, /\[data-formato="presentacion"\]:not\(\[data-proporcion="fluido"\]\) > \.gm-doc \.gm-tarjeta/);
  assert.ok(r.some((x) => /aspect-ratio:\s*4 \/ 3/.test(x.decl) && x.sel.includes('[data-proporcion="4:3"]') && x.sel.includes('.gm-tarjeta')), 'falta 4:3');
  // La letra base de una diapositiva no tiene el piso de 15px de la página (si no, no entra de ancho).
  const letra = r.find((x) => x.sel.includes('.gm-pagina') && /font-size/.test(x.decl) && x.i < base.i);
  assert.ok(letra && !/15px/.test(letra.decl), letra?.decl);
});

test('hoja: la guía de desbordamiento es sólo del editor y queda DEBAJO del límite (recortada si todo entra)', () => {
  const guia = reglas('.gm-tarjeta-fondo::after').filter((x) => x.sel.includes('[data-formato="presentacion"]'));
  assert.ok(guia.length, 'falta la guía');
  for (const g of guia) assert.match(g.sel, /\[data-modo="editor"\]/, `la guía se vería fuera del editor: ${g.sel}`);
  const linea = guia.find((x) => /dashed/.test(x.decl));
  assert.ok(linea && /top:\s*1px/.test(linea.decl), 'la línea va 1px por debajo del límite');
  const caja = guia.find((x) => /aspect-ratio:\s*16 \/ 9/.test(x.decl));
  assert.ok(caja && /box-sizing:\s*content-box/.test(caja.decl), 'con border-box la línea caería ADENTRO de la diapositiva y se vería siempre');
  const recorte = reglas('.gm-tarjeta-fondo').find((x) => x.sel.includes('[data-modo="editor"][data-formato="presentacion"]') && /overflow:\s*hidden/.test(x.decl));
  assert.ok(recorte, 'sin overflow:hidden en el fondo la guía se ve aunque todo entre');
});

test('hoja: en celular la diapositiva vuelve a ser fluida, y esa regla va DESPUÉS (gana con el mismo peso)', () => {
  const desktop = reglas('[data-formato="presentacion"]').find((x) => /aspect-ratio:\s*16 \/ 9/.test(x.decl) && !x.sel.includes('fondo'))!;
  const movil = reglas('[data-formato="presentacion"]').find((x) => /aspect-ratio:\s*auto/.test(x.decl));
  assert.ok(movil, 'falta la vuelta a fluido');
  assert.ok(movil.i > desktop.i, 'la vuelta a fluido va antes que la diapositiva: pierde');
  // Adentro del bloque de celular: después de su `@media` y sin la línea `}` que lo cierra en el medio.
  const antes = CSS_CONTENIDO.slice(0, movil.i);
  const media = antes.lastIndexOf('@media (max-width: 768px) {');
  assert.ok(media > 0 && !antes.slice(media).includes('\n}\n'), 'la vuelta a fluido tiene que estar adentro del bloque de celular');
  // Y la vista previa de celular del editor tiene la suya (el mismo bloque, bajo data-dispositivo).
  assert.ok(reglas('[data-dispositivo="movil"][data-formato="presentacion"]').some((x) => /aspect-ratio:\s*auto/.test(x.decl)));
  // Fluida no hay límite: la guía se apaga en la vista de celular del editor (medido en Chromium:
  // a 400px marcaba 212px sobre una diapositiva de 1055).
  assert.ok(reglas('[data-dispositivo="movil"][data-modo="editor"][data-formato="presentacion"]').some((x) => x.sel.includes('::after') && /display:\s*none/.test(x.decl)));
  assert.match(movil.sel, /:not\(\[data-proporcion="fluido"\]\)/, 'sin el :not pesa menos que la regla de escritorio');
});

// ─────────────────────────────────────────────────────────────────────────────
// El PPTX
// ─────────────────────────────────────────────────────────────────────────────

test('pptx: 4:3 sólo en una presentación de 4:3, y las cajas de 16:9 son las de siempre', () => {
  assert.equal(tamanoDiapo({ formato: 'presentacion', proporcion: '4:3' }), DIAPO_4x3);
  assert.equal(tamanoDiapo({ formato: 'pagina', proporcion: '4:3' }), DIAPO_16x9);
  assert.equal(tamanoDiapo({ formato: 'presentacion', proporcion: 'fluido' }), DIAPO_16x9);
  assert.equal(tamanoDiapo(null).layout, 'LAYOUT_16x9');
  assert.deepEqual(cajasDeDiseno('izquierda'), { imagen: { x: 0, y: 0, w: 3.75, h: 5.625 }, texto: { x: 4.15, y: 0.45, w: 5.25, h: 4.725 } });
  assert.deepEqual(cajasDeDiseno('arriba'), { imagen: { x: 0, y: 0, w: 10, h: 2.1 }, texto: { x: 0.6, y: 2.3, w: 8.8, h: 3 } });
  // En 4:3 la imagen del costado cubre el alto ENTERO y el texto usa el alto que hay.
  const c = cajasDeDiseno('izquierda', DIAPO_4x3);
  assert.equal(c.imagen?.h, 7.5);
  assert.equal(c.texto.h, 6.6);
  for (const lugar of ['arriba', 'izquierda', 'derecha', 'fondo', null] as const) {
    const k = cajasDeDiseno(lugar, DIAPO_4x3);
    assert.ok(k.texto.y + k.texto.h <= 7.5 && k.texto.x + k.texto.w <= 10, `${lugar}: el texto se sale de la diapositiva`);
  }
});

test('pptx: el texto que no entra ni achicado va ARRIBA (centrado se cortaría fuera de la diapositiva)', () => {
  const tema = temaPorId('pewter');
  const corta = modeloDiapositiva({ numero: 1, tarjeta: tarjeta([titulo('Hola', 2), parrafo('Poco texto.')]) }, tema);
  assert.equal(corta.alinear, 'middle');
  const largo = Array.from({ length: 40 }, (_, i) => parrafo(`Párrafo ${i} con bastante texto para que no entre en una diapositiva ni achicado a la mitad del tamaño.`));
  const larga = modeloDiapositiva({ numero: 2, tarjeta: tarjeta([titulo('Mucho', 2), ...largo]) }, tema);
  assert.equal(larga.alinear, 'top');
  // Y en 4:3 la caja de texto es más alta que en 16:9.
  const en43 = modeloDiapositiva({ numero: 1, tarjeta: tarjeta([titulo('Hola', 2)]) }, tema, DIAPO_4x3);
  assert.ok(en43.cajaTexto.h > corta.cajaTexto.h);
});

// ─────────────────────────────────────────────────────────────────────────────
// La IA
// ─────────────────────────────────────────────────────────────────────────────

test('ia: las reglas de diapositivas llegan a esquema, secciones y editar, sólo con formato presentación', () => {
  const src = sinComentarios(leer('lib/editor-landing/ia.ts'));
  assert.match(src, /const esDiapositivas = \(params: unknown\): boolean =>\s*!!params && typeof params === 'object' && \(params as \{ formato\?: unknown \}\)\.formato === 'presentacion'/);
  const cuerpo = (nombre: string) => {
    const ini = src.indexOf(`export async function ${nombre}(`);
    const fin = src.indexOf('export async function', ini + 10);
    assert.ok(ini > 0, nombre);
    return src.slice(ini, fin > 0 ? fin : undefined);
  };
  const esq = cuerpo('esquema');
  assert.match(esq, /const diapos = esDiapositivas\(p\.params\)/, 'se lee del pedido CRUDO: normalizarParams no conoce el campo');
  // Integración (12/10/2026, feedback de una prueba: «te lo creó tipo presentación diapositiva»):
  // sin formato presentación, lo que viaja en ese mismo lugar es REGLAS_PAGINA (ia-reglas.ts).
  // Probado rompiéndolo: las secciones con la forma vieja (`: ''`, sin REGLAS_PAGINA) → 16 / 1.
  assert.match(esq, /ajustes: ajustesAutoritativos\(params, cantidad\) \+ `\\n\$\{diapos \? REGLAS_DIAPOSITIVAS_ESQUEMA : REGLAS_PAGINA\}`/);
  const sec = cuerpo('secciones');
  assert.match(sec, /const diapos = esDiapositivas\(p\.params\)/);
  assert.match(sec, /ajustes: ajustesAutoritativos\(params, esq\.secciones\.length\) \+ `\\n\$\{diapos \? REGLAS_DIAPOSITIVAS_SECCIONES : REGLAS_PAGINA\}`/);
  const ed = cuerpo('editar');
  assert.match(ed, /`\\n\$\{esDiapositivas\(p\.params\) \? REGLAS_DIAPOSITIVAS_EDITAR : REGLAS_PAGINA\}`/);
  // Lo que dicen: una idea por diapositiva, poco texto, diseños optimizados.
  assert.match(REGLAS_DIAPOSITIVAS_ESQUEMA, /una sola idea por diapositiva/i);
  assert.match(REGLAS_DIAPOSITIVAS_SECCIONES, /poco texto/i);
  assert.match(REGLAS_DIAPOSITIVAS_SECCIONES, /diseños optimizados/i);
  assert.match(REGLAS_DIAPOSITIVAS_EDITAR, /diapositiva/);
  // Y la de una landing dice que es UNA página de corrido, no diapositivas.
  assert.match(REGLAS_PAGINA, /LANDING/);
  assert.match(REGLAS_PAGINA, /NO es una presentación/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Las plantillas
// ─────────────────────────────────────────────────────────────────────────────

test('plantillas: 12 presentaciones con id único, categoría de la lista, tema que existe y formato de presentación', () => {
  assert.equal(PLANTILLAS_PRESENTACION.length, 12);
  assert.equal(new Set(PLANTILLAS_PRESENTACION.map((p) => p.id)).size, 12);
  const temas = new Set(TEMAS.map((t) => t.id));
  for (const p of PLANTILLAS_PRESENTACION) {
    assert.ok((CATEGORIAS_PRESENTACION as readonly string[]).includes(p.categoria), p.id);
    assert.ok(temas.has(p.tema), `${p.id}: tema «${p.tema}» no existe`);
    assert.equal(p.formato, 'presentacion', p.id);
    assert.equal(sanearConfig({ formato: p.formato, proporcion: p.proporcion }).descartes.length, 0, p.id);
    assert.ok(p.nombre && p.descripcion.length <= 80, p.id);
    assert.equal(plantillaPresentacionPorId(p.id), p);
  }
});

test('plantillas: pasan el saneo del server SIN UN CAMBIO, la conversión no corrigió nada, una página y un solo Título', () => {
  for (const p of PLANTILLAS_PRESENTACION) {
    const { contenido: c, descartes } = armarPresentacion(p);
    assert.deepEqual(descartes, [], `${p.id}: la conversión corrigió algo`);
    const saneo = sanearContenido(c);
    assert.deepEqual(saneo.descartes, [], `${p.id}: el saneo tiró algo`);
    assert.deepEqual(saneo.contenido, c, `${p.id}: el saneo cambió algo`);
    assert.equal(c.paginas.length, 1, `${p.id}: una presentación es una página`);
    const n = diapositivas(c).length;
    assert.ok(n >= 7 && n <= 10, `${p.id}: ${n} diapositivas`);
    const titulos = diapositivas(c).flatMap((t) => [...nodos(t)]).filter((x) => x.type === 'heading' && x.attrs?.variante === 'titulo');
    assert.equal(titulos.length, 1, `${p.id}: ${titulos.length} títulos`);
  }
});

test('plantillas: una idea por diapositiva — poco texto suelto, un diseño optimizado como mucho, nada de formularios', () => {
  const sueltos = new Set(['paragraph', 'bulletList', 'orderedList', 'taskList', 'blockquote']);
  for (const p of PLANTILLAS_PRESENTACION) {
    diapositivas(p.contenido()).forEach((t, k) => {
      const donde = `${p.id} / diapositiva ${k + 1}`;
      const hijos = t.content ?? [];
      const optimizados = hijos.filter((h) => h.type === NODO.optimizado);
      assert.ok(optimizados.length <= 1, `${donde}: ${optimizados.length} diseños optimizados`);
      for (const o of optimizados) assert.ok((o.content ?? []).length <= 6, `${donde}: ${(o.content ?? []).length} ítems`);
      const texto = hijos.filter((h) => sueltos.has(h.type)).map((h) => textoDe(h)).join(' ');
      assert.ok(palabras(texto) <= 40, `${donde}: ${palabras(texto)} palabras sueltas`);
      for (const n of [...nodos(t)]) {
        assert.notEqual(n.type, NODO.formulario, `${donde}: formulario`);
        assert.notEqual(n.type, NODO.desplegable, `${donde}: desplegable`);
        assert.notEqual(n.type, NODO.imagen, `${donde}: una imagen de bloque necesita src`);
        if (n.type === NODO.tarjeta || n.type === NODO.optimizadoItem) assert.equal(n.attrs?.imagenSrc, null, `${donde}: imagen cargada`);
      }
    });
  }
});

test('plantillas: los diseños «con íconos» tienen un ícono del set en cada ítem', () => {
  const set = new Set(NOMBRES_ICONO);
  const conIcono = new Set(['vinetas-iconos', 'cajas-iconos', 'etapas-iconos', 'iconos-texto', 'iconos-izquierda', 'iconos-grandes']);
  for (const p of PLANTILLAS_PRESENTACION) {
    for (const n of diapositivas(p.contenido()).flatMap((t) => [...nodos(t)])) {
      if (n.type === NODO.optimizado && conIcono.has(String(n.attrs?.variante))) {
        for (const it of n.content ?? []) assert.ok(set.has(String(it.attrs?.icono)), `${p.id}: «${textoDe(it).slice(0, 30)}» sin ícono`);
      }
    }
  }
});

test('plantillas: dos presentaciones de la misma plantilla no comparten ids', () => {
  for (const p of PLANTILLAS_PRESENTACION) {
    const ids = (c: LandingContenido) => [...c.paginas.map((x) => x.id), ...diapositivas(c).map((t) => String(t.attrs?.id))];
    const a = ids(p.contenido());
    const b = ids(p.contenido());
    assert.equal(new Set(a).size, a.length, `${p.id}: ids repetidos adentro`);
    assert.equal(a.filter((x) => b.includes(x)).length, 0, `${p.id}: dos llamadas comparten ids`);
  }
});

/** Todo lo que se dibuja o se le pega a la IA, incluidas las notas del orador. */
const textos = () => [
  ...PLANTILLAS_PRESENTACION.flatMap((p) => {
    const c = p.contenido();
    return [p.nombre, p.descripcion, textoDeContenido(c), ...diapositivas(c).map((t) => String(t.attrs?.notas ?? ''))];
  }),
  REGLAS_DIAPOSITIVAS_ESQUEMA, REGLAS_DIAPOSITIVAS_SECCIONES, REGLAS_DIAPOSITIVAS_EDITAR,
];

test('plantillas: ningún nombre real, ni en el fuente ni en lo que se dibuja (notas incluidas)', () => {
  const fuente = sinAcentos(sinComentarios(leer('lib/editor-landing/plantillas-presentaciones.ts')));
  const dibujado = sinAcentos(textos().join('\n'));
  for (const nombre of REALES) {
    const n = sinAcentos(nombre);
    assert.equal(fuente.includes(n), false, `«${nombre}» en plantillas-presentaciones.ts`);
    assert.equal(dibujado.includes(n), false, `«${nombre}» en una presentación`);
  }
});

test('plantillas: español neutro (tú), con el detector completo del guard del repo', () => {
  const t = textos();
  assert.deepEqual(t.flatMap((x) => marcasDeVoseo(x)), []);
  // `marcasDeVoseo` no ve los imperativos («Mostrá»): corre además `voseoEn` en otro proceso
  // (el mismo camino que tests/editor-landing-plantillas.test.ts).
  const guard = pathToFileURL(join(RAIZ, 'tests/puente-panel-copy.test.ts')).href;
  const script = `import { readFileSync } from 'node:fs'; import { voseoEn } from ${JSON.stringify(guard)}; const t = JSON.parse(readFileSync(0, 'utf8')); console.log('VOSEO' + JSON.stringify(t.flatMap((x) => voseoEn(x).map((h) => h.forma)))); process.exit(0);`;
  const salida = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: RAIZ, input: JSON.stringify(t), encoding: 'utf8' });
  const linea = salida.split('\n').find((l) => l.startsWith('VOSEO'));
  assert.ok(linea, `el detector no contestó: ${salida.slice(0, 300)}`);
  assert.deepEqual(JSON.parse(linea.slice(5)), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla (fuente)
// ─────────────────────────────────────────────────────────────────────────────

test('pantalla: en una presentación Presentar es el botón principal, y el lienzo y Presentar llevan la forma', () => {
  const ed = sinComentarios(leer('app/landing-generator/editor/EditorLanding.tsx'));
  const partido = ed.slice(ed.indexOf('<div className="gma-partido">'), ed.indexOf('aria-label={presentacion ? \'Más opciones\''));
  assert.ok(partido.length > 100 && partido.length < 1500, `recorte del botón partido: ${partido.length}`);
  assert.match(partido, /\{presentacion \? \(\s*<button[^>]*onClick=\{\(\) => setDialogo\('presentar'\)\}>\s*<Ico n="presentar"[^>]*\/> Presentar/);
  assert.match(ed, /data-formato=\{presentacion \? 'presentacion' : undefined\}/);
  assert.match(ed, /baseDelLienzo\(dispositivo, zoom, fija \? \{ ancho: anchoLienzo \} : null\)/);
  const pr = sinComentarios(leer('app/landing-generator/editor/Presentar.tsx'));
  assert.match(pr, /data-fija=\{forma\.relacion \? forma\.proporcion : undefined\}/);
  assert.match(pr, /if \(relacion\) \{[\s\S]{0,400}?encajar\(sec\)/, 'Presentar no encaja el contenido en la diapositiva fija');
  assert.match(pr, /\.gma-pr \.gma-pr-lienzo\[data-fija\] \.gm-doc \.gm-tarjeta\{[^}]*min-height:0;overflow:hidden/);
  const conf = sinComentarios(leer('app/landing-generator/editor/dialogos/DialogoConfiguracion.tsx'));
  assert.match(conf, /\{fija \? null : \(\s*<Campo etiqueta="Ancho de las secciones">/, 'con forma fija el ancho no cambia nada y no se ofrece');
  assert.match(conf, /<Campo etiqueta="Relación de aspecto">/);
  // El PPTX toma la proporción de la configuración que DialogoExportar ya le pasa.
  assert.match(sinComentarios(leer('lib/editor-landing/exportar-pptx.ts')), /const tam = tamanoDiapo\(op\.config\);\s*pptx\.layout = tam\.layout;/);
});

// ── PROBADO ROMPIÉNDOLO (11/10/2026) ──────────────────────────────────────────
// scratchpad/pres/romper.mjs: rompe en el disco, corre este archivo y restaura por reemplazo
// quirúrgico (respeta lo que otra sesión edite en el medio), sin git. Base: 17 pasan, 0 fallan.
//   · validar.ts sin `formato` en la config ................... 2 fallos (contrato, render)
//   · render.ts sin `data-formato` en la raíz ................. 1 fallo (render)
//   · css.ts: la diapositiva sin `min-height: auto` ........... 1 fallo (hoja: forma)
//   · css.ts: la guía con `border-box` ........................ 1 fallo (hoja: guía)
//   · css.ts: la guía también fuera del editor ................ 1 fallo (hoja: guía)
//   · css.ts: 15b DESPUÉS de lo responsive .................... 1 fallo (hoja: celular)
//   · pptx: el texto que no entra, centrado ................... 1 fallo (pptx: arriba)
//   · pptx: la imagen del costado con el alto de 16:9 en 4:3 .. 1 fallo (pptx: tamaños)
//   · ia.ts: secciones sin las reglas de diapositivas ......... 1 fallo (ia)
//   · ia.ts: el formato leído de los params NORMALIZADOS ...... 1 fallo (ia): normalizarParams
//     no conoce el campo, así que así las reglas no llegarían nunca
//   · plantillas: «Mauricio» en vez de «[Nombre]» ............. 1 fallo (nombres reales)
//   · plantillas: «Mostrá» en una nota del orador ............. 1 fallo (neutro; `marcasDeVoseo`
//     sola no lo ve: lo caza `voseoEn`)
//   · plantillas: dos diseños optimizados en una diapositiva .. 1 fallo (una idea)
//   · plantillas: un párrafo largo (> 40 palabras) ............ 1 fallo (una idea)
//   · plantillas: una variante mal escrita ('embudox') ........ 1 fallo (saneo / descartes)
//   · EditorLanding: Publicar como principal en presentación .. 1 fallo (pantalla)
//   · Presentar sin `encajar` ................................. 1 fallo (pantalla)
//   · Configuración: «Ancho de las secciones» con forma fija .. 1 fallo (pantalla)
