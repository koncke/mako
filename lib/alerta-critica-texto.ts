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
 * su `estado` (16/10/2026) y en su `ventana` (el día del incidente, 27/10/2026). `total`: los que llegaron en todo el
 * incidente (el «ya está» sale sólo si llegó alguno). Una marca de antes no tiene `estado`, ni `ventana`, ni `total`.
 */
export type Insistencia = { ultimaIso: string; veces: number; estado?: string | null; ventana?: number; total?: number };

/** Un día, en minutos: el largo de cada `ventana` del incidente. */
export const MIN_DIA = 24 * 60;
/** Cada cuánto se vuelve a intentar mientras toca avisar (el cron corre cada 10 min). */
export const CADENCIA_MIN = 60;

/**
 * EL DÍA DEL INCIDENTE (27/10/2026, MAU-33): 0 las primeras 24 h desde que se abrió, 1 las siguientes, y así. Decidido por el
 * Cerebro: «un incidente abierto varios días avisa una vez por día, y uno resuelto avisa "ya está"». Mauricio: «DETÉN TODO,
 * cuenta suspendida» le salió 25 veces en 28 horas (15-16/10) y desde el 16/10 calló con la cuenta frenada nueve días más.
 */
export const ventanaDelIncidente = (minAbierto: number): number => Math.max(0, Math.floor(minAbierto / MIN_DIA));

/**
 * LOS AVISOS QUE LLEGARON DEL ESTADO Y DEL DÍA DE AHORA (revisión del 16/10/2026; el día, 27/10/2026): un estado nuevo («En
 * período de gracia» → «Pendiente de cierre») vuelve a contar desde cero; si no, el techo callaba justo el empeoramiento. Y un
 * día nuevo también: con el techo de la automatización («Aviso número ≤ 3») contado sobre TODO el incidente, una cuenta frenada
 * nueve días callaba desde el día 2. Una marca de antes, sin `estado`, cuenta como el mismo estado; sin `ventana`, como el día 0.
 */
export function vecesDelEstado(prev: Insistencia | null, estado: string | null, ventana = 0): number {
  if (!prev) return 0;
  if ((prev.ventana ?? 0) !== ventana) return 0;
  if (prev.estado === undefined || (prev.estado ?? null) === (estado ?? null)) return prev.veces;
  return 0;
}

/** El horario del recordatorio de cada día, en la hora del NEGOCIO: de las 9 a las 21. */
export const HORARIO_RECORDATORIO = { desde: 9, hasta: 21 } as const;

/** La hora (0 a 23) de `ahoraMs` en la zona `tz`. Una zona que Intl no conoce cuenta como UTC. */
export function horaEnZona(ahoraMs: number, tz: string): number {
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(ahoraMs));
    if (Number.isFinite(h)) return h % 24;
  } catch { /* zona desconocida: UTC */ }
  return new Date(ahoraMs).getUTCHours();
}

/** ¿Es hora de mandar el recordatorio del día en la zona del negocio? */
export const enHorarioDeRecordatorio = (ahoraMs: number, tz: string): boolean => {
  const h = horaEnZona(ahoraMs, tz);
  return h >= HORARIO_RECORDATORIO.desde && h < HORARIO_RECORDATORIO.hasta;
};

/**
 * ¿TOCA EMITIR AHORA? (27/10/2026, MAU-33). El primer día, cada `CADENCIA_MIN` (el techo lo pone la automatización). Desde el
 * segundo, UNO por día: si hoy ya llegó uno (`veces` del día), nada hasta mañana; si no llegó (la línea caída, sin grupo), se
 * reintenta cada `CADENCIA_MIN`, como antes, sin perder el aviso del día.
 */
export function tocaAvisar(prev: Insistencia | null, minAbierto: number, veces: number, ahoraMs: number, tz?: string | null): boolean {
  if (!prev) return true;
  const dia = ventanaDelIncidente(minAbierto);
  if (dia > 0 && veces > 0) return false;
  // ⚠️ EL RECORDATORIO DE CADA DÍA, DE DÍA (la revisión del Cerebro, 28/10/2026): el día del incidente cuenta 24 h desde que se
  // abrió, y sin esto el recordatorio caía a la hora en que Meta frenó la cuenta (las 03:05 de Argentina, todos los días). El
  // primer día, no: la cuenta acaba de frenarse y se avisa en el acto, como siempre. Sin zona, como antes.
  if (dia > 0 && tz && !enHorarioDeRecordatorio(ahoraMs, tz)) return false;
  const desdeUltimo = (ahoraMs - Date.parse(prev.ultimaIso)) / 60_000;
  return !(desdeUltimo < CADENCIA_MIN);
}

/** ¿Le LLEGÓ algún aviso de este incidente? (el «ya está» sale sólo así). Una marca de antes cuenta sus `veces`. */
export const llegoAlguno = (m: Partial<Insistencia> | null | undefined): boolean => ((m?.total ?? m?.veces) ?? 0) > 0;

/**
 * LA MARCA DESPUÉS DE EMITIR EL EVENTO (revisión del 16/10/2026). `null` = no se pudo (no se leyeron las automatizaciones de
 * la plataforma): no se escribe nada y el próximo tick reintenta. Si se emitió, se anota la hora —la cadencia corre desde
 * acá— y SÓLO un aviso que LLEGÓ (al grupo o por email) suma al techo. Sin automatización prendida, o con la tarjeta sin
 * llegar (sin grupo, la línea caída), vuelve a probar en la próxima cadencia sin gastar avisos: si no, el rato entre el
 * deploy y la mudanza, o tres horas de línea caída, agotaban el techo sin que saliera ninguno.
 */
export function marcaTrasEmitir(
  prev: Insistencia | null, estado: string | null, r: { ok: boolean; llegaron?: number }, ahoraIso: string, ventana = 0,
): Insistencia | null {
  if (!r.ok) return null;
  const veces = vecesDelEstado(prev, estado, ventana);
  const llego = (r.llegaron ?? 0) > 0 ? 1 : 0;
  return { ultimaIso: ahoraIso, veces: veces + llego, estado: estado ?? null, ventana, total: ((prev?.total ?? prev?.veces) ?? 0) + llego };
}

// «hace 12 días» y no «hace 288 h» (27/10/2026: con el aviso de cada día, el incidente lleva días).
export const horasYMinutos = (min: number): string => {
  if (min >= MIN_DIA) {
    const d = Math.floor(min / MIN_DIA);
    const h = Math.floor((min % MIN_DIA) / 60);
    return `${d} ${d === 1 ? 'día' : 'días'}${h ? ` y ${h} h` : ''}`;
  }
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
