'use client';

// =============================================================================
// Tablas — la MISMA información, en filas
// =============================================================================
// El pedido, textual (22/09/2026): «no puedo ver todos los proyectos de una página, las
// tarjetas ocupan muchísimo espacio», y con el zoom «se abudea el diseño». Y sobre el
// deadline: «no me dice cuándo es el deadline, cuánto me falta, nada de eso tengo claridad
// en la vista principal».
//
// ⚠️ ES OTRA OPCIÓN DE VERLO, NO UN REEMPLAZO. Su corrección, textual: «NO reemplaces lo
// que hay ahora, es otra opción de verlo». El default sigue siendo las tarjetas y el
// Kanban; esto se prende en la barra de arriba y se recuerda por navegador.
//
// Tres cosas que la tabla hace y las tarjetas no:
//  1. El DEADLINE, teñido por lo que falta (ver `CeldaFecha`).
//  2. Se ordena por deadline (click en el encabezado), no solo por prioridad.
//  3. Lo COMPLETADO se va al fondo, plegado: «un proyecto marcado completo tiene que
//     desaparecer o bajar — me queda acá».
//
// ⚠️ ES LA VISTA QUE MÁS USA. «A mí me gusta mucho más esta vista, yo la entiendo mucho
// más… esto me da mucha claridad de qué es lo que tengo que priorizar» (25/09/2026). Por
// eso la pasada de ese día fue sacar, no agregar: el mismo dato dicho una sola vez, un
// ícono en vez de una palabra, y la columna del ID afuera.
//
// ⚠️ ES TAMBIÉN LA LISTA DE TAREAS DE UN PROYECTO, y por eso `TablaTareas` es UNA sola
// para las dos pantallas: «dos pantallas que muestran lo mismo se ven igual». Lo que
// cambia entre las dos son dos props, y las dos existen para no reimplementar nada:
//   · `ocultarProyecto` — adentro de un proyecto esa columna repite el mismo nombre en
//     todas las filas, así que no se dibuja y el `minWidth` baja con ella (a
//     `ANCHO_TABLA_EN_PROYECTO`, que sale de la geometría del modal y vive en ./piezas).
//     Sin eso, la tabla declaraba 720px en una columna de ~500 y era scroll horizontal
//     SIEMPRE.
//   · `onEliminar` — el tacho de la fila. Abre la pregunta de dos botones de quien llama;
//     sin la prop, la fila no lo dibuja (un control que no se puede cumplir no se pinta).
// Quien la USA no reimplementa nada de lo que la tabla hace: ni el desplegable de las
// completadas (`FilaPlegada`, que pide que le pasen TODAS las tareas juntas), ni el tinte
// del deadline, ni el orden. Dos copias de esto divergen a la primera corrección.
// =============================================================================

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { type BoardTask, type Label, PCOLOR, PLABEL, prioFromScore } from './types';
import type { Board } from './useBoard';
import { fechaConDia, diasHasta, plazoTexto, IconoTacho, ANCHO_TABLA_EN_PROYECTO } from './piezas';
import { usePref, esUnoDe } from './prefs';
import { AccionesLote } from './AccionesLote';
import { ScoreIcon } from './guardian-form';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type OrdenProy = 'deadline' | 'score' | 'nombre' | 'avance';
type OrdenTarea = 'deadline' | 'score' | 'proyecto' | 'num';

// ── la caja de la tabla ──────────────────────────────────────────────────────────────
// El scroll horizontal vive ACÁ, en el contenido, que es donde la regla de la casa lo
// permite (una BARRA DE NAVEGACIÓN no scrollea; una tabla sí). Sin esto, con el zoom al
// 150% la tabla empuja el ancho del documento entero y se lleva puesto el header.
const cajaStyle: CSSProperties = { width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' };
// ⚠️ EL `minWidth` NO ES UNA CONSTANTE: lo pasa cada tabla, porque lo que necesita depende
// de las columnas que DIBUJA y de DÓNDE se dibuja. Los 720 de antes eran los de la tabla
// completa a lo ancho de la pantalla, y adentro del detalle de un proyecto —una columna de
// ~500px— eso era scroll horizontal SIEMPRE, con «Proyecto» cortada al medio. «Intenta
// evitar al MÁXIMO el scroll» (25/09/2026). La barra NO se esconde (`scrollbar-width: none`
// está prohibido en los dos ejes): el objetivo es que no haga falta, no taparla.
// El número de adentro de un proyecto es `ANCHO_TABLA_EN_PROYECTO` (./piezas) y NO se
// escribe acá: depende del ancho de la columna derecha del modal, que vive en otro archivo.
const tablaStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13.5 };
const thBase: CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' };
const tdBase: CSSProperties = { padding: '9px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
// 126 y no 138: un `input type=date` a 12.5px dibuja «dd/mm/aaaa» (~62px) más el ícono del
// calendario (~18px); lo demás era hueco, y ese hueco se pagaba en scroll.
const fechaInput: CSSProperties = { width: 126, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontFamily: SANS };
/** El botón de una acción de fila: un ícono, sin rótulo, con el nombre en `title`. */
const accionBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flex: 'none', padding: 0, border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer' };

function Th({ children, orden, activo, dir, onSort, ancho }: { children: ReactNode; orden?: string; activo?: boolean; dir?: 'asc' | 'desc'; onSort?: () => void; ancho?: number }) {
  if (!onSort) return <th style={{ ...thBase, width: ancho }}>{children}</th>;
  return (
    <th style={{ ...thBase, width: ancho }} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onSort} title={`Ordenar por ${orden}`}
        style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: activo ? 'var(--primary)' : 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}{activo && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

/**
 * La celda del deadline: UN solo dato —la fecha, editable— teñido por lo que falta.
 *
 * Antes decía lo mismo TRES veces: el `input`, «mié 30 sep» al lado y «faltan 5 días»
 * al final. Textual (25/09/2026): «acá dice deadline y acá dice 30 del 9, acá miércoles
 * 30 de septiembre, o sea esto es tres veces el mismo dato nada más que representado de
 * forma diferente, no me interesa verlo de forma diferente». Queda la fecha; los días que
 * faltan «lo pondría en base a un código de COLORES».
 *
 * ⚠️ El color NUNCA es el único portador: el `title` y el `aria-label` dicen el plazo en
 * palabras («mié 30 sep · faltan 5 días»), que además es lo único que lee un lector de
 * pantalla y lo único que sobrevive a un daltonismo.
 *
 * ⚠️ Y SIN FECHA VA UN GUIÓN, no un cartel ni un triángulo: «un guion que justamente
 * muestre que el campo no está completado». Reemplaza al `WarnMark` **sólo en la tabla**:
 * una columna entera de triangulitos rojos parpadeando es exactamente el ruido que esta
 * vista vino a sacar. En las tarjetas, donde el aviso va solo y es la única señal, el
 * triangulito sigue.
 */
function CeldaFecha({ iso, hoy, onSet, nombre }: { iso: string; hoy: string; onSet: (v: string) => void; nombre: string }) {
  // El guión es un BOTÓN: al tocarlo aparece el `input`. Un `input type=date` vacío dibuja
  // «dd/mm/aaaa», que es justo el texto de más que el guión vino a reemplazar.
  const [editando, setEditando] = useState(false);
  const pickerAbierto = useRef(false);
  const dias = iso ? diasHasta(iso, hoy) : null;
  const plazo = dias == null ? null : plazoTexto(dias);
  // La escala sale de `plazoTexto`, la misma que usan las tarjetas: vencido y hoy en rojo,
  // esta semana en ámbar, más lejos neutro. Lo único que se cambia es ese último tramo:
  // `--faint` sobre el dato principal de una celda lo vuelve ilegible, y «falta mucho» no
  // necesita un color propio — necesita no gritar.
  const tinta = dias == null || plazo == null ? 'var(--ink)' : dias > 7 ? 'var(--dim)' : plazo.color;
  const enPalabras = plazo ? `${fechaConDia(iso)} · ${plazo.texto}` : 'sin deadline';

  if (!iso && !editando) {
    return (
      <button type="button" onClick={() => { pickerAbierto.current = false; setEditando(true); }}
        title={`${nombre}: sin deadline`} aria-label={`${nombre}: sin deadline. Ponerle una fecha`}
        style={{ border: 'none', background: 'transparent', padding: '5px 10px', cursor: 'pointer', fontFamily: MONO, fontSize: 15, lineHeight: 1, color: 'var(--faint)' }}>—</button>
    );
  }
  return (
    <input type="date" value={iso} onChange={(e) => onSet(e.target.value)} autoFocus={editando}
      // Viniendo del guión, el calendario se abre solo: si no, el guión costaría dos
      // clicks donde antes costaba uno. `showPicker` no existe en Safari viejo y tira si
      // la llamada no cuelga de un gesto, así que va opcional y adentro de un try.
      ref={(el) => {
        if (!el || !editando || pickerAbierto.current) return;
        pickerAbierto.current = true;
        try { el.showPicker?.(); } catch { /* sin picker nativo queda el input, que igual se edita */ }
      }}
      onBlur={() => setEditando(false)}
      title={`${nombre}: ${enPalabras}`} aria-label={`Deadline de ${nombre}: ${enPalabras}`}
      style={{ ...fechaInput, color: tinta, fontWeight: plazo?.fuerte ? 700 : 500, borderColor: plazo?.fuerte ? tinta : 'var(--border)' }} />
  );
}

/**
 * COMPLETAR. Es un CHECK, y la casilla cuadrada de la primera columna SELECCIONA.
 *
 * Son dos controles distintos en la misma fila y el reclamo principal de los dos audios
 * del 25/09/2026 es que no se puedan confundir: «acá lo que falta es una checkbox, porque
 * acá selecciono pero no es… si voy a individual me falta la checkbox de completar», más
 * la regla general —«que un mismo control signifique lo mismo en toda la app»—. Por eso la
 * forma es distinta a propósito: **cuadrado = seleccionar, redondo con tilde = completar**.
 *
 * Y es un ícono sin rótulo: «un check y un tacho», no dos botones con texto. Lo que el
 * ícono no dice lo dice el `title`, que es donde el texto no ocupa lugar.
 */
function CheckHecha({ hecha, onToggle, titulo }: { hecha: boolean; onToggle: () => void; titulo: string }) {
  const texto = hecha ? `Completada — reabrir «${titulo}»` : `Marcar «${titulo}» como completada`;
  return (
    <button type="button" onClick={onToggle} title={texto} aria-label={texto} aria-pressed={hecha}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flex: 'none', padding: 0, cursor: 'pointer', borderRadius: 999, border: `1.5px solid ${hecha ? 'var(--good)' : 'var(--border-strong)'}`, background: hecha ? 'var(--good)' : 'transparent', color: hecha ? '#fff' : 'var(--faint)', fontSize: 12, lineHeight: 1 }}>✓</button>
  );
}

function Score({ score, color }: { score: number; color: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 12, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 7px 2px 6px' }}><ScoreIcon size={11} color={color} />{score}</span>;
}

function Barra({ pct, color }: { pct: number; color: string }) {
  return <span style={{ display: 'block', width: 56, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></span>;
}

/**
 * La fila que pliega lo terminado. Se ve el número; lo que hay adentro, a un click.
 *
 * ⚠️ ES UNA FILA MÁS DE LA MISMA TABLA, NO OTRA TABLA. «Que las "18 completadas"
 * simplemente sea otra fila más de una ÚNICA tabla, y al clickearlo ahí aparecen las otras
 * filas, no otra tabla» (25/09/2026). Por eso `TablaTareas` recibe TODAS las tareas
 * —abiertas y terminadas— y las parte ella: dos `<TablaTareas>` una arriba de la otra
 * dibujan dos encabezados, dos barras de acciones y dos anchos distintos para lo mismo.
 *
 * ⚠️ `cols` NO tiene default y se calcula en quien llama. Estuvo hardcodeado en 6, que era
 * cierto sólo mientras la tabla tuviera siempre las mismas seis columnas; con
 * `ocultarProyecto` son cinco, y un `colSpan` de más deja la fila desbordando la tabla.
 */
function FilaPlegada({ n, abierto, onToggle, cols, texto }: { n: number; abierto: boolean; onToggle: () => void; cols: number; texto: string }) {
  if (n === 0) return null;
  // Que se ENTIENDA como clickeable: el chevron, el conteo, el `title` que dice la acción
  // en palabras, `aria-expanded` para quien no ve el chevron, y el fondo que responde al
  // pasar por encima. Sin eso es un renglón gris que parece un encabezado apagado.
  const accion = `${abierto ? 'Ocultar' : 'Ver'} ${n} ${texto}`;
  return (
    <tr>
      <td colSpan={cols} style={{ ...tdBase, padding: 0 }}>
        <button type="button" onClick={onToggle} title={accion} aria-expanded={abierto}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--dim)'; }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', border: 'none', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '9px 12px', cursor: 'pointer' }}>
          <span aria-hidden style={{ flex: 'none', display: 'inline-block', width: 10, fontSize: 10, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .12s ease' }}>▸</span>
          <span>{n} {texto}</span>
        </button>
      </td>
    </tr>
  );
}

// ── PROYECTOS ────────────────────────────────────────────────────────────────────────

export function TablaProyectos({ filas, topProjectId, hoy, onOpen, onDeadline, labelPlural }: {
  filas: Array<{ l: Label; prog: { pct: number; total: number; done: number } }>;
  topProjectId: string | null;
  hoy: string;
  onOpen: (id: string) => void;
  onDeadline: (id: string, iso: string) => void;
  labelPlural: string;
}) {
  const [orden, setOrden] = usePref<OrdenProy>('proyectos.tabla.orden', 'deadline', esUnoDe('deadline', 'score', 'nombre', 'avance'));
  const [dir, setDir] = usePref<'asc' | 'desc'>('proyectos.tabla.dir', 'asc', esUnoDe('asc', 'desc'));
  const [verHechos, setVerHechos] = useState(false);

  const sortear = (col: OrdenProy) => {
    if (col === orden) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setOrden(col);
    // Cada columna tiene una dirección que se lee natural: la fecha más cercana primero,
    // la prioridad más alta primero. Arrancar siempre en `asc` deja la tabla al revés.
    setDir(col === 'deadline' || col === 'nombre' ? 'asc' : 'desc');
  };

  const { vivos, hechos } = useMemo(() => {
    const s = dir === 'asc' ? 1 : -1;
    const cmp = (a: { l: Label; prog: { pct: number } }, b: { l: Label; prog: { pct: number } }) => {
      if (orden === 'nombre') return s * a.l.name.localeCompare(b.l.name, 'es');
      if (orden === 'score') return s * ((a.l.score || 0) - (b.l.score || 0));
      if (orden === 'avance') return s * (a.prog.pct - b.prog.pct);
      // Por deadline: los que NO tienen van al final SIEMPRE, en las dos direcciones —
      // invertir el orden no puede hacer que lo que no tiene fecha encabece la tabla.
      const fa = a.l.deadline || '', fb = b.l.deadline || '';
      if (!fa && !fb) return (b.l.score || 0) - (a.l.score || 0);
      if (!fa) return 1;
      if (!fb) return -1;
      return s * fa.localeCompare(fb);
    };
    const orde = filas.slice().sort(cmp);
    return {
      vivos: orde.filter(({ prog }) => !(prog.total > 0 && prog.pct >= 100)),
      hechos: orde.filter(({ prog }) => prog.total > 0 && prog.pct >= 100),
    };
  }, [filas, orden, dir]);

  const fila = ({ l, prog }: { l: Label; prog: { pct: number; total: number; done: number } }, hecho: boolean) => (
    <tr key={l.id} style={{ background: hecho ? 'var(--surface-2)' : undefined }}>
      <td style={{ ...tdBase, maxWidth: 340 }}>
        <button type="button" onClick={() => onOpen(l.id)} title={`Abrir «${l.name}»`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left', maxWidth: '100%' }}>
          <span style={{ flex: 'none' }}>{l.emoji}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: l.color, fontWeight: 700, flex: 'none' }}>{l.pid}</span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: hecho ? 'line-through' : 'none', opacity: hecho ? .7 : 1 }}>{l.name}</span>
          {l.id === topProjectId && <span title="Objetivo Principal" style={{ flex: 'none' }}>🎯</span>}
        </button>
      </td>
      <td style={tdBase}><Score score={l.score} color={l.color} /></td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Barra pct={prog.pct} color={l.color} />
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{prog.done}/{prog.total}</span>
        </div>
      </td>
      <td style={tdBase}>
        <CeldaFecha iso={l.deadline || ''} hoy={hoy} nombre={`«${l.name}»`} onSet={(v) => onDeadline(l.id, v)} />
      </td>
    </tr>
  );

  return (
    <div style={cajaStyle} className="mk-scroll-x">
      {/* 600 y no 720: son 200 para el nombre + las tres columnas de ancho declarado. El
          número sale de sumar lo que las columnas necesitan, no de copiar el de al lado. */}
      <table style={{ ...tablaStyle, minWidth: 600 }}>
        <thead>
          <tr>
            <Th orden="nombre" activo={orden === 'nombre'} dir={dir} onSort={() => sortear('nombre')}>{labelPlural}</Th>
            <Th orden="prioridad" activo={orden === 'score'} dir={dir} onSort={() => sortear('score')} ancho={110}>Prioridad</Th>
            <Th orden="avance" activo={orden === 'avance'} dir={dir} onSort={() => sortear('avance')} ancho={130}>Tareas</Th>
            {/* 330 era el ancho de cuando la celda decía la fecha tres veces; 160, el de
                cuando el `input` medía 138. Con un solo dato y el input en 126, son 150. */}
            <Th orden="deadline" activo={orden === 'deadline'} dir={dir} onSort={() => sortear('deadline')} ancho={150}>Deadline</Th>
          </tr>
        </thead>
        <tbody>
          {vivos.map((f) => fila(f, false))}
          {vivos.length === 0 && hechos.length === 0 && (
            <tr><td colSpan={4} style={{ ...tdBase, textAlign: 'center', color: 'var(--faint)' }}>No hay {labelPlural.toLowerCase()} para este filtro.</td></tr>
          )}
          <FilaPlegada n={hechos.length} abierto={verHechos} onToggle={() => setVerHechos((v) => !v)} cols={4} texto={`completado${hechos.length === 1 ? '' : 's'}`} />
          {verHechos && hechos.map((f) => fila(f, true))}
        </tbody>
      </table>
    </div>
  );
}

// ── TAREAS ───────────────────────────────────────────────────────────────────────────

export function TablaTareas({ tareas, board, hoy, onOpen, onOpenProj, ask, ocultarProyecto = false, onEliminar }: {
  /** TODAS: abiertas Y terminadas. La tabla las separa sola (ver `FilaPlegada`). */
  tareas: BoardTask[];
  board: Board;
  hoy: string;
  onOpen: (id: string) => void;
  onOpenProj?: (id: string) => void;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
  /** dentro de un proyecto la columna Proyecto es siempre la misma: se esconde y la
   *  tabla baja su minWidth para no scrollear de costado. */
  ocultarProyecto?: boolean;
  /** abre la pregunta de borrar. Sin esto, la fila no dibuja el tacho. */
  onEliminar?: (id: string) => void;
}) {
  /**
   * LO SELECCIONADO. La casilla de la primera columna SELECCIONA, no completa.
   *
   * «En la vista de tabla el botón de marcar como completada no debería salir allí, porque
   * pareciera que es un botón de seleccionar varias» (23/09/2026). Y tenía razón por partida
   * doble: en una tabla, una casilla en la primera columna ES el control de selección —lo es
   * en Gmail, en Drive y en cualquier tabla— así que la lectura no era un error de nadie.
   * Lo que faltaba era que hiciera lo que parecía que hacía.
   *
   * ⚠️ Y COMPLETAR NO SE FUE: volvió como CHECK, en la última columna (`CheckHecha`).
   * Sacarlo de acá dejó la fila sin ninguna forma de cerrar una tarea, y eso se reportó al
   * mes siguiente: «si voy a individual me falta la checkbox de completar» (25/09/2026).
   * Las dos conviven porque tienen forma distinta —cuadrado selecciona, redondo completa—,
   * que es la única manera de que un mismo control signifique lo mismo en toda la app.
   */
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [ordenPref, setOrden] = usePref<OrdenTarea>('kanban.tabla.orden', 'score', esUnoDe('deadline', 'score', 'proyecto', 'num'));
  const [dir, setDir] = usePref<'asc' | 'desc'>('kanban.tabla.dir', 'desc', esUnoDe('asc', 'desc'));
  const [verHechas, setVerHechas] = useState(false);

  // ⚠️ ORDENAR POR UNA COLUMNA QUE NO SE DIBUJA ES OFRECER UNA INCÓGNITA — es la misma
  // razón por la que el tooltip de «Tarea» dice «creación» desde que el #ID salió de la
  // fila. La preferencia se guarda por navegador y es la MISMA de la vista principal, así
  // que adentro de un proyecto puede llegar puesta en «proyecto», que ahí es una columna
  // escondida y un criterio constante. Cae al default de la tabla, sin pisar la
  // preferencia: al volver a la vista completa, su orden sigue donde lo dejó.
  const orden: OrdenTarea = ocultarProyecto && ordenPref === 'proyecto' ? 'score' : ordenPref;
  // Con «Proyecto» escondida son cinco columnas, no seis. Se calcula UNA vez y lo usan la
  // fila plegada y el cartel de «no hay tareas»: un `colSpan` hardcodeado es lo que hacía
  // desbordar la fila de las completadas.
  const cols = ocultarProyecto ? 5 : 6;

  const sortear = (col: OrdenTarea) => {
    if (col === orden) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setOrden(col);
    setDir(col === 'deadline' || col === 'proyecto' ? 'asc' : 'desc');
  };

  const nombreProy = (t: BoardTask) => board.labelById(t.labels[0])?.name ?? '';
  const { vivas, hechas } = useMemo(() => {
    const s = dir === 'asc' ? 1 : -1;
    const cmp = (a: BoardTask, b: BoardTask) => {
      if (orden === 'num') return s * (a.num - b.num);
      if (orden === 'score') return s * ((a.score || 0) - (b.score || 0));
      if (orden === 'proyecto') return s * nombreProy(a).localeCompare(nombreProy(b), 'es') || b.score - a.score;
      const fa = a.deadline || '', fb = b.deadline || '';
      if (!fa && !fb) return b.score - a.score;
      if (!fa) return 1;
      if (!fb) return -1;
      return s * fa.localeCompare(fb);
    };
    const orde = tareas.slice().sort(cmp);
    return { vivas: orde.filter((t) => t.progress < 100), hechas: orde.filter((t) => t.progress >= 100) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas, orden, dir, board.labels]);

  // Sobre lo VISIBLE, nunca sobre el tablero entero: si hay un filtro puesto, «todas» son
  // las que se ven. Seleccionar lo que no está en pantalla es cómo se borra de más.
  const visiblesIds = (verHechas ? [...vivas, ...hechas] : vivas).map((t) => t.id);
  const todasSel = visiblesIds.length > 0 && visiblesIds.every((id) => sel.has(id));
  const alternar = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const elegidas = tareas.filter((t) => sel.has(t.id));

  const fila = (t: BoardTask, hecha: boolean) => {
    const proy = board.labelById(t.labels[0]);
    const c = PCOLOR[prioFromScore(t.score)];
    return (
      <tr key={t.id} style={{ background: hecha ? 'var(--surface-2)' : undefined }}>
        <td style={{ ...tdBase, width: 34, paddingRight: 0 }}>
          <input type="checkbox" checked={sel.has(t.id)} onChange={() => alternar(t.id)}
            title="Seleccionar" aria-label={`Seleccionar «${t.title}»`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
        </td>
        <td style={{ ...tdBase, maxWidth: 420 }}>
          {/* SIN EL #ID. «El ID lo quitaría… el ID de la tabla de tareas» (25/09/2026):
              en una columna que ya cede ancho, el número se comía el principio del título
              en todas las filas para contestar una pregunta que nadie le hace a la tabla
              —el # se usa adentro del detalle, que es donde sigue estando—. */}
          <button type="button" onClick={() => onOpen(t.id)} title={t.title}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left', maxWidth: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: hecha ? 'line-through' : 'none', opacity: hecha ? .7 : 1 }}>{t.title}</span>
          </button>
        </td>
        {/* ⚠️ ADENTRO DE UN PROYECTO ESTA COLUMNA NO SE DIBUJA: son 190px repitiendo el
            nombre del proyecto que estás mirando en todas las filas, y en la columna
            principal del detalle (~538px) es la que quedaba cortada al medio. */}
        {!ocultarProyecto && (
          <td style={tdBase}>
            {proy && (
              <button type="button" onClick={() => onOpenProj?.(proy.id)} title={`Abrir «${proy.name}»`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 170, border: `1px solid ${proy.color}33`, background: proy.color + '14', color: proy.color, borderRadius: 7, padding: '3px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ flex: 'none' }}>{proy.emoji}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proy.name}</span>
              </button>
            )}
          </td>
        )}
        <td style={tdBase}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Score score={t.score} color={c} />
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{PLABEL[prioFromScore(t.score)]}</span>
          </span>
        </td>
        <td style={tdBase}>
          <CeldaFecha iso={t.deadline || ''} hoy={hoy} nombre={`«${t.title}»`} onSet={(v) => board.setDeadline(t.id, v, t.deadline)} />
        </td>
        {/* LAS DOS ACCIONES QUE CIERRAN UNA TAREA, JUNTAS: el check y el tacho.
            · El ESTADO se cambia desde acá: «otra columna para cambiar el estado»
              (25/09/2026). En este tablero el estado de una tarea es uno solo —activa o
              completada, que es lo que filtra el botón «Filtrar»—, así que la columna no
              inventa un tercer valor: es el check, que lo muestra y lo cambia en un click.
            · Y EL TACHO: «falta el botón de basura en la vista de tabla». Van en la MISMA
              celda y en el mismo orden que en la tarjeta y que al pie del detalle
              —«deberían estar juntos… un check y un ícono de tacho de basura»—, porque un
              control tiene que significar lo mismo en todos lados. Una columna propia para
              el tacho costaba un encabezado y ~34px de scroll para dibujar un solo ícono.
            Las dos van últimas y separadas de la casilla de selección, que vive en la
            primera: dos controles parecidos pegados es cómo se volvieron a confundir.
            ⚠️ El tacho NO borra: llama a `onEliminar`, que abre la pregunta de dos botones.
            Borrar de un click en una fila de una lista densa es borrar la de al lado. */}
        <td style={{ ...tdBase, textAlign: 'right' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckHecha hecha={hecha} onToggle={() => board.toggleDone(t.id)} titulo={t.title} />
            {onEliminar && (
              <button type="button" onClick={() => onEliminar(t.id)}
                title={`Eliminar «${t.title}»`} aria-label={`Eliminar «${t.title}»`}
                style={{ ...accionBtn, color: 'var(--faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--bad)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; }}>
                <IconoTacho size={15} />
              </button>
            )}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div style={cajaStyle} className="mk-scroll-x">
      {/* La barra vive en `AccionesLote`: la usa también el Kanban desde el 24/09/2026, y
          dos copias de una barra de acciones divergen a la primera acción nueva. */}
      <AccionesLote elegidas={elegidas} board={board} ask={ask} onLimpiar={() => setSel(new Set())} estilo={{ marginBottom: 10 }} />
      {/* ⚠️ EL PISO DE ADENTRO DE UN PROYECTO NO ES UN NÚMERO ELEGIDO ACÁ: es
          `ANCHO_TABLA_EN_PROYECTO` (./piezas), que sale de restarle al modal la columna
          derecha, el padding y las barras. Estuvo en 520 unas horas del 25/09/2026, sumando
          lo que las columnas «necesitan» (34 selección + 150 título + 124 prioridad + 150
          deadline + 76 acciones = 534, redondeado abajo) — y 520 no entra: la columna
          derecha del detalle subió de 236 a 264 el MISMO día, en el otro archivo, así que
          quedaban ~499px útiles y la barra horizontal volvía. Sumar lo que uno quiere no
          contesta si entra; restar lo que hay, sí. El que cede es el título, con «…» y el
          texto entero en su `title`.
          A lo ancho de la pantalla el problema no existe, así que ahí el piso sigue siendo
          la suma (700, con los 190 de la columna «Proyecto»). */}
      <table style={{ ...tablaStyle, minWidth: ocultarProyecto ? ANCHO_TABLA_EN_PROYECTO : 700 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: 34 }}>
              <input type="checkbox" checked={todasSel} ref={(el) => { if (el) el.indeterminate = sel.size > 0 && !todasSel; }}
                onChange={() => setSel(todasSel ? new Set() : new Set(visiblesIds))}
                title={todasSel ? 'Quitar la selección' : 'Seleccionar todas'} aria-label="Seleccionar todas"
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
            </th>
            {/* Ordena por `num`, que es el orden de CREACIÓN. El rótulo del tooltip dice
                «creación» y no «número» desde que el #ID salió de la fila: ofrecer ordenar
                por una columna que ya no se ve es ofrecer una incógnita. */}
            <Th orden="creación" activo={orden === 'num'} dir={dir} onSort={() => sortear('num')}>Tarea</Th>
            {!ocultarProyecto && <Th orden="proyecto" activo={orden === 'proyecto'} dir={dir} onSort={() => sortear('proyecto')} ancho={190}>Proyecto</Th>}
            {/* 150 y 160 eran anchos heredados: la celda de prioridad mide 99px de
                contenido (el chip + la palabra) y la del deadline, 126 (el `input`). El
                resto era hueco, y el hueco de una tabla se paga en scroll horizontal. */}
            <Th orden="prioridad" activo={orden === 'score'} dir={dir} onSort={() => sortear('score')} ancho={124}>Prioridad</Th>
            <Th orden="deadline" activo={orden === 'deadline'} dir={dir} onSort={() => sortear('deadline')} ancho={150}>Deadline</Th>
            {/* SIN RÓTULO. Decía «Estado» cuando la celda era sólo el check; ahora trae
                también el tacho, así que la palabra pasó a nombrar mal a la mitad de la
                columna — y un encabezado que miente es peor que ninguno. Las dos acciones
                se anuncian por su `title` y su `aria-label`, que es donde el texto no
                ocupa lugar; el nombre de la columna vive en el `aria-label` del `th`. */}
            <th aria-label="Acciones" style={{ ...thBase, width: 76 }} />
          </tr>
        </thead>
        <tbody>
          {vivas.map((t) => fila(t, false))}
          {vivas.length === 0 && hechas.length === 0 && (
            <tr><td colSpan={cols} style={{ ...tdBase, textAlign: 'center', color: 'var(--faint)' }}>No hay tareas para este filtro.</td></tr>
          )}
          <FilaPlegada n={hechas.length} abierto={verHechas} onToggle={() => setVerHechas((v) => !v)} cols={cols} texto={`completada${hechas.length === 1 ? '' : 's'}`} />
          {verHechas && hechas.map((t) => fila(t, true))}
        </tbody>
      </table>
    </div>
  );
}
