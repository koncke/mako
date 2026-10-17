// =============================================================================
// plan-bandeja — a qué proyecto va una tarea que entra SIN IA, y la bandeja «Sin proyecto»
// =============================================================================
// 16/10/2026, «Fathom sin fricción». El pedido, textual (Martín): «optimiza la velocidad de
// importación de tareas de Fathom… Que hoy en día tardan un montón porque "cruzan" con las otras
// tareas... Quiero que elimines eso y toda la fricción. Quiero hacerlo "libre", que se creen sin
// prioridad, y luego de última un botón en los 3 puntos de arriba del plan para "re-priorizar"
// todo».
//
// «Cargar» un borrador (aplicarPropuestas, lib/plan-propuesta.ts) ya no llama a ninguna IA: ni el
// ruteo del Perro (asignarTareasAProyectos) ni la puntuación. Lo que decide el proyecto sale de
// señales que no cuestan nada, de la más dura a la más blanda, y lo que no tiene ninguna va a la
// BANDEJA, un proyecto que se llama «Sin proyecto» y que «Re-priorizar todo» reparte después.
//
// ⚠️ UN NOMBRE INVENTADO NO ABRE UN PROYECTO, tampoco sin IA. Lo que propone la extracción es a
// veces un proyecto que existe, a veces uno del catálogo y a veces un nombre que se le ocurrió al
// modelo («Webinar Diciembre Especial»). El tercero era el que el ruteo del Perro filtraba —sin él
// nacían «cincuenta proyectos de una tarea cada uno» (lib/todo-rutear.ts) y la compuerta del dueño
// (lib/plan-board.ts) lo frena desde agosto—. Sin el Perro, ese nombre NO crea nada: la tarea va a
// la bandeja y el nombre queda escrito en su historial, para que «Re-priorizar todo» (o la persona)
// lo lea.
//
// Puro y sin `server-only`: lo importan el server (los dos tableros), el navegador (el alta desde el
// modal de una reunión, BoardShell) y los tests.
// =============================================================================

/** El nombre EXACTO de la bandeja. Se crea con este nombre y se reconoce sin acentos ni mayúsculas. */
export const PROYECTO_SIN_PROYECTO = 'Sin proyecto';
export const EMOJI_SIN_PROYECTO = '📥';
/** El color de la bandeja: gris, porque no es un tema. */
export const COLOR_SIN_PROYECTO = '#9b9ba2';
/** Lo que dice la bandeja de sí misma (su `detalle`). */
export const QUE_SIN_PROYECTO = 'La bandeja: lo que entró sin un proyecto claro (de una reunión, un archivo o un mensaje). «Re-priorizar todo» lo reparte a su proyecto; mientras tanto, también puedes moverlo a mano.';

const norm = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** ¿Este proyecto es la bandeja? Un destino que NO se ofrece a un ruteo (una tarea no «va» a la
 *  bandeja: cae ahí cuando nada la reclama). */
export const esProyectoBandeja = (nombre: string | null | undefined): boolean =>
  norm(nombre ?? '') === norm(PROYECTO_SIN_PROYECTO);

/**
 * ¿Este proyecto ES un cliente? («Cliente: X», «Cuenta X»…). Vivía en lib/todo-rutear.ts, que es
 * `server-only`; acá lo puede usar también la regla pura de abajo. El porqué de la regex (y por qué
 * los dos puntos son opcionales) está en lib/todo-rutear.ts, que la re-exporta.
 */
export function esProyectoDeCliente(nombre: string): boolean {
  return /^(cliente|cuenta)\s*:?\s+/.test(norm(nombre));
}

/** Por dónde se decidió el proyecto. Va al historial de la tarjeta, que es donde se discute. */
export type ViaSinIA = 'cliente-en-texto' | 'proyecto-en-texto' | 'existente' | 'catalogo' | 'cliente-de-la-reunion' | 'bandeja';

export type DestinoSinIA = {
  /** El NOMBRE del proyecto destino (quien llama lo resuelve a su id, o lo crea). */
  nombre: string;
  via: ViaSinIA;
  /** El renglón del historial: por qué fue ahí. */
  razon: string;
};

/**
 * EL DESTINO DE UNA TAREA SIN IA. Puro: las preguntas a la base las hace quien llama.
 *
 *   1. `deTexto`: el texto de la tarea nombra a un cliente del CRM o a un proyecto que ya existe
 *      (lib/reunion-cliente.ts, `proyectoParaTarea`: una lectura de la base, sin modelo).
 *   2. Lo que PROPUSO quien la cargó (la extracción, el cliente de la reunión), y sólo si es:
 *      a. un proyecto que YA EXISTE en el tablero → ése;
 *      b. uno del CATÁLOGO → con su nombre canónico (lo crea quien llama, como siempre);
 *      c. el proyecto del CLIENTE de esa reunión (el borrador sabe con qué cliente fue) → ése.
 *   3. Si no, la BANDEJA, con el nombre propuesto escrito en la razón.
 */
export function destinoSinIA(p: {
  deTexto?: { nombre: string; via: 'cliente-en-texto' | 'proyecto-en-texto' } | null;
  propuesto?: string | null;
  existe: (nombre: string) => boolean;
  /** El nombre canónico si es del catálogo de ESE tablero; `undefined` si no. */
  delCatalogo: (nombre: string) => string | undefined;
  /** ¿Es el proyecto del cliente con quien fue la reunión? */
  esClienteDeLaReunion: (nombre: string) => boolean;
}): DestinoSinIA {
  if (p.deTexto?.nombre?.trim() && !esProyectoBandeja(p.deTexto.nombre)) {
    const n = p.deTexto.nombre.trim();
    return {
      nombre: n, via: p.deTexto.via,
      razon: p.deTexto.via === 'cliente-en-texto' ? `Va a «${n}»: la tarea nombra a ese cliente.` : `Va a «${n}»: la tarea nombra ese proyecto.`,
    };
  }
  const prop = (p.propuesto ?? '').trim();
  if (prop && !esProyectoBandeja(prop)) {
    if (p.existe(prop)) return { nombre: prop, via: 'existente', razon: `Va a «${prop}», el proyecto que propuso la reunión.` };
    const cat = p.delCatalogo(prop);
    if (cat) return { nombre: cat, via: 'catalogo', razon: `Va a «${cat}», del catálogo de proyectos.` };
    if (p.esClienteDeLaReunion(prop)) return { nombre: prop, via: 'cliente-de-la-reunion', razon: `Va a «${prop}»: la reunión fue con ese cliente.` };
  }
  return {
    nombre: PROYECTO_SIN_PROYECTO, via: 'bandeja',
    razon: prop
      ? `Quedó en «${PROYECTO_SIN_PROYECTO}»: la reunión proponía «${prop.slice(0, 60)}», que no existe. «Re-priorizar todo» le busca proyecto.`
      : `Quedó en «${PROYECTO_SIN_PROYECTO}»: nada decía a qué proyecto va. «Re-priorizar todo» le busca proyecto.`,
  };
}
