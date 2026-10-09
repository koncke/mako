// =============================================================================
// crear-ia-lugar — dónde flotan la caja y la barra de «Crear con IA» sobre el lienzo de /chatbot
// =============================================================================
// Revisión de la segunda tanda (09/10/2026). Las dos piezas de app/chatbot/CrearConIA.tsx flotaban
// con su propia cuenta y las dos tapaban algo:
//
//   · la CAJA de una automatización vacía era `inset: 0` y centrada en el ancho TOTAL: pasaba por
//     encima de la lista (ventanas angostas), de «Probar», y —lo caro— de la tarjeta CRON entera,
//     que `encuadreInicial` centra en ese mismo lugar. No se podía tocar para elegir el disparador;
//   · la BARRA «Pídele un cambio» medía 560 de envoltorio con 460 de barra pegada a la izquierda (los
//     100 px transparentes se comían los clics) y quedaba encima de la franja del editor apaisado.
//
// Ahora las dos van en la franja de ABAJO, entre la lista y lo que tapa la derecha en esa franja
// (`insets.derAbajo`: con «Probar» apilado arriba a la derecha es 0, porque «Probar» termina antes de
// la franja del editor —`muelles` lo garantiza—; lado a lado es todo su ancho), encima de la fila del
// zoom y de «Publicar». Y mientras está la caja, el lienzo encuadra el CRON ARRIBA de ella
// (`RESERVA_ABAJO_CREAR`, la prop `reservaAbajo` del Lienzo). Mientras hay una tarjeta abierta las dos
// se esconden (sin desmontarse: un pedido en vuelo dura hasta un minuto) — eso lo decide quien monta.
//
// ⚠️ PURO Y SIN `server-only`: los números los leen el componente y el test, que mide contra
// `encuadreInicial` y `muelles` de verdad que la caja no tape el CRON ni la lista.
// =============================================================================

import { PANEL_MARGEN, ZOOM_ALTO, type Muelles } from './lienzo-grafo';

/** El ancho de la caja de crear (`S.caja` de CrearConIA: `min(520px, 100%)`). */
export const CAJA_IA_ANCHO = 520;
/** El ancho de la barra de editar (`S.barraWrap` de CrearConIA: `min(460px, 100%)`). */
export const BARRA_IA_ANCHO = 460;
/**
 * El alto que se le reserva a la caja de crear. Medido sobre el componente: ~280 con dos ejemplos;
 * con un error y los ejemplos en tres renglones, ~370 — el margen del grafo (28 px abajo de la
 * tarjeta) y el hueco de abajo absorben la diferencia.
 */
export const CAJA_IA_ALTO = 320;
/** Desde el borde de abajo: la fila del zoom (y «Publicar») con su margen, y un hueco más. */
export const IA_ABAJO = PANEL_MARGEN + ZOOM_ALTO + PANEL_MARGEN;
/** Lo que el encuadre deja libre abajo mientras se ve la caja: ella, lo de abajo y un hueco. */
export const RESERVA_ABAJO_CREAR = CAJA_IA_ALTO + IA_ABAJO + PANEL_MARGEN;

export type FranjaIA = { left: number; right: number; bottom: number };

/**
 * La franja de abajo donde se centran la caja y la barra, en coordenadas del contenedor del lienzo.
 * Sin `muelles` (un montaje que no los calcula), los insets de siempre.
 */
export function franjaIA(m: Pick<Muelles, 'insets'> | null | undefined, sin: { izq?: number; der?: number } = {}): FranjaIA {
  const izq = m ? m.insets.izq : (sin.izq ?? 0);
  const der = m ? m.insets.derAbajo : (sin.der ?? 0);
  return { left: izq + PANEL_MARGEN, right: der + PANEL_MARGEN, bottom: IA_ABAJO };
}
