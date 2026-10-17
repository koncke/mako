// =============================================================================
// tracking-aviso — los DATOS de los tres avisos del Pixel y de la landing (puro, con test)
// =============================================================================
// «Nada por detrás», lote 3 (docs/inventario-nada-por-detras.md, 17/10/2026): `tracking-apagado`, `tracking-desactualizado`
// y `landing-cambio` los armaba el cron tracking-vigilante con su texto en el código, eligiendo la frase según el caso
// (una página o varias, graba o no, se puede medir o no). El primero, además, lo REDACTABA una IA (`contexto`). Ahora son
// eventos de la plataforma (`tracking_apagado`, `pixel_viejo`, `landing_cambio`) con el texto LITERAL en su fila de
// SuperAdmin, y lo que antes decidía el código lo pregunta una CONDITION sobre estos datos.
//
// Sólo HECHOS, por nombre (lib/variables-aviso.ts los describe). ⚠️ Un dato opcional FALTA, no viene vacío: uno vacío es un
// valor para `textoConDatos` y su renglón quedaba con la etiqueta sola; uno que falta se lleva el renglón entero.

import { fechaLegible } from './linea-vigilancia';

/** Un número con su unidad: «1 día», «3 días». */
const conUnidad = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

/** Una lista en su renglón, como las de la grabación y el recordatorio: «\n· a\n· b». */
const lista = (items: readonly string[]): string => items.map((x) => `\n· ${x}`).join('');

export type DatosTrackingApagado = { tracking_dias: string; tracking_link: string; tracking_ultima?: string };

/**
 * LA LANDING QUE DEJÓ DE MANDAR DATOS: cuántos días lleva sin visitas, la fecha de la última (en la zona del negocio) y el
 * link a la tarjeta de la landing en /integraciones. El cron avisa desde las 48 h, así que son 2 días o más.
 */
export function datosTrackingApagado(p: { horas: number; ultima: string | null; tz: string; link: string }): DatosTrackingApagado {
  const dias = Math.max(1, Math.floor(p.horas / 24));
  const fecha = fechaLegible(p.ultima, p.tz);
  return { tracking_dias: conUnidad(dias, 'día', 'días'), ...(fecha ? { tracking_ultima: fecha } : {}), tracking_link: p.link };
}

/** Lo que pregunta la CONDITION del Pixel viejo: si por ser viejo deja de grabar las visitas. */
export const PIXEL_GRABA = ['no graba', 'graba'] as const;

export type DatosPixelViejo = { pixel_graba: (typeof PIXEL_GRABA)[number]; pixel_novedades: string; pixel_link: string; pixel_paginas?: string };

/**
 * EL PIXEL QUE QUEDÓ VIEJO: qué páginas lo tienen (las que se pudieron nombrar; ninguna = el renglón no va), si por eso no
 * graban las visitas (lo pregunta la CONDITION: cada caso con su texto), lo que se están perdiendo (`novedadesDesde`) y el
 * link donde se copia la línea del Pixel.
 */
export function datosPixelViejo(p: { paginas: readonly string[]; noGraba: boolean; novedades: string; link: string }): DatosPixelViejo {
  return {
    pixel_graba: p.noGraba ? 'no graba' : 'graba',
    ...(p.paginas.length ? { pixel_paginas: lista(p.paginas) } : {}),
    pixel_novedades: p.novedades,
    pixel_link: p.link,
  };
}

/** Lo que pregunta la CONDITION del cambio de la landing: si lo que se agregó se puede medir. */
export const LANDING_MEDIBLE = ['sí', 'no'] as const;

export type DatosLandingCambio = {
  landing_pagina: string; landing_link: string;
  landing_agregaste?: string; landing_medible?: (typeof LANDING_MEDIBLE)[number]; landing_sacaste?: string;
};

/**
 * LA LANDING QUE CAMBIÓ: la página, lo que se le agregó (ya enumerado: «un video y un formulario») y si se puede medir,
 * lo que se le sacó, y el link a la landing en /integraciones. Sin nada agregado, `landing_agregaste` y `landing_medible`
 * faltan (su renglón no va); sin nada sacado, `landing_sacaste`. «Se puede medir» es «no» sólo si NINGUNA pieza nueva se
 * puede medir (un video de Drive no le avisa nada a la página): con una que sí, ya se está midiendo.
 */
export function datosLandingCambio(p: { pagina: string; agregaste: string | null; todasSinMedir: boolean; sacaste: string | null; link: string }): DatosLandingCambio {
  return {
    landing_pagina: p.pagina,
    ...(p.agregaste ? { landing_agregaste: p.agregaste, landing_medible: p.todasSinMedir ? 'no' : 'sí' } : {}),
    ...(p.sacaste ? { landing_sacaste: p.sacaste } : {}),
    landing_link: p.link,
  };
}
