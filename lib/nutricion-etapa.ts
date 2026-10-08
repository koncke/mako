// =============================================================================
// nutricion-etapa — qué secuencias dispara un lead que ACABA de caer en una etapa
// =============================================================================
// El dato ya existía: una secuencia con `trigger_tipo = 'etapa_actual'` se cuelga de
// una etapa (`nutricion_secuencias.etapa` = la key del stage) y se acota al embudo que
// declara (`funnel_id`, mig 0170). Lo que no existía era el EVENTO: hasta el 05/10/2026
// eso lo descubría únicamente el barrido horario del cron (`leadsDeCohorte`), así que
// mover un lead a una etapa y que le llegue el mensaje eran dos cosas separadas por
// hasta una hora.
//
// Pedido de Martín (05/10/2026): «Tienes que poner un CRON que se active mediante que un
// lead caiga en X etapa de X producto. Recuerda que ahora tenemos varios productos en el
// CRM, y dentro de cada producto se pueden configurar etapas, entonces esto debería leer
// eso y que el usuario pueda elegir que si cae en dicha etapa, se dispare esa secuencia».
//
// ⚠️ VIVE EN UN MÓDULO PURO, SIN NINGÚN IMPORT DE SERVIDOR, A PROPÓSITO. Esto decide a
// quién le llega un WhatsApp real, así que es justo lo que no puede quedarse sin test —
// el mismo criterio que `lib/nutricion-familias.ts` y `lib/nutricion-ambito.ts`.
//
// ⚠️ Y NO SE PUEDE REUSAR `enrolarPorEvento` A SECAS. Ese camino enrola en TODAS las
// secuencias activas de los triggers del evento, lo cual es correcto para `lead_nuevo`
// (hay un puñado y todas le aplican a cualquier lead nuevo) y sería catastrófico acá: un
// lead que cae en «Agenda» entraría también a la secuencia de «Facturando» y a la del
// producto de al lado. La etapa y el producto son parte de la pregunta, no un detalle.

import { leadEnAmbito, type AmbitoFunnel } from './nutricion-ambito';

/** Lo mínimo que hace falta de una secuencia para saber si esta etapa la dispara. */
export type SecuenciaDeEtapa = {
  id: number;
  trigger_tipo: string;
  /** La key del stage del que cuelga. Sin etapa no hay nada que comparar. */
  etapa: string | null;
  /** El ámbito de embudo YA resuelto (`ambitoDeSecuencia`): el caller es el único que
   *  puede saber si ese embudo es el del negocio. */
  ambito: AmbitoFunnel;
};

/** El trigger que se cuelga de una etapa. Es el nombre que ya está en la base. */
export const TRIGGER_ETAPA = 'etapa_actual';

/**
 * Las secuencias que dispara un lead que acaba de caer en `etapa`.
 *
 * Tres condiciones, y las tres tienen que valer:
 *   1. la secuencia se cuelga de una etapa (`trigger_tipo === 'etapa_actual'`),
 *   2. es ESA etapa, y
 *   3. el lead está en el ámbito de embudo que la secuencia declara — o sea, el
 *      PRODUCTO. Con `funnel_id` NULL la secuencia es de todos los productos, que es
 *      como están hoy las 62 filas de producción: sin esto, declarar el producto en una
 *      sola secuencia apagaría el resto.
 *
 * Devuelve las secuencias, no los ids: el caller necesita sus pasos para el primer envío.
 */
export function secuenciasDeEtapa<T extends SecuenciaDeEtapa>(
  secuencias: readonly T[],
  etapa: string | null | undefined,
  leadFunnelId: number | string | null | undefined,
): T[] {
  // Sin etapa no se enrola a nadie. Es la guarda que convierte este camino en uno
  // seguro: un evento sin la etapa adentro NO puede caer en «entonces todas».
  const key = (etapa ?? '').trim();
  if (!key) return [];
  return secuencias.filter((s) => (
    s.trigger_tipo === TRIGGER_ETAPA
    && (s.etapa ?? '').trim() === key
    && leadEnAmbito(s.ambito, leadFunnelId)
  ));
}

/** El trigger que se cuelga de una etapa de la ENTREGA de un servicio. */
export const TRIGGER_ENTREGA = 'entrega_actual';

/** Lo mínimo de una secuencia para saber si una etapa de ENTREGA la dispara. */
export type SecuenciaDeEntrega = {
  id: number;
  trigger_tipo: string;
  etapa: string | null;
  /** El producto de cuya entrega cuelga. NULL = la entrega de cualquier producto. */
  producto_id?: number | string | null;
};

/**
 * Las secuencias que dispara un CLIENTE que acaba de caer en una etapa de la entrega.
 *
 * ⚠️ ES UN EVENTO PROPIO Y NO UN STRING MÁS ADENTRO DEL DE VENTA, y el porqué lo midió
 * la sesión de Customer Success antes de que existiera este código: `secuenciasDeEtapa`
 * compara la etapa con `===`, y las dos listas de etapas —la del embudo y la de la
 * entrega— las edita el CLIENTE. Hoy el choque entre los dos defaults es CERO (venta:
 * lead, agenda, agendaj2, facturando, ganado · entrega: onboarding, arranque, hito1,
 * hito2, entregado), pero nada lo impide: el día que alguien llame `facturando` a una
 * etapa de entrega, mover un cliente en el kanban de Customer Success dispararía una
 * secuencia de VENTA. Un trigger aparte lo cierra por construcción, no por suerte.
 *
 * ⚠️ Y EL ÁMBITO ES EL PRODUCTO, NO EL EMBUDO. Son dos columnas distintas
 * (`producto_id` de la mig 0189 vs `funnel_id` de la 0170) porque del producto al embudo
 * hay dos saltos: pasar el id de un producto como si fuera el de un embudo hace match
 * con el embudo que tenga ese número, que es el de cualquier otra cosa.
 */
export function secuenciasDeEntrega<T extends SecuenciaDeEntrega>(
  secuencias: readonly T[],
  etapa: string | null | undefined,
  productoId: number | string | null | undefined,
): T[] {
  // La misma guarda que arriba, y por lo mismo: sin etapa no se enrola a nadie.
  const key = (etapa ?? '').trim();
  if (!key) return [];
  // Y sin producto tampoco. Acá es MÁS estricto que en la venta: un lead sin embudo es
  // normal (NULL = el del negocio), pero un movimiento de entrega SIEMPRE trae su
  // producto —la fila de `cliente_entrega` lo tiene NOT NULL—, así que un evento sin
  // producto es un llamador roto, no un caso de negocio.
  const prod = productoId == null || productoId === '' ? null : Number(productoId);
  if (prod == null || !Number.isFinite(prod)) return [];
  return secuencias.filter((s) => {
    if (s.trigger_tipo !== TRIGGER_ENTREGA) return false;
    if ((s.etapa ?? '').trim() !== key) return false;
    // NULL = la entrega de CUALQUIER producto, igual que `funnel_id` NULL en la venta.
    if (s.producto_id == null || s.producto_id === '') return true;
    const suyo = Number(s.producto_id);
    return Number.isFinite(suyo) && suyo === prod;
  });
}

/**
 * El trigger «le pusieron la etiqueta X» (mig 0223: `nutricion_secuencias.etiqueta_id`).
 *
 * ⚠️ OTRO TRIGGER Y NO UNA ETAPA MÁS, por lo mismo que la entrega: la etiqueta es un id de
 * `crm_etiquetas` (mig 0224) y una etapa es una key que edita el cliente. Mezclados en
 * `etapa`, el día que un id coincida con una key se dispararía una secuencia que nadie pidió.
 */
export const TRIGGER_ETIQUETA = 'etiqueta_puesta';

/** Lo mínimo de una secuencia para saber si una etiqueta la dispara. */
export type SecuenciaDeEtiqueta = { id: number; trigger_tipo: string; etiqueta_id?: number | string | null };

/**
 * Las secuencias que dispara un lead al que ACABAN de ponerle la etiqueta `etiquetaId`.
 *
 * ⚠️ SIN ETIQUETA NO SE ENROLA A NADIE, y es la misma guarda que la del evento de etapa:
 * `enrolarPorEvento` mete al lead en TODAS las secuencias del trigger del evento, así que sin
 * este filtro poner «Cualificado» lo metía también en la secuencia de «Seguimiento». Una
 * secuencia sin `etiqueta_id` no dispara nunca: no existe «todas las etiquetas».
 */
export function secuenciasDeEtiqueta<T extends SecuenciaDeEtiqueta>(
  secuencias: readonly T[],
  etiquetaId: number | string | null | undefined,
): T[] {
  const id = etiquetaId == null || etiquetaId === '' ? NaN : Number(etiquetaId);
  if (!Number.isInteger(id) || id <= 0) return [];
  return secuencias.filter((s) => s.trigger_tipo === TRIGGER_ETIQUETA && s.etiqueta_id != null && Number(s.etiqueta_id) === id);
}
