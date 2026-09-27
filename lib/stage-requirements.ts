// =============================================================================
// stage-requirements — requisitos ACUMULATIVOS de datos por etapa (fuente única)
// =============================================================================
// Para ESTAR en una etapa deben cumplirse los requisitos de toda la cadena
// previa del funnel canónico: un lead no puede ser "Ganado" sin R1 marcada
// (fecha + asistencia + calificado + Fathom), R2 marcada y monto. El Kanban,
// la ficha y el backstop del server consumen esta misma fuente.
//
// Regla "posible vs imposible": solo se exige lo que el humano PUEDE conseguir.
// Las fechas de reunión viven en Calendly/Google Calendar; el link de Fathom
// solo existe si la reunión YA ocurrió (a una futura no se le exige); el
// comportamiento (VSL/landing) es imposible de reconstruir y JAMÁS se exige.
//
// Devuelve PASOS ordenados (para el wizard progresivo: una pregunta por vez).

// Cuáles etapas son reuniones (y en qué orden) NO se decide acá: es la misma
// pregunta que responden generateFunnel y el worklist, y vive en un solo módulo.
import { reunionesDe, type EtapaLite } from './funnel-etapas';

export type StepId =
  | 'fechaJ1' | 'asistenciaR1' | 'calificado' | 'fathomR1'
  | 'fechaJ2' | 'asistenciaR2' | 'fathomR2' | 'r2Respuestas'
  | 'monto' | 'plan' | 'motivo' | 'setter' | 'closer'
  | 'telefono' | 'empresa'
  | 'dealServicio' | 'dealPromesa' | 'dealFiscal' | 'dealObligaciones' | 'dealFiscalDoc'
  | 'comprobante';

export type Step = { id: StepId; label: string };

export interface StageReqValues {
  fechaJ1?: string | null;
  asistioJ1?: boolean | null;
  calificado?: boolean | null;
  fechaJ2?: string | null;
  asistioJ2?: boolean | null;
  /** Un solo set de links por lead: cubre R1 y R2 (etiquetados). */
  hasFathomUrl?: boolean;
  monto?: number | null;
  /** Importe MENSUAL de una venta recurrente (`suscripcion_monto_usd`). En una
   *  suscripción `monto` queda null A PROPÓSITO —una recurrencia indefinida no
   *  tiene total— así que este es el importe que satisface "Monto de cierre".
   *  El caller solo lo pasa cuando la venta ES recurrente; si el movimiento la
   *  cambia a pago único, va null (si no, el importe viejo daría por cargado un
   *  monto que ya no existe). */
  suscripcionMonto?: number | null;
  /** Motivo YA persistido en el lead (`motivo_perdida`). Puede ser el de una
   *  pérdida ANTERIOR: ver `etapaActual` en el corte de perdido/descal. */
  motivo?: string | null;
  /** Motivo aportado EN ESTE movimiento (lo que la persona acaba de contestar).
   *  Se separa del anterior a propósito: es el único que vale al ENTRAR a una salida. */
  motivoNuevo?: string | null;
  /** Etapa donde el lead está AHORA (el origen del movimiento). Solo la sabe quien
   *  está MOVIENDO el lead; los callers que evalúan la etapa actual (el worklist
   *  "Datos sin marcar") la dejan en undefined a propósito. */
  etapaActual?: string | null;
  /** Datos operativos (higiene): se exigen SIEMPRE en la ficha, nunca gatean mover. */
  setter?: string | null;
  closer?: string | null;
  telefono?: string | null;
  empresa?: string | null;
  /** Deal Details desglosado (ganado). true = presente, false = falta, undefined = no evaluar. */
  dealServicioOk?: boolean;
  dealPromesaOk?: boolean;
  dealFiscalOk?: boolean;
  dealObligacionesOk?: boolean;
  dealFiscalDocOk?: boolean;
  /** Cuotas ya pagadas SIN comprobante subido (del caller que tiene los pagos). */
  comprobantesFaltantes?: number;
  /** ¿Hubo R2? + ¿tiene respuestas del formulario de Calendly R2? */
  tieneR2?: boolean;
  r2RespuestasOk?: boolean;
  /** undefined = el caller no sabe si hay plan (no se exige); boolean = se exige. */
  tienePlan?: boolean;
  /** Hoy en ISO (YYYY-MM-DD). Si falta, las fechas se asumen pasadas (estricto). */
  hoyISO?: string | null;
  /** Timestamps con HORA de las reuniones (Calendly start_time). Si están, "ya pasó"
   *  mira la hora real (no solo el día): una reunión de hoy que ya terminó exige el Fathom. */
  atJ1?: string | null;
  atJ2?: string | null;
  /** Excepciones declaradas (con motivo registrado): cierre sin R1 / sin R2. */
  sinR1?: boolean;
  sinR2?: boolean;
  /** La reunión no se grabó: no se exige el link de Fathom. */
  fathomOmitido?: boolean;
  /**
   * ¿De este encuentro se espera una grabación? Sale de `seGraba(canal, fathomConectado)`
   * en lib/pipeline.ts: un 1:1 remoto con Fathom conectado, sí; un taller presencial o
   * un webinar, nunca; un workspace sin Fathom, tampoco.
   *
   * Es el mismo escape hatch que `fathomOmitido` (mig 0064, el botón «No se grabó»),
   * pero resuelto por la naturaleza del encuentro en vez de a mano, lead por lead. Sin
   * esto, quien cierra en persona no puede mover un lead a Ganado sin inventar un link.
   *
   * `undefined` = el caller no sabe → se comporta como hoy (se exige).
   */
  grabable?: boolean;
  /** Funnel del workspace (para funnels no-default). Si faltan, se asume el funnel
   *  high-ticket DEFAULT: 2 reuniones y venta = etapa 'ganado'. */
  nivel?: number;         // override del nivel de requisitos de la etapa
  numReuniones?: number;  // reuniones del funnel (gatea R1/R2)
  esVenta?: boolean;      // la etapa exige datos de venta (monto + Deal Details)
}

// Gracia tras la HORA de inicio para considerar una reunión "ya terminada" (y por
// ende exigirle el Fathom): una llamada de ventas dura ~1h, así no la pedimos
// mientras la reunión está en curso.
const GRACIA_POST_REUNION_MS = 60 * 60_000;

/** ¿La reunión ya pasó? Si hay timestamp con HORA (junta_N_at) usamos la hora real
 *  + gracia; si no, caemos al día (comportamiento previo). Antes solo miraba el día,
 *  así que una reunión de HOY que ya pasó por hora no exigía el Fathom. */
const yaPaso = (fecha: string | null | undefined, hoyISO: string | null | undefined, atISO?: string | null) => {
  if (atISO) { const t = Date.parse(atISO); if (Number.isFinite(t)) return Date.now() >= t + GRACIA_POST_REUNION_MS; }
  return !!fecha && (!hoyISO || fecha.slice(0, 10) < hoyISO);
};

/** Nivel de la cadena canónica que exige cada etapa destino (funnel high-ticket default). */
const NIVEL: Record<string, number> = {
  // 1 = R1 agendada · 2 = R1 completa · 3 = R2 agendada · 4 = R2 completa · 5 = venta
  agenda: 1,
  agendaj2: 3,
  facturando: 4,
  ganado: 5,
};

/** La vista liviana del pipeline que necesita este módulo — el mismo tipo que
 *  usa funnel-etapas, no una copia (se conserva el nombre por los call-sites). */
export type PipelineStageLite = EtapaLite;

/**
 * Deriva del funnel del WORKSPACE (su fila de "Activo") el nivel de requisitos de
 * una etapa, cuántas reuniones tiene el funnel y si la etapa exige datos de venta.
 * Para el funnel DEFAULT devuelve EXACTAMENTE lo que codificaba NIVEL (2 reuniones,
 * venta = 'ganado'); para funnels de 1 reunión / sin reunión / con etapas custom,
 * lo correcto (así el worklist "Datos sin marcar" no pide una R2 que no existe ni
 * deja de validar las etapas custom). Etapas fuera del pipeline (nutrición/salidas)
 * → nivel 0 (solo higiene), igual que antes.
 */
export function funnelReqInfo(pipeline: PipelineStageLite[], stageKey: string): { nivel: number; numReuniones: number; esVenta: boolean } {
  // `reunionesDe` y no `etapasDeReunion`: acá el pipeline es el del workspace tal
  // cual, y uno sin reuniones tiene que dar numReuniones = 0 (si cayera al funnel
  // por defecto, el worklist pediría una R1/R2 que ese funnel no tiene).
  const reuniones = reunionesDe(pipeline);
  const numReuniones = reuniones.length;
  const s = pipeline.find((p) => p.key === stageKey);
  if (!s) return { nivel: NIVEL[stageKey] ?? 0, numReuniones, esVenta: stageKey === 'ganado' };
  if (s.kind === 'reunion') return { nivel: 2 * reuniones.indexOf(stageKey) + 1, numReuniones, esVenta: false };
  if (s.kind === 'pago') return { nivel: 2 * numReuniones, numReuniones, esVenta: false };
  if (s.kind === 'cierre') return { nivel: 2 * numReuniones + 1, numReuniones, esVenta: true };
  return { nivel: 0, numReuniones, esVenta: false };
}

/**
 * Pasos FALTANTES (en orden de wizard) para poder mover un lead a `stageKey`.
 * Acumulativo: cada nivel arrastra los requisitos de los anteriores.
 */
export function stepsForStage(stageKey: string, v: StageReqValues): Step[] {
  const steps: Step[] = [];

  // Salidas terminales: perdido/descal piden motivo; noresp no pide nada.
  if (stageKey === 'perdido' || stageKey === 'descal') {
    // `motivo_perdida` es UNA columna y un lead se puede perder DOS veces (se
    // recupera, vuelve al pipeline, se vuelve a perder). Mientras el corte miró
    // solo "¿hay texto?", la segunda pérdida se registraba con el motivo de la
    // primera: nadie repreguntaba y el dato viejo pasaba por nuevo.
    //
    // La distinción no está en el valor sino en el MOVIMIENTO, y por eso hace
    // falta la etapa de origen:
    //   · ENTRA ahora a la salida (etapaActual ≠ stageKey) → el motivo tiene que
    //     ser el de AHORA (`motivoNuevo`); el heredado no cuenta.
    //   · YA estaba ahí (o el caller no sabe de dónde viene: `etapaActual`
    //     undefined) → el motivo cargado alcanza. Esto es lo que mantiene a
    //     "Completar datos" (faltantesDeLead, que evalúa la etapa ACTUAL y no
    //     pasa etapaActual) sin reclamarle el motivo a todo lead ya perdido.
    const entrando = !!v.etapaActual && v.etapaActual !== stageKey;
    const motivoValido = entrando ? v.motivoNuevo : (v.motivoNuevo ?? v.motivo);
    if (!motivoValido?.trim()) {
      steps.push({ id: 'motivo', label: stageKey === 'perdido' ? 'Motivo de la pérdida' : 'Motivo de la descalificación' });
    }
    return steps;
  }
  if (stageKey === 'noresp') return steps;

  // Nivel/venta del funnel: si el caller pasa la info del funnel del workspace, la
  // usamos; si no, caemos al funnel DEFAULT (NIVEL + 2 reuniones + venta='ganado').
  const nivel = v.nivel ?? NIVEL[stageKey] ?? 0;
  const mTotal = v.numReuniones ?? 2;
  const esVenta = v.esVenta ?? (nivel >= 5);
  const hayFathom = !!v.hasFathomUrl || !!v.fathomOmitido || v.grabable === false;

  // ── Reunión 1 (solo si el funnel tiene al menos 1 reunión) ──
  if (nivel >= 1 && mTotal >= 1 && !v.sinR1) {
    if (!v.fechaJ1?.trim()) steps.push({ id: 'fechaJ1', label: 'Fecha de la Reunión 1' });

    // ── R1 completa (la fecha ya pasó, o la etapa lo implica) ──
    const r1DebeEstarCompleta = nivel >= 3 || (nivel >= 1 && yaPaso(v.fechaJ1, v.hoyISO, v.atJ1));
    if (r1DebeEstarCompleta) {
      if (v.asistioJ1 == null) steps.push({ id: 'asistenciaR1', label: 'Asistencia a la Reunión 1' });
      // "¿Era calificado?" no se pregunta al cerrar (Ganado/venta): un cierre YA
      // implica que calificaba. Sí se pregunta en etapas previas (agendaj2/facturando).
      if (v.asistioJ1 !== false && v.calificado == null && !esVenta) steps.push({ id: 'calificado', label: '¿Era lead calificado?' });
      if (v.asistioJ1 !== false && !hayFathom) steps.push({ id: 'fathomR1', label: 'Link de Fathom (R1)' });
      // Closer: quien corrió la R1.
      if (v.asistioJ1 !== false && v.closer !== undefined && !v.closer?.trim()) steps.push({ id: 'closer', label: 'Closer asignado' });
    }
  }

  // ── Reunión 2 (solo si el funnel tiene 2 reuniones) ──
  if (nivel >= 1 && mTotal >= 2 && !v.sinR1 && !v.sinR2) {
    if (nivel >= 3 && !v.fechaJ2?.trim()) steps.push({ id: 'fechaJ2', label: 'Fecha de la Reunión 2' });

    const r2DebeEstarCompleta = nivel >= 4 || (nivel >= 3 && yaPaso(v.fechaJ2, v.hoyISO, v.atJ2));
    // Etapas que exigen la R2 COMPLETA (facturando/ganado, nivel>=4) piden la
    // asistencia/fathom aunque todavía no haya fecha: el wizard la carga en el
    // mismo paso. Sin esto, la asistencia quedaba fuera de los pasos (fecha aún
    // nula al montar) pero el server la exigía después → el movimiento fallaba.
    if (r2DebeEstarCompleta && (v.fechaJ2 || nivel >= 4)) {
      if (v.asistioJ2 == null) steps.push({ id: 'asistenciaR2', label: 'Asistencia a la Reunión 2' });
      if (v.asistioJ2 !== false && !hayFathom && !steps.some((s) => s.id === 'fathomR1')) {
        steps.push({ id: 'fathomR2', label: 'Link de Fathom (R2)' });
      }
    }
  }

  // ── Venta — Deal Details COMPLETO (etapa de cierre del funnel) ──
  if (esVenta) {
    // Una venta RECURRENTE guarda su importe en `suscripcion_monto_usd` (el MRR) y
    // deja `monto_cierre_usd` en null. Mirando solo `monto`, un cierre por
    // suscripción quedaba bloqueado con el importe cargado y A LA VISTA en el
    // resumen del wizard ("Suscripción · $40/mes"), sin ninguna salida: el paso
    // que lo pedía era el mismo que ya se había contestado.
    if (!(Number(v.monto) > 0) && !(Number(v.suscripcionMonto) > 0)) steps.push({ id: 'monto', label: 'Monto de cierre' });
    if (v.tienePlan === false) steps.push({ id: 'plan', label: 'Plan de pagos' });
    if (v.dealServicioOk === false) steps.push({ id: 'dealServicio', label: 'Servicio del cierre' });
    if (v.dealPromesaOk === false) steps.push({ id: 'dealPromesa', label: 'Promesa del cierre' });
    if (v.dealFiscalOk === false) steps.push({ id: 'dealFiscal', label: 'Datos fiscales del cliente' });
    if (v.dealFiscalDocOk === false) steps.push({ id: 'dealFiscalDoc', label: 'Documento fiscal del cliente' });
    if (v.dealObligacionesOk === false) steps.push({ id: 'dealObligaciones', label: 'Obligaciones del cierre' });
    if (v.comprobantesFaltantes && v.comprobantesFaltantes > 0) {
      steps.push({ id: 'comprobante', label: v.comprobantesFaltantes === 1 ? 'Comprobante de pago' : `Comprobantes de pago (${v.comprobantesFaltantes})` });
    }
  }

  // ── Respuestas del formulario de Calendly R2 (si hubo R2) ──
  // ⚠️ «Respuestas de Calendly (R2)» NO se pide más: es un pendiente IMPOSIBLE de
  // resolver desde la app. Las respuestas las escribe quien agenda, en el
  // formulario de Calendly, y si no las completó ahí no hay ninguna pantalla acá
  // que lo arregle. Medido: 20 de los 31 leads con R2 lo tenían clavado, y se
  // exigía hasta en etapas que no tienen R2.
  //
  // El dato se sigue LEYENDO cuando llega (`r2RespuestasOk` sigue en el tipo y lo
  // usa la ficha): lo que se saca es exigirlo como tarea.

  // ── Higiene (SIEMPRE, cualquier etapa activa/nutrición) — nunca gatea mover ──
  // Setter: cualquier lead que ya se está trabajando (no el 'lead' crudo del form).
  if (stageKey !== 'lead' && v.setter !== undefined && !v.setter?.trim()) steps.push({ id: 'setter', label: 'Setter asignado' });
  if (v.empresa !== undefined && !v.empresa?.trim()) steps.push({ id: 'empresa', label: 'Empresa' });
  if (v.telefono !== undefined && !v.telefono?.trim()) steps.push({ id: 'telefono', label: 'Teléfono de contacto' });

  return steps;
}

/** Compat: lista de etiquetas faltantes ([] = se puede mover). */
export function missingForStage(stageKey: string, v: StageReqValues): string[] {
  return stepsForStage(stageKey, v).map((s) => s.label);
}

/**
 * Orden canónico de los pasos — el MISMO que produce `stepsForStage`.
 *
 * Existe para poder FUSIONAR dos listas de faltantes (la que trae el worklist y la
 * que el server va a exigir al confirmar) sin que el wizard quede preguntando en
 * un orden raro: primero la reunión, después la venta, la higiene al final.
 */
const ORDEN: StepId[] = [
  'fechaJ1', 'asistenciaR1', 'calificado', 'fathomR1', 'closer',
  'fechaJ2', 'asistenciaR2', 'fathomR2',
  'monto', 'plan',
  'dealServicio', 'dealPromesa', 'dealFiscal', 'dealFiscalDoc', 'dealObligaciones', 'comprobante',
  'r2Respuestas', 'motivo', 'setter', 'empresa', 'telefono',
];

/**
 * Une varias listas de pasos en UNA sola, sin repetidos y en el orden canónico.
 *
 * El wizard tiene que pedir TODO lo que el server va a exigir. Cuando las dos
 * listas se calculan por caminos distintos (el worklist filtra por
 * `pendientes_ignorados`, el server no) la única salida sana es preguntar la
 * UNIÓN: pedir de más se resuelve contestando; pedir de menos termina en un
 * error críptico después de completar todo el formulario.
 */
export function unirPasos(...listas: Array<readonly Step[] | null | undefined>): Step[] {
  const porId = new Map<StepId, Step>();
  for (const lista of listas) {
    for (const s of lista ?? []) if (!porId.has(s.id)) porId.set(s.id, s);
  }
  const idx = (id: StepId) => { const i = ORDEN.indexOf(id); return i === -1 ? ORDEN.length : i; };
  return [...porId.values()].sort((a, b) => idx(a.id) - idx(b.id));
}

/**
 * Steps que el wizard "Solucionar" (StageMoveDialog en modo "Completar datos")
 * resuelve en UNA sola pasada: reunión/venta + higiene + Deal Details (manual o
 * con IA) + documento fiscal (subir/omitir) + comprobante (omitir) + Respuestas
 * de Calendly R2 (búsqueda automática o motivo de agenda externa). Ya NO se
 * deriva a ninguna tab: TODO se completa en el wizard.
 */
export const WIZARD_STEP_IDS: ReadonlySet<StepId> = new Set<StepId>([
  'fechaJ1', 'asistenciaR1', 'calificado', 'fathomR1',
  'fechaJ2', 'asistenciaR2', 'fathomR2', 'monto', 'plan', 'motivo',
  'setter', 'closer', 'empresa', 'telefono',
  'dealServicio', 'dealPromesa', 'dealFiscal', 'dealObligaciones', 'dealFiscalDoc',
  'comprobante', 'r2Respuestas',
]);

/** ¿Hay al menos un dato que el wizard pueda resolver? Con la pasada única, es
 *  true siempre que haya faltantes (el wizard sabe resolver todos los tipos). */
export const hayPasoDeWizard = (steps: Step[]): boolean => steps.some((s) => WIZARD_STEP_IDS.has(s.id));

/** Steps que se completan en una tab de la ficha (no en el wizard) y en cuál. */
const STEP_TAB: Partial<Record<StepId, 'cobranza' | 'reuniones'>> = {
  dealServicio: 'cobranza', dealPromesa: 'cobranza', dealFiscal: 'cobranza',
  dealFiscalDoc: 'cobranza', dealObligaciones: 'cobranza', comprobante: 'cobranza',
  r2Respuestas: 'reuniones',
};

/** La tab de Editar donde se resuelve el primer step no-wizard (o null si todo es wizard). */
export function tabDeSolucion(steps: Step[]): 'cobranza' | 'reuniones' | null {
  for (const s of steps) { const t = STEP_TAB[s.id]; if (t) return t; }
  return null;
}
