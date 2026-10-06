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

export type AccionMenu = { label: string; sub?: string; onClick: () => void };

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
              style={{ ...item, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</span>
              {a.sub && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{a.sub}</span>}
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
      <button type="button" onClick={() => { setAbierto((v) => !v); setDentro(null); }} aria-expanded={abierto}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
          border: '1px solid ' + (activos ? 'var(--primary)' : 'var(--border-strong)'),
          background: activos ? 'var(--primary-bg)' : 'var(--surface)',
          color: activos ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        }}>
        ⚙ Filtros
        {activos > 0 && <span style={{ fontFamily: MONO, fontSize: 11, background: 'var(--primary)', color: '#fff', borderRadius: 999, padding: '0 6px' }}>{activos}</span>}
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
