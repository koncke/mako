'use client';

// =============================================================================
// Media Buyer — Biblioteca: los creativos (25/10/2026)
// =============================================================================
// La «Library» de AdAmigo (adamigo-3) y su «New ads ready for your review» (adamigo-1), con la fábrica de MaKo: lo nuevo
// que propuso el Diseñador de creativos para revisar, los anuncios que más resultados trajeron al CRM este mes (de ahí
// salen las variaciones que vale la pena pedir), lo que ya lanzó, y los atajos a donde se HACE cada creativo. Cada cosa vive
// donde vive (memoria «cada-cosa-donde-vive»): la matriz de avatares y razones en Ads Writer, el video en Video Generator
// y AI Avatar, la imagen en Image Editor, la landing en Web Generator. Acá no se duplica ninguna; se llega a cada una.
// Una sección sin nada no se dibuja (nunca una caja vacía); los atajos están siempre.
// =============================================================================

import Link from 'next/link';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { AnuncioDestacado } from '@/lib/media-buyer/productos';
import { fmtDinero, fmtNum } from '@/lib/format';
import { Ic } from './Autopilot';
import { hace } from './mb-modelo';

const RESULTADO: Record<KpiMediaBuyer, string> = { lead: 'leads', agenda: 'agendas', venta: 'ventas' };
const UNO: Record<KpiMediaBuyer, string> = { lead: 'lead', agenda: 'agenda', venta: 'venta' };

const CREAR: Array<{ href: string; titulo: string; que: string; ic: string }> = [
  { href: '/ads-writer', titulo: 'Ads Writer', que: 'Guiones con tu matriz de avatares y razones', ic: '✍️' },
  { href: '/video-generator', titulo: 'Video Generator', que: 'Filma los ganchos nuevos de tus ganadores', ic: '🎬' },
  { href: '/ai-avatar', titulo: 'AI Avatar', que: 'Un video con un avatar que habla por ti', ic: '🧑‍💼' },
  { href: '/image-editor', titulo: 'Image Editor', que: 'Imágenes para tus anuncios, desde plantillas', ic: '🖼️' },
  { href: '/web-generator', titulo: 'Web Generator', que: 'La landing a la que llegan tus anuncios', ic: '🌐' },
];

export function Biblioteca({ kpi, paraRevisar, lanzadas, mejores, onAbrir, onSubir, onPedir }: {
  kpi: KpiMediaBuyer;
  /** Las acciones de variaciones abiertas: lo nuevo para revisar. */
  paraRevisar: Decision[];
  /** Las variaciones y los creativos que ya se lanzaron (30 días). */
  lanzadas: Decision[];
  mejores: AnuncioDestacado[];
  onAbrir: (d: Decision) => void;
  onSubir: () => void;
  /** Le pide algo a MaKo (el chat de la tab). */
  onPedir: (texto: string) => void;
}) {
  const tiles = paraRevisar.flatMap((d) => (d.variaciones ?? []).filter((v) => v.elegida).map((v) => ({ d, v })));
  return (
    <div className="aa-bib">
      <header className="aa-bib-cab">
        <div>
          <h1>Biblioteca</h1>
          <p>Tus creativos: lo nuevo para revisar, lo que mejor vende y dónde hacer más.</p>
        </div>
        <button type="button" className="aa-aplicar" onClick={onSubir}>{Ic.chispa()}Subir creativos</button>
      </header>

      {tiles.length > 0 && (
        <section aria-label="Para revisar">
          <h2 className="aa-seccion">Para revisar</h2>
          <div className="aa-bib-grid">
            {tiles.map(({ d, v }) => (
              <button key={`${d.id}-${v.id}`} type="button" className="aa-bib-nuevo" onClick={() => onAbrir(d)}>
                <small>{d.tipo === 'variaciones_hook' ? 'Gancho nuevo' : 'Texto nuevo'} · de «{d.entidadNombre}»</small>
                <b>{v.gancho ?? v.textoPrincipal}</b>
                {v.gancho && <span>{v.textoPrincipal}</span>}
                <em>Revisar y lanzar →</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {mejores.length > 0 && (
        <section aria-label="Tus mejores anuncios">
          <h2 className="aa-seccion">Tus mejores anuncios este mes</h2>
          <div className="aa-bib-grid">
            {mejores.map((a) => (
              <article key={a.adId} className="aa-bib-ad">
                <div className="aa-bib-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.miniatura ? <img src={a.miniatura} alt="" loading="lazy" /> : <span aria-hidden>{a.nombre.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="aa-bib-ad-txt">
                  <b title={a.nombre}>{a.nombre}</b>
                  <span>{fmtNum(a.resultados)} {RESULTADO[kpi]} · {a.costo != null ? `${fmtDinero(a.costo)} por ${UNO[kpi]}` : '—'}</span>
                </div>
                <button type="button" className="aa-sec" onClick={() => onPedir(`Media Buyer: arma variaciones de texto y de gancho del anuncio «${a.nombre}» (${a.adId}), que trajo ${a.resultados} ${RESULTADO[kpi]} este mes.`)}>
                  {Ic.chispa()}Variaciones
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Crear con MaKo">
        <h2 className="aa-seccion">Crear con MaKo</h2>
        <div className="aa-bib-crear">
          {CREAR.map((c) => (
            <Link key={c.href} href={c.href} className="aa-bib-tool">
              <span className="aa-bib-tool-ic" aria-hidden>{c.ic}</span>
              <b>{c.titulo}</b>
              <span>{c.que}</span>
            </Link>
          ))}
        </div>
      </section>

      {lanzadas.length > 0 && (
        <section aria-label="Lanzados por MaKo">
          <h2 className="aa-seccion">Lanzados</h2>
          <ul className="aa-bib-lanz">
            {lanzadas.slice(0, 12).map((d) => (
              <li key={d.id}>
                <b>{d.titulo}</b>
                <span>{d.creados.length} {d.creados.length === 1 ? 'anuncio' : 'anuncios'} · {hace(d.aplicadaAt)}{d.estado === 'deshecha' ? ' · deshecho' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
