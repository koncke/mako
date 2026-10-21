// =============================================================================
// PARA QUÉ PRODUCTO es una landing que se le pide a MaKo (Ops Center 1.15)
// =============================================================================
// Sin esto, generar_landing_con_ia arma el esquema con el perfil del negocio, o sea sobre el producto principal:
// «créame una landing para mi otro producto», con un solo producto en el catálogo, salía sobre el que ya hay.
//
// CUATRO RONDAS DE REGLAS (20-21/10/2026), cada una tirada por una revisión adversarial con agujeros nuevos: contar
// palabras; después comparar con los nombres y reconocer «otro» como destino; después negaciones, plurales y «todo el
// negocio»; después una lista de palabras de DUDA para elegir el producto nombrado «sin dudas». La cuarta probó 44
// frases naturales de excluir, comparar o vender cruzado («sin mencionar la Mentoría», «como la de la Mentoría pero
// para…», «que al final lleve a la Mentoría») y las 44 elegían el producto nombrado. Una lista de palabras de duda
// siempre deja afuera la frase siguiente. Es la regla de AGENTS.md («Leer texto libre con reglas falla en lo obvio: la
// red es que la persona CONFIRME lo que se entendió»): el TEXTO no elige nunca.
//   · Se elige sin preguntar SÓLO si el modelo manda en `producto` un nombre del catálogo (lo decide el modelo, que lee
//     la conversación, y la persona lo ve en la tarjeta), o «El negocio en general», o un producto nuevo con su nombre
//     en `producto_nuevo`.
//   · Con catálogo y sin eso, MaKo PREGUNTA SIEMPRE con opciones: los productos del catálogo, «Un producto nuevo» y «El
//     negocio en general». Preguntar de más cuesta un toque; elegir mal cuesta una landing mala.
//   · Sin catálogo (vacío o todo inactivo), un `producto` con nombre es uno nuevo: no hay cuál elegir mal, y tirarlo
//     dejaba la landing sobre la oferta del brief. Si el catálogo no se pudo leer, vale lo que no lo necesita.
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
const esNegocio = (s: string): boolean => ES_NEGOCIO.has(sinArticulo(s));
const esOpcionNuevo = (s: string): boolean => sinArticulo(s) === sinArticulo(OPCION_NUEVO);

/**
 * Lo que no dice CUÁL es un producto nuevo: referencias («mi otro», «el que te dije», «el principal», «ambos»),
 * rellenos («a definir», «TBD», «producto no especificado») y el nombre de una cosa sin nada más («un curso»). Es la
 * segunda red; la primera es la tarjeta que se confirma, que muestra lo que llegó.
 */
const VAGAS = new Set([
  'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra',
  'nuestros', 'nuestras', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'eso', 'esto', 'aquel', 'aquella',
  'de', 'del', 'al', 'en', 'para', 'por', 'con', 'que', 'sin', 'te', 'le', 'me', 'es', 'otro', 'otra', 'otros', 'otras', 'nuevo',
  'nueva', 'nuevos', 'nuevas', 'segundo', 'segunda', 'tercer', 'tercero', 'tercera', 'proximo', 'proxima', 'adicional', 'extra',
  'distinto', 'distinta', 'diferente', 'aparte', 'mas', 'producto', 'productos', 'servicio', 'servicios', 'oferta', 'ofertas',
  'curso', 'cursos', 'programa', 'programas', 'taller', 'talleres', 'mentoria', 'mentorias', 'emprendimiento', 'lanzamiento',
  'asesoria', 'asesorias', 'coaching', 'consultoria', 'consultorias', 'ebook', 'ebooks', 'libro', 'libros', 'membresia',
  'membresias', 'masterclass', 'clase', 'clases', 'sesion', 'sesiones', 'pack', 'packs', 'paquete', 'paquetes', 'evento', 'eventos',
  'product', 'other', 'no', 'se', 'ninguno', 'ninguna', 'nada', 'cual', 'aun', 'todavia', 'ya', 'definir', 'especificado',
  'especificar', 'pendiente', 'tbd', 'desconocido', 'nombre', 'uno', 'dije', 'dijo', 'antes', 'cosa', 'cliente', 'persona',
  'lanzar', 'voy', 'vamos', 'estoy', 'armando', 'vendo', 'tengo', 'menciono', 'mencione', 'nombro', 'catalogo', 'preguntar',
  'opcion', 'numero', 'primero', 'primera', 'ultimo', 'ultima', 'principal', 'ambos', 'ambas', 'dos', 'cualquiera', 'todo',
  'todos', 'todas', 'toda', 'entero', 'entera', 'pagina', 'negocio', 'agencia', 'general',
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
 * PARA QUÉ PRODUCTO es la landing, en el `preparar` de generar_landing_con_ia. `dicho` es lo que mandó el modelo:
 * `producto` (uno del catálogo o «El negocio en general») y `nuevo` (un producto que no está, con su nombre y de qué se
 * trata). `productos` es el catálogo ACTIVO, o null si no se pudo leer. El texto del pedido NO elige (ver la cabecera).
 */
export function productoDeLanding(
  dicho: { producto?: string | null; nuevo?: string | null },
  productos: readonly ObjetoChat[] | null,
): ProductoDeLanding {
  const producto = (dicho.producto ?? '').replace(/\s+/g, ' ').trim();
  const nuevo = (dicho.nuevo ?? '').replace(/\s+/g, ' ').trim();
  const delCatalogo = (s: string) => productos?.find((p) => sinArticulo(p.nombre) === sinArticulo(s));
  const enCatalogo = producto ? delCatalogo(producto) : undefined;
  if (enCatalogo) return { que: 'sigue', es: 'catalogo', producto: enCatalogo.nombre };
  if ((producto && esNegocio(producto)) || (nuevo && esNegocio(nuevo))) return { que: 'sigue', es: 'negocio', producto: null };
  if (nuevo) {
    const p = delCatalogo(nuevo);
    if (p) return { que: 'sigue', es: 'catalogo', producto: p.nombre };
    if (!esDescripcionVaga(nuevo)) return { que: 'sigue', es: 'nuevo', producto: nuevo.slice(0, 300) };
  }
  // Eligió «Un producto nuevo» y falta cuál: se pregunta el nombre, haya catálogo o no.
  if (esOpcionNuevo(producto)) {
    return { que: 'preguntar', opciones: [], mensaje: `Eligió «${OPCION_NUEVO}»: pregúntale su nombre y de qué se trata, y vuelve a proponer con eso en «producto_nuevo».` };
  }
  // Sin catálogo legible, como antes de esta pieza: lo que necesitaba el catálogo no se puede comprobar.
  if (!productos) return { que: 'sigue', es: 'ninguno', producto: null };
  // Sin productos activos, un nombre en `producto` es uno nuevo: no hay cuál elegir mal.
  if (!productos.length) {
    return producto && !esDescripcionVaga(producto) ? { que: 'sigue', es: 'nuevo', producto: producto.slice(0, 300) } : { que: 'sigue', es: 'ninguno', producto: null };
  }
  if (producto) return preguntar(productos, `«${corto(producto)}» no es un producto del catálogo.`);
  if (nuevo) return preguntar(productos, `«${corto(nuevo)}» no dice cuál es el producto nuevo.`);
  return preguntar(productos, '');
}
