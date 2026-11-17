// =============================================================================
// Las columnas de los planes, LAS MISMAS de /planes, para la portada (15/11/2026)
// =============================================================================
// Martín, 15/11/2026: «en la landing principal se tiene que repetir exactamente lo mismo que en precios. Me refiero a las columnas
// de los tres planes… tiene que ser exactamente lo mismo».
//
// Lo que había: la portada dibujaba el mismo `TarjetasPlanes` que /planes, pero con OTRAS props y otra hoja. Sin la barra de MaKo
// Tokens (la que va debajo del selector mensual / anual), sin el «Tu primer mes» del 50 % (`promoVigente`), sin el origen de la
// campaña ni el `?ref=` del partner en los botones (`sufijo=""`), sin la hoja de la barra (`CSS_TOKENS`), y en otra letra y otro
// ancho (Figtree a 1.120 px contra Urbanist a 1.060). Las tarjetas eran iguales; lo de alrededor, no.
//
// ⚠️ LAS PROPS SON LAS DE /planes (app/planes/Vitrina.tsx: `<TarjetasPlanes planes sufijo promoVigente barra={<CalculadoraTokens
//    planes />} />`). Vitrina las arma ella misma y esta pieza las repite: tests/sitio-recursos-y-pie.test.ts dibuja las dos
//    páginas con los mismos planes y pide que el bloque de las columnas salga IGUAL, letra por letra. El día que /planes cambie
//    una prop, ese test se pone rojo hasta que la portada la tenga. (Lo ideal es que Vitrina use esta misma pieza y no la repita:
//    no se hizo el 15/11 porque app/planes lo estaba editando otro frente.)
// La letra y el ancho de /planes, en ./estilos.ts (.s-precios-bloques).
// =============================================================================

import { CSS_TARJETAS, TarjetasPlanes, type PlanEnTarjeta } from '@/app/planes/Tarjetas';
import { CSS_TOKENS, CalculadoraTokens } from '@/app/planes/CalculadoraTokens';

/** La hoja de las columnas y de su barra, la misma que inyecta /planes para ellas. */
export const CSS_COLUMNAS_PLANES = CSS_TARJETAS + CSS_TOKENS;

export function ColumnasPlanes({ planes, sufijo, promoVigente = false }: {
  planes: readonly PlanEnTarjeta[];
  /** Lo que la URL trae y pasa tal cual al plan elegido (el origen de la campaña y el código de partner), como en /planes. */
  sufijo: string;
  /** El reloj del 50 % del primer mes sigue vivo en este navegador: las columnas lo dicen, como en /planes. */
  promoVigente?: boolean;
}) {
  // LA BARRA SOLA, sin «Agrega créditos extra» ni la línea de abajo (Martín, 17/11/2026: «en la landing principal elimina el texto…
  // lo que quede simplemente la barra»). Es lo ÚNICO que difiere de /planes (tests/sitio-recursos-y-pie.test.ts, el 7).
  return <TarjetasPlanes planes={planes} sufijo={sufijo} promoVigente={promoVigente} barra={<CalculadoraTokens planes={planes} />} barraSola />;
}
