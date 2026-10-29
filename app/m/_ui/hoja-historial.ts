// =============================================================================
// El historial de las hojas del teléfono (SheetM): «atrás» cierra, nunca hay dos, y navegar al cerrar
// =============================================================================
// Salió de app/m/_ui/SheetM.tsx el 29/10/2026 (ticket #27) tal cual estaba, para que un test lo corra sin DOM
// (tests/m-hoja-navegar-al-cerrar.test.ts). Sin React: sólo `window.history` y `window.location`.
//
// ⚠️ NEXT 16 ESCUCHA EL `replaceState` Y EL `pushState` (node_modules/next/dist/client/components/app-router.js, el
// parche de `window.history`): cada uno con una URL lo despacha como ACTION_RESTORE, y un RESTORE DESCARTA la
// navegación que estaba en curso (app-router-instance.js, «Navigations (including back/forward) take priority over any
// pending actions»). Cerrar una hoja por código y hacer `router.push` en el mismo toque perdía la navegación entera: el
// `replaceState` que saca el `?sheet=` llega DESPUÉS del push (lo corre el efecto de SheetM, cuando React vuelve a dibujar)
// y gana. Joan, en el CRM del teléfono de su cliente Natalia: «toco ahí en "Venta Props" para cambiar, y no hace nada»
// (ticket #27). Por eso `navegarAlCerrar`: la navegación espera a que la hoja suelte su URL.
// =============================================================================

const PARAM = 'sheet';
// `clave` es la INSTANCIA, no el id: dos hojas con el mismo nombre siguen siendo dos.
export type Registro = { id: string; clave: object; cerrarYa: () => void; ocupado: () => boolean };
let activa: Registro | null = null;
let entradaPropia = false;
let ignorarPop = 0;
let escuchando = false;
/** La navegación que espera a que ESA hoja (su `clave`) suelte su `?sheet=` (`navegarAlCerrar`). */
let trasSoltar: { clave: object; navegar: () => void } | null = null;

function urlCon(id: string | null): string {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set(PARAM, id); else u.searchParams.delete(PARAM);
  return u.pathname + u.search + u.hash;
}
function hojaEnUrl(): string | null {
  try { return new URL(window.location.href).searchParams.get(PARAM); } catch { return null; }
}
function escucharAtras() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  window.addEventListener('popstate', () => {
    if (ignorarPop > 0) { ignorarPop -= 1; return; }
    if (!activa) { entradaPropia = false; return; }
    if (hojaEnUrl() === activa.id) return;
    entradaPropia = false;
    if (activa.ocupado()) {
      // Enviando: el «atrás» no la cierra. Se vuelve a poner la entrada.
      window.history.pushState(null, '', urlCon(activa.id));
      entradaPropia = true;
      return;
    }
    const a = activa;
    activa = null;
    a.cerrarYa();
  });
}
/** La navegación que esperaba a esta hoja, si había: se corre (o se tira) una sola vez. */
function laQueEsperaba(clave: object): (() => void) | null {
  if (trasSoltar?.clave !== clave) return null;
  const { navegar } = trasSoltar;
  trasSoltar = null;
  return navegar;
}
export function registrarApertura(r: Registro) {
  escucharAtras();
  // Lo que esperaba a otra apertura ya no corre: la misma hoja reabierta (su `clave` es la de la instancia) la dispararía tarde.
  trasSoltar = null;
  if (activa && activa.clave !== r.clave) {
    // Una hoja sobre otra REEMPLAZA: la de antes se cierra y la entrada del
    // historial pasa a ser de la nueva (un «atrás» no tiene que pasar por las dos).
    const previa = activa;
    activa = null;
    previa.cerrarYa();
    if (entradaPropia) { window.history.replaceState(null, '', urlCon(r.id)); activa = r; return; }
  }
  activa = r;
  if (!entradaPropia) {
    window.history.pushState(null, '', urlCon(r.id));
    entradaPropia = true;
  }
}
/** La persona la cerró (botón, velo, arrastre): es lo mismo que «atrás». */
export function soltarPorGesto(id: string, clave: object) {
  if (activa?.clave === clave) activa = null;
  // Una navegación que esperaba a esta hoja no sobrevive a un gesto: el `back()` de acá la desharía igual.
  laQueEsperaba(clave);
  if (entradaPropia && hojaEnUrl() === id) {
    entradaPropia = false;
    ignorarPop += 1;
    window.history.back();
  } else if (hojaEnUrl() === id) {
    window.history.replaceState(null, '', urlCon(null));
  }
}
/**
 * La cerró el código (el que la abrió puso `abierto=false`). Se saca el parámetro
 * con replaceState y NO con `back()`: un `back()` es asíncrono y deshace lo que venga.
 * El costo es una entrada de más en el historial con la misma URL, que es el menor de los dos.
 * ⚠️ El replaceState TAMBIÉN descarta una navegación en curso (Next lo despacha como ACTION_RESTORE, ver arriba):
 * quien cierre y navegue en el mismo toque lo pide con `navegarAlCerrar`, que corre DESPUÉS de esto.
 */
export function soltarPorCodigo(id: string, clave: object) {
  if (activa?.clave === clave) activa = null;
  if (hojaEnUrl() === id) window.history.replaceState(null, '', urlCon(null));
  entradaPropia = false;
  laQueEsperaba(clave)?.();
}
/**
 * La pantalla se fue con la hoja abierta (navegó a otro lado, o dejó de dibujar la hoja): sólo se suelta el registro.
 * Tocar el historial acá podría deshacer la navegación en curso. Si una navegación esperaba a esta hoja, sale ahora:
 * sin `replaceState` no hay nada que la descarte.
 */
export function soltarAlDesmontar(clave: object) {
  if (activa?.clave !== clave) return;
  activa = null;
  entradaPropia = false;
  laQueEsperaba(clave)?.();
}

/**
 * NAVEGAR DESDE UNA HOJA QUE SE CIERRA EN EL MISMO TOQUE (29/10/2026, ticket #27). En vez de
 * `setAbierta(false); router.push(url)`, que perdía la navegación (ver arriba):
 *
 *     setAbierta(false); navegarAlCerrar(() => router.push(url));
 *
 * La navegación espera a que la hoja abierta saque su `?sheet=` (`soltarPorCodigo`, cuando React la vuelva a dibujar
 * cerrada): primero el RESTORE de ese replaceState y DESPUÉS el NAVIGATE, que es el que gana. Sin una hoja abierta
 * (nadie que toque el historial), navega ya. El orden de las dos líneas da igual.
 */
export function navegarAlCerrar(navegar: () => void): void {
  if (!activa) { navegar(); return; }
  trasSoltar = { clave: activa.clave, navegar };
}
