'use client';

// =============================================================================
// Media Buyer — Campañas: el lienzo por producto (25/10/2026)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «en el lienzo, recuerda que tenemos varios CRM, varios productos, se debe poder interactuar».
// La pestaña «Campaigns» de AdAmigo, con lo que MaKo tiene y AdAmigo no: cada campaña pertenece a un PRODUCTO (un funnel
// del CRM) y su costo sale de los resultados del CRM, no de los que reporta Meta. A la izquierda los productos (como las
// tarjetas de cuenta de adamigo-4: nombre, lo que gasta y su costo en verde o rojo); a la derecha, las campañas del elegido,
// cada una con lo que gasta, sus resultados del CRM, sus acciones abiertas y la pieza del CRM para cambiarla de producto
// (ProductoCelda.tsx: la MISMA de la tabla de campañas del CRM, con sus acciones; ninguna segunda implementación).
// Lo pide al abrir la pestaña (`op: 'lienzo'`): lee la cuenta en vivo.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductoCelda } from './ProductoCelda';
import { campanasAsignadasAction, type ProductoNombre } from '@/app/crm/campanas-actions';
import type { CampanaAsignada } from '@/lib/campana-config';
import type { CampanaDeLienzo, ProductoDeLienzo } from '@/lib/media-buyer/productos';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import { fmtDinero, fmtNum } from '@/lib/format';
import { Nada } from './Autopilot';

export type Lienzo = { productos: ProductoDeLienzo[]; sinProducto: CampanaDeLienzo[]; moneda: string | null };
const SIN = 'sin';
const NOMBRE_KPI: Record<KpiMediaBuyer, { varios: string; costo: string }> = {
  lead: { varios: 'Leads', costo: 'Costo por lead' }, agenda: { varios: 'Agendas', costo: 'Costo por agenda' }, venta: { varios: 'Ventas', costo: 'Costo por venta' },
};

export function LienzoCampanas({ kpi, objetivo, abiertas, productoInicial, onVerAcciones, show, inicial = null }: {
  kpi: KpiMediaBuyer; objetivo: number | null;
  /** Las acciones abiertas (Hoy y Programadas): cada campaña dice cuántas tiene. */
  abiertas: Decision[];
  productoInicial: string | null;
  onVerAcciones: (d: Decision) => void;
  show: (msg: string, onUndo?: () => void, tono?: 'bad') => void;
  /** Lo ya leído (sin pedirlo otra vez). */
  inicial?: Lienzo | null;
}) {
  const [l, setL] = useState<Lienzo | null>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<string | null>(productoInicial);
  const [asignadas, setAsignadas] = useState<CampanaAsignada[]>([]);
  const [productosCrm, setProductosCrm] = useState<ProductoNombre[]>([]);
  const n = NOMBRE_KPI[kpi];

  const leer = useCallback(async () => {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'lienzo' }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: 'No pude leer la cuenta.' }));
    if (r.ok) { setL({ productos: r.productos, sinProducto: r.sinProducto, moneda: r.moneda ?? null }); setError(null); }
    else setError(r.error ?? 'No pude leer la cuenta.');
  }, []);
  useEffect(() => {
    if (!inicial) void leer();
    void campanasAsignadasAction().then((r) => { if (r.ok) { setAsignadas(r.asignadas); setProductosCrm(r.productos); } });
  }, [leer]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (u: number | null) => (u == null ? '—' : fmtDinero(u, 'USD'));
  const lista = useMemo(() => (l ? [...l.productos, ...(l.sinProducto.length ? [{ id: SIN, nombre: 'Sin producto', gasto: l.sinProducto.reduce((s, c) => s + c.gasto, 0), resultados: l.sinProducto.reduce((s, c) => s + c.resultados, 0), costo: null, tono: null, campanas: l.sinProducto }] : [])] : []), [l]);
  const actual = lista.find((p) => p.id === elegido) ?? lista.find((p) => p.campanas.length) ?? lista[0] ?? null;
  const accionesDe = (c: CampanaDeLienzo) => abiertas.filter((d) => d.entidadId === c.id || d.campanaNombre === c.nombre);

  if (error) return <Nada>{error}</Nada>;
  if (!l) return <div className="aa-lz" aria-busy="true"><div className="aa-lz-prods">{[0, 1, 2].map((i) => <div key={i} className="aa-lz-prod aa-cargando" />)}</div><div className="aa-panel aa-cargando" style={{ minHeight: 320 }} /></div>;

  return (
    <div className="aa-lz">
      <nav className="aa-lz-prods" aria-label="Tus productos">
        {lista.map((p) => {
          const prendidas = p.campanas.filter((c) => c.prendida).length;
          return (
            <button key={p.id} type="button" className="aa-lz-prod" aria-pressed={actual?.id === p.id} data-sin={p.id === SIN ? '1' : '0'} onClick={() => setElegido(p.id)}>
              <span className="aa-lz-prod-nombre">{p.nombre}</span>
              <span className="aa-lz-prod-sub">{p.campanas.length ? `${p.campanas.length} ${p.campanas.length === 1 ? 'campaña' : 'campañas'} · ${prendidas} ${prendidas === 1 ? 'prendida' : 'prendidas'}` : 'Sin campañas todavía'}</span>
              {p.id !== SIN && p.campanas.length > 0 && (
                <span className="aa-lz-prod-num">
                  <b>{fmt(p.costo)}</b><em data-tono={p.tono ?? undefined}>{n.costo.toLowerCase()}</em>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {actual && (
        <section className="aa-panel aa-lz-det" aria-label={actual.nombre}>
          <header className="aa-lz-cab">
            <h2>{actual.nombre}</h2>
            <p>{actual.id === SIN ? 'Campañas que todavía no van a ningún producto: sus leads entran por las reglas de siempre.' : 'Este mes · los resultados salen de tu CRM'}</p>
          </header>
          {actual.id !== SIN && (
            <div className="aa-lz-stats">
              <div><span>Gasto</span><b>{fmt(actual.gasto)}</b></div>
              <div><span>{n.varios}</span><b>{fmtNum(actual.resultados)}</b></div>
              <div><span>{n.costo}</span><b data-tono={actual.tono ?? undefined}>{fmt(actual.costo)}</b>{objetivo ? <small>objetivo {fmt(objetivo)}</small> : null}</div>
            </div>
          )}
          {actual.campanas.length === 0 ? (
            <Nada>Este producto todavía no tiene campañas. Asígnale una desde «Sin producto», o pídele a MaKo que la arme.</Nada>
          ) : (
            <div className="aa-lz-campanas" role="list">
              {actual.campanas.map((c) => {
                const acc = accionesDe(c);
                return (
                  <article key={c.id} className="aa-lz-camp" role="listitem">
                    <div className="aa-lz-camp-cab">
                      <span className="aa-punto" data-off={c.prendida ? '0' : '1'} aria-label={c.prendida ? 'Prendida' : 'Pausada'} />
                      <b title={c.nombre}>{c.nombre}</b>
                      {acc.length > 0 && (
                        <button type="button" className="aa-lz-acc" onClick={() => onVerAcciones(acc[0])}>{acc.length} {acc.length === 1 ? 'acción' : 'acciones'}</button>
                      )}
                    </div>
                    <dl className="aa-lz-camp-nums">
                      <div><dt>Por día</dt><dd>{c.presupuestoDia != null ? fmtDinero(c.presupuestoDia, l.moneda) : 'En sus conjuntos'}</dd></div>
                      <div><dt>Gasto del mes</dt><dd>{fmt(c.gasto)}</dd></div>
                      <div><dt>{n.varios}</dt><dd>{fmtNum(c.resultados)}</dd></div>
                      <div><dt>{n.costo}</dt><dd data-tono={c.tono ?? undefined}>{fmt(c.costo)}</dd></div>
                    </dl>
                    <div className="aa-lz-camp-pie">
                      <span>{c.conjuntos} {c.conjuntos === 1 ? 'conjunto' : 'conjuntos'}</span>
                      <ProductoCelda item={{ tipo: 'campana', id: c.id, nombre: c.nombre }} productos={productosCrm}
                        asignada={asignadas.find((a) => a.tipo === 'campana' && a.id === c.id)}
                        onAsignadas={(xs) => { setAsignadas(xs); void leer(); }} show={show} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
