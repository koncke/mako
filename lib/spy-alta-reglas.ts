// =============================================================================
// spy-alta-reglas — lo PURO del buscador de «Mirar a alguien más» (3/11/2026)
// =============================================================================
// Martín, 3/11: «No se mejoró ni el modal, sigue horrible el diseño... Y no tiene sentido que tenga 2
// tabs». Queda UN campo. Desde el 4/11/2026 lo que se escribe decide qué se busca en `./spy-buscar-reglas.ts`
// (`planDeBusqueda`, un grupo por red); acá quedan el cupo y «¿lo escrito es alguien que ya miro?».
//
// ⚠️ TODO LO DE ACÁ CUIDA UN TOPE. Cada búsqueda y cada perfil leído gastan de `APIFY_TOPE_POR_DIA`, y si se
// agota nadie del negocio puede agregar a nadie hasta mañana.
// =============================================================================

import { queEs } from './spy-que-es';
import { dominioComparable, nombreComparable } from './spy-reglas';

/**
 * Las lecturas del cupo diario que completar las filas solas NO puede tocar: quedan para quien aprieta «agregar».
 *
 * ⚠️ 4/11/2026: subió de 15 a 30 con el cupo de la clave de Spy, que pasó de 40 a 150 lecturas por día
 * (`TOPE_LECTURAS_SPY_POR_DIA`, lib/instagram-perfil.ts). Lo que se decide del buscador (qué se busca, cómo se
 * ordena) vive desde ese día en `./spy-buscar-reglas.ts`.
 */
export const RESERVA_DEL_ALTA = 30;

/** La espera antes de completar: quien sigue escribiendo no gasta lecturas en una lista que ya no mira. */
export const ESPERA_COMPLETAR_MS = 700;

type Mirado = { nombre: string; instagram?: string | null; youtube_id?: string | null; tiktok?: string | null; landing_url?: string | null };

/**
 * ¿Lo escrito en la barra de arriba es este competidor? Por su nombre, o por cualquiera de sus canales pegado entero.
 * `titulo` = el nombre que muestra su tarjeta, que puede no ser el guardado (`nombreDeTarjeta`): se busca lo que se ve.
 */
export function coincideCompetidor(c: Mirado, texto: string, titulo?: string): boolean {
  const n = nombreComparable(texto);
  if (!n) return !texto.trim();
  if ([c.nombre, titulo ?? '', c.instagram ?? '', c.tiktok ?? ''].some((x) => nombreComparable(x).includes(n))) return true;
  const l = queEs(texto);
  if (l?.campo === 'instagram') return (c.instagram ?? '').toLowerCase() === l.valor;
  if (l?.campo === 'tiktok') return (c.tiktok ?? '').toLowerCase() === l.valor.toLowerCase();
  if (l?.campo === 'youtube_id') return c.youtube_id === l.valor;
  if (l?.campo === 'landing_url') return !!c.landing_url && dominioComparable(c.landing_url) === dominioComparable(l.valor);
  return false;
}
