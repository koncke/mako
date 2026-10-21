// =============================================================================
// La marca de «la entrada de MaKo ya salió» en el teléfono (20/10 → 21/10/2026)
// =============================================================================
// La entrada al abrir la app la muestra ShellM (app/m/_ui/ShellM.tsx, pedidos del Ops Center del 21/10), una vez por
// apertura. El final del onboarding ya la mostró: pone esta misma clave para que /m no la repita (ChatArranque.tsx →
// `entrar`). Va en su propio archivo, sin imports: la leen el onboarding y ShellM sin arrastrar nada. Hasta el 21/10
// convivía con otra entrada de esta rama (EntradaMobile, en el layout): eran dos para el mismo pedido y se sacó.
// tests/movil-entrada.test.ts.
// =============================================================================

/** La marca de sessionStorage: la entrada ya se vio en esta apertura de la app. */
export const CLAVE_ENTRADA_MOVIL = 'mako_entrada_m';
