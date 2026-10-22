// =============================================================================
// La entrada de MaKo al abrir la app en el teléfono: la marca de «ya salió», el primer cuadro y el script de antes de pintar
// =============================================================================
// La entrada la dibuja ShellM (app/m/_ui/ShellM.tsx → EntradaApp.tsx), una vez por apertura. La intro del onboarding es
// otra pieza (app/onboarding/EntradaMako.tsx): cuando se VE, pone la misma clave para que /m no la repita (ChatArranque.tsx,
// el onFin de su EntradaMako). Va en su propio archivo, SIN IMPORTS: la leen el onboarding, ShellM, el layout de /m y el
// manifest sin arrastrar nada. tests/movil-entrada.test.ts.
//
// ⚠️ 22/10/2026, Martín desde su Android: «Al entrar en Mobile, me sigue apareciendo eso [el splash con el ícono], cuando te
// pedí que solo sea la criatura de MaKo... y entre medio, se ve el ops center por unos segundos y luego viene la animación».
// Medido (docs/hallazgos-mobile.md): la entrada se montaba en el CLIENTE (un `dynamic` sin SSR, después de hidratar), así
// que el HTML del server pintaba el Centro sin hidratar entre el splash y la criatura. Ahora va en el primer HTML.
//
// EL SPLASH DEL SISTEMA NO SE PUEDE SACAR: Chrome lo dibuja con el ícono MASKABLE del manifest (el mismo de la pantalla de
// inicio) sobre `background_color`. Por eso el PRIMER CUADRO de la entrada es ese splash, copiado: mismo fondo, la misma
// baldosa oscura con la chispa, en el mismo lugar y del mismo tamaño. Después la baldosa se va y la chispa se vuelve la
// criatura. Medidas sacadas de la captura del 22/10 09:45 (Samsung, 1080×2316, 2,625 px por punto: la barra de 3 botones
// mide 126 px = 48 dp) y de Chromium (webapk shell_apk: SplashUtilsForS → 240 dp; el maskable con 15 % de margen por lado).
// =============================================================================

/** La marca de sessionStorage: la entrada ya se vio en esta apertura de la app. */
export const CLAVE_ENTRADA_MOVIL = 'mako_entrada_m';

/** El `background_color` del manifest = el fondo del splash = el fondo del primer cuadro. Es el --bg del tema claro. */
export const FONDO_ARRANQUE = '#F4F6F9';

/** La forma con la que el teléfono recorta el ícono en el splash (la del lanzador: en Samsung, una superelipse). Diámetro en
 *  px de CSS (= dp): 615 px de pantalla / 2,625. En un Pixel es un círculo: ahí sólo cambian las esquinas del primer cuadro. */
export const FORMA_ARRANQUE = 235;
/** El exponente de esa superelipse (|x|^n + |y|^n = 1), ajustado a 103 puntos del borde de la captura. */
export const EXPONENTE_FORMA = 2.7;
/** El maskable entero, como queda dibujado en el splash (720 px de pantalla): la forma muestra el 86 % del centro. */
export const ARTE_ARRANQUE = 274;
/** La chispa del maskable mide 240 de sus 512 px (ajustada píxel a píxel contra public/icon-maskable-512.png). */
export const CHISPA_EN_ARTE = 240 / 512;
/** La criatura del primer cuadro: sus puntas (38 de las 40 unidades de Muneco) caen sobre las de la chispa del splash. */
export const CRIATURA_ARRANQUE = Math.round((ARTE_ARRANQUE * CHISPA_EN_ARTE * 40) / 38);

/** Atributo de <html> que pone el script de antes de pintar: la entrada ya salió en esta apertura y no se dibuja. */
export const ATTR_ENTRADA_VISTA = 'data-entrada-vista';
/** Variable CSS con lo que las barras del sistema le sacan a la pantalla (el splash se centra en la pantalla entera). */
export const VAR_BARRAS = '--ea-barras';
/** Más que esto no es una barra del sistema (pantalla partida, teclado): no se corrige. */
const TOPE_BARRAS = 120;

/**
 * El <script> que va en el HTML del layout de /m, ANTES de ShellM, y corre antes del primer pintado:
 *   · si la entrada ya salió en esta apertura (o no hay sessionStorage, que no deja saberlo), marca <html> y el CSS de la
 *     entrada la apaga: un documento nuevo de la misma apertura no la repite ni la deja ver un cuadro;
 *   · en la app instalada, guarda cuánto alto le comen las barras del sistema: el splash se centra en la pantalla ENTERA y
 *     la página empieza debajo de la barra de estado. El CSS corrige sólo cuando la página llega hasta abajo (edge-to-edge,
 *     `safe-area-inset-bottom` > 0), que es el caso en que esa diferencia es toda de arriba.
 * No lee estilos (nada de getComputedStyle): forzar el cálculo de estilos acá arrancaría la animación antes de que se vea.
 * ⚠️ UN SOLO template literal (tests/minificador-templates.test.ts): partido con `+`, el minificador se come el texto.
 */
export const ARRANQUE_ANTES_DE_PINTAR = `(function(){try{var d=document.documentElement,v=1;try{v=sessionStorage.getItem('${CLAVE_ENTRADA_MOVIL}')?1:0;}catch(e){v=1;}if(v)d.setAttribute('${ATTR_ENTRADA_VISTA}','');var a=window.matchMedia&&matchMedia('(display-mode: standalone)').matches;var h=Math.round(screen.height-innerHeight);if(a&&h>0&&h<${TOPE_BARRAS})d.style.setProperty('${VAR_BARRAS}',h+'px');}catch(e){}})()`;

/** El contorno de la superelipse de radio `r` centrada en 0,0, como `d` de un <path> (la forma del splash de Samsung). */
export function trazoForma(r: number, n = EXPONENTE_FORMA, pasos = 96): string {
  const p: string[] = [];
  for (let i = 0; i < pasos; i++) {
    const t = (i / pasos) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = Math.sign(c) * r * Math.abs(c) ** (2 / n);
    const y = Math.sign(s) * r * Math.abs(s) ** (2 / n);
    p.push(`${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${p.join('')}Z`;
}
