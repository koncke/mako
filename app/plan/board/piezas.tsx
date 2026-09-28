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
// El rotulo y el predicado de una tarea RECURRENTE salen del modulo de datos, no de acá:
// «una cosa, un lugar». Nadie escribe `t.recurrente` suelto en una pantalla — si mañana
// la recurrencia deja de ser un booleano, cambia un archivo y no once.
// (El modulo NO lleva `server-only` a proposito, justamente para que lo pueda importar
// un `'use client'` como éste.)
import { ROTULO_RECURRENTE, esRecurrente } from '@/lib/plan-recurrentes';

const MONO = "'Geist Mono', monospace";

// ── la geometría del detalle ─────────────────────────────────────────────────────────
// ⚠️ ESTOS TRES NÚMEROS ESTÁN ATADOS Y POR ESO VIVEN JUNTOS. La tabla de tareas de un
// proyecto se dibuja adentro de la columna PRINCIPAL del mismo modal que hospeda la
// columna derecha, así que el ancho de una sale de restar el de la otra. Escrito en dos
// archivos, eso se desincroniza al primer ajuste — y se desincronizó: el 25/09/2026 la
// columna derecha pasó de 236 a 264 en `BoardShell` y `Tablas` siguió calculando su
// `minWidth` contra 236, con lo cual «entra sin barra horizontal» quedó medido contra un
// ancho que ya no existía. `Tablas.tsx` no puede importar de `BoardShell` (BoardShell
// importa las tablas), y para eso existe este archivo.

/** El `maxWidth` del modal de tarea y del de proyecto. Los dos, el mismo. */
/**
 * El ancho del detalle de un proyecto y del de una tarea.
 *
 * ⚠️ PASÓ DE 820 A 1180 EL 28/09/2026, a pedido: «haz el detail de proyectos y tareas
 * más ancho, entonces entran mejor todos los textos». Con 820 la columna izquierda se
 * quedaba en ~500 px —la derecha son 264 fijos más los paddings— y los títulos de la
 * tabla de tareas se partían en dos renglones con puntos suspensivos. Con 1180 son
 * ~860: el mismo alto de modal muestra casi el doble de texto por renglón.
 *
 * ⚠️ Y LA TABLA SE AGRANDA SOLA: `ANCHO_TABLA_EN_PROYECTO` se deriva de acá, así que
 * no hay un segundo número que mover. Ése era el punto de que fuera una resta y no
 * una constante.
 */
export const MODAL_DETALLE = 1180;

/**
 * EL ANCHO DE LA COLUMNA DERECHA DE LOS DOS DETALLES — uno solo para la tarea y para el
 * proyecto, que hasta el 25/09/2026 eran 280 y 236: dos pantallas que muestran lo mismo
 * no pueden verse distinto.
 *
 * «Que la sidebar derecha sea un poco más angosta» (25/09/2026). El número NO se elige a
 * ojo: lo fija el formulario que abre el LÁPIZ de `DependenciasBloque`, que ahora vive en
 * esta columna en las dos pantallas. (Ese botón fue «+ Agregar» hasta el 25/09/2026 y pasó
 * a ser el mismo lápiz que «PROYECTOS ✎»; el formulario que abre, y por lo tanto el NÚMERO,
 * no cambiaron.) El elemento más ancho de ahí adentro es el botón
 * «Sí — no se puede empezar antes» (≈199px con su padding, a 12.5px), y el ancho útil
 * dentro del formulario es `COL_DER − 36` (el padding de la columna) `− 26` (el borde y
 * el padding del propio formulario). Con 264 quedan 202: entra.
 *
 * ⚠️ Y desde que esos dos botones van con `flex-wrap`, quedarse corto ya no parte una
 * palabra en dos: lo peor que puede pasar es una etiqueta en dos renglones. La red es el
 * `wrap`; esto es la medida.
 *
 * ⚠️ TOCARLO MUEVE `ANCHO_TABLA_EN_PROYECTO`, que es justo lo que se quiere: subirlo le
 * come ancho al título de las tareas, bajarlo se lo devuelve.
 */
export const COL_DER = 264;

/**
 * Lo que le queda a la TABLA DE TAREAS adentro del detalle de un proyecto. Es una RESTA,
 * no una medición en pantalla: un layout que se auto-mide tiene que acertar siempre, uno
 * fijo no tiene casos (AGENTS.md).
 *
 *   820  el modal (`MODAL_DETALLE`, border-box)
 *   − 2  su borde
 *   −264 la columna derecha (`COL_DER`, que ya incluye su `borderLeft`)
 *   − 44 el padding de la columna principal (`20px 22px`)
 *   − 9  la barra de scroll VERTICAL de esa columna, que aparece sí o sí: adentro van el
 *        doc, el avance, la tabla, las notas y el historial (9px, `app/globals.css`)
 *   − 2  el borde de la caja de la tabla (`cajaStyle`)
 *   − 3  colchón, porque con el zoom puesto los anchos son fraccionarios
 *
 * ⚠️ ESTO ES UN TECHO, NO EL PISO DE LA TABLA — y cambió el 25/09/2026, después de que la
 * barra horizontal volviera con la tabla declarando exactamente este número. Declarar como
 * piso el ancho DISPONIBLE no deja margen para nada: el zoom achica el modal, una palabra
 * más larga estira su columna, un borde nuevo suma 2px, y la barra reaparece «sin que nadie
 * tocara nada». El piso lo declara la tabla como la SUMA DE LO QUE SUS COLUMNAS PIDEN
 * (`ANCHO_MINIMO`, en Tablas.tsx: 444 adentro de un proyecto) y usa este número sólo para
 * toparse: `Math.min(ANCHO_MINIMO, ANCHO_TABLA_EN_PROYECTO)`. Los 52px de diferencia son el
 * aire, y son la razón por la que no hay barra.
 *
 * ⚠️ EL QUE CEDE ES EL TÍTULO, y es una decisión, no un descuido. «Intenta evitar al MÁXIMO
 * el scroll… pero que se siga entendiendo todo» (25/09/2026) son dos pedidos que acá se
 * cruzan, y el corte se eligió del lado de no scrollear: el título se recorta con «…» en
 * dos líneas y el texto entero sigue en su `title`.
 *
 * ⚠️ SI EL TÍTULO QUEDA DEMASIADO CORTO, EL LEVER ES `COL_DER` O EL PADDING DE LA COLUMNA
 * — no volver a subir este número, que es lo que reinstala la barra horizontal.
 *
 * ⚠️ Y NO SE COPIAN ACÁ LOS ANCHOS DE LAS COLUMNAS. Estuvieron («34 selección + 124
 * prioridad + 150 deadline + 76 acciones»), los cuatro se movieron en Tablas.tsx el mismo
 * día, y este comentario quedó afirmando una suma que ya no existía. Viven en `C_SEL`,
 * `C_PRIO`, `C_FECHA` y `C_ACC`, que es donde se usan.
 */
export const ANCHO_TABLA_EN_PROYECTO = MODAL_DETALLE - 2 - COL_DER - 44 - 9 - 2 - 3;

/**
 * Progreso agregado de un proyecto (promedio del avance de sus tareas CON FIN).
 *
 * ⚠️ LAS RECURRENTES NO ENTRAN AL PORCENTAJE, Y NO ES UN DETALLE DE CALCULO: es la
 * decision que el pedido de las Recurrentes obliga a tomar a proposito. Una tarea que
 * «se repite para siempre» esta clavada en 0% por definicion, asi que contarla baja el
 * avance del proyecto de forma PERMANENTE y el numero nunca puede volver a 100 — un
 * cliente al que se le atiende todas las semanas se veria peor cuanto mas se lo atiende.
 *
 * ⚠️ Y POR ESO SE DEVUELVE `recurrentes`. Sacarlas del promedio deja un caso nuevo: el
 * proyecto de PURAS recurrentes cae en `total: 0` y desde afuera es indistinguible de uno
 * vacio — pintaria «sin tareas» y «0%» sobre el proyecto mas activo del tablero, y el
 * bloque que ofrece inventarle tareas se dibujaria justo ahi. El conteo es lo que permite
 * decir «en marcha · N se repiten» en vez de mentir con un cero. Quien pinte `pct` tiene
 * que mirar `total` primero, y quien pregunte «¿este proyecto esta vacio?» tiene que
 * preguntar `total === 0 && recurrentes === 0`, que es «¿no tiene NADA?».
 */
export function projProgress(tasks: BoardTask[], labelId: string): { pct: number; total: number; done: number; recurrentes: number } {
  const suyas = tasks.filter((t) => t.labels.includes(labelId));
  const conFin = suyas.filter((t) => !esRecurrente(t));
  const recurrentes = suyas.length - conFin.length;
  if (!conFin.length) return { pct: 0, total: 0, done: 0, recurrentes };
  return { pct: Math.round(conFin.reduce((s, t) => s + t.progress, 0) / conFin.length), total: conFin.length, done: conFin.filter((t) => t.progress >= 100).length, recurrentes };
}

/**
 * El bucle: el icono de «esto se repite». Es el `repeat` de Feather, no un emoji — un 🔁
 * se dibuja distinto en cada sistema operativo y acá tiene que pesar lo mismo que el
 * tacho y que el reloj del deadline, que son SVG por la misma razon.
 */
export function IconoRepite({ size = 13 }: { size?: number }) {
  return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
}

/**
 * «Se repite» — la marca de una tarea recurrente, para donde se la ve FUERA de su vista.
 *
 * Existe por una razon concreta: una recurrente no compite en el ranking, asi que cuando
 * aparece al lado de tareas rankeadas (la lista de tareas de un proyecto, la tarjeta que
 * devuelve una busqueda, el detalle) sin prioridad y sin fecha se lee como una tarea a la
 * que se le perdieron los datos. El chip dice que el hueco es a proposito.
 *
 * ⚠️ ES GRIS Y NO TITILA. Es una CATEGORIA, no una alarma: el triangulito rojo pide una
 * accion y esto no pide ninguna. Y por eso tampoco reemplaza al `WarnMark` — en una
 * recurrente el `WarnMark` de «falta el deadline» directamente no se dibuja, porque
 * titilaria para siempre sobre algo a lo que no le falta nada.
 *
 * ⚠️ `soloIcono` para las cajas apretadas (la tarjeta del Kanban mide 249px y el titulo
 * necesita sus dos lineas). El rotulo no se pierde: viaja en el `title` y en el
 * `aria-label`, que es donde el texto no ocupa lugar.
 */
export function RepiteChip({ soloIcono = false, tam = 10.5, style }: { soloIcono?: boolean; tam?: number; style?: CSSProperties }) {
  const nombre = `${ROTULO_RECURRENTE} · no compite en el ranking ni en Prioridades`;
  return (
    <span title={nombre} aria-label={ROTULO_RECURRENTE}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--dim)', borderRadius: 6, padding: soloIcono ? '2px 4px' : '2px 7px', fontFamily: MONO, fontSize: tam, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', ...style }}>
      <IconoRepite size={tam + 2} />
      {!soloIcono && ROTULO_RECURRENTE}
    </span>
  );
}

/**
 * El hueco HONESTO de una columna que no aplica: un guion, con el porque en el `title`.
 *
 * No es lo mismo que un campo vacio. «Prioridad —» en la fila de una recurrente no dice
 * «todavia no se la puso»: dice «esto no se mide asi». Por eso la explicacion viaja
 * pegada y no hay forma de dibujarlo sin darla.
 */
export function NoAplica({ porQue }: { porQue: string }) {
  return <span title={porQue} aria-label={porQue} style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>—</span>;
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
 * pantalla titilando. Para decir sólo «el campo está vacío» está el GUION, y el guion vive
 * en `CeldaFecha` (Tablas.tsx) —no acá y no en `LineaDeadline`—, porque es un botón que al
 * tocarlo abre el `<input type=date>` de la celda. O sea que el reparto es por VISTA: en la
 * tabla, guion; en las tarjetas, donde el aviso va solo y es la única señal, este
 * triangulito. Ninguno de los dos escribe «Sin deadline»: lo que no se lee, estorba.
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
/**
 * HOY, en la zona del NAVEGADOR y en formato ISO corto.
 *
 * ⚠️ ES LA ZONA DEL QUE MIRA, y está bien: lo único que decide es cómo se PINTA un
 * plazo («vence en 3 días»), y quien lo lee está en su propia zona. Si esto decidiera
 * un valor a ESCRIBIR tendría que venir del server — una detección automática mide TU
 * máquina y no la del cliente, que es una trampa que este repo ya pagó con el acento
 * de un avatar.
 *
 * ⚠️ Vivía como const local de `BoardShell`; se mudó acá el 28/09/2026 cuando la
 * necesitó una segunda pantalla. Copiarla habría sido la segunda copia de una regla de
 * zona horaria.
 */
export const hoyISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
 * ⚠️ EL GUION DE «SIN FECHA» NO SE VE DESDE ACÁ, Y NO ES UN OLVIDO. «Un guion que
 * justamente muestre que el campo no está completado» (25/09/2026) es un pedido sobre la
 * TABLA, y ahí la celda es un `<input type=date>` editable que esta pieza no puede dibujar:
 * lo implementa `CeldaFecha` (Tablas.tsx). En las TARJETAS el hueco lo sigue diciendo el
 * `WarnMark`, porque ahí el aviso va solo y es la única señal. Los tres call sites de esta
 * pieza son tarjetas y los tres entran con `{x.deadline && …}`, así que el `!iso` de abajo
 * es una GUARDA, no una pantalla: si empieza a verse un «—» en una tarjeta, lo que cambió
 * es quién llama.
 *
 * ⛔ Y NO HAY UN `plazo={false}` («sólo la fecha, sin “faltan 5 días”»). Existió desde el
 * 25/09/2026 sin un solo call site: las tres tarjetas quieren el plazo —es lo que se pidió
 * para las tres— y la única vista que muestra la fecha pelada es la tabla, que no usa esta
 * pieza. Es el mismo motivo por el que tampoco hay una variante que TIÑA la fecha en vez de
 * escribir el plazo: sería la segunda implementación del código de colores de `CeldaFecha`,
 * con una sola viva. Si algún día hace falta, la escala sale de `plazoTexto`.
 */
export function LineaDeadline({ iso, hoy, tam = 10.5, mono = true, color = 'var(--faint)', style }: {
  /** Vacío = el campo no está completado. Ver la guarda, arriba. */
  iso: string | null | undefined; hoy: string;
  tam?: number;
  /** false = tipografía de texto (el detalle), donde esto se lee como una frase. */
  mono?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  // Sin ISO no hay plazo que calcular, así que la guarda va ANTES de cualquier cuenta.
  if (!iso) return (
    <span title={SIN_FECHA} aria-label={SIN_FECHA}
      style={{ display: 'inline-flex', flex: 'none', fontFamily: mono ? MONO : undefined, fontSize: tam, color: 'var(--faint)', ...style }}>—</span>
  );

  const p = plazoTexto(diasHasta(iso, hoy));
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
      <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: p.color, fontWeight: p.fuerte ? 700 : 500, whiteSpace: 'nowrap' }}>· {p.texto}</span>
    </span>
  );
}

/**
 * El tacho. «Simplemente puede ser un check y un ícono de tacho de basura para que sea más
 * intuitivo» (25/09/2026) — y después, sobre la tabla: «falta el botón de basura en la
 * vista de tabla».
 *
 * ⚠️ Vive acá y no en `BoardShell` por la razón del encabezado de este archivo: las tablas
 * no pueden importar de `BoardShell`, que importa las tablas. Que la tarjeta y la fila
 * dibujen el MISMO tacho es el pedido de que «un control signifique lo mismo en todos
 * lados»; con dos copias, la segunda se queda vieja.
 *
 * ⚠️ Quien lo use lleva `aria-label` Y `title`: un botón cuyo único contenido es un SVG no
 * tiene nombre accesible — el lector de pantalla anuncia «botón», a secas.
 */
export function IconoTacho({ size = 15 }: { size?: number }) {
  return <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2.6 4.2h10.8M6.4 4.2V2.9h3.2v1.3M4.3 4.2l.6 8.3a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.6-8.3M6.6 6.7v4.3M9.4 6.7v4.3" /></svg>;
}
