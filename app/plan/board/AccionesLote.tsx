'use client';

// =============================================================================
// AccionesLote — lo que se puede hacer con VARIAS tarjetas a la vez
// =============================================================================
// Nació en la vista de tabla (23/09/2026, «seleccionar varias tareas para realizar acciones
// múltiples») y al día siguiente hizo falta también en el Kanban: «que pueda seleccionar
// varias tarjetas también en la vista kanban». Vive acá y no en cada vista porque es la
// misma pregunta con la misma respuesta — y dos copias de una barra de acciones divergen a
// la primera acción nueva que se agregue en una sola.
//
// ⚠️ UNA ACCIÓN EN LOTE NECESITA UN SOLO DESHACER. Cada cambio individual ya ofrece el suyo
// (va en el choke point de `useBoard`), así que una acción sobre 12 tareas dispara 12 toasts
// y el que queda arriba deshace UNA. Acá se guarda el estado anterior de todas y se pisa con
// un toast que las revierte juntas — que es la unidad en la que la persona decidió.
//
// ⚠️ Y BORRAR PREGUNTA, Y NO PROMETE DESHACER. Restaurar N tareas es volver a crearlas en el
// server una por una, y a mitad de camino puede fallar dejando la mitad. Un botón que
// promete deshacer y a veces no puede es peor que uno que avisa antes.
//
// ⚠️ TODA LA BARRA ES ÍCONOS —salvo dos—, Y LA CUENTA ES LO QUE LO AUTORIZA (25/09/2026).
// Con texto pedía 899 px donde hay ~499 —el detalle de un proyecto; la cuenta NO se copia
// acá, vive en `ANCHO_TABLA_EN_PROYECTO` (piezas.tsx), que es donde se usa y donde ya dice
// por qué − 44 − 9 − 2, un número FIJO que no mejora con un monitor más grande—, se partía
// en dos renglones y valía 106 px de alto: tres filas de la tabla que la ronda anterior
// acababa de apretar columna por columna. La cuenta al día de hoy, con el ritmo adentro,
// está en `LA CUENTA` (abajo, pegada al contenedor). Sacarle el `wrap` sin que ENTRE habría
// devuelto la barra horizontal del `overflowX: auto` de `cajaStyle` (Tablas.tsx), que es
// justo lo que esa ronda mató.
//
// ── LA MISMA BARRA PARA DOS ENTIDADES (26/09/2026) ───────────────────────────────────
// «Proyecto también debería poder tener selección múltiple.» La anatomía es la misma —a la
// izquierda con qué estás trabajando, en el medio lo que CAMBIA, a la derecha lo que CIERRA—
// así que es UNA pieza (`BarraLote`) con DOS configuraciones (`AccionesLote` y
// `AccionesLoteProyectos`), nunca dos copias: es la regla de `.mk-fila` de AGENTS.md («si
// comparten esqueleto, es una pieza con dos configuraciones, y mantenerlas separadas
// garantiza que diverjan»).
//
// ⚠️ LO QUE UN PROYECTO **NO** PUEDE, Y POR QUÉ NO SE PINTA. Un control que no se puede
// cumplir no se dibuja; enumerar lo que queda afuera es la mitad del trabajo:
//   · **Completar.** El avance de un proyecto lo calcula `projProgress` a partir de sus
//     tareas: no hay ningún `progress` que tildar. Un check ahí sería un botón que no
//     escribe nada, o peor, uno que cierra N tareas que nadie miró.
//   · **Mover a un proyecto.** Un proyecto no vive adentro de otro: el tablero no tiene
//     jerarquía de proyectos y el `Dropdown` se llenaría con la propia selección.
//   · **Eliminar.** Borrar un proyecto NO es borrar una tarea: hay dos operaciones
//     distintas (`deleteLabel`, que deja las tareas huérfanas, y `deleteLabelYTareas`, que
//     se las lleva puestas) y `EliminarModal` existe justamente para hacer ESA pregunta por
//     proyecto, con la cuenta de lo que hay adentro. Una pregunta de dos botones sobre seis
//     proyectos no puede decir qué pasa con las 80 tareas de adentro, así que la barra no la
//     hace: se borra de a uno, desde el detalle, que es donde la pregunta cabe.
// Lo que SÍ puede —y es exactamente lo que el pedido necesitaba— es lo temporal: «Se
// repite», el ritmo con su día, y el deadline.
// =============================================================================

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { BoardTask, Label } from './types';
import type { Board } from './useBoard';
import { IconoTacho, IconoRepite } from './piezas';
import { Dropdown } from '@/app/components/Dropdown';
import {
  ROTULO_RECURRENTE, ROTULO_FRECUENCIA, ROTULO_DIA, FRECUENCIAS, DIAS_SEMANA, DIA_MES_MAX,
  esRecurrente, frecuenciaOk, frecuenciaDe, frecuenciaDiaOk, pideDia, textoFrecuencia, textoDia,
  type Frecuencia,
} from '@/lib/plan-recurrentes';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// ⛔ ACÁ VIVÍA `btn` — `padding: '6px 11px'`, `fontSize: 12.5`, y cinco rótulos adentro.
// Esa constante es lo que hacía que la barra pidiera 899. Sin texto no hace falta un molde
// de botón de texto: el de ícono ya existe y es `.mk-icon-btn` (globals.css:670).

/**
 * CÓMO SE DICE QUE TODAVÍA NADIE ELIGIÓ UN RITMO. **Una palabra**, y la misma en las cuatro
 * superficies que lo dicen (el selector del detalle, la tarjeta, la fila de tabla y esta
 * barra).
 *
 * ⚠️ NO es «Sin asignar» —lo que dice el selector de Quarter de al lado— por dos razones.
 * Una es el largo: en la tarjeta esto cae en el renglón del plazo, donde el techo es una
 * palabra y no una frase («no pongas texto innecesario nunca», 26/09/2026). La otra es que
 * los dos campos nunca conviven: el Quarter sólo existe si NO se repite y el ritmo sólo si
 * se repite, así que no hay ninguna pantalla donde las dos palabras se puedan contradecir.
 *
 * ⚠️ Y NO ES «—». El guion es `NoAplica`, que significa «esto no se mide así» (la columna
 * Prioridad de una recurrente). Acá sí aplica y sí se puede contestar: falta contestarlo.
 * Son dos huecos distintos, y decirlos igual es perder la diferencia.
 *
 * ⚠️ VIVE ACÁ Y NO EN `Tablas.tsx`, QUE ES DE DONDE SE MUDÓ (26/09/2026), Y LA RAZÓN ES EL
 * GRAFO DE IMPORTS. `Tablas` y `BoardShell` MONTAN esta barra, así que importar de ellos
 * sería un ciclo; esta barra no importa a ninguno de los dos, o sea que es la única hoja de
 * las tres y el único lugar del que los tres pueden leer. El sitio que le correspondería por
 * tema es `lib/plan-recurrentes.ts`, al lado de `FRECUENCIAS`; queda anotado y no hecho
 * porque `lib/` no es de esta pasada. Lo que NO puede pasar —y no pasa— es que la tarjeta,
 * la fila y la barra digan la misma cosa con tres textos distintos.
 */
export const SIN_FRECUENCIA = 'Indefinida';

/**
 * LAS OPCIONES DEL DÍA, SEGÚN LO QUE LA FRECUENCIA PIDA (mig 0166).
 *
 * `pideDia` contesta qué ancla necesita cada ritmo y esto contesta con qué se llena el
 * selector: los siete días de la semana (`DIAS_SEMANA`, la lista única) o los 31 del mes.
 *
 * ⚠️ EL TOPE SALE DE `DIA_MES_MAX`, NO DE UN 31 ESCRITO ACÁ: es el MISMO número contra el
 * que `frecuenciaDiaOk` valida, y dos topes es cómo el selector ofrece un día que el saneo
 * después tira. Y son 31 siempre, no los días del mes en curso: un ritmo mensual no vive en
 * un mes, así que ofrecer 28 en febrero dejaría un valor válido fuera de la lista once meses
 * al año — el `<select>` cuyo `value` no está entre sus `<option>`, que no muestra nada y en
 * el primer click lo borra, que este tablero ya pagó con los trimestres.
 *
 * ⚠️ Y VIVE ACÁ POR EL MISMO MOTIVO QUE `SIN_FRECUENCIA`: es la hoja del grafo de imports
 * entre los tres archivos del tablero. Su casa por tema es `lib/plan-recurrentes.ts`, al
 * lado de `DIAS_SEMANA`.
 */
export function opcionesDia(pide: 'semana' | 'mes'): Array<{ value: string; label: string }> {
  return pide === 'semana'
    ? DIAS_SEMANA.map((d) => ({ value: d.id, label: d.label }))
    : Array.from({ length: DIA_MES_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
}

// ── LOS ÍCONOS ───────────────────────────────────────────────────────────────────────
// ⚠️ EL TACHO Y EL BUCLE SE IMPORTAN; EL TILDE Y EL LÁPIZ SON COPIAS DECLARADAS. Los dos
// originales viven en archivos que esta barra NO puede importar sin ciclo: `BoardShell` y
// `Tablas` son los que la MONTAN. Es la misma razón por la que `IconoTacho` vive en
// `piezas.tsx` y no en BoardShell — la lápida de la copia anterior está en
// BoardShell.tsx:1480-1487. La cura de verdad son dos renglones: mudar el path del tilde
// (`CheckHecho`, BoardShell.tsx:1472) y el SVG de `LapizPrioridad` (PrioridadAMano.tsx:48)
// a `piezas.tsx` e importarlos desde los dos lados. Van marcadas con su origen para que el
// día que alguien toque una se acuerde de la otra.

/** Copia del path de `CheckHecho` (BoardShell.tsx:1472). El GROSOR —y no sólo el color—
 *  separa los dos estados: el color nunca puede ser el único portador. */
function TildeLote({ hecho }: { hecho: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      // ⚠️ 1.5/1.9 y no 1.8/2.4 como en la tarjeta: acá el tilde vive en un renglón de
      //    CINCO íconos y el peso se compara con el de al lado. El trazo efectivo es
      //    `strokeWidth × (tamaño / viewBox)`, y a 1.8 este tilde salía 46% más grueso
      //    que la cruz — que es el mismo defecto que el comentario de la cruz cita para
      //    justificar haber cambiado el carácter «✕» por un SVG. En la tarjeta va solo
      //    y ahí el 1.8 está bien: lo que cambia no es el ícono, es el vecindario.
      strokeWidth={hecho ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.6 6.3 11.9 13 4.4" />
    </svg>
  );
}

/** Copia del SVG de `LapizPrioridad` (PrioridadAMano.tsx:48). El lápiz YA significa «cambiar
 *  de proyecto» en el detalle (BoardShell.tsx:3511): es el único símbolo que este tablero
 *  tiene para esto, así que es ESE. No se importa el componente porque es un BOTÓN entero
 *  con su propio molde fantasma, y acá hace falta el dibujo suelto para meterlo adentro del
 *  `Dropdown`. */
function LapizLote() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      // 2.4 sobre viewBox 24 dibujado a 15px = 1.5 de trazo efectivo, el mismo que el
      // tacho y el calendario. A 2 salía 1.25 y el lápiz se veía más fino que todos.
      strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** ⚠️ EL ÚNICO DIBUJO NUEVO DE LA BARRA: no hay ningún calendario en todo `app/` (buscado
 *  por nombre y por path: cero de las 77 claves de `_components/icons.tsx`). Hasta hoy la
 *  fecha la dibujaba Chrome adentro del `<input type="date">`. Va en la familia de
 *  `IconoTacho` —viewBox 16, `strokeWidth 1.5`, `currentColor`, `aria-hidden`— porque su
 *  vecino de fila y de tamaño es el tacho, no el registro de 24. En cuanto tenga un SEGUNDO
 *  call site se muda a `piezas.tsx`, al lado del tacho: dos copias de un dibujo divergen a
 *  la primera. */
function CalendarioLote() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.1" y="3.5" width="11.8" height="10.4" rx="1.6" />
      <path d="M2.1 6.6h11.8" />
      <path d="M5.4 2.1v2.6M10.6 2.1v2.6" />
    </svg>
  );
}

/** El botón de ícono de la CASA: `.mk-icon-btn` (globals.css:670) con su `data-tone`.
 *  34×34 `flex: none`, radio 9, borde `--border-strong`, fondo `--surface`.
 *
 *  ⚠️ NADA DE COLOR NI DE FONDO INLINE. La clase los pone para que la variante oscura los
 *  pueda repintar (globals.css:773-776 y las reglas de `.mk-key-row--code`), y un inline le
 *  gana a cualquier clase — el comentario de globals.css dice que esa misma familia de barra
 *  ya pagó ese error con el color de los íconos. Lo único inline es `cursor`, que no se
 *  tematiza y que la clase no trae.
 *
 *  ⚠️ `title` Y `aria-label` con el MISMO string, siempre: un botón cuyo único contenido es
 *  un SVG se anuncia «botón», a secas. */
function BtnIcono({ rotulo, texto, tono = 'dim', pressed, onClick, children }: {
  rotulo: string;
  /** La palabra al lado del ícono. Sin esto el botón es el cuadrado de 34 de siempre.
   *  ⚠️ Lo ÚNICO que se pisa de la clase es la GEOMETRÍA (ancho auto y padding): el color y
   *  el fondo siguen saliendo de `.mk-icon-btn` + `data-tone`, porque un inline le gana a
   *  cualquier clase y esta misma familia de barra ya pagó ese error con el color. */
  texto?: string;
  tono?: 'dim' | 'bad' | 'good' | 'primary';
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="mk-icon-btn" data-tone={tono}
      title={rotulo} aria-label={rotulo} aria-pressed={pressed}
      onClick={onClick}
      style={texto
        ? { cursor: 'pointer', width: 'auto', padding: '0 11px', gap: 6, fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }
        : { cursor: 'pointer' }}>
      {children}
      {texto}
    </button>
  );
}

/**
 * LO ÚNICO QUE CAMBIA ENTRE LA BARRA DE TAREAS Y LA DE PROYECTOS.
 *
 * Todo lo que es `null` es una acción que esa entidad NO puede cumplir, y no se dibuja: es
 * el mismo criterio que `onEliminar` en la fila de la tabla o que `onAgarrar` en la tarjeta
 * —la prop ES la capacidad— y el mismo que impide que el tablero del CLIENTE muestre un
 * control que sólo sabe contestar «solo admin».
 */
type CfgLote<T> = {
  /** «1 tarea» · «4 proyectos». En un proyecto sale de `repo.labelPlural`, nunca cableado:
   *  en el tablero del cliente estos se llaman «Categorías». */
  nombre: (n: number) => string;
  /** el género de esa palabra, para «seleccionadas» / «seleccionados». */
  fem: boolean;
  /** el deshacer: devolver la copia al board. `replaceTask` para una tarea, `patchLabel`
   *  con la copia entera para un proyecto. */
  restaurar: (snap: T) => void;
  setRecurrente: (t: T, v: boolean) => void;
  setFrecuencia: (t: T, v: Frecuencia | null) => void;
  setFrecuenciaDia: (t: T, v: string | null) => void;
  setDeadline: (t: T, iso: string) => void;
  /** completar / reabrir. `null` = esta entidad no se completa (ver la cabecera). */
  estado: { hecha: (t: T) => boolean; toggle: (t: T) => void } | null;
  /** mover a un proyecto. `null` = esta entidad no vive adentro de un proyecto. */
  mover: ((t: T, labelId: string) => void) | null;
  /** eliminar en lote. `null` = la pregunta no cabe en una barra (ver la cabecera). */
  borrar: ((t: T) => void) | null;
};

/**
 * LA BARRA DE TAREAS. Es la configuración de siempre: se completan, se mueven de proyecto y
 * se borran, y desde hoy también se marcan como recurrentes y llevan ritmo.
 */
export function AccionesLote({ elegidas, board, ask, onLimpiar, estilo }: {
  elegidas: BoardTask[];
  board: Board;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
  onLimpiar: () => void;
  estilo?: CSSProperties;
}) {
  return (
    <BarraLote<BoardTask> elegidas={elegidas} board={board} ask={ask} onLimpiar={onLimpiar} estilo={estilo}
      cfg={{
        nombre: (n) => (n === 1 ? '1 tarea' : `${n} tareas`),
        fem: true,
        restaurar: (snap) => board.replaceTask(snap),
        setRecurrente: (t, v) => board.setRecurrente(t.id, v),
        setFrecuencia: (t, v) => board.setFrecuencia(t.id, v),
        setFrecuenciaDia: (t, v) => board.setFrecuenciaDia(t.id, v),
        setDeadline: (t, iso) => board.setDeadline(t.id, iso, t.deadline),
        estado: { hecha: (t) => t.progress >= 100, toggle: (t) => board.toggleDone(t.id) },
        mover: (t, labelId) => board.setTaskLabels(t.id, [labelId], `Movida a «${board.labelById(labelId)?.name ?? ''}»`),
        borrar: (t) => board.removeSilent(t.id),
      }} />
  );
}

/**
 * LA BARRA DE PROYECTOS (26/09/2026, «proyecto también debería poder tener selección
 * múltiple»). MISMA pieza, tres capacidades apagadas: completar, mover y eliminar. El porqué
 * de cada una está enumerado en la cabecera del archivo, que es donde se busca.
 *
 * ⚠️ EL DESHACER RESTAURA CON `patchLabel(id, snap)` Y NO CON UN `replaceLabel`, que no
 * existe: `patchLabel` fusiona el objeto entero encima del actual y GUARDA, así que pasarle
 * la copia completa —historial incluido— devuelve el proyecto exactamente como estaba. Es lo
 * mismo que hace `replaceTask` del otro lado, con la única API que un Label tiene.
 */
export function AccionesLoteProyectos({ elegidos, board, onLimpiar, estilo }: {
  elegidos: Label[];
  board: Board;
  onLimpiar: () => void;
  estilo?: CSSProperties;
}) {
  // ⚠️ NO RECIBE `ask`, Y NO ES UN OLVIDO: `ask` existe para la ÚNICA acción irreversible de
  // la barra —el tacho— y esta configuración no la tiene. Pedirlo igual obligaría a las dos
  // vistas de proyectos a cablear una pregunta que nunca se hace, y eso es exactamente cómo
  // nace un botón que después alguien enchufa «porque el prop ya estaba».
  // «Categoría» en el tablero del cliente, «Proyecto» en el del dueño: la palabra sale del
  // repo y la concordancia de «seleccionados/as» se deriva de ella. Un rótulo cableado sería
  // la única frase de esta barra hablando de otra cosa.
  const plural = board.repo.labelPlural.toLowerCase();
  const singular = board.repo.labelSingular.toLowerCase();
  return (
    <BarraLote<Label> elegidas={elegidos} board={board} onLimpiar={onLimpiar} estilo={estilo}
      cfg={{
        nombre: (n) => `${n} ${n === 1 ? singular : plural}`,
        fem: /a$/.test(singular),
        restaurar: (snap) => board.patchLabel(snap.id, snap),
        setRecurrente: (l, v) => board.setLabelRecurrente(l.id, v),
        setFrecuencia: (l, v) => board.setLabelFrecuencia(l.id, v),
        setFrecuenciaDia: (l, v) => board.setLabelFrecuenciaDia(l.id, v),
        setDeadline: (l, iso) => board.setLabelDeadline(l.id, iso),
        estado: null,
        mover: null,
        borrar: null,
      }} />
  );
}

function BarraLote<T extends { id: string; recurrente?: boolean; frecuencia?: unknown; frecuenciaDia?: string | null }>({ elegidas, board, ask, onLimpiar, estilo, cfg }: {
  elegidas: T[];
  board: Board;
  /** confirmar lo irreversible (lo trae el board). Opcional porque va PEGADO a `cfg.borrar`:
   *  la configuración que no borra no tiene nada que confirmar, y sin las dos el tacho no se
   *  dibuja. */
  ask?: (msg: string, onOk: () => void) => void;
  onLimpiar: () => void;
  estilo?: CSSProperties;
  cfg: CfgLote<T>;
}) {
  // ⚠️ LOS HOOKS VAN ARRIBA DEL `return null`, NO ABAJO. El call site de la tabla
  // (Tablas.tsx) dibuja esta barra SIEMPRE —el del Kanban la envuelve en
  // `elegidas.length > 0 &&`, así que ahí sí desmonta—, o sea que el return de abajo corre
  // en casi todos los renders. Un hook detrás de él es el «Minified React error #300»: la
  // pantalla entera en blanco, sin archivo ni línea. Lo bloquea el pre-push
  // (scripts/hooks-en-orden.sh) y es la razón por la que este archivo no tenía un solo hook
  // hasta el 25/09.
  const [editandoFecha, setEditandoFecha] = useState(false);
  /**
   * EL RITMO QUE ACABA DE ESCRIBIRSE Y TODAVÍA NO TIENE DÍA (mig 0166).
   *
   * «La frecuencia debe poder configurarse como Google Calendar, es decir, si es 1 vez a la
   * semana ¿qué día?» (26/09/2026). Acá eso son DOS preguntas y UNA sola ranura: se elige el
   * ritmo, y si ese ritmo pide un ancla la misma ranura pasa a preguntar el día. Es el mismo
   * mecanismo que el deadline —el botón se convierte en el `<input type=date>` y vuelve—, y
   * es lo único que entra: la cuenta de más abajo dice que un tercer control con palabra no.
   *
   * ⚠️ SON DOS ESCRITURAS Y NO UNA, Y NO ES UNA ELECCIÓN DE DISEÑO: ES LO ÚNICO QUE GUARDA.
   * `setFrecuenciaDia` sanea el día CONTRA LA FRECUENCIA QUE LA TARJETA TIENE, y la lee de
   * `byId(id)` —o sea del array `tasks` del render en curso—. Las dos llamadas juntas en el
   * mismo handler dejan la segunda leyendo la frecuencia VIEJA: `frecuenciaDiaOk('lun',
   * viejo)` da `null`, `next === prev`, y la función **sale sin escribir**. El gesto se ve
   * perfecto y el día no se guarda, que es el modo de falla más caro de este tablero. Con el
   * ritmo escrito en el paso 1, el paso 2 corre en el render SIGUIENTE y ahí la tarjeta ya
   * trae la frecuencia nueva.
   *
   * ⚠️ Y POR ESO EL PASO 1 **NO LIMPIA LA SELECCIÓN**. Es la única excepción del archivo y
   * está acotada a este caso: si limpiara, el paso 2 se quedaría sin a quién escribirle. El
   * que limpia es el paso 2 —o cualquier otra acción—, que es cuando la decisión terminó.
   *
   * ⚠️ Y ABANDONAR EL PASO 2 NO ROMPE NADA, que es lo que lo vuelve seguro: el ritmo ya está
   * guardado y «se repite y nadie dijo cuándo» es un estado real del contrato. La primera
   * versión guardaba las dos cosas juntas al final, y ahí abandonar significaba no guardar
   * nada — una ranura de la que sólo se salía sin haber hecho lo que se pidió.
   *
   * ⚠️ NULL = NO HAY NADA PENDIENTE. Nunca guarda una frecuencia que no pida día: ésas se
   * aplican enteras en el acto.
   */
  const [ritmoPend, setRitmoPend] = useState<Frecuencia | null>(null);
  const pickerAbierto = useRef(false);

  if (!elegidas.length) return null;

  // ⚠️ Y en la tabla `return null` NO DESMONTA: la instancia queda viva con su estado. Por
  // eso los dos editores de dos pasos —la fecha y el ritmo— se cierran ACÁ, en el único
  // lugar por donde pasan todas las acciones; si no, la próxima selección nace con el input
  // abierto en vez del ícono.
  const enLote = (texto: string, aplicar: (t: T) => void, mantenerSeleccion = false) => {
    const snaps = elegidas.map((t) => ({ ...t }));
    elegidas.forEach(aplicar);
    cerrarEditores();
    if (!mantenerSeleccion) onLimpiar();
    board.showUndo(texto, () => snaps.forEach((snap) => cfg.restaurar(snap)));
  };
  const cerrarEditores = () => { setEditandoFecha(false); setRitmoPend(null); };

  // ⚠️ UN SOLO BOTÓN PARA LAS DOS DIRECCIONES. «Elimina el "Reabrir", sería lo mismo que
  // "completar" solo que si lo aprieto a la inversa se descompleta, pero no debe haber 2
  // botones» (24/09/2026). Con dos, uno de los dos siempre está de más: sobre una selección
  // de tareas abiertas, «Reabrir» no hace nada y viceversa — un botón que no puede hacer
  // nada se lee como que la app está rota. El sentido lo decide la selección: si TODAS están
  // hechas, descompleta; si no, completa. Sin texto, lo que dice en qué dirección va es el
  // `title` (el verbo), y lo que dice en qué estado está es el grosor del trazo +
  // `aria-pressed`.
  const todasHechas = !!cfg.estado && elegidas.every(cfg.estado.hecha);
  const n = elegidas.length;
  const plural = n === 1 ? '' : 's';
  // Sin texto en pantalla, el `title` es el ÚNICO lugar donde se dice sobre QUÉ actúa cada
  // botón: «Eliminar» a secas no nombra su objeto.
  const cosas = cfg.nombre(n);
  const rotCuenta = `${cosas} seleccionad${cfg.fem ? 'a' : 'o'}${plural}`;
  // «Reabrir», no «Descompletar»: es lo que ya dicen la fila de la tabla (Tablas.tsx:475) y
  // el toast de deshacer («3 reabiertas»). Era la única de las tres superficies que decía
  // otra cosa. Y el `↺` se va sin que se extrañe: no tiene glifo en Geist, lo dibujaba la
  // fuente del sistema.
  const rotEstado = `${todasHechas ? 'Reabrir' : 'Completar'} ${cosas}`;
  const rotMover = `Mover ${cosas} a un proyecto`;
  /**
   * ⚠️ EL DEADLINE SE DECIDE POR LA SELECCIÓN, NO POR LA PANTALLA. Una recurrente no lleva
   * fecha —`taskToRow` y `editarTarea` se la borran en el server—, así que ofrecer el
   * control sobre una selección de puras recurrentes es prometer una escritura que no va a
   * ocurrir: la barra diría «Deadline 2026-10-03 en 4» sobre cuatro tarjetas que siguen sin
   * fecha. Es un éxito falso, que es el modo de falla más caro de todos.
   *
   * ⚠️ Y SE MIRA LA SELECCIÓN Y NO UN PROP. La tabla ya tiene `sinRanking` y podría pasarlo,
   * pero eso sólo cubriría la vista «Recurrentes»: en el Kanban y en la tabla completa se
   * pueden tildar recurrentes igual, y ahí el prop no llega. La pregunta correcta es sobre
   * lo que se tildó, no sobre dónde está dibujada la barra.
   *
   * Con una selección MIXTA el control se queda: la fecha se le pone a las que pueden
   * tenerla y el mensaje del deshacer dice ese número, no el total.
   */
  const conFecha = elegidas.filter((t) => !esRecurrente(t));
  const puedeFechar = conFecha.length > 0;
  const rotFecha = conFecha.length === n
    ? `Ponerle${plural} deadline a ${cosas}`
    : `Ponerle deadline a ${conFecha.length} de ${cosas} (las que se repiten no llevan fecha)`;
  const rotBorrar = `Eliminar ${cosas} — no se puede deshacer`;
  /**
   * ── «SE REPITE» EN LOTE, Y EL RITMO EN EL LUGAR DEL DEADLINE ───────────────────────
   *
   * «Ponle la frecuencia AL LOTE también, que se pueda poner recurrente o dejar a tareas en
   * lote» (26/09/2026).
   *
   * ⚠️ EL INTERRUPTOR VA EN LAS DOS DIRECCIONES, como el tilde, y por el mismo motivo: dos
   * botones dejarían siempre uno que no puede hacer nada. Lo decide la selección — si TODAS
   * se repiten, desmarca; si no, marca.
   *
   * ⚠️ Y EL RITMO **REEMPLAZA** AL DEADLINE, no se suma. Son la misma pregunta —«¿cuándo?»—
   * con dos respuestas que no pueden convivir: algo que se repite no lleva fecha de fin, así
   * que `!puedeFechar` (toda la selección se repite) es exactamente el caso en que el
   * deadline no se dibuja y su ranura queda libre. Es lo mismo que ya hacen el detalle
   * (`llevaDeadline ? deadline+quarter : frecuencia`) y la columna temporal de las dos
   * tablas, y es lo único que la barra aguanta de ancho (ver `LA CUENTA`).
   *
   * ⚠️ POR ESO EL RITMO NO NECESITA DECIR «EN N»: sólo existe cuando la selección entera se
   * repite, o sea que se aplica al 100% de lo tildado. El «en N» está donde una acción puede
   * tocar un SUBCONJUNTO —el deadline y este interruptor—, que es donde una barra puede
   * mentir.
   */
  const todasRepiten = elegidas.every((t) => esRecurrente(t));
  const cambianRepite = todasRepiten ? n : elegidas.filter((t) => !esRecurrente(t)).length;
  // El `title` dice a CUÁNTAS se aplica, y sólo cuando no son todas: «en 4 de 4» es ruido.
  // Mismo criterio que `rotFecha`, que es el otro control que puede tocar un subconjunto.
  const rotRepite = todasRepiten
    ? `Quitar «${ROTULO_RECURRENTE}» a ${cosas}`
    : cambianRepite === n
      ? `Marcar «${ROTULO_RECURRENTE}» en ${cosas}`
      : `Marcar «${ROTULO_RECURRENTE}» en ${cambianRepite} de ${cosas} (el resto ya se repite)`;
  /** El ancla que pide el ritmo que está esperando. Nunca `null` mientras `ritmoPend` viva:
   *  las frecuencias que no piden día se aplican enteras en el acto y no llegan a este
   *  estado. */
  const anclaPend = ritmoPend ? pideDia(ritmoPend) : null;
  /**
   * PASO 1: el ritmo. Si pide un ancla, la selección se QUEDA y la ranura pasa a preguntar
   * el día (ver el porqué en `ritmoPend`); si no —«Todos los días» o «Indefinida»—, no hay
   * nada más que preguntar y la acción termina acá.
   *
   * El texto del toast es `textoFrecuencia`, el MISMO que usa `useBoard` para el cambio de
   * una sola tarjeta: dos palabras, que es el techo de esa superficie.
   */
  const ponerRitmo = (f: Frecuencia | null) => {
    const pide = f ? pideDia(f) : null;
    // ⚠️ SI NADIE CAMBIA, NO SE ESCRIBE NI SE OFRECE DESHACER — y acá eso NO es un caso
    // raro: re-elegir el ritmo que la selección ya tiene es el camino NORMAL para llegar al
    // paso del día. Un toast de 5 segundos que dice «Cada semana» sobre un cambio que no
    // ocurrió, y que además pisa el deshacer de la acción anterior, es la barra mintiendo.
    if (elegidas.some((t) => frecuenciaDe(t) !== f)) enLote(textoFrecuencia(f) ?? SIN_FRECUENCIA, (t) => cfg.setFrecuencia(t, f), !!pide);
    else { cerrarEditores(); if (!pide) onLimpiar(); }
    // DESPUÉS de `enLote` y de `cerrarEditores()`, que lo pondrían en `null`.
    if (pide) setRitmoPend(f);
  };
  /** PASO 2: el día. El texto es `textoDia` —«Los lunes», «El 15»— y no la frase entera: el
   *  ritmo ya se dijo en el toast anterior y no es lo que la persona acaba de tocar. Es
   *  exactamente lo que hace `useBoard.setFrecuenciaDia` para una sola tarjeta. */
  const ponerDia = (crudo: string) => {
    const dia = frecuenciaDiaOk(crudo, ritmoPend);
    // Misma guarda que arriba, y por lo mismo: elegir el día que ya estaba puesto no es un
    // cambio, y el deshacer es de lo que cambió.
    if (elegidas.some((t) => frecuenciaDiaOk(t.frecuenciaDia, frecuenciaDe(t)) !== dia)) enLote(textoDia(ritmoPend, dia) ?? 'Sin día', (t) => cfg.setFrecuenciaDia(t, dia));
    else { cerrarEditores(); onLimpiar(); }
  };

  return (
    // ⚠️ LA BARRA OCUPA EL ANCHO Y REPARTE: `width: '100%'` + `space-between`. «Que no se
    // agrupe todo a la izquierda, que sea proporcional» (25/09/2026).
    //
    // Estuvo en `fit-content` unas horas del mismo día, y el razonamiento parecía correcto:
    // la caja azul vacía de la captura era el hueco de una banda al 100 % con todo apretado
    // contra un borde, así que encogerla al contenido lo hacía desaparecer. Y desapareció —
    // junto con la mitad de la barra: los controles quedaron en una pastilla pegada a la
    // izquierda de una columna de 499, o sea el hueco seguía ahí, sólo que AFUERA de la barra
    // en vez de adentro y encima sin fondo.
    //
    // ⚠️ Y `space-between` sobre los controles SUELTOS tampoco era: con la barra al ancho del
    // Kanban (~1.900 px) los repartió uno por esquina, cada uno a 300 px del siguiente. «No
    // tiene sentido esta distribución» (25/09/2026). Lo que se reparte son TRES GRUPOS, no
    // seis piezas — y cada grupo se mantiene junto por dentro.
    //
    // El hueco no se saca achicando la caja: se saca repartiendo lo que hay adentro.
    //
    // ⚠️ POR ESO NO HAY NINGÚN `<span style={{ flex: 1 }} />`. Un espaciador empuja a los de
    // un lado contra un borde y deja TODO el aire en un solo lugar, que es exactamente el
    // apilamiento que este pedido saca. El aire lo dividen en partes iguales los DOS grupos
    // de los costados, que son `flex: 1` (uno alineado al principio y el otro al final) con
    // el del medio en `flex: none`: así el medio queda en el medio de verdad y sigue ahí con
    // cualquier ancho — la misma barra se dibuja en una columna de 499 y en el Kanban, que
    // mide el tablero entero. El `space-between` del contenedor queda como respaldo para el
    // caso en que los costados no puedan crecer; no es lo que centra.
    //
    // ⚠️ Y EL GRUPO DE LA DERECHA PUEDE QUEDAR VACÍO —la barra de PROYECTOS no completa ni
    // borra— y sigue siendo necesario: es el `flex: 1` que equilibra al de la izquierda y
    // deja el medio en el medio. Sacarlo cuando no tiene hijos correría los controles hacia
    // la derecha, que es el mismo hueco mal repartido de arriba con el signo cambiado.
    //
    // ⚠️ EL `flexWrap: 'wrap'` NO ES EL DE ANTES, aunque sea la misma línea. Antes era el
    // CAMINO —la barra pedía 899 px donde hay 499, así que se partía en dos renglones
    // siempre, que es lo que Martín reportó—; ahora es la RED. Ahí el `wrap` es lo correcto y
    // el `nowrap` es lo peligroso: sin él, lo que no entra no baja de renglón sino que
    // DESBORDA, y el Kanban no tiene ningún ancestro con `overflow`, así que la barra
    // horizontal se la come la PÁGINA entera. Es la regla de la casa para una barra que no
    // entra —baja de renglón, nunca scrollea de costado— y es gratis: en las tres pantallas
    // donde Martín la mira, nunca se dispara.
    //
    // ⚠️ Y EL QUE CEDE ES EL GRUPO DEL MEDIO, que ahora sí puede: desde que la fecha y el
    // proyecto llevan su palabra hay algo que RECORTAR. Mientras fueron íconos pelados, el
    // `flex: 0 1 auto` era una red decorativa —un ícono no se elipsa, y el botón tocaba
    // fondo en ~54 px—, que es justo lo que la regla de la casa quiere decir con «declará
    // quién cede»: ceder en el tipo no es ceder en píxeles. Los grupos de los costados van
    // `flex: none` porque son los que no se pueden perder: con qué se está trabajando, y
    // las dos acciones que cierran.
    //
    // ── LA CUENTA, contra los ~499 del lugar más angosto (el detalle de un proyecto) ────
    // Medida ANTES de escribir, que es lo que el pedido pide, y en los DOS estados que la
    // ranura temporal puede tener. Los anchos de los botones con palabra salen de los
    // medidos el 25/09 («Deadline» 96 · «Proyecto» 108) y el del ritmo se estima con la
    // misma regla: `Dropdown` con ícono + caret ≈ 54 + el ancho del texto a 12.5 px, o sea
    // «Frecuencia» (10 caracteres, ~70) ≈ 124 y «Día» ≈ 78.
    //
    //   izquierda  16 casilla + 8 + 24 número                                =  48
    //   medio A    34 «Se repite» + 14 + 96 Deadline + 14 + 108 Proyecto     = 266
    //              (con el calendario abierto el Deadline mide 118)          = 288
    //   medio B    34 «Se repite» + 14 + 124 Frecuencia + 14 + 108 Proyecto  = 294
    //              (en el paso del día la ranura mide 78, o sea MENOS)       = 248
    //   derecha    34 tilde + 6 + 34 tacho                                   =  74
    //   los dos huecos entre grupos, como mínimo                             =  20
    //   padding 24 + borde 2                                                 =  26
    //   ─────────────────────────────────────────────────────────────────────────────
    //   A 434 · A con el calendario abierto 456 · **B 462, que es el peor**
    //   Contra 499: 37 px de aire en el peor estado. Entra, y por eso el ritmo REEMPLAZA al
    //   deadline en vez de sumarse: los dos juntos pedirían 558 y la barra se partiría en
    //   dos renglones, que es exactamente el reporte que la ronda del 25/09 vino a cerrar.
    //
    // La barra de PROYECTOS es más angosta todavía (sin «Proyecto», sin tilde y sin tacho):
    // 48 + 172 + 0 + 20 + 26 = 266 en su peor estado, y vive en vistas de 860 y 1180 px.
    //
    // El tilde y el tacho se quedan SIN palabra a propósito y no es por ahorrar: significan
    // lo mismo en la fila, en la tarjeta y al pie del detalle, así que ahí el ícono ya es el
    // nombre. Lo mismo vale para el bucle de «Se repite», que es la marca de lo que se
    // repite en TODO el tablero (el chip de la tarjeta, la vista, la columna de la tabla).
    // La fecha y el ritmo no tienen esa suerte — un calendario suelto no dice QUÉ fecha.
    <div role="group" aria-label={`Acciones sobre ${cosas}`}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap', padding: '7px 12px', borderRadius: 11,
        border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)',
        fontFamily: SANS, ...estilo,
      }}>


      {/* ── IZQUIERDA: la casilla, marcada, y el número. ───────────────────────────────
          «El botón de quitar selección no debe existir, solamente el check en el mismo
          lugar, a la izquierda del todo, marcado, como seleccionado, y al lado el número de
          cantidad de items que agarró. Y si lo vuelvo a marcar se deselecciona» (25/09/2026).

          La ✕ que había acá era un segundo control para lo mismo: en la tabla, lo que
          selecciona ES una casilla —la de cada fila y la de «todas» del encabezado—, así que
          destildar la casilla ya significaba «ninguna». Un botón aparte para eso es partir la
          respuesta en dos, y encima con otra forma.

          ⚠️ Por eso es un `<input type="checkbox">` de verdad y no un botón dibujado como
          casilla: es el MISMO control que las filas, se anuncia como casilla marcada y el
          teclado la conoce. `checked` es siempre true —la barra sólo existe con algo
          seleccionado— y destildarla limpia.

          El número va al lado y NO es clicable: el `role="status"` lo canta a medida que se
          tildan tarjetas, que es lo único que le queda a quien no ve la barra. */}
      {/* ⚠️ `flex: 1` EN LOS DOS COSTADOS, y no `flex: none`. Con `space-between` a secas el
          grupo del medio no queda centrado: queda donde sobra, o sea corrido hacia el lado
          del grupo más angosto —la izquierda mide ~48 px y la derecha ~74, así que el medio
          salía 13 px a la izquierda del centro real—. Dos costados elásticos, uno alineado al
          principio y el otro al final, dejan el medio exactamente en el medio, y siguen ahí
          con cualquier ancho: es el molde de tres ranuras de toda barra de herramientas. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <input type="checkbox" checked readOnly
          onClick={() => { cerrarEditores(); onLimpiar(); }}
          title="Quitar la selección" aria-label={`${rotCuenta}. Quitar la selección`}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
        <span role="status" title={rotCuenta} aria-label={rotCuenta}
          style={{ flex: 'none', minWidth: 24, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
          {n}
        </span>
      </div>


      {/* ── MEDIO: lo que CAMBIA la tarjeta, y acá sí con su palabra donde hace falta. ──
          «En el medio la fecha y el proyecto, que sería bueno que no sean solo íconos, pero
          cuida que entre bien todo» (25/09/2026). Son los dos únicos controles de la barra
          que no se adivinan por su forma: un tilde y un tacho significan lo mismo en toda la
          app, y un calendario y un lápiz sueltos no dicen QUÉ fecha ni qué se edita. */}
      {/* ⚠️ `gap: 14` Y NO 6. «No los pongas tan juntos a los del medio» (25/09/2026): son
          los controles de la barra que tienen borde Y palabra, y a 6 px sus cajas se tocan y
          se leen como un solo bloque partido por una raya. Los de los costados pueden ir
          apretados porque son íconos sueltos sin caja —ahí el aire lo pone el propio
          botón—; dos pastillas necesitan el doble. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none', justifyContent: 'center' }}>

        {/* EL INTERRUPTOR «Se repite», PRIMERO DEL GRUPO Y SIN PALABRA.
            ⚠️ VA PRIMERO PORQUE ES EL QUE DECIDE QUÉ ES LO DE AL LADO: leído en orden dice
            «esto se repite → por eso lo temporal es un ritmo y no una fecha», que es el
            MISMO orden que el detalle (el interruptor arriba, el ritmo abajo). Puesto
            después, la ranura temporal cambia de forma sin que nada la explique.
            ⚠️ Y SIN PALABRA: el bucle ES el nombre de esto en todo el tablero (el chip de la
            tarjeta, la vista Recurrentes, la columna de la tabla, el ícono del detalle). La
            palabra la dice el `title`, que no ocupa lugar — y la cuenta de arriba dice que
            un tercer control con texto no entra. */}
        <BtnIcono rotulo={rotRepite} tono={todasRepiten ? 'primary' : 'dim'} pressed={todasRepiten}
          onClick={() => enLote(
            // ⚠️ El verbo concuerda con el NÚMERO QUE SE MUESTRA, no con la selección: la
            // barra se dibuja desde una sola tildada, así que «1 se repiten» sale en el caso
            // más común de todos. Y el número del que marca es `cambianRepite` —las que de
            // verdad cambian— mientras que el del que desmarca es `n`: por eso son dos.
            todasRepiten
              ? `${n} ya no se ${n === 1 ? 'repite' : 'repiten'}`
              : `${cambianRepite} se ${cambianRepite === 1 ? 'repite' : 'repiten'}`,
            (t) => { if (esRecurrente(t) === todasRepiten) cfg.setRecurrente(t, !todasRepiten); },
          )}>
          <IconoRepite size={15} />
        </BtnIcono>

        {/* ⚠️ EL CALENDARIO ABIERTO MIDE 118 EN VEZ DE 34, y con `space-between` eso ya no
            corre a nadie de lugar: lo que se achica es el AIRE repartido, no la posición de los
            vecinos. (Con la barra encogida a su contenido sí los corría, y por eso estaba
            puesto último del grupo; el orden se queda igual porque agrupa por significado —
            primero lo que cambia la tarea, al final lo que la saca de encima.)
            Cómo un ícono abre un calendario: el botón monta el `<input type=date>` de verdad y
            el ref le llama `showPicker()`. Es el mecanismo de `CeldaFecha` (Tablas.tsx:425-461)
            —las dos únicas líneas de todo el repo que llaman a `showPicker`— con sus dos
            gotchas intactos:
            · `pickerAbierto` es un `useRef` y NO estado: el ref callback corre en cada render y
              sin el flag `showPicker()` se volvería a llamar. Se resetea en el `onClick` del
              BOTÓN, no en un efecto.
            · `showPicker?.()` va dentro de un `try` con el catch vacío a propósito: no existe
              en Safari viejo y tira si la llamada no cuelga de un gesto. Sin picker nativo
              queda el input, que igual se edita — por eso el input es real y visible, y no uno
              escondido detrás del ícono: escondido, ese respaldo no existiría.
            El `height: 34` (border-box, globals.css) es lo que hace que abrirlo NO cambie el
            ALTO de la barra, que es lo que esta ronda vino a cuidar. Y los 118 son los mismos
            de `fechaInput` (Tablas.tsx:119): por debajo de ~110 Chrome recorta «aaaa».
            No va en un flotante absoluto porque `cajaStyle` computa `overflow` en los DOS ejes
            (`overflow-x: auto` + `overflow-y: visible` → el Y pasa a auto) y lo recortaría, o
            devolvería la barra de scroll que la ronda anterior mató. */}
        {/* ⚠️ UNA SOLA RANURA PARA «¿CUÁNDO?», Y TRES FORMAS QUE NUNCA CONVIVEN: el deadline
            (si algo de la selección puede tener fecha), el ritmo (si TODO se repite) y, como
            segundo paso del ritmo, el día. Es un `? :` y no tres condiciones sueltas por lo
            mismo que en el detalle: escrito suelto, el día que alguien toque una condición
            quedan las tres a la vez —y ahí la barra no entra— o ninguna, y el grupo del
            medio se queda con un solo control. */}
        {puedeFechar ? (
          editandoFecha ? (
            <input type="date" autoFocus
              ref={(el) => {
                if (!el || pickerAbierto.current) return;
                pickerAbierto.current = true;
                try { el.showPicker?.(); } catch { /* sin picker nativo queda el input, que igual se edita */ }
              }}
              onChange={(e) => {
                const v = e.target.value;
                setEditandoFecha(false);
                if (v) enLote(`Deadline ${v} en ${conFecha.length}`, (t) => { if (!esRecurrente(t)) cfg.setDeadline(t, v); });
              }}
              onBlur={() => setEditandoFecha(false)}
              // El Escape se queda acá: con el picker abierto se lo come el navegador, y con el
              // picker cerrado tiene que cerrar el editor y NO el modal del proyecto que lo
              // contiene. Gana lo más de adentro.
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditandoFecha(false); } }}
              title={rotFecha} aria-label={rotFecha}
              style={{
                flex: 'none', boxSizing: 'border-box', width: 118, height: 34, padding: '4px 7px',
                borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
                color: 'var(--ink)', fontSize: 12.5, fontFamily: SANS, cursor: 'pointer',
              }} />
          ) : (
            <BtnIcono rotulo={rotFecha} texto="Deadline"
              onClick={() => { pickerAbierto.current = false; setEditandoFecha(true); }}>
              <CalendarioLote />
            </BtnIcono>
          )
        ) : anclaPend ? (
          /* EL SEGUNDO PASO: qué día. Aparece en la MISMA ranura y sólo después de haber
             escrito un ritmo que pide ancla — con «Todos los días» no hay nada que anclar y
             el paso no existe.
             ⚠️ «Sin día» ES LA PRIMERA OPCIÓN Y ES LA SALIDA LIMPIA. `frecuenciaDia` en
             `null` es un estado real del contrato («se repite y nadie dijo cuándo»), así que
             elegirlo cierra el paso sin dejar nada a medias. Y abandonarlo tampoco rompe
             nada: el ritmo ya está guardado. Un control que no se puede cumplir no se pinta;
             éste siempre se puede cumplir. */
          <span title={`Qué día se repiten ${cosas}`} style={{ flex: '0 1 auto', minWidth: 0, display: 'inline-flex' }}>
            <Dropdown
              value=""
              resetAfterSelect
              placeholder={ROTULO_DIA}
              align="right"
              ariaLabel={`Qué día se repiten ${cosas}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoRepite size={14} /></span>}
              buttonStyle={{ height: 34, padding: '0 8px', borderRadius: 9, gap: 4, fontSize: 12.5 }}
              options={[{ value: '', label: 'Sin día' }, ...opcionesDia(anclaPend)]}
              onChange={ponerDia} />
          </span>
        ) : (
          /* EL RITMO, EN LA RANURA QUE DEJÓ EL DEADLINE. La lista sale de `FRECUENCIAS` —la
             única— más «Indefinida», que es el destino que BORRA: sin él, un ritmo puesto de
             más sólo se saca abriendo cada detalle, y el selector de allá sí lo ofrece. Es la
             misma decisión que ya tomó la escalera de ritmos de la vista Recurrentes. */
          <span title={`Cada cuánto se repiten ${cosas}`} style={{ flex: '0 1 auto', minWidth: 0, display: 'inline-flex' }}>
            <Dropdown
              value=""
              resetAfterSelect
              placeholder={ROTULO_FRECUENCIA}
              align="right"
              ariaLabel={`Cada cuánto se repiten ${cosas}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoRepite size={14} /></span>}
              buttonStyle={{ height: 34, padding: '0 8px', borderRadius: 9, gap: 4, fontSize: 12.5 }}
              options={[...FRECUENCIAS.map((f) => ({ value: f.id, label: f.label })), { value: '', label: SIN_FRECUENCIA }]}
              onChange={(v) => ponerRitmo(frecuenciaOk(v))} />
          </span>
        )}

        {/* ⚠️ ACÁ HABÍA UN `<select>` NATIVO, y la casa lo prohíbe con todas las letras
            (app/_ui/Select.tsx:10-12). Además su `maxWidth: 190` no sólo lo techaba: por
            Flexbox §4.5 el max-width clampea el tamaño mínimo automático, así que costaba 190
            px CLAVADOS —no podía encogerse ni crecer— mientras su opción más larga pedía 267.
            El `Dropdown` de la casa cuesta ~52 y trae lo que una lista plana de 70 proyectos
            necesita: buscador (sale solo pasadas las 8 opciones, con el foco entrando solo en
            el campo), el punto de color de cada proyecto, y el menú en un PORTAL
            `position: fixed` con z-index 1000 — lo único que lo salva del `overflow` de
            `cajaStyle` y del modal. `resetAfterSelect` está documentado textualmente para
            esto: «Para selects-acción (ej. "Mover a…")».
            ⚠️ SIN `width`: el ancho va AUTO. Forzarlo no entra — el botón del Dropdown es
            `space-between` con un `gap: 8` hardcodeado en su span interno, así que por debajo
            de ~54 el caret se come al ícono.
            ⚠️ El `title` va en el `<span>` de afuera porque el `Dropdown` NO tiene prop `title`
            y un control se anuncia con los dos. El arreglo de verdad es agregarle `title` AL
            Dropdown, que es lo que manda su propia regla; queda como pendiente.
            El ícono se envuelve en un span que le pisa el `--faint` que el componente le pone
            por dentro, para que el lápiz tenga el mismo `--dim` que los otros cuatro.
            ⚠️ Y NO SE DIBUJA EN LA BARRA DE PROYECTOS: un proyecto no vive adentro de otro
            proyecto, así que el desplegable se llenaría con la propia selección. La prop en
            `null` ES la capacidad ausente. */}
        {cfg.mover && (
          <span title={rotMover} style={{ flex: '0 1 auto', minWidth: 0, display: 'inline-flex' }}>
            <Dropdown
              value=""
              resetAfterSelect
              placeholder="Proyecto"
              align="right"
              ariaLabel={rotMover}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><LapizLote /></span>}
              buttonStyle={{ height: 34, padding: '0 8px', borderRadius: 9, gap: 4, fontSize: 12.5 }}
              options={board.labels.map((l) => ({ value: l.id, label: `${l.emoji} ${l.name}`, color: l.color }))}
              onChange={(id) => {
                if (!id) return;
                const l = board.labelById(id);
                const aplicar = cfg.mover;
                if (!aplicar) return;
                enLote(`${n} a «${l?.name ?? ''}»`, (t) => aplicar(t, id));
              }} />
          </span>
        )}
      </div>

      {/* ── DERECHA: las dos que CIERRAN la tarjeta, juntas y al final. ────────────────
          «El completar tarea y eliminar al final del todo, juntos» (25/09/2026) — y es el
          mismo par, en el mismo orden, que el pie del detalle, la fila de la tabla y la
          tarjeta del Kanban: un control significa lo mismo en todos lados. Van lejos de la
          casilla de la izquierda a propósito: dos controles parecidos pegados es cómo se
          volvieron a confundir seleccionar y completar.
          ⚠️ EN LA BARRA DE PROYECTOS ESTE GRUPO VA VACÍO, y el `div` se queda igual: es el
          `flex: 1` que equilibra a la izquierda y deja el medio centrado. El porqué de las
          dos ausencias está enumerado en la cabecera del archivo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>

        {cfg.estado && (
          <BtnIcono rotulo={rotEstado} tono={todasHechas ? 'good' : 'dim'} pressed={todasHechas}
            onClick={() => {
              const est = cfg.estado;
              if (!est) return;
              enLote(
                todasHechas ? `${n} reabierta${plural}` : `${n} completada${plural}`,
                (t) => { if (est.hecha(t) === todasHechas) est.toggle(t); },
              );
            }}>
            <TildeLote hecho={todasHechas} />
          </BtnIcono>
        )}
        {/* El tacho se IMPORTA de `piezas`: es el mismo dibujo que la fila de la tabla
            (Tablas.tsx:845), la tarjeta y el detalle. `piezas.tsx` sólo importa TIPOS, así que
            no hay ciclo. La consecuencia va pegada al botón y ANTES del click, que es lo que un
            `title` puede hacer donde ya no hay texto; el `ask()` no cambia una coma. */}
        {cfg.borrar && ask && (
          <BtnIcono rotulo={rotBorrar} tono="bad"
            onClick={() => {
              const borrar = cfg.borrar;
              if (!borrar || !ask) return;
              ask(
                `¿Eliminar ${cosas}? Esto no se puede deshacer en lote.`,
                () => { elegidas.forEach(borrar); cerrarEditores(); onLimpiar(); },
              );
            }}>
            <IconoTacho size={16} />
          </BtnIcono>
        )}
      </div>
    </div>
  );
}
