// =============================================================================
// aviso-closing — la hoja «Closing» dice cuándo no hay con qué analizar las llamadas (IA12, 22/10/2026)
// =============================================================================
// El Closing Analyst analiza con el Claude del negocio (su clave) o, mientras dure, con el permiso de la plataforma
// (lib/closing.ts, `conQueAnalizaElClosing`). Sin ninguno de los dos las llamadas nuevas no se analizan, y la hoja se
// quedaba quieta sin decir por qué. Ahora lo dice arriba de la hoja (escritorio y teléfono), con el link a conectar.
//   · 'no'    → el aviso (`CONECTA_TU_CLAUDE_CLOSING`, el texto de IA12);
//   · 'no-se' → nada: la base no contestó, y «conecta tu Claude» a quien ya lo tiene sería mentira.
// Puro: lo leen las páginas (servidor), el lienzo (navegador) y tests/dashboard-aviso-closing.test.ts.
// =============================================================================

export type ConQueClosing = 'su-clave' | 'plataforma' | 'no' | 'no-se';

/**
 * La integración que conecta el aviso: Claude, con EL modal de /integraciones abierto en la hoja (`BotonIntegracion`,
 * app/_components/ConectarIntegracion.tsx). Una integración nunca se conecta saliendo de la tab (Martín, 14/10/2026; lo
 * barre tests/integracion-sin-salir.test.ts).
 */
export const SERVICIO_CLAUDE = 'anthropic';

/** ¿La hoja nació de la plantilla Closing? (`Hoja.plantilla`: el saneo se la pone también a las de antes de v5). */
export const esHojaClosing = (h: { plantilla?: string } | null | undefined): boolean => h?.plantilla === 'closing';

/** El texto del aviso, sólo con un «no» seguro. */
export const avisoDeClosing = (con: ConQueClosing | null, texto: string): string | null => (con === 'no' ? texto : null);

// ── Su Claude no puede (27/10/2026) ───────────────────────────────────────────────────────────────────────────────
// El Closing de Leila tenía 193 llamadas sin analizar: su clave de Claude se quedó sin crédito, el aviso le llegó a su
// grupo (lib/closing-ia-caida.ts) y la hoja seguía quieta sin decir por qué. Ella preguntó por qué Fathom no tenía los
// datos de Ana. Ahora la hoja lo dice arriba: el texto lo arma `avisoDeIaCaida` (lib/closing-ia-caida-reglas.ts) en el
// servidor, y acá sólo se decide CUÁL va (este archivo lo carga también el lienzo, en el navegador).

/**
 * El aviso de la hoja Closing: primero «no hay con qué analizar» (sin clave), y si analiza con SU clave y esa clave no
 * puede, la causa. Con 'plataforma' o 'no-se' el incidente no se muestra: no es de su clave, o no se sabe.
 */
export const avisoDeLaHojaClosing = (con: ConQueClosing | null, textoSinClave: string, textoIaCaida: string | null): string | null =>
  avisoDeClosing(con, textoSinClave) ?? (con === 'su-clave' ? textoIaCaida : null);

/** El botón al lado del aviso: sin clave, conectarla; con su clave caída, abrirla (pegar otra, o la del crédito de Max). */
export const accionDeLaHojaClosing = (con: ConQueClosing | null): string => (con === 'no' ? 'Conectar Claude' : 'Mi clave de Claude');
