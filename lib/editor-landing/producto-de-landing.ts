// =============================================================================
// PARA QUÉ PRODUCTO es una landing que se le pide a MaKo (Ops Center 1.15)
// =============================================================================
// Sin esto, generar_landing_con_ia arma el esquema con el perfil del negocio, o sea sobre el producto principal:
// «créame una landing para mi otro producto», con un solo producto en el catálogo, salía sobre el que ya hay.
//
// TRES RONDAS DE REGLAS (20-21/10/2026), cada una tirada por una revisión adversarial con agujeros nuevos: contar
// palabras; después comparar con los nombres y reconocer «otro» como destino; después negaciones, plurales y «todo el
// negocio». La tercera probó unas 200 frases: «una landing que venda mi otro producto» no se veía, «ya tengo la de la
// Mentoría; créame una para mi otro producto» elegía la Mentoría, y «Curso de fotografía» caía en el «Curso» del
// catálogo. Es la regla de AGENTS.md («Leer texto libre con reglas falla en lo obvio: la red es que la persona CONFIRME
// lo que se entendió»): esto ya NO ADIVINA el producto.
//   · Se elige sin preguntar SÓLO si: `producto` es un nombre del catálogo; o el catálogo está vacío; o el pedido nombra
//     exactamente UNO y no dice nada de otro, nuevo, excluir ni comparar (`DUDA`).
//   · En todo lo demás, MaKo PREGUNTA con opciones: los productos del catálogo, «Un producto nuevo» y «El negocio en
//     general». Preguntar de más cuesta un toque; elegir mal cuesta una landing mala.
//   · Lo elegido va adelante en la tarjeta que se confirma (resumenGenerar): ésa es la red.
// El chat del editor (`productoDelPedido`, lib/mako-pedidos.ts) sigue como en producción hasta que use este camino.
// =============================================================================

import { MAX_PRODUCTOS_PREGUNTA, plano, type ObjetoChat } from '@/lib/mako-pedidos';

/** Las dos opciones que van con los productos del catálogo cuando MaKo pregunta para cuál es. */
export const OPCION_NUEVO = 'Un producto nuevo';
export const OPCION_NEGOCIO = 'El negocio en general';

/** Minúsculas, sin tildes ni signos: «¡La MENTORÍA 1 a 1!» → «la mentoria 1 a 1». */
const comparable = (s: string): string => plano((s ?? '').normalize('NFC')).replace(/[^a-z0-9]+/g, ' ').trim();
/** Sin el artículo de adelante: «la Mentoría» es «Mentoría». «Un curso» NO es «el Curso»: el indefinido se queda. */
const sinArticulo = (s: string): string => comparable(s).replace(/^(?:el|la|los|las|mi|mis)\s+/, '');
const corto = (s: string): string => (s.length > 80 ? `${s.slice(0, 79)}…` : s);

const ES_NEGOCIO = new Set([sinArticulo(OPCION_NEGOCIO), 'todo el negocio']);

/**
 * Lo que hace DUDAR de un producto nombrado: otro, nuevo, excluir o comparar, en CUALQUIER parte del pedido («ya tengo la
 * de la Mentoría; créame una para mi otro producto», «parecida a la de la Mentoría», «no la Mentoría»). Son prefijos a
 * propósito («otr»: otro, otra, otros; «nuev»: nuevo, nueva): con uno, se pregunta aunque el nombre esté.
 */
const DUDA = /\b(?:otr|nuev|distint|diferent|aparte|segund|proxim|tercer|adicional|ademas|parecid|similar|igual|mism|compar|excepto|salvo)|\b(?:no|ya tengo|en vez|en lugar)\b/;

/**
 * Los productos del catálogo que el pedido nombra, con su nombre entero como palabras. Uno que sólo aparece ADENTRO de
 * otro nombrado («Curso» en «el Curso avanzado») no cuenta; si también aparece suelto («el Curso y el Curso avanzado»),
 * cuentan los dos.
 */
export function nombradosEn(texto: string, productos: readonly ObjetoChat[]): ObjetoChat[] {
  const t = ` ${comparable(texto)} `;
  const en = productos.map((p) => {
    const n = comparable(p.nombre);
    const r: [number, number][] = [];
    if (n.length >= 3) for (let i = t.indexOf(` ${n} `); i >= 0; i = t.indexOf(` ${n} `, i + 1)) r.push([i + 1, i + 1 + n.length]);
    return r;
  });
  const adentroDeOtro = (k: number, [a, b]: [number, number]): boolean =>
    en.some((r, j) => j !== k && r.some(([c, d]) => c <= a && b <= d && d - c > b - a));
  return productos.filter((_, k) => en[k].some((o) => !adentroDeOtro(k, o)));
}

/**
 * Lo que no dice CUÁL es un producto nuevo: referencias («mi otro», «el que te dije»), rellenos («a definir», «TBD»,
 * «producto no especificado») y el nombre de una cosa sin nada más («un curso»). Es la segunda red; la primera es la
 * tarjeta que se confirma, que muestra lo que llegó.
 */
const VAGAS = new Set([
  'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra',
  'nuestros', 'nuestras', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'eso', 'esto', 'aquel', 'aquella',
  'de', 'del', 'al', 'en', 'para', 'por', 'con', 'que', 'sin', 'te', 'le', 'me', 'otro', 'otra', 'otros', 'otras', 'nuevo',
  'nueva', 'nuevos', 'nuevas', 'segundo', 'segunda', 'tercer', 'tercero', 'tercera', 'proximo', 'proxima', 'adicional', 'extra',
  'distinto', 'distinta', 'diferente', 'aparte', 'mas', 'producto', 'productos', 'servicio', 'servicios', 'oferta', 'ofertas',
  'curso', 'cursos', 'programa', 'programas', 'taller', 'talleres', 'mentoria', 'mentorias', 'emprendimiento', 'lanzamiento',
  'asesoria', 'asesorias', 'coaching', 'consultoria', 'consultorias', 'ebook', 'ebooks', 'libro', 'libros', 'membresia',
  'membresias', 'masterclass', 'clase', 'clases', 'sesion', 'sesiones', 'pack', 'packs', 'paquete', 'paquetes', 'evento', 'eventos',
  'product', 'other', 'no', 'se', 'ninguno', 'ninguna', 'nada', 'cual', 'aun', 'todavia', 'ya', 'definir', 'especificado',
  'especificar', 'pendiente', 'tbd', 'desconocido', 'nombre', 'uno', 'dije', 'dijo', 'antes', 'cosa', 'cliente', 'persona',
  'lanzar', 'voy', 'vamos', 'estoy', 'armando', 'vendo', 'tengo', 'menciono', 'mencione', 'nombro', 'catalogo', 'preguntar',
  'opcion', 'numero', 'primero', 'primera', 'ultimo', 'ultima',
]);
/** ¿Lo que mandó el modelo como producto nuevo no dice cuál es? Sin una palabra con contenido (los números no cuentan). */
export const esDescripcionVaga = (s: string): boolean =>
  !comparable(s).split(' ').some((w) => w.length >= 2 && !/^\d+$/.test(w) && !VAGAS.has(w));

/** Lo que decide `productoDeLanding`: seguir (con el producto, si hay) o preguntar antes, con las opciones. */
export type ProductoDeLanding =
  | { que: 'sigue'; es: 'catalogo' | 'nuevo'; producto: string }
  | { que: 'sigue'; es: 'negocio' | 'ninguno'; producto: null }
  | { que: 'preguntar'; mensaje: string; opciones: string[] };

function preguntar(productos: readonly ObjetoChat[], motivo: string): ProductoDeLanding {
  const opciones = [...productos.slice(0, MAX_PRODUCTOS_PREGUNTA).map((p) => p.nombre), OPCION_NUEVO, OPCION_NEGOCIO];
  const mas = productos.length > MAX_PRODUCTOS_PREGUNTA ? ` (el catálogo tiene ${productos.length}: puede nombrar otro de ellos)` : '';
  return {
    que: 'preguntar',
    opciones,
    mensaje: `${motivo ? `${motivo} ` : ''}Antes de crear la landing falta saber para qué producto es: no lo adivines, pregúntale a la persona con estas opciones: ${opciones.map((o) => `«${o}»`).join(', ')}${mas}. Con lo que elija, vuelve a proponer: uno del catálogo o «${OPCION_NEGOCIO}» van en «producto», con el nombre exacto; si es «${OPCION_NUEVO}», su nombre y de qué se trata van en «producto_nuevo» (si no lo dijo, pregúntaselo).`,
  };
}

/**
 * PARA QUÉ PRODUCTO es la landing, en el `preparar` de generar_landing_con_ia. `texto` es lo que pide la persona (idea,
 * instrucciones, título y audiencia); `dicho`, lo que mandó el modelo: `producto` (uno del catálogo o «El negocio en
 * general») y `nuevo` (un producto que no está, con su nombre y de qué se trata).
 */
export function productoDeLanding(
  texto: string,
  dicho: { producto?: string | null; nuevo?: string | null },
  productos: readonly ObjetoChat[],
): ProductoDeLanding {
  const producto = (dicho.producto ?? '').replace(/\s+/g, ' ').trim();
  const nuevo = (dicho.nuevo ?? '').replace(/\s+/g, ' ').trim();
  const delCatalogo = (s: string) => productos.find((p) => sinArticulo(p.nombre) === sinArticulo(s));
  if (producto) {
    const p = delCatalogo(producto);
    if (p) return { que: 'sigue', es: 'catalogo', producto: p.nombre };
    if (ES_NEGOCIO.has(sinArticulo(producto))) return { que: 'sigue', es: 'negocio', producto: null };
  }
  if (nuevo) {
    const p = delCatalogo(nuevo);
    if (p) return { que: 'sigue', es: 'catalogo', producto: p.nombre };
    if (!esDescripcionVaga(nuevo)) return { que: 'sigue', es: 'nuevo', producto: nuevo.slice(0, 300) };
  }
  if (!productos.length) return { que: 'sigue', es: 'ninguno', producto: null };
  if (sinArticulo(producto) === sinArticulo(OPCION_NUEVO)) {
    return { que: 'preguntar', opciones: [], mensaje: `Eligió «${OPCION_NUEVO}»: pregúntale su nombre y de qué se trata, y vuelve a proponer con eso en «producto_nuevo».` };
  }
  // Lo que mandó el modelo y no es del catálogo ni un producto nuevo con nombre: no se adivina desde el texto.
  if (producto) return preguntar(productos, `«${corto(producto)}» no es un producto del catálogo.`);
  if (nuevo) return preguntar(productos, `«${corto(nuevo)}» no dice cuál es el producto nuevo.`);
  const nombrados = nombradosEn(texto, productos);
  if (nombrados.length === 1 && !DUDA.test(plano(texto.normalize('NFC')))) return { que: 'sigue', es: 'catalogo', producto: nombrados[0].nombre };
  return preguntar(productos, nombrados.length > 1
    ? `El pedido nombra más de uno: ${nombrados.slice(0, MAX_PRODUCTOS_PREGUNTA).map((p) => `«${p.nombre}»`).join(', ')}.`
    : nombrados.length ? `El pedido nombra «${nombrados[0].nombre}», pero también dice algo que puede ser otro producto, excluirlo o compararlo.` : '');
}
