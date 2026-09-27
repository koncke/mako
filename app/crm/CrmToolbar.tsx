'use client';

// =============================================================================
// CrmToolbar — los controles del tablero del CRM (header + barra de filtros)
// =============================================================================
// Se separó de CrmBoard.tsx por una razón concreta: la barra crecía por acumulación
// (un botón nuevo = una fila nueva) y terminó ocupando tres renglones con tres
// jerarquías distintas de acciones mezcladas. Acá viven las piezas y sus reglas de
// layout; CrmBoard solo las compone y les pasa el estado.
//
// Reglas de layout que NO se pueden romper (se rompieron antes):
//  · Nada de flexWrap:'wrap' junto a marginLeft:'auto' en la misma fila: al envolver,
//    el "auto" empuja al último elemento y queda un hueco enorme en el medio. La fila
//    va en nowrap, cada control con flex:'none' y UN solo elástico (<span flex:1/>).
//  · Los estilos inline no soportan @media: los breakpoints se inyectan como clases
//    en <CrmToolbarStyles/> y ahí el elástico se apaga antes de permitir el wrap.
//  · Los valores de "origen" salen de los datos del cliente y pueden ser larguísimos
//    (URLs de campaña enteras): toda opción y todo chip lleva maxWidth + ellipsis +
//    title con el valor completo.

import Link, { useRouter } from '@/app/_ui/Link';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BAND_LABEL, CATEGORY, bandToCategory, type Stage, type StageBand } from '@/lib/pipeline';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/** Vista del tablero. "pendientes" (datos sin marcar) es UNA VISTA: reemplaza el board entero. */
export type CrmVista = 'kanban' | 'tabla' | 'pendientes';
/** Categorías del menú de filtros. El buscador NO es una categoría (no genera chip). */
export type FiltroCat = 'etapa' | 'origen';
/** Estado del panel de filtros: null = cerrado; 'root' = las categorías; el resto = drill-down. */
export type FiltroAbierto = 'root' | FiltroCat | null;

// Alto común de los controles de la barra: si cada uno elige el suyo, la fila
// queda escalonada y se nota más que cualquier otro detalle de la pantalla.
const CTRL_H = 40;

// ── clases para lo que los estilos inline no pueden hacer (breakpoints) ───────
export function CrmToolbarStyles() {
  return (
    <style>{`
      /* Debajo de 980px la fila no entra: recién ahí se permite envolver, y el
         elástico se APAGA primero — si quedara vivo, al envolver dejaría un hueco
         del ancho de la fila entre el filtro y lo que sigue. */
      @media (max-width: 980px) {
        .crm-tb { flex-wrap: wrap !important; }
        .crm-tb-elastico { display: none !important; }
        .crm-tb-buscar { flex: 1 1 200px !important; }
      }
      @media (max-width: 760px) {
        .crm-acciones { flex-wrap: wrap !important; justify-content: flex-end; }
      }
    `}</style>
  );
}

// ── iconos ───────────────────────────────────────────────────────────────────
function UploadIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>;
}
function DownloadIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>;
}
function FunnelIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>;
}
function KebabIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>;
}
function LupaIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: 13, pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
}

// Cerrar con Escape. Se registra solo mientras el panel está abierto para no dejar
// listeners sueltos escuchando toda la vida de la pantalla. El callback va por ref:
// si entrara en las deps, el listener se daría de baja y de alta en CADA render del
// tablero (que re-renderiza con cada drag).
function useEscape(activo: boolean, cerrar: () => void) {
  const ref = useRef(cerrar);
  useEffect(() => { ref.current = cerrar; });
  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activo]);
}

// =============================================================================
// A) Acciones del header — un solo clúster a la derecha
// =============================================================================
// "+ Nuevo lead" es el ÚNICO botón primario y siempre el último. Importar y
// Exportar bajan al kebab: los dos iconos que tenían eran la misma bandeja con la
// flecha para el otro lado y no se distinguían sin pasar el mouse por encima —
// además, con cada acción nueva el header crecía a lo ancho.

function MenuItem({ icon, label, desc, onClick, href }: {
  icon: ReactNode; label: string; desc: string; onClick?: () => void; href?: string;
}) {
  const [hover, setHover] = useState(false);
  const inner = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: hover ? 'var(--primary)' : 'var(--dim)' }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', lineHeight: 1.35, marginTop: 1 }}>{desc}</span>
      </span>
    </>
  );
  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
    padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: hover ? 'var(--surface-2)' : 'transparent', fontFamily: SANS, textDecoration: 'none',
  };
  const handlers = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };
  return href
    ? <Link href={href} style={style} onClick={onClick} {...handlers}>{inner}</Link>
    : <button type="button" onClick={onClick} style={style} {...handlers}>{inner}</button>;
}

export function AccionesHeader({ total, onImportar, onExportar }: {
  /** leads del workspace (no los filtrados): con 0, importar es el camino crítico. */
  total: number;
  onImportar: () => void;
  onExportar: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));
  const vacio = total === 0;

  const secundario: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none', height: CTRL_H, padding: '0 15px',
    borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
  };

  return (
    <div className="crm-acciones" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Más acciones del CRM" aria-expanded={open}
          title="Importar, exportar y editar el funnel"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flex: 'none', borderRadius: 9, border: `1px solid ${open ? 'var(--primary)' : 'var(--border-strong)'}`, background: open ? 'var(--surface-2)' : 'var(--surface)', color: open ? 'var(--primary)' : 'var(--dim)', cursor: 'pointer', padding: 0 }}>
          <KebabIcon />
        </button>
        {open && <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" style={{ position: 'absolute', top: 44, right: 0, zIndex: 41, width: 306, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, boxShadow: '0 16px 40px rgba(18,21,27,.18)', padding: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MenuItem icon={<UploadIcon size={15} />} label="Importar CSV"
              desc="Un archivo con nombre, email, teléfono y empresa"
              onClick={() => { setOpen(false); onImportar(); }} />
            <MenuItem icon={<DownloadIcon size={15} />} label="Exportar leads"
              desc="Baja los leads a planilla o documento"
              onClick={() => { setOpen(false); onExportar(); }} />
            <span style={{ height: 1, background: 'var(--border)', margin: '5px 6px' }} />
            <MenuItem icon={<FunnelIcon size={15} />} label="Editar funnel"
              desc="Cambia las etapas del pipeline y sus flechas"
              href="/funnel" onClick={() => setOpen(false)} />
          </div>
        </>}
      </span>

      {/* Con el CRM vacío, importar deja de ser una acción secundaria: es LA acción.
          Sube a botón visible al lado del primario y vuelve al menú cuando ya hay leads. */}
      {vacio && (
        <button type="button" onClick={onImportar} style={secundario}>
          <UploadIcon size={15} /> Importar CSV
        </button>
      )}

      <Link href="/crm/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none', height: CTRL_H, padding: '0 18px', borderRadius: 10, background: 'var(--ink)', color: '#F3F5F8', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
        + Nuevo lead
      </Link>
    </div>
  );
}

/** Divisor entre el toggle de MaKo y el clúster de acciones (son dos cosas distintas). */
export function DivisorHeader() {
  return <span aria-hidden style={{ flex: 'none', width: 1, height: 20, background: 'var(--border)' }} />;
}

// =============================================================================
// B) Barra: selector de vista, buscador, bandas
// =============================================================================

export function VistaSelector({ vista, onVista, pendientes }: {
  vista: CrmVista;
  onVista: (v: CrmVista) => void;
  /** cuántos leads tienen datos sin marcar (0 = el segmento va sin badge). */
  pendientes: number;
}) {
  const seg = (activo: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 15px', borderRadius: 8,
    border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 14,
    fontWeight: activo ? 600 : 500,
    background: activo ? 'var(--ink)' : 'transparent',
    // `--on-ink`, no `--on-sidebar`. Coincidían en el tema por defecto, pero el
    // segundo significa «se lee sobre LA BARRA»: con la barra clara, esto quedó
    // tinta sobre tinta —ratio 1,00, el botón activo INVISIBLE— y se veía igual
    // en claro y en oscuro, así que ningún vistazo lo iba a encontrar.
    color: activo ? 'var(--on-ink)' : 'var(--dim)',
  });
  return (
    <div style={{ display: 'inline-flex', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 4, gap: 4 }}>
      <button type="button" onClick={() => onVista('kanban')} style={seg(vista === 'kanban')}>Kanban</button>
      <button type="button" onClick={() => onVista('tabla')} style={seg(vista === 'tabla')}>Tabla</button>
      <button type="button" onClick={() => onVista('pendientes')} style={seg(vista === 'pendientes')}
        title={pendientes > 0 ? `${pendientes} lead${pendientes === 1 ? '' : 's'} con datos que faltan marcar` : 'Datos sin marcar — no hay ninguno pendiente'}>
        Pendientes
        {/* El latido va en el BADGE, no en el segmento: un botón entero pulsando al
            lado de las otras dos vistas leía como una alarma, no como una pestaña. */}
        {pendientes > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--bad)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
            {pendientes}
          </span>
        )}
      </button>
    </div>
  );
}

// El input NO filtra: solo reporta lo tipeado. El filtrado vive en CrmBoard y usa
// `coincideBusqueda` de lib/buscar-texto.ts — misma regla que el board del plan:
// sin acentos, por palabras sueltas en cualquier orden, y «#412» / «412» como
// pedido EXACTO del lead por su número. El placeholder tiene que DECIRLO: nadie
// prueba escribir un # en un campo que dice «Buscar…».
const BUSCAR_AYUDA = 'Buscar por nombre, empresa, email o teléfono. Para un lead puntual, su número: #412 (no distingue mayúsculas ni acentos).';

export function Buscador({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="crm-tb-buscar" style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '0 1 260px', minWidth: 110 }}>
      <LupaIcon />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar o #número de lead"
        aria-label={BUSCAR_AYUDA}
        title={BUSCAR_AYUDA}
        style={{ width: '100%', height: CTRL_H, padding: value ? '0 34px 0 36px' : '0 14px 0 36px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar la búsqueda" title="Limpiar la búsqueda"
          style={{ position: 'absolute', right: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13, lineHeight: 1, cursor: 'pointer', fontFamily: SANS }}>
          ×
        </button>
      )}
    </div>
  );
}

export function BandasToggle({ bandas, onToggle, conteo }: {
  bandas: Set<StageBand>;
  onToggle: (b: StageBand) => void;
  conteo: (b: StageBand) => number;
}) {
  const ORDEN: StageBand[] = ['pipeline', 'nutricion', 'salidas'];
  return (
    <div style={{ display: 'inline-flex', flex: 'none', alignItems: 'center', gap: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
      {ORDEN.map((band) => {
        const on = bandas.has(band);
        const accent = CATEGORY[bandToCategory(band)].c;
        // La última banda encendida no se puede apagar: con 0 bandas el tablero se
        // vaciaba entero y no había nada en pantalla que explicara por qué.
        const ultima = on && bandas.size === 1;
        return (
          <button key={band} type="button" onClick={() => onToggle(band)} aria-pressed={on}
            title={ultima ? 'Tiene que quedar al menos una banda visible' : on ? `Ocultar ${BAND_LABEL[band]}` : `Mostrar ${BAND_LABEL[band]}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8, border: 'none', cursor: ultima ? 'default' : 'pointer', background: on ? accent : 'transparent', color: on ? '#fff' : 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', opacity: ultima ? 0.9 : 1 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#fff' : accent, flex: 'none' }} />
            {BAND_LABEL[band]}
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>{conteo(band)}</span>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// C) Filtros — un único menú "Filtrar (N)" (mismo patrón que el board del plan)
// =============================================================================
// Drill-down: en 'root' se ven las categorías con su resumen; al tocar una, su
// contenido reemplaza el panel EN EL MISMO LUGAR con un "‹ volver". Nunca hay más
// de una categoría en pantalla, así el panel no crece con el catálogo del cliente.

export function CrmFilterMenu({ stages, etapas, setEtapas, origenes, origen, setOrigen, abierto, setAbierto }: {
  stages: Stage[];
  etapas: Set<string>;
  setEtapas: (s: Set<string>) => void;
  origenes: string[];
  origen: Set<string>;
  setOrigen: (s: Set<string>) => void;
  abierto: FiltroAbierto;
  setAbierto: (v: FiltroAbierto) => void;
}) {
  const open = abierto !== null;
  const cerrar = () => setAbierto(null);
  useEscape(open, cerrar);

  const n = etapas.size + origen.size;
  const limpiar = () => { setEtapas(new Set()); setOrigen(new Set()); };
  const toggleEtapa = (k: string) => { const c = new Set(etapas); if (c.has(k)) c.delete(k); else c.add(k); setEtapas(c); };
  const toggleOrigen = (o: string) => { const c = new Set(origen); if (c.has(o)) c.delete(o); else c.add(o); setOrigen(c); };

  const check = (on: boolean): CSSProperties => ({ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' });
  const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS };
  const catRow: CSSProperties = { ...rowBtn, justifyContent: 'space-between', padding: '10px 9px' };
  const resumenTxt = (activo: boolean): CSSProperties => ({ fontSize: 12, color: activo ? 'var(--primary)' : 'var(--faint)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 118 });
  const backBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 6px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginBottom: 4 };
  const texto: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const etapaLabel = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  const resumen = (sel: Set<string>, label: (v: string) => string) =>
    sel.size === 0 ? 'Todas' : sel.size === 1 ? label([...sel][0]) : `${sel.size} elegidas`;

  const cats: Array<{ key: FiltroCat; label: string; resumen: string; activo: boolean }> = [
    { key: 'etapa', label: 'Etapa', resumen: resumen(etapas, etapaLabel), activo: etapas.size > 0 },
    { key: 'origen', label: 'Origen', resumen: origen.size === 0 ? 'Todos' : origen.size === 1 ? [...origen][0] : `${origen.size} elegidos`, activo: origen.size > 0 },
  ];

  return (
    <span style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
      <button type="button" onClick={() => setAbierto(open ? null : 'root')} aria-expanded={open}
        title={n > 0 ? `${n} filtro${n === 1 ? '' : 's'} activo${n === 1 ? '' : 's'}` : 'Filtrar por etapa u origen'}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none', height: CTRL_H, padding: '0 14px', borderRadius: 10, border: `1px solid ${n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)'}`, background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <FunnelIcon size={13} />Filtrar
        {n > 0 && (
          <span onClick={(e) => { e.stopPropagation(); limpiar(); }} title="Limpiar los filtros"
            style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>
            {n}
          </span>
        )}
      </button>
      {open && <>
        <span onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 46, left: 0, zIndex: 41, width: 262, maxWidth: 'calc(100vw - 32px)', maxHeight: 420, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {abierto === 'root' ? (
            <>
              {cats.map((c) => (
                <button key={c.key} type="button" onClick={() => setAbierto(c.key)} style={catRow}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={resumenTxt(c.activo)} title={c.resumen}>{c.resumen}</span>
                    <span aria-hidden style={{ color: 'var(--faint)', fontSize: 16, lineHeight: 1 }}>›</span>
                  </span>
                </button>
              ))}
              {n > 0 && (
                <button type="button" onClick={limpiar}
                  style={{ ...rowBtn, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--primary)', fontWeight: 600 }}>
                  Limpiar filtros ({n})
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setAbierto('root')} style={backBtn}>
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>‹</span>
                {abierto === 'etapa' ? 'Etapa' : 'Origen'}
              </button>
              {abierto === 'etapa' && stages.map((s) => (
                <button key={s.key} type="button" onClick={() => toggleEtapa(s.key)} style={rowBtn} title={s.label}>
                  <span style={check(etapas.has(s.key))}>{etapas.has(s.key) ? '✓' : ''}</span>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flex: 'none' }} />
                  <span style={texto}>{s.label}</span>
                </button>
              ))}
              {abierto === 'origen' && (origenes.length === 0
                ? <div style={{ padding: '10px 9px', fontSize: 12.5, color: 'var(--faint)' }}>Todavía no hay orígenes cargados.</div>
                : origenes.map((o) => (
                  <button key={o} type="button" onClick={() => toggleOrigen(o)} style={rowBtn} title={o}>
                    <span style={check(origen.has(o))}>{origen.has(o) ? '✓' : ''}</span>
                    <span style={texto}>{o}</span>
                  </button>
                )))}
            </>
          )}
        </div>
      </>}
    </span>
  );
}

// ── chips de filtros activos: UNO POR CATEGORÍA ──────────────────────────────
// Un chip por VALOR se desbordaba con cinco etapas elegidas y empujaba el tablero
// media pantalla para abajo. El cuerpo del chip reabre el menú en esa categoría;
// la × limpia la categoría entera.
export function FiltroChips({ stages, etapas, setEtapas, origen, setOrigen, onAbrir }: {
  stages: Stage[];
  etapas: Set<string>;
  setEtapas: (s: Set<string>) => void;
  origen: Set<string>;
  setOrigen: (s: Set<string>) => void;
  onAbrir: (cat: FiltroCat) => void;
}) {
  const etapaLabel = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  const chips: Array<{ cat: FiltroCat; titulo: string; texto: string; completo: string; limpiar: () => void }> = [];
  if (etapas.size > 0) {
    const vals = [...etapas].map(etapaLabel);
    chips.push({ cat: 'etapa', titulo: 'Etapa', texto: vals[0] + (vals.length > 1 ? ` +${vals.length - 1}` : ''), completo: vals.join(', '), limpiar: () => setEtapas(new Set()) });
  }
  if (origen.size > 0) {
    const vals = [...origen];
    chips.push({ cat: 'origen', titulo: 'Origen', texto: vals[0] + (vals.length > 1 ? ` +${vals.length - 1}` : ''), completo: vals.join(', '), limpiar: () => setOrigen(new Set()) });
  }
  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {chips.map((c) => (
        <span key={c.cat} style={{ display: 'inline-flex', alignItems: 'center', maxWidth: 300, borderRadius: 999, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', overflow: 'hidden' }}>
          <button type="button" onClick={() => onAbrir(c.cat)} title={`${c.titulo}: ${c.completo}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, padding: '5px 4px 5px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, color: 'var(--primary)' }}>
            <span style={{ fontWeight: 500, opacity: 0.8, flex: 'none' }}>{c.titulo}:</span>
            <span style={{ fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.texto}</span>
          </button>
          <button type="button" onClick={c.limpiar} aria-label={`Quitar el filtro de ${c.titulo.toLowerCase()}`} title={`Quitar el filtro de ${c.titulo.toLowerCase()}`}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 24, flex: 'none', border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: SANS }}>
            ×
          </button>
        </span>
      ))}
      <button type="button" onClick={() => { setEtapas(new Set()); setOrigen(new Set()); }}
        style={{ padding: '5px 10px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        Limpiar
      </button>
    </div>
  );
}

// ── Qué funnel dibuja el tablero ─────────────────────────────────────────────
// Acá vivía «1.142 de 1.142», que repetía los conteos de las bandas que están al
// lado y no se usaba para nada. Pedido del dueño (26/09): ese lugar es para
// elegir la oferta/funnel. Cambiar de funnel es cambiar de página (`?funnel=`):
// las etapas se leen en el server, no hay estado que sincronizar.
/** Valor centinela del renglón que no es un funnel sino una salida. */
const NUEVA = '__nueva';

export function SelectorFunnel({ funnels, activo }: {
  funnels: { id: number; nombre: string; esDefault: boolean }[];
  activo: number | null;
}) {
  const router = useRouter();
  if (funnels.length === 0) return null;
  const actual = funnels.find((f) => f.id === activo) ?? funnels.find((f) => f.esDefault) ?? funnels[0];
  const opciones: DropdownOption[] = funnels.map((f) => ({
    value: String(f.id),
    label: f.nombre,
    sub: f.esDefault ? 'el de tu negocio' : undefined,
  }));
  // Hoy todo workspace tiene UN funnel (mig 0170 le creó uno a cada uno) y cero
  // ofertas, así que sin este renglón el desplegable abre, muestra una sola cosa y
  // no hace nada — que se lee como que está roto, no como que falta crear algo.
  // Las ofertas y sus funnels se crean en el cerebro; el `?area=` lo abre ahí mismo.
  opciones.push({ value: NUEVA, label: 'Crear otra oferta', sub: 'con su propio funnel' });
  return (
    <span style={{ flex: 'none', minWidth: 190 }}>
      <Dropdown
        value={String(actual.id)}
        options={opciones}
        ariaLabel="Oferta que dibuja el tablero"
        onChange={(v) => {
          if (v === NUEVA) { router.push('/second-brain?area=oferta'); return; }
          const f = funnels.find((x) => x.id === Number(v));
          // El del negocio va sin parámetro: la URL del CRM no se ensucia por defecto.
          router.push(f?.esDefault ? '/crm' : `/crm?funnel=${v}`);
        }}
      />
    </span>
  );
}

// ── vacío por filtros (kanban): antes solo la tabla avisaba ──────────────────
export function SinResultados({ hayFiltros, onLimpiar }: { hayFiltros: boolean; onLimpiar: () => void }) {
  return (
    <div style={{ padding: '44px 30px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
        {hayFiltros ? 'Sin resultados para estos filtros' : 'Todavía no hay leads para mostrar'}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 5 }}>
        {/* El momento en que uno está trabado es EL momento para contar que se puede
            buscar por número: decirlo solo en el placeholder llega tarde. */}
        {hayFiltros ? 'Prueba con menos filtros, otras palabras sueltas, o el número del lead (#412).' : 'Importa un CSV o carga tu primer lead para empezar.'}
      </div>
      {hayFiltros && (
        <button type="button" onClick={onLimpiar}
          style={{ marginTop: 16, padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
