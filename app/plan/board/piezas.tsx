'use client';

// =============================================================================
// piezas — lo chico que comparten el tablero y las tablas
// =============================================================================
// Salió de `BoardShell` cuando las vistas de TABLA (proyectos y kanban) necesitaron las
// mismas dos cosas que ya usaban las tarjetas. Es «una cosa, un lugar»: la alternativa era
// importar desde `BoardShell` —que importa las tablas— o dibujar un segundo triangulito
// rojo parecido, que es cómo se termina con dos avisos que no significan lo mismo.
// =============================================================================

import type { CSSProperties } from 'react';
import type { BoardTask } from './types';

const MONO = "'Geist Mono', monospace";

/** Progreso agregado de un proyecto (promedio del avance de sus tareas). */
export function projProgress(tasks: BoardTask[], labelId: string): { pct: number; total: number; done: number } {
  const suyas = tasks.filter((t) => t.labels.includes(labelId));
  if (!suyas.length) return { pct: 0, total: 0, done: 0 };
  return { pct: Math.round(suyas.reduce((s, t) => s + t.progress, 0) / suyas.length), total: suyas.length, done: suyas.filter((t) => t.progress >= 100).length };
}

/**
 * Aviso rojo tintineante (falta deadline/checklist). En la preview va al lado de la
 * prioridad y es clickeable (abre el wizard); en el detalle, al lado del label.
 *
 * ⚠️ Es TAMBIÉN la forma de decir «esto no tiene fecha»: «no pongas "Sin deadline" cuando
 * ya existe un signo de warning que utilizamos en esos casos» (22/09/2026).
 *
 * ⚠️ Pero es la ALARMA, no el hueco. El triangulito parpadea: dice «esto es un riesgo».
 * En una lista densa, donde la mitad de las filas no tiene fecha todavía, eso es una
 * pantalla titilando. Para decir sólo «el campo está vacío» está el GUION de
 * `LineaDeadline` (25/09/2026). Ninguno de los dos escribe «Sin deadline»: lo que no se
 * lee, estorba.
 */
export function WarnMark({ title, onClick, size = 15, blink = true }: { title: string; onClick?: (e: import('react').MouseEvent) => void; size?: number; blink?: boolean }) {
  return (
    <span title={title} aria-label={title} role={onClick ? 'button' : undefined} onClick={onClick}
      style={{ display: 'inline-flex', flex: 'none', color: blink ? 'var(--bad)' : 'var(--faint)', cursor: onClick ? 'pointer' : 'default', animation: blink ? 'makoWarnBlink 1s ease-in-out infinite' : 'none' }}>
      <style>{'@keyframes makoWarnBlink{0%,100%{opacity:1}50%{opacity:.2}}'}</style>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    </span>
  );
}

// ── el tiempo, como se lee en una tabla ──────────────────────────────────────────────
// «No me dice cuándo es el deadline, cuánto me falta, nada de eso tengo claridad en la
// vista principal» (22/09/2026). Las tres cosas salen de acá para que digan lo mismo en
// las dos tablas.

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * «mié 24 sep» a partir de un ISO.
 *
 * ⚠️ Se parsea a mano y NO con `new Date(iso)`: un `YYYY-MM-DD` pelado lo interpreta como
 * UTC medianoche, así que en cualquier zona al oeste de Greenwich el día que muestra es el
 * ANTERIOR. Un deadline corrido un día es exactamente el error que no se ve.
 */
export function fechaConDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} ${MESES[m - 1]}`;
}

/** Días entre hoy y un ISO. Negativo = atrasado. Por la misma razón, sin `Date(iso)`. */
export function diasHasta(iso: string, hoy: string): number {
  const dias = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  return dias(iso) - dias(hoy);
}

/** «faltan 4 días» · «vence hoy» · «5 días atrasado», con su color. */
export function plazoTexto(dias: number): { texto: string; color: string; fuerte: boolean } {
  if (dias < 0) return { texto: `${-dias} día${dias === -1 ? '' : 's'} atrasado`, color: 'var(--bad)', fuerte: true };
  if (dias === 0) return { texto: 'vence hoy', color: 'var(--bad)', fuerte: true };
  if (dias === 1) return { texto: 'falta 1 día', color: 'var(--warn, #C8870C)', fuerte: true };
  if (dias <= 7) return { texto: `faltan ${dias} días`, color: 'var(--warn, #C8870C)', fuerte: false };
  return { texto: `faltan ${dias} días`, color: 'var(--faint)', fuerte: false };
}

const SIN_FECHA = 'Falta el deadline';

/**
 * LA FECHA CON SU PLAZO: «◷ vie 24 jul · 62 días atrasado».
 *
 * Una pieza y no cuatro parecidas. El 24/09/2026 el dueño pidió que la tarjeta del Kanban
 * dijera lo mismo que la del proyecto —«me gusta este formato, que también dice los días
 * faltantes y atrasados»— y lo que había ahí era `deadline.slice(5)`: **«09-25»**, que no
 * dice el día de la semana, no dice el año y sobre todo NO DICE SI YA SE VENCIÓ. Una fecha
 * sola obliga a hacer la cuenta; lo que se lee de un vistazo es el plazo.
 *
 * ⚠️ `hoy` viaja como PROP y no se calcula acá. Es la misma razón por la que `fechaConDia`
 * parsea el ISO a mano: la fecha de hoy depende de la zona horaria de la máquina, y este
 * repo ya paga que eso se resuelva en un solo lugar.
 *
 * SIN FECHA dibuja un GUION: «un guion que justamente muestre que el campo no está
 * completado» (25/09/2026). No escribe «Sin deadline» —eso es texto que nadie lee— y no
 * parpadea: el triangulito de `WarnMark` es la ALARMA, esto es el hueco.
 */
export function LineaDeadline({ iso, hoy, tam = 10.5, mono = true, color = 'var(--faint)', plazo = true, style }: {
  /** Vacío = el campo no está completado: se dibuja el guion. */
  iso: string | null | undefined; hoy: string;
  tam?: number;
  /** false = tipografía de texto (el detalle), donde esto se lee como una frase. */
  mono?: boolean;
  color?: string;
  /**
   * `true` escribe el plazo al lado («· faltan 5 días»).
   * `false` = sólo la fecha, para listas densas donde el plazo empujaría el título.
   *
   * ⚠️ NO HAY UNA VARIANTE QUE TIÑA LA FECHA EN VEZ DE ESCRIBIR EL PLAZO. Se escribió el
   * 25/09/2026 y se sacó el mismo día sin haber tenido nunca un call site: donde el plazo
   * va como COLOR es en la tabla, y ahí la celda es un `<input type=date>` editable que
   * esta pieza no puede dibujar (`CeldaFecha`, Tablas.tsx). O sea que habrían quedado dos
   * implementaciones del mismo código de colores y sólo una viva — la forma exacta en que
   * dos copias divergen. Si algún día hace falta acá, la escala sale de `plazoTexto`.
   */
  plazo?: boolean;
  style?: CSSProperties;
}) {
  // El guion sale ANTES de cualquier cuenta de fechas: sin ISO no hay plazo que calcular.
  if (!iso) return (
    <span title={SIN_FECHA} aria-label={SIN_FECHA}
      style={{ display: 'inline-flex', flex: 'none', fontFamily: mono ? MONO : undefined, fontSize: tam, color: 'var(--faint)', ...style }}>—</span>
  );

  const p = plazo ? plazoTexto(diasHasta(iso, hoy)) : null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, fontFamily: mono ? MONO : undefined, fontSize: tam, color, ...style }}>
      {/* El que CEDE es la FECHA. Si el ancho no alcanza, lo que no se puede perder es
          «62 días atrasado»: la fecha se puede mirar en el detalle, el atraso no se
          deduce de nada. Por eso la fecha se achica 999 veces más rápido que el plazo:
          es prioridad, no reparto proporcional (con `flex: 0 1 auto` en los dos el flex
          achica MÁS al más largo, que acá es justo el que no puede ceder). */}
      <span style={{ flex: '0 999 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>◷ {fechaConDia(iso)}</span>
      {/* Y el plazo cede ÚLTIMO, pero cede. El valor más largo del conjunto no es «faltan
          5 días»: es el atraso, que crece sin tope («999 días atrasado», 17 caracteres
          contra los 10 fijos de la fecha). Con `flex: none` + `nowrap` esa fila no entraba
          en ningún ancho — empujaba la fila entera en vez de recortarse. */}
      {p && <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: p.color, fontWeight: p.fuerte ? 700 : 500, whiteSpace: 'nowrap' }}>· {p.texto}</span>}
    </span>
  );
}
