'use client';

// =============================================================================
// Media Buyer — el árbol de la captura 04 de AdAmigo: ramas y tarjetas chicas (25/10/2026 noche)
// =============================================================================
// Martín eligió la 04 (docs/media-buyer/referencias/otras-apps/04-adamigo-aplicado-y-deshacer.png) y la primera versión copió
// OTRA pantalla de AdAmigo: «Una cantidad de botones y texto impresionante... no se parece en nada». La 04, de arriba abajo:
// una pastilla de MaKo, líneas finas que bajan a tarjetas CHICAS en fila y un mensaje de MaKo al pie, en una o dos líneas.
// Lo usan las tres pestañas, con el mismo dibujo:
//   · Hoy (`ArbolDeHoy`): las ramas son los productos del CRM y cada tarjeta es un cambio, con «Aplicar»;
//   · Campañas (Lienzo.tsx): las ramas son los productos y cada tarjeta, una campaña con sus números del mes;
//   · Biblioteca (Biblioteca.tsx): cada tarjeta, uno de los anuncios que más resultados trajeron.
// La tarjeta es exactamente la de la 04: arriba el nombre con una línea gris, a la derecha UNA marca o UN botón; una raya;
// un rótulo chico; la entidad; y una línea con los números. Toda la tarjeta abre su detalle (una hoja), donde vive el resto.
// Lo prueba tests/media-buyer-hoy.test.ts (un botón por tarjeta). Sin estado propio: lo dibujan la computadora y el teléfono.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import { LogoMeta } from '@/app/_components/ServicioVisual';
import { aplicablesEnLote, cambioCorto, columnasDeHoy, esVariacion, mensajeDeHoy, pildoraDeHoy, ramasDeHoy, rotuloDe } from './mb-modelo';

/** El hueco entre columnas, en % del ancho: así el centro de cada columna se calcula exacto para las ramas (sin medir). */
const HUECO = 2.4;

export type Columna = { clave: string; cabecera?: ReactNode; items: ReactNode[]; /** Sin tarjetas: en el teléfono no se dibuja (una columna vacía ocupa una pantalla entera). */ vacia?: boolean };

/** La pastilla, el abanico de ramas, las columnas de tarjetas y el mensaje al pie. */
export function Ramas({ etiqueta, avatar, pildora, columnas, pie }: {
  etiqueta: string;
  avatar: ReactNode;
  pildora: string;
  columnas: Columna[];
  pie?: ReactNode;
}) {
  // Tres columnas, como la 04 (con cuatro, el nombre ya no entra). Las ramas de más bajan de fila, sin su punto.
  const n = Math.max(1, Math.min(3, columnas.length));
  const ancho = (100 - (n - 1) * HUECO) / n;
  const centro = (i: number) => i * (ancho + HUECO) + ancho / 2;
  return (
    <section className="aa-arbol" aria-label={etiqueta} style={{ '--cols': n, '--hueco': `${HUECO}%` } as CSSProperties}>
      <div className="aa-pildora">{avatar}<span><b>MaKo</b>{` · ${pildora}`}</span></div>
      <svg className="aa-ramas" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <path key={i} d={`M50 0 C50 22 ${centro(i)} 16 ${centro(i)} 40`} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="aa-cols">
        {columnas.map((c, i) => (
          <div key={c.clave} className="aa-col" data-fila={i >= n ? '2' : undefined} data-vacia={c.vacia ? '1' : undefined}>
            {c.cabecera && <p className="aa-col-cab">{c.cabecera}</p>}
            {c.items}
          </div>
        ))}
      </div>
      {pie && <div className="aa-pie-mako">{avatar}{pie}</div>}
    </section>
  );
}

/**
 * Una tarjeta chica de la 04. Toda la tarjeta abre el detalle (un botón que la cubre, debajo de la marca): así hay un solo
 * botón a la vista y ningún botón adentro de otro.
 */
export function TarjetaRama({ id, estado, logo, titulo, sub, marca, rotulo, nombre, linea, abrir, onAbrir }: {
  id?: string;
  estado?: string;
  /** Lo de la izquierda: el logo de Meta, o la miniatura del anuncio. */
  logo?: ReactNode;
  titulo: string;
  sub?: string | null;
  /** UN botón («Aplicar») o una marca («Aplicado»). */
  marca?: ReactNode;
  rotulo: string;
  nombre?: string | null;
  linea: ReactNode;
  /** Lo que dice el lector de pantalla del botón que la cubre (sin `onAbrir`, la tarjeta no abre nada). */
  abrir?: string;
  onAbrir?: () => void;
}) {
  return (
    <article className="aa-chica" data-estado={estado} id={id}>
      {onAbrir && <button type="button" className="aa-chica-abrir" aria-label={abrir} onClick={onAbrir} />}
      <header className="aa-chica-cab">
        <span className="aa-chica-logo" aria-hidden>{logo ?? <LogoMeta size={18} />}</span>
        <span className="aa-chica-quien">
          <b>{titulo}</b>
          {sub && <small>{sub}</small>}
        </span>
        {marca}
      </header>
      <p className="aa-chica-rotulo">{rotulo}</p>
      {nombre && <p className="aa-chica-nombre">{nombre}</p>}
      <p className="aa-chica-cambio">{linea}</p>
    </article>
  );
}

/** Una columna sin nada (un producto sin campañas): una tarjeta punteada, una línea. */
export function TarjetaVacia({ children }: { children: ReactNode }) {
  return <p className="aa-chica aa-chica-vacia">{children}</p>;
}

// ── HOY: los cambios del día ─────────────────────────────────────────────────

export function ArbolDeHoy({ decisiones, productoDe, kpi, ocupada, encendido, avatar, aplicandoTodas = false, onAbrir, onAplicar, onAplicarTodas }: {
  decisiones: Decision[];
  productoDe: (d: Decision) => string | null;
  kpi: KpiMediaBuyer;
  /** La que se está aplicando (su botón dice «Aplicando…»). */
  ocupada: string | null;
  /** Con el Media Buyer apagado (o mirando otro negocio) no se aplica. */
  encendido: boolean;
  /** La estrella de MaKo, para la pastilla y el mensaje. */
  avatar: ReactNode;
  aplicandoTodas?: boolean;
  onAbrir: (d: Decision) => void;
  onAplicar: (d: Decision) => void;
  onAplicarTodas: () => void;
}) {
  const ramas = ramasDeHoy(decisiones, productoDe);
  const conProducto = ramas.filter((r) => r.producto != null).length;
  // «Aplicar los N» no lanza textos nuevos de la IA: ésos se leen en su hoja antes de salir (revisión de tren-l, falla 0).
  const abiertas = aplicablesEnLote(decisiones);
  return (
    <Ramas etiqueta="Los cambios de hoy" avatar={avatar} pildora={pildoraDeHoy(decisiones, conProducto)}
      columnas={columnasDeHoy(ramas).map((c, i) => ({
        clave: `${c.producto ?? 'sin'}-${i}`,
        items: c.decisiones.map((d) => (
          <TarjetaChica key={d.id} d={d} producto={c.producto} encendido={encendido}
            ocupada={ocupada === d.id || (aplicandoTodas && d.estado === 'abierta')} onAbrir={() => onAbrir(d)} onAplicar={() => onAplicar(d)} />
        )),
      }))}
      pie={<>
        <p>{mensajeDeHoy(decisiones, kpi)}</p>
        {abiertas.length > 1 && (
          <button type="button" className="aa-aplicar" disabled={!encendido || aplicandoTodas || ocupada != null} onClick={onAplicarTodas}>
            {aplicandoTodas ? 'Aplicando…' : `Aplicar los ${abiertas.length}`}
          </button>
        )}
      </>} />
  );
}

/** Un cambio de HOY: el producto con «Meta · la campaña», «Aplicar» (o la marca), el rótulo, la entidad y el cambio. */
export function TarjetaChica({ d, producto, ocupada, encendido, onAbrir, onAplicar }: {
  d: Decision;
  /** El producto del CRM es el título (la cuenta, en la 04); sin producto, la campaña. */
  producto: string | null;
  ocupada: boolean;
  encendido: boolean;
  onAbrir: () => void;
  onAplicar: () => void;
}) {
  const c = cambioCorto(d);
  const rotulo = rotuloDe(d);
  const campana = d.nivel === 'campaign' ? null : d.campanaNombre;
  return (
    <TarjetaRama id={`accion-${d.id}`} estado={d.estado} titulo={producto ?? campana ?? d.entidadNombre}
      sub={`Meta${producto && campana ? ` · ${campana}` : ''}`} rotulo={rotulo} nombre={d.entidadNombre}
      abrir={`${rotulo}: ${d.entidadNombre}. Ver el detalle`} onAbrir={onAbrir}
      marca={d.estado === 'aplicada'
        ? <span className="aa-chica-marca" data-tono="bien">✓ Aplicado</span>
        : d.estado === 'abierta' && esVariacion(d)
          // Los textos de la IA no salen sin que alguien los lea: el botón abre la hoja, donde se eligen y se lanzan.
          ? <button type="button" className="aa-chica-aplicar" data-tono="sec" onClick={onAbrir}>Ver textos</button>
          : d.estado === 'abierta'
          ? <button type="button" className="aa-chica-aplicar" disabled={ocupada || !encendido} onClick={onAplicar}>{ocupada ? 'Aplicando…' : 'Aplicar'}</button>
          : <span className="aa-chica-marca" data-tono="cuidado">Frenado</span>}
      linea={<>
        {c.antes && <><span>{c.antes}</span><span className="aa-chica-flecha" aria-hidden>→</span></>}
        <b>{c.despues}</b>
        {c.pct && <em data-sube={c.sube ? '1' : '0'}>{c.pct}</em>}
      </>} />
  );
}
