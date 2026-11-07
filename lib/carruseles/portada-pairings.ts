// =============================================================================
// La portada «best font Pairings», medida sobre la referencia real (7/11/2026)
// =============================================================================
// Es la copia que pidió Martín: la portada de @growithalex con Mauricio en lugar del influencer y
// Walter White intacto. Sirve de PRUEBA VIVA de que cada letra es editable y conserva su propia
// tipografía — que es lo único que él pidió comprobar.
//
// ── De dónde salen estos números ────────────────────────────────────────────
//
// De contar píxeles sobre el original de 1080×1350, no de mirarlo. Se midió la caja de tinta de
// cada bloque y, por separado, la altura de x (o de mayúscula) de una letra sin ascendentes ni
// descendentes, porque la caja entera miente: «best» y «irings» tienen cuerpos distintos y la caja
// no lo muestra, ya que una tiene «b» y la otra tiene «g».
//
// Lo que esa medición encontró, y no se veía a ojo: **«Pa» es bastante más grande que «irings»**
// (110 px contra 76). Son dos bloques de la misma familia con dos cuerpos distintos, pegados: el
// caso exacto que dos ranuras de fuente no pueden expresar.
//
// ⚠️ `left`/`top` son de la CAJA, no de la tinta, y la diferencia entre una y otra depende de las
// métricas de cada fuente. Están calculados restando el hueco de ascendente al tope de tinta medido,
// así que son fieles pero no exactos al píxel: la última pasada se hace arrastrando en el editor,
// que es justamente para lo que está.
//
// ── Las tipografías ─────────────────────────────────────────────────────────
//
// El original usa una grotesca comercial (del aire de Helvetica Now) y una Didone itálica. Las dos
// equivalentes libres salen del catálogo del editor (`app/image-editor/mako/fuentes.ts`), que
// verifica archivo por archivo que el peso EXISTA:
//
//   · Inter — 100 a 900 con itálicas. Es la neo-grotesca más cercana y ya es la de cuerpo del repo.
//   · Playfair Display — itálica en los seis pesos. Es la del «font»: alto contraste y remate de
//     bola en la «f», que es lo que la identifica.
//
// Inter sale un poco más ancha que la del original (la del ejemplo mide ~0,56 em por carácter en
// mayúsculas y la de Inter ~0,65): por eso el encabezado lleva tracking negativo.

import { type BloqueMedido, type Plancha, documentoDeClon } from './clon-fiel';

/** La grotesca: encabezado, «best», «Pa», «06», «irings». */
export const GROTESCA = 'Inter';
/** La itálica serif de alto contraste: la palabra «font», y nada más. */
export const SERIF_ITALICA = 'Playfair Display';

const TINTA = '#111111';
const GRIS_ENCABEZADO = '#303435';
const VERDE_PLACA = '#0F5B33';

/**
 * Los ocho bloques, en orden de pintado. El encabezado primero porque es lo que se lee primero;
 * el orden dentro del documento no cambia el resultado salvo donde hay superposición («best» y
 * «font» se pisan a propósito, como en el original).
 */
export const BLOQUES_PAIRINGS: readonly BloqueMedido[] = [
  { nombre: 'Encabezado: fecha', texto: 'AUG ©2026', familia: GROTESCA, peso: 700, italica: false, tam: 17, left: 114, top: 64, ancho: 250, color: GRIS_ENCABEZADO, espaciado: -20, alin: 'left' },
  { nombre: 'Encabezado: cuenta', texto: 'GROWITHALEX', familia: GROTESCA, peso: 700, italica: false, tam: 17, left: 397, top: 64, ancho: 250, color: GRIS_ENCABEZADO, espaciado: -20, alin: 'center' },
  { nombre: 'Encabezado: rol', texto: 'CREATIVE STRATEGIST', familia: GROTESCA, peso: 700, italica: false, tam: 17, left: 742, top: 64, ancho: 250, color: GRIS_ENCABEZADO, espaciado: -20, alin: 'right' },

  { nombre: 'Titular: best', texto: 'best', familia: GROTESCA, peso: 800, italica: false, tam: 111, left: 374, top: 186, ancho: 300, color: TINTA, espaciado: -30, alin: 'left' },
  // La única itálica de la pieza, y la que más se nota si se pierde.
  { nombre: 'Titular: font', texto: 'font', familia: SERIF_ITALICA, peso: 900, italica: true, tam: 210, left: 275, top: 225, ancho: 520, color: TINTA, alin: 'left' },

  // La placa de tabla periódica de Breaking Bad: texto BLANCO sobre color, que el estilo por roles
  // no sabe expresar (su `tinta` es una sola para toda la lámina).
  { nombre: 'Pa (placa)', texto: 'Pa', familia: GROTESCA, peso: 800, italica: false, tam: 110, left: 414, top: 478, ancho: 110, color: '#FFFFFF', espaciado: -30, alin: 'left',
    placa: { left: 404, top: 464, ancho: 103, alto: 103, color: VERDE_PLACA } },
  { nombre: 'Pa: número', texto: '06', familia: GROTESCA, peso: 700, italica: false, tam: 30, left: 462, top: 464, ancho: 50, color: '#FFFFFF', alin: 'left' },

  { nombre: 'Titular: irings', texto: 'irings', familia: GROTESCA, peso: 800, italica: false, tam: 76, left: 514, top: 469, ancho: 220, color: TINTA, espaciado: -20, alin: 'left' },
] as const;

/**
 * El documento listo para abrir en el editor.
 *
 * `plancha` es la imagen **sin letras**: si se le pasa la original con el texto quemado, cada
 * palabra se ve dos veces y parece que todo está roto.
 */
export const documentoPairings = (plancha: Plancha, nuevoId: () => string): Record<string, unknown> =>
  documentoDeClon({
    plancha,
    bloques: BLOQUES_PAIRINGS,
    nombre: 'best font Pairings',
    nuevoId,
    notas: 'Copia de la portada de @growithalex con Mauricio. Cada bloque trae su propia tipografía: '
      + 'Inter para la grotesca y Playfair Display itálica para «font». El fondo es la plancha sin letras.',
  });
