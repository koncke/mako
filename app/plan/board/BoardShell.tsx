'use client';

// =============================================================================
// BoardShell — la ÚNICA vista del tablero /todo (admin y cliente idénticos)
// =============================================================================
// Recibe un `Board` (useBoard) y pinta todo: header con avance promedio, toggle
// Prioridades/Kanban, 4 columnas de prioridad a ancho completo con DnD, tarjetas
// cuadradas (estilo CRM) con avance editable inline, modal con checklist + coach
// de MaKo + Change history (avatar + deshacer por entrada), editor de proyectos
// con emoji, y el form bloqueante para tareas Alta sin deadline/checklist.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UndoToast } from '../../_components/UndoToast';
import { ConfirmModal } from '../../_components/ConfirmModal';
import { MakoChecklistModal } from './MakoChecklist';
import { pasosComoBullets } from '@/lib/detalle-fusion';
import { CrearTareaModal } from './CrearTareaModal';
import { CrearProyectoModal } from './CrearProyecto';
import { EliminarModal } from './EliminarModal';
import { AsignarProyectoModal } from './AsignarProyecto';
// DE QUIÉN es una tarjeta (mig 0172). El picker y el chip viven juntos para que la tarea y
// el proyecto no los puedan dibujar distinto; el contrato (rótulo, «Interno», el predicado)
// sale del módulo compartido que también leen el server y Customer Success.
import { AsignarClienteModal, ClienteChip } from './AsignarCliente';
import { clienteDe, ROTULO_CLIENTE, SIN_CLIENTE, type ClienteRef } from '@/lib/plan-clientes';
// LA PORTADA de un proyecto (mig 0173). El selector es EL MISMO que usa la ficha de un
// cliente: la pregunta «¿qué se ve arriba?» se contesta en un solo lugar o se contesta de
// dos formas distintas según de dónde la abriste.
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import { IdentidadPicker } from '@/app/_components/IdentidadPicker';
import { Marca } from '@/app/_components/Marca';
import { useReposicionar, BarraReposicion } from '@/app/_components/Reposicionar';
import { PortadaDetalle, FilaDetalle } from '@/app/_components/CabeceraDetalle';
import { EditableInline } from '@/app/_components/EditableInline';
import { fondoPortada, esFoto, urlPortada } from '@/lib/portadas';
import { AudienciaModal } from './AudienciaModal';
import { LapizPrioridad, MoverPrioridadModal } from './PrioridadAMano';
import { MakoProyectoModal } from './MakoProyecto';
import { useVerMas } from './VerMas';
// ⚠️ EL DESPLEGABLE, SU DIÁLOGO Y LA LISTA DE OPCIONES VIENEN DE ACÁ Y NO DE `lib/`, y el
// motivo es el grafo de imports: `AccionesLote` es la única HOJA de los tres archivos del
// tablero —`Tablas` y `BoardShell` la montan, ella no importa a ninguno—, así que es el
// único lugar del que los tres pueden leer sin ciclo. Y no van en `lib/plan-recurrentes.ts`
// —donde vive todo el resto del campo— porque no son datos del modelo: son cómo esta
// pantalla dibuja el campo. `RepeticionModal` es el diálogo «Personalizado…» de Google,
// COMPARTIDO con la barra de lote: devuelve una RRULE y no sabe a quién se le aplica.
import { AccionesLote, AccionesLoteProyectos, opcionesRepeticion, canonRRule, VALOR_PERSONALIZADO, RepeticionModal } from './AccionesLote';
import { Dropdown } from '@/app/components/Dropdown';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ImportarModal } from './ImportarModal';
import { ReunionExtractModal } from './ReunionExtractModal';
import { TareasRecibidasModal, type PropuestaPendiente } from './TareasRecibidasModal';
import { DatosModal, type FaltanteItem } from './DatosModal';
import { TareasCreadasModal } from './TareasCreadasModal';
import { MakoStar } from '../../_components/MakoBrand';
import { GuardianIcon } from './GuardianIcon';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { SvcIcon, BrandDefs } from '../../_components/ServicioVisual';
import { ScoreIcon } from './guardian-form';
import { BuscadorTareas } from './BuscadorTareas';
import { matchTarea, coincide, CAMPOS_POR_DEFECTO, type CampoBusqueda } from '@/lib/buscar-tareas';
import { RichText, mdAHtml, stripHtml, FOCO_BARRA } from './RichText';
import type { Board } from './useBoard';
import { separarRepetidas, textoRepetidas } from '@/lib/tareas-dedup';
import { type BoardTask, type Label, type Prio, type Check, type Actor, type Fuente, type FuenteTipo, ACTOR_LABEL, PRIOS, PLABEL, PCOLOR, SWATCHES, MAX_PRIORIDAD, scoreFromPrio, uid, relTime, fechaHora, fuenteEfectiva, prioFromScore, displayPrio } from './types';
import { resolverDeps, estaBloqueada, type EstadoDeps, type Dep } from './dependencias';
import { ESCALERA } from './types';
import { DependenciasBloque } from './DependenciasBloque';
import { apiPlan } from './repo-plan';
// El Link propio, NUNCA next/link: preserva el ?ws= de la pestaña (AGENTS.md).
import Link from '@/app/_ui/Link';
import { diasQuieta, diasAlDeadline, ajusteTemporal } from './envejecer';
import { ExportarModal } from './ExportarModal';
import { NotasLista } from './NotasLista';
// Los cuatro títulos del `detalle` salen del contrato, no de una copia local: son
// EXACTOS y el que los escribe, el que los valida y el que ahora los pliega tienen que
// mirar la misma lista (AGENTS.md → «Una cosa, un lugar»).
import { PARTES_DETALLE, PARTES_PROYECTO } from '@/lib/detalle-contrato';
import { capacidad } from '@/lib/mako-capacidades';
import { cuandoDe, quartersElegibles, quarterDeFecha, esCuando, CUANDO_LABEL, CUANDO_OPS, type Cuando } from './cuando';
import { usePref, usePrefSet, esUnoDe, esBool, setScopePrefs } from './prefs';
import { useArrastreTactil, type ArrastreTactil } from './arrastre-tactil';
import { WarnMark, projProgress, proyectoTerminado, fechaConDia, diasHasta, plazoTexto, LineaDeadline, IconoTacho, RepiteChip, IconoRepite, hoyISO, COL_DER, MODAL_DETALLE } from './piezas';
// ⚠️ `LineaRepeticion` VIVE EN `Tablas.tsx` Y NO ACÁ, y el motivo es el grafo de imports:
// este archivo ya importa de aquél, así que al revés sería un ciclo. El lugar que le
// correspondería por tema es `piezas.tsx`; queda anotado y no hecho porque ese archivo no es
// de esta pasada. Lo que NO puede pasar —y no pasa— es que la tarjeta y la fila digan la
// misma cosa con dos textos distintos: la pieza es una sola.
// ⚠️ `SIN_REPETICION` NO ENTRA MÁS POR ACÁ (26/09/2026). `Tablas` lo re-exportaba «para no
// partir en dos la lista de lo que este archivo le pide al de al lado», y el resultado fue
// una constante entrando por dos puertas: ésta y `AccionesLote`, que es donde vive y que
// este archivo importa igual. Hoy no se usa acá —la opción «Indefinida» la pone
// `opcionesRepeticion`, que es la única lista— así que directamente no se importa.
import { TablaProyectos, TablaTareas, LineaRepeticion } from './Tablas';
// LAS TAREAS QUE SE REPITEN. El rótulo, el predicado y el filtro salen del módulo de datos
// —`ROTULO_RECURRENTE` / `esRecurrente` / `sinRecurrentes`—, no de un `t.recurrente` suelto
// en una pantalla: es el mismo criterio que el catálogo de proyectos o la gramática de MaKo.
// El módulo no lleva `server-only` a propósito, para que lo pueda importar este `'use client'`.
// ⚠️ `llevaDeadline` ES LA CONDICIÓN DE LOS DOS CAMPOS QUE DESAPARECEN (deadline y Quarter,
// en el detalle de una tarea y en el de un proyecto). Se importa la REGLA y no se escribe
// `!repite` en cada uno: es la misma que aplican `taskToRow` y `useBoard`, y el día que una
// recurrente lleve la fecha del próximo ciclo cambia en un solo lugar.
// `PORQUE_NO_COMPITE` y `PORQUE_SIN_FECHA` ya NO se importan: los dos renglones que los
// pintaban se fueron con la glosa y con el campo. Siguen vivos —el server los manda al
// rechazar una re-priorización y el historial los escribe al borrar la fecha—, y acá sólo
// se los nombra en comentarios, que no necesitan el import.
// ⚠️ Y CADA CUÁNTO SE REPITE (mig 0167) SALE DE LA MISMA PUERTA, EN **UN SOLO CAMPO**: una
// RRULE de RFC 5545, que es lo que guarda Google Calendar por debajo. `recurrenciaDe` es la
// invariante «una recurrencia sin `recurrente` no existe», que se aplica también al LEER
// para que una fila vieja con los dos campos cruzados no afirme un ritmo sobre algo que sí
// vence, y `ROTULO_REPETICION` es el nombre del campo en pantalla.
// ⛔ YA NO SE IMPORTA NADA DE `frecuencia` NI DE `frecuencia_dia`. Eran DOS campos
// —un enum de seis ritmos y UN día— y no podían expresar lo que Martín pidió: varios días a
// la vez, un intervalo («cada 3 semanas») ni un ordinal («el segundo martes»). Cada una de
// esas tres habría sido otra columna, y una recurrencia tiene UNA forma por vez: con cuatro
// columnas, pasar de «cada semana, los lunes» a «cada mes» deja las viejas vivas
// contradiciendo a la nueva. Las columnas siguen existiendo en la base hasta la 0168, pero
// este código no las nombra: dos modelos de lo mismo es el bug que la 0167 vino a cerrar.
import { ROTULO_RECURRENTE, esRecurrente, sinRecurrentes, llevaDeadline, recurrenciaDe, ROTULO_REPETICION } from '@/lib/plan-recurrentes';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/* ⛔ `hoyISO` se fue a `./piezas` el 28/09/2026, con su comentario. Vivía acá como
   const local y la necesitó una segunda pantalla (el tablero de un cliente adentro
   del panel de la plataforma); copiarla habría sido la segunda copia de una regla de
   zona horaria, que es de las que se quedan viejas sin que nada avise. */

// ⚠️ «tareas», NO «kanban», y la ruta también: «cambia el nombre y la ruta de kanban por
// tareas, que es más preciso» (23/09/2026). Kanban es CÓMO se dibuja —y desde que existe la
// vista de tabla ya ni siquiera es siempre un kanban—; lo que hay ahí son las tareas.
// ⚠️ «recurrentes» VA JUSTO DESPUÉS DE «proyectos», y el orden del array ES el orden de las
// tabs. Es una vista y no un filtro de «Tareas» porque la razón de existir no es poder
// verlas juntas: es que NO ENSUCIEN EL RANKING. El Perro puntúa por «qué mueve la aguja» y
// le pone deadline a todo; algo que se repite para siempre no tiene fin ni deadline real,
// así que competía por un puesto que no le corresponde. La vista es la consecuencia de
// sacarlas; la causa es la exclusión — y por eso también salen de «Tareas» y de
// «Prioridades», no sólo se agrupan acá.
//
// (El criterio es de Mauricio, 16/07/2026: «acá lo que entran son tareas que tienen un
// inicio y tienen un fin». En el producto se llama RECURRENTES y en ninguna pantalla se
// escribe la sigla con la que él lo nombró: «el nombre tal vez no es muy conocido».)
// ⚠️ `graphics` SE FUE DE ACÁ EL 26/09/2026 y ahora es una TAB propia: «Productivity
// Analyst», adentro del desplegable de Analysts (`app/productivity-analyst`). No era una
// vista del tablero como las otras cuatro —no se filtra, no se ordena, no se arrastra y no
// escribe nada—: es un análisis de lo que el tablero produjo, que es exactamente lo que
// hacen los Analysts. Si vuelve a hacer falta acá, `GraphicsView` sólo pide `tasks` y
// `labels`; lo que NO se puede es montar un segundo `useBoard` para dibujarla.
const VISTAS = ['prioridades', 'tareas', 'proyectos', 'recurrentes'] as const;
type Vista = (typeof VISTAS)[number];
// ⚠️ `kanban` SIGUE RESOLVIENDO, para siempre. Es el nombre que tuvo la vista hasta el
// 23/09/2026 y vive en links compartidos, en favoritos y en la barra de direcciones de
// cualquiera que la haya usado. Renombrar sin redirigir es romperlos en silencio (AGENTS.md:
// «sacar algo de un catálogo no es borrarlo: hay gente apuntándole»).
const ALIAS_VISTA: Record<string, Vista> = { kanban: 'tareas' };
const vistaValida = (v: unknown): Vista | null => {
  const k = String(v);
  if ((VISTAS as readonly string[]).includes(k)) return k as Vista;
  return ALIAS_VISTA[k] ?? null;
};

/**
 * La caja del tablero: `<main>` cuando ES la pantalla, un `<div>` cuando vive adentro de
 * otra (la ficha de un cliente).
 *
 * ⚠️ EL LAYOUT DE ADENTRO NO CAMBIA, y eso es un requisito. Un cliente reportó TRES veces
 * «el plan está vacío» desde Safari mientras en Chrome se veía perfecto: la grilla con filas
 * `auto 1fr` le da a la fila del cuerpo un alto DEFINIDO, que es lo único que todos los
 * motores resuelven igual. Lo que cambia embebido son las dos cosas que sólo valen para una
 * pantalla: la etiqueta `<main>` (un `<main>` dentro de otro no es HTML válido) y el
 * `minHeight` de 100vh (adentro de una caja topada en `min(85vh, 720px)` obliga a scrollear
 * el cuerpo del modal aunque el cliente tenga dos tareas).
 *
 * El `100vh` MENOS la barra de agencia: mirando el tablero de un cliente, con `100vh` a
 * secas el board mide 50 px más que el hueco que le queda —la barra empuja el body— y se
 * come la franja de abajo del kanban. La variable vale 0px cuando no hay barra. Va CON
 * fallback: un `calc()` con una variable vacía es inválido en tiempo de cómputo y se cae la
 * declaración entera, o sea que el alto desaparece.
 *
 * Y SIN `overflow: hidden`: era lo que convertía «midió mal» en «no se ve nada». En el peor
 * caso la página scrollea, que es un defecto que se entiende y se puede contar por teléfono.
 */
function Marco({ embebido, children }: { embebido: boolean; children: ReactNode }) {
  const estilo: CSSProperties = {
    flex: 1, minWidth: 0, display: 'grid', gridTemplateRows: 'auto 1fr', fontFamily: SANS,
    ...(embebido ? {} : { minHeight: 'calc(100vh - var(--barra-agencia, 0px))' }),
  };
  return embebido ? <div style={estilo}>{children}</div> : <main style={estilo}>{children}</main>;
}

export function BoardShell({ board, scope, vistaInicial, clientes = [], embebido = false, vistaExtra, onRecargar }: {
  board: Board;
  /**
   * Los clientes elegibles: los leads GANADOS del workspace (mig 0172). Los lee la PÁGINA
   * en el server y bajan como prop — no hay endpoint de búsqueda de leads y no hace falta
   * uno: son 14 en el workspace más grande del producto, medido el 26/09/2026.
   *
   * ⚠️ VACÍO ES UN ESTADO REAL, no un error: un workspace que todavía no ganó ninguna venta
   * no tiene a quién asignarle nada, y el picker lo dice en una frase. Por eso el default
   * es `[]` y no hay un estado de carga.
   */
  clientes?: ClienteRef[];
  /** scope de las preferencias locales (por workspace): no se mezclan entre impersonaciones. */
  scope?: string;
  /**
   * La vista con la que arranca, LEÍDA EN EL SERVER desde `?vista=` (app/plan/agencia/page.tsx).
   * No se lee acá de `window`: el server renderiza «prioridades», el cliente corregiría después
   * de hidratar, y eso son dos cosas malas a la vez — un parpadeo en cada refresh y un aviso
   * de hidratación desalineada. Opcional porque el board del CLIENTE todavía no la pasa.
   */
  vistaInicial?: string;
  /**
   * UNA VISTA MÁS, al final de las cuatro.
   *
   * ⚠️ VA EN EL MISMO SELECTOR Y NO EN UNO PROPIO. «Pusiste 2 seleccionables de tabs,
   * arriba tablero y equipo y abajo las otras cuatro… tienes que quitar lo de arriba, y
   * simplemente agregar Equipo luego de Recurrentes» (28/09/2026). Dos filas de tabs una
   * encima de la otra son dos mapas para la misma pantalla, y quien la mira tiene que
   * adivinar cuál manda.
   *
   * Es un slot y no una lista de vistas: lo que va adentro es de la pantalla que monta
   * el board (hoy, el equipo de un cliente en el panel de la plataforma), y el board no
   * tiene por qué saber qué es.
   */
  vistaExtra?: { id: string; label: string; contenido: ReactNode };
  /**
   * ⚠️ NO SOY LA PANTALLA: estoy montado ADENTRO de otra (hoy, la ficha de un cliente).
   *
   * El tablero fue escrito asumiendo que ES la ruta, así que guarda su estado en la URL:
   * `?vista=`, `?tarea=` y `?proyecto=`, y los LEE al montar para abrir ese detalle. Eso
   * está bien en `/plan` —el link que copiás es la pantalla que ves— y es destructivo
   * adentro de un modal:
   *
   *   · escribe en la URL de OTRA ruta (`/customer-success?tarea=…`), que no sabe qué hacer
   *     con eso; y
   *   · al volver a abrir la ficha, el deep-link vuelve a abrir ese detalle solo. Medido el
   *     27/09/2026: quedaba un `?tarea=` pegado y desde ahí el cliente ya no se podía abrir
   *     — cada intento montaba el tablero, que abría el detalle, que tapaba todo.
   *
   * Con esto la URL no se toca ni se lee. El estado vive en React, que es donde tiene que
   * vivir el estado de algo que se abrió adentro de un modal.
   */
  embebido?: boolean;
  /**
   * CÓMO SE RECARGA DESPUÉS DE UNA ESCRITURA GRANDE DEL SERVER. Por default,
   * `window.location.reload()`, que es lo correcto cuando el tablero ES la pantalla.
   *
   * ⚠️ EMBEBIDO TIENE QUE PASARLA, O LA ACCIÓN TE EXPULSA. Adentro de la ficha, qué cliente
   * está abierto es estado de React en `ClientesApp` y no viaja en la URL: un `reload()`
   * cierra la ficha y te deja en la grilla después de una acción que no pidió navegar. La
   * ficha pasa un `router.refresh()`, que revalida el render del server sin desmontar el
   * árbol del navegador.
   */
  onRecargar?: () => void;
}) {
  
  // G1/G2 guardián: score→columna, restricción al proyecto top, debate.
  const { tasks, labels, repo } = board;
  /**
   * EL TABLERO PARTIDO EN DOS UNIVERSOS, Y ACÁ ARRIBA PORQUE LO USAN SIETE LUGARES.
   *
   * `conFin` son las tareas que tienen un inicio y un fin: las únicas que se rankean, que
   * se cuentan y que contestan «¿qué hago ahora?». `lasRecurrentes` son las que se repiten
   * para siempre, y tienen su propia vista.
   *
   * ⚠️ NO ALCANZA CON SACARLAS DE LA VISTA: HAY QUE SACARLAS DE LOS CONTADORES. Es la
   * trampa del «consumidor huérfano» de AGENTS.md, y acá había cuatro esperando:
   *   · el avance «del plan» (`avg`): una recurrente clavada en 0% para siempre lo baja de
   *     forma permanente, y el número nunca puede volver a 100.
   *   · «N/M del plan»: el denominador contaría lo que la vista ya no muestra.
   *   · el ⚠ de «tareas sin fecha» (`faltantes`): una recurrente no puede tener fecha, así
   *     que el triangulito rojo titilaría para siempre sobre algo a lo que no le falta nada
   *     — y el contador crecería solo con cada recurrente nueva.
   *   · las 5 tarjetas de Prioridades: una recurrente ocupando 1 de 5 es el 20% de la
   *     pantalla del día contestando otra pregunta.
   */
  const conFin = sinRecurrentes(tasks);
  const lasRecurrentes = tasks.filter(esRecurrente);
  /**
   * ⚠️ UN PROYECTO TAMBIÉN SE REPITE (mig 0164, 26/09/2026): «un proyecto también se puede
   * repetir». El cliente al que se le atiende todas las semanas, el mantenimiento — no
   * tienen inicio ni fin, así que caen bajo el MISMO criterio que una tarea recurrente y
   * salen por el MISMO predicado (`esRecurrente` acepta cualquier `{ recurrente?: boolean }`,
   * así que sirve para un `Label` sin tocarlo). Dos filtros distintos para la misma pregunta
   * son las dos copias que este módulo existe para evitar.
   */
  const losProyectosRecurrentes = labels.filter(esRecurrente);
  // ⚠️ `Vista | string` y no sólo `Vista`: con `vistaExtra` el valor puede ser un id que
  // el board no conoce. Las comparaciones contra las cuatro literales siguen tipando, y
  // la extra se compara contra su propio id.
  // ⚠️ Y `vistaInicial` PUEDE SER LA EXTRA. `vistaValida` sólo conoce las cuatro
  // literales, así que sin este `??` un deep-link a la vista de más («ver su equipo»)
  // abría Prioridades y el control que llevaba ahí se leía como roto.
  const [view, setView] = useState<Vista | string>(
    vistaValida(vistaInicial)
    ?? (vistaExtra && vistaInicial === vistaExtra.id ? vistaExtra.id : 'prioridades'),
  );
  /**
   * LO TILDADO EN LA VISTA TAREAS, Y VIVE ACÁ PORQUE ACÁ NO SE DESMONTA.
   *
   * «Si estoy seleccionando en lote desde una vista, como la de tarjetas, y paso a la vista
   * de tabla, debería seguir la selección tal cual» (04/10/2026). El conmutador de formato
   * cambia de COMPONENTE —`Kanban` o `TablaTareas`—, así que un `useState` adentro de
   * cualquiera de los dos muere con el desmonte. No hay forma de que sobreviva sin sacarlo
   * del que se desmonta, y el pedido es exactamente eso.
   *
   * ⚠️ NO VA POR `prefs.ts`, y no es por comodidad: ese archivo dice con todas las letras
   * que guarda una PREFERENCIA y nunca una decisión. Y además no funcionaría — `usePref`
   * arranca con el default y lee recién en el primer efecto, así que la barra parpadearía
   * vacía al cambiar de formato; y `usePrefSet` persiste al F5, con lo que el tablero
   * abriría con doce tarjetas tildadas que nadie eligió en esta sesión.
   */
  const [selTareasVista, setSelTareasVista] = useState<ReadonlySet<string>>(new Set());
  /**
   * ⚠️ Y SE LIMPIA AL CAMBIAR DE VISTA, no al conmutar formato. Subirla acá la hace
   * sobrevivir también al cambio de tab, y eso NO es lo que se pidió: una barra que
   * reaparece con doce tildadas al volver a Tareas después de haber estado en otra cosa es
   * una acción destructiva esperando — la persona no eligió esas doce en este momento.
   *
   * Y lo que lo decide no es sólo prudencia: los universos de las vistas son DISJUNTOS por
   * construcción (`conFin` contra `lasRecurrentes`), así que una selección arrastrada de
   * Tareas a Recurrentes intersecta en cero ítems y la barra aparecería vacía — se lee como
   * que la selección se perdió, y al volver reaparece sola.
   */
  useEffect(() => { setSelTareasVista(new Set()); }, [view]);
  const [openProj, setOpenProj] = useState<string | null>(null);
  const [peekProjId, setPeekProjId] = useState<string | null>(null); // proyecto abierto DESDE una tarea (encima de ella; feedback jul-19)
  const [nuevoProj, setNuevoProj] = useState(false);
  const [nuevaTareaProj, setNuevaTareaProj] = useState<string | null>(null); // proyecto donde crear la tarea nueva
  const [nuevaTareaPrio, setNuevaTareaPrio] = useState<Prio | null>(null);   // columna desde la que se creó (precompleta la prioridad)
  const [eliminarTaskId, setEliminarTaskId] = useState<string | null>(null);
  const [eliminarProjId, setEliminarProjId] = useState<string | null>(null);
  const [asignarTaskId, setAsignarTaskId] = useState<string | null>(null);
  /** Qué tarjeta está eligiendo cliente. Uno solo para las dos entidades: el modal es el
   *  mismo y abrir dos a la vez no tiene sentido. */
  const [asignarCli, setAsignarCli] = useState<{ tipo: 'tarea' | 'proyecto'; id: string } | null>(null);
  /** El proyecto al que se le está eligiendo portada (mig 0173), y DE QUÉ BOTÓN cuelga
   *  el popover: el ancla es el nodo, no un rect (ver PortadaPicker). */
  const [portadaDe, setPortadaDe] = useState<{ id: string; ancla: HTMLElement } | null>(null);
  /** Idem para el ICONO del proyecto (mig 0174). */
  const [iconoDe, setIconoDe] = useState<{ id: string; ancla: HTMLElement } | null>(null);
  const [debateProjId, setDebateProjId] = useState<string | null>(null);
  const [makoHintId, setMakoHintId] = useState<string | null>(null); // tarea recién creada → sugerir "MaKo te ayuda"
  const [makoProjId, setMakoProjId] = useState<string | null>(null); // "MaKo te ayuda" para un proyecto
  const [q, setQ] = useState('');
  // DÓNDE busca la barra. Por defecto SOLO el título: buscar una palabra y recibir media
  // lista porque la palabra estaba en el detalle de treinta tareas es lo que hacía antes.
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_POR_DEFECTO);
  // La búsqueda con MaKo devuelve IDS, no un texto: se filtra por pertenencia, no por
  // coincidencia. `ids === null` = no hay búsqueda con IA activa.
  const [ia, setIa] = useState<{ pensando: boolean; ids: string[] | null; explico: string }>({ pensando: false, ids: null, explico: '' });
  const idsIA = useMemo(() => (ia.ids ? new Set(ia.ids) : null), [ia.ids]);

  const buscarConIA = async (texto: string) => {
    setIa({ pensando: true, ids: null, explico: '' });
    const j = await fetch('/api/plan-buscar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: texto }), signal: AbortSignal.timeout(60_000) })
      .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (!j.ok) { setIa({ pensando: false, ids: null, explico: '' }); alert(j.error || 'No pude buscar.'); return; }
    setIa({ pensando: false, ids: (j.ids ?? []).map(String), explico: String(j.explico ?? '') });
  };
  // El scope va ANTES de cualquier usePref: la lectura ocurre en el primer efecto de cada
  // hook, y esto corre en el render. Sin esto, las preferencias del tablero del dueño se
  // aplicaban dentro del tablero de un cliente (ids de proyecto que allá no existen).
  setScopePrefs(scope);
  // ⚠️ LOS FILTROS Y EL ORDEN SE RECUERDAN (usePref): «se resetean al recargar y al cambiar
  // de pestaña» era el reporte. Lo que NO se recuerda es la BÚSQUEDA (`q`): un texto viejo
  // restaurado esconde el tablero entero y se lee como que no hay nada cargado.
  const [fLabels, setFLabels] = usePrefSet('tablero.proyectos');
  // ⚠️ UN SOLO FILTRO DE ESTADO Y UNA SOLA VISTA DE TABLA PARA LAS DOS TABS. «Tanto la vista
  // de tabla como los filtros, haz que se mantengan igual tanto para la tab de proyectos
  // como kanban» (23/09/2026). Eran dos pares de preferencias con la misma pregunta adentro
  // («¿muestro lo hecho?», «¿tabla o tarjetas?»), así que cambiar de tab deshacía lo que
  // acababas de elegir — y no se leía como dos estados: se leía como que el filtro no
  // funciona. Los rótulos siguen siendo distintos (Activas/Activos) porque el sustantivo
  // cambia; la elección es la misma.
  const [doneFilter, setDoneFilter] = usePref<DoneFilter>('tablero.estado', 'all', esUnoDe('all', 'activas', 'hechas'));
  const [fOrigen, setFOrigen] = usePrefSet('tablero.origen');  // filtrar por ORIGEN (fuente: WhatsApp/Fathom/…)
  // CUANDO cae la tarea: hoy / esta semana / este Quarter / sin planificar (tarea #635).
  // Es un Set y no un valor unico porque «hoy Y esta semana» es una pregunta legitima
  // —lo urgente mas lo que se viene— y con un radio habria que elegir una.
  const [fCuando, setFCuando] = usePrefSet<Cuando>('tablero.cuando', esCuando);
  const [sortMode, setSortMode] = usePref<OrdenModo>('orden.modo', 'score', esUnoDe('score', 'creacion', 'deadline', 'az')); // orden de tareas/proyectos
  const [sortDir, setSortDir] = usePref<'desc' | 'asc'>('orden.dir', 'desc', esUnoDe('desc', 'asc')); // dirección: desc = mayor/más nuevo primero
  // TARJETAS o TABLA, una preferencia por vista. «Sí me parece bien que haya una vista
  // tabla tanto para proyectos como para el kanban, pero NO reemplaces lo que hay ahora,
  // es otra opción de verlo» — así que el default sigue siendo lo de siempre.
  const [tabla, setTabla] = usePref<boolean>('tablero.tabla', false, esBool);
  // La tarjeta que acabás de soltar en otra columna: abre el pop-up del 1 al 100.
  // Qué prioridad se está editando, y por qué camino se llegó. UNO para los dos caminos:
  // el ARRASTRE (que trae la columna de destino) y el LÁPIZ del panel (que no trae ninguna,
  // porque no se movió de columna). Antes era sólo del arrastre y sólo de tareas.
  const [soltada, setSoltada] = useState<{ entidad: 'proyecto' | 'tarea'; id: string; destino?: Prio; sugerido?: number } | null>(null);
  /**
   * SOBRE QUÉ está trabajando el Perro AHORA mismo (ids de tarea o de proyecto).
   *
   * «Cuando se cree un proyecto o tarea me lo tiene que abrir el detail inmediatamente… y en
   * el proceso, obvio el loader» (23/09/2026). Crear ya no espera al modelo —la tarjeta
   * nace y el detalle se abre— así que hay una ventana de 10-20 segundos en la que la
   * tarjeta está VACÍA: sin proyecto, sin detalle y con el score de fábrica. Sin decirlo,
   * eso se lee como que la creación salió mal.
   */
  const [trabajandoIA, setTrabajandoIA] = useState<ReadonlySet<string>>(new Set());
  const marcarTrabajando = useCallback((ids: string[], on: boolean) => {
    setTrabajandoIA((prev) => {
      const n = new Set(prev);
      for (const id of ids) { if (on) n.add(id); else n.delete(id); }
      return n;
    });
  }, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [extraerReunion, setExtraerReunion] = useState(false); // G3: extraer de una reunión de Fathom
  const [exportar, setExportar] = useState(false);             // bajarse el tablero (modal de a 1 pregunta)
  const [reunionArchivo, setReunionArchivo] = useState<File[] | null>(null); // los archivos elegidos en la bandeja → entran al modal de extracción
  const [importar, setImportar] = useState(false);                           // la bandeja de importación
  // "Datos sin marcar" (feedback jul-19): UN modal batch para las tareas sin fecha, en
  // vez del gauntlet card-by-card. Ver DatosModal.
  // ⚠️ SOLO A PEDIDO, desde el ⚠ del header (08-T46, 17/9). Antes se abría SOLO al entrar
  // a la tab y, al cerrarlo, salía un segundo pop-up («¿seguir recordándote?»). Mauricio,
  // en la llamada del 8/9: «me da miedo picarle a Maco» — no entendía qué le pedía ni qué
  // le preguntaba después, y eligió «recordármelo más tarde» para sacárselo de encima. Es
  // la regla de la casa: nada de auto-abrir modales al entrar a una pantalla (para avisar
  // está el badge), y nunca pedir datos en plena operación (AGENTS.md). Cerrar = «más tarde».
  const [datosOpen, setDatosOpen] = useState(false);
  const [dlDismiss, setDlDismiss] = useState<Set<string>>(new Set()); // deadline ignorado por tarea
  const [dlLoaded, setDlLoaded] = useState(false);                    // ya leí localStorage
  // "MaKo cargó tareas" (bienvenida): tareas creadas por una FUENTE (WhatsApp/Fathom/MaKo)
  // que el dueño todavía no vio en este device. Se muestran ANTES que el DatosModal.
  const [welcomeTasks, setWelcomeTasks] = useState<BoardTask[]>([]);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const welcomeDetectRef = useRef(false);
  const welcomeAutoRef = useRef(false);
  const guardianNuevasRef = useRef(false); // el Perro re-puntúa las tareas nuevas UNA vez al entrar
  // Borradores PENDIENTES (plan_propuestas): las tareas que MaKo sacó sola de tu última
  // reunión de equipo, o las que te mandó otra persona. Se muestran de a una.
  const [pendientes, setPendientes] = useState<PropuestaPendiente[]>([]);
  /** El hueco elástico del header: es el METRO de cuánto lugar sobra. */
  // Cerrar el modal con la ✕ NO descarta nada: solo lo esconde. Los borradores siguen
  // vivos y el botón de Fathom (que late) los vuelve a abrir.
  // (ya no hace falta un flag de "lo cerré": el modal solo se abre a pedido)
  /** el borrador de UNA reunión, abierto desde el selector de Fathom ("ver lo que sacó"). */
  const [borradorReunion, setBorradorReunion] = useState<PropuestaPendiente | null>(null);
    // Lo que se sabe de la reunión MIENTRAS viaja el request: título y cuántas tareas.
  // Los dos salen del conteo que el server ya mandó con la lista, así que el esqueleto
  // no inventa nada. null = no hay nada abriéndose.
  const [cargandoBorrador, setCargandoBorrador] = useState<{ titulo: string; fecha: string | null; n: number } | null>(null);
  // Lo que ESPERA ALGO TUYO. Es lo que hace esperar a los otros pop-ups — y tiene que ser
  // esto y no "hay borrador": un borrador al que solo le quedan tareas de otras personas
  // se queda abierto para siempre, y con él se quedaba tapado el resto de la cola.
  // Los CIERRES cuentan igual que las tareas: «revisá si estas 10 ya están hechas» es
  // trabajo tuyo y de nadie más. Sin sumarlos, un borrador de puros cierres entraba a la
  // lista y el badge seguía en cero — visible en el código, invisible en la pantalla.
  const nPendientes = pendientes.reduce((s, p) => s + (p.tareas?.filter((t) => !t.esDeOtro).length ?? 0) + (p.cerrar?.length ?? 0), 0);
  // Lo que espera algo de OTRA persona (repartir o mandárselo). No hace esperar a los
  // demás pop-ups —no es trabajo tuyo— pero TIENE que verse: un borrador que solo
  // conserva tareas ajenas quedaba completamente invisible (el modal nunca se abría
  // y el botón no mostraba badge), y ahí murieron los 15 compromisos que Mauricio
  // asumió en su reunión: existían en la base y nadie podía llegar a ellos.
  const nDeOtros = pendientes.reduce((s, p) => s + (p.tareas?.filter((t) => t.esDeOtro).length ?? 0), 0);
  const pendientesRef = useRef(false);

  const ask = (msg: string, onOk: () => void) => setConfirm({ msg, onOk });
  // El aviso de gasto de IA lo muestra el toast GLOBAL <IaUsageToast> (app/layout.tsx),
  // que sale ante CUALQUIER operación de IA. Antes el board tenía SU PROPIO cartel →
  // salían DOS avisos apilados por la misma operación (feedback jul-19). showUsage queda
  // como no-op para no tocar los ~8 call-sites que lo pasan como onUsage.
  const showUsage = (_u: unknown, _feature: string) => { /* dedup: lo muestra IaUsageToast */ };

  // El guardián es dueño de la ubicación: la columna respeta la restricción
  // (Alta solo para el proyecto top / sin proyecto / emergencia).
  //
  // El Objetivo Principal es el proyecto de mayor score QUE TODAVÍA TIENE TRABAJO.
  // Antes era, sin más, el de mayor score: cuando lo terminabas, el norte se quedaba
  // clavado en un proyecto 100% hecho y la vista Prioridades se vaciaba en vez de
  // pasar al siguiente. Si ya está TODO hecho, se muestra igual el de mayor score
  // (para no dejar la card vacía), pero no hay nada que priorizar.
  //
  // El score del proyecto lo DERIVA el Perro de sus tareas (`recurvarProyectosOwner`), así
  // que dos proyectos empatan cuando su mejor trabajo vale lo mismo — y eso pasa seguido en
  // la punta. El desempate NO puede quedar en `orden`, que es el orden en que se crearon:
  // el norte del tablero cambiaría de proyecto por un motivo que no significa nada. Empata
  // el que tiene MÁS trabajo abierto: si dos cosas importan igual, se ataca donde hay más.
  const pendientesPorProy = new Map<string, number>();
  // Sobre `conFin`: de este conteo sale el OBJETIVO PRINCIPAL, y un proyecto al que solo
  // se le hace la reunion semanal no es el norte del tablero. Es la misma particion que
  // usa el avance, unas lineas mas abajo.
  for (const t of conFin) if (t.progress < 100) for (const id of t.labels) pendientesPorProy.set(id, (pendientesPorProy.get(id) ?? 0) + 1);

  // ── Dependencias (mig 0140) ──
  // Se resuelven ACÁ, en el render, y NO se persiste ni un número. Es la decisión de
  // diseño más importante de la feature: `curveTaskScores` reasigna los scores por ranking
  // a bandas fijas, así que un orden horneado en la base es IRREVERSIBLE —borrar la arista
  // no devuelve los scores viejos, que ya no existen—. Como lente, una arista equivocada
  // se arregla borrándola y el tablero vuelve exacto al instante.
  // El otro motivo es de cableado: `recurvarPlanOwner` tiene UN solo llamador (adentro de
  // `priorizarNuevasOwner`), o sea que el tablero solo se re-reparte cuando ENTRAN TAREAS
  // NUEVAS. Una propagación enchufada ahí sería invisible hasta la próxima reunión: el
  // dueño declara la dependencia, no pasa nada, y parece que la feature no funciona.
  const estDeps = useMemo(() => resolverDeps({ tareas: tasks, deps: board.deps }), [tasks, board.deps]);
  const nombreDe = (id: string) => board.labelById(id)?.name ?? tasks.find((t) => t.id === id)?.title ?? id;
  const frenanA = (id: string): string[] => [
    ...(estDeps.bloqueantes[id] ?? []).map(nombreDe),
    ...(estDeps.bloqueantesProy[id] ?? []).map(nombreDe),
  ];

  // Un proyecto está frenado cuando NINGUNA de sus tareas abiertas se puede empezar. Ojo
  // con el matiz: alcanza con que UNA sea arrancable para que el proyecto lo sea, porque
  // el norte del tablero tiene que ser algo en lo que hoy se puede poner una hora.
  // Tambien sobre `conFin`: «arrancable» decide el desempate del objetivo principal, y
  // una recurrente no es trabajo que se pueda arrancar y terminar.
  const proyArrancable = (id: string) => conFin.some((t) => t.progress < 100 && t.labels.includes(id) && !estaBloqueada(t.id, estDeps));

  // ⚠️ SIN LOS QUE SE REPITEN, y no alcanzaba con sacarlos del ranking del Perro: marcar
  // un proyecto NO le baja el score, le deja el que tenía (bajárselo lo mandaría al fondo
  // como si estuviera abandonado, que es otra mentira). Así que el que estaba primero sigue
  // primero en esta lista, y de acá sale el Objetivo Principal — el norte del tablero
  // señalando algo que no se puede terminar.
  const porScore = sinRecurrentes(labels).slice().sort((a, b) => b.score - a.score || (pendientesPorProy.get(b.id) ?? 0) - (pendientesPorProy.get(a.id) ?? 0));
  const tienePendientes = (id: string) => (pendientesPorProy.get(id) ?? 0) > 0;
  // El Objetivo Principal exige trabajo ARRANCABLE, no solo pendiente: un norte en el que
  // no se puede empezar nada hoy es un norte que no sirve. Si todo está frenado se cae al
  // criterio de siempre en vez de dejar la card vacía — y ahí el tablero ya está diciendo
  // otra cosa (que la cadena está trabada), que se ve en los candados.
  const objetivoPrincipal = porScore.find((l) => proyArrancable(l.id)) ?? porScore.find((l) => tienePendientes(l.id)) ?? porScore[0] ?? null;
  const topProjectId = objetivoPrincipal?.id ?? null;
  // ── "Datos sin marcar" (feedback jul-19): el deadline (opcional), en UN modal batch.
  // Reemplaza al gauntlet card-by-card que auto-popeaba de a una. Persistimos qué se ignoró. (El «no volver a pedir» de
  // `mako_plan_datos_off` se fue con el auto-open: sin pop-up solo, no hay nada que apagar.) ──
  // Las keys se scopean por workspace (scope): impersonando distintos clientes,
  // las preferencias NO se mezclan en el mismo navegador.
  const dlKey = (base: string) => `${base}${scope ? '_' + scope : ''}`;
  useEffect(() => {
    try {
      const dl = localStorage.getItem(dlKey('mako_plan_dl_dismiss'));
      if (dl) setDlDismiss(new Set(JSON.parse(dl) as string[]));
    } catch { /* localStorage no disponible */ }
    setDlLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  // Bienvenida "MaKo cargó tareas": detectamos UNA vez las tareas con FUENTE recientes que
  // este device no vio. NO se auto-abren acá: el auto-open está más abajo. El botón ✨ del
  // header las reabre cuando quieras (ya no se pierden al tocar una tarea).
  useEffect(() => {
    if (welcomeDetectRef.current || !dlLoaded || tasks.length === 0) return;
    welcomeDetectRef.current = true;
    try {
      const raw = localStorage.getItem(dlKey('mako_plan_welcome_seen'));
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      const reciente = Date.now() - 3 * 86400000; // últimas 72h → no floodear con viejas
      const nuevas = tasks.filter((t) => t.progress < 100 && !seen.has(t.id)
        && fuenteEfectiva(t).tipo !== 'manual'
        && (t.historial?.length ? Math.min(...t.historial.map((h) => h.ts)) : 0) >= reciente);
      if (nuevas.length) setWelcomeTasks(nuevas);
    } catch { /* localStorage no disponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlLoaded, tasks.length]);
  const hayWelcome = welcomeTasks.length > 0;
  // Los proyectos que tocan esas tareas nuevas (para la tab "Proyectos" del modal).
  const welcomeProjIds = new Set(welcomeTasks.flatMap((t) => t.labels));
  const welcomeProjects = labels.filter((l) => welcomeProjIds.has(l.id));
  // Cuáles se CREARON en esta carga vs se REUTILIZARON: un proyecto nuevo nace junto
  // con las tareas del lote (su alta en el historial es de ~el mismo momento); uno
  // reutilizado es viejo. Ventana holgada (5 min) porque el lote entra en segundos.
  const welcomeTs = welcomeTasks.reduce((min, t) => { const ts = t.historial.length ? t.historial[t.historial.length - 1].ts : 0; return ts && ts < min ? ts : min; }, Infinity);
  const proyNuevoIds = new Set(welcomeProjects.filter((l) => { const cre = l.historial.length ? Math.min(...l.historial.map((h) => h.ts)) : 0; return cre >= welcomeTs - 300000; }).map((l) => l.id));
  const marcarWelcomeVisto = () => {
    try {
      const raw = localStorage.getItem(dlKey('mako_plan_welcome_seen'));
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      welcomeTasks.forEach((t) => seen.add(t.id));
      localStorage.setItem(dlKey('mako_plan_welcome_seen'), JSON.stringify([...seen]));
    } catch { /* ignore */ }
  };
  // Lo único que queda sin marcar es la FECHA: la checklist se fue del producto el
  // 22/09/2026 y con ella la mitad de este modal.
  const faltantes: FaltanteItem[] = conFin
    .filter((t) => t.progress < 100)
    .map((t) => ({ task: t, needDl: !t.deadline && !dlDismiss.has(t.id) }))
    .filter((x) => x.needDl)
    .sort((a, b) => b.task.score - a.task.score);
  const persistSet = (key: string, s: Set<string>) => { try { localStorage.setItem(dlKey(key), JSON.stringify([...s])); } catch { /* ignore */ } };
  const ignorarDl = (id: string) => setDlDismiss((s) => { const n = new Set(s).add(id); persistSet('mako_plan_dl_dismiss', n); return n; });
  // Cerrar = «más tarde». Sin segundo pop-up: el ⚠ sigue ahí con el número.
  const cerrarDatos = () => setDatosOpen(false);
  const abrirDatosManual = () => setDatosOpen(true);
  // Auto-abrir la bienvenida UNA vez, sin apilar sobre un detalle abierto ni sobre «Datos»
  // abierto a mano. Antes esperaba a que Datos se abriera solo primero: con el auto-open de
  // Datos fuera (08-T46), esa espera la habría dejado sin abrirse nunca, de costado.
  useEffect(() => {
    // ⚠️ EMBEBIDO NO SE AUTO-ABRE, y no es cosmético. `TareasCreadasModal` va por portal a
    // `document.body` con z 140 y NO se registra en la pila, así que adentro de la ficha se
    // pinta encima sin apagar nada: dos overlays superpuestos apenas abrís un cliente. Y
    // peor: `marcarWelcomeVisto` escribe la MISMA clave de localStorage que `/plan`, así
    // que abrir la ficha CONSUME la bienvenida que el tablero grande le iba a mostrar a
    // esas tareas. Es una pantalla de «acabás de entrar a tu tablero»; adentro de la ficha
    // de un cliente contesta la pregunta de otro alcance.
    if (embebido) return;
    if (!hayWelcome || welcomeAutoRef.current) return;
    if (openId || openProj || peekProjId) return;
    if (nPendientes > 0) return;                  // el borrador por confirmar va primero
    if (datosOpen) return;
    welcomeAutoRef.current = true;
    marcarWelcomeVisto();
    setWelcomeVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayWelcome, datosOpen, openId, openProj, peekProjId, nPendientes, embebido]);

  // Traer los borradores pendientes UNA vez por montaje. No los creó nadie en el board:
  // los dejó el cron de reuniones (MaKo leyó tu reunión) o los mandó otra persona.
  //
  // ⚠️ EMBEBIDO NO LOS PIDE. La consulta es del WORKSPACE entero y no se puede acotar a un
  // cliente: adentro de su ficha, el badge contaría reuniones que no son suyas y el pop-up
  // ofrecería confirmar trabajo de otro. Un número que responde una pregunta distinta de la
  // que la pantalla plantea es peor que no tener el número.
  useEffect(() => {
    if (embebido) return;
    if (pendientesRef.current) return;
    pendientesRef.current = true;
    void fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pendientes' }) })
      .then((r) => r.json())
      .then((j) => { if (j?.ok && Array.isArray(j.propuestas)) setPendientes(j.propuestas as PropuestaPendiente[]); })
      .catch(() => { /* silencioso: es un extra al entrar */ });
  }, [embebido]);
  // Los borradores van PRIMEROS de la cola de pop-ups, no últimos. Antes cedían ante
  // Datos y la bienvenida: con el tablero lleno, "faltan datos" salta siempre y el
  // borrador no se veía nunca — MaKo decía "entrá al plan a confirmarlas" y no había
  // nada. Lo que alguien está esperando confirmar le gana a un recordatorio.
  // Espera a que NO haya otro pop-up: si el de "datos que faltan" está abierto (lo
  // abrió el ⚠ a mano), este se muestra recién cuando se cierre — no atrás de él.
  // SOLO se abre solo si hay algo TUYO esperando. Un borrador al que solo le quedan
  // tareas de otras personas sigue vivo (para repartirlas), pero saltarte encima en cada
  // entrada al plan sería un recordatorio de algo que ya resolviste: queda a un click,
  // dentro del selector de Fathom.
  // SOLO a pedido. Antes se abría solo al entrar al plan y era lo primero que veías
  // cada vez, tapando el tablero por algo que ya sabías: el botón de Fathom late y
  // lleva el número. Ahora se llega desde ahí — el selector muestra cuántas esperan
  // por reunión y al entrar a una se abre su borrador.
  const hayRecibidas = !!borradorReunion;
  // Espera su turno detrás de cualquier otro pop-up (y del detalle de una tarjeta), pero
  // SE ESCONDE, no se desmonta. Desmontarlo tiraba a la basura media revisión: los
  // destildes, las reasignaciones y las respuestas viven en su estado, y abrir una
  // tarjeta ya cargada —ahora una grilla de tarjetas clickeables— lo desmontaba.
  // …salvo cuando el borrador se abrió DESDE el selector: ahí va encima de él, para
  // poder volver a la lista al cerrarlo en vez de perder los dos de un saque.
  const recibidasOculto = !!(openId || openProj || peekProjId || datosOpen || cargandoBorrador
    || (extraerReunion && !borradorReunion));

  // ── el perro guardián re-puntúa el plan (score 1-100 / 1-10) ──
  // Sin botón: corre solo EN BACKGROUND, pero SOLO cuando el plan cambió de forma
  // ESTRUCTURAL (se agregó/quitó/completó una tarea, o cambió un proyecto). Si nada
  // cambió, NO gasta tokens (feedback #1/#14). La "firma" ignora los scores para no
  // re-dispararse a sí misma cuando el guardián aplica los suyos.
  const repriorizando = useRef(false);
  const lastReprioSig = useRef(''); // dedup: no re-puntuar dos veces la misma firma
  const planSignature = () => {
    const t = tasks.filter((x) => x.progress < 100).map((x) => x.id).sort().join(',');
    const p = labels.map((l) => l.id).sort().join(',');
    return `${t}|${p}`;
  };
  const rePriorizar = async (sig?: string) => {
    if (repriorizando.current) return;
    const sigNow = sig ?? planSignature();
    if (lastReprioSig.current === sigNow) return; // ya se corrió para esta firma
    repriorizando.current = true;
    // ⚠️ LOS PROYECTOS NO VIAJAN ACÁ, y es a propósito. Los juzga `priorizarProyectosOwner`
    // (server-side) con la metodología completa y con datos para juzgar. Mandarlos también
    // desde acá —como `{ id, nombre }`, dos palabras— era el SEGUNDO productor del mismo
    // número, y el que producía el peor: el modelo decidía si «Feature: Closing Analyst»
    // mueve la aguja sin ver ni una de sus tareas.
    const proyectos: Array<{ id: string; nombre: string }> = [];
    // scoreActual: el guardián mantiene el score previo salvo razón concreta (estabilidad).
    //
    // ⚠️ EL `detalle` VA RECORTADO A 1500, igual que en `puntuarNuevas`. Sin el recorte este
    // payload medía 990.903 caracteres ≈ 275.000 tokens sobre el tablero real (550 tareas ×
    // detalle de hasta 6.000 chars, el 87% del total) — y el límite diario de una cuenta de
    // Gemini son 250.000. O sea: una sola corrida se comía el día entero, y como esta feature
    // tiene `fallback: []` la llamada no degradaba, FALLABA. Colgada de un setTimeout que
    // dispara con solo tener el board abierto y cambiar una tarea.
    const tareasIn = tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: (t.detalle ?? '').slice(0, 1500), proyecto: board.labelById(t.labels[0])?.name ?? '', deadline: t.deadline, avance: t.progress, origen: t.origen, scoreActual: t.score }));
    if (tareasIn.length < 2) { repriorizando.current = false; return; }
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proyectos, tareas: tareasIn }) }).then((r) => r.json());
      // `ok:true` con listas vacías NO es éxito: es el Perro que no pudo puntuar (se le
      // cortó la respuesta). Marcar esa firma como "ya corrida" la quemaba para toda la
      // sesión: el foco y las prioridades se quedaban clavados y nadie se enteraba —
      // exactamente lo que se veía como "las 3 prioridades no se actualizan solas".
      const hubo = (j.tareas?.length ?? 0) + (j.proyectos?.length ?? 0) > 0;
      if (j.ok && hubo) {
        board.applyGuardian(j.tareas || [], j.proyectos || []);
        showUsage(j.usage, 're-priorización del plan');
        lastReprioSig.current = sigNow; // recién ACÁ se da por atendida
      } else {
        console.error('[board] el Perro no devolvió prioridades:', j.error ?? '(sin error explícito)');
      }
    } catch (e) { console.error('[board] falló la re-priorización:', e instanceof Error ? e.message : String(e)); }
    repriorizando.current = false;
  };
  // Re-priorización: SOLO cuando el plan cambia DE VERDAD MIENTRAS lo usás (agregar/
  // borrar/completar una tarea, o cambiar un proyecto). NUNCA al entrar a la tab ni al
  // refrescar (feedback: no debe correr en cada refresh). Para eso guardamos la firma
  // de ARRANQUE como línea base en un ref (por sesión): la primera firma con la que
  // hidrata el board NO dispara nada; solo disparan las divergencias posteriores.
  const planSig = planSignature();
  const baseSig = useRef<string | null>(null);
  // Cuando la ruta de reunión/archivo del DUEÑO puntúa server-side (repo.priorizarNuevas),
  // suprimimos el re-scoreo client-side de ese cambio para no correr el Perro dos veces.
  const skipRePrio = useRef(false);
  useEffect(() => {
    if (tasks.length < 2 || !planSig) return;
    // primer render con datos → fijamos la línea base y NO corremos (es "entrar a la tab").
    if (baseSig.current === null) { baseSig.current = planSig; return; }
    if (planSig === baseSig.current) return; // sin cambios estructurales reales
    const id = setTimeout(() => { baseSig.current = planSig; if (skipRePrio.current) return; void rePriorizar(planSig); }, 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSig]);
  // PUNTO 4: las tareas que carga MaKo (WhatsApp/Fathom) las puntúa el Perro Guardián
  // SERVER-SIDE al crearlas (ver priorizarNuevasOwner) → llegan ya con score + razón. Este
  // disparador queda solo como FALLBACK: si alguna tarea nueva NO tiene razón (el server no
  // llegó a puntuarla), corremos la re-priorización client-side una vez. Si ya están
  // puntuadas, NO re-puntuamos todo el plan (era caro y redundante).
  useEffect(() => {
    if (guardianNuevasRef.current || !hayWelcome) return;
    guardianNuevasRef.current = true;
    if (!welcomeTasks.some((t) => !t.scoreRazon)) return; // ya las puntuó el server
    // Igual que el disparador de arriba: si el Perro SERVER-SIDE está corriendo sobre
    // estas mismas tareas, no lo pisamos con una corrida client-side (puntuaba dos veces
    // y la segunda le ganaba a la del server).
    const id = setTimeout(() => { if (skipRePrio.current) return; void rePriorizar(); }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayWelcome]);
  const passes = (t: BoardTask) => (idsIA ? idsIA.has(t.id) : (!q || matchTarea(t, q, campos))) && (fLabels.size === 0 || t.labels.some((l) => fLabels.has(l))) && (fOrigen.size === 0 || fOrigen.has(fuenteEfectiva(t).tipo)) && (fCuando.size === 0 || fCuando.has(cuandoDe(t, hoyISO()))) && pasaEstado(t.progress, doneFilter);
  /**
   * LO QUE SE VE EN «TAREAS» (Kanban y tabla): el universo CON FIN, salvo que estés
   * buscando.
   *
   * ⚠️ LA EXCEPCIÓN DE LA BÚSQUEDA NO ES UN CAPRICHO. Sacar las recurrentes de la vista es
   * correcto —tienen la suya— pero sacarlas también del buscador convierte «reunión de los
   * miércoles» en CERO RESULTADOS sobre una tarea que existe, y un cero es indistinguible
   * de «no está». Una búsqueda es una pregunta directa: esconder la respuesta es la peor
   * forma de contestarla. Cuando aparecen así, cada tarjeta lleva el chip «Se repite», que
   * es lo que explica por qué normalmente no están ahí.
   */
  const buscando = !!idsIA || !!q.trim();
  const visibles = (buscando ? tasks : conFin).filter(passes);

  /**
   * Lo que la vista «Recurrentes» dibuja de verdad: lo que se repite Y pasa el buscador y
   * los filtros de la barra. Se arma acá y no adentro de la vista porque `passes` —el
   * predicado de la vista Tareas— ya sabe cruzar texto, proyecto, origen y estado, y tener
   * dos predicados para la misma barra es garantizar que un filtro nuevo funcione en una
   * vista y en la otra no.
   *
   * ⚠️ `passes` mira `fCuando`, que sale del deadline. Para una recurrente eso siempre da
   * «sin fecha», así que el filtro no se dibuja en esta vista y el `Set` queda vacío — y un
   * `Set` vacío en `passes` es «no filtres». Si alguna vez se dibujara, esta lista se
   * vaciaría entera sin que nada lo explique.
   */
  /**
   * ⚠️ `passes` NO SIRVE ACÁ, Y EL COMENTARIO QUE DECÍA QUE SÍ ERA EL BUG. Miraba `fCuando`,
   * que sale del deadline y que para una recurrente siempre da «sin fecha». El razonamiento
   * era: «el filtro no se dibuja en esta vista, así que el Set queda vacío y un Set vacío es
   * no filtres». Falso: `fCuando` es `usePrefSet('tablero.cuando')` — vive en localStorage y
   * es UNA sola instancia para TODAS las vistas. Con «Esta semana» tildado en Tareas, entrar
   * a Recurrentes devolvía CERO tarjetas y la pantalla decía «Nada se repite todavía»
   * —o sea una afirmación falsa sobre los datos— sin ningún filtro a la vista que lo
   * explicara ni forma de apagarlo desde ahí.
   *
   * Es la regla de la casa sobre `localStorage`: restaura una PREFERENCIA, nunca decide algo
   * que la pantalla no muestra. Acá se filtra con lo que esta vista SÍ dibuja.
   */
  const recurrentesVisibles = lasRecurrentes.filter((t) => (
    (idsIA ? idsIA.has(t.id) : (!q || matchTarea(t, q, campos)))
    && (fLabels.size === 0 || t.labels.some((l) => fLabels.has(l)))
    && (fOrigen.size === 0 || fOrigen.has(fuenteEfectiva(t).tipo))
    && pasaEstado(t.progress, doneFilter)
  ));
  const proyRecurrentesVisibles = losProyectosRecurrentes.filter((l) => (
    (!q || coincide(`${l.pid ?? ''} ${(l.pid ?? '').replace(/^P/i, '')} ${l.name}`, q.replace(/^#/, '')))
    && (fLabels.size === 0 || fLabels.has(l.id))
  ));
  // ── El header: SIEMPRE PLEGADO ───────────────────────────────────────────────
  //
  // Acá vivían ~90 líneas que medían el header para decidir si plegar los botones, y se
  // reescribieron TRES veces en dos días. Las tres fallaron con el zoom puesto, y la tercera
  // —la de `anchoNatural`, que era correcta como medición— falló igual. El pedido, textual
  // (23/09/2026): «se sigue bugeando cuando tiene zoom, y se pone en doble línea. Haz que
  // todo se colapse independientemente del zoom que tenga, así evitamos esto. Que siempre
  // esté colapsado».
  //
  // ⚠️ LA LECCIÓN ES LA MEDICIÓN, NO LA FÓRMULA. Un layout que se decide midiéndose a sí
  // mismo tiene que acertar en TODAS las combinaciones de ancho, zoom, tipografía cargada o
  // no, cantidad de botones (que cambia sola: ⚠ y ✦ aparecen y desaparecen) y vista abierta.
  // Cada arreglo tapaba un caso y destapaba otro, y el modo de falla es el peor posible: los
  // botones bajan a un segundo renglón pegado al borde izquierdo, que se lee como una
  // pantalla rota. Plegado siempre no tiene ningún caso: es UN renglón, con cualquier zoom,
  // en cualquier pantalla.
  //
  // Lo que se pierde es la palabra «Plan» y el chip de progreso en el header — y el progreso
  // NO se pierde: viaja arriba de todo en el menú, que es donde ya iba cuando se plegaba.
  const compacto = true;
  // `?diag=1`: el tablero contando qué está viendo, en el navegador de quien lo reporta.
  const [diag, setDiag] = useState(false);
  useEffect(() => { try { setDiag(new URLSearchParams(window.location.search).get('diag') === '1'); } catch { /* no-op */ } }, []);

  // Sobre `conFin`, NUNCA sobre `tasks`: ver el porqué arriba, donde se parte el tablero.
  const avg = conFin.length ? Math.round(conFin.reduce((s, t) => s + t.progress, 0) / conFin.length) : 0;
  const hechas = conFin.filter((t) => t.progress >= 100).length;
  // "En prioridad" = AUTOMÁTICO: las 3 tareas de mayor score del Objetivo Principal
  // (no lo elige el usuario). NUNCA se queda corta: si al proyecto top le quedan menos
  // de 3 pendientes, se completa con lo mejor del resto del plan (por score del
  // proyecto y después por score de la tarea). Antes, con el norte al 86%, la vista
  // mostraba UNA sola tarjeta y el resto del plan quedaba invisible: el tablero decía
  // "no hay nada más que hacer" con 20 tareas abiertas.
  const scoreProy = (t: BoardTask) => Math.max(0, ...t.labels.map((id) => board.labelById(id)?.score ?? 0));
  // ⚠️ Prioridades responde «¿qué hago AHORA?», así que lo BLOQUEADO no entra. No es que
  // valga menos —su score no se toca, y en el Kanban sigue donde estaba—: es que hoy no se
  // puede empezar, y una lista de «hacé esto» con cosas que no se pueden hacer es peor que
  // una lista corta. Lo que sí sube es lo que las DESTRABA, por la urgencia heredada.
  const pendientesTodas = conFin.filter((t) => t.progress < 100 && !estaBloqueada(t.id, estDeps));
  // ⚠️ MANDA LA BANDA, Y EL PROYECTO TOP DESEMPATA ADENTRO DE ELLA.
  //
  // Acá entraban primero TODAS las pendientes del proyecto top ordenadas por score y el
  // resto del plan completaba atrás, así que una tarea floja del norte le ganaba a una
  // fuerte de cualquier otro proyecto. Medido el 25/09/2026 en el tablero del dueño: la
  // #3 de la lista salía con prioridad **20** al lado de 90, 91, 79 y 71 — y una lista de
  // «qué hago ahora» con una tarea a futuro en el podio deja de ser una respuesta.
  //
  // La banda es la misma que agrupa el Kanban (`prioFromScore`: alta ≥ 75 · media ≥ 50 ·
  // baja ≥ 25 · futuro < 25), así que las dos vistas no se pueden contradecir. Una ALTA de
  // otro proyecto siempre le gana a una BAJA del proyecto top; empatada la banda, sí manda
  // el norte. El score que se mira es el EFECTIVO (la urgencia heredada de lo que destraba),
  // que es el mismo con el que después se ordena.
  const urg = (t: BoardTask) => estDeps.urgencia[t.id] ?? t.score;
  const banda = (t: BoardTask) => PRIOS.indexOf(prioFromScore(urg(t)));   // 0 = alta … 3 = a futuro
  const esDelTop = (t: BoardTask) => (topProjectId ? t.labels.includes(topProjectId) : false);
  const enPrio = [...pendientesTodas]
    .sort((a, b) => banda(a) - banda(b) || Number(esDelTop(b)) - Number(esDelTop(a)) || scoreProy(b) - scoreProy(a) || urg(b) - urg(a))
    .slice(0, MAX_PRIORIDAD);
  const prioAvg = enPrio.length ? Math.round(enPrio.reduce((s, t) => s + t.progress, 0) / enPrio.length) : 0;
  // agregado de proyectos (para el chip del header en la vista Proyectos)
  // ⚠️ SIN LOS QUE SE REPITEN. Un proyecto recurrente no llega a 100 nunca —por definición,
  // no termina—, así que contarlo acá hunde el promedio del plan para siempre y el chip
  // «proyectos ✓» nunca puede completarse. Es el mismo corte que ya hacen el ranking, los
  // avisos y la API; éste quedaba afuera porque vive en la pantalla y no en `lib/`.
  const projAgg = sinRecurrentes(labels).map((l) => projProgress(tasks, l.id));
  const projConTareas = projAgg.filter((p) => p.total > 0);
  const avgProj = projConTareas.length ? Math.round(projConTareas.reduce((s, p) => s + p.pct, 0) / projConTareas.length) : 0;
  const hechosProj = projAgg.filter((p) => p.total > 0 && p.done === p.total).length;

  // El avance de LA VISTA que se está mirando, en un solo lugar. Los tres chips del
  // header lo pintaban cada uno por su lado; cuando el header se pliega, este mismo dato
  // es el que viaja al menú — copiarlo allá era garantizar que uno de los dos mintiera.
  //
  // ⚠️ «RECURRENTES» NO TIENE PROGRESO, Y ES UNA DECISIÓN ESCRITA, NO UN OLVIDO. El chip
  // dice «X% · N/M»: los tres números mienten sobre algo que se repite para siempre. `N/M`
  // sería «cuántas de tus rutinas terminaste», que es una pregunta sin respuesta posible —
  // al cerrarla hay que volver a crearla, que es justamente lo que la delata como
  // recurrente—; y un 0% permanente se lee como «nadie hizo nada» sobre lo que más se hace.
  // El único número que ahí significa algo es CUÁNTAS son, y ese va en el encabezado de la
  // propia vista (`RecurrentesView`), donde se puede decir con su frase al lado.
  const progresoDeLaVista = view === 'tareas' ? { pct: avg, hechas, total: conFin.length, label: 'del plan' }
    : view === 'prioridades' ? { pct: prioAvg, hechas: enPrio.length, total: MAX_PRIORIDAD, label: 'en prioridad' }
      : view === 'proyectos' ? { pct: avgProj, hechas: hechosProj, total: labels.length, label: 'proyectos ✓' }
        : undefined;
  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const debateTask = tasks.find((t) => t.id === debateId) ?? null;
  const soltadaItem = soltada
    ? (soltada.entidad === 'tarea'
        ? (() => { const t = tasks.find((x) => x.id === soltada.id); return t ? { titulo: t.title, score: t.score } : null; })()
        : (() => { const l = labels.find((x) => x.id === soltada.id); return l ? { titulo: l.name, score: l.score } : null; })())
    : null;
  const openProjLabel = labels.find((l) => l.id === openProj) ?? null;
  const peekProj = labels.find((l) => l.id === peekProjId) ?? null;

  // Deep-link (punto 9): ?tarea=<id> / ?proyecto=<id> abre ese detalle al entrar —
  // lo usa MaKo por WhatsApp para linkear lo que creó. Después limpia el query.
  //
  // ⚠️ NO CORRE EMBEBIDO. Adentro de la ficha de un cliente, la URL es la de
  // `/customer-success` y sus parámetros no son de este tablero: leerlos abre un detalle
  // que nadie pidió, encima de un modal, y deja la pantalla trabada (ver `embebido`).
  useEffect(() => {
    if (embebido) return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const tId = sp.get('tarea'); const pId = sp.get('proyecto');
      // `?reunion=<recordingId>`: el link que manda MaKo por WhatsApp cuando leyó una
      // reunión. Abre EL BORRADOR DE ESA REUNIÓN —pendiente o ya cargado—, en vez de
      // dejarte parado en el tablero esperando que salte un modal que quizá no salta.
      const rId = Number(sp.get('reunion'));
      if (Number.isFinite(rId) && rId > 0) {
        // El cartel de carga sin título todavía: el nombre de la reunión lo trae la
        // respuesta, y hasta entonces dice «Abriendo lo que sacó MaKo…».
        setCargandoBorrador({ titulo: '', fecha: null, n: 0 });
        void fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'por-reunion', recordingId: rId }) })
          .then((r) => r.json())
          .then((j) => { if (j?.ok && j.propuesta) setBorradorReunion(j.propuesta as PropuestaPendiente); })
          .catch(() => { /* si falla, queda el tablero: nunca una pantalla trabada */ })
          .finally(() => setCargandoBorrador(null));
      }
      if (tId && tasks.some((t) => t.id === tId)) setOpenId(tId);
      else if (pId && labels.some((l) => l.id === pId)) setOpenProj(pId);
      // ⚠️ SOLO SE LIMPIA `?reunion=`. `?tarea=` y `?proyecto=` YA NO: dejaron de ser un
      // link de una sola vez y pasaron a ser el ESTADO de la pantalla — si se borran, un
      // refresh te deja el tablero pelado aunque tuvieras una tarjeta abierta. `reunion` sí
      // se limpia porque es un EVENTO (abrir un borrador), no un estado que sobreviva.
      if (sp.get('reunion')) { sp.delete('reunion'); const qs = sp.toString(); window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '')); }
    } catch { /* no-op */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── LA URL ES EL ESTADO DE LA PANTALLA ───────────────────────────────────────
  // Antes el board arrancaba SIEMPRE en Prioridades y el deep-link se borraba apenas abría
  // el modal: refrescar te devolvía a otra tab, sin la tarjeta que estabas mirando. Con esto
  // el link que copiás es la pantalla que estás viendo, y F5 no te mueve de lugar.
  //
  // No usa `push` para no llenar el historial: el Atrás tiene que sacarte del tablero, no
  // recorrer las cuatro tabs que miraste.
  //
  // ⚠️ Y VA CON `history.replaceState`, NO con `router.replace`, apartándose de la
  // convención de tabs de AGENTS.md — con el motivo escrito: `router.replace` sobre la misma
  // ruta con otro query ES una navegación, y esta página es `force-dynamic`, así que Next
  // vuelve a pedir el RSC. Serían 550 tareas y 71 proyectos por cada click en una tab. Acá
  // la URL no es un destino: es un marcador para el próximo F5.
  //
  // El `?ws=` se conserva solo porque se parte de `window.location.search`, que ya lo trae.
  // La query NO se arma de cero, justamente por eso: armarla de cero es como se pierde la
  // pestaña del cliente y terminás mirando otra cuenta.
  //
  // ⚠️ Y NO SE ESCRIBE EMBEBIDO: la URL de `/customer-success` no es la de este tablero.
  const urlEstado = `${view}|${openId ?? ''}|${openProj ?? ''}`;
  const urlPrev = useRef<string | null>(null);
  useEffect(() => {
    if (embebido) return;
    if (urlPrev.current === urlEstado) return;
    const primera = urlPrev.current === null;
    urlPrev.current = urlEstado;
    // El primer render solo fija la línea base: escribir en el montaje pisaría el `?tarea=`
    // con el que acabás de entrar, justo antes de que el efecto de deep-link lo lea.
    if (primera) return;
    try {
      const sp = new URLSearchParams(window.location.search);
      // «prioridades» es el default: no se escribe, para que la URL limpia siga andando.
      if (view === 'prioridades') sp.delete('vista'); else sp.set('vista', view);
      if (openId) sp.set('tarea', openId); else sp.delete('tarea');
      if (openProj) sp.set('proyecto', openProj); else sp.delete('proyecto');
      const qs = sp.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } catch { /* sin URL no se pierde nada: el estado vive en React igual */ }
  }, [urlEstado, view, openId, openProj, embebido]);

  const eliminarTask = tasks.find((t) => t.id === eliminarTaskId) ?? null;
  const eliminarProj = labels.find((l) => l.id === eliminarProjId) ?? null;
  const asignarTask = tasks.find((t) => t.id === asignarTaskId) ?? null;
  // La tarjeta cuyo cliente se está eligiendo, resuelta acá para que el modal reciba sólo
  // lo que pinta (nombre + lead actual) y no tenga que saber de qué tabla salió.
  const cliDe = asignarCli && (asignarCli.tipo === 'tarea'
    ? tasks.find((t) => t.id === asignarCli.id)
    : labels.find((l) => l.id === asignarCli.id)) || null;
  const debateProj = labels.find((l) => l.id === debateProjId) ?? null;
  const makoProj = labels.find((l) => l.id === makoProjId) ?? null;
  /**
   * Después de una cascada se RECARGA, no se parchea.
   *
   * La escritura la hizo el server sobre decenas de filas por id; el estado del navegador
   * quedó viejo en todas ellas. Reconstruirlo a mano acá sería mantener una segunda copia
   * de la misma decisión —y la que se quedaría vieja es la que se ve—. Recargar es barato
   * y honesto, y desde que la vista, el proyecto y la tarea abiertos viajan en la URL, se
   * vuelve exactamente a la misma pantalla.
   *
   * ⚠️ ESO ÚLTIMO ES FALSO EMBEBIDO, y por eso existe `onRecargar`: adentro de la ficha la
   * URL no guarda nada (la apaga `embebido`) y el cliente abierto es estado de React, así
   * que recargar la página cierra la ficha entera.
   */
  const recargar = onRecargar ?? (() => window.location.reload());
  const recargarTrasCascada = recargar;
  /**
   * Crear un proyecto. El Perro lo PUNTÚA después, no la persona al crearlo.
   *
   * El alta preguntaba la prioridad con un slider del 1 al 100 —comparando contra los 70 que
   * ya hay— y ésa era la mitad de la fricción del wizard. Ahora nace en 50 y la corrida que
   * ya existe (`priorizarNuevas` con `proyectoIds`) le pone score, razón, emoji y detalle,
   * exactamente igual que a un proyecto que abre una reunión. Corre en segundo plano: crear
   * no espera a un modelo.
   */
  const crearProyecto = async (nombre: string, emoji: string, detalle: string, score = 50) => {
    const l = await board.createLabel({ id: uid(), emoji: emoji || '🏷', name: nombre, color: SWATCHES[labels.length % SWATCHES.length], score, detalle, historial: [] });
    // El detalle se abre EN EL ACTO, como con una tarea: lo que se acaba de crear es lo que
    // se quiere mirar, y además es donde se ve trabajar al Perro.
    if (l?.id) setOpenProj(l.id);
    if (board.repo?.priorizarNuevas && l?.id) {
      marcarTrabajando([l.id], true);
      void (async () => {
        try {
          const r = await board.repo!.priorizarNuevas!([], [l.id], 'Proyecto nuevo creado a mano desde el tablero.');
          if (r) board.aplicarPerroServer(r.patches, r.proyectosPatch);
        } catch (e) { console.warn('[alta proyecto] priorizarNuevas', e); }
        finally { marcarTrabajando([l.id], false); }
      })();
    }
    return l;
  };
  // resumen del plan para que el guardián compare al debatir/crear
  const planResumen = tasks.filter((t) => t.progress < 100).map((t) => `- [${t.score}] ${t.title} (${board.labelById(t.labels[0])?.name ?? 'sin proyecto'})`).join('\n');

  // crear una tarea: el usuario propone proyecto(s) + prioridad; el GUARDIÁN la puntúa
  // (arrancando de la sugerencia del usuario) y decide su columna final (#10).
  const crearConGuardian = async (d: { title: string; detalle: string; labelIds: string[]; userScore: number; motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string; deadline: string; fijarPrioridad: boolean }) => {
    let labelIds = d.labelIds;
    const proyIds: string[] = [];
    // Si el usuario dijo que el proyecto todavía no existe, lo creamos inline. Nace en 50
    // (la escala es 1-100; el 5 viejo lo dejaba último siempre) y con alta en el historial,
    // igual que un proyecto creado desde WhatsApp.
    if (d.nuevoProyecto.trim()) {
      // Se ESPERA el id canónico del server: con el temporal (`uid()`, alfanumérico) la
      // tarea nacía sin proyecto, porque el board del cliente convierte los ids a número
      // y descarta los NaN. Era la causa de las tareas huérfanas.
      const canon = await board.createLabel({ id: uid(), emoji: d.nuevoProyEmoji || '🏷', name: d.nuevoProyecto.trim(), color: SWATCHES[labels.length % SWATCHES.length], score: 50, detalle: '', historial: [{ id: uid(), ts: Date.now(), actor: 'user', text: 'Creó el proyecto — alta manual' }] });
      labelIds = [canon.id];
      proyIds.push(canon.id);
    }
    const starter = d.userScore || 50;
    const t = await board.create(d.title, prioFromScore(starter), labelIds.length ? labelIds : undefined, { detalle: d.detalle });
    if (!t) return null;
    // La FECHA que puso la persona, antes que nada: el Perro propone una solo si no hay.
    if (d.deadline) board.setDeadline(t.id, d.deadline, '');
    // ⚠️ Y SI LA PRIORIDAD LA PUSO ELLA, SE FIJA ANTES DE LLAMAR AL PERRO. «Si el usuario
    // ya puso la prioridad, el Perro no la pisa»: el que la respeta es
    // `priorizarNuevasOwner`, que mira `score_manual` — o sea que el candado tiene que
    // estar puesto cuando la corrida lee la fila, no después.
    if (d.fijarPrioridad && board.repo.prioridadManual) {
      try {
        const r = await board.repo.prioridadManual('tarea', t.id, starter);
        board.aplicarCascadaManual('tarea', { id: t.id, score: r.score, razon: 'Prioridad fijada a mano', texto: `La creaste con prioridad ${r.score}` }, r.movidos);
      } catch (e) { console.warn('[alta] fijar prioridad', e); }
    }
    // Los HECHOS que aportó el usuario (no su número: la prioridad la decide el Perro).
    const partes: string[] = [];
    if (d.argumento) partes.push(d.argumento);
    if (!labelIds.length && d.motivoNinguno) partes.push(`Sin proyecto: ${d.motivoNinguno}.`);
    // El número que movió el dueño en el slider viaja como SUGERENCIA declarada, no como
    // ancla: el Perro tiene que puntuarla contra la pirámide del plan y puede ignorarla
    // por completo. Decírselo explícito es lo que evita que la tome de punto de partida
    // — un modelo al que le mostrás un número tiende a quedarse cerca de ese número.
    partes.push(d.fijarPrioridad
      ? `(El dueño YA FIJÓ la prioridad en ${starter}/100 a mano: no la discutas ni la cambies. Escríbele la descripción y nada más.)`
      : `(El dueño SUGIRIÓ ${starter}/100 al crearla. Es una sugerencia, no un dato: puntúala tú contra el resto del plan y, si no se sostiene, corrígela sin problema.)`);
    const contexto = partes.join(' ');

    // UNIFICACIÓN: una tarea cargada a mano recibe EXACTAMENTE el mismo trato que una de
    // WhatsApp o de una reunión → el Perro server-side, que la ancla contra la pirámide del
    // plan (no contra el número que propuso el usuario), le arma la checklist y le describe
    // el proyecto nuevo. El debate 1-a-1 quedaba de rubber-stamp: su veredicto más duro
    // ("rechaza") dejaba la tarea justo donde el usuario la había puesto.
    if (board.repo?.priorizarNuevas) {
      // ⚠️ EL PERRO CORRE EN SEGUNDO PLANO, Y ESO ES EL CAMBIO. Antes el modal se quedaba
      // en «El Perro Guardián está priorizando la tarea…» hasta que volvían TRES llamadas
      // a un modelo: entre 10 y 20 segundos mirando un cartel para cargar una línea. Se
      // crea, se cierra, y cuando el Perro contesta el tablero se actualiza solo.
      skipRePrio.current = true;
      marcarTrabajando([t.id, ...proyIds], true);
      void (async () => {
        try {
          const r = await board.repo!.priorizarNuevas!([t.id], proyIds, contexto || '(sin argumento del usuario: puntúala por impacto objetivo contra el resto del plan)');
          if (r) board.aplicarPerroServer(r.patches, r.proyectosPatch);
        } catch (e) { console.warn('[alta] priorizarNuevas', e); }
        finally {
          marcarTrabajando([t.id, ...proyIds], false);
          setTimeout(() => { skipRePrio.current = false; }, 3500);
        }
      })();
      return { id: t.id, score: t.score, razon: '', respuesta: '', prio: displayPrio(t, topProjectId) };
    } else {
      // Board del cliente (sin Perro server-side): debate client-side, como antes.
      const argFinal = contexto || '(sin argumento: puntúalo por impacto objetivo comparándolo con el resto del plan)';
      try {
        const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', tarea: d.title + (d.detalle ? `\n\n${d.detalle}` : ''), scoreActual: starter, argumento: argFinal, plan: planResumen, uso: 'Nueva tarea' }) }).then((r) => r.json());
        if (j.ok && typeof j.score === 'number') {
          board.setScore(t.id, j.score, `Priorizada al crear · score ${j.score}`, 'ia', j.razon);
          showUsage(j.usage, 'nueva tarea');
          return { id: t.id, score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '', prio: displayPrio({ ...t, score: j.score }, topProjectId) };
        }
      } catch { /* fallback abajo */ }
    }
    // Sin veredicto: devolvemos el score REAL con el que quedó la fila (antes se mostraba
    // el número que había tipeado el usuario, que no era el guardado).
    return { id: t.id, score: t.score, razon: '', respuesta: 'No pude priorizar ahora; quedó con una prioridad provisoria. Puedes debatirla después.', prio: displayPrio(t, topProjectId) };
  };

  // G3: crear en lote las tareas que MaKo sacó de una reunión. Entran con la prioridad
  // sugerida; al cambiar la firma del plan, el guardián las re-puntúa solo (una corrida).
  // Deshacer = borrar las que se acaban de crear (fue una acción revisada, no un click suelto).
  type CandReunion = { titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null; proyectoNombre?: string; minuto?: number; minutos?: number[] };
  /**
   * Las que YA estaban: en vez de crear una segunda tarjeta igual, se le SUMA a la que
   * existe el contexto que trajo esta reunión (detalle + los pasos que dijo). Es lo
   * que faltaba para poder cargar reuniones en serie: el mismo tema se habla en tres
   * llamadas y antes la segunda y la tercera se descartaban enteras — con sus números
   * y sus frases textuales adentro.
   */
  const ampliarDesdeReunion = async (items: Array<{ id: string; detalle: string; titulo: string }>, fuente?: Fuente) => {
    const utiles = items.filter((it) => it.id && it.detalle.trim());
    if (!utiles.length || !board.repo?.ampliarTareas) return;
    try {
      const patches = await board.repo.ampliarTareas(utiles.map(({ id, detalle }) => ({ id, detalle })), fuente);
      if (patches.length) board.aplicarPerroServer(patches);
      const n = patches.length;
      if (n) board.showUndo(`${n === 1 ? 'Le sumé' : `Les sumé a ${n}`} el contexto de la reunión a ${n === 1 ? 'la tarjeta que ya estaba' : 'las tarjetas que ya estaban'}`);
      else board.showUndo('Esas tareas ya tenían este contexto: no cambié nada.');
    } catch (e) { console.warn('[reunion] ampliarTareas', e); }
  };

  const crearDesdeReunion = async (candsIn: CandReunion[], fuente?: Fuente) => {
    // ÚLTIMA RED contra el duplicado, y ahora sin salidas: lo que ya está en el tablero
    // NO se vuelve a crear NUNCA — se le suma el contexto a la tarjeta que existe.
    // Antes acá había un «Deshacer» que la creaba igual (forzar=true): esa era la puerta
    // por la que entraban los duplicados que después había que fundir a mano.
    const enTablero = tasks.map((t) => ({ id: t.id, titulo: t.title, hecha: t.progress >= 100 }));
    const { nuevas, repetidas } = separarRepetidas(candsIn, enTablero);
    const cands = nuevas;
    // Las repetidas se amplían SIEMPRE (tengan o no tarea que crear al lado): el
    // contexto de esta reunión —los números y las frases que se dijeron— entra igual.
    const ampliables = repetidas
      .filter((r) => r.existente.id && (r.tarea.detalle ?? '').trim())
      .map((r) => ({ id: r.existente.id, detalle: (r.tarea.detalle ?? '').trim(), titulo: r.tarea.titulo }));
    if (ampliables.length) await ampliarDesdeReunion(ampliables, fuente);
    if (!cands.length) {
      // Nada nuevo que crear. Si tampoco se pudo ampliar (repetidas dentro del mismo
      // lote, que no traen id), al menos se dice — antes esto salía sin una palabra.
      if (repetidas.length && !ampliables.length) board.showUndo(`${textoRepetidas(repetidas.length)}: no las dupliqué.`);
      return;
    }
    // origen = MaKo (la IA extrajo estas tarjetas) + fuente (Fathom/archivo) + un alta
    // que deja rastro de DE DÓNDE salió (feedback jul-19 / regla del historial).
    const altaText = fuente?.tipo === 'fathom' ? `Creó la tarjeta — de la reunión «${fuente.etiqueta ?? ''}» (Fathom)`
      : fuente?.tipo === 'archivo' ? `Creó la tarjeta — del archivo «${fuente.etiqueta ?? ''}»`
        : undefined;
    // Si el board del dueño puede correr el Perro server-side, lo hace ÉL (mismo trato
    // que WhatsApp) y suprimimos el re-scoreo client-side para no puntuar dos veces.
    const usaServerPerro = !!board.repo?.priorizarNuevas;
    if (usaServerPerro) skipRePrio.current = true;
    // El MINUTO en que se dijo, por tarjeta: el mismo chip que traen las que vienen del
    // borrador. Sin esto, las creadas por el botón manual nacían sin forma de volver al
    // momento de la grabación — dos tarjetas de la misma reunión, una con contexto y la
    // otra no, conviviendo en la misma pantalla.
    const reloj = (seg: number): string => (seg >= 3600
      ? `${Math.floor(seg / 3600)}:${String(Math.floor((seg % 3600) / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`
      : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`);
    const fuenteDe = (c: { minuto?: number; minutos?: number[] }): Fuente | undefined => {
      if (!fuente) return undefined;
      const todos = c.minutos?.length ? c.minutos : (c.minuto != null ? [c.minuto] : []);
      if (!todos.length) return fuente;
      const url = fuente.url ? `${fuente.url}${fuente.url.includes('?') ? '&' : '?'}timestamp=${todos[0]}` : undefined;
      return { ...fuente, etiqueta: [fuente.etiqueta, todos.map(reloj).join(', ')].filter(Boolean).join(' · '), url };
    };
    // Proyectos que la reunión pidió y que NO existen: se crean UNA vez y todas sus
    // tareas cuelgan de ahí. Antes el modelo no podía proponerlos (o elegía de la
    // lista, o null), así que un tema nuevo se repartía entre proyectos que no le
    // correspondían — o caía entero en el primero.
    const nuevosProy = new Map<string, string>(); // nombre normalizado → id creado
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    // `cat:<nombre>` = un proyecto DEL CATÁLOGO que todavía no está en el tablero. Se
    // pasa a proyectoNombre para que siga UN solo camino de creación, y así el nombre
    // y el emoji salen del catálogo y no de lo que se le ocurrió al modelo.
    const delCat = (n: string) => repo.catalogo?.find((c) => norm(c.nombre) === norm(n));
    for (const c of cands) {
      if (c.proyectoId?.startsWith('cat:')) { c.proyectoNombre = c.proyectoId.slice(4); c.proyectoId = null; }
    }
    for (const c of cands) {
      const nom = (c.proyectoNombre ?? '').trim();
      if (!nom || c.proyectoId || nuevosProy.has(norm(nom))) continue;
      const yaEsta = labels.find((l) => norm(l.name) === norm(nom));
      if (yaEsta) { nuevosProy.set(norm(nom), yaEsta.id); continue; }
      // El id que vale es el CANÓNICO (el del server). Guardar el temporal acá era lo
      // que dejaba las tareas de ese proyecto sin proyecto: viajaban con un id que
      // `Number()` vuelve NaN y el board lo filtra sin decir nada.
      const cat = delCat(nom);
      const canon = await board.createLabel({
        id: uid(), emoji: cat?.emoji ?? '🏷', name: cat?.nombre ?? nom, color: SWATCHES[(labels.length + nuevosProy.size) % SWATCHES.length],
        score: 50, detalle: cat?.que ?? '', historial: [{ id: uid(), ts: Date.now(), actor: 'ia', text: `Creó el proyecto — de la reunión «${fuente?.etiqueta ?? ''}»` }],
      });
      nuevosProy.set(norm(nom), canon.id);
    }

    const ids: string[] = [];
    for (const c of cands) {
      // el detalle va DENTRO del alta: si se escribiera después, el Perro server-side
      // podría leer la fila antes de que llegue y puntuar solo con el título.
      // `[]` explícito, NO undefined: si la IA no le encontró proyecto, la tarea queda
      // suelta y se ve como tal. Con undefined heredaba el primer proyecto del tablero.
      const proy = c.proyectoId ?? (c.proyectoNombre ? nuevosProy.get(norm(c.proyectoNombre)) ?? null : null);
      const t = await board.create(c.titulo, c.prioridad, proy ? [proy] : [], { origen: 'ia', fuente: fuenteDe(c), altaText, detalle: c.detalle });
      if (!t) continue;
      ids.push(t.id);
    }
    if (ids.length) {
      const extra = repetidas.length ? ` · ${textoRepetidas(repetidas.length)}, no las dupliqué` : '';
      board.showUndo(`${ids.length} tarea${ids.length > 1 ? 's' : ''} de la reunión al plan${extra}`, () => ids.forEach((id) => board.removeSilent(id)));
    }
    // UNIFICACIÓN (#1): el Perro server-side puntúa/describe estas tareas nuevas y les arma
    // checklist, igual que las de WhatsApp — y con el MISMO contexto (de dónde salieron),
    // que antes no le pasábamos: puntuaba "(sin brief adicional)".
    if (usaServerPerro && ids.length) {
      const contexto = fuente?.tipo === 'fathom' ? `Salieron de la reunión «${fuente.etiqueta ?? ''}» (Fathom): son compromisos que se asumieron ahí.`
        : fuente?.tipo === 'archivo' ? `Salieron del archivo «${fuente.etiqueta ?? ''}» que subió el dueño.`
          : '';
      const proyIds = [...new Set(cands.map((c) => c.proyectoId).filter((x): x is string => !!x))];
      try {
        const r = await board.repo!.priorizarNuevas!(ids, proyIds, contexto);
        // Traer el veredicto a la pantalla. Sin esto la UI mostraba el score adivinado por
        // la extracción y el próximo guardado del board le pisaba encima al Perro.
        if (r) board.aplicarPerroServer(r.patches, r.proyectosPatch);
      } catch (e) { console.warn('[reunion] priorizarNuevas', e); skipRePrio.current = false; }
    }
    if (usaServerPerro) setTimeout(() => { skipRePrio.current = false; }, 3500);
  };

  return (
    // El porqué del layout —la grilla `auto 1fr`, el `minHeight` y por qué NO lleva
    // `overflow: hidden`— vive entero en `Marco`, acá arriba. Una sola copia: la vez que
    // estuvo en los dos lados, una se quedó vieja.
    <Marco embebido={embebido}>
      {/* símbolos de marca (para el logo de Fathom del toolbar/modal) — una vez por página */}
      <BrandDefs />
      {/* UNA SOLA LÍNEA, siempre. Antes tenía flexWrap:'wrap' y los botones de acción se
          caían a un segundo renglón, que además quedaba pegado al borde izquierdo y no
          se leía como parte del header. Lo que hace que entre: nada crece de más
          (flex:'none' en cada control) y lo único elástico es el buscador, que se
          achica hasta 90px antes que empujar a nadie. */}
      {/* ⚠️ ENVUELVE, NO SE SALE. Achicando la ventana (o con el zoom al 150%, que para la
          página es lo mismo) llega un punto en que ni plegando los botones entra todo: el
          logo, las cuatro tabs y el buscador ya no caben en un renglón de 700px. Con
          `nowrap` eso se dibujaba UNO ENCIMA DEL OTRO —medido: 108px de desborde a 780 y
          148 a 740—. La regla de la casa para una barra de navegación es que baje de
          renglón, nunca que scrollee ni que se pise (AGENTS.md). */}
      {/* ⚠️ EMBEBIDO, EL AIRE DE ARRIBA SOBRA. Adentro de la ficha de un cliente este
          header ya tiene encima el nombre y la foto, así que sus 20 px se suman a los
          18 del envoltorio y a los 10 del cuerpo del modal: 48 px de blanco entre el
          nombre y las tabs. Medido en Chrome, nivel por nivel, porque ninguno de los
          tres parece grande por separado — se reportó dos veces («no debería haber
          tanto espacio blanco») y la primera pasada sólo tocó el de la ficha, que era
          el más chico de los tres. Como pantalla no cambia nada. */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, rowGap: 10, padding: embebido ? '4px 30px 12px' : '20px 30px 16px', flexWrap: 'wrap', minWidth: 0 }}>
        {/* logo (checklist) + Plan — mismo ícono que la sidebar (feedback #2) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <PlanIcon size={38} />
          {/* La PALABRA cede cuando no entra; el ícono no. Son ~110px que valen más como
              buscador que como rótulo de una pantalla en la que ya estás. */}
          {!compacto && <span style={{ fontSize: 40, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1 }}>Plan</span>}
        </div>
        {/* tabs */}
        <div style={{ display: 'inline-flex', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {[...VISTAS.map((v) => ({ id: v as string, label: v === 'proyectos' ? repo.labelPlural : (v as string) })),
            ...(vistaExtra ? [{ id: vistaExtra.id, label: vistaExtra.label }] : [])].map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} style={{ border: 'none', background: view === v.id ? 'var(--surface)' : 'transparent', color: view === v.id ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v.id ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v.id ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v.label}</button>
          ))}
        </div>
        {/* De acá a la derecha. DOS grupos, y el orden importa:
            · el VARIABLE (progreso + buscar + filtrar) cambia según la vista;
            · el FIJO (avisos, MaKo, Fathom, subir, exportar) va SIEMPRE último y en el
              mismo orden, así ningún botón se te mueve de lugar al cambiar de tab.
            Antes estaban todos mezclados: al pasar de Kanban a Prioridades desaparecían
            el buscador y el filtro y los cuatro botones saltaban 250px a la izquierda. */}
        {/* El hueco elástico. Además de empujar, es el METRO: lo que mida acá es el
            lugar que hay para volver a desplegar los botones. */}
        {/* El hueco elástico: empuja el grupo de la derecha contra el borde. Tenía un ref
            porque era el METRO de la medición del header; esa medición ya no existe. */}
        <span style={{ flex: 1 }} />
        {/* El grupo VARIABLE (progreso + buscador + filtro). Lleva marca porque es el que
            se achica: el header entero puede entrar perfecto y ser ESTE el que se queda
            sin lugar — su contenido se sale y se dibuja encima de los botones. */}
        <div data-grupo-vista style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* El progreso es un DATO, no un control: cuando no entra todo, es lo primero que
            cede el lugar (los botones hacen algo; este solo informa). */}
        {!compacto && view === 'tareas' && <AvgChip avg={avg} hechas={hechas} total={tasks.length} label="del plan" />}
        {!compacto && view === 'prioridades' && <AvgChip avg={prioAvg} hechas={enPrio.length} total={MAX_PRIORIDAD} label="en prioridad" />}
        {!compacto && view === 'proyectos' && <AvgChip avg={avgProj} hechas={hechosProj} total={labels.length} label="proyectos ✓" />}
        {/* ⚠️ «RECURRENTES» SÍ LLEVA BUSCADOR Y FILTRO. Estuvo sin los dos unas horas, con
            el argumento de que el filtro pregunta por prioridad, deadline y «Cuándo» —las
            tres cosas que una recurrente no puede contestar—. El argumento era cierto sobre
            ESOS TRES controles y falso sobre el resto: proyecto, origen y estado se
            contestan igual, y una vista sin buscador es una vista que no se puede usar en
            cuanto pasa de diez tarjetas. «Faltan los filtros y la barra de búsqueda en
            Recurrentes» (26/09/2026).
            Lo que se hizo con los tres que no aplican es no dibujarlos (ver el `FilterMenu`
            de esta vista, más abajo): un control que devuelve la lista igual o vacía se lee
            como que la app está rota. */}
        {(view === 'tareas' || view === 'proyectos' || view === 'recurrentes') && (
          <BuscadorTareas
            q={q} onQ={setQ}
            campos={campos} onCampos={setCampos}
            ia={ia}
            onBuscarIA={buscarConIA}
            onLimpiarIA={() => setIa({ pensando: false, ids: null, explico: '' })}
          />
        )}
        {/* ⚠️ EL INTERRUPTOR TARJETAS/TABLA TAMBIÉN EN «RECURRENTES», y sale del `&&` del
            buscador para eso. «Siempre la vista tipo tarjetas, es lo que venimos haciendo»
            (26/09/2026): esa vista montaba `TablaTareas` SIEMPRE y ni siquiera recibía la
            preferencia, así que era la única del tablero donde elegir cómo mirar no existía
            —y encima arrancaba en la forma que NO es la de la casa—. El buscador y
            «Filtrar» siguen afuera, por lo que dice el comentario de arriba: sus tres
            preguntas se derivan del deadline y del score. */}
        {(view === 'tareas' || view === 'proyectos' || view === 'recurrentes') && <VistaToggle tabla={tabla} onSet={setTabla} />}
        {view === 'tareas' && <FilterMenu soloIcono={compacto} labels={labels} fLabels={fLabels} setFLabels={setFLabels} doneFilter={doneFilter} setDoneFilter={setDoneFilter} fOrigen={fOrigen} setFOrigen={setFOrigen} fCuando={fCuando} setFCuando={setFCuando} sortMode={sortMode} setSortMode={setSortMode} sortDir={sortDir} setSortDir={setSortDir} />}
        {view === 'proyectos' && <FilterMenu soloIcono={compacto} doneFilter={doneFilter} setDoneFilter={setDoneFilter} estadoLabels={[['all', 'Todos'], ['activas', 'Activos'], ['hechas', 'Completados']]} fOrigen={fOrigen} setFOrigen={setFOrigen} sortMode={sortMode} setSortMode={setSortMode} sortDir={sortDir} setSortDir={setSortDir} />}
        {/* ⚠️ SIN «CUÁNDO» Y SIN ORDENAR: los dos salen del deadline, y una recurrente no
            tiene. Dibujarlos acá sería ofrecer tres controles que devuelven la lista igual.
            Quedan los que sí contestan algo: por proyecto, por origen y por estado. */}
        {view === 'recurrentes' && <FilterMenu soloIcono={compacto} labels={labels} fLabels={fLabels} setFLabels={setFLabels} doneFilter={doneFilter} setDoneFilter={setDoneFilter} fOrigen={fOrigen} setFOrigen={setFOrigen} />}
        </div>
        {/* Los botones de acción, PLEGABLES: cuando no entran se esconden detrás de un
            «+» que los despliega al costado. Antes se dibujaban encima de «Filtrar». */}
        {/* El progreso NO se pierde al plegarse: viaja al menú, arriba de todo. Un dato
            que desaparece porque no hay lugar es esconder sin pista. */}
        <BarraAcciones compacto={compacto} progreso={progresoDeLaVista} acciones={[
          /* ⚠ en TODAS las vistas (no solo kanban): es la ÚNICA puerta al modal, que ya no se
             abre solo (08-T46). Avisa con el NÚMERO, como el ✨ de al lado, y no titila: un
             ícono que late en cada entrada es el mismo «picarle» con otra forma. */
          ...(faltantes.length > 0 ? [{ key: 'datos', nodo: (
          <button type="button" onClick={abrirDatosManual} title={`${faltantes.length} tarea${faltantes.length === 1 ? '' : 's'} sin fecha`} aria-label="Tareas sin fecha"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', padding: '0 11px' }}>
            <WarnMark title="" size={16} blink={false} />
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{faltantes.length}</span>
          </button>
          ), menu: { icono: <WarnMark title="" size={15} blink={false} />, label: 'Tareas sin fecha', badge: faltantes.length,
            desc: 'Las tareas a las que les falta la fecha', onClick: abrirDatosManual } }] : []),
          ...(hayWelcome ? [{ key: 'welcome', nodo: (
          <button type="button" onClick={() => setWelcomeVisible(true)} title={`${welcomeTasks.length} tarea${welcomeTasks.length === 1 ? '' : 's'} que cargó MaKo — ver`} aria-label="Tareas que cargó MaKo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 9, border: '1px solid var(--primary-weak)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', padding: '0 11px' }}>
            <MakoStar size={15} color="var(--primary)" />
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{welcomeTasks.length}</span>
          </button>
          ), menu: { icono: <MakoStar size={15} color="currentColor" />, label: 'Lo que cargó MaKo', badge: welcomeTasks.length,
            desc: 'Las tareas que entraron solas, para revisarlas', onClick: () => setWelcomeVisible(true) } }] : []),
          ...(repo.fathomExtract ? [{ key: 'fathom', nodo: (<>
          {/* El botón ES el logo de Fathom (feedback jul-18): sin contenedor blanco. Mismo 38×38 que el de subir. */}
          {/* Con borradores esperando, este botón ABRE ESOS BORRADORES (y late para que
              se vea que hay algo). El selector de reuniones de siempre vuelve recién
              cuando no queda nada pendiente: o las cargaste, o las descartaste. Antes,
              cerrar el modal era perderlo de vista sin forma de volver. */}
          {/* El badge cuenta TODO lo que espera (tuyo + de otros). El latido queda solo
              para lo tuyo: lo ajeno se ve, pero no te apura. */}
          {/* SIEMPRE abre el selector de reuniones. Antes, si había un borrador
              esperando, el botón te devolvía a ese borrador y no había forma de llegar
              a la lista: con tareas pendientes quedabas encerrado en ellas, sin poder
              mirar el resto de tus reuniones. El badge ya avisa cuántas esperan, y en
              la lista cada reunión muestra las suyas: no hace falta bloquear nada. */}
          <button type="button" onClick={() => { setReunionArchivo(null); setExtraerReunion(true); }}
            aria-label={nPendientes + nDeOtros > 0 ? `Tus reuniones — ${pendientes.length} borrador(es) esperando` : 'Tus reuniones de Fathom'}
            title={nPendientes > 0 ? `Tus reuniones — ${nPendientes} tarea${nPendientes === 1 ? '' : 's'} esperando que las confirmes${nDeOtros ? ` (y ${nDeOtros} de otras personas para repartir)` : ''}`
              : nDeOtros > 0 ? `Tus reuniones — quedan ${nDeOtros} tarea${nDeOtros === 1 ? '' : 's'} de otras personas para repartir`
              : 'Extraer tareas de una reunión de Fathom (MaKo lee la transcripción)'}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 0, borderRadius: 9, transition: 'opacity .12s', animation: nPendientes > 0 ? 'makoLatido 1.6s ease-in-out infinite' : undefined }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.82'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
            <SvcIcon k="fathom" size={22} box={38} radius={9} />
            {nPendientes + nDeOtros > 0 && (
              <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: nPendientes > 0 ? 'var(--primary)' : 'var(--dim)', color: '#fff', fontFamily: MONO, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{nPendientes + nDeOtros}</span>
            )}
          </button>
          {nPendientes > 0 && <style>{'@keyframes makoLatido{0%,100%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(47,111,237,0))}50%{transform:scale(1.09);filter:drop-shadow(0 0 6px rgba(47,111,237,.65))}}'}</style>}
          </>), menu: { icono: <SvcIcon k="fathom" size={15} box={20} radius={5} />, label: 'Tus reuniones', badge: nPendientes + nDeOtros,
            desc: 'MaKo lee la grabación y saca los compromisos', onClick: () => { setReunionArchivo(null); setExtraerReunion(true); } } },
          { key: 'importar', nodo: (<>          {/* Abre la BANDEJA, no el buscador de archivos del sistema. Elegir el
              archivo es el paso 2, no el 1: así se ve qué se está por mandar, entran
              varios y el que falla dice por qué sin llevarse a los otros. */}
          <button type="button" aria-label="Importar archivos al plan" title="Importar: notas, transcripciones, PDFs, capturas o audios — MaKo saca las tareas"
            onClick={() => setImportar(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flex: 'none', color: 'var(--dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--dim)'; }}>
            <UploadIcon />
          </button>
          </>), menu: { icono: <UploadIcon />, label: 'Importar archivos',
            desc: 'Notas, transcripciones, PDFs, capturas o audios', onClick: () => setImportar(true) } }] : []),
          /* Bajarse el tablero. Sale del estado que ya está en memoria, así que anda
             igual en el tablero del dueño que en el del cliente, y baja al instante. */
          { key: 'exportar', nodo: <ExportarBoton onAbrir={() => setExportar(true)} />,
            menu: { icono: <DescargarIcon />, label: 'Exportar el tablero',
              desc: 'Baja las tareas y los proyectos a un archivo', onClick: () => setExportar(true) } },
        ]} />

      </header>

      {/* ⚠️ COLUMNA FLEX, no un bloque a secas. Las vistas colgaban de acá con
          `height: 100%`, y eso en SAFARI da CERO: su padre saca el alto de `flex: 1`,
          que para el motor es un alto INDEFINIDO, así que el porcentaje no resuelve
          (Chrome sí lo resuelve, y por eso pasó meses sin verse). Con el `overflow:
          hidden` de acá, cero de alto es una PANTALLA EN BLANCO: header dibujado y
          debajo nada. Se reportó tres veces como «el plan está vacío» desde una Mac.
          El patrón que sí funciona en los dos: el padre es columna y el hijo estira
          con `flex: 1` + `minHeight: 0`. Ninguna vista vuelve a pedir `height: 100%`. */}
      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'prioridades' && <Prioridades tasks={enPrio} board={board} objetivo={objetivoPrincipal} onOpen={setOpenId} onOpenProj={setOpenProj} />}
        {view === 'tareas' && (tabla
          ? <div style={{ flex: '1 0 auto', padding: '18px 30px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ⚠️ EL BOTÓN DE CREAR, QUE ACÁ NO ESTABA. «Falta el botón de crear tarea en la
                vista tabla» (25/09/2026). En el Kanban cada columna trae el suyo —y por eso
                nadie lo echó de menos mientras la tabla fue la vista secundaria—, así que al
                pasar a tabla la única forma de crear una tarea desaparecía de la pantalla.
                Es el mismo tratamiento y el mismo lugar que el de la tabla de PROYECTOS
                (`＋ Crear proyecto`): dos tablas hermanas no ofrecen la misma acción de dos
                formas distintas.
                Sin prioridad preelegida (`setNuevaTareaPrio(null)`): en el Kanban el botón
                vive DENTRO de una columna y por eso hereda su banda; acá no hay columna de
                dónde heredarla, y la pone el Perro en la misma corrida en la que escribe el
                detalle — que es la regla de no pedir un número sobre algo que no existe. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setNuevaTareaPrio(null); setNuevaTarea(true); }}
                style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                ＋ Nueva tarea
              </button>
            </div>
            <TablaTareas tareas={visibles} board={board} hoy={hoyISO()} onOpen={setOpenId} onOpenProj={setOpenProj} ask={ask} onEliminar={setEliminarTaskId} onFecha={(id, v, antes) => board.setDeadline(id, v, antes)} onHecha={(id) => board.toggleDone(id)}
              /* LA MISMA selección que el Kanban: es el pedido entero del 04/10/2026. */
              seleccion={{ ids: selTareasVista, set: setSelTareasVista }}
              /* «Que en el formato tabla también pueda arrastrar y cambiar la prioridad»
                 (25/09/2026). Soltar dice DÓNDE y abre el MISMO pop-up del 1 al 100 que el
                 Kanban, el lápiz y la grilla de proyectos: la persona dice CUÁNTO.
                 ⚠️ LA PROP **ES** LA CAPACIDAD (`repo.prioridadManual`): el tablero del
                 cliente no tiene con qué escribir una prioridad a mano, así que ahí la
                 tabla no dibuja el agarre en vez de ofrecer un gesto que contesta 403. */
              onSoltar={board.repo.prioridadManual ? (id, sugerido) => setSoltada({ entidad: 'tarea', id, sugerido }) : undefined} /></div>
          : <Kanban tasks={visibles} board={board} topProjectId={topProjectId} sortMode={sortMode} sortDir={sortDir} frenanA={frenanA} ask={ask} sel={selTareasVista} setSel={setSelTareasVista} onOpen={setOpenId} onNew={(p) => { setNuevaTareaPrio(p ?? null); setNuevaTarea(true); }} onWarn={setOpenId} onOpenProj={setOpenProj} onEliminar={setEliminarTaskId} onSoltar={(id, destino, sugerido) => setSoltada({ entidad: 'tarea', id, destino, sugerido })} />)}
        {view === 'proyectos' && <ProyectosView board={board} topProjectId={topProjectId} onOpen={setOpenProj} onNew={() => setNuevoProj(true)} projFilter={doneFilter} q={q} campos={campos} fOrigen={fOrigen} sortMode={sortMode} sortDir={sortDir} tabla={tabla}
          onSoltar={(id, sugerido) => setSoltada({ entidad: 'proyecto', id, sugerido })} />}
        {view === 'recurrentes' && <RecurrentesView tareas={recurrentesVisibles} proyectos={proyRecurrentesVisibles} board={board} topProjectId={topProjectId} tabla={tabla} onOpen={setOpenId} onOpenProj={setOpenProj} onEliminar={setEliminarTaskId}
          onSoltarTarea={board.repo.prioridadManual ? (id, sugerido) => setSoltada({ entidad: 'tarea', id, sugerido }) : undefined}
          onSoltarProy={board.repo.prioridadManual ? (id, sugerido) => setSoltada({ entidad: 'proyecto', id, sugerido }) : undefined} ask={ask} />}
        {/* La vista de más, si la pantalla que monta el board trajo una. */}
        {vistaExtra && view === vistaExtra.id && vistaExtra.contenido}
      </div>

      {openTask && <TaskModal key={openTask.id} t={openTask} board={board} topProjectId={topProjectId} suggestMako={openTask.id === makoHintId} trabajando={trabajandoIA.has(openTask.id)} onDebate={() => setDebateId(openTask.id)} onPrioridad={() => setSoltada({ entidad: 'tarea', id: openTask.id })} onDelete={() => setEliminarTaskId(openTask.id)} onAsignar={() => setAsignarTaskId(openTask.id)} onAsignarCliente={() => setAsignarCli({ tipo: 'tarea', id: openTask.id })} onOpenProj={(id) => setPeekProjId(id)} escDisabled={!!peekProjId} ask={ask}
        onBack={(openProjLabel || welcomeVisible) ? () => { setOpenId(null); setMakoHintId(null); } : undefined}
        onClose={() => { setOpenId(null); setOpenProj(null); setPeekProjId(null); setMakoHintId(null); }} />}
      {peekProj && openTask && <ProjectDetailModal proj={peekProj} board={board} topProjectId={topProjectId} trabajando={trabajandoIA.has(peekProj.id)} z={130} onBack={() => setPeekProjId(null)} onAsignarCliente={() => setAsignarCli({ tipo: 'proyecto', id: peekProj.id })} onPortada={(ancla) => setPortadaDe({ id: peekProj.id, ancla })} onIcono={(ancla) => setIconoDe({ id: peekProj.id, ancla })} onEncuadre={(y) => board.patchLabelLog(peekProj.id, { portadaY: y }, 'Acomodó la portada')}
        onOpenTask={(id) => { setPeekProjId(null); setOpenId(id); }} onNewTask={() => { setNuevaTareaProj(peekProj.id); setNuevaTarea(true); }} ask={ask}
        onPrioridad={() => setSoltada({ entidad: 'proyecto', id: peekProj.id })} onMako={() => setMakoProjId(peekProj.id)} onDelete={() => setEliminarProjId(peekProj.id)} onEliminarTask={setEliminarTaskId} onSoltarTask={board.repo.prioridadManual ? (id, sugerido) => setSoltada({ entidad: 'tarea', id, sugerido }) : undefined}
        onClose={() => setPeekProjId(null)} />}
      {/* LA AUDIENCIA. Reemplaza a `DebateModal` en el camino del SCORE (la FECHA se sigue
          debatiendo aparte: es otra pregunta). Tres cosas cambian y las tres importan: la
          exigencia se ve antes de argumentar, el rechazo NO escribe nada, y aceptar muestra
          la cascada antes de tocar la base. */}
      {debateTask && <AudienciaModal entidad="tarea"
        item={{ id: debateTask.id, titulo: debateTask.title, score: debateTask.score, emoji: debateTask.emoji }}
        otros={tasks.filter((t) => t.id !== debateTask.id && t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, score: t.score, emoji: t.emoji }))}
        tareas={[]}
        onUsage={(u) => showUsage(u, 'prioridad de tarea')}
        onAplicado={recargarTrasCascada}
        onClose={() => setDebateId(null)} />}
      {/* EL POP-UP DEL 1 AL 100 — la única forma de fijar un número a mano, para los dos
          caminos (arrastrar y el lápiz del panel) y las dos entidades. «Para eso teníamos
          el pop-up» (23/09/2026): el slider del panel se fue.
          ⚠️ `sugerido` sale de DÓNDE la soltaste —el punto medio entre la tarjeta de arriba
          y la de abajo, ver `scoreEntre`—, no del representativo de la banda: soltarla
          arriba de todo en «Alta» y soltarla al fondo son dos decisiones distintas, y hasta
          hoy las dos abrían el pop-up en el mismo número. */}
      {soltada && soltadaItem && (
        <MoverPrioridadModal
          titulo={soltadaItem.titulo} score={soltadaItem.score}
          sugerido={soltada.sugerido ?? (soltada.destino ? scoreFromPrio[soltada.destino] : soltadaItem.score)}
          vecinos={soltada.entidad === 'tarea'
            ? tasks.filter((x) => x.id !== soltada.id && x.progress < 100).map((x) => ({ id: x.id, titulo: x.title, score: x.score }))
            : labels.filter((x) => x.id !== soltada.id).map((x) => ({ id: x.id, titulo: x.name, score: x.score }))}
          onDebate={board.repo.debatePrioridad
            ? () => (soltada.entidad === 'tarea' ? setDebateId(soltada.id) : setDebateProjId(soltada.id))
            : undefined}
          onAbrir={(id) => (soltada.entidad === 'tarea' ? setOpenId(id) : setOpenProj(id))}
          onAplicado={async (n) => {
            const r = await board.repo.prioridadManual!(soltada.entidad, soltada.id, n);
            board.aplicarCascadaManual(soltada.entidad, { id: soltada.id, score: r.score, razon: 'Prioridad fijada a mano', texto: `Fijaste la prioridad en ${r.score} a mano` }, r.movidos);
          }}
          onClose={() => setSoltada(null)} />
      )}
      {nuevaTarea && <CrearTareaModal proyectoInicial={nuevaTareaProj} prioInicial={nuevaTareaPrio} ejemplos={tasks.filter((t) => t.progress < 100).map((t) => ({ title: t.title, score: t.score }))} onCrear={crearConGuardian} onDone={(id) => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); setOpenId(id); setMakoHintId(id); }} onClose={() => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); }} />}
      {openProjLabel && <ProjectDetailModal proj={openProjLabel} board={board} topProjectId={topProjectId} taskAbierta={!!openTask} trabajando={trabajandoIA.has(openProjLabel.id)} onAsignarCliente={() => setAsignarCli({ tipo: 'proyecto', id: openProjLabel.id })} onPortada={(ancla) => setPortadaDe({ id: openProjLabel.id, ancla })} onIcono={(ancla) => setIconoDe({ id: openProjLabel.id, ancla })} onEncuadre={(y) => board.patchLabelLog(openProjLabel.id, { portadaY: y }, 'Acomodó la portada')}
        onBack={welcomeVisible ? () => setOpenProj(null) : undefined} backLabel="Volver"
        onOpenTask={setOpenId} onNewTask={() => { setNuevaTareaProj(openProjLabel.id); setNuevaTarea(true); }} ask={ask} onPrioridad={() => setSoltada({ entidad: 'proyecto', id: openProjLabel.id })} onMako={() => setMakoProjId(openProjLabel.id)} onDelete={() => setEliminarProjId(openProjLabel.id)} onEliminarTask={setEliminarTaskId} onSoltarTask={board.repo.prioridadManual ? (id, sugerido) => setSoltada({ entidad: 'tarea', id, sugerido }) : undefined} onClose={() => setOpenProj(null)} />}
      {makoProj && <MakoProyectoModal proj={{ name: makoProj.name, emoji: makoProj.emoji, detalle: makoProj.detalle }} onApply={(nombre, emoji, det) => board.patchLabelLog(makoProj.id, { name: nombre, emoji, detalle: det }, 'MaKo mejoró el proyecto', 'ia')} onClose={() => setMakoProjId(null)} />}
      {/* ⛔ ACÁ SE MONTABA `FechaDebateModal`, y se fue el 23/09/2026 con el botón que lo
          abría: la fecha se cambia en el selector y listo. El archivo queda en el repo —el
          Perro sigue PROPONIENDO la fecha al crear la tarjeta, que es cuando sirve— pero ya
          no hay ninguna pantalla que mande a discutírsela. */}
      {debateProj && <AudienciaModal entidad="proyecto"
        item={{ id: debateProj.id, titulo: debateProj.name, score: debateProj.score, emoji: debateProj.emoji }}
        otros={labels.filter((l) => l.id !== debateProj.id).map((l) => ({ id: l.id, titulo: l.name, score: l.score, emoji: l.emoji }))}
        tareas={tasks.filter((t) => t.progress < 100).slice().sort((a, b) => b.score - a.score).map((t) => ({ id: t.id, titulo: t.title, score: t.score, emoji: t.emoji }))}
        onUsage={(u) => showUsage(u, 'prioridad de proyecto')}
        onAplicado={recargarTrasCascada}
        onClose={() => setDebateProjId(null)} />}
      {nuevoProj && <CrearProyectoModal onCrear={crearProyecto} onClose={() => setNuevoProj(false)} />}
      {/* Lo que MaKo dejó esperando: tareas de una reunión tuya que leyó sola, o que te
          mandó otra persona. Nunca se crearon: se confirman acá. Van DESPUÉS de Datos
          y de la bienvenida para no apilar modales. */}
      {hayRecibidas && (
        <TareasRecibidasModal
          oculto={recibidasOculto}
          // HUELLA, no solo el id: `filas` se inicializa perezoso adentro del modal, así
          // que un objeto nuevo con el mismo id no re-inicializaría nada y la
          // revalidación no entraría nunca.
          key={borradorReunion
            ? `${borradorReunion.id}:${borradorReunion.estado ?? 'pendiente'}:${borradorReunion.tareas.length}:${borradorReunion.aplicadas?.length ?? 0}`
            : pendientes.map((p) => p.id).join('|')}
          props={borradorReunion ? [borradorReunion] : pendientes}
          labels={labels}
          // Lo que YA está en el plan, para que el modal no vuelva a ofrecer lo que
          // ya existe: la misma reunión leída dos veces (o el mismo compromiso en dos
          // juntas) traía las tarjetas repetidas y el botón decía "Agregar 48" sin
          // avisar que varias ya estaban.
          existentes={tasks.map((t) => ({ id: t.id, titulo: t.title, hecha: t.progress >= 100 }))}
          onListo={recargar}
          onClose={() => setBorradorReunion(null)}
          onDescartadas={() => { setBorradorReunion(null); setPendientes([]); }}
          // Abrir una que ya cargaste: el detalle se pone adelante y este modal espera
          // atrás (la condición de arriba lo apaga mientras haya una tarea abierta).
          onAbrirTarea={(id) => setOpenId(id)}
          // La MISMA tarjeta del kanban para lo que ya está en el plan (no una lista de
          // texto): si ya es una tarea de verdad, tiene que verse como una tarea.
          renderTaskCard={(id) => { const t = tasks.find((x) => x.id === id); return t ? <CardTile t={t} board={board} warn={false} onOpen={setOpenId} onWarn={setOpenId} onOpenProj={setOpenProj} /> : null; }}
        />
      )}
      {/* El caso frío (una reunión vieja, ya aplicada) igual va al server. Mientras
          viaja se pinta LA MISMA caja del modal con el título real de la reunión y la
          cantidad exacta de tareas —los dos salen del conteo que el server ya mandó con
          la lista, así que no se inventa nada— y filas fantasma del alto de una tarjeta.
          Antes acá había un scrim negro con un spinner centrado y nada más: no decías ni
          a qué reunión habías entrado. */}
      {cargandoBorrador && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 133, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
          <div style={{ width: '100%', maxWidth: 620, height: 'min(86vh, 760px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', display: 'inline-block', animation: 'makoSpinBS .7s linear infinite', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · REUNIÓN → PLAN</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cargandoBorrador.titulo || 'Abriendo lo que sacó MaKo…'}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cargandoBorrador.n > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{cargandoBorrador.n} {cargandoBorrador.n === 1 ? 'tarea' : 'tareas'} de esta reunión</div>
              )}
              {Array.from({ length: Math.max(3, Math.min(6, cargandoBorrador.n || 3)) }).map((_, i) => (
                <div key={i} style={{ height: 62, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: 0.65 - i * 0.08 }} />
              ))}
            </div>
          </div>
          <style>{'@keyframes makoSpinBS{to{transform:rotate(360deg)}}'}</style>
        </div>
      )}
      {importar && <ImportarModal onClose={() => setImportar(false)}
        onListo={(files) => { setImportar(false); setReunionArchivo(files); setExtraerReunion(true); }} />}
      {diag && <Diagnostico />}
      {extraerReunion && <ReunionExtractModal catalogo={repo.catalogo} labels={labels} archivoInicial={reunionArchivo}
        // Los borradores que te MANDÓ otra persona no tienen una reunión tuya en la
        // lista de Fathom (esa grabación es de su cuenta), así que sin esta sección
        // quedaban sin puerta desde que el modal dejó de abrirse solo.
        recibidos={pendientes.filter((p) => !!p.enviadoPor).map((p) => ({
          id: p.id, de: p.enviadoPor ?? '',
          titulo: p.fuenteTitulo || p.resumen || 'Tareas para confirmar',
          n: p.tareas?.filter((t) => !t.esDeOtro).length ?? 0,
        })).filter((r) => r.n > 0)}
        onAbrirRecibido={(id) => {
          const p = pendientes.find((x) => x.id === id);
          if (p) { setReunionArchivo(null); setBorradorReunion(p); }
        }}
        onAbrirBorrador={(rid, meta) => {
          // El selector NO se cierra: queda abierto DEBAJO. Cerrar el borrador te
          // devuelve a la lista de reuniones, que es de donde entraste — cerrar un paso
          // no puede cerrarte los dos. Y como no se desmonta, la lista no se vuelve a
          // pedir a Fathom ni pierde el buscador y el filtro de fecha.
          setReunionArchivo(null);
          // EL BORRADOR YA ESTÁ ACÁ, casi siempre: `pendientes` se pide una vez al montar
          // el board y trae las propuestas ENTERAS, con su `ref`. Fetchear igual era pagar
          // ~300-800 ms de pantalla muerta para volver a traer lo que ya teníamos. Es el
          // mismo atajo que usa onAbrirRecibido dos líneas más arriba.
          const ya = pendientes.find((p) => p.ref === `fathom:${rid}`);
          if (ya) setBorradorReunion(ya);
          else { setCargandoBorrador(meta ?? { titulo: '', fecha: null, n: 0 }); }
          // El fetch SIGUE, siempre: es la revalidación. Si alguien cargó las tareas en
          // otra pestaña, el objeto de memoria diría 'pendiente' y el modal ofrecería
          // «Agregar al plan» sobre tareas que ya están. La `key` de abajo lleva la huella
          // del borrador, así que si la respuesta difiere el modal se remonta con lo
          // fresco, y si es igual React no toca nada y no se ve ni un parpadeo.
          void fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'por-reunion', recordingId: rid }) })
            .then((r) => r.json())
            .then((j) => { if (j?.ok && j.propuesta) setBorradorReunion(j.propuesta as PropuestaPendiente); })
            .catch(() => { /* si falla, queda lo que ya habíamos pintado */ })
            .finally(() => setCargandoBorrador(null));
        }}
        existentes={tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle }))}
        onUsage={(u) => showUsage(u, 'extraer tareas de reunión')} onCrear={crearDesdeReunion} onAmpliar={ampliarDesdeReunion} onClose={() => { setExtraerReunion(false); setReunionArchivo(null); }} />}
      {exportar && <ExportarModal tasks={tasks} labels={labels} titulo={repo.labelPlural === 'Proyectos' ? 'Plan' : repo.labelPlural} onClose={() => setExportar(false)} />}
      {/* Borrar es UNA pregunta con dos botones: ya no se le pide permiso al Perro. La
          tarea que no está terminada y el motivo, que ahora es opcional, van al historial
          del proyecto igual que antes. */}
      {eliminarTask && <EliminarModal tipo="tarea" nombre={eliminarTask.title}
        onCompletar={eliminarTask.progress >= 100 ? undefined : () => board.toggleDone(eliminarTask.id)}
        onDebate={board.repo.debatePrioridad ? () => setDebateId(eliminarTask.id) : undefined}
        onBorrar={(motivo) => { board.remove(eliminarTask.id, motivo); setOpenId(null); }} onClose={() => setEliminarTaskId(null)} />}
      {eliminarProj && <EliminarModal tipo="proyecto" nombre={eliminarProj.name} nTareas={tasks.filter((t) => t.labels.includes(eliminarProj.id)).length}
        onBorrar={() => { board.deleteLabelYTareas(eliminarProj.id); setOpenProj(null); }} onClose={() => setEliminarProjId(null)} />}
      {asignarTask && <AsignarProyectoModal task={asignarTask} labels={labels}
        onAsignar={(ids, motivo) => { const snap = asignarTask; board.setTaskLabels(asignarTask.id, ids, `${ids.length ? `Asignó a ${ids.map((id) => board.labelById(id)?.name).filter(Boolean).join(', ')}` : 'Quitó el proyecto'}${motivo ? ` — ${motivo.slice(0, 80)}` : ''}`); board.showUndo('Proyecto actualizado', () => board.replaceTask(snap)); }}
        onClose={() => setAsignarTaskId(null)} />}
      {/* ⚠️ HERMANO DE LOS DETALLES, NO HIJO. Igual que `AsignarProyectoModal`: escrito
          dentro de los `children` de un modal de la casa se escondería solo (la pila apaga
          al de abajo con `display:none`, y un descendiente se apaga con él). Acá el detalle
          se sigue viendo debajo, que es lo que se pidió el 26/09 («no debería cerrarse el
          detail»). */}
      {asignarCli && cliDe && (
        <AsignarClienteModal
          que={asignarCli.tipo === 'tarea' ? 'la tarea' : 'el proyecto'}
          nombre={'title' in cliDe ? cliDe.title : cliDe.name}
          clientes={clientes}
          actualId={clienteDe(cliDe)?.leadId ?? null}
          onElegir={(c) => {
            const v = c ? { leadId: c.leadId, nombre: c.nombre } : null;
            if (asignarCli.tipo === 'tarea') board.setCliente(asignarCli.id, v);
            else board.setLabelCliente(asignarCli.id, v);
          }}
          onClose={() => setAsignarCli(null)} />
      )}
      {/* HERMANO, no hijo, por lo mismo que el de arriba: adentro del detalle la pila lo
          apagaría junto con él. `anidada` (que trae el propio `PortadaPicker`) deja ver el
          detalle abajo, que es de donde se abrió. */}
      {/* HERMANO del de portada y por lo mismo: adentro del detalle la pila lo apagaría
          junto con él. El emoji va a la columna `emoji` y el ícono a `icono` — son dos
          columnas y sólo una manda, porque `emoji` la leen como TEXTO el prompt de
          reuniones, el export a Markdown, el CSV y la API de MaKo (ver mig 0174). */}
      {iconoDe && (() => {
        const l = labels.find((x) => x.id === iconoDe.id);
        if (!l) return null;
        return (
          <IdentidadPicker
            emoji={l.emoji}
            icono={l.icono}
            ancla={iconoDe.ancla}
            titulo={`Ícono de ${l.name}`}
            onElegir={(cambio) => {
              // ⚠️ ELEGIR UN EMOJI LIMPIA `icono`, y elegir un ícono NO toca `emoji`.
              // Lo primero, para que no queden dos respuestas a «¿qué se dibuja?».
              // Lo segundo, porque `emoji` es el respaldo que siguen leyendo el prompt
              // y el export: dejarlo intacto es lo que hace que un proyecto con un
              // logo subido siga teniendo un glifo que poner en un texto plano.
              if (cambio.emoji !== undefined) board.patchLabelLog(iconoDe.id, { emoji: cambio.emoji || '📁', icono: null }, 'Cambió el emoji');
              else if (cambio.icono !== undefined) board.patchLabelLog(iconoDe.id, { icono: cambio.icono }, cambio.icono ? 'Cambió el ícono' : 'Sacó el ícono');
            }}
            onCerrar={() => setIconoDe(null)} />
        );
      })()}
      {portadaDe && (() => {
        const l = labels.find((x) => x.id === portadaDe.id);
        if (!l) return null;
        return (
          <PortadaPicker
            valor={l.portada}
            colorBase={l.color}
            ancla={portadaDe.ancla}
            titulo={`Portada de ${l.name}`}
            onColor={(c) => board.patchLabelLog(portadaDe.id, { color: c }, 'Cambió el color')}
            /* ⚠️ ELEGIR YA NO CIERRA: el panel cuelga del campo y la banda de al lado
               cambia en vivo, que es para lo que se hizo popover. Cerrar acá obligaba a
               reabrirlo por cada degradado que quisieras ver. */
            onElegir={(v) => {
              // Por `patchLabelLog` y no por `patchLabel`: de ahí salen el guardado, el
              // Change History y el deshacer. Un cambio escrito al costado se guarda igual
              // y no se puede deshacer, que es la regla de «lo que vale para TODOS los
              // cambios se escribe donde pasan todos».
              board.patchLabelLog(portadaDe.id, { portada: v }, v ? 'Cambió la portada' : 'Sacó la portada');
            }}
            onCerrar={() => setPortadaDe(null)} />
        );
      })()}
      {datosOpen && <DatosModal items={faltantes}
        onSetDeadline={(id, fecha) => board.setDeadline(id, fecha, '')}
        onAbrir={(id) => { setDatosOpen(false); setOpenId(id); }}
        onIgnorarDl={ignorarDl}
        onClose={cerrarDatos} />}
      {/* Bienvenida "MaKo cargó tareas": se abre sola UNA vez al entrar (Datos ya no). No se
          apila sobre un detalle abierto por deep-link (?tarea=): ahí espera a que se cierre. */}
      {welcomeVisible && !openId && !openProj && !peekProjId && <TareasCreadasModal tasks={welcomeTasks} projects={welcomeProjects} proyNuevoIds={proyNuevoIds}
        renderTaskCard={(t) => <CardTile t={t} board={board} warn={false} onOpen={setOpenId} onWarn={setOpenId} onOpenProj={setOpenProj} />}
        renderProjCard={(l) => <ProyectoCardTile l={l} prog={projProgress(tasks, l.id)} isTop={l.id === topProjectId} onOpen={() => setOpenProj(l.id)} />}
        onClose={() => setWelcomeVisible(false)} />}
      {confirm && <ConfirmModal msg={confirm.msg} onOk={() => { confirm.onOk(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
      <UndoToast state={board.undo} onClose={board.clearUndo} />
    </Marco>
  );
}

/* ⚠️ `COL_DER` (el ancho de la columna derecha) y `MODAL_DETALLE` (el ancho del modal) NO
   viven acá: viven en `./piezas`, y el porqué está escrito ahí. En dos palabras: la tabla
   de tareas de un proyecto se dibuja DENTRO de la columna principal de este mismo modal,
   así que su ancho sale de restarle `COL_DER` — y `Tablas.tsx` no puede importarlo de acá
   (BoardShell importa las tablas). Con el número escrito en los dos archivos, el 25/09 la
   columna subió de 236 a 264 de un lado y la tabla se siguió dimensionando contra 236 del
   otro: «entra sin scroll» calculado con un ancho que ya no existía. */

// ── átomos ────────────────────────────────────────────────────────────────────
const ghostBtn: CSSProperties ={ padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, width: '100%' };
// ⛔ ACÁ VIVÍA `cambiarBtn`, el molde del botón «Cambiar prioridad / Cambiar proyecto».
// Se quedó sin un solo call site cuando los dos botones se volvieron el LÁPIZ pegado al
// rótulo (23-25/09/2026, «no tiene sentido el botón si dijimos que ya no hay fricción»).
// Una constante que no importa nadie compila perfecto y no hace nada.

function FunnelIcon({ color = 'currentColor', size = 17 }: { color?: string; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>; }
/**
 * Exportar el tablero. Era un desplegable con tres salidas fijas —o te llevabas todo
 * o nada, y sin el P# del proyecto, sin la justificación de prioridad y sin las notas—.
 * Ahora abre el mismo formulario que el resto de la app: una pregunta por pantalla
 * (qué · de qué proyectos · qué tareas · qué datos · qué formato) en ExportarModal.
 */
// BarraAcciones se MUDO a app/_components/BarraAcciones.tsx.
//
// No fue una prolijidad: la monta tambien la barra de Clientes
// (app/customer-success/BarraClientes.tsx), y mientras vivio aca ese import
// arrastraba ESTE archivo entero -5.728 lineas y 56 imports de primer nivel, con
// todos los modales del tablero adentro- al bundle de cualquier pantalla que la
// usara. Se midio al ir a montarla en /admin, que hoy no carga nada de esto.
//
// Se re-exporta para no tocar los call-sites que ya la importaban de aca.
// ⚠️ IMPORT **Y** EXPORT, no un `export … from`: ese no crea binding local y este
// mismo archivo la usa mas abajo. Es la trampa que AGENTS.md ya tiene escrita.
import { BarraAcciones } from '@/app/_components/BarraAcciones';
export { BarraAcciones };
export type { AccionPlegable } from '@/app/_components/BarraAcciones';

function ExportarBoton({ onAbrir }: { onAbrir: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onAbrir} aria-label="Exportar el tablero" title="Exportar las tareas y los proyectos"
      style={{ display: 'inline-flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: `1px solid ${hover ? 'var(--primary)' : 'var(--border-strong)'}`, background: 'var(--surface)', cursor: 'pointer', color: hover ? 'var(--primary)' : 'var(--dim)', padding: 0 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <DownloadIcon />
    </button>
  );
}
/**
 * NOTAS — el cuaderno del dueño. El `detalle` dice QUÉ hay que hacer y lo escribe (o
 * lo amplía) el Perro; esto es de él y no lo toca nadie: dónde quedó, con quién habló,
 * el link que le pasaron, por qué lo frenó. Antes todo eso terminaba metido en el
 * detalle, donde la IA lo reescribe en la siguiente pasada.
 *
 * Guarda al salir del campo, no en cada tecla: escribir una nota larga son cien
 * escrituras a la base y cien líneas de historial.
 */
/**
 * Línea entre secciones del detalle. Antes el modal apilaba título, detalle, avance,
 * checklist e historial con un margin y nada más: se leía como UNA sola sección larga.
 * Una línea y aire alcanzan — no hacen falta cajas.
 */
function Separador() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '26px 0 22px' }} />;
}

/**
 * El CHECK de completar.
 *
 * ⚠️ NO ES UNA CASILLA, Y ESA ES TODA LA PIEZA. En esta app un cuadrado que se tilda
 * significa SELECCIONAR — es lo que hace la casilla del lote en el Kanban — y nada más:
 * «vos tenés que saber de que la checkbox en todos los lugares de la aplicación tiene que
 * significar una cosa… y el de completar tiene que ser un check» (25/09/2026). Había un
 * cuadrado de 15-16px haciendo de «completar» en CUATRO pantallas (la tarjeta del Kanban,
 * la de Prioridades, el header del detalle y la lista de un proyecto), o sea el mismo
 * dibujo para dos acciones opuestas y a un click de distancia.
 *
 * Vive en un solo lugar para que no vuelvan a divergir: si mañana el check cambia, cambia
 * en las cuatro.
 */
function CheckHecho({ done, size = 16 }: { done: boolean; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: done ? 'var(--good)' : 'var(--faint)' }}>
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={done ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.6 6.3 11.9 13 4.4" /></svg>
    </span>
  );
}

/* ⛔ ACÁ VIVÍA UNA SEGUNDA COPIA DE `IconoTacho`, idéntica carácter por carácter a la de
   `./piezas`. Nació privada acá y el 25/09/2026 la fila de la tabla necesitó el MISMO
   tacho; como `Tablas.tsx` no puede importar de este archivo (BoardShell importa las
   tablas y el ciclo deja el componente en `undefined`), el ícono se mudó a `piezas.tsx`
   —que existe justamente para eso— y acá quedó la copia vieja. Dos SVG iguales en dos
   archivos son dos SVG que divergen a la primera corrección, así que ahora se importa:
   la tarjeta, el pie del detalle y la fila de la tabla dibujan LA MISMA pieza. */

// Un título del contrato se reconoce sin tildes y sin mayúsculas: lo escriben cinco
// caminos distintos (Fathom, WhatsApp, un archivo, Claude Code, a mano) y «Que hay que
// hacer» sin tilde es el mismo título que «Qué hay que hacer».
const sinTilde = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Los títulos de los DOS moldes: el de una tarea («Qué hay que hacer»…) y el de un
// proyecto («Qué es», «Qué ya está»…). Uno solo, y salen del contrato: copiar la lista
// acá es la segunda definición que se queda vieja. No colisionan, y da igual si un título
// suelto aparece en el molde equivocado: reconocerlo de más sólo agrega un chevron, no
// parte nada — desde que el detalle es UN documento, plegar no puede perder texto.
const TITULOS_DETALLE = new Set([...PARTES_DETALLE, ...PARTES_PROYECTO].map(sinTilde));
/**
 * ¿Este encabezado abre una sección? Los del contrato SIEMPRE; y además cualquier
 * negrita corta que esté sola en su renglón.
 *
 * Por qué no alcanzaba con los del contrato: la #783 —el documento de oferta— arranca
 * con «El entregable», «Por qué es UNA tarea y no ocho», «Lo que ya está decidido»… y
 * recién después trae los cuatro. Sin esto quedaba un muro de texto arriba y cuatro
 * renglones plegados abajo. «Revisa los copy del detalle siempre formateados y con
 * desplegables… es muy largo como introducción» (25/09/2026).
 *
 * ⚠️ El tope de 60 caracteres NO es cosmético: sin él, un párrafo entero en negrita
 * —que en estos detalles abunda— se vuelve el título de su propia sección y el
 * desplegable queda diciendo el texto que esconde.
 */
const esEncabezado = (txt: string) => {
  const t = txt.trim();
  if (!t) return false;
  if (TITULOS_DETALLE.has(sinTilde(t))) return true;
  return t.length <= 60 && !t.endsWith('.') && !t.endsWith(':');
};
/** La clave con la que se recuerda un encabezado plegado: su texto sin tildes, sin
 *  mayúsculas y sin los dos puntos del final. NO es el índice, a propósito: escribir un
 *  renglón más arriba corre todos los índices de abajo y con eso se plegaría sola una
 *  parte que nadie tocó. */
const sinDosPuntos = (txt: string) => txt.replace(/\s*:\s*$/, '');
const claveHead = (txt: string) => sinTilde(sinDosPuntos(txt));

/**
 * ¿ESTE BLOQUE DEL EDITOR ES UN ENCABEZADO? Devuelve su texto, o `null`.
 *
 * ⚠️ ACÁ ESTABA EL BUG DE «SAQUÉ LOS DESPLEGABLES SIN QUERER BORRANDO 1» (25/09/2026).
 * La condición vieja era `hijo.children.length === 1` y ese único hijo un `<strong>`, o
 * sea: la forma EXACTA que emite `mdAHtml`. Pero esto se decora sobre el DOM de un
 * `contentEditable`, donde la persona parte, fusiona y reescribe renglones todo el tiempo,
 * y Chrome deja formas perfectamente normales que esa condición no reconoce. Medido en
 * Chrome el 25/09/2026 con el mismo doc de cuatro partes:
 *
 *   · `<div><strong>Por qué</strong><br></div>`      → 2 hijos → sin chevrón (y `<br>` es
 *     lo que Chrome deja al borrar hasta el final de un renglón)
 *   · `<div><strong>Por</strong><strong> qué</strong></div>` → 2 hijos → sin chevrón
 *     (editar en el medio de un encabezado parte el `<strong>` en dos)
 *   · `<h3>Por qué</h3>`                              → el botón del toolbar (pedido 3)
 *
 * Ninguna de las tres pierde una letra y en las tres el chevrón desaparecía. La pregunta
 * correcta no es «¿tiene exactamente un hijo?» sino «¿TODO el texto de este bloque está en
 * negrita?», que es lo que la persona ve.
 *
 * ⚠️ Y UN `h1-h6` NO PASA POR LA HEURÍSTICA de `esEncabezado` (≤60 caracteres, sin punto ni
 * dos puntos al final). Esa heurística existe para no confundir un párrafo en negrita con
 * un título; un `<h3>` lo pone el botón del toolbar a propósito, y si el creador y el
 * reconocedor no usan la misma regla, lo que creás no se pliega y no hay ningún error.
 * UN SOLO encabezado alcanza: no hay ningún mínimo de dos: eso era de cuando el detalle se
 * PARTÍA en secciones, y partir en uno no tiene sentido. Poner un chevrón, sí.
 */
/**
 * El texto de un bloque SIN el chevron que le montamos encima.
 *
 * ⚠️ Hace falta porque un encabezado YA DECORADO tiene el botón adentro, y `textContent` lo
 * incluye. Hoy el chevron es un `<svg>` y no aporta ni una letra, así que leer `textContent`
 * a secas «funciona» — por casualidad: el día que el botón lleve un carácter (un `›`, una
 * flecha, un contador) la clave del plegado pasa a ser «›por qué» y deja de coincidir con la
 * que guardó el toggle. Medido el 25/09/2026 en el arnés, donde el chevron SÍ era un `›`: la
 * guardia frenaba bien el borrado y las partes NO se desplegaban, o sea que para la persona
 * el gesto «no hacía nada», que es el peor resultado posible de un bloqueo.
 */
function textoSinChevron(el: Element): string {
  return Array.from(el.childNodes)
    .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && (n as Element).getAttribute('data-mk') === 'c'))
    .map((n) => n.textContent || '').join('').trim();
}

function encabezadoDeBloque(hijo: HTMLElement): string | null {
  // Sin el chevron, por la misma razón que arriba: el texto que sale de acá es la CLAVE con
  // la que se recuerda si esta parte está plegada.
  const txt = textoSinChevron(hijo);
  if (!txt) return null;
  if (/^H[1-6]$/.test(hijo.tagName)) return txt;
  let negrita = false;
  for (const n of Array.from(hijo.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      if ((n.textContent || '').trim()) return null; // texto pelado fuera de la negrita
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as HTMLElement;
    if (el.tagName === 'BR' || el.getAttribute('data-mk') === 'c') continue;
    if (/^(STRONG|B)$/.test(el.tagName)) { negrita = true; continue; }
    // Un envoltorio (span/em/u) cuenta sólo si TODO su texto está adentro de una negrita.
    const propio = (el.textContent || '').trim();
    const enNegrita = Array.from(el.querySelectorAll('strong,b')).map((x) => (x.textContent || '').trim()).join('');
    if (propio && enNegrita === propio) { negrita = true; continue; }
    return null;
  }
  return negrita && esEncabezado(sinDosPuntos(txt)) ? txt : null;
}

/**
 * Saca la decoración del plegado de un HTML ANTES de guardarlo.
 *
 * ⚠️ EL ORDEN IMPORTA. Los botones se borran enteros PRIMERO, porque se reconocen por su
 * propio `data-mk`: barriendo los atributos antes quedaría un `<button>` sin marca y el
 * segundo paso ya no lo vería. Es el mismo bug de orden del guard del voseo (AGENTS.md).
 *
 * Los `aria-label`/`title` del botón son TEXTO FIJO y no el nombre de la sección: un `>`
 * adentro del valor de un atributo no se escapa al serializar, y ahí `[^>]*` cortaría el
 * tag por la mitad y la marca quedaría escrita en el detalle.
 *
 * Probado ROMPIÉNDOLO (25/09/2026, sobre el HTML que el navegador serializa de verdad,
 * leyendo esta misma función del fuente en vez de transcribirla): con el orden correcto
 * el ida y vuelta devuelve el html idéntico carácter por carácter y es idempotente;
 * invirtiendo los dos `replace` queda un `<button type="button" contenteditable="false"…>`
 * huérfano DENTRO del detalle guardado.
 */
const sinMarcas = (html: string) => html
  // El encabezado del intro es INVENTADO —no lo escribió nadie— así que se va ENTERO, y
  // primero: si se fuera sólo su `data-mk`, quedaría un «Resumen» escrito dentro del
  // detalle guardado, y a la vuelta siguiente el documento tendría un encabezado de verdad
  // que nadie puso. Es la misma razón y el mismo orden que el del botón de acá abajo.
  .replace(/<div class="mk-intro"[\s\S]*?<\/div>/gi, '')
  .replace(/<button[^>]*\sdata-mk="c"[^>]*>[\s\S]*?<\/button>/gi, '')
  .replace(/\s*data-mk="[^"]*"/gi, '');

/** El rótulo del desplegable que envuelve al intro. No se guarda: ver `sinMarcas`. */
const ROT_INTRO = 'Resumen';
/** Su clave en el mapa de plegados. Empieza con un carácter que ningún encabezado real
 *  puede tener, así que no puede chocar con `claveHead` de una sección que se llame así. */
const CLAVE_INTRO = '\u0000intro';

const CHEVRON_HTML = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 1.4 L7 5 L3.4 8.6"/></svg>';

const CSS_DOC = [
  '.mk-doc [data-mk="x"]{display:none}',
  '.mk-doc [data-mk="h"],.mk-doc [data-mk="ho"]{position:relative}',
  // El encabezado del intro se dibuja como los de verdad: mismo peso, misma canaleta. Lo
  // único distinto es que no es texto del documento, y por eso va `contenteditable=false`.
  '.mk-doc .mk-intro{font-weight:700;color:var(--ink);margin:0 0 .35em}',
  // `left:-24px` y no -23: la canaleta pasó a 27px para dejarle los 2 primeros píxeles a
  // `FOCO_BARRA` (la barra de foco del editor, ver RichText). Sin ese respiro el chevrón
  // se dibuja encima de la barra y el foco del doc queda tapado justo al escribir.
  '.mk-doc button[data-mk="c"]{position:absolute;left:-24px;top:.12em;width:19px;height:19px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:5px;background:transparent;color:var(--faint);cursor:pointer;user-select:none}',
  '.mk-doc button[data-mk="c"]:hover{background:var(--surface-2);color:var(--ink)}',
  '.mk-doc button[data-mk="c"] svg{transition:transform .14s}',
  '.mk-doc [data-mk="ho"] button[data-mk="c"] svg{transform:rotate(90deg)}',
].join('');

/**
 * El detalle: UN SOLO DOCUMENTO, con los encabezados plegables.
 *
 * «Cada desplegable es como un FORMATEO de texto, no una sección más, tiene que ser 1 solo
 * detalle, no muchos» (25/09/2026). Lo que había —`DetalleSecciones`— partía el campo en N
 * pedazos y montaba UN `RichText` POR SECCIÓN, cada uno con su caja y su separador, y al
 * guardar rearmaba el campo concatenando. Se leía como cuatro documentos pegados.
 *
 * ⚠️ Y EL RIESGO CARO SE FUE CON ELLO: el rearmado era la única parte del detalle que podía
 * PERDER texto (por eso estaba probado rompiéndolo, con el encabezado reemitido tal cual).
 * Acá no hay nada que rearmar — el `RichText` tiene el HTML entero adentro, como cualquier
 * otro campo— así que esa clase de bug no existe más.
 *
 * Plegar es una forma de VER el texto: se esconden los bloques que van DESPUÉS de un
 * encabezado hasta el encabezado siguiente. El primero arranca abierto —es el que contesta
 * «¿qué hago?»— y el resto plegado, que es lo que se venía pidiendo («es muy largo como
 * introducción»).
 *
 * ⚠️ LO QUE SE DIBUJA PARA PLEGAR NO SE GUARDA. El botón del chevron y el atributo
 * `data-mk` viven DENTRO del contentEditable, así que viajan en el `innerHTML` que
 * `RichText` commitea en cada blur; `sinMarcas` los saca antes de que el valor llegue al
 * board, y la comparación de «¿cambió algo?» se hace contra el texto YA limpio — sin eso,
 * abrir y cerrar el modal sin tocar nada escribiría una edición fantasma en el historial.
 */
function DetalleDoc({ valor, onChange, placeholder }: { valor: string; onChange: (html: string) => void; placeholder?: string }) {
  const cajaRef = useRef<HTMLDivElement>(null);
  // `true`/`false` EXPLÍCITO de lo que la persona abrió o cerró. Lo que no está acá lo
  // decide la regla: abierto si es el primer encabezado, plegado si no.
  const [tocados, setTocados] = useState<ReadonlyMap<string, boolean>>(new Map());
  /**
   * ⚠️ POR QUÉ HAY UN CONTADOR ACÁ. `RichText` vuelve a escribir su `innerHTML` cada vez
   * que deja de estar enfocado, y eso BORRA la decoración: entrar al doc y salir sin
   * tocar nada dejaba el detalle sin chevrones y con todo desplegado. Un blur bumpea
   * esto, el efecto vuelve a correr y redecora.
   *
   * Los dos efectos caen en el mismo commit y el del hijo corre primero, así que el
   * navegador pinta una sola vez: no hay parpadeo de lo plegado. Por lo mismo el efecto
   * de acá NO puede ser `useLayoutEffect` —correría ANTES del borrado, no después.
   */
  const [pulso, setPulso] = useState(0);
  // Defensivo: si alguna vez quedó una marca escrita en la base, no se dibuja.
  const base = useMemo(() => sinMarcas(valor || ''), [valor]);

  useEffect(() => {
    const ed = cajaRef.current?.querySelector('.mako-rt') as HTMLElement | null;
    if (!ed) return;
    // La pasada anterior se borra entera: los botones se vuelven a crear con su listener.
    ed.querySelectorAll('button[data-mk="c"]').forEach((b) => b.remove());
    ed.querySelectorAll('.mk-intro').forEach((e) => e.remove());
    ed.querySelectorAll('[data-mk]').forEach((e) => e.removeAttribute('data-mk'));

    /**
     * ⚠️ EL INTRO TAMBIÉN SE PLIEGA, Y PARA ESO HAY QUE INVENTARLE UN ENCABEZADO. «Todas las
     * intro de las descripciones deben estar dentro de un desplegable, que no esté plegado»
     * (25/09/2026). Lo que va antes del primer encabezado no es una sección —nadie le puso
     * título— y hasta hoy era la única parte del documento que NO se podía cerrar: un muro
     * de texto permanente arriba de una lista de renglones plegados.
     *
     * El encabezado lo pone el código y NO se guarda (`sinMarcas` lo borra entero, ver allá).
     * Va `contenteditable=false` para que escribir no caiga adentro, y se borra y se vuelve
     * a crear en cada pasada, igual que los chevrones — un nodo decorativo que sobrevive a
     * una edición es un nodo que la próxima edición deja corrupto.
     */
    const primerHijo = ed.firstElementChild as HTMLElement | null;
    if (primerHijo && !encabezadoDeBloque(primerHijo)) {
      const h = document.createElement('div');
      h.className = 'mk-intro';
      h.setAttribute('contenteditable', 'false');
      h.textContent = ROT_INTRO;
      ed.insertBefore(h, primerHijo);
    }
    const toggle = (k: string, abiertoAhora: boolean) =>
      setTocados((prev) => { const m = new Map(prev); m.set(k, !abiertoAhora); return m; });
    let plegando = false;   // ¿venimos escondiendo el cuerpo del encabezado anterior?
    /**
     * ⚠️ EL PRIMER DESPLEGABLE ARRANCA ABIERTO, SEA CUAL SEA. «Siempre el primer
     * desplegable del detalle de cada tarea o proyecto debe estar desplegado, el resto,
     * plegado» (30/09/2026).
     *
     * Antes la condición era `esIntro`, y eso dejaba el documento ENTERO plegado cuando
     * no había intro — que es el caso de todo detalle escrito con el molde de la casa,
     * porque arranca con `**Qué es**` y ahí el primer hijo YA es un encabezado. O sea:
     * la regla abría el primero sólo cuando el primero era el bloque sin título.
     *
     * Y la razón por la que en su momento se eligió el intro sigue valiendo, sin
     * excepción aparte: cuando hay intro, el intro ES el primero. Lo que aquella captura
     * mostraba mal —«Lo que ya está decidido» abierto ENCIMA del muro del intro— eran
     * DOS bloques abiertos a la vez, y con esta regla nunca hay dos.
     */
    let yaHuboUno = false;
    for (const hijo of Array.from(ed.children) as HTMLElement[]) {
      const esIntro = hijo.classList.contains('mk-intro');
      // ⚠️ Los dos puntos del final los saca `encabezadoDeBloque` ANTES de preguntar:
      // `esEncabezado` descarta todo lo que termina en `:` (para no comerse un párrafo
      // introductorio), así que un «**Lo que ya está decidido:**» —que es como los escribe
      // media extracción— no llevaría chevron.
      const txt = esIntro ? ROT_INTRO : encabezadoDeBloque(hijo);
      if (!txt) {
        if (plegando) hijo.setAttribute('data-mk', 'x');
        continue;
      }
      const k = esIntro ? CLAVE_INTRO : claveHead(txt);
      const esPrimero = !yaHuboUno;
      yaHuboUno = true;
      // Lo que la persona abrió o cerró GANA siempre: la regla sólo decide el arranque.
      const abierto = tocados.get(k) ?? esPrimero;
      plegando = !abierto;
      hijo.setAttribute('data-mk', abierto ? 'ho' : 'h');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-mk', 'c');
      b.setAttribute('contenteditable', 'false');
      b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      b.setAttribute('aria-label', abierto ? 'Plegar esta parte del detalle' : 'Desplegar esta parte del detalle');
      b.setAttribute('title', abierto ? 'Plegar esta parte' : 'Desplegar esta parte');
      b.innerHTML = CHEVRON_HTML;
      // `mousedown` cancelado: sin esto el click primero mueve el cursor de texto al
      // encabezado y recién después pliega, así que plegar dejaba el editor enfocado.
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(k, abierto); });
      hijo.insertBefore(b, hijo.firstChild);
    }
  }, [base, tocados, pulso]);

  /**
   * ⚠️ LO QUE ESTÁ PLEGADO NO SE PUEDE BORRAR SIN VERLO. Ésta es la mitad IRREVERSIBLE del
   * «saqué los desplegables sin querer borrando 1», y se midió en Chrome el 25/09/2026:
   *
   * con el doc de cuatro partes y tres de ellas plegadas, la pantalla muestra tres
   * renglones cortos y pegados («Por qué», «Detalles concretos», «Listo cuando»). Seleccionar
   * del primero al último —que a la vista es seleccionar tres palabras— y apretar Backspace
   * se llevó también los DOS párrafos escondidos entre ellos: el cuerpo plegado sigue dentro
   * del `contentEditable` y entra en el rango igual que si estuviera a la vista. El texto no
   * lo pierde el plegado ni `sinMarcas` —eso se comprobó y vuelve entero—, lo pierde ESTE
   * gesto, y no queda ningún rastro de lo que había.
   *
   * La cura es la regla de la casa: lo irreversible se muestra ANTES. Si lo que se va a
   * escribir o borrar toca un cuerpo plegado, el navegador NO lo hace y esas partes se
   * despliegan. La persona ve aparecer el texto que estaba por borrar y decide de nuevo; un
   * `deshacer` acá no alcanzaría, porque el editor commitea al blur y lo que se guarda ya
   * viene sin el texto.
   *
   * Va como listener NATIVO y no como `onBeforeInput` de React: lo único que distingue
   * «Backspace pegado a una parte plegada» de «Backspace en el medio de un renglón» es
   * `getTargetRanges()`, que sólo trae el evento nativo.
   *
   * Probado ROMPIÉNDOLO en Chrome (25/09/2026), con el mismo gesto —clic en «Por qué»,
   * shift-clic en «Listo cuando», Backspace—: SIN esta guardia se perdieron los 2 párrafos
   * escondidos y no se bloqueó nada (0 eventos frenados); CON ella, 2 eventos frenados,
   * 0 párrafos perdidos, y las dos partes quedaron desplegadas con su texto a la vista.
   */
  useEffect(() => {
    const ed = cajaRef.current?.querySelector('.mako-rt') as HTMLElement | null;
    if (!ed) return;
    const guardia = (e: Event) => {
      const ev = e as InputEvent;
      const st = typeof ev.getTargetRanges === 'function' ? ev.getTargetRanges()[0] : undefined;
      let rango: Range | null = null;
      if (st) { rango = document.createRange(); rango.setStart(st.startContainer, st.startOffset); rango.setEnd(st.endContainer, st.endOffset); }
      else { const s = window.getSelection(); rango = s && s.rangeCount ? s.getRangeAt(0) : null; }
      if (!rango || rango.collapsed) return;
      const tapados = Array.from(ed.querySelectorAll('[data-mk="x"]')).filter((n) => rango!.intersectsNode(n));
      if (!tapados.length) return;
      e.preventDefault();
      const claves = new Set<string>();
      for (const n of tapados) {
        let p: Element | null = n;
        while (p && p.getAttribute('data-mk') !== 'h') p = p.previousElementSibling;
        if (p) claves.add(claveHead(textoSinChevron(p)));
      }
      setTocados((prev) => { const m = new Map(prev); claves.forEach((k) => m.set(k, true)); return m; });
    };
    ed.addEventListener('beforeinput', guardia);
    return () => ed.removeEventListener('beforeinput', guardia);
  }, []);

  return (
    <div ref={cajaRef} className="mk-doc" onBlurCapture={() => setPulso((n) => n + 1)}>
      <style>{CSS_DOC}</style>
      {/* El `paddingLeft` es la CANALETA donde vive el chevron: sin él, el botón queda
          fuera de la caja del editor y lo puede recortar la columna. Son 27 y no 23 porque
          los 2 primeros píxeles son de `FOCO_BARRA`. */}
      <RichText value={base} placeholder={placeholder} style={{ paddingLeft: 27 }}
        encabezados
        /* El encabezado recién creado nace ABIERTO: si cayera plegado, el botón escondería
           el renglón que la persona está escribiendo. El `pulso` es para el caso inverso
           —quitar el encabezado—, donde no hay clave nueva que anotar y hay que redecorar
           igual; el toolbar no dispara blur (cancela su `mousedown` para no perder el
           cursor), así que sin esto la pasada no vuelve a correr. */
        onFormato={(nuevo) => {
          if (nuevo) setTocados((prev) => { const m = new Map(prev); m.set(claveHead(nuevo), true); return m; });
          setPulso((n) => n + 1);
        }}
        onChange={(html) => {
          const limpio = sinMarcas(html);
          // La misma guarda que `RichText` hace contra `value`, pero sobre el texto limpio:
          // el campo guarda markdown en casi todas las tarjetas y el editor muestra su
          // conversión, así que sin comparar también contra `mdAHtml` abrir y cerrar sin
          // tocar nada guardaría el HTML convertido y estamparía una entrada en el historial.
          if (limpio !== base && limpio !== mdAHtml(base)) onChange(limpio);
        }} />
    </div>
  );
}

/* ⛔ ACÁ VIVÍA `NotasBox`, un `<textarea>` con su rótulo «Notas» y su «sin guardar». Lo
   reemplazó `NotasLista` (./NotasLista) —las notas como lista, con su fecha— y quedó sin
   un solo call site. Dos componentes para el mismo campo son dos, y el que nadie monta es
   el que se queda viejo: el molde de las notas es `NotasLista` y no hay otro. */
/**
 * "Esto se hace acá adentro". Cuando el Perro reconoció que la tarea se resuelve en una
 * tab de MaKo, la tarjeta deja de ser un deber y pasa a ser un botón: el nombre de la
 * pantalla, los pasos, y el link. La lista de capacidades es cerrada y está escrita a
 * mano (lib/mako-capacidades) — mandar a alguien a una pantalla que no hace lo que
 * promete es peor que no decirle nada.
 */
function HaceloEnMaKo({ id }: { id?: string }) {
  const cap = id ? capacidad(id) : undefined;
  if (!cap) return null;
  return (
    <div style={{ border: '1px solid var(--accent-soft, var(--border-strong))', background: 'var(--surface-2)', borderRadius: 12, padding: '12px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <MakoStar size={14} color="var(--accent)" />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>Esto se hace en MaKo</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 8 }}>{cap.que}</div>
      <ol style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>
        {cap.como.map((paso) => <li key={paso}>{paso}</li>)}
      </ol>
      <a href={cap.ruta} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: SANS }}>
        Ir a {cap.tab} →
      </a>
    </div>
  );
}
function DownloadIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>; }

// Ícono de subir archivo (bandeja + flecha hacia arriba) para el botón del toolbar (punto 7).
function DescargarIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>; }
function UploadIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>; }
// Logo del Plan: checklist relleno (mismo motivo que el ícono de la sidebar). Los
// checks/líneas usan --surface para invertir bien en claro/oscuro.
function PlanIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}>
      <rect x="3.4" y="2.4" width="17.2" height="19.2" rx="3.4" fill="var(--ink)" />
      <g stroke="var(--surface)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M6.6 8l1.3 1.3 2.4-2.9" /><path d="M6.6 12.4l1.3 1.3 2.4-2.9" /><path d="M6.6 16.8l1.3 1.3 2.4-2.9" />
        <path d="M13 8h4.3M13 12.4h4.3M13 16.8h4.3" strokeWidth="1.9" />
      </g>
    </svg>
  );
}
// formatea tokens (12300 → "12,3k") para el toast de consumo de IA
// Búsqueda: texto libre sobre título/detalle + por NÚMERO de tarjeta. El #num es
// cómo se referencian las tareas entre sí (y como las nombra MaKo cuando marca un
// duplicado), así que tiene que ser buscable: sin esto el id no sirve para nada.
// "#132" busca SOLO por número (exacto); "132" busca por número o por texto.
// El buscador de proyectos usa el MISMO `coincide` que el de tareas (lib/buscar-tareas).
// Acá vivía una segunda copia, con su propio `paraBuscar`: la de la barra sacaba la
// puntuación y ésta no, la de acá sacaba las etiquetas HTML y la otra no, y las dos
// buscaban por subcadena. Dos buscadores en la misma pantalla que no se parecían.


// filtro por estado (2ª capa del botón Filtrar): Todas / Activas / Completadas.
// ⛔ «Comenzadas» se fue con las checklists — el porqué, veinte líneas más abajo.
/**
 * Cómo se ordena el tablero. Los cuatro valen para tareas Y para proyectos, que es lo que
 * pedía «ordenar por varias cosas, ya sea por prioridad, por deadline, por creación, por Az».
 *
 * ⚠️ `deadline` pone lo SIN FECHA al final SIEMPRE, en las dos direcciones. Una tarjeta sin
 * deadline no es «la más lejana»: es una que no contestó la pregunta, y mezclarla entre las
 * que sí tienen fecha hace que el orden deje de significar «qué vence antes».
 */
type OrdenModo = 'score' | 'creacion' | 'deadline' | 'az';
const ORDEN_OPS: Array<[OrdenModo, string]> = [['score', 'Por prioridad'], ['deadline', 'Por deadline'], ['creacion', 'Por creación'], ['az', 'Alfabético']];
/** El mismo rótulo, corto, para los chips del filtro de proyectos. */
const ORDEN_CORTO: Record<OrdenModo, string> = { score: 'Prioridad', deadline: 'Deadline', creacion: 'Creación', az: 'A-Z' };
/**
 * LA DIRECCIÓN CON LA QUE ARRANCA CADA CRITERIO, que no es la misma para los cuatro.
 *
 * Arrancaban todos en `desc`, y eso deja dos de los cuatro al revés de lo único que alguien
 * quiere ver: «Alfabético» empezaba por la Z, y «Por deadline» por lo que vence MÁS LEJOS.
 * Un orden que hay que invertir a mano apenas se elige no es un orden: es un paso de más.
 * Invertirlo sigue estando a un click.
 */
const DIR_NATURAL: Record<OrdenModo, 'desc' | 'asc'> = { score: 'desc', deadline: 'asc', creacion: 'desc', az: 'asc' };

/**
 * ⛔ ACÁ ESTABA `comenzadas` («progreso entre 1 y 99»), y se fue el 24/09/2026: «elimina el
 * estado Comenzadas, como ya no hay checklist, no tiene sentido». Y es exacto — ese estado
 * existía porque el avance se calculaba tildando pasos, y desde que las checklists salieron
 * del producto (22/09) el progreso sólo vale 0 o 100. El filtro seleccionaba SIEMPRE cero
 * tarjetas: un filtro que no puede devolver nada se lee como que el tablero está vacío.
 */
type DoneFilter = 'all' | 'activas' | 'hechas';
const ESTADO_OPS: Array<[DoneFilter, string]> = [['all', 'Todas'], ['activas', 'Activas'], ['hechas', 'Completadas']];
function pasaEstado(progress: number, f: DoneFilter): boolean {
  if (f === 'all') return true;
  if (f === 'hechas') return progress >= 100;
  return progress < 100; // activas
}

function AvgChip({ avg, hechas, total, label }: { avg: number; hechas: number; total: number; label: string }) {
  // `flex: 'none'` + `whiteSpace: 'nowrap'`: el chip vive en un contenedor con
  // `minWidth: 0` que lo deja encogerse, y cuando el tablero llegó a «89/527 del plan»
  // el texto partió en dos renglones y estiró todo el header. Un contador que cambia de
  // alto según cuántas tareas tengas no es un contador, es un salto.
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flex: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{avg}%</span>
      <span style={{ display: 'block', width: 74, height: 6, flex: 'none', borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: avg + '%', background: 'var(--primary)' }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{hechas}/{total} {label}</span>
    </div>
  );
}

// Chip de proyecto. Si trae onOpen, es CLICKEABLE (feedback jul-19: el chip del header
// del detalle también debe abrir el proyecto, igual que los del sidebar).
function LabelChip({ l, cap = 190, onOpen }: { l: Label; cap?: number; onOpen?: (id: string) => void }) {
  const style: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', maxWidth: cap, overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none', fontFamily: SANS };
  const inner = <><span style={{ flex: 'none' }}>{l.emoji}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span></>;
  // stopPropagation: el chip vive dentro de contenedores que TAMBIÉN son clickeables
  // (la tarjeta abre la tarea). Sin esto, un click abría el proyecto y la tarea a la vez.
  if (onOpen) return <button type="button" title={`Abrir «${l.name}»`} onClick={(e) => { e.stopPropagation(); onOpen(l.id); }} style={{ ...style, cursor: 'pointer' }}>{inner}</button>;
  return <span title={l.name} style={style}>{inner}</span>;
}
// Chips de proyecto con tope: muestra `max` (truncados) + un "+N" si hay más. Evita
// que las tareas con varios proyectos rompan el layout o le coman protagonismo al título.
function LabelChips({ chips, max = 2, cap = 190, onOpen }: { chips: Label[]; max?: number; cap?: number; onOpen?: (id: string) => void }) {
  const shown = chips.slice(0, max);
  const rest = chips.slice(max);
  return <>{shown.map((l) => <LabelChip key={l.id} l={l} cap={cap} onOpen={onOpen} />)}{rest.length > 0 && <MasChip extra={rest} onOpen={onOpen} />}</>;
}
// "+N" con desplegable HOVER (diseño nuestro): muestra los proyectos ocultos con su
// color + emoji. Se renderiza en un PORTAL (fixed) para que NO lo tape ni lo recorte
// ninguna card/columna con overflow, y muestra el NOMBRE COMPLETO (sin cortar).
function MasChip({ extra, onOpen }: { extra: Label[]; onOpen?: (id: string) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Abrir cancela el cierre pendiente; cerrar espera ~2s (feedback jul-19: el desplegable
  // no debe cerrarse solo — te da tiempo a moverte hasta él y leerlo). El propio panel
  // comparte los handlers, así hovering el panel lo mantiene abierto.
  const abrir = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } const r = ref.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 320) }); };
  const cerrarPronto = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), 2000); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // El mouseleave NO alcanza: vive en un PORTAL fijo fuera de la card, así que si el
  // puntero nunca sale (se abrió una tarea encima, la columna scrolleó, la card se
  // desmontó) el panel quedaba flotando para siempre — encima del detalle, incluido.
  // Cualquier gesto que cambie lo que estás mirando lo cierra.
  useEffect(() => {
    if (!pos) return;
    const cerrar = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } setPos(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    // capture: el scroll de una columna del kanban no burbujea hasta window.
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('scroll', cerrar, true);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', cerrar);
    window.addEventListener('blur', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('scroll', cerrar, true);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('blur', cerrar);
    };
  }, [pos]);
  return (
    <span ref={ref} style={{ flex: 'none', display: 'inline-flex' }} onMouseEnter={abrir} onMouseLeave={cerrarPronto}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface)', border: `1px solid ${pos ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 6, padding: '2px 6px', cursor: 'default' }}>+{extra.length}</span>
      {pos && createPortal(
        <span onMouseEnter={abrir} onMouseLeave={cerrarPronto} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 5, width: 300, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: '0 16px 40px rgba(18,21,27,.24)', padding: 8, fontFamily: SANS }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '0 2px 2px' }}>También en</span>
          {extra.map((l) => {
            const est: CSSProperties = { display: 'inline-flex', alignItems: 'flex-start', gap: 6, fontSize: 12, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, borderRadius: 7, padding: '4px 9px', lineHeight: 1.35, textAlign: 'left', fontFamily: SANS };
            const cont = <><span style={{ flex: 'none' }}>{l.emoji}</span><span>{l.name}</span></>;
            return onOpen
              ? <button key={l.id} type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPos(null); onOpen(l.id); }} title={`Abrir «${l.name}»`} style={{ ...est, cursor: 'pointer', width: '100%' }}>{cont}</button>
              : <span key={l.id} style={est}>{cont}</span>;
          })}
        </span>,
        document.body,
      )}
    </span>
  );
}
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}
// barra Impacto/Esfuerzo (1-100): las variables con las que el guardián arma la prioridad.
function IEMeter({ label, v, color }: { label: string; v: number; color: string }) {
  const w = Math.max(0, Math.min(100, v));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, width: 52, flex: 'none' }}>{label}</span>
      <span style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: w + '%', background: color }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color, width: 22, textAlign: 'right', flex: 'none' }}>{v}</span>
    </div>
  );
}
// prioridad del proyecto (1-100) — mismo sistema gauge + número que las tareas

function ProjScore({ score, color, big }: { score: number; color: string; big?: boolean }) {
  return <span title="Prioridad del proyecto" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: big ? 15 : 11, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 6, padding: big ? '3px 10px' : '2px 6px 2px 5px' }}><ScoreIcon size={big ? 15 : 11} color={color} />{score}</span>;
}
// TARJETAS o TABLA. Vive al lado de «Filtrar» porque es lo mismo que un filtro: cambia
// cómo mirás lo que ya está, no lo que hay. Se recuerda por navegador y por vista.
function VistaToggle({ tabla, onSet }: { tabla: boolean; onSet: (v: boolean) => void }) {
  const btn = (activo: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, borderRadius: 7,
    border: 'none', background: activo ? 'var(--surface)' : 'transparent', color: activo ? 'var(--primary)' : 'var(--faint)',
    boxShadow: activo ? '0 1px 2px rgba(18,21,27,.08)' : 'none', cursor: 'pointer', flex: 'none',
  });
  return (
    <div style={{ display: 'inline-flex', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 2 }}>
      <button type="button" onClick={() => onSet(false)} aria-pressed={!tabla} title="Ver en tarjetas" aria-label="Ver en tarjetas" style={btn(!tabla)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
      </button>
      <button type="button" onClick={() => onSet(true)} aria-pressed={tabla} title="Ver en tabla — con deadline, días que faltan y atraso" aria-label="Ver en tabla" style={btn(tabla)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>
    </div>
  );
}
// LA RAZÓN DEL NÚMERO, PLEGADA. Estaba suelta arriba de todo en las dos sidebars y son
// dos o tres renglones de itálica que nadie lee dos veces: «eso está bien que exista, ya
// que el perro seguirá funcionando, pero es mucho texto suelto, entonces mejor que sea un
// desplegable» (22/09). Sigue existiendo y sigue a un click.
/**
 * EL PERRO TRABAJANDO sobre esta tarjeta, en el panel abierto.
 *
 * Crear ya no espera al modelo: la tarjeta nace, el detalle se abre, y durante 10-20
 * segundos la tarjeta está VACÍA —sin proyecto, sin descripción y con el score de fábrica—
 * mientras el Perro la puntúa, la rutea y le escribe el detalle. Sin decirlo, eso se lee
 * como que la creación salió mal.
 *
 * ⚠️ EL RÓTULO SALE DE `GRAMATICA`, NO DE ACÁ (AGENTS.md: «el rótulo de un estado de MaKo no
 * es un prop»). Y el estado `analizando` EXIGE nombrar la fuente: «no usar animación
 * decorativa indefinida» — un spinner sin objeto a los diez segundos es indistinguible de
 * una pantalla colgada.
 */
function PerroTrabajando({ que }: { que: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--mako-weak, var(--border))', background: 'color-mix(in srgb, var(--mako, #C8870C) 8%, transparent)' }}>
      <span style={{ display: 'inline-flex', flex: 'none', animation: 'mkLatido 1.4s ease-in-out infinite' }}><GuardianIcon size={18} /></span>
      <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.35 }}>
        <b style={{ fontWeight: 700 }}>{GRAMATICA.analizando.rotulo}</b> · {que}
      </span>
      <style>{'@keyframes mkLatido{0%,100%{opacity:.45}50%{opacity:1}}'}</style>
    </div>
  );
}

/**
 * EL BLOQUE DE PRIORIDAD del panel del detalle. UNO solo para tareas y para proyectos.
 *
 * El pedido del 23/09/2026, mirando la pantalla, son cuatro cosas y las cuatro están acá:
 *  1. Nada de slider ni de botón de ancho completo: «para eso teníamos el pop-up».
 *  2. Fuera «La fijaste a mano: MaKo ya no la toca. Devolvérsela.».
 *  3. UN desplegable, en el TÍTULO, que abre todo — no uno por sección. Antes eran dos
 *     `<details>` anidados en la misma columna («Por qué este número» e «Impacto y
 *     esfuerzo»), o sea tres clicks para ver tres renglones.
 *  4. El lápiz, minimalista y PEGADO AL NÚMERO. Un ícono suelto al final de la columna no
 *     se lee como «editá esto».
 *
 * ⚠️ ES COMPARTIDO A PROPÓSITO: «revisá que funcione igualmente para tareas como para
 * proyecto». Eran dos copias del mismo bloque, con dos `<details>` cada una, y ya habían
 * divergido (el de proyectos no mostraba el ajuste por tiempo).
 */
function BloquePrioridad({ etiqueta, chip, color, titulo, razon, impacto, esfuerzo, tiempo, puedeEditar, onEditar }: {
  /** «BAJA», «ALTA»… Sólo las tareas tienen banda; un proyecto es su número. */
  etiqueta?: string;
  chip: ReactNode;
  color: string;
  titulo: string;
  razon?: string;
  impacto?: number | null;
  esfuerzo?: number | null;
  /* ⛔ Y NO HAY UN `extra` («lo propio de cada entidad»): su único contenido fue siempre el
     `EscalonChip` del proyecto, que se borró el 23/09/2026 («no entiendo ese pin de
     "construir"… sácalo»), y desde entonces ningún call site lo pasaba. Una ranura vacía en
     un bloque compartido es cómo las dos pantallas vuelven a divergir. */
  /** el ajuste por tiempo (sólo tareas) */
  tiempo?: ReactNode;
  puedeEditar: boolean;
  onEditar: () => void;
}) {
  const hayQueAbrir = !!razon || impacto != null || esfuerzo != null;
  // ⚠️ UNA LÍNEA, Y LO QUE LA HACE ENTRAR NO ES EL TAMAÑO DE LA LETRA: ES QUIÉN CEDE.
  //
  // Esto se reportó roto cuatro veces. La primera versión ponía rótulo + banda + número +
  // lápiz en una fila y envolvía: con `ALTA` entraba y con `A FUTURO` partía la banda en
  // dos renglones. La segunda lo apiló en dos líneas y eso tampoco: «se sigue poniendo en
  // doble línea».
  //
  // El error de las dos fue el mismo: tratar de que la suma de los anchos diera menor que
  // 200px. Esa cuenta depende del dato (una banda de dos palabras), de la fuente cuando
  // termina de cargar y del zoom, así que acierta hoy y falla mañana — es la misma trampa
  // que la medición del header, en chico.
  //
  // Acá la fila NO ENVUELVE (`nowrap`) y cada pieza declara si puede achicarse:
  //   · el RÓTULO es lo único elástico y se recorta con «…» — es lo que menos informa;
  //   · la banda, el número y el lápiz son `flex: 'none'`: no se parten ni se van nunca.
  // Con cualquier texto, en cualquier ancho, el resultado es una línea con el dato entero.
  const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--faint)' };
  const cabecera = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', minWidth: 0, width: '100%' }}>
      <span style={{ ...rotulo, flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Prioridad</span>
      {/* ⚠️ 12px, NO 15. «Está ENORME la tipografía de la prioridad» (23/09/2026), y ése
          era el diagnóstico de fondo de las cuatro veces que este bloque se reportó roto:
          venía de cuando era un titular con su slider debajo, y quedó de ese tamaño cuando
          pasó a ser un campo más de la columna. Un valor más grande que el título del panel
          no se lee como jerarquía: se lee como que algo se desbordó. Ahora está a la escala
          de DEADLINE y QUARTER, que es lo que es. */}
      {etiqueta && <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{etiqueta}</span>}
      <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center' }}>{chip}</span>
      {/* ⚠️ `preventDefault` + `stopPropagation` viven en el contenedor del summary: adentro
          de un `<summary>` CUALQUIER click pliega, así que sin eso tocar el lápiz abriría el
          pop-up Y cerraría el bloque en el mismo gesto. */}
      {puedeEditar && <LapizPrioridad tam={20} onClick={onEditar} titulo={`Cambiar la prioridad de «${titulo.slice(0, 40)}»`} />}
    </span>
  );
  const cuerpo = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9 }}>
      {razon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, fontStyle: 'italic' }}>“{razon}”</div>}
      {tiempo}
      {impacto != null && <IEMeter label="Impacto" v={impacto} color="#1E9E57" />}
      {esfuerzo != null && <IEMeter label="Esfuerzo" v={esfuerzo} color="#C8870C" />}
    </div>
  );
  if (!hayQueAbrir) {
    return (
      <div>
        {cabecera}
        {tiempo}
      </div>
    );
  }
  return (
    <div>
      <details className="mk-det mk-det--prio">
        <summary style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}
          onClick={(e) => { const t = e.target as HTMLElement; if (t.closest('button')) { e.preventDefault(); e.stopPropagation(); } }}>
          {cabecera}
        </summary>
        {cuerpo}
      </details>
    </div>
  );
}

/* ⛔ ACÁ VIVÍA `RazonPrio`, un `<details>` suelto con «Por qué este número». Se quedó sin
   call sites cuando la razón se mudó ADENTRO de `BloquePrioridad`, que ya la abre junto
   con el impacto y el esfuerzo: la razón no es un bloque aparte, es lo que explica el
   número que está al lado. */
// score del guardián (1-100), coloreado por la columna que define.
function ScoreBadge({ score }: { score: number }) {
  const c = PCOLOR[prioFromScore(score)];
  return <span title="Prioridad del guardián (1-100)" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c, background: c + '18', border: `1px solid ${c}33`, borderRadius: 5, padding: '1px 5px 1px 4px' }}><ScoreIcon size={10} color={c} />{score}</span>;
}
// Chip de FUENTE (feedback jul-19): DE DÓNDE salió la tarjeta — Fathom (reunión),
// WhatsApp, un archivo, Claude Code (con nombre + link del chat), o MaKo. Distinto de
// "quién": una tarjeta que sacó MaKo de una reunión de Fathom no es lo mismo que una
// que escribió un dev en el SEED. Si trae url, el chip es un link.
const FUENTE_META: Record<FuenteTipo, { label: string; icon: () => ReactNode; accent: boolean } | null> = {
  manual: null,
  mako: { label: 'MaKo', icon: () => <span style={{ color: 'var(--accent)' }}>✦</span>, accent: true },
  fathom: { label: 'Fathom', icon: () => <SvcIcon k="fathom" size={11} box={16} radius={4} />, accent: true },
  whatsapp: { label: 'WhatsApp', icon: () => <SvcIcon k="whatsapp" size={11} box={16} radius={4} />, accent: true },
  archivo: { label: 'Archivo', icon: () => <span>📄</span>, accent: false },
  'claude-code': { label: 'Claude Code', icon: () => <span style={{ fontFamily: MONO, fontWeight: 700 }}>‹╱›</span>, accent: false },
  retro: { label: 'Retro', icon: () => <span>🔎</span>, accent: true },
  experimento: { label: 'Experimento', icon: () => <span>🧪</span>, accent: true },
  // La instancia de una PLANTILLA recurrente (mig 0185). Su `url` va a la plantilla,
  // así que el chip es el link a «de dónde vuelve esto cada semana» — que es justo la
  // pregunta de quien ve la misma tarea por tercera vez y no sabe por qué.
  recurrente: { label: 'Se repite', icon: () => <span>⟳</span>, accent: false },
};
/** ⛔ Tuvo un `soloIcono` (el chip sin una sola palabra) durante unas horas del 25/09 y se
 *  fue con su único call site: «que origen esté más arriba… y que sí tenga texto, no solo
 *  ícono». Un ícono suelto al pie de una columna vacía no se lee como un dato, se lee como
 *  algo que sobró. Una prop sin call sites compila perfecto y no la usa nadie. */
function FuenteChip({ fuente }: { fuente: Fuente }) {
  const m = FUENTE_META[fuente.tipo];
  if (!m) return null; // manual (del usuario) → sin chip
  const clickable = !!fuente.url;
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700,
    color: m.accent ? 'var(--accent)' : 'var(--dim)', background: 'var(--surface)',
    border: `1px solid ${m.accent ? 'var(--primary-weak)' : 'var(--border-strong)'}`,
    borderRadius: 6, padding: '2px 7px', maxWidth: 250, minWidth: 0, textDecoration: 'none',
    cursor: clickable ? 'pointer' : 'default',
  };
  const cuerpo = <>
    <span style={{ flex: 'none', display: 'inline-flex', lineHeight: 0 }}>{m.icon()}</span>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}{fuente.etiqueta ? ` · ${fuente.etiqueta}` : ''}</span>
    {clickable && <span style={{ flex: 'none', opacity: 0.7 }}>↗</span>}
  </>;
  const title = `${m.label}${fuente.etiqueta ? ` · ${fuente.etiqueta}` : ''}${clickable ? ' — abrir' : ''}`;
  return clickable
    ? <a href={fuente.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={title} aria-label={title} style={style}>{cuerpo}</a>
    : <span title={title} style={style}>{cuerpo}</span>;
}

/**
 * EL HISTORIAL, PLEGADO — y el ORIGEN al lado, a la vista.
 *
 * Dos pedidos del 25/09/2026, y los dos son sobre lo mismo:
 *  · «El change history no se entiende que es un desplegable.» Era un `<summary>` en
 *    monoespaciada que decía «7 MOVIMIENTOS DE ESTA TARJETA» y ninguna pista de que se
 *    abría. Ahora es un BOTÓN con su chevron, que rota al abrir.
 *  · «Que el origen esté en el change history, tiene sentido que esté allí. Pero que se
 *    vea sin necesidad de desplegar.» El chip vive en el mismo renglón del botón, FUERA
 *    de lo que se pliega: de dónde salió la tarjeta se contesta sin abrir nada.
 *
 * ⚠️ NO ES UN `<details>`, y es a propósito: el chip de origen es a veces un LINK (la
 * grabación de Fathom), y adentro de un `<summary>` el click que abre el link dispara
 * igual el plegado del `<details>` — la activación es del summary, no del listener, así
 * que un `stopPropagation` no alcanza.
 *
 * ⚠️ Y TIENE QUE VERSE DISTINTO DEL PLEGADO DEL DETALLE, que era el reclamo de la tanda
 * anterior («está exactamente igual diseñado que los desplegables del detalle, parece lo
 * mismo»). Son dos cosas: el doc lo escribís vos, el historial es el registro de quién
 * movió qué. Por eso el detalle pliega con un chevron pelado en la canaleta del texto y
 * esto es una pastilla con borde, en monoespaciada y con el conteo adelante.
 *
 * Lo usan la tarea y el proyecto, sin una sola diferencia: «al igual que el formateo de
 * change history, aplica todo en ambos, que no haya discordancia» (25/09/2026).
 */
/** El chip de origen CON su rótulo. Va junto y no suelto porque el rótulo sin chip no dice
 *  nada y el chip sin rótulo es lo que se reportó: se dibujan o los dos o ninguno — una
 *  tarjeta cargada a mano no tiene origen que contar (`FuenteChip` devuelve `null`) y un
 *  «ORIGEN» solo, colgado al lado del botón, sería un rótulo sin valor. */
function FuenteRotulada({ fuente }: { fuente: Fuente }) {
  if (!FUENTE_META[fuente.tipo]) return null; // manual: no hay origen que contar
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{ ...rowLabel, marginBottom: 0, flex: 'none' }}>Origen</span>
      <FuenteChip fuente={fuente} />
    </span>
  );
}

function BloqueHistorial({ n, fuente, children }: { n: number; fuente: Fuente; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setAbierto((o) => !o)} aria-expanded={abierto}
          title={abierto ? 'Cerrar el historial' : 'Ver el historial completo'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--dim)' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
            style={{ flex: 'none', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .14s' }}>
            <path d="M3.4 1.4 L7 5 L3.4 8.6" />
          </svg>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
          {/* ⚠️ EN INGLÉS Y A PEDIDO: «en lugar de "Movimientos" mejor "Change History"»
              (26/09/2026). Es la EXCEPCIÓN a la regla de que la interfaz va en español
              neutro (AGENTS.md), y por eso queda escrita acá: no es un descuido de quien
              copió de un kit, es el nombre que el dueño le puso a esta cosa. */}
          Change History
        </button>
        {/* ⚠️ EL CHIP NO SE EXPLICA SOLO. «El origen no sólo el ícono con la palabra, sino
            que también que diga "Origen" en algún lado, para que se entienda» (25/09/2026):
            el chip dice «Fathom · Reunión con…» y nada decía que eso ES el origen — al lado
            de un botón que cuenta movimientos, se lee como un movimiento más. El rótulo usa
            el mismo `rowLabel` que los campos de la columna derecha (DEADLINE, QUARTER…):
            un rótulo de campo ya significa eso en esta pantalla, no hace falta uno nuevo. */}
        <FuenteRotulada fuente={fuente} />
      </div>
      {abierto && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

/**
 * Un botón de ícono de los que CIERRAN una tarjeta: completar y eliminar.
 *
 * «Eliminar y marcar como completada en la sidebar derecha, eso es obvio…» (25/09/2026).
 * Estuvieron en el header del modal, después al pie de la columna principal, y viven acá:
 * al pie de la columna derecha, juntos, en la tarea Y en el proyecto.
 *
 * ⚠️ `aria-label` Y `title`, siempre: un botón cuyo único contenido es un SVG se anuncia
 * como «botón», sin decir de qué.
 */
function AccionIcono({ label, onClick, tono, children }: { label: string; onClick: () => void; tono?: 'ok' | 'mal'; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, borderRadius: 9, cursor: 'pointer', flex: 'none', border: `1px solid ${tono === 'ok' ? 'var(--good)' : 'var(--border-strong)'}`, background: tono === 'ok' ? 'var(--good-bg, var(--surface))' : 'var(--surface)', color: tono === 'mal' ? 'var(--bad)' : 'var(--dim)' }}>
      {children}
    </button>
  );
}

/** El pie de la columna derecha donde viven esos botones. `marginTop: auto` los empuja
 *  abajo cuando la columna sobra, y los deja al final del contenido cuando no. */
const pieAcciones: CSSProperties = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)' };

/** El único que NO es un ícono en ese pie: `marginRight: auto` lo manda a la izquierda y
 *  deja a las dos acciones que cierran la tarjeta juntas contra el borde, donde estaban. */
const btnProfundizar: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, marginRight: 'auto',
  border: 'none', background: 'transparent', color: 'var(--faint)',
  fontFamily: MONO, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', lineHeight: 1.6,
};

/** El rótulo de un campo de la columna derecha (DEADLINE, QUARTER, COLOR, PROYECTOS…).
 *  Estaba escrito DOS VECES, una adentro de cada modal y con el mismo literal carácter por
 *  carácter: «al igual que el formateo de change history, aplica todo en ambos, que no haya
 *  discordancia» (25/09/2026) también vale para lo que no se ve hasta que uno de los dos
 *  cambia. Uno solo, y los dos detalles lo importan. */
/**
 * EL CAMPO «CLIENTE», UNO SOLO PARA LAS DOS COLUMNAS (mig 0172).
 *
 * ⚠️ ES UN COMPONENTE Y NO DOS BLOQUES COPIADOS, Y ESO ES LA DECISIÓN. La columna derecha
 * del detalle está escrita DOS VECES en este archivo —`TaskModal` y `ProjectDetailModal`—
 * con el mismo objeto de estilo duplicado, así que «agregá un campo igual a los demás» son
 * dos ediciones y dos oportunidades de que queden distintos. El Quarter ya vive así y se
 * nota: el aviso de «la fecha cae en otro trimestre» está escrito dos veces, palabra por
 * palabra. Acá se corta.
 *
 * ⚠️ EL LÁPIZ VA PEGADO AL RÓTULO, como en PROYECTOS. Probado en los dos lugares
 * equivocados el 23/09/2026: colgado con un `flex:1` en el medio queda flotando contra el
 * borde, y metido en la fila del chip se cae a un renglón propio porque el chip ocupa el
 * ancho entero de la columna.
 */
function CampoCliente({ cliente, onAbrir }: {
  cliente: { leadId: number; nombre: string } | null;
  onAbrir: () => void;
}) {
  return (
    <div>
      <label style={{ ...rowLabel, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {ROTULO_CLIENTE}
        <LapizPrioridad tam={20} onClick={onAbrir} titulo={cliente ? 'Cambiar el cliente' : 'Asignar un cliente'} />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
        {cliente
          ? <ClienteChip nombre={cliente.nombre} onClick={onAbrir} />
          /* «Interno» y no «Sin cliente»: que un trabajo no sea de nadie es una respuesta
             válida y es la que tiene la mayoría del tablero. Un «sin…» se lee como que
             falta algo, y pone un hueco donde no hay ninguno. */
          : <span style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>{SIN_CLIENTE}</span>}
      </div>
    </div>
  );
}


/**
 * ⛔ ACÁ VIVÍA `CSS_DETALLE`, y se fue el 28/09/2026 con la cabecera.
 *
 * Eran siete clases —`.pd-acciones`, `.pd-pill`, `.pd-cerrar`, `.pd-icono`,
 * `.pd-marca` y su hover— que dibujaban la portada del detalle de un proyecto, y
 * estaban escritas OTRA VEZ en la ficha de un cliente con el prefijo `fc-`. Las
 * pastillas eran byte a byte la misma regla. Ahora las pone `CabeceraDetalle`, que
 * es la pieza que montan las tres pantallas.
 *
 * ⚠️ Y `.pd-marca-inline` se fue con ellas SIN reemplazo, porque no lo necesitaba:
 * tenía CERO call sites. Era el molde del ícono cuando NO había portada, y desde
 * que la portada va siempre (el `null` es el degradado derivado del nombre, no
 * «sin portada») ese caso dejó de existir. El comentario que la justificaba
 * describía un camino que ya no se podía tomar.
 */

const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };

/**
 * El título de una tarjeta, editable — SIN NINGUNA CAJA.
 *
 * «No tiene que aparecer ningún recuadro de texto, tal cual como la descripción, que no
 * parezca un input que esté flotando el título» (25/09/2026). Lo de la tanda anterior
 * —borde gris al pasar el mouse, fondo `--surface-2` al enfocar, `borderRadius: 9`— era
 * exactamente eso: un input dibujado alrededor del título, mientras el doc de abajo, que
 * se edita igual, era texto pelado. Ahora el título ES texto: sin borde, sin fondo, sin
 * radio, sin padding propio.
 *
 * ⚠️ PERO EL FOCO TIENE QUE SEGUIR VIÉNDOSE — un control sin ninguna señal de foco es
 * inaccesible por teclado. Lo que se saca es la CAJA, no la señal, y la que queda no es
 * inventada: es `FOCO_BARRA`, LA MISMA que usa el doc (`RichText`, regla `.mako-rt:focus`).
 * Dos campos que se editan igual no pueden señalar el foco de dos maneras.
 *
 * ⛔ Y NO QUEDA NADA EN EL HOVER. La tanda anterior le había puesto un borde gris al pasar
 * el mouse, con su porqué escrito («se había reportado como "no se puede cambiar el nombre
 * de una tarea"»); ese borde es un recuadro y el pedido nuevo lo saca. Lo que queda diciendo
 * que se edita es el `cursor: text`, el `title` y el placeholder — lo mismo que tiene el doc.
 */
/*
 * ⚠️ LA TAREA LO MONTA EN UN `<textarea rows={2}>` Y EL PROYECTO EN UN `<input>`, y es la
 * ÚNICA diferencia que queda entre los dos títulos: misma tipografía, mismo tamaño, mismo
 * foco, mismo hover, mismo aire debajo. Está escrita acá para que no se lea como un
 * descuido. El título de una tarea es una frase entera («Sacar el plan viejo de modelo.ts
 * y escribir el escalón nuevo en la landing») y a 22px casi ninguno entra en un renglón,
 * así que un `input` lo scrollearía de costado —que es lo que esta tanda vino a sacar—;
 * el nombre de un proyecto es una etiqueta corta («Feature: CRM»), y darle dos renglones
 * es regalar un renglón vacío arriba de todo en el modal que más scroll tiene.
 * `resize: 'none'` es por el `<textarea>`: en el `input` no significa nada.
 */
const tituloEditable: CSSProperties = { width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', boxShadow: 'none', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: SANS, letterSpacing: '-0.01em', cursor: 'text', padding: 0, paddingLeft: 10, marginLeft: -10, marginBottom: 6, transition: 'box-shadow .12s' };
const tituloFoco = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.boxShadow = FOCO_BARRA; };
const tituloBlur = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.boxShadow = 'none'; };

// El alta se muestra con una frase que nombra al autor ("Creada por MaKo") en vez
// del texto crudo. Pero cuando MaKo además dejó asentado QUÉ hizo (todo lo que va
// después del " — "), ese porqué tiene que sobrevivir: si no, una tanda entera de
// tarjetas creadas por la IA queda sin rastro de dónde salió.
function partirCreacion(text: string, prefijo: string): { esCreacion: boolean; porque: string } {
  if (!text.startsWith(prefijo)) return { esCreacion: false, porque: '' };
  return { esCreacion: true, porque: text.slice(prefijo.length).replace(/^\s*—\s*/, '').trim() };
}

// Quién figura como autor de una entrada del historial.
const autorDe = (actor: Actor, nombre: string) => ACTOR_LABEL[actor] || nombre || 'Usuario';
// La frase del alta. 'code' se nombra distinto A PROPÓSITO: que una tarjeta la haya
// escrito un dev en el SEED no es lo mismo que la haya sacado MaKo de tus datos.
const frasePorAlta = (actor: Actor, nombre: string, genero: 'a' | 'o') =>
  actor === 'ia' ? `Cread${genero} por MaKo`
    : actor === 'code' ? `Cread desde el código`
      : `Cread${genero} por ${nombre || 'ti'}`;

// Avatar para el change history: MaKo → ✦; Claude Code → ‹╱›; usuario → foto o inicial.
function ActorAvatar({ actor, nombre, avatarUrl, size = 24 }: { actor: Actor; nombre: string; avatarUrl: string; size?: number }) {
  if (actor === 'ia') return <span title="MaKo" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)' + '1f', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, flex: 'none' }}>✦</span>;
  if (actor === 'code') return <span title="Claude Code" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontFamily: MONO, fontWeight: 700, flex: 'none' }}>╱</span>;
  if (avatarUrl) /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />;
  const ini = (nombre || 'U').trim().slice(0, 1).toUpperCase();
  return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700, flex: 'none' }}>{ini}</span>;
}

// ── tarjeta (cuadrada, estilo CRM; la columna la decide el guardián, no se arrastra) ─
// El emoji de una tarea = el de su proyecto principal (feedback jul-18): más simple
// y coherente que un emoji propio por tarea. Sin proyecto → 📌.
const emojiTarea = (board: Board, t: BoardTask): string => board.labelById(t.labels[0])?.emoji || t.emoji || '📌';


// Tarjeta de tarea: ALTURA FIJA para que todas midan igual (feedback jul-18). El
// título se recorta a 2 líneas; el toggle de completar es compacto (inline), no una
// píldora que agrandaba unas cards más que otras.
function CardTile({ t, board, warn, frenanA = [], onOpen, onWarn, onOpenProj, onEliminar, tactil, onAgarrar, oculta = false, elegida = false, haySeleccion = false, onElegir, sinRanking = false }: {
  t: BoardTask; board: Board; warn: boolean; frenanA?: string[]; onOpen: (id: string) => void; onWarn: (id: string) => void; onOpenProj?: (id: string) => void;
  /** ⚠️ EN LA VISTA «RECURRENTES» NO SE PINTAN NI EL PUNTAJE NI EL CHIP «Se repite», y no es
   *  cosmética: ahí TODAS se repiten, así que el chip es ruido en el 100% de las tarjetas, y
   *  el número es un ranking que la mig 0163 sacó — dejarlo a la vista invita a compararlo
   *  entre tarjetas que justamente no compiten. La TABLA de esa misma vista ya apagaba las
   *  dos con `sinRanking`; la tarjeta las seguía pintando, o sea que el mismo dato se mostraba
   *  o no según el interruptor del header. Mismo nombre que en `Tablas.tsx`. */
  sinRanking?: boolean;
  /** abre la pregunta de borrar. Opcional: donde no se pasa, la tarjeta no dibuja el tacho. */
  onEliminar?: (id: string) => void;
  /** el arrastre con el dedo (sólo en el Kanban; en el resto de las vistas no existe) */
  tactil?: ArrastreTactil;
  /** avisa al Kanban qué tarjeta está en la mano, y con qué nodo y offset dibujar la copia */
  onAgarrar?: (id: string | null, desde?: { nodo: HTMLElement; dx: number; dy: number }) => void;
  /** se está arrastrando: la tarjeta se desvanece y el que ocupa su lugar es el HUECO */
  oculta?: boolean;
  /** está seleccionada para una acción en lote */
  elegida?: boolean;
  /** ya hay algo seleccionado: la casilla se queda a la vista en todas */
  haySeleccion?: boolean;
  onElegir?: (id: string) => void;
}) {
  const done = t.progress >= 100;
  const levantada = tactil?.arrastrando === t.id;
  // ⚠️ EL ARRASTRE CON MOUSE NO TENÍA NINGÚN FEEDBACK. `levantada` es del camino TÁCTIL
  // (pointer events); el de mouse es HTML5 drag-and-drop, que no avisa nada por su cuenta:
  // la tarjeta se quedaba quieta mientras el cursor se llevaba una miniatura fantasma del
  // navegador. «Al intentar agarrar una tarea del kanban, debería tener la misma animación
  // que tenemos hoy en día en el CRM» (23/09/2026) — y son los mismos tres valores que usa
  // `CrmBoard.tsx`: se atenúa, se achica un poco y se despega con una sombra.
  const [hover, setHover] = useState(false);
  // ⚠️ `oculta` YA NO PINTA NADA en la tarjeta (ver el `style`): el Kanban lo sigue
  // pasando porque lo necesita para saber cuál excluir al calcular el hueco, pero acá
  // adentro lo único que cambia de aspecto durante un arrastre con mouse es NADA.
  void oculta;
  // A qué proyecto pertenece. El kanban agrupa por PRIORIDAD, así que sin esto una
  // columna es una lista de tareas sueltas y hay que abrir cada una para saber de qué
  // parte del plan es. Va en el lugar del emoji —que ya era el del proyecto, solo que
  // mudo— para no gastar una fila: la card mide 138px fijos y el título necesita sus
  // dos líneas. Mismo chip que el detalle (color del proyecto), no un estilo nuevo.
  const proys = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  return (
    <div
      // ⚠️ El click se traga si el gesto anterior fue un arrastre: el navegador sintetiza un
      // `click` sobre donde empezó el toque, y sin esto se soltaba la tarjeta, salía el
      // pop-up de la prioridad y DETRÁS se abría el detalle.
      onClick={() => { if (!tactil?.huboArrastre()) onOpen(t.id); }}
      onPointerDown={(e) => tactil?.alTocar(e, t.id)}
      // ⚠️ LA PROP **ES** LA CAPACIDAD, Y AHORA LO ES DEL TODO. Sin `onAgarrar`, la tarjeta
      // era `draggable` en todos lados donde se reusa —«lo que cargó MaKo», lo que salió de
      // una reunión— y el gesto no hacía absolutamente nada: `onAgarrar?.()` se come la
      // llamada y `fotoVaciaDeArrastre` deja al cursor sin nada detrás. Un arrastre que
      // empieza y no muestra ni mueve nada es exactamente el reporte de «no agarra la
      // tarjeta» que este Kanban ya pagó siete veces.
      //
      // ⚠️ Y EL `prioridadManual` QUE ESTABA ACÁ SE MUDÓ AL CALL SITE DEL KANBAN, que es
      // donde se sabe QUÉ escribe el arrastre. Cableado adentro, esta tarjeta decidía por
      // todos sus usos que arrastrarla siempre significa cambiar la prioridad — y desde la
      // vista Recurrentes significa otra cosa (el RITMO, mig 0165), que es una escritura que
      // los dos tableros sí tienen. Un componente compartido que decide solo qué se puede
      // escribir es cómo el slider de prioridad salió a producción contestándole «solo
      // admin» a todos los clientes; el que sabe es el que monta.
      draggable={!!onAgarrar}
      data-card
      // ⚠️ LA COPIA QUE VIAJA CON EL CURSOR NO LA DIBUJA EL NAVEGADOR: LA DIBUJAMOS NOSOTROS.
      //
      // Siete rondas de reportes sobre lo mismo, y el que lo cerró fue el dueño: «me doy
      // cuenta que en el CRM pasa lo mismo… es un problema de diseño». Tenía razón. La
      // imagen del arrastre la pinta el SISTEMA OPERATIVO —en Windows, translúcida— y no la
      // gobierna ninguna regla CSS. Se puede reemplazar con `setDragImage`, pero eso sigue
      // dejando el dibujo del lado del SO: cambia QUÉ se fotografía, no CÓMO se pinta.
      //
      // Así que acá se le pasa una imagen VACÍA (1×1 transparente) y la copia real es un
      // nodo nuestro que sigue al cursor — opaco, nítido, con la sombra que queremos. Lo
      // monta y lo mueve el Kanban (`agarrar`), en DOM puro y sin estado de React: moverlo
      // con `setState` sería un re-render del tablero por píxel, que es el otro bug que ya
      // costó tres rondas.
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        fotoVaciaDeArrastre(e.dataTransfer);
        const r = e.currentTarget.getBoundingClientRect();
        onAgarrar?.(t.id, { nodo: e.currentTarget, dx: e.clientX - r.left, dy: e.clientY - r.top });
      }}
      onDragEnd={() => { onAgarrar?.(null); }}
      // ⚠️ MIENTRAS SE ARRASTRA, ESTA TARJETA NO CAMBIA NADA. Preguntado y contestado el
      // 24/09/2026: de lo que hace el CRM, lo que había que replicar era exactamente eso —
      // «que la tarjeta no cambie nada». Cada efecto que se le fue agregando acá era ruido
      // que allá no existe: primero `opacity: .5` («se ve transparente»), después borde de
      // color + `scale(1.02)` + sombra («no se visualiza correctamente la animación»).
      //
      // Lo que se mueve es la COPIA; lo que dice a dónde va es el HUECO; y la columna
      // destino se tiñe. La tarjeta de origen se queda como está: es el lugar del que salió,
      // no un estado que haya que comunicar tres veces.
      //
      // ⛔ Y NO SE COLAPSA A ALTURA CERO, que era la salida obvia (es lo que hacen Trello y
      // Linear). Medido: sacar del flujo el nodo ORIGEN del arrastre deja el gesto sin
      // salida — el arnés no pudo completar un solo drop y se colgó hasta el timeout,
      // mientras la misma página cargaba perfecto.
      style={{ background: elegida ? 'var(--primary-bg)' : 'var(--surface-2)', border: `1px solid ${elegida ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 11, padding: '12px 14px', cursor: onAgarrar ? 'grab' : 'pointer', opacity: done ? 0.62 : 1, height: 138, display: 'flex', flexDirection: 'column', transition: 'border-color .12s, background .12s',
        // `manipulation` saca el retardo del doble-tap sin tocar el scroll. `none` NO va:
        // es CSS, decide antes de que exista el listener y apagaría el scroll de la página
        // sobre cada tarjeta.
        touchAction: 'manipulation',
        // Con el dedo la tarjeta se LEVANTA (crece): el dedo la tapa y hay que verla salir.
        // Con el mouse se HUNDE (se achica y se atenúa), igual que en el CRM: lo que se
        // mueve es la miniatura que dibuja el navegador, y la tarjeta de abajo es el hueco
        // que dejó.
        // Con el DEDO sí se levanta: el dedo tapa la tarjeta y hay que verla salir. Con el
        // mouse no, porque ahí lo que se ve viajar es la copia.
        ...(levantada ? { transform: 'scale(1.03)', boxShadow: '0 10px 24px rgba(18,21,27,.22)' } : {}) }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; setHover(true); }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; setHover(false); }}>
      {/* header: [casilla] + proyecto + #id + [aviso] + prioridad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, minWidth: 0 }}>
        {onElegir && (hover || haySeleccion) && (
          <input type="checkbox" checked={elegida} onClick={(e) => e.stopPropagation()} onChange={() => onElegir(t.id)}
            title="Seleccionar" aria-label={`Seleccionar «${t.title}»`}
            style={{ width: 14, height: 14, flex: 'none', cursor: 'pointer', accentColor: 'var(--primary)', margin: 0 }} />
        )}
        {proys.length > 0
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
              {/* Con más de un proyecto entra también el "+N": el chip cede ancho para
                  que #id, el aviso y el score no queden sin lugar en una card de 249px. */}
              {/* «El chip del proyecto más largo, para que se vea todo el proyecto»
                  (25/09/2026). Sube de 130 a 200 con los ~45px que dejaron el `#id` (se
                  fue el 25/09) y el chip de tiempo (se fue hoy). El tope sigue existiendo
                  porque el nombre más largo del tablero no entra en ningún ancho, y con
                  dos proyectos hay que dejarle lugar al «+N». */}
              <LabelChips chips={proys} max={1} cap={proys.length > 1 ? 150 : 200} onOpen={onOpenProj} />
            </span>
          : <span style={{ fontSize: 17, lineHeight: 1, flex: 'none' }}>{emojiTarea(board, t)}</span>}
        {/* ⛔ ACÁ IBA `#{t.num}` Y SE FUE EL 25/09/2026. «El ID de la tarea es algo que no es
            relevante en esta vista de tarjetas, ocupa más espacio que otra cosa» — y el
            motivo real lo dijo un renglón antes: «el ID está justo en el medio y no permite
            que se vea el nombre del proyecto completo». Los ~35px que ocupaba (el número más
            su gap) se los queda el chip, que por eso sube de 96 a 130.
            EL CHIP DEL PROYECTO SE QUEDA: Mauricio tiene proyectos que son clientes y
            necesita verlos sin abrir la tarjeta. El número sigue en el detalle, que es donde
            se usa para nombrar una tarjeta. */}
        <span style={{ flex: 1, minWidth: 0 }} />
        {/* El candado va COMPACTO en la tarjeta: la card mide 138px fijos y el título
            necesita sus dos líneas. El nombre de lo que la frena vive en el tooltip y en
            el detalle, que es donde hay lugar para decirlo entero. */}
        <BloqueoChip porQue={frenanA} compacto />
        {/* ⚠️ «Se repite», SÓLO EL ÍCONO. Una recurrente normalmente no está en el Kanban
            —salen de la vista Tareas— pero SÍ aparece cuando la buscás, y también en los
            modales que reusan esta tarjeta (lo que cargó MaKo, lo que salió de una
            reunión). Sin el chip, una tarjeta sin fecha en una columna de prioridad se lee
            como una tarea a la que se le perdieron los datos. Compacto por el mismo motivo
            que el candado de al lado: la card mide 138px de alto fijos y 249 de ancho, y el
            rótulo entero le come el nombre del proyecto. El texto no se pierde: va en el
            `title` y en el `aria-label`. */}
        {esRecurrente(t) && !sinRanking && <RepiteChip soloIcono />}
        {/* ⛔ ACÁ IBA `<TiempoChip>` (◷ subió / 💤 bajó de prioridad) Y SE FUE EL
            25/09/2026: «quita los íconos de subió de prioridad o bajó». En una tarjeta de
            249px cada ícono le come ancho al nombre del proyecto, y el porqué del
            movimiento sigue entero en el detalle (`TiempoLinea`), que es donde se
            discute un número. La ALARMA (`WarnMark`) se queda: esa pide una acción. */}
        {warn && <WarnMark title="Falta el deadline" onClick={(e) => { e.stopPropagation(); onWarn(t.id); }} />}
        {!sinRanking && <ScoreBadge score={t.score} />}
      </div>
      {/* TÍTULO DE DOS LÍNEAS, con el entero en el `title`. Primero fue una sola —«los
          títulos son muy largos, tiene que poner una cantidad máxima de caracteres»— y con
          eso se cortaban demasiadas: «como hay algunas que están cortadas, permite el salto
          de línea 1 vez» (25/09/2026). Dos es el número: con una se pierde la mitad de los
          títulos del tablero, con tres la card deja de medir lo mismo que sus vecinas.
          El tope no se escribe en CARACTERES sino en líneas: un `slice(0, 60)` corta igual
          de feo con palabras cortas, se queda corto con palabras largas, y además miente en
          el `title`. Con el clamp, el corte lo decide el ancho real de la card. */}
      <div title={t.title} style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{t.title}</div>
      {/* ⚠️ EL DEADLINE VA EN SU PROPIO RENGLÓN, y dice el plazo. Acá había un
          `deadline.slice(5)` — «09-25»: sin día de la semana, sin año y, sobre todo, sin
          decir si ya se venció. «Me gusta este formato, que también dice los días
          faltantes y atrasados» (24/09/2026), señalando la tarjeta del PROYECTO, que ya lo
          hacía bien. Es la misma pieza para las dos, así que no pueden volver a divergir.
          Y va en un renglón propio porque al lado del botón de completar no entra: en una
          tarjeta de 281px, «◷ vie 24 jul · 62 días atrasado» + «Completar» se pisan. */}
      {/* ⛔ ACÁ ESTUVO EL DEADLINE, PEGADO AL TÍTULO, unas horas del 25/09 —«el deadline y
          los días faltantes más pegado al título»— y el MISMO día bajó al pie: «en la preview
          de la tarea, que el deadline con los días faltantes, mejor que esté al final de
          todo, abajo, no pegado al título». Gana el pedido nuevo. Vive en el pie, acá abajo. */}
      <span style={{ flex: 1 }} />
      {/* footer fijo: el CHECK a la derecha. Sin el % y sin la barra: «una tarea se
          completa o no se completa», y el check está siempre a la vista porque el estado
          tenía que verse sin entrar al detalle («no me dice si está terminado o no»). */}
      {/* SOLO ÍCONOS: «que no diga la palabra "Completar", solo el ícono del check y también
          el ícono de basura, para eliminar» (25/09/2026). El nombre accesible NO se pierde
          —va en `aria-label` y en `title`— porque un botón cuyo único contenido es un SVG se
          anuncia como «botón», a secas. El tacho abre la MISMA pregunta de dos botones que
          el detalle: borrar no se hace de un click en una tarjeta que se arrastra. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 22 }}>
        {/* EL DEADLINE, AL PIE Y A LA IZQUIERDA (25/09/2026, ver arriba). Entra al lado de
            los dos botones PORQUE son íconos desde hoy: con la palabra «Completar» no
            entraba —«◷ vie 24 jul · 62 días atrasado» son ~150 px sobre una tarjeta de 281—
            y eso es lo que en su momento lo mandó a un renglón propio. Con 26+26 de botones
            quedan ~200 para la fecha, así que ya no se pisan.
            ⚠️ `flex: '0 1 auto'` + `minWidth: 0`: si un plazo largo no entrara, el que CEDE
            es la fecha y nunca los botones — un botón encogido deja de ser clickeable. */}
        {/* ⚠️ SI SE REPITE, ACÁ VA EL RITMO Y NO LA FECHA (mig 0165). Es el mismo renglón
            porque es la misma pregunta —«¿cuándo?»— con dos respuestas que nunca conviven:
            una recurrente no puede tener deadline. Y hace falta acá, no sólo en el detalle:
            «la junta de los miércoles» y «el seguimiento diario» se veían IDÉNTICAS en la
            vista Recurrentes y una pesa cuatro veces más que la otra.
            ⚠️ Y VA EN `CardTile`, o sea en TODOS lados donde se reusa esta tarjeta —la
            búsqueda, «lo que cargó MaKo», lo que salió de una reunión—, no sólo adentro de
            su vista. Una recurrente mezclada con tareas rankeadas ya mostraba el hueco de la
            fecha; ahora muestra el dato que ese hueco escondía. */}
        {esRecurrente(t)
          ? <LineaRepeticion de={t} tam={10} style={{ flex: '0 1 auto', minWidth: 0 }} />
          : t.deadline
            ? <LineaDeadline iso={t.deadline} hoy={hoyISO()} hecho={t.progress >= 100} tam={10} color="var(--dim)" style={{ flex: '0 1 auto', minWidth: 0 }} />
            : <span style={{ flex: 'none' }} />}
        <span style={{ flex: 1 }} />
        <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }}
          aria-label={done ? `Reabrir «${t.title}»` : `Marcar «${t.title}» como completada`}
          title={done ? 'Marcar sin completar' : 'Marcar completada'}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: done ? 'var(--good)' : 'var(--faint)' }}>
          <CheckHecho done={done} size={16} />
        </button>
        {onEliminar && (
          <button onClick={(e) => { e.stopPropagation(); onEliminar(t.id); }}
            aria-label={`Eliminar «${t.title}»`} title="Eliminar"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--faint)' }}>
            <IconoTacho size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * El bloque de un proyecto sin tareas abiertas.
 *
 * La corrección del dueño fue de categoría: *«Un proyecto vacío NO debe tener una
 * puntuación de 1. Todo lo contrario. Si se creó un proyecto es por algo… lo que se debe
 * hacer es cargarle tareas»*. La primera versión los hundía, o sea trataba «no sé» como «no
 * importa». Acá no se dice cuánto valen: se ofrece la única acción que los saca del limbo.
 *
 * ⚠️ No escribe ninguna tarea: deja un BORRADOR y devuelve el link para revisarlo, con el
 * mismo form de preguntas que el resto del tablero. Un canal PROPONE, una persona confirma
 * — y acá pesa doble, porque lo propuesto sale de una intuición sobre un nombre de proyecto.
 */
function ProyectoVacioBloque({ proj }: { proj: Label }) {
  const [estado, setEstado] = useState<'quieto' | 'pensando' | 'listo' | 'error'>('quieto');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const pedir = async () => {
    setEstado('pensando'); setMsg('');
    const j = await apiPlan({ action: 'proponer-tareas-proyecto', id: proj.id }) as { ok: boolean; error?: string; propuestaId?: string; n?: number };
    if (!j.ok || !j.propuestaId) { setEstado('error'); setMsg(j.error || 'No se pudo.'); return; }
    setLink(`/plan/revisar/${j.propuestaId}`);
    setMsg(`${j.n} ${j.n === 1 ? 'tarea propuesta' : 'tareas propuestas'} para revisar.`);
    setEstado('listo');
  };
  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, padding: 14, background: 'var(--surface-2)', marginBottom: 4 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Este proyecto no tiene ninguna tarea abierta.</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 10 }}>
        No es que valga poco: le falta el trabajo. MaKo puede intuir qué tareas tendría y dejártelas en un borrador para que las corrijas antes de que entren al plan.
      </div>
      {estado === 'listo' ? (
        <div style={{ fontSize: 13, color: 'var(--ink)' }}>
          ✓ {msg} <Link href={link} style={{ color: 'var(--primary)', fontWeight: 700 }}>Abrir la revisión →</Link>
        </div>
      ) : (
        <>
          <button onClick={() => void pedir()} disabled={estado === 'pensando'}
            style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 9, padding: '8px 14px', cursor: estado === 'pensando' ? 'wait' : 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 700 }}>
            {estado === 'pensando' ? 'MaKo está pensando…' : `Que MaKo proponga tareas para «${proj.name.slice(0, 28)}»`}
          </button>
          {estado === 'error' && <div style={{ fontSize: 12.5, color: 'var(--bad, #C0392B)', marginTop: 8 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}

/**
 * EN QUÉ ESCALÓN DE LA ESCALERA DEL DINERO cae este proyecto (mig 0142).
 *
 * Es lo que contesta la pregunta del dueño —«¿en qué me acerca eso a lo que configuramos en
 * el perro?»— sin tener que leer la razón entera: 1 cobrar · 2 traer una conversación nueva ·
 * 3 no perder a un cliente que ya está adentro · 4 convertir mejor · 5 construir capacidad.
 *
 * Hasta que existió esta columna, el escalón se decidía en cada corrida, se escribía adentro
 * de una frase y ahí moría. Ahora se ve, y por eso se puede discutir.
 */
// ⛔ ACÁ VIVÍA `EscalonChip`, el chip «💰 5 · CONSTRUIR» de la escalera del dinero, y se
// fue el 23/09/2026: «no entiendo ese pin de "construir" en el proyecto, si no sirve,
// sácalo». Y no servía — no porque el concepto esté mal, sino porque el chip solo no lo
// transmite: para entender que un proyecto es «escalón 5» hay que conocer la escalera, y la
// única explicación estaba en un `title` que aparece al pasar el mouse. Un dato que necesita
// un glosario para significar algo, en una columna de 236px, es ruido con forma de dato.
//
// El `escalon` y el `desbloquea` SIGUEN en la base y los sigue usando el Perro para
// priorizar: lo que se sacó es el chip.

/**
 * EL FACTOR TIEMPO, en el detalle (#158).
 *
 * Dos renglones y son dos cosas distintas:
 *  · la EDAD y la QUIETUD, que se dicen SIEMPRE. Cuándo nació y hace cuánto que nadie
 *    la toca es contexto de la tarjeta, no una consecuencia: una tarea de hace tres
 *    meses que nadie movió se lee distinto que una de ayer, tenga o no el score tocado.
 *  · el AJUSTE del ranking, que sale sólo cuando el tiempo MOVIÓ el número, porque eso
 *    sí es algo que pasó y que hay que poder discutir.
 *
 * ⚠️ VA EN EL DETALLE Y NO EN LA TARJETA DEL KANBAN, y esa parte es una decisión del
 * dueño, no una omisión. El 25/09/2026 sacó de la tarjeta el chip de tiempo con todas
 * las letras —«quita los íconos de subió de prioridad o bajó»— y el motivo está medido
 * en el comentario que quedó en su lugar: la card mide 249px y cada ícono le come ancho
 * al nombre del proyecto, que es lo que ÉL reclamó dos veces. Devolverlo ahí es
 * reinstalar lo que se sacó.
 *
 * Los días salen de `diasQuieta`, la MISMA función pura que usa el reparto del servidor
 * para castigarla: un chip que dice una cosa y un ranking que hace otra es el bug que
 * este tablero ya pagó dos veces.
 */
function TiempoLinea({ t }: { t: BoardTask }) {
  const ahora = Date.now();
  const quieta = diasQuieta(t.historial, t.creadaEn, ahora);
  const aj = ajusteTemporal({ quieta, alDeadline: diasAlDeadline(t.deadline || undefined, ahora) });
  const sube = aj.delta > 0;
  // Una recurrente no se «traba»: no se completa, se repite. Decirle que lleva 40 días
  // parada es acusarla de algo que no puede dejar de pasar.
  const repite = esRecurrente(t);
  const nacio = Number.isFinite(t.creadaEn) ? new Date(t.creadaEn as number) : null;
  const edad = nacio ? Math.floor((ahora - nacio.getTime()) / 86400000) : null;
  return (
    <>
      {edad != null && (
        <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginBottom: aj.delta === 0 ? 8 : 4 }}>
          Nació hace {edad === 0 ? 'hoy' : `${edad} ${edad === 1 ? 'día' : 'días'}`}
          {!repite && quieta >= 1 && ` · ${quieta} ${quieta === 1 ? 'día' : 'días'} sin que nadie la mueva`}
        </div>
      )}
      {aj.delta !== 0 && (
        <div style={{ fontSize: 11.5, color: sube ? 'var(--warn, #B4762A)' : 'var(--dim)', lineHeight: 1.4, marginBottom: 8 }}>
          {/* Antes decía «debatila y el Perro la vuelve a fijar», y esa era la única salida.
              Desde que el número se mueve acá arriba, mandar a debatir es mandar por el camino
              largo: el debate queda para cuando querés que te discutan el número. */}
          {sube ? '◷' : '💤'} {sube ? 'Subió' : 'Bajó'} de prioridad porque {aj.razon}. Si no corresponde, cámbiala arriba.
        </div>
      )}
    </>
  );
}

/**
 * Por qué el tiempo movió esta tarjeta. Sale de las MISMAS funciones puras que usa el
 * reparto del servidor (`envejecer.ts`), no de una copia: un chip que dice una cosa y un
 * ranking que hace otra es el bug que este tablero ya pagó dos veces.
 *
 * Existe porque un score que se mueve solo y no dice por qué es exactamente lo que el
 * dueño reportó del tablero entero. Si baja, tiene que poder discutirlo.
 */
// ⛔ `TiempoChip` se borró el 25/09/2026 junto con su único uso. La versión larga que
//    SÍ se usa —`TiempoLinea`, acá abajo— dice lo mismo con la frase entera en el
//    detalle. Un componente sin call sites compila perfecto y no lo dibuja nadie.

/**
 * El candado. UNA pieza, usada en la tarjeta del Kanban, en la fila de Prioridades y en el
 * detalle — porque el chip y el ranking tienen que decir lo mismo, y cinco copias de un
 * chip son cinco lugares donde eso deja de pasar.
 *
 * El `title` NOMBRA lo que frena. Un candado que solo dice «bloqueada» obliga a abrir la
 * tarjeta para saber qué esperar, que es justo lo que el candado venía a evitar.
 */
function BloqueoChip({ porQue, compacto = false }: { porQue: string[]; compacto?: boolean }) {
  if (!porQue.length) return null;
  const t = porQue.length === 1 ? `Espera a «${porQue[0]}»` : `Espera a ${porQue.length} cosas: ${porQue.join(' · ')}`;
  return (
    <span title={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'var(--warn, #B4762A)', background: 'color-mix(in srgb, var(--warn, #B4762A) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warn, #B4762A) 30%, transparent)', borderRadius: 5, padding: '1px 5px', maxWidth: compacto ? 22 : 150, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      🔒{compacto ? '' : ` ${porQue.length > 1 ? `${porQue.length} pendientes` : porQue[0]}`}
    </span>
  );
}

// ── vista Kanban (4 columnas por prioridad derivada del score; ancho completo) ──
/**
 * Dónde se va a insertar la tarjeta que estás arrastrando: qué columna y en qué POSICIÓN.
 *
 * «No solo desplazar de columna, sino de fila: puedo moverla abajo o arriba, y se tiene que
 * ver en la animación que la estoy moviendo un espacio donde estoy por dejar caer a la
 * tarjeta» (23/09/2026). Hasta acá el arrastre sólo sabía de columnas, así que soltar en
 * cualquier lado de «Alta» daba siempre el mismo número —el representativo de la banda— y
 * el pop-up abría en 88 sin importar si la habías dejado arriba de todo o al fondo.
 */
type Insercion = { destino: Prio; idx: number };

/**
 * El número que le corresponde a una tarjeta soltada ENTRE otras dos.
 *
 * Es el punto medio entre la de arriba y la de abajo, que es lo que hace que el orden que
 * dibujaste con la mano sea el orden que queda. Los bordes tienen su caso: arriba de todo
 * son dos puntos más que la primera, abajo de todo dos menos que la última, y en una columna
 * vacía el representativo de la banda, que es lo único que se sabe.
 *
 * ⚠️ Sale una SUGERENCIA, no el número final: el pop-up siempre pregunta. «Que siempre salga
 * el pop-up para cambiar la prioridad del 1 al 100» — soltar dice dónde, la persona dice
 * cuánto.
 */
function scoreEntre(items: { score: number }[], idx: number, destino: Prio): number {
  const arriba = items[idx - 1];
  const abajo = items[idx];
  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
  if (arriba && abajo) return clamp((arriba.score + abajo.score) / 2);
  if (abajo) return clamp(abajo.score + 2);
  if (arriba) return clamp(arriba.score - 2);
  return scoreFromPrio[destino];
}

/**
 * LA FOTO QUE EL SISTEMA OPERATIVO PINTA DETRÁS DEL CURSOR, VACÍA.
 *
 * No la gobierna ninguna regla CSS: en Windows Chrome la dibuja translúcida y la ancla
 * donde quiere, y `setDragImage(nodo)` cambia QUÉ se fotografía, no CÓMO se pinta. Así que
 * se le pasa una imagen de 1×1 y la copia de verdad la monta `useArrastreCopia`.
 *
 * Está acá suelto —y no adentro del hook— porque lo llama el `dragstart` de cada TARJETA y
 * el hook vive en el contenedor. Lo usan el Kanban y la vista de proyectos: un segundo
 * `try/catch` copiado es el que se queda sin el `catch` la primera vez que alguien lo toca.
 */
function fotoVaciaDeArrastre(dt: DataTransfer) {
  try {
    const vacio = document.createElement('canvas');
    vacio.width = 1; vacio.height = 1;
    dt.setDragImage(vacio, 0, 0);
  } catch { /* si no deja, queda la del navegador y se ve como antes */ }
}

/**
 * EL MOLDE DEL ARRASTRE CON MOUSE — UNO SOLO PARA TODO EL TABLERO.
 *
 * Nació adentro del Kanban y se midió a lo largo de SIETE rondas de reportes; cuando la
 * vista de proyectos también tuvo que arrastrar (25/09/2026) se extrajo acá en vez de
 * escribir un segundo. Las cuatro cosas que tiene y por qué, que es lo que costó:
 *
 * 1. **La copia la dibujamos nosotros** (`montarCopia`), opaca y nítida, porque la del
 *    sistema operativo se ve fantasmal y no hay CSS que la toque (ver `fotoVaciaDeArrastre`).
 * 2. **Se mueve escribiendo `transform` sobre un ref, NUNCA con `setState`.** Un `setState`
 *    por `dragover` redibuja el tablero 60 veces por segundo, que es el bug que hizo que el
 *    arrastre se sintiera roto tres rondas seguidas.
 * 3. **El listener va en `document` y EN CAPTURA.** El `dragover` de las columnas no cubre
 *    los huecos entre ellas ni el fondo de la página, y ahí la copia se queda clavada.
 * 4. **El auto-scroll va adentro del `dragover`.** Medido el 23/09/2026: mientras Chrome
 *    corre su bucle nativo de arrastre no entrega frames de animación **ni corre los
 *    timers** — sobre `requestAnimationFrame`, 1,2 s en el borde movieron 0 px (y su único
 *    tick llegó DESPUÉS de soltar); con `setInterval`, 0 px y 112 px de scroll largados con
 *    el gesto ya terminado. Lo único que el navegador sigue entregando es `dragover`.
 *
 * ⚠️ Y AL NODO ORIGEN NO SE LE TOCA EL TAMAÑO: colapsarlo a altura cero —lo que hacen
 * Trello y Linear— dejó el gesto sin salida (el arnés no completó un solo drop). Eso no vive
 * acá porque acá no se toca ninguna tarjeta: se menciona para que no vuelva.
 */
/**
 * EL CONTENEDOR QUE DE VERDAD SCROLLEA arriba de este nodo, o `null` si es la página.
 *
 * ⚠️ EXISTE PORQUE EL TABLERO YA NO ES SIEMPRE LA PANTALLA. Adentro de la ficha de un
 * cliente, el `Modal` de la casa pone `document.body.style.overflow = 'hidden'` y el que
 * scrollea pasa a ser `.mk-modal__cuerpo`: un `window.scrollBy` ahí no mueve NADA, así que
 * agarrabas una tarjeta, la llevabas al borde y no pasaba nada. Es literalmente el bug que
 * AGENTS.md ya tiene medido para `/plan` («19.630 px de tablero contra una ventana de 900,
 * sin auto-scroll en el camino del mouse»), reproducido un nivel más adentro.
 *
 * Se resuelve UNA vez, al agarrar: durante un arrastre el navegador congela `rAF` y los
 * timers, y lo único que sigue entregando es `dragover` — no es momento de caminar el DOM
 * en cada evento.
 */
function scrollerDe(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;  // la página: se sigue usando `window`, igual que siempre
}

function useArrastreCopia() {
  const scrollDir = useRef(0);
  /** Quién scrollea en ESTE arrastre. `null` = la ventana, que es el caso de `/plan`. */
  const scroller = useRef<HTMLElement | null>(null);
  const pararScroll = useCallback(() => { scrollDir.current = 0; }, []);
  const empujarScroll = useCallback((clientY: number) => {
    const BORDE = 110;
    const sc = scroller.current;
    // El borde se mide contra la caja del que scrollea, no contra el viewport: adentro de
    // un modal el tablero empieza 90 px más abajo y termina 90 px más arriba.
    const arriba = sc ? sc.getBoundingClientRect().top : 0;
    const abajo = sc ? sc.getBoundingClientRect().bottom : window.innerHeight;
    const dir = clientY < arriba + BORDE ? -1 : clientY > abajo - BORDE ? 1 : 0;
    scrollDir.current = dir;
    if (!dir) { pararScroll(); return; }
    if (sc) sc.scrollTop += dir * 18; else window.scrollBy(0, dir * 18);
  }, [pararScroll]);
  useEffect(() => () => pararScroll(), [pararScroll]);

  const copia = useRef<HTMLElement | null>(null);
  const soltarCopia = useCallback(() => { copia.current?.remove(); copia.current = null; }, []);
  useEffect(() => soltarCopia, [soltarCopia]);

  const montarCopia = useCallback((origen: HTMLElement, dx: number, dy: number) => {
    soltarCopia();
    // Quién scrollea se decide acá, en el `dragstart`, y vale para todo el gesto.
    scroller.current = scrollerDe(origen);
    const r = origen.getBoundingClientRect();
    const nodo = origen.cloneNode(true) as HTMLElement;
    const fondo = getComputedStyle(origen).backgroundColor;
    Object.assign(nodo.style, {
      position: 'fixed', top: '0', left: '0', margin: '0',
      width: `${r.width}px`, height: `${r.height}px`,
      // Opaca de verdad: si el fondo computado fuese transparente, la copia deja ver el
      // tablero por debajo y se ve igual de fantasmal que la del navegador.
      background: fondo && fondo !== 'rgba(0, 0, 0, 0)' ? fondo : 'var(--surface-2)',
      opacity: '1', pointerEvents: 'none', zIndex: '3000',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', transform: `translate3d(${r.left}px, ${r.top}px, 0) rotate(1.5deg)`,
      transition: 'none', cursor: 'grabbing',
    });
    document.body.appendChild(nodo);
    copia.current = nodo;
    const mover = (e: DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', mover, true); return; }
      copia.current.style.transform = `translate3d(${e.clientX - dx}px, ${e.clientY - dy}px, 0) rotate(1.5deg)`;
    };
    document.addEventListener('dragover', mover, true);
    // Se saca en `dragend` Y en `drop`, los dos, o queda un nodo colgado por arrastre.
    const fin = () => {
      document.removeEventListener('dragover', mover, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      soltarCopia();
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
  }, [soltarCopia]);

  return { empujarScroll, pararScroll, montarCopia, soltarCopia };
}

function Kanban({ tasks, board, topProjectId, sortMode, sortDir, frenanA, ask, sel, setSel, onOpen, onNew, onWarn, onOpenProj, onEliminar, onSoltar }: {
  tasks: BoardTask[]; board: Board; topProjectId: string | null; sortMode: OrdenModo; sortDir: 'desc' | 'asc'; frenanA: (id: string) => string[]; ask: (msg: string, onOk: () => void) => void; onOpen: (id: string) => void; onNew: (p?: Prio) => void; onWarn: (id: string) => void; onOpenProj: (id: string) => void; onEliminar: (id: string) => void;
  /**
   * LO TILDADO, Y VIENE DE AFUERA. Vivía acá adentro hasta el 04/10/2026, y por eso se
   * perdía al conmutar a la tabla: este componente se desmonta entero. Lo guarda
   * `BoardShell`, que es el ancestro que las dos formas comparten.
   */
  sel: ReadonlySet<string>; setSel: Dispatch<SetStateAction<ReadonlySet<string>>>;
  /** soltaste una tarjeta: NO se fija sola, se pregunta el número — con el que sugiere la POSICIÓN */
  onSoltar: (id: string, destino: Prio, sugerido?: number) => void;
}) {
  // Dónde caería si soltaras ahora. Es estado y no un ref porque se DIBUJA: el hueco entre
  // las tarjetas es la única forma de saber dónde va a caer antes de soltarla.
  const [ins, setIns] = useState<Insercion | null>(null);
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  /**
   * LO SELECCIONADO EN EL KANBAN. «Que pueda seleccionar varias tarjetas también en la vista
   * kanban» (24/09/2026).
   *
   * ⚠️ La casilla aparece SÓLO al pasar el mouse o cuando ya hay algo elegido. En una tabla
   * una casilla en la primera columna es el control de selección y se espera; en una tarjeta
   * es un control más compitiendo con el check de completar, el chip del proyecto y el
   * aviso de fecha. Apareciendo al hover no le saca lugar a nada hasta que hace falta.
   */
  // ⚠️ LAS DEPS SON `[setSel]`, no `[]` ni el objeto entero: el setter de `useState` es
  // estable, así que el `useCallback` sigue valiendo lo que valía cuando el estado vivía acá.
  const alternarSel = useCallback((id: string) => {
    setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, [setSel]);
  const elegidas = tasks.filter((t) => sel.has(t.id));
  /**
   * El punto MEDIO de cada tarjeta, por columna y en coordenadas de PÁGINA.
   *
   * Se mide una sola vez, cuando agarrás la tarjeta, y no se vuelve a leer layout en todo
   * el gesto. En coordenadas de página porque la página se puede mover mientras arrastrás
   * y un rectángulo medido contra la ventana deja de valer apenas eso pasa — es la misma
   * trampa que ya se había pagado en `arrastre-tactil.ts`.
   */
  const rects = useRef<Record<string, number[]>>({});

  /**
   * EMPUJAR LA PÁGINA MIENTRAS ARRASTRÁS, Y LA COPIA QUE SIGUE AL CURSOR. Las dos salen de
   * `useArrastreCopia` —el molde compartido con la vista de proyectos—, donde está escrito
   * por qué cada una es así.
   *
   * Lo que sí es de acá: sin auto-scroll el arrastre sirve para lo que ya se ve. Medido el
   * 23/09/2026 con el tablero real: la columna «Media» mide **9.801 px** de alto (66
   * tarjetas de 138 px), o sea el 10% del contenido a la vista en una ventana de 1000 px.
   *
   * Los rectángulos cacheados no se invalidan al scrollear porque están en coordenadas de
   * página — ésa es justamente la razón por la que se guardan así.
   */
  const { empujarScroll, pararScroll, montarCopia, soltarCopia } = useArrastreCopia();

  const agarrar = useCallback((id: string | null, desde?: { nodo: HTMLElement; dx: number; dy: number }) => {
    setArrastrado(id);
    if (!id) { setIns(null); rects.current = {}; pararScroll(); soltarCopia(); return; }
    if (desde) montarCopia(desde.nodo, desde.dx, desde.dy);
    const out: Record<string, number[]> = {};
    for (const col of document.querySelectorAll<HTMLElement>('[data-prio]')) {
      const prio = col.dataset.prio ?? '';
      out[prio] = [...col.querySelectorAll<HTMLElement>('[data-card]')].map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 + window.scrollY;
      });
    }
    rects.current = out;
  }, [pararScroll, soltarCopia, montarCopia]);
  // dir = -1 → desc (mayor score / #num más alto = más nuevo, primero); +1 → asc (al revés).
  const dir = sortDir === 'asc' ? 1 : -1;
  // EL ARRASTRE CON EL DEDO. El mouse sigue por HTML5 drag-and-drop (ya funciona y ya está
  // probado); esto corre sólo cuando el puntero NO es un mouse. Ver arrastre-tactil.ts: ahí
  // están las cuatro trampas que hacen que un arrastre táctil se pelee con el scroll, con
  // los clicks de adentro de la tarjeta y con el click fantasma del final.
  const prioDe = useCallback((id: string) => {
    const t = tasks.find((x) => x.id === id);
    return t ? displayPrio(t, topProjectId) : null;
  }, [tasks, topProjectId]);
  const tactil = useArrastreTactil(onSoltar, prioDe, !!board.repo.prioridadManual);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: '18px 30px 30px', flex: '1 0 auto', alignItems: 'flex-start' }} className="mako-board">
      <style>{`@media (max-width:1000px){.mako-board{grid-template-columns:repeat(2,1fr)!important}}@media (max-width:560px){.mako-board{grid-template-columns:1fr!important}}`}</style>
      {/* La barra ocupa el ancho de las cuatro columnas y queda pegada arriba mientras
          scrolleás: con un tablero de 19.000px, una barra que se va con el scroll obliga a
          volver arriba para usarla. */}
      {elegidas.length > 0 && (
        <div style={{ gridColumn: '1 / -1', position: 'sticky', top: 8, zIndex: 20 }}>
          <AccionesLote elegidas={elegidas} board={board} ask={ask} onLimpiar={() => setSel(new Set())} estilo={{ boxShadow: '0 8px 24px rgba(18,21,27,.14)' }} />
        </div>
      )}
      {PRIOS.map((p) => {
        const cmp = comparar(sortMode, dir);
        const items = tasks.filter((t) => displayPrio(t, topProjectId) === p).sort((a, b) =>
          (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0)
          || cmp({ score: a.score, titulo: a.title, deadline: a.deadline, creado: a.num }, { score: b.score, titulo: b.title, deadline: b.deadline, creado: b.num })
          || b.num - a.num);
        // El hueco se dibuja en la posición exacta donde va a caer, y sólo en la columna
        // sobre la que está el puntero.
        const hueco = (i: number) => (ins?.destino === p && ins.idx === i
          ? <div key={`hueco-${i}`} style={{ flex: 'none', height: 64, borderRadius: 10, border: `2px dashed ${PCOLOR[p]}`, background: PCOLOR[p] + '12', transition: 'height .12s' }} />
          : null);
        return (
          <section key={p}
            // Soltar una tarjeta acá ABRE EL POP-UP del 1 al 100; la columna solo dice la
            // banda. `preventDefault` en dragOver es lo que habilita el drop (sin él, el
            // navegador lo rechaza y no pasa nada, que se lee como que el arrastre no anda).
            // ⚠️ ACÁ ESTABA EL BUG, Y NO EN LA TARJETA. «No entiendo por qué en CRM
            // funciona bien y aquí no»: el CRM re-renderiza cuando cambiás DE COLUMNA —
            // cuatro veces en todo el arrastre— y esta versión leía el
            // `getBoundingClientRect` de las 55 tarjetas de «Alta» y volvía a dibujar el
            // tablero entero (334 tarjetas) en CADA evento de `dragover`, o sea ~60 veces
            // por segundo. Con el DOM reconstruyéndose así, el arrastre se ve exactamente
            // como se reportó: la tarjeta «no se agarra» y queda un fantasma congelado.
            //
            // La lección ya estaba escrita —y probada— en `arrastre-tactil.ts`: «leer
            // layout en cada movimiento es lo que hace que un arrastre se sienta
            // pegajoso». Los rectángulos se miden UNA vez, al empezar, y en coordenadas de
            // PÁGINA para que sobrevivan al scroll.
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              empujarScroll(e.clientY);
              const y = e.clientY + window.scrollY;
              const medidas = rects.current[p] ?? [];
              let idx = medidas.length;
              for (let i = 0; i < medidas.length; i++) { if (y < medidas[i]) { idx = i; break; } }
              // Y sólo se re-renderiza cuando el DESTINO cambia de verdad.
              setIns((prev) => (prev && prev.destino === p && prev.idx === idx ? prev : { destino: p, idx }));
            }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIns((prev) => (prev?.destino === p ? null : prev)); }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              rects.current = {};
              pararScroll();
              const crudo = ins?.destino === p ? ins.idx : items.length;
              setIns(null);
              setArrastrado(null);
              // La lista SIN la que se está moviendo: si se la deja adentro, el punto medio
              // se calcula contra su propio número y la tarjeta «no se mueve».
              //
              // ⚠️ Y POR ESO EL ÍNDICE HAY QUE CORRERLO. `idx` se midió contra los
              // rectángulos DIBUJADOS, que incluyen a la tarjeta agarrada —al nodo origen no
              // se le toca el tamaño, así que sigue ocupando su lugar—, y el número se
              // calcula contra la lista sin ella: bajando una tarjeta dentro de su propia
              // columna, cada posición de abajo se corre una. Sin el corrimiento el punto
              // medio sale entre el par equivocado y la tarjeta cae un lugar más arriba del
              // hueco que se estuvo viendo todo el arrastre — «la solté acá y quedó allá».
              // La grilla de proyectos y las tablas ya lo hacían; el Kanban era el único de
              // los tres que no, y un mismo gesto no puede dar tres números distintos.
              const otros = items.filter((t) => t.id !== id);
              const iYo = items.findIndex((t) => t.id === id);
              const idx = Math.max(0, Math.min(iYo >= 0 && crudo > iYo ? crudo - 1 : crudo, otros.length));
              if (id) onSoltar(id, p, scoreEntre(otros, idx, p));
            }}
            // `data-prio` es cómo el arrastre táctil sabe dónde está cada columna: al armarse
            // el gesto mide estos cuatro rectángulos UNA vez y después no vuelve a leer layout.
            data-prio={p}
            style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: (tactil.sobre === p || ins?.destino === p) ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid ' + ((tactil.sobre === p || ins?.destino === p) ? PCOLOR[p] : 'var(--border)'), borderTop: '3px solid ' + PCOLOR[p], borderRadius: 14, padding: 10, transition: 'background .12s, border-color .12s' }}>
            <ColHeader p={p} count={items.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 30, paddingRight: 2 }}>
              {/* card gris translúcida para crear (arriba de todo, más bajita que las tarjetas) */}
              <button onClick={() => onNew(p)} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', color: 'var(--faint)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, opacity: 0.8, transition: 'border-color .12s, color .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>＋ Nueva tarea</button>
              {items.length === 0 && !hueco(0) && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '10px 0' }}>—</div>}
              {/* EL HUECO. Es lo que convierte «la estoy soltando en Alta» en «la estoy
                  soltando ACÁ»: sin él, el número que propone el pop-up sale de una posición
                  que nadie vio. Tiene el alto de una tarjeta para que lo de abajo se corra
                  de verdad, como en el CRM. */}
              {hueco(0)}
              {items.map((t, i) => (
                <Fragment key={t.id}>
                  {/* `warn`: el triangulito rojo de «alta sin fecha». `!esRecurrente(t)`
                      porque una recurrente no puede tener deadline, así que titilaría para
                      siempre — es el mismo corte que el detalle hace en su rótulo. */}
                  <CardTile t={t} board={board} frenanA={frenanA(t.id)} warn={displayPrio(t, topProjectId) === 'alta' && t.progress < 100 && !t.deadline && !esRecurrente(t)} onOpen={onOpen} onWarn={onWarn} onOpenProj={onOpenProj} onEliminar={onEliminar} tactil={tactil} onAgarrar={board.repo.prioridadManual ? agarrar : undefined} oculta={arrastrado === t.id} elegida={sel.has(t.id)} haySeleccion={sel.size > 0} onElegir={alternarSel} />
                  {hueco(i + 1)}
                </Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function ColHeader({ p, count }: { p: Prio; count: number }) {
  return (
    <div style={{ flex: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 3px 8px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PCOLOR[p], flex: 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PLABEL[p]}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>
      </div>
    </div>
  );
}

// ── vista Prioridades: Objetivo Principal a la IZQUIERDA (alto, clickeable) + las
// 3 tareas a la DERECHA (feedback #11 y #3). ─────────────────────────────────────
function Prioridades({ tasks, board, objetivo, onOpen, onOpenProj }: { tasks: BoardTask[]; board: Board; objetivo: Label | null; onOpen: (id: string) => void; onOpenProj: (id: string) => void }) {
  return (
    // FLUIDA, no de ancho fijo. Antes era `maxWidth: 1060` + una columna clavada en
    // 336px y una media query a 840: con el zoom del navegador (que cambia el ancho en
    // píxeles CSS) quedaba una isla del mismo tamaño en el medio de la pantalla —
    // achicando el zoom sobraba medio monitor vacío, y agrandándolo saltaba de golpe a
    // una sola columna. Ahora las dos columnas son elásticas con un mínimo y el corte
    // lo hace el propio `flex-wrap` cuando de verdad no entran: acompaña cualquier zoom
    // sin escalones.
    // ⚠️ `alignItems: flex-start` ACA ARRIBA, Y ES LO QUE ARREGLA QUE LA TARJETA SE
    // ALARGUE SOLA. Este contenedor tiene `flex: 1 0 auto`, asi que crece hasta el
    // alto del viewport; sin esto su hijo se estira con el (el default es `stretch`)
    // y, adentro, el `stretch` de la fila le pasa ese alto a la tarjeta del
    // objetivo. Resultado: el proyecto terminaba MUCHO por debajo de la ultima
    // tarea, y cuanto mas zoom out, peor — porque mas viewport sobra.
    //
    // Medido a 1440/1800/2200/2800: la fila y las dos columnas daban 864 px las
    // tres, con el contenido de las tareas terminando en ~665. Ese hueco era el bug.
    //
    // Con `flex-start` la fila mide lo que mide su contenido, y el `stretch` de
    // adentro pasa a hacer lo que se espera: igualar la tarjeta a la ALTURA DE LAS
    // TAREAS, no a la de la pantalla.
    <div style={{ flex: '1 0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(12px,1.6vw,18px) clamp(14px,2.4vw,30px) 40px' }}>
      {/* El hueco entre el objetivo y las tareas baja de 20 a 12: «que este pegado a
          las tareas, no tanta separacion». Son dos cosas que se leen juntas —el norte
          y lo que hay que hacer por el—, no dos bloques de la pantalla. */}
      <div className="mako-prio" style={{ width: '100%', maxWidth: 'min(1400px, 100%)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
        {/* IZQUIERDA — Objetivo Principal (card alto, clickeable) */}
        {/* El objetivo es UN PROYECTO, así que ocupa lo mismo que un proyecto: la grilla
            de Proyectos usa tarjetas de ~240-300px y esta se estiraba hasta 440, con lo
            que en pantalla ancha parecía otra cosa. Se tiene que reconocer por el diseño
            —borde de color arriba, emoji, P#, avance— sin leer una palabra. */}
        {/* ⚠️ MAS ANCHA Y PEGADA A LAS TAREAS. El hueco que se veia NO era el gap: la
            tarjeta media 259 px adentro de una columna de 300 —no la llenaba— asi que
            sobraban 41 px que se leian como separacion y que bajar el gap no tocaba.
            Ahora la tarjeta lleva `width:100%` y el hueco real ES el gap.
            Y la columna pasa de 300 a 380 («esta muy flaca»): con la banda, el icono y
            el titulo adentro, 300 le quedaban cortos a la misma pieza que en la grilla
            vive en celdas de 320 minimo. */}
        <div className="mako-prio-obj" style={{ flex: '0 1 380px', maxWidth: 420, minWidth: 280, display: 'flex' }}>
          {objetivo ? <ObjetivoCard objetivo={objetivo} prog={projProgress(board.tasks, objetivo.id)} onOpen={() => onOpenProj(objetivo.id)} /> : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 24 }}>Todavía no hay un Objetivo Principal. Crea un proyecto y el perro elige el norte.</div>
          )}
        </div>
        {/* DERECHA — las 3 tareas en prioridad. `flex: 2 1 380px`: crece el doble que
            el objetivo cuando sobra lugar y se va abajo sola cuando no entra. */}
        <div style={{ flex: '2 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700 }}>🎯 Tareas prioritarias · {tasks.length}/{MAX_PRIORIDAD}</div>
            {/* ⛔ ACÁ IBA «🔒 N frenadas por otra cosa · no entran aquí hasta que se destraben»,
                y se fue el 25/09/2026. «No me dice qué tareas son, y todas las que están —las
                cinco principales— no tienen ninguna tarea bloqueante. Ese texto de por sí no
                debería estar ahí.» Un número que no nombra a nadie no se puede accionar: lo
                que frena a una tarjeta se ve en su detalle, que es donde está el nombre.
                El dato NO se perdió — lo bloqueado sigue fuera de esta lista, como siempre. */}
          </div>
          {tasks.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--faint)', textAlign: 'center', padding: '24px 20px', border: '1px dashed var(--border-strong)', borderRadius: 14 }}>
              {/* Acá SOLO se llega con el plan entero terminado: la lista se completa con
                  lo mejor del resto de los proyectos, así que si está vacía es que no
                  queda ni una tarea abierta. Decirlo así y no "todavía no hay ninguna". */}
              <div style={{ fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>No queda ninguna tarea abierta en todo el plan. Crea una nueva o saca los pendientes de tu última reunión.</div>
            </div>
          )}
          {tasks.map((t, i) => {
            // A qué proyecto pertenece. Antes solo se decía cuando la tarjeta NO era del
            // Objetivo Principal (entraba para completar las 3); ahora se dice siempre,
            // porque saber de qué parte del plan es una tarea no debería depender de
            // abrirla. El chip es el mismo del detalle: color del proyecto. UNO solo +
            // "+N" (con su desplegable al pasar el mouse): con dos chips largos, el
            // proyecto le ganaba en peso visual al título, que es lo que hay que leer.
            const proys = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
            return (
              // ⚠️ MAS COMPACTA, Y LO QUE SE RECORTA ES EL AIRE, NO EL TEXTO. «Que no
              // sean tan altas las tareas, que sea un poco mas compacto, asi el proyecto
              // de al lado no queda larguisimo» (27/09/2026) — y el sintoma que nombra es
              // el que importa: la columna izquierda es UNA tarjeta que estira hasta el
              // alto de las cinco de la derecha, asi que cada pixel de mas aca se paga
              // alla multiplicado por cinco. De 20/24 de padding y tres separaciones de
              // 10/12/14 a 14/18 y 7/8: ~32 px menos por tarjeta, ~160 en la columna.
              <div key={t.id} onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', boxShadow: '0 1px 2px rgba(18,21,27,.05)', cursor: 'pointer', transition: 'border-color .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                {/* Como el proyecto de al lado (feedback jul-18): arriba ranking + proyecto
                    + #id + prioridad; el título abajo, en su línea. El emoji suelto se fue:
                    era el del proyecto, y ahora va DENTRO del chip en vez de repetido. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, minWidth: 0 }}>
                  <span title={`Prioridad ${i + 1}`} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontFamily: MONO }}>{i + 1}</span>
                  {proys.length > 0
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><LabelChips chips={proys} max={1} cap={240} onOpen={onOpenProj} /></span>
                    : <span style={{ fontSize: 22, lineHeight: 1, flex: 'none' }}>{emojiTarea(board, t)}</span>}
                  <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', flex: 'none' }}>#{t.num}</span>
                  <span style={{ flex: 1, minWidth: 0 }} />
                  {!t.deadline && <WarnMark title="Falta el deadline" size={16} />}
                  <ScoreBadge score={t.score} />
                </div>
                {/* DOS LÍNEAS: «permite el salto de línea 1 vez» (25/09/2026). A 19px una
                    sola cortaba casi todos los títulos, y tres renglones empujan el deadline
                    y el check fuera de la vista y hacen que dos tarjetas de la misma lista
                    midan distinto. El entero sigue en el `title`. */}
                <div title={t.title} style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{t.title}</div>
                {/* El DEADLINE a la vista y el check para completar. Antes acá vivían la
                    barra de avance, el % y la checklist plegable: los tres se fueron con
                    la checklist («una tarea se completa o no se completa»), y lo que
                    faltaba era justamente cuándo vence y cuánto falta. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {t.deadline && <LineaDeadline iso={t.deadline} hoy={hoyISO()} hecho={t.progress >= 100} tam={13} mono={false} color="var(--dim)" style={{ flex: 'none' }} />}
                  <span style={{ flex: 1 }} />
                  <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }}
                    aria-label={`Marcar «${t.title}» como completada`} title="Marcar como completada"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                    <CheckHecho done={t.progress >= 100} size={14} />
                    Completar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * La tarjeta del Objetivo Principal (izquierda de Prioridades).
 *
 * ⚠️ ES **LA MISMA** QUE EN LA GRILLA DE PROYECTOS, no una parecida. Tenía su
 * propio dibujo —un borde de color arriba, el emoji suelto, el pid, el nombre y
 * una barra— y le faltaba lo único que el dueño pidió: «en la vista de
 * prioridades también debes poner el diseño de la preview de la card de
 * proyecto, con su banner» (27/09/2026). Un proyecto se tiene que reconocer
 * igual en las dos pantallas, y para eso hay que montar la MISMA pieza: la
 * segunda copia es la que se queda vieja.
 *
 * `sinRanking` queda en false a propósito: acá el score SÍ importa — es el
 * número que explica por qué este proyecto es el norte.
 */
function ObjetivoCard({ objetivo, onOpen, prog }: { objetivo: Label; onOpen: () => void; prog: { total: number; done: number; pct: number } }) {
  return <ProyectoCardTile l={objetivo} prog={prog} isTop onOpen={onOpen} />;
}

// ── filtro por etiqueta ─────────────────────────────────────────────────────────
// Botón "Filtrar" de CAPAS (#13): estado + etiquetas + ORIGEN (fuente) + ORDEN.
// `labels` opcional: en Proyectos solo va la capa de estado. `fOrigen`/`sortMode`
// opcionales: si vienen, se muestran esas capas (aplican a tareas y a proyectos).
const ORIGEN_OPS: Array<[string, string]> = [
  ['whatsapp', '💬 WhatsApp'], ['fathom', '🎙️ Reunión · Fathom'], ['claude-code', '⌨️ Claude Code'],
  ['archivo', '📄 Archivos subidos'], ['mako', '✨ MaKo'], ['manual', '✍️ Manual'],
];
type FiltroVista = 'root' | 'estado' | 'proyecto' | 'origen' | 'orden' | 'cuando';
function FilterMenu({ labels, fLabels, setFLabels, doneFilter, setDoneFilter, estadoLabels, fOrigen, setFOrigen, fCuando, setFCuando, sortMode, setSortMode, sortDir, setSortDir, soloIcono }: {
  /** sin lugar: queda el embudo solo (la palabra son ~55px). */
  soloIcono?: boolean;
  labels?: Label[]; fLabels?: Set<string>; setFLabels?: (s: Set<string>) => void;
  doneFilter: DoneFilter; setDoneFilter: (f: DoneFilter) => void; estadoLabels?: Array<[DoneFilter, string]>;
  fOrigen?: Set<string>; setFOrigen?: (s: Set<string>) => void;
  fCuando?: Set<Cuando>; setFCuando?: (s: Set<Cuando>) => void;
  sortMode?: OrdenModo; setSortMode?: (m: OrdenModo) => void;
  sortDir?: 'desc' | 'asc'; setSortDir?: (d: 'desc' | 'asc') => void;
}) {
  const [open, setOpen] = useState(false);
  // Drill-down (feedback: la lista apilada obligaba a un scroll gigante). En 'root' se
  // ven las 4 categorías; al tocar una, su contenido reemplaza el panel EN EL MISMO
  // lugar, con un "‹ volver". Así nunca hay más de una categoría en pantalla a la vez.
  const [vista, setVista] = useState<FiltroVista>('root');
  const [buscaProy, setBuscaProy] = useState('');
  /**
   * CÓMO SE ORDENA LA LISTA DEL FILTRO, que NO es cómo se ordena el tablero.
   *
   * «Aún no se puede ordenar el filtro de proyectos, son muchos y cuesta buscarlos sin
   * ordenamiento allí» (24/09/2026). Es una pregunta distinta de la del menú «Ordenar»:
   * aquella ordena LO QUE SE VE en el tablero, ésta ordena la lista donde uno va a BUSCAR.
   * Atarlas sería reordenar el tablero entero por abrir un filtro.
   *
   * ⚠️ Y arranca en A-Z, no en prioridad: el trabajo de esta lista es ENCONTRAR un
   * proyecto por su nombre. Se recuerda (`usePref`), así que quien prefiera verlos por
   * prioridad lo cambia una vez.
   */
  const [ordenProy, setOrdenProy] = usePref<OrdenModo>('filtro.proyectos.orden', 'az', esUnoDe('score', 'deadline', 'creacion', 'az'));
  const [dirProy, setDirProy] = usePref<'desc' | 'asc'>('filtro.proyectos.dir', 'asc', esUnoDe('desc', 'asc'));
  const cerrar = () => { setOpen(false); setVista('root'); };
  const n = (fLabels?.size ?? 0) + (fOrigen?.size ?? 0) + (fCuando?.size ?? 0) + (doneFilter !== 'all' ? 1 : 0);
  const toggle = (id: string) => { if (!fLabels || !setFLabels) return; const c = new Set(fLabels); if (c.has(id)) c.delete(id); else c.add(id); setFLabels(c); };
  const toggleOrigen = (tipo: string) => { if (!fOrigen || !setFOrigen) return; const c = new Set(fOrigen); if (c.has(tipo)) c.delete(tipo); else c.add(tipo); setFOrigen(c); };
  const toggleCuando = (v: Cuando) => { if (!fCuando || !setFCuando) return; const c = new Set(fCuando); if (c.has(v)) c.delete(v); else c.add(v); setFCuando(c); };
  const ops = estadoLabels ?? ESTADO_OPS;
  const check = (on: boolean): CSSProperties => ({ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' });
  const radio = (on: boolean): CSSProperties => ({ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2px var(--surface)' : 'none' });
  const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS };

  // Resúmenes que se muestran en la fila de cada categoría (el valor actual, a la derecha).
  const estadoLabel = ops.find(([v]) => v === doneFilter)?.[1] ?? ops[0][1];
  const proyResumen = fLabels?.size ? `${fLabels.size} elegido${fLabels.size > 1 ? 's' : ''}` : 'Todos';
  const origenResumen = !fOrigen?.size ? 'Todos' : (fOrigen.size === 1 ? (ORIGEN_OPS.find(([t]) => fOrigen.has(t))?.[1].replace(/^\S+\s/, '') ?? '1') : `${fOrigen.size} elegidos`);
  const cuandoResumen = !fCuando?.size ? 'Todas'
    : fCuando.size === 1 ? CUANDO_LABEL[[...fCuando][0]] : `${fCuando.size} ventanas`;
  const modeLabel = ORDEN_OPS.find(([v]) => v === sortMode)?.[1] ?? 'Por prioridad';
  const ordenResumen = `${modeLabel} ${sortDir === 'asc' ? '↑' : '↓'}`;

  // Categorías del menú. ORDENAR va PRIMERO (pedido de Martín). El resto: las que
  // apliquen (en la vista Proyectos no va "Proyecto", etc.).
  const cats: Array<{ key: FiltroVista; label: string; resumen: string; activo: boolean }> = [];
  if (sortMode && setSortMode) cats.push({ key: 'orden', label: 'Ordenar', resumen: ordenResumen, activo: false });
  // «Cuando» va ARRIBA de «Estado»: la pregunta de quien abre el tablero a la manana
  // es que le toca HOY, no en que estado esta cada cosa.
  if (fCuando && setFCuando) cats.push({ key: 'cuando', label: 'Cuando', resumen: cuandoResumen, activo: !!fCuando.size });
  cats.push({ key: 'estado', label: 'Estado', resumen: estadoLabel, activo: doneFilter !== 'all' });
  if (labels && labels.length > 0) cats.push({ key: 'proyecto', label: 'Proyecto', resumen: proyResumen, activo: !!fLabels?.size });
  if (fOrigen && setFOrigen) cats.push({ key: 'origen', label: 'Origen', resumen: origenResumen, activo: !!fOrigen.size });

  const catRow: CSSProperties = { ...rowBtn, justifyContent: 'space-between', padding: '10px 9px' };
  const resumenTxt = (activo: boolean): CSSProperties => ({ fontSize: 12, color: activo ? 'var(--primary)' : 'var(--faint)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 });
  const backBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 6px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginBottom: 4 };

  return (
    // ⚠️ `flex: none` VA ACÁ, no solo en el botón de adentro. Este span es el flex item que
    // ve el header, y el grupo que lo contiene tiene `minWidth: 0` para poder achicarse: sin
    // esto el span se comprimía y el botón quedaba CORTADO por su propio borde, con la
    // palabra «Filtrar» saliéndose. Poner `flex: none` en el hijo no sirve — el que se
    // achica es el padre.
    <span style={{ position: 'relative', flex: 'none' }}>
      <button onClick={() => { setOpen((o) => !o); setVista('root'); }} aria-label="Filtrar" title="Filtrar" aria-expanded={open}
        style={{ position: 'relative', ...ghostBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          // Sin la palabra, el alto lo fijaba el texto y el botón quedaba en 41x31 al lado
          // de los de 38x38: tres alturas en la misma fila. La caja es la MISMA siempre.
          height: 38, width: soloIcono ? 38 : undefined, padding: soloIcono ? 0 : '0 13px', flex: 'none', whiteSpace: 'nowrap', background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
        <FunnelIcon color="var(--primary)" />{!soloIcono && 'Filtrar'}
        {n > 0 && <span onClick={(e) => { e.stopPropagation(); setFLabels?.(new Set()); setFOrigen?.(new Set()); setFCuando?.(new Set()); setDoneFilter('all'); }} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 244, maxHeight: 460, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {vista === 'root' ? (
            <>
              {cats.map((c) => (
                <button key={c.key} onClick={() => setVista(c.key)} style={catRow}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={resumenTxt(c.activo)}>{c.resumen}</span>
                    <span style={{ color: 'var(--faint)', fontSize: 16, lineHeight: 1 }}>›</span>
                  </span>
                </button>
              ))}
              {n > 0 && (
                <button onClick={() => { setFLabels?.(new Set()); setFOrigen?.(new Set()); setFCuando?.(new Set()); setDoneFilter('all'); }}
                  style={{ ...rowBtn, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--primary)', fontWeight: 600 }}>
                  Limpiar filtros ({n})
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setVista('root')} style={backBtn}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>‹</span>
                {cats.find((c) => c.key === vista)?.label ?? 'Volver'}
              </button>
              {vista === 'estado' && ops.map(([v, label]) => (
                <button key={v} onClick={() => setDoneFilter(v)} style={{ ...rowBtn, background: doneFilter === v ? 'var(--primary-bg)' : 'transparent', fontWeight: doneFilter === v ? 700 : 500 }}>
                  <span style={radio(doneFilter === v)} /><span>{label}</span>
                </button>
              ))}
              {/* ⚠️ CON 70 PROYECTOS, UNA LISTA PLANA NO ES UN FILTRO: es un scroll. «En el
                  filtro de proyectos debería poder ordenar o buscar, porque si no son muchos
                  y es difícil» (24/09/2026). Se busca sin acentos y sin el prefijo, así
                  «landing» encuentra «Feature: Landing Analyst» y escribir «feature» no
                  devuelve los 47. Los ELEGIDOS quedan arriba y no los filtra nada: si el
                  buscador escondiera lo que ya marcaste, la pantalla mentiría sobre lo que
                  está filtrando. */}
              {vista === 'proyecto' && labels && (() => {
                const q = buscaProy.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                const limpio = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^(feature|agente|vender mako|cliente)\s*:\s*/, '');
                const cmp = comparar(ordenProy, dirProy === 'asc' ? 1 : -1);
                const lista = labels
                  .filter((l) => fLabels?.has(l.id) || !q || limpio(l.name).includes(q) || l.name.toLowerCase().includes(q))
                  // Los ELEGIDOS primero, y después el criterio. Que lo marcado se mueva de
                  // lugar al reordenar es cómo se pierde de vista lo que uno acaba de elegir.
                  .sort((a, b) => (fLabels?.has(b.id) ? 1 : 0) - (fLabels?.has(a.id) ? 1 : 0)
                    || cmp({ score: a.score, titulo: a.name, deadline: a.deadline ?? '', creado: creTsLabel(a) },
                           { score: b.score, titulo: b.name, deadline: b.deadline ?? '', creado: creTsLabel(b) }));
                return (
                  <>
                    <input value={buscaProy} onChange={(e) => setBuscaProy(e.target.value)} autoFocus placeholder="Buscar proyecto…"
                      style={{ width: '100%', padding: '7px 9px', marginBottom: 6, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', fontFamily: SANS }} />
                    {/* Los chips PLIEGAN a un segundo renglón si no entran (`flexWrap`): no
                        son una barra de navegación, así que envolver no esconde nada — y
                        acertarle a la suma de cuatro rótulos en cualquier zoom no se puede. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, marginRight: 2 }}>Ordenar</span>
                      {ORDEN_OPS.map(([v]) => {
                        const on = ordenProy === v;
                        return (
                          <button key={v} type="button" title={`Ordenar la lista por ${ORDEN_CORTO[v]}${on ? ' (invertir)' : ''}`}
                            onClick={() => { if (on) setDirProy(dirProy === 'desc' ? 'asc' : 'desc'); else { setOrdenProy(v); setDirProy(DIR_NATURAL[v]); } }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 7px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 11, lineHeight: 1.5,
                              border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'transparent',
                              color: on ? 'var(--primary)' : 'var(--dim)', fontWeight: on ? 700 : 500 }}>
                            {ORDEN_CORTO[v]}{on && <span style={{ fontSize: 12 }}>{dirProy === 'asc' ? '↑' : '↓'}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {lista.length === 0 && <div style={{ padding: '10px 9px', fontSize: 12, color: 'var(--faint)' }}>Ninguno coincide.</div>}
                    {lista.map((l) => (
                      <button key={l.id} onClick={() => toggle(l.id)} style={rowBtn}>
                        <span style={check(!!fLabels?.has(l.id))}>{fLabels?.has(l.id) ? '✓' : ''}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.emoji} {l.name}</span>
                        {/* El dato de la DERECHA es el del criterio activo: una lista
                            ordenada por deadline que muestra el score no se puede leer. */}
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>
                          {ordenProy === 'deadline' ? (l.deadline ? fechaConDia(l.deadline) : '—') : l.score}
                        </span>
                      </button>
                    ))}
                  </>
                );
              })()}
              {vista === 'cuando' && CUANDO_OPS.map((v) => (
                <button key={v} onClick={() => toggleCuando(v)} style={rowBtn}>
                  <span style={check(!!fCuando?.has(v))}>{fCuando?.has(v) ? '✓' : ''}</span>
                  <span>{CUANDO_LABEL[v]}</span>
                </button>
              ))}
              {vista === 'origen' && ORIGEN_OPS.map(([tipo, label]) => (
                <button key={tipo} onClick={() => toggleOrigen(tipo)} style={rowBtn}>
                  <span style={check(!!fOrigen?.has(tipo))}>{fOrigen?.has(tipo) ? '✓' : ''}</span>
                  <span>{label}</span>
                </button>
              ))}
              {vista === 'orden' && (
                // Toggle clásico: 1 clic ordena, otro clic sobre el MISMO invierte la
                // dirección (flecha ↓/↑). Clic en el otro criterio arranca en ↓ (desc).
                ORDEN_OPS.map(([v, label]) => {
                  const activo = sortMode === v;
                  return (
                    <button key={v} onClick={() => { if (activo) setSortDir?.(sortDir === 'desc' ? 'asc' : 'desc'); else { setSortMode?.(v); setSortDir?.(DIR_NATURAL[v]); } }}
                      style={{ ...rowBtn, justifyContent: 'space-between', background: activo ? 'var(--primary-bg)' : 'transparent', fontWeight: activo ? 700 : 500 }}>
                      <span>{label}</span>
                      <span style={{ fontSize: 15, lineHeight: 1, color: activo ? 'var(--primary)' : 'var(--faint)', width: 14, textAlign: 'center' }}>{activo ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      </>}
    </span>
  );
}

// ── change history (avatar + nombre + deshacer por entrada) ─────────────────────
function ChangeHistory({ t, board, ask }: { t: BoardTask; board: Board; ask: (msg: string, onOk: () => void) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  const { nombre, avatarUrl } = board.user;
  // Mismo criterio que el historial de un proyecto: una tarea que pasó por el Perro, por
  // una reunión y por dos scripts junta veinte entradas, y abajo del historial está el
  // resto del detalle.
  const { visibles, boton } = useVerMas(t.historial, { inicial: 8, tanda: 8, estilo: 'texto' });
  if (t.historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía. Los cambios van a aparecer aquí.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibles.map((h, i) => {
        const { esCreacion, porque } = partirCreacion(h.text, 'Creó la tarjeta');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={26} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{autorDe(h.actor, nombre)}</strong> · {esCreacion ? frasePorAlta(h.actor, nombre, "a") : h.text}{esCreacion && porque && <span style={{ color: 'var(--dim)' }}> — {porque}</span>}</div>
              <div title={nowMs ? relTime(h.ts, nowMs) : ''} style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fechaHora(h.ts)}</div>
            </div>
            {/* solo el ÚLTIMO cambio se puede deshacer (1 en 1, tipo ctrl-z) */}
            {/* #10: no se puede deshacer un cambio de MaKo / el perro — sería saltearse el sistema */}
            {i === 0 && h.undo && h.actor === 'user' && <button onClick={() => ask('Se revierte este cambio y se borra del historial. ¿Seguir?', () => board.undoHist(t.id, h))} title="Deshacer el último cambio" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '4px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶ Deshacer</button>}
          </div>
        );
      })}
      {boton}
    </div>
  );
}

// ── modal de detalle ────────────────────────────────────────────────────────────
export function TaskModal({ t, board, topProjectId, suggestMako = false, trabajando = false, onDebate, onPrioridad, onDelete, onAsignar, onAsignarCliente, onOpenProj, ask, onBack, escDisabled = false, onClose }: {
  t: BoardTask; board: Board; topProjectId: string | null; suggestMako?: boolean;
  /** el Perro está trabajando sobre ESTA tarjeta ahora mismo (recién creada) */
  trabajando?: boolean;
  onDebate: () => void; onPrioridad: () => void; onDelete: () => void; onAsignar: () => void;
  /** Abre el picker de CLIENTE (mig 0172). El estado del modal vive en `BoardShell`, así que
   *  la capacidad entra por acá: sin la prop, el lápiz no se dibuja. Mismo criterio que
   *  `onAsignar`, y el mismo modo de falla que este archivo ya pagó cuatro veces. */
  onAsignarCliente: () => void;
  onOpenProj?: (id: string) => void; ask: (msg: string, onOk: () => void) => void; onBack?: () => void; escDisabled?: boolean; onClose: () => void;
}) {
  const prioEfectiva = displayPrio(t, topProjectId);
  const topeada = prioEfectiva !== prioFromScore(t.score);
  // ¿Se repite para siempre? Sale del contrato, nunca de `t.recurrente`.
  const repite = esRecurrente(t);
  const [mako, setMako] = useState(false);
  const [titleDraft, setTitleDraft] = useState(t.title);

  // commit del título al DESMONTAR (Escape/cierre no dispara onBlur). El detalle lo
  // maneja RichText (commit onBlur).
  const tRef = useRef(t);
  const tdRef = useRef(titleDraft);
  useEffect(() => { tRef.current = t; tdRef.current = titleDraft; });
  useEffect(() => () => { board.setTitle(tRef.current.id, tdRef.current, tRef.current.title); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Escape: si vino de un proyecto, VUELVE al proyecto; si no, cierra. (Blurea primero
  // para commitear el detalle.) No dispara con el submodal de MaKo abierto.
  const salir = onBack ?? onClose;
  // Pila de modales: si esta tarjeta se abrió DESDE otro modal (la revisión de una
  // reunión, por ejemplo), ese otro se esconde mientras esta está arriba y vuelve —con
  // su scroll— al cerrarla. Antes esta se abría DETRÁS y no se veía.
  const capa = useCapaModal(true);
  // Se pregunta en el MOMENTO de la tecla (es una función, no un boolean): así el handler
  // no tiene dependencias y no se re-registra cada vez que algo se abre encima.
  const capaArriba = capa.esElDeArriba;
  useEffect(() => {
    // `capaArriba` es la guarda GENERAL (ver `esElDeArriba` en pila-modales): adentro de la
    // ficha de un cliente hay otra capa visible debajo, y sin esto un Escape cerraba las dos.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mako && !escDisabled && capaArriba()) { (document.activeElement as HTMLElement)?.blur?.(); salir(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [mako, escDisabled, salir, capaArriba]);
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  const optimizada = t.historial.some((h) => h.text.startsWith('MaKo'));

  return (
    <div onClick={salir} style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: capa.visible ? 'flex' : 'none', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: MODAL_DETALLE, height: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          {onBack && <button onClick={onBack} title="Volver al proyecto" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>← Volver</button>}
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontWeight: 600, flex: 'none' }}>#{t.num}</span>
          {/* El chip va en el HEADER y no sólo en el interruptor de la columna derecha: es
              lo primero que hay que saber de esta tarjeta —cambia el significado de su
              prioridad, de su fecha y de dónde vive—, y la columna derecha puede estar
              scrolleada. Este modal se monta también FUERA del tablero (`RoadmapCS`), donde
              no hay ninguna otra pista de que la tarea no compite. */}
          {repite && <RepiteChip />}
          {/* en el header, compacto (la lista completa está en el sidebar "Proyectos") */}
          <LabelChips chips={chips} max={1} cap={230} onOpen={onOpenProj} />
          {/* ⛔ ACÁ IBA EL CHIP DE ORIGEN con su palabra al lado («Fathom · Reunión con…»).
              Pasó por la columna derecha —«no lo pondría en el punto principal»— y terminó
              en el renglón del historial: «que el origen esté en el change history, tiene
              sentido que esté allí. Pero que se vea sin necesidad de desplegar» (25/09). */}
          <span style={{ flex: 1 }} />
          <button aria-label="Cerrar" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            {/* El título SE EDITA, y ahora se nota — pero sin el recuadro azul al
                enfocarlo. El molde (y el porqué de cada estado) está en `tituloEditable`. */}
            <textarea value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={(e) => { tituloBlur(e); board.setTitle(t.id, titleDraft, t.title); }}
              onFocus={tituloFoco}
              title="Edita el título" aria-label="Título de la tarea" placeholder="Título de la tarea…" rows={2}
              style={tituloEditable} />

            {/* ⛔ ACÁ IBAN UN `<Separador />` Y EL RÓTULO «Detalle · doc», y se fueron los
                dos el 25/09/2026: «elimina lo de "Detalle doc" y que sea directamente el
                detalle» + «elimina el divider que separa el título del detalle, que estén
                más juntos». El título y el doc son la misma cosa dicha en dos tamaños;
                una línea en el medio los presentaba como dos secciones. */}
            <DetalleDoc valor={t.detalle} onChange={(html) => board.setDetalle(t.id, html, t.detalle)} placeholder="El doc de esta tarea…" />

            <Separador />
            {/* ⚠️ LAS NOTAS, DEBAJO DEL DETALLE. Estuvieron arriba unas horas del 25/09 y
                volvieron acá: «las notas abajo del detalle». Arriba empujaban el doc —que es
                lo que se viene a leer— fuera de la primera pantalla, y una caja vacía que
                dice «Agregar nota» es lo primero que se veía de una tarjeta llena de
                contenido. No se pliega: es lo único que escribe la PERSONA. */}
            <NotasLista valor={t.notas ?? ''} onGuardar={(v) => board.patch(t.id, { notas: v })} />

            {/* ⚠️ ACÁ VIVÍAN EL AVANCE Y LA CHECKLIST, y se fueron los dos el 22/09/2026.
                Textual: «que no existan checklists, quitan mucho tiempo, son incómodas e
                imprácticas. De última un bullet point». Y con ellas el % por tarea: «una
                tarea se completa o no se completa».
                · Los pasos ahora son viñetas del detalle, que es lo que un agente lee
                  para ejecutar la tarea (lib/detalle-fusion.ts → pasosComoBullets).
                · El check de completar vive al pie de la columna derecha, junto al tacho
                  («eliminar y marcar como completada en la sidebar derecha, eso es
                  obvio…», 25/09/2026). Acá abajo, entre el doc y el historial, era «re
                  invisible… tan incómodo». */}

            {t.haceloEn && <><Separador /><HaceloEnMaKo id={t.haceloEn} /></>}

            <Separador />
            {/* EL HISTORIAL, PLEGADO, CON SU CHEVRON Y EL ORIGEN AL LADO. El molde —y por
                qué no es un `<details>` ni se parece al plegado del detalle— está en
                `BloqueHistorial`. Es el MISMO que usa el proyecto. */}
            <BloqueHistorial n={t.historial.length} fuente={fuenteEfectiva(t)}>
              <ChangeHistory t={t} board={board} ask={ask} />
            </BloqueHistorial>
            {/* ⛔ ACÁ ABAJO estuvieron, unas horas del 25/09, los botones de completar y
                eliminar. Se fueron a la columna derecha el mismo día: «eliminar y marcar
                como completada en la sidebar derecha, eso es obvio…». */}
          </div>
          {/* EL ANCHO DE LA COLUMNA, `COL_DER`: mismo número acá y en el proyecto. */}
          <div style={{ width: COL_DER, flex: 'none', minWidth: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            {trabajando && <PerroTrabajando que="tu plan, para ponerle proyecto, prioridad y detalle" />}
            <BloquePrioridad
              etiqueta={PLABEL[prioEfectiva].toUpperCase()} color={PCOLOR[prioEfectiva]} titulo={t.title}
              chip={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: PCOLOR[prioEfectiva], whiteSpace: 'nowrap' }}><ScoreIcon size={12} color={PCOLOR[prioEfectiva]} />{t.score}</span>}
              razon={t.scoreRazon} impacto={t.impacto} esfuerzo={t.esfuerzo}
              tiempo={<TiempoLinea t={t} />}
              puedeEditar={!!board.repo.prioridadManual} onEditar={onPrioridad} />
            {/* La FECHA la decide el Perro igual que la prioridad: la propone al crear la
                tarea, deja escrito por qué, y para moverla hay que discutírsela. */}
            {/* ── fin de grupo. Ver el porqué de los grupos en el comentario de arriba. */}
            <div aria-hidden style={{ height: 1, background: 'var(--border)' }} />
            {/* ⚠️ EL INTERRUPTOR VA ACÁ Y NO EN OTRO LADO, y abre el grupo del TIEMPO a
                propósito: lo que decide es si el deadline y el Quarter de abajo significan
                algo. Leído en orden dice «esta tarea se repite → por eso no tiene fecha»,
                que es la frase entera; puesto después, las dos fechas se leen primero como
                campos vacíos.

                ⚠️ Y ES EL ÚNICO LUGAR DONDE SE MARCA UNA TAREA, por ahora, y es una
                decisión: el detalle es donde la persona está mirando la tarjeta entera y
                donde el cambio se explica solo (el chip aparece arriba, los dos campos de
                fecha DESAPARECEN acá abajo). Su gemelo para un proyecto vive en
                `ProjectDetailModal`, en el mismo lugar de la misma columna. El alta y la
                barra de selección múltiple viven en otros archivos y no se tocaron en esta
                pasada — están declarados como pendientes, con su archivo, porque una
                capacidad a medias es peor que ninguna. Lo que NO puede pasar, y no pasa, es
                que la única forma de marcarla sea la base de datos. */}
            <BloqueRecurrente rotulo="Tarea recurrente" repite={repite} onCambiar={(v) => board.setRecurrente(t.id, v)} />
            {/* ══ LOS DOS CAMPOS DE TIEMPO SE VAN AL MARCAR «Se repite» ══════════════════
                «Si le pongo "Se repite" a alguna tarea o proyecto, deben desaparecer las
                opciones de deadline o quarter» (26/09/2026). **No se deshabilitan: se van.**
                Un `disabled` que no se puede usar es la peor de las dos versiones —ya está
                en AGENTS.md: un control que no hace nada se lee como que la app está rota— y
                encima deja dos campos vacíos que se leen como datos que faltan sobre algo a
                lo que no le falta nada.

                ⚠️ LA CONDICIÓN ES `llevaDeadline`, NO UN `!repite` ESCRITO ACÁ. Es la misma
                regla que ya aplican el mapper del server (`taskToRow`) y `useBoard`, y vive
                en `lib/plan-recurrentes.ts` para poder grepearse: el día que una recurrente
                sí lleve una fecha (la del próximo ciclo) cambia ahí y no en los seis lugares
                que hoy la aplican.

                ⚠️ Y POR ESO EL INTERRUPTOR ESTÁ ARRIBA, DENTRO DE ESTE MISMO GRUPO. La
                sidebar son cuatro grupos separados por una línea; con el interruptor en otro
                grupo, marcar «se repite» dejaría éste SIN UN SOLO HIJO y con sus dos líneas
                colgando pegadas. Con él adentro el grupo no puede quedar vacío — y además se
                lee en orden: «esta tarea se repite → por eso no tiene fecha».

                ⚠️ Se va también el porqué (`PORQUE_SIN_FECHA`), que se pintaba bajo el
                deadline cuando una recurrente todavía tenía la fecha vieja: sin el campo no
                hay nada que justificar, y el borrado sigue teniendo su propia entrada en el
                historial, que es donde se audita un cambio. */}
            {/* ⚠️ ES UN `? :` Y NO DOS CONDICIONES SUELTAS. Los dos lados contestan LA MISMA
                pregunta —«¿cuándo?»— y no pueden convivir: con fecha de fin se contesta con
                un deadline y un Quarter, y sin ella con un ritmo. Escrito como dos `&&`
                separados, el día que alguien toque una de las dos condiciones quedan las
                tres cosas juntas (una recurrente con deadline) o ninguna (el grupo vacío,
                con sus dos líneas divisorias pegadas). */}
            {llevaDeadline(t) ? <>
            <div>
              {/* ⚠️ EL TRIANGULITO NO SE DIBUJA SI SE REPITE, y ahora ni siquiera se puede:
                  el campo entero vive dentro de `llevaDeadline`. «Falta el deadline» sobre
                  algo que no puede tener uno titilaría para siempre, y una alarma permanente
                  es cómo se aprende a ignorar todas las demás. No le falta nada: no aplica. */}
              <label style={{ ...rowLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Deadline {!t.deadline && <WarnMark title="Falta el deadline" size={13} />}</label>
              <input type="date" value={t.deadline} onChange={(e) => board.setDeadline(t.id, e.target.value, t.deadline)} style={selStyle} />
              {/* ⛔ ACÁ SE PINTABA `deadlineRazon`, la frase con la que el Perro justifica la
                  fecha que propuso («Es el paso 2 y 5 del bucle de 5 pasos, y Mauricio lo
                  necesita para escalar»). Se fue el 23/09/2026: «eso no tiene sentido».
                  Y tenía razón — justificaba una fecha que ahora se cambia en el selector
                  sin pedirle permiso a nadie, así que era una explicación de una decisión
                  que ya no hay que discutir, ocupando tres renglones arriba del Quarter.
                  El dato NO se borró: sigue en la base, en el export («Por qué esa fecha»)
                  y en la API de MaKo. Lo que se sacó es el renglón. */}
              {/* ⛔ ACÁ VIVÍA «Cambiar la fecha», que abría el debate con el Perro. «No tiene
                  sentido el botón si dijimos que ya no hay fricción: solo el desplegable para
                  seleccionar fechas» (23/09/2026). El selector escribe directo, y la fecha la
                  sigue proponiendo el Perro al crear la tarjeta — que es cuando sirve. */}
            </div>
            {/* EL QUARTER ES OTRA COSA QUE EL DEADLINE, y por eso es otro campo.
                El deadline dice cuándo VENCE —lo propone el Perro y se le discute—;
                el Quarter dice cuándo decidiste HACERLO, y eso no lo decide nadie
                más que vos. Sin fecha todavía, el Quarter alcanza para que la tarea
                aparezca en «este Quarter» y no se caiga de todas las vistas. */}
            <div>
              <label style={rowLabel}>Quarter</label>
              <select
                value={t.quarter ?? ''}
                onChange={(e) => board.setQuarter(t.id, e.target.value, t.quarter ?? '')}
                style={selStyle}
              >
                <option value="">Sin asignar</option>
                {quartersElegibles(hoyISO(), 8, t.quarter).map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
              </select>
              {/* ⚠️ AVISA, NO CORRIGE. Que el deadline caiga en otro trimestre que el
                  planificado puede ser un error de tipeo o una decisión (una entrega de Q3
                  que se planificó para Q2). Quien sabe cuál de las dos es, es la persona;
                  lo único que el código puede afirmar es que no coinciden. */}
              {t.quarter && t.deadline && quarterDeFecha(t.deadline) !== t.quarter && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--warn, #B4762A)', lineHeight: 1.35, marginTop: 6 }}>
                  <WarnMark title="El Quarter y la fecha no coinciden" size={13} blink={false} />
                  <span>La fecha cae en el {quarterDeFecha(t.deadline).replace('-', ' ')}, no en el {t.quarter.replace('-', ' ')}.</span>
                </div>
              )}
            </div>
            </> : (
              /* LO TEMPORAL DE UNA RECURRENTE, en el lugar que dejaron los dos campos de
                 arriba. El valor entra por `recurrenciaDe` —la invariante del contrato— y
                 no por `t.recurrencia`: una fila vieja con las dos cosas cruzadas no puede
                 pintar una repetición acá (mig 0167). */
              <BloqueRepeticion
                valor={recurrenciaDe(t)}
                onCambiar={(v) => board.setRecurrencia(t.id, v)} />
            )}
            {/* ⚠️ DEPENDE DE, JUSTO ARRIBA DE PROYECTOS. Subió a esta columna el 25/09
                («debería estar como mínimo en el costado… es importante verlo de una forma
                rápida y no scrolleando todo desde abajo») y el mismo día se acomodó acá:
                «Depende de… arriba de proyecto». Arriba de todo se comía la primera pantalla
                con su buscador; acá queda al lado de lo otro que dice DÓNDE vive la tarea. */}
            {/* ── fin de grupo. Ver el porqué de los grupos en el comentario de arriba. */}
            <div aria-hidden style={{ height: 1, background: 'var(--border)' }} />
            <DependenciasBloque
              entidad="tarea" id={t.id} deps={board.deps}
              candidatos={board.tasks.filter((x) => x.id !== t.id).map((x) => ({
                id: x.id, titulo: `#${x.num} ${x.title}`,
                sub: x.labels.map((l) => board.labelById(l)?.name).filter(Boolean).join(' · '),
                terminado: x.progress >= 100,
              }))}
              onAdd={board.addDep} onDel={board.delDep} />
            <div>
              {/* ⚠️ EL LÁPIZ VA PEGADO AL RÓTULO, no al borde ni debajo del chip. Probado
                  en los dos lugares equivocados el mismo día: colgado del rótulo con un
                  `flex: 1` en el medio quedaba flotando contra el borde de la columna, y
                  metido en la fila de los chips se caía a un renglón propio —el chip ocupa
                  el ancho entero de la columna, así que el `flex-wrap` lo baja—. Acá es parte del
                  rótulo: se lee «PROYECTOS ✎», alineado con todo lo demás. */}
              <label style={{ ...rowLabel, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {board.repo.labelPlural}
                <LapizPrioridad tam={20} onClick={onAsignar} titulo={chips.length ? 'Cambiar de proyecto' : 'Asignar un proyecto'} />
              </label>
              {/* Los chips ya no se sacan con una × acá: cambiar de proyecto pasa por el
                  Perro Guardián (feedback #7). */}
              {/* Chips cuadrados y clickeables (feedback jul-19): mismo diseño que el header
                  (LabelChip), con ellipsis; al tocarlos abrís el proyecto (y volvés a la tarea). */}
              {/* ⚠️ EL LÁPIZ VA CON LOS CHIPS, no colgado del rótulo. Puesto arriba a la
                  derecha del rotulito quedaba flotando contra el borde, lejos de lo que
                  edita y alineado con nada — «mira el botón de editar dónde quedó»
                  (23/09/2026). Acá es el último elemento de la misma fila: se lee como
                  «editá esto». */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                {chips.length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>Sin proyecto</span>
                  : chips.map((l) => (
                    <button key={l.id} type="button" onClick={() => onOpenProj?.(l.id)} title={`Abrir «${l.name}»`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 200, fontSize: 11, fontWeight: 600, color: l.color, background: l.color + '1f', border: `1px solid ${l.color}59`, padding: '3px 8px', borderRadius: 6, cursor: onOpenProj ? 'pointer' : 'default', fontFamily: SANS, overflow: 'hidden' }}>
                      <span style={{ flex: 'none' }}>{l.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* ⚠️ EL CLIENTE VA PEGADO A PROYECTOS, y no arriba con la prioridad. Los dos
                contestan la misma pregunta —DÓNDE vive esta tarea, de qué cuelga y de quién
                es— y leerlos juntos es lo que permite ver de un vistazo que una tarea está
                en el proyecto de un cliente y asignada a otro. */}
            <CampoCliente cliente={clienteDe(t)} onAbrir={onAsignarCliente} />

            {/* ⛔ ACÁ VIVÍA EL ORIGEN, con su rótulo y su chip. Se fue al renglón del
                historial el 25/09/2026: «que el origen esté en el change history, tiene
                sentido que esté allí. Pero que se vea sin necesidad de desplegar». */}

            {/* LAS DOS ACCIONES QUE CIERRAN LA TARJETA. Ver `AccionIcono`. */}
            <div style={pieAcciones}>
              {/* ⚠️ EL BOTÓN QUE FALTABA. `MakoChecklistModal` estaba escrito, importado y
                  montado ahí abajo con `{mako && …}` — y `setMako(true)` no existía en
                  todo el repo: código muerto que compilaba, tipaba y no abría nada.
                  Es el caso exacto de «escribir la salida no es ofrecerla».

                  Y es OPT-IN, que es lo que lo hace compatible con la decisión del
                  dueño. El Perro dejó de cobrar peaje en el alta, en la prioridad y al
                  cambiar de proyecto: crear una tarea es un insert pelado. Esto es lo
                  contrario de aquella fricción — un botón que se aprieta cuando UNO
                  quiere que MaKo le dé una vuelta a una tarea escrita a las apuradas.

                  Texto y no caja: en un pie de tres acciones, una cajita más compite con
                  las dos que cierran la tarjeta, que son las que importan. */}
              <button type="button" onClick={() => setMako(true)} style={btnProfundizar}
                title={optimizada ? 'MaKo ya le dio una vuelta: prueba de nuevo con lo que sepas ahora' : 'MaKo te hace unas preguntas y te propone título, contexto y pasos'}>
                {optimizada ? 'Profundizar otra vez' : 'Profundizar'}
              </button>
              <AccionIcono onClick={() => board.toggleDone(t.id)} tono={t.progress >= 100 ? 'ok' : undefined}
                label={t.progress >= 100 ? 'Reabrir la tarea' : 'Marcar la tarea como completada'}>
                <CheckHecho done={t.progress >= 100} size={17} />
              </AccionIcono>
              <AccionIcono onClick={onDelete} tono="mal" label="Eliminar la tarea"><IconoTacho size={15} /></AccionIcono>
            </div>
          </div>
        </div>
      </div>
      {mako && <MakoChecklistModal title={t.title} detalle={t.detalle} yaOptimizada={optimizada} onApply={(r) => {
        if (r.titulo) board.setTitle(t.id, r.titulo, t.title);
        // Los PASOS entran como viñetas del detalle, no como checklist (se fueron el
        // 22/09/2026). `pasosComoBullets` no repite lo que ya está escrito.
        const base = r.detalle || t.detalle;
        const conPasos = pasosComoBullets(base, r.items);
        if (conPasos && conPasos !== t.detalle) board.setDetalle(t.id, conPasos, t.detalle);
      }} onClose={() => setMako(false)} />}
    </div>
  );
}

// ── change history para proyectos — con deshacer (solo la última entrada del usuario) ──
function HistList({ historial, nombre, avatarUrl, onUndo }: { historial: BoardTask['historial']; nombre: string; avatarUrl: string; onUndo?: (h: import('./types').Hist) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  // Sin tope de ningún tipo: renderizaba el historial entero, y los proyectos que pasaron
  // por varios scripts de reordenamiento tienen decenas de entradas.
  const { visibles, boton } = useVerMas(historial, { inicial: 8, tanda: 8, estilo: 'texto' });
  if (historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {visibles.map((h, i) => {
        const { esCreacion, porque } = partirCreacion(h.text, 'Creó el proyecto');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={24} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{autorDe(h.actor, nombre)}</strong> · {esCreacion ? frasePorAlta(h.actor, nombre, "o") : h.text}{esCreacion && porque && <span style={{ color: 'var(--dim)' }}> — {porque}</span>}</div>
              <div title={nowMs ? relTime(h.ts, nowMs) : ''} style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fechaHora(h.ts)}</div>
            </div>
            {/* solo el último cambio del usuario se puede deshacer (nunca los de MaKo) */}
            {i === 0 && h.undo && h.actor === 'user' && onUndo && <button onClick={() => onUndo(h)} title="Deshacer" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '3px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶</button>}
          </div>
        );
      })}
      {boton}
    </div>
  );
}

// ── change history de la TAB Proyectos: agrega los eventos de CADA proyecto
// (creación/rename/detalle/score…), NO los de tareas (esos viven en el detalle). ──
function ProjTabHist({ labels, nombre, avatarUrl }: { labels: Label[]; nombre: string; avatarUrl: string }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  // Es el historial de TODOS los proyectos junto: con 36 proyectos y hasta 40 entradas
  // cada uno, el `.slice(0, 40)` de antes seguía dejando una tira de 40 filas con avatar
  // y chip, y para llegar a lo que está debajo había que scrollear un rato largo. Ahora
  // se muestran las últimas 8 y el resto queda detrás de un botón que dice cuántas son.
  const todas = labels
    .flatMap((l) => l.historial.filter((h) => h.kind !== 'task').map((h) => ({ h, l })))
    .sort((a, b) => b.h.ts - a.h.ts)
    .slice(0, 200);
  const { visibles: rows, boton } = useVerMas(todas, { inicial: 10, tanda: 10, estilo: 'texto' });
  if (todas.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad de proyectos todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map(({ h, l }) => {
        const { esCreacion, porque } = partirCreacion(h.text, 'Creó el proyecto');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={24} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '1px 7px 1px 5px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color, marginRight: 6, verticalAlign: 'middle' }}>{l.emoji} {l.name}</span>
                <strong style={{ fontWeight: 600 }}>{autorDe(h.actor, nombre)}</strong> · {esCreacion ? frasePorAlta(h.actor, nombre, "o") : h.text}{esCreacion && porque && <span style={{ color: 'var(--dim)' }}> — {porque}</span>}
              </div>
              <div title={nowMs ? relTime(h.ts, nowMs) : ''} style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fechaHora(h.ts)}</div>
            </div>
          </div>
        );
      })}
      {boton}
    </div>
  );
}

// La card de proyecto (misma en la vista Proyectos y en el modal "MaKo cargó", así son
// IDÉNTICAS). `verDetalle` muestra descripción + razón del Perro (para el modal); en la
// grilla queda apagado (es para barrer de un vistazo).
export function ProyectoCardTile({ l, prog, isTop, verDetalle = false, onOpen, onAgarrar, onSoltarse, sinRanking = false, elegido = false, haySeleccion = false, onElegir }: {
  l: Label; prog: { total: number; done: number; pct: number; recurrentes?: number }; isTop: boolean; verDetalle?: boolean; onOpen: () => void;
  /** está seleccionado para una acción en lote */
  elegido?: boolean;
  /** hay algo seleccionado en la grilla: la casilla se queda a la vista aunque el mouse no
   *  esté encima (si no, tildar la segunda tarjeta obliga a adivinar dónde está la primera). */
  haySeleccion?: boolean;
  /** ⚠️ LA PROP **ES** LA CAPACIDAD (26/09/2026, «proyecto también debería poder tener
   *  selección múltiple»). Sin ella la tarjeta no dibuja la casilla, que es cómo se ve desde
   *  afuera que quien la monta no tiene barra de lote: el modal de «MaKo cargó» reusa esta
   *  misma tarjeta y ahí seleccionar no lleva a ningún lado. */
  onElegir?: (id: string) => void;
  /** ⚠️ EN LA VISTA «RECURRENTES» NO SE PINTAN NI EL PUNTAJE NI EL CHIP «Se repite», y no es
   *  cosmética: ahí TODAS se repiten, así que el chip es ruido en el 100% de las tarjetas, y
   *  el número es un ranking que la mig 0163 sacó — dejarlo a la vista invita a compararlo
   *  entre tarjetas que justamente no compiten. La TABLA de esa misma vista ya apagaba las
   *  dos con `sinRanking`; la tarjeta las seguía pintando, o sea que el mismo dato se mostraba
   *  o no según el interruptor del header. Mismo nombre que en `Tablas.tsx`. */
  sinRanking?: boolean;
  /** LA TARJETA SE PUEDE ARRASTRAR, y quien la monta dice si se puede: el tablero del
   *  CLIENTE no tiene con qué escribir una prioridad a mano, así que ahí no se dibuja el
   *  control (`repo.prioridadManual`). Sin esta prop, la tarjeta no es `draggable` — que es
   *  cómo se ve desde afuera que ese tablero no pasó la capacidad. */
  onAgarrar?: (nodo: HTMLElement, dx: number, dy: number) => void;
  onSoltarse?: () => void;
}) {
  const completo = prog.total > 0 && prog.done === prog.total;
  const arrastrable = !!onAgarrar;
  /** ⚠️ LA CASILLA APARECE AL PASAR EL MOUSE, o cuando ya hay algo elegido. Es la misma
   *  decisión que en la tarjeta de una tarea y por el mismo motivo: en una tabla una casilla
   *  en la primera columna se espera, en una tarjeta es un control más compitiendo con el
   *  emoji, el pid y el puntaje. Apareciendo al hover no le saca lugar a nada hasta que hace
   *  falta. El hook va ACÁ ARRIBA, antes de cualquier `return`. */
  const [hoverSel, setHoverSel] = useState(false);
  return (
    <div onClick={onOpen} data-projcard={arrastrable ? l.id : undefined} draggable={arrastrable}
      // ⚠️ MISMO MOLDE QUE EL KANBAN, no uno nuevo: foto vacía del sistema operativo + la
      // copia que monta `useArrastreCopia`. Y la tarjeta de origen NO cambia nada mientras
      // viaja («que la tarjeta no cambie nada», 24/09/2026): lo que se mueve es la copia y
      // lo que dice dónde va a caer es el hueco.
      onDragStart={arrastrable ? (e) => {
        e.dataTransfer.setData('text/plain', l.id);
        e.dataTransfer.effectAllowed = 'move';
        fotoVaciaDeArrastre(e.dataTransfer);
        const r = e.currentTarget.getBoundingClientRect();
        onAgarrar(e.currentTarget, e.clientX - r.left, e.clientY - r.top);
      } : undefined}
      onDragEnd={arrastrable ? () => onSoltarse?.() : undefined}
      // ⚠️ SELECCIONADO SE DICE CON EL FONDO Y EL BORDE, igual que la tarjeta de una tarea:
      // la casilla marcada sola es de 14 px en una tarjeta de 360 de alto, así que de un
      // vistazo no se ve cuántas hay elegidas.
      style={{ background: elegido ? 'var(--primary-bg)' : 'var(--surface)', border: `1px solid ${elegido ? 'var(--primary)' : isTop ? l.color + '80' : 'var(--border)'}`, borderTop: `3px solid ${l.color}`, borderRadius: 14, padding: '16px 16px 15px', cursor: arrastrable ? 'grab' : 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 360, width: '100%', minWidth: 0, position: 'relative', transition: 'border-color .12s, background .12s' }}
      onMouseEnter={(e) => { if (!elegido) e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.borderTopColor = l.color; setHoverSel(true); }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = elegido ? 'var(--primary)' : isTop ? l.color + '80' : 'var(--border)'; e.currentTarget.style.borderTopColor = l.color; setHoverSel(false); }}>
      {/* LA PORTADA (mig 0173), sangrando el padding para llegar a los bordes de la
          tarjeta. Se dibuja SÓLO si la eligieron: sin esto, todas las tarjetas nacerían con
          una banda de color que nadie pidió y la grilla pasaría de leerse por título a
          leerse por manchas. Es `aria-hidden` porque no dice nada que el título no diga. */}
      {/* ⚠️ LA BANDA VA SIEMPRE, y esto CAMBIÓ el 27/09/2026. Antes se dibujaba sólo si
          alguien había elegido una portada, con un porqué razonable: «sin esto todas
          las tarjetas nacerían con una banda de color que nadie pidió y la grilla
          pasaría de leerse por título a leerse por manchas». Lo que ese razonamiento
          no vio es que `null` NO significa «sin portada»: significa **el degradado
          derivado del nombre**, que es el default del modelo desde la mig 0173. O sea
          que la tarjeta no estaba evitando una mancha, estaba escondiendo su portada.
          Medido: de 71 proyectos, CERO tenían una elegida — así que la feature existía
          y no se veía en ninguna tarjeta. Y la card de un CLIENTE ya dibujaba su banda
          siempre: dos tarjetas hermanas con dos reglas distintas para el mismo campo. */}
      <div aria-hidden style={{ position: 'relative', margin: '-16px -16px 6px', height: 92 }}>
        <div style={{ height: '100%', borderRadius: '11px 11px 0 0',
          background: fondoPortada(l.portada, l.color, l.portadaY) }} />
        {/* ⚠️ EL ÍCONO CRUZA LA PORTADA, igual que en el detalle y en la ficha de un
            cliente — «que el emoji lo cruza, y el título acompaña». Acá va a 34 px y
            no a 54: es la MISMA anatomía a otra escala, no otra pieza. Y el renglón de
            abajo no cambia de alto, así que la tarjeta conserva su largo (360). */}
        <span style={{ position: 'absolute', left: 16, top: 75, borderRadius: 10, lineHeight: 0,
          boxShadow: '0 0 0 3px var(--surface)' }}>
          <Marca icono={l.icono} emoji={l.emoji} nombre={l.name} tam={34} color={l.color} cuadrado />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* ⛔ ACÁ ESTABAN EL EMOJI Y EL PID. El emoji se fue arriba a cruzar la banda
            —dibujarlo en los dos lados serían dos marcas de la misma cosa a 20 px—, y
            el pid se fue al detalle: «quita el ID, que queda feo allí, solo en el
            detail» (27/09/2026). En la grilla no sirve para nada, porque nadie busca
            un proyecto por su número mirando 70 tarjetas; en el detalle sí, que es
            donde se lo copia para nombrarlo en otro lado. */}
        <span style={{ flex: 1 }} />
        {completo && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--good)', background: 'var(--good-bg, var(--surface))', border: '1px solid var(--good)', borderRadius: 6, padding: '1px 6px' }}>✓ Completo</span>}
        {/* ⚠️ «Se repite», SÓLO EL ÍCONO, igual que en la tarjeta de una tarea y por el mismo
            motivo: en la grilla de Proyectos un proyecto recurrente cae MEZCLADO con los que
            compiten, y sin el chip su renglón sin fecha se lee como un proyecto al que se le
            perdieron los datos. El texto no se pierde: va en el `title` y en el `aria-label`. */}
        {esRecurrente(l) && !sinRanking && <RepiteChip soloIcono />}
        {!sinRanking && <ProjScore score={l.score} color={l.color} />}
      </div>
      {/* ⚠️ LA CASILLA VA ANTES DEL TÍTULO, igual que en la tarjeta de una tarea («que
          no esté en la portada, que aparezca antes del título, como lo hace en las
          tareas», 27/09/2026). Estuvo en dos lugares malos antes de éste, y los dos
          por la misma causa: el ícono que cruza la banda baja hasta DENTRO del renglón
          del pid, así que ahí tapaba la casilla; y sobre la portada, una casilla de
          navegador es casi blanca y sobre una foto clara desaparece —por eso había
          terminado con un velo, que es el olor de un control puesto donde no va—.
          El renglón del título arranca debajo del ícono y no choca con nada.
          `stopPropagation` porque la tarjeta entera abre el detalle: sin eso, tildar
          un proyecto lo abriría encima de la grilla. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        {onElegir && (hoverSel || haySeleccion) && (
          <input type="checkbox" checked={elegido} onClick={(e) => e.stopPropagation()} onChange={() => onElegir(l.id)}
            title="Seleccionar" aria-label={`Seleccionar «${l.name}»`}
            style={{ width: 14, height: 14, flex: 'none', cursor: 'pointer', accentColor: 'var(--primary)',
              // Alineada con la primera línea del título, no con el centro del bloque:
              // con un título de dos renglones, centrada queda flotando al medio.
              margin: '3px 0 0' }} />
        )}
        <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, minWidth: 0 }}>{l.name}</span>
      </div>
      {isTop && <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: l.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>}
      {verDetalle && l.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{stripHtml(l.detalle)}</div>}
      {verDetalle && l.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.45 }}>🐕 {l.scoreRazon}</div>}
      <span style={{ flex: 1 }} />
      {/* EL DEADLINE, EN LA PREVIEW. «Aún no sale el deadline en la preview de las cards de
          los proyectos» (23/09/2026). Estaba sólo en la tabla y en el detalle, así que la
          vista por defecto —la de tarjetas— era la única que no decía para cuándo es. Va con
          el plazo al lado y no sólo la fecha: «12 oct» no dice si ya se venció. */}
      {/* ⚠️ Y NO SE DIBUJA SI SE REPITE, aunque la fila todavía traiga una fecha vieja:
          `llevaDeadline` es la misma regla que el mapper del server y que el detalle. Una
          fecha de fin sobre algo que no termina es el dato que la vista viene a no decir. */}
      {/* ⚠️ Y SI SE REPITE, EL RITMO EN SU LUGAR. Mismo renglón, misma pieza y mismo motivo
          que en la tarjeta de una tarea: es lo temporal de la tarjeta, y en un proyecto que
          se repite eso es «cada cuánto», no «para cuándo». La condición es `llevaDeadline`
          en las dos ramas —la regla del contrato— y no un `!esRecurrente` escrito acá. */}
      {llevaDeadline(l)
        ? l.deadline && <LineaDeadline iso={l.deadline} hoy={hoyISO()} hecho={completo} />
        : <LineaRepeticion de={l} />}
      {prog.total > 0 && <span style={{ display: 'block' }}><MiniBar v={prog.pct} /></span>}
      {/* ⚠️ «SIN TAREAS» ES UNA AFIRMACIÓN, Y SOBRE UN PROYECTO DE PURAS RECURRENTES ES
          FALSA. `projProgress` saca las recurrentes del porcentaje —una tarea que no
          termina nunca dejaría el avance clavado en 0 para siempre—, así que un cliente al
          que se le atiende todas las semanas cae en `total: 0` y esta línea decía «sin
          tareas · 0%» sobre el proyecto más activo del tablero. No tiene trabajo QUE SE
          PUEDA CERRAR, que es otra cosa: se dice lo que sí tiene. */}
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>
        {prog.total
          ? <><span>{prog.done}/{prog.total}</span><span style={{ flex: 1 }} /><span style={{ fontWeight: 700, color: 'var(--dim)' }}>{prog.pct}%</span></>
          : prog.recurrentes
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconoRepite size={11} /> en marcha · {prog.recurrentes} se {prog.recurrentes === 1 ? 'repite' : 'repiten'}</span>
            : <span>sin tareas</span>}
      </div>
    </div>
  );
}

/**
 * El historial de la tab de proyectos, PLEGADO.
 *
 * «Revisa la captura de "Change history · proyectos": tiene mucho protagonismo en la tab de
 * proyecto» (23/09/2026). Y lo tenía: abierto y a ancho completo debajo de las tarjetas, con
 * diez renglones de «fijaste la prioridad / se la devolviste» que son el rastro de UNA
 * sesión de ajustes, no lo que alguien viene a ver cuando abre sus proyectos.
 *
 * No se borra —es la bitácora de quién movió qué, y sin ella un número que cambió solo no se
 * puede explicar—: se pliega, con el conteo a la vista para que se sepa que está.
 */
function HistorialDeLaTab({ labels, board }: { labels: Label[]; board: Board }) {
  const n = labels.reduce((acc, l) => acc + (l.historial?.length ?? 0), 0);
  if (!n) return null;
  return (
    <details className="mk-det" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <summary style={{ userSelect: 'none', fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>
        Historial · {n} cambio{n === 1 ? '' : 's'}
      </summary>
      <div style={{ marginTop: 12 }}>
        <ProjTabHist labels={labels} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} />
      </div>
    </details>
  );
}

/**
 * El comparador del tablero. UNO para las cuatro formas de ordenar y para las dos entidades.
 *
 * `dir` es -1 para descendente (lo más alto primero) y +1 para ascendente. El desempate
 * siempre es el score: con 334 tarjetas, dos que caen el mismo día tienen que salir en un
 * orden estable y que signifique algo.
 */
/**
 * Cuándo NACIÓ un proyecto. Sale de su historial porque es el único rastro que tiene:
 * `created_at` no viaja al modelo. Sin historial da 0, o sea «el más viejo».
 */
const creTsLabel = (l: Label) => (l.historial?.length ? Math.min(...l.historial.map((h) => h.ts)) : 0);

function comparar(modo: OrdenModo, dir: number) {
  return (a: { score: number; titulo: string; deadline: string; creado: number }, b: { score: number; titulo: string; deadline: string; creado: number }): number => {
    if (modo === 'az') return dir * a.titulo.localeCompare(b.titulo, 'es') || b.score - a.score;
    if (modo === 'creacion') return dir * (a.creado - b.creado) || b.score - a.score;
    if (modo === 'deadline') {
      // Sin fecha, al final SIEMPRE — no es «la más lejana», es una que no contestó.
      if (!a.deadline && !b.deadline) return b.score - a.score;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return dir * a.deadline.localeCompare(b.deadline) || b.score - a.score;
    }
    return dir * (a.score - b.score) || b.score - a.score;
  };
}

/**
 * EL INTERRUPTOR «Se repite», en el detalle de una TAREA y en el de un PROYECTO.
 *
 * Es la ÚNICA puerta del producto para poner la marca, y por eso está donde la persona ya
 * está mirando la tarjeta entera: acá el cambio se explica solo —aparece el chip en el
 * header, el deadline y el Quarter DESAPARECEN de esta misma columna, la tarjeta se va del
 * Kanban— en vez de ser una casilla que hace desaparecer algo de otra pantalla.
 *
 * ⚠️ UNO SOLO PARA LAS DOS ENTIDADES (26/09/2026, «un proyecto también se puede repetir»).
 * Lo único que cambia es el rótulo y a quién se le escribe, así que lo que entra por prop es
 * eso y nada más. Un gemelo copiado diverge a la primera corrección —y acá la corrección ya
 * llegó dos veces sobre el mismo control—, que es justo lo que este repo paga cada vez.
 *
 * ⚠️ EL RÓTULO ES «Tarea recurrente», no una pregunta. Fue «¿Se repite para siempre?» y lo
 * cambió Martín el 26/09/2026: *«en lugar de "¿Se repite para siempre?" solo "Tarea
 * recurrente"»*. Un campo de una columna de campos se nombra, no se interroga.
 *
 * ⚠️ Y NO LLEVA `title`. El que había narraba el efecto («sale del ranking y pasa a la vista
 * Recurrentes») y era la última glosa que quedaba viva de este bloque: desde que los dos
 * campos de fecha se VAN al marcarlo, el efecto está en la pantalla y el tooltip lo repetía.
 * «No pongas texto innecesario nunca» (26/09/2026) — y un tooltip es texto.
 *
 * ⚠️ ES UN `role="switch"`, NO UN CHECKBOX: prende y apaga un estado que ya existe, no
 * elige un valor de un formulario. Y lleva su estado adentro (`Se repite` / `No se
 * repite`), porque un interruptor sin estado escrito se lee al revés la mitad de las veces.
 */
function BloqueRecurrente({ rotulo, repite, onCambiar }: {
  /** «Tarea recurrente», o el singular del tablero + « recurrente» para un proyecto. */
  rotulo: string;
  repite: boolean;
  /** `board.setRecurrente` para una tarea · `board.setLabelRecurrente` para un proyecto. */
  onCambiar: (v: boolean) => void;
}) {
  return (
    <div>
      <label style={rowLabel}>{rotulo}</label>
      <button type="button" role="switch" aria-checked={repite} aria-label={rotulo}
        onClick={() => onCambiar(!repite)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
          border: `1px solid ${repite ? 'var(--primary-weak)' : 'var(--border-strong)'}`,
          background: repite ? 'var(--primary-bg)' : 'var(--surface)',
          color: repite ? 'var(--primary)' : 'var(--dim)',
          borderRadius: 9, padding: '7px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
        <IconoRepite size={14} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repite ? ROTULO_RECURRENTE : 'No se repite'}</span>
        {/* La perilla. `aria-hidden` porque el estado ya viaja en `aria-checked` y en el
            texto de al lado: anunciarlo tres veces es ruido para un lector de pantalla. */}
        <span aria-hidden style={{ flex: 'none', width: 30, height: 17, borderRadius: 999, background: repite ? 'var(--primary)' : 'var(--border-strong)', display: 'inline-flex', alignItems: 'center', padding: 2, transition: 'background .12s' }}>
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#fff', transform: repite ? 'translateX(13px)' : 'translateX(0)', transition: 'transform .12s' }} />
        </span>
      </button>
      {/* ⛔ ACÁ HABÍA UNA GLOSA DE DOS RENGLONES bajo el interruptor, y se fue: «saca el
          texto innecesario» / «no pongas texto innecesario nunca» (25-26/09/2026). Explicaba
          cuándo marcar una tarea y qué pasaba al marcarla — las dos cosas se contestan
          antes: el rótulo dice qué es, y el efecto se VE (la tarjeta pierde el deadline y el
          quarter en el acto y se va de la vista). Un cartel que narra lo que la pantalla ya
          está haciendo es el ruido que este tablero viene sacando hace tres tandas. */}
    </div>
  );
}


/**
 * EL DESPLEGABLE DE LA REPETICIÓN, EN EL LUGAR QUE DEJARON VACÍO EL DEADLINE Y EL QUARTER.
 *
 * «El tema de la frecuencia, copialo tal cual como lo hace Google Calendar… porque puede
 * ser personalizado, varios días de la semana, etc. Pero más simple, investiga y copialo
 * tal cual» (26/09/2026).
 *
 * Es el desplegable de Google: sus presets, y «Personalizado…» al final abriendo el
 * diálogo. La lista sale de `opcionesRepeticion` —la MISMA que usa la barra de lote— y no
 * de una escrita acá: dos listas es cómo se agrega un preset en una y no en la otra.
 *
 * ⚠️ VA EXACTAMENTE DONDE ESTABAN LOS DOS CAMPOS QUE SE FUERON, y de ahí sale el sentido:
 * ese renglón de la columna derecha es el que contesta «¿cuándo?». Una recurrente lo
 * contesta con un RITMO en vez de con una fecha, así que la pregunta no desaparece: cambia
 * de forma. Y es la razón por la que el interruptor está arriba: leído en orden dice «esta
 * tarea se repite → por eso lo temporal es cada cuánto».
 *
 * ⚠️ Y ASÍ EL GRUPO NUNCA QUEDA VACÍO. La sidebar son cuatro grupos separados por una
 * línea; este grupo tenía exactamente dos hijos (Deadline y Quarter) y los dos se van al
 * marcar. Sin algo que ocupe su lugar, marcar «se repite» dejaba el grupo con el
 * interruptor solo entre dos divisorias — y en el detalle del proyecto, directamente con
 * las dos líneas pegadas. Por eso esto es el `else` de `llevaDeadline` y no un bloque más:
 * son la misma pregunta con dos respuestas, nunca las dos a la vez.
 *
 * ⚠️ NO SE PARECE A UNA FECHA. Sin calendario, sin tinte por proximidad, sin titileo y sin
 * el aviso de «falta el deadline». Un deadline LLEGA, pasa y deja la tarjeta vencida; un
 * ritmo no vence nunca, y el día que se dibuje como una fecha vuelve el motor de
 * vencimientos avisando que «la junta semanal está atrasada», que es justo lo que las
 * migraciones 0163 y 0164 vinieron a sacar.
 *
 * ⚠️ SIN GLOSA DEBAJO Y SIN `title`. El rótulo es el NOMBRE del campo y las opciones se
 * explican solas («Todos los días», «Cada semana»): cualquier renglón extra acá narra lo
 * que la pantalla ya dice («no pongas texto innecesario nunca», 26/09/2026).
 *
 * ⚠️ ES **UN** CONTROL Y NO DOS, Y ÉSE ES EL CAMBIO DE LA 0167. Eran dos selectores
 * —«Frecuencia» y «Día»— que sólo sabían decir un ritmo de una lista cerrada y UN día; el
 * pedido («varios días de la semana», «cada 3 semanas», «el segundo martes») no entra en
 * ese modelo por más selectores que se le agreguen. Con una RRULE, lo común son dos clicks
 * en el desplegable y lo raro vive adentro del diálogo, que es exactamente el reparto de
 * Google.
 *
 * ⚠️ EL VALOR SIEMPRE ESTÁ ENTRE LAS OPCIONES, y eso no es suerte: cuando la repetición
 * guardada no coincide con ningún preset, `opcionesRepeticion` la agrega como una opción
 * más con su frase. Sin eso, elegir «cada 3 semanas» y volver a abrir mostraría «Cada
 * semana» sobre una tarjeta que se repite cada tres — y el primer click la escribiría, que
 * es el `<select>` cuyo `value` no está entre sus `<option>` que este tablero ya pagó con
 * los trimestres.
 */
function BloqueRepeticion({ valor, onCambiar }: {
  /** la RRULE guardada. Entra por `recurrenciaDe` —la invariante del contrato—, así que
   *  una fila vieja con `recurrente: false` y una regla viva no puede pintar nada acá. */
  valor: string | null;
  /** `board.setRecurrencia` para una tarea · `board.setLabelRecurrencia` para un proyecto.
   *  `null` = «se repite y nadie dijo cada cuánto», que es un estado real del contrato. */
  onCambiar: (v: string | null) => void;
}) {
  /**
   * ⚠️ EL DIÁLOGO ES ESTADO DE ESTE BLOQUE Y NO DEL MODAL QUE LO CONTIENE, y por eso los
   * dos detalles —el de una tarea y el de un proyecto— lo heredan sin cablear nada. Un
   * `abierto` izado al padre serían dos estados que hay que acordarse de pasar, y el que se
   * olvide deja el «Personalizado…» de ESE detalle sin abrir nada.
   */
  const [custom, setCustom] = useState(false);
  const actual = canonRRule(valor);
  /** UNA sola lista: la misma que dibuja las opciones y de la que sale el `title`. Sacar el
   *  texto del valor actual por otro camino sería la segunda traducción de siempre. */
  const opciones = opcionesRepeticion(valor);
  return (
    <div>
      {/* UN solo rótulo porque ahora es UN solo campo. Eran dos («Frecuencia» y «Día»)
          cuando eran dos selectores. */}
      <label style={rowLabel}>{ROTULO_REPETICION}</label>
      {/* ⚠️ EL `Dropdown` DE LA CASA Y NO UN `<select>` NATIVO. La regla está escrita con
          todas las letras en `app/_ui/Select.tsx`: «NUNCA uses <select> nativo: no se puede
          estilar igual en los distintos navegadores y rompe la coherencia de la app». Este
          campo nació con uno y se notaba — era el único control de la columna que se veía
          del sistema operativo y no del producto.
          Y de paso arregla lo que el nativo no podía: el conjunto de valores es ABIERTO
          («Cada semana, los lunes, martes, miércoles, jueves y viernes» pide ~384 px sobre
          los 228 de esta columna), así que el nativo recortaba la frase con un `title` como
          único consuelo. El menú del `Dropdown` vive en un PORTAL, así que ahí la frase
          entra entera aunque el botón la recorte.
          El ícono es el mismo `IconoRepite` de la tarjeta y de la vista: un control que
          significa lo mismo se ve igual en todos lados. */}
      <Dropdown
        value={actual}
        ariaLabel={ROTULO_REPETICION}
        icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoRepite size={13} /></span>}
        placeholder={opciones.find((o) => o.value === actual)?.label ?? ''}
        options={opciones.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => {
          // ⚠️ EL CENTINELA NO SE GUARDA NUNCA: abre el diálogo y sale. El control es
          // CONTROLADO, así que en el próximo render vuelve al valor de antes — abandonar el
          // diálogo no lo deja diciendo «Personalizado…» sobre una tarjeta que no cambió.
          if (v === VALOR_PERSONALIZADO) { setCustom(true); return; }
          if (v !== actual) onCambiar(v || null);
        }} />
      {/* EL DIÁLOGO «PERSONALIZADO», el MISMO que abre la barra de lote: la pieza devuelve
          una RRULE y no sabe a quién se le aplica, que es lo que la vuelve compartible.
          Se abre con lo que la tarjeta tiene hoy, para no hacerle empezar de cero a quien
          sólo quería cambiarle el intervalo. */}
      {custom && (
        <RepeticionModal
          valor={valor}
          onGuardar={(rrule) => { if (rrule !== actual) onCambiar(rrule); }}
          onCerrar={() => setCustom(false)} />
      )}
    </div>
  );
}


/**
 * ── VISTA RECURRENTES ────────────────────────────────────────────────────────────────
 *
 * Las tareas que se repiten para siempre: la reunión de los miércoles, el seguimiento
 * diario. El criterio es de Mauricio (16/07/2026): *«acá lo que entran son tareas que
 * tienen un inicio y tienen un fin»*, y lo que delata a una recurrente es que **al
 * cerrarla hay que volver a crearla**.
 *
 * ⚠️ LA VISTA ES LA CONSECUENCIA, NO LA CAUSA. Lo que hacía falta no era poder verlas
 * juntas: era que dejaran de ensuciar el ranking. El Perro puntúa por «qué mueve la aguja»
 * y le pone deadline a todo lo que no tiene; algo sin fin no puede tener ni score ni fecha,
 * así que competía por un puesto que no le corresponde y encima hundía el avance del plan.
 * Sacarlas deja un agujero —trabajo real que ya no se ve en ningún lado— y esta pantalla es
 * el lugar donde ese trabajo sigue existiendo.
 *
 * Cuatro decisiones de diseño, y las cuatro son la misma:
 *
 *  1. **TARJETAS POR DEFECTO, y respeta el interruptor del header** (`tabla`). «Siempre la
 *     vista tipo tarjetas, es lo que venimos haciendo» (26/09/2026). Antes montaba
 *     `TablaTareas` SIEMPRE y ni siquiera recibía la preferencia: era la única vista del
 *     tablero donde elegir cómo mirar no existía.
 *  2. **Son las MISMAS piezas de siempre** —`CardTile`, `ProyectoCardTile`, `TablaTareas`,
 *     `TablaProyectos`—, no moldes nuevos. Dos pantallas que muestran lo mismo se ven igual,
 *     y una segunda tarjeta diverge a la primera corrección (el tinte del deadline, el
 *     plegado de lo completado, la barra de selección). Lo único que cambia es una prop.
 *  3. **Sin columna de prioridad y sin columna de deadline** (`sinRanking`, en las dos
 *     tablas). La tabla de siempre mentiría dos veces por fila: un score que no ordena nada
 *     y una fecha de fin de algo que no termina.
 *  4. **Sin progreso en el header y sin chip «Se repite» en las filas.** Acá todo lo es, así
 *     que el chip no distinguiría nada; y el único número que significa algo —cuántas son—
 *     se dice acá arriba, en vez de disfrazado de porcentaje.
 *
 * ── POR QUÉ SE AGRUPA POR ENTIDAD (proyectos arriba, tareas abajo) ───────────────────
 *
 * «La vista muestra TAMBIÉN los proyectos recurrentes, separados de las tareas» (26/09/2026),
 * y el corte es por ENTIDAD y no por proyecto→sus tareas, que era la otra opción obvia.
 * Tres razones, y la tercera es la que decide:
 *
 *  · Una tarea recurrente casi nunca cuelga de un proyecto recurrente. «Seguimiento diario a
 *    los leads» vive en el proyecto del CRM, que tiene inicio y fin. Anidar dejaría a casi
 *    todas las tareas en un cajón «sin proyecto que se repita», que es una jerarquía que no
 *    agrupa nada.
 *  · Son dos cosas con dos formas distintas de mirarse: un proyecto se mira por lo que tiene
 *    adentro, una tarea por lo que hay que hacer. Sus tarjetas ya son distintas.
 *  · Y sobre todo: **anidar HARÍA DESAPARECER las tareas CON FIN que viven adentro de un
 *    proyecto recurrente.** Esas tareas no son recurrentes —compiten, tienen deadline y
 *    siguen en el Kanban—, así que meterlas acá adentro las contaría dos veces, y dejarlas
 *    afuera de un árbol que promete «el proyecto y lo suyo» las borraría sin decirlo. Con el
 *    corte por entidad no hay promesa que romper: la tarjeta del proyecto sigue diciendo su
 *    `N/M · %`, que ES la cuenta de lo que tiene adentro con fecha de fin, y el lugar donde
 *    esas tareas se trabajan sigue siendo el mismo de siempre.
 *
 * ⚠️ Y NO HAY BOTÓN DE «NUEVA RECURRENTE». Una recurrente no es una entidad aparte: es una
 * tarea —o un proyecto— marcado, y la marca se pone en su detalle. Un botón acá tendría que
 * abrir el alta normal y dejar la marca sin poner —o sea, crear algo que no aparece en esta
 * vista después de haberlo creado desde esta vista—, que es peor que no tenerlo. El estado
 * vacío dice dónde está el interruptor.
 */
function RecurrentesView({ tareas, proyectos, board, topProjectId, tabla, onOpen, onOpenProj, onEliminar, onSoltarTarea, onSoltarProy, ask }: {
  tareas: BoardTask[];
  /** los PROYECTOS que se repiten (mig 0164). Salen del mismo predicado que las tareas. */
  proyectos: Label[];
  /** ⚠️ «En la tab de recurrente debe funcionar igual TODO» (26/09/2026). Las TARJETAS ya se
   *  arrastraban y las TABLAS no: se montaban sin `onSoltar`, así que el mismo gesto andaba
   *  o no según el interruptor del header — que es la peor forma de que algo esté a medias,
   *  porque parece roto sólo a veces. Van los dos niveles. */
  onSoltarTarea?: (id: string, sugerido: number) => void;
  onSoltarProy?: (id: string, sugerido: number) => void;
  board: Board; topProjectId: string | null;
  /** el interruptor tarjetas/tabla del header. `false` = tarjetas, que es el default. */
  tabla: boolean;
  onOpen: (id: string) => void; onOpenProj: (id: string) => void;
  /** abre la pregunta de dos botones. Sin esto la fila no dibuja el tacho. */
  onEliminar: (id: string) => void;
  ask: (msg: string, onOk: () => void) => void;
}) {
  const n = tareas.length + proyectos.length;
  // El mismo `prog` que arma la vista Proyectos, con la misma función: `projProgress` ya
  // saca las recurrentes del porcentaje, así que el `N/M` de la tarjeta es exactamente la
  // cuenta de lo que ese proyecto tiene adentro CON fecha de fin (ver el porqué de arriba).
  const filasProy = proyectos.map((l) => ({ l, prog: projProgress(board.tasks, l.id) }));
  // ⚠️ EL ANCHO SALE DE LA FORMA, no de la vista: los mismos dos números que usa la tab
  // Proyectos (860 para tarjetas, 1180 para tabla). Copiar otro número acá es cómo la
  // columna del Kanban terminó midiendo 264 de un lado y 236 del otro.
  const ancho = tabla ? 1180 : 860;
  /**
   * ⚠️ TODOS LOS HOOKS ARRIBA DE CUALQUIER `return`. Esta vista tiene dos salidas —el vacío
   * y la lista— y un hook detrás de una de ellas es el «Minified React error #300»: la
   * pantalla entera en blanco, sin archivo ni línea.
   *
   * ── EL ARRASTRE DE ESTA VISTA: QUÉ HACE, POR QUÉ, Y QUÉ NO PUEDE HACER ──────────────
   *
   * «En la tab de recurrente debe funcionar igual todo. Es decir, también debo poder
   * arrastrar las tarjetas» (26/09/2026).
   *
   * **LO QUE HACE: soltar una tarjeta le cambia el RITMO.** El molde es el mismo de siempre
   * —`useArrastreCopia`, el medido a lo largo de siete rondas: foto vacía del sistema
   * operativo, una copia nuestra que sigue al cursor, y al nodo origen no se le toca nada—.
   * Lo único distinto es el DESTINO: mientras hay una tarjeta en la mano aparece la escalera
   * de repeticiones abajo de la pantalla, y soltar en uno escribe `recurrencia`.
   *
   * **POR QUÉ ÉSE Y NO OTRO.** En el Kanban el destino es una banda de PRIORIDAD y en la
   * grilla de Proyectos es una POSICIÓN en el ranking; las dos cosas son el ranking del que
   * la migración 0163 sacó a las recurrentes a propósito. Acá lo único temporal que una
   * recurrente puede contestar es cada cuánto se repite, así que ése es el único destino que
   * la posición puede significar sin mentir.
   *
   * **LO QUE NO PUEDE HACER, Y ES LA MITAD IMPORTANTE:**
   *  · **No abre el pop-up del 1 al 100 y no escribe `score`.** Una recurrente CONSERVA su
   *    score —marcarla no se lo baja, a propósito— y encima la tarjeta lo muestra, así que un
   *    arrastre que lo moviera sería un ranking reinstalado a la vista: el bug exacto que
   *    esta feature vino a arreglar. Y de yapa ese pop-up escribe `score_manual`, el candado
   *    que el Perro ya no puede tocar — un número clavado a mano para ordenar una lista que
   *    no se ordena por ese número.
   *  · **No reordena.** No hay ninguna columna donde guardar un orden propio de esta vista, y
   *    un orden que se pierde en el próximo F5 es un gesto que miente. Lo único que se
   *    guarda es el ritmo, que es un dato del negocio y no una preferencia de quien mira.
   *  · **No arrastra FILAS.** En la tabla el ritmo ya tiene su columna y se lee de un
   *    vistazo; la marca de destino de `useArrastreFilas` es una línea de 2px que no puede
   *    decir a qué ritmo vas a caer, y lo único que la posición entre dos filas sabe proponer
   *    es un score. Así que la tabla no ofrece el gesto, en vez de ofrecer uno que contesta
   *    justo lo que no hay que contestar.
   *
   * ⚠️ LA ESCALERA ES FIJA A LA VENTANA, Y POR ESO ACÁ NO HAY AUTO-SCROLL. Con los destinos
   * pegados al borde de abajo no hay a dónde ir: `empujarScroll` existe para cuando el
   * destino está fuera de la vista (la columna del Kanban mide 19.000px de alto), y usarlo
   * acá sería mover la página debajo de una tarjeta que ya tiene su destino a la vista.
   *
   * ⚠️ Y SÓLO APARECE CON UNA TARJETA EN LA MANO. Dibujada siempre sería un control más en
   * una pantalla que ya tiene buscador, filtro e interruptor de vista, contestando una
   * pregunta que el detalle ya contesta.
   */
  const { montarCopia, soltarCopia } = useArrastreCopia();
  const [enMano, setEnMano] = useState<{ id: string; tipo: 'tarea' | 'proyecto'; r: string } | null>(null);
  const soltar = () => { setEnMano(null); soltarCopia(); };
  /**
   * DOS SELECCIONES, UNA POR GRUPO, Y NO UNA SOLA COMPARTIDA. Es la vista donde poner el
   * ritmo a varias de una sirve de verdad —acá TODO se repite— y es también la única con dos
   * entidades en pantalla. Una selección mixta obligaría a una barra que ofrece lo que sólo
   * la mitad puede cumplir, que es exactamente el control que este tablero no pinta: un
   * proyecto no se completa ni se mueve a un proyecto. Con una selección por grupo, cada
   * barra ofrece lo que su entidad SÍ puede y aparece pegada a lo que va a cambiar.
   *
   * ⚠️ Las TABLAS de esta vista traen su propia selección adentro (`TablaTareas` y
   * `TablaProyectos`), así que esto es sólo para las TARJETAS — que es el default de la
   * vista. No hay dos selecciones compitiendo: el interruptor del header dibuja una forma o
   * la otra, nunca las dos.
   */
  const [selTareas, setSelTareas] = useState<ReadonlySet<string>>(new Set());
  const [selProy, setSelProy] = useState<ReadonlySet<string>>(new Set());
  const alternarTarea = (id: string) => setSelTareas((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarProy = (id: string) => setSelProy((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /**
   * ⚠️ EL VALOR SE LEE ANTES DE LIMPIAR. `soltar()` vacía `enMano`, así que hacerlo primero
   * deja al `if` de abajo mirando `null` y la repetición no se escribe nunca — el gesto se
   * ve perfecto y no guarda nada, que es el modo de falla más caro de este tablero.
   *
   * ⚠️ Y SOLTAR EN LA QUE YA TENÍA NO ESCRIBE. Sin esa guarda, cada arrastre del que
   * alguien se arrepiente deja una entrada en el historial y un toast de deshacer sobre un
   * cambio que no cambió nada. La comparación es entre formas CANÓNICAS —las dos puntas
   * pasan por `canonRRule`— porque `FREQ=WEEKLY` y `FREQ=WEEKLY;INTERVAL=1` son la misma
   * repetición escrita de dos maneras, y comparar los strings crudos haría que soltar en el
   * chip donde ya estás parado escribiera igual.
   */
  const ponerRepeticion = (rrule: string) => {
    const q = enMano;
    soltar();
    if (!q || q.r === rrule) return;
    if (q.tipo === 'tarea') board.setRecurrencia(q.id, rrule || null);
    else board.setLabelRecurrencia(q.id, rrule || null);
  };
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div style={{ width: '100%', maxWidth: ancho, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ⛔ ACÁ HABÍA UNA CABECERA CON EL BUCLE Y LA PALABRA «Se repite», Y SE FUE:
            «Elimina el "Se repite" de titulo» (26/09/2026). Estaba debajo de una tab que ya
            se llama «Recurrentes», o sea que era el nombre de la pantalla escrito dos veces
            con dos palabras distintas — que es peor que repetirlo: obliga a decidir si son
            la misma cosa.

            ⚠️ EL CONTADOR NO SE FUE CON ELLA: BAJÓ AL RÓTULO DE CADA GRUPO. El número era lo
            único que la cabecera decía y que no se veía en ningún otro lado, y borrarlo junto
            con el título habría sido tirar el dato con el ruido. Abajo dice «Proyectos · 3» y
            «Tareas · 7», que además es MÁS de lo que decía el total: las dos entidades se
            cuentan por separado, que es como se miran. */}
        {n === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--faint)', textAlign: 'center', padding: '34px 20px', border: '1px dashed var(--border-strong)', borderRadius: 14 }}>
            {/* ⚠️ NACE VACÍA Y ESTÁ BIEN. No se puede rellenar buscando «semanal» o «diaria»
                en los títulos: lo que eso encuentra es «Diseñar la estructura de la junta
                semanal» o «Implementar la cadencia de juntas», que son tareas CON FIN que
                montan un ritual — exactamente lo contrario de lo que esta vista busca. La
                marca la pone una persona, o la extracción de una reunión. */}
            <IconoRepite size={22} />
            {/* UNA línea. Un vacío tiene que decir qué falta, y eso es una frase: la segunda
                —dónde está el interruptor— era un manual, y el que abre una tarjeta lo ve. */}
            <div style={{ fontSize: 13.5, color: 'var(--dim)', maxWidth: 460, lineHeight: 1.55 }}>
              Nada se repite todavía. Se marca desde el detalle de una tarea o de un proyecto.
            </div>
          </div>
        ) : (
          <>
            {/* ⚠️ UN GRUPO NO SE DIBUJA SI ESTÁ VACÍO. Un rótulo «Proyectos» sobre la nada es
                un hueco que se lee como un dato que no cargó.
                ⚠️ Y AHORA SU RÓTULO VA SIEMPRE, haya uno o dos grupos. Antes se escondía con
                un solo grupo a la vista —no separaba de nada, y eso sigue siendo cierto—,
                pero desde que la cabecera se fue es además el ÚNICO lugar donde se dice
                cuántas son. Es lo mismo que pasa con el progreso al plegarse el header: un
                dato que desaparece porque su envase se fue es esconder sin pista. */}
            {filasProy.length > 0 && (
              <GrupoRecurrente rotulo={board.repo.labelPlural} n={filasProy.length}>
                {tabla
                  /* La MISMA selección que las tarjetas de este grupo: el comentario de
                     arriba decía que esto era «sólo para las TARJETAS» porque la tabla
                     traía la suya adentro. Desde el 04/10/2026 ya no. */
                  ? <TablaProyectos filas={filasProy} board={board} topProjectId={topProjectId} hoy={hoyISO()} labelPlural={board.repo.labelPlural} onOpen={onOpenProj} onDeadline={(id, v) => board.setLabelDeadline(id, v)} onSoltar={onSoltarProy} seleccion={{ ids: selProy, set: setSelProy }} sinRanking />
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                      {/* La barra ocupa el ancho de la grilla entera y se dibuja pegada a lo
                          que va a cambiar: en esta vista lo que se hace en lote es ponerle el
                          ritmo (y su día) a varias de una. */}
                      {selProy.size > 0 && (
                        /* ⚠️ PEGADA, igual que la del Kanban y la de las tablas. Medido en
                           la grilla real (04/10/2026): un ítem de grilla con
                           `gridColumn: 1/-1` y `position: sticky` SÍ se pega —y=8 desde
                           scrollY=400 hasta 10.000—, así que el molde del Kanban sirve acá.
                           ⚠️ Y ÉSTA VA EN `top: 8` Y LA DE TAREAS MÁS ABAJO: en esta vista
                           las dos selecciones pueden estar vivas a la vez, y las dos en el
                           mismo `top` se pisan cuando los dos grupos están en pantalla. */
                        <div style={{ gridColumn: '1 / -1', position: 'sticky', top: 8, zIndex: 20 }}>
                          <AccionesLoteProyectos elegidos={proyectos.filter((l) => selProy.has(l.id))} board={board} onLimpiar={() => setSelProy(new Set())} estilo={{ boxShadow: '0 8px 24px rgba(18,21,27,.14)' }} />
                        </div>
                      )}
                      {/* La MISMA tarjeta de la tab Proyectos, con el MISMO agarre. Lo único
                          que cambia es a dónde se puede soltar: allá una posición del
                          ranking, acá un ritmo (ver el bloque largo de arriba). */}
                      {filasProy.map(({ l, prog }) => (
                        <ProyectoCardTile key={l.id} l={l} prog={prog} isTop={l.id === topProjectId} sinRanking onOpen={() => onOpenProj(l.id)}
                          elegido={selProy.has(l.id)} haySeleccion={selProy.size > 0} onElegir={alternarProy}
                          onAgarrar={(nodo, dx, dy) => { montarCopia(nodo, dx, dy); setEnMano({ id: l.id, tipo: 'proyecto', r: canonRRule(recurrenciaDe(l)) }); }}
                          onSoltarse={soltar} />
                      ))}
                    </div>
                  )}
              </GrupoRecurrente>
            )}
            {tareas.length > 0 && (
              <GrupoRecurrente rotulo="Tareas" n={tareas.length}>
                {tabla
                  ? <TablaTareas tareas={tareas} board={board} hoy={hoyISO()} onOpen={onOpen} onOpenProj={onOpenProj} ask={ask} onEliminar={onEliminar} onSoltar={onSoltarTarea} onFecha={(id, v, antes) => board.setDeadline(id, v, antes)} onHecha={(id) => board.toggleDone(id)} seleccion={{ ids: selTareas, set: setSelTareas }} sinRanking />
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {/* La barra de TAREAS: la de siempre, sobre la selección de este grupo.
                          Acá es donde el pedido «ponle la repetición al lote» se usa de
                          verdad — toda esta vista se repite, así que el deadline no aplica y
                          su ranura la ocupa el ritmo. */}
                      {selTareas.size > 0 && (
                        /* ⚠️ `top: 66` Y NO 8: en esta vista la barra de PROYECTOS también
                           puede estar viva, y las dos pegadas al mismo borde se tapan entre
                           sí. 66 = los 8 de la de arriba + sus 50 de alto + 8 de aire. */
                        <div style={{ gridColumn: '1 / -1', position: 'sticky', top: 66, zIndex: 19 }}>
                          <AccionesLote elegidas={tareas.filter((t) => selTareas.has(t.id))} board={board} ask={ask} onLimpiar={() => setSelTareas(new Set())} estilo={{ boxShadow: '0 8px 24px rgba(18,21,27,.14)' }} />
                        </div>
                      )}
                      {/* La MISMA tarjeta del Kanban. `warn={false}`: el triangulito es «alta
                          sin fecha», y acá nada puede tener fecha — una alarma permanente es
                          cómo se aprende a ignorar todas las demás. */}
                      {tareas.map((t) => (
                        <CardTile key={t.id} t={t} board={board} warn={false} sinRanking onOpen={onOpen} onWarn={onOpen} onOpenProj={onOpenProj} onEliminar={onEliminar}
                          elegida={selTareas.has(t.id)} haySeleccion={selTareas.size > 0} onElegir={alternarTarea}
                          onAgarrar={(id, desde) => {
                            if (!id) { soltar(); return; }
                            if (desde) montarCopia(desde.nodo, desde.dx, desde.dy);
                            setEnMano({ id, tipo: 'tarea', r: canonRRule(recurrenciaDe(t)) });
                          }} />
                      ))}
                    </div>
                  )}
              </GrupoRecurrente>
            )}
          </>
        )}
      </div>
      {enMano && <EscaleraDeRitmos actual={enMano.r} onSoltar={ponerRepeticion} />}
    </div>
  );
}

/**
 * LOS DESTINOS DEL ARRASTRE: un chip por ritmo, pegados al borde de abajo de la ventana.
 *
 * Es al ritmo lo que las cuatro columnas del Kanban a la prioridad: el destino ES el valor,
 * así que no hay nada que preguntar después de soltar. Por eso acá no hay pop-up — la
 * pregunta «¿cada cuánto?» ya la contestó dónde soltaste.
 *
 * ⚠️ `position: fixed` Y NO UNA BANDA ADENTRO DE LA LISTA. Una banda por ritmo en la grilla
 * tenía dos problemas, y el segundo es el que decide: aparecería y desaparecería moviendo
 * las tarjetas justo cuando hay una en la mano, y sobre todo diría el ritmo de cada tarjeta
 * DOS veces —el rótulo de la banda y el renglón de la tarjeta—, que es como uno de los dos
 * se queda viejo. Fija a la ventana no mueve nada y siempre está a la vista, que además es
 * lo que hace innecesario el auto-scroll.
 *
 * ⚠️ VA «Indefinida» TAMBIÉN, y es el único destino que BORRA. Sin él, un ritmo puesto por
 * error sólo se saca abriendo el detalle — y el selector de allá sí lo ofrece, así que no
 * ofrecerlo acá sería que el mismo campo se pueda poner de dos maneras y sacar de una.
 *
 * ⚠️ EL QUE LA TARJETA YA TIENE SE MARCA Y NO ACEPTA EL DROP. Un destino que no cambia nada
 * se lee como que el gesto falló; marcado, dice dónde estás parado.
 */
function EscaleraDeRitmos({ actual, onSoltar }: {
  /** la repetición que la tarjeta en la mano ya tiene, canónica, para marcarla. */
  actual: string;
  onSoltar: (rrule: string) => void;
}) {
  // ⚠️ LA LISTA SALE DE `opcionesRepeticion`, LA MISMA QUE PINTA EL DESPLEGABLE DEL DETALLE
  // y la barra de lote: un preset nuevo aparece acá sin que nadie se acuerde de esta
  // escalera. Lo único que se saca es «Personalizado…»: un destino de arrastre que abre un
  // diálogo es soltar en un lugar que todavía pregunta, y el sentido de esta escalera es
  // que el destino ES el valor. Lo personalizado se pone donde hay un formulario, que es el
  // detalle y la barra.
  const destinos = opcionesRepeticion().filter((o) => o.value !== VALOR_PERSONALIZADO);
  // ⚠️ 3001 ES UNO MÁS QUE LA COPIA QUE SIGUE AL CURSOR (3000, `useArrastreCopia`), y es a
  // propósito: la tarjeta mide 249×138 y los chips ~150×34, así que con la copia encima
  // taparía justo el destino al que estás apuntando — y el único aviso de dónde va a caer es
  // que ese chip se tiña. La copia se mete DEBAJO de la barra, que se lee como dejarla en
  // una bandeja. No la bloquea: la copia es `pointerEvents: none`.
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 3001, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border-strong)', boxShadow: '0 -10px 30px rgba(18,21,27,.18)', fontFamily: SANS }}>
      {destinos.map((d) => <ChipRitmo key={d.value || 'sin'} label={d.label} actual={actual === d.value} onSoltar={() => onSoltar(d.value)} />)}
    </div>
  );
}

/**
 * Un destino de la escalera. Se tiñe cuando la tarjeta le pasa por encima, que es lo único
 * que dice «si soltás acá, cae acá».
 *
 * ⚠️ `preventDefault()` EN `dragOver` ES LO QUE HABILITA EL DROP. Sin él el navegador lo
 * rechaza y no pasa nada — que se lee exactamente como que el arrastre no anda.
 */
function ChipRitmo({ label, actual, onSoltar }: { label: string; actual: boolean; onSoltar: () => void }) {
  const [sobre, setSobre] = useState(false);
  const activo = sobre && !actual;
  return (
    <div
      onDragOver={actual ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!sobre) setSobre(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false); }}
      onDrop={actual ? undefined : (e) => { e.preventDefault(); setSobre(false); onSoltar(); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none',
        border: `1.5px ${actual ? 'solid' : 'dashed'} ${activo ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: activo ? 'var(--primary-bg)' : actual ? 'var(--surface-2)' : 'transparent',
        color: activo ? 'var(--primary)' : actual ? 'var(--dim)' : 'var(--faint)',
        borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, transition: 'border-color .12s, background .12s, color .12s' }}>
      <IconoRepite size={13} />
      {label}
    </div>
  );
}

/**
 * Un grupo de la vista Recurrentes: su rótulo, su conteo y lo que haya adentro.
 *
 * ⚠️ EL RÓTULO LLEVA EL CONTEO Y VA SIEMPRE, y eso cambió el 26/09/2026 al irse la cabecera
 * «Se repite»: el número vivía allá arriba y con ella se iba. Antes el rótulo se escondía
 * cuando había un solo grupo —no separaba de nada—, pero ahora además es el ÚNICO lugar
 * donde se dice cuántas son. Va en el mismo `rowLabel` mono que todos los rótulos del
 * tablero: es un nombre y un número, no una glosa.
 */
function GrupoRecurrente({ rotulo, n, children }: { rotulo: string; n: number; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ ...rowLabel, marginBottom: 0 }}>{rotulo} · {n}</label>
      {children}
    </div>
  );
}
// ── vista Proyectos (tab): cards ordenadas por prioridad ────────────────────────
function ProyectosView({ board, topProjectId, onOpen, onNew, projFilter, q, campos, fOrigen, sortMode, sortDir, tabla, onSoltar }: { board: Board; topProjectId: string | null; onOpen: (id: string) => void; onNew: () => void; projFilter: DoneFilter; q: string;
  /** DÓNDE mira la búsqueda. Es la MISMA elección que gobierna la de tareas (el chevrón al
   *  lado de la lupa), que esta vista ignoraba: buscar acá miraba siempre el detalle, las
   *  notas y los títulos de las tareas de adentro, hubiera pedido eso o no. */
  campos: CampoBusqueda[]; fOrigen: Set<string>; sortMode: OrdenModo; sortDir: 'desc' | 'asc'; tabla: boolean;
  /** soltaste un proyecto: NO se fija solo, dispara el MISMO pop-up del 1 al 100 que el
   *  Kanban y que el lápiz del panel (`setSoltada`), con el número que sugiere la posición. */
  onSoltar: (id: string, sugerido: number) => void }) {
  const { labels, tasks, repo } = board;
  const [verTodos, setVerTodos] = useState(false);
  /**
   * ⚠️ TODOS LOS HOOKS DE ESTA VISTA VAN ACÁ ARRIBA, antes del `return` de la vista TABLA:
   * un hook detrás de un `return` temprano se llama en unos renders y en otros no, y eso es
   * el «Minified React error #300» — la pantalla entera en blanco, sin archivo ni línea.
   *
   * ARRASTRAR UN PROYECTO. «Que pueda mover los proyectos como en el kanban, arrastrando y
   * cambiándole la prioridad» (25/09/2026). Reusa `useArrastreCopia` —el molde medido del
   * Kanban— y al soltar dispara `onSoltar`, que es el pop-up que ya existe: soltar dice
   * DÓNDE, la persona dice CUÁNTO.
   */
  const { empujarScroll, pararScroll, montarCopia, soltarCopia } = useArrastreCopia();
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [insProy, setInsProy] = useState<number | null>(null);
  /**
   * LO SELECCIONADO EN LA GRILLA (26/09/2026, «proyecto también debería poder tener
   * selección múltiple»). La MISMA mecánica que el Kanban: el estado vive acá —la barra se
   * dibuja ARRIBA de la grilla, así que la tarjeta no puede ser su dueña— y la tarjeta
   * recibe `elegido`, `haySeleccion` y `onElegir`.
   *
   * ⚠️ VA ARRIBA DEL `return` DE LA VISTA TABLA, como todos los hooks de esta vista: la
   * tabla trae su propia selección adentro (es la misma decisión que en `TablaTareas`) y un
   * hook detrás de ese `return` es el «Minified React error #300».
   */
  const [selProy, setSelProy] = useState<ReadonlySet<string>>(new Set());
  /**
   * EL «VER MÁS» SE ABRE SOLO AL AGARRAR UNA TARJETA. «Lo único que habría que
   * automáticamente desplegar el "ver más" si agarro uno. Y si me arrepiento y lo suelto,
   * que se pliegue nuevamente» (25/09/2026) — y no es cosmético: con 6 a la vista y el resto
   * escondido, la mitad de los destinos no se puede soltar porque no está dibujada.
   *
   * `abriPorArrastre` es la mitad que hace falta para NO pisar una decisión de la persona:
   * si ya lo había desplegado, al soltar se queda como estaba.
   */
  const abriPorArrastre = useRef(false);
  /** ⚠️ EL MISMO DATO QUE `arrastrado`, PERO EN UN REF, y lo mira el `dragover` de la
   *  grilla. El estado se lee en el render SIGUIENTE al `dragstart`, y el primer `dragover`
   *  puede llegar antes: con la condición colgada del estado, el primer evento no llama a
   *  `preventDefault()` y el navegador decide ahí mismo que esto no es un destino válido —
   *  el gesto arranca «muerto» y se lee como que el arrastre no anda. */
  const arrastradoRef = useRef<string | null>(null);
  /** Los centros de cada tarjeta, en coordenadas de PÁGINA y medidos UNA sola vez por gesto:
   *  leer layout en cada `dragover` es lo que hace que un arrastre se sienta pegajoso, y en
   *  coordenadas de página para que sobrevivan al auto-scroll. */
  const rects = useRef<Array<{ id: string; x: number; y1: number; y2: number }>>([]);
  const TOPE = 6; // feedback jul-18: al arranque, el "+" (cuenta como 1) + 5 proyectos reales; el resto tras "Ver más"
  const REALES = TOPE - 1;
  const needle = q.trim();
  // Orden por PRIORIDAD (score) o por CREACIÓN (ts más viejo del historial), en la
  // dirección elegida. dir=-1 → desc (mayor score / más nuevo primero); +1 → asc.
  const dir = sortDir === 'asc' ? 1 : -1;
  const cmpProy = comparar(sortMode, dir);
  const ordenados = labels.slice().sort((a, b) => cmpProy(
    { score: a.score, titulo: a.name, deadline: a.deadline ?? '', creado: creTsLabel(a) },
    { score: b.score, titulo: b.name, deadline: b.deadline ?? '', creado: creTsLabel(b) },
  ));
  const origenDe = (l: Label) => fuenteEfectiva({ origen: l.historial[l.historial.length - 1]?.actor ?? 'user', fuente: l.fuente }).tipo;
  // Un proyecto pasa el filtro de ORIGEN si lo creó esa fuente O si TIENE tareas de
  // esa fuente. Antes solo miraba el origen del proyecto en sí, y como los proyectos
  // los crea uno a mano, filtrar por "Reunión · Fathom" devolvía la pantalla vacía
  // aunque las tareas de la reunión estuvieran cargadas adentro — el motivo por el
  // que pareció que una reunión entera no se había cargado.
  const tieneTareasDe = (id: string) => tasks.some((t) => t.labels.includes(id) && fOrigen.has(fuenteEfectiva(t).tipo));
  const withProg = ordenados.map((l) => ({ l, prog: projProgress(tasks, l.id), ts: tasks.filter((t) => t.labels.includes(l.id)) }));
  /**
   * ⚠️ BUSCAR ORDENA POR RELEVANCIA, NO POR SCORE. «No está funcionando bien la barra de
   * búsqueda, mira que no me trae lo que le pido» (26/09/2026), buscando «mauricio» en la
   * vista Proyectos: salieron Chatbot, Plan, Customer Success e Integraciones, y el que él
   * quería —«Cliente: Mauricio»— no estaba a la vista.
   *
   * Y el filtro NO estaba mal: el heno incluye el detalle, las notas y los títulos de las
   * tareas del proyecto a propósito (buscar «landing» tiene que traer el proyecto donde vive
   * esa tarea aunque su nombre no la nombre). Lo que estaba mal era el ORDEN. Medido contra
   * la base: «Cliente: Mauricio» es P82 con score 20, y «Feature: Chatbot» tiene 99 — así
   * que el match EXACTO en el nombre quedaba sepultado bajo cuatro proyectos que sólo lo
   * mencionan en su descripción. Un buscador que encuentra y no muestra es indistinguible
   * de uno que no encuentra.
   *
   * Tres escalones, y adentro de cada uno se conserva el orden elegido en el header:
   *   0 · el identificador o el NOMBRE           — lo que la persona escribió ES el proyecto
   *   1 · su descripción o sus notas             — habla de eso
   *   2 · el título de alguna de sus tareas      — tiene trabajo sobre eso
   */
  /**
   * ⚠️ POR DEFECTO SE BUSCA SÓLO EN EL NOMBRE. «Cómo es posible que busco idea y el proyecto
   * de idea me sale último… debe estar buscando por la descripción, pero eso sólo debería
   * pasar en la búsqueda avanzada» (26/09/2026).
   *
   * Tenía razón y el arreglo de la vuelta anterior —ordenar por relevancia— atacaba el
   * síntoma: medido contra la base, «idea» devolvía 10 proyectos de 71 y UNO SOLO lo tiene
   * en el nombre. Ordenarlos mejor deja nueve tarjetas que la persona no pidió.
   *
   * Lo que faltaba ya existía: la búsqueda de TAREAS mira sólo el título salvo que se
   * agreguen campos en el desplegable de la lupa (`CAMPOS_POR_DEFECTO = ['titulo']`), y esta
   * vista era la única que no respetaba esa elección. Ahora la comparte, así que el mismo
   * control gobierna las dos — que es la regla de la casa de un control, un significado.
   *
   * El mapeo, con su porqué:
   *   · `titulo`  → el pid y el NOMBRE. Es lo único del default.
   *   · `detalle` → la descripción Y los títulos de las tareas de adentro: las dos son
   *                 «mirar adentro del proyecto», y buscar «landing» y que aparezca el
   *                 proyecto donde vive esa tarea sigue siendo útil — pero bajo pedido.
   *   · `notas`   → las notas.
   */
  const ve = (c: CampoBusqueda) => campos.includes(c);
  const henoDe = (l: Label) => `${l.pid ?? ''} ${(l.pid ?? '').replace(/^P/i, '')} ${l.name}`;
  const aguja = needle.replace(/^#/, '');
  const escalon = (l: Label, ts: BoardTask[]): number => {
    // El pid se busca SIEMPRE, como el `#número` de una tarea: escribir «P39» es pedir un
    // proyecto puntual, no buscar texto.
    if (ve('titulo') && coincide(henoDe(l), aguja)) return 0;
    if (ve('detalle') && coincide(l.detalle ?? '', aguja)) return 1;
    if (ve('notas') && coincide(l.notas ?? '', aguja)) return 1;
    if (ve('detalle') && coincide(ts.map((t) => t.title).join(' '), aguja)) return 2;
    return 3;   // no coincide con nada de lo que se pidió mirar
  };
  const conEscalon = needle ? withProg.map((x) => ({ ...x, esc: escalon(x.l, x.ts) })) : withProg.map((x) => ({ ...x, esc: 0 }));
  const shown = conEscalon
    .filter(({ esc }) => esc < 3)
    // `sort` es estable en todos los motores desde ES2019, así que empatar en el escalón
    // deja el orden que traía `ordenados` — el del header — sin volver a compararlo.
    .sort((a, b) => a.esc - b.esc)
    .filter(({ l }) => fOrigen.size === 0 || fOrigen.has(origenDe(l)) || tieneTareasDe(l.id))
    .filter(({ prog }) => pasaEstado(prog.pct, projFilter))
    // ⚠️ LO TERMINADO VA AL FONDO, igual que en la tabla. Mismo criterio y misma función
    // (`proyectoTerminado`), porque el bug era justamente que cada vista tenía el suyo:
    // «en la vista de tablas sí se va para abajo, pero en la vista de tarjetas se queda de
    // arriba» (01/10/2026, 01:01:00). El `sort` es estable desde ES2019, así que adentro
    // de cada grupo se conserva el orden que eligió el header.
    .sort((a, b) => Number(proyectoTerminado(a.prog)) - Number(proyectoTerminado(b.prog)));
  /**
   * MIENTRAS HAYA SELECCIÓN, LA GRILLA ESTÁ DESPLEGADA. No es un gesto: es una propiedad
   * de estar seleccionando.
   *
   * «Cuando hago selección en lote en los proyectos, en la vista de tarjetas, primero se
   * tienen que desplegar todas las del "ver más", si no, no tiene sentido… y cuando dejo de
   * seleccionar el lote, volver a plegar» (04/10/2026). Con cinco a la vista y el resto
   * escondido, tildar «todos los de la fase» es imposible.
   *
   * ⚠️ SE DERIVA Y NO SE DISPARA, y lo decidió el navegador. La primera versión abría y
   * cerraba desde un `cambiarSel()` por el que pasaban los dos caminos que cambian la
   * selección —la casilla y el `onLimpiar` de la barra—, y era correcta para los dos… y
   * dejaba un tercero afuera: desde que la selección sobrevive al cambio de formato, se
   * puede tildar en la TABLA y conmutar a tarjetas. Medido: tres tildados y cinco tarjetas
   * dibujadas, o sea una barra actuando sobre lo que no está en pantalla. Derivado no hay
   * camino que se pueda olvidar — tampoco el que se invente mañana.
   *
   * ⚠️ Y POR ESO EL BOTÓN DE «Ver más» NO SE DIBUJA MIENTRAS HAY SELECCIÓN (más abajo):
   * apretarlo no podría plegar nada, y un control que no hace nada se lee como que la app
   * está rota. Mientras se selecciona, la expansión es de la selección.
   */
  const desplegadoPorSeleccion = selProy.size > 0;
  const visibles = (verTodos || needle || desplegadoPorSeleccion) ? shown : shown.slice(0, REALES);
  const resto = shown.length - visibles.length;

  /**
   * ARRASTRAR SÓLO TIENE SENTIDO ORDENADO POR PRIORIDAD. Con «Alfabético» o «Por deadline»
   * la posición donde soltás no dice nada del score, así que el punto medio entre los dos
   * vecinos sería un número inventado con cara de decisión. Fuera de ese orden la tarjeta no
   * es `draggable` y el cursor lo dice.
   *
   * Y lo escribe `repo.prioridadManual`: el tablero del CLIENTE no tiene esa escritura
   * —`score_manual` es una columna que su tabla no tiene—, y un control que sólo puede
   * contestar «solo admin» se lee como que la app está rota.
   */
  const alternarProy = (id: string) => setSelProy((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sePuedeArrastrar = !!repo.prioridadManual && sortMode === 'score';
  const agarrarProy = (id: string, nodo: HTMLElement, dx: number, dy: number) => {
    arrastradoRef.current = id;
    setArrastrado(id);
    montarCopia(nodo, dx, dy);
    rects.current = [];
    // El `desplegadoPorSeleccion` en el guard es lo que impide que este gesto marque su ref
    // sobre una grilla que ya estaba abierta: al soltar la plegaría con la selección viva.
    if (!verTodos && !needle && !desplegadoPorSeleccion && shown.length > REALES) { abriPorArrastre.current = true; setVerTodos(true); }
  };
  const terminarProy = () => {
    arrastradoRef.current = null;
    setArrastrado(null); setInsProy(null); rects.current = []; pararScroll(); soltarCopia();
    if (abriPorArrastre.current) { abriPorArrastre.current = false; setVerTodos(false); }
  };
  /**
   * LOS RECTÁNGULOS SE MIDEN UNA VEZ POR GESTO, Y DESDE EL `dragover`.
   *
   * ⚠️ NO desde un `requestAnimationFrame` del `dragstart`, que era la salida obvia para
   * esperar a que el «Ver más» se dibujara: durante un arrastre NATIVO el navegador congela
   * rAF y los timers (medido y escrito en AGENTS.md), así que ese callback llega DESPUÉS de
   * soltar y la medición nunca ocurre — con la lista vacía, el hueco se queda clavado en la
   * posición 0 y el número que propone el pop-up sale de una posición que nadie eligió.
   *
   * Se re-mide sólo si CAMBIÓ LA CANTIDAD de tarjetas, que es exactamente lo que pasa una
   * vez, cuando el «Ver más» se despliega solo. `querySelectorAll` no fuerza layout; el
   * `getBoundingClientRect` de adentro sí, y por eso corre una vez y no sesenta por segundo.
   */
  const medirSiHaceFalta = () => {
    const nodos = document.querySelectorAll<HTMLElement>('[data-projcard]');
    if (rects.current.length === nodos.length) return;
    rects.current = [...nodos].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.projcard ?? '', x: r.left + r.width / 2, y1: r.top + window.scrollY, y2: r.bottom + window.scrollY };
    });
  };
  /** Dónde caería si soltaras ahora, en ORDEN DE LECTURA: la grilla tiene filas y columnas,
   *  así que no alcanza con comparar la Y — una tarjeta «antes» es la que está en una fila
   *  de más arriba, o en la misma fila y más a la izquierda. */
  const indiceEn = (px: number, py: number) => {
    const m = rects.current;
    for (let i = 0; i < m.length; i++) if (py < m[i].y1 || (py <= m[i].y2 && px < m[i].x)) return i;
    return m.length;
  };
  // En TABLA entran todos de una: el «Ver más…» existe porque una tarjeta ocupa media
  // pantalla, que es justo lo que la tabla viene a resolver.
  if (tabla) {
    return (
      <div style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
        <div style={{ width: '100%', maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onNew} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>＋ Crear {repo.labelSingular.toLowerCase()}</button>
          </div>
          <TablaProyectos
            filas={shown} board={board} topProjectId={topProjectId} hoy={hoyISO()} labelPlural={repo.labelPlural}
            onOpen={onOpen}
            /* EL MISMO `onSoltar` QUE LA GRILLA: el pedido 9 es el 8 en la otra vista, así
               que las dos abren el mismo pop-up y no hay dos formas de mover un proyecto.
               Acá NO se mira `sortMode` —como sí hace `sePuedeArrastrar` para la grilla—
               porque la tabla se ordena por su cuenta (su propia pref por navegador) y ella
               misma apaga el agarre cuando no está ordenada por prioridad. */
            onSoltar={repo.prioridadManual ? onSoltar : undefined}
            /* LA MISMA selección que la grilla de tarjetas. Acá no hace falta `cambiarSel`:
               en la tabla entran todas, así que no hay «Ver más» que desplegar. */
            seleccion={{ ids: selProy, set: setSelProy }}
            onDeadline={(id, v) => board.setLabelDeadline(id, v)} />
          <HistorialDeLaTab labels={labels} board={board} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* La barra de lote de PROYECTOS: la misma pieza que la de tareas con otra
            configuración (ver la cabecera de `AccionesLote`). Se dibuja sólo con algo
            elegido, igual que en el Kanban, porque acá no hay una tabla que la sostenga. */}
        {selProy.size > 0 && (
          /* ⚠️ SOBRE `shown` Y NO SOBRE `labels`: lo que la barra toca es lo que pasó los
             filtros, igual que la tabla de tareas arma su selección sobre lo que recibió.
             Con la lista entera, un id que quedó tildado antes de filtrar seguiría contando
             en el número y recibiendo la escritura sin estar en pantalla — que es la forma
             de cambiar de más sin verlo. */
          /* ⚠️ PEGADA. «La barra que me permite hacer las acciones en lote también debe
             bajar con el scroll» (04/10/2026). Acá la barra es HERMANA de la grilla, dentro
             de un flex column, así que su bloque contenedor es toda la vista y el `sticky`
             recorre la pantalla entera; medido a scrollY 400, 1.200, 4.000 y 10.000.
             ⚠️ Y `onLimpiar` ES EL SETTER PELADO: el repliegue no cuelga de ningún camino,
             se deriva de que la selección esté vacía (ver `desplegadoPorSeleccion`). Así
             vale igual para los seis caminos internos de la barra, para la casilla de la
             tarjeta y para el que se invente mañana. */
          <div style={{ position: 'sticky', top: 8, zIndex: 20 }}>
            <AccionesLoteProyectos elegidos={shown.filter(({ l }) => selProy.has(l.id)).map(({ l }) => l)} board={board}
              onLimpiar={() => setSelProy(new Set())} estilo={{ boxShadow: '0 8px 24px rgba(18,21,27,.14)' }} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}
          // `preventDefault` en dragOver es lo que HABILITA el drop: sin él el navegador lo
          // rechaza y no pasa nada, que se lee exactamente como que el arrastre no anda.
          onDragOver={sePuedeArrastrar ? (e) => {
            if (!arrastradoRef.current) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            empujarScroll(e.clientY);
            medirSiHaceFalta();
            const idx = indiceEn(e.clientX, e.clientY + window.scrollY);
            setInsProy((prev) => (prev === idx ? prev : idx));
          } : undefined}
          onDrop={sePuedeArrastrar ? (e) => {
            const enMano = arrastradoRef.current;
            if (!enMano) return;
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain') || enMano;
            // ⚠️ EL ÍNDICE VIENE DE UNA LISTA QUE TODAVÍA CONTIENE AL QUE SE ESTÁ MOVIENDO
            // —al nodo origen no se le toca el tamaño, así que sigue ocupando su celda—, y
            // el número se calcula contra la lista SIN él: dejarlo adentro haría el punto
            // medio contra su propio score y el proyecto «no se movería». Soltarlo más
            // abajo de donde estaba corre una posición.
            const iYo = rects.current.findIndex((r) => r.id === id);
            const crudo = insProy ?? rects.current.length;
            const otros = visibles.map(({ l }) => l).filter((l) => l.id !== id);
            const donde = Math.max(0, Math.min(iYo >= 0 && crudo > iYo ? crudo - 1 : crudo, otros.length));
            // `scoreEntre` asume la lista de MAYOR a MENOR (es la del Kanban). Con el orden
            // invertido, la misma posición mirada al revés es `largo - idx`.
            const lista = sortDir === 'asc' ? otros.slice().reverse() : otros;
            const pos = sortDir === 'asc' ? otros.length - donde : donde;
            const yo = labels.find((l) => l.id === id);
            terminarProy();
            if (id && yo) onSoltar(id, scoreEntre(lista, pos, prioFromScore(yo.score)));
          } : undefined}>
          {/* #1: "Crear proyecto" PRIMERO y del mismo tamaño que el resto (cuenta como 1 celda) */}
          <button onClick={onNew} style={{ border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 14, padding: '15px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 360, color: 'var(--faint)', fontFamily: SANS, opacity: 0.85, transition: 'border-color .12s, color .12s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Crear nuevo {repo.labelSingular.toLowerCase()}…</span>
          </button>
          {/* EL HUECO: es lo que convierte «lo estoy soltando en la lista» en «lo estoy
              soltando ACÁ». Sin él, el número que propone el pop-up sale de una posición que
              nadie vio. Mismo gesto que el hueco del Kanban, con la forma de esta grilla.
              Va DESPUÉS del botón de crear: la posición 0 es la del primer PROYECTO, y el
              botón no es uno — los rectángulos se miden sobre `[data-projcard]`, que no lo
              incluye, así que dibujarlo antes correría el hueco una celda respecto de lo
              que el número va a decir. */}
          {arrastrado && insProy === 0 && <div style={{ minHeight: 360, borderRadius: 14, border: '2px dashed var(--primary)', background: 'var(--primary-bg)' }} />}
          {visibles.map(({ l, prog }, i) => (
            <Fragment key={l.id}>
              <ProyectoCardTile l={l} prog={prog} isTop={l.id === topProjectId} onOpen={() => onOpen(l.id)}
                elegido={selProy.has(l.id)} haySeleccion={selProy.size > 0} onElegir={alternarProy}
                onAgarrar={sePuedeArrastrar ? (nodo, dx, dy) => agarrarProy(l.id, nodo, dx, dy) : undefined}
                onSoltarse={terminarProy} />
              {arrastrado && insProy === i + 1 && <div style={{ minHeight: 360, borderRadius: 14, border: '2px dashed var(--primary)', background: 'var(--primary-bg)' }} />}
            </Fragment>
          ))}
          {shown.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '10px 0 0' }}>No hay {repo.labelPlural.toLowerCase()} para este filtro.</div>}
        </div>
        {/* ⚠️ NO SE DIBUJA MIENTRAS HAY SELECCIÓN: ahí la expansión la manda la selección,
            así que este botón no podría plegar nada — y un control que no hace nada se lee
            como que la app está rota. Vuelve solo al soltar la selección. */}
        {shown.length > REALES && !desplegadoPorSeleccion && (
          <button onClick={() => setVerTodos((v) => !v)}
            style={{ alignSelf: 'center', marginTop: -4, padding: '9px 20px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--dim)'; }}>
            {resto > 0 ? `Ver más… (${resto} ${repo.labelPlural.toLowerCase()} más)` : 'Ver menos'}
          </button>
        )}
        <HistorialDeLaTab labels={labels} board={board} />
      </div>
    </div>
  );
}

// ── detalle de un proyecto — MISMO layout de 2 columnas que la ficha de tarea (#25) ─
function ProjectDetailModal({ proj, board, topProjectId, taskAbierta = false, trabajando = false, z = 90, onBack, backLabel = 'Volver a la tarea', onOpenTask, onNewTask, onPrioridad, onMako, onDelete, onAsignarCliente, onPortada, onIcono, onEncuadre, onEliminarTask, onSoltarTask, onClose, ask }: { proj: Label; board: Board; topProjectId: string | null; taskAbierta?: boolean; trabajando?: boolean; z?: number; onBack?: () => void; backLabel?: string; onOpenTask: (id: string) => void; onNewTask: () => void; onPrioridad: () => void; onMako: () => void; onDelete: () => void;
  /** Abre el picker de CLIENTE (mig 0172). Es la mitad del PROYECTO, y es la que importa:
   *  un proyecto asignado ata a ese cliente TODAS sus tareas de una vez. Sin la prop, este
   *  modal dibuja el tablero completo y el campo no — el modo de falla de siempre. */
  onAsignarCliente: () => void;
  /** Abre el selector de portada (mig 0173). Vive en `BoardShell` y no acá por lo mismo
   *  que el de cliente: es un modal HERMANO del detalle, no un hijo — un descendiente se
   *  apagaría junto con él cuando la pila esconde al de abajo. */
  /** Recibe el NODO que lo abrio: de ahi cuelga el popover (ver PortadaPicker). */
  onPortada: (ancla: HTMLElement) => void;
  /** Abre el selector de ICONO, colgado del nodo que se toco (mig 0174). */
  onIcono: (ancla: HTMLElement) => void;
  /** Guarda el encuadre de la portada del proyecto. */
  onEncuadre: (y: number) => void;
  /** soltaste una TAREA en la tabla de adentro del proyecto. Este modal no tiene el estado
   *  del pop-up (vive en `BoardShell`), así que la capacidad entra por acá: sin la prop, la
   *  tabla no dibuja el agarre. Es el mismo criterio que `onAgarrar` de `ProyectoCardTile`. */
  onSoltarTask?: (id: string, sugerido: number) => void;
  /** borrar UNA tarea del proyecto. Sin esto, la fila de la tabla no dibuja el tacho — que
   *  es cómo se ve desde afuera que este modal no pasó la capacidad. */
  onEliminarTask?: (id: string) => void; onClose: () => void;
  /** confirmar lo irreversible: lo pide `TablaTareas`, que ahora dibuja las tareas de acá */
  ask: (msg: string, onOk: () => void) => void }) {
  // ⚠️ `useCapaModal` SUBIÓ ACÁ ARRIBA: el efecto del Escape necesita su valor, y un `const`
  // no se hoistea. El orden de los hooks cambia en el FUENTE, no entre renders, que es lo
  // único que a React le importa.
  const capa = useCapaModal(true);
  // Se pregunta en el MOMENTO de la tecla (es una función, no un boolean): así el handler
  // no tiene dependencias y no se re-registra cada vez que algo se abre encima.
  const capaArriba = capa.esElDeArriba;
  // No cerrar con Escape cuando hay una tarea abierta ENCIMA (esa maneja su propio Escape),
  // ni cuando este modal no es el de más arriba de la pila (ver `esElDeArriba`).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !taskAbierta && capaArriba()) { (document.activeElement as HTMLElement)?.blur?.(); onClose(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose, taskAbierta, capaArriba]);
  const suyas = board.tasks.filter((t) => t.labels.includes(proj.id)).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.score - a.score);
  // Lo ABIERTO se cuenta acá sólo para el rótulo y para el bloque del proyecto vacío: la
  // tabla recibe `suyas` ENTERO y separa sola lo hecho, en su propia fila plegable.
  const abiertas = suyas.filter((t) => t.progress < 100);
  const prog = projProgress(board.tasks, proj.id);
  const isTop = proj.id === topProjectId;
  // ¿Se repite? Sale del contrato, nunca de `proj.recurrente`. Mismo predicado que la tarea.
  const repiteProj = esRecurrente(proj);
  return (
    // `z` sigue existiendo como piso para el caso proyecto-debajo-de-tarea, pero quien
    // manda es la pila: el de arriba se ve, los de abajo se esconden.
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: Math.max(z, capa.z), background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: capa.visible || taskAbierta ? 'flex' : 'none', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: MODAL_DETALLE, height: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `4px solid ${proj.color}`, borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* ⚠️ LA CABECERA ES UNA PIEZA COMPARTIDA DESDE EL 28/09/2026, y no una copia
            de su diseño. Acá vivían la portada, sus pastillas, el cerrar, la marca que
            cruza y la fila del título, escritos a mano — y los mismos estaban escritos
            otra vez en la ficha de un cliente y una tercera vez, mal, en el detalle de
            un cliente de la plataforma. El dueño lo reportó mirando el tercero: «el
            detail está mal, te había dicho que idéntico al del plan». Ahora las tres
            montan `CabeceraDetalle`, que es la única forma de que «idéntico» no
            dependa de que nadie edite una de las tres.

            Lo que se quedó acá es lo que es DEL TABLERO: el pid, el chip de objetivo
            principal, el título que escribe con `patchLabelLog` y el «Volver». */}
        {/* ⚠️ LA BANDA VA A LO ANCHO Y EL RENGLÓN DEL NOMBRE NO: el renglón se monta
            más abajo, ADENTRO de la columna izquierda, para que la columna derecha
            arranque pegada a la portada. «Haz que la sidebar llegue hasta el tope de la
            portada… así evitamos que tenga scroll» (29/09/2026). Medido: son 67 px, que
            es exactamente el alto de ese renglón. */}
        <PortadaDetalle
          nombre={proj.name}
          color={proj.color}
          portada={proj.portada} portadaY={proj.portadaY}
          onPortada={onPortada} onEncuadre={onEncuadre}
          icono={proj.icono} emoji={proj.emoji} onIcono={onIcono}
          cuadrado
          onCerrar={onClose}
        />
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* ⚠️ LA COLUMNA IZQUIERDA ES UNA COLUMNA DE FLEX, no el scroller. El renglón
              del nombre va arriba con `flex:none` y el scroller abajo con `flex:1` y su
              propio `minHeight:0`: sin ese 0 el hijo crece a su contenido, la columna
              crece con él y el que termina scrolleando es el MODAL — o sea que el título
              se va de la pantalla, que es lo contrario del pedido. */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <FilaDetalle
          color={proj.color}
          antes={onBack ? (
            <button onClick={onBack} title={backLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, flex: 'none' }}>← {backLabel}</button>
          ) : undefined}
          kicker={
            <>
              <span style={{ fontFamily: MONO, fontSize: 11, color: proj.color, fontWeight: 700 }}>{proj.pid}</span>
              {isTop && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: proj.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>}
            </>
          }
          titulo={
            /* ⚠️ ES `EditableInline` Y NO UN `<input>`, y eso ARREGLA que el nombre se
               cortara: «mira como se corta el título de Vender MaKo: Oferta y precios»
               (29/09/2026). Un `<input>` no mide su texto — su ancho intrínseco sale del
               atributo `size` (20 por default), que se cuenta en avances del dígito «0»
               de la fuente ACTIVA. Medido: 308 px con Geist y 275 px con la fallback,
               para un texto que mide 285,7 px. O sea que entraba por 2,3 px en Chromium,
               se cortaba 8,7 px en WebKit (media «s», que es la captura) y 30,4 px
               mientras la webfont no llegaba. Y el par `paddingLeft:10 / marginLeft:-10`
               de `tituloEditable` le robaba 10 px más, descontados dos veces porque el
               padre se dimensiona al hijo.
               Medido sobre el catálogo: 4 de 70 nombres YA se cortaban y 3 más pasaban
               por menos de 20 px. No era un nombre desafortunado.
               Un span editable ocupa exactamente lo que dice, así que la columna del
               título mide el TEXTO. Y de paso es la misma pieza que usan la ficha de un
               cliente y la del super admin: las tres editan el nombre igual. */
            <EditableInline
              valor={proj.name}
              placeholder="Sin nombre"
              titulo="Edita el nombre del proyecto"
              className="cd-nombre"
              /* ⚠️ EL GUARD DE VACÍO NO SE PUEDE OMITIR: `EditableInline` avisa de
                 cualquier texto que CAMBIÓ, y «» cambió. Sin esto, seleccionar todo y
                 borrar deja un proyecto sin nombre. */
              onGuardar={(v) => { if (v.trim() && v.trim() !== proj.name) board.patchLabelLog(proj.id, { name: v.trim() }, `Renombró el proyecto → «${v.trim()}»`); }} />
          }
          /* El chip va en la cabecera por el mismo motivo que en una tarea: es lo primero
             que hay que saber de este proyecto —cambia el significado de su prioridad, de
             su fecha y de dónde vive— y la columna derecha puede estar scrolleada. */
          chips={repiteProj ? <RepiteChip /> : undefined}
        />
            {/* EL SCROLLER: el cuerpo del proyecto. El padding se MUDÓ acá desde la
                columna — si se quedaba arriba, el renglón del nombre arrancaría en x=22 y
                su sangría dejaría de alinear con el `left:20` de la marca. */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: '20px 22px' }}>
              {/* ⛔ EL TÍTULO YA NO VIVE ACÁ. Subió al renglón del ícono el 27/09/2026:
                  «el título principal debería estar al lado del emoji/perfil, no abajo».
                  Es la anatomía de la ficha de un cliente y la de una página de Notion —
                  marca, nombre al lado, y el cuerpo empieza en el contenido. Abajo dejaba
                  el renglón del ícono con sólo el pid, o sea un renglón entero para un
                  número de cinco caracteres. */}
              {/* ⚠️ EL DETALLE VUELVE ARRIBA, Y ES UN SOLO DOCUMENTO. Tres pedidos del mismo
                  día y hay que leer los tres juntos: primero «yo no veo el detalle, yo veo las
                  tareas», después «haz que el "Detalle del proyecto" siga estando arriba del
                  todo, como antes, solo que las secciones estén plegadas», y al final «cada
                  desplegable es como un FORMATEO de texto… tiene que ser 1 solo detalle, no
                  muchos» (25/09/2026). O sea: lo que molestaba no era el LUGAR ni el plegado,
                  era que el doc se leyera como N secciones sueltas. Plegado ocupa cuatro
                  renglones y deja las tareas a la vista igual.
                  El AVANCE se queda arriba porque es un renglón y contesta lo mismo que las
                  tareas: cómo viene esto. Sin `<Separador />` entre el título y el doc — el
                  mismo pedido que en la tarea. */}
              <DetalleDoc valor={proj.detalle} onChange={(html) => { if (html !== proj.detalle) board.patchLabelLog(proj.id, { detalle: html }, 'Editó el detalle'); }} placeholder="¿De qué se trata este proyecto?" />
              <Separador />
              {/* El avance y las tareas, debajo del doc. El `N/M tareas` que iba acá se fue:
                  lo dice la tabla —N abiertas arriba, «M completadas» en su última fila— y
                  repetirlo es el mismo dato representado de otra forma, que es justo lo que
                  esta pasada vino a sacar. */}
              {/* Ver el porqué en la tarjeta del proyecto: sin tareas CON FIN no hay
                  porcentaje que mostrar, y un 0% con su barra vacía se lee como «nadie hizo
                  nada». Lo que hay se dice con su nombre. */}
              {prog.total === 0 && prog.recurrentes > 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)', marginBottom: 20 }}>
                  <IconoRepite size={13} />
                  En marcha · {prog.recurrentes} tarea{prog.recurrentes === 1 ? '' : 's'} que se {prog.recurrentes === 1 ? 'repite' : 'repiten'}, sin nada con fecha de fin.
                </div>
              ) : (<>
                <label style={rowLabel}>Avance · {prog.pct}%</label>
                <span style={{ display: 'block', marginBottom: 20 }}><MiniBar v={prog.pct} /></span>
              </>)}

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                {/* El conteo dice lo que queda ABIERTO y nada más: cuántas están hechas lo
                    dice la propia tabla, en su última fila. Decirlo dos veces es el mismo
                    dato representado de dos formas, que es justo lo que se vino sacando. */}
                <label style={{ ...rowLabel, marginBottom: 0 }}>Tareas del proyecto · {abiertas.length}</label>
                <span style={{ flex: 1 }} />
                <button onClick={onNewTask} style={{ border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Nueva Tarea</button>
              </div>
              {/* ⚠️ UNA SOLA TABLA, CON TODAS LAS TAREAS DEL PROYECTO. «Que las "18
                  completadas" simplemente sea otra fila más de una única tabla, y al
                  clickearlo ahí aparecen las otras filas, no otra tabla» (25/09/2026).
                  Acá había DOS `<TablaTareas>` —una de abiertas y otra de terminadas adentro
                  de un `<details>`— con dos encabezados, dos órdenes y dos barras de
                  selección para la misma cosa. La tabla separa sola lo hecho de lo abierto y
                  lo pliega en su propia fila: es UN control, no dos vistas.
                  · `ocultarProyecto`: adentro de un proyecto esa columna dice siempre lo
                    mismo, y sacarla es lo que hace que la tabla entre sin scroll de costado.
                  · `onEliminar`: sin eso la fila no dibuja el tacho.
                  Es la MISMA `TablaTareas` de la vista principal, no una copia: si divergen,
                  el deadline se tiñe distinto en dos pantallas que muestran lo mismo. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {suyas.length === 0
                  ? <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin tareas todavía.</div>
                  : <TablaTareas tareas={suyas} board={board} hoy={hoyISO()} onOpen={onOpenTask} ask={ask} ocultarProyecto onEliminar={onEliminarTask} onSoltar={onSoltarTask} onFecha={(id, v, antes) => board.setDeadline(id, v, antes)} onHecha={(id) => board.toggleDone(id)} />}
              </div>

              {/* Un proyecto SIN tareas abiertas: lo que le falta es TRABAJO, no prioridad.
                  Va ARRIBA de todo en su detalle porque es la única acción que tiene sentido
                  acá — dejarlo como una fila más entre las notas y el historial es esconderlo. */}
              {abiertas.length === 0 && <ProyectoVacioBloque proj={proj} />}

              {/* ⛔ ACÁ ABAJO estuvo el bloque de DEPENDENCIAS, y se fue a la columna derecha
                  el 25/09/2026: «en proyecto el "Depende de" lo mismo que en tareas». En la
                  tarea ya vivía arriba de Proyectos —«es importante verlo de una forma rápida
                  y no scrolleando todo desde abajo»— y acá seguía al fondo de la columna
                  principal: el mismo bloque, en dos lugares, en dos pantallas hermanas. */}

              <Separador />
              <NotasLista valor={proj.notas ?? ''} onGuardar={(v) => board.patchLabelLog(proj.id, { notas: v }, 'Escribió una nota', 'user')} />

              <Separador />
              {/* EL MISMO `BloqueHistorial` de la tarea, con el origen al lado: el chevron
                  que dice que se abre y el conteo para que plegar no esconda cuánto hay. */}
              <BloqueHistorial n={proj.historial.length} fuente={fuenteEfectiva({ origen: proj.historial[proj.historial.length - 1]?.actor ?? 'user', fuente: proj.fuente })}>
                <HistList historial={proj.historial} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} onUndo={(h) => board.undoLabelHist(proj.id, h)} />
              </BloqueHistorial>
            </div>
          </div>
          {/* sidebar — MISMO ancho que la de una tarea (`COL_DER`), mismo orden de bloques */}
          <div style={{ width: COL_DER, flex: 'none', minWidth: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            {trabajando && <PerroTrabajando que="el resto de tus proyectos, para ubicarlo y describirlo" />}
            <BloquePrioridad
              color={proj.color} titulo={proj.name}
              chip={<ProjScore score={proj.score} color={proj.color} />}
              razon={proj.scoreRazon} impacto={proj.impacto} esfuerzo={proj.esfuerzo}
              puedeEditar={!!board.repo.prioridadManual} onEditar={onPrioridad} />
            {/* ── fin de grupo. Ver el porqué de los grupos en el comentario de arriba. */}
            <div aria-hidden style={{ height: 1, background: 'var(--border)' }} />
            {/* ⚠️ EL INTERRUPTOR DEL PROYECTO, GEMELO DEL DE LA TAREA (mig 0164, 26/09/2026:
                «un proyecto también se puede repetir»). Mismo componente, mismo lugar de la
                misma columna y mismo tratamiento: abre el grupo del TIEMPO, porque lo que
                decide es si el deadline y el Quarter de abajo significan algo.

                ⚠️ Y ACÁ ESTAR ADENTRO DEL GRUPO NO ES ESTÉTICA, ES LA TRAMPA DE ESTA
                COLUMNA: este grupo tenía exactamente dos hijos —Deadline y Quarter— y los
                dos se van al marcar. Sin el interruptor adentro, un proyecto que se repite
                dejaba el grupo VACÍO, con sus dos líneas divisorias pegadas una encima de la
                otra. Comprobado en los dos estados.

                El rótulo sale de `repo.labelSingular` y no de la palabra «Proyecto»: en el
                tablero del cliente estos se llaman «Categoría», y un rótulo cableado sería
                la única palabra de esa columna hablando de otra cosa. */}
            <BloqueRecurrente rotulo={`${board.repo.labelSingular} recurrente`} repite={repiteProj}
              onCambiar={(v) => board.setLabelRecurrente(proj.id, v)} />
            {/* Los dos campos que se van, y lo que ocupa su lugar: ver el bloque largo del
                mismo sitio en `TaskModal`. La condición es `llevaDeadline`, la misma del
                contrato, para las dos entidades — y es un `? :` por lo mismo que allá: acá
                este grupo tenía EXACTAMENTE dos hijos, así que sin el ritmo un proyecto que
                se repite dejaba el interruptor solo entre dos divisorias. */}
            {llevaDeadline(proj) ? <>
            <div><label style={rowLabel}>Deadline</label><input type="date" value={proj.deadline || ''} onChange={(e) => board.setLabelDeadline(proj.id, e.target.value)} style={selStyle} /></div>
            {/* ⚠️ EL QUARTER DE UN PROYECTO (mig 0162). «Falta agregar la opción de Quarter
                en los proyectos» (24/09/2026), y es donde más sentido tiene: una tarea cae
                en un trimestre casi siempre porque su proyecto lo decidió.
                Mismo molde que el de una tarea —mismo selector, mismo aviso— porque es la
                misma pregunta; dos moldes para lo mismo divergen a la primera. */}
            <div>
              <label style={rowLabel}>Quarter</label>
              <select value={proj.quarter ?? ''} onChange={(e) => board.setLabelQuarter(proj.id, e.target.value)} style={selStyle}>
                <option value="">Sin asignar</option>
                {quartersElegibles(hoyISO(), 8, proj.quarter).map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
              </select>
              {proj.quarter && proj.deadline && quarterDeFecha(proj.deadline) !== proj.quarter && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--warn, #B4762A)', lineHeight: 1.35, marginTop: 6 }}>
                  <WarnMark title="El Quarter y la fecha no coinciden" size={13} blink={false} />
                  <span>La fecha cae en el {quarterDeFecha(proj.deadline).replace('-', ' ')}, no en el {proj.quarter.replace('-', ' ')}.</span>
                </div>
              )}
            </div>
            </> : (
              <BloqueRepeticion
                valor={recurrenciaDe(proj)}
                onCambiar={(v) => board.setLabelRecurrencia(proj.id, v)} />
            )}

            {/* ⚠️ DEPENDE DE, EN LA COLUMNA DERECHA Y EN EL MISMO LUGAR QUE EN UNA TAREA
                (después del Quarter). «En proyecto el "Depende de" lo mismo que en tareas»
                (25/09/2026).
                Una dependencia de PROYECTO frena todas sus tareas abiertas de un saque: es
                la escritura de mayor palanca del tablero, y por eso el radio se dice antes
                del click y no después. */}
            {/* ── fin de grupo. Ver el porqué de los grupos en el comentario de arriba. */}
            <div aria-hidden style={{ height: 1, background: 'var(--border)' }} />
            <DependenciasBloque
              entidad="proyecto" id={proj.id} deps={board.deps}
              candidatos={board.labels.filter((l) => l.id !== proj.id).map((l) => {
                const abiertasDeEse = board.tasks.filter((t) => t.progress < 100 && t.labels.includes(l.id)).length;
                const total = board.tasks.filter((t) => t.labels.includes(l.id)).length;
                return {
                  id: l.id, titulo: `${l.emoji} ${l.name}`,
                  sub: total === 0 ? 'todavía sin tareas cargadas' : `${abiertasDeEse} de ${total} abiertas`,
                  // Un proyecto SIN tareas NO cuenta como terminado: tratar «vacío» como
                  // «listo» destrabaría media cadena sin que nadie hiciera el trabajo.
                  terminado: total > 0 && abiertasDeEse === 0,
                };
              })}
              impacto={(aId) => {
                const n = board.tasks.filter((t) => t.progress < 100 && t.labels.includes(proj.id)).length;
                const otro = board.labelById(aId);
                const sinTareas = board.tasks.filter((t) => t.labels.includes(aId)).length === 0;
                return `Esto frena ${n === 1 ? 'la tarea abierta' : `las ${n} tareas abiertas`} de «${proj.name}» hasta que «${otro?.name ?? aId}» esté terminado.${sinTareas ? ' Y ojo: ese proyecto todavía no tiene ninguna tarea cargada, así que no se va a destrabar solo.' : ''}`;
              }}
              onAdd={board.addDep} onDel={board.delDep} />

            {/* ── fin de grupo. Ver el porqué de los grupos en el comentario de arriba. */}
            <div aria-hidden style={{ height: 1, background: 'var(--border)' }} />
            {/* ⚠️ ES EL MISMO COMPONENTE QUE EN LA TAREA, a propósito: un campo que significa
                lo mismo no puede verse distinto según qué detalle abriste. Y acá es donde
                más pesa — asignar el proyecto ata a ese cliente sus N tareas de un click,
                sin escribir N filas: el cruce de Customer Success las ata POR proyecto. */}
            <CampoCliente cliente={clienteDe(proj)} onAbrir={onAsignarCliente} />
            {/* LA PORTADA, al lado del color y del emoji: las tres contestan «cómo se ve
                este proyecto» y estaban repartidas en dos lugares. */}
            {/* ⛔ ACÁ ESTABAN «PORTADA» Y «COLOR», y se fueron el 27/09/2026. Los dos se
                editan ahora DONDE SE VEN: la portada, desde la banda de arriba; y el
                color, adentro de ese mismo selector, porque el color ES la portada
                automática. Tenerlos acá obligaba a mirar una miniatura de 46 px en una
                columna para cambiar algo que ocupa el ancho entero del modal, y a
                cerrar el selector para ver el efecto de lo que acababas de elegir.
                `CampoPortada` se borró: era su único call site. */}
            {/* ELIMINAR, AL PIE DE LA COLUMNA DERECHA Y COMO TACHO: el mismo control, en el
                mismo lugar y con la misma cara que en una tarea. Lo que se borra y cuántas
                tarjetas se lleva puestas lo dice `EliminarModal` antes de confirmar, que es
                donde la consecuencia de lo irreversible tiene que estar. Un proyecto no
                tiene «completar» —se termina cuando se terminan sus tareas—, así que acá va
                un solo botón. */}
            <div style={pieAcciones}>
              <AccionIcono onClick={onDelete} tono="mal" label={`Eliminar el proyecto y sus ${suyas.length} tarea${suyas.length === 1 ? '' : 's'}`}><IconoTacho size={15} /></AccionIcono>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// nombres de los colores por defecto (en vez del hex)
// Color como DESPLEGABLE (#29): swatches en CÍRCULOS + botón "+" con anillo rainbow que

/**
 * `?diag=1` — el tablero contándote qué midió, en el navegador de quien lo está viendo.
 *
 * Existe porque hay una clase de bug que NO SE PUEDE reproducir del otro lado: depende
 * de la versión del motor, de una extensión o de un ajuste del navegador de esa persona.
 * Se perdieron dos días con «el plan está vacío» desde una Mac —header dibujado, cuerpo
 * en blanco— probando en Chrome, donde nunca falló, y hasta con WebKit headless, que es
 * varias versiones más nuevo que el Safari del cliente y tampoco lo reproduce.
 *
 * Pedirle a alguien la consola de su Mac no es una opción real. Esto sí: abre un link,
 * saca una foto. Lo que hay que mirar es el primer alto que dé 0 — ese es el que se comió
 * la pantalla.
 */
function Diagnostico() {
  const [txt, setTxt] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const medir = () => {
      const de = (sel: string, el?: Element | null) => {
        const e = el ?? document.querySelector(sel);
        if (!e) return `${sel}: (no está)`;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return `${sel}: alto=${Math.round(r.height)} ancho=${Math.round(r.width)} display=${cs.display} overflow=${cs.overflow} pos=${cs.position}`;
      };
      const main = document.querySelector('main');
      const header = main?.querySelector('header');
      const cuerpo = main ? [...main.children].find((e) => e !== header && e.tagName === 'DIV') : null;
      setTxt([
        `MaKo diag · ${new Date().toISOString().slice(0, 19)}`,
        `UA: ${navigator.userAgent}`,
        `ventana: ${window.innerWidth}x${window.innerHeight} · dpr=${window.devicePixelRatio} · zoom≈${Math.round((window.outerWidth / window.innerWidth) * 100) / 100}`,
        de('html', document.documentElement), de('body', document.body), de('main', main),
        de('header', header), de('cuerpo', cuerpo), de('vista', cuerpo?.firstElementChild),
        `tema: ${document.documentElement.getAttribute('data-tema') || '(ninguno)'} · candidato: ${document.documentElement.getAttribute('data-tema-candidato') || '(ninguno)'}`,
      ].join(String.fromCharCode(10)));
    };
    medir();
    const t = setTimeout(medir, 1200);
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); };
  }, []);
  return (
    <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 9999, maxWidth: 'min(92vw, 560px)', background: '#12151b', color: '#e8eaed', border: '1px solid #3a4150', borderRadius: 12, padding: 12, fontFamily: MONO, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: '0 18px 44px rgba(0,0,0,.35)' }}>
      {txt}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(txt).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #3a4150', background: '#1b1f27', color: '#e8eaed', fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}>
          {copiado ? '✓ copiado' : 'copiar'}
        </button>
      </div>
    </div>
  );
}
