// =============================================================================
// objetivos — el catálogo de objetivos de un día de stories (una cosa, un lugar)
// =============================================================================
// SIN 'server-only' a propósito: lo consumen las server actions (para componer
// el pedido) y la UI (para el selector). Los textos de metodología que respaldan
// cada objetivo viven en lib/ig-formatos.ts (METODOLOGIA_STORY); acá solo está
// la traducción de «qué eligió el usuario» a «qué se le pide al writer».

export type ObjetivoStories = 'conexion' | 'venta' | 'interaccion';

export const OBJETIVOS_STORIES: Array<{ value: ObjetivoStories; label: string; hint: string }> = [
  { value: 'conexion', label: 'Conexión', hint: 'Calentar a la audiencia: una idea del día, sin vender' },
  { value: 'venta', label: 'Venta', hint: 'El día vende y cierra pidiendo la palabra clave por DM' },
  { value: 'interaccion', label: 'Interacción', hint: 'Provocar respuestas y mover la conversación al DM' },
];

/** ¿El objetivo exige que el último frame empuje a responder por DM? */
export const empujaADm = (o: ObjetivoStories): boolean => o !== 'conexion';

/**
 * Cómo viaja el objetivo DENTRO del pedido que recibe generarPieza. Va redactado
 * como parte de lo que el usuario quiere (el pedido entero entra al prompt como
 * contenido no confiable, así que no es el lugar de instrucciones de sistema:
 * es la descripción de la pieza pedida). La validación determinista del empuje
 * a DM vive en generarSecuenciaAction — las dos capas de siempre.
 */
export const OBJETIVO_EN_PEDIDO: Record<ObjetivoStories, string> = {
  conexion:
    'CONEXIÓN — calentar a la audiencia con una sola idea del día (gancho → contexto → moraleja). Sin vender: el CTA final es opcional y suave.',
  venta:
    'VENTA — el día calienta y VENDE (en stories la proporción se invierte: ~80% venta). El último frame pide responder la story con una palabra clave única en MAYÚSCULAS y una promesa concreta, para que la conversación siga por DM.',
  interaccion:
    'INTERACCIÓN — provocar RESPUESTAS (preguntas, retos, tapar algo y revelarlo al final). El último frame pide responder la story con una palabra clave única en MAYÚSCULAS para mover la conversación al DM.',
};
