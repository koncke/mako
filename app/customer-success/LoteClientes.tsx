'use client';

// =============================================================================
// LoteClientes — lo que se puede hacer con VARIOS clientes a la vez
// =============================================================================
// «Muy importante que implementes las acciones en LOTE, tanto para la vista de tablas
// como kanban... Copia todo del plan. Y piensa qué acciones en lote valdría la pena»
// (Martín, 05/10/2026).
//
// ⚠️ ES UNA COPIA DECLARADA DE `BarraLote` (app/plan/board/AccionesLote.tsx), NO UNA
// IMPORTACIÓN, y no por gusto. `BarraLote` es interna (no se exporta) y está atada al
// tablero del Plan por las tres puntas: escribe con `board.setDeadline/setRecurrencia/
// prioridadManual`, deshace con `board.showUndo` y lista proyectos con `board.labels`.
// Un cliente en entrega no tiene nada de eso. Lo que SÍ se copió, tal cual:
//   · la ANATOMÍA de tres grupos: a la izquierda con qué se está trabajando (la casilla
//     marcada y el número), en el medio lo que CAMBIA, a la derecha lo que sale;
//   · el contenedor: `primary-bg` con borde `primary-weak`, radio 11, padding 7/12,
//     `space-between` con los dos costados en `flex: 1` (así el medio queda en el medio
//     de verdad, con cualquier ancho) y `flex-wrap` como RED, no como camino;
//   · el botón de ícono de la casa (`.mk-icon-btn` + `data-tone`), con `title` y
//     `aria-label` iguales, y el `Dropdown` de acción (`value=""` + `resetAfterSelect`)
//     con el mismo `buttonStyle`;
//   · la barra PEGADA arriba: `sticky, top: 8, zIndex: 20` y la misma sombra que el
//     Kanban y las tablas del Plan (`BarraPegada`, Tablas.tsx).
// Lo que la UNIRÍA: sacar de `BarraLote` su CASCARÓN —las tres ranuras, la casilla con
// el número, `BtnIcono` y el sticky— a una pieza de `app/_ui/` que reciba los tres
// grupos como hijos. El Plan quedaría como una configuración de esa pieza y ésta como
// otra. No se hizo acá porque toca `app/plan/board/`, que es de otra sesión.
//
// ⛔ NO HAY UNA ✕ DE «LIMPIAR», aunque la acción exista (`onLimpiar`). El Plan la sacó
// con todas las letras: «El botón de quitar selección no debe existir, solamente el check
// en el mismo lugar, a la izquierda del todo, marcado... Y si lo vuelvo a marcar se
// deselecciona» (25/09/2026). Destildar la casilla ES limpiar.
//
// ── QUÉ ACCIONES, Y POR QUÉ ÉSAS ─────────────────────────────────────────────────────
// Lo que una cartera de clientes EN ENTREGA hace en tanda es moverse de etapa: terminar
// el onboarding de los cinco que entraron juntos, pasar de hito a los que cerraron la
// misma semana. De ahí las dos del medio, y las dos dicen QUÉ se cambia:
//   · «Mover a» → las etapas del servicio, agrupadas por FASE con su color. Es el mismo
//     color que la columna, por `colorDeEtapa`: la línea de arriba de la columna, el
//     punto de la cabecera y este renglón no pueden decir cosas distintas.
//   · «Siguiente etapa» → cada uno a la que le sigue a SU etapa (no todos a la misma).
// Y a la derecha «Exportar»: lo que sale de la pantalla sin cambiar nada.
//
// Lo que NO está, y por qué no se dibuja:
//   · **Borrar / sacar de la entrega.** Desde que todos los clientes están en el tablero
//     (un cliente sin fila está en la primera etapa, `repartirEnEtapas`), «sacar» no
//     existe como acción: lo contrario de mover a alguien es moverlo de vuelta, y eso ya
//     lo hace «Mover a». Y un cliente es un lead GANADO del CRM: borrarlo es otra pantalla.
//   · **Sin servicio (`etapas === null`) no hay «Mover a» ni «Siguiente»**: no hay
//     columnas a dónde ir, y un control que no puede hacer nada se lee como roto.
//
// ⚠️ EL DESHACER LO HACE LA PANTALLA, Y ES UNO POR LOTE. Mover doce clientes con un toast
// por cliente deja arriba el que deshace UNO (AGENTS.md: «Una acción en LOTE necesita UN
// deshacer, no N»). Esta barra sólo avisa QUÉ se pidió; quien escribe es quien deshace.
// =============================================================================

import type { ReactNode } from 'react';
import { Dropdown, type DropdownGroup, type DropdownOption } from '@/app/components/Dropdown';
import { colorDeEtapa, faseDe, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// ── Lo que el ARRASTRE en lote necesita saber, en funciones puras ───────────────────
// ⚠️ VIVEN ACÁ Y NO EN EL KANBAN porque son la regla del LOTE, no del tablero: la tabla
// que arrastra filas tiene que contestar las mismas dos preguntas («¿qué viaja?» y
// «¿dónde cae?») y con dos implementaciones una de las dos se queda vieja. Y porque un
// componente que monta tarjetas no se puede importar desde un test (arrastra módulos con
// `server-only`); éste sí.

/**
 * QUÉ VIAJA cuando se agarra una tarjeta.
 *
 * Si la agarrada está SELECCIONADA y la selección tiene más de una, viajan todas — en el
 * orden de la lista, que es el orden en que la pantalla las dibuja. Si no está
 * seleccionada, viaja sola aunque haya otras marcadas: es lo que hace cualquier gestor de
 * archivos, y lo contrario (arrastrar una suelta y que se lleve la selección entera) mueve
 * clientes que la persona no estaba mirando.
 *
 * ⚠️ SÓLO LAS QUE ESTÁN EN LA LISTA (`orden`), igual que la barra del Plan, que actúa
 * sobre `tasks.filter((t) => sel.has(t.id))`: una selección puede guardar ids que la
 * búsqueda escondió, y moverlos es actuar sobre lo que no está en pantalla.
 */
export function quienesViajan(agarrado: number, seleccion: ReadonlySet<number>, orden: readonly number[]): number[] {
  if (!seleccion.has(agarrado)) return [agarrado];
  const lote = orden.filter((id) => seleccion.has(id));
  return lote.length > 1 ? lote : [agarrado];
}

/**
 * DÓNDE CAE, en la columna `destino`: el índice exacto donde va a aparecer, o `null` si
 * soltar ahí no mueve a nadie (todos los que viajan ya están en esa etapa).
 *
 * ⚠️ SALE DE LOS DATOS Y NO DE LA ALTURA DEL CURSOR, y ésa es la diferencia con el Plan
 * que no se ve. En el Plan la posición SE RESPETA: el número de la tarjeta sale de dónde
 * la soltaste (`scoreEntre`). Acá no hay orden dentro de una etapa —la columna se dibuja
 * en el orden de la lista, que decide la barra (nombre, antigüedad…)—, así que un hueco
 * que siguiera al cursor prometería un lugar que el tablero no honra: «la solté acá y
 * quedó allá», que es exactamente el reporte que el Plan ya pagó. El hueco va donde la
 * tarjeta VA a aparecer.
 *
 * Con varias viajando, el hueco marca dónde cae la PRIMERA (en el orden de la lista): un
 * hueco por cliente sería un tablero que se reacomoda entero mientras se arrastra.
 *
 * `columna` son los ids que hoy dibuja esa columna; `posicion` es el lugar de cada id en
 * la lista (el mismo orden que usó el reparto).
 */
export function dondeCae(
  destino: string,
  ids: readonly number[],
  etapaDe: (id: number) => string,
  columna: readonly number[],
  posicion: (id: number) => number,
): number | null {
  const mueven = ids.filter((id) => etapaDe(id) !== destino);
  if (!mueven.length) return null;
  const primera = Math.min(...mueven.map(posicion));
  let idx = 0;
  for (const id of columna) if (posicion(id) < primera) idx++;
  return idx;
}

// ── Los íconos ───────────────────────────────────────────────────────────────────────
// En la familia de `IconoTacho` y de `CalendarioLote` del Plan: viewBox 16, trazo 1.5,
// `currentColor`, `aria-hidden`. Mismo grosor que sus vecinos de fila, que es lo que la
// barra del Plan cuida renglón por renglón.

/** Una flecha que entra a una columna: llevar a otra etapa. */
function IconoMover() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.2 8h8.4" />
      <path d="M7.6 5l3 3-3 3" />
      <path d="M13.6 2.8v10.4" />
    </svg>
  );
}

/** Doble chevrón: un paso más, el que sigue. */
function IconoSiguiente() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.6 4.2 7.4 8l-3.8 3.8" />
      <path d="M8.6 4.2 12.4 8l-3.8 3.8" />
    </svg>
  );
}

/** La bandeja con la flecha: lo mismo que «descargar» del set de la casa, en el registro
 *  de 16 de esta barra (el de 24 dibujado a 16 sale más fino que sus vecinos). */
function IconoExportar() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 10v2.2a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3V10" />
      <path d="M4.8 6.6 8 9.8l3.2-3.2" />
      <path d="M8 9.8V2.5" />
    </svg>
  );
}

/** Copia de `BtnIcono` (AccionesLote.tsx): `.mk-icon-btn` con su `data-tone`. NADA de
 *  color ni fondo inline —la clase los pone para que el tema oscuro los repinte, y un
 *  inline le gana a cualquier clase—; lo único que se pisa con texto es la geometría. */
function BtnIcono({ rotulo, texto, tono = 'dim', onClick, children }: {
  rotulo: string;
  texto?: string;
  tono?: 'dim' | 'primary';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="mk-icon-btn" data-tone={tono}
      title={rotulo} aria-label={rotulo}
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
 * Las etapas como opciones del desplegable, AGRUPADAS POR FASE cuando el servicio tiene
 * fases. Sin fases es una lista plana: un grupo de un solo título es ruido.
 *
 * ⚠️ LOS GRUPOS SIGUEN EL ORDEN DE LAS COLUMNAS, no el de la lista de fases: el menú se
 * lee de arriba abajo como el tablero se lee de izquierda a derecha. Las etapas sin fase
 * (o con una fase que ya no existe, que `colorDeEtapa` también trata como suelta) van en
 * «Sin fase», en el lugar donde aparece la primera.
 *
 * ⚠️ ES EL MENÚ DE «MOVER A UNA ETAPA» EN LAS DOS VISTAS: lo usan esta barra y el chip de la
 * columna Etapa de la tabla. Hasta el 05/10/2026 la tabla armaba el suyo —una lista plana
 * con la fase repetida debajo de cada etapa, cinco de nueve a la vista— y la barra éste:
 * la misma pregunta con dos menús distintos. Se monta con `alContenido` en el `Dropdown`,
 * o una sola columna sale con los 500 px de un menú a varias.
 */
export function opcionesDeEtapas(etapas: readonly EtapaEntrega[], fases: readonly FaseEntrega[]): { options?: DropdownOption[]; columns?: DropdownGroup[][] } {
  const opcion = (e: EtapaEntrega): DropdownOption => ({ value: e.key, label: e.label, color: colorDeEtapa(e, fases) });
  if (!fases.length) return { options: etapas.map(opcion) };
  const grupos: DropdownGroup[] = [];
  const porClave = new Map<string, DropdownGroup>();
  for (const e of etapas) {
    const f = faseDe(fases, e.fase);
    const clave = f?.key ?? '';
    let g = porClave.get(clave);
    if (!g) { g = { title: f?.label ?? 'Sin fase', options: [] }; porClave.set(clave, g); grupos.push(g); }
    g.options.push(opcion(e));
  }
  // UNA columna con los grupos uno debajo del otro: en varias columnas el menú se parte
  // en filas de dos y la tercera fase queda sola abajo, estirada a lo ancho.
  return { columns: [grupos] };
}

export function LoteClientes({ elegidos, etapas, fases, onMover, onSiguiente, onExportar, onTodos, onLimpiar, visibles, puedeAvanzar = true }: {
  /** Cuántos clientes hay marcados. Con 0 la barra no se dibuja. */
  elegidos: number;
  /** Las columnas del servicio que se está mirando. `null` = sin servicio: no hay a dónde
   *  mover, así que «Mover a» y «Siguiente etapa» no se dibujan. */
  etapas: EtapaEntrega[] | null;
  fases: FaseEntrega[];
  onMover: (etapa: string) => void;
  onSiguiente: () => void;
  onExportar: () => void;
  /** Marcar todos los que la pantalla tiene a la vista. */
  onTodos: () => void;
  onLimpiar: () => void;
  /**
   * OPCIONAL: cuántos hay a la vista. Con él, «Seleccionar todos» se esconde cuando ya
   * están todos marcados — un control que no puede hacer nada se lee como roto. Sin él
   * se dibuja siempre, que es lo que hace el contrato de base.
   */
  visibles?: number;
  /**
   * OPCIONAL: `false` cuando TODOS los marcados ya están en la última etapa. Ahí
   * «Siguiente etapa» no movería a nadie, y no se dibuja. Por default se dibuja: la barra
   * no sabe en qué etapa está cada uno, la pantalla sí.
   */
  puedeAvanzar?: boolean;
}) {
  if (elegidos <= 0) return null;

  const n = elegidos;
  // Sin texto en pantalla para la cuenta, el `title` es lo que dice sobre QUÉ actúa cada
  // botón: «Exportar» a secas no nombra su objeto.
  const cosas = n === 1 ? '1 cliente' : `${n} clientes`;
  const rotCuenta = `${cosas} seleccionado${n === 1 ? '' : 's'}`;
  const rotMover = `Mover ${cosas} a una etapa`;
  const rotSiguiente = `Pasar ${cosas} a la siguiente etapa`;
  const rotExportar = `Exportar ${cosas} a CSV`;
  const hayEtapas = !!etapas && etapas.length > 0;
  // Con una sola columna no hay «siguiente»: cada uno ya está en la última.
  const haySiguiente = !!etapas && etapas.length > 1 && puedeAvanzar;
  const faltanTodos = visibles == null || n < visibles;
  const menu = etapas ? opcionesDeEtapas(etapas, fases) : null;

  return (
    // ⚠️ PEGADA ARRIBA, COMO EN EL PLAN (`BarraPegada`, Tablas.tsx). Y la regla que viene
    // con ella, que es de quien la MONTA: el sticky se posiciona contra el ancestro que
    // scrollea, así que esta barra va AFUERA de cualquier caja con `overflow` (la de la
    // tabla, `.mk-scroll-x`). Adentro de una caja así queda clavada, con el
    // `position: sticky` puesto y sin un solo error (AGENTS.md: «Un eje en `hidden`
    // convierte el otro en `auto`...»). En el kanban la tab no scrollea —scrollea cada
    // columna—, así que ahí el sticky no hace nada y tampoco molesta.
    // ⚠️ Y COMO CREA UN CONTEXTO DE APILAMIENTO (sticky + zIndex), nada que se abra desde
    // acá puede vivir adentro: los desplegables van por portal (`Dropdown` ya lo hace).
    <div style={{ position: 'sticky', top: 8, zIndex: 20 }}>
      <div role="group" aria-label={`Acciones sobre ${cosas}`}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, flexWrap: 'wrap', padding: '7px 12px', borderRadius: 11,
          border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)',
          fontFamily: SANS, boxShadow: '0 8px 24px rgba(18,21,27,.14)',
        }}>

        {/* ── IZQUIERDA: la casilla, marcada, y el número. Destildarla limpia. ──────────
            Es un `<input type="checkbox">` de verdad y no un botón dibujado como casilla:
            es el MISMO control que las tarjetas y las filas, se anuncia como casilla
            marcada y el teclado la conoce. El número NO es clicable: el `role="status"`
            lo canta a medida que se marcan clientes. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <input type="checkbox" checked readOnly
            onClick={onLimpiar}
            title="Quitar la selección" aria-label={`${rotCuenta}. Quitar la selección`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none', margin: 0 }} />
          <span role="status" title={rotCuenta} aria-label={rotCuenta}
            style={{ flex: 'none', minWidth: 24, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
            {n}
          </span>
          {/* ⚠️ «SELECCIONAR TODOS» VIVE AL LADO DE LA CUENTA Y NO EN EL MEDIO: no cambia a
              ningún cliente, cambia CON QUÉ se está trabajando — que es lo que dice este
              grupo. En el Plan la misma pregunta la contesta la casilla del encabezado de
              la tabla; el kanban no tiene encabezado, así que acá es la única puerta. */}
          {faltanTodos && (
            <button type="button" onClick={onTodos}
              title="Seleccionar todos los que están a la vista"
              style={{ flex: 'none', border: 'none', background: 'none', padding: '4px 2px', cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>
              Seleccionar todos
            </button>
          )}
        </div>

        {/* ── MEDIO: lo que CAMBIA a los clientes, con su palabra. ─────────────────────
            `gap: 14` y no 6, igual que el Plan: son controles con borde Y palabra, y a 6 px
            sus cajas se tocan y se leen como un solo bloque. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none', justifyContent: 'center' }}>
          {hayEtapas && menu && (
            /* El `title` va en el span de afuera porque el `Dropdown` no tiene esa prop
               (mismo pendiente que anota la barra del Plan). */
            <span title={rotMover} style={{ flex: '0 1 auto', minWidth: 0, display: 'inline-flex' }}>
              <Dropdown
                value=""
                resetAfterSelect
                placeholder="Mover a"
                align="right"
                ariaLabel={rotMover}
                icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoMover /></span>}
                buttonStyle={{ height: 34, padding: '0 8px', borderRadius: 9, gap: 4, fontSize: 12.5 }}
                options={menu.options}
                columns={menu.columns}
                alContenido
                onChange={(v) => { if (v) onMover(v); }} />
            </span>
          )}
          {haySiguiente && (
            <BtnIcono rotulo={rotSiguiente} texto="Siguiente etapa" onClick={onSiguiente}>
              <IconoSiguiente />
            </BtnIcono>
          )}
        </div>

        {/* ── DERECHA: lo que SALE de la pantalla. ──────────────────────────────────────
            En el Plan esta ranura es lo que CIERRA la tarjeta (completar, eliminar); un
            cliente en entrega no se cierra desde acá (ver la cabecera), así que lo que
            queda es lo que sale sin cambiar nada. ⚠️ Y CON PALABRA, al revés que el tilde
            y el tacho del Plan: aquellos significan lo mismo en toda la pantalla y ahí el
            ícono ya es el nombre; una bandeja con flecha no aparece en ningún otro lugar
            de esta tab. El grupo se queda aunque estuviera vacío: es el `flex: 1` que
            equilibra a la izquierda y deja el medio en el medio. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <BtnIcono rotulo={rotExportar} texto="Exportar" onClick={onExportar}>
            <IconoExportar />
          </BtnIcono>
        </div>
      </div>
    </div>
  );
}
