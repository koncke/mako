/**
 * Lo que comparten las láminas del catálogo (app/_cursos/laminas/): el lienzo, el reparto del
 * texto en renglones, la tinta legible sobre un fondo cualquiera, los ids por instancia y el número
 * dibujado a mano.
 *
 * LA MISMA LÓGICA PARA TODAS (pedido de Martín, 07/10/2026: «que todos tengan la misma lógica»):
 * número grande arriba, de dos cifras; un rótulo tipo MÓDULO; el texto debajo; y dos colores, A (el
 * protagonista) y B (el acento). Cada diseño decide DÓNDE va cada cosa; lo de acá decide que no se
 * rompa.
 *
 * TRES REGLAS QUE NO SON DE ESTILO, y valen para cada diseño nuevo:
 *
 * 1. SIN HOOKS Y SIN `'use client'`. Son funciones puras: las dibuja el server (el portal del alumno)
 *    y el navegador (el selector), con la misma respuesta. Nada de `Math.random()` ni `Date`: lo
 *    que varía (el giro de la nota, las fibras del cartón) sale de `azar(semilla)`, que es entero.
 * 2. LOS `id` SON ÚNICOS POR INSTANCIA y salen de un hash de TODO lo que cambia el dibujo (diseño,
 *    número, texto, colores, rótulo) más la `instancia` que pasa quien dibuja dos iguales en la
 *    misma página. Un id de SVG es GLOBAL al documento: con dos láminas en pantalla, un
 *    `url(#x)` repetido resuelve contra la PRIMERA (ver la nota 1 de PortadaModulo.tsx).
 * 3. EL TEXTO NO ROMPE EL DISEÑO: tiene tope (lib/laminas.ts), se reparte en renglones con el mismo
 *    reparto que el cuaderno, se achica hasta un piso de lectura, una palabra que ni sola entra se
 *    parte con guion, y la caja va en un `<svg>` anidado que RECORTA si la estimación del ancho se
 *    equivoca (otra tipografía de respaldo, un glifo raro). El tope de cada diseño está medido con
 *    el texto más largo permitido en tests/laminas.test.ts.
 *
 * ⚠️ NADA DE CARACTERES DE 3 BYTES EN EL CÓDIGO (flechas, puntos suspensivos, estrellas): van
 *    escapados. Es la misma regla que CursoUgc.tsx, por la misma razón (un reemplazo con PowerShell
 *    los volvió rombos una vez).
 */

import type { ReactNode } from 'react';
import {
  AVANCE, EJE_G, FAMILIA, GLIFOS, TINTA, TRACKING, anchoEm, h32, limpiarTitulo, repartir,
} from '@/app/conocimientos/PortadaModulo';
import { contraste, mezclar } from '@/lib/curso-estilo';
import { textoLamina } from '@/lib/laminas';

export { TINTA };

/** 320x180 = 16:9, el aspect-ratio de la tarjeta (`.ugc-modcard-cover`). 1 unidad ~ 0,92 css px. */
export const W = 320;
export const H = 180;

/** El claro de las láminas oscuras: un blanco apenas cálido, como la tiza o el papel. */
export const CLARO = '#FBFAF4';

/**
 * Las tipografías. Ninguna se descarga: son las que ya están (Archivo la carga la hoja del curso) o
 * las del sistema, con su respaldo. El ancho de cada una se ESTIMA (esto corre en el server: no hay
 * DOM para medir) con la tabla del cuaderno (`anchoEm`, calibrada en Archivo 900) por un factor:
 *   · archivo  1,00 — la de la tabla.
 *   · mano     1,12 — Segoe Print es la más ancha de la pila; Comic Sans y Chalkboard, un poco menos.
 *   · maquina  0,62 por carácter — monoespaciada: Courier New mide 0,60; Menlo 0,60; Consolas 0,55.
 *   · serif    1,00 — Georgia en negrita anda cerca de Archivo 900.
 * El margen de error lo cubre `SEGURO` (el mismo 0,86 que el cuaderno midió) y, si aun así se pasa,
 * el recorte de la caja.
 */
export const LETRA = {
  archivo: FAMILIA,
  mano: "'Segoe Print', 'Bradley Hand', 'Chalkboard SE', 'Comic Sans MS', 'Comic Neue', cursive",
  maquina: "'Courier New', Courier, ui-monospace, Menlo, Consolas, monospace",
  serif: "Georgia, 'Times New Roman', Times, serif",
} as const;

export const MEDIR = {
  archivo: (s: string) => anchoEm(s),
  mano: (s: string) => anchoEm(s) * 1.12,
  maquina: (s: string) => Array.from(s).length * 0.62,
  serif: (s: string) => anchoEm(s),
} as const;

const SEGURO = 0.86;
/** Marca interna de «esta pieza sigue en la próxima»: no viaja al dibujo (se vuelve guion o se pega). */
const SIGUE = '\u00AD';

/** Una palabra que ni sola entra en la caja al piso de lectura, partida en pedazos que sí. */
export function partir(palabra: string, maxEm: number, medir: (s: string) => number): string[] {
  if (medir(palabra) <= maxEm) return [palabra];
  const chars = Array.from(palabra);
  const piezas: string[] = [];
  let actual = '';
  for (const c of chars) {
    if (actual && medir(`${actual}${c}-`) > maxEm) { piezas.push(actual + SIGUE); actual = ''; }
    actual += c;
  }
  if (actual) piezas.push(actual);
  return piezas;
}

/**
 * El texto con sus palabras demasiado largas ya partidas y con su guion a la vista, para un reparto
 * que NO es el de acá (el del cuaderno, que corta sólo en espacios).
 */
export function conPalabrasPartidas(texto: string, maxEm: number, medir: (s: string) => number = MEDIR.archivo): string {
  return texto.split(' ').flatMap((p) => (p ? partir(p, maxEm, medir) : [])).map((p) => (p.endsWith(SIGUE) ? `${p.slice(0, -1)}-` : p)).join(' ');
}

/** Las piezas de un renglón, con los pedazos de una misma palabra vueltos a pegar. */
function unir(piezas: string[]): string {
  let s = '';
  for (const p of piezas) s += s && !s.endsWith(SIGUE) ? ` ${p}` : p;
  s = s.split(SIGUE + ' ').join('').split(SIGUE).join('');
  // El pedazo que quedó al final del renglón sigue en el de abajo: lleva su guion.
  return piezas.length && piezas[piezas.length - 1].endsWith(SIGUE) ? `${s}-` : s;
}

export type Caja = { x: number; y: number; ancho: number; alto: number };
export type Reparto = { lineas: string[]; fs: number; alto: number; inter: number; cap: number };
/**
 * Cómo acomoda su texto un diseño: la caja, las reglas del reparto, y si va en mayúsculas. Cada
 * diseño EXPORTA el suyo, y el test lo corre con el texto más largo permitido.
 */
export type AjusteDeTexto = { caja: Caja; opciones: OpcionesTexto; mayus: boolean };
export type OpcionesTexto = {
  fsMax: number;
  /** El piso de lectura: con el tope del diseño, el texto más largo permitido no baja de acá. */
  fsPiso: number;
  maxLineas: number;
  /** Interlineado / cuerpo. */
  inter?: number;
  /** Alto de la mayúscula / cuerpo. */
  cap?: number;
  medir?: (s: string) => number;
};

/**
 * EL AJUSTE: de 1 a `maxLineas` renglones, el que deja la letra MÁS GRANDE (con más renglones sólo si
 * gana más de un 8 %, o si el anterior no llegaba al piso). El reparto es el del cuaderno
 * (`repartir`, minimizando el renglón más ancho), con la medida de la tipografía de cada diseño.
 *
 * ⚠️ NO ES LA REGLA DEL CUADERNO («la menor cantidad de renglones que llegue al piso»), y a propósito:
 *    allá el número es la variable dependiente —cada renglón de menos es número de más—; acá la caja
 *    del texto es FIJA, y con aquella regla «Construye tu oferta irresistible» quedaba en un renglón
 *    de 13 unidades sobre una caja donde dos renglones de 21 entraban sobrados (medido en la primera
 *    galería, 07/10/2026).
 */
export function ajustarTexto(texto: string, caja: { ancho: number; alto: number }, o: OpcionesTexto): Reparto {
  const inter = o.inter ?? 1.1;
  const cap = o.cap ?? 0.72;
  const medir = o.medir ?? MEDIR.archivo;
  const util = caja.ancho * SEGURO;
  const palabras: string[] = [];
  for (const p of texto.split(' ')) {
    if (!p) continue;
    // Un separador suelto se pega a la palabra anterior: si no, un renglón puede empezar con un
    // guion huérfano (la misma regla del cuaderno).
    if (/^[-\u2013\u2014|·]$/u.test(p) && palabras.length) palabras[palabras.length - 1] += ` ${p}`;
    else palabras.push(p);
  }
  const piezas = palabras.flatMap((p) => partir(p, util / o.fsPiso, medir));
  if (!piezas.length) return { lineas: [], fs: 0, alto: 0, inter, cap };
  let lineas: string[] = [];
  let fs = 0;
  for (let L = 1; L <= Math.min(o.maxLineas, piezas.length); L++) {
    const r = repartir(piezas, L, medir);
    if (!r) break;
    const cand = r.map(unir);
    const mayor = Math.max(...cand.map(medir));
    const f = Math.min(o.fsMax, util / mayor, caja.alto / ((L - 1) * inter + cap));
    if (!lineas.length || f > fs * 1.08 || (fs < o.fsPiso && f > fs)) { lineas = cand; fs = f; }
  }
  return { lineas, fs, alto: ((lineas.length - 1) * inter + cap) * fs, inter, cap };
}

/**
 * El texto en mayúsculas SIN CAMBIARLE EL LARGO. `toLocaleUpperCase` puede volver dos letras de una
 * («ß» da «SS», la ligadura de «fi» da «FI», la «ǰ» da una «J» más su marca), y el tope del diseño
 * se contó ANTES, sobre lo que se escribió: treinta «ß» en la entrada eran sesenta letras a máquina
 * y el texto bajaba a 6,7 con un piso de 10 (medido en la revisión del 08/10/2026). La letra que
 * crecería se queda como está.
 */
export function mayusculas(texto: string): string {
  return Array.from(texto, (c) => {
    const m = c.toLocaleUpperCase('es');
    return Array.from(m).length === 1 ? m : c;
  }).join('');
}

/** El reparto de un diseño, con SU caja y SUS reglas (y en mayúsculas si el diseño las usa). */
export const repartoDe = (texto: string, a: AjusteDeTexto): Reparto =>
  ajustarTexto(a.mayus ? mayusculas(texto) : texto, a.caja, a.opciones);

/**
 * La tinta que se LEE sobre `fondo`: la oscura o la clara, la que más contraste dé. Si ninguna de
 * las dos llega a 4,5 (un gris medio contra una tinta que no es negro puro), negro o blanco puros,
 * y uno de esos dos SIEMPRE llega: el peor fondo posible da 4,58 contra el mejor de los dos.
 *
 * ⚠️ ES LO QUE HACE QUE UN COLOR ELEGIDO NO PUEDA DEJAR EL TEXTO INVISIBLE. El color no se corrige
 *    (es el que la persona eligió): se elige la tinta que va encima.
 */
export function tintaSobre(fondo: string, oscura: string = TINTA, clara: string = CLARO): string {
  const co = contraste(oscura, fondo);
  const cc = contraste(clara, fondo);
  if (Math.max(co, cc) >= 4.5) return co >= cc ? oscura : clara;
  return contraste('#000000', fondo) >= contraste('#FFFFFF', fondo) ? '#000000' : '#FFFFFF';
}

/**
 * `color`, empujado hacia el negro o el blanco hasta que se distinga de `fondo` (contraste ≥ `min`).
 * Es para lo que no es texto pero no puede desaparecer —el número, la tiza sobre el pizarrón—: elegir
 * el mismo color para A y B dejaría el número invisible, que es romper el diseño.
 */
export function visibleSobre(color: string, fondo: string, min = 2): string {
  if (contraste(color, fondo) >= min) return color;
  const hacia = contraste('#000000', fondo) >= contraste('#FFFFFF', fondo) ? '#000000' : '#FFFFFF';
  for (let i = 1; i <= 20; i++) {
    const c = mezclar(color, hacia, i / 20);
    if (contraste(c, fondo) >= min) return c;
  }
  return hacia;
}

/** El id de una instancia: un hash de todo lo que cambia el dibujo (ver la regla 2 de la cabecera). */
export function uidLamina(partes: ReadonlyArray<string | number | null | undefined>): string {
  return `lm${h32(partes.map((p) => (p == null ? '' : String(p))).join('\u0000')).toString(36)}`;
}

/**
 * Un azar DETERMINISTA (mulberry32), para la variación de cada lámina. Enteros nada más: la misma
 * semilla da lo mismo en el server y en el navegador. Y la variación no codifica nada: la textura
 * del corcho no dice nada del módulo.
 */
export function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Las cifras del número: dos como mínimo, tres como máximo («07», «104»). */
export function cifras(n: number): string {
  const v = Number.isFinite(n) ? Math.min(999, Math.max(0, Math.trunc(n))) : 0;
  return String(v).padStart(2, '0');
}

/** El rótulo («MÓDULO», «ETAPA»), en versalitas y con techo: es una palabra, no una frase. */
export function rotuloDe(rotulo: string): string {
  return Array.from((rotulo || '').replace(/\s+/g, ' ').trim().toUpperCase()).slice(0, 14).join('');
}

/**
 * LO QUE SE DIBUJA DEBAJO DEL NÚMERO. El texto elegido, si hay; si no, el nombre del módulo
 * limpio con la regla del cuaderno (`limpiarTitulo`: sin «Módulo 7 - », que repite el número).
 *
 * ⚠️ EL NOMBRE SÍ SE RECORTA AL TOPE, con «…», y el texto elegido no hace falta (ya viene con el
 *    tope puesto). El cuaderno no recorta nunca, porque su reparto llega a cuatro renglones; estos
 *    diseños tienen cajas más chicas, y el nombre completo ya está escrito en texto de verdad
 *    debajo de la tarjeta (`.ugc-modcard-t`): el de la lámina es un eco.
 */
export function textoDeLamina(texto: string | null | undefined, nombre: string | null | undefined, tope: number): string {
  const propio = textoLamina(texto, tope);
  if (propio) return propio;
  const base = limpiarTitulo(nombre ?? '');
  const chars = Array.from(base);
  if (chars.length <= tope) return base;
  const corte = chars.slice(0, tope - 1).join('');
  const espacio = corte.lastIndexOf(' ');
  const cuerpo = espacio > tope * 0.5 ? corte.slice(0, espacio) : corte;
  return `${cuerpo.replace(/[\s,.;:\u2013\u2014-]+$/u, '')}\u2026`;
}

export const r2 = (v: number) => Math.round(v * 100) / 100;

/** Las props que recibe cada dibujo, ya saneadas por `Lamina` (index.tsx). */
export type PropsDibujo = {
  n: number;
  rotulo: string;
  /** El texto ya resuelto (elegido o el nombre), con el tope del diseño. */
  texto: string;
  /** `#RRGGBB`, sin corregir: cada diseño decide la tinta que va encima. */
  a: string;
  b: string;
  className?: string;
  /** El id base de esta instancia (`uidLamina`). Los `id` del SVG se arman con esto + un sufijo. */
  uid: string;
  /** La semilla de la variación decorativa. */
  semilla: number;
};

/**
 * El `<svg>` de toda lámina. `ugc-lamina` va SIEMPRE: es el enganche por el que la hoja del curso le
 * aplica el mismo revelado que a una tapa real (ver PortadaModulo.tsx), y los mismos `position`,
 * `inset` y `height: 100%` que el cuaderno ya midió (un svg es un elemento reemplazado).
 * Decorativa: el nombre del módulo está escrito en texto de verdad en la tarjeta.
 */
export function SvgLamina({ className, familia = LETRA.archivo, children }: { className?: string; familia?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className ? `ugc-lamina ${className}` : 'ugc-lamina'}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', fontFamily: familia }}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * Los renglones de un texto, adentro de su caja, con el RECORTE puesto: un `<svg>` anidado clipea por
 * default (es lo que hace el cuaderno, y no gasta un id). La caja de recorte se pasa del bloque un
 * poco abajo, para las letras que bajan de la línea («g», «p»).
 */
export function Renglones({ caja, reparto, color, familia, peso = 700, alinear = 'inicio', vertical = 'arriba', espaciado = 0, opacidad }: {
  caja: Caja; reparto: Reparto; color: string; familia: string; peso?: number;
  alinear?: 'inicio' | 'centro' | 'fin'; vertical?: 'arriba' | 'centro' | 'abajo'; espaciado?: number; opacidad?: number;
}) {
  if (!reparto.lineas.length) return null;
  const { fs, inter, cap } = reparto;
  const top = vertical === 'arriba' ? caja.y : vertical === 'centro' ? caja.y + (caja.alto - reparto.alto) / 2 : caja.y + caja.alto - reparto.alto;
  const x = alinear === 'inicio' ? caja.x : alinear === 'centro' ? caja.x + caja.ancho / 2 : caja.x + caja.ancho;
  const anchor = alinear === 'inicio' ? 'start' : alinear === 'centro' ? 'middle' : 'end';
  const margen = 3;
  const cx = caja.x - margen;
  const cy = caja.y - margen;
  const cw = caja.ancho + margen * 2;
  const ch = caja.alto + margen + fs * 0.32;
  return (
    <svg x={r2(cx)} y={r2(cy)} width={r2(cw)} height={r2(ch)} viewBox={`${r2(cx)} ${r2(cy)} ${r2(cw)} ${r2(ch)}`}>
      <g fill={color} fontFamily={familia} fontWeight={peso} fontSize={r2(fs)} textAnchor={anchor} letterSpacing={espaciado || undefined} opacity={opacidad}>
        {reparto.lineas.map((l, i) => (
          <text key={i} x={r2(x)} y={r2(top + cap * fs + i * inter * fs)}>{l}</text>
        ))}
      </g>
    </svg>
  );
}

/** Lo que mide de ancho un número dibujado con el alfabeto del cuaderno, con su trazo. */
export function anchoNumeroMano(digitos: string, alto: number, trazo: number): number {
  const k = alto / (76 + trazo);
  const avance = Array.from(digitos).reduce((t, d) => t + (AVANCE[Number(d)] ?? 58), 0) + TRACKING * (digitos.length - 1);
  return avance * k;
}

/**
 * EL NÚMERO ESCRITO A MANO, con el alfabeto del cuaderno (`GLIFOS`), en un solo trazo: la tiza de la
 * pizarra y el marcador de la nota. No depende de que haya cargado ninguna tipografía.
 * `x` es el borde izquierdo de la tinta y `y` su tapa. Cada cifra lee SUS bits de giro (si
 * compartieran, el «11» saldría con los dos palos torcidos igual).
 */
export function NumeroMano({ digitos, x, y, alto, trazo, color, semilla, opacidad, corrida }: {
  digitos: string; x: number; y: number; alto: number; trazo: number; color: string; semilla: number;
  opacidad?: number;
  /** Un segundo pasado corrido (el polvo de la tiza): `[dx, dy, ancho extra, opacidad]`. */
  corrida?: [number, number, number, number];
}) {
  const k = alto / (76 + trazo);
  const ds = Array.from(digitos).map(Number);
  const trazos = ds.map((d, i) => {
    let cursor = 0;
    for (let j = 0; j < i; j++) cursor += (AVANCE[ds[j]] ?? 58) + TRACKING;
    const rot = (((semilla >>> (i * 3)) & 7) / 7) * 3.2 - 1.6;
    const tx = cursor + (AVANCE[d] ?? 58) / 2 - (EJE_G[d] ?? 32);
    return { d: GLIFOS[d] ?? GLIFOS[0], t: `translate(${r2(tx)},0) rotate(${r2(rot)},${EJE_G[d] ?? 32},50)` };
  });
  const base = `translate(${r2(x)},${r2(y - (12 - trazo / 2) * k)}) scale(${r2(k * 1000) / 1000})`;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {corrida && (
        <g transform={`translate(${corrida[0]},${corrida[1]}) ${base}`} stroke={color} strokeWidth={trazo + corrida[2]} opacity={corrida[3]}>
          {trazos.map((t, i) => <path key={i} d={t.d} transform={t.t} />)}
        </g>
      )}
      <g transform={base} stroke={color} strokeWidth={trazo} opacity={opacidad}>
        {trazos.map((t, i) => <path key={i} d={t.d} transform={t.t} />)}
      </g>
    </g>
  );
}
