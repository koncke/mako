'use client';

// =============================================================================
// Media Buyer — HOY como la captura 04 de AdAmigo: un árbol de tarjetas chicas (25/10/2026 noche)
// =============================================================================
// Martín eligió la 04 (docs/media-buyer/referencias/otras-apps/04-adamigo-aplicado-y-deshacer.png) y la primera versión copió
// OTRA pantalla de AdAmigo: «Una cantidad de botones y texto impresionante... no se parece en nada». La 04, de arriba abajo:
// una pastilla de MaKo («MaKo · 3 cambios para hoy en 3 productos»), líneas finas que bajan a tarjetas CHICAS en fila (las
// ramas son los productos del CRM) y un mensaje de MaKo al pie, en una o dos líneas, con «Aplicar los N».
// La tarjeta es exactamente la de la 04: el producto con «Meta · la campaña», «Aplicar» o «Aplicado», un rótulo chico, la
// entidad y el cambio con sus números. NADA más: el porqué, los números y el resto de los botones viven en el detalle
// que se abre al tocarla (la hoja de MediaBuyer.tsx). Lo prueba tests/media-buyer-hoy.test.ts (un botón por tarjeta).
// Sin estado propio y sin el chat adentro: lo dibujan la computadora y el teléfono (app/m/ads/MediaBuyerM.tsx).
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import { LogoMeta } from '@/app/_components/ServicioVisual';
import { cambioCorto, columnasDeHoy, mensajeDeHoy, pildoraDeHoy, ramasDeHoy, rotuloDe } from './mb-modelo';

/** El hueco entre columnas, en % del ancho: así el centro de cada columna se calcula exacto para las ramas (sin medir). */
const HUECO = 2.4;

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
  const cols = columnasDeHoy(ramas);
  const n = Math.min(3, cols.length);
  const ancho = (100 - (n - 1) * HUECO) / n;
  const centro = (i: number) => i * (ancho + HUECO) + ancho / 2;
  const abiertas = decisiones.filter((d) => d.estado === 'abierta');
  return (
    <section className="aa-arbol" aria-label="Los cambios de hoy" style={{ '--cols': n, '--hueco': `${HUECO}%` } as CSSProperties}>
      <div className="aa-pildora">{avatar}<span><b>MaKo</b>{` · ${pildoraDeHoy(decisiones, conProducto)}`}</span></div>
      <svg className="aa-ramas" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <path key={i} d={`M50 0 C50 22 ${centro(i)} 16 ${centro(i)} 40`} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="aa-cols">
        {cols.map((c, i) => (
          <div key={i} className="aa-col">
            {c.decisiones.map((d) => (
              <TarjetaChica key={d.id} d={d} producto={c.producto}
                ocupada={ocupada === d.id || (aplicandoTodas && d.estado === 'abierta')} encendido={encendido}
                onAbrir={() => onAbrir(d)} onAplicar={() => onAplicar(d)} />
            ))}
          </div>
        ))}
      </div>
      <div className="aa-pie-mako">
        {avatar}
        <p>{mensajeDeHoy(decisiones, kpi)}</p>
        {abiertas.length > 1 && (
          <button type="button" className="aa-aplicar" disabled={!encendido || aplicandoTodas || ocupada != null} onClick={onAplicarTodas}>
            {aplicandoTodas ? 'Aplicando…' : `Aplicar los ${abiertas.length}`}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Una tarjeta chica de la 04. Toda la tarjeta abre el detalle (un botón que la cubre, debajo de «Aplicar»): así hay un solo
 * botón a la vista y ningún botón adentro de otro.
 */
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
  const titulo = producto ?? campana ?? d.entidadNombre;
  const sub = producto ? campana : null;
  return (
    <article className="aa-chica" data-estado={d.estado} id={`accion-${d.id}`}>
      <button type="button" className="aa-chica-abrir" aria-label={`${rotulo}: ${d.entidadNombre}. Ver el detalle`} onClick={onAbrir} />
      <header className="aa-chica-cab">
        <span className="aa-chica-logo" aria-hidden><LogoMeta size={18} /></span>
        <span className="aa-chica-quien">
          <b>{titulo}</b>
          <small>{`Meta${sub ? ` · ${sub}` : ''}`}</small>
        </span>
        {d.estado === 'aplicada'
          ? <span className="aa-chica-marca" data-tono="bien">✓ Aplicado</span>
          : d.estado === 'abierta'
            ? <button type="button" className="aa-chica-aplicar" disabled={ocupada || !encendido} onClick={onAplicar}>{ocupada ? 'Aplicando…' : 'Aplicar'}</button>
            : <span className="aa-chica-marca" data-tono="cuidado">Frenado</span>}
      </header>
      <p className="aa-chica-rotulo">{rotulo}</p>
      <p className="aa-chica-nombre">{d.entidadNombre}</p>
      <p className="aa-chica-cambio">
        {c.antes && <><span>{c.antes}</span><span className="aa-chica-flecha" aria-hidden>→</span></>}
        <b>{c.despues}</b>
        {c.pct && <em data-sube={c.sube ? '1' : '0'}>{c.pct}</em>}
      </p>
    </article>
  );
}
