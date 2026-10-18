// =============================================================================
// El «Deshacer» de un movimiento de etapa: la FOTO de antes y la de después (17/10/2026)
// =============================================================================
// Módulo PURO (sin 'server-only': lo ejecuta el test; `node:crypto` sólo firma).
//
// ⚠️ «CÓMO ESTABA» NO SE RECONSTRUYE DESDE EL HISTORIAL. Hasta el 17/10 el Deshacer volvía a mover el lead
// (y la regla del desenlace le borraba la venta a uno de «Facturando»); el primer arreglo lo reconstruía desde
// las líneas de `lead_audit`, y la revisión adversarial le encontró cinco agujeros: el wizard con cuotas
// escribe el estado y el monto en OTRO grupo (`saveLeadPlanManual`, sin auditar) y el Deshacer fallaba con la
// venta contada; el anti-duplicado de 60 s (`sinRepetidas`) le saca líneas al grupo y la venta quedaba
// inventada o perdida; la línea de la etapa podía ser del movimiento de OTRA persona; y la etapa que dibuja el
// tablero no siempre es la que dice la línea. El historial es un registro para leer, no una foto.
//
// LA REGLA: la acción que MUEVE saca la foto del lead ANTES de escribir nada y DESPUÉS de terminar, más las
// cuotas y los ids de las líneas de historial que escribió, y la devuelve FIRMADA (HMAC con AUTH_SECRET). El
// Deshacer comprueba la firma, que lo que el movimiento cambió siga HOY como lo dejó (si no, «Alguien ya lo
// cambió» y no escribe nada), y repone la foto de antes TAL CUAL en las columnas que el movimiento cambió:
// sin `desenlaceAlGuardar`, que es una decisión y no una foto. Borra sólo esas líneas del historial y las
// cuotas que el movimiento creó.
// =============================================================================
import crypto from 'node:crypto';

/**
 * Las columnas de `leads` que puede tocar un movimiento: la etapa, el desenlace, las señales, y lo que carga el
 * wizard («Completar datos», el plan de pagos, el deal) y la reunión manual. `etapa_vista` NO: es la memoria del
 * historial y la alinea `alinearEtapaVista`. Una columna que la base no tiene (migración sin correr) no viene en
 * el lead y no entra a la foto.
 */
export const COLUMNAS_DEL_DESHACER = [
  'pipeline_stage', 'nutricion_manual_deadline', 'nutricion_realizada',
  'estado_lead', 'cerro', 'monto_cierre_usd', 'fecha_cierre', 'motivo_perdida',
  'asistio_j1', 'asistio_j2', 'calificado',
  'fecha_agenda', 'fecha_junta_1', 'fecha_junta_2', 'junta_1_at', 'junta_2_at', 'fathom_links',
  'setter', 'closer', 'empresa', 'telefono', 'telefono_normalizado',
  'sin_r1', 'sin_r2', 'fathom_omitido', 'deal_fiscal_doc_omitido', 'comprobante_omitido', 'r2_agenda_externa_motivo',
  'deal_servicio', 'deal_promesa', 'deal_fiscal', 'deal_obligaciones',
  'venta_tipo', 'suscripcion_monto_usd', 'suscripcion_meses',
  'duracion_meses', 'fecha_inicio_servicio', 'fecha_confirmacion',
  'cobro_inicial_usd', 'monto_cuota_usd', 'total_cuotas', 'dia_de_pago',
] as const;

export type FotoLead = Record<string, unknown>;
export type FotoCuota = { id: number; numero: number; monto_usd: number; fecha_esperada: string | null; pagado: boolean };

export type DatosDeshacer = {
  leadId: number;
  ws: number | null;
  /** Cuándo se sacó (epoch ms): pasada la vida del token, no se deshace. */
  t: number;
  antes: FotoLead;
  despues: FotoLead;
  /** Los ids de `lead_audit` que escribió el movimiento. */
  audit: number[];
  /**
   * Sólo si el movimiento pudo tocar cuotas (el wizard). `marcas`: el dedup de cobranza de las cuotas impagas de
   * ANTES (`leerMarcasDeCobranza`, lib/pagos.ts), que reprogramar una cuota olvida y el Deshacer repone.
   */
  cuotas?: { antes: FotoCuota[]; despues: FotoCuota[]; marcas?: MarcasDeCobranza };
};

/** Cuota (id como texto) → aviso (`AVISOS_DE_CUOTA`) → su marca de dedup tal como estaba (null = sin marca). */
export type MarcasDeCobranza = Record<string, Record<string, string | null>>;

/** Lo que viaja al navegador y vuelve: el cuerpo tal cual se firmó, y la firma. */
export type TokenDeshacer = { cuerpo: string; firma: string };

/** El toast dura 5-10 s; el teléfono, algo más. Diez minutos es de sobra y corta un token viejo. */
export const VIDA_DESHACER_MS = 10 * 60_000;

/** Las columnas del deshacer que el lead TIENE (las otras no se escriben nunca). */
export function fotoDe(lead: Record<string, unknown>): FotoLead {
  const f: FotoLead = {};
  for (const k of COLUMNAS_DEL_DESHACER) if (k in lead) f[k] = lead[k] ?? null;
  return f;
}

/** Las cuotas como se comparan: ordenadas por id, con números de verdad. */
export function fotoDeCuotas(filas: ReadonlyArray<Record<string, unknown>>): FotoCuota[] {
  return filas
    .map((p) => ({
      id: Number(p.id), numero: Number(p.numero), monto_usd: Number(p.monto_usd),
      fecha_esperada: (p.fecha_esperada as string | null) ?? null, pagado: p.pagado === true,
    }))
    .sort((a, b) => a.id - b.id);
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const firmar = (cuerpo: string, secreto: string): string =>
  crypto.createHmac('sha256', secreto).update(`deshacer:${cuerpo}`).digest('base64url');

export function firmarDeshacer(datos: DatosDeshacer, secreto: string): TokenDeshacer {
  const cuerpo = JSON.stringify(datos);
  return { cuerpo, firma: firmar(cuerpo, secreto) };
}

/** El token de vuelta, sólo si la firma es nuestra y no venció. Cualquier otra cosa: null. */
export function leerDeshacer(token: unknown, secreto: string, ahora: number): DatosDeshacer | null {
  if (!token || typeof token !== 'object') return null;
  const { cuerpo, firma } = token as Partial<TokenDeshacer>;
  if (typeof cuerpo !== 'string' || typeof firma !== 'string') return null;
  const esperada = Buffer.from(firmar(cuerpo, secreto));
  const vino = Buffer.from(firma);
  if (esperada.length !== vino.length || !crypto.timingSafeEqual(esperada, vino)) return null;
  let d: DatosDeshacer;
  try { d = JSON.parse(cuerpo) as DatosDeshacer; } catch { return null; }
  if (!d || typeof d.leadId !== 'number' || typeof d.t !== 'number' || !d.antes || !d.despues || !Array.isArray(d.audit)) return null;
  if (!(ahora - d.t >= 0 && ahora - d.t <= VIDA_DESHACER_MS)) return null;
  return d;
}

export type PlanDeshacer = {
  /** Columna → valor de ANTES, sólo las que el movimiento cambió. */
  lead: FotoLead;
  cuotas: { borrar: number[]; reponer: FotoCuota[]; volver: FotoCuota[] };
};

/**
 * Qué escribe el Deshacer, o por qué no. `hoyLead` y `hoyCuotas` son lo que dice la base AHORA.
 *   · `pisado`: algo que el movimiento cambió ya no está como lo dejó (otra persona, MaKo, el plan de pagos).
 *     No se escribe NADA: deshacer a medias es peor que no deshacer.
 *   · Las cuotas: las que el movimiento creó se borran (`borrar`), las que quitó vuelven con su id (`reponer`)
 *     y las que reprogramó vuelven a su monto y fecha (`volver`). Si cualquiera cambió después, `pisado`.
 */
export function planDeshacer(
  d: DatosDeshacer,
  hoyLead: FotoLead,
  hoyCuotas: FotoCuota[] | null,
): PlanDeshacer | { error: 'pisado'; campos: string[] } {
  const cambiadas = Object.keys(d.despues).filter((k) => k in d.antes && !igual(d.antes[k], d.despues[k]));
  const campos = cambiadas.filter((k) => !igual(hoyLead[k], d.despues[k]));
  if (d.cuotas && !igual(hoyCuotas, d.cuotas.despues)) campos.push('cuotas');
  if (campos.length) return { error: 'pisado', campos };

  const lead: FotoLead = {};
  for (const k of cambiadas) lead[k] = d.antes[k] ?? null;

  const cuotas: PlanDeshacer['cuotas'] = { borrar: [], reponer: [], volver: [] };
  if (d.cuotas) {
    const antes = new Map(d.cuotas.antes.map((c) => [c.id, c]));
    const despues = new Map(d.cuotas.despues.map((c) => [c.id, c]));
    for (const c of d.cuotas.despues) if (!antes.has(c.id)) cuotas.borrar.push(c.id);
    for (const c of d.cuotas.antes) {
      const ahora = despues.get(c.id);
      if (!ahora) cuotas.reponer.push(c);
      else if (!igual(ahora, c)) cuotas.volver.push(c);
    }
  }
  return { lead, cuotas };
}
