'use client';

// =============================================================================
// Media Buyer — las piezas con la estructura de AdAmigo (25/10/2026)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «Me gusta el de "AdAmigo" implementalo de punta en punta». Cada pieza es la de una captura de
// AdAmigo (docs/media-buyer/referencias/adamigo/): la cabecera «I've prepared 2 new AI Actions for today» con su barra
// «0/2 applied» y «Adjust AI» (adamigo-1), la tarjeta de acción con su agente, Qué · Por qué · Impacto esperado y
// 🗑 · ⚙ · Ask · Apply (adamigo-1 y adamigo-3), el cambio «$250 → $300/day +20%» (adamigo-4) y la columna de la derecha
// con los números de la cuenta y «New ads ready for your review» (adamigo-1). Los nombres, en español y cortos.
// Lo que AdAmigo no tiene y MaKo sí va DENTRO de esos lugares: el producto (el funnel del CRM) de cada acción como una
// etiqueta más, y los números del CRM por producto en la columna de la derecha.
// =============================================================================

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Criatura } from '@/app/_components/Criatura';
import type { Decision, KpiMediaBuyer, MetasDelMes } from '@/lib/media-buyer/tipos';
import type { Alerta } from '@/lib/media-buyer/protect';
import { fmtDinero, fmtNum } from '@/lib/format';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import {
  AGENTE_DE, NOMBRE_AGENTE, cambioDe, hace, impactoEsperado, monto, queHace, verboLanzar,
  type Agente, type PestanaAA,
} from './mb-modelo';

// ── Los íconos de línea (el trazo de AdAmigo, que es el de Lucide) ──
const sv = (d: ReactNode, w = 1.7) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
export const Ic = {
  resumen: () => sv(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  autopilot: () => sv(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m8 12 3 3 5-6" /></>),
  campanas: () => sv(<><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12" /></>),
  biblioteca: () => sv(<><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></>),
  robot: () => sv(<><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6" /></>),
  tuerca: () => sv(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  info: () => sv(<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>),
  check: () => sv(<path d="M20 6 9 17l-5-5" />, 2),
  checkCirculo: () => sv(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  abajo: () => sv(<path d="m6 9 6 6 6-6" />),
  deshacer: () => sv(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>),
  chispa: () => sv(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />),
};
const ICONO_AGENTE: Record<Agente, () => ReactNode> = {
  media_buyer: () => sv(<><circle cx="9" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6" /></>),
  protect: () => sv(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  estratega: () => sv(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>),
  disenador: () => sv(<><path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="m2 2 7.6 7.6" /><circle cx="11" cy="11" r="2" /></>),
  tu: () => sv(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};

export function EtiquetaAgente({ d }: { d: Pick<Decision, 'tactica'> }) {
  const a = AGENTE_DE[d.tactica];
  return <span className="aa-agente">{ICONO_AGENTE[a]()}{NOMBRE_AGENTE[a]}</span>;
}

// ── La cabecera de hoy ───────────────────────────────────────────────────────

export function CabeceraHoy({ pendientes, aplicadasHoy, actualizado, ajustesHref, alertasGraves = 0 }: {
  pendientes: number; aplicadasHoy: number; actualizado: string; ajustesHref: string;
  /** Las alertas graves de Protect: con alguna, la cuenta NO está «en orden». */
  alertasGraves?: number;
}) {
  const total = pendientes + aplicadasHoy;
  return (
    <section className="aa-hero" aria-label="Lo de hoy">
      <div className="aa-hero-txt">
        {pendientes > 0 ? (
          <>
            <h1>Te preparé <b>{pendientes} {pendientes === 1 ? 'acción nueva' : 'acciones nuevas'}</b> para hoy</h1>
            <p>Revísalas, pregúntame lo que quieras y aplícalas con un toque. Toma <b>{Math.max(2, pendientes)} min</b>.</p>
          </>
        ) : alertasGraves > 0 ? (
          <>
            <h1>Hay <b>{alertasGraves} {alertasGraves === 1 ? 'cosa' : 'cosas'}</b> para mirar en tu cuenta</h1>
            <p>No hay nada para aprobar, pero algo se rompió. {actualizado}.</p>
          </>
        ) : (
          <>
            <h1>Hoy tu cuenta está <b>en orden</b></h1>
            <p>Vuelvo a mirarla mañana temprano. {actualizado}.</p>
          </>
        )}
        {total > 0 && (
          <>
            <div className="aa-barra" aria-hidden><i style={{ width: `${Math.round((aplicadasHoy / total) * 100)}%` }} /></div>
            <span className="aa-barra-txt">{aplicadasHoy}/{total} {total === 1 ? 'aplicada' : 'aplicadas'}</span>
          </>
        )}
      </div>
      <Link href={ajustesHref} className="aa-ajustar" title="Ajustar cómo trabaja MaKo">
        <Criatura nombre="MaKo" size={46} estrella />
        <span>Ajustar IA</span>
      </Link>
    </section>
  );
}

// ── Las subpestañas ──────────────────────────────────────────────────────────

export const NOMBRE_SUB: Record<PestanaAA, string> = { hoy: 'Hoy', programadas: 'Programadas', implementadas: 'Implementadas', bloqueadas: 'Bloqueadas' };

export function Subpestanas({ actual, cuenta, onCambiar }: { actual: PestanaAA; cuenta: Record<PestanaAA, number>; onCambiar: (p: PestanaAA) => void }) {
  return (
    <nav className="aa-sub" role="tablist" aria-label="Acciones">
      {(['hoy', 'programadas', 'implementadas', 'bloqueadas'] as PestanaAA[]).map((p) => (
        <button key={p} type="button" role="tab" aria-selected={actual === p} onClick={() => onCambiar(p)}>
          {NOMBRE_SUB[p]}{cuenta[p] > 0 && <small>{cuenta[p]}</small>}
        </button>
      ))}
    </nav>
  );
}

// ── La tarjeta de acción ─────────────────────────────────────────────────────

const fecha = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export function TarjetaAccion({ d, kpi, producto, ocupada, encendido, ajustesHref, onAplicar, onBorrar, onPreguntar, onDeshacer, onReabrir, onCalificar, onHooksAVideo }: {
  d: Decision; kpi: KpiMediaBuyer; producto: string | null; ocupada: boolean; encendido: boolean; ajustesHref: string;
  onAplicar: (extra: { presupuesto?: number; elegidas?: string[] }) => Promise<boolean>;
  onBorrar: () => void; onPreguntar: () => void; onDeshacer: () => void; onReabrir: () => void;
  onCalificar: (n: number) => void; onHooksAVideo: (elegidas: string[]) => void;
}) {
  const [mas, setMas] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set((d.variaciones ?? []).filter((v) => v.elegida).map((v) => v.id)));
  const [editando, setEditando] = useState(false);
  const [montoTxt, setMontoTxt] = useState(d.despues.presupuesto != null ? String(d.despues.presupuesto) : '');
  const esVar = d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook';
  const abierta = d.estado === 'abierta';
  const reintentable = d.estado === 'bloqueada' || d.estado === 'fallida';
  const hecha = d.estado === 'aplicada' || d.estado === 'deshecha';
  const cambio = cambioDe(d);
  const baja = cambio?.pct?.startsWith('-') || d.despues.estado === 'PAUSED';
  const aplicar = () => {
    const extra: { presupuesto?: number; elegidas?: string[] } = {};
    if (esVar) extra.elegidas = [...elegidas];
    if (editando && montoTxt.trim()) extra.presupuesto = Number(montoTxt.replace(',', '.'));
    void onAplicar(extra).then((ok) => { if (ok) setEditando(false); });
  };
  const estado = d.estado === 'fallida' ? { t: 'No se pudo', tono: 'mal' } : d.estado === 'bloqueada' ? { t: 'Frenada por un tope', tono: 'cuidado' }
    : d.estado === 'vencida' ? { t: 'Vencida', tono: undefined } : d.estado === 'descartada' ? { t: 'Descartada', tono: undefined }
      : d.estado === 'deshecha' ? { t: 'Deshecha', tono: undefined }
        : d.estado === 'aplicada' ? { t: d.origen === 'piloto' ? `Piloto automático · ${hace(d.aplicadaAt)}` : `${d.aplicadaPor ?? 'Tu equipo'} · ${hace(d.aplicadaAt)}`, tono: undefined } : null;

  return (
    <article className="aa-card" id={`accion-${d.id}`}>
      <div className="aa-card-cab">
        <EtiquetaAgente d={d} />
        {producto && <span className="aa-producto" title={`Producto: ${producto}`}>{producto}</span>}
        {estado && <span className="aa-estado" data-tono={estado.tono}>{estado.t}</span>}
      </div>
      <h3>{d.titulo}</h3>
      <div className="aa-fecha">{fecha.format(new Date(d.creada))}</div>
      {cambio && (
        <div className="aa-cambio">
          <span className="a">{cambio.antes}</span><span className="flecha" aria-hidden>→</span><span className="b">{cambio.despues}</span>
          {cambio.pct && <span className="aa-pct" data-baja={baja ? '1' : '0'}>{cambio.pct}</span>}
        </div>
      )}
      <div className="aa-bloque"><h4>Qué</h4><p>{queHace(d)}</p></div>
      <div className="aa-bloque">
        <h4>Por qué</h4>
        <p>{d.titular}.{mas && d.porque.length ? ' ' + d.porque.join(' ') : ''}</p>
        {mas && d.numeros.length > 0 && (
          <table className="aa-nums" style={{ marginTop: 8 }}>
            <tbody>{d.numeros.map((n, i) => <tr key={i}><td>{n.condicion}</td><td>{n.valor}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      {esVar && (
        <div className="aa-bloque">
          <h4>{d.tipo === 'variaciones_hook' ? 'Los ganchos' : 'Los textos'}</h4>
          <div className="aa-vars">
            {(d.variaciones ?? []).slice(0, mas ? undefined : 2).map((v) => {
              const on = elegidas.has(v.id);
              return (
                <label key={v.id} className="aa-var" data-on={on ? '1' : '0'}>
                  <input type="checkbox" checked={on} disabled={!abierta}
                    onChange={() => setElegidas((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} />
                  <span>{v.gancho && <b>{v.gancho}</b>}<p>{v.textoPrincipal}</p></span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div className="aa-bloque">
        <h4>Impacto esperado</h4>
        <ul className="aa-impacto">{impactoEsperado(d, kpi).map((t) => <li key={t}>{Ic.checkCirculo()}{t}</li>)}</ul>
      </div>
      {(d.porque.length > 0 || d.numeros.length > 0 || (d.variaciones ?? []).length > 2) && (
        <button type="button" className="aa-mas" aria-expanded={mas} onClick={() => setMas((x) => !x)}>{mas ? 'Menos' : 'Más info'}{Ic.abajo()}</button>
      )}
      {editando && d.despues.presupuesto != null && (
        <div className="aa-editar">
          <input inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} aria-label="Presupuesto diario nuevo, en la moneda de la cuenta" />
          <span>{d.moneda ?? ''} por día</span>
        </div>
      )}
      <div className="aa-pie">
        {hecha && (
          <span className="aa-estrellas" aria-label="¿Cuánto sirvió?">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" data-on={(d.estrellas ?? 0) >= n ? '1' : '0'} title={`${n} de 5`} onClick={() => onCalificar(n)}>★</button>)}
          </span>
        )}
        {!hecha && <span className="aa-pie-nota" data-tono={d.error ? (d.estado === 'bloqueada' ? 'cuidado' : 'mal') : undefined}>{d.error ?? d.nota ?? ''}</span>}
        {(abierta || reintentable) && <button type="button" className="aa-ic" title="Borrar" aria-label="Borrar esta acción" disabled={ocupada} onClick={onBorrar}><IconoBorrar size={16} /></button>}
        {abierta && <Link href={ajustesHref} className="aa-ic" title="Ajustes de esta táctica" aria-label="Ajustes de esta táctica">{Ic.tuerca()}</Link>}
        {abierta && d.despues.presupuesto != null && (
          <button type="button" className="aa-sec" onClick={() => setEditando((x) => !x)}>{editando ? 'Usar el de MaKo' : 'Editar'}</button>
        )}
        {abierta && d.tipo === 'variaciones_hook' && (
          <button type="button" className="aa-sec" disabled={elegidas.size === 0} onClick={() => onHooksAVideo([...elegidas])}>Filmar</button>
        )}
        <button type="button" className="aa-sec" onClick={onPreguntar}>{Ic.info()}Preguntar</button>
        {(abierta || reintentable) && (
          <button type="button" className="aa-aplicar" disabled={ocupada || !encendido || (esVar && elegidas.size === 0)} onClick={aplicar}>
            {Ic.check()}{ocupada ? 'Aplicando…' : reintentable ? 'Reintentar' : esVar ? verboLanzar(d) : 'Aplicar'}
          </button>
        )}
        {d.estado === 'aplicada' && <button type="button" className="aa-sec" disabled={ocupada} onClick={onDeshacer}>{Ic.deshacer()}Deshacer</button>}
        {(d.estado === 'descartada' || d.estado === 'vencida') && <button type="button" className="aa-sec" disabled={ocupada} onClick={onReabrir}>Volver a abrir</button>}
      </div>
    </article>
  );
}

// ── La columna de la derecha ─────────────────────────────────────────────────

export type ProductoEnCuenta = { id: string; nombre: string; resultados: number; costo: number | null; tono: 'bien' | 'mal' | null; href: string };

const NOMBRE_KPI: Record<KpiMediaBuyer, { varios: string; costo: string }> = {
  lead: { varios: 'Leads', costo: 'Costo por lead' }, agenda: { varios: 'Agendas', costo: 'Costo por agenda' }, venta: { varios: 'Ventas', costo: 'Costo por venta' },
};

export function PanelCuenta({ metas, kpi, objetivo, productos }: { metas: MetasDelMes; kpi: KpiMediaBuyer; objetivo: number | null; productos: ProductoEnCuenta[] }) {
  const fmt = (u: number) => (metas.convierte ? fmtDinero(u) : fmtDinero(u, metas.moneda));
  const res = kpi === 'venta' ? metas.resultados.ventas : kpi === 'agenda' ? metas.resultados.agendas : metas.resultados.leads;
  const costo = res > 0 ? metas.gasto / res : null;
  const n = NOMBRE_KPI[kpi];
  const filas: Array<[string, string, string | null]> = [
    ['Gasto en Meta', fmt(metas.gasto), null],
    [n.varios, fmtNum(res), 'del CRM'],
    [n.costo, costo != null ? fmt(costo) : '—', objetivo ? `objetivo ${fmt(objetivo)}` : null],
    ...(kpi !== 'agenda' ? [['Agendas', fmtNum(metas.resultados.agendas), 'del CRM'] as [string, string, string]] : []),
    ...(kpi !== 'venta' ? [['Ventas', fmtNum(metas.resultados.ventas), 'del CRM'] as [string, string, string]] : []),
    ['Cobrado', fmt(metas.caja), 'del CRM'],
  ];
  return (
    <section className="aa-panel" aria-label="Tu cuenta">
      <h2>Tu cuenta — <em>este mes</em></h2>
      <p>{metas.diasQuedan === 1 ? 'Queda 1 día' : `Quedan ${metas.diasQuedan} días`} · los resultados salen de tu CRM</p>
      <table className="aa-kpis">
        <thead><tr><th>Métrica</th><th>Valor</th></tr></thead>
        <tbody>{filas.map(([k, v, s]) => <tr key={k}><td>{k}</td><td>{v}{s && <small>{s}</small>}</td></tr>)}</tbody>
      </table>
      {productos.length > 0 && (
        <div className="aa-prods" aria-label="Por producto">
          {productos.map((p) => (
            <Link key={p.id} href={p.href} className="aa-prod">
              <b>{p.nombre}</b>
              <strong>{p.costo != null ? fmt(p.costo) : '—'}</strong>
              <span>{p.resultados} {n.varios.toLowerCase()}</span>
              <em data-tono={p.tono ?? undefined}>{n.costo.toLowerCase()}</em>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** «New ads ready for your review»: las variaciones abiertas, para revisar de un vistazo. Sin ninguna, no se dibuja. */
export function AnunciosNuevos({ decisiones, onAbrir }: { decisiones: Decision[]; onAbrir: (d: Decision) => void }) {
  const tiles = decisiones.flatMap((d) => (d.variaciones ?? []).filter((v) => v.elegida).map((v) => ({ d, v }))).slice(0, 4);
  if (!tiles.length) return null;
  return (
    <section className="aa-panel" aria-label="Anuncios nuevos para revisar">
      <h2>Anuncios nuevos para revisar</h2>
      <p>Textos y ganchos nuevos de tus ganadores, listos para lanzar.</p>
      <div className="aa-ads">
        {tiles.map(({ d, v }) => (
          <button key={`${d.id}-${v.id}`} type="button" className="aa-ad" data-texto={d.anuncioBase?.miniatura ? '0' : '1'} onClick={() => onAbrir(d)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.anuncioBase?.miniatura && <img src={d.anuncioBase.miniatura} alt="" loading="lazy" />}
            {!d.anuncioBase?.miniatura && <small>{v.gancho ? 'Gancho nuevo' : 'Texto nuevo'}</small>}
            <span>{v.gancho ?? v.textoPrincipal}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Protect: lo roto en la cuenta (lib/media-buyer/protect.ts), arriba de las acciones. Sin alertas no se dibuja. */
export function AlertasProtect({ alertas, onPreguntar }: { alertas: Alerta[]; onPreguntar: (a: Alerta) => void }) {
  if (!alertas.length) return null;
  return (
    <section className="aa-protect" aria-label="Protect">
      <h2 className="aa-seccion">Protect · {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}</h2>
      {alertas.map((a) => (
        <article key={a.id} className="aa-alerta" data-g={a.gravedad}>
          <span className="aa-alerta-ic" aria-hidden>{ICONO_AGENTE.protect()}</span>
          <div>
            <b>{a.titulo}</b>
            <p>{a.detalle}</p>
          </div>
          <button type="button" className="aa-sec" onClick={() => onPreguntar(a)}>{Ic.info()}Preguntar</button>
        </article>
      ))}
    </section>
  );
}

/** Lo que no está en ninguna pestaña: una línea, nunca una caja vacía. */
export function Nada({ children }: { children: ReactNode }) {
  return <p className="aa-nada">{Ic.chispa()}{children}</p>;
}

export function montoCorto(m: number | null | undefined, moneda: string | null): string { return monto(m, moneda); }
