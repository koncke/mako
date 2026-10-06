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
// CADA FILA SE ASIGNA SOLA, sin «Guardar»: tildar es asignar. Y asignar TRAE LOS LEADS
// que esa campaña ya tiene en el CRM («si selecciono una campaña, me traiga todos los
// leads. No solo los futuros»).
//
// ⚠️ PREGUNTA SI VA A MOVER LEADS, Y SÓLO ENTONCES. Una campaña nueva no tiene ninguno y
// se asigna con un clic —«no haya tanta fricción al asignar una nueva campaña, porque
// podrían haber nuevas campañas todo el tiempo»—. Una vieja sí, y pueden ser muchos:
// medido en el cliente más grande, una sola campaña tiene 896 leads. Pasar 896 personas de
// tablero con un clic y un toast de siete segundos no es «sin fricción», es una sorpresa.
// La pregunta lleva el número y de dónde salen; después queda el «Deshacer» igual.
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
import type { CampanaAsignada } from '@/lib/campana-config';
import { hayQuePreguntar, preguntaAsignar } from '@/lib/campana-asignar';
import {
  campanasDelProductoAction, previaCampanaAction, asignarCampanaAction, quitarCampanaAction,
  deshacerAsignacionAction, type EstadoCampanas, type FilaCampana,
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

/** Las columnas, en UN lugar: la cabecera y las filas leen la misma plantilla. */
const COLS = '30px minmax(0, 1fr) 128px 64px 150px';
const FILA: CSSProperties = { display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', columnGap: 10 };
const TH: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--faint)', fontWeight: 600, whiteSpace: 'nowrap',
};

type Orden = 'nombre' | 'estado' | 'leads';
type Item = { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string };
type Pide = { item: Item } & ReturnType<typeof preguntaAsignar>;

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
  const [ocupada, setOcupada] = useState<string | null>(null);
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
    const va = dondeVa.has(id) ? dondeVa.get(id)! : undefined;
    if (filtroAsig === 'este') return dondeVa.has(id) && va === funnelId;
    if (filtroAsig === 'otro') return dondeVa.has(id) && va !== funnelId;
    return !dondeVa.has(id);
  };
  const pasaEstado = (e: string | null) =>
    !filtroEstado || (filtroEstado === 'ACTIVE' ? e === 'ACTIVE' : filtroEstado === 'otra' ? e !== 'ACTIVE' : true);

  // Sin `useMemo`: son decenas de filas, y memoizar con cinco funciones de cierre adentro
  // es la forma de que una dependencia olvidada deje la tabla vieja sin un error.
  const filas = (() => {
    if (!estado) return [];
    const texto = q.trim().toLowerCase();
    const coincide = (f: FilaCampana) => !texto || f.nombre.toLowerCase().includes(texto) || f.id.includes(texto);
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

  const ordenar = (o: Orden) => {
    if (orden === o) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrden(o); setDir(o === 'nombre' ? 'asc' : 'desc'); }
  };

  // ── Asignar y quitar ─────────────────────────────────────────────────────
  const asignar = async (item: Item, traer: boolean) => {
    setOcupada(item.id);
    try {
      const r = await asignarCampanaAction(funnelId, item, traer);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      actualizar(r.asignadas);
      const n = r.movidos.length;
      // El toast dice QUÉ pasó, en tres o cuatro palabras (AGENTS.md); el porqué vive acá.
      show(n ? `${n} ${n === 1 ? 'lead traído' : 'leads traídos'}` : 'Asignada', async () => {
        const d = await deshacerAsignacionAction(item.id, r.antes, r.movidos);
        if (d.ok) actualizar(d.asignadas); else show(d.error, undefined, 'bad');
      });
    } catch {
      show('No se pudo asignar', undefined, 'bad');
    } finally {
      setOcupada(null);
    }
  };

  const alternar = async (item: Item) => {
    if (ocupada) return;
    if (esMia(item.id)) {
      // QUITAR NO PREGUNTA: no mueve a nadie. Los leads que ya trajo se quedan; lo único
      // que cambia es dónde caen los nuevos — y eso se deshace con el toast.
      const antes = asignadas.find((a) => a.id === item.id) ?? null;
      setOcupada(item.id);
      try {
        const r = await quitarCampanaAction(item.id);
        if (!r.ok) { show(r.error, undefined, 'bad'); return; }
        actualizar(r.asignadas);
        show('Quitada', async () => {
          if (!antes) return;
          const d = await asignarCampanaAction(antes.funnelId, antes, false);
          if (d.ok) actualizar(d.asignadas);
        });
      } finally {
        setOcupada(null);
      }
      return;
    }
    setOcupada(item.id);
    let previa: Awaited<ReturnType<typeof previaCampanaAction>>;
    try {
      previa = await previaCampanaAction(funnelId, item);
    } catch {
      setOcupada(null);
      show('No se pudo contar', undefined, 'bad');
      return;
    }
    if (!previa.ok) { setOcupada(null); show(previa.error, undefined, 'bad'); return; }
    const otro = dondeVa.has(item.id) ? nombreDe(dondeVa.get(item.id)!) : null;
    // CUÁNDO se pregunta y QUÉ dice la pregunta salen de lib/campana-asignar.ts: la tabla de
    // Ads Manager hace la misma, y dos copias de una regla de producto divergen.
    if (!hayQuePreguntar(previa.aTraer, otro)) { setOcupada(null); await asignar(item, true); return; }
    setOcupada(null);
    setPide({
      item,
      ...preguntaAsignar({ producto: nombreProducto, aTraer: previa.aTraer, desde: otro, porProducto: previa.porProducto }),
    });
  };

  // ── Dibujo ───────────────────────────────────────────────────────────────
  const opcionesEstado: DropdownOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'ACTIVE', label: 'Activas' },
    { value: 'otra', label: 'No activas' },
  ];
  const opcionesAsig: DropdownOption[] = [
    { value: '', label: 'Todas' },
    { value: 'este', label: 'En este producto' },
    { value: 'otro', label: 'En otro producto' },
    { value: 'sin', label: 'Sin asignar' },
  ];
  const mias = asignadas.filter((a) => a.funnelId === funnelId).length;

  const celdaProducto = (id: string): ReactNode => {
    if (!dondeVa.has(id)) return <span style={{ color: 'var(--faint)' }}>—</span>;
    const va = dondeVa.get(id)!;
    if (va === funnelId) return <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Este</span>;
    return <span style={{ color: 'var(--dim)' }} title={`Hoy va a ${nombreDe(va)}`}>{nombreDe(va)}</span>;
  };

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

  const fila = (f: FilaCampana, item: Item, nivel: 0 | 1, hijos = 0) => {
    const on = esMia(f.id);
    const abierta = abiertas.has(f.id);
    return (
      <div key={f.id} role="row" className="mk-fila-campana" onClick={() => void alternar(item)}
        style={{
          ...FILA, padding: '9px 12px', borderTop: '1px solid var(--border)', cursor: ocupada ? 'progress' : 'pointer',
          background: on ? 'var(--primary-weak)' : 'transparent', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)',
        }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {ocupada === f.id ? <Spinner size={15} /> : (
            <input type="checkbox" checked={on} readOnly tabIndex={-1}
              aria-label={on ? `Quitar «${f.nombre}» de ${nombreProducto}` : `Asignar «${f.nombre}» a ${nombreProducto}`}
              style={{ width: 16, height: 16, margin: 0, cursor: 'pointer', accentColor: 'var(--primary)', pointerEvents: 'none' }} />
          )}
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
        <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{celdaProducto(f.id)}</span>
      </div>
    );
  };

  const cuerpo = (
    <Modal titulo="Campañas de Meta" encabezado={<span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{nombreProducto}</span>}
      onCerrar={onCerrar} ancho={860} alto="min(85vh, 720px)" anidada={anidada} sinFiletes>
      {/* `crm-hover`: el portal se escapa del `<main>` del CRM, que es donde vive el velo
          de hover de todos sus botones (app/_ui/ui.css). Sin esto, los de acá no reaccionan. */}
      <div className="crm-hover" style={{ padding: 0, minWidth: 520 }}>
        {/* La barra y la cabecera viajan juntas y quedan pegadas arriba: el cuerpo del
            modal es el que scrollea, así que el sticky se posiciona contra él. */}
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
            <Dropdown value={filtroAsig} options={opcionesAsig} onChange={setFiltroAsig} ariaLabel="Filtrar por producto" width={170} />
          </div>
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
            <span />
            <Th activo={orden === 'nombre'} dir={dir} onSort={() => ordenar('nombre')}>Campaña</Th>
            <Th activo={orden === 'estado'} dir={dir} onSort={() => ordenar('estado')}>Estado</Th>
            <Th activo={orden === 'leads'} dir={dir} onSort={() => ordenar('leads')} derecha>Leads</Th>
            <span style={TH}>Producto</span>
          </div>
        </div>

        <div role="table" aria-label="Campañas de Meta" style={{ borderBottom: filas.length ? '1px solid var(--border)' : 'none' }}>
          {filas.map((c) => {
            const hijos = conjuntosDe.get(c.id) ?? [];
            const texto = q.trim().toLowerCase();
            // Con una búsqueda que matchea un CONJUNTO, la campaña se abre sola: si no, el
            // resultado está escondido detrás de un chevrón y se lee como «no lo encontró».
            const porHijo = !!texto && !c.nombre.toLowerCase().includes(texto) && hijos.some((s) => s.nombre.toLowerCase().includes(texto));
            const abierta = abiertas.has(c.id) || porHijo;
            return [
              fila(c, { tipo: 'campana', id: c.id, nombre: c.nombre }, 0, hijos.length),
              ...(abierta
                ? [...hijos].sort((a, b) => b.leads - a.leads || a.nombre.localeCompare(b.nombre, 'es'))
                  .map((s) => fila(s, { tipo: 'conjunto', id: s.id, nombre: s.nombre, campanaId: c.id }, 1))
                : []),
            ];
          })}
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
          onConfirm={() => { const it = pide.item; setPide(null); void asignar(it, true); }}
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
