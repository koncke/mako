// =============================================================================
// borrado-workspace — QUÉ cliente se puede eliminar, y por qué no los demás
// =============================================================================
// Borrar un cliente es la operación más destructiva de la app: se lleva 89 tablas,
// sus archivos y sus personas, y no tiene vuelta atrás. La condición vive acá, sola
// y sin `server-only`, por el mismo motivo que `exigirClienteDePrueba`: lo que
// protege algo irreversible tiene que poder testearse.
//
// ⚠️ ESCRITO EN POSITIVO, o casi: lo que devuelve es el MOTIVO por el que NO se
// puede, y la lista de motivos es cerrada y explícita. La regla de la casa dice que
// un guard sobre algo destructivo se escribe como «solo ESTE», porque la lista de lo
// que hay que proteger crece sola con cada cliente nuevo. Acá no se puede nombrar a
// un único borrable —cualquier cliente lo es— así que la protección la da la otra
// mitad: el NOMBRE ESCRITO A MANO, que no se puede acertar por accidente.
//
// ⚠️ Y EL NOMBRE SE COMPARA EN EL SERVIDOR, no en el botón. Un confirm que sólo vive
// en la pantalla lo saltea cualquiera que llame a la ruta, que es exactamente el modo
// de falla que un `curl` de más encuentra.

/** Lo que hace falta saber del workspace para decidir. Sale de la BASE, no de la UI. */
export type WsABorrar = {
  id: number;
  nombre: string;
  capa: string;
};

export type ContextoBorrado = {
  /** El workspace desde el que se está llamando. Nadie se borra a sí mismo. */
  wsDelQueLlama: number | null;
  /** Los clientes que este workspace tiene en su cartera de AGENCIA, si tiene. */
  clientesEnCartera: number[];
  /** Lo que la persona tipeó para confirmar. */
  nombreEscrito: string;
  /** El id del workspace de la PLATAFORMA (`wsSuperAdmin()`), leído en el server. */
  wsPlataforma: number | null;
};

/**
 * Normaliza para comparar nombres: espacios colapsados, sin acentos compuestos y en
 * minúsculas.
 *
 * ⚠️ EL NFC NO ES DECORACIÓN. «Código» tipeado en macOS puede llegar en NFD (la `o` y
 * la tilde como dos puntos de código) y comparado con el NFC de la base da distinto,
 * con los dos textos viéndose IDÉNTICOS en pantalla. Sin esto, el dueño tipea bien el
 * nombre y el botón sigue apagado sin poder explicarle por qué.
 */
const norm = (s: string): string =>
  (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * `null` = se puede borrar. Un string = el motivo, ya escrito para mostrarse.
 *
 * El orden importa: primero lo que NO se arregla tipeando (es la plataforma, es el
 * dueño, sos vos, tiene cartera) y recién al final el nombre. Al revés, a alguien que
 * intenta borrar la plataforma le diría «el nombre no coincide», que es una pista
 * falsa: aunque lo escriba bien, no va a poder.
 */
export function motivoNoEliminable(w: WsABorrar, ctx: ContextoBorrado): string | null {
  // 1. LA PLATAFORMA. `wsSuperAdmin()` toma el menor id con capa `superadmin`: sin
  //    ella no hay remitente de MaKo, ni credenciales, ni panel. Se mira la CAPA de la
  //    fila además del id, para que siga protegida aunque el id llegue mal.
  if (w.capa === 'superadmin' || (ctx.wsPlataforma != null && w.id === ctx.wsPlataforma)) {
    return 'Ese es el espacio de la plataforma: si se borra, MaKo se queda sin panel, sin credenciales y sin remitente.';
  }

  // 2. EL WORKSPACE 1. No es «el dueño» —hace rato que es un cliente más— pero 29
  //    tablas lo tienen como `default 1` en su columna `workspace_id` (mig 0054): una
  //    fila que nazca sin workspace aterriza ahí, así que borrarlo deja el default
  //    apuntando a una fila que no existe y el próximo insert falla por la FK.
  if (w.id === 1) {
    return 'El workspace 1 es el default de 29 tablas: borrarlo deja la base con un valor por defecto que apunta a la nada.';
  }

  // 3. EL PROPIO. Borrarse a sí mismo deja la sesión en curso apuntando a un
  //    workspace que ya no está, y lo que se ve después no es un error: es la app
  //    contestando 403 en todo sin decir por qué.
  if (ctx.wsDelQueLlama != null && w.id === ctx.wsDelQueLlama) {
    return 'No puedes borrar el workspace desde el que estás entrando.';
  }

  // 4. UNA AGENCIA CON CARTERA. Sus filas de `agencia_clientes` cascadean, así que el
  //    borrado se llevaría en silencio el registro de que esa agencia atendía a esos
  //    clientes — y los clientes quedarían vivos, sin agencia y sin nadie que los
  //    hubiera dado de baja. Primero se revoca, que es una decisión que alguien toma.
  if (ctx.clientesEnCartera.length > 0) {
    const n = ctx.clientesEnCartera.length;
    return `Es una agencia con ${n} ${n === 1 ? 'cliente' : 'clientes'} en su cartera. Revócalos primero: borrarla ahora los dejaría sin agencia y sin registro de quién los atendía.`;
  }

  // 5. Y RECIÉN ACÁ EL NOMBRE.
  if (!norm(ctx.nombreEscrito)) return 'Escribe el nombre del cliente para confirmar.';
  if (norm(ctx.nombreEscrito) !== norm(w.nombre)) {
    return `El nombre no coincide. Escribe exactamente: ${w.nombre}`;
  }

  return null;
}
