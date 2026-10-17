'use client';

// =============================================================================
// ReproductorAnuncio — el video de un anuncio, en vertical, sin salir de la hoja (#860)
// =============================================================================
// Martín (revisión del 16/10/2026, 1:14:31): «debería poder reproducirse ahí mismo, sin necesidad de tener que redirigir a
// otra pestaña». Lo abre el ▶ de la miniatura de una tarjeta de anuncio (./Tarjetas.tsx). El src sale de
// /api/anuncios/video (el plugin de video de facebook.com: lib/anuncio-video.ts dice por qué ése). Si el anuncio no tiene
// video o Meta no lo da, se dice, con «Verlo en Facebook» si hay link.

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Spinner } from '@/app/_ui';

const TOPE_MS = 30_000;

type Estado = { cargando: boolean; src: string | null; permalink: string | null; error: string | null };

export function ReproductorAnuncio({ adId, nombre, onCerrar }: { adId: string; nombre: string; onCerrar: () => void }) {
  const [estado, setEstado] = useState<Estado>({ cargando: true, src: null, permalink: null, error: null });
  useEffect(() => {
    let vivo = true;
    fetch(`/api/anuncios/video?ad_id=${encodeURIComponent(adId)}`, { cache: 'no-store', signal: AbortSignal.timeout(TOPE_MS) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; reproductor?: string | null; permalink?: string | null; error?: string }) => {
        if (!vivo) return;
        setEstado({ cargando: false, src: j?.ok ? j.reproductor ?? null : null, permalink: j?.permalink ?? null, error: j?.ok ? null : j?.error ?? 'No pude leer el video' });
      })
      .catch(() => { if (vivo) setEstado({ cargando: false, src: null, permalink: null, error: 'No pude leer el video' }); });
    return () => { vivo = false; };
  }, [adId]);

  return (
    <Modal titulo={nombre} ancho={420} onCerrar={onCerrar}>
      {estado.cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', aspectRatio: '9 / 16', maxHeight: '70vh' }}><Spinner size={22} /></div>
      ) : estado.src ? (
        <iframe
          src={estado.src} title={`Video: ${nombre}`} allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen
          style={{ display: 'block', width: '100%', aspectRatio: '9 / 16', maxHeight: '70vh', border: 0, borderRadius: 12, background: '#000' }}
        />
      ) : (
        <p style={{ margin: 0, color: 'var(--dim)', lineHeight: 1.5 }}>
          {estado.error ?? 'Este anuncio no tiene video'}
          {estado.permalink && <> · <a href={estado.permalink} target="_blank" rel="noopener noreferrer">Verlo en Facebook</a></>}
        </p>
      )}
    </Modal>
  );
}
