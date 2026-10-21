// =============================================================================
// La entrada de MaKo en el teléfono, ANTES de pintar (20/10/2026)
// =============================================================================
// La revisión del Cerebro: EntradaMobile arrancaba visible (`useState(true)`), así que el HTML del server de TODA página de
// /m traía la capa a pantalla completa, y la marca de «ya la vi» recién se leía al hidratar. En cada recarga ya vista la
// capa tapaba la pantalla de 1 a 3 s en un Android lento y desaparecía de golpe; sin JS, tapaba para siempre.
// Ahora este script corre antes del primer pintado (como TEMA_ANTES_DE_PINTAR, ./tema.ts): con la sesión ya marcada pone
// `data-entrada-vista` en <html> y el CSS (app/m/m.css) la oculta sin esperar a React. Sin JS, el CSS la esconde a los 6 s.
// Sin imports a propósito: lo importa el layout del server y lo lee un test en node.
// =============================================================================

/** La marca de sessionStorage: la entrada ya se vio en esta sesión del navegador (también la pone el final del onboarding). */
export const CLAVE_ENTRADA_MOVIL = 'mako.entrada-movil';

/** El atributo de <html> con el que el CSS oculta la entrada desde el primer pintado. */
export const ATTR_ENTRADA_VISTA = 'data-entrada-vista';

export const ENTRADA_ANTES_DE_PINTAR =
  `(function(){try{if(sessionStorage.getItem('${CLAVE_ENTRADA_MOVIL}')==='1'){document.documentElement.setAttribute('${ATTR_ENTRADA_VISTA}','')}}catch(e){}})()`;
