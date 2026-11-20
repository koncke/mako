// =============================================================================
// EL REINICIO DEL ONBOARDING, EN EL NAVEGADOR (20/11/2026; módulo CHICO y sin imports: lo usa el layout raíz vía lib/seguir-en-pc.ts)
// =============================================================================
// «Reiniciar onboarding» (lib/reiniciar-onboarding.ts) borra lo visto en la base, pero el navegador de la persona también lo guarda, y
// `Recorrido.tsx` y `useVisto.ts` le MANDAN al server lo visto en el navegador que el server no tiene: sin limpiar el navegador, el
// primer cuadro deshacía el reinicio. El reinicio deja una marca en `usuarios.perfil` (`CLAVE_REINICIO`); el layout, a quien la tiene
// sin limpiar en ESE navegador, le pone `scriptDelReinicio` en el HTML, que corre antes que React y limpia una sola vez.
// =============================================================================

/** La marca que deja el reinicio en `usuarios.perfil` del dueño: cuándo. */
export const CLAVE_REINICIO = 'onboardingReiniciado';

/** La marca del reinicio en un perfil, o null. */
export function reinicioDelPerfil(perfil: unknown): string | null {
  const v = perfil && typeof perfil === 'object' && !Array.isArray(perfil) ? (perfil as Record<string, unknown>)[CLAVE_REINICIO] : null;
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
}

/**
 * Lo que el navegador guarda del onboarding (localStorage y sessionStorage). La llegada, la entrada de cada coach y lo ya escrito del
 * arranque se miran SÓLO ahí; lo visto de cada tutorial, ahí y en la base.
 */
export const CLAVES_DEL_NAVEGADOR: readonly RegExp[] = [
  /^mako\.recorrido\.(?:.+\.)?tutorial-/, // lo visto de cada tutorial (con y sin la persona en la clave)
  /^mk-llegada-mostrada:/, // la llegada al reto ya mostrada
  /^mk-onb-salidos:/, // los mensajes del arranque ya escritos
  /^mk-entrada:/, /^mk-dale-play:/, // la entrada de cada chat y su «dale play»
  /^mako\.reto\./, // lo visto de cada día del reto
  /^mako\.v2\.desde-cero/, // el «desde cero» de la revisión (sessionStorage, app/_ui/tutorial/desde-cero.ts)
];

/** Lo mínimo de un almacén del navegador (localStorage, sessionStorage, o uno de mentira en el test). */
export type AlmacenDelNavegador = { readonly length: number; key(i: number): string | null; removeItem(k: string): void };

/**
 * Borra de los almacenes lo de `CLAVES_DEL_NAVEGADOR` y devuelve cuántas claves sacó. Lo usa «Sí, reiniciar» en el navegador de QUIEN
 * MIRA (20/11/2026, el Cerebro: después de reiniciar desde la vista de administrador, ese navegador conservaba el «dale play», lo ya
 * escrito del arranque y la llegada de ese negocio, y el onboarding arrancaba con «¿cómo te llamas?» antes del video). Nunca tira.
 */
export function limpiarClavesDelOnboarding(almacenes: readonly AlmacenDelNavegador[]): number {
  let n = 0;
  for (const st of almacenes) {
    try {
      const borrar: string[] = [];
      for (let i = 0; i < st.length; i++) { const c = st.key(i); if (c && CLAVES_DEL_NAVEGADOR.some((p) => p.test(c))) borrar.push(c); }
      for (const c of borrar) { st.removeItem(c); n++; }
    } catch { /* un almacén bloqueado no frena el reinicio */ }
  }
  return n;
}

/** En el navegador: el último reinicio ya limpiado (así limpia una sola vez). */
export const CLAVE_LIMPIADO = 'mk-onboarding-reiniciado';

/** El <script> del layout: borra lo de `CLAVES_DEL_NAVEGADOR` una vez por reinicio, antes de que React sincronice nada. Nunca tira. */
export function scriptDelReinicio(at: string): string {
  const patrones = CLAVES_DEL_NAVEGADOR.map((r) => r.source);
  return `(function(){try{var at=${JSON.stringify(at)},k=${JSON.stringify(CLAVE_LIMPIADO)};if(localStorage.getItem(k)===at)return;`
    + `var ps=${JSON.stringify(patrones)}.map(function(s){return new RegExp(s)});`
    + `[localStorage,sessionStorage].forEach(function(st){var b=[];for(var i=0;i<st.length;i++){var c=st.key(i);if(c&&ps.some(function(p){return p.test(c)}))b.push(c)}b.forEach(function(c){st.removeItem(c)})});`
    + `localStorage.setItem(k,at)}catch(e){}})();`;
}
