'use client';

// =============================================================================
// BarraClientes — la topbar de Clientes: buscar, mirar, filtrar y exportar
// =============================================================================
// «Aplica todo lo que hay en el plan en la topbar, pero aquí en clientes… la barra
// de búsqueda, la vista de tabla o tarjetas, el filtro, los 3 puntos con la opción
// de importar o exportar. Que todo tenga sentido, claro» (27/09/2026).
//
// ⚠️ «QUE TODO TENGA SENTIDO» ES LA PARTE QUE MANDA, y por eso esto NO es una copia
// de la barra del tablero. Allá los filtros salen del deadline y del score, que un
// cliente no tiene. Acá las preguntas son otras tres, y son las únicas que la grilla
// puede contestar con lo que ya trae cada tarjeta:
//
//   · ¿quién tiene trabajo abierto, y quién no?   → el que no, es el que se enfría
//   · ¿quién todavía no tiene ni un proyecto?      → es el que falta arrancar
//   · ¿en qué orden los miro?                      → por nombre, por carga, por antigüedad
//
// Un cuarto control que devuelva la lista igual es ruido: pasó en el tablero con
// «Cuándo» y «Ordenar» en la vista de recurrentes, y ahí se sacaron por eso mismo.
//
// ⚠️ Y «IMPORTAR» LLEVA AL CRM EN VEZ DE IMPORTAR ACÁ. No es pereza: **un cliente es
// un lead ganado** (`lib/clientes-ganados.ts`), no hay tabla de clientes. Un
// importador propio sería una segunda implementación del que ya existe en el CRM, con
// su propio parseo de planilla y su propio mapeo de columnas — o sea, el segundo lugar
// que se queda viejo. Lo que sí vive acá es EXPORTAR, que es de esta vista: sale lo
// que la grilla está mostrando, con sus filtros puestos.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { BarraAcciones, type AccionPlegable } from '@/app/_components/BarraAcciones';
import { ICONO_VISTA } from '@/app/_ui/iconos-vista';
import { repartirEnEtapas, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';

/**
 * Las formas de mirar la misma lista. Es UN valor y no un booleano por vista: con
 * `tabla` y `kanban` por separado, el día que los dos sean true gana el que lea
 * primero el que dibuja — y ya está escrito en esta casa que dos campos para el
 * mismo lugar es cómo se muere uno de los dos.
 *
 * ⚠️ CADA PANTALLA DECLARA CUÁLES OFRECE (`vistas`), y no hay un flag por vista.
 * Las dos que montan esta barra no ofrecen las mismas: Customer Success muestra la
 * ENTREGA de un servicio (kanban + tabla, y el kanban es el default), y /admin una
 * lista de WORKSPACES, que no tiene etapas de entrega (tarjetas + tabla). Un botón
 * que no puede dibujar nada se lee como que la app está rota, así que la lista va en
 * POSITIVO: se dibuja lo que la pantalla declara, no «todas menos».
 */
export type VistaClientes = 'tarjetas' | 'tabla' | 'kanban';

/** El orden en que se dibujan los botones, sea cual sea el orden de `vistas`. */
const ORDEN_VISTAS: readonly VistaClientes[] = ['kanban', 'tarjetas', 'tabla'];

/**
 * Qué dibuja cada botón del toggle: el catálogo COMPARTIDO con el CRM y el Plan.
 *
 * ⚠️ ACÁ HABÍA UNA COPIA PROPIA, con el kanban dibujado como tres columnas de alto
 * distinto y el rótulo «Ver la entrega en etapas». Martín (05/10/2026): «el ícono de
 * kanban debería ser como en el plan, que son cubos. Y el placeholder debería ser "Ven
 * en Kanban"». El catálogo `ICONO_VISTA` ya lo tenía resuelto para el CRM ese mismo día
 * —los cuatro cubos y «Ver en Kanban»—; la copia era justo lo que hacía que los dos
 * toggles se vieran distintos. Ningún uso de esta barra ofrece kanban Y tarjetas a la
 * vez (Customer Success: kanban + tabla; /admin: tarjetas + tabla), así que los cubos
 * no se confunden con nada.
 */
const VISTA_META: Record<VistaClientes, { titulo: string; icono: ReactNode }> = ICONO_VISTA;

export type OrdenClientes = 'nombre' | 'abiertas' | 'proyectos' | 'antiguedad' | 'contacto' | 'vencidas';
export type FiltroClientes = 'todos' | 'con-trabajo' | 'sin-trabajo' | 'sin-proyecto' | 'con-cuenta' | 'sin-cuenta';

export const ORDEN_LABEL: Record<OrdenClientes, string> = {
  nombre: 'Nombre',
  abiertas: 'Tareas abiertas',
  proyectos: 'Proyectos',
  // ⚠️ AHORA ES UNA FECHA DE VERDAD (`leads.fecha_cierre`). Antes «antigüedad» era
  // el orden por id, o sea el de CARGA — dos clientes ganados el mismo mes podían
  // salir a diez lugares de distancia porque uno se había cargado antes al CRM.
  antiguedad: 'Cuándo se ganó',
  // Las dos columnas de la cartera (#109). «Ordenables si la tabla ordena»: la tabla no ordena
  // por su encabezado, ordena por esta barra — así que se ordenan desde acá. Sólo los monta
  // Customer Success: /admin pasa sus propios criterios (`ORDEN_WS`) y nunca ve esta lista.
  contacto: 'Último contacto',
  vencidas: 'Tareas vencidas',
};

/**
 * Las ventanas de tiempo, en UN lugar y con la funcion que las aplica al lado.
 *
 * ⚠️ SON RELATIVAS Y NO UN RANGO CON CALENDARIO, a proposito: «los ultimos 90
 * dias» es la pregunta que alguien se hace mirando una cartera, y un rango
 * obliga a elegir dos fechas para contestarla. El tablero ya resolvio esto igual.
 */
/**
 * ⚠️ LAS CLAVES LLEVAN LETRA A PROPOSITO: `d30` y no `30`.
 *
 * En JavaScript un objeto ordena PRIMERO las claves que parecen enteros, en orden
 * numerico, y recien despues las demas en orden de escritura. Con `'30'`, `'90'` y
 * `'365'`, `Object.keys` devolvia [30, 90, 365, siempre, viejos] — o sea que
 * «Siempre», que es el default y el primero que hay que ver, salia TERCERO en el
 * menu. Se vio en la pantalla, no en el codigo.
 */
export const CUANDO_LABEL: Record<string, string> = {
  siempre: 'Siempre',
  d30: 'Últimos 30 días',
  d90: 'Últimos 90 días',
  d365: 'Último año',
  viejos: 'Hace más de un año',
};

/** ¿Esta fecha entra en la ventana? Sin fecha NO entra en ninguna ventana que no
 *  sea «siempre»: un dato que falta no es un dato reciente. */
export function entraEnVentana(iso: string | null | undefined, cuando: string): boolean {
  if (cuando === 'siempre') return true;
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const dias = (Date.now() - t) / 86_400_000;
  if (cuando === 'viejos') return dias > 365;
  // `d30` → 30. La letra es del ORDEN del menú (ver arriba), no del dato.
  const tope = Number(cuando.replace(/^d/, ''));
  return Number.isFinite(tope) ? dias <= tope : true;
}

// ── La FASE: qué columnas del tablero de entrega se ven ──────────────────────────
//
// «Como terminaron siendo muchas fases, es mejor que lo pongas como un filtro
// directamente, porque no queda bien que estén todos esos botones» (Martín, 05/10/2026).
// Hasta ese día eran chips arriba del riel del kanban, uno por fase y con su conteo.
// Ahora es una sección más de «Filtrar», y las tres reglas de abajo viven acá —y no en
// el kanban ni en la pantalla— porque son la definición de la opción: qué se ofrece y
// qué significa haberla elegido. El kanban dibuja con `columnasVisibles` y la pantalla
// valida con `faseVigente`; ninguno de los dos vuelve a escribir la regla.

/** Una opción de la sección «Fase». `valor` es la clave de la fase, o `''` para las
 *  columnas sueltas; «Todas» no es una opción de la lista: es la ausencia de filtro. */
export type OpcionFase = { valor: string; label: string; color: string | null };

/**
 * Las columnas que se ven con `fase` elegida. `null` = todas.
 *
 * ⚠️ «SIN FASE» SON LAS QUE NO TIENEN UNA FASE QUE EXISTA, no sólo las que no tienen el
 * campo. Una etapa puede apuntar a una fase que se borró, y para su color ya es suelta
 * (`colorDeEtapa` cae a su color propio). Los chips viejos la contaban como suelta para
 * OFRECER «Sin fase» y la filtraban por `e.fase === ''` para DIBUJAR — con una sola
 * columna así, elegir «Sin fase» dejaba el tablero en blanco. Es una función y la usan las
 * dos puntas.
 */
export function columnasVisibles(
  etapas: readonly EtapaEntrega[],
  fases: readonly FaseEntrega[],
  fase: string | null,
): EtapaEntrega[] {
  if (fase === null) return [...etapas];
  if (fase === '') return etapas.filter((e) => !e.fase || !fases.some((f) => f.key === e.fase));
  return etapas.filter((e) => e.fase === fase);
}

/**
 * Lo que la sección «Fase» ofrece, en el orden del catálogo y con «Sin fase» al final.
 *
 * ⚠️ SÓLO LAS QUE DIBUJAN ALGO. Una fase sin columnas —recién creada, o a la que le
 * sacaron la última— se ofrecía igual en los chips, y elegirla dejaba el riel vacío sin
 * nada que lo explicara. Se pregunta con `columnasVisibles`, que es lo que se va a dibujar.
 *
 * ⚠️ Y CON MENOS DE DOS NO HAY SECCIÓN (`[]`). Con una sola fase, elegirla muestra lo
 * mismo que «Todas»: un filtro cuyas dos respuestas son iguales es un control que no
 * hace nada, y eso se lee como que la app está rota. Sin fases, tampoco: es el caso
 * normal, y la barra sigue igual que siempre.
 */
export function opcionesDeFase(etapas: readonly EtapaEntrega[], fases: readonly FaseEntrega[]): OpcionFase[] {
  if (!fases.length) return [];
  const todas: OpcionFase[] = [
    ...fases.map((f) => ({ valor: f.key, label: f.label, color: f.dot })),
    { valor: '', label: 'Sin fase', color: null },
  ];
  const ofrecidas = todas.filter((o) => columnasVisibles(etapas, fases, o.valor).length > 0);
  return ofrecidas.length >= 2 ? ofrecidas : [];
}

/**
 * La fase que de verdad se mira: la pedida, si este servicio la ofrece; si no, `null`.
 *
 * ⚠️ SE DERIVA, NO SE CORRIGE CON UN EFECTO. La pantalla NO se desmonta al cambiar de
 * servicio, así que lo elegido en uno sobrevive al pasar a otro — y ahí puede no existir.
 * Tratarlo como «todas» en el render nunca deja el riel en blanco, y no le pisa la
 * elección a nadie: al volver al servicio de antes, la fase vuelve con él.
 */
export function faseVigente(pedida: string | null, opciones: readonly OpcionFase[]): string | null {
  return pedida !== null && opciones.some((o) => o.valor === pedida) ? pedida : null;
}

/**
 * LOS CLIENTES QUE LA VISTA DIBUJA, con `fase` elegida. De acá sale lo que la pantalla
 * cuenta («N de M»), elige en lote («Seleccionar todos») y exporta.
 *
 * ⚠️ CON LAS MISMAS DOS FUNCIONES QUE DIBUJAN: `repartirEnEtapas` (un cliente sin fila está
 * en la primera) y `columnasVisibles` (qué es «de la fase»). Con una cuenta propia, el
 * contador diría un número y el riel —o la tabla— mostraría otro.
 *
 * ⚠️ LOS HUÉRFANOS (una fila con una etapa que el catálogo ya no tiene) CUENTAN SÓLO DONDE
 * TIENEN UNA FILA DIBUJADA: en la TABLA y sin fase, que es donde sale el grupo «Etapa
 * borrada». El kanban no les dibuja tarjeta —los nombra en un aviso al pie—, y con una fase
 * puesta la tabla tampoco los muestra (no son de ninguna fase). Contarlos ahí es lo que
 * encontró la auditoría del 06/10/2026 con la clienta del ws1 que quedó en «onboarding»:
 * «N de M» la sumaba sin que el kanban tuviera su tarjeta, y «Seleccionar todos» la elegía
 * sin que se viera. Por eso el flag lo pasa la VISTA (`conHuerfanos`): es una propiedad de
 * qué se dibuja, no de la fase.
 *
 * Sin etapas (no hay servicio elegido) no hay columnas que esconder: van todos.
 */
export function clientesEnPantalla<C>(
  etapas: readonly EtapaEntrega[],
  fases: readonly FaseEntrega[],
  fase: string | null,
  clientes: readonly C[],
  etapaDe: (c: C) => string | null | undefined,
  conHuerfanos: boolean,
): C[] {
  if (!etapas.length) return [...clientes];
  const { porEtapa, huerfanos } = repartirEnEtapas(etapas, clientes, etapaDe);
  const se = new Set<C>();
  for (const e of columnasVisibles(etapas, fases, fase)) for (const c of porEtapa[e.key] ?? []) se.add(c);
  if (conHuerfanos && fase === null) for (const c of huerfanos) se.add(c);
  // En el orden en que llegaron: el orden lo decidió «Ordenar», no el reparto.
  return clientes.filter((c) => se.has(c));
}

export const FILTRO_LABEL: Record<FiltroClientes, string> = {
  todos: 'Todos',
  'con-trabajo': 'Con trabajo abierto',
  'sin-trabajo': 'Sin trabajo abierto',
  'sin-proyecto': 'Sin ningún proyecto',
  'con-cuenta': 'Con cuenta de MaKo',
  'sin-cuenta': 'Sin cuenta de MaKo',
};

/**
 * ⚠️ ES LA MISMA BARRA EN LAS DOS PANTALLAS, no dos parecidas. La monta Customer
 * Success (una cartera de LEADS ganados) y el panel de /admin (una lista de
 * WORKSPACES), a pedido del dueño: «que sea exactamente igual que la vista de
 * clientes que construimos». Lo que cambia entre las dos son sus DATOS, y eso
 * entra por parámetro: los rótulos de filtro y orden, el placeholder, el
 * progreso y qué hay adentro de los tres puntos.
 *
 * Los defaults son los de Customer Success, que es donde nació: esa pantalla
 * sigue llamándola igual que antes.
 */
export function BarraClientes({
  q, onQ, vista, onVista, vistas = ['tarjetas', 'tabla'], extremo,
  filtro, onFiltro, orden, onOrden, onExportar, onImportar,
  nVisibles, nTotal, progreso, placeholder = 'Buscar por nombre o empresa…',
  filtros = FILTRO_LABEL, ordenes = ORDEN_LABEL, filtroBase = 'todos', ordenBase = 'nombre',
  cuandos, cuando = 'siempre', onCuando, dir = 'desc', onDir,
  fases, fase = null, onFase,
  accionesExtra = [],
}: {
  q: string;
  onQ: (v: string) => void;
  vista: VistaClientes;
  onVista: (v: VistaClientes) => void;
  /** Las vistas que ESTA pantalla puede dibujar. Ver el porqué en `VistaClientes`. */
  vistas?: readonly VistaClientes[];
  /**
   * Lo que va al final de la barra, pegado a los tres puntos.
   *
   * Lo pone quien la monta y no esta pieza: Customer Success manda ahí el selector de
   * servicio —y sólo en la vista de etapas, porque las otras dos contestan «quiénes
   * son mis clientes», que no depende de ningún servicio— y /admin no manda nada.
   */
  extremo?: ReactNode;
  filtro: string;
  onFiltro: (v: string) => void;
  orden: string;
  onOrden: (v: string) => void;
  onExportar: () => void;
  /** Sólo Customer Success importa: /admin no tiene de dónde. */
  onImportar?: () => void;
  nVisibles: number;
  nTotal: number;
  /** El avance de la cartera, para el mismo lugar donde el plan pone el suyo.
   *  OPCIONAL: una lista de workspaces no tiene ningún porcentaje análogo, y
   *  obligarla a inventar uno sería justo lo que la regla de la casa prohíbe. */
  progreso?: { pct: number; hechas: number; total: number; label: string };
  placeholder?: string;
  /** Los rótulos de cada filtro y de cada orden, y cuál de ellos es «sin filtrar». */
  filtros?: Record<string, string>;
  ordenes?: Record<string, string>;
  filtroBase?: string;
  ordenBase?: string;
  /**
   * La ventana de tiempo. OPCIONAL y con sus rótulos por parámetro: sólo se ofrece
   * si la pantalla tiene una FECHA de verdad que filtrar. Una cartera la tiene
   * (cuándo se ganó al cliente) y la plataforma también (cuándo se creó el
   * workspace), pero son fechas distintas y significan cosas distintas — por eso
   * el rótulo lo pone quien la monta y no está escrito acá.
   *
   * ⚠️ Sin esto, «antigüedad» era el orden por id: el de CARGA, no el de la
   * relación. Ofrecer un filtro sobre un dato que la pantalla no baja es la forma
   * más cara de mentir, porque el resultado parece una respuesta.
   */
  cuandos?: Record<string, string>;
  cuando?: string;
  onCuando?: (v: string) => void;
  /** La dirección del orden, separada del criterio — como en el tablero. «Nombre»
   *  y «Nombre al revés» no son dos criterios: es uno con dos sentidos. */
  dir?: 'asc' | 'desc';
  onDir?: (d: 'asc' | 'desc') => void;
  /**
   * Las fases del tablero de entrega que se pueden mirar de a una (`opcionesDeFase`), la
   * elegida (`null` = todas) y cómo cambiarla.
   *
   * ⚠️ OPCIONAL Y EN POSITIVO: la sección existe sólo si la pantalla la manda con algo
   * adentro. /admin monta esta misma barra sobre una lista de WORKSPACES, que no tienen
   * etapas de entrega, y Customer Success la manda sólo en la vista de kanban — la tabla
   * no filtra columnas, y una opción que no cambia nada de lo que se ve se lee como rota.
   */
  fases?: readonly OpcionFase[];
  fase?: string | null;
  onFase?: (v: string | null) => void;
  /** Más filas para los tres puntos, además de exportar e importar. */
  accionesExtra?: AccionPlegable[];
}) {
  return (
    <div className="bc">
      {/* ⚠️ EL ORDEN ES PEDIDO Y NO ESTÉTICO (05/10/2026): primero CÓMO se mira, después
          QUÉ se busca, y recién ahí con qué se recorta. «El botón de filtro va luego de la
          barra de búsqueda. Y los íconos de kanban y tabla, antes de la barra de búsqueda.» */}
      <VistaToggleClientes vista={vista} onSet={onVista} vistas={vistas} />

      <label className="bc-buscar">
        {/* El ícono no es decorativo: sin él, un input vacío al lado de dos botones
            cuadrados se lee como un campo más y no como «buscá acá». */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input value={q} onChange={(e) => onQ(e.target.value)}
          placeholder={placeholder} aria-label="Buscar" />
        {q && (
          <button type="button" onClick={() => onQ('')} title="Limpiar" aria-label="Limpiar la búsqueda">✕</button>
        )}
      </label>

      <MenuFiltro filtro={filtro} onFiltro={onFiltro} orden={orden} onOrden={onOrden}
        filtros={filtros} ordenes={ordenes} filtroBase={filtroBase} ordenBase={ordenBase}
        cuandos={cuandos} cuando={cuando} onCuando={onCuando} dir={dir} onDir={onDir}
        fases={fases} fase={fase} onFase={onFase} />

      {/* ⚠️ EL CONTADOR SÓLO APARECE CUANDO LA VISTA ESTÁ RECORTADA. «3 de 12» con los
          12 a la vista no informa nada; con un filtro puesto es lo único que dice por
          qué faltan nueve. Un filtro que esconde sin decirlo es esconder sin pista. */}
      {nVisibles !== nTotal && <span className="bc-cuenta">{nVisibles} de {nTotal}</span>}

      <span style={{ flex: 1 }} />

      {/* ⚠️ EL SELECTOR DE SERVICIO VA A LA DERECHA, pegado a los tres puntos: es lo que
          decide QUÉ tablero se está mirando, y arriba del todo hay una sola cosa de esas. */}
      {/* ⚠️ EL SELECTOR LO PONE QUIEN MONTA LA BARRA, y no esta pieza: /admin tambien
          la monta y no tiene servicios. Entra por `extremo`, que es el hueco de la
          derecha, pegado a los tres puntos. */}
      {extremo}
      <BarraAcciones compacto progreso={progreso} acciones={[
        { key: 'exportar',
          nodo: null,
          menu: {
            icono: <IconoBajar />,
            label: 'Exportar a CSV',
            desc: 'Lo que estás viendo, con los filtros puestos',
            onClick: onExportar,
          } },
        // La fila de importar EXISTE sólo si hay a dónde: /admin no tiene planilla
        // de la que traer workspaces, y una fila que no hace nada se lee como que
        // la app está rota.
        ...(onImportar ? [{ key: 'importar',
          nodo: null,
          menu: {
            icono: <IconoSubir />,
            label: 'Importar desde una planilla',
            desc: 'Entran al CRM; son clientes al marcarlos ganados',
            onClick: onImportar,
          } }] : []),
        ...accionesExtra,
      ]} />

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/**
 * Los botones de vista. Se dibuja UNO por cada vista que la pantalla declara.
 *
 * ⚠️ CON UNA SOLA VISTA NO SE DIBUJA NADA. Un toggle de un botón no ofrece ninguna
 * decisión y, peor, el botón queda permanentemente activo: se lee como un control
 * trabado. Mismo molde y mismos íconos que el del tablero.
 */
function VistaToggleClientes({ vista, onSet, vistas }: {
  vista: VistaClientes;
  onSet: (v: VistaClientes) => void;
  vistas: readonly VistaClientes[];
}) {
  const disponibles = ORDEN_VISTAS.filter((v) => vistas.includes(v));
  if (disponibles.length < 2) return null;
  return (
    <div className="bc-toggle">
      {disponibles.map((v) => (
        <button key={v} type="button" onClick={() => onSet(v)} aria-pressed={vista === v}
          className={vista === v ? 'on' : ''} title={VISTA_META[v].titulo} aria-label={VISTA_META[v].titulo}>
          {VISTA_META[v].icono}
        </button>
      ))}
    </div>
  );
}

/** Un desplegable que se cierra con Escape, con un click afuera y al elegir. */
function usePlegable() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    // ⚠️ `stopImmediatePropagation` y no `stopPropagation`: esta pantalla puede tener
    // una ficha abierta, y todos los Escape de la casa viven en `document` en captura.
    // Sin esto, cerrar el menú cerraría además la ficha. Ya se pagó tres veces hoy.
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  return { open, setOpen, ref };
}

/**
 * EL FILTRO, con la MISMA gramática que el del tablero: un panel con una fila por
 * categoría —su nombre a la izquierda, el valor actual a la derecha y un `›`— que al
 * tocarla se REEMPLAZA por sus opciones, con un «‹ volver». Nunca hay más de una
 * categoría en pantalla a la vez.
 *
 * ⚠️ NO ES UNA LISTA PLANA, y por eso se rehizo: la primera versión apilaba las siete
 * opciones de las dos categorías una debajo de la otra y el dueño lo rechazó con
 * «copia mejor el filtro, no se parecen en nada» (27/09/2026). Tenía razón y no era
 * gusto: apilada, no se ve qué está puesto sin leer cuál está resaltada, y el panel
 * crece con cada opción nueva. Con el resumen a la derecha, el estado se lee cerrado.
 *
 * ⚠️ Y EL BADGE CUENTA LO QUE NO ES EL DEFAULT, no las categorías. Con «Nombre» y
 * «Todos» puestos no hay nada filtrado, así que el botón no puede decir 2.
 */
function MenuFiltro({ filtro, onFiltro, orden, onOrden, filtros, ordenes, filtroBase, ordenBase, cuandos, cuando, onCuando, dir, onDir, fases, fase, onFase }: {
  filtro: string; onFiltro: (v: string) => void;
  orden: string; onOrden: (v: string) => void;
  filtros: Record<string, string>; ordenes: Record<string, string>;
  filtroBase: string; ordenBase: string;
  cuandos?: Record<string, string>; cuando?: string; onCuando?: (v: string) => void;
  dir?: 'asc' | 'desc'; onDir?: (d: 'asc' | 'desc') => void;
  fases?: readonly OpcionFase[]; fase?: string | null; onFase?: (v: string | null) => void;
}) {
  const { open, setOpen, ref } = usePlegable();
  const [vista, setVista] = useState<'root' | 'mostrar' | 'orden' | 'cuando' | 'fase'>('root');
  const hayCuando = !!cuandos && !!cuando && cuando !== 'siempre';
  /**
   * ⚠️ LA SECCIÓN Y SU CUENTA SALEN DE LA MISMA CONDICIÓN. La fase elegida sólo cuenta en
   * el número del botón si la sección está ofrecida: con la pantalla en la vista de tabla
   * (que no manda `fases`), el riel no está filtrando nada y un «1» en el botón diría lo
   * contrario. La elección no se pierde: vuelve al volver al kanban.
   */
  const hayFases = !!fases && fases.length > 0 && !!onFase;
  const faseOn = hayFases && fase != null ? fases!.find((o) => o.valor === fase) ?? null : null;
  const n = (filtro !== filtroBase ? 1 : 0) + (orden !== ordenBase ? 1 : 0) + (hayCuando ? 1 : 0) + (faseOn ? 1 : 0);

  // Al cerrarse, vuelve a la raíz: reabrirlo adentro de una categoría es aparecer en
  // un lugar que nadie eligió.
  useEffect(() => { if (!open) setVista('root'); }, [open]);

  /**
   * Limpiar es devolver CADA categoría a su base, las cuatro, y es UNA función: el número
   * del botón y «Limpiar filtros» del panel la llaman igual. ⛔ El del panel devolvía
   * 'todos' y 'nombre' escritos a mano en vez de la base que llega por prop, y se olvidaba
   * de la ventana de tiempo: con «Cuándo» puesto, limpiar dejaba el número del botón en 1.
   */
  const limpiar = () => { onFiltro(filtroBase); onOrden(ordenBase); onCuando?.('siempre'); onFase?.(null); };

  const cats = [
    { key: 'mostrar' as const, label: 'Mostrar', resumen: filtros[filtro], activo: filtro !== filtroBase },
    // La fase va al lado de «Mostrar» porque contesta lo mismo —qué se ve—, sólo que de
    // columnas y no de clientes. Y sólo existe si la pantalla la ofrece (ver `fases`).
    ...(hayFases ? [{ key: 'fase' as const, label: 'Fase', resumen: faseOn?.label ?? 'Todas', activo: !!faseOn }] : []),
    { key: 'orden' as const, label: 'Ordenar', resumen: ordenes[orden], activo: orden !== ordenBase },
    // La ventana de tiempo sólo existe si la pantalla tiene una fecha que filtrar.
    ...(cuandos ? [{ key: 'cuando' as const, label: 'Cuándo', resumen: cuandos[cuando ?? 'siempre'], activo: hayCuando }] : []),
  ];
  /** El rótulo del «‹ volver», que es el de la categoría abierta. ⛔ Era un ternario de
   *  dos ramas y «Cuándo» volvía diciendo «‹ Ordenar». */
  const volverA = cats.find((c) => c.key === vista)?.label ?? 'Volver';

  return (
    <div ref={ref} className="bc-pop">
      <button type="button" className={`bc-btn${n > 0 ? ' on' : ''}`} onClick={() => setOpen((o) => !o)}
        aria-expanded={open} title="Filtrar y ordenar" aria-label="Filtrar y ordenar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
        </svg>
        {/* ⚠️ LA PALABRA VA EN EL BOTÓN, no sólo en el `title`: «el botón de filtrar que
            sí tenga el texto "Filtrar"» (Martín, 05/10/2026). Un embudo de 15 px al lado
            de dos íconos de vista no se lee como un filtro hasta que alguien lo aprieta,
            y el `title` aparece recién al pasar el mouse — o sea nunca en un celular. */}
        <span className="bc-btn-txt">Filtrar</span>
        {/* El número de lo que está puesto, y limpia al tocarlo. Sin esto, un filtro
            activo con el panel cerrado es una lista recortada sin explicación. */}
        {n > 0 && (
          <span className="bc-badge" title="Limpiar"
            onClick={(e) => { e.stopPropagation(); limpiar(); }}>{n}</span>
        )}
      </button>
      {open && (
        <div className="bc-menu bc-menu-der">
          {vista === 'root' ? (
            <>
              {cats.map((c) => (
                <button key={c.key} type="button" className="bc-fila" onClick={() => setVista(c.key)}>
                  <span className="bc-fila-nom">{c.label}</span>
                  <span className="bc-fila-val">
                    <span className={c.activo ? 'on' : ''}>{c.resumen}</span>
                    <span className="bc-chev">›</span>
                  </span>
                </button>
              ))}
              {n > 0 && (
                <button type="button" className="bc-limpiar"
                  onClick={limpiar}>Limpiar filtros ({n})</button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="bc-volver" onClick={() => setVista('root')}>
                ‹ {volverA}
              </button>
              {/* ⚠️ LOS RENGLONES SALEN DE LOS DICCIONARIOS QUE LLEGAN POR PROP, no de
                  los de Customer Success. Estaban cableados a FILTRO_LABEL/ORDEN_LABEL
                  mientras el RESUMEN de arriba ya usaba los de la prop: en /admin el menú
                  ofrecía «Con trabajo abierto» y «Más tareas abiertas» —que no existen para
                  un workspace— y elegir cualquiera no filtraba nada. La barra parecía
                  compartida y estaba compartida a medias, que es peor que no estarlo. */}
              {vista === 'mostrar' && Object.keys(filtros).map((k) => (
                <button key={k} type="button" className={`bc-op${filtro === k ? ' on' : ''}`}
                  onClick={() => { onFiltro(k); setVista('root'); setOpen(false); }}>{filtros[k]}</button>
              ))}
              {/* UNA fase a la vez, con «Todas» de verdad: es la ausencia de filtro, no una
                  opción más, así que no puede quedar el riel sin columnas. El punto es el
                  color de la fase, el mismo que la línea de arriba de sus columnas. */}
              {vista === 'fase' && hayFases && (
                <>
                  <button type="button" className={`bc-op${faseOn ? '' : ' on'}`}
                    onClick={() => { onFase?.(null); setVista('root'); setOpen(false); }}>Todas</button>
                  {fases!.map((o) => (
                    <button key={o.valor || '__sueltas'} type="button" className={`bc-op${faseOn?.valor === o.valor ? ' on' : ''}`}
                      onClick={() => { onFase?.(o.valor); setVista('root'); setOpen(false); }}>
                      <span className="bc-dot" style={{ background: o.color ?? 'var(--border-strong)' }} aria-hidden />
                      {o.label}
                    </button>
                  ))}
                </>
              )}
              {vista === 'cuando' && Object.keys(cuandos ?? {}).map((k) => (
                <button key={k} type="button" className={`bc-op${cuando === k ? ' on' : ''}`}
                  onClick={() => { onCuando?.(k); setVista('root'); setOpen(false); }}>{(cuandos ?? {})[k]}</button>
              ))}
              {vista === 'orden' && (
                <>
                  {Object.keys(ordenes).map((k) => (
                    <button key={k} type="button" className={`bc-op${orden === k ? ' on' : ''}`}
                      onClick={() => { onOrden(k); }}>{ordenes[k]}</button>
                  ))}
                  {/* ⚠️ LA DIRECCION ES OTRA PREGUNTA, no dos criterios mas. Duplicar cada
                      orden en «X» y «X al reves» convierte una lista de cuatro en una de
                      ocho, y quien la lee tiene que encontrar su criterio dos veces. El
                      tablero ya lo resolvio asi y esto es lo mismo.
                      Y NO cierra el panel: cambiar el sentido es un ajuste del orden que
                      se acaba de elegir, no una eleccion nueva. */}
                  {onDir && (
                    <div className="bc-dir">
                      <button type="button" className={dir === 'desc' ? 'on' : ''} onClick={() => onDir('desc')}>Mayor primero</button>
                      <button type="button" className={dir === 'asc' ? 'on' : ''} onClick={() => onDir('asc')}>Menor primero</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Los dos íconos del menú, del mismo trazo que los del plan (24×24, stroke 2). */
function IconoBajar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}
function IconoSubir() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21V9" /><path d="m7 13 5-5 5 5" /><path d="M5 3h14" />
    </svg>
  );
}

const CSS = `
/* ⚠️ EL MISMO ANCHO Y EL MISMO CENTRADO QUE LA GRILLA. Con la grilla topada en 1180
   y centrada, una barra a ancho completo arranca 52 px a la izquierda de la primera
   tarjeta — y esos 52 px se leen como que algo quedó desalineado, no como una
   decisión. Los dos números viven en dos archivos, así que van comentados de los dos
   lados: si uno cambia, el otro se nota al instante. */
/* ⚠️ width:100% ADEMAS del max-width, y no sobra. Con margin:0 auto a secas, en
   un contenedor de BLOQUE la barra ocupa todo (Customer Success) y en uno FLEX
   EN COLUMNA se encoge al contenido y se centra: los margenes auto de un item
   flex absorben el espacio libre. Medido en /admin al montarla: 419 px de ancho,
   centrada, y con la mitad de los controles caidos a un segundo renglon. Se lee
   como una barra rota, no como una barra angosta. */
.bc{ display:flex; align-items:center; gap:10px; margin:0 auto 16px; width:100%;
  max-width:var(--cartera-max, 1180px); flex-wrap:wrap; }
.bc-buscar{ display:inline-flex; align-items:center; gap:8px; flex:0 1 320px; min-width:190px;
  height:38px; padding:0 11px; border:1px solid var(--border); border-radius:9px;
  background:var(--surface); color:var(--faint); }
.bc-buscar:focus-within{ border-color:var(--primary); color:var(--primary); }
.bc-buscar input{ flex:1; min-width:0; border:0; outline:none; background:none; font:inherit;
  font-size:13.5px; color:var(--ink); }
.bc-buscar button{ border:0; background:none; color:var(--faint); cursor:pointer; font-size:12px; padding:2px; }
.bc-buscar button:hover{ color:var(--ink); }
.bc-cuenta{ font-size:12.5px; color:var(--dim); white-space:nowrap; }

.bc-toggle{ display:inline-flex; flex:none; background:var(--surface-2); border:1px solid var(--border);
  border-radius:9px; padding:2px; }
.bc-toggle button{ display:inline-flex; align-items:center; justify-content:center; width:32px; height:30px;
  border-radius:7px; border:0; background:transparent; color:var(--faint); cursor:pointer; flex:none; }
.bc-toggle button.on{ background:var(--surface); color:var(--primary); box-shadow:0 1px 2px rgba(18,21,27,.08); }

.bc-pop{ position:relative; flex:none; }
.bc-btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px; height:38px;
  padding:0 13px; border:1px solid var(--border); border-radius:9px; background:var(--surface);
  color:var(--dim); cursor:pointer; font:inherit; }
.bc-btn-txt{ font-size:13px; font-weight:600; white-space:nowrap; }
.bc-btn:hover{ border-color:var(--border-strong); color:var(--ink); }
.bc-btn.on{ border-color:var(--primary); color:var(--primary); }
.bc-menu{ position:absolute; top:calc(100% + 6px); left:0; z-index:40; min-width:230px;
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  box-shadow:0 14px 38px rgba(18,21,27,.18); padding:6px; }
.bc-menu-der{ left:auto; right:0; }
.bc-tit{ margin:6px 8px 4px; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--faint); font-weight:700; }
.bc-op{ display:block; width:100%; text-align:left; border:0; background:none; border-radius:8px;
  padding:7px 9px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; text-decoration:none; }
/* El par de direccion: dos mitades de un mismo control, no dos opciones sueltas. */
.bc-dir{ display:flex; gap:4px; margin:6px 6px 2px; padding-top:6px; border-top:1px solid var(--border); }
.bc-dir button{ flex:1; border:1px solid var(--border); background:var(--surface); border-radius:8px;
  padding:5px 8px; font:inherit; font-size:11.5px; font-weight:600; color:var(--dim); cursor:pointer; }
.bc-dir button.on{ border-color:var(--primary); color:var(--primary); background:var(--primary-bg); }
.bc-op:hover{ background:var(--surface-2); color:var(--ink); }
.bc-op.on{ color:var(--primary); font-weight:600; }
/* El punto de color de una fase, adelante de su nombre. «Sin fase» va en el gris del
   borde: no tiene color propio, y un hueco ahi corre el texto respecto de las demas. */
.bc-dot{ display:inline-block; width:8px; height:8px; border-radius:999px; margin-right:8px;
  vertical-align:middle; position:relative; top:-1px; }
.bc-desc{ display:block; font-size:11.5px; color:var(--faint); margin-top:1px; }

/* La fila de una categoria: nombre a la izquierda, valor y chevron a la derecha. Es
   la anatomia del filtro del tablero, a proposito. */
.bc-fila{ display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;
  border:0; background:none; border-radius:8px; padding:9px 10px; font:inherit; font-size:13px;
  color:var(--ink); cursor:pointer; text-align:left; }
.bc-fila:hover{ background:var(--surface-2); }
.bc-fila-nom{ font-weight:600; }
.bc-fila-val{ display:inline-flex; align-items:center; gap:6px; min-width:0; font-size:12.5px; color:var(--faint); }
.bc-fila-val .on{ color:var(--primary); font-weight:600; }
.bc-chev{ color:var(--faint); font-size:16px; line-height:1; }
.bc-volver{ display:block; width:100%; text-align:left; border:0; background:none; cursor:pointer;
  font:inherit; font-size:12px; color:var(--dim); padding:6px 9px 8px; font-weight:600; }
.bc-volver:hover{ color:var(--ink); }
.bc-limpiar{ display:block; width:100%; border:0; background:none; cursor:pointer; font:inherit;
  font-size:13px; font-weight:600; color:var(--primary); padding:10px 9px 6px; margin-top:4px;
  border-top:1px solid var(--border); text-align:center; }
.bc-badge{ position:absolute; top:-7px; right:-7px; min-width:18px; height:18px; padding:0 4px;
  border-radius:999px; background:var(--primary); color:#fff; font-size:10px; font-weight:700;
  display:flex; align-items:center; justify-content:center; border:2px solid var(--bg); }
`;
