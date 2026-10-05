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

import { useEffect, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { BarraAcciones, type AccionPlegable } from '@/app/_components/BarraAcciones';

/**
 * Las TRES formas de mirar la misma cartera. Es UN valor y no dos booleanos: con
 * `tabla` y `kanban` por separado, el día que los dos sean true gana el que lea
 * primero el que dibuja — y ya está escrito en esta casa que dos campos para el
 * mismo lugar es cómo se muere uno de los dos.
 *
 * `kanban` SÓLO lo ofrece quien pueda dibujarlo (`conKanban`): /admin monta esta
 * misma barra sobre una lista de WORKSPACES, que no tiene etapas de entrega, y un
 * botón que no hace nada se lee como que la app está rota.
 */
export type VistaClientes = 'tarjetas' | 'tabla' | 'kanban';

export type OrdenClientes = 'nombre' | 'abiertas' | 'proyectos' | 'antiguedad';
export type FiltroClientes = 'todos' | 'con-trabajo' | 'sin-trabajo' | 'sin-proyecto' | 'con-cuenta' | 'sin-cuenta';

export const ORDEN_LABEL: Record<OrdenClientes, string> = {
  nombre: 'Nombre',
  abiertas: 'Tareas abiertas',
  proyectos: 'Proyectos',
  // ⚠️ AHORA ES UNA FECHA DE VERDAD (`leads.fecha_cierre`). Antes «antigüedad» era
  // el orden por id, o sea el de CARGA — dos clientes ganados el mismo mes podían
  // salir a diez lugares de distancia porque uno se había cargado antes al CRM.
  antiguedad: 'Cuándo se ganó',
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
  q, onQ, vista, onVista, conKanban = false,
  servicios = [], servicio = null, onServicio,
  filtro, onFiltro, orden, onOrden, onExportar, onImportar,
  nVisibles, nTotal, progreso, placeholder = 'Buscar por nombre o empresa…',
  filtros = FILTRO_LABEL, ordenes = ORDEN_LABEL, filtroBase = 'todos', ordenBase = 'nombre',
  cuandos, cuando = 'siempre', onCuando, dir = 'desc', onDir,
  accionesExtra = [],
}: {
  q: string;
  onQ: (v: string) => void;
  vista: VistaClientes;
  onVista: (v: VistaClientes) => void;
  /** Dibujar el botón de kanban. Sólo lo prende quien tiene un tablero que mostrar. */
  conKanban?: boolean;
  /**
   * Los servicios entre los que elige el kanban, y cuál está elegido.
   *
   * ⚠️ APARECE SÓLO EN KANBAN, y no es una decisión de prolijidad: las otras dos
   * vistas contestan «quiénes son mis clientes y qué trabajo tienen», que no depende
   * de ningún servicio. Un selector a la vista ahí prometería que filtra la grilla.
   */
  servicios?: { id: number; nombre: string }[];
  servicio?: number | null;
  onServicio?: (id: number) => void;
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
  /** Más filas para los tres puntos, además de exportar e importar. */
  accionesExtra?: AccionPlegable[];
}) {
  return (
    <div className="bc">
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

      {/* ⚠️ EL CONTADOR SÓLO APARECE CUANDO LA VISTA ESTÁ RECORTADA. «3 de 12» con los
          12 a la vista no informa nada; con un filtro puesto es lo único que dice por
          qué faltan nueve. Un filtro que esconde sin decirlo es esconder sin pista. */}
      {nVisibles !== nTotal && <span className="bc-cuenta">{nVisibles} de {nTotal}</span>}

      <span style={{ flex: 1 }} />

      {/* ⚠️ EL SELECTOR DE SERVICIO VA ANTES DEL TOGGLE, no después: es lo que decide
          QUÉ tablero se está mirando, y un control que gobierna la vista entera no
          puede vivir a la derecha de los tres puntos. */}
      {vista === 'kanban' && servicios.length > 1 && onServicio && (
        <SelectorServicio servicios={servicios} servicio={servicio} onServicio={onServicio} />
      )}
      <VistaToggleClientes vista={vista} onSet={onVista} conKanban={conKanban} />
      <MenuFiltro filtro={filtro} onFiltro={onFiltro} orden={orden} onOrden={onOrden}
        filtros={filtros} ordenes={ordenes} filtroBase={filtroBase} ordenBase={ordenBase}
        cuandos={cuandos} cuando={cuando} onCuando={onCuando} dir={dir} onDir={onDir} />
      {/* ⚠️ ES **LA** BARRA DEL PLAN, no una parecida. «Falta la barra de progreso en
          los 3 puntitos en clientes, y los íconos; asegurate de copiar el diseño»
          (27/09/2026) — y copiar un diseño es escribir el segundo, que es el que se
          queda viejo. Se importa la pieza y se le pasan las acciones de acá.
          `compacto` va fijo en `true`: en el plan el header MIDE si los botones
          entran y los pliega; acá son dos y siempre viven adentro del menú, así que
          medir sería una decisión que no cambia nunca. */}
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

/** Tarjetas, tabla o kanban. Mismo molde y mismos íconos que el del tablero. */
function VistaToggleClientes({ vista, onSet, conKanban }: { vista: VistaClientes; onSet: (v: VistaClientes) => void; conKanban: boolean }) {
  return (
    <div className="bc-toggle">
      <button type="button" onClick={() => onSet('tarjetas')} aria-pressed={vista === 'tarjetas'}
        className={vista === 'tarjetas' ? 'on' : ''} title="Ver en tarjetas" aria-label="Ver en tarjetas">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
      <button type="button" onClick={() => onSet('tabla')} aria-pressed={vista === 'tabla'}
        className={vista === 'tabla' ? 'on' : ''} title="Ver en tabla" aria-label="Ver en tabla">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {/* Tres columnas: el ícono dice que lo que se agrupa son ETAPAS, no filas. */}
      {conKanban && (
        <button type="button" onClick={() => onSet('kanban')} aria-pressed={vista === 'kanban'}
          className={vista === 'kanban' ? 'on' : ''} title="Ver la entrega en etapas" aria-label="Ver la entrega en etapas">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="5" height="18" rx="1.5" /><rect x="10" y="3" width="5" height="12" rx="1.5" /><rect x="17" y="3" width="4" height="8" rx="1.5" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * De qué servicio es el tablero.
 *
 * ⚠️ SÓLO SE DIBUJA CON MÁS DE UNO. Con un servicio único el selector no ofrece
 * ninguna decisión, y el nombre del servicio ya está arriba de las columnas.
 */
function SelectorServicio({ servicios, servicio, onServicio }: {
  servicios: { id: number; nombre: string }[];
  servicio: number | null;
  onServicio: (id: number) => void;
}) {
  return (
    <label className="bc-serv">
      <span className="bc-serv-rot">Servicio</span>
      <select value={servicio ?? ''} onChange={(e) => onServicio(Number(e.target.value))}
        aria-label="De qué servicio es el tablero">
        {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </label>
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
function MenuFiltro({ filtro, onFiltro, orden, onOrden, filtros, ordenes, filtroBase, ordenBase, cuandos, cuando, onCuando, dir, onDir }: {
  filtro: string; onFiltro: (v: string) => void;
  orden: string; onOrden: (v: string) => void;
  filtros: Record<string, string>; ordenes: Record<string, string>;
  filtroBase: string; ordenBase: string;
  cuandos?: Record<string, string>; cuando?: string; onCuando?: (v: string) => void;
  dir?: 'asc' | 'desc'; onDir?: (d: 'asc' | 'desc') => void;
}) {
  const { open, setOpen, ref } = usePlegable();
  const [vista, setVista] = useState<'root' | 'mostrar' | 'orden' | 'cuando'>('root');
  const hayCuando = !!cuandos && !!cuando && cuando !== 'siempre';
  const n = (filtro !== filtroBase ? 1 : 0) + (orden !== ordenBase ? 1 : 0) + (hayCuando ? 1 : 0);

  // Al cerrarse, vuelve a la raíz: reabrirlo adentro de una categoría es aparecer en
  // un lugar que nadie eligió.
  useEffect(() => { if (!open) setVista('root'); }, [open]);

  const cats = [
    { key: 'mostrar' as const, label: 'Mostrar', resumen: filtros[filtro], activo: filtro !== filtroBase },
    { key: 'orden' as const, label: 'Ordenar', resumen: ordenes[orden], activo: orden !== ordenBase },
    // La ventana de tiempo sólo existe si la pantalla tiene una fecha que filtrar.
    ...(cuandos ? [{ key: 'cuando' as const, label: 'Cuándo', resumen: cuandos[cuando ?? 'siempre'], activo: hayCuando }] : []),
  ];

  return (
    <div ref={ref} className="bc-pop">
      <button type="button" className={`bc-btn${n > 0 ? ' on' : ''}`} onClick={() => setOpen((o) => !o)}
        aria-expanded={open} title="Filtrar y ordenar" aria-label="Filtrar y ordenar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
        </svg>
        {/* El número de lo que está puesto, y limpia al tocarlo. Sin esto, un filtro
            activo con el panel cerrado es una lista recortada sin explicación. */}
        {n > 0 && (
          <span className="bc-badge" title="Limpiar"
            onClick={(e) => { e.stopPropagation(); onFiltro(filtroBase); onOrden(ordenBase); onCuando?.('siempre'); }}>{n}</span>
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
                  onClick={() => { onFiltro('todos'); onOrden('nombre'); }}>Limpiar filtros ({n})</button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="bc-volver" onClick={() => setVista('root')}>
                ‹ {vista === 'mostrar' ? 'Mostrar' : 'Ordenar'}
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

/* El selector de servicio: gobierna QUE tablero se mira, asi que se lee como un
   control y no como un dato. */
.bc-serv{ display:inline-flex; align-items:center; gap:7px; flex:0 1 auto; min-width:0; }
.bc-serv-rot{ flex:none; font-size:10.5px; letter-spacing:.07em; text-transform:uppercase;
  font-weight:700; color:var(--dim); }
.bc-serv select{ flex:0 1 auto; min-width:0; max-width:230px; padding:6px 9px; font:inherit;
  font-size:13px; font-weight:600; color:var(--ink); background:var(--surface);
  border:1px solid var(--border); border-radius:9px; cursor:pointer; }
.bc-serv select:hover{ border-color:var(--border-strong); }
.bc-toggle{ display:inline-flex; flex:none; background:var(--surface-2); border:1px solid var(--border);
  border-radius:9px; padding:2px; }
.bc-toggle button{ display:inline-flex; align-items:center; justify-content:center; width:32px; height:30px;
  border-radius:7px; border:0; background:transparent; color:var(--faint); cursor:pointer; flex:none; }
.bc-toggle button.on{ background:var(--surface); color:var(--primary); box-shadow:0 1px 2px rgba(18,21,27,.08); }

.bc-pop{ position:relative; flex:none; }
.bc-btn{ display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px;
  border:1px solid var(--border); border-radius:9px; background:var(--surface); color:var(--dim); cursor:pointer; }
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
