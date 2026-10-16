// =============================================================================
// datos-aviso — qué «dato sin marcar» AVISA, cuál se esconde, y dónde se completa
// =============================================================================
// Pedido de Martín (13/10/2026, feedback del detalle del lead, punto 1): el botón de «Datos
// sin marcar» abre un desplegable con los títulos de lo que falta; cada uno con «solucionar»
// (te lleva al dato) e «ignorar»; «todos los ignorados como también los resueltos, pasan a
// esconderse», detrás de un «Ver más»; «y es importante poder configurar que datos quiero que
// MaKo me notifique que estan sin marcar».
//
// Sin `server-only` ni `'use client'`, a propósito: lo usan el worklist del server (queries.ts),
// la ficha (el navegador) y los tests. La regla de QUÉ falta no vive acá: es `stepsForStage`
// (lib/stage-requirements.ts). Acá se decide qué se HACE con lo que falta.
//
// Tres palabras, tres cosas distintas:
//   · ignorado   → una persona dijo «no me avises de ESTE dato de ESTE lead» (leads.datos_ignorados)
//   · sin aviso  → el negocio apagó el aviso de ese TIPO de dato para todos (setting del workspace)
//   · resuelto   → la etapa lo pide y ya está cargado
// Ninguna de las tres cambia lo que exige mover de etapa: ignorar no completa nada.
// =============================================================================

import type { Step, StepId } from './stage-requirements';

/**
 * Lo que NO se puede ignorar ni apagar: la asistencia a una reunión que ya pasó. Es el lead
 * trabado esperando que alguien diga qué ocurrió, no un dato lindo de tener (la misma regla que
 * ya tenía el worklist para el «ignorar» del lead entero, mig 0109).
 */
export const NO_IGNORABLES: ReadonlySet<StepId> = new Set<StepId>(['asistenciaR1', 'asistenciaR2']);

/** Los tipos de dato que se pueden configurar, con su nombre genérico (no depende de la etapa). */
export const DATOS_AVISABLES: ReadonlyArray<{ id: StepId; label: string; grupo: 'Reuniones' | 'Venta' | 'Equipo y contacto' }> = [
  { id: 'fechaJ1', label: 'Fecha de la Reunión 1', grupo: 'Reuniones' },
  { id: 'asistenciaR1', label: 'Asistencia a la Reunión 1', grupo: 'Reuniones' },
  { id: 'calificado', label: '¿Era lead calificado?', grupo: 'Reuniones' },
  { id: 'fathomR1', label: 'Link de Fathom (R1)', grupo: 'Reuniones' },
  { id: 'fechaJ2', label: 'Fecha de la Reunión 2', grupo: 'Reuniones' },
  { id: 'asistenciaR2', label: 'Asistencia a la Reunión 2', grupo: 'Reuniones' },
  { id: 'fathomR2', label: 'Link de Fathom (R2)', grupo: 'Reuniones' },
  { id: 'monto', label: 'Monto de cierre', grupo: 'Venta' },
  { id: 'plan', label: 'Plan de pagos', grupo: 'Venta' },
  { id: 'comprobante', label: 'Comprobante de pago', grupo: 'Venta' },
  { id: 'dealServicio', label: 'Servicio del cierre', grupo: 'Venta' },
  { id: 'dealPromesa', label: 'Promesa del cierre', grupo: 'Venta' },
  { id: 'dealFiscal', label: 'Datos fiscales del cliente', grupo: 'Venta' },
  { id: 'dealFiscalDoc', label: 'Documento fiscal del cliente', grupo: 'Venta' },
  { id: 'dealObligaciones', label: 'Obligaciones del cierre', grupo: 'Venta' },
  { id: 'motivo', label: 'Motivo de la pérdida', grupo: 'Venta' },
  { id: 'closer', label: 'Closer asignado', grupo: 'Equipo y contacto' },
  { id: 'setter', label: 'Setter asignado', grupo: 'Equipo y contacto' },
  { id: 'telefono', label: 'Teléfono de contacto', grupo: 'Equipo y contacto' },
  { id: 'empresa', label: 'Empresa', grupo: 'Equipo y contacto' },
];

const IDS = new Set<string>(DATOS_AVISABLES.map((d) => d.id));

/** Una lista de ids que viene de la base o del navegador: sólo los que existen, sin repetidos. */
export function sanearIds(x: unknown): StepId[] {
  if (!Array.isArray(x)) return [];
  const out: StepId[] = [];
  for (const v of x) if (typeof v === 'string' && IDS.has(v) && !out.includes(v as StepId)) out.push(v as StepId);
  return out;
}

/** Los apagados del negocio, sin los que no se pueden apagar. */
export function sanearApagados(x: unknown): StepId[] {
  return sanearIds(x).filter((id) => !NO_IGNORABLES.has(id));
}

/**
 * Lo que de verdad AVISA (el número del renglón, el worklist, «A revisar», los avisos de MaKo).
 * Lo no ignorable avisa siempre.
 */
export function avisables(faltan: readonly Step[], ignorados: readonly string[] | null | undefined, apagados: readonly string[] | null | undefined): Step[] {
  const ign = new Set(ignorados ?? []);
  const apa = new Set(apagados ?? []);
  return faltan.filter((f) => NO_IGNORABLES.has(f.id) || (!ign.has(f.id) && !apa.has(f.id)));
}

export type EstadoDato = 'falta' | 'ignorado' | 'sin_aviso' | 'resuelto';
export type DatoDeLaFicha = Step & { estado: EstadoDato; ignorable: boolean };
/** Lo que dibuja el desplegable de la ficha. `ocultos` va detrás de «Ver más». */
export type EstadoDatos = { avisar: DatoDeLaFicha[]; ocultos: DatoDeLaFicha[] };

/**
 * Parte los datos de la etapa en lo que avisa y lo que se esconde. Orden de los ocultos: primero
 * lo que sigue faltando (ignorado, sin aviso), después lo resuelto — lo que todavía se puede
 * querer deshacer va arriba.
 */
export function partirDatos(
  faltan: readonly Step[],
  resueltos: readonly Step[],
  ignorados: readonly string[] | null | undefined,
  apagados: readonly string[] | null | undefined,
): EstadoDatos {
  const ign = new Set(ignorados ?? []);
  const apa = new Set(apagados ?? []);
  const avisar: DatoDeLaFicha[] = [];
  const pendientesOcultos: DatoDeLaFicha[] = [];
  for (const f of faltan) {
    const ignorable = !NO_IGNORABLES.has(f.id);
    if (!ignorable) { avisar.push({ ...f, estado: 'falta', ignorable }); continue; }
    if (ign.has(f.id)) pendientesOcultos.push({ ...f, estado: 'ignorado', ignorable });
    else if (apa.has(f.id)) pendientesOcultos.push({ ...f, estado: 'sin_aviso', ignorable });
    else avisar.push({ ...f, estado: 'falta', ignorable });
  }
  const yaEstan = resueltos
    .filter((r) => !faltan.some((f) => f.id === r.id))
    .map((r) => ({ ...r, estado: 'resuelto' as const, ignorable: false }));
  return { avisar, ocultos: [...pendientesOcultos, ...yaEstan] };
}

// ── El MISMO número en las tres puertas (14/10/2026) ─────────────────────────
// «N sin marcar» de la cabecera de la ficha, la fila del lead en «A revisar» y el worklist tienen que
// contar lo mismo para el mismo lead. Hasta el 14/10 no: el worklist sacaba lo del lead entero ignorado
// (`pendientes_ignorados`, mig 0109) y la empresa omitida (`empresa_omitido`), y la ficha no, así que un
// lead ignorado decía «3 sin marcar» en su cabecera y no aparecía en «A revisar». Las dos puertas pasan
// ahora por estas funciones, y tests/ficha-avisos.test.ts lo fija ejecutándolas.

/** Lo que hace falta del lead para saber qué tiene ignorado. */
export type IgnoradosDelLead = {
  datos_ignorados?: readonly string[] | null;
  pendientes_ignorados?: string | null;
  empresa_omitido?: boolean | null;
};

/** Los datos ignorables, todos (lo que no es una asistencia). */
export const IGNORABLES: readonly StepId[] = DATOS_AVISABLES.map((d) => d.id).filter((id) => !NO_IGNORABLES.has(id));

/**
 * Todo lo que el lead tiene ignorado, junto: lo ignorado dato por dato (mig 0270), el lead entero
 * ignorado antes de que existiera eso (mig 0109: cuenta como TODOS ignorados, y no se lo «despierta») y
 * la empresa omitida (la ✕ de «Ignorar empresa» en lote).
 */
export function ignoradosDelLead(l: IgnoradosDelLead): StepId[] {
  if (l.pendientes_ignorados) return [...IGNORABLES];
  const out = sanearIds(l.datos_ignorados);
  if (l.empresa_omitido && !out.includes('empresa')) out.push('empresa');
  return out;
}

/** Lo que AVISA de este lead: el número de «N sin marcar», de su fila en «A revisar» y del worklist. */
export function avisanDelLead(faltan: readonly Step[], l: IgnoradosDelLead, apagados: readonly string[] | null | undefined): Step[] {
  return avisables(faltan, ignoradosDelLead(l), apagados);
}

/** El desplegable de la ficha, con lo ignorado del lead entero. `avisar` es SIEMPRE `avisanDelLead`. */
export function partirDatosDelLead(
  faltan: readonly Step[],
  resueltos: readonly Step[],
  l: IgnoradosDelLead,
  apagados: readonly string[] | null | undefined,
): EstadoDatos {
  return partirDatos(faltan, resueltos, ignoradosDelLead(l), apagados);
}

/** Lo que se escribe en `leads` al ignorar o volver a avisar. Sólo las columnas que cambian. */
export type CambioIgnorados = { datos_ignorados: StepId[]; pendientes_ignorados?: null; empresa_omitido?: false };

/**
 * Ignorar (o volver a avisar) unos datos de UN lead: la escritura que comparten la ficha, la ✕ de «A
 * revisar» y la API de MaKo. Las asistencias no se ignoran nunca.
 *
 * ⚠️ «VOLVER A AVISAR» TIENE QUE CUMPLIR LO QUE DICE en un lead ignorado ENTERO (mig 0109) o con la empresa
 *    omitida: esos datos se dibujan como «ignorados» con su botón, y sacarlos sólo de `datos_ignorados` no
 *    cambiaba nada. Ahí el lead entero pasa a ignorado dato por dato (todos menos los que vuelven) y se
 *    limpia la marca vieja: vuelve a avisar lo que se pidió, y nada más se despierta.
 */
export function cambioDeIgnorados(l: IgnoradosDelLead, pasos: readonly StepId[], ignorar: boolean): CambioIgnorados {
  const validos = sanearIds(pasos).filter((p) => !NO_IGNORABLES.has(p));
  if (ignorar) {
    let nuevos = sanearIds(l.datos_ignorados);
    for (const p of validos) nuevos = conIgnorado(nuevos, p, true);
    return { datos_ignorados: nuevos };
  }
  const base = l.pendientes_ignorados ? [...IGNORABLES] : sanearIds(l.datos_ignorados);
  const out: CambioIgnorados = { datos_ignorados: base.filter((x) => !validos.includes(x)) };
  if (l.pendientes_ignorados) out.pendientes_ignorados = null;
  if (l.empresa_omitido && validos.includes('empresa')) out.empresa_omitido = false;
  return out;
}

/** Ignorar o dejar de ignorar UN dato: la lista nueva, sin repetidos y sin ids que no existen. */
export function conIgnorado(actual: unknown, id: StepId, ignorar: boolean): StepId[] {
  const base = sanearIds(actual).filter((x) => x !== id);
  return ignorar && !NO_IGNORABLES.has(id) ? [...base, id] : base;
}

// ── Dónde se completa cada dato ──────────────────────────────────────────────

export type TabDeDato = 'resumen' | 'reuniones' | 'cobranza';

/**
 * La tab de la ficha donde vive el campo de cada dato. El campo lleva
 * `data-recorrido={marcaDato(id)}`: «solucionar» cambia a esa tab, lo busca y lo señala.
 * Si la tab no está (un funnel sin reuniones no tiene «Reuniones») o el campo no se dibujó,
 * «solucionar» abre el asistente de «Completar datos», que sabe pedir todos.
 */
export const TAB_DE_DATO: Readonly<Record<StepId, TabDeDato>> = {
  fechaJ1: 'reuniones', asistenciaR1: 'reuniones', fathomR1: 'reuniones',
  fechaJ2: 'reuniones', asistenciaR2: 'reuniones', fathomR2: 'reuniones', r2Respuestas: 'reuniones',
  closer: 'reuniones', setter: 'reuniones',
  calificado: 'resumen', motivo: 'resumen', telefono: 'resumen', empresa: 'resumen',
  monto: 'cobranza', plan: 'cobranza', comprobante: 'cobranza',
  dealServicio: 'cobranza', dealPromesa: 'cobranza', dealFiscal: 'cobranza',
  dealFiscalDoc: 'cobranza', dealObligaciones: 'cobranza',
};

/** La marca que lleva el campo (`data-recorrido`), la misma que mira el señalador. */
export const marcaDato = (id: StepId): string => `dato-${id}`;
