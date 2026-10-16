// =============================================================================
// tests/editor-landing-panel-animacion.test.ts — el panel «Animar» del Web Generator y la animación EN EL EDITOR
// =============================================================================
// Pedido de Martín (14/10/2026): «las dos cosas» — animaciones de página y video de fondo. Decidido el 15/10: el
// panel se copia del de animaciones del Image Editor (AnimatePanel/AnimateThumb) y de la ayuda de Canva; un estilo
// para la landing y un efecto por sección; cada efecto se reproduce solo al pasar el mouse. Esto fija lo que el
// paquete del PANEL construye sobre el contrato (lib/editor-landing/animaciones.ts) y la hoja (css.ts, bloque 16):
//   · las secciones del EDITOR llevan los mismos data-* que el render (un plugin de decoraciones que sigue al
//     documento y a la config, y que una página abierta con un EditorState nuevo no pierde);
//   · lo que el panel muestra y escribe (heredar, «ninguna», la dirección que se conserva o se cae);
//   · cada tile y cada estilo tienen su regla de `.gm-reproducir` en la hoja (la tile usa la MISMA hoja);
//   · reproducir: sacar, reflow, poner; el timer de fin; repetir con el mouse encima; el ▶ al entrar en pantalla con
//     el umbral de la publicada;
//   · «reducir movimiento»: lo que se mueve solo lo mira; el ▶ no;
//   · el cableado: la barra, el menú de la sección, el montaje con onCerrar fijo, el póster del video de fondo.
//
// ── Roturas (15/10/2026; base en verde: 14 pasan, 0 fallan). Arnés del scratchpad de la corrida (romper.mjs): lee
//    el archivo, reemplaza UNA ocurrencia exacta, corre, lo reescribe desde memoria y verifica el hash (las 20
//    corridas, restauradas). pasan / fallan:
//   · el `init` del plugin arranca con el default y no con la última config ............... 13 / 1 (el plugin)
//   · la oculta corre el índice del «alterna» ................................... 12 / 2 (render y plugin)
//   · la config al plugin sin `preventUpdate` ....................................... 13 / 1 (el plugin)
//   · sacar y poner `gm-reproducir` sin el reflow ................................ 12 / 2 (una vez, repetir)
//   · una reproducción nueva no corta la anterior del mismo elemento ................ 13 / 1 (una vez)
//   · el fin sin el margen ........................................................... 13 / 1 (una vez)
//   · el ▶ con otro umbral que el de la publicada (0,15) ............................. 13 / 1 (el ▶)
//   · elegir otro efecto tira la dirección aunque la ofrezca ......................... 13 / 1 (el panel)
//   · la tile de un efecto ignora la dirección elegida ............................... 13 / 1 (cada tile)
//   · el efecto elegido se reproduce con «reducir movimiento» ........................ 13 / 1 (reducir)
//   · el ▶ se calla con «reducir movimiento» ......................................... 13 / 1 (reducir)
//   · la tile se mueve con «reducir movimiento» ...................................... 13 / 1 (reducir)
//   · «Quitar animación» → «Eliminar animación» ...................................... 13 / 1 (los textos)
//   · sin el plugin en `extensionesLanding` .......................................... 13 / 1 (el cableado)
//   · el panel montado con una flecha nueva por render ............................... 13 / 1 (el cableado)
//   · el hero con video dibuja la imagen y no el póster .............................. 13 / 1 (el cableado)
//   · `escribir` sin `closeHistory` ................................................... 13 / 1 (escribe)
//   · y el guard del repo (tests/puente-panel-copy.test.ts, base 9 / 0): «Seleccioná» en el estado vacío 8 / 1;
//     «Pasá el cursor» en la tile 8 / 1. ⚠️ «Elegí una sección… animá» pasó 9 / 0: el guard no genera el
//     imperativo de los -ir regulares (es igual al pretérito: «la elegí») ni conoce «animar». No era que no viera
//     los archivos nuevos (los ve con `git add -N`).
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSchema } from '@tiptap/core';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import {
  EFECTOS, ESTILOS_PAGINA, GRUPOS_EFECTO, SIN_ANIMACION, duracionTotalMs, type DefEfecto,
} from '../lib/editor-landing/animaciones';
import { htmlDePagina } from '../lib/editor-landing/render';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { docPagina, parrafo, tarjeta, titulo, type AttrsTarjeta, type JsonNodo, type Pagina } from '../lib/editor-landing/doc';
import { temaPorId } from '../lib/editor-landing/temas';
import { SCRIPT_PAGINA } from '../lib/editor-landing/pagina-publica';
import { extensionesBase } from '../app/web-generator/editor/extensiones/esquema';
import { animationStrings } from '../app/image-editor/_doory/editor/animation/strings';
import {
  BLOQUES_TILE, CLASE_REPRODUCIR, CLAVE_ANIMACION, DIRECCION_UI, ENTRADA_EN_PANTALLA, GRILLA, MARGEN_FIN_MS, PAUSA_ENTRE_VUELTAS_MS, PIEZAS_TILE,
  cambiosAlElegir, cambiosDeDireccion, datosDeSecciones, datosDeTile, duracionDeVista, pideMenosMovimiento,
  pluginAnimacionSecciones, ponerAnimacionDePagina, repetirMientras, reproducirPagina, reproducirUnaVez, vistaDeSeccion,
  type ObservadorCtor, type Reloj, type SeccionDom,
} from '../app/web-generator/editor/animacion-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario primero y los bloques después (como tests/editor-landing-armazon.test.ts). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El texto entre `desde` y `hasta` (el bloque real, no N caracteres a ojo). */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

const tema = temaPorId('pewter');
const cfg = (pagina: Partial<ConfigLanding['pagina']> & Record<string, unknown>): ConfigLanding =>
  ({ ...CONFIG_DEFAULT, pagina: { ...CONFIG_DEFAULT.pagina, ...pagina } as ConfigLanding['pagina'] });
const sec = (id: string, attrs: Partial<AttrsTarjeta> | Record<string, unknown> = {}) =>
  tarjeta([titulo(`Título ${id}`, 2), parrafo(`Texto ${id}`)], { ...(attrs as Partial<AttrsTarjeta>), id });
const SECCIONES: JsonNodo[] = [
  sec('s0'),
  sec('s1', { oculta: true }),
  sec('s2'),
  sec('s3', { animacion: 'iris' }),
  sec('s4', { animacion: 'ninguna' }),
  sec('s5', { animacion: 'barrido', animacionDireccion: 'abajo' }),
  sec('s6'),
];
const PAGINA: Pagina = { id: 'p1', titulo: 'Inicio', ruta: '', doc: docPagina(SECCIONES) };
const DATOS = ['data-anim', 'data-anim-dir', 'data-anim-texto'] as const;

/** Los data-* de animación de cada `<section>` del HTML, por id. */
function datosDelHtml(html: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const m of html.matchAll(/<section\b([^>]*)>/g)) {
    const a: Record<string, string> = {};
    for (const x of m[1].matchAll(/([a-z-]+)="([^"]*)"/g)) a[x[1]] = x[2];
    const d: Record<string, string> = {};
    for (const k of DATOS) if (a[k]) d[k] = a[k];
    out.set((a.id ?? '').replace(/^t-/, ''), d);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Los data-* de las secciones del editor
// ─────────────────────────────────────────────────────────────────────────────

test('las secciones del editor llevan EXACTAMENTE los data-* del render (la oculta no corre el «alterna»)', () => {
  const paginas: Partial<ConfigLanding['pagina']>[] = [
    { estiloAnimacion: 'deslizar' }, { estiloAnimacion: 'palabras' }, { estiloAnimacion: 'subir' }, { animaciones: false, estiloAnimacion: 'deslizar' },
  ];
  for (const pagina of paginas) {
    const html = datosDelHtml(htmlDePagina(PAGINA, cfg(pagina), tema, { modo: 'miniatura', incluirOcultas: true }));
    const c = cfg(pagina).pagina;
    const editor = datosDeSecciones(SECCIONES.map((s) => s.attrs ?? {}), c);
    SECCIONES.forEach((s, i) => assert.deepEqual(editor[i], html.get(String(s.attrs?.id)), `${JSON.stringify(pagina)} · ${String(s.attrs?.id)}`));
  }
  const d = datosDeSecciones(SECCIONES.map((s) => s.attrs ?? {}), { animaciones: true, estiloAnimacion: 'deslizar' });
  assert.deepEqual([d[0], d[1], d[2]].map((x) => x['data-anim-dir']), ['izquierda', 'derecha', 'derecha'], 's1 (oculta) toma el lugar de s2 y no lo corre');
});

/** Un estado de ProseMirror con el plugin, y una vista de mentira que aplica lo que se despacha. */
function vistaDePrueba(tarjetas: JsonNodo[]) {
  const schema = getSchema(extensionesBase());
  const plugin = pluginAnimacionSecciones();
  const vista = {
    state: EditorState.create({ schema, doc: schema.nodeFromJSON(docPagina(tarjetas)), plugins: [plugin] }),
    despachadas: [] as Transaction[],
    dispatch(tr: Transaction) { this.despachadas.push(tr); this.state = this.state.apply(tr); },
  };
  /** Los data-* de la decoración de cada sección, por id. */
  const decos = (st: EditorState = vista.state) => {
    const out: Record<string, Record<string, string>> = {};
    for (const d of CLAVE_ANIMACION.getState(st)?.deco.find() ?? []) {
      out[String(st.doc.nodeAt(d.from)?.attrs.id)] = { ...(d as unknown as { type: { attrs: Record<string, string> } }).type.attrs };
    }
    return out;
  };
  return { schema, plugin, vista, decos };
}

test('el plugin: decoraciones con los data-*, la config por meta fuera del historial, y una página nueva la conserva', () => {
  const { schema, plugin, vista, decos } = vistaDePrueba(SECCIONES);
  // Sin config, el default (el estilo de siempre: «Subir»).
  assert.deepEqual(decos()['s0'], { 'data-anim': 'subir' });
  assert.deepEqual(decos()['s4'], { 'data-anim': 'ninguna' });
  assert.equal(ponerAnimacionDePagina(vista, { animaciones: true, estiloAnimacion: 'deslizar' }), true);
  const tr = vista.despachadas[vista.despachadas.length - 1];
  assert.equal(tr?.getMeta('addToHistory'), false, 'un cambio de config no es un paso de Ctrl+Z del documento');
  assert.equal(tr?.getMeta('preventUpdate'), true, 'sin esto el autoguardado marcaría «sin guardar»');
  assert.deepEqual([decos()['s0'], decos()['s2']], [{ 'data-anim': 'deslizar', 'data-anim-dir': 'izquierda' }, { 'data-anim': 'deslizar', 'data-anim-dir': 'derecha' }]);
  assert.equal(ponerAnimacionDePagina(vista, { animaciones: true, estiloAnimacion: 'deslizar' }), false, 'la misma config no despacha');
  // Una sección nueva ARRIBA corre el «alterna» de las de abajo (sus nodos no cambiaron: el NodeView no se enteraría).
  vista.dispatch(vista.state.tr.insert(0, schema.nodeFromJSON(sec('nueva'))));
  assert.equal(decos()['s0']['data-anim-dir'], 'derecha', 's0 ahora es la segunda visible');
  // El armazón abre cada página con un EditorState NUEVO y los mismos plugins: arranca con la config de la landing.
  const otra = EditorState.create({ schema, doc: schema.nodeFromJSON(docPagina([sec('a'), sec('b')])), plugins: [plugin] });
  assert.deepEqual(decos(otra)['b'], { 'data-anim': 'deslizar', 'data-anim-dir': 'derecha' }, 'la página abierta después perdió el estilo');
  // El interruptor apagado: ninguna decoración (tampoco «ninguna»).
  ponerAnimacionDePagina(vista, { animaciones: false, estiloAnimacion: 'deslizar' });
  assert.deepEqual(decos(), {});
  // Un estilo que no está en el catálogo cae al de siempre (como el saneo del server).
  ponerAnimacionDePagina(vista, { animaciones: true, estiloAnimacion: 'tornado' });
  assert.deepEqual(decos()['s0'], { 'data-anim': 'subir' });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lo que el panel muestra y escribe
// ─────────────────────────────────────────────────────────────────────────────

test('el panel: heredar, un efecto propio con su dirección, «ninguna», y lo que escribe cada gesto', () => {
  const pag = { animaciones: true, estiloAnimacion: 'palabras' };
  assert.deepEqual(vistaDeSeccion({}, pag), { elegido: null, direcciones: [], direccion: null, estiloPagina: 'Palabras' });
  assert.deepEqual(vistaDeSeccion({ animacion: 'deslizar', animacionDireccion: 'abajo' }, pag).direccion, 'abajo');
  assert.deepEqual(vistaDeSeccion({ animacion: 'deslizar' }, pag).direccion, 'izquierda', 'sin dirección guardada, la de default del efecto');
  assert.deepEqual(vistaDeSeccion({ animacion: 'iris', animacionDireccion: 'abajo' }, pag).direcciones, [], 'Iris no ofrece dirección');
  assert.equal(vistaDeSeccion({ animacion: SIN_ANIMACION }, pag).elegido, SIN_ANIMACION);
  assert.equal(vistaDeSeccion({ animacion: 'tornado' }, pag).elegido, null, 'lo que no es del catálogo se lee como heredar');
  // Elegir: la dirección se conserva si el efecto nuevo la ofrece; si no, null (la de default).
  assert.deepEqual(cambiosAlElegir('barrido', { animacionDireccion: 'abajo' }), { animacion: 'barrido', animacionDireccion: 'abajo' });
  assert.deepEqual(cambiosAlElegir('iris', { animacionDireccion: 'abajo' }), { animacion: 'iris', animacionDireccion: null });
  assert.deepEqual(cambiosAlElegir(SIN_ANIMACION, { animacionDireccion: 'abajo' }), { animacion: SIN_ANIMACION, animacionDireccion: null });
  assert.deepEqual(cambiosAlElegir(null, { animacionDireccion: 'abajo' }), { animacion: null, animacionDireccion: null }, '«Quitar animación» vuelve a heredar');
  assert.deepEqual(cambiosAlElegir('tornado', {}), { animacion: null, animacionDireccion: null });
  assert.deepEqual(cambiosDeDireccion('arriba', { animacion: 'deslizar' }), { animacionDireccion: 'arriba' });
  assert.equal(cambiosDeDireccion('arriba', { animacion: 'iris' }), null, 'un efecto sin direcciones no recibe una');
  assert.equal(cambiosDeDireccion('diagonal', { animacion: 'deslizar' }), null);
  // Las flechas apuntan hacia donde VIAJA el bloque (AnimateSettings.tsx: «desde la izquierda» → flecha a la derecha).
  assert.deepEqual(Object.fromEntries(Object.entries(DIRECCION_UI).map(([k, v]) => [k, v.icono])),
    { izquierda: 'flecha-derecha', derecha: 'flecha-izquierda', arriba: 'flecha-abajo', abajo: 'flecha-arriba' });
  for (const [k, v] of Object.entries(DIRECCION_UI)) {
    const ingles = { izquierda: 'left', derecha: 'right', arriba: 'up', abajo: 'down' }[k] as 'left';
    assert.equal(v.nombre, animationStrings.panel.directionFrom[ingles], `el nombre de «${k}» es el del Image Editor`);
  }
});

test('la grilla: los cuatro grupos del Image Editor con los 17 efectos, cada uno una vez', () => {
  assert.deepEqual(GRILLA.map((g) => g.nombre), ['Básicas', 'Movimiento', 'Revelar', 'Intensas']);
  assert.deepEqual(GRILLA.map((g) => g.nombre), [animationStrings.panel.groups.basic, animationStrings.panel.groups.motion, animationStrings.panel.groups.reveal, animationStrings.panel.groups.bold]);
  assert.deepEqual(GRILLA.map((g) => g.id), GRUPOS_EFECTO.map((g) => g.id));
  const ids = GRILLA.flatMap((g) => g.efectos.map((e) => e.id));
  assert.deepEqual([...ids].sort(), (EFECTOS as readonly DefEfecto[]).map((e) => e.id).sort());
  assert.equal(new Set(ids).size, 17);
});

// ─────────────────────────────────────────────────────────────────────────────
// La tile: la MISMA hoja que la publicada
// ─────────────────────────────────────────────────────────────────────────────

test('cada tile (17 efectos con sus direcciones, «Ninguna» y los 8 estilos) tiene su regla de .gm-reproducir en la hoja', () => {
  const hoja = CSS_CONTENIDO.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglaDe = (d: Record<string, string | undefined>) => {
    let sel = `.gm-doc .gm-tarjeta[data-anim="${d['data-anim']}"]`;
    if (d['data-anim-dir']) sel += `[data-anim-dir="${d['data-anim-dir']}"]`;
    return `${sel}.gm-reproducir > .gm-tarjeta-cuerpo > :nth-child(${BLOQUES_TILE})`;
  };
  let n = 0;
  for (const e of EFECTOS as readonly DefEfecto[]) {
    for (const dir of e.direcciones ?? [null]) {
      const d = datosDeTile({ tipo: 'efecto', efecto: e.id as never, direccion: dir });
      assert.equal(d['data-anim-dir'] ?? null, dir, `la tile de ${e.id} muestra otra dirección que la elegida`);
      assert.ok(hoja.includes(reglaDe(d)), `la tile de ${e.id} ${dir ?? ''} no tiene regla: ${reglaDe(d)}`);
      assert.ok(duracionDeVista(d, BLOQUES_TILE) > 0);
      n++;
    }
  }
  assert.equal(n, 23);
  assert.deepEqual(datosDeTile({ tipo: 'efecto', efecto: SIN_ANIMACION }), { 'data-anim': 'ninguna' });
  assert.equal(duracionDeVista({ 'data-anim': 'ninguna' }, BLOQUES_TILE), 0, '«Ninguna» no se mueve');
  for (const s of ESTILOS_PAGINA) {
    const d = datosDeTile({ tipo: 'estilo', estilo: s.id });
    assert.ok(hoja.includes(reglaDe(d)), `el estilo ${s.id} no tiene regla: ${reglaDe(d)}`);
    if (d['data-anim-texto']) {
      assert.ok(hoja.includes(`.gm-doc .gm-tarjeta[data-anim-texto="${d['data-anim-texto']}"].gm-reproducir .gm-u`), `el título partido de ${s.id}`);
    }
  }
  assert.deepEqual(datosDeTile({ tipo: 'estilo', estilo: 'deslizar' }), { 'data-anim': 'deslizar', 'data-anim-dir': 'izquierda' });
});

test('la duración de una vista previa: la del contrato, y la del título partido si tarda más', () => {
  assert.equal(duracionDeVista({ 'data-anim': 'subir' }, 4), duracionTotalMs('subir', 4));
  assert.equal(duracionDeVista({ 'data-anim': 'subir' }, 4), 150 + 3 * 80 + 1000);
  // «Máquina de escribir»: 9 letras de Desvanecer cada 35 ms (150 + 8 × 35 + 700 = 1130) le ganan a los bloques (1090).
  assert.equal(duracionDeVista({ 'data-anim': 'desvanecer', 'data-anim-texto': 'letra' }, BLOQUES_TILE, PIEZAS_TILE.letra), 1130);
  // «Palabras»: 3 palabras de Subir cada 90 ms (150 + 2 × 90 + 1000 = 1330).
  assert.equal(duracionDeVista({ 'data-anim': 'desvanecer', 'data-anim-texto': 'palabra' }, BLOQUES_TILE, PIEZAS_TILE.palabra), 1330);
  assert.equal(duracionDeVista({}, 4), 0);
  assert.equal(duracionDeVista({ 'data-anim': 'tornado' }, 4), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reproducir
// ─────────────────────────────────────────────────────────────────────────────

/** Un elemento de mentira que anota cada paso (sacar, reflow, poner) y un reloj que se avanza a mano. */
function elemento(nombre = 'el', datos: Record<string, string> = {}, bloques = 3) {
  const pasos: string[] = [];
  const clases = new Set<string>();
  const el = {
    pasos,
    clases,
    classList: {
      add: (c: string) => { pasos.push(`+${c}`); clases.add(c); },
      remove: (c: string) => { pasos.push(`-${c}`); clases.delete(c); },
    },
    get offsetWidth() { pasos.push('reflow'); return 100; },
    getAttribute: (k: string) => datos[k] ?? null,
    children: [{ classList: { contains: (c: string) => c === 'gm-tarjeta-cuerpo' }, children: { length: bloques } }],
    nombre,
  };
  return el as typeof el & SeccionDom;
}
function relojDePrueba() {
  let ahora = 0;
  let id = 0;
  const pendientes = new Map<number, { en: number; f: () => void }>();
  const reloj: Reloj = {
    poner: (f, ms) => { pendientes.set(++id, { en: ahora + ms, f }); return id; },
    sacar: (t) => { pendientes.delete(t as number); },
  };
  const avanzar = (ms: number) => {
    const hasta = ahora + ms;
    for (;;) {
      const prox = [...pendientes.entries()].filter(([, p]) => p.en <= hasta).sort((a, b) => a[1].en - b[1].en)[0];
      if (!prox) break;
      pendientes.delete(prox[0]);
      ahora = prox[1].en;
      prox[1].f();
    }
    ahora = hasta;
  };
  return { reloj, avanzar, pendientes };
}

test('reproducir una vez: sacar, reflow, poner; se saca a la duración + el margen; una nueva corta la anterior', () => {
  const { reloj, avanzar, pendientes } = relojDePrueba();
  const el = elemento();
  reproducirUnaVez(el, 1000, reloj);
  assert.deepEqual(el.pasos, [`-${CLASE_REPRODUCIR}`, 'reflow', `+${CLASE_REPRODUCIR}`], 'sin el reflow, la animación no vuelve a empezar');
  avanzar(1000 + MARGEN_FIN_MS - 1);
  assert.ok(el.clases.has(CLASE_REPRODUCIR), 'se sacó antes de terminar');
  avanzar(1);
  assert.ok(!el.clases.has(CLASE_REPRODUCIR), 'no se sacó al terminar');
  // Una segunda reproducción del MISMO elemento corta el timer de la primera: si no, le sacaría la clase a mitad.
  reproducirUnaVez(el, 1000, reloj);
  avanzar(500);
  reproducirUnaVez(el, 1000, reloj);
  assert.equal(pendientes.size, 1, 'quedaron dos timers vivos sobre el mismo elemento');
  avanzar(800);
  assert.ok(el.clases.has(CLASE_REPRODUCIR), 'el timer de la primera cortó la segunda');
  // Cortar a mano saca la clase y el timer.
  const cortar = reproducirUnaVez(el, 1000, reloj);
  cortar();
  assert.ok(!el.clases.has(CLASE_REPRODUCIR));
  assert.equal(pendientes.size, 0);
  reproducirUnaVez(el, 0, reloj);
  assert.ok(!el.clases.has(CLASE_REPRODUCIR) && pendientes.size === 0, 'sin duración (sin efecto, «ninguna») no se reproduce');
});

test('repetir con el mouse encima: cada duración + la pausa, hasta que se corta', () => {
  const { reloj, avanzar, pendientes } = relojDePrueba();
  const el = elemento();
  const cortar = repetirMientras(el, 1000, reloj);
  assert.equal(el.pasos.filter((p) => p === `+${CLASE_REPRODUCIR}`).length, 1);
  avanzar(1000 + PAUSA_ENTRE_VUELTAS_MS);
  assert.equal(el.pasos.filter((p) => p === `+${CLASE_REPRODUCIR}`).length, 2, 'no volvió a empezar');
  assert.deepEqual(el.pasos.slice(-3), [`-${CLASE_REPRODUCIR}`, 'reflow', `+${CLASE_REPRODUCIR}`]);
  avanzar(2 * (1000 + PAUSA_ENTRE_VUELTAS_MS));
  assert.equal(el.pasos.filter((p) => p === `+${CLASE_REPRODUCIR}`).length, 4);
  cortar();
  assert.ok(!el.clases.has(CLASE_REPRODUCIR));
  assert.equal(pendientes.size, 0, 'el timer siguió vivo después de sacar el mouse');
});

test('el ▶: cada sección que anima, UNA vez al entrar en pantalla, con el umbral del script de la publicada', () => {
  const { reloj } = relojDePrueba();
  type Llamada = (e: { target: unknown; isIntersecting: boolean }[]) => void;
  const io = { cb: null as Llamada | null, opciones: {} as Record<string, unknown>, desconectado: false };
  const observadas = new Set<unknown>();
  const IO = class {
    constructor(f: Llamada, op: Record<string, unknown>) { io.cb = f; io.opciones = op; }
    observe(t: unknown) { observadas.add(t); }
    unobserve(t: unknown) { observadas.delete(t); }
    disconnect() { io.desconectado = true; observadas.clear(); }
  } as unknown as ObservadorCtor;
  const cb: Llamada = (e) => io.cb?.(e);
  const a = elemento('a', { 'data-anim': 'subir' });
  const b = elemento('b', { 'data-anim': 'barrido', 'data-anim-dir': 'abajo' });
  const quieta = elemento('quieta', { 'data-anim': 'ninguna' });
  const sinDatos = elemento('sin');
  const raiz = { lienzo: true };
  const cortar = reproducirPagina([a, b, quieta, sinDatos], { raiz, IO, reloj });
  assert.deepEqual([...observadas], [a, b], '«ninguna» y una sección sin data-anim no se observan');
  assert.equal(io.opciones.root, raiz);
  assert.equal(io.opciones.rootMargin, ENTRADA_EN_PANTALLA.rootMargin);
  assert.equal(io.opciones.threshold, ENTRADA_EN_PANTALLA.threshold);
  assert.ok(SCRIPT_PAGINA.includes(`{ rootMargin: '${ENTRADA_EN_PANTALLA.rootMargin}', threshold: ${ENTRADA_EN_PANTALLA.threshold} }`), 'el umbral no es el de la publicada');
  cb([{ target: a, isIntersecting: true }, { target: b, isIntersecting: false }]);
  assert.ok(a.clases.has(CLASE_REPRODUCIR) && !b.clases.has(CLASE_REPRODUCIR), 'sólo la que entró');
  assert.deepEqual([...observadas], [b], 'la que ya se reprodujo se deja de observar');
  assert.equal(io.desconectado, false, 'se desconectó con una sección sin reproducir');
  cb([{ target: b, isIntersecting: true }]);
  assert.ok(b.clases.has(CLASE_REPRODUCIR));
  assert.ok(io.desconectado, 'con todas reproducidas, se desconecta');
  cortar();
  assert.ok(!a.clases.has(CLASE_REPRODUCIR) && !b.clases.has(CLASE_REPRODUCIR), 'cortar saca la clase');
  // «Sólo las de pantalla» (al elegir un estilo): la primera tanda y se termina.
  io.desconectado = false;
  const c = elemento('c', { 'data-anim': 'subir' });
  const d = elemento('d', { 'data-anim': 'subir' });
  reproducirPagina([c, d], { IO, reloj, soloLasDePantalla: true });
  cb([{ target: c, isIntersecting: true }, { target: d, isIntersecting: false }]);
  assert.ok(io.desconectado, 'siguió observando lo que no se ve');
  assert.ok(c.clases.has(CLASE_REPRODUCIR) && !d.clases.has(CLASE_REPRODUCIR));
});

test('«reducir movimiento»: se lee del sistema, y donde no se puede leer es «no»', () => {
  assert.equal(pideMenosMovimiento({ matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) }), true);
  assert.equal(pideMenosMovimiento({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(pideMenosMovimiento({}), false);
  assert.equal(pideMenosMovimiento({ matchMedia: () => { throw new Error('x'); } }), false);
  assert.equal(pideMenosMovimiento(undefined), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// El cableado (sobre el fuente, sin comentarios)
// ─────────────────────────────────────────────────────────────────────────────

const PANEL = sinComentarios(leer('app/web-generator/editor/paneles/PanelAnimacion.tsx'));
const TILE = sinComentarios(leer('app/web-generator/editor/paneles/TileAnimacion.tsx'));
const ARMAZON = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));

test('lo que se mueve solo mira «reducir movimiento»; el ▶ no; y nada se mueve al abrir el panel', () => {
  const verSeccion = bloque(PANEL, 'const verSeccion = (id: string) => {', 'const escribir = ');
  assert.match(verSeccion, /^const verSeccion = \(id: string\) => \{\s*if \(menos\) return;/, 'el efecto recién elegido se reproduce aunque el sistema pida menos movimiento');
  const verEstilo = bloque(PANEL, 'useEffect(() => {\n    if (!verEstilo', '}, [verEstilo]);');
  assert.match(verEstilo, /if \(!verEstilo \|\| menos \|\| !pagina\.animaciones\) return;/, 'el estilo elegido se reproduce con menos movimiento, o al abrir el panel (verEstilo = 0)');
  const todo = bloque(PANEL, 'const reproducirTodo = () => {', '};');
  assert.doesNotMatch(todo, /menos/, 'el ▶ es una acción apretada: reproduce aunque el sistema pida menos movimiento');
  assert.match(todo, /reproducirPagina\(seccionesDom\(\), \{ raiz: lienzo\(\) \}\)/);
  const jugar = bloque(TILE, 'const jugar = () => {', '};');
  assert.match(jugar, /vivo\.current\.quieta/, 'la tile se mueve con «reducir movimiento»');
  assert.match(PANEL, /<TileAnimacion[\s\S]*?quieta=\{menos\}/);
  // Ninguna reproducción en un efecto de montaje: sólo `verEstilo` (que arranca en 0) y el corte al desmontar.
  const efectos = [...PANEL.matchAll(/useEffect\(\(\) => \{?([\s\S]*?)\}?, \[([^\]]*)\]\)/g)];
  for (const [, cuerpo, deps] of efectos) {
    if (/reproducir/.test(cuerpo)) assert.equal(deps.trim(), 'verEstilo', `un efecto reproduce con [${deps}]`);
  }
  assert.ok(efectos.some(([, c, d]) => /reproducirPagina/.test(c) && d.trim() === 'verEstilo'), 'el recorte de los efectos no encontró el del estilo: está mirando otra cosa');
});

test('escribe por UNA transacción (setNodeMarkup, deshacible) y la config por el contexto', () => {
  const escribir = bloque(PANEL, 'const escribir = ', 'const elegir = ');
  assert.match(escribir, /editor\.commands\.command\(\(\{ tr, state \}\) => \{/);
  assert.match(escribir, /tr\.setNodeMarkup\(s\.pos, undefined, \{ \.\.\.s\.nodo\.attrs, \.\.\.cambios \}\);\s*closeHistory\(tr\);/, 'dos tiles seguidas serían UN paso de Ctrl+Z');
  assert.match(PANEL, /cambiar\(\(c\) => \(\{ \.\.\.c, pagina: \{ \.\.\.c\.pagina, estiloAnimacion: id \} \}\)\)/);
  assert.match(PANEL, /cambiar\(\(c\) => \(\{ \.\.\.c, pagina: \{ \.\.\.c\.pagina, animaciones: v \} \}\)\)/);
});

test('los textos son los del Image Editor (animation/strings.ts) y el video de fondo no se ofrece', () => {
  const P = animationStrings.panel;
  for (const t of [P.reduced, P.remove, P.pageStyle, P.emptyTitle, P.animatePage, P.page, P.direction, P.none, animationStrings.timeline.play]) {
    assert.ok(PANEL.includes(t), `falta «${t}»`);
  }
  assert.equal(P.preview('X'), 'X. Pasa el cursor o enfoca para previsualizar.');
  assert.ok(TILE.includes('`${nombre}. Pasa el cursor o enfoca para previsualizar.`'));
  assert.ok(PANEL.includes('`Ajustes: ${efectoElegido.nombre}`'), 'la caja «Ajustes: <efecto>» del Image Editor');
  assert.match(PANEL, /\{VIDEO_FONDO\.disponible && seccion\.disenoFondo \? <VideoDeFondo /, 'el lugar del video de fondo, apagado por VIDEO_FONDO');
  assert.match(bloque(PANEL, 'function VideoDeFondo(', '\n}'), /return null;/);
});

test('el cableado: la barra, el menú de la sección, el montaje con onCerrar fijo y la config al plugin', () => {
  assert.match(ARMAZON, /aria-pressed=\{panelDer === 'animacion'\}[\s\S]{0,200}abrirAnimar\(tarjetaActivaRef\.current \? 'seccion' : 'pagina'\)[\s\S]{0,120}<span className="gma-herr-texto">Animar<\/span>/, 'el botón «Animar» de la barra');
  assert.match(ARMAZON, /<PanelAnimacion onCerrar=\{cerrarPanelDer\} pedido=\{pedidoAnimar\} \/>/, 'el panel se monta con cerrarPanelDer (identidad fija)');
  assert.match(ARMAZON, /const cerrarPanelDer = useCallback\(\(\) => setPanelDer\(null\), \[\]\);/);
  assert.match(ARMAZON, /ponerAnimacionDePagina\(editor\.view, \{ animaciones: animacionesPagina, estiloAnimacion: estiloPagina \}\)/);
  assert.match(ARMAZON, /\}, \[editor, revision, animacionesPagina, estiloPagina\]\);/, 'la config tiene que llegar al plugin también al abrir otra página');
  const ext = sinComentarios(leer('app/web-generator/editor/extensiones/index.ts'));
  assert.match(ext, /return \[\.\.\.extensionesBase\(\{ \.\.\.op, vistas \}\), ExtensionBarra, AnimacionSecciones\];/, 'sin el plugin, .gm-reproducir no tiene qué reproducir en el lienzo');
  const tarjetaVista = sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'));
  assert.match(tarjetaVista, /<FilaMenu icono="brillo" texto=\{`Animar \$\{uno\}`\} onClick=\{desdeMenu\(\(\) => ctx\.abrirAnimar\('seccion', id\)\)\} \/>/, '«Animar sección» en el menú de la sección');
  // El hero con video de fondo se dibuja con su póster (como el render del editor), nunca con la imagen de abajo.
  assert.match(tarjetaVista, /const srcAcento = conVideo && a\.videoFondo \? a\.videoFondo\.poster : a\.imagenSrc;/);
  assert.match(tarjetaVista, /backgroundImage: `url\("\$\{srcAcento\}"\)`/);
  assert.match(tarjetaVista, /const conVideo = a\.diseno === 'fondo' && !!a\.videoFondo;/);
});
