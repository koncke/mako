'use client';

// =============================================================================
// FuentesVista — lo que se VE de «Asignar fuentes» (20/11/2026), sin estado ni lecturas: todo por props
// =============================================================================
// Martín, 20/11/2026: «que haya 2 secciones, de "Campañas de Meta" y "Formularios"… formularios de páginas web (creadas en
// MaKo o creadas en cualquier lado…) o formularios de Meta, de anuncios. Y para lo que necesita Juanfran, que se pueda
// asignar los "calificados" o "descalificados"… Y mejora y rediseña al 100% ese modal, se tiene que entender fácil». Y: «El
// modal de "Asignar fuentes" está feo el diseño».
//
// Dos pestañas hermanas (app/_ui/Tabs.tsx): «Campañas de Meta» y «Formularios». Cada fuente es UNA fila con un INTERRUPTOR
// que dice una sola cosa: «sus leads entran a este funnel». Un formulario prendido lleva debajo su «Calificación automática»,
// que abre el editor de reglas en la misma ventana (`VistaReglas`).
//
// EL EDITOR DE REGLAS COPIA EL «ROUTING LOGIC» DE CALENDLY (Routing Forms, «How to create a Routing Form», leído el
// 20/11/2026): rutas en orden, cada una con sus condiciones de «pregunta + qualifier + respuesta» y un destino; la primera que
// se cumple gana; y una ruta de respaldo para el que no calza en ninguna. El motor es lib/calificacion-formulario.ts.
//
// ⚠️ ESTE ARCHIVO NO LEE NADA: así se dibuja igual en la app y en el artefacto (renderToStaticMarkup no corre efectos). Lo
// que lee y guarda es app/crm/FuentesModal.tsx.
// ⚠️ INTERRUPTOR Y NO CASILLA (Martín, 06/10/2026): en MaKo la casilla SELECCIONA. Un interruptor prende o apaga, y nada más.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import { Tabs, Spinner, SANS, MONO } from '@/app/_ui';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { LogoMeta } from '@/app/_components/ServicioVisual';
import {
  TEXTO_OPERADOR, OPERADORES, SIN_VALOR, minimoDe, normalizar, legible,
  type ReglasFormulario, type RutaCalificacion, type CondicionRegla, type OperadorRegla, type PreguntaVista,
} from '@/lib/calificacion-formulario';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type PestanaFuentes = 'meta' | 'formularios';
export type TipoFuente = 'campana' | 'conjunto' | 'meta' | 'wg' | 'web';

export type FilaFuente = {
  /** La clave de la fuente: el id de Meta de la campaña o el conjunto, `meta:<form>`, `form:<id>` o `web:<página>`. */
  id: string;
  tipo: TipoFuente;
  nombre: string;
  /** La línea de abajo: «Activa · 3 conjuntos», «Página Inmo Norte · 312 leads · último hace 2 h». */
  detalle: string;
  /** El punto de color de una campaña: activa, pausada o con problemas. */
  tono?: 'activa' | 'apagada' | 'mala' | null;
  /** Cuántos leads trae (la columna de la derecha de una campaña). */
  leads?: number | null;
  prendida: boolean;
  /** Los OTROS funnels donde entra: «También entra a …» si está prendida acá, «Entra a …» si no. */
  tambien?: string[];
  /** Un conjunto sin asignación propia entra por su campaña: se dice, y su interruptor queda prendido y quieto (`bloqueada`). */
  heredada?: boolean;
  /** El interruptor no se puede tocar acá (un conjunto que entra por su campaña: se apaga en la campaña). */
  bloqueada?: boolean;
  /** Los conjuntos de una campaña. */
  hijos?: FilaFuente[];
  /** La calificación automática de un formulario prendido. `null` = no aplica (una campaña). */
  calificacion?: { activa: boolean; reglas: number } | null;
  /** Un formulario sin envíos todavía: no hay preguntas que mirar para armar reglas. */
  sinEnvios?: boolean;
};

export type EtapaDestino = { key: string; label: string; color: string };

const ESTILO_CTA: CSSProperties = { textTransform: 'uppercase', letterSpacing: '.04em' };

// ── Piezas chicas ──────────────────────────────────────────────────────────────

/** El interruptor de la casa (`.mk-switch`, app/_ui/ui.css), con su etiqueta para el lector de pantalla. */
function Interruptor({ prendido, etiqueta, onCambiar, disabled }: { prendido: boolean; etiqueta: string; onCambiar: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} disabled={disabled}
      className="mk-switch" onClick={(e) => { e.stopPropagation(); onCambiar(!prendido); }} />
  );
}

const ICONO_FORM: Record<'wg' | 'web', string> = {
  wg: 'M6 4h12a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4Zm2.5 4.5h7M8.5 12h7M8.5 15.5h4',
  web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z',
};

function IconoFuente({ tipo }: { tipo: TipoFuente }) {
  if (tipo === 'meta' || tipo === 'campana' || tipo === 'conjunto') {
    return <span aria-hidden style={{ ...CAJA_ICONO }}><LogoMeta size={16} /></span>;
  }
  return (
    <span aria-hidden style={CAJA_ICONO}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONO_FORM[tipo]} />
      </svg>
    </span>
  );
}
const CAJA_ICONO: CSSProperties = {
  flex: 'none', width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--surface-2)', border: '1px solid var(--border)',
};

const TONO: Record<'activa' | 'apagada' | 'mala', string> = { activa: 'var(--good)', apagada: 'var(--faint)', mala: 'var(--bad)' };

function Flecha({ abierta }: { abierta: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M9 6l6 6-6 6" /></svg>
  );
}

// ── Una fila ───────────────────────────────────────────────────────────────────

function Fila({ f, nombreFunnel, nivel = 0, abierta, onAbrir, onAlternar, onReglas, ocupada }: {
  f: FilaFuente; nombreFunnel: string; nivel?: 0 | 1; abierta?: boolean;
  onAbrir?: () => void; onAlternar: (f: FilaFuente, v: boolean) => void; onReglas?: (f: FilaFuente) => void; ocupada?: boolean;
}) {
  const hijos = f.hijos?.length ?? 0;
  const sub = [f.detalle, f.heredada ? 'Entra por su campaña' : '', f.tambien?.length ? `${f.prendida ? 'También entra' : 'Entra'} a ${f.tambien.map((t) => `«${t}»`).join(', ')}` : '']
    .filter(Boolean).join(' · ');
  return (
    <div data-fuente={f.id} className="mk-fuente-fila" style={{ borderTop: '1px solid var(--border)', background: nivel ? 'var(--surface-2)' : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: nivel ? '10px 14px 10px 58px' : '12px 14px', minWidth: 0 }}>
        {nivel === 0 && (hijos > 0
          ? (
            <button type="button" onClick={onAbrir} aria-expanded={!!abierta}
              aria-label={abierta ? `Esconder los conjuntos de «${f.nombre}»` : `Ver los ${hijos} conjuntos de «${f.nombre}»`}
              className="mk-icon-btn" data-tone="dim"
              style={{ flex: 'none', width: 24, height: 24, marginRight: -6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: 'var(--dim)', cursor: 'pointer', padding: 0 }}>
              <Flecha abierta={!!abierta} />
            </button>
          )
          : (f.tipo === 'campana' ? <span aria-hidden style={{ flex: 'none', width: 18 }} /> : null))}
        {nivel === 0 && <IconoFuente tipo={f.tipo} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {f.tono && <span aria-hidden title={f.tono === 'activa' ? 'Activa' : f.tono === 'mala' ? 'Con problemas' : 'No activa'}
              style={{ flex: 'none', width: 7, height: 7, borderRadius: 99, background: TONO[f.tono] }} />}
            <span title={f.nombre} style={{ fontSize: nivel ? 13.5 : 14.5, fontWeight: nivel ? 500 : 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
          </span>
          {(sub || f.leads != null) && (
            <span className="mk-fuente-sub" style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sub}
              {/* En el teléfono la columna de leads se esconde y el número viene acá (`.mk-solo-movil`, app/_ui/ui.css). */}
              {f.leads != null && <span className="mk-solo-movil">{sub ? ' · ' : ''}{f.leads} {f.leads === 1 ? 'lead' : 'leads'}</span>}
            </span>
          )}
        </span>
        {f.leads != null && (
          <span className="mk-fuente-leads" style={{ flex: 'none', minWidth: 44, textAlign: 'right', fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: f.leads ? 'var(--ink)' : 'var(--faint)' }}
            title={`${f.leads} ${f.leads === 1 ? 'lead' : 'leads'} en el CRM`}>{f.leads}</span>
        )}
        {ocupada ? <span style={{ flex: 'none', width: 42, display: 'inline-flex', justifyContent: 'center' }}><Spinner size={15} /></span>
          : (
            <span title={f.bloqueada ? 'Entra por su campaña: para que no entre, apaga la campaña' : undefined} style={{ flex: 'none', display: 'inline-flex' }}>
              <Interruptor prendido={f.prendida} disabled={f.bloqueada} onCambiar={(v) => onAlternar(f, v)}
                etiqueta={`«${f.nombre}»: ${f.prendida ? 'sus leads entran' : 'sus leads no entran'} a «${nombreFunnel}»`} />
            </span>
          )}
      </div>
      {/* LA CALIFICACIÓN, debajo del formulario prendido: un renglón que abre su editor. Apagado no va (no entra nada que calificar). */}
      {f.prendida && f.calificacion && onReglas && (
        <button type="button" onClick={() => onReglas(f)} className="mk-fuente-reglas"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '0 14px 12px 58px',
            border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SANS,
          }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 9,
            border: '1px solid var(--border)', background: 'var(--surface-2)', minWidth: 0,
          }}>
            {/* Prendida: el punto verde de «activa» (el mismo de una campaña activa). Apagada: el ícono de la lista que se ordena. */}
            {f.calificacion.activa
              ? <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: 99, background: 'var(--good)' }} />
              : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
                  <path d="M4 6h10M4 12h7M4 18h4M15 15l3 3 4-5" />
                </svg>
              )}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              {f.calificacion.activa
                ? `Calificación automática · ${f.calificacion.reglas} ${f.calificacion.reglas === 1 ? 'regla' : 'reglas'}`
                : 'Calificar automáticamente'}
            </span>
            <span aria-hidden style={{ color: 'var(--faint)', fontSize: 13 }}>›</span>
          </span>
        </button>
      )}
    </div>
  );
}

// ── La caja de una lista (con su título) ───────────────────────────────────────

function Grupo({ titulo, cuenta, children, extra }: { titulo: string; cuenta?: number; children: ReactNode; extra?: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 2px' }}>
        <h3 style={{ margin: 0, fontFamily: SANS, fontSize: 13, fontWeight: 650, color: 'var(--ink)' }}>{titulo}</h3>
        {cuenta != null && cuenta > 0 && <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{cuenta}</span>}
        <span style={{ flex: 1 }} />
        {extra}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
        {/* La primera fila no lleva la raya de arriba: la pone la caja. */}
        <div style={{ marginTop: -1 }}>{children}</div>
      </div>
    </section>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, padding: '22px 16px', fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5 }}>{children}</p>;
}

// ── Las dos pestañas ───────────────────────────────────────────────────────────

export type FiltroCampanas = 'todas' | 'activas' | 'este';

export type PropsPanelFuentes = {
  nombreFunnel: string;
  pestana: PestanaFuentes;
  onPestana: (p: PestanaFuentes) => void;
  campanas: {
    filas: FilaFuente[] | null;
    busqueda: string;
    onBuscar: (q: string) => void;
    filtro: FiltroCampanas;
    onFiltro: (f: FiltroCampanas) => void;
    abiertas: ReadonlySet<string>;
    onAbrir: (id: string) => void;
    /** La cuenta de Meta que se leyó, o lo que impide leerla. */
    aviso?: ReactNode;
    vacio?: ReactNode;
    verMas?: ReactNode;
  };
  formularios: {
    meta: FilaFuente[] | null;
    web: FilaFuente[] | null;
    avisoMeta?: ReactNode;
    vacioMeta?: ReactNode;
    vacioWeb?: ReactNode;
  };
  /** Cuántas fuentes de cada pestaña entran HOY a este funnel (el número de la pestaña). */
  cuenta: { meta: number; formularios: number };
  onAlternar: (f: FilaFuente, v: boolean) => void;
  onReglas: (f: FilaFuente) => void;
  /** La fila que se está guardando (su interruptor gira). */
  ocupada?: string | null;
};

const FILTROS: Array<{ v: FiltroCampanas; label: string }> = [
  { v: 'todas', label: 'Todas' }, { v: 'activas', label: 'Activas' }, { v: 'este', label: 'En este funnel' },
];

export function PanelFuentes(p: PropsPanelFuentes) {
  return (
    <div className="crm-hover mk-fuentes" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, fontFamily: SANS }}>
      <Tabs sinLinea activa={p.pestana} onCambio={(id) => p.onPestana(id as PestanaFuentes)}
        tabs={[{ id: 'meta', label: 'Campañas de Meta', badge: p.cuenta.meta }, { id: 'formularios', label: 'Formularios', badge: p.cuenta.formularios }]} />
      {p.pestana === 'meta' ? <PestanaCampanas {...p} /> : <PestanaFormularios {...p} />}
    </div>
  );
}

function PestanaCampanas(p: PropsPanelFuentes) {
  const c = p.campanas;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 240px', minWidth: 0, position: 'relative', display: 'flex' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" aria-hidden
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={c.busqueda} onChange={(e) => c.onBuscar(e.target.value)} placeholder="Buscar campaña o conjunto" aria-label="Buscar campaña o conjunto"
            style={{ width: '100%', height: 40, boxSizing: 'border-box', padding: '0 12px 0 36px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }} />
        </label>
        {/* Los tres filtros a la vista, como un control segmentado: con una sola dimensión, un menú escondido era un clic de más. */}
        <div role="radiogroup" aria-label="Qué campañas mostrar" style={{ flex: 'none', display: 'inline-flex', padding: 3, gap: 2, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {FILTROS.map((f) => {
            const on = c.filtro === f.v;
            return (
              <button key={f.v} type="button" role="radio" aria-checked={on} onClick={() => c.onFiltro(f.v)}
                style={{
                  height: 32, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13,
                  fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', whiteSpace: 'nowrap',
                  background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? '0 1px 2px rgba(18,21,27,.12)' : 'none',
                }}>{f.label}</button>
            );
          })}
        </div>
      </div>
      {c.aviso}
      {c.filas == null ? (
        <div style={{ padding: '36px 0', display: 'flex', justifyContent: 'center' }}><Spinner size={18} /></div>
      ) : c.filas.length === 0 ? (
        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 14 }}>{c.vacio ?? <Vacio>Ninguna con ese filtro.</Vacio>}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
          <div className="mk-fuente-cabecera" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: 'var(--surface-2)', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
            <span style={{ flex: 1 }}>Campaña</span>
            <span className="mk-fuente-leads" style={{ minWidth: 44, textAlign: 'right' }}>Leads</span>
            <span style={{ width: 42, textAlign: 'center' }}>Entra</span>
          </div>
          {c.filas.map((f) => {
            const abierta = c.abiertas.has(f.id);
            return (
              <div key={f.id}>
                <Fila f={f} nombreFunnel={p.nombreFunnel} abierta={abierta} onAbrir={() => c.onAbrir(f.id)} onAlternar={p.onAlternar} ocupada={p.ocupada === f.id} />
                {abierta && f.hijos?.map((h) => (
                  <Fila key={h.id} f={h} nivel={1} nombreFunnel={p.nombreFunnel} onAlternar={p.onAlternar} ocupada={p.ocupada === h.id} />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {c.verMas}
    </>
  );
}

function PestanaFormularios(p: PropsPanelFuentes) {
  const fm = p.formularios;
  const lista = (filas: FilaFuente[] | null, vacio: ReactNode) => (filas == null
    ? <div style={{ padding: '26px 0', display: 'flex', justifyContent: 'center' }}><Spinner size={16} /></div>
    : filas.length === 0 ? vacio
      : filas.map((f) => <Fila key={f.id} f={f} nombreFunnel={p.nombreFunnel} onAlternar={p.onAlternar} onReglas={p.onReglas} ocupada={p.ocupada === f.id} />));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Grupo titulo="Formularios de anuncios de Meta" cuenta={fm.meta?.length}>
        {fm.avisoMeta}
        {lista(fm.meta, fm.vacioMeta ?? <Vacio>Tu página de Facebook no tiene formularios de anuncios.</Vacio>)}
      </Grupo>
      <Grupo titulo="Formularios de páginas web" cuenta={fm.web?.length}>
        {lista(fm.web, fm.vacioWeb ?? <Vacio>Todavía no llegó ningún formulario de tus páginas.</Vacio>)}
      </Grupo>
    </div>
  );
}

// ── El editor de reglas de un formulario (Calendly, «Routing logic») ──────────

export type PropsVistaReglas = {
  formulario: FilaFuente;
  nombreFunnel: string;
  reglas: ReglasFormulario;
  preguntas: PreguntaVista[];
  etapas: EtapaDestino[];
  /** La etapa de entrada del funnel (la que dice «se queda donde entró»). */
  entrada: string;
  /** Con estas reglas, a dónde irían los últimos envíos: `null` mientras se leen. */
  previa: { total: number; porEtapa: Array<{ etapa: string | null; n: number }> } | null;
  onCambiar: (r: ReglasFormulario) => void;
  onVolver: () => void;
};

/** Un id para una ruta o condición nueva (no criptográfico: sólo distingue las filas mientras se edita). */
export const idNuevo = (): string => `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

const BOTON_TEXTO: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 8, border: 'none',
  background: 'none', color: 'var(--primary)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const CONTROL: CSSProperties = { minHeight: 38, borderRadius: 9, fontSize: 13.5 };

function Punto({ color }: { color: string }) {
  return <span aria-hidden style={{ flex: 'none', width: 8, height: 8, borderRadius: 99, background: color }} />;
}

function opcionesEtapa(etapas: EtapaDestino[], entrada: string): DropdownOption[] {
  return etapas.map((e) => ({ value: e.key, label: e.label, color: e.color, ...(e.key === entrada ? { sub: 'Calificado' } : {}) }));
}

/** El desplegable del modo: «todas», «alguna» o «al menos N». */
function opcionesModo(n: number): DropdownOption[] {
  const out: DropdownOption[] = [{ value: 'todas', label: n === 2 ? 'las dos' : 'todas' }, { value: 'alguna', label: 'alguna' }];
  for (let k = 2; k < n; k++) out.push({ value: `n:${k}`, label: `al menos ${k}` });
  return out;
}
const valorModo = (r: RutaCalificacion): string => (r.modo === 'al_menos' && minimoDe(r) > 1 && minimoDe(r) < r.condiciones.length ? `n:${minimoDe(r)}` : r.modo === 'alguna' ? 'alguna' : 'todas');
function conModo(r: RutaCalificacion, v: string): RutaCalificacion {
  if (v.startsWith('n:')) return { ...r, modo: 'al_menos', minimo: Number(v.slice(2)) || 1 };
  return { ...r, modo: v === 'alguna' ? 'alguna' : 'todas' };
}

function Condicion({ c, preguntas, onCambiar, onQuitar }: {
  c: CondicionRegla; preguntas: PreguntaVista[]; onCambiar: (c: CondicionRegla) => void; onQuitar: () => void;
}) {
  const p = preguntas.find((x) => normalizar(x.pregunta) === normalizar(c.pregunta));
  const opcionesPregunta: DropdownOption[] = preguntas.map((x) => ({ value: x.pregunta, label: x.rotulo }));
  if (c.pregunta && !p) opcionesPregunta.unshift({ value: c.pregunta, label: legible(c.pregunta) });
  const numerico = c.op === 'mayor' || c.op === 'menor';
  // ⚠️ LAS RESPUESTAS ELEGIDAS SE BUSCAN NORMALIZADAS: la condición guarda «Fuera de la ciudad» y el envío trajo
  // «fuera_de_la_ciudad». Comparando tal cual, el desplegable decía «Elige respuestas» con la respuesta ya elegida (20/11, en el
  // artefacto). Una elegida que ya no aparece en los envíos se suma como opción, para poder sacarla.
  const conocidas = [...(p?.respuestas ?? [])];
  for (const v of c.valores) if (!conocidas.some((r) => normalizar(r.valor) === normalizar(v))) conocidas.push({ valor: legible(v), veces: 0 });
  const elegidas = conocidas.filter((r) => c.valores.some((v) => normalizar(v) === normalizar(r.valor))).map((r) => r.valor);
  return (
    <div className="mk-condicion" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) 150px minmax(0, 1fr) 32px', gap: 8, alignItems: 'center' }}>
      <Dropdown value={c.pregunta} options={opcionesPregunta} onChange={(v) => onCambiar({ ...c, pregunta: v, valores: [] })}
        placeholder="Elige una pregunta" ariaLabel="Pregunta" width="100%" buttonStyle={CONTROL} />
      <Dropdown value={c.op} options={OPERADORES.map((o) => ({ value: o, label: TEXTO_OPERADOR[o] }))}
        onChange={(v) => onCambiar({ ...c, op: v as OperadorRegla, valores: SIN_VALOR.has(v as OperadorRegla) ? [] : c.valores })}
        ariaLabel="Condición" width="100%" buttonStyle={CONTROL} />
      {SIN_VALOR.has(c.op) ? <span /> : (p?.respuestas.length ?? 0) > 0 && !numerico && (c.op === 'es' || c.op === 'no_es') ? (
        <Dropdown value={elegidas[0] ?? ''} varios={elegidas} options={conocidas.map((r) => ({ value: r.valor, label: r.valor, ...(r.veces ? { sub: `${r.veces} ${r.veces === 1 ? 'vez' : 'veces'}` } : {}) }))}
          onChange={(v) => onCambiar({ ...c, valores: elegidas.includes(v) ? elegidas.filter((x) => x !== v) : [...elegidas, v] })}
          placeholder="Elige respuestas" ariaLabel="Respuesta" width="100%" buttonStyle={CONTROL} />
      ) : (
        <input value={c.valores.join(', ')} onChange={(e) => onCambiar({ ...c, valores: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
          placeholder={numerico ? 'Un número' : 'Respuesta'} aria-label="Respuesta" inputMode={numerico ? 'decimal' : undefined}
          style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
      )}
      <button type="button" onClick={onQuitar} aria-label="Quitar esta condición" title="Quitar esta condición" className="mk-icon-btn" data-tone="dim"
        style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', borderRadius: 8, padding: 0 }}>
        <svg width="13" height="13" viewBox="0 0 15 15" aria-hidden><path d="M3.5 3.5l8 8m0-8l-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

function Ruta({ r, i, total, preguntas, etapas, entrada, onCambiar, onQuitar, onMover, onDuplicar }: {
  r: RutaCalificacion; i: number; total: number; preguntas: PreguntaVista[]; etapas: EtapaDestino[]; entrada: string;
  onCambiar: (r: RutaCalificacion) => void; onQuitar: () => void; onMover: (d: -1 | 1) => void; onDuplicar: () => void;
}) {
  const n = r.condiciones.length;
  const nueva = (): CondicionRegla => ({ pregunta: preguntas.find((p) => !r.condiciones.some((c) => c.pregunta === p.pregunta))?.pregunta ?? preguntas[0]?.pregunta ?? '', op: 'es', valores: [] });
  return (
    <div className="mk-ruta" style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--faint)', textTransform: 'uppercase' }}>Regla {i + 1}</span>
        <span style={{ flex: 1 }} />
        <Dropdown value="" resetAfterSelect sinFlecha align="right" ariaLabel={`Opciones de la regla ${i + 1}`} botonLabel="⋯"
          options={[
            ...(i > 0 ? [{ value: 'subir', label: 'Subir', icono: 'arriba' as const }] : []),
            ...(i < total - 1 ? [{ value: 'bajar', label: 'Bajar', icono: 'abajo' as const }] : []),
            { value: 'duplicar', label: 'Duplicar', icono: 'duplicar' as const },
            { value: 'quitar', label: 'Eliminar regla', icono: 'borrar' as const },
          ]}
          onChange={(v) => { if (v === 'subir') onMover(-1); else if (v === 'bajar') onMover(1); else if (v === 'duplicar') onDuplicar(); else if (v === 'quitar') onQuitar(); }}
          buttonStyle={{ width: 30, height: 30, minHeight: 0, padding: 0, justifyContent: 'center', border: 'none', background: 'transparent', fontSize: 16, color: 'var(--dim)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--ink)' }}>
          <span>Si se {n === 1 ? 'cumple' : 'cumplen'}</span>
          {n > 1
            ? <Dropdown value={valorModo(r)} options={opcionesModo(n)} onChange={(v) => onCambiar(conModo(r, v))} ariaLabel="Cuántas condiciones" width={150} buttonStyle={{ ...CONTROL, minHeight: 34, fontWeight: 600 }} />
            : null}
          <span>{n === 1 ? 'esta condición' : `de estas ${n} condiciones`}</span>
        </div>
        {r.condiciones.map((c, k) => (
          <Condicion key={k} c={c} preguntas={preguntas}
            onCambiar={(nc) => onCambiar({ ...r, condiciones: r.condiciones.map((x, j) => (j === k ? nc : x)) })}
            onQuitar={() => onCambiar({ ...r, condiciones: r.condiciones.filter((_, j) => j !== k) })} />
        ))}
        <div>
          <button type="button" style={BOTON_TEXTO} onClick={() => onCambiar({ ...r, condiciones: [...r.condiciones, nueva()] })}>+ Agregar condición</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>→ Mover a</span>
          <Dropdown value={r.etapa} options={opcionesEtapa(etapas, entrada)} onChange={(v) => onCambiar({ ...r, etapa: v })}
            ariaLabel="Etapa de destino" width={230} placeholder="Elige una etapa" buttonStyle={{ ...CONTROL, fontWeight: 600 }} />
        </div>
      </div>
    </div>
  );
}

export function VistaReglas(p: PropsVistaReglas) {
  const { reglas } = p;
  const nombreEtapa = (k: string | null) => (k == null ? null : p.etapas.find((e) => e.key === k)?.label ?? k);
  const colorEtapa = (k: string | null) => (k == null ? 'var(--faint)' : p.etapas.find((e) => e.key === k)?.color ?? 'var(--faint)');
  const cambiarRuta = (i: number, r: RutaCalificacion) => p.onCambiar({ ...reglas, rutas: reglas.rutas.map((x, j) => (j === i ? r : x)) });
  const mover = (i: number, d: -1 | 1) => {
    const rutas = [...reglas.rutas];
    const [r] = rutas.splice(i, 1);
    rutas.splice(i + d, 0, r);
    p.onCambiar({ ...reglas, rutas });
  };
  const nuevaRuta = (): RutaCalificacion => ({
    id: idNuevo(), modo: 'todas', minimo: 1,
    condiciones: [{ pregunta: p.preguntas[0]?.pregunta ?? '', op: 'es', valores: [] }],
    etapa: p.etapas.find((e) => e.key === 'descal')?.key ?? p.entrada,
  });
  const siNinguna = reglas.siNinguna;
  return (
    <div className="crm-hover mk-reglas" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, fontFamily: SANS }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={p.onVolver} style={{ ...BOTON_TEXTO, padding: 0, height: 24, alignSelf: 'flex-start', color: 'var(--dim)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
          Formularios
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <IconoFuente tipo={p.formulario.tipo} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 650, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.formulario.nombre}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.formulario.detalle}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Calificación automática</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>Cada lead de este formulario va a su etapa de «{p.nombreFunnel}» según lo que contestó.</span>
          </span>
          <Interruptor prendido={reglas.activa} etiqueta="Calificación automática" onCambiar={(v) => p.onCambiar({ ...reglas, activa: v })} />
        </div>
      </div>

      {p.preguntas.length === 0 && (
        <p role="status" style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          Este formulario todavía no tiene envíos: sus preguntas aparecen aquí cuando llegue el primero.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: reglas.activa ? 1 : 0.55 }}>
        {reglas.rutas.map((r, i) => (
          <Ruta key={r.id} r={r} i={i} total={reglas.rutas.length} preguntas={p.preguntas} etapas={p.etapas} entrada={p.entrada}
            onCambiar={(nr) => cambiarRuta(i, nr)}
            onQuitar={() => p.onCambiar({ ...reglas, rutas: reglas.rutas.filter((_, j) => j !== i) })}
            onMover={(d) => mover(i, d)}
            onDuplicar={() => { const rutas = [...reglas.rutas]; rutas.splice(i + 1, 0, { ...r, id: idNuevo(), condiciones: r.condiciones.map((c) => ({ ...c, valores: [...c.valores] })) }); p.onCambiar({ ...reglas, rutas }); }} />
        ))}
        <div>
          <button type="button" style={{ ...BOTON_TEXTO, border: '1px dashed var(--border-strong)', height: 38, padding: '0 14px', borderRadius: 10 }}
            onClick={() => p.onCambiar({ ...reglas, activa: true, rutas: [...reglas.rutas, nuevaRuta()] })}>+ Agregar regla</button>
        </div>
        {/* EL RESPALDO de Calendly («fallback route»): el que no cumple ninguna. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, flex: '1 1 200px' }}>Si no cumple ninguna regla</span>
          <Dropdown value={siNinguna ?? ''} ariaLabel="Etapa si no cumple ninguna regla" width={230}
            options={[{ value: '', label: `Se queda en «${nombreEtapa(p.entrada) ?? 'Lead entrante'}»` }, ...opcionesEtapa(p.etapas, p.entrada).filter((o) => o.value !== p.entrada)]}
            onChange={(v) => p.onCambiar({ ...reglas, siNinguna: v || null })} buttonStyle={{ ...CONTROL, fontWeight: 600 }} />
        </div>
      </div>

      {/* LA VISTA PREVIA (el «Preview form» de Calendly, con los envíos de verdad): a dónde irían los que ya llegaron. */}
      <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
          {p.previa == null ? 'Calculando con los envíos que ya llegaron…'
            : p.previa.total === 0 ? 'Cuando lleguen envíos, aquí verás a qué etapa iría cada uno.'
              : `Con estas reglas, ${p.previa.total === 1 ? 'el último envío iría' : `los últimos ${p.previa.total} envíos irían`} así:`}
        </span>
        {p.previa && p.previa.total > 0 && (
          <>
            <div aria-hidden style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--border)' }}>
              {p.previa.porEtapa.filter((x) => x.n > 0).map((x) => (
                <span key={x.etapa ?? 'nada'} style={{ width: `${(100 * x.n) / p.previa!.total}%`, background: x.etapa ? colorEtapa(x.etapa) : 'var(--border-strong)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {p.previa.porEtapa.filter((x) => x.n > 0).map((x) => (
                <span key={x.etapa ?? 'nada'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ink)' }}>
                  <Punto color={x.etapa ? colorEtapa(x.etapa) : 'var(--border-strong)'} />
                  {nombreEtapa(x.etapa) ?? `Se quedan en «${nombreEtapa(p.entrada) ?? 'Lead entrante'}»`}
                  <b style={{ fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{x.n}</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** El estilo de un botón principal de este modal: en MAYÚSCULA (memoria «cta-en-mayuscula», 18/11/2026). */
export const CTA_FUENTES = ESTILO_CTA;
