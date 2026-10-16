// =============================================================================
// tests/editor-landing-animaciones-render.test.ts — el catálogo de animaciones llevado al MODELO y al RENDER
// =============================================================================
// Pedido de Martín (14/10/2026): «las dos cosas» — animaciones de página y el video de fondo en loop. El contrato
// es lib/editor-landing/animaciones.ts (tests/editor-landing-animaciones.test.ts); esto fija lo que el paquete A
// (modelo y render) construye encima, y que los demás paquetes usan:
//   · el render: cada `.gm-tarjeta` con data-anim / data-anim-dir / data-anim-texto según el estilo de la landing,
//     su efecto propio, «ninguna», el interruptor y su lugar entre las VISIBLES (una oculta no cuenta);
//   · la hoja (css.ts, bloque 16): una regla por efecto, dirección y escalón con `animacionCss` tal cual; lo que
//     esconde sólo bajo `html.gm-anim`; nada de transform en la sección; Enfoque cae a Desvanecer en el teléfono
//     (el corte del bloque 17); «reducir movimiento» apaga todo en la publicada;
//   · el script de la publicada (SCRIPT_PAGINA, corrido en vm contra un DOM de mentira): parte los títulos en
//     palabras o letras SIN cambiar el texto que se lee y sin tocar lo que ya está en pantalla; el video de fondo
//     (src después del load, el del teléfono, pausa fuera de pantalla y con la pestaña oculta, el botón de pausa,
//     nada con «menos movimiento» o «ahorro de datos»);
//   · el saneo (validar.ts), el esquema de TipTap, la foto de lo publicado y «Editar con IA», que conserva lo de la
//     sección.
// ── Roturas: al final del archivo. ──
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';
import { getSchema } from '@tiptap/core';
import {
  CORTE_CELULAR, EFECTOS, animacionCss, keyframesAnimaciones, type DefEfecto, type VideoFondo,
} from '../lib/editor-landing/animaciones';
import { htmlDePagina, htmlDeTarjeta } from '../lib/editor-landing/render';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { attrsTarjeta } from '../lib/editor-landing/especificacion';
import { sanearConfig, sanearContenido } from '../lib/editor-landing/validar';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { docPagina, parrafo, tarjeta, titulo, type AttrsTarjeta, type JsonNodo, type Pagina } from '../lib/editor-landing/doc';
import { temaPorId } from '../lib/editor-landing/temas';
import { SCRIPT_PAGINA, armarDocumento, configDeLectura, hashScript, type LecturaPublica } from '../lib/editor-landing/pagina-publica';
import { extensionesBase } from '../app/web-generator/editor/extensiones/esquema';
import { convertirEdicion, emparejarEdicion } from '../lib/editor-landing/ia-reglas';
import { bloquesATarjeta, type TarjetaIA } from '../lib/editor-landing/ia-bloques';

const RAIZ = join(__dirname, '..');
const BUCKET = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/';
const POSTER =`${BUCKET}7/poster-1280.webp`;
const POSTER_M = `${BUCKET}7/poster-480.webp`;
const VID = `${BUCKET}7/hero-720.mp4`;
const VID_M = `${BUCKET}7/hero-480.mp4`;
const VIDEO: VideoFondo = { src: VID, srcMovil: VID_M, poster: POSTER, posterMovil: POSTER_M };
const tema = temaPorId('pewter');

const cfg = (pagina: Partial<ConfigLanding['pagina']> & Record<string, unknown>): ConfigLanding =>
  ({ ...CONFIG_DEFAULT, pagina: { ...CONFIG_DEFAULT.pagina, ...pagina } as ConfigLanding['pagina'] });
const pag = (tarjetas: JsonNodo[]): Pagina => ({ id: 'p1', titulo: 'Inicio', ruta: '', doc: docPagina(tarjetas) });
const sec = (id: string, attrs: Partial<AttrsTarjeta> | Record<string, unknown> = {}) =>
  tarjeta([titulo(`Título ${id}`, 2), parrafo(`Texto ${id}`)], { ...(attrs as Partial<AttrsTarjeta>), id });

/** Los atributos de cada `<section>` del HTML, por su id. */
function secciones(html: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const m of html.matchAll(/<section\b([^>]*)>/g)) {
    const a: Record<string, string> = {};
    for (const x of m[1].matchAll(/([a-z-]+)="([^"]*)"/g)) a[x[1]] = x[2];
    out.set((a.id ?? '').replace(/^t-/, ''), a);
  }
  return out;
}
const anim = (a: Record<string, string> | undefined) => (a ? [a['data-anim'] ?? '-', a['data-anim-dir'] ?? '-', a['data-anim-texto'] ?? '-'].join(' ') : 'no está');

// ─────────────────────────────────────────────────────────────────────────────
// El render
// ─────────────────────────────────────────────────────────────────────────────

const PAGINA = pag([
  sec('s0'),
  sec('s1', { oculta: true }),
  sec('s2'),
  sec('s3', { animacion: 'iris' }),
  sec('s4', { animacion: 'ninguna' }),
  sec('s5', { animacion: 'barrido', animacionDireccion: 'abajo' }),
  sec('s6'),
]);

test('render: el estilo de la landing llega a lo que no eligió, con su lugar entre las VISIBLES («alterna»)', () => {
  const s = secciones(htmlDePagina(PAGINA, cfg({ estiloAnimacion: 'deslizar' }), tema, { modo: 'publico' }));
  assert.equal(anim(s.get('s0')), 'deslizar izquierda -');
  assert.equal(anim(s.get('s1')), 'no está', 'la oculta no se publica');
  assert.equal(anim(s.get('s2')), 'deslizar derecha -', 'la oculta no cuenta: s2 es la segunda que se ve');
  assert.equal(anim(s.get('s3')), 'iris - -', 'la propia gana; sin direcciones, sin data-anim-dir');
  assert.equal(anim(s.get('s4')), 'ninguna - -');
  assert.equal(anim(s.get('s5')), 'barrido abajo -');
  assert.equal(anim(s.get('s6')), 'deslizar derecha -', 's6 es la sexta visible (índice 5)');
  // La tira dibuja la oculta, y la oculta igual no corre el índice de las demás.
  const t = secciones(htmlDePagina(PAGINA, cfg({ estiloAnimacion: 'deslizar' }), tema, { modo: 'miniatura', incluirOcultas: true }));
  assert.equal(anim(t.get('s2')), 'deslizar derecha -');
});

test('render: títulos de a palabra sólo con el estilo; el interruptor apagado no deja ningún data-anim', () => {
  const s = secciones(htmlDePagina(PAGINA, cfg({ estiloAnimacion: 'palabras' }), tema, { modo: 'publico' }));
  assert.equal(anim(s.get('s0')), 'desvanecer - palabra');
  assert.equal(anim(s.get('s3')), 'iris - -', 'un efecto propio no parte los títulos');
  const apagado = htmlDePagina(PAGINA, cfg({ animaciones: false, estiloAnimacion: 'palabras' }), tema, { modo: 'publico' });
  assert.doesNotMatch(apagado, /data-anim/, 'apagado: ni data-anim, ni dir, ni texto (tampoco «ninguna»)');
  // Una config guardada antes del catálogo (sin estiloAnimacion): la entrada de siempre, «Subir».
  const vieja = { ...CONFIG_DEFAULT, pagina: { animaciones: true, fondoImagen: null } } as unknown as ConfigLanding;
  assert.equal(anim(secciones(htmlDePagina(PAGINA, vieja, tema, { modo: 'publico' })).get('s0')), 'subir - -');
});

test('render: el editor lleva los mismos data-*; una sección suelta, sólo si se le dice con qué landing', () => {
  const s = secciones(htmlDePagina(PAGINA, cfg({ estiloAnimacion: 'aparecer' }), tema, { modo: 'editor' }));
  assert.equal(anim(s.get('s0')), 'aparecer - -');
  const suelta = sec('x', { animacion: 'rebote' });
  assert.doesNotMatch(htmlDeTarjeta(suelta, tema, { modo: 'miniatura' }), /data-anim/);
  const conLanding = htmlDeTarjeta(sec('y'), tema, { modo: 'miniatura', animacion: { pagina: { animaciones: true, estiloAnimacion: 'deslizar' }, indice: 1 } });
  assert.equal(anim(secciones(conLanding).get('y')), 'deslizar derecha -');
});

test('render: el video de fondo — póster <img> (el LCP) y <video> SIN autoplay ni src en la publicada; el editor, sólo el póster', () => {
  const p = pag([
    sec('h0', { diseno: 'fondo', videoFondo: VIDEO }),
    sec('h1', { diseno: 'fondo', videoFondo: { src: VID, srcMovil: null, poster: POSTER } }),
    sec('h2', { diseno: 'izquierda', videoFondo: VIDEO }),
  ]);
  const html = htmlDePagina(p, cfg({}), tema, { modo: 'publico' });
  const s = secciones(html);
  assert.equal(s.get('h0')?.['data-diseno'], 'fondo', 'sin imagenSrc, el póster hace de imagen');
  assert.equal(s.get('h2')?.['data-diseno'], 'sin', 'el video de fondo es sólo del diseño «fondo»');
  const [h0, h1] = html.split('<section').slice(1);
  assert.match(h0, new RegExp(`<img class="gm-acento-poster" src="${POSTER}" srcset="${POSTER_M} 480w, ${POSTER} 1280w" sizes="\\${CORTE_CELULAR.slice(0, -1)}\\) 1px, 100vw" alt="" fetchpriority="high"`));
  assert.doesNotMatch(h0.slice(0, h0.indexOf('<video')), /loading="lazy"/, 'el póster de la primera no espera');
  const video = /<video\b[^>]*>/.exec(h0)?.[0] ?? '';
  assert.match(video, /class="gm-acento-video" muted="" playsinline="" loop="" preload="none"/);
  assert.match(video, new RegExp(`data-src="${VID}" data-src-movil="${VID_M}"`));
  assert.doesNotMatch(video, /autoplay|\ssrc=|\sposter=/, 'sin autoplay ni src: le robaban ancho de banda al póster');
  assert.match(h1, /<img class="gm-acento-poster" src="[^"]+" alt="" loading="lazy" decoding="async"/, 'la segunda: diferida');
  assert.doesNotMatch(h1, /srcset|fetchpriority|data-src-movil/);
  for (const modo of ['editor', 'miniatura', 'exportar'] as const) {
    const otro = htmlDePagina(p, cfg({}), tema, { modo });
    assert.doesNotMatch(otro, /<video|gm-acento-poster/, `${modo}: sin video`);
    assert.ok(otro.includes(`background-image:url(&quot;${POSTER}&quot;)`) || otro.includes(`background-image:url("${POSTER}")`), `${modo}: el póster de fondo`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// La hoja
// ─────────────────────────────────────────────────────────────────────────────

type Regla = { media: string | null; sels: string[]; decl: string };
/** Las reglas de la hoja con su @media (las de @keyframes no son reglas de selector y se saltean). */
function reglas(css: string, media: string | null = null): Regla[] {
  const out: Regla[] = [];
  const t = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  while (i < t.length) {
    const abre = t.indexOf('{', i);
    if (abre < 0) break;
    const prel = t.slice(i, abre).trim();
    let prof = 1, j = abre + 1;
    while (j < t.length && prof) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
    const cuerpo = t.slice(abre + 1, j - 1);
    if (prel.startsWith('@media')) out.push(...reglas(cuerpo, prel));
    else if (!prel.startsWith('@')) out.push({ media, sels: prel.split(',\n').map((x) => x.trim()), decl: cuerpo.trim() });
    i = j;
  }
  return out;
}
const HOJA = reglas(CSS_CONTENIDO);
const VARIANTES = (EFECTOS as readonly DefEfecto[]).flatMap((e) => (e.direcciones ?? [null]).map((d) => ({ e, d })));
const lugar = (k: number) => (k < 9 ? `:nth-child(${k})` : ':nth-child(n+9)');
const variante = (id: string, d: string | null) => `[data-anim="${id}"]${d ? `[data-anim-dir="${d}"]` : ''}`;
const regla = (sel: string, media: string | null = null) => HOJA.find((r) => r.media === media && r.sels.includes(sel));

test('la hoja: una regla por efecto, dirección y escalón, con `animacionCss` tal cual (la publicada y lo que reproduce)', () => {
  assert.ok(CSS_CONTENIDO.includes(keyframesAnimaciones()), 'los keyframes del catálogo, una vez');
  let n = 0;
  for (const { e, d } of VARIANTES) {
    for (let k = 1; k <= 9; k++) {
      const v = variante(e.id, d);
      const pub = `html.gm-anim .gm-tarjeta${v}.gm-visto > .gm-tarjeta-cuerpo > ${lugar(k)}`;
      const rep = `.gm-doc .gm-tarjeta${v}.gm-reproducir > .gm-tarjeta-cuerpo > ${lugar(k)}`;
      const r = regla(pub);
      assert.ok(r, `falta ${pub}`);
      assert.ok(r.sels.includes(rep), `falta lo que reproduce: ${rep}`);
      assert.equal(r.decl, `animation: ${animacionCss(e.id as never, d as never, k - 1)};`, pub);
      n++;
    }
  }
  assert.equal(n, 23 * 9, '17 efectos, dos con 4 direcciones');
  // Lo de antes del catálogo (HTML sin data-anim) sigue con la entrada de siempre; «ninguna» no se esconde.
  assert.match(regla('html.gm-anim .gm-tarjeta.gm-visto:not([data-anim]) > .gm-tarjeta-cuerpo > *')?.decl ?? '', /gm-entrada 1s cubic-bezier\(0\.22, 1, 0\.36, 1\) 0\.15s backwards/);
  assert.equal(regla('html.gm-anim .gm-tarjeta:not(.gm-visto):not([data-anim="ninguna"])')?.decl, 'opacity: 0;');
  assert.equal(regla('html.gm-anim .gm-tarjeta.gm-visto:not([data-anim="ninguna"])')?.decl, 'animation: gm-aparecer 0.6s ease backwards;');
});

test('la hoja: lo que esconde, sólo bajo html.gm-anim; nada de html.gm-anim en lo que reproduce ni en el código de la app', () => {
  const animadas = HOJA.filter((r) => r.sels.some((s) => /gm-tarjeta|data-anim|\.gm-u|gm-reproducir/.test(s)));
  for (const r of animadas) {
    for (const s of r.sels) {
      if (s.includes('gm-reproducir')) assert.ok(!s.includes('gm-anim'), `lo que reproduce no depende de gm-anim: ${s}`);
    }
    if (/(^|;\s*)opacity:\s*0;/.test(r.decl) && r.media === null) {
      for (const s of r.sels) assert.ok(s.startsWith('html.gm-anim '), `esconde fuera de la publicada: ${s}`);
    }
    // Un transform o un filter en la SECCIÓN la vuelve el contenedor de lo fixed: los efectos van en los bloques.
    if (/gm-e-/.test(r.decl)) for (const s of r.sels) assert.ok(s.includes(' > .gm-tarjeta-cuerpo > ') || s.endsWith(' .gm-u'), `un efecto en la sección: ${s}`);
  }
  // En el código (sin comentarios), `gm-anim` sólo lo nombran la hoja y el script de la publicada. Los candidatos
  // los da `git grep` (con los archivos nuevos sin commitear): recorrer app/ y lib/ a mano tardaba 12-34 s.
  const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  let candidatos: string[] = [];
  try {
    candidatos = execFileSync('git', ['grep', '-l', '--untracked', '-e', 'gm-anim', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    if ((e as { status?: number }).status !== 1) throw e; // 1 = ninguno; otro código = git falló, y eso no es «ninguno»
  }
  assert.ok(candidatos.length >= 2, 'git grep tiene que encontrar por lo menos la hoja y el script');
  const nombran = candidatos.filter((p) => /\.(ts|tsx|js|mjs)$/.test(p) && /gm-anim(?![a-z-])/.test(sinComentarios(readFileSync(join(RAIZ, p), 'utf8'))));
  assert.deepEqual(nombran.sort(), ['lib/editor-landing/css.ts', 'lib/editor-landing/pagina-publica.ts']);
});

test('la hoja: Enfoque cae a Desvanecer en el teléfono (el corte del bloque 17) y «reducir movimiento» apaga la publicada', () => {
  const media = '@media ' + CORTE_CELULAR;
  assert.ok(regla('.gm-doc .gm-tarjeta-cuerpo', media)?.decl.includes('padding: 2em 1.4em;'), 'el bloque 17 usa el mismo corte');
  for (let k = 1; k <= 9; k++) {
    const desv = `animation: ${animacionCss('desvanecer', null, k - 1)};`;
    const r = regla(`html.gm-anim .gm-tarjeta[data-anim="enfoque"].gm-visto > .gm-tarjeta-cuerpo > ${lugar(k)}`, media);
    assert.equal(r?.decl, desv, `publicada, escalón ${k}`);
    assert.ok(r?.sels.includes(`.gm-doc .gm-tarjeta[data-anim="enfoque"].gm-reproducir > .gm-tarjeta-cuerpo > ${lugar(k)}`));
    assert.equal(regla(`.gm-doc[data-dispositivo="movil"] .gm-tarjeta[data-anim="enfoque"].gm-reproducir > .gm-tarjeta-cuerpo > ${lugar(k)}`)?.decl, desv, `vista «Teléfono», escalón ${k}`);
  }
  // Ningún otro efecto con filter queda vivo en el teléfono: en el teléfono sólo transform, opacity y clip-path.
  for (const r of HOJA.filter((x) => x.media === media)) assert.doesNotMatch(r.decl, /gm-e-enfoque/);
  const reducir = HOJA.filter((r) => r.media === '@media (prefers-reduced-motion: reduce)');
  const apaga = reducir.find((r) => r.sels.includes('html.gm-anim .gm-tarjeta > .gm-tarjeta-cuerpo > *'));
  assert.equal(apaga?.decl, 'opacity: 1 !important; animation: none !important;');
  for (const s of ['html.gm-anim .gm-tarjeta', 'html.gm-anim [data-animar]', 'html.gm-anim .gm-tarjeta .gm-u']) assert.ok(apaga?.sels.includes(s), s);
  assert.ok(reducir.some((r) => r.sels.includes('.gm-doc .gm-acento > .gm-acento-video') && r.decl === 'display: none;'), 'y el video de fondo');
  // Los títulos partidos: por palabra en bloque (si no, un transform no los mueve); por letra, en línea.
  assert.match(regla('html.gm-anim .gm-tarjeta[data-anim-texto="palabra"].gm-visto .gm-u')?.decl ?? '', /^display: inline-block; animation: gm-e-subir 1000ms .* backwards; animation-delay: calc\(var\(--gm-u, 0\) \* 90ms \+ 150ms\);$/);
  assert.match(regla('html.gm-anim .gm-tarjeta[data-anim-texto="letra"].gm-visto .gm-u')?.decl ?? '', /^animation: gm-e-desvanecer 700ms ease backwards; animation-delay: calc\(var\(--gm-u, 0\) \* 35ms \+ 150ms\);$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// El script de la publicada, corrido de verdad (vm) contra un DOM de mentira
// ─────────────────────────────────────────────────────────────────────────────

type Oyente = (ev: Record<string, unknown>) => void;
class Nodo {
  parentNode: Nodo | null = null;
  childNodes: Nodo[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  oyentes: Record<string, Oyente[]> = {};
  rect = { top: 0, bottom: 0 };
  [k: string]: unknown;
  constructor(public nodeType: number, public nodeName: string, public nodeValue: string | null = null) {}
  get firstChild() { return this.childNodes[0] ?? null; }
  get nextSibling(): Nodo | null { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get textContent(): string { return this.nodeType === 3 ? this.nodeValue ?? '' : this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(t: string) { this.childNodes = []; if (t) this.appendChild(new Nodo(3, '#text', t)); }
  get className() { return this.attrs.class ?? ''; }
  set className(v: string) { this.attrs.class = v; }
  get classList() {
    const clases = () => new Set((this.attrs.class ?? '').split(' ').filter(Boolean));
    return {
      add: (c: string) => { const s = clases(); s.add(c); this.attrs.class = [...s].join(' '); },
      contains: (c: string) => clases().has(c),
    };
  }
  getAttribute(n: string) { return n in this.attrs ? this.attrs[n] : null; }
  setAttribute(n: string, v: string) { this.attrs[n] = String(v); }
  removeAttribute(n: string) { delete this.attrs[n]; }
  appendChild(n: Nodo): Nodo {
    if (n.nodeType === 11) { for (const c of [...n.childNodes]) this.appendChild(c); n.childNodes = []; return n; }
    if (n.parentNode) n.parentNode.childNodes.splice(n.parentNode.childNodes.indexOf(n), 1);
    n.parentNode = this; this.childNodes.push(n); return n;
  }
  replaceChild(nuevo: Nodo, viejo: Nodo): Nodo {
    const lista = nuevo.nodeType === 11 ? [...nuevo.childNodes] : [nuevo];
    if (nuevo.nodeType === 11) nuevo.childNodes = [];
    for (const c of lista) c.parentNode = this;
    this.childNodes.splice(this.childNodes.indexOf(viejo), 1, ...lista);
    viejo.parentNode = null;
    return viejo;
  }
  todos(): Nodo[] { return this.children.flatMap((c) => [c, ...c.todos()]); }
  querySelectorAll(sel: string): Nodo[] { return this.todos().filter((n) => sel.split(',').some((p) => calza(n, p.trim()))); }
  closest(sel: string): Nodo | null { for (let n: Nodo | null = this; n; n = n.parentNode) if (n.nodeType === 1 && calza(n, sel)) return n; return null; }
  getBoundingClientRect() { return this.rect; }
  addEventListener(t: string, fn: Oyente) { (this.oyentes[t] ??= []).push(fn); }
  disparar(t: string) { for (const fn of this.oyentes[t] ?? []) fn({ target: this }); }
}
class Video extends Nodo {
  paused = true; plays = 0; pauses = 0; muted = false;
  constructor() { super(1, 'VIDEO'); }
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauses++; this.paused = true; }
  get src() { return this.attrs.src ?? ''; }
  set src(v: string) { this.attrs.src = v; }
}
function calza(n: Nodo, sel: string): boolean {
  const m = /^([a-z0-9]*)((?:\.[\w-]+)*)(?:\[([\w-]+)\])?$/i.exec(sel);
  if (!m) throw new Error(`selector que el DOM de mentira no sabe: ${sel}`);
  if (m[1] && n.nodeName !== m[1].toUpperCase()) return false;
  for (const c of m[2].split('.').filter(Boolean)) if (!n.classList.contains(c)) return false;
  return !m[3] || n.getAttribute(m[3]) !== null;
}
function el(tag: string, attrs: Record<string, string> = {}, ...hijos: Array<Nodo | string>): Nodo {
  const n = tag === 'video' ? new Video() : new Nodo(1, tag.toUpperCase());
  Object.assign(n.attrs, attrs);
  for (const h of hijos) n.appendChild(typeof h === 'string' ? new Nodo(3, '#text', h) : h);
  return n;
}
const seccionDom = (attrs: Record<string, string>, rect: [number, number], ...cuerpo: Nodo[]) => {
  const s = el('section', { class: 'gm-tarjeta', ...attrs }, el('div', { class: 'gm-tarjeta-cuerpo' }, ...cuerpo));
  s.rect = { top: rect[0], bottom: rect[1] };
  return s;
};

type OpScript = { animar?: boolean; reducido?: boolean; conIO?: boolean; angosto?: boolean; ahorro?: boolean; readyState?: string };
function correr(raiz: Nodo, op: OpScript = {}) {
  const ios: Array<{ cb: (e: Array<{ isIntersecting: boolean; target: Nodo }>) => void; vistos: Nodo[] }> = [];
  class IOFalso {
    vistos: Nodo[] = [];
    constructor(cb: (e: Array<{ isIntersecting: boolean; target: Nodo }>) => void) { ios.push({ cb, vistos: this.vistos }); }
    observe(n: Nodo) { this.vistos.push(n); }
    unobserve() { /* nada */ }
  }
  const oyentesWin: Record<string, Oyente[]> = {};
  const oyentesDoc: Record<string, Oyente[]> = {};
  const clasesHtml: string[] = [];
  const alPonerGmAnim: Array<() => void> = [];
  const document = {
    body: { getAttribute: (n: string) => (n === 'data-gm-animar' && op.animar !== false ? '1' : null) },
    documentElement: { clientHeight: 844, classList: { add: (c: string) => { clasesHtml.push(c); if (c === 'gm-anim') alPonerGmAnim.forEach((f) => f()); } } },
    readyState: op.readyState ?? 'interactive',
    hidden: false,
    createElement: (t: string) => el(t),
    createTextNode: (t: string) => new Nodo(3, '#text', t),
    createDocumentFragment: () => new Nodo(11, '#document-fragment'),
    querySelectorAll: (s: string) => raiz.querySelectorAll(s),
    addEventListener: (t: string, fn: Oyente) => { (oyentesDoc[t] ??= []).push(fn); },
  };
  const window = {
    location: { href: 'https://hola-mako.site/x' },
    innerHeight: 844,
    matchMedia: (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' ? !!op.reducido : q === CORTE_CELULAR ? !!op.angosto : false }),
    IntersectionObserver: op.conIO === false ? undefined : IOFalso,
    addEventListener: (t: string, fn: Oyente) => { (oyentesWin[t] ??= []).push(fn); },
    navigator: { connection: op.ahorro ? { saveData: true } : {} },
    setTimeout: () => 0,
    // El degradado de los títulos (6 temas) se lee del estilo calculado: acá, marcado con `data-degradado`.
    getComputedStyle: (n: Nodo) => ({ backgroundImage: n.getAttribute('data-degradado') !== null ? 'linear-gradient(90deg, #f00, #00f)' : 'none' }),
  };
  return {
    ios, clasesHtml, alPonerGmAnim, document,
    correr: () => runInContext(SCRIPT_PAGINA, createContext({ document, window, URL })),
    cargar: () => (oyentesWin.load ?? []).forEach((f) => f({})),
    pestana: (oculta: boolean) => { document.hidden = oculta; (oyentesDoc.visibilitychange ?? []).forEach((f) => f({})); },
  };
}
const unidades = (n: Nodo) => n.todos().filter((x) => x.classList.contains('gm-u'));

test('el script parte los títulos de a palabra y de a letra SIN cambiar lo que se lee, y no toca lo ya visto', () => {
  const h1 = el('h1', {}, 'Hola mundo');
  const h2 = el('h2', {}, 'Vende  más ', el('strong', {}, 'hoy'), ' mismo');
  const p = el('p', {}, 'Un párrafo no se parte');
  const h3 = el('h3', {}, 'Ñandú 🚀 sí');
  const viejo = el('h2', {}, 'Sin data-anim-texto');
  const degradado = el('h3', { 'data-degradado': '' }, 'Título con degradado');
  const raiz = el('main', {},
    seccionDom({ 'data-anim': 'desvanecer', 'data-anim-texto': 'palabra' }, [0, 800], h1),
    seccionDom({ 'data-anim': 'desvanecer', 'data-anim-texto': 'palabra' }, [1600, 2400], h2, p, degradado),
    seccionDom({ 'data-anim': 'desvanecer', 'data-anim-texto': 'letra' }, [2600, 3400], h3),
    seccionDom({}, [3600, 4400], viejo),
  );
  const antes = [h1, h2, p, h3, viejo].map((n) => n.textContent);
  const s = correr(raiz);
  let partidoAlPonerGmAnim = -1;
  // La PRIMERA vez que se pone (si el script la pusiera dos veces, la que cuenta es la primera).
  s.alPonerGmAnim.push(() => { if (partidoAlPonerGmAnim < 0) partidoAlPonerGmAnim = unidades(h2).length; });
  s.correr();
  assert.deepEqual([h1, h2, p, h3, viejo].map((n) => n.textContent), antes, 'el texto que se lee es el mismo');
  assert.equal(unidades(h1).length, 0, 'la primera sección queda quieta (el arreglo del parpadeo): no se parte');
  assert.equal(h1.getAttribute('aria-label'), null);
  assert.deepEqual(unidades(h2).map((u) => u.textContent), ['Vende', 'más', 'hoy', 'mismo'], 'palabras, también adentro de la negrita');
  assert.deepEqual(unidades(h2).map((u) => u.getAttribute('style')), ['--gm-u:0', '--gm-u:1', '--gm-u:2', '--gm-u:3']);
  assert.ok(unidades(h2).every((u) => u.getAttribute('aria-hidden') === 'true'));
  assert.equal(h2.getAttribute('aria-label'), 'Vende  más hoy mismo');
  assert.equal(unidades(p).length, 0, 'sólo los títulos');
  assert.equal(unidades(degradado).length, 0, 'un título con degradado entra entero (sus pedazos se verían vacíos)');
  assert.equal(degradado.getAttribute('aria-label'), null);
  assert.deepEqual(unidades(h3).map((u) => u.textContent), ['Ñ', 'a', 'n', 'd', 'ú', '🚀', 's', 'í'], 'letras; un emoji entero');
  assert.equal(unidades(viejo).length, 0, 'el HTML de antes no se toca');
  assert.equal(partidoAlPonerGmAnim, 4, 'se parte ANTES de gm-anim: no hay un cuadro con el título entero escondido');
  assert.ok(s.clasesHtml.includes('gm-anim'));

  // Sin IntersectionObserver o con «menos movimiento», nada se parte.
  for (const op of [{ conIO: false }, { reducido: true }, { animar: false }]) {
    const t = el('h2', {}, 'Dos palabras');
    correr(el('main', {}, seccionDom({}, [0, 800], el('p', {}, 'x')), seccionDom({ 'data-anim-texto': 'palabra' }, [1600, 2400], t)), op).correr();
    assert.equal(unidades(t).length, 0, JSON.stringify(op));
  }
});

function hero(animar = true) {
  const video = el('video', { class: 'gm-acento-video', 'data-src': VID, 'data-src-movil': VID_M }) as Video;
  const s = seccionDom({ 'data-diseno': 'fondo' }, [0, 800], el('h1', {}, 'Hola'));
  s.appendChild(el('div', { class: 'gm-acento' }, el('img', { class: 'gm-acento-poster' }), video));
  return { raiz: el('main', {}, s), seccion: s, video, animar };
}

test('el script y el video de fondo: src recién después del load, play en pantalla, pausa fuera y con la pestaña oculta', () => {
  for (const animar of [true, false]) {
    const h = hero();
    const s = correr(h.raiz, { animar });
    s.correr();
    assert.equal(h.video.getAttribute('src'), null, 'antes del load no se baja nada (el póster primero)');
    s.cargar();
    assert.equal(h.video.muted, true);
    const ojo = s.ios.find((x) => x.vistos.includes(h.video));
    assert.ok(ojo, 'el video se vigila');
    assert.equal(h.video.plays, 0, 'fuera de pantalla hasta que el observador diga');
    ojo.cb([{ isIntersecting: true, target: h.video }]);
    assert.equal(h.video.getAttribute('src'), VID, `escritorio: el de 720p (animaciones ${animar ? 'prendidas' : 'apagadas'}: no depende)`);
    assert.equal(h.video.plays, 1);
    ojo.cb([{ isIntersecting: false, target: h.video }]);
    assert.equal(h.video.paused, true, 'fuera de pantalla, pausado');
    ojo.cb([{ isIntersecting: true, target: h.video }]);
    s.pestana(true);
    assert.equal(h.video.paused, true, 'con la pestaña oculta, pausado');
    s.pestana(false);
    assert.equal(h.video.paused, false);
  }
  const movil = hero();
  const sm = correr(movil.raiz, { readyState: 'complete', angosto: true });
  sm.correr();
  sm.ios.find((x) => x.vistos.includes(movil.video))?.cb([{ isIntersecting: true, target: movil.video }]);
  assert.equal(movil.video.getAttribute('src'), VID_M, 'en el ancho del teléfono, el vertical (y con la página ya cargada, sin esperar)');
});

test('el script y el video: se muestra con «playing», con la pausa (WCAG 2.2.2) que respeta lo que eligió la persona', () => {
  const h = hero();
  const s = correr(h.raiz);
  s.correr(); s.cargar();
  const ojo = s.ios.find((x) => x.vistos.includes(h.video))!;
  ojo.cb([{ isIntersecting: true, target: h.video }]);
  assert.equal(h.video.getAttribute('data-andando'), null, 'play() no alcanza: iOS en ahorro de energía no reproduce');
  assert.equal(h.seccion.querySelectorAll('button').length, 0, 'sin video andando, no hay nada que pausar');
  h.video.disparar('playing');
  h.video.disparar('playing');
  assert.equal(h.video.getAttribute('data-andando'), '1');
  const botones = h.seccion.querySelectorAll('button.gm-video-pausa');
  assert.equal(botones.length, 1, 'un solo botón');
  const b = botones[0];
  assert.equal(b.type, 'button');
  assert.equal(b.getAttribute('aria-label'), 'Pausar el video de fondo');
  b.disparar('click');
  assert.equal(h.video.paused, true);
  assert.equal(b.getAttribute('aria-label'), 'Reproducir el video de fondo');
  assert.equal(b.getAttribute('data-pausado'), '1');
  ojo.cb([{ isIntersecting: false, target: h.video }]);
  ojo.cb([{ isIntersecting: true, target: h.video }]);
  s.pestana(true); s.pestana(false);
  assert.equal(h.video.paused, true, 'volver a la pantalla o a la pestaña no lo despausa');
  b.disparar('click');
  assert.equal(h.video.paused, false);
  assert.equal(b.getAttribute('data-pausado'), null);
});

test('el script y el video: con «menos movimiento» o «ahorro de datos», sólo el póster', () => {
  for (const op of [{ reducido: true }, { ahorro: true }]) {
    const h = hero();
    const s = correr(h.raiz, op);
    s.correr(); s.cargar();
    for (const o of s.ios) o.cb(o.vistos.map((target) => ({ isIntersecting: true, target })));
    assert.equal(h.video.getAttribute('src'), null, JSON.stringify(op));
    assert.equal(h.video.plays, 0, JSON.stringify(op));
  }
});

test('el hash de la política sale del script REAL que se sirve', () => {
  const doc = armarDocumento({ html: '<main></main>', config: CONFIG_DEFAULT, workspaceId: 1, modo: 'vista', urlCanonica: 'https://hola-mako.site/vista/abc' },
    { appBaseUrl: 'https://mako.test', prefijoBucket: BUCKET });
  assert.ok(doc.includes(`<script>${SCRIPT_PAGINA}</script>`));
  // En el <meta> la política va escapada (las comillas simples del hash como &#39;).
  assert.ok(doc.includes(hashScript(SCRIPT_PAGINA).replace(/'/g, '&#39;')), 'la política lleva el hash de ESTE script');
  assert.ok(SCRIPT_PAGINA.includes(`'${CORTE_CELULAR}'`), 'el corte del video sale del contrato, no de una copia');
  assert.doesNotMatch(SCRIPT_PAGINA, /[\\`]|\$\{/, 'un string que se sirve: sin barras, sin backticks, sin ${');
});

// ─────────────────────────────────────────────────────────────────────────────
// El modelo: saneo, esquema, foto y «Editar con IA»
// ─────────────────────────────────────────────────────────────────────────────

test('el saneo: lo que no está en el catálogo se tira con su motivo; el video, sólo del bucket; idempotente', () => {
  const contenido = { v: 1, paginas: [pag([
    sec('a1', { animacion: 'giro-loco', animacionDireccion: 'abajo' }),
    sec('a2', { animacion: 'deslizar', animacionDireccion: 'diagonal' }),
    sec('a3', { diseno: 'fondo', videoFondo: { src: 'https://evil.com/v.mp4', srcMovil: null, poster: POSTER } }),
    sec('a4', { diseno: 'fondo', videoFondo: { src: VID, srcMovil: 'https://evil.com/m.mp4', poster: POSTER } }),
    sec('a5', { animacion: 'ninguna', diseno: 'fondo', videoFondo: VIDEO }),
    sec('a6', { animacion: 'barrido', animacionDireccion: 'arriba' }),
  ])] };
  const r = sanearContenido(contenido);
  const a = (id: string) => (r.contenido.paginas[0].doc.content.find((t) => t.attrs?.id === id)?.attrs ?? {}) as Record<string, unknown>;
  assert.equal(a('a1').animacion, null);
  assert.equal(a('a1').animacionDireccion, null, 'sin efecto propio, la dirección no vale');
  assert.ok(r.descartes.some((d) => /«animacion» inválido .*giro-loco/.test(d)), r.descartes.join('\n'));
  assert.deepEqual([a('a2').animacion, a('a2').animacionDireccion], ['deslizar', null]);
  assert.equal(a('a3').videoFondo, null);
  assert.ok(r.descartes.some((d) => /video de fondo .* «https:\/\/evil\.com\/v\.mp4» en .*: se quita/.test(d)), r.descartes.join('\n'));
  assert.deepEqual(a('a4').videoFondo, { src: VID, srcMovil: null, poster: POSTER, posterMovil: null });
  assert.ok(r.descartes.some((d) => /variante del teléfono del video de fondo/.test(d)));
  assert.deepEqual([a('a5').animacion, a('a5').videoFondo], ['ninguna', VIDEO]);
  assert.deepEqual([a('a6').animacion, a('a6').animacionDireccion], ['barrido', 'arriba']);
  assert.ok(!r.descartes.some((d) => /a5|a6/.test(d)), 'lo válido no deja motivo');
  const otra = sanearContenido(r.contenido);
  assert.deepEqual(otra.contenido, r.contenido);
  assert.deepEqual(otra.descartes, [], 'idempotente');
  // El normalizador de siempre (render, TipTap, la IA) lee igual.
  assert.deepEqual(attrsTarjeta({ videoFondo: { src: VID, poster: 'https://evil.com/p.webp' } }).videoFondo, null, 'sin póster del bucket, no hay video');
});

test('la config: «Animación de página» con default para lo guardado antes, y lo inventado se tira con motivo', () => {
  assert.equal(sanearConfig({}).config.pagina.estiloAnimacion, 'subir');
  assert.ok(!sanearConfig({}).descartes.some((d) => /animación/.test(d)));
  assert.equal(sanearConfig({ pagina: { estiloAnimacion: 'maquina' } }).config.pagina.estiloAnimacion, 'maquina');
  const r = sanearConfig({ pagina: { animaciones: false, estiloAnimacion: 'tornado' } });
  assert.deepEqual([r.config.pagina.animaciones, r.config.pagina.estiloAnimacion], [false, 'subir']);
  assert.ok(r.descartes.some((d) => /estilo de animación «tornado» inválido: queda «subir»/.test(d)), r.descartes.join('\n'));
});

test('el esquema de TipTap conoce los tres attrs (si no, los tira y el autoguardado los borra)', () => {
  const schema = getSchema(extensionesBase());
  const json = { type: 'doc', content: [sec('z', { animacion: 'rebote', animacionDireccion: null, videoFondo: VIDEO, diseno: 'fondo' })] };
  const vuelta = schema.nodeFromJSON(json).toJSON() as { content: Array<{ attrs: Record<string, unknown> }> };
  const at = vuelta.content[0].attrs;
  assert.deepEqual([at.animacion, at.animacionDireccion, at.videoFondo], ['rebote', null, VIDEO]);
  const nueva = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'tarjeta', content: [{ type: 'paragraph' }] }] }).toJSON() as typeof vuelta;
  assert.deepEqual([nueva.content[0].attrs.animacion, nueva.content[0].attrs.animacionDireccion, nueva.content[0].attrs.videoFondo], [null, null, null], 'una sección nueva hereda');
});

test('la foto: guarda el estilo como guarda el interruptor; una foto vieja lee el de siempre', () => {
  const base: LecturaPublica = { workspaceId: 3, foto: { sitio: CONFIG_DEFAULT.sitio }, pagina: { html: '<main></main>' } };
  assert.equal(configDeLectura(base).pagina.estiloAnimacion, 'subir');
  assert.equal(configDeLectura({ ...base, foto: { ...base.foto, estiloAnimacion: 'palabras' } }).pagina.estiloAnimacion, 'palabras');
  assert.equal(configDeLectura({ ...base, foto: { ...base.foto, estiloAnimacion: 'inventado' } }).pagina.estiloAnimacion, 'subir');
  // publicar.ts es server-only: se lee el fuente (sin comentarios) de `sitioDe`.
  const src = readFileSync(join(RAIZ, 'lib/editor-landing/publicar.ts'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  const cuerpo = src.slice(src.indexOf('function sitioDe('), src.indexOf('const TOPE_FOTO_BYTES'));
  assert.ok(cuerpo.length > 100 && cuerpo.length < 1200, `el recorte mide ${cuerpo.length}`);
  assert.match(cuerpo, /animaciones: foto\.config\.pagina\.animaciones,/);
  assert.match(cuerpo, /estiloAnimacion: sanearEstilo\(foto\.config\.pagina\?\.estiloAnimacion\)/);
});

test('«Editar con IA» conserva la animación y el video de la sección que reescribe (y la IA no los puede tocar)', () => {
  const originales = [
    sec('tA', { diseno: 'fondo', animacion: 'barrido', animacionDireccion: 'abajo', videoFondo: VIDEO }),
    sec('tB', { animacion: 'ninguna' }),
  ];
  const vino = [
    { id: 'tA', animacion: 'rebote', videoFondo: null, bloques: [{ t: 'h2', texto: 'Nuevo título' }] },
    { id: 'tB', bloques: [{ t: 'p', texto: 'Otro texto' }] },
    { bloques: [{ t: 'p', texto: 'Una sección nueva' }] },
  ] as unknown as TarjetaIA[];
  const { pares } = emparejarEdicion(vino as never, originales);
  const r = convertirEdicion(pares, originales, (t, base) => bloquesATarjeta(t as TarjetaIA, { base }));
  const a = (i: number) => r.tarjetas[i].attrs as Record<string, unknown>;
  assert.deepEqual([a(0).id, a(0).animacion, a(0).animacionDireccion, a(0).videoFondo], ['tA', 'barrido', 'abajo', VIDEO]);
  assert.equal(r.tarjetas[0].content?.[0].content?.[0].text, 'Nuevo título', 'los bloques sí cambiaron');
  assert.deepEqual([a(1).id, a(1).animacion], ['tB', 'ninguna']);
  assert.deepEqual([a(2).animacion, a(2).animacionDireccion, a(2).videoFondo], [null, null, null], 'una nueva hereda el estilo');
  // Y lo que se guarda después (el saneo del server) lo deja igual.
  const g = sanearContenido({ v: 1, paginas: [pag(r.tarjetas)] });
  assert.deepEqual(g.contenido.paginas[0].doc.content[0].attrs?.videoFondo, VIDEO);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTURAS
// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (15/10/2026), corrido junto con tests/editor-landing-animaciones.test.ts: base 24 / 0; una
// rotura por vez, restaurada de memoria y verificada por hash (scratchpad del paquete A, romper-A.mjs).
//   #0  la sección oculta CUENTA en el índice (render.ts) ............................ 23 / 1 (render «alterna»)
//   #1  las reglas viejas (gm-entrada) sin :not([data-anim]) (css.ts) ............... 23 / 1 (la hoja: una regla…)
//   #2  la cascada con k en vez de k - 1 (css.ts) ................................... 22 / 2 (una regla… · Enfoque)
//   #3  Enfoque sin caer a Desvanecer en el teléfono (css.ts) ....................... 23 / 1 (Enfoque)
//   #4  los títulos se parten DESPUÉS de gm-anim (pagina-publica.ts) ................ 23 / 1 (el script parte…)
//   #5  las letras sin juntar el par sustituto: el emoji partido .................... 23 / 1 (el script parte…)
//   #6  la pausa de la persona no manda (sin gmQuieto) .............................. 23 / 1 (la pausa WCAG)
//   #7  el video sin mirar «ahorro de datos» ......................................... 23 / 1 (sólo el póster)
//   #8  el video con autoplay en el HTML (especificacion.ts) ........................ 23 / 1 (render del video)
//   #9  la foto sin el estilo (publicar.ts) ........................................... 23 / 1 (la foto)
//   #10 el estilo inventado sin motivo (validar.ts) .................................. 23 / 1 (la config)
//   #11 «ninguna» sin su data-anim (animaciones.ts) .................................. 22 / 2 (render · contrato)
//   #12 el título con degradado también se parte ..................................... 23 / 1 (el script parte…)
//   #13 el video de fondo sin el saneo del bucket (especificacion.ts) ................ 23 / 1 (el saneo)
// Restaurado: 24 / 0. (La primera vuelta encontró dos tests que no mordían: el gancho de gm-anim guardaba la
// ÚLTIMA vez que se ponía la clase, y la rotura de data-anim-dir no cambiaba nada; los dos quedaron corregidos.)

// WCAG 2.2.2 (16/10/2026, la verificación de la tanda 8): un título partido termina de entrar en 5 s como mucho. Con
// «Máquina de escribir» uno de 140 letras llegaba a 5,7 s (150 + 139 × 35 + 700 ms); el script le junta los pedazos.
// Roturas (a mano y restaurado; base en verde: 18 / 0 en este archivo):
//   · el script sin el tope (TOPE_TEXTO ignorado) ...................................... 17 / 1 (éste)
//   · el tope con 6000 ms en vez de 5000 ................................................. 17 / 1 (éste)
test('un título largo de a letra termina de entrar en 5 s como mucho; uno corto no cambia', () => {
  const largo = el('h2', {}, 'x'.repeat(140));
  const corto = el('h3', {}, 'Hola');
  const raiz = el('main', {},
    seccionDom({ 'data-anim': 'desvanecer' }, [0, 800], el('h1', {}, 'Arriba')),
    seccionDom({ 'data-anim': 'desvanecer', 'data-anim-texto': 'letra' }, [1600, 2400], largo),
    seccionDom({ 'data-anim': 'desvanecer', 'data-anim-texto': 'letra' }, [2600, 3400], corto),
  );
  correr(raiz).correr();
  const lugar = (u: Nodo) => Number(/--gm-u:([\d.]+)/.exec(u.getAttribute('style') ?? '')?.[1]);
  const us = unidades(largo);
  assert.equal(us.length, 140, 'el título largo se partió');
  const ultimo = lugar(us[us.length - 1]);
  assert.ok(150 + ultimo * 35 + 700 <= 5000, `el último pedazo termina a los ${150 + ultimo * 35 + 700} ms`);
  assert.ok(ultimo > lugar(us[0]), 'siguen entrando de a uno, en orden');
  assert.deepEqual(unidades(corto).map((u) => u.getAttribute('style')), ['--gm-u:0', '--gm-u:1', '--gm-u:2', '--gm-u:3'], 'uno corto no cambia');
});

// Revisión de la tanda 8 (16/10/2026): (a) un título con un enlace o un botón adentro no se parte (los pedazos van
// aria-hidden y el enlace se quedaba sin nombre accesible); (b) el observador entra con threshold 0: con 0.06, una
// sección más alta que ~16 pantallas no llegaba nunca a mostrar el 6 % y quedaba en opacity 0 para siempre.
// Roturas (a mano y restaurado; base en verde: 19 / 0 en este archivo):
//   · partirTitulos sin la guarda del enlace ............................................. 18 / 1 (éste)
//   · el observador de vuelta con threshold: 0.06 ........................................ 18 / 1 (éste)
test('un título con un enlace no se parte, y el observador entra con threshold 0 (una sección muy alta no queda escondida)', () => {
  const conEnlace = el('h2', {}, el('a', { href: '#agenda' }, 'Agenda tu llamada'));
  const conBoton = el('h3', {}, 'Hola ', el('button', {}, 'ver'));
  const normal = el('h2', {}, 'Sin enlace');
  const raiz = el('main', {},
    seccionDom({ 'data-anim': 'desvanecer' }, [0, 800], el('h1', {}, 'Arriba')),
    seccionDom({ 'data-anim': 'desvanecer', 'data-anim-texto': 'palabra' }, [1600, 2400], conEnlace, conBoton, normal),
  );
  correr(raiz).correr();
  assert.equal(unidades(conEnlace).length, 0, 'el título con enlace entra entero');
  assert.equal(conEnlace.getAttribute('aria-label'), null);
  assert.equal(unidades(conBoton).length, 0, 'el título con botón entra entero');
  assert.equal(unidades(normal).length, 2, 'uno sin enlace se sigue partiendo');
  assert.ok(SCRIPT_PAGINA.includes("{ rootMargin: '0px 0px -6% 0px', threshold: 0 }"), 'el observador entra con threshold 0');
});
