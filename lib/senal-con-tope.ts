// =============================================================================
// UNA SEÑAL QUE CORTA UN fetch A LOS `ms`, TAMBIÉN EN UN NAVEGADOR SIN AbortSignal.timeout (20/11/2026)
// =============================================================================
// El inventario de botones del onboarding: «Entrar a MaKo» usaba `AbortSignal.timeout(20_000)`, que un Safari de antes del 16 no tiene.
// Tiraba ANTES del fetch (el `.catch` del fetch no lo agarra) y el botón quedaba en «Entrando…» para siempre. Puro: lo prueba
// tests/inventario-onboarding-flujo.test.ts sacándole `timeout` a AbortSignal.
// =============================================================================

export function senalConTope(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  } catch {
    return undefined;
  }
}
