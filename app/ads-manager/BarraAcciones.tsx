'use client';

// =============================================================================
// BarraAcciones — el menú «⋯» y el filtro de la tabla de Ads Manager
// =============================================================================
// Pedido de Martín (05/10/2026): el botón de nueva campaña arriba a la derecha del todo,
// «más a la derecha el icono con los 3 puntos» con el resto de las acciones (incluidas las
// dos que estaban en el desplegable de MaKo, que se elimina), y «a la misma altura de las
// tabs, bien a la derecha, el botón de filtrado, que combine las fechas, estados y
// columnas… copia el desplegable de filtrado que tenemos en el plan, que tiene categorías
// y que si abres una ahí te muestra las opciones».
//
// Por qué una pieza aparte: la tabla ya son 1.400 líneas y estas dos no saben nada de
// Meta — reciben lo que hay que mostrar y devuelven lo que la persona eligió.
//
// ⚠️ EL FILTRO MEZCLA DOS COSAS QUE NO SE GUARDAN IGUAL, y por eso vive acá y no en tres
// controles: las FECHAS viajan en la URL (?desde&hasta, las lee el server para traer el
// rendimiento) y el ESTADO y las COLUMNAS son estado del navegador. Para quien mira es
// «qué estoy viendo», una sola pregunta; adentro son dos caminos y uno recarga la página.
//
// ⚠️ Y LAS COLUMNAS NO CIERRAN EL MENÚ. Son interruptores: elegir una es seguir eligiendo.
// Las fechas y el estado sí cierran — ahí la elección es una sola y mantenerlo abierto deja
// al tablero tapado por su propio filtro.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { presetsDeFecha } from '../_components/FechaFiltroGlobal';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { esConvertible, tipeadoACuenta } from '@/lib/presupuesto-cambio';
import { Icon } from '../_components/icons';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cierra al tocar afuera o con Escape. Lo comparten el menú y el filtro. */
function useCerrarAfuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cerrar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc, true); };
  }, [abierto, cerrar]);
  return ref;
}

const panel: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, minWidth: 280,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  boxShadow: '0 18px 46px rgba(18,21,27,.22)', padding: 6, fontFamily: SANS,
};

const item: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  textAlign: 'left', padding: '9px 11px', borderRadius: 9, border: 'none', background: 'transparent',
  cursor: 'pointer', fontFamily: SANS,
};

const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', padding: '8px 11px 4px' };

// ─────────────────────────────────────────────────────────────────────────────
// El menú «⋯»: todo lo que no es crear una campaña
// ─────────────────────────────────────────────────────────────────────────────

export type AccionMenu = { label: string; icono: string; onClick: () => void };

export function MenuAcciones({ acciones }: { acciones: AccionMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useCerrarAfuera(abierto, () => setAbierto(false));
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="menu" aria-expanded={abierto} aria-label="Más acciones" title="Más acciones"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 19, lineHeight: 1, cursor: 'pointer' }}>
        ⋯
      </button>
      {abierto && (
        <div role="menu" style={{ ...panel, minWidth: 300 }}>
          {acciones.map((a) => (
            <button key={a.label} type="button" role="menuitem" onClick={() => { setAbierto(false); a.onClick(); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{ ...item, justifyContent: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-flex', color: 'var(--dim)' }}><Icon name={a.icono} size={17} /></span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El filtro: fechas + estado + columnas, en un solo botón
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionColumna = { id: string; label: string };

type Categoria = 'fechas' | 'estado' | 'columnas';

export function FiltrosMenu({ hoyReal, estado, opcionesEstado, onEstado, columnas, visibles, onColumna }: {
  hoyReal: string;
  estado: string;
  opcionesEstado: Array<{ value: string; label: string; color?: string }>;
  onEstado: (v: string) => void;
  /** Las que se pueden prender y apagar en la tab actual. */
  columnas: OpcionColumna[];
  visibles: Record<string, boolean>;
  onColumna: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [dentro, setDentro] = useState<Categoria | null>(null);
  const ref = useCerrarAfuera(abierto, () => { setAbierto(false); setDentro(null); });

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const desdeUrl = params.get('desde') ?? '';
  const hastaUrl = params.get('hasta') ?? '';
  const rangoPropio = !!(desdeUrl && hastaUrl);

  const presets = presetsDeFecha(hoyReal);
  const presetActivo = rangoPropio ? presets.find((p) => p.desde === desdeUrl && p.hasta === hastaUrl) : undefined;
  const textoFechas = !rangoPropio ? 'Este mes' : presetActivo ? presetActivo.label : `${fmtDDMMYYYY(desdeUrl)} – ${fmtDDMMYYYY(hastaUrl)}`;

  const irA = (d: string, h: string) => {
    const p = new URLSearchParams(params.toString());
    if (d && h) { p.set('desde', d); p.set('hasta', h); } else { p.delete('desde'); p.delete('hasta'); }
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setAbierto(false); setDentro(null);
  };

  const estadoActivo = estado !== 'all';
  const ocultas = columnas.filter((c) => !visibles[c.id]).length;
  // El botón DICE si hay algo puesto: un filtro activo que no se ve es una tabla que miente.
  const activos = (rangoPropio ? 1 : 0) + (estadoActivo ? 1 : 0) + (ocultas ? 1 : 0);
  const textoEstado = opcionesEstado.find((o) => o.value === estado)?.label ?? 'Todos';

  const categorias: Array<{ key: Categoria; label: string; valor: string }> = [
    { key: 'fechas', label: 'Fechas', valor: textoFechas },
    { key: 'estado', label: 'Estado', valor: textoEstado },
    { key: 'columnas', label: 'Columnas', valor: ocultas ? `${columnas.length - ocultas} de ${columnas.length}` : 'Todas' },
  ];

  const fila = (contenido: React.ReactNode, onClick: () => void, key: string) => (
    <button key={key} type="button" onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      style={item}>{contenido}</button>
  );

  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      {/* Copiado del botón de filtro del CRM (app/crm/CrmToolbar.tsx) y no inventado acá:
          «venimos con una estetica más cuadrada… Copialo del CRM» (Martín, 06/10). Era una
          pastilla de `borderRadius: 999` y el repo no tiene ni una: el CRM resuelve sus
          BOTONES en 10 —72 veces, el radio más usado del módulo— y deja el 999 para los
          CHIPS y los contadores, que sí son redondos ahí también. La diferencia no es de
          gusto: una pastilla dice «soy una etiqueta» y este control se aprieta.
          ⚠️ El contador SÍ queda redondo, porque es un badge y no un botón, y va absoluto
          en la esquina como el del CRM — inline empujaba el ancho del botón con cada
          filtro que se prendía. */}
      <button type="button" onClick={() => { setAbierto((v) => !v); setDentro(null); }} aria-expanded={abierto}
        title={activos > 0 ? `${activos} filtro${activos === 1 ? '' : 's'} activo${activos === 1 ? '' : 's'}` : 'Filtrar por fecha, estado o columnas'}
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
          height: 40, padding: '0 14px', borderRadius: 10,
          border: '1px solid ' + (activos ? 'var(--primary-weak)' : 'var(--border-strong)'),
          background: abierto ? 'var(--surface-2)' : 'var(--surface)',
          color: activos ? 'var(--primary)' : 'var(--dim)',
          fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        <Icon name="funnel" size={13} />
        Filtrar
        {activos > 0 && (
          <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{activos}</span>
        )}
      </button>

      {abierto && (
        <div style={panel}>
          {dentro === null && categorias.map((c) => fila(
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)' }}>{c.valor} <span style={{ color: 'var(--faint)' }}>›</span></span>
            </>,
            () => setDentro(c.key), c.key,
          ))}

          {dentro !== null && (
            <>
              <button type="button" onClick={() => setDentro(null)} style={{ ...item, color: 'var(--dim)', fontSize: 12.5 }}>‹ Volver</button>
              <div style={rotulo}>{categorias.find((c) => c.key === dentro)?.label}</div>
            </>
          )}

          {dentro === 'fechas' && (
            <>
              {fila(<span style={{ fontSize: 13.5, color: !rangoPropio ? 'var(--primary-strong)' : 'var(--ink)' }}>Este mes {!rangoPropio && '✓'}</span>, () => irA('', ''), 'default')}
              {presets.map((p) => fila(
                <span style={{ fontSize: 13.5, color: presetActivo?.key === p.key ? 'var(--primary-strong)' : 'var(--ink)' }}>{p.label} {presetActivo?.key === p.key && '✓'}</span>,
                () => irA(p.desde, p.hasta), p.key,
              ))}
            </>
          )}

          {dentro === 'estado' && opcionesEstado.map((o) => fila(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: o.value === estado ? 'var(--primary-strong)' : 'var(--ink)' }}>
              {o.color && <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color }} />}
              {o.label} {o.value === estado && '✓'}
            </span>,
            () => { onEstado(o.value); setAbierto(false); setDentro(null); }, o.value,
          ))}

          {dentro === 'columnas' && columnas.map((c) => fila(
            <>
              <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{c.label}</span>
              <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${visibles[c.id] ? 'var(--primary)' : 'var(--border-strong)'}`, background: visibles[c.id] ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, lineHeight: '15px', textAlign: 'center' }}>{visibles[c.id] ? '✓' : ''}</span>
            </>,
            () => onColumna(c.id), c.id,
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La barra de la selección múltiple
// ─────────────────────────────────────────────────────────────────────────────
// Pedido de Martín (05/10/2026): «faltan muchas otras acciones en lote… utilizar iconos
// porque serán muchas… "Activar y pausar" son dos botones que podría ser uno, como un botón
// de arrastre típico de activo o pausa», y que no haya ningún «Limpiar selección» —el
// checkbox de la cabecera ya selecciona todo y lo suelta, como en el plan.
//
// Anatomía, la misma que la barra del plan: a la IZQUIERDA con qué estás trabajando, en el
// MEDIO lo que cambia, y nada a la derecha. Lo que una selección NO puede hacer no se
// dibuja: un control que no se puede cumplir se lee como que la app está rota.
//
// ⚠️ EL INTERRUPTOR ES UNO Y DICE EL ESTADO DEL LOTE. Encendido sólo si TODOS están
// activos: con una mezcla, apagado — y tocarlo los activa a todos, que es lo que alguien
// espera de un control que ve apagado. Dos botones separados obligaban a saber de antemano
// en qué estado estaba cada uno.
// =============================================================================

export type LoteNivel = 'campaign' | 'adset' | 'ad';

const NOMBRE: Record<LoteNivel, [string, string]> = {
  campaign: ['campaña', 'campañas'],
  adset: ['conjunto', 'conjuntos'],
  ad: ['anuncio', 'anuncios'],
};

const chip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px',
  borderRadius: 10, border: '1px solid rgba(243,245,248,.22)', background: 'rgba(243,245,248,.08)',
  color: 'var(--surface)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};

/**
 * Ícono del catálogo + TEXTO.
 *
 * ⚠️ La primera versión era sólo íconos, y Martín la frenó el 06/10: «no exageres con
 * poner solo iconos y nada de botones con texto, porque se acumularon todos a la izquierda
 * y no se entiende… No pongas emoji, siempre iconos para que sea mas profesional». Las dos
 * mitades importan: el texto es lo que hace legible la barra, y el ícono sale de
 * `app/_components/icons.tsx` — un emoji se dibuja distinto en cada sistema y no hereda el
 * color del botón.
 */
function BotonLote({ icono, children, onClick, activo, tono, disabled }: {
  icono: string; children: React.ReactNode; onClick: () => void; activo?: boolean; tono?: 'malo'; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        ...chip,
        background: tono === 'malo' ? 'var(--bad)' : activo ? 'rgba(243,245,248,.22)' : 'rgba(243,245,248,.08)',
        borderColor: tono === 'malo' ? 'transparent' : 'rgba(243,245,248,.22)',
        cursor: disabled ? 'wait' : 'pointer',
      }}>
      <span style={{ display: 'inline-flex', opacity: 0.9 }}><Icon name={icono} size={15} /></span>
      {children}
    </button>
  );
}

export function BarraLoteAds({ n, nivel, todosActivos, trabajando, onEstado, onPresupuesto, moneda, productos, onProducto, onRenombrar, onAgregarConjunto, onAgregarAnuncio, onEliminar }: {
  n: number;
  nivel: LoteNivel;
  /** Encendido = los N están activos. Con una mezcla va apagado. */
  todosActivos: boolean;
  trabajando?: boolean;
  onEstado: (next: 'ACTIVE' | 'PAUSED') => void;
  /**
   * Sólo donde el presupuesto se edita en ESTE nivel (CBO→campaña, ABO→conjunto). Recibe
   * el monto YA en la moneda de la cuenta, y NO escribe: arma el cartel de confirmación.
   */
  onPresupuesto?: (montoCuenta: number) => void;
  /** La moneda de la cuenta de Meta (`health.account.currency`): decide en qué se tipea. */
  moneda: string;
  productos?: Array<{ value: string; label: string }> | null;
  onProducto?: (valor: string) => void;
  /** La nomenclatura con MaKo, ahora sobre lo SELECCIONADO y no sobre toda la tab. */
  onRenombrar?: () => void;
  /** Sólo con UNA campaña elegida: un conjunto cuelga de una, no de seis. */
  onAgregarConjunto?: () => void;
  /** Sólo con UN conjunto elegido. */
  onAgregarAnuncio?: () => void;
  /** Meta sólo deja borrar lo que está en pausa, así que esto no siempre se puede. */
  onEliminar?: () => void;
}) {
  const [modo, setModo] = useState<null | 'presupuesto' | 'producto' | 'eliminar'>(null);
  const [monto, setMonto] = useState('');
  const [sing, plur] = NOMBRE[nivel];

  /**
   * TRES ZONAS, como la barra de lote genérica de la casa (`app/plan/board/AccionesLote.tsx`):
   * `space-between` con el grupo del medio centrado. «Intenta que los botones estén
   * centrados. El botón de activar y eliminar juntos, a la derecha del todo» (Martín, 06/10).
   *
   * Y el reparto no es estético: a la izquierda va lo que DICE sobre qué se está actuando,
   * en el medio lo que se puede deshacer, y a la derecha los dos que cambian el estado de
   * verdad —prender/pausar y borrar—. Juntarlos ahí los saca del camino del ojo cuando uno
   * está eligiendo qué editar.
   */
  return (
    <div role="group" aria-label={`Acciones sobre ${n} ${n === 1 ? sing : plur}`}
      style={{ display: 'flex', width: '100%', boxSizing: 'border-box', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'var(--ink)', color: 'var(--surface)', borderRadius: 14, padding: '10px 14px' }}>

      {/* IZQUIERDA: sobre cuántos se está actuando.
          ⚠️ Las dos puntas llevan el MISMO `flex: 1 1 0` y ése es el centrado: con
          `space-between` solo, el medio queda centrado únicamente si las dos puntas miden
          igual, y no miden igual —«1 campaña» son ~90 px y activar + eliminar ~220—.
          Medido en el navegador con `space-between`: el centro del grupo cayó en 648 con
          la barra en 722, o sea 74 px corrido a la izquierda. Con las dos puntas
          repartiéndose el sobrante por igual, el medio queda en el centro de la BARRA y no
          en el del hueco que le dejan. `minWidth: max-content` evita que una punta se
          aplaste por debajo de su contenido cuando la barra se angosta. */}
      <span style={{ fontSize: 14, fontWeight: 600, flex: '1 1 0', minWidth: 'max-content' }}>{n} {n === 1 ? sing : plur}</span>

      {/* CENTRO: lo que EDITA. `gap: 14` y no 8, por lo mismo que la barra del plan: son
          controles con borde Y palabra, y más juntos sus cajas se tocan y se leen como un
          solo bloque partido por una raya. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap', flex: 'none' }}>
        {onPresupuesto && <BotonLote icono="sales" disabled={trabajando} activo={modo === 'presupuesto'} onClick={() => setModo((m) => (m === 'presupuesto' ? null : 'presupuesto'))}>Presupuesto</BotonLote>}
        {productos && productos.length > 0 && onProducto && <BotonLote icono="tag" disabled={trabajando} activo={modo === 'producto'} onClick={() => setModo((m) => (m === 'producto' ? null : 'producto'))}>Producto</BotonLote>}
        {onRenombrar && <BotonLote icono="notepencil" disabled={trabajando} onClick={onRenombrar}>Renombrar</BotonLote>}
        {onAgregarConjunto && <BotonLote icono="users" disabled={trabajando} onClick={onAgregarConjunto}>Agregar conjunto</BotonLote>}
        {onAgregarAnuncio && <BotonLote icono="creativos" disabled={trabajando} onClick={onAgregarAnuncio}>Agregar anuncio</BotonLote>}
      </div>

      {/* DERECHA: los dos que cambian el estado, juntos y contra el borde. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flex: '1 1 0', minWidth: 'max-content' }}>
        {/* un solo interruptor: encendido = los N activos */}
        <button type="button" role="switch" aria-checked={todosActivos} disabled={trabajando}
          title={todosActivos ? `Pausar ${n === 1 ? sing : plur}` : `Activar ${n === 1 ? sing : plur}`}
          onClick={() => onEstado(todosActivos ? 'PAUSED' : 'ACTIVE')}
          style={{ ...chip, padding: '0 12px 0 6px', cursor: trabajando ? 'wait' : 'pointer' }}>
          <span style={{ width: 34, height: 19, borderRadius: 999, background: todosActivos ? 'var(--good)' : 'rgba(243,245,248,.28)', position: 'relative', transition: 'background .15s', flex: 'none' }}>
            <span style={{ position: 'absolute', top: 2, left: todosActivos ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
          </span>
          {todosActivos ? 'Activas' : 'En pausa'}
        </button>
        {onEliminar && <BotonLote icono="trash" disabled={trabajando} activo={modo === 'eliminar'} onClick={() => setModo((m) => (m === 'eliminar' ? null : 'eliminar'))}>Eliminar</BotonLote>}
      </div>

      {/* ⚠️ Lo desplegado va en su PROPIO renglón (`flexBasis: '100%'`), no adentro de una
          zona: metido en el medio, el input de 220 px corría los botones de los costados
          cada vez que alguien abría un panel, y la barra se leía como que se movió sola. */}
      {/* ⚠️ La MISMA unidad que la celda de la tabla y que el wizard: se tipea en
          dólares y se convierte a la moneda de la cuenta (sin tasa, en esa moneda). Hasta
          el 07/10/2026 este campo pedía la moneda de la cuenta cruda mientras la celda
          pedía dólares: el mismo «50» eran 50 MXN acá y 865 MXN en la celda, en la misma
          pantalla. Y SÓLO dígitos: `Number(x.replace(',', '.'))` convertía «1.500» en 1,5.
          «Aplicar» no escribe: abre el cartel con el viejo y el nuevo. */}
      {modo === 'presupuesto' && onPresupuesto && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexBasis: '100%' }}>
          <input autoFocus inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ''))}
            placeholder={`Diario, en ${esConvertible(moneda) ? 'USD' : moneda}`}
            style={{ height: 34, width: 220, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(243,245,248,.25)', background: 'rgba(243,245,248,.10)', color: 'var(--surface)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
          <button type="button" disabled={tipeadoACuenta(monto, moneda) == null} onClick={() => { const m = tipeadoACuenta(monto, moneda); if (m == null) return; onPresupuesto(m); setModo(null); setMonto(''); }}
            style={{ ...chip, background: 'var(--primary)', borderColor: 'transparent' }}>Aplicar a {n}</button>
        </span>
      )}

      {modo === 'producto' && productos && onProducto && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexBasis: '100%' }}>
          {productos.map((p) => (
            <button key={p.value} type="button" onClick={() => { onProducto(p.value); setModo(null); }} style={chip}>{p.label}</button>
          ))}
        </span>
      )}

      {modo === 'eliminar' && onEliminar && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexBasis: '100%' }}>
          <span style={{ fontSize: 13 }}>Sólo se eliminan las pausadas.</span>
          <button type="button" onClick={() => { onEliminar(); setModo(null); }} style={{ ...chip, background: 'var(--bad)', borderColor: 'transparent' }}>Eliminar {n}</button>
          <button type="button" onClick={() => setModo(null)} style={chip}>No eliminar</button>
        </span>
      )}
    </div>
  );
}
