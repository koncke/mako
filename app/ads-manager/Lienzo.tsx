'use client';

// =============================================================================
// Media Buyer — Campañas: el árbol de la 04 con los productos del CRM (25/10/2026 noche)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «en el lienzo, recuerda que tenemos varios CRM, varios productos, se debe poder interactuar».
// Con el dibujo de la captura 04 (Arbol.tsx), como Hoy: la pastilla de MaKo, una rama por PRODUCTO (un funnel del CRM) y,
// en cada rama, una tarjeta chica por campaña con lo que gastó este mes, sus resultados del CRM y su costo en verde o rojo.
// Lo que no tiene producto va en su propia rama, y cada tarjeta lleva a lo sumo UN botón: «Asignar» (sin producto) o
// «N cambios» (los del día sobre esa campaña). Al tocarla se abre su hoja: los números, la pieza del CRM para cambiarla de
// producto (ProductoCelda.tsx: la MISMA de la tabla de campañas del CRM, ninguna segunda implementación) y sus cambios.
// Lo pide al abrir la pestaña (`op: 'lienzo'`): lee la cuenta en vivo.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/app/_ui';
import { ProductoCelda } from './ProductoCelda';
import { campanasAsignadasAction, type ProductoNombre } from '@/app/crm/campanas-actions';
import type { CampanaAsignada } from '@/lib/campana-config';
import type { CampanaDeLienzo, ProductoDeLienzo } from '@/lib/media-buyer/productos';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import { fmtDinero, fmtNum } from '@/lib/format';
import { Nada } from './Autopilot';
import { Ramas, TarjetaRama, TarjetaVacia } from './Arbol';
import { mensajeDeCampanas, pildoraDeCampanas } from './mb-modelo';

export type Lienzo = { productos: ProductoDeLienzo[]; sinProducto: CampanaDeLienzo[]; moneda: string | null };
const RES: Record<KpiMediaBuyer, [string, string]> = { lead: ['leads', 'lead'], agenda: ['agendas', 'agenda'], venta: ['ventas', 'venta'] };

export function LienzoCampanas({ kpi, abiertas, productoInicial, avatar, onVerAcciones, show, inicial = null }: {
  kpi: KpiMediaBuyer;
  /** Los cambios abiertos de hoy: cada campaña dice cuántos tiene. */
  abiertas: Decision[];
  /** `?producto=<id>`: abre la hoja de la primera campaña de ese producto. */
  productoInicial: string | null;
  /** La estrella de MaKo, para la pastilla y el mensaje. */
  avatar: ReactNode;
  onVerAcciones: (d: Decision) => void;
  show: (msg: string, onUndo?: () => void, tono?: 'bad') => void;
  /** Lo ya leído (sin pedirlo otra vez). */
  inicial?: Lienzo | null;
}) {
  const [l, setL] = useState<Lienzo | null>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [asignadas, setAsignadas] = useState<CampanaAsignada[]>([]);
  const [productosCrm, setProductosCrm] = useState<ProductoNombre[]>([]);
  const [plural, uno] = RES[kpi];

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
  useEffect(() => {
    // `?producto=`: la primera campaña de ese producto, abierta.
    if (!l || !productoInicial) return;
    const p = productoInicial === 'sin' ? { campanas: l.sinProducto } : l.productos.find((x) => x.id === productoInicial);
    if (p?.campanas[0]) setAbierta(p.campanas[0].id);
  }, [l, productoInicial]);

  const fmt = (u: number | null) => (u == null ? '—' : fmtDinero(u, 'USD'));
  const accionesDe = useCallback((c: CampanaDeLienzo) => abiertas.filter((d) => d.entidadId === c.id || d.campanaNombre === c.nombre), [abiertas]);
  const todas = useMemo(() => (l ? [...l.productos.flatMap((p) => p.campanas.map((c) => ({ c, producto: p.nombre as string | null }))), ...l.sinProducto.map((c) => ({ c, producto: null as string | null }))] : []), [l]);
  const detalle = abierta ? todas.find((x) => x.c.id === abierta) ?? null : null;

  if (error) return <Nada>{error}</Nada>;
  if (!l) return <div className="aa-arbol" aria-busy="true"><div className="aa-chica aa-cargando" style={{ width: 'min(100%, 360px)' }} /></div>;

  const tarjeta = (c: CampanaDeLienzo, producto: string | null) => {
    const acc = accionesDe(c);
    return (
      <TarjetaRama key={c.id} titulo={c.nombre} sub={`Meta · ${c.conjuntos} ${c.conjuntos === 1 ? 'conjunto' : 'conjuntos'}${c.prendida ? '' : ' · pausada'}`}
        rotulo="Este mes" abrir={`${c.nombre}: ver sus números`} onAbrir={() => setAbierta(c.id)}
        marca={acc.length
          ? <button type="button" className="aa-chica-aplicar" data-tono="sec" onClick={() => onVerAcciones(acc[0])}>{acc.length} {acc.length === 1 ? 'cambio' : 'cambios'}</button>
          : producto == null
            ? <button type="button" className="aa-chica-aplicar" onClick={() => setAbierta(c.id)}>Asignar</button>
            : null}
        linea={<>
          <span>{fmt(c.gasto)}</span><span className="aa-chica-flecha" aria-hidden>·</span><b>{`${fmtNum(c.resultados)} ${c.resultados === 1 ? uno : plural}`}</b>
          {c.costo != null && <em data-tono={c.tono ?? undefined}>{fmt(c.costo)}</em>}
        </>} />
    );
  };

  const columnas = [
    ...l.productos.map((p) => ({
      clave: p.id,
      cabecera: <><b>{p.nombre}</b>{p.costo != null ? ` · ${fmt(p.costo)} por ${uno}` : ''}</>,
      items: p.campanas.length ? p.campanas.map((c) => tarjeta(c, p.nombre)) : [<TarjetaVacia key="vacia">Todavía sin campañas</TarjetaVacia>],
    })),
    ...(l.sinProducto.length ? [{ clave: 'sin', cabecera: <b>Sin producto</b>, items: l.sinProducto.map((c) => tarjeta(c, null)) }] : []),
  ];

  return (
    <>
      <Ramas etiqueta="Tus campañas por producto" avatar={avatar} pildora={pildoraDeCampanas(todas.length, l.productos.length)} columnas={columnas}
        pie={<p>{mensajeDeCampanas(l.productos.filter((p) => p.campanas.length), l.sinProducto.length, kpi, (n) => fmt(n))}</p>} />

      {detalle && (
        <Modal titulo={detalle.c.nombre} encabezado={detalle.producto ?? 'Sin producto'} ancho={520} onCerrar={() => setAbierta(null)}>
          <div className="aa aa-hoja">
            <dl className="aa-mes aa-mes-hoja">
              <div><dt>Por día</dt><dd>{detalle.c.presupuestoDia != null ? fmtDinero(detalle.c.presupuestoDia, l.moneda) : 'En sus conjuntos'}</dd></div>
              <div><dt>Gastado este mes</dt><dd>{fmt(detalle.c.gasto)}</dd></div>
              <div><dt>{plural[0].toUpperCase() + plural.slice(1)}</dt><dd>{fmtNum(detalle.c.resultados)}</dd></div>
              <div><dt>Costo por {uno}</dt><dd data-tono={detalle.c.tono ?? undefined}>{fmt(detalle.c.costo)}</dd></div>
            </dl>
            <div className="aa-hoja-fila">
              <span>Producto</span>
              <ProductoCelda item={{ tipo: 'campana', id: detalle.c.id, nombre: detalle.c.nombre }} productos={productosCrm}
                asignada={asignadas.find((a) => a.tipo === 'campana' && a.id === detalle.c.id)}
                onAsignadas={(xs) => { setAsignadas(xs); void leer(); }} show={show} />
            </div>
            {accionesDe(detalle.c).map((d) => (
              <button key={d.id} type="button" className="aa-hoja-cambio" onClick={() => { setAbierta(null); onVerAcciones(d); }}>{d.titulo} →</button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
