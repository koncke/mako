// =============================================================================
// Las reuniones CON FECHA en el período, una por una y con nombre, según su asistencia: las que nadie marcó
// (`asistio_jN` NULL), los no-show (`false`) o las que se hicieron (`true`). Lo que lee `reuniones_por_asistencia`
// (lib/api-mako/areas/metricas.*). Puro: lo prueban los tests sin base.
//
// Joan (Código Inmobiliario, ws13, 26/10/2026) pidió «pasame los no show» y «el nombre y apellido de cada uno de los que
// quedaron sin marcar», y MaKo contestó que «no se lista nominalmente»: había el número (`metricas_negocio`) y ninguna
// lectura con los nombres.
//
// ⚠️ LA MISMA CUENTA QUE `metricas_negocio`: `estadoDeAsistencia` es la que usa también lib/metricas-negocio.ts, y la fecha
// DATE va dentro del período tal cual. Una reunión de HOY sin marcar todavía puede no haber pasado: cuenta igual que allá
// (va con `es_hoy`). Si la lista y el número contaran distinto, MaKo daría dos cifras para lo mismo.
// =============================================================================

export type EstadoAsistencia = 'realizada' | 'noshow' | 'sin_marcar';

/** `asistio_jN` tiene TRES estados: un NULL no es «no vino», es «nadie lo marcó todavía» (lib/metricas-negocio.ts). */
export function estadoDeAsistencia(asistio: boolean | null | undefined): EstadoAsistencia {
  return asistio === true ? 'realizada' : asistio === false ? 'noshow' : 'sin_marcar';
}

/** Lo que se pide (el parámetro `asistencia`) → el estado. */
export const ASISTENCIAS = { sin_marcar: 'sin_marcar', no_show: 'noshow', asistio: 'realizada' } as const satisfies Record<string, EstadoAsistencia>;
export type Asistencia = keyof typeof ASISTENCIAS;
export const esAsistencia = (x: unknown): x is Asistencia => typeof x === 'string' && x in ASISTENCIAS;

export type FilaReunionLead = {
  id: number;
  nombre: string | null;
  fecha_junta_1: string | null;
  asistio_j1: boolean | null;
  fecha_junta_2: string | null;
  asistio_j2: boolean | null;
  closer?: string | null;
};

export type ReunionDelPeriodo = { lead_id: number; nombre: string; reunion: 'R1' | 'R2'; fecha: string; es_hoy?: true; closer: string | null };

/** Las DATE se comparan tal cual (no tienen zona: convertirlas sería inventarle una). */
const dentro = (f: string | null | undefined, desde: string, hasta: string): string | null => {
  const d = f ? f.slice(0, 10) : null;
  return d && d >= desde && d <= hasta ? d : null;
};

export function reunionesPorAsistencia(
  filas: readonly FilaReunionLead[],
  o: { desde: string; hasta: string; hoy: string; asistencia: Asistencia; reunion?: 'R1' | 'R2' | null },
): ReunionDelPeriodo[] {
  const busco = ASISTENCIAS[o.asistencia];
  const out: ReunionDelPeriodo[] = [];
  for (const f of filas) {
    const nombre = f.nombre?.trim() || `Lead #${f.id}`;
    const pares: Array<['R1' | 'R2', string | null, boolean | null]> = [['R1', f.fecha_junta_1, f.asistio_j1], ['R2', f.fecha_junta_2, f.asistio_j2]];
    for (const [reunion, fecha, asistio] of pares) {
      if (o.reunion && o.reunion !== reunion) continue;
      const d = dentro(fecha, o.desde, o.hasta);
      if (!d || estadoDeAsistencia(asistio) !== busco) continue;
      out.push({ lead_id: f.id, nombre, reunion, fecha: d, ...(d === o.hoy ? { es_hoy: true as const } : {}), closer: f.closer?.trim() || null });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Tope de nombres en la respuesta: el total va siempre entero. */
export const TOPE_LISTA_REUNIONES = 200;

const NOMBRE_EN_METRICAS: Readonly<Record<Asistencia, string>> = { sin_marcar: 'reuniones sin marcar', no_show: 'no-shows', asistio: 'reuniones realizadas' };

export function salidaPorAsistencia(
  lista: readonly ReunionDelPeriodo[],
  o: { desde: string; hasta: string; zona: string; contadoA: string; asistencia: Asistencia },
) {
  return {
    periodo: { desde: o.desde, hasta: o.hasta }, zona: o.zona, asistencia: o.asistencia,
    // La hora de la cuenta: si el equipo marca reuniones entre dos preguntas, el número cambia y hay que poder decir por qué
    // (Joan, 26/10/2026: 25 no-shows y 14 sin marcar a las 16:15, y 28 y 10 a las 16:26; en el medio se marcaron 4).
    contado_a: o.contadoA,
    total: lista.length,
    r1: lista.filter((x) => x.reunion === 'R1').length,
    r2: lista.filter((x) => x.reunion === 'R2').length,
    reuniones: lista.slice(0, TOPE_LISTA_REUNIONES),
    ...(lista.length > TOPE_LISTA_REUNIONES ? { faltan_en_la_lista: lista.length - TOPE_LISTA_REUNIONES } : {}),
    nota: `Es la misma cuenta que «${NOMBRE_EN_METRICAS[o.asistencia]}» (reuniones 1 y 2) de metricas_negocio para el mismo período.${o.asistencia === 'sin_marcar' ? ' Una de hoy (es_hoy) puede no haber pasado todavía. Para marcarla: marcar_asistencia_reunion.' : ''}`,
  };
}
