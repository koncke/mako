'use client';

// =============================================================================
// TablaClientes — la misma cartera, en filas, agrupada por ETAPA de la entrega
// =============================================================================
// La otra mitad del interruptor kanban/tabla de Customer Success. La tarjeta es para
// RECONOCER —foto, portada, el nombre grande— y la tabla es para COMPARAR: con doce
// clientes, «¿quién tiene más abierto?» en tarjetas es scrollear y acordarse; en una tabla
// es mirar una columna.
//
// ⚠️ EL MOLDE ES LA TABLA DEL PLAN (app/plan/board/Tablas.tsx), no una tabla nueva. Los
// pedidos de Martín (05/10/2026), textuales:
//   · «si estoy en la vista de tabla debería poder moverse también, ya tenemos animación
//     de eso en el plan»
//   · «revisa el diseño de la tabla, que se parezca más a como lo tenemos en el plan. Con
//     acciones útiles. Y aplica lo que te pedí de mover filas, ya tenemos esa animación.
//     Muy importante que implementes las acciones en LOTE, tanto para la vista de tablas
//     como kanban... Copia todo del plan.»
// De ahí salen las piezas, una por una y del mismo lugar:
//   · la casilla de SELECCIÓN en la primera columna, con «todos» arriba y el estado
//     intermedio (`indeterminate`) — el mismo control que en Gmail, Drive y el Plan;
//   · el encabezado en mono, chico y en mayúsculas, y la fila apretada;
//   · el grupo que se PLIEGA con un chevron y su conteo (la `FilaPlegada` del Plan), acá
//     una por etapa en vez de una para lo completado;
//   · y el ARRASTRE de filas: imagen del sistema vacía, una copia NUESTRA de la fila que
//     sigue al cursor, la marca de dónde cae y el auto-scroll adentro del `dragover`.
//
// ⚠️ LA BARRA DE ACCIONES EN LOTE NO VIVE ACÁ. La dibuja la pantalla (ClientesApp), UNA
// sola para las dos vistas: la selección vive afuera (props `seleccion`/`onSeleccion`),
// así que tildar en la tabla y pasar al kanban no la pierde — el bug que el Plan pagó el
// 04/10/2026 por guardar la selección adentro de cada vista.
//
// ⚠️ NO REPITE LO QUE LA TARJETA YA DICE MEJOR. No lleva portada ni números grandes: lleva
// las mismas tres cuentas en columnas alineadas, que es lo único que cambia el modo de
// leerlas.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as DragReact } from 'react';
import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';
import type { Asignacion } from './KanbanEntrega';
import { Marca } from '@/app/_components/Marca';
import { Dropdown } from '@/app/components/Dropdown';
import { colorDe } from './ClienteCard';
import { opcionesDeEtapas } from './LoteClientes';
import { useFotoCliente } from './foto-cliente';
import { tiempoEnEtapa } from './en-etapa';
import { repartirEnEtapas, colorDeEtapa, faseDe, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';
// ⚠️ EL MISMO MOLDE DE ARRASTRE QUE EL PLAN Y QUE EL KANBAN DE ESTA PANTALLA, importado y no
// reescrito: la foto vacía (la que pinta el sistema operativo no la gobierna ningún CSS) y
// quién scrollea de verdad. Ver la nota de `montarCopiaFila` sobre la única pieza que NO se
// pudo importar.
import { fotoVaciaDeArrastre, scrollerDe } from '@/app/plan/board/arrastre-copia';

/** La clave del grupo de los clientes cuya etapa guardada ya no existe en el catálogo. */
const BORRADA = '__etapa_borrada__';

/** Sólo los hex de 6 dígitos aceptan el sufijo de alfa: con un `rgb()` o un `var()`, el
 *  color sale inválido y el navegador descarta la declaración en silencio. */
const HEX6 = /^#[0-9a-f]{6}$/i;
const conAlfa = (color: string, alfa: string, sinHex: string) => (HEX6.test(color) ? color + alfa : sinHex);

/**
 * LA COPIA DE LA FILA QUE SIGUE AL CURSOR — la de la tabla del Plan, pieza por pieza.
 *
 * ⚠️ ES LA ÚNICA PARTE DEL GESTO QUE NO SE IMPORTA, y no por gusto. `useArrastreCopia`
 * (arrastre-copia.ts) clona el nodo tal cual con `position: fixed` y le suma un
 * `rotate(1.5deg)`: sirve para una TARJETA. Un `<tr>` suelto no se puede posicionar
 * (`position` lo blockifica y sus celdas pierden los anchos), y una fila de 1.400 px
 * inclinada 1,5° corre sus puntas ±18 px. La tabla del Plan lo resolvió armando un `<div>`
 * con su propia tablita adentro y los anchos de celda clavados en lo medido — y eso vive
 * adentro de su `useArrastreFilas`, sin exportar. Unificarlo es sacar esta función a
 * arrastre-copia.ts y que Tablas.tsx la importe; queda anotado, no hecho, porque esos dos
 * archivos no son de esta pasada.
 *
 * Lo que está medido allá y viaja igual acá:
 *   · se mueve escribiendo `transform` desde un `dragover` en `document` y EN CAPTURA
 *     (el de la tabla no cubre los huecos ni el fondo), nunca con `setState`;
 *   · se saca en `dragend` Y en `drop`, los dos, o queda un nodo colgado;
 *   · `cloneNode` copia el ATRIBUTO y React escribe los `input` por PROPIEDAD: sin copiar
 *     `checked` a mano, la copia viaja con la casilla desmarcada.
 *
 * Y una cosa propia: con varias filas seleccionadas se mueven TODAS, así que la copia lo
 * dice («3 clientes»). Sin eso, el gesto muestra una fila y mueve tres.
 *
 * Devuelve la función que la saca; es idempotente.
 */
/** La cara del cliente en su fila. Es un componente porque la foto automática es un hook,
 *  y un hook no se llama adentro del `map` de las filas. */
function CaraFila({ c, nombre }: { c: ClienteCruce; nombre: string }) {
  const foto = useFotoCliente(c);
  return <Marca icono={c.icono ?? c.avatarUrl} foto={foto} nombre={nombre} tam={26} y={c.avatarY} color={colorDe(nombre)} />;
}

function montarCopiaFila(tr: HTMLTableRowElement, clientX: number, clientY: number, cuantos: number): () => void {
  const r = tr.getBoundingClientRect();
  const fondo = getComputedStyle(tr).backgroundColor;
  const cont = document.createElement('div');
  Object.assign(cont.style, {
    position: 'fixed', top: '0', left: '0', width: `${r.width}px`,
    // Opaca de verdad: si el fondo computado es transparente, la copia deja ver la tabla
    // por debajo y se ve tan fantasmal como la del navegador.
    background: fondo && fondo !== 'rgba(0, 0, 0, 0)' ? fondo : 'var(--surface)',
    border: '1px solid var(--border-strong)', borderRadius: '10px', overflow: 'hidden',
    boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
    transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none',
  });
  // La tablita lleva la MISMA clase que la tabla de verdad: los estilos de esta pantalla
  // viven en una hoja (no inline como en el Plan), así que sin `.tc` la copia sale sin
  // padding ni tipografía.
  const tabla = document.createElement('table');
  tabla.className = 'tc';
  tabla.style.tableLayout = 'fixed';
  const cuerpo = document.createElement('tbody');
  const clon = tr.cloneNode(true) as HTMLElement;
  clon.removeAttribute('draggable');
  Array.from(tr.children).forEach((celda, i) => {
    const h = clon.children[i] as HTMLElement | undefined;
    if (!h) return;
    h.style.width = `${(celda as HTMLElement).getBoundingClientRect().width}px`;
    h.style.borderBottom = 'none';
    h.style.boxShadow = 'none';
  });
  const origen = tr.querySelectorAll('input');
  clon.querySelectorAll('input').forEach((inp, i) => {
    const o = origen[i];
    if (!o) return;
    inp.checked = o.checked;
    inp.value = o.value;
  });
  cuerpo.appendChild(clon);
  tabla.appendChild(cuerpo);
  cont.appendChild(tabla);
  if (cuantos > 1) {
    const n = document.createElement('span');
    n.className = 'tc-copia-n';
    n.textContent = `${cuantos} clientes`;
    cont.appendChild(n);
  }
  document.body.appendChild(cont);

  const dx = clientX - r.left;
  const dy = clientY - r.top;
  const mover = (ev: DragEvent) => {
    cont.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
  };
  let viva = true;
  const fin = () => {
    if (!viva) return;
    viva = false;
    document.removeEventListener('dragover', mover, true);
    document.removeEventListener('dragend', fin, true);
    document.removeEventListener('drop', fin, true);
    cont.remove();
  };
  document.addEventListener('dragover', mover, true);
  document.addEventListener('dragend', fin, true);
  document.addEventListener('drop', fin, true);
  return fin;
}

/** Lo que se arrastra: el cliente agarrado, o todos los seleccionados si él es uno. */
type EnMano = {
  ids: number[];
  /** `true` = se agarró una fila seleccionada con más seleccionadas: se mueven todas. */
  lote: boolean;
  /**
   * La etapa donde soltar NO cambia nada: la de todos, si todos están en la misma. Con una
   * selección repartida en dos etapas no existe — soltar en cualquiera mueve a alguien —, y
   * por eso no alcanza con «la etapa de la fila agarrada».
   */
  quieta: string | null;
};

export function TablaClientes({
  filas, numeroDe, resumenDe, tableroOk,
  etapas, fases, asignacion,
  onMover, onMoverLote,
  seleccion, onSeleccion,
  onAbrir, onNuevo,
}: {
  filas: ClienteCruce[];
  numeroDe: Map<number, number>;
  resumenDe: (leadId: number) => ResumenTrabajo | null;
  tableroOk: boolean;
  /**
   * Las etapas de la entrega del servicio elegido. `null` = no hay servicio, y entonces la
   * tabla es PLANA: sin grupos, sin columna de etapa y sin arrastre — no hay a dónde mover.
   */
  etapas: EtapaEntrega[] | null;
  /** Los tramos que le dan su color a las etapas (`colorDeEtapa`). Vacío es lo normal. */
  fases: FaseEntrega[];
  /** leadId → su etapa en ESTE servicio. Sin fila = está en la PRIMERA (derivado). */
  asignacion: Record<number, Asignacion>;
  onMover: (leadId: number, etapa: string) => void;
  onMoverLote: (leadIds: number[], etapa: string) => void;
  /** La selección vive AFUERA: es una sola para la tabla, el kanban y la barra de lote. */
  seleccion: ReadonlySet<number>;
  onSeleccion: (next: Set<number>) => void;
  onAbrir: (leadId: number) => void;
  onNuevo: () => void;
}) {
  const agrupada = Boolean(etapas && etapas.length);

  /**
   * Cada cliente en su grupo, con LA MISMA función que el kanban y el editor de etapas.
   *
   * ⚠️ UN CLIENTE SIN FILA ESTÁ EN LA PRIMERA ETAPA, y esa regla vive en
   * `repartirEnEtapas`: escrita otra vez acá, la tabla y el kanban contarían distinto la
   * misma cartera — que es exactamente el reclamo que la creó («no puede ser que yo vea
   * muchos leads en la vista de tabla y luego no vea nada en la vista de kanban»).
   */
  const reparto = useMemo(
    () => (etapas && etapas.length ? repartirEnEtapas(etapas, filas, (c) => asignacion[c.leadId]?.etapa) : null),
    [etapas, filas, asignacion],
  );

  /** La etapa de un cliente, con la misma derivación que el reparto. */
  const etapaDe = (leadId: number): string => {
    const k = (asignacion[leadId]?.etapa ?? '').trim();
    return k || (etapas?.[0]?.key ?? '');
  };

  /**
   * LOS GRUPOS PLEGADOS, por clave de etapa. Es estado de esta vista y nada más: plegar
   * es cómo se mira, no qué se eligió.
   *
   * ⚠️ NO ES UN `useState(props…)`: guarda claves, y una clave que ya no existe (otro
   * servicio, una etapa borrada) simplemente no matchea ningún grupo. Cambiar de servicio
   * no lo deja mostrando nada viejo.
   */
  const [plegadas, setPlegadas] = useState<ReadonlySet<string>>(new Set());
  const plegar = (k: string) => setPlegadas((p) => {
    const n = new Set(p);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  // ── El gesto ─────────────────────────────────────────────────────────────────

  /**
   * QUÉ HAY EN LA MANO ES UN REF, NO ESTADO. React vuelca un `setState` un frame después y
   * los handlers del gesto corren antes: con la decisión colgada de un estado, el primer
   * `dragover` lee `null`, no llama a `preventDefault()` y el `drop` no llega nunca. Medido
   * en el kanban de esta misma pantalla el 05/10/2026.
   */
  const enMano = useRef<EnMano | null>(null);
  /** Dónde va a caer: la etapa bajo el cursor. Se repinta sólo cuando CAMBIA. */
  const [destino, setDestino] = useState<string | null>(null);
  /** Quién scrollea en este gesto, decidido UNA vez al agarrar. `null` = la ventana. */
  const caja = useRef<HTMLElement | null>(null);
  const sacarCopia = useRef<(() => void) | null>(null);

  const limpiar = () => {
    enMano.current = null;
    caja.current = null;
    sacarCopia.current?.();
    sacarCopia.current = null;
    setDestino(null);
  };
  // Si la tabla se desmonta a mitad del gesto (cambiar de vista con el teclado), la copia
  // no puede quedar colgada en el `body`.
  useEffect(() => () => { sacarCopia.current?.(); sacarCopia.current = null; }, []);

  /**
   * El auto-scroll, ADENTRO del `dragover`: durante un arrastre nativo el navegador congela
   * `requestAnimationFrame` y los timers (medido el 23/09/2026: 0 px en 1,2 s), y lo único
   * que sigue entregando es este evento. Los números son los de la tabla del Plan.
   */
  const empujar = (clientY: number) => {
    const el = caja.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const d = clientY < r.top + 70 ? -1 : clientY > r.bottom - 70 ? 1 : 0;
      if (d) el.scrollTop += d * 14;
      return;
    }
    const d = clientY < 110 ? -1 : clientY > window.innerHeight - 110 ? 1 : 0;
    if (d) window.scrollBy(0, d * 18);
  };

  const agarrar = (e: DragReact<HTMLTableRowElement>, leadId: number) => {
    const t = e.target as Element | null;
    // ⚠️ DOS COSAS NO ARRANCAN UN ARRASTRE: lo que vive en un PORTAL (el menú del
    // desplegable de etapa se dibuja en el `body`, pero sus eventos de React burbujean
    // hasta esta fila) y lo que está marcado `data-nodrag`.
    if (!t || !e.currentTarget.contains(t) || t.closest?.('[data-nodrag]')) { e.preventDefault(); return; }
    // Si la fila está seleccionada y hay más, se mueve la SELECCIÓN — pero sólo lo que se
    // VE: seleccionar lo que no está en pantalla es cómo se cambia de más (la misma cuenta
    // que hace el «todos» de la tabla del Plan).
    const selVisibles = filas.filter((c) => seleccion.has(c.leadId)).map((c) => c.leadId);
    const lote = seleccion.has(leadId) && selVisibles.length > 1;
    const ids = lote ? selVisibles : [leadId];
    const etapasDeIds = new Set(ids.map(etapaDe));
    e.dataTransfer.setData('text/plain', String(leadId));
    e.dataTransfer.effectAllowed = 'move';
    fotoVaciaDeArrastre(e.dataTransfer);
    caja.current = scrollerDe(e.currentTarget);
    sacarCopia.current?.();
    sacarCopia.current = montarCopiaFila(e.currentTarget, e.clientX, e.clientY, ids.length);
    enMano.current = { ids, lote, quieta: etapasDeIds.size === 1 ? [...etapasDeIds][0] : null };
    // ⚠️ LA LIMPIEZA VA EN `document`, NO SÓLO EN LA FILA. Al soltar en otro grupo, la fila
    // se re-monta en otro `<tbody>` y su `onDragEnd` puede no llegar nunca: el estado
    // quedaría con una fila «en la mano» para siempre.
    document.addEventListener('dragend', limpiar, { capture: true, once: true });
  };

  const soltarEn = (key: string) => {
    const m = enMano.current;
    limpiar();
    if (!m) return;
    // Soltar donde ya estaba no es un movimiento: ni viaje al server ni cartel de «se
    // movió» sobre algo que no se movió.
    const mueven = m.ids.filter((id) => etapaDe(id) !== key);
    if (!mueven.length) return;
    if (m.lote && mueven.length > 1) onMoverLote(mueven, key);
    else onMover(mueven[0], key);
  };

  /** Lo que va en el `<tbody>` de cada grupo: es el DESTINO del gesto. */
  const destinoProps = (key: string) => ({
    onDragOver: (e: DragReact<HTMLTableSectionElement>) => {
      const m = enMano.current;
      if (!m) return;
      // Sin `preventDefault` el navegador RECHAZA el drop y no pasa nada, que se lee como
      // que el arrastre no anda.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const k = m.quieta === key ? null : key;
      setDestino((p) => (p === k ? p : k));
    },
    onDragLeave: (e: DragReact<HTMLTableSectionElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDestino((p) => (p === key ? null : p));
    },
    onDrop: (e: DragReact<HTMLTableSectionElement>) => { e.preventDefault(); soltarEn(key); },
  });

  // ── La selección ─────────────────────────────────────────────────────────────

  const alternar = (id: number) => {
    const n = new Set(seleccion);
    if (n.has(id)) n.delete(id); else n.add(id);
    onSeleccion(n);
  };
  /** Un grupo entero: si están todos, se sacan; si no, se suman los que faltan. */
  const alternarGrupo = (ids: number[]) => {
    const todos = ids.length > 0 && ids.every((id) => seleccion.has(id));
    const n = new Set(seleccion);
    for (const id of ids) { if (todos) n.delete(id); else n.add(id); }
    onSeleccion(n);
  };

  // Los grupos, en el orden del tablero, y al final los de una etapa borrada.
  const grupos = reparto && etapas
    ? [
      ...etapas.map((e) => ({
        key: e.key, label: e.label, color: colorDeEtapa(e, fases), fase: faseDe(fases, e.fase)?.label ?? null,
        clientes: reparto.porEtapa[e.key] ?? [], borrada: false,
      })),
      ...(reparto.huerfanos.length
        ? [{ key: BORRADA, label: 'Etapa borrada', color: 'var(--bad)', fase: null, clientes: reparto.huerfanos, borrada: true }]
        : []),
    ]
    : [];

  /**
   * «Todos» es sobre lo VISIBLE: si un grupo está plegado, sus filas no se ven y no entran.
   * Es la misma cuenta que la tabla del Plan hace con lo completado plegado.
   */
  const idsVisibles = agrupada
    ? grupos.filter((g) => !plegadas.has(g.key)).flatMap((g) => g.clientes.map((c) => c.leadId))
    : filas.map((c) => c.leadId);
  const todosSel = idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.has(id));

  // El MISMO menú que «Mover a» de la barra de lote: agrupado por fase (ver
  // `opcionesDeEtapas`). Una lista propia acá repetía la fase debajo de cada etapa.
  const menuEtapa = opcionesDeEtapas(etapas ?? [], fases);

  // Las columnas que se DIBUJAN: lo mira el `colSpan` de la cabecera de cada grupo. Un
  // número suelto es lo que hacía desbordar la fila plegada del Plan.
  const cols = agrupada ? 8 : 6;

  const fila = (c: ClienteCruce, linea: string | null) => {
    const nombre = c.nombre.trim() || 'Sin nombre';
    const r = resumenDe(c.leadId);
    // ⚠️ SIN TABLERO, UN GUION Y NO UN CERO. Un 0 es una afirmación sobre su trabajo; si la
    // lectura falló, es una que nadie hizo. Misma regla que la tarjeta con `tableroOk`.
    const n = (v: number | undefined) => (tableroOk ? String(v ?? 0) : '—');
    // La marca de dónde cae: una LÍNEA bajo la última fila del grupo destino, como la del
    // Plan. Una línea y no un hueco: un hueco del alto de una fila en una tabla es justo
    // el salto de layout que una tabla no puede tener.
    const td: CSSProperties | undefined = linea ? { boxShadow: `inset 0 -2px 0 ${linea}` } : undefined;
    const k = etapaDe(c.leadId);
    const t = agrupada ? tiempoEnEtapa(asignacion[c.leadId]?.etapa_desde) : null;
    const etapa = agrupada ? (etapas ?? []).find((e) => e.key === k) ?? null : null;
    const color = etapa ? colorDeEtapa(etapa, fases) : 'var(--bad)';
    return (
      /* ⚠️ LA FILA ENTERA ABRE LA FICHA, y el corte va en la CELDA (`data-parar`), no en
         cada control: lo que se agregue mañana adentro lo hereda. Y lo que llega desde un
         PORTAL (el menú del desplegable) no cuenta: React burbujea sus clics hasta acá
         aunque en el DOM vivan en el `body`, y sin este corte elegir una etapa abría
         además la ficha. */
      <tr key={c.leadId} className="tc-f" tabIndex={0} title={`Abrir «${nombre}»`}
        draggable={agrupada || undefined}
        onDragStart={agrupada ? (e) => agarrar(e, c.leadId) : undefined}
        onClick={(e) => {
          const el = e.target as Element;
          if (!e.currentTarget.contains(el) || el.closest?.('[data-parar]')) return;
          onAbrir(c.leadId);
        }}
        // Doble clic para seleccionar el nombre no puede abrir la ficha en el segundo.
        onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir(c.leadId); }}
        style={{ cursor: agrupada ? 'grab' : 'pointer' }}>
        <td data-parar className="tc-sel" style={td}>
          <input type="checkbox" checked={seleccion.has(c.leadId)} onChange={() => alternar(c.leadId)}
            title="Seleccionar" aria-label={`Seleccionar «${nombre}»`} />
        </td>
        <td style={td}>
          <span className="tc-quien">
            <CaraFila c={c} nombre={nombre} />
            <span className="tc-nom">{nombre}</span>
            <span className="tc-num">Cliente {numeroDe.get(c.leadId) ?? 0}</span>
          </span>
        </td>
        <td className="tc-emp" style={td}>{c.empresa?.trim() || <span className="tc-vacio">—</span>}</td>
        {agrupada && (
          /* LA ETAPA SE CAMBIA DESDE LA CELDA, como la prioridad desde su chip en la tabla
             del Plan: el mismo `Dropdown` del repo, con el color de cada etapa. Es la
             salida sin arrastre — con el teclado, o en una tabla larga donde el grupo de
             destino está tres pantallas más abajo. */
          <td data-parar style={td}>
            <Dropdown value={k} options={menuEtapa.options} alContenido placeholder="Etapa borrada"
              ariaLabel={`Mover «${nombre}» de etapa`}
              onChange={(v) => { if (v && v !== k) onMover(c.leadId, v); }}
              buttonStyle={{
                padding: '3px 8px 3px 9px', borderRadius: 999, gap: 6, fontSize: 12, fontWeight: 600,
                maxWidth: 170, color: etapa ? 'var(--ink)' : 'var(--bad)',
                background: conAlfa(color, '18', 'var(--surface-2)'),
                border: `1px solid ${conAlfa(color, '40', 'var(--border)')}`,
              }} />
          </td>
        )}
        {agrupada && (
          /* «Sin fila» no tiene reloj: el cliente nunca se movió, así que no hay desde
             cuándo contar. Un «recién» ahí sería un dato inventado. */
          <td className={`tc-desde${t?.trabado ? ' tc-desde-trabado' : ''}`} style={td}
            title={t ? (t.trabado ? `${t.corto} sin moverse` : `En esta etapa ${t.frase}`) : 'Todavía no se movió de etapa'}>
            {t ? t.corto : <span className="tc-vacio">—</span>}
          </td>
        )}
        <td className="num" style={td}>{n(r?.proyectos)}</td>
        <td className="num" style={td}>{n(r?.abiertas)}</td>
        <td className="num" style={td}>{n(r?.recurrentes)}</td>
      </tr>
    );
  };

  return (
    <>
      {/* ⚠️ EN TABLA, CREAR ES UN BOTÓN ARRIBA — como «+ Crear proyecto» en la tabla del
          tablero. «Falta el botón de nuevo cliente cuando está en la vista de tabla»
          (27/09/2026): una fila de acción al final de una lista se lee como un dato más, y
          con la tabla scrolleada ni siquiera está en pantalla. */}
      <div className="tc-arriba">
        <button type="button" className="tc-nuevo" onClick={onNuevo}>＋ Nuevo cliente</button>
      </div>
      {/* El auto-scroll escucha en la CAJA y no en cada grupo: tiene que empujar también
          cuando el cursor pasa por el encabezado o por un grupo que no es destino. */}
      <div className="tc-caja mk-scroll-x"
        onDragOver={(e) => { if (enMano.current) empujar(e.clientY); }}>
        <table className={`tc${agrupada ? ' tc-agrupada' : ''}`}>
          <thead>
            <tr>
              <th className="tc-sel">
                <input type="checkbox" checked={todosSel}
                  ref={(el) => { if (el) el.indeterminate = !todosSel && idsVisibles.some((id) => seleccion.has(id)); }}
                  onChange={() => onSeleccion(todosSel ? new Set() : new Set(idsVisibles))}
                  disabled={idsVisibles.length === 0}
                  title={todosSel ? 'Quitar la selección' : 'Seleccionar todos'} aria-label="Seleccionar todos" />
              </th>
              <th>Cliente</th>
              <th>Empresa</th>
              {agrupada && <th className="tc-c-etapa">Etapa</th>}
              {agrupada && <th className="tc-c-desde">En la etapa</th>}
              <th className="num">Proyectos</th>
              <th className="num">Tareas</th>
              <th className="num">Recurrentes</th>
            </tr>
          </thead>
          {agrupada ? grupos.map((g) => {
            const plegada = plegadas.has(g.key);
            const ids = g.clientes.map((c) => c.leadId);
            const todos = ids.length > 0 && ids.every((id) => seleccion.has(id));
            const algunos = !todos && ids.some((id) => seleccion.has(id));
            const esDestino = destino === g.key;
            // La línea va bajo la ÚLTIMA fila que se VE del grupo; con el grupo vacío o
            // plegado, bajo su cabecera — que en ese caso es todo lo que hay para soltar.
            const conFilas = !plegada && g.clientes.length > 0;
            const cab: CSSProperties | undefined = esDestino
              ? { background: conAlfa(g.color, '1f', 'var(--primary-weak)'), ...(conFilas ? {} : { boxShadow: `inset 0 -2px 0 ${g.color}` }) }
              : undefined;
            return (
              /* UN `<tbody>` POR GRUPO: es el destino del gesto, y una tabla puede tener
                 varios. Así el `dragover` sabe a qué etapa va sin medir una sola fila —
                 acá la POSICIÓN dentro del grupo no significa nada (el orden lo pone la
                 barra), así que no hay puntos medios que calcular. Los de una etapa
                 borrada no son un destino: no se puede mover a nadie a lo que no existe. */
              <tbody key={g.key} data-etapa={g.key} {...(g.borrada ? {} : destinoProps(g.key))}>
                <tr className={`tc-g${g.borrada ? ' tc-g-borrada' : ''}`}>
                  <td className="tc-sel" style={cab}>
                    {/* Un grupo vacío no lleva casilla: tildarla no seleccionaría nada. */}
                    {ids.length > 0 && (
                      <input type="checkbox" checked={todos}
                        ref={(el) => { if (el) el.indeterminate = algunos; }}
                        onChange={() => alternarGrupo(ids)}
                        title={todos ? 'Quitar la selección' : 'Seleccionar el grupo'}
                        aria-label={`Seleccionar los clientes de ${g.label}`} />
                    )}
                  </td>
                  <td colSpan={cols - 1} style={cab}>
                    {/* La anatomía de `FilaPlegada` del Plan: el chevron, el conteo y el
                        `aria-expanded`, para que se lea como algo que se abre. */}
                    <button type="button" className="tc-g-btn" onClick={() => plegar(g.key)} aria-expanded={!plegada}
                      title={`${plegada ? 'Ver' : 'Ocultar'} ${g.label}`}>
                      <span aria-hidden className={`tc-g-chev${plegada ? '' : ' tc-g-abierta'}`}>▸</span>
                      <span aria-hidden className="tc-g-dot" style={{ background: g.color }} />
                      <span className="tc-g-nom">{g.label}</span>
                      {g.fase && <span className="tc-g-fase">{g.fase}</span>}
                      <span className="tc-g-n">{g.clientes.length}</span>
                    </button>
                  </td>
                </tr>
                {!plegada && g.clientes.map((c, i) => fila(c, esDestino && i === g.clientes.length - 1 ? g.color : null))}
              </tbody>
            );
          }) : (
            <tbody>{filas.map((c) => fila(c, null))}</tbody>
          )}
        </table>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </div>
    </>
  );
}

const CSS = `
/* El mismo ancho y el mismo centrado que la barra (ver alla). La caja scrollea de costado
   por su cuenta (mk-scroll-x): en un telefono la tabla no empuja el ancho de la pagina. */
.tc-caja{ border:1px solid var(--border); border-radius:14px;
  background:var(--surface); max-width:var(--cartera-max, 1180px); margin:0 auto; }
/* Las medidas son las de la tabla del Plan: encabezado en mono de 10 px en mayusculas,
   celdas con 10 px de costado. El piso de ancho es la suma de lo que las columnas piden,
   para que en angosto aparezca la barra de la caja y no se aplasten los nombres. */
.tc{ width:100%; min-width:680px; border-collapse:collapse; font-family:'Geist', sans-serif; font-size:13.5px; }
.tc-agrupada{ min-width:940px; }
.tc th{ text-align:left; font-family:'Geist Mono', monospace; font-size:10px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--faint); font-weight:700; padding:9px 10px;
  border-bottom:1px solid var(--border); background:var(--surface-2); white-space:nowrap; }
.tc td{ padding:6px 10px; border-bottom:1px solid var(--border); color:var(--ink); vertical-align:middle; }
.tc .tc-sel{ width:28px; padding-right:0; }
.tc-sel input{ display:block; width:16px; height:16px; margin:0; cursor:pointer; accent-color:var(--primary); }
.tc-sel input:disabled{ cursor:default; }
.tc tr.tc-f:hover > td{ background:var(--surface-2); }
.tc > tbody:last-child > tr:last-child > td{ border-bottom:0; }
.tc .num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; width:96px; }
.tc .tc-c-etapa{ width:180px; }
.tc .tc-c-desde{ width:112px; }
.tc-quien{ display:inline-flex; align-items:center; gap:9px; min-width:0; }
.tc-nom{ font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tc-num{ font-size:11.5px; color:var(--faint); white-space:nowrap; }
.tc-emp{ color:var(--dim); }
.tc-vacio{ color:var(--faint); }
/* Hace cuanto: en rojo pasado el umbral, el mismo que la tarjeta del kanban. */
.tc-desde{ color:var(--dim); white-space:nowrap; font-variant-numeric:tabular-nums; }
.tc-desde-trabado{ color:var(--bad); font-weight:650; }

/* La cabecera de cada grupo: la FilaPlegada del Plan, con el punto de la etapa. */
.tc-g > td{ background:var(--surface-2); padding:0; border-bottom:1px solid var(--border); }
.tc-g > td.tc-sel{ padding:0 0 0 10px; }
.tc-g:hover > td{ background:var(--surface); }
.tc-g-btn{ display:flex; align-items:center; gap:8px; width:100%; text-align:left; border:0;
  background:transparent; color:var(--dim); font:inherit; font-size:12.5px; font-weight:600;
  padding:9px 10px; cursor:pointer; }
.tc-g-btn:hover{ color:var(--ink); }
.tc-g-chev{ flex:none; display:inline-block; width:10px; font-size:10px; transition:transform .12s ease; }
.tc-g-abierta{ transform:rotate(90deg); }
.tc-g-dot{ flex:none; width:8px; height:8px; border-radius:999px; }
.tc-g-nom{ color:var(--ink); font-weight:700; }
.tc-g-borrada .tc-g-nom{ color:var(--bad); }
.tc-g-fase{ font-size:11px; font-weight:600; color:var(--dim); border:1px solid var(--border);
  border-radius:999px; padding:0 7px; white-space:nowrap; }
.tc-g-n{ font-size:11.5px; font-weight:700; color:var(--dim); background:var(--surface);
  border:1px solid var(--border); border-radius:999px; padding:0 7px; font-variant-numeric:tabular-nums; }

/* El conteo que viaja en la copia cuando se arrastra una seleccion. */
.tc-copia-n{ position:absolute; top:50%; right:12px; transform:translateY(-50%);
  font-family:'Geist', sans-serif; font-size:11.5px; font-weight:700; color:var(--on-ink);
  background:var(--ink); border-radius:999px; padding:2px 9px; white-space:nowrap; }

/* El boton de crear, arriba y alineado con la caja de la tabla. */
.tc-arriba{ display:flex; justify-content:flex-end; max-width:var(--cartera-max, 1180px); margin:0 auto 12px; }
.tc-nuevo{ border:1px solid var(--border-strong); background:var(--surface); border-radius:9px;
  padding:8px 14px; font:inherit; font-size:13px; font-weight:600; color:var(--ink); cursor:pointer; }
.tc-nuevo:hover{ border-color:var(--primary); color:var(--primary); }
`;
