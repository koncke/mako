// =============================================================================
// Replicar las ANIMACIONES de una web ajena, y el aviso de lo que no se copia del scroll (tanda 8)
// =============================================================================
// Pedido de Martín (14/10/2026): «las dos cosas» y «poder replicarlas al copiar una web». Decidido el 15/10/2026
// (`landing-replicar-scroll`): al replicar una web con efectos atados al scroll que la copia no trae, UNA línea
// corta donde la persona lee el resultado: «Los efectos que siguen al scroll no se copian.».
//
// Lo que fija este archivo (lib/editor-landing/replicar-animaciones.ts y sus enchufes):
//   1. el MAPEO al catálogo: AOS y animate.css por su nombre; los keyframes, Framer y el estado en línea por la
//      forma del primer cuadro (y la vuelta: el `desde` de cada efecto del catálogo se reconoce como él mismo,
//      con las excepciones escritas);
//   2. las señales del HTML que baja el server (AOS, animate.css, Framer appear, Webflow IX2), cada una en su
//      parte; una página sin nada no trae el campo;
//   3. la réplica: el estilo es el más repetido; cada sección distinta lleva el suyo, y el render lo reproduce;
//   4. el saneo: crudo → catálogo, idempotente, con topes;
//   5. el aviso del scroll (CSS, ScrollTrigger, parallax), sin confundirlo con `overflow: scroll`;
//   6. el lector del navegador (JS_LEER_ANIMACIONES) corrido con un DOM de mentira;
//   7. los enchufes: Landing escribe estilo y efectos, Página web avisa, Presentación nada; la pantalla muestra la
//      línea al abrirse el editor; la API de MaKo la cuenta.
//
// LO QUE NO SE PUEDE PROBAR ACÁ (no hay navegador en node:test, y la regla de la máquina no deja levantar uno):
// que getAnimations() de una página real devuelva lo esperado mientras el lector baja. Lo medido antes (hallazgos,
// «Qué se puede replicar»): AOS dio 63 transiciones con 0 de 2 hojas legibles; webflow.com, 79 tweens de GSAP.
//
// PROBADO ROMPIÉNDOLO: ver el bloque «ROTURAS» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script, createContext, runInContext } from 'node:vm';
import {
  AVISO_SCROLL, ESTILO_DE_EFECTO, TOPES_ANIMACIONES,
  agruparSenales, animacionesDeReplica, appearDeFramer, claseAnimate, conAnimaciones, efectoDeSenal, estadoEnLinea,
  sanearAnimaciones, scrollEnCss, scrollEnHtml, type AnimacionesOriginal, type SenalAnimacion,
} from '../lib/editor-landing/replicar-animaciones';
import { EFECTOS, animacionDeSeccion, type DefEfecto, type Direccion } from '../lib/editor-landing/animaciones';
import { estiloDeHtml, sanearEstilo } from '../lib/editor-landing/estilo-original';
import { partesDeCadaSeccion } from '../lib/editor-landing/estilo-aplicar';
import { JS_LECTOR, JS_LEER_ANIMACIONES } from '../lib/editor-landing/lector-script';
import { NODO, type JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const BASE = 'https://www.ejemplo.com/';
const ef = (x: unknown) => { const r = efectoDeSenal(x); return r ? `${r.efecto}${r.direccion ? `:${r.direccion}` : ''}` : null; };

// ── 1. El mapeo ───────────────────────────────────────────────────────────────

test('AOS por su nombre: fade-left viene de la DERECHA, zoom-out es Pisotón, slide no funde', () => {
  assert.equal(ef({ aos: 'fade' }), 'desvanecer');
  assert.equal(ef({ aos: 'fade-up' }), 'subir');
  assert.equal(ef({ aos: 'fade-down' }), 'caer');
  assert.equal(ef({ aos: 'fade-left' }), 'deslizar:derecha', 'AOS arranca fade-left en translate3d(100px,0,0)');
  assert.equal(ef({ aos: 'fade-right' }), 'deslizar:izquierda');
  assert.equal(ef({ aos: 'fade-up-right' }), 'subir', 'las diagonales van por su vertical');
  assert.equal(ef({ aos: 'zoom-in' }), 'crecer');
  assert.equal(ef({ aos: 'zoom-out' }), 'pisoton', 'entra desde MÁS grande: Aparecer invertiría el movimiento');
  assert.equal(ef({ aos: 'flip-left' }), 'voltear');
  assert.equal(ef({ aos: 'slide-up' }), 'deslizar:abajo');
  assert.equal(ef({ aos: 'FADE-UP ' }), 'subir', 'sin importar mayúsculas ni espacios');
  assert.equal(ef({ aos: 'fade-zoom-in' }), 'crecer', 'una variante propia, por sus palabras');
  assert.equal(ef({ aos: 'mi-efecto' }), null);
});

test('animate.css: la 4 con prefijo, la 3 con «animated» y WOW; sólo las entradas', () => {
  assert.equal(claseAnimate('animate__animated animate__delay-1s animate__fadeInUp'), 'fadeInUp');
  assert.equal(claseAnimate('animated zoomIn'), 'zoomIn');
  assert.equal(claseAnimate('wow slideInLeft'), 'slideInLeft');
  assert.equal(claseAnimate('fadeInUp boton'), '', 'sin el marcador, una clase con ese nombre no es animate.css');
  assert.equal(claseAnimate('animate__animated animate__pulse'), '', 'las de atención se repiten: no son una entrada');
  assert.equal(ef({ ac: 'fadeInLeft' }), 'deslizar:izquierda');
  assert.equal(ef({ ac: 'bounceIn' }), 'elastico');
  assert.equal(ef({ ac: 'bounceInUp' }), 'rebote');
  assert.equal(ef({ ac: 'flipInX' }), 'voltear');
  assert.equal(ef({ ac: 'rotateInDownLeft' }), 'balanceo');
  assert.equal(ef({ ac: 'fadeOut' }), null, 'una salida no es de una página que carga');
});

test('la forma del primer cuadro: keyframes, Framer y las propiedades sueltas', () => {
  const kf = (o: Record<string, string>) => ef({ kf: o });
  assert.equal(kf({ o: '0' }), 'desvanecer');
  assert.equal(kf({ o: '0', t: 'matrix(1, 0, 0, 1, 0, 100)' }), 'subir', 'una transición de AOS: el navegador da la matriz');
  assert.equal(kf({ o: '0', t: 'translate3d(0px, -30px, 0px)' }), 'caer');
  assert.equal(kf({ o: '0', t: 'translateX(-48px)' }), 'deslizar:izquierda');
  assert.equal(kf({ t: 'translate3d(100%, 0px, 0px)' }), 'deslizar:derecha', 'el % cuenta por su sentido');
  assert.equal(kf({ t: 'translateY(100%)' }), 'deslizar:abajo', 'vertical sin fundido: Deslizar, no Subir');
  assert.equal(kf({ o: '0', t: 'scale(0.6)' }), 'crecer');
  assert.equal(kf({ o: '0', t: 'scale(0.85)' }), 'aparecer');
  assert.equal(kf({ o: '0', t: 'scale(1.2)' }), 'pisoton');
  assert.equal(kf({ o: '0', t: 'matrix3d(1, 0, 0, 0, 0, 0.34, -0.94, 0.0012, 0, 0.94, 0.34, -0.0004, 0, 0, 0, 1)' }), 'voltear', 'perspective + rotateX como matriz');
  assert.equal(kf({ c: 'inset(0px 100% 0px 0px)' }), 'barrido:izquierda');
  assert.equal(kf({ c: 'inset(0 50% 0 50%)' }), 'telon');
  assert.equal(kf({ c: 'circle(0% at 50% 50%)' }), 'iris');
  assert.equal(kf({ o: '0', f: 'blur(10px)' }), 'enfoque');
  assert.equal(kf({ o: '0', tr: '0px 40px' }), 'subir', 'la propiedad suelta `translate`');
  assert.equal(kf({ sc: '0.5' }), 'crecer');
  assert.equal(kf({ ro: 'x 80deg' }), 'voltear');
  assert.equal(kf({ o: '1', t: 'none' }), null, 'no esconde ni mueve: no es una entrada');
  assert.equal(kf({ o: '1', t: 'translate(1px, 2px)' }), null, 'un par de píxeles no es un movimiento');
  assert.equal(ef({ fr: { opacity: 0.001, x: 0, y: 10, scale: 1 } }), 'subir', 'el `initial` de Framer');
  assert.equal(ef({ fr: { opacity: 0.001, scale: 0.6 } }), 'crecer');
  assert.equal(ef({ fr: { opacity: 1, x: 0, y: 0 } }), null);
});

// El `desde` de cada efecto del catálogo, leído como el primer cuadro, se reconoce como ÉL MISMO. Las excepciones,
// escritas: Rebote y Elástico se distinguen de Subir y Crecer sólo por la curva (no viaja); Deriva es una diagonal
// (va por su vertical); y Deslizar arriba/abajo CON fundido tiene la forma de Caer/Subir (se decidió por el sentido:
// «fade-up» es Subir, como en AOS, y no por los píxeles).
test('la vuelta: el primer cuadro de cada efecto del catálogo se reconoce como él mismo (con las excepciones escritas)', () => {
  const comoKf = (css: string) => {
    const o: Record<string, string> = {};
    for (const d of css.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const p = d.slice(0, i).trim();
      const v = d.slice(i + 1).trim();
      const k = ({ opacity: 'o', transform: 't', 'clip-path': 'c', filter: 'f' } as Record<string, string>)[p];
      if (k) o[k] = v;
    }
    return o;
  };
  const EXCEPCIONES: Record<string, string> = {
    rebote: 'subir', elastico: 'crecer', deriva: 'subir', 'deslizar:arriba': 'caer', 'deslizar:abajo': 'subir',
  };
  let vistos = 0;
  for (const e of EFECTOS as readonly DefEfecto[]) {
    const casos: [string, string][] = typeof e.desde === 'string'
      ? [[e.id, e.desde]]
      : (e.direcciones ?? []).map((d) => [`${e.id}:${d}`, (e.desde as Record<string, string>)[d]]);
    for (const [id, css] of casos) {
      vistos++;
      assert.equal(ef({ kf: comoKf(css) }), EXCEPCIONES[id] ?? id, `«${id}» (${css}) no se reconoce`);
    }
  }
  assert.equal(vistos, 23, 'los 17 efectos, con las 4 direcciones de Deslizar y de Barrido');
});

// ── 2. Las señales del HTML que baja el server ────────────────────────────────

const HTML_ANIMADO = `<!doctype html><html><head>
<style>body{background:#ffffff;color:#111111;font-family:Inter}</style>
<script type="framer/appear" id="__framer__appearAnimationsContent">{"abc1":{"default":{"initial":{"opacity":0.001,"x":0,"y":10,"scale":1},"animate":{"opacity":1,"y":0}}},"roto":{"x":{"y":{"z":{"w":{"v":{"initial":{"opacity":0}}}}}}}}</script>
<script type="framer/appear" id="__framer__breakpoints">[{"hash":"x","mediaQuery":"(min-width: 1200px)"}]</script>
</head><body>
<nav><a data-aos="fade-down" href="/">Logo</a><h2>Menú</h2></nav>
<header><h1 class="animate__animated animate__fadeInDown">Crece tu negocio hoy</h1>
<p class="animate__animated animate__fadeInDown">Bajada del título principal de la página.</p>
<img data-aos="zoom-in" src="/hero.jpg" width="800" height="400"></header>
<section><div data-aos="fade-up"><h2>Cómo trabajamos</h2><p>Texto de la sección.</p></div>
<div data-aos="fade-up"><p>Otra tarjeta</p></div><div data-aos="fade-up"><p>Y otra</p></div></section>
<section><h2>Resultados</h2><div data-framer-appear-id="abc1" style="opacity:0.001;transform:translateY(10px)">A</div><div data-framer-appear-id="abc1">B</div></section>
<section><h2>Testimonios</h2><div data-w-id="77" style="opacity:0;-webkit-transform:translate3d(-50PX, 0, 0) scale3d(1, 1, 1);transform:translate3d(-50PX, 0, 0) scale3d(1, 1, 1)">C</div></section>
<section><h2>Preguntas</h2><div class="wow fadeInRight">D</div><div class="fadeInUp">sin «animated» ni «wow» no cuenta</div></section>
</body></html>`;

const resumen = (a: AnimacionesOriginal | undefined) => (a?.senales ?? []).map((s) => `${s.parte}:${s.efecto}${s.direccion ? `:${s.direccion}` : ''}×${s.veces}`);

test('el HTML del server: AOS, animate.css, Framer appear y Webflow, cada uno en su parte (lo del <nav> no)', () => {
  const e = estiloDeHtml(HTML_ANIMADO, BASE);
  assert.deepEqual(e.secciones.map((s) => s.titulo), ['Crece tu negocio hoy', 'Cómo trabajamos', 'Resultados', 'Testimonios', 'Preguntas']);
  assert.deepEqual(resumen(e.animaciones), [
    '0:caer×2',                     // el h1 y su bajada (animate.css 4)
    '0:crecer×1',                   // la imagen del hero (AOS, una etiqueta vacía: va con el último título)
    '1:subir×3',                    // el envoltorio con data-aos que TRAE el título es de esa parte, y sus dos hermanas
    '2:subir×2',                    // Framer appear: por el JSON (no por el `style`, que sólo trae el primero)
    '3:deslizar:izquierda×1',       // Webflow IX2: el estado inicial escrito en línea (con «PX»)
    '4:deslizar:derecha×1',         // WOW + animate.css 3; «fadeInUp» suelto no cuenta
  ]);
  assert.equal(e.animaciones?.scroll, false);
  const f = appearDeFramer(HTML_ANIMADO);
  assert.deepEqual([...f.keys()], ['abc1'], 'el arreglo de los cortes no aporta; anidado más de 4 niveles, tampoco');
  assert.deepEqual(estadoEnLinea('opacity:1;transform:none'), null);
});

test('una página sin animaciones: ni el campo, y la réplica queda con el default', () => {
  const e = estiloDeHtml('<html><body style="background:#fff"><h1>Hola mundo</h1><p>Un texto cualquiera.</p></body></html>', BASE);
  assert.ok(!('animaciones' in e), 'sin señales ni scroll, el campo no va');
  const r = animacionesDeReplica(e.animaciones, [[0], []]);
  assert.deepEqual(r, { estilo: null, porSeccion: [null, null], avisoScroll: false });
  assert.deepEqual(animacionesDeReplica(null, []), { estilo: null, porSeccion: [], avisoScroll: false });
});

// ── 3. La réplica ─────────────────────────────────────────────────────────────

const s = (parte: number, efecto: SenalAnimacion['efecto'], veces = 1, direccion: Direccion | null = null): SenalAnimacion => ({ parte, efecto, direccion, veces });
const tarjetas = (n: number): JsonNodo[] => Array.from({ length: n }, (_, i) => ({ type: NODO.tarjeta, attrs: { id: `t${i}`, animacion: null, animacionDireccion: null }, content: [] }));

test('la réplica: el estilo es el más repetido; cada sección distinta lleva el suyo, y el render lo reproduce', () => {
  const e = estiloDeHtml(HTML_ANIMADO, BASE);
  const partes = partesDeCadaSeccion([0, 1, 2, 3, 4], e.secciones.length);
  const r = animacionesDeReplica(e.animaciones, partes);
  assert.equal(r.estilo, 'subir', 'Subir domina 2 partes y Deslizar 2: gana el de más veces (5 contra 2)');
  assert.deepEqual(r.porSeccion, [
    { animacion: 'caer', animacionDireccion: null },
    null, null,
    { animacion: 'deslizar', animacionDireccion: 'izquierda' },
    { animacion: 'deslizar', animacionDireccion: 'derecha' },
  ]);
  const t = tarjetas(5);
  const { tarjetas: con, propias } = conAnimaciones(t, r.porSeccion);
  assert.equal(propias, 3);
  assert.equal(t[0].attrs!.animacion, null, 'no muta la entrada');
  // Lo que dibuja el render (animacionDeSeccion) es el efecto dominante de cada parte de la original.
  const esperado = ['caer', 'subir', 'subir', 'deslizar:izquierda', 'deslizar:derecha'];
  con.forEach((x, i) => {
    const a = animacionDeSeccion(x.attrs!, { animaciones: true, estiloAnimacion: r.estilo }, i);
    assert.equal(`${a.efecto}${a.direccion && a.efecto === 'deslizar' ? `:${a.direccion}` : ''}`, esperado[i], `sección ${i}`);
  });
});

test('la réplica: «alterna» ya alterna; sin estilo de página, el que sí tiene; sin sección reconocida, sólo el estilo', () => {
  const alterna = animacionesDeReplica({
    senales: [s(0, 'deslizar', 2, 'izquierda'), s(1, 'deslizar', 2, 'derecha'), s(2, 'deslizar', 1, 'izquierda'), s(3, 'deslizar', 1, 'izquierda')], scroll: false,
  }, [[0], [1], [2], [3]]);
  assert.deepEqual(alterna, {
    estilo: 'deslizar', avisoScroll: false,
    porSeccion: [null, null, null, { animacion: 'deslizar', animacionDireccion: 'izquierda' }],
  }, 'la original alternaba hasta la tercera: nada propio; la cuarta (impar) entraba por la izquierda, y «alterna» le daría la derecha');
  const caer = animacionesDeReplica({ senales: [s(0, 'caer', 3), s(1, 'caer', 3), s(2, 'desvanecer')], scroll: true }, [[0], [1], [2]]);
  assert.equal(caer.estilo, 'desvanecer', 'Caer no tiene «Animación de página»: el estilo es el que sí');
  assert.deepEqual(caer.porSeccion, [{ animacion: 'caer', animacionDireccion: null }, { animacion: 'caer', animacionDireccion: null }, null]);
  assert.equal(caer.avisoScroll, true);
  const porPartes = animacionesDeReplica({ senales: [s(0, 'aparecer', 10), s(1, 'subir'), s(2, 'subir'), s(3, 'subir')], scroll: false }, []);
  assert.equal(porPartes.estilo, 'subir', 'el estilo es el que domina MÁS PARTES (3), no el de más elementos (una galería de 10)');
  const sinAsig = animacionesDeReplica({ senales: [s(0, 'aparecer'), s(1, 'aparecer')], scroll: false }, [[], []]);
  assert.deepEqual(sinAsig, { estilo: 'aparecer', porSeccion: [null, null], avisoScroll: false });
  assert.deepEqual(ESTILO_DE_EFECTO, { desvanecer: 'desvanecer', subir: 'subir', aparecer: 'aparecer', deslizar: 'deslizar', barrido: 'barrido', enfoque: 'enfoque' },
    'los de texto (Palabras, Máquina) parten títulos: no salen de una señal');
});

// ── 4. El saneo ───────────────────────────────────────────────────────────────

test('sanearAnimaciones: crudo → catálogo, idempotente, con topes y partes válidas', () => {
  const crudo = {
    senales: [
      { s: -1, n: 2, aos: 'fade-up' },           // antes del primer título: con la primera parte
      { s: 0, n: 1, kf: { o: '0', t: 'translateY(20px)' } }, // el mismo efecto: se suma
      { s: 1, n: 1, efecto: 'explotar' },          // no está en el catálogo
      { parte: 1, efecto: 'barrido', direccion: 'diagonal', veces: 3 }, // dirección que no ofrece: la primera
      { s: 9, n: 1, aos: 'zoom-in' },              // una parte fuera del tope de títulos
      { s: 1, n: 1e9, ac: 'zoomIn' },
      'basura', null, [1, 2],
    ],
    scroll: 'sí',
  };
  const a = sanearAnimaciones(crudo, 3)!;
  assert.deepEqual(resumen(a), ['0:subir×3', `1:crecer×${TOPES_ANIMACIONES.veces}`, '1:barrido:izquierda×3']);
  assert.equal(a.scroll, false, 'sólo `true` es true');
  assert.deepEqual(sanearAnimaciones(JSON.parse(JSON.stringify(a)), 3), a, 'no es idempotente: el server lo vuelve a sanear');
  // 60 partes × 5 efectos distintos = 300 señales: entran las 60 más repetidas.
  const muchas = { senales: Array.from({ length: 300 }, (_, i) => ({ s: i % 60, n: 1 + (i % 7), aos: ['fade', 'fade-up', 'zoom-in', 'flip-up', 'fade-left'][Math.floor(i / 60)] })) };
  const m = sanearAnimaciones(muchas, 60)!;
  assert.equal(m.senales.length, TOPES_ANIMACIONES.senales);
  assert.deepEqual(sanearAnimaciones(JSON.parse(JSON.stringify(m)), 60), m);
  assert.equal(sanearAnimaciones({ senales: [] }, 3), null);
  assert.equal(sanearAnimaciones('x', 3), null);
  assert.deepEqual(sanearAnimaciones({ senales: [], scroll: true }, 0), { senales: [], scroll: true }, 'sólo el aviso también viaja');
  // Por el canal del estilo: sanearEstilo lo lleva y es idempotente con él.
  const est = sanearEstilo({ fondo: 'rgb(255, 255, 255)', texto: '#111', secciones: [{ titulo: 'A' }, { titulo: 'B' }], animaciones: crudo })!;
  assert.deepEqual(resumen(est.animaciones), ['0:subir×3', `1:crecer×${TOPES_ANIMACIONES.veces}`, '1:barrido:izquierda×3']);
  assert.deepEqual(sanearEstilo(JSON.parse(JSON.stringify(est))), est);
  assert.deepEqual(agruparSenales([{ seccion: 2, senal: { aos: 'fade' } }, { seccion: 2, senal: { aos: 'fade' } }]), [{ aos: 'fade', s: 2, n: 2 }]);
});

// ── 5. El aviso del scroll ────────────────────────────────────────────────────

test('el scroll: animation-timeline, ScrollTrigger y parallax sí; overflow: scroll o la palabra en el texto, no', () => {
  assert.equal(scrollEnCss('.a{animation:sube linear both;animation-timeline:view()}'), true);
  assert.equal(scrollEnCss('.b { view-timeline: --tarjeta block; }'), true);
  assert.equal(scrollEnCss('.c{animation-timeline:auto} .d{scroll-timeline:none}'), false, 'lo que no ata nada no cuenta');
  assert.equal(scrollEnCss('html{scroll-behavior:smooth;overflow-y:scroll} .e{scroll-snap-type:y mandatory}'), false);
  assert.equal(scrollEnHtml('<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>'), true);
  assert.equal(scrollEnHtml('<script>gsap.to(".x", { y: 100, scrollTrigger: { scrub: true } })</script>'), true);
  assert.equal(scrollEnHtml('<div data-scroll-speed="2">x</div>'), true, 'Locomotive');
  assert.equal(scrollEnHtml('<img class="foto rellax" src="a.jpg">'), true);
  assert.equal(scrollEnHtml('<section data-parallax="scroll" data-image-src="a.jpg"></section>'), true);
  assert.equal(scrollEnHtml('<div style="animation-timeline: scroll(root)">x</div>'), true);
  assert.equal(scrollEnHtml('<p>Haz scroll para ver más. El trigger es tuyo.</p><div style="overflow:scroll"></div><div data-speed-x="2"></div>'), false);
  assert.equal(scrollEnHtml(HTML_ANIMADO), false);
  // Por el estilo: el `animation-timeline` en la HOJA que bajó el server también cuenta.
  const e = estiloDeHtml('<html><body style="background:#fff"><h1>Hola</h1></body></html>', BASE, ['.hero{animation-timeline:view()}']);
  assert.deepEqual(e.animaciones, { senales: [], scroll: true });
  assert.equal(AVISO_SCROLL, 'Los efectos que siguen al scroll no se copian.');
  assert.ok(AVISO_SCROLL.length <= 50, 'UNA línea corta');
});

// ── 6. El lector del navegador, con un DOM de mentira ─────────────────────────

type ElFalso = { nodeType: 1; isConnected: boolean; style: { opacity: string; transform: string }; attrs: Record<string, string>; parte: number; getAttribute: (k: string) => string | null; hasAttribute: (k: string) => boolean; closest: (s: string) => unknown };
function elFalso(attrs: Record<string, string>, parte: number, style: Partial<ElFalso['style']> = {}, fuera = false): ElFalso {
  return {
    nodeType: 1, isConnected: true, style: { opacity: '', transform: '', ...style }, attrs, parte,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k) => k in attrs,
    closest: () => (fuera ? {} : null),
  };
}

/** La línea de tiempo del documento (la de siempre): una animación con OTRA que tenga `source` sigue al scroll. */
const TL = { currentTime: 0 };

function lectorConDom(p: { elementos: ElFalso[]; animaciones: unknown[]; framer?: string; scripts?: { src?: string; texto?: string }[] }) {
  const document = {
    timeline: TL,
    documentElement: { scrollHeight: 2000 },
    body: null,
    scripts: (p.scripts ?? []).map((x) => ({ getAttribute: (k: string) => (k === 'src' ? x.src ?? null : null), textContent: x.texto ?? '' })),
    querySelector: () => null,
    querySelectorAll: (sel: string) => (sel.includes('framer/appear') ? (p.framer ? [{ textContent: p.framer }] : []) : p.elementos),
    getAnimations: () => p.animaciones,
  };
  const ctx = createContext({ document, window: { innerHeight: 800 } });
  const fabrica = runInContext(`(${JS_LEER_ANIMACIONES})`, ctx) as (sel: string) => {
    delDom: () => void; mirar: () => void; resumen: (parteDe: (el: ElFalso) => number) => { senales: Record<string, unknown>[]; scroll: boolean };
  };
  return { anim: fabrica('nav') };
}

const animacion = (target: ElFalso, cuadros: Record<string, unknown>[], extra: { timeline?: unknown; iterations?: number; duration?: number } = {}) => ({
  timeline: extra.timeline,
  effect: { target, getTiming: () => ({ iterations: extra.iterations ?? 1, duration: extra.duration ?? 600 }), getKeyframes: () => cuadros },
});

test('el lector: data-aos y animate.css del DOM, Framer por el JSON, y getAnimations sólo para las entradas', () => {
  const aos = elFalso({ 'data-aos': 'fade-up' }, 1);
  const aos2 = elFalso({ 'data-aos': 'fade-up' }, 1);
  const anim4 = elFalso({ class: 'animate__animated animate__zoomIn' }, 2);
  const framer = elFalso({ 'data-framer-appear-id': 'f1' }, 0);
  const webflow = elFalso({ 'data-w-id': 'w' }, 3, { opacity: '0', transform: 'translate3d(0px, 50px, 0px)' });
  const enNav = elFalso({ 'data-aos': 'fade-down' }, 0, {}, true);
  const transicion = elFalso({}, 4);
  const lazo = elFalso({}, 4);
  const salida = elFalso({}, 4);
  const velo = elFalso({}, 4);
  const conTimeline = elFalso({}, 4);
  const { anim } = lectorConDom({
    elementos: [aos, aos2, anim4, framer, webflow, enNav],
    framer: JSON.stringify({ f1: { d: { initial: { opacity: 0.001, scale: 0.85 } } } }),
    animaciones: [
      // AOS por transiciones: dos animaciones del MISMO elemento (opacidad y transform) se juntan en un cuadro.
      animacion(transicion, [{ computedOffset: 0, opacity: '0' }, { computedOffset: 1, opacity: '1' }], { timeline: TL }),
      animacion(transicion, [{ computedOffset: 0, transform: 'matrix(1, 0, 0, 1, -100, 0)' }, { computedOffset: 1, transform: 'none' }], { timeline: TL }),
      animacion(lazo, [{ computedOffset: 0, opacity: '0' }, { computedOffset: 1, opacity: '1' }], { timeline: TL, iterations: Infinity }),
      animacion(salida, [{ computedOffset: 0, opacity: '1' }, { computedOffset: 1, opacity: '0' }], { timeline: TL }),
      // Un velo (el fondo de un modal) que llega al 60 %: empieza escondido pero no termina en su estado natural.
      animacion(velo, [{ computedOffset: 0, opacity: '0' }, { computedOffset: 1, opacity: '0.6' }], { timeline: TL }),
      animacion(conTimeline, [{ computedOffset: 0, opacity: '0' }, { computedOffset: 1, opacity: '1' }], { timeline: { source: {} } }),
      animacion(aos, [{ computedOffset: 0, opacity: '0' }, { computedOffset: 1, opacity: '1' }], { timeline: TL }),
    ],
  });
  anim.delDom();
  anim.mirar();
  const r = anim.resumen((el) => el.parte);
  assert.equal(r.scroll, true, 'una animación con línea de tiempo de scroll');
  const a = sanearAnimaciones(JSON.parse(JSON.stringify(r)), 5)!;
  assert.deepEqual(resumen(a), [
    '0:aparecer×1',               // Framer por el JSON
    '1:subir×2',                  // data-aos (su transición no se cuenta otra vez)
    '2:crecer×1',                 // animate.css 4
    '3:subir×1',                  // Webflow: el estado escrito en línea
    '4:deslizar:izquierda×1',     // las dos transiciones juntas; el lazo, la salida y el velo no son entradas
  ]);
  assert.ok(r.senales.every((x) => JSON.stringify(x).length < 300), 'un resumen chico por señal');
});

test('el lector: el resumen tiene tope (60 señales, 6.000 caracteres) y la página no corre nada', () => {
  const muchos = Array.from({ length: 200 }, (_, i) => elFalso({ 'data-aos': `fade-up-${'x'.repeat(i % 50)}${i}` }, i % 60));
  const { anim } = lectorConDom({ elementos: muchos, animaciones: [] });
  anim.delDom();
  const r = anim.resumen((el) => el.parte);
  assert.ok(r.senales.length <= 60);
  assert.ok(JSON.stringify(r.senales).length <= 6_000 + 200, `${JSON.stringify(r.senales).length} caracteres`);
  for (const js of [JS_LEER_ANIMACIONES, JS_LECTOR]) {
    assert.doesNotMatch(js, /\beval\s*\(|new\s+Function\b|setTimeout\s*\(\s*['"]/, 'nada de correr código de la página');
    assert.doesNotThrow(() => new Script(`(${js});`));
  }
  const conScripts = lectorConDom({ elementos: [], animaciones: [], scripts: [{ src: 'https://cdn.x.com/ScrollTrigger.min.js' }] });
  conScripts.anim.delDom();
  assert.equal(conScripts.anim.resumen(() => 0).scroll, true, 'ScrollTrigger visto por su script, sin llamarlo');
});

// ── 7. Los enchufes ───────────────────────────────────────────────────────────

test('el lector: mira en cada paso de la bajada SIN esperas nuevas, manda el resumen en el estilo y sigue soltando el opener', () => {
  const js = JS_LECTOR;
  assert.ok(js.indexOf('try { window.opener = null; } catch (e) {}') > 0, 'el opener se sigue soltando al arrancar');
  assert.match(js, /await esperar\(60\);\s*if \(alPaso\) alPaso\(\);/, 'getAnimations en cada paso que ya existía');
  assert.match(js, /await bajarYSubir\(anim \? function \(\) \{ conAnim\(function \(x\) \{ x\.mirar\(\); \}\); \} : null\);/);
  const iDom = js.indexOf('x.delDom(); x.mirar(); x.vigilar(\'scroll\');');
  assert.ok(iDom > 0 && iDom < js.indexOf('await bajarYSubir('), 'lo del DOM, ANTES de bajar (lo de abajo todavía no se animó)');
  assert.ok(js.indexOf('await anim.probar(irA, esperar)') < js.indexOf('estiloLeido = leerEstilo()'), 'el scroll se decide antes de leer el estilo');
  assert.match(js, /if \(anim && !tarde\(\)\) \{/, 'la prueba del scroll no pasa el tope');
  assert.match(js, /e\.animaciones = ra;/);
  assert.match(js, /sumarImagen\(su, parteDe\(el\), false, ri\);/, 'las imágenes y las animaciones, con la MISMA parte');
});

test('replicar.ts: Landing escribe estilo y efectos, Página web avisa, Presentación nada', () => {
  const rep = sinComentarios(leer('lib/editor-landing/replicar.ts'));
  const bloques = rep.slice(rep.indexOf('async function replicarComoBloques'));
  assert.match(bloques, /const anim = receta\.formato === 'landing' && estilo \? animacionesDeReplica\(estilo\.animaciones, partesDeCadaSeccion\(asig, estilo\.secciones\.length\)\) : null;/,
    'sólo como Landing; la Presentación, nada');
  assert.match(bloques, /\.\.\.\(anim\?\.estilo \? \{ pagina: \{ \.\.\.CONFIG_DEFAULT\.pagina, estiloAnimacion: anim\.estilo \} \} : \{\}\)/);
  assert.match(bloques, /conAnimaciones\(puesto\.tarjetas, anim\.porSeccion\)/);
  assert.match(bloques, /content: animadas\.tarjetas/, 'las secciones con su efecto son las que se guardan');
  assert.match(bloques, /anim\?\.avisoScroll \? AVISO_SCROLL : ''/);
  const fiel = rep.slice(rep.indexOf('async function replicarFiel'), rep.indexOf('async function replicarComoBloques'));
  assert.match(fiel, /const scrollP = scrollDeLaPagina\(html, url\);[\s\S]*crearLanding\([\s\S]*const scroll = await scrollP;/, 'se mira MIENTRAS se crea');
  assert.match(fiel, /scroll \? AVISO_SCROLL : ''/);
  assert.match(fiel, /\.\.\.\(scroll \? \{ avisoScroll: true as const \} : \{\}\)/);
  assert.match(rep, /bajarHoja\(h\)\.catch\(\(\) => ''\)/, 'las hojas con la baranda de siempre');
});

test('la pantalla: la línea se lee al abrirse el editor de la copia, una vez y nunca por la URL', () => {
  const rep = sinComentarios(leer('app/web-generator/crear/Replicar.tsx'));
  assert.match(rep, /if \(r\.avisoScroll\) dejarAvisoDeReplica\(r\.id, AVISO_SCROLL\);\s*irDuro\(`\/web-generator\/\$\{r\.id\}`, ws\);/);
  const ed = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.match(ed, /useEffect\(\(\) => \{\s*if \(avisoReplica\.current === undefined\) avisoReplica\.current = tomarAvisoDeReplica\(docId\);/,
    'en un efecto, nunca en el inicializador de useState/useRef');
  const av = sinComentarios(leer('app/web-generator/crear/aviso-replica.ts'));
  assert.match(av, /sessionStorage/);
  assert.match(av, /if \(!v \|\| v\.id !== id\) return null;/, 'abrir otra landing no la consume');
});

test('la API de MaKo: replicar_landing cuenta las animaciones copiadas y el aviso', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const i = run.search(/^ {2}replicar_landing: \{/m);
  const bloque = run.slice(i, i + 5000);
  assert.match(bloque, /r\.animaciones\s*\?\s*` Copió las animaciones/);
  assert.match(bloque, /animaciones: r\.animaciones \?\? null, aviso_scroll: r\.avisoScroll === true/);
  assert.match(bloque, /\$\{anim\}\$\{r\.aviso \? ` \$\{r\.aviso\}` : ''\}/, 'el aviso del scroll viaja en `aviso`');
  const def = leer('lib/api-mako/areas/landing.def.ts');
  assert.match(def, /los efectos que siguen al scroll no se copian en ningún formato/);
  // docs/api-mako.md es la referencia de lo que sale por HTTP: replicar_landing no sale (SIN_HTTP, tarda hasta 240 s),
  // así que regenerarla no cambia nada (`generar-api-doc.mjs`: «ya estaba al día», 15/10/2026).
  assert.ok(!leer('tests/api-mako-http.snapshot.txt').split('\n').includes('replicar_landing'));
});

test('español neutro y corto en lo que se dibuja o lee MaKo', () => {
  const textos = [AVISO_SCROLL, sinComentarios(leer('lib/api-mako/areas/landing.def.ts')).match(/En «landing» copia además[^.]*\./)?.[0] ?? ''];
  for (const t of textos) assert.doesNotMatch(t, /\b(?:tenés|podés|querés|hacé|mirá|sabés|vos)\b/i, `voseo en «${t}»`);
});

// =============================================================================
// ROTURAS
// =============================================================================
// 15/10/2026, con un arnés en el scratchpad: una rotura por vez, restaurada de MEMORIA y verificada por sha256
// (nunca git checkout). Base: 17 pasan / 0 fallan. Al final, otra vez 17 / 0. Pasan / fallan:
//    1. AOS fade-left como «desde la izquierda» (el obvio) ............... 16 / 1  «AOS por su nombre»
//    2. AOS zoom-out → Aparecer ............................................ 16 / 1  «AOS por su nombre»
//    3. la forma: vertical siempre Subir/Caer (sin mirar el fundido) ...... 16 / 1  «la forma del primer cuadro»
//    4. la forma: el recorte no se mira .................................... 15 / 2  «la forma…», «la vuelta…»
//    5. animate.css sin el marcador «animated»/«wow» ....................... 14 / 3  «animate.css», «el HTML del server», «la réplica: el estilo…»
//    6. el HTML: la señal va con el título de ANTES (sin esperar al de adentro) 16 / 1  «el HTML del server»
//    7. el HTML: lo del <nav> cuenta ....................................... 16 / 1  «el HTML del server»
//    8. la réplica: toda sección con señales lleva su efecto (no hereda) ... 15 / 2  «la réplica: el estilo…», «la réplica: alterna…»
//    9. la réplica: se compara el efecto sin la dirección .................. 16 / 1  «la réplica: alterna…»
//   10. la réplica: el estilo por veces, no por partes ..................... 16 / 1  «la réplica: alterna…» (dio 17 / 0 hasta sumar «porPartes»)
//   11. el saneo: lo de antes del primer título no va con la primera parte  16 / 1  «sanearAnimaciones»
//   12. el saneo: sin tope de señales ...................................... 16 / 1  «sanearAnimaciones»
//   13. el scroll: «animation-timeline: auto» cuenta ........................ 16 / 1  «el scroll»
//   14. el scroll: ScrollTrigger en un script no cuenta ..................... 16 / 1  «el scroll»
//   15. el lector: lo que no termina en su estado natural cuenta ............ 16 / 1  «el lector: data-aos…» (dio 17 / 0 hasta sumar el velo:
//       una salida pura empieza visible y el mapeo ya la descartaba; el velo empieza escondido y termina al 60 %)
//   16. el lector: dos animaciones del mismo elemento no se juntan ......... 16 / 1  «el lector: data-aos…»
//   17. el lector: la línea de tiempo de scroll no se mira ................. 16 / 1  «el lector: data-aos…»
//   18. el lector: lo del DOM DESPUÉS de bajar ............................. 16 / 1  «el lector: mira en cada paso…»
//   19. replicar.ts: las animaciones también en la Presentación ............ 16 / 1  «replicar.ts»
//   20. replicar.ts: la copia fiel espera el scroll ANTES de crear .......... 16 / 1  «replicar.ts»
//   21. la pantalla: no deja la línea para el editor ........................ 16 / 1  «la pantalla»
//   22. la pantalla: otra landing consume la línea .......................... 16 / 1  «la pantalla»
//   23. la API: sin aviso_scroll en los datos ............................... 16 / 1  «la API de MaKo»
// Y el tsc acotado (los 13 archivos tocados) dio 0; con un estilo que no existe metido en replicar.ts, TS2322.

// Revisión de la tanda 8 (16/10/2026): buscar efectos de scroll en el HTML era cuadrático con «<a » repetido sin cerrar
// (240 KB → 43 s, medido) y trababa el server, que baja hasta 5 MB al replicar. Ahora es una pasada lineal por etiqueta.
// Roturas (a mano y restaurado; base en verde: 18 / 0): las regex acotadas a 2.000 de antes ... 17 / 1 (éste, por tiempo);
// saltar entero el tramo de un «<» suelto sin cerrar (se tragaba la etiqueta real de después) ... 17 / 1 (éste).
test('buscar efectos de scroll en un HTML hostil de 1 MB tarda menos de 1,5 s, y sigue encontrando lo de verdad', () => {
  const hostil = '<a '.repeat(350_000);
  const t = Date.now();
  assert.equal(scrollEnHtml(hostil), false);
  assert.equal(scrollEnHtml(hostil + '>'), false);
  const ms = Date.now() - t;
  assert.ok(ms < 1500, `tardó ${ms} ms`);
  assert.equal(scrollEnHtml(hostil + '<section data-parallax="scroll">'), true, 'lo que viene después de la basura se sigue viendo');
});
