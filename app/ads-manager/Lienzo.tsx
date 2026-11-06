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
// Lo pide al abrir la pestaña (`op: 'lienzo'`): lee la cuenta en vivo. Arriba va la caja del chat (como Hoy: la 04 de AdAmigo)
// y los números del mes son la primera línea del pie (27/10/2026: eran tres tarjetas entre la pestaña y el árbol).
// La hoja también lleva el HASTA de esa campaña (29/10/2026, lib/media-buyer/zona.ts): su fecha de fin, que gana a la de toda
// la cuenta (Ajustes). Se guarda al SALIR del campo (`op: 'hasta_campana'`), nunca en cada tecla: un año a medio escribir es
// «0002-11-05», y guardarlo pausaba la campaña (revisión adversarial del 29/10). Vacía, vuelve a la de la cuenta.
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
import { etiquetaCuentaMeta, linkCampanasEnMeta, type CuentaLeida } from '@/lib/meta-cuenta-leida';
import { COLUMNAS, TOPE_POR_COLUMNA, opcionesDeProducto, repartirCampanas, verMas, visiblesPorProducto, type Grupo } from '@/lib/media-buyer/campanas-grupos';

export type Lienzo = {
  productos: ProductoDeLienzo[]; sinProducto: CampanaDeLienzo[]; moneda: string | null;
  /** La cuenta que se leyó y la frase si no tiene campañas nuevas (lib/media-buyer/vista.ts → lienzoMediaBuyer). */
  cuenta?: CuentaLeida | null; aviso?: string | null;
};
const RES: Record<KpiMediaBuyer, [string, string]> = { lead: ['leads', 'lead'], agenda: ['agendas', 'agenda'], venta: ['ventas', 'venta'] };

export function LienzoCampanas({ kpi, objetivo = null, abiertas, productoInicial, avatar, onVerAcciones, show, inicial = null, mes = null, fechas }: {
  kpi: KpiMediaBuyer;
  /** Lo que busca el negocio por resultado, en US$ (Ajustes): con él se separa lo que funciona de lo caro. Sin él, se compara con el promedio de la cuenta. */
  objetivo?: number | null;
  /** Los números del mes en una línea (mb-modelo.ts → lineaDelMes): la primera del pie. */
  mes?: { texto: string; tono: 'bien' | 'mal' | null } | null;
  /** La fecha de fin de toda la cuenta y la de cada campaña (de la config). */
  fechas: { hasta: string | null; hastaCampanas: Record<string, string> };
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
  const [hastas, setHastas] = useState(fechas);
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [borradorFecha, setBorradorFecha] = useState<string | null>(null);
  const guardarFecha = async (campaignId: string, fecha: string) => {
    setGuardandoFecha(true);
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'hasta_campana', campaignId, fecha }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: 'No pude guardar la fecha.' }));
    setGuardandoFecha(false);
    if (r.ok) { setHastas({ hasta: r.hasta ?? null, hastaCampanas: r.hastaCampanas ?? {} }); show(fecha ? 'Fecha de fin guardada' : 'Sin fecha propia: vale la de toda la cuenta'); }
    else show(r.error ?? 'No pude guardar la fecha.', undefined, 'bad');
  };
  const [plural, uno] = RES[kpi];
  // El producto es un FILTRO (6/11/2026, Martín): las columnas son el estado de cada campaña (lib/media-buyer/campanas-grupos.ts).
  const [producto, setProducto] = useState<string>(productoInicial && productoInicial !== 'sin' ? productoInicial : productoInicial === 'sin' ? 'sin' : 'todos');
  const [abiertasCol, setAbiertasCol] = useState<Partial<Record<Grupo, boolean>>>({});

  const leer = useCallback(async () => {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'lienzo' }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: 'No pude leer la cuenta.' }));
    if (r.ok) { setL({ productos: r.productos, sinProducto: r.sinProducto, moneda: r.moneda ?? null, cuenta: r.cuenta ?? null, aviso: r.aviso ?? null }); setError(null); }
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
    // Retenida por Meta: no entrega hasta que la publiquen en el Administrador, y eso va antes que cualquier cambio de MaKo.
    const publicar = c.retenida ? linkCampanasEnMeta(l.cuenta?.id, c.id) : null;
    return (
      <TarjetaRama key={c.id} titulo={c.nombre} estado={c.retenida ? 'retenida' : undefined}
        sub={c.retenida ? 'Retenida en Meta: falta publicar' : `Meta · ${c.conjuntos} ${c.conjuntos === 1 ? 'conjunto' : 'conjuntos'}${c.prendida ? '' : ' · pausada'}`}
        rotulo="Este mes" abrir={`${c.nombre}: ver sus números`} onAbrir={() => setAbierta(c.id)}
        marca={publicar
          ? <a className="aa-chica-aplicar" href={publicar} target="_blank" rel="noreferrer">Publicar ↗</a>
          : acc.length
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

  const opciones = opcionesDeProducto(l.productos, l.sinProducto);
  const elegido = opciones.some((o) => o.id === producto) ? producto : 'todos';
  const reparto = repartirCampanas(visiblesPorProducto(l.productos, l.sinProducto, elegido), objetivo);
  const nombreDe = (c: CampanaDeLienzo) => (l.sinProducto.some((x) => x.id === c.id) ? null : l.productos.find((p) => p.campanas.some((x) => x.id === c.id))?.nombre ?? null);
  const columnas = COLUMNAS.map((col) => {
    const todasDe = reparto.grupos[col.id];
    const ver = abiertasCol[col.id] ? todasDe : todasDe.slice(0, TOPE_POR_COLUMNA);
    const mas = verMas(todasDe.length, ver.length);
    return {
      clave: col.id,
      vacia: todasDe.length === 0,
      cabecera: <><b>{col.titulo}</b>{` · ${todasDe.length}`}<small className="aa-col-ayuda">{col.id === 'funcionan' && reparto.referencia?.de === 'promedio' ? 'Mejor que el promedio de tu cuenta' : col.ayuda}</small></>,
      items: [
        ...(todasDe.length ? ver.map((c) => tarjeta(c, nombreDe(c))) : [<TarjetaVacia key="vacia">{col.vacia}</TarjetaVacia>]),
        ...(mas || (abiertasCol[col.id] && todasDe.length > TOPE_POR_COLUMNA)
          ? [<button key="mas" type="button" className="aa-mas" onClick={() => setAbiertasCol((x) => ({ ...x, [col.id]: !x[col.id] }))}>{mas ?? 'Ver menos'}</button>] : []),
      ],
    };
  });
  // MK-03 (27/10/2026): «no veo las campañas» era otra cuenta o un borrador. El pie dice QUÉ cuenta se leyó, como Meta la
  // muestra arriba a la izquierda, y lleva a su «Revisar y publicar»: un borrador no existe para la API (lib/meta-cuenta-leida.ts).
  const cuenta = etiquetaCuentaMeta(l.cuenta);
  const enMeta = linkCampanasEnMeta(l.cuenta?.id);

  return (
    <>
      {opciones.length > 0 && (
        <div className="aa-filtro">
          <label htmlFor="aa-producto">Producto</label>
          <select id="aa-producto" className="mk-input" value={elegido} onChange={(e) => setProducto(e.target.value)}>
            {opciones.map((o) => <option key={o.id} value={o.id}>{`${o.nombre} (${o.n})`}</option>)}
          </select>
        </div>
      )}
      <Ramas etiqueta="Tus campañas por estado" avatar={avatar} pildora={pildoraDeCampanas(todas.length, l.productos.length)}
        columnas={todas.length ? columnas : [{ clave: 'vacia', items: [<TarjetaVacia key="vacia">Sin campañas en esta cuenta</TarjetaVacia>] }]}
        pie={<div className="aa-pie-texto">
          {mes && <p className="aa-pie-mes" data-tono={mes.tono ?? undefined}>{mes.texto}</p>}
          <p>{todas.length ? mensajeDeCampanas(l.productos.filter((p) => p.campanas.length), l.sinProducto.length, kpi, (n) => fmt(n)) : l.aviso ?? 'Meta no devolvió campañas de esta cuenta.'}</p>
          {todas.length > 0 && l.aviso && <p>{l.aviso}</p>}
          {cuenta && (
            <p className="aa-pie-cuenta">{cuenta}{enMeta && <> · <a href={enMeta} target="_blank" rel="noreferrer" title="Un borrador de Meta no llega a MaKo hasta que lo publicas">Revisar y publicar en Meta ↗</a></>}</p>
          )}
        </div>} />

      {reparto.pausadas.length > 0 && (
        <details className="aa-pausadas">
          <summary>{reparto.pausadas.length === 1 ? '1 pausada' : `${reparto.pausadas.length} pausadas`}</summary>
          <ul>
            {reparto.pausadas.map((c) => (
              <li key={c.id}><button type="button" onClick={() => setAbierta(c.id)}><span>{c.nombre}</span><em>{fmt(c.gasto)}{c.resultados ? ` · ${fmtNum(c.resultados)} ${c.resultados === 1 ? uno : plural}` : ''}</em></button></li>
            ))}
          </ul>
        </details>
      )}

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
              <span>Hasta</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input type="date" className="mk-input" aria-label={`Fecha de fin de ${detalle.c.nombre}`} disabled={guardandoFecha}
                  value={borradorFecha ?? hastas.hastaCampanas[detalle.c.id] ?? ''} onChange={(e) => setBorradorFecha(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  onBlur={() => {
                    const f = borradorFecha;
                    setBorradorFecha(null);
                    if (f != null && f !== (hastas.hastaCampanas[detalle.c.id] ?? '')) void guardarFecha(detalle.c.id, f);
                  }} />
                {!hastas.hastaCampanas[detalle.c.id] && <small style={{ color: 'var(--dim)' }}>{hastas.hasta ? `La de la cuenta: ${hastas.hasta.slice(8, 10)}/${hastas.hasta.slice(5, 7)}` : 'Sin fecha de fin'}</small>}
              </span>
            </div>
            <div className="aa-hoja-fila">
              <span>Producto</span>
              <ProductoCelda item={{ tipo: 'campana', id: detalle.c.id, nombre: detalle.c.nombre }} productos={productosCrm}
                asignada={asignadas.find((a) => a.tipo === 'campana' && a.id === detalle.c.id)}
                onAsignadas={(xs) => { setAsignadas(xs); void leer(); }} show={show} />
            </div>
            {detalle.c.retenida && linkCampanasEnMeta(l.cuenta?.id, detalle.c.id) && (
              <a className="aa-hoja-cambio" href={linkCampanasEnMeta(l.cuenta?.id, detalle.c.id)!} target="_blank" rel="noreferrer">Retenida en Meta: publícala ahí ↗</a>
            )}
            {accionesDe(detalle.c).map((d) => (
              <button key={d.id} type="button" className="aa-hoja-cambio" onClick={() => { setAbierta(null); onVerAcciones(d); }}>{d.titulo} →</button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
