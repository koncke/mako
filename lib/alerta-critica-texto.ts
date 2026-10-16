// =============================================================================
// alerta-critica-texto — los HECHOS de la alerta de la cuenta publicitaria. Sin `server-only`, a propósito.
// =============================================================================
// Vive separado de `alerta-critica.ts` (que hace el trabajo sucio: leer la base,
// decidir la cadencia, emitir) para que un test lo pueda importar.
//
// ⚠️ DESDE EL 16/10/2026 ACÁ NO HAY NINGUNA FRASE (docs/inventario-nada-por-detras.md,
// lote 1: el «18ª vez» del grupo de Mauricio). Hasta ese día este módulo armaba el
// mensaje entero —el titular por estado, «qué hacer», el contador «Es la Nª vez», la
// escalada de las 6 h— y lo mandaba `emitirAviso` directo, sin automatización: nadie lo
// podía ver ni cambiar, y no tenía techo. Ahora sale por el evento de la plataforma
// `meta_cuenta_frenada`, y su automatización de SuperAdmin tiene el texto literal de
// cada estado y el techo de avisos (`mako-meta-cuenta-frenada`,
// lib/plantillas-automatizaciones.ts). Acá quedan los datos que cita.
//
// Lo que se aprendió con los textos de antes, y que la fila sigue respetando:
//   · decir la CAUSA, no el síntoma: «suspendida por falta de pago» dice qué hacer,
//     «dejó de entregar» no (pedido del dueño, 12/8);
//   · no afirmar lo que Meta no confirmó: «sin entregar» sale sólo con `entrega_frenada`,
//     y es un DATO (`anuncios_entrega`), no una frase que el texto da por hecha;
//   · el motivo de Meta sólo cuando agrega algo: igual al estado, no se pasa y su renglón
//     se va solo.
// =============================================================================

/** El estado del incidente, tal como lo guarda `service_incidents`. */
export type IncidenteTexto = {
  /** `accountStatusLabel()` de lib/meta-health.ts: «Saldo impago», «Deshabilitada»… */
  statusLabel: string | null;
  /** `disableReasonLabel()`: por qué la deshabilitaron, cuando aplica. */
  disableReason: string | null;
  entregaFrenada: boolean;
  /** ¿`statusLabel` es de verdad un ESTADO que contestó Meta? (mig 0139). Sólo se avisa lo confirmado (`esCritico`). */
  confirmado?: boolean;
};

/**
 * LO QUE GUARDA LA INSISTENCIA DE UN INCIDENTE (settings `mako.alerta.insistencia.<id>`). `veces`: los avisos que LLEGARON en
 * su `estado` (16/10/2026). Una marca de antes no tiene `estado`.
 */
export type Insistencia = { ultimaIso: string; veces: number; estado?: string | null };

/**
 * LOS AVISOS QUE LLEGARON DEL ESTADO DE AHORA (revisión del 16/10/2026): un estado nuevo («En período de gracia» → «Pendiente
 * de cierre») vuelve a contar desde cero; si no, el techo callaba justo el empeoramiento. Una marca de antes, sin `estado`,
 * cuenta como el mismo estado (el incidente que ya pasó el techo no vuelve a salir).
 */
export function vecesDelEstado(prev: Insistencia | null, estado: string | null): number {
  if (!prev) return 0;
  if (prev.estado === undefined || (prev.estado ?? null) === (estado ?? null)) return prev.veces;
  return 0;
}

/**
 * LA MARCA DESPUÉS DE EMITIR EL EVENTO (revisión del 16/10/2026). `null` = no se pudo (no se leyeron las automatizaciones de
 * la plataforma): no se escribe nada y el próximo tick reintenta. Si se emitió, se anota la hora —la cadencia corre desde
 * acá— y SÓLO un aviso que LLEGÓ (al grupo o por email) suma al techo. Sin automatización prendida, o con la tarjeta sin
 * llegar (sin grupo, la línea caída), vuelve a probar en la próxima cadencia sin gastar avisos: si no, el rato entre el
 * deploy y la mudanza, o tres horas de línea caída, agotaban el techo sin que saliera ninguno.
 */
export function marcaTrasEmitir(
  prev: Insistencia | null, estado: string | null, r: { ok: boolean; llegaron?: number }, ahoraIso: string,
): Insistencia | null {
  if (!r.ok) return null;
  const veces = vecesDelEstado(prev, estado);
  return { ultimaIso: ahoraIso, veces: (r.llegaron ?? 0) > 0 ? veces + 1 : veces, estado: estado ?? null };
}

export const horasYMinutos = (min: number): string => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/**
 * LOS DATOS DEL EVENTO `meta_cuenta_frenada` (lib/variables-aviso.ts, alcance `anuncios`): el estado que contestó Meta, si
 * la entrega está frenada, hace cuánto, el motivo (si agrega algo) y qué número de aviso es (el primero es el 1). Lo que
 * falta no se pasa: su renglón se va solo (`sinRenglonesVacios`).
 */
export function datosCuentaFrenada(i: IncidenteTexto, minAbierto: number, veces: number): Record<string, string> {
  const estado = i.statusLabel?.trim();
  const motivo = i.disableReason?.trim();
  return {
    ...(estado ? { anuncios_estado: estado } : {}),
    anuncios_entrega: i.entregaFrenada ? 'sin entregar' : 'entregando',
    anuncios_hace: horasYMinutos(minAbierto),
    ...(motivo && motivo !== estado ? { anuncios_motivo_meta: motivo } : {}),
    anuncios_vez: String(veces + 1),
  };
}
