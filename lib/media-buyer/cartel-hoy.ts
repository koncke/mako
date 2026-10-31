// =============================================================================
// Media Buyer — el cartel de «Hoy» cuando no hay cambios: una frase VERDADERA por caso (30/10/2026)
// =============================================================================
// La pantalla sin cambios decía siempre lo mismo: «Hoy no hay cambios — Todo anda dentro de tu objetivo. Vuelvo a mirar
// mañana.». Miraba DOS cosas: que no hubiera decisiones de hoy y que el agente estuviera prendido. Nunca preguntaba si el
// negocio TIENE campañas, así que una cuenta recién conectada, sin una campaña, sin gastar un peso, leía «todo anda dentro
// de tu objetivo»: el peor cartel de la app, porque le dice que está todo bien a quien todavía no empezó.
//
// Acá se decide con lo que LLEGA a la pantalla y nada más:
//   · el interruptor del agente (`config.encendido`);
//   · si la cuenta publicitaria está conectada (el token de Meta del negocio o su Zernio) — `null` cuando todavía no se sabe;
//   · lo que dejó la última corrida en su resumen (`config.ultimaCorridaInfo`, lib/media-buyer/corrida.ts): su `estado` y,
//     desde hoy, `campanas` y `activas`, contadas del árbol que el agente YA leyó. Ni una lectura más de Meta: las campañas
//     EN VIVO sólo las trae la pestaña Campañas (lienzoMediaBuyer), que lee Meta al abrirse.
//
// ⚠️ Sin resumen, o con un resumen que no trae esos números, NO se afirma nada: la pantalla dice que todavía no lo sabe.
// Una pantalla que calla cuando no midió es la regla; «todo bien» sin medirlo es lo que había que sacar.
//
// Puro (sin React, sin servidor) y A PROPÓSITO fuera de las dos pantallas: lo usan la computadora
// (app/ads-manager/MediaBuyer.tsx) y el teléfono (app/m/ads/MediaBuyerM.tsx), y lo cubre
// tests/media-buyer-cartel-hoy.test.ts.
// =============================================================================

/** Los casos que antes se decían con la misma frase. */
export type EstadoHoy =
  | 'sin_cuenta'
  | 'sin_campanas'
  | 'campanas_en_pausa'
  | 'agente_apagado'
  | 'sin_cambios'
  | 'sin_medir'
  | 'sin_lectura';

/** El próximo paso de cada caso. `null` sólo cuando de verdad no hay nada que hacer. */
export type PasoHoy = 'conectar' | 'crear_campana' | 'prender_campana' | 'prender_agente' | 'analizar';

export type CartelHoy = { estado: EstadoHoy; titulo: string; bajada: string; paso: PasoHoy | null };

/** El botón de la computadora: acción + objeto, nunca «Aceptar». */
export const ROTULO_PASO: Record<PasoHoy, string> = {
  conectar: 'Conectar mi cuenta de Meta',
  crear_campana: 'Lanzar mi primera campaña',
  prender_campana: 'Ver mis campañas',
  prender_agente: 'Prenderme en Ajustes',
  analizar: 'Mirar mi cuenta ahora',
};

/** Dónde se hace, en la computadora: el Media Buyer no se configura desde el teléfono (memoria «mako-mobile»). */
export const PASO_EN_EL_TELEFONO: Record<PasoHoy, string> = {
  conectar: 'La cuenta se conecta en la computadora.',
  crear_campana: 'La primera campaña se lanza en la computadora.',
  prender_campana: 'Las campañas se prenden en la computadora.',
  prender_agente: 'Se prende en la computadora.',
  analizar: 'La miro cada día; en la computadora puedes pedírmelo ahora.',
};

/** Lo que el resumen de la última corrida deja ver. Todo `null` = no se sabe (no se afirma nada). */
export type LoVisto = { estado: string | null; campanas: number | null; activas: number | null };

const cuenta = (x: unknown): number | null => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null);

/**
 * Lee `ultima_corrida_info` (JSONB: puede venir de una versión vieja, a medias, o con cualquier cosa adentro) sin confiar
 * en nada. Más prendidas que vivas es un resumen roto: se descarta el número en vez de dibujar un «0 en pausa» inventado.
 */
export function loVisto(info: unknown): LoVisto {
  const o = info && typeof info === 'object' && !Array.isArray(info) ? (info as Record<string, unknown>) : null;
  const campanas = cuenta(o?.campanas);
  const activas = cuenta(o?.activas);
  return {
    estado: typeof o?.estado === 'string' && o.estado ? o.estado : null,
    campanas,
    activas: campanas != null && activas != null && activas > campanas ? null : activas,
  };
}

/**
 * Qué dice la pantalla de «Hoy» cuando no hay ningún cambio para hoy. Quien llama ya sabe que `hoy.length === 0`.
 *
 * El ORDEN es el del próximo paso que le sirve al negocio, no el del dato:
 *   1. sin cuenta no hay nada más que decir (ni campañas, ni agente);
 *   2. con la cuenta vacía, o con todo en pausa, prender el agente no cambia nada: va ANTES del interruptor;
 *   3. el interruptor;
 *   4. prendido, con campañas prendidas y una corrida que terminó: la ÚNICA vez que se puede decir que no hubo nada que hacer;
 *   5. cualquier otra cosa: todavía no se sabe, y se dice.
 */
export function cartelDeHoy({ encendido, conectada, corrida }: {
  encendido: boolean;
  /** `true`/`false` la cuenta publicitaria; `null` cuando todavía no se sabe (no se afirma que falte). */
  conectada: boolean | null;
  /** `config.ultimaCorridaInfo` tal como viene, o `null` si el agente nunca corrió. */
  corrida: unknown;
}): CartelHoy {
  const v = loVisto(corrida);

  if (conectada === false || v.estado === 'sin_cuenta') {
    return {
      estado: 'sin_cuenta',
      titulo: 'Conecta tu cuenta de Meta',
      bajada: 'Sin ella no veo tus anuncios ni puedo mover un peso.',
      paso: 'conectar',
    };
  }

  if (v.campanas === 0) {
    return {
      estado: 'sin_campanas',
      titulo: 'Todavía no tienes campañas',
      bajada: 'Tu cuenta de Meta está vacía: no hay nada que medir. Lanza la primera y la sigo desde el primer día.',
      paso: 'crear_campana',
    };
  }

  if (v.campanas != null && v.campanas > 0 && v.activas === 0) {
    const una = v.campanas === 1;
    return {
      estado: 'campanas_en_pausa',
      titulo: una ? 'Tu campaña está en pausa' : 'Tus campañas están en pausa',
      bajada: `Nada está gastando, así que no hay nada que ajustar. ${una ? 'Préndela' : 'Prende una'} y la sigo.`,
      paso: 'prender_campana',
    };
  }

  if (!encendido) {
    return {
      estado: 'agente_apagado',
      titulo: 'Estoy apagado',
      bajada: 'Mientras no me prendas no miro tu cuenta ni te aviso de nada.',
      paso: 'prender_agente',
    };
  }

  if (v.estado === 'ok' && v.activas != null && v.activas > 0) {
    const una = v.activas === 1;
    return {
      estado: 'sin_cambios',
      titulo: 'Hoy no hay cambios',
      bajada: `Miré ${una ? 'tu campaña activa' : `tus ${v.activas} campañas activas`} y no hay nada que mover. Vuelvo a mirar mañana.`,
      paso: null,
    };
  }

  if (v.estado === null) {
    return {
      estado: 'sin_medir',
      titulo: 'Todavía no miré tu cuenta',
      bajada: 'Dame una pasada y te digo qué conviene mover.',
      paso: 'analizar',
    };
  }

  return {
    estado: 'sin_lectura',
    titulo: 'Todavía no sé cómo vienes',
    bajada: 'No tengo una lectura completa de tu cuenta, y no te digo nada que no haya medido.',
    paso: 'analizar',
  };
}
