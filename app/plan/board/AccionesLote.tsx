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
// ⚠️ TODA LA BARRA ES ÍCONOS, Y LA CUENTA ES LO QUE LO AUTORIZA (25/09/2026). Con texto
// pedía 899 px donde hay ~499 —el detalle de un proyecto; la cuenta NO se copia acá, vive
// en `ANCHO_TABLA_EN_PROYECTO` (piezas.tsx), que es donde se usa y donde ya dice por qué
// − 44 − 9 − 2, un número FIJO que no mejora con un monitor más grande—, se partía en dos
// renglones y valía 106 px de alto: tres filas de la tabla que la ronda anterior acababa de
// apretar columna por columna. Ahora pide 278 cerrada y 362 con el calendario abierto, y
// mide 48 de alto. Sacarle el `wrap` sin que ENTRE habría devuelto la barra horizontal del
// `overflowX: auto` de `cajaStyle` (Tablas.tsx), que es justo lo que esa ronda mató.
// =============================================================================

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { BoardTask } from './types';
import type { Board } from './useBoard';
import { IconoTacho } from './piezas';
import { Dropdown } from '@/app/components/Dropdown';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// ⛔ ACÁ VIVÍA `btn` — `padding: '6px 11px'`, `fontSize: 12.5`, y cinco rótulos adentro.
// Esa constante es lo que hacía que la barra pidiera 899. Sin texto no hace falta un molde
// de botón de texto: el de ícono ya existe y es `.mk-icon-btn` (globals.css:670).

// ── LOS ÍCONOS ───────────────────────────────────────────────────────────────────────
// ⚠️ EL TACHO SE IMPORTA; EL TILDE Y EL LÁPIZ SON COPIAS DECLARADAS. Los dos originales
// viven en archivos que esta barra NO puede importar sin ciclo: `BoardShell` y `Tablas` son
// los que la MONTAN. Es la misma razón por la que `IconoTacho` vive en `piezas.tsx` y no en
// BoardShell — la lápida de la copia anterior está en BoardShell.tsx:1480-1487. La cura de
// verdad son dos renglones: mudar el path del tilde (`CheckHecho`, BoardShell.tsx:1472) y el
// SVG de `LapizPrioridad` (PrioridadAMano.tsx:48) a `piezas.tsx` e importarlos desde los dos
// lados. Van marcadas con su origen para que el día que alguien toque una se acuerde de la
// otra.

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

export function AccionesLote({ elegidas, board, ask, onLimpiar, estilo }: {
  elegidas: BoardTask[];
  board: Board;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
  onLimpiar: () => void;
  estilo?: CSSProperties;
}) {
  // ⚠️ LOS DOS HOOKS VAN ARRIBA DEL `return null`, NO ABAJO. El call site de la tabla
  // (Tablas.tsx:858) dibuja esta barra SIEMPRE —el del Kanban, BoardShell.tsx:2864, la
  // envuelve en `elegidas.length > 0 &&`, así que ahí sí desmonta—, o sea que el return de
  // abajo corre en casi todos los renders. Un hook detrás de él es el «Minified React error
  // #300»: la pantalla entera en blanco, sin archivo ni línea. Lo bloquea el pre-push
  // (scripts/hooks-en-orden.sh) y es la razón por la que este archivo no tenía un solo hook
  // hasta hoy.
  const [editandoFecha, setEditandoFecha] = useState(false);
  const pickerAbierto = useRef(false);

  if (!elegidas.length) return null;

  // ⚠️ Y en la tabla `return null` NO DESMONTA: la instancia queda viva con su estado. Por
  // eso el editor de fecha se cierra ACÁ, en el único lugar por donde pasan las cuatro
  // acciones — si no, la próxima selección nace con el input abierto en vez del ícono.
  const enLote = (texto: string, aplicar: (t: BoardTask) => void) => {
    const snaps = elegidas.map((t) => ({ ...t }));
    elegidas.forEach(aplicar);
    setEditandoFecha(false);
    onLimpiar();
    board.showUndo(texto, () => snaps.forEach((snap) => board.replaceTask(snap)));
  };

  // ⚠️ UN SOLO BOTÓN PARA LAS DOS DIRECCIONES. «Elimina el "Reabrir", sería lo mismo que
  // "completar" solo que si lo aprieto a la inversa se descompleta, pero no debe haber 2
  // botones» (24/09/2026). Con dos, uno de los dos siempre está de más: sobre una selección
  // de tareas abiertas, «Reabrir» no hace nada y viceversa — un botón que no puede hacer
  // nada se lee como que la app está rota. El sentido lo decide la selección: si TODAS están
  // hechas, descompleta; si no, completa. Sin texto, lo que dice en qué dirección va es el
  // `title` (el verbo), y lo que dice en qué estado está es el grosor del trazo +
  // `aria-pressed`.
  const todasHechas = elegidas.every((t) => t.progress >= 100);
  const n = elegidas.length;
  const plural = n === 1 ? '' : 's';
  // Sin texto en pantalla, el `title` es el ÚNICO lugar donde se dice sobre QUÉ actúa cada
  // botón: «Eliminar» a secas no nombra su objeto.
  const tareas = n === 1 ? '1 tarea' : `${n} tareas`;
  const rotCuenta = `${tareas} seleccionada${plural}`;
  // «Reabrir», no «Descompletar»: es lo que ya dicen la fila de la tabla (Tablas.tsx:475) y
  // el toast de deshacer («3 reabiertas»). Era la única de las tres superficies que decía
  // otra cosa. Y el `↺` se va sin que se extrañe: no tiene glifo en Geist, lo dibujaba la
  // fuente del sistema.
  const rotEstado = `${todasHechas ? 'Reabrir' : 'Completar'} ${tareas}`;
  const rotMover = `Mover ${tareas} a un proyecto`;
  const rotFecha = `Ponerle${plural} deadline a ${tareas}`;
  const rotBorrar = `Eliminar ${tareas} — no se puede deshacer`;

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
    // ⚠️ Y `space-between` sobre los seis controles SUELTOS tampoco era: con la barra al
    // ancho del Kanban (~1.900 px) los repartió uno por esquina, cada uno a 300 px del
    // siguiente. «No tiene sentido esta distribución» (25/09/2026). Lo que se reparte son
    // TRES GRUPOS, no seis piezas — y cada grupo se mantiene junto por dentro.
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
    // ⚠️ EL `flexWrap: 'wrap'` NO ES EL DE ANTES, aunque sea la misma línea. Antes era el
    // CAMINO —la barra pedía 899 px donde hay 499, así que se partía en dos renglones
    // siempre, que es lo que Martín reportó—; ahora es la RED. Medido en Chrome sobre el
    // componente real: 216 px cerrada y 300 con el calendario abierto, así que en un renglón
    // entra en cualquier ancho de esta app menos un teléfono angosto con el calendario
    // abierto (~375 px de viewport en el Kanban, donde la banda mide viewport − 128).
    //
    // Ahí el `wrap` es lo correcto y el `nowrap` es lo peligroso: sin él, lo que no entra no
    // baja de renglón sino que DESBORDA, y el Kanban no tiene ningún ancestro con `overflow`,
    // así que la barra horizontal se la come la PÁGINA entera. Es la regla de la casa para
    // una barra que no entra —baja de renglón, nunca scrollea de costado— y es gratis:
    // en las tres pantallas donde Martín la mira, nunca se dispara.
    //
    // ⚠️ Y EL QUE CEDE ES EL GRUPO DEL MEDIO, que ahora sí puede: desde que la fecha y el
    // proyecto llevan su palabra hay algo que RECORTAR. Mientras fueron íconos pelados, el
    // `flex: 0 1 auto` era una red decorativa —un ícono no se elipsa, y el botón tocaba
    // fondo en ~54 px—, que es justo lo que la regla de la casa quiere decir con «declará
    // quién cede»: ceder en el tipo no es ceder en píxeles. Los grupos de los costados van
    // `flex: none` porque son los que no se pueden perder: con qué se está trabajando, y
    // las dos acciones que cierran.
    //
    // LA CUENTA, contra los ~499 del lugar más angosto (el detalle de un proyecto):
    //   izquierda  16 casilla + 8 + 24 número               =  48
    //   medio      ~96 «Deadline» (118 abierto) + 14 + ~108 «Proyecto» = ~218 / ~240
    //   derecha    34 tilde + 6 + 34 tacho                  =  74
    //   los dos huecos entre grupos, como mínimo            =  20
    //   padding 24 + borde 2                                =  26
    //   ───────────────────────────────────────────────────────────
    //   ~386 cerrada · ~408 con el calendario abierto, o sea >90 px de aire.
    //
    // Las palabras cuestan ~116 px sobre la versión de sólo íconos y se pagan con eso. El
    // tilde y el tacho se quedan SIN palabra a propósito y no es por ahorrar: significan lo
    // mismo en la fila, en la tarjeta y al pie del detalle, así que ahí el ícono ya es el
    // nombre. La fecha y el proyecto no tienen esa suerte — un calendario suelto no dice
    // QUÉ fecha.
    <div role="group" aria-label={`Acciones sobre ${tareas}`}
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
          onClick={() => { setEditandoFecha(false); onLimpiar(); }}
          title="Quitar la selección" aria-label={`${rotCuenta}. Quitar la selección`}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
        <span role="status" title={rotCuenta} aria-label={rotCuenta}
          style={{ flex: 'none', minWidth: 24, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
          {n}
        </span>
      </div>


      {/* ── MEDIO: lo que CAMBIA la tarea, y acá sí con su palabra. ────────────────────
          «En el medio la fecha y el proyecto, que sería bueno que no sean solo íconos, pero
          cuida que entre bien todo» (25/09/2026). Son los dos únicos controles de la barra
          que no se adivinan por su forma: un tilde y un tacho significan lo mismo en toda la
          app, y un calendario y un lápiz sueltos no dicen QUÉ fecha ni qué se edita.

          El ancho que cuesta la palabra está medido contra el lugar más angosto (~499 px, el
          detalle de un proyecto): «Deadline» lleva el botón de 34 a ~96 y «Proyecto» el
          Dropdown de ~54 a ~108, o sea +116 sobre los 216 de antes. Con los tres grupos y sus
          dos huecos mínimos da ~365 cerrada y ~391 con el calendario abierto: entran, con más
          de 100 px de aire. Los otros dos se quedan como íconos justamente para pagar esto. */}
      {/* ⚠️ `gap: 14` Y NO 6. «No los pongas tan juntos a los del medio» (25/09/2026): son
          los DOS ÚNICOS controles de la barra que tienen borde Y palabra, y a 6 px sus dos
          cajas se tocan y se leen como un solo bloque partido por una raya. Los de los
          costados pueden ir apretados porque son íconos sueltos sin caja —ahí el aire lo pone
          el propio botón—; dos pastillas necesitan el doble. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none', justifyContent: 'center' }}>

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
        {editandoFecha ? (
          <input type="date" autoFocus
            ref={(el) => {
              if (!el || pickerAbierto.current) return;
              pickerAbierto.current = true;
              try { el.showPicker?.(); } catch { /* sin picker nativo queda el input, que igual se edita */ }
            }}
            onChange={(e) => {
              const v = e.target.value;
              setEditandoFecha(false);
              if (v) enLote(`Deadline ${v} en ${n}`, (t) => board.setDeadline(t.id, v, t.deadline));
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
            por dentro, para que el lápiz tenga el mismo `--dim` que los otros cuatro. */}
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
              enLote(`${n} a «${l?.name ?? ''}»`, (t) => board.setTaskLabels(t.id, [id], `Movida a «${l?.name ?? ''}»`));
            }} />
        </span>
      </div>

      {/* ── DERECHA: las dos que CIERRAN la tarjeta, juntas y al final. ────────────────
          «El completar tarea y eliminar al final del todo, juntos» (25/09/2026) — y es el
          mismo par, en el mismo orden, que el pie del detalle, la fila de la tabla y la
          tarjeta del Kanban: un control significa lo mismo en todos lados. Van lejos de la
          casilla de la izquierda a propósito: dos controles parecidos pegados es cómo se
          volvieron a confundir seleccionar y completar. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>

        <BtnIcono rotulo={rotEstado} tono={todasHechas ? 'good' : 'dim'} pressed={todasHechas}
          onClick={() => enLote(
            todasHechas ? `${n} reabierta${plural}` : `${n} completada${plural}`,
            (t) => { if (todasHechas ? t.progress >= 100 : t.progress < 100) board.toggleDone(t.id); },
          )}>
          <TildeLote hecho={todasHechas} />
        </BtnIcono>
        {/* El tacho se IMPORTA de `piezas`: es el mismo dibujo que la fila de la tabla
            (Tablas.tsx:845), la tarjeta y el detalle. `piezas.tsx` sólo importa TIPOS, así que
            no hay ciclo. La consecuencia va pegada al botón y ANTES del click, que es lo que un
            `title` puede hacer donde ya no hay texto; el `ask()` no cambia una coma. */}
        <BtnIcono rotulo={rotBorrar} tono="bad"
          onClick={() => ask(
            `¿Eliminar ${n} tarea${plural}? Esto no se puede deshacer en lote.`,
            () => { elegidas.forEach((t) => board.removeSilent(t.id)); setEditandoFecha(false); onLimpiar(); },
          )}>
          <IconoTacho size={16} />
        </BtnIcono>
      </div>
    </div>
  );
}
