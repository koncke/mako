'use client';

// =============================================================================
// VistaPdf — el PDF de la oferta, página por página, ANTES de descargarlo
// =============================================================================
// Tarjeta #887 (revisión con Código Inmobiliario, 16/10/2026, 01:49:37). Martín: «lo que le recomiendo siempre… es que
// te muestre la vista de PDF, mejor antes que eso» (que la oferta nueva en pantalla). Es la primera pestaña de la
// ventana de la oferta, y la ventana se abre sola en ella cuando MaKo termina de armarla.
//
// Las páginas son las MISMAS del PDF que se descarga (GET /api/offer/pdf?…&vista=paginas → lib/pdf-escritor.ts,
// `paginasSvg`), dibujadas como imágenes: un `<iframe>` con el PDF no se ve en Android ni entero en un iPhone, y un
// visor de PDF en el navegador es una librería de más de un mega. Como `<img>`, el SVG no puede correr nada.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Banner, Spinner } from '@/app/_ui';
import { mensajeDeError, paginasPdf } from './offer-api';

type Estado = { paginas: string[] | null; error: string | null };

/** La imagen de una página: el SVG como `data:` (así no corre nada y no hay otra ruta que pedir). */
export const srcDePagina = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** `tipo='lo-que-vendes'`: el PDF del onboarding (las piezas), que se mira en el chat sin salir de la pestaña (18/10/2026). */
export function VistaPdf({ sesionId, version = null, tipo }: { sesionId: number; version?: number | null; tipo?: 'lo-que-vendes' }) {
  const [estado, setEstado] = useState<Estado>({ paginas: null, error: null });
  const [intento, setIntento] = useState(0);
  const cargar = useCallback(() => { setEstado({ paginas: null, error: null }); setIntento((n) => n + 1); }, []);

  useEffect(() => {
    let vivo = true;
    paginasPdf(sesionId, version, tipo)
      .then((paginas) => { if (vivo) setEstado({ paginas, error: paginas.length ? null : 'El PDF salió vacío.' }); })
      .catch((e) => { if (vivo) setEstado({ paginas: null, error: mensajeDeError(e) }); });
    return () => { vivo = false; };
  }, [sesionId, version, tipo, intento]);

  if (estado.error) {
    return <Banner tono="bad" alcance="local" accion={{ label: 'Volver a cargar el PDF', onClick: cargar }}>{estado.error}</Banner>;
  }
  if (!estado.paginas) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 240, color: 'var(--dim)', fontSize: 'var(--fs-md)' }}>
        <Spinner size={18} /> Cargando el PDF
      </div>
    );
  }
  const n = estado.paginas.length;
  return (
    <div className="of-pdf" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 'clamp(8px, 2vw, 18px)', borderRadius: 16, background: 'var(--surface-2)' }}>
      {estado.paginas.map((svg, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- un SVG en data: no pasa por el optimizador de imágenes
        <img key={i} src={srcDePagina(svg)} alt={`Página ${i + 1} de ${n} de ${tipo ? 'lo que vendes' : 'tu oferta'}`} loading={i === 0 ? 'eager' : 'lazy'}
          width={595} height={842}
          style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '595.28 / 841.89', background: '#FFFFFF', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,.12), 0 6px 18px rgba(0,0,0,.06)' }} />
      ))}
    </div>
  );
}
