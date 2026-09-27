// =============================================================================
// plan-clientes — DE QUIÉN es un proyecto o una tarea
// =============================================================================
// El contrato compartido de «este trabajo es del cliente X» (mig 0172). Vive acá y
// no en cada pantalla por la misma razón que `lib/plan-recurrentes.ts`: lo leen el
// tablero del super-admin, el tablero de cada cliente, los dos pickers y Customer
// Success, y una regla escrita cuatro veces son cuatro reglas que van a divergir.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan componentes de navegador (el chip del
// detalle, los dos modales de asignación) y también el server. Si algún día necesita
// tocar la base, eso va en otro módulo — este sólo sabe de forma y de texto.
//
// ⚠️ `null` ACÁ SIGNIFICA «NO ES DE NADIE», NO «NO SE SABE». Es la diferencia que la
// pantalla tiene que respetar: la pregunta la contesta una persona eligiendo de una
// lista, y no elegir a nadie es una respuesta válida (trabajo interno del negocio).
// Por eso el rótulo de vacío dice «Interno» y no «Sin datos».

/** Un cliente elegible: los leads GANADOS del workspace. La forma que viaja a los pickers. */
export type ClienteRef = {
  leadId: number;
  nombre: string;
  empresa: string | null;
  /**
   * Su foto y su portada (mig 0173), configurables desde su ficha. Las dos son
   * OPCIONALES y su ausencia es el caso normal, no un error: sin foto van las
   * iniciales sobre el color derivado del nombre, y sin portada va ese mismo color.
   *
   * ⚠️ VIAJAN EN ESTE TIPO —y no sólo en el de Customer Success— porque el picker del
   * tablero muestra a la misma gente. Dos strings por cliente sobre una lista de
   * catorce nombres es nada, y tener dos formas de «un cliente» según quién lo mire
   * es cómo se termina con la foto puesta en una pantalla y ausente en la de al lado.
   */
  avatarUrl?: string | null;
  portada?: string | null;
  /** El ícono y los encuadres (mig 0174). Viajan por lo mismo que los dos de arriba:
   *  el picker del tablero dibuja a la misma gente que la grilla de Clientes, y con
   *  la mitad de los campos se vería distinta en cada pantalla. */
  icono?: string | null;
  avatarY?: number | null;
  portadaY?: number | null;
};

/** Lo que una tarjeta (tarea o proyecto) guarda de su cliente. */
export type ConCliente = { clienteLeadId?: number | null; clienteNombre?: string | null };

/** El rótulo del campo, en las dos pantallas y en los dos modales. */
export const ROTULO_CLIENTE = 'Cliente';
/**
 * Lo que dice el campo cuando no hay nadie. NO es un error ni un dato faltante.
 *
 * ⚠️ DECÍA «Interno» Y AHORA DICE «Ninguno» (27/09/2026, a pedido). «Interno» nombra
 * una CATEGORÍA de trabajo —del negocio, no de un cliente— y eso obliga a saber qué
 * cuenta como interno; «Ninguno» contesta la pregunta que el campo hace, que es «¿de
 * quién es?». Vive acá y no repetido: lo leen el campo del detalle, el modal y la
 * tabla, y tres copias son tres momentos distintos para quedarse viejas.
 */
export const SIN_CLIENTE = 'Ninguno';

/**
 * El cliente de una tarjeta, o `null`.
 *
 * ⚠️ MANDA EL ID, NO EL NOMBRE. Una fila puede tener el nombre escrito y el id vacío
 * (lo escribía la extracción de reuniones antes de la 0172, cuando `cliente_nombre`
 * significaba «el cliente de la reunión de la que salió»). Ese nombre suelto no ata a
 * nadie: sin id no se puede abrir su ficha, no se puede cruzar con la cartera y no se
 * puede saber si ese «Mauricio» es el lead 2472 o un homónimo. Se ignora.
 */
export function clienteDe(x: ConCliente): { leadId: number; nombre: string } | null {
  const id = Number(x.clienteLeadId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { leadId: id, nombre: (x.clienteNombre ?? '').trim() || `Cliente #${id}` };
}

/** ¿Este trabajo es de ESE cliente? Por id, nunca por nombre. */
export const esDelCliente = (x: ConCliente, leadId: number): boolean =>
  clienteDe(x)?.leadId === leadId;

/** Cómo se ve un cliente en una lista: «Mauricio Bustos · Elevate». */
export const etiquetaCliente = (c: ClienteRef): string =>
  c.empresa?.trim() ? `${c.nombre} · ${c.empresa.trim()}` : c.nombre;

/**
 * Sin acentos y en minúsculas, para buscar. Es la misma normalización que usa el
 * buscador de proyectos (`app/plan/board/AsignarProyecto.tsx`): escribir «bustos» tiene
 * que encontrar «Mauricio Bustós», y «elevate» tiene que encontrarlo por la empresa.
 */
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Los clientes que matchean lo tecleado, con los que EMPIEZAN con el texto primero.
 *
 * ⚠️ POR RELEVANCIA Y NO ALFABÉTICO, que es la corrección que ya se pidió dos veces
 * para el buscador del tablero: «busco idea y el proyecto de idea me sale último».
 * Quien empieza con lo que escribiste es lo que estabas buscando.
 */
export function buscarClientes(clientes: ClienteRef[], q: string): ClienteRef[] {
  const t = norm(q.trim());
  if (!t) return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const rank = (c: ClienteRef): number => {
    const n = norm(c.nombre), e = norm(c.empresa ?? '');
    if (n.startsWith(t)) return 0;
    if (e.startsWith(t)) return 1;
    if (n.includes(t)) return 2;
    if (e.includes(t)) return 3;
    return 9;
  };
  return clientes
    .map((c) => ({ c, r: rank(c) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.c.nombre.localeCompare(b.c.nombre, 'es'))
    .map((x) => x.c);
}
