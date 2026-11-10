// =============================================================================
// motion/escena — de un spec a una ESCENA: dónde va cada capa y cuándo entra cada pedazo
// =============================================================================
// La escena se arma UNA vez por spec y proporción (no por cuadro): el lienzo la dibuja en cualquier t (./canvas.ts) y la
// landing la escribe como HTML con CSS (./html.ts). Los dos leen los mismos tiempos y curvas, así que lo que se ve en el
// Video Editor es la misma coreografía que en la landing publicada.
//
// Las reglas son las de las skills de iart-ai (MIT, Copyright (c) 2026 iart.ai, github.com/iart-ai/motion-skills),
// resumidas en docs/hallazgos-motion.md:
//   · el TONO decide los tiempos y las curvas (motion-art-direction: premium, corporativo, enérgico, juguetón);
//   · un titular entra por líneas con máscara (translateY 110 %, no 100 %: el descendente se ve), 80-120 ms entre líneas;
//     palabras 40-70 ms, letras 20-40 ms, y un grupo no tarda más de ~800 ms en entrar (kinetic-typography);
//   · área segura: 6 % en horizontal; en vertical 14 % arriba y 22 % abajo (la interfaz de Reels y TikTok); 7-8 % en cuadrado;
//   · nada se corta: el texto se achica hasta que entra, y la última palabra no queda sola en su línea (huérfana);
//   · un número no rebota; el tercio inferior empieza y termina vacío; lo que late, late 3 veces y para (WCAG 2.2.2).
// El ancho del texto se ESTIMA con una tabla por carácter (sin medir): así el server, el lienzo y el CSS parten las
// líneas igual. El lienzo después mide de verdad y, si una línea quedó más ancha que su caja, la aprieta.
// =============================================================================

import type { Curva } from './curvas';
import {
  PLANTILLAS, FUENTE_MOTION_DEFECTO, FUENTES_MOTION, color, datosDeBarras, numero, pesoDisponible, texto, normalizarMotion,
} from './plantillas';
import type {
  Capa, CapaCaja, CapaCifra, CapaForma, CapaTexto, Efecto, Escena, MotionSpec, Partir, Tono, Tramo, Alineacion,
} from './tipos';

// ─────────────────────────────────────────────────────────────────────────────
// El tono: tiempos y curvas
// ─────────────────────────────────────────────────────────────────────────────

type Ritmo = {
  /** Duración de lo principal (un titular). */
  dur: number;
  /** Duración de lo que aparece de golpe (un botón, un sello). */
  durPop: number;
  pasoLinea: number;
  pasoPalabra: number;
  pasoLetra: number;
  entra: Curva;
  pop: Curva;
  sale: Curva;
  efectoPalabra: Efecto;
};

/** motion-art-direction («Tone presets») y kinetic-typography; los valores elegidos dentro de los rangos, en hallazgos-motion. */
export const RITMOS: Record<Tono, Ritmo> = {
  premium: { dur: 900, durPop: 600, pasoLinea: 120, pasoPalabra: 70, pasoLetra: 35, entra: 'salida', pop: 'quinta', sale: 'acelera', efectoPalabra: 'desenfoque' },
  corporativo: { dur: 700, durPop: 500, pasoLinea: 80, pasoPalabra: 50, pasoLetra: 30, entra: 'quinta', pop: 'quinta', sale: 'sale', efectoPalabra: 'deslizar' },
  energico: { dur: 500, durPop: 400, pasoLinea: 60, pasoPalabra: 40, pasoLetra: 20, entra: 'salida', pop: 'rebote', sale: 'sale', efectoPalabra: 'escalar' },
  jugueton: { dur: 600, durPop: 500, pasoLinea: 90, pasoPalabra: 60, pasoLetra: 30, entra: 'salida', pop: 'rebote', sale: 'sale', efectoPalabra: 'escalar' },
};

/** Lo que tarda en salir un clip de video (la landing no sale: queda en su estado final). */
const DUR_SALE = 300;

/** Un grupo entra en ~800 ms como mucho: si son muchos pedazos, el paso se achica (kinetic-typography). */
function pasoTope(paso: number, n: number, dur: number, tope = 800): number {
  if (n <= 1) return paso;
  return Math.max(8, Math.min(paso, (tope - dur) / (n - 1) > 0 ? (tope - dur) / (n - 1) : 8));
}

const tramo = (efecto: Efecto, t0: number, dur: number, curva: Curva, paso = 0): Tramo => ({ efecto, t0: Math.round(t0), dur: Math.round(dur), curva, paso: Math.round(paso) });

/** Cuándo termina de entrar el último pedazo de una capa. */
export function finDeEntrada(c: Capa): number {
  return c.entra.t0 + Math.max(0, pedazos(c) - 1) * c.entra.paso + c.entra.dur;
}

/** Cuántos pedazos tiene una capa según cómo se parte (líneas, palabras, letras; cada dígito de una cifra). */
export function pedazos(c: Capa): number {
  if (c.k === 'texto') return fragmentosDeTexto(c.lineas, c.partir).length;
  if (c.k === 'cifra') return c.partes.length;
  return 1;
}

/** Los pedazos de un texto en orden de lectura, con la línea a la que pertenecen. */
export function fragmentosDeTexto(lineas: string[], partir: Partir): Array<{ linea: number; texto: string }> {
  const out: Array<{ linea: number; texto: string }> = [];
  lineas.forEach((l, i) => {
    if (partir === 'linea') out.push({ linea: i, texto: l });
    else if (partir === 'palabra') for (const p of l.split(' ').filter(Boolean)) out.push({ linea: i, texto: p });
    else for (const ch of Array.from(l)) if (ch !== ' ') out.push({ linea: i, texto: ch });
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Medir sin medir: el ancho estimado de un texto, en em
// ─────────────────────────────────────────────────────────────────────────────

/** Qué tan ancha es cada familia respecto de Inter (medido a ojo contra Google Fonts; condensadas por debajo de 1). */
const FACTOR_FAMILIA: Record<string, number> = {
  Inter: 1, Montserrat: 1.1, Poppins: 1.08, 'Archivo Black': 1.18, 'Bebas Neue': 0.66, Anton: 0.74,
  'Playfair Display': 0.96, 'DM Serif Display': 0.94, Lora: 0.98,
};

function anchoCaracter(c: string): number {
  if (c === ' ' || c === ' ') return 0.27;
  if ('iljI.,:;!|\'’`¡'.includes(c)) return 0.3;
  if ('ftr()[]-'.includes(c)) return 0.4;
  if ('mwMW@%'.includes(c)) return 0.88;
  if ('★☆'.includes(c)) return 0.95;
  if (/[A-ZÁÉÍÓÚÑÜ$€#&?¿]/.test(c)) return 0.7;
  if (/[0-9]/.test(c)) return 0.62;
  return 0.56;
}

/** El ancho estimado, en em, de una línea con su familia, peso, mayúsculas y espacio entre letras. */
export function anchoEm(s: string, familia: string, peso: number, mayus: boolean, tracking: number): number {
  const t = mayus ? s.toLocaleUpperCase('es') : s;
  let w = 0;
  for (const ch of Array.from(t)) w += anchoCaracter(ch) + tracking;
  return w * (FACTOR_FAMILIA[familia] ?? 1) * (peso >= 700 ? 1.05 : 1);
}

type Medida = { familia: string; peso: number; mayus: boolean; tracking: number };

/** Parte en líneas sin cortar palabras y sin dejar una huérfana al final. */
export function partirEnLineas(s: string, maxEm: number, m: Medida): string[] {
  const palabras = s.split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const lineas: string[][] = [[]];
  for (const p of palabras) {
    const actual = lineas[lineas.length - 1];
    const prueba = [...actual, p].join(' ');
    if (actual.length && anchoEm(prueba, m.familia, m.peso, m.mayus, m.tracking) > maxEm) lineas.push([p]);
    else actual.push(p);
  }
  // La huérfana: si la última línea tiene una palabra sola y la anterior más de dos, baja una.
  if (lineas.length > 1) {
    const ult = lineas[lineas.length - 1];
    const ant = lineas[lineas.length - 2];
    if (ult.length === 1 && ant.length > 2) {
      const movida = ant[ant.length - 1];
      const nueva = [movida, ...ult].join(' ');
      if (anchoEm(nueva, m.familia, m.peso, m.mayus, m.tracking) <= maxEm) {
        ant.pop();
        ult.unshift(movida);
      }
    }
  }
  return lineas.map((l) => l.join(' '));
}

/**
 * El tamaño más grande (entre `tamMax` y `tamMin`, fracciones del ancho) con el que el texto entra en `maxLineas`
 * líneas de `anchoFr`. Las skills: «words are never cut: shrink with fit()».
 */
export function ajustar(s: string, maxLineas: number, anchoFr: number, tamMax: number, tamMin: number, m: Medida): { lineas: string[]; tam: number } {
  let tam = tamMax;
  for (let i = 0; i < 40 && tam >= tamMin; i++) {
    const maxEm = anchoFr / tam;
    const lineas = partirEnLineas(s, maxEm, m);
    if (lineas.length <= maxLineas && lineas.every((l) => anchoEm(l, m.familia, m.peso, m.mayus, m.tracking) <= maxEm)) return { lineas, tam };
    tam *= 0.94;
  }
  tam = tamMin;
  return { lineas: partirEnLineas(s, anchoFr / tam, m), tam };
}

// ─────────────────────────────────────────────────────────────────────────────
// Colores
// ─────────────────────────────────────────────────────────────────────────────

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** El texto que se lee sobre un color (un botón, un sello): negro o blanco, el de más contraste. */
export function tintaSobre(fondo: string): string {
  return contraste(fondo, '#111111') >= contraste(fondo, '#ffffff') ? '#111111' : '#ffffff';
}

// ─────────────────────────────────────────────────────────────────────────────
// Números (a mano, sin Intl: el mismo texto en el server, el navegador y los tests)
// ─────────────────────────────────────────────────────────────────────────────

/** 1250 → «1.250»; 3.5 con un decimal → «3,5». */
export function formatearNumero(n: number, decimales: number): string {
  const neg = n < 0;
  const fijo = Math.abs(n).toFixed(Math.max(0, Math.min(2, Math.round(decimales))));
  const [ent, dec] = fijo.split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${miles}${dec ? `,${dec}` : ''}`;
}

/** Cuántos decimales TIENE un número (hasta 2, que es lo que acepta una cifra): 4,5 → 1; 1250 → 0; 3,14 → 2. */
export function decimalesDe(n: number): number {
  for (let d = 0; d < 2; d++) if (Math.abs(Math.round(n * 10 ** d) / 10 ** d - n) < 1e-9) return d;
  return 2;
}

/**
 * Los decimales con que se MUESTRA una cifra: los del número que dio la persona, y `decimales` como mínimo (para
 * «4,50» o «12,0»). ⚠️ Nunca menos que los del número: con `decimales` en 0 por defecto, 4,5 se mostraba «5» (el bug
 * de la plantilla `cifra` hasta el 10/11/2026), que es un número que nadie dio.
 */
export function decimalesAMostrar(numero: number, decimales: number): number {
  return Math.max(decimalesDe(numero), Math.max(0, Math.min(2, Math.round(decimales))));
}

// ─────────────────────────────────────────────────────────────────────────────
// La caja: área segura y unidades
// ─────────────────────────────────────────────────────────────────────────────

type Marco = {
  a: number;
  l: number; r: number; t: number; b: number;
  /** El ancho útil, fracción del ancho. */
  ancho: number;
  /** px de una pieza de 1080 (el lado corto) → fracción del ANCHO. En vertical, todo un 15 % más grande. */
  fr: (px: number) => number;
  /** Un largo en fracción del ancho → fracción del ALTO. */
  alto: (f: number) => number;
  vertical: boolean;
};

function marco(a: number): Marco {
  const vertical = a < 0.8;
  const horizontal = a > 1.2;
  const m = horizontal ? { l: 0.06, r: 0.06, t: 0.07, b: 0.07 } : vertical ? { l: 0.07, r: 0.07, t: 0.14, b: 0.22 } : { l: 0.07, r: 0.07, t: 0.08, b: 0.08 };
  const k = vertical ? 1.15 : 1;
  return {
    a, ...m, vertical,
    ancho: 1 - m.l - m.r,
    fr: (px) => (px * k / 1080) * Math.min(1, 1 / a),
    alto: (f) => f * a,
  };
}

type Ctx = { v: MotionSpec['valores']; R: Ritmo; M: Marco; familia: string; tinta: string; acento: string; video: boolean; durMs: number };

/** Un texto ya ajustado, listo para apilar. */
function capaTexto(ctx: Ctx, p: {
  id: string; s: string; maxLineas: number; ancho?: number; tamMax: number; tamMin: number; peso: number; mayus?: boolean;
  tracking?: number; interlineado?: number; partir: Partir; color?: string; alinear?: Alineacion; entra: Tramo; tinta?: number;
  familia?: string; cursiva?: boolean; tachado?: boolean;
}): CapaTexto {
  const familia = p.familia ?? ctx.familia;
  const peso = pesoDisponible(familia, p.peso);
  const m: Medida = { familia, peso, mayus: !!p.mayus, tracking: p.tracking ?? 0 };
  const ancho = p.ancho ?? ctx.M.ancho;
  const { lineas, tam } = ajustar(p.s, p.maxLineas, ancho, ctx.M.fr(p.tamMax), ctx.M.fr(p.tamMin), m);
  return {
    k: 'texto', id: p.id, lineas, x: (1 - ancho) / 2, y: 0, ancho, alinear: p.alinear ?? 'centro', tam, peso,
    color: p.color ?? ctx.tinta, familia, mayus: !!p.mayus, tracking: m.tracking, interlineado: p.interlineado ?? 1.15,
    partir: p.partir, entra: p.entra, ...(p.tinta !== undefined ? { tinta: p.tinta } : {}),
    ...(p.cursiva ? { cursiva: true } : {}), ...(p.tachado ? { tachado: true } : {}),
  };
}

/** Alto de un texto, fracción del alto de la caja. */
export function altoTexto(c: Pick<CapaTexto, 'lineas' | 'tam' | 'interlineado'>, a: number): number {
  return Math.max(1, c.lineas.length) * c.tam * c.interlineado * a;
}

/** Ancho estimado (fracción del ancho) de la línea más larga de un texto. */
function anchoTexto(c: CapaTexto): number {
  return Math.max(0, ...c.lineas.map((l) => anchoEm(l, c.familia, c.peso, c.mayus, c.tracking))) * c.tam;
}

/** Apila de arriba abajo, centrado en `centro` (fracción del alto) y sin pasarse del área segura. */
function apilar(items: Array<{ alto: number; poner: (y: number) => void; aire?: number }>, M: Marco, centro: number) {
  const total = items.reduce((s, it, i) => s + it.alto + (i ? it.aire ?? 0 : 0), 0);
  let y = Math.max(M.t, Math.min(1 - M.b - total, centro - total / 2));
  items.forEach((it, i) => {
    if (i) y += it.aire ?? 0;
    it.poner(y);
    y += it.alto;
  });
}

function pildora(ctx: Ctx, id: string, etiqueta: string, entra: Tramo, latidoDesde: number | null): { caja: CapaCaja; label: CapaTexto; alto: number; poner: (y: number) => void } {
  const label = capaTexto(ctx, { id: `${id}-texto`, s: etiqueta, maxLineas: 1, ancho: ctx.M.ancho * 0.8, tamMax: 34, tamMin: 22, peso: 700, partir: 'linea', color: tintaSobre(ctx.acento), entra });
  const w = Math.min(ctx.M.ancho, anchoTexto(label) + label.tam * 2.4);
  const hAncho = label.tam * 2.5;
  const caja: CapaCaja = { k: 'caja', id, x: 0.5 - w / 2, y: 0, w, h: ctx.M.alto(hAncho), color: ctx.acento, radio: hAncho / 2, entra };
  if (latidoDesde !== null) {
    const latido = { t0: latidoDesde, periodo: 900, veces: 3, escala: 1.06 };
    caja.latido = latido;
    label.latido = latido;
  }
  const altoCaja = caja.h;
  return {
    caja, label, alto: altoCaja,
    poner: (y) => {
      caja.y = y;
      label.y = y + (altoCaja - altoTexto(label, ctx.M.a)) / 2;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las plantillas
// ─────────────────────────────────────────────────────────────────────────────

function titular(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const pila: Array<{ alto: number; poner: (y: number) => void; aire?: number }> = [];
  const ante = texto(v, 'antetitulo');
  if (ante) {
    const k = capaTexto(ctx, { id: 'antetitulo', s: ante, maxLineas: 1, tamMax: 30, tamMin: 16, peso: 700, mayus: true, tracking: 0.18, partir: 'linea', color: ctx.acento, entra: tramo('deslizar', 0, 500, R.entra) });
    capas.push(k);
    pila.push({ alto: altoTexto(k, M.a), poner: (y) => { k.y = y; } });
  }
  const tituloBase = capaTexto(ctx, { id: 'titulo', s: texto(v, 'titulo'), maxLineas: 3, tamMax: 124, tamMin: 48, peso: 800, tracking: -0.02, interlineado: 1.1, partir: 'linea', entra: tramo('subir', 300, R.dur, R.entra, R.pasoLinea) });
  capas.push(tituloBase);
  pila.push({ alto: altoTexto(tituloBase, M.a), poner: (y) => { tituloBase.y = y; }, aire: M.alto(M.fr(18)) });
  const finTitulo = finDeEntrada(tituloBase);
  const grosor = M.fr(7);
  const regla: CapaCaja = { k: 'caja', id: 'regla', x: 0.5 - 0.06, y: 0, w: 0.12, h: M.alto(grosor), color: ctx.acento, radio: grosor / 2, entra: tramo('crecer-x', finTitulo - 250, 500, 'quinta') };
  capas.push(regla);
  pila.push({ alto: regla.h, poner: (y) => { regla.y = y; }, aire: M.alto(M.fr(26)) });
  const baj = texto(v, 'bajada');
  if (baj) {
    const b = capaTexto(ctx, { id: 'bajada', s: baj, maxLineas: 3, ancho: M.ancho * 0.78, tamMax: 40, tamMin: 22, peso: 400, interlineado: 1.4, partir: 'linea', tinta: 0.82, entra: tramo('deslizar', Math.max(500, finTitulo - 500), R.dur, R.entra, R.pasoLinea) });
    capas.push(b);
    pila.push({ alto: altoTexto(b, M.a), poner: (y) => { b.y = y; }, aire: M.alto(M.fr(26)) });
  }
  apilar(pila, M, M.vertical ? 0.42 : 0.5);
  return capas;
}

function palabras(ctx: Ctx): Capa[] {
  const { R, M, v, video, durMs } = ctx;
  const frases = ['frase1', 'frase2', 'frase3'].map((k) => texto(v, k)).filter(Boolean);
  const n = Math.max(1, frases.length);
  const ventana = video ? durMs / n : 1500;
  const curva = R.efectoPalabra === 'escalar' ? R.pop : R.entra;
  return frases.map((s, i) => {
    const c = capaTexto(ctx, {
      id: `frase${i + 1}`, s, maxLineas: 2, tamMax: 156, tamMin: 56, peso: 800, tracking: -0.02, interlineado: 1.05, partir: 'palabra',
      color: i === 1 ? ctx.acento : ctx.tinta, entra: tramo(R.efectoPalabra, i * ventana + 100, R.durPop, curva, 0),
    });
    c.entra.paso = Math.round(pasoTope(R.pasoPalabra, pedazos(c), c.entra.dur));
    c.y = (M.vertical ? 0.42 : 0.5) - altoTexto(c, M.a) / 2;
    // Cada frase se va cuando llega la siguiente; la última, en la landing, se queda.
    if (i < n - 1 || video) {
      // El ÚLTIMO pedazo termina de irse en `fin`: con paso entre palabras, la primera arranca antes.
      const fin = (i + 1) * ventana - (i < n - 1 ? 60 : 80);
      const paso = 15;
      c.sale = tramo(R.efectoPalabra === 'escalar' ? 'escalar' : 'deslizar', fin - DUR_SALE - (pedazos(c) - 1) * paso, DUR_SALE, R.sale, paso);
    }
    return c;
  });
}

function cifra(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const pila: Array<{ alto: number; poner: (y: number) => void; aire?: number }> = [];
  const textoNumero = formatearNumero(numero(v, 'numero'), decimalesAMostrar(numero(v, 'numero'), numero(v, 'decimales')));
  const pre = texto(v, 'prefijo');
  const suf = texto(v, 'sufijo');
  const completo = `${pre}${textoNumero}${suf}`;
  const base = capaTexto(ctx, { id: 'numero', s: completo, maxLineas: 1, tamMax: 220, tamMin: 80, peso: 800, tracking: -0.02, interlineado: 1.05, partir: 'linea', entra: tramo('rodar', 200, 1000, 'cubica', 70) });
  const partes: CapaCifra['partes'] = [];
  for (const ch of Array.from(pre)) partes.push({ s: ch });
  for (const ch of Array.from(textoNumero)) partes.push(/[0-9]/.test(ch) ? { d: Number(ch) } : { s: ch });
  for (const ch of Array.from(suf)) partes.push({ s: ch });
  const { lineas: _l, partir: _p, k: _k, ...resto } = base;
  void _l; void _p; void _k;
  const c: CapaCifra = { ...resto, k: 'cifra', partes };
  c.entra.paso = Math.round(pasoTope(70, partes.length, c.entra.dur, 1400));
  capas.push(c);
  pila.push({ alto: altoTexto({ lineas: [completo], tam: c.tam, interlineado: c.interlineado }, M.a), poner: (y) => { c.y = y; } });
  const finCuenta = finDeEntrada(c);
  const et = capaTexto(ctx, { id: 'etiqueta', s: texto(v, 'etiqueta'), maxLineas: 2, tamMax: 44, tamMin: 26, peso: 600, interlineado: 1.25, partir: 'linea', color: ctx.acento, entra: tramo('deslizar', finCuenta + 100, 500, R.entra, R.pasoLinea) });
  capas.push(et);
  pila.push({ alto: altoTexto(et, M.a), poner: (y) => { et.y = y; }, aire: M.alto(M.fr(14)) });
  const nota = texto(v, 'nota');
  if (nota) {
    const n = capaTexto(ctx, { id: 'nota', s: nota, maxLineas: 2, ancho: M.ancho * 0.8, tamMax: 28, tamMin: 18, peso: 400, interlineado: 1.4, partir: 'linea', tinta: 0.75, entra: tramo('aparecer', finCuenta + 400, 500, 'estandar') });
    capas.push(n);
    pila.push({ alto: altoTexto(n, M.a), poner: (y) => { n.y = y; }, aire: M.alto(M.fr(22)) });
  }
  apilar(pila, M, M.vertical ? 0.42 : 0.5);
  return capas;
}

function tercio(ctx: Ctx): Capa[] {
  const { M, v, video, durMs } = ctx;
  // Las constantes del tercio inferior de lower-thirds-skills (LEAD .2 s, IN .8 s): el primer cuadro y el último, vacíos.
  const tIn = 200;
  const panelColor = color(v, 'colorPanel', '#14161b');
  const x0 = M.l;
  const barra = M.fr(10);
  const padX = M.fr(34);
  const nombre = capaTexto(ctx, { id: 'nombre', s: texto(v, 'nombre'), maxLineas: 1, ancho: Math.min(0.62, M.ancho * 0.85), tamMax: 62, tamMin: 30, peso: 700, tracking: -0.01, interlineado: 1.2, partir: 'linea', alinear: 'izquierda', color: tintaSobre(panelColor), entra: tramo('subir', tIn + 350, 400, 'cubica') });
  const rolS = texto(v, 'rol');
  const rol = rolS ? capaTexto(ctx, { id: 'rol', s: rolS, maxLineas: 1, ancho: Math.min(0.55, M.ancho * 0.8), tamMax: Math.round(62 * 0.42), tamMin: 14, peso: 700, mayus: true, tracking: 0.12, interlineado: 1.2, partir: 'linea', alinear: 'izquierda', color: tintaSobre(ctx.acento), entra: tramo('aparecer', tIn + 550, 300, 'cubica') }) : null;
  const panelH = M.alto(nombre.tam * 1.55);
  const tabH = rol ? M.alto(rol.tam * 2) : 0;
  const bottom = M.vertical ? 0.72 : 1 - M.b;
  const yPanel = bottom - panelH - tabH;
  const panelW = Math.min(1 - x0 - M.r - barra, anchoTexto(nombre) + padX * 2);
  const capas: Capa[] = [];
  const acentoBarra: CapaCaja = { k: 'caja', id: 'barra', x: x0, y: yPanel, w: barra, h: panelH + tabH, color: ctx.acento, radio: 0, entra: tramo('crecer-y', tIn, 350, 'cubica') };
  const panel: CapaCaja = { k: 'caja', id: 'panel', x: x0 + barra, y: yPanel, w: panelW, h: panelH, color: panelColor, radio: 0, tinta: 0.92, entra: tramo('barrido', tIn + 200, 450, 'suave') };
  nombre.x = x0 + barra + padX;
  nombre.ancho = panelW - padX * 2;
  nombre.y = yPanel + (panelH - altoTexto(nombre, M.a)) / 2;
  capas.push(acentoBarra, panel, nombre);
  if (rol) {
    const tabW = Math.min(panelW, anchoTexto(rol) + padX * 1.2);
    const tab: CapaCaja = { k: 'caja', id: 'pestana', x: x0 + barra, y: yPanel + panelH, w: tabW, h: tabH, color: ctx.acento, radio: 0, entra: tramo('barrido', tIn + 500, 350, 'cubica') };
    rol.x = x0 + barra + padX * 0.6;
    rol.ancho = tabW - padX * 0.6;
    rol.y = yPanel + panelH + (tabH - altoTexto(rol, M.a)) / 2;
    capas.push(tab, rol);
  }
  if (video) {
    // La salida del molde: las palabras primero, el panel después y la barra al final; el último cuadro, vacío.
    const tOut = durMs - 300 - 600;
    nombre.sale = tramo('aparecer', tOut, 200, 'sale');
    if (rol) rol.sale = tramo('aparecer', tOut, 200, 'sale');
    panel.sale = tramo('barrido', tOut + 150, 300, 'suave');
    const tab = capas.find((c) => c.id === 'pestana');
    if (tab) tab.sale = tramo('barrido', tOut + 150, 300, 'suave');
    acentoBarra.sale = tramo('crecer-y', tOut + 350, 250, 'sale');
  }
  return capas;
}

function logo(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const pila: Array<{ alto: number; poner: (y: number) => void; aire?: number }> = [];
  const marcaS = texto(v, 'marca');
  const r = M.fr(78);
  const simbolo: CapaForma = { k: 'forma', id: 'simbolo', cx: 0.5, cy: 0, r, puntas: 0, interior: 1, color: ctx.acento, entra: tramo('escalar', 0, R.durPop, R.pop) };
  const inicial = capaTexto(ctx, { id: 'inicial', s: Array.from(marcaS.trim())[0]?.toLocaleUpperCase('es') ?? 'M', maxLineas: 1, ancho: r * 2, tamMax: 96, tamMin: 40, peso: 800, interlineado: 1, partir: 'linea', color: tintaSobre(ctx.acento), entra: tramo('aparecer', 250, 300, 'estandar') });
  inicial.tam = r * 1.1;
  capas.push(simbolo, inicial);
  pila.push({ alto: M.alto(r * 2), poner: (y) => { simbolo.cy = y + M.alto(r); inicial.y = y + M.alto(r) - altoTexto(inicial, M.a) / 2; } });
  const marca = capaTexto(ctx, { id: 'marca', s: marcaS, maxLineas: 1, tamMax: 110, tamMin: 44, peso: 800, tracking: -0.02, interlineado: 1.1, partir: 'letra', entra: tramo('deslizar', 450, 500, R.entra) });
  marca.entra.paso = Math.round(pasoTope(R.pasoLetra, pedazos(marca), marca.entra.dur, 1000));
  capas.push(marca);
  pila.push({ alto: altoTexto(marca, M.a), poner: (y) => { marca.y = y; }, aire: M.alto(M.fr(26)) });
  const finMarca = finDeEntrada(marca);
  const anchoMarca = Math.min(M.ancho, anchoTexto(marca));
  const grosor = M.fr(4);
  const regla: CapaCaja = { k: 'caja', id: 'regla', x: 0.5 - anchoMarca / 2, y: 0, w: anchoMarca, h: M.alto(grosor), color: ctx.acento, radio: grosor / 2, entra: tramo('crecer-x', finMarca - 200, 600, 'suave') };
  capas.push(regla);
  pila.push({ alto: regla.h, poner: (y) => { regla.y = y; }, aire: M.alto(M.fr(16)) });
  const lemaS = texto(v, 'lema');
  if (lemaS) {
    const lema = capaTexto(ctx, { id: 'lema', s: lemaS, maxLineas: 2, ancho: M.ancho * 0.8, tamMax: 34, tamMin: 20, peso: 400, interlineado: 1.35, partir: 'linea', tinta: 0.82, entra: tramo('deslizar', finMarca + 100, 600, R.entra) });
    capas.push(lema);
    pila.push({ alto: altoTexto(lema, M.a), poner: (y) => { lema.y = y; }, aire: M.alto(M.fr(22)) });
  }
  apilar(pila, M, M.vertical ? 0.42 : 0.5);
  return capas;
}

function barras(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const datos = datosDeBarras(texto(v, 'datos'));
  const unidad = texto(v, 'unidad');
  let arriba = M.t;
  const tituloS = texto(v, 'titulo');
  if (tituloS) {
    const t = capaTexto(ctx, { id: 'titulo', s: tituloS, maxLineas: 2, tamMax: 56, tamMin: 30, peso: 800, tracking: -0.01, interlineado: 1.15, partir: 'linea', entra: tramo('deslizar', 0, R.dur, R.entra, R.pasoLinea) });
    t.y = M.t;
    capas.push(t);
    arriba = M.t + altoTexto(t, M.a) + M.alto(M.fr(30));
  }
  if (!datos.length) return capas;
  const n = datos.length;
  const max = Math.max(...datos.map((d) => d.valor), 0) || 1;
  const tamEtiqueta = M.fr(26);
  const abajo = 1 - M.b - M.alto(tamEtiqueta * 1.8);
  const tamValor = M.fr(30);
  const zonaAlto = Math.max(0.1, abajo - arriba - M.alto(tamValor * 1.6));
  const slot = M.ancho / n;
  const w = slot * 0.62;
  const decimales = datos.some((d) => !Number.isInteger(d.valor)) ? 1 : 0;
  datos.forEach((d, i) => {
    const h = zonaAlto * Math.max(0, d.valor) / max;
    const x = M.l + slot * i + (slot - w) / 2;
    const t0 = 300 + i * 120;
    capas.push({ k: 'caja', id: `barra${i + 1}`, x, y: abajo - h, w, h: Math.max(h, 0.002), color: ctx.acento, radio: M.fr(6), entra: tramo('crecer-y', t0, 650, 'cuarta') });
    const val = capaTexto(ctx, { id: `valor${i + 1}`, s: `${formatearNumero(d.valor, decimales)}${unidad ? ` ${unidad}` : ''}`, maxLineas: 1, ancho: slot, tamMax: 30, tamMin: 14, peso: 700, interlineado: 1.2, partir: 'linea', entra: tramo('aparecer', t0 + 400, 300, 'estandar') });
    val.x = M.l + slot * i;
    val.y = abajo - h - altoTexto(val, M.a) - M.alto(M.fr(8));
    const et = capaTexto(ctx, { id: `etiqueta${i + 1}`, s: d.etiqueta, maxLineas: 1, ancho: slot * 0.96, tamMax: 26, tamMin: 12, peso: 500, interlineado: 1.2, partir: 'linea', tinta: 0.8, entra: tramo('aparecer', t0, 300, 'estandar') });
    et.x = M.l + slot * i + slot * 0.02;
    et.y = abajo + M.alto(M.fr(10));
    capas.push(val, et);
  });
  return capas;
}

function testimonio(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const pila: Array<{ alto: number; poner: (y: number) => void; aire?: number }> = [];
  const comillas = capaTexto(ctx, { id: 'comillas', s: '“', maxLineas: 1, tamMax: 180, tamMin: 120, peso: 800, interlineado: 0.7, partir: 'linea', color: ctx.acento, familia: 'Playfair Display', entra: tramo('escalar', 0, 400, R.pop) });
  capas.push(comillas);
  pila.push({ alto: altoTexto(comillas, M.a) * 0.75, poner: (y) => { comillas.y = y; } });
  // Testimonial de ad-video: líneas cada 200 ms, 400 ms cada una, sin pasarse (ni blur ni escala en el cuerpo).
  const cita = capaTexto(ctx, { id: 'cita', s: texto(v, 'cita'), maxLineas: 5, ancho: M.ancho * 0.9, tamMax: 60, tamMin: 30, peso: 500, interlineado: 1.3, partir: 'linea', entra: tramo('deslizar', 270, 400, 'salida', 200) });
  capas.push(cita);
  pila.push({ alto: altoTexto(cita, M.a), poner: (y) => { cita.y = y; }, aire: M.alto(M.fr(10)) });
  let siguiente = finDeEntrada(cita) + 130;
  const estrellas = numero(v, 'estrellas');
  if (estrellas > 0) {
    const base = capaTexto(ctx, { id: 'estrellas-base', s: '★★★★★', maxLineas: 1, tamMax: 46, tamMin: 28, peso: 400, tracking: 0.12, interlineado: 1.2, partir: 'linea', tinta: 0.25, entra: tramo('aparecer', siguiente, 200, 'estandar') });
    const llenas: CapaTexto = { ...base, id: 'estrellas', color: ctx.acento, tinta: undefined, corte: 1 - estrellas / 5, entra: tramo('barrido', siguiente + 100, 470, 'cubica') };
    delete llenas.tinta;
    capas.push(base, llenas);
    pila.push({ alto: altoTexto(base, M.a), poner: (y) => { base.y = y; llenas.y = y; }, aire: M.alto(M.fr(30)) });
    siguiente += 570;
  }
  const nombre = capaTexto(ctx, { id: 'nombre', s: texto(v, 'nombre'), maxLineas: 1, tamMax: 38, tamMin: 22, peso: 700, interlineado: 1.25, partir: 'linea', entra: tramo('deslizar', siguiente + 100, 400, 'salida') });
  capas.push(nombre);
  pila.push({ alto: altoTexto(nombre, M.a), poner: (y) => { nombre.y = y; }, aire: M.alto(M.fr(30)) });
  const cargoS = texto(v, 'cargo');
  if (cargoS) {
    const cargo = capaTexto(ctx, { id: 'cargo', s: cargoS, maxLineas: 1, tamMax: 30, tamMin: 18, peso: 400, interlineado: 1.3, partir: 'linea', tinta: 0.72, entra: tramo('deslizar', siguiente + 180, 400, 'salida') });
    capas.push(cargo);
    pila.push({ alto: altoTexto(cargo, M.a), poner: (y) => { cargo.y = y; }, aire: M.alto(M.fr(4)) });
  }
  apilar(pila, M, M.vertical ? 0.42 : 0.5);
  return capas;
}

function oferta(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const pila: Array<{ alto: number; poner: (y: number) => void; aire?: number }> = [];
  const ante = texto(v, 'antetitulo');
  if (ante) {
    const k = capaTexto(ctx, { id: 'antetitulo', s: ante, maxLineas: 1, tamMax: 26, tamMin: 16, peso: 700, mayus: true, tracking: 0.16, partir: 'linea', color: ctx.acento, entra: tramo('aparecer', 300, 400, 'estandar') });
    capas.push(k);
    pila.push({ alto: altoTexto(k, M.a), poner: (y) => { k.y = y; } });
  }
  // El sello: 16 puntas, interior 0,78 (la ráfaga de los showcases de ad-video). En un tono serio, sin rebote.
  const r = M.fr(M.vertical ? 150 : 120);
  const sello: CapaForma = { k: 'forma', id: 'sello', cx: 0.5, cy: 0, r, puntas: 16, interior: 0.8, color: ctx.acento, entra: tramo('girar', 0, 450, R.pop) };
  const desc = capaTexto(ctx, { id: 'descuento', s: texto(v, 'descuento'), maxLineas: 1, ancho: r * 1.5, tamMax: 80, tamMin: 24, peso: 800, tracking: -0.02, interlineado: 1, partir: 'linea', color: tintaSobre(ctx.acento), entra: tramo('girar', 0, 450, R.pop) });
  capas.push(sello, desc);
  pila.push({ alto: M.alto(r * 2), poner: (y) => { sello.cy = y + M.alto(r); desc.y = sello.cy - altoTexto(desc, M.a) / 2; }, aire: M.alto(M.fr(16)) });
  const prod = texto(v, 'producto');
  if (prod) {
    const p = capaTexto(ctx, { id: 'producto', s: prod, maxLineas: 2, tamMax: 76, tamMin: 32, peso: 800, tracking: -0.01, interlineado: 1.1, partir: 'linea', entra: tramo('subir', 450, R.dur * 0.8, R.entra, R.pasoLinea) });
    capas.push(p);
    pila.push({ alto: altoTexto(p, M.a), poner: (y) => { p.y = y; }, aire: M.alto(M.fr(22)) });
  }
  const precio = texto(v, 'precio');
  const antes = texto(v, 'precioAntes');
  if (precio || antes) {
    const pr = precio ? capaTexto(ctx, { id: 'precio', s: precio, maxLineas: 1, ancho: M.ancho * 0.5, tamMax: 56, tamMin: 26, peso: 800, interlineado: 1.15, partir: 'linea', color: ctx.acento, entra: tramo('deslizar', 750, 500, R.entra) }) : null;
    const an = antes ? capaTexto(ctx, { id: 'precio-antes', s: antes, maxLineas: 1, ancho: M.ancho * 0.4, tamMax: 36, tamMin: 18, peso: 400, interlineado: 1.15, partir: 'linea', tinta: 0.6, tachado: true, entra: tramo('aparecer', 850, 400, 'estandar') }) : null;
    const wP = pr ? anchoTexto(pr) : 0;
    const wA = an ? anchoTexto(an) : 0;
    const aire = pr && an ? M.fr(24) : 0;
    const x0 = 0.5 - (wP + aire + wA) / 2;
    if (pr) { pr.alinear = 'izquierda'; pr.x = x0; pr.ancho = wP + 0.01; capas.push(pr); }
    if (an) { an.alinear = 'izquierda'; an.x = x0 + wP + aire; an.ancho = wA + 0.01; capas.push(an); }
    const alto = Math.max(pr ? altoTexto(pr, M.a) : 0, an ? altoTexto(an, M.a) : 0);
    pila.push({ alto, poner: (y) => { if (pr) pr.y = y + (alto - altoTexto(pr, M.a)) / 2; if (an) an.y = y + (alto - altoTexto(an, M.a)) / 2; }, aire: M.alto(M.fr(14)) });
  }
  const boton = texto(v, 'boton');
  if (boton) {
    const b = pildora(ctx, 'boton', boton, tramo('escalar', 1000, R.durPop, R.pop), 1000 + R.durPop + 500);
    capas.push(b.caja, b.label);
    pila.push({ alto: b.alto, poner: b.poner, aire: M.alto(M.fr(30)) });
  }
  apilar(pila, M, M.vertical ? 0.42 : 0.5);
  return capas;
}

function cierre(ctx: Ctx): Capa[] {
  const { R, M, v } = ctx;
  const capas: Capa[] = [];
  const pila: Array<{ alto: number; poner: (y: number) => void; aire?: number }> = [];
  const t = capaTexto(ctx, { id: 'titulo', s: texto(v, 'titulo'), maxLineas: 3, tamMax: 124, tamMin: 48, peso: 800, tracking: -0.02, interlineado: 1.1, partir: 'linea', entra: tramo('subir', 100, R.dur, R.entra, R.pasoLinea) });
  capas.push(t);
  pila.push({ alto: altoTexto(t, M.a), poner: (y) => { t.y = y; } });
  const fin = finDeEntrada(t);
  const b = pildora(ctx, 'boton', texto(v, 'boton'), tramo('escalar', fin - 100, R.durPop, R.pop), fin - 100 + R.durPop + 400);
  capas.push(b.caja, b.label);
  pila.push({ alto: b.alto, poner: b.poner, aire: M.alto(M.fr(40)) });
  const det = texto(v, 'detalle');
  if (det) {
    const d = capaTexto(ctx, { id: 'detalle', s: det, maxLineas: 1, tamMax: 30, tamMin: 18, peso: 500, interlineado: 1.3, partir: 'linea', tinta: 0.78, entra: tramo('aparecer', fin + R.durPop, 500, 'estandar') });
    capas.push(d);
    pila.push({ alto: altoTexto(d, M.a), poner: (y) => { d.y = y; }, aire: M.alto(M.fr(28)) });
  }
  apilar(pila, M, M.vertical ? 0.42 : 0.5);
  return capas;
}

const ARMAR: Record<MotionSpec['plantilla'], (ctx: Ctx) => Capa[]> = { titular, palabras, cifra, tercio, logo, barras, testimonio, oferta, cierre };

/** La salida de un clip: todo se apaga con el tono, de abajo hacia arriba, y el último cuadro queda limpio. */
function conSalida(capas: Capa[], durMs: number, R: Ritmo) {
  const t0 = Math.max(0, durMs - DUR_SALE - 80 - (capas.length - 1) * 30);
  capas.forEach((c, i) => {
    if (!c.sale) c.sale = tramo('aparecer', t0 + (capas.length - 1 - i) * 30, DUR_SALE, R.sale);
  });
}

export type OpcionesEscena = {
  /** Ancho / alto de la caja. */
  aspecto: number;
  /** Un clip de video: dura `durMs` y sale al final. La landing no sale. */
  video?: boolean;
  durMs?: number;
};

/** El spec (ya normalizado o no: pasa otra vez por `normalizarMotion`) → la escena. */
export function armarEscena(spec: unknown, op: OpcionesEscena): Escena {
  const { spec: s } = normalizarMotion(spec, { estricto: false });
  const a = Number.isFinite(op.aspecto) && op.aspecto > 0.2 && op.aspecto < 5 ? op.aspecto : 16 / 9;
  const def = PLANTILLAS[s.plantilla];
  const video = !!op.video;
  const durMs = Math.max(1000, Math.min(60_000, Math.round(op.durMs ?? def.duracionMs)));
  const tono = (typeof s.valores.tono === 'string' ? s.valores.tono : 'corporativo') as Tono;
  const R = RITMOS[tono] ?? RITMOS.corporativo;
  const fuente = typeof s.valores.fuente === 'string' && FUENTES_MOTION[s.valores.fuente] ? s.valores.fuente : FUENTE_MOTION_DEFECTO;
  const ctx: Ctx = {
    v: s.valores, R, M: marco(a), familia: fuente, video, durMs,
    tinta: color(s.valores, 'colorTexto', '#f5f7fa'), acento: color(s.valores, 'colorAcento', '#ffc24b'),
  };
  const capas = ARMAR[s.plantilla](ctx);
  if (video) conSalida(capas, durMs, R);
  const conFondo = s.valores.conFondo === true;
  // Lo que lee un lector de pantalla, en el orden de las capas (las estrellas, como «N de 5 estrellas»).
  const estrellas = numero(s.valores, 'estrellas');
  const textoEntero = capas
    .map((c) => {
      if (c.k === 'cifra') return c.partes.map((p) => ('d' in p ? String(p.d) : p.s)).join('');
      if (c.k !== 'texto' || c.id === 'comillas' || c.id === 'inicial' || c.id === 'estrellas-base') return '';
      if (c.id === 'estrellas') return `${formatearNumero(estrellas, Number.isInteger(estrellas) ? 0 : 1)} de 5 estrellas`;
      return c.lineas.join(' ');
    })
    .filter(Boolean)
    .reduce((acc, s) => (acc ? `${acc}${/[.!?…:]$/.test(acc) ? '' : '.'} ${s}` : s), '');
  return { aspecto: a, durMs: video ? durMs : Math.max(...capas.map(finDeEntrada), 0), fondo: conFondo ? color(s.valores, 'colorFondo', '#0e1116') : null, capas, texto: textoEntero };
}
