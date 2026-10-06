'use client';

// =============================================================================
// CampanasModal — la tabla de campañas de Meta de un producto
// =============================================================================
// Pedido de Martín (05/10/2026), textual: «no sea un loader, que sea una sección
// directamente, porque es algo importante que requiere tener una barra de busqueda,
// filtros, ordenamientos... Si son muchas campañas debería poder buscar facilmente...
// Si le doy a los 3 puntos debería abrir un modal solo de eso. Haz que sea formato
// tabla, procura que se vea bonito y minimalista».
//
// Lo abren dos puertas y es el MISMO modal: el «⋯» de la columna de entrada del tablero
// y el botón de la sección «Campañas de Meta» del pop-up del embudo.
//
// ⚠️ LA CASILLA SELECCIONA, NO ASIGNA. La primera versión asignaba al tildar, y Martín
// (06/10/2026): «El botón de checkbox no debería asignar, porque se entiende en todo MaKo
// que esa es la selección multiple... Y falta el checkbox más arriba para seleccionar a
// todo. Y luego una topbar aparece para poder asignar en lote». Es lo que hacen el tablero
// del CRM y el del plan, y una casilla que hace otra cosa en una sola pantalla es una
// trampa. Asignar es:
//   · DE A UNA: el desplegable de la columna Producto (`ProductoCelda`, la MISMA pieza que
//     la tabla de Ads Manager), que además dice el NOMBRE del producto — «El producto no
//     debe decir "Este" eso es muy informal y no se entiende».
//   · EN LOTE: la barra que aparece arriba con lo tildado.
//
// Asignar TRAE LOS LEADS que esa campaña ya tiene en el CRM («si selecciono una campaña,
// me traiga todos los leads. No solo los futuros»), y pregunta sólo si va a traer leads o
// a sacársela a otro producto: la regla es UNA (lib/campana-asignar.ts) y la usan las tres
// puertas (esta barra, la celda de cada fila y la tabla de Ads Manager).
//
// ⚠️ TRAER ES AGREGAR, NO MOVER (06/10/2026): cada lead sigue en el producto donde estaba
// y además aparece en éste, en su etapa de entrada (app/crm/campanas-actions.ts). Por eso
// el toast dice «traídos» y no «movidos», y el deshacer saca SÓLO a los que se agregaron.
//
// ⚠️ VA POR PORTAL AL `body`. Una de sus puertas es el pop-up del embudo, y montado
// adentro de esa caja sería un DESCENDIENTE suyo en el DOM: la pila de modales apaga al
// de abajo con `display:none` y se llevaría puesto al que se acaba de abrir (ver
// `contenedor` en app/_components/pila-modales.ts).
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Confirm, Spinner, Toast, useToast, SANS, MONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { ProductoCelda, type ItemCampana } from '@/app/ads-manager/ProductoCelda';
import type { CampanaAsignada } from '@/lib/campana-config';
import { hayQuePreguntar, preguntaAsignar, valorDeProducto, funnelDeValor } from '@/lib/campana-asignar';
import {
  campanasDelProductoAction, previaLoteAction, asignarLoteAction, quitarLoteAction, deshacerLoteAction,
  type EstadoCampanas, type FilaCampana,
} from './campanas-actions';

/** Lo que dice Meta de cada estado, en una palabra. Lo que no está acá se muestra
 *  tal cual, en minúscula: inventarle una traducción a un estado nuevo es peor. */
const ESTADO: Record<string, string> = {
  ACTIVE: 'Activa', PAUSED: 'Pausada', CAMPAIGN_PAUSED: 'Campaña pausada', ADSET_PAUSED: 'Pausado',
  IN_PROCESS: 'En proceso', WITH_ISSUES: 'Con problemas', PENDING_REVIEW: 'En revisión', DISAPPROVED: 'Rechazada',
  PREAPPROVED: 'Preaprobada', PENDING_BILLING_INFO: 'Falta el pago', ARCHIVED: 'Archivada', DELETED: 'Borrada',
};
const estadoTxt = (e: string) => ESTADO[e] ?? e.toLowerCase().replace(/_/g, ' ');
const MALO = new Set(['WITH_ISSUES', 'DISAPPROVED', 'PENDING_BILLING_INFO']);
const tonoEstado = (e: string | null) =>
  e === 'ACTIVE' ? 'var(--good)' : e && MALO.has(e) ? 'var(--bad)' : 'var(--faint)';

/** Las columnas, en UN lugar: la cabecera y las filas leen la misma plantilla. La última
 *  mide lo que mide el desplegable de `ProductoCelda` (168) más su aire. */
const COLS = '30px minmax(0, 1fr) 120px 56px 176px';
const FILA: CSSProperties = { display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', columnGap: 10 };
const TH: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--faint)', fontWeight: 600, whiteSpace: 'nowrap',
};
/** El desplegable de la columna Producto, sin borde y bajo: se lee como el nombre del
 *  producto con su flecha, y el velo de hover dice que se puede tocar. Con el borde por
 *  defecto, cada fila medía 58 px. */
const CELDA_PRODUCTO: CSSProperties = {
  border: '1px solid transparent', background: 'transparent', padding: '4px 8px',
  minHeight: 0, height: 30, fontSize: 13, fontWeight: 500,
};
const CASILLA: CSSProperties = { width: 16, height: 16, margin: 0, cursor: 'pointer', accentColor: 'var(--primary)' };

type Orden = 'nombre' | 'estado' | 'leads';
type Pide = { funnelId: number | null; items: ItemCampana[] } & ReturnType<typeof preguntaAsignar>;

export function CampanasModal({ funnelId, nombreProducto, anidada = false, onCerrar, onCambio }: {
  /** El producto. `null` = el del negocio — y quien monta normaliza el id numérico del
   *  principal a `null` antes de pasarlo (ver `destino` en campanas-actions.ts). */
  funnelId: number | null;
  nombreProducto: string;
  /** Si se abre desde otro modal y es parte de la misma tarea: el de atrás no se apaga. */
  anidada?: boolean;
  onCerrar: () => void;
  /** Para que la sección que lo abrió se redibuje sin volver a leer. */
  onCambio?: (asignadas: CampanaAsignada[]) => void;
}) {
  const [estado, setEstado] = useState<EstadoCampanas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroAsig, setFiltroAsig] = useState('');
  const [orden, setOrden] = useState<Orden | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [trabajando, setTrabajando] = useState(false);
  const [pide, setPide] = useState<Pide | null>(null);
  const { toast, show, clear } = useToast(7000);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);
  useEffect(() => {
    let vivo = true;
    campanasDelProductoAction().then((r) => {
      if (!vivo) return;
      if (r.ok) setEstado(r); else setError(r.error);
    }).catch(() => { if (vivo) setError('No se pudo leer'); });
    return () => { vivo = false; };
  }, []);

  const asignadas = useMemo(() => estado?.asignadas ?? [], [estado]);
  const dondeVa = useMemo(() => new Map(asignadas.map((a) => [a.id, a.funnelId])), [asignadas]);
  const nombreDe = (id: number | null) => estado?.productos.find((p) => p.id === id)?.nombre ?? 'otro producto';
  const esMia = (id: string) => dondeVa.has(id) && dondeVa.get(id) === funnelId;

  const actualizar = (nuevas: CampanaAsignada[]) => {
    setEstado((e) => (e ? { ...e, asignadas: nuevas } : e));
    onCambio?.(nuevas);
  };

  // ── Filtrar y ordenar ─────────────────────────────────────────────────────
  const conjuntosDe = useMemo(() => {
    const m = new Map<string, FilaCampana[]>();
    for (const s of estado?.conjuntos ?? []) m.set(s.campanaId, [...(m.get(s.campanaId) ?? []), s]);
    return m;
  }, [estado]);

  const pasaAsig = (id: string) => {
    if (!filtroAsig) return true;
    if (filtroAsig === 'este') return esMia(id);
    if (filtroAsig === 'otro') return dondeVa.has(id) && !esMia(id);
    return !dondeVa.has(id);
  };
  const pasaEstado = (e: string | null) =>
    !filtroEstado || (filtroEstado === 'ACTIVE' ? e === 'ACTIVE' : filtroEstado === 'otra' ? e !== 'ACTIVE' : true);
  const texto = q.trim().toLowerCase();
  const coincide = (f: FilaCampana) => !texto || f.nombre.toLowerCase().includes(texto) || f.id.includes(texto);

  // Sin `useMemo`: son decenas de filas, y memoizar con cinco funciones de cierre adentro
  // es la forma de que una dependencia olvidada deje la tabla vieja sin un error.
  const filas = (() => {
    if (!estado) return [];
    const out = estado.campanas.filter((c) => {
      const hijos = conjuntosDe.get(c.id) ?? [];
      // Una campaña entra si ELLA pasa los filtros, o si pasa alguno de sus conjuntos:
      // buscar el nombre de un conjunto tiene que encontrarlo aunque viva adentro.
      const ella = coincide(c) && pasaEstado(c.estado) && pasaAsig(c.id);
      return ella || hijos.some((s) => coincide(s) && pasaEstado(s.estado) && pasaAsig(s.id));
    });
    const rango = (e: string | null) => (e === 'ACTIVE' ? 0 : e == null ? 2 : 1);
    const k = dir === 'asc' ? 1 : -1;
    return out.sort((a, b) => {
      if (orden === 'nombre') return k * a.nombre.localeCompare(b.nombre, 'es');
      if (orden === 'leads') return k * (a.leads - b.leads);
      if (orden === 'estado') return k * (rango(b.estado) - rango(a.estado)) || b.leads - a.leads;
      // Sin orden elegido: las de este producto arriba, después las activas, después las
      // que más leads traen. Es lo que se busca primero al abrir.
      return Number(esMia(b.id)) - Number(esMia(a.id)) || rango(a.estado) - rango(b.estado) || b.leads - a.leads
        || a.nombre.localeCompare(b.nombre, 'es');
    });
  })();

  /** Los conjuntos que se ven de una campaña: los abiertos a mano, o los que la búsqueda
   *  encontró adentro — si no, el resultado queda detrás de un chevrón y se lee como «no
   *  lo encontró». */
  const hijosVisibles = (c: FilaCampana): FilaCampana[] => {
    const hijos = conjuntosDe.get(c.id) ?? [];
    const porHijo = !!texto && !c.nombre.toLowerCase().includes(texto) && hijos.some((s) => s.nombre.toLowerCase().includes(texto));
    if (!abiertas.has(c.id) && !porHijo) return [];
    return [...hijos].sort((a, b) => b.leads - a.leads || a.nombre.localeCompare(b.nombre, 'es'));
  };

  const ordenar = (o: Orden) => {
    if (orden === o) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(o); setDir(o === 'nombre' ? 'asc' : 'desc'); }
  };

  // ── Selección ────────────────────────────────────────────────────────────
  // Cada id visible con lo que hace falta para asignarlo. La casilla de «todos» tilda lo
  // VISIBLE: con un filtro puesto, llevarse lo escondido sería asignar lo que nadie vio.
  const visibles = new Map<string, ItemCampana>();
  for (const c of filas) {
    visibles.set(c.id, { tipo: 'campana', id: c.id, nombre: c.nombre });
    for (const s of hijosVisibles(c)) visibles.set(s.id, { tipo: 'conjunto', id: s.id, nombre: s.nombre, campanaId: c.id });
  }
  const todosTildados = visibles.size > 0 && [...visibles.keys()].every((id) => sel.has(id));
  const algunoTildado = [...visibles.keys()].some((id) => sel.has(id));
  const alternarSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarTodos = () => setSel((s) => {
    const n = new Set(s);
    if (todosTildados) for (const id of visibles.keys()) n.delete(id);
    else for (const id of visibles.keys()) n.add(id);
    return n;
  });
  // Lo tildado que se puede tocar: lo que SE VE. Si un filtro escondió algo tildado, la
  // barra no lo cuenta ni lo asigna.
  const elegidos = [...sel].map((id) => visibles.get(id)).filter((x): x is ItemCampana => !!x);

  // ── El lote ──────────────────────────────────────────────────────────────
  const asignarLote = async (fid: number | null, items: ItemCampana[]) => {
    setTrabajando(true);
    setPide(null);
    try {
      const r = await asignarLoteAction(fid, items, true);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      actualizar(r.asignadas);
      setSel(new Set());
      // `movidos` son los AGREGADOS: el nombre quedó por la tabla de Ads Manager (ver el tipo
      // `Movido` en campanas-actions.ts). Nadie salió de su producto.
      const n = r.movidos.length;
      // El toast dice QUÉ pasó, en tres o cuatro palabras (AGENTS.md); el porqué vive acá.
      // UN deshacer para todo el lote: es la unidad en la que la persona decidió.
      // ⚠️ Y los que NO se pudieron agregar se dicen: con `agregarLoteAProducto` un ítem
      // puede fallar entero (producto sin etapas) y un «Asignadas» pelado escondería que sus
      // leads no llegaron.
      const base = n ? `${n} ${n === 1 ? 'lead traído' : 'leads traídos'}` : `${items.length} ${items.length === 1 ? 'asignada' : 'asignadas'}`;
      show(r.fallaron ? `${base} · ${r.fallaron} sin traer` : base, async () => {
        const d = await deshacerLoteAction(r.previos, r.movidos);
        if (d.ok) actualizar(d.asignadas); else show(d.error, undefined, 'bad');
      }, r.fallaron ? 'bad' : undefined);
    } catch {
      show('No se pudo asignar', undefined, 'bad');
    } finally {
      setTrabajando(false);
    }
  };

  const elegirProductoLote = async (valor: string) => {
    const items = elegidos;
    if (!items.length || trabajando) return;
    if (valor === '') {
      // QUITAR NO PREGUNTA: no mueve a nadie. Los leads que ya trajeron se quedan; lo
      // único que cambia es dónde caen los nuevos — y eso se deshace con el toast.
      setTrabajando(true);
      try {
        const r = await quitarLoteAction(items.map((i) => i.id));
        if (!r.ok) { show(r.error, undefined, 'bad'); return; }
        actualizar(r.asignadas);
        setSel(new Set());
        show(`${items.length} ${items.length === 1 ? 'quitada' : 'quitadas'}`, async () => {
          const d = await deshacerLoteAction(r.previos, []);
          if (d.ok) actualizar(d.asignadas);
        });
      } catch {
        show('No se pudo quitar', undefined, 'bad');
      } finally {
        setTrabajando(false);
      }
      return;
    }
    const fid = funnelDeValor(valor);
    setTrabajando(true);
    let previa: Awaited<ReturnType<typeof previaLoteAction>>;
    try {
      previa = await previaLoteAction(fid, items);
    } catch {
      setTrabajando(false);
      show('No se pudo contar', undefined, 'bad');
      return;
    }
    setTrabajando(false);
    if (!previa.ok) { show(previa.error, undefined, 'bad'); return; }
    const desde = previa.desde.length ? previa.desde.join(', ') : null;
    if (!hayQuePreguntar(previa.aTraer, desde)) { await asignarLote(fid, items); return; }
    setPide({ funnelId: fid, items, ...preguntaAsignar({ producto: nombreDe(fid), aTraer: previa.aTraer, desde, porProducto: previa.porProducto }) });
  };

  // ── Dibujo ───────────────────────────────────────────────────────────────
  const opcionesEstado: DropdownOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'ACTIVE', label: 'Activas' },
    { value: 'otra', label: 'No activas' },
  ];
  const opcionesAsig: DropdownOption[] = [
    { value: '', label: 'Todos los productos' },
    { value: 'este', label: `En ${nombreProducto}` },
    { value: 'otro', label: 'En otro producto' },
    { value: 'sin', label: 'Sin asignar' },
  ];
  const opcionesLote: DropdownOption[] = [
    ...(estado?.productos ?? []).map((p) => ({ value: valorDeProducto(p.id), label: p.nombre })),
    { value: '', label: 'Sin asignar' },
  ];
  const mias = asignadas.filter((a) => a.funnelId === funnelId).length;

  const celdaEstado = (e: string | null): ReactNode => {
    if (e == null) {
      // `null` = Meta no la nombró. Si Meta CONTESTÓ, es que ya no está; si no contestó,
      // no se sabe — y afirmar «ya no está» mandaría a sacar algo que está bien.
      return estado?.metaError
        ? <span style={{ color: 'var(--faint)' }}>—</span>
        : <span style={{ color: 'var(--faint)' }} title="Meta ya no la muestra. Sus leads siguen en el CRM.">Ya no está</span>;
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: tonoEstado(e), flex: 'none' }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{estadoTxt(e)}</span>
      </span>
    );
  };

  const fila = (f: FilaCampana, item: ItemCampana, nivel: 0 | 1, hijos = 0) => {
    const on = sel.has(f.id);
    const abierta = abiertas.has(f.id);
    const asignada = asignadas.find((a) => a.id === f.id);
    // Un conjunto sin asignación propia HEREDA la de su campaña (así rutea
    // `funnelIdDeCampana`), y la celda lo dice en vez de «Sin asignar».
    const heredadoDe = item.tipo === 'conjunto' && !asignada && item.campanaId && dondeVa.has(item.campanaId)
      ? nombreDe(dondeVa.get(item.campanaId)!) : null;
    return (
      <div key={f.id} role="row" className="mk-fila-campana" onClick={() => alternarSel(f.id)}
        style={{
          ...FILA, padding: '7px 12px', borderTop: '1px solid var(--border)', cursor: 'pointer',
          background: on ? 'var(--primary-weak)' : 'transparent', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)',
        }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={on} readOnly tabIndex={-1}
            aria-label={`Seleccionar «${f.nombre || f.id}»`}
            style={{ ...CASILLA, pointerEvents: 'none' }} />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingLeft: nivel ? 22 : 0 }}>
          {nivel === 0 && hijos > 0 && (
            <button type="button" aria-expanded={abierta}
              aria-label={abierta ? `Esconder los conjuntos de «${f.nombre}»` : `Ver los ${hijos} conjuntos de «${f.nombre}»`}
              title={abierta ? 'Esconder conjuntos' : `${hijos} ${hijos === 1 ? 'conjunto' : 'conjuntos'}`}
              onClick={(e) => {
                e.stopPropagation();
                setAbiertas((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; });
              }}
              className="mk-icon-btn" data-tone="dim"
              style={{ width: 22, height: 22, flex: 'none', marginLeft: -4, cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                style={{ transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M9 6l6 6-6 6" /></svg>
            </button>
          )}
          <span title={`${f.nombre || f.id} · ${f.id}`}
            style={{ fontWeight: nivel ? 500 : 600, color: nivel ? 'var(--dim)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {f.nombre || f.id}
          </span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--dim)', minWidth: 0 }}>{celdaEstado(f.estado)}</span>
        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: f.leads ? 'var(--ink)' : 'var(--faint)' }}>{f.leads}</span>
        {/* El NOMBRE del producto, y desde acá se asigna de a una. `ProductoCelda` frena el
            clic para que elegir un producto no tilde la fila. */}
        <span style={{ minWidth: 0 }}>
          {estado && (
            <ProductoCelda item={item} productos={estado.productos} asignada={asignada} heredadoDe={heredadoDe}
              onAsignadas={actualizar} show={show} disabled={trabajando} buttonStyle={CELDA_PRODUCTO} />
          )}
        </span>
      </div>
    );
  };

  const cuerpo = (
    <Modal titulo="Campañas de Meta" encabezado={<span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{nombreProducto}</span>}
      onCerrar={onCerrar} ancho={900} alto="min(85vh, 720px)" anidada={anidada} sinFiletes>
      {/* `crm-hover`: el portal se escapa del `<main>` del CRM, que es donde vive el velo
          de hover de todos sus botones (app/_ui/ui.css). Sin esto, los de acá no reaccionan. */}
      <div className="crm-hover" style={{ padding: 0, minWidth: 560 }}>
        {/* La barra, la de lote y la cabecera viajan juntas y quedan pegadas arriba: el
            cuerpo del modal es el que scrollea, así que el sticky se posiciona contra él. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', paddingTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 12 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campaña, conjunto o id"
              aria-label="Buscar campaña"
              style={{
                flex: '1 1 240px', minWidth: 180, padding: '9px 12px', borderRadius: 10,
                border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
                color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none',
              }} />
            <Dropdown value={filtroEstado} options={opcionesEstado} onChange={setFiltroEstado} ariaLabel="Filtrar por estado" width={170} />
            <Dropdown value={filtroAsig} options={opcionesAsig} onChange={setFiltroAsig} ariaLabel="Filtrar por producto" width={190} />
          </div>

          {/* LA BARRA DE LOTE aparece con lo tildado, arriba de la tabla — la misma forma que
              la del tablero (app/crm/AccionesLoteLeads.tsx): la casilla marcada limpia, el
              número, y lo que cambia. */}
          {elegidos.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', marginBottom: 10,
              background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12,
            }}>
              <input type="checkbox" checked readOnly onClick={() => setSel(new Set())}
                title="Quitar la selección" aria-label={`${elegidos.length} seleccionadas. Quitar la selección`} style={CASILLA} />
              <span role="status" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', minWidth: 20 }}>{elegidos.length}</span>
              <span style={{ flex: 1 }} />
              {trabajando && <Spinner size={15} />}
              <Dropdown value="" resetAfterSelect placeholder="Asignar a producto" disabled={trabajando}
                ariaLabel={`Asignar ${elegidos.length} a un producto`}
                icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoProducto /></span>}
                options={opcionesLote} onChange={(v) => void elegirProductoLote(v)} width={210} align="right" />
            </div>
          )}

          {/* Sin Meta, la tabla igual sirve: las campañas con datos guardados se pueden asignar
              y traen sus leads. Lo que no se ve son las de HOY, y eso se dice. */}
          {estado?.metaError && estado.campanas.length > 0 && (
            <p style={{ margin: '0 0 10px', fontFamily: SANS, fontSize: 12.5, color: 'var(--warn)' }}>
              {estado.metaError === 'sin-meta'
                ? <>Sin Meta conectado: se ven las campañas con datos guardados. <Link href="/integraciones" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar</Link></>
                : 'Meta no contestó: se ven las campañas con datos guardados.'}
            </p>
          )}
          <div role="row" style={{ ...FILA, padding: '0 12px 8px' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={todosTildados} disabled={!visibles.size}
                ref={(el) => { if (el) el.indeterminate = algunoTildado && !todosTildados; }}
                onChange={alternarTodos} aria-label="Seleccionar todas las que se ven" style={CASILLA} />
            </span>
            <Th activo={orden === 'nombre'} dir={dir} onSort={() => ordenar('nombre')}>Campaña</Th>
            <Th activo={orden === 'estado'} dir={dir} onSort={() => ordenar('estado')}>Estado</Th>
            <Th activo={orden === 'leads'} dir={dir} onSort={() => ordenar('leads')} derecha>Leads</Th>
            <span style={TH}>Producto</span>
          </div>
        </div>

        <div role="table" aria-label="Campañas de Meta" style={{ borderBottom: filas.length ? '1px solid var(--border)' : 'none' }}>
          {filas.map((c) => [
            fila(c, { tipo: 'campana', id: c.id, nombre: c.nombre }, 0, (conjuntosDe.get(c.id) ?? []).length),
            ...hijosVisibles(c).map((s) => fila(s, { tipo: 'conjunto', id: s.id, nombre: s.nombre, campanaId: c.id }, 1)),
          ])}
        </div>

        {/* Los estados vacíos son DISTINTOS y se dicen distinto: todavía no llegó · no hay
            Meta · no hay campañas · el filtro no deja nada. El giro va ADENTRO de la tabla,
            no tapando la pantalla: la barra ya se puede usar mientras llega. */}
        {!estado && !error && <div style={{ padding: '34px 0', display: 'flex', justifyContent: 'center' }}><Spinner size={18} /></div>}
        {!estado && error && <p style={vacio('var(--bad)')}>{error}</p>}
        {estado && estado.campanas.length === 0 && (
          estado.metaError === 'sin-meta'
            ? <p style={vacio()}><Link href="/integraciones" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conecta Meta</Link> para ver tus campañas.</p>
            : estado.metaError
              ? <p style={vacio('var(--warn)')}>{estado.metaError}</p>
              : <p style={vacio()}>Esta cuenta no tiene campañas.</p>
        )}
        {estado && estado.campanas.length > 0 && filas.length === 0 && <p style={vacio()}>Ninguna con esos filtros.</p>}

        {estado && estado.campanas.length > 0 && (
          <p style={{ margin: '12px 0 0', fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)' }}>
            {mias ? `${mias} ${mias === 1 ? 'asignada' : 'asignadas'} a ${nombreProducto}` : `Ninguna asignada a ${nombreProducto}`}
          </p>
        )}
      </div>

      {pide && (
        <Confirm
          title={pide.titulo} message={pide.mensaje}
          confirmLabel={pide.confirmar} cancelLabel={pide.cancelar} tone="primary"
          onConfirm={() => { const { funnelId: fid, items } = pide; void asignarLote(fid, items); }}
          onCancel={() => setPide(null)} />
      )}
      <Toast state={toast} onClose={clear} />
    </Modal>
  );

  if (!montado) return null;
  return createPortal(cuerpo, document.body);
}

const vacio = (color = 'var(--dim)'): CSSProperties => ({
  fontFamily: SANS, fontSize: 13.5, color, padding: '28px 12px', margin: 0, textAlign: 'center',
});

function IconoProducto() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 7.8 12 3 3.4 7.8 12 12.6z" /><path d="M3.4 7.8v8.4L12 21v-8.4" /><path d="M20.6 7.8v8.4L12 21" />
    </svg>
  );
}

/** Un encabezado que ORDENA. Mismo molde que `ThCrm` del tablero: la flecha sólo en la
 *  activa, y `aria-sort` para quien no la ve. */
function Th({ children, activo, dir, onSort, derecha }: {
  children: string; activo: boolean; dir: 'asc' | 'desc'; onSort: () => void; derecha?: boolean;
}) {
  return (
    <span style={{ ...TH, display: 'flex', justifyContent: derecha ? 'flex-end' : 'flex-start' }}
      aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onSort} title={`Ordenar por ${children.toLowerCase()}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 0, background: 'none',
          cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
          color: activo ? 'var(--ink)' : 'inherit', fontWeight: activo ? 700 : 'inherit',
        }}>
        {children}
        {activo && <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </span>
  );
}
