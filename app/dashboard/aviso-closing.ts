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

/** Adónde lleva el aviso: Integraciones, con «Tus cuentas de IA» abierta en Claude. */
export const LINK_CONECTAR_CLAUDE = '/integraciones?abrir=anthropic';

/** ¿La hoja nació de la plantilla Closing? (`Hoja.plantilla`: el saneo se la pone también a las de antes de v5). */
export const esHojaClosing = (h: { plantilla?: string } | null | undefined): boolean => h?.plantilla === 'closing';

/** El texto del aviso, sólo con un «no» seguro. */
export const avisoDeClosing = (con: ConQueClosing | null, texto: string): string | null => (con === 'no' ? texto : null);
