// =============================================================================
// Transiciones: las claves de `element.params` y sus valores por defecto
// =============================================================================
// El contrato con los demás paquetes (docs/diseno-editor-video.md §4.1): la
// transición vive en el clip de la IZQUIERDA del corte, en `transicion.id` (vacío
// = sin transición) y `transicion.duracion` (segundos). Rige sólo si el clip que
// sigue en la MISMA pista empieza justo donde éste termina (./reglas.ts); si no,
// queda dormida y no se dibuja (D tampoco pinta el ⧓).
//
// Las claves `__tr.*` NO se guardan: las arma la escena en cada armado
// (./escena.ts) sobre una copia de los params que lee sólo el gancho visual
// (./gancho.ts), así el clip de la derecha también sabe que le entra una.

export const PARAM_TRANSICION_ID = "transicion.id";
export const PARAM_TRANSICION_DURACION = "transicion.duracion";

/** El prefijo de las dos: copiar/pegar atributos y Congelar no las llevan. */
export const PREFIJO_TRANSICION = "transicion.";

/** 0,5 s: el valor del pedido (en el catálogo de JianYing compite con 1 s). */
export const DURACION_POR_DEFECTO = 0.5;
/** Lo mínimo que deja el deslizador de «Duración». */
export const DURACION_MINIMA = 0.1;

// Lo que la escena le agrega a la copia de los params que ve el gancho.
export const TR_SALE_ID = "__tr.sale.id";
export const TR_SALE_DURACION = "__tr.sale.duracion";
export const TR_ENTRA_ID = "__tr.entra.id";
export const TR_ENTRA_DURACION = "__tr.entra.duracion";

/**
 * La clave del SEGUNDO decodificador de un medio (./escena.ts): la piden los
 * clips de un mismo medio pegados con una transición, que durante la ventana
 * piden cuadros a la vez. Quien suelta los decodificadores de un medio
 * (commands/media/remove-media-asset.ts) suelta también éste.
 */
export function claveDecodificadorTransicion(mediaId: string): string {
	return `${mediaId}#transicion`;
}
