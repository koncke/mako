// =============================================================================
// prueba-aviso — los DATOS de los dos avisos de la prueba del Pixel (puro, con test)
// =============================================================================
// «Nada por detrás», lote 3 (docs/inventario-nada-por-detras.md, 17/10/2026): `prueba-recibida` (al cerrar una prueba del
// Pixel en /integraciones) y `prueba-grabada` (el cron prueba-grabacion, cuando la grabación está lista) armaban su texto en
// el código, con el singular y el plural escritos ahí. Ahora son los eventos de la plataforma `prueba_recibida` y
// `prueba_grabada` con el texto literal en su fila de SuperAdmin; acá van sólo los hechos.

/** Un número con su unidad: «1 evento», «3 eventos». */
const conUnidad = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

export type DatosPruebaRecibida = { prueba_eventos: string; prueba_pagina?: string };

/** LA PRUEBA QUE SE CERRÓ: cuántos eventos llegaron y en qué página (si se supo: si no, su renglón no va). */
export function datosPruebaRecibida(p: { eventos: number; pagina: string | null }): DatosPruebaRecibida {
  const pagina = (p.pagina ?? '').trim();
  return { prueba_eventos: conUnidad(Math.max(0, Math.floor(p.eventos)), 'evento', 'eventos'), ...(pagina ? { prueba_pagina: pagina } : {}) };
}

export type DatosPruebaGrabada = { prueba_grabaciones: string };

/**
 * LAS GRABACIONES QUE YA SE PUEDEN VER: una por lead de prueba, con su página y el link a su ficha, como una lista en su
 * renglón («\n• *dominio* 👉 link»). Sirve para una y para varias: el texto no elige entre singular y plural.
 */
export function datosPruebaGrabada(links: ReadonlyArray<{ donde: string; url: string }>): DatosPruebaGrabada {
  return { prueba_grabaciones: links.map((l) => `\n• *${l.donde}* 👉 ${l.url}`).join('') };
}
