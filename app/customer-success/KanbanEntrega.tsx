'use client';

// =============================================================================
// KanbanEntrega — en qué etapa de la entrega de UN servicio está cada cliente
// =============================================================================
// «si un CLIENTE actual llega a X etapa de mi SERVICIO (onboarding, hito 1, hito 2, o
// lo que sea que el usuario configure en su entrega de servicio…)» (Martín, 05/10/2026).
// Las columnas son las etapas de ESE servicio y las tarjetas son los clientes.
//
// ⚠️ ES POR SERVICIO Y NO POR CLIENTE, y eso lo decidió el pedido: «Todo por producto,
// siempre, justamente pueden tener muchos productos». Un cliente que compró la mentoría
// y el servicio mensual aparece en los dos tableros, en la etapa que le toca en cada uno
// — y en el CRM sigue siendo `ganado`, porque las dos etapas son simultáneas.
//
// ⚠️ LA TARJETA ES LA DE CLIENTE, LA MISMA PIEZA, no una compacta parecida. Pedido de
// Martín (05/10/2026): «dentro del kanban, las tarjetas no son como las del CRM, son
// como las nuevas que hicimos, de clientes». Antes acá había una tarjeta propia —avatar
// chico, nombre y un renglón— calcada del CRM; el reemplazo no es cosmético: la grilla
// de tarjetas DEJÓ DE EXISTIR en esta pantalla, así que si el kanban dibujara otra cosa,
// la tarjeta de cliente no se vería en ningún lado.
//
// Lo propio de esta pantalla entra por los huecos que `ClienteCard` ofrece:
// `chipExtra` (hace cuánto que no se mueve, que es de DÓNDE ESTÁ y no del cliente — la
// misma persona tiene uno distinto en cada servicio) y `antesDelNombre` (la casilla de
// selección, que es la del CRM). `accionExtra` también existe y hoy no lo usa nadie
// acá: sacar a alguien de la entrega dejó de ser un botón el día que todo cliente pasó
// a estar en alguna columna.
//
// ─────────────────────────────────────────────────────────────────────────────
// EL ARRASTRE: imagen VACÍA y la copia la dibujamos nosotros
// ─────────────────────────────────────────────────────────────────────────────
// La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
// gobierna: en Windows, Chrome la pinta semitransparente y la ancla donde quiere. Por
// eso se le pasa un canvas de 1x1 y la copia se monta a mano, con `position: fixed` y
// `translate3d` sobre un ref — nunca con `setState`, que redibujaría el tablero sesenta
// veces por segundo. Es el mismo molde que ya usa el arrastre de columnas del CRM
// (`app/crm/CrmBoard.tsx`), y está documentado en AGENTS.md.
//
// Tres detalles que, sin ellos, el gesto se ve roto:
//   · el listener de `dragover` va en `document` y EN CAPTURA: el de las columnas no
//     cubre los huecos entre ellas ni el fondo, y ahí la copia se queda clavada;
//   · se limpia en `dragend` Y en `drop`, los dos, o queda un nodo colgado por arrastre;
//   · al nodo ORIGEN no se le toca el TAMAÑO (un borde y una sombra, nada de `height: 0`):
//     colapsarlo deja el gesto sin salida.
//
// Y el auto-scroll horizontal va adentro del `dragover`: durante un arrastre nativo el
// navegador congela `requestAnimationFrame` y los timers, así que un auto-scroll sobre
// rAF mueve 0 px. ⚠️ Y ESE `dragover` ES EL DE `document`, NO EL DEL RIEL: ver
// `montarEmpuje`, que es el arreglo que el CRM ya había hecho para el mismo reporte.
//
// ─────────────────────────────────────────────────────────────────────────────
// IGUAL AL DEL PLAN (05/10/2026): lo que se comparó y lo que se cerró
// ─────────────────────────────────────────────────────────────────────────────
// «Tiene que cambiar la animación de mover tarjetas… ya tenemos animación de eso en el
// plan» (Martín). Puestos lado a lado el `Kanban` de app/plan/board/BoardShell.tsx y
// éste, las diferencias que se VEÍAN eran tres, y las tres se cerraron hacia el Plan:
//   · EL HUECO medía 230 px (el alto entero de una tarjeta de cliente), radio 18 y alfa
//     12%: cada vez que el cursor cruzaba una columna, la columna se corría un cuarto de
//     pantalla. El del Plan mide 64, radio 10, alfa 7% y anima su alto. Ahora es ése.
//   · LA COLUMNA DESTINO se teñía de azul de la casa (`primary-weak` + borde `primary`).
//     En el Plan pasa a `--surface-2` y el borde toma EL COLOR DE SU COLUMNA: el destino
//     se lee como «esta columna», no como un estado genérico. Ahora es así.
//   · EL HUECO POR CLIENTE es uno solo, en su propio renglón de la lista (un hermano de
//     las tarjetas, como el `Fragment` del Plan), y no pegado adentro del de la tarjeta
//     con un margen propio: el aire lo pone el `gap` de la lista, que es el mismo arriba
//     y abajo.
// ⛔ HASTA EL 06/10/2026 HABÍA UNA DIFERENCIA A PROPÓSITO: el hueco no seguía al cursor
// sino que iba donde la tarjeta IBA a aparecer (`dondeCae`), porque la columna no tenía
// orden propio y seguir al cursor era prometer «acá» y dejarla «allá». Martín: «si a un
// cliente lo arrastro abajo de otro, no se ve esa animación», y al preguntarle si esa
// posición se guarda: «Se guarda + "Manual"». Ahora la columna TIENE orden
// (`cliente_entrega_orden`, mig 0196) y el hueco sigue al cursor como en el Plan y el CRM
// (./orden-manual.ts). Soltar ahí es donde queda, y «Ordenar» pasa a «Manual».
// Lo que ya era igual y no se tocó: la copia (el MISMO hook), la tarjeta de origen sin
// ningún cambio, el `dragover` como único reloj del auto-scroll, y la limpieza en
// `dragend` Y en `drop`. Lo que el Plan tiene y acá NO: el arrastre con el DEDO
// (`arrastre-tactil.ts`), que está tipado contra las bandas de prioridad del Plan.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA SELECCIÓN Y EL ARRASTRE EN LOTE
// ─────────────────────────────────────────────────────────────────────────────
// La casilla es LA DEL CRM, la misma pieza y la misma regla (`.mk-sel-tarjeta`, en
// app/globals.css): «copia la animación de aparición del checkbox para la selección de
// múltiples tarjetas que hizo el CRM… aparece detrás del título y desplaza el título
// cuando paso el cursor» (Martín, 05/10/2026). En reposo mide CERO —el nombre no está
// corrido—, al pasar el cursor crece a 15 px y empuja el nombre, y marcada se queda a
// la vista. Entra adelante del nombre por el slot `antesDelNombre` de la tarjeta.
//
// ⛔ ANTES ERA UNA PASTILLA ABSOLUTA ENCIMA DE LA BANDA, con una clase en el contenedor
// que la mostraba en TODAS las tarjetas mientras hubiera algo marcado (la regla del
// Plan). Se fue entera con el pedido: la del CRM sólo se ve en la tarjeta del cursor y en
// las marcadas.
//
// La selección vive AFUERA (la guarda la pantalla), porque es UNA para el kanban y la
// tabla: conmutar de vista no la pierde.
//
// ⚠️ Arrastrar una tarjeta MARCADA, con más de una marcada, se lleva a todas
// (`quienesViajan`), y la copia lo dice con el número en la esquina. Arrastrar una que no
// está marcada se lleva sólo a ésa.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ClienteCruce } from './cruce';
import type { CuentasProp } from './CuentaDeMaKo';
import type { ResumenTrabajo } from './trabajo';
import { ClienteCard } from './ClienteCard';
import { columnasVisibles } from './BarraClientes';
import { repartirEnEtapas, colorDeEtapa, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';
import { tiempoEnEtapa } from './en-etapa';
// ⚠️ EL MISMO MOLDE QUE EL PLAN, no una copia. «La animación de arrastrar tarjetas por
// el kanban, eso replicalo tal cual de como lo hacemos en PLAN» (Martín, 05/10/2026).
// Estaba inline en `BoardShell.tsx` y salió a su módulo para que las dos pantallas usen
// la misma pieza: todo lo que ahí está medido —la foto que pinta el sistema operativo,
// el `transform` sobre un ref, el listener en captura, el auto-scroll adentro del
// `dragover`— viajó con el código en vez de volver a escribirse.
import { fotoVaciaDeArrastre, useArrastreCopia } from '@/app/plan/board/arrastre-copia';
import { quienesViajan } from './LoteClientes';
import { indiceEnColumna, antesDeQuien } from './orden-manual';

/** Dónde está un cliente en esta entrega. */
export type Asignacion = { etapa: string; etapa_desde: string; por: string };

// ⛔ ACÁ VIVÍAN `hace()` Y `DIAS_TRABADO`, sin exportar. La tabla necesitaba la MISMA
// respuesta («hace cuánto está en su etapa» y «desde cuándo es trabado»), así que se
// mudaron a `./en-etapa` (05/10/2026): con dos copias, la tarjeta y la fila del mismo
// cliente podían decir dos cosas distintas, y la regla de los 21 días vivía dos veces.

export function KanbanEntrega({
  etapas, fases, fase, origen, servicio, clientes, asignacion, numeroDe,
  trabajoDe, tableroOk, cuentas,
  onSoltar, onAbrir, onEquipo, onNuevoCliente, onError,
  seleccion, onSeleccion,
}: {
  etapas: EtapaEntrega[];
  /**
   * Los TRAMOS del programa, que le dan su color a las columnas de cada uno.
   *
   * «En todo programa existen "fases", por ejemplo, Fase 1: "Cimientos" y dentro están
   * las etapas» (Martín, 05/10/2026). Vacío es el caso normal y no cambia nada de lo que
   * se dibuja: sin fases, cada columna usa su color propio.
   */
  fases: FaseEntrega[];
  /**
   * QUÉ FASE SE ESTÁ MIRANDO. `null` = todas, `''` = las columnas sueltas.
   *
   * ⚠️ LO ELIGE LA PANTALLA, NO EL TABLERO. Hasta el 05/10/2026 era una fila de chips
   * arriba del riel («Todas 14 · Inicio 14 · Contexto y Norte 0 · …»), con su estado acá
   * adentro; Martín: «como terminaron siendo muchas fases, es mejor que lo pongas como un
   * filtro directamente, porque no queda bien que estén todos esos botones». Ahora es una
   * sección más de «Filtrar» (BarraClientes), y el valor llega ya VIGENTE (`faseVigente`):
   * una fase que no existe en este servicio llega como `null`, así que el riel nunca queda
   * en blanco por mirar una fase de otro servicio.
   */
  fase: string | null;
  /** `default` = nadie configuró estas columnas. La pantalla lo DICE. */
  origen: 'declarado' | 'default';
  servicio: string;
  /** La cartera que la barra dejó a la vista, ya buscada y filtrada. */
  clientes: ClienteCruce[];
  /** leadId → su etapa en ESTE servicio. Lo que no está acá, no está en la entrega. */
  asignacion: Record<number, Asignacion>;
  numeroDe: Map<number, number>;
  /** Los tres números del tablero que la tarjeta pinta al pie. */
  trabajoDe: (leadId: number) => ResumenTrabajo | null;
  /** Con el tablero caído la tarjeta pone un renglón en vez de tres ceros: un 0 es una
   *  afirmación sobre su trabajo, y si la lectura falló nadie la hizo. */
  tableroOk: boolean;
  cuentas?: CuentasProp;
  /**
   * Se soltó lo que viajaba en ESA columna, ANTES de ese cliente (`null` = al final).
   *
   * ⚠️ UN SOLO CALLBACK PARA MOVER Y REORDENAR (06/10/2026): soltar en otra columna es un
   * movimiento de etapa Y un lugar en la columna nueva, y soltar en la misma es sólo el
   * lugar. Las dos cosas las decide la pantalla, que es la que tiene la columna ENTERA (este
   * tablero ve sólo lo que el buscador dejó) y el deshacer. Un lote viaja junto: lo que la
   * persona decidió es la selección entera.
   */
  onSoltar: (leadIds: number[], etapa: string, antesDe: number | null) => void;
  onAbrir: (leadId: number) => void;
  onEquipo: (leadId: number) => void;
  /**
   * Crear un cliente, naciendo en ESA etapa.
   *
   * ⚠️ RECIBE LA ETAPA, y no es un detalle: un botón de alta por columna que crea
   * siempre en la primera es un control que promete algo que no hace. La etapa viaja
   * para que el alta termine donde se apretó.
   */
  onNuevoCliente: (etapa: string) => void;
  onError: (m: string) => void;
  /** Los clientes marcados. Vive AFUERA: es la misma selección que la tabla. */
  seleccion: ReadonlySet<number>;
  onSeleccion: (next: Set<number>) => void;
}) {
  /**
   * Lo que está en la mano, EN UN REF: qué clientes viajan (el agarrado, o el lote).
   *
   * ⚠️ UN REF Y NO UN ESTADO, y está medido: React vuelca un `setState` un frame
   * después, y los handlers del gesto corren ANTES. Con la decisión colgada de un estado,
   * el primer `dragover` leía `null`, no hacía `preventDefault()` y el `drop` no llegaba
   * nunca (05/10/2026). Es la misma familia que la foto del arrastre, que sale opaca
   * aunque atenúes la tarjeta en el mismo handler.
   *
   * ⛔ ACÁ HABÍA ADEMÁS UN `agarrado` EN ESTADO, «para pintar», y no pintaba nada: la
   * clase que lo iba a usar no estaba puesta en ninguna tarjeta. Se fue con su regla de
   * la hoja. Lo que se pinta durante el gesto es el hueco y la columna destino, y los dos
   * salen de `ins`.
   */
  const enMano = useRef<{ ids: number[] } | null>(null);
  /**
   * DÓNDE VA A CAER: la columna Y el índice exacto. Sólo se repinta cuando CAMBIA.
   *
   * ⚠️ ES LO QUE CONVIERTE «la estoy soltando en esta columna» EN «la estoy soltando
   * ACÁ». Desde el 06/10/2026 el índice sale de la ALTURA DEL CURSOR, como en el CRM y en el
   * Plan («si a un cliente lo arrastro abajo de otro, no se ve esa animación»): la columna
   * tiene orden manual y soltar ahí es donde la tarjeta queda (./orden-manual.ts).
   */
  const [ins, setIns] = useState<{ etapa: string; idx: number } | null>(null);
  /**
   * LOS PUNTOS MEDIOS DE LAS TARJETAS DE CADA COLUMNA, MEDIDOS UNA VEZ AL AGARRAR y en
   * coordenadas del CONTENIDO (página + scroll de la columna).
   *
   * ⚠️ UNA VEZ: leer el layout de las tarjetas en cada `dragover` es lo que el Plan pagó siete
   * veces (el gesto se siente pegajoso), y además con el hueco abierto las tarjetas de abajo se
   * corren: medidas en vivo, el índice oscilaría entre dos valores.
   * ⚠️ DEL CONTENIDO: cada columna tiene su scroll y el auto-scroll del gesto lo mueve. Lo medido
   * contra la ventana apuntaría a otra tarjeta después de correr la columna; el `dragover`
   * suma lo mismo del otro lado, así que la comparación se sostiene (la cuenta del CRM).
   */
  const medios = useRef<Record<string, number[]>>({});
  const riel = useRef<HTMLDivElement | null>(null);

  // ⛔ ACÁ VIVÍA EL ESTADO DE LA FASE (`fasePedida` y su `faseVista` derivada), y se mudó
  // a la pantalla con los chips (05/10/2026): el filtro ahora está en «Filtrar», que es de
  // la barra, y la barra no es hija de este tablero. Las dos reglas que cuidaba viajaron
  // con él a `faseVigente` (BarraClientes): una fase que ya no existe cuenta como
  // «todas», y es UNA fase a la vez con un «Todas» de verdad.

  /**
   * Cómo se SUELTA el empuje horizontal del gesto en curso, o `null` si no hay ninguno.
   * Un ref y no un estado por lo mismo que `enMano`: lo monta el `dragstart`, y un estado
   * se aplicaría un frame después de que el primer `dragover` ya pasó.
   */
  const quitarEmpuje = useRef<(() => void) | null>(null);
  // Si el tablero se desmonta a mitad de un arrastre (cambiar de vista con el teclado, un
  // `revalidatePath` que cambia de servicio), el listener de `document` no puede quedar
  // vivo empujando un riel que ya no existe.
  useEffect(() => () => quitarEmpuje.current?.(), []);

  /**
   * Cada cliente en su columna.
   *
   * ⚠️ UN CLIENTE SIN FILA ESTÁ EN LA PRIMERA, no afuera del tablero: la regla y su
   * porqué viven en `repartirEnEtapas`. Acá lo que importa es que el reparto NO se
   * escribe dos veces — el editor de etapas cuenta con la misma función, y si una de
   * las dos supiera la regla y la otra no, el editor diría «0 en Onboarding» sobre una
   * columna con catorce tarjetas a la vista.
   */
  const { porEtapa, huerfanos } = useMemo(
    () => repartirEnEtapas(etapas, clientes, (c) => asignacion[c.leadId]?.etapa),
    [etapas, clientes, asignacion],
  );

  /**
   * LAS COLUMNAS QUE SE DIBUJAN. El filtro por fase es del RENDER, no del reparto.
   *
   * ⚠️ POR ESO `repartirEnEtapas` SIGUE RECIBIENDO LAS ETAPAS ENTERAS. Pasarle la lista
   * filtrada haría que todos los clientes de las columnas escondidas salieran como
   * HUÉRFANOS, y el pie del tablero anunciaría «12 clientes están en una etapa que ya no
   * existe» — una afirmación falsa, producida por mirar una fase.
   *
   * ⚠️ Y QUÉ COLUMNAS SON «DE LA FASE» LO DECIDE `columnasVisibles`, la MISMA función con
   * la que el filtro arma sus opciones. Con dos reglas pasaba esto: «Sin fase» se ofrecía
   * por una columna que apuntaba a una fase BORRADA y el riel la filtraba por
   * `e.fase === ''`, o sea que elegirla dejaba el tablero en blanco.
   */
  const visibles = columnasVisibles(etapas, fases, fase);

  // ── El gesto ───────────────────────────────────────────────────────────────

  /** Al agarrar: los puntos medios de TODAS las columnas, una sola vez (ver `medios`). */
  function medirColumnas() {
    const out: Record<string, number[]> = {};
    for (const col of riel.current?.querySelectorAll<HTMLElement>('[data-etapa]') ?? []) {
      const cuerpo = col.querySelector<HTMLElement>('[data-cuerpo]');
      const dy = window.scrollY + (cuerpo?.scrollTop ?? 0);
      out[col.dataset.etapa ?? ''] = [...(cuerpo?.querySelectorAll<HTMLElement>('[data-tarjeta]') ?? [])]
        .map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 + dy; });
    }
    medios.current = out;
  }

  /**
   * La copia que sigue al cursor sale del molde del Plan. LOS DOS EMPUJES se quedan acá, y
   * `empujarScroll` del hook NO se usa a propósito:
   *
   * · el HORIZONTAL es del riel, y `scrollerDe` sólo mira `overflowY` — un riel
   *   `overflow-x: auto` no es un scroller para él y devuelve la ventana (y escucha en
   *   `document`, no en el riel: ver `montarEmpuje`);
   * · el VERTICAL es de la columna BAJO EL CURSOR, y `scrollerDe` resuelve el scroller UNA
   *   vez en el `dragstart`, con la tarjeta de ORIGEN: en el Plan eso es la página (o el
   *   cuerpo del modal) y da igual, pero acá cada columna tiene su propio scroll, así que
   *   empujaría la columna de la que salió la tarjeta en vez de la que se está mirando.
   */
  const { pararScroll, montarCopia, soltarCopia } = useArrastreCopia();

  function agarrar(e: React.DragEvent<HTMLElement>, leadId: number) {
    // ⚠️ SÓLO SI EL GESTO NACIÓ ADENTRO DE ESTA TARJETA EN EL DOM. Un portal saca el nodo
    // del DOM pero no del árbol de React, y los eventos sintéticos suben por el árbol: un
    // texto arrastrado en el email del modal de «Abrir cuenta» (que se monta desde la
    // tarjeta y se portalea al body) llegaba acá y clonaba la tarjeta como si la agarraran.
    if (!e.currentTarget.contains(e.target as Node)) return;
    const tarjeta = e.currentTarget.closest<HTMLElement>('[data-tarjeta]');
    if (!tarjeta) return;
    const ids = quienesViajan(leadId, seleccion, clientes.map((c) => c.leadId));
    enMano.current = { ids };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(leadId));
    fotoVaciaDeArrastre(e.dataTransfer);

    const r = tarjeta.getBoundingClientRect();
    /**
     * ⚠️ CON VARIOS EN LA MANO, LA COPIA LLEVA EL NÚMERO. Sin eso se agarra una tarjeta,
     * se suelta, y se mueven cinco: un gesto que hace más de lo que muestra se lee como un
     * error. El número se cuelga del ORIGEN, `montarCopia` lo clona junto con la tarjeta
     * (es síncrono) y se descuelga en el mismo tick — el navegador no llega a pintar el
     * origen con él, así que la tarjeta de origen sigue sin cambiar nada, que es la regla.
     * Es DOM directo a propósito: un estado de React se pintaría un frame tarde, después
     * de la foto (la trampa de siempre del `dragstart`).
     */
    let marca: HTMLElement | null = null;
    if (ids.length > 1) {
      marca = document.createElement('span');
      marca.className = 'ke-lleva';
      marca.textContent = String(ids.length);
      marca.setAttribute('aria-hidden', 'true');
      tarjeta.appendChild(marca);
    }
    try { montarCopia(tarjeta, e.clientX - r.left, e.clientY - r.top); }
    finally { marca?.remove(); }
    montarEmpuje();
    medirColumnas();
  }

  function soltarGesto() {
    enMano.current = null;
    medios.current = {};
    setIns(null);
    pararScroll();
    soltarCopia();
    quitarEmpuje.current?.();
  }

  /**
   * EL EMPUJE HORIZONTAL DEL RIEL VIVE EN `document` Y EN CAPTURA, no en el riel.
   *
   * ⚠️ «Te pasó lo mismo que al CRM, si intento desplazar una tarjeta… si lo muevo muy al
   * costado, se sale del contenedor del kanban y deja de desplazar, eso no debe pasar»
   * (Martín, 05/10/2026). Y era exactamente lo del CRM: el empuje colgaba del `onDragOver`
   * del DIV que scrollea, así que en cuanto el cursor salía de su caja —pasando el borde
   * de la derecha, por la barra lateral, o por arriba y por abajo del riel— el navegador
   * dejaba de mandarle `dragover` y el tablero se frenaba en seco. Lo incómodo es justo el
   * caso en que más falta hace: para llegar a una columna que está fuera de la vista hay
   * que llevar el cursor AL borde, y el borde es donde el evento se cortaba.
   *
   * El arreglo es el del CRM (`empujeDelRiel` en app/crm/CrmBoard.tsx, commit abbb7a12):
   * la cuenta no cambia —pasado el borde, `clientX < left + BORDE` sigue siendo
   * verdadera—; lo único que cambia es que el evento LLEGUE. Es la regla que AGENTS.md ya
   * tenía para la copia que sigue al cursor, aplicada al otro efecto del mismo gesto.
   *
   * ⚠️ VA ADENTRO DEL `dragover` Y NO EN UN rAF NI UN TIMER: durante un arrastre nativo el
   * navegador congela los dos (medido: 0 px en 1,2 s sobre el borde). Lo único que sigue
   * entregando es este evento, y llega aunque el cursor esté quieto.
   *
   * ⚠️ SE MONTA EN EL `dragstart` Y NO EN UN EFECTO, a diferencia del CRM: allá el gesto
   * vive en un estado (`dragId`) y acá en un ref (`enMano`, ver arriba por qué), y un ref
   * no dispara efectos. Se suelta en `dragend` Y en `drop`, los dos —y en `soltarGesto`, y
   * al desmontar—, o queda empujando el riel después de soltar.
   *
   * ⚠️ EL EMPUJE QUEDA EN UN SOLO LUGAR: el riel ya no tiene `onDragOver`. Con los dos, el
   * tablero correría al DOBLE de velocidad con el cursor encima y a velocidad normal apenas
   * sale, que se siente como un tirón.
   *
   * ⚠️ Y ESTE `dragover` NO LLEVA `preventDefault()`: eso habilitaría soltar sobre
   * CUALQUIER punto de la página, incluida la barra lateral, y ahí soltar tiene que seguir
   * sin hacer nada. Lo que habilita el drop son las columnas, y sólo ellas.
   *
   * El empuje VERTICAL no se muda: es de la columna que está bajo el cursor, y fuera de
   * una columna no hay ninguna que empujar.
   */
  function montarEmpuje() {
    quitarEmpuje.current?.();
    const empujeDelRiel = (e: DragEvent) => {
      const el = riel.current;
      if (!el || enMano.current == null) return;
      const r = el.getBoundingClientRect();
      const BORDE = 110;
      const dir = e.clientX < r.left + BORDE ? -1 : e.clientX > r.right - BORDE ? 1 : 0;
      if (dir !== 0) el.scrollLeft += dir * 18;
    };
    /**
     * ⚠️ EL `dragenter` SE ACEPTA ADENTRO DE UNA COLUMNA, o soltar ENCIMA DEL HUECO se puede
     * perder. Desde el 06/10 el hueco sigue al cursor, así que aparece JUSTO DEBAJO de él: el
     * elemento bajo el cursor cambia sin que el mouse se mueva, y en esa vuelta Chromium
     * dispara `dragenter` y NO `dragover`; si el `dragenter` no se canceló, soltar ahí no llega.
     * Lo midió el agente del editor de etapas en el arnés (0 de 2 drops sobre el hueco sin esto,
     * 2 de 2 con esto) y el kanban abre su hueco de la misma forma.
     * Sólo adentro de `[data-etapa]`: aceptarlo en toda la página no habilita soltar (eso lo
     * decide el `dragover` de la columna), pero tampoco tiene por qué.
     */
    const aceptarEntrada = (e: DragEvent) => {
      if (enMano.current == null) return;
      if ((e.target as Element | null)?.closest?.('[data-etapa]')) e.preventDefault();
    };
    const fin = () => {
      document.removeEventListener('dragover', empujeDelRiel, true);
      document.removeEventListener('dragenter', aceptarEntrada, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      if (quitarEmpuje.current === fin) quitarEmpuje.current = null;
    };
    document.addEventListener('dragenter', aceptarEntrada, true);
    document.addEventListener('dragover', empujeDelRiel, true);
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    quitarEmpuje.current = fin;
  }

  /**
   * El empuje VERTICAL, DENTRO de la columna que está bajo el cursor.
   *
   * ⚠️ HACE FALTA DESDE QUE LA COLUMNA TIENE SU PROPIO SCROLL. «La tab NO tiene que tener
   * scroll, las columnas tienen su scroll propio» (Martín, 05/10/2026): con el cuerpo
   * recortado, una columna de veinte tarjetas tiene la mitad fuera de la vista y sin esto
   * no hay forma de soltar ahí — el gesto queda sin salida, igual que el tablero del Plan
   * con 19.630 px de alto y sin auto-scroll.
   */
  function empujarColumna(cuerpo: HTMLElement | null, clientY: number) {
    if (!cuerpo || cuerpo.scrollHeight <= cuerpo.clientHeight + 1) return;
    const r = cuerpo.getBoundingClientRect();
    const BORDE = 64;
    const dir = clientY < r.top + BORDE ? -1 : clientY > r.bottom - BORDE ? 1 : 0;
    if (dir !== 0) cuerpo.scrollTop += dir * 18;
  }

  /**
   * Soltar en una columna. El índice es el del hueco que se estaba dibujando (lo último que
   * vio la persona); sin hueco en esa columna —soltar sin haber pasado por un `dragover` de
   * ella—, al final.
   *
   * ⚠️ EL ÍNDICE SE LEE ANTES DE `soltarGesto()`, que borra el hueco. Y sale del estado de ESTE
   * render: el `dragover` que lo puso ya re-renderizó, así que el handler lo ve.
   *
   * Qué se mueve y si cambió algo lo decide la pantalla (`onSoltar`): soltar donde ya estaba
   * no es un cambio y no se guarda ni se anuncia (`mismaLista`).
   */
  function soltarEn(key: string) {
    const mano = enMano.current;
    const idx = ins?.etapa === key ? ins.idx : Number.MAX_SAFE_INTEGER;
    soltarGesto();
    if (!mano) return;
    const dibujadas = (porEtapa[key] ?? []).map((c) => c.leadId);
    onSoltar(mano.ids, key, antesDeQuien(dibujadas, idx, mano.ids));
  }

  /** Marcar o desmarcar uno. La selección se devuelve ENTERA: la guarda la pantalla. */
  function alternar(leadId: number) {
    const n = new Set(seleccion);
    if (n.has(leadId)) n.delete(leadId); else n.add(leadId);
    onSeleccion(n);
  }

  if (!etapas.length) {
    // No puede pasar —`entregaPorDefecto` nunca devuelve `[]`— y si pasara, un tablero
    // de cero columnas no se puede dibujar y hay que decirlo en vez de mostrar nada.
    return <p className="ke-nada">Este servicio no tiene etapas de entrega configuradas.</p>;
  }

  return (
    <div className="ke">
      {/* ⛔ ACÁ HUBO UNA CABECERA Y YA NO HAY NINGUNA (05/10/2026). Se fueron, en este
          orden: «N de M clientes en esta entrega» —que dejó de tener sentido el día que
          TODOS los clientes entran al tablero—, «Etapas de ejemplo · Define las tuyas»
          —una glosa arriba del tablero sobre algo que se arregla en otro lado—, un
          «＋ Nuevo cliente» —que ahora vive en cada columna y además dice en qué etapa
          nace— y «Editar etapas», que se mudó al LÁPIZ del desplegable de servicios: ahí
          edita las etapas de CUALQUIERA de los servicios, no sólo del que estás mirando.
          Un renglón entero para un solo link era, además, el único que separaba la barra
          del tablero. */}
      {/* ⛔ ACÁ IBAN LOS CHIPS DE FASE, y se fueron a «Filtrar» (05/10/2026). Estaban
          arriba del riel con el porqué de que eran «una propiedad del TABLERO y no un
          filtro de la cartera»; Martín los descartó por la cantidad, no por el criterio:
          «como terminaron siendo muchas fases, es mejor que lo pongas como un filtro
          directamente». Con ocho fases eran ocho botones en su propio renglón. */}

      {/* ⚠️ SIN `onDragOver`: el empuje horizontal escucha en `document` (`montarEmpuje`),
          porque el del riel se cortaba apenas el cursor salía de su caja. */}
      <div className="ke-riel" ref={riel}>
        {visibles.map((e) => {
          const cards = porEtapa[e.key] ?? [];
          const color = colorDeEtapa(e, fases);
          const destino = ins?.etapa === e.key;
          /* EL HUECO: un recuadro punteado en el índice exacto donde va a caer y SÓLO en
             la columna bajo el cursor. Es la pieza del Plan tal cual —64 px, radio 10,
             el color de su columna con alfa 7% (`12` hex) y el alto animado— y va en su
             propio renglón de la lista, como el `Fragment` del Plan: el aire lo pone el
             `gap`, igual arriba y abajo.
             ⚠️ El sufijo `12` es alfa HEX y sólo funciona con hex de 6 dígitos: `dot` lo
             es (lib/servicio-etapas.ts). Con un `rgb()` o un `var()` el color sale
             inválido y el navegador lo descarta en silencio. */
          const hueco = (i: number) => (destino && ins?.idx === i
            ? <li key={`hueco-${i}`} aria-hidden><div className="ke-hueco" style={{ borderColor: color, background: `${color}12` }} /></li>
            : null);
          return (
            <section key={e.key}
              data-etapa={e.key}
              className={`ke-col${destino ? ' ke-col-destino' : ''}`}
              /* ⚠️ LA LÍNEA DE ARRIBA SALE DE LA ETAPA, no de una banda. El CRM la saca de
                 `CATEGORY[bandToCategory(c.band)]`, que son TRES colores (avanza / nutre /
                 sale); una etapa de entrega no tiene banda —a propósito: acá no hay
                 nutrición ni descarte— así que copiado tal cual pintaría las cinco columnas
                 del mismo verde. `dot` ya es un color por etapa y es el mismo que el punto
                 de la cabecera, así que la línea y el punto no pueden desincronizarse.

                 ⚠️ Y SALE DE `colorDeEtapa`, no de `e.dot`: el color de la FASE le gana al
                 propio, y quién gana se decide en UNA función. Leyendo `e.dot` acá, las
                 columnas de una fase quedarían con cinco colores distintos y agrupar no se
                 vería — que es exactamente lo que las fases vienen a mostrar. */
              /* ⚠️ EL DESTINO SE MARCA COMO EN EL PLAN: el fondo pasa a `--surface-2` (la
                 clase) y el borde toma el color DE ESTA COLUMNA, no el azul de la casa. Los
                 tres lados por separado y no `borderColor`: ese atajo pisa también el de
                 arriba, y React avisa cuando se mezclan atajo y lados en el mismo objeto. */
              style={{ borderTop: `3px solid ${color}`, ...(destino ? { borderLeftColor: color, borderRightColor: color, borderBottomColor: color } : null) }}
              /* `preventDefault` es lo que HABILITA el drop: sin él el navegador lo
                 rechaza y no pasa nada, que se lee como que el arrastre no anda.
                 ⚠️ Y SE HABILITA TAMBIÉN EN LA COLUMNA DE ORIGEN, que desde el 06/10 abre su
                 hueco igual que las otras: soltar ahí REORDENA (orden manual). Antes no
                 movía a nadie y se habilitaba igual, porque con el drop rechazado el sistema
                 dibuja el cursor de «prohibido» apenas se agarra la tarjeta. */
              onDragOver={(ev) => {
                const mano = enMano.current;
                if (mano == null) return;
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                const cuerpo = ev.currentTarget.querySelector<HTMLElement>('[data-cuerpo]');
                empujarColumna(cuerpo, ev.clientY);
                // La altura del cursor en las MISMAS coordenadas en que se midió (`medios`).
                const y = ev.clientY + window.scrollY + (cuerpo?.scrollTop ?? 0);
                const idx = indiceEnColumna(medios.current[e.key] ?? [], y);
                // Y sólo se re-renderiza cuando el destino cambia DE VERDAD.
                setIns((p) => (p && p.etapa === e.key && p.idx === idx ? p : { etapa: e.key, idx }));
              }}
              onDragLeave={(ev) => {
                if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) {
                  setIns((p) => (p?.etapa === e.key ? null : p));
                }
              }}
              onDrop={(ev) => { ev.preventDefault(); soltarEn(e.key); }}
            >
              <header className="ke-cab">
                <span className="ke-dot" style={{ background: color }} aria-hidden />
                <span className="ke-label">{e.label}</span>
                <span className="ke-n">{cards.length}</span>
              </header>

              {/* ⚠️ CREAR VIVE EN CADA COLUMNA, como «＋ Nuevo lead» en el CRM. Antes era
                  «Sumar un cliente» y SÓLO en la primera, porque un cliente podía estar
                  afuera del tablero; desde que todos están adentro, «sumar» no existe como
                  acción — lo que falta es dar de alta a uno nuevo, y desde una columna eso
                  dice además en qué etapa nace. */}
              <button type="button" className="ke-nuevo-col" onClick={() => onNuevoCliente(e.key)}>
                ＋ Nuevo cliente
              </button>

              <ul className="ke-cards" data-cuerpo>
                {hueco(0)}
                {cards.map((c, iCard) => {
                  const a = asignacion[c.leadId];
                  const t = tiempoEnEtapa(a?.etapa_desde);
                  const desde = t?.frase ?? null;
                  const trabado = t?.trabado ?? false;
                  const elegida = seleccion.has(c.leadId);
                  const nombre = c.nombre.trim() || 'Sin nombre';
                  return (
                    <Fragment key={c.leadId}>
                    <li>
                      {/* ⚠️ EL `draggable` VA EN EL ENVOLTORIO Y NO EN LA TARJETA.
                          `TarjetaEntidad` cubre su superficie con un `<button>` absoluto
                          y pone todo lo demás en `pointer-events: none`. Medido en el
                          navegador: el `dragstart` igual burbujea desde ese botón hasta
                          acá, así que el gesto arranca; lo que NO viaja es el cursor, y
                          por eso la hoja de abajo le pone `grab` a mano. */}
                      {/* ⚠️ AL NODO ORIGEN NO SE LE HACE NADA, y es una decisión medida del
                          Plan, no un olvido: se probaron `opacity: .5`, un borde de color y
                          un `scale`, y los tres se reportaron como ruido — con la copia
                          siguiendo al cursor Y el hueco marcando el destino, atenuar el
                          original hace aparecer la misma tarjeta tres veces. */}
                      {/* ⚠️ `mk-tarjeta-sel` ES LO QUE REVELA LA CASILLA AL PASAR EL CURSOR:
                          es el gancho genérico de la regla `.mk-sel-tarjeta` en globals.css,
                          el mismo que usa el Plan. No hay un selector propio de esta pantalla
                          a propósito — dos selectores para la misma animación son dos lugares
                          que tocar el día que cambie. */}
                      <div data-tarjeta className={`ke-card mk-tarjeta-sel${elegida ? ' ke-card-elegida' : ''}`}
                        draggable
                        onDragStart={(ev) => agarrar(ev, c.leadId)}
                        onDragEnd={soltarGesto}
                      >
                        <ClienteCard
                          c={c} n={numeroDe.get(c.leadId) ?? 0}
                          trabajo={trabajoDe(c.leadId)} tableroOk={tableroOk}
                          cuentas={cuentas} onError={onError}
                          onAbrir={() => onAbrir(c.leadId)}
                          onEquipo={() => onEquipo(c.leadId)}
                          /* LA CASILLA DEL CRM, tal cual (CrmBoard.tsx, la tarjeta del lead):
                             adelante del nombre y en su renglón, de ancho 0 hasta el hover.
                             · `onClick` con `stopPropagation` y no `onChange`: el click en la
                               tarjeta ABRE la ficha, y tildar no puede abrir nada. (Acá la
                               ficha la abre `.cl-abrir`, que no es ancestro de la casilla, así
                               que el click no le llega; el freno queda por el envoltorio
                               arrastrable y por lo que se le cuelgue mañana.)
                             · `onPointerDown` frenado: la tarjeta entera es `draggable`.
                             · `data-marcada`: tildada sigue a la vista sin el cursor encima,
                               o la barra de lote diría «3» sin forma de saber cuáles.
                             · ⚠️ SIN `width` EN EL STYLE: lo gobierna la clase, que lo lleva de
                               0 a 15. Un ancho en línea le gana y deja el nombre corrido por
                               defecto, con la opacidad animando — se ve arreglado sin estarlo.
                             Los clicks le llegan porque el slot de la tarjeta se los devuelve
                             (`.cl-n-antes`): el resto del contenido va en `pointer-events: none`. */
                          antesDelNombre={
                            <input type="checkbox" checked={elegida}
                              className="mk-sel-tarjeta"
                              data-marcada={elegida ? '1' : '0'}
                              onPointerDown={(ev) => ev.stopPropagation()}
                              onClick={(ev) => { ev.stopPropagation(); alternar(c.leadId); }}
                              onChange={() => { /* lo hace el onClick: ver arriba */ }}
                              title={elegida ? `Quitar «${nombre}» de la selección` : `Seleccionar «${nombre}»`}
                              aria-label={elegida ? `Quitar «${nombre}» de la selección` : `Seleccionar «${nombre}»`}
                              style={{ height: 15, marginTop: 2, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
                          }
                          chipExtra={desde && (
                            <span className={`ke-chip${trabado ? ' ke-chip-trabado' : ''}`}>
                              {trabado ? `${desde.replace(/^hace /, '')} sin moverse` : desde}
                            </span>
                          )}
                        />
                      </div>
                    </li>
                    {hueco(iCard + 1)}
                    </Fragment>
                  );
                })}
              </ul>
              {/* ⛔ ACÁ DECÍA «Sin clientes.» y se fue (Martín, 05/10/2026). El contador de
                  la cabecera ya dice 0 en el mismo renglón que el nombre, así que el
                  renglón repetía el único dato que había y le robaba el lugar al único que
                  importa en una columna vacía: que ahí se puede soltar una tarjeta. */}
            </section>
          );
        })}
      </div>

      {/* ⚠️ LOS HUÉRFANOS NO SE CALLAN: ver la nota de arriba. */}
      {huerfanos.length > 0 && (
        <p className="ke-huerfanos">
          {huerfanos.length === 1 ? 'Un cliente está' : `${huerfanos.length} clientes están`} en una etapa
          que ya no existe: {huerfanos.map((c) => c.nombre.trim() || 'Sin nombre').join(', ')}. Muévelos a una columna.
        </p>
      )}

      {/* La hoja de la tarjeta la monta la PANTALLA (ClientesApp), no este tablero: la
          vista de tabla también la necesita. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

const CSS = `
.ke { display: flex; flex-direction: column; gap: 10px; min-height: 0; }

.ke-arriba { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ke-cuenta { font-size: 12.5px; color: var(--dim); }
.ke-default { font-size: 12.5px; color: var(--dim); }
.ke-default button, .ke-editar {
  background: none; border: none; padding: 0; font: inherit; color: var(--accent-ink);
  font-weight: 600; cursor: pointer; text-decoration: underline;
}
.ke-editar { margin-left: auto; }
.ke-nuevo {
  flex: none; padding: 6px 12px; border-radius: 9px; border: 1px solid var(--border-strong);
  background: var(--surface); color: var(--ink); cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap;
}
.ke-nuevo:hover { border-color: var(--ink); }

/* El riel scrollea en horizontal: es CONTENIDO que se corre, no navegación. */
.ke-riel {
  display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden;
  padding-bottom: 6px; align-items: flex-start; scrollbar-width: thin;
}
/* ⚠️ EL FONDO ES --surface (BLANCO) Y LA TARJETA PASA A --surface-2, igual que en el
   CRM y al revés de como estaba. «Copia el estilo de las columnas... Que no sean
   transparentes» (Martín, 05/10/2026) — y no eran transparentes: la columna estaba en
   --surface-2 (#F5F7FA) sobre un --bg de #F4F6F9, o sea UNA unidad por canal. Tenía
   fondo, y era el mismo fondo de la página. No es transparencia, es contraste cero, y
   sólo pasa en el tema claro por defecto: en oscuro y en true-north los dos tokens sí se
   distinguen. Dar vuelta el par es lo que lo arregla en los tres a la vez.
   ⚠️ Y EL MINIMO DE ALTO ES UNA TARJETA: una columna vacia es un DESTINO, y con 140 px
   era un recuadro mas chico que lo que se le quiere soltar adentro.
   ⚠️ EL ANCHO LO DECIDE LA TARJETA, no el gusto. La de cliente mide 230 px de alto y
   su pie son TRES números con sus rótulos; medido en el navegador, «Recurrentes» entra
   desde los 258 px, y a 300 la banda de 74 px y la marca montada encima quedan en
   proporción en vez de parecer una tarjeta apretada. Con 300 entran cuatro columnas en
   1480; el riel scrollea, que es contenido corriéndose y no navegación escondida. */
/* ⚠️ EL TOPE DE ALTO ES LO QUE SACA EL SCROLL DE LA TAB. «La tab NO tiene que tener
   scroll, las columnas tienen su scroll propio. La tab si debe tener scroll de izquierda a
   derecha» (Martin, 05/10/2026). Son 68vh, el mismo numero que el tablero del CRM, y el
   recorte vive en la COLUMNA y no en la pagina: un alto en vh sobre un contenedor flex es
   un numero cerrado, mientras que un height al 100% contra un padre de alto indefinido
   resuelve CERO en Safari — y con el el overflow hidden de arriba, cero es una pantalla en
   blanco. La cabecera y el boton de alta se quedan fijos; lo que corre son las tarjetas. */
.ke-col {
  flex: 0 0 300px; display: flex; flex-direction: column; gap: 8px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 11px; min-height: 248px; max-height: 68vh;
  transition: background .12s, border-color .12s;
}
/* ⚠️ LA TARJETA SE DA VUELTA ADENTRO DE LA COLUMNA, y acá, no en TarjetaEntidad: esa
   pieza la usan /admin y la ficha de un workspace, donde la columna no existe. */
.ke-card .cl-card { background: var(--surface-2); }
/* El destino se marca en la COLUMNA, sin mover nada, y como en el Plan: el fondo a
   --surface-2 aca y el borde con el color de SU columna, inline (es uno por columna).
   Antes era el azul de la casa, que dice «estado» y no «esta columna». */
.ke-col-destino { background: var(--surface-2); }

/* El hueco del Plan, tal cual: 64 de alto, radio 10, punteado del color de la etapa
   (inline) y el alto animado. Antes medía 230, el alto entero de una tarjeta de
   cliente: cada columna que cruzaba el cursor se corría un cuarto de pantalla. */
.ke-hueco { flex: none; height: 64px; border-radius: 10px; border: 2px dashed currentColor; transition: height .12s; }

.ke-cab { display: flex; align-items: center; gap: 7px; padding: 0 2px; }
.ke-dot { width: 8px; height: 8px; border-radius: 999px; flex: none; }
.ke-label { font-size: 13px; font-weight: 700; color: var(--ink); flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* El pill contrasta contra la columna, que ahora es --surface: va en --surface-2. */
.ke-n { margin-left: auto; flex: none; font-size: 11.5px; font-weight: 700; color: var(--dim); background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 0 7px; }
/* Va PRIMERO adentro de la columna, arriba de las tarjetas, igual que el del CRM. */
.ke-nuevo-col {
  width: 100%; border: 1px dashed var(--border-strong); background: none; border-radius: 10px;
  padding: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--dim); cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
}
.ke-nuevo-col:hover { color: var(--ink); border-color: var(--ink); background: var(--surface-2); }
/* ⚠️ El min-height en 0 NO ES DECORATIVO: sin el, un hijo flex no baja de su alto de
   contenido y el overflow no recorta nada — la columna crece y vuelve el scroll de la
   tab. El padding derecho deja aire para la barra sin que tape el borde de la tarjeta. */
.ke-cards { list-style: none; margin: 0; padding: 0 2px 0 0; display: flex; flex-direction: column; gap: 10px;
  flex: 1 1 auto; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
/* El envoltorio que se arrastra. La tarjeta de adentro trae su propia caja.
   El position relative es para el numero que lleva la copia (ke-lleva), que se cuelga
   de la esquina. */
.ke-card { position: relative; display: flex; border-radius: 18px; }
.ke-card > * { width: 100%; }
/* ⚠️ EL CURSOR SE PONE A MANO. El botón que TarjetaEntidad monta en inset: 0 para
   que la tarjeta entera sea clicable declara cursor: pointer, y gana sobre el del
   envoltorio: sin esto, algo que se puede arrastrar muestra el cursor de un click. */
.ke-card .cl-abrir { cursor: grab; }
/* ⚠️ LA FILA DE ACCIONES BAJA DE RENGLON ACA, Y SOLO ACA. En la grilla medía 320 px y
   llevaba dos controles; en una columna mide 276 y, para una AGENCIA, lleva cuatro
   (entrar como, el menu, y el Sacar de esta pantalla). Un flex sin wrap no los apila:
   los desborda fuera de la tarjeta, que ademas tiene overflow hidden — o sea que el
   ultimo control desaparece sin dejar rastro. */
.ke-card .cl-acc { flex-wrap: wrap; row-gap: 7px; }
.ke-card:active .cl-abrir { cursor: grabbing; }
/* Al nodo ORIGEN no se le hace NADA mientras se arrastra (ni anillo, ni opacidad, ni
   escala): la regla medida del Plan. Aca habia una regla de anillo para el origen que
   ninguna tarjeta usaba, y se fue. */

/* ⛔ ACA VIVIA LA CASILLA EN PASTILLA (ke-sel), absoluta encima de la banda y a la
   vista en todas las tarjetas mientras hubiera algo marcado (ke-hay-sel). Se fue el
   05/10/2026: ahora es la casilla del CRM, adelante del nombre, y su regla vive UNA vez
   en globals.css (.mk-sel-tarjeta, revelada por .mk-tarjeta-sel:hover).
   ⚠️ Y LA TRAMPA QUE ESA REGLA DOCUMENTABA SIGUE VIVA PARA EL NUMERO DE LA COPIA: todo
   hijo DIRECTO de .ke-card hereda el width 100% de arriba, y ke-lleva se cuelga ahi.
   Sin esto, el numero de la copia mide lo que la tarjeta (con la casilla vieja se
   midio: una franja blanca de 274 px sobre la banda). El selector lleva .ke-card
   adelante porque tiene que ganarle en especificidad. */
.ke-card > .ke-lleva { width: auto; }
/* La tarjeta MARCADA, con los dos valores de la del Plan: fondo primary-bg y borde
   primary. Va despues de la regla que la da vuelta a surface-2, que la pisaria. */
.ke-card-elegida .cl-card, .ke-card-elegida .cl-card:hover { background: var(--primary-bg); border-color: var(--primary); }
.ke-card-elegida .cl-acc { background: var(--primary-bg); }

/* EL NUMERO QUE LLEVA LA COPIA cuando viajan varios. Solo existe en la copia: se
   cuelga del origen el tiempo justo para que la copia lo clone (ver agarrar). */
.ke-lleva { position: absolute; top: -9px; right: -9px; z-index: 4; min-width: 26px; height: 26px;
  padding: 0 8px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: var(--ink); color: var(--on-ink); font-size: 12.5px; font-weight: 700;
  font-variant-numeric: tabular-nums; box-shadow: 0 2px 8px rgba(18,21,27,.3); }

/* El chip de hace cuánto, al lado del nombre: es de DÓNDE ESTÁ, no del cliente. */
.ke-chip { font-size: 10.5px; font-weight: 650; color: var(--dim);
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px;
  padding: 1px 8px; white-space: nowrap; }
.ke-chip-trabado { color: var(--bad); border-color: var(--bad); background: var(--bad-bg); }

.ke-huerfanos { margin: 0; font-size: 12.5px; color: var(--bad); }
.ke-nada { margin: 10px 0 0; font-size: 13px; color: var(--dim); }

.ke-sub { margin: 0 0 10px; font-size: 13px; color: var(--dim); }
.ke-buscar { width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 10px; font: inherit; font-size: 13.5px; background: var(--surface); color: var(--ink); }
.ke-lista { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; }
.ke-lista button {
  width: 100%; display: flex; align-items: center; gap: 9px; text-align: left;
  background: none; border: 1px solid transparent; border-radius: 10px; padding: 7px 8px;
  font: inherit; cursor: pointer; color: var(--ink);
}
.ke-lista button:hover { background: var(--surface-2); border-color: var(--border); }
.ke-lnom { flex: 1 1 auto; min-width: 0; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ke-lnum { flex: none; font-size: 11.5px; color: var(--dim); }
`;
