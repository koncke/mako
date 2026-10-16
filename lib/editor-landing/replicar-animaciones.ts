// =============================================================================
// editor-landing/replicar-animaciones — las animaciones de una página de AFUERA, al catálogo (tanda 8)
// =============================================================================
// Pedido de Martín (14/10/2026), a «¿cuál de los dos frentes?»: «las dos cosas» (las animaciones de la
// página y el video de fondo) y «poder replicarlas al copiar una web». Decidido el 15/10/2026
// (`landing-replicar-scroll`, docs/hallazgos-editor-landing.md → «Etapas propuestas»): al replicar una web
// con efectos atados al scroll que la copia no trae, se avisa con UNA línea corta donde la persona lee el
// resultado (`AVISO_SCROLL`).
//
// Lo medido (mismo documento, «Qué se puede replicar de una web ajena»): FIEL = las animaciones y
// transiciones CSS (getAnimations() da los keyframes aunque la hoja sea de otro origen), AOS (data-aos),
// animate.css (la clase), Framer appear (el JSON <script type=framer/appear>) y el estado inicial que Webflow
// IX2 deja escrito en el HTML; APROXIMADO = transforms cuadro a cuadro, GSAP con pin, texto por palabra;
// NO = canvas/WebGL, Lottie/Rive/video ajenos, y lo atado al scroll.
//
// Tres piezas, PURAS (sin server-only ni DOM: lo importan estilo-original.ts —que también corre en el
// navegador—, lector-script.ts, replicar.ts y el test):
//   1. LAS SEÑALES. Llegan crudas (`SenalCruda`) de dos lados y viajan en `EstiloOriginal.animaciones`: el
//      mismo canal y los MISMOS índices de parte que los títulos y las imágenes del estilo, así que la
//      sección de la réplica que es cuál de la original sale del mismo `asignarSecciones`:
//        · el lector del navegador (lector-script.ts, `JS_LEER_ANIMACIONES`): data-aos, la clase de
//          animate.css, el JSON de Framer, el estado inicial en línea y el primer cuadro de lo que da
//          getAnimations() por elemento, agrupado por parte con su cuenta;
//        · el HTML que baja el server (`estiloDeHtml`): lo mismo menos getAnimations, etiqueta por etiqueta
//          (`senalDeEtiqueta`).
//      `sanearAnimaciones` las pasa al catálogo y las deja con forma y topes (dos veces da lo mismo).
//   2. EL MAPEO al catálogo (`efectoDeSenal`): AOS y animate.css por su NOMBRE; Framer, el estado en línea y
//      los keyframes por la FORMA del primer cuadro (opacidad, traslado, escala, giro, recorte, desenfoque).
//      Nunca un efecto que no esté en EFECTOS (animaciones.ts).
//   3. LA RÉPLICA (`animacionesDeReplica`): el ESTILO de la landing es el efecto más repetido entre las
//      partes de la original (de los que tienen «Animación de página»); cada sección de la réplica cuyo
//      efecto no es el que le daría ese estilo lleva el suyo, saneado con `cambiosAlElegir` (la misma regla
//      que el panel «Animar» y la API). Sin señales, nada: la landing nace con el default.
// Y el AVISO del scroll (`scrollEnHtml` acá; en el navegador, `JS_LEER_ANIMACIONES`).
//
// ⚠️ NUNCA SE CORRE NADA DE LA PÁGINA: el JSON de Framer se lee con JSON.parse (un parser de datos), Webflow
//    IX2 sólo por el estado inicial que su HTML ya trae escrito, y de un script sólo se mira si NOMBRA a
//    ScrollTrigger. Nada de eval ni new Function, y ningún recurso ajeno (Lottie, video, imagen) por acá.
// =============================================================================

import {
  DIRECCIONES, ESTILOS_PAGINA, ESTILO_DEFAULT, IDS_EFECTO,
  animacionDeSeccion, cambiosAlElegir, efectoPorId, esEfecto, sanearDireccion,
  type AnimacionSeccion, type DefEstilo, type Direccion, type IdEfecto, type IdEstilo,
} from './animaciones';
import { NODO, type JsonNodo } from './doc';

// ─────────────────────────────────────────────────────────────────────────────
// El contrato
// ─────────────────────────────────────────────────────────────────────────────

/** Una señal ya en el catálogo: en qué parte de la original (índice de `EstiloOriginal.secciones`), qué efecto, cuántas veces. */
export type SenalAnimacion = { parte: number; efecto: IdEfecto; direccion: Direccion | null; veces: number };

/** Lo que se sabe de las animaciones de la original. `scroll`: tenía efectos atados al scroll (la copia no los trae). */
export type AnimacionesOriginal = { senales: SenalAnimacion[]; scroll: boolean };

/**
 * Una señal CRUDA (la arman el lector del navegador y el recorrido del HTML), sin la parte. Una sola fuente
 * por elemento, en este orden de confianza:
 *   · `aos`: el valor de data-aos («fade-up»);
 *   · `ac`: la clase de animate.css sin el prefijo («fadeInUp»);
 *   · `fr`: el `initial` de Framer appear (opacity, x, y, scale, rotate, rotateX, rotateY);
 *   · `kf`: el PRIMER cuadro (o el estado inicial escrito en línea), como lo da el navegador: `o` opacity,
 *     `t` transform, `tr` translate, `sc` scale, `ro` rotate, `c` clip-path, `f` filter.
 */
export type SenalCruda = { aos?: string; ac?: string; fr?: Record<string, unknown>; kf?: Record<string, unknown> };

export const TOPES_ANIMACIONES = {
  /** Señales que se guardan (una por parte y efecto). */
  senales: 60,
  /** Señales crudas que se leen de un pedido (las de más se ignoran). */
  crudas: 1_000,
  veces: 9_999,
  /** Un valor CSS crudo (un transform, un clip-path). */
  valor: 160,
  /** Un nombre de AOS o de animate.css. */
  nombre: 60,
  /** El texto de un <script type=framer/appear> que se lee (más es otra cosa). */
  framer: 500_000,
  /** Los ids de Framer que se miran. */
  idsFramer: 2_000,
} as const;

/**
 * La línea del resultado de Replicar (decidido el 15/10/2026, `landing-replicar-scroll`): la dice el resultado
 * («aviso») y la ve la persona al abrirse el editor de la copia. Corta a propósito: lo que no se copia y nada más.
 */
export const AVISO_SCROLL = 'Los efectos que siguen al scroll no se copian.';

/** Un efecto del catálogo con su dirección (null si el efecto no ofrece). */
export type EfectoDireccion = { efecto: IdEfecto; direccion: Direccion | null };

const con = (efecto: IdEfecto, direccion: Direccion | null = null): EfectoDireccion => ({ efecto, direccion });

// ─────────────────────────────────────────────────────────────────────────────
// 2. El mapeo: AOS y animate.css por su nombre
// ─────────────────────────────────────────────────────────────────────────────
//
// Las direcciones son DE DÓNDE VIENE el elemento, como en el catálogo («Deslizar · derecha» arranca en
// translateX(48px)). AOS nombra hacia dónde va: `fade-left` arranca en translate3d(100px,0,0), así que viene de
// la DERECHA; `fade-right`, de la izquierda (la hoja de AOS 2.3, aos.css).
//   · Las diagonales de AOS (`fade-up-right`…) van por su componente vertical: el catálogo no tiene una diagonal
//     con dirección («Deriva» es otra cosa: un derrape lento de 1,4 s).
//   · `zoom-out` → PISOTÓN, no Aparecer: AOS lo arranca en scale(1.2) y lo achica a 1, y Pisotón es el único del
//     catálogo que entra desde MÁS grande (scale(1.4)). Aparecer entra desde más chico (0.85): invertiría el
//     movimiento. Lo que se pierde es la curva (la de AOS es suave; la de Pisotón, un golpe de 0,5 s), que se
//     nota menos que el sentido.
//   · `slide-*` no funde (AOS sólo traslada el 100 %): «Deslizar», no «Subir».
//   · `flip-*` → Voltear (el catálogo voltea sobre un solo eje: se pierde hacia qué lado).

const AOS: Readonly<Record<string, EfectoDireccion>> = {
  'fade': con('desvanecer'),
  'fade-up': con('subir'),
  'fade-down': con('caer'),
  'fade-left': con('deslizar', 'derecha'),
  'fade-right': con('deslizar', 'izquierda'),
  'fade-up-right': con('subir'),
  'fade-up-left': con('subir'),
  'fade-down-right': con('caer'),
  'fade-down-left': con('caer'),
  'flip-up': con('voltear'),
  'flip-down': con('voltear'),
  'flip-left': con('voltear'),
  'flip-right': con('voltear'),
  'slide-up': con('deslizar', 'abajo'),
  'slide-down': con('deslizar', 'arriba'),
  'slide-left': con('deslizar', 'derecha'),
  'slide-right': con('deslizar', 'izquierda'),
  'zoom-in': con('crecer'),
  'zoom-in-up': con('crecer'),
  'zoom-in-down': con('crecer'),
  'zoom-in-left': con('crecer'),
  'zoom-in-right': con('crecer'),
  'zoom-out': con('pisoton'),
  'zoom-out-up': con('pisoton'),
  'zoom-out-down': con('pisoton'),
  'zoom-out-left': con('pisoton'),
  'zoom-out-right': con('pisoton'),
};

// animate.css 4 (sin el prefijo `animate__`) y los nombres de la 3 (`animated fadeInUp`, también WOW.js). Sólo
// las ENTRADAS: las de atención (pulse, tada…) se repiten o enfatizan, y las salidas no son de una página que carga.
//   · bounceIn → Elástico (escala desde 0.3 con rebote); bounceInUp → Rebote (el del catálogo viene de abajo);
//     bounceInDown → Caer (no hay rebote desde arriba: se conserva el sentido, se pierde el rebote).
//   · rotateIn* → Balanceo (el único con giro); jackInTheBox → Elástico; rollIn → Deslizar desde la izquierda.
const ANIMATE: Readonly<Record<string, EfectoDireccion>> = {
  fadeIn: con('desvanecer'),
  fadeInUp: con('subir'), fadeInUpBig: con('subir'), fadeInBottomLeft: con('subir'), fadeInBottomRight: con('subir'),
  fadeInDown: con('caer'), fadeInDownBig: con('caer'), fadeInTopLeft: con('caer'), fadeInTopRight: con('caer'),
  fadeInLeft: con('deslizar', 'izquierda'), fadeInLeftBig: con('deslizar', 'izquierda'),
  fadeInRight: con('deslizar', 'derecha'), fadeInRightBig: con('deslizar', 'derecha'),
  backInUp: con('subir'), backInDown: con('caer'), backInLeft: con('deslizar', 'izquierda'), backInRight: con('deslizar', 'derecha'),
  bounceIn: con('elastico'), bounceInUp: con('rebote'), bounceInDown: con('caer'),
  bounceInLeft: con('deslizar', 'izquierda'), bounceInRight: con('deslizar', 'derecha'),
  flipInX: con('voltear'), flipInY: con('voltear'),
  lightSpeedIn: con('deslizar', 'derecha'), lightSpeedInRight: con('deslizar', 'derecha'), lightSpeedInLeft: con('deslizar', 'izquierda'),
  rotateIn: con('balanceo'), rotateInDownLeft: con('balanceo'), rotateInDownRight: con('balanceo'),
  rotateInUpLeft: con('balanceo'), rotateInUpRight: con('balanceo'),
  jackInTheBox: con('elastico'), rollIn: con('deslizar', 'izquierda'),
  zoomIn: con('crecer'), zoomInUp: con('crecer'), zoomInDown: con('crecer'), zoomInLeft: con('crecer'), zoomInRight: con('crecer'),
  slideInUp: con('deslizar', 'abajo'), slideInDown: con('deslizar', 'arriba'),
  slideInLeft: con('deslizar', 'izquierda'), slideInRight: con('deslizar', 'derecha'),
};

/** Los nombres de animate.css que se reconocen (el lector del navegador los recibe de acá: una sola lista). */
export const NOMBRES_ANIMATE: readonly string[] = Object.keys(ANIMATE);

/** El nombre de animate.css de una lista de clases («animate__animated animate__fadeInUp» → «fadeInUp»), o ''. */
export function claseAnimate(clase: string | null | undefined): string {
  const t = String(clase ?? '').split(/\s+/).filter(Boolean).slice(0, 60);
  const viejo = t.includes('animated') || t.includes('wow');
  for (const c of t) {
    if (c.startsWith('animate__') && Object.prototype.hasOwnProperty.call(ANIMATE, c.slice(9))) return c.slice(9);
    if (viejo && Object.prototype.hasOwnProperty.call(ANIMATE, c)) return c;
  }
  return '';
}

/** Un nombre de AOS que no está en la tabla (una variante propia), por sus palabras. */
function aosPorPalabras(n: string): EfectoDireccion | null {
  if (/zoom-?in/.test(n)) return con('crecer');
  if (/zoom-?out/.test(n)) return con('pisoton');
  if (/flip/.test(n)) return con('voltear');
  if (/slide|fade/.test(n)) {
    const funde = /fade/.test(n);
    if (/up/.test(n)) return funde ? con('subir') : con('deslizar', 'abajo');
    if (/down/.test(n)) return funde ? con('caer') : con('deslizar', 'arriba');
    if (/left/.test(n)) return con('deslizar', 'derecha');
    if (/right/.test(n)) return con('deslizar', 'izquierda');
    return funde ? con('desvanecer') : null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. El mapeo: la FORMA del primer cuadro
// ─────────────────────────────────────────────────────────────────────────────

/** El primer cuadro, en números: opacidad, traslado (px), escala, giros (grados), recorte y desenfoque (px). */
export type Forma = { o: number; x: number; y: number; s: number; rx: number; ry: number; rz: number; clip: string; blur: number };

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Un largo CSS en px. El % (de su propio tamaño, que no se sabe) cuenta como px: importa el sentido, no la medida. */
function largo(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const m = /^\s*(-?[\d.]+(?:e-?\d+)?)\s*([a-z%]*)\s*$/i.exec(String(v ?? ''));
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  const u = m[2].toLowerCase();
  return u === 'rem' || u === 'em' ? n * 16 : n;
}

/** Un ángulo CSS en grados (deg, rad, turn, grad; sin unidad, grados). */
function angulo(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const m = /^\s*(-?[\d.]+(?:e-?\d+)?)\s*([a-z]*)\s*$/i.exec(String(v ?? ''));
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  const u = m[2].toLowerCase();
  return u === 'rad' ? (n * 180) / Math.PI : u === 'turn' ? n * 360 : u === 'grad' ? n * 0.9 : n;
}

const grados = (r: number) => (r * 180) / Math.PI;

/** Suma a la forma lo que dice un `transform` («translate3d(0, 100px, 0) scale(.6)», «matrix(…)», «matrix3d(…)»). */
function sumarTransform(f: Forma, t: string): void {
  for (const m of t.slice(0, TOPES_ANIMACIONES.valor * 2).matchAll(/([a-zA-Z0-9]+)\(([^()]*)\)/g)) {
    const fn = m[1].toLowerCase();
    const a = m[2].split(/\s*,\s*|\s+/).filter(Boolean);
    switch (fn) {
      case 'translate': f.x += largo(a[0]); f.y += largo(a[1] ?? 0); break;
      case 'translatex': f.x += largo(a[0]); break;
      case 'translatey': f.y += largo(a[0]); break;
      case 'translate3d': f.x += largo(a[0]); f.y += largo(a[1]); break;
      case 'scale': { const sx = num(a[0]) ?? 1; const sy = num(a[1]) ?? sx; f.s *= (sx + sy) / 2; break; }
      case 'scale3d': { const sx = num(a[0]) ?? 1; const sy = num(a[1]) ?? sx; f.s *= (sx + sy) / 2; break; }
      case 'scalex': case 'scaley': f.s *= num(a[0]) ?? 1; break;
      case 'rotate': case 'rotatez': f.rz += angulo(a[0]); break;
      case 'rotatex': f.rx += angulo(a[0]); break;
      case 'rotatey': f.ry += angulo(a[0]); break;
      case 'rotate3d': {
        const [x, y, z] = [Math.abs(num(a[0]) ?? 0), Math.abs(num(a[1]) ?? 0), Math.abs(num(a[2]) ?? 0)];
        const g = angulo(a[3]);
        if (x >= y && x >= z) f.rx += g; else if (y >= z) f.ry += g; else f.rz += g;
        break;
      }
      case 'matrix': {
        const v = a.map((x) => num(x) ?? 0);
        if (v.length < 6) break;
        f.x += v[4]; f.y += v[5];
        f.s *= Math.hypot(v[0], v[1]) || 1;
        f.rz += grados(Math.atan2(v[1], v[0]));
        break;
      }
      case 'matrix3d': {
        // Por columnas (CSS): el traslado en 12 y 13; arriba a la izquierda, el giro (la perspectiva sólo toca la
        // última fila, así que «perspective(800px) rotateX(-70deg)» deja el giro intacto ahí).
        const v = a.map((x) => num(x) ?? 0);
        if (v.length < 16) break;
        f.x += v[12]; f.y += v[13];
        const sx = Math.hypot(v[0], v[1], v[2]) || 1;
        const sy = Math.hypot(v[4], v[5], v[6]) || 1;
        f.s *= (sx + sy) / 2;
        f.rx += grados(Math.atan2(v[6], v[5]));
        f.ry += grados(Math.atan2(-v[2], v[0]));
        f.rz += grados(Math.atan2(v[1], v[0]));
        break;
      }
      default: break; // perspective, skew, translateZ: no cambian qué efecto es
    }
  }
}

/** La forma del primer cuadro de una señal `kf` (lo que da el navegador) o `fr` (el `initial` de Framer). */
export function formaDe(s: { kf?: unknown; fr?: unknown }): Forma | null {
  const f: Forma = { o: 1, x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0, clip: '', blur: 0 };
  const kf = s.kf && typeof s.kf === 'object' && !Array.isArray(s.kf) ? (s.kf as Record<string, unknown>) : null;
  const fr = s.fr && typeof s.fr === 'object' && !Array.isArray(s.fr) ? (s.fr as Record<string, unknown>) : null;
  if (!kf && !fr) return null;
  const corto = (v: unknown) => (typeof v === 'string' ? v.slice(0, TOPES_ANIMACIONES.valor * 2).trim() : typeof v === 'number' ? String(v) : '');
  if (kf) {
    const o = num(kf.o);
    if (o !== null && corto(kf.o) !== '') f.o = o;
    const t = corto(kf.t);
    if (t && t !== 'none') sumarTransform(f, t);
    const tr = corto(kf.tr);
    if (tr && tr !== 'none') { const p = tr.split(/\s+/); f.x += largo(p[0]); f.y += largo(p[1] ?? 0); }
    const sc = corto(kf.sc);
    if (sc && sc !== 'none') { const p = sc.split(/\s+/).map((x) => num(x) ?? 1); f.s *= ((p[0] ?? 1) + (p[1] ?? p[0] ?? 1)) / 2; }
    const ro = corto(kf.ro);
    if (ro && ro !== 'none') {
      // «8deg», «x 70deg» o «1 0 0 70deg»: el eje, si lo dice, y el ángulo al final.
      const p = ro.split(/\s+/);
      const g = angulo(p[p.length - 1]);
      const eje = p.length === 2 ? p[0].toLowerCase() : p.length === 4 ? (Math.abs(num(p[0]) ?? 0) >= Math.abs(num(p[1]) ?? 0) && Math.abs(num(p[0]) ?? 0) >= Math.abs(num(p[2]) ?? 0) ? 'x' : Math.abs(num(p[1]) ?? 0) >= Math.abs(num(p[2]) ?? 0) ? 'y' : 'z') : 'z';
      if (eje === 'x') f.rx += g; else if (eje === 'y') f.ry += g; else f.rz += g;
    }
    const c = corto(kf.c);
    if (c && c !== 'none') f.clip = c.toLowerCase();
    const b = /blur\(\s*([\d.]+)\s*px/i.exec(corto(kf.f));
    if (b) f.blur = Number(b[1]) || 0;
  }
  if (fr) {
    const o = num(fr.opacity);
    if (o !== null) f.o = o;
    f.x += largo(fr.x ?? 0);
    f.y += largo(fr.y ?? 0);
    const s = num(fr.scale);
    if (s !== null) f.s *= s;
    f.rz += angulo(fr.rotate ?? 0);
    f.rx += angulo(fr.rotateX ?? 0);
    f.ry += angulo(fr.rotateY ?? 0);
  }
  f.o = Math.max(0, Math.min(1, f.o));
  return f;
}

/** Un recorte de partida → Iris, Telón, Barrido (con su dirección) o Desplegar; null si no revela nada. */
function efectoDeRecorte(clip: string, y: number): EfectoDireccion | null {
  if (/^circle\(\s*0(?:\.0*)?\s*(?:%|px)?(?=[\s)])/.test(clip)) return con('iris');
  const m = /^inset\(([^)]*)\)/.exec(clip);
  if (!m) return null;
  const pct = (v: string): number => {
    const x = /^(-?[\d.]+)\s*(%|px)?$/.exec(v);
    if (!x) return 0;
    const n = Number(x[1]);
    // En px no se sabe el tamaño del elemento: cuenta como «todo» desde 100 px.
    return x[2] === '%' ? n : n >= 100 ? 100 : 0;
  };
  const v = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/).map(pct);
  const [t, r, b, l] = v.length === 1 ? [v[0], v[0], v[0], v[0]] : v.length === 2 ? [v[0], v[1], v[0], v[1]] : v.length === 3 ? [v[0], v[1], v[2], v[1]] : [v[0], v[1], v[2], v[3]];
  if (l >= 50 && r >= 50 && t < 50 && b < 50) return con('telon');
  const max = Math.max(t, r, b, l);
  if (max < 50) return null;
  // El lado RECORTADO es el que falta mostrar: «inset(0 100% 0 0)» se revela de izquierda a derecha.
  if (r === max) return con('barrido', 'izquierda');
  if (l === max) return con('barrido', 'derecha');
  if (b === max) return y < 0 ? con('desplegar') : con('barrido', 'arriba');
  return con('barrido', 'abajo');
}

/**
 * La forma → el efecto del catálogo, en este orden: el recorte; el desenfoque (Enfoque); un giro de 30° o más
 * en X/Y (Voltear) o de 3° o más en el plano (Balanceo); la escala (más grande que 1 → Pisotón; desde 0.75 →
 * Aparecer; menos → Crecer); el traslado (vertical: con fundido Subir/Caer, sin fundido Deslizar desde abajo/
 * arriba; horizontal: Deslizar desde el lado donde arranca); y la opacidad sola (Desvanecer). null: el primer
 * cuadro no esconde ni mueve nada (no es una entrada).
 */
export function efectoDeForma(f: Forma): EfectoDireccion | null {
  if (f.clip) { const r = efectoDeRecorte(f.clip, f.y); if (r) return r; }
  if (f.blur >= 2) return con('enfoque');
  if (Math.abs(f.rx) >= 30 || Math.abs(f.ry) >= 30) return con('voltear');
  if (Math.abs(f.rz) >= 3) return con('balanceo');
  if (Math.abs(f.s - 1) >= 0.05) return f.s > 1 ? con('pisoton') : f.s >= 0.75 ? con('aparecer') : con('crecer');
  const ax = Math.abs(f.x);
  const ay = Math.abs(f.y);
  if (ax >= 4 || ay >= 4) {
    const funde = f.o < 0.99;
    if (ay >= ax) return f.y > 0 ? (funde ? con('subir') : con('deslizar', 'abajo')) : (funde ? con('caer') : con('deslizar', 'arriba'));
    return con('deslizar', f.x < 0 ? 'izquierda' : 'derecha');
  }
  if (f.o < 0.99) return con('desvanecer');
  return null;
}

/** Una señal cruda → el efecto del catálogo, o null (no es una entrada, o no se reconoce). */
export function efectoDeSenal(raw: unknown): EfectoDireccion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.aos === 'string' && s.aos.trim()) {
    const n = s.aos.trim().toLowerCase().slice(0, TOPES_ANIMACIONES.nombre);
    return (Object.prototype.hasOwnProperty.call(AOS, n) ? AOS[n] : null) ?? aosPorPalabras(n);
  }
  if (typeof s.ac === 'string' && s.ac.trim()) {
    const n = s.ac.trim().replace(/^animate__/, '').slice(0, TOPES_ANIMACIONES.nombre);
    return Object.prototype.hasOwnProperty.call(ANIMATE, n) ? ANIMATE[n] : null;
  }
  const f = formaDe(s);
  return f ? efectoDeForma(f) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Las señales del HTML que baja el server (las usa estiloDeHtml, etiqueta por etiqueta)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que interesa del `initial` de Framer (números, o un texto corto como «10px»). */
const CLAVES_FRAMER = ['opacity', 'x', 'y', 'scale', 'rotate', 'rotateX', 'rotateY'] as const;

/** El primer `initial` adentro de la entrada de un id (Framer lo anida por variante de tamaño), con lo que interesa. */
function inicialDeFramer(v: unknown, prof = 0): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || prof > 4) return null;
  const o = v as Record<string, unknown>;
  if (o.initial && typeof o.initial === 'object' && !Array.isArray(o.initial)) {
    const ini = o.initial as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of CLAVES_FRAMER) {
      const x = ini[k];
      if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
      else if (typeof x === 'string' && x.length <= 40) out[k] = x;
    }
    return Object.keys(out).length ? out : null;
  }
  for (const k of Object.keys(o).slice(0, 40)) {
    const r = inicialDeFramer(o[k], prof + 1);
    if (r) return r;
  }
  return null;
}

/**
 * Framer appear: el JSON de `<script type="framer/appear">` → id (`data-framer-appear-id`) → su `initial`. Se LEE
 * con JSON.parse: es un dato, no se corre. Un JSON roto, un arreglo (el de los cortes de pantalla) o uno enorme
 * no aportan nada.
 */
export function appearDeFramer(html: string): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  const re = /<script\b[^>]*\btype\s*=\s*["']?framer\/appear["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let n = 0;
  for (const m of String(html ?? '').matchAll(re)) {
    if (++n > 4) break;
    const texto = m[1].trim();
    if (!texto || texto.length > TOPES_ANIMACIONES.framer) continue;
    let j: unknown;
    try { j = JSON.parse(texto); } catch { continue; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
    for (const id of Object.keys(j).slice(0, TOPES_ANIMACIONES.idsFramer)) {
      const ini = inicialDeFramer((j as Record<string, unknown>)[id]);
      if (ini) out.set(id, ini);
    }
  }
  return out;
}

/** El estado escondido o movido que un `style` en línea deja escrito (Webflow IX2, Framer), o null. */
export function estadoEnLinea(style: string | null | undefined): Record<string, string> | null {
  const s = String(style ?? '');
  if (!s) return null;
  const decl = (prop: string): string => {
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(s);
    return m ? m[1].replace(/!important\s*$/i, '').trim().slice(0, TOPES_ANIMACIONES.valor) : '';
  };
  const o = decl('opacity');
  const t = decl('transform') || decl('-webkit-transform');
  const oculto = o !== '' && (num(o) ?? 1) < 0.99;
  const mueve = !!t && t.toLowerCase() !== 'none';
  return oculto || mueve ? { o, t } : null;
}

/**
 * La señal de UNA etiqueta de apertura del HTML, leyendo sus atributos con `leer` (el lector de atributos de quien
 * recorre, que ya decodifica las entidades), o null. `framer`: lo de `appearDeFramer`.
 */
export function senalDeEtiqueta(leer: (nombre: string) => string | null, framer: ReadonlyMap<string, Record<string, unknown>>): SenalCruda | null {
  const aos = leer('data-aos');
  if (aos && aos.trim()) return { aos: aos.trim().slice(0, TOPES_ANIMACIONES.nombre) };
  const ac = claseAnimate(leer('class'));
  if (ac) return { ac };
  const fid = leer('data-framer-appear-id');
  const fr = fid ? framer.get(fid) : undefined;
  if (fr) return { fr };
  if (fid || leer('data-w-id') !== null) {
    const kf = estadoEnLinea(leer('style'));
    if (kf) return { kf };
  }
  return null;
}

/**
 * Las señales de un recorrido (una por elemento) agrupadas por parte y señal, con su cuenta: la forma cruda que
 * acepta `sanearAnimaciones` (`{ s, n, aos | ac | fr | kf }`). Lo mismo que hace el lector en el navegador.
 */
export function agruparSenales(lista: readonly { seccion: number; senal: SenalCruda }[]): (SenalCruda & { s: number; n: number })[] {
  const grupos = new Map<string, SenalCruda & { s: number; n: number }>();
  for (const x of lista) {
    const k = `${x.seccion}|${JSON.stringify(x.senal)}`;
    const ya = grupos.get(k);
    if (ya) ya.n++;
    else grupos.set(k, { ...x.senal, s: x.seccion, n: 1 });
  }
  return [...grupos.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// El scroll (el aviso)
// ─────────────────────────────────────────────────────────────────────────────
//
// «Atado al scroll» = el efecto avanza con el scroll, no se dispara una vez al entrar (eso sí se copia). Se ve:
//   · en el CSS: `animation-timeline` (con `view()`/`scroll()` o una línea con nombre), `view-timeline`,
//     `scroll-timeline` (Chrome 115+, Safari 26);
//   · en el código: ScrollTrigger de GSAP (su script o su nombre en un script en línea), `new ScrollTimeline`;
//   · en los atributos de las librerías de parallax (Locomotive, Rellax, Jarallax, Stellar, ScrollSmoother).
// En el navegador, además, getAnimations() con una línea de tiempo de scroll y los transforms que cambian con el
// scroll (JS_LEER_ANIMACIONES, lector-script.ts). Medido: en la copia fiel no corre nada de esto («view()»
// congelada en 0,444 y 0 eventos de scroll en el iframe de alto ajustado).

/** Los atributos de las librerías de parallax (el selector del navegador y la búsqueda en el HTML salen de acá). */
export const ATRIBUTOS_SCROLL = ['data-scroll-speed', 'data-rellax-speed', 'data-jarallax', 'data-stellar-ratio', 'data-stellar-background-ratio', 'data-lag'] as const;
export const CLASES_SCROLL = ['rellax', 'jarallax'] as const;
/** El selector de lo de arriba, para el navegador (`document.querySelector`). */
export const SEL_SCROLL = [...ATRIBUTOS_SCROLL.map((a) => `[${a}]`), ...CLASES_SCROLL.map((c) => `.${c}`), '[data-parallax="scroll"]'].join(', ');
/** El nombre de una librería de scroll en el `src` de un script. */
export const RE_SCRIPT_SCROLL = /ScrollTrigger|ScrollMagic|ScrollSmoother|skrollr|locomotive-scroll|rellax|jarallax/i;
/** Lo que NOMBRA un efecto de scroll adentro de un script en línea (se lee, no se corre). */
export const RE_CODIGO_SCROLL = /\bScrollTrigger\b|\bscrollTrigger\s*:|\bnew\s+(?:Scroll|View)Timeline\s*\(/;
/** Una línea de tiempo de scroll en CSS (los valores que no atan nada no cuentan). */
const RE_TIMELINE_CSS = /(?:^|[\s;{"'])(?:animation-timeline|view-timeline(?:-name)?|scroll-timeline(?:-name)?)\s*:\s*([^;}"']*)/gi;
const NO_ATA = /^(?:auto|none|initial|inherit|unset|revert(?:-layer)?)?$/i;

/** ¿El CSS ata una animación al scroll? */
export function scrollEnCss(css: string): boolean {
  for (const m of String(css ?? '').slice(0, 6_000_000).matchAll(RE_TIMELINE_CSS)) {
    if (!NO_ATA.test(m[1].trim())) return true;
  }
  return false;
}

/**
 * ¿La página tiene efectos atados al scroll? En su HTML (los `<style>`, los `style` en línea, los scripts y los
 * atributos) y en el CSS de sus hojas, si se bajaron.
 */
export function scrollEnHtml(html: string, css = ''): boolean {
  const doc = String(html ?? '').slice(0, 6_000_000);
  if (scrollEnCss(doc) || (css && scrollEnCss(css))) return true;
  if (RE_CODIGO_SCROLL.test(doc)) return true;
  for (const m of doc.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) if (RE_SCRIPT_SCROLL.test(m[1])) return true;
  if (new RegExp(`<[a-z][^>]*\\s(?:${ATRIBUTOS_SCROLL.join('|')})(?=[\\s=>/])`, 'i').test(doc)) return true;
  if (new RegExp(`<[a-z][^>]*\\sclass\\s*=\\s*["'][^"']*\\b(?:${CLASES_SCROLL.join('|')})\\b`, 'i').test(doc)) return true;
  return /<[a-z][^>]*\sdata-parallax\s*=\s*["']?scroll\b/i.test(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// El saneo (lo que manda el lector, o lo que vuelve a pasar por el server): crudo → catálogo
// ─────────────────────────────────────────────────────────────────────────────

const ORDEN_EFECTO = new Map<string, number>(IDS_EFECTO.map((id, i) => [id, i]));
const ordenDir = (d: Direccion | null) => (d ? DIRECCIONES.indexOf(d) : -1);
/** Más veces primero; a igual cuenta, el orden del catálogo (estable: dos saneos dan lo mismo). */
const porVeces = (a: SenalAnimacion, b: SenalAnimacion) =>
  b.veces - a.veces || (ORDEN_EFECTO.get(a.efecto) ?? 0) - (ORDEN_EFECTO.get(b.efecto) ?? 0) || ordenDir(a.direccion) - ordenDir(b.direccion) || a.parte - b.parte;

/** La dirección de un efecto: la pedida si la ofrece, la primera suya si no; null si no ofrece. */
function direccionDe(efecto: IdEfecto, d: unknown): Direccion | null {
  return sanearDireccion(d, efecto) ?? efectoPorId(efecto)?.direcciones?.[0] ?? null;
}

/**
 * Las animaciones que llegaron de afuera (el lector del navegador, el recorrido del HTML o el pedido de Replicar),
 * con forma y topes, YA en el catálogo. Acepta las señales crudas (`{ s, n, aos | ac | fr | kf }`) y las saneadas
 * (`{ parte, efecto, direccion, veces }`): pasar dos veces da lo mismo. `totalPartes`: cuántos títulos tiene el
 * estilo; una señal de antes del primer título va con la primera parte (como las imágenes) y una de una parte
 * que quedó fuera del tope no tiene a dónde ir. null si no queda nada (ni señales ni scroll).
 */
export function sanearAnimaciones(raw: unknown, totalPartes: number): AnimacionesOriginal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  // Se leen más que las que se guardan: llegan una por parte y señal CRUDA, y varias caen en el mismo efecto.
  const lista = Array.isArray(r.senales) ? r.senales.slice(0, TOPES_ANIMACIONES.crudas) : [];
  const suma = new Map<string, SenalAnimacion>();
  for (const x of lista) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const p0 = typeof o.parte === 'number' ? o.parte : typeof o.s === 'number' ? o.s : -1;
    if (!Number.isInteger(p0)) continue;
    const parte = p0 < 0 ? (totalPartes > 0 ? 0 : -1) : p0;
    if (parte >= Math.max(0, totalPartes)) continue;
    const ef = esEfecto(o.efecto) ? { efecto: o.efecto, direccion: direccionDe(o.efecto, o.direccion) } : efectoDeSenal(o);
    if (!ef) continue;
    const direccion = direccionDe(ef.efecto, ef.direccion);
    const v0 = typeof o.veces === 'number' ? o.veces : typeof o.n === 'number' ? o.n : 1;
    const veces = Number.isFinite(v0) ? Math.max(1, Math.min(TOPES_ANIMACIONES.veces, Math.round(v0))) : 1;
    const k = `${parte}|${ef.efecto}|${direccion ?? ''}`;
    const ya = suma.get(k);
    if (ya) ya.veces = Math.min(TOPES_ANIMACIONES.veces, ya.veces + veces);
    else suma.set(k, { parte, efecto: ef.efecto, direccion, veces });
  }
  // Las más repetidas entran al tope; después, en el orden de la página.
  const senales = [...suma.values()].sort(porVeces).slice(0, TOPES_ANIMACIONES.senales)
    .sort((a, b) => a.parte - b.parte || porVeces(a, b));
  const scroll = r.scroll === true;
  return senales.length || scroll ? { senales, scroll } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. La réplica: el estilo de la landing y el efecto de cada sección
// ─────────────────────────────────────────────────────────────────────────────

/** El estilo de página de cada efecto que tiene uno exacto (los de texto —Palabras, Máquina— no: parten títulos). */
export const ESTILO_DE_EFECTO: Readonly<Partial<Record<IdEfecto, IdEstilo>>> = (() => {
  const out: Partial<Record<IdEfecto, IdEstilo>> = {};
  for (const e of ESTILOS_PAGINA as readonly DefEstilo[]) if (!e.texto && !out[e.efecto]) out[e.efecto] = e.id as IdEstilo;
  return out;
})();

/** Lo que se le escribe a una sección de la réplica (sus attrs), o null = hereda el estilo de la landing. */
export type EfectoReplica = { animacion: Exclude<AnimacionSeccion, null>; animacionDireccion: Direccion | null };

export type AnimacionesReplica = {
  /** El estilo de la landing; null = no se toca (sin señales, o ninguna con estilo de página: queda el default). */
  estilo: IdEstilo | null;
  /** Por sección de la réplica, en orden: su efecto propio, o null (hereda). */
  porSeccion: (EfectoReplica | null)[];
  /** La original tenía efectos atados al scroll: el resultado lo dice (`AVISO_SCROLL`). */
  avisoScroll: boolean;
};

/** El efecto que más se repite entre las señales de estas partes (a igual cuenta, el orden del catálogo), o null. */
function dominante(senales: readonly SenalAnimacion[], partes: ReadonlySet<number>): SenalAnimacion | null {
  const suma = new Map<string, SenalAnimacion>();
  for (const s of senales) {
    if (!partes.has(s.parte)) continue;
    const k = `${s.efecto}|${s.direccion ?? ''}`;
    const ya = suma.get(k);
    if (ya) ya.veces += s.veces;
    else suma.set(k, { ...s });
  }
  return [...suma.values()].sort(porVeces)[0] ?? null;
}

/**
 * Las animaciones de la original → las de la réplica. `partes[i]`: las partes de la original que son de la sección
 * `i` de la réplica (`partesDeCadaSeccion` de estilo-aplicar.ts, por el título; [] = no se reconoció).
 *   · El ESTILO: por cada parte de la original, su efecto dominante; gana el que más partes domina entre los que
 *     tienen estilo de página (a igual cuenta, el de más veces; después, el orden del catálogo).
 *   · Cada sección: su efecto dominante; si es el que ya le daría el estilo en esa posición (con «alterna»,
 *     izquierda las pares y derecha las impares: `animacionDeSeccion`, la regla del render), hereda; si no, el
 *     suyo, por `cambiosAlElegir`. Una sección sin señales hereda: no detectar no prueba que la original estaba quieta.
 */
export function animacionesDeReplica(anim: AnimacionesOriginal | null | undefined, partes: readonly (readonly number[])[]): AnimacionesReplica {
  const avisoScroll = anim?.scroll === true;
  const senales = anim?.senales ?? [];
  if (!senales.length) return { estilo: null, porSeccion: partes.map(() => null), avisoScroll };

  const cuenta = new Map<IdEstilo, { partes: number; veces: number }>();
  for (const p of new Set(senales.map((s) => s.parte))) {
    const d = dominante(senales, new Set([p]));
    const estilo = d ? ESTILO_DE_EFECTO[d.efecto] : undefined;
    if (!d || !estilo) continue;
    const c = cuenta.get(estilo) ?? { partes: 0, veces: 0 };
    c.partes++;
    c.veces += d.veces;
    cuenta.set(estilo, c);
  }
  const ordenEstilo = (id: IdEstilo) => (ESTILOS_PAGINA as readonly DefEstilo[]).findIndex((e) => e.id === id);
  const estilo = [...cuenta.entries()].sort((a, b) => b[1].partes - a[1].partes || b[1].veces - a[1].veces || ordenEstilo(a[0]) - ordenEstilo(b[0]))[0]?.[0] ?? null;

  const pagina = { animaciones: true, estiloAnimacion: estilo ?? ESTILO_DEFAULT };
  const porSeccion = partes.map((ps, i): EfectoReplica | null => {
    const d = dominante(senales, new Set(ps));
    if (!d) return null;
    const heredado = animacionDeSeccion({ animacion: null }, pagina, i);
    if (heredado.efecto === d.efecto && heredado.direccion === direccionDe(d.efecto, d.direccion)) return null;
    const c = cambiosAlElegir(d.efecto, { animacionDireccion: d.direccion });
    return c.animacion ? { animacion: c.animacion, animacionDireccion: c.animacionDireccion } : null;
  });
  return { estilo, porSeccion, avisoScroll };
}

/**
 * Las secciones de la réplica con su efecto propio en los attrs (`animacion`, `animacionDireccion`). No muta la
 * entrada. `propias`: cuántas quedaron con uno.
 */
export function conAnimaciones(tarjetas: readonly JsonNodo[], porSeccion: readonly (EfectoReplica | null)[]): { tarjetas: JsonNodo[]; propias: number } {
  let propias = 0;
  const out = tarjetas.map((t, i) => {
    const e = porSeccion[i];
    if (!e || t.type !== NODO.tarjeta) return t;
    propias++;
    return { ...t, attrs: { ...(t.attrs ?? {}), animacion: e.animacion, animacionDireccion: e.animacionDireccion } };
  });
  return { tarjetas: out, propias };
}
