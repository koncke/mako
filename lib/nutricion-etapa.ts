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
