'use client';

// =============================================================================
// Media Buyer — Biblioteca: los anuncios que más venden, con el árbol de la 04 (25/10/2026 noche)
// =============================================================================
// Con el dibujo de la captura 04 (Arbol.tsx), como Hoy y Campañas: la pastilla de MaKo y una tarjeta chica por cada anuncio
// que más resultados trajo al CRM este mes (de ahí salen las variaciones que vale la pena pedir), con UN botón,
// «Variaciones», que se las pide a MaKo. Al pie, una línea con dónde se HACE cada creativo (memoria «cada-cosa-donde-vive»:
// Ads Writer, Video Generator, AI Avatar; acá no se duplica ninguno) y «Subir creativos».
// Lo nuevo para revisar (las variaciones que propuso el Diseñador) ya está en Hoy, como un cambio más; lo lanzado, en
// Actividad: acá no se repite. Sin anuncios con resultados, la pantalla de la captura 2 con cuatro atajos.
// =============================================================================

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { AnuncioDestacado } from '@/lib/media-buyer/productos';
import { fmtDinero, fmtNum } from '@/lib/format';
import { Criatura } from '@/app/_components/Criatura';
import { Ramas, TarjetaRama } from './Arbol';

const RES: Record<KpiMediaBuyer, [string, string]> = { lead: ['leads', 'lead'], agenda: ['agendas', 'agenda'], venta: ['ventas', 'venta'] };

export function Biblioteca({ kpi, mejores, avatar, onSubir, onPedir }: {
  kpi: KpiMediaBuyer;
  mejores: AnuncioDestacado[];
  /** La estrella de MaKo, para la pastilla y el mensaje. */
  avatar: ReactNode;
  onSubir: () => void;
  /** Le pide algo a MaKo (el chat de la tab). */
  onPedir: (texto: string) => void;
}) {
  const [plural, uno] = RES[kpi];
  if (!mejores.length) {
    return (
      <section className="aa-nuevo" aria-label="Biblioteca">
        <Criatura nombre="MaKo" size={44} estrella />
        <h1>Todavía no hay anuncios con resultados</h1>
        <p>{`Cuando uno traiga ${plural} a tu CRM, aparece aquí.`}</p>
        <div className="aa-sugs">
          <Link href="/ads-writer" className="aa-sug">Escribir guiones</Link>
          <Link href="/video-generator" className="aa-sug">Filmar un video</Link>
          <Link href="/ai-avatar" className="aa-sug">Un avatar que habla</Link>
          <button type="button" className="aa-sug" onClick={onSubir}>Subir creativos</button>
        </div>
      </section>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  const miniatura = (a: AnuncioDestacado) => (a.miniatura ? <img src={a.miniatura} alt="" loading="lazy" /> : undefined);
  const variaciones = (a: AnuncioDestacado) => onPedir(`Media Buyer: arma variaciones de texto y de gancho del anuncio «${a.nombre}» (${a.adId}), que trajo ${a.resultados} ${plural} este mes.`);
  // Como en Hoy con un solo producto: cada anuncio es su rama, en tres columnas.
  const n = Math.min(3, mejores.length);
  const columnas = Array.from({ length: n }, (_, i) => ({
    clave: String(i),
    items: mejores.filter((_, j) => j % n === i).map((a) => (
      <TarjetaRama key={a.adId} titulo={a.nombre} sub={a.campana ? `Meta · ${a.campana}` : 'Meta'} rotulo="Este mes" logo={miniatura(a)}
        marca={<button type="button" className="aa-chica-aplicar" data-tono="sec" onClick={() => variaciones(a)}>Variaciones</button>}
        linea={<>
          <b>{`${fmtNum(a.resultados)} ${a.resultados === 1 ? uno : plural}`}</b>
          <span className="aa-chica-flecha" aria-hidden>·</span><span>{`${fmtDinero(a.gasto)} gastados`}</span>
          {a.costo != null && <em>{`${fmtDinero(a.costo)} c/u`}</em>}
        </>} />
    )),
  }));
  return (
    <Ramas etiqueta="Tus mejores anuncios" avatar={avatar} pildora={`tus ${mejores.length} anuncios que más ${plural} trajeron`} columnas={columnas}
      pie={<>
        <p>Pídeme variaciones de cualquiera, o crea más en <Link href="/ads-writer" className="aa-link">Ads Writer</Link>, <Link href="/video-generator" className="aa-link">Video Generator</Link> o <Link href="/ai-avatar" className="aa-link">AI Avatar</Link>.</p>
        <button type="button" className="aa-aplicar" onClick={onSubir}>Subir creativos</button>
      </>} />
  );
}
