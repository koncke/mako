'use client';

// =============================================================================
// CampanasDelProducto — qué campañas y conjuntos de Meta entran a ESTE producto
// =============================================================================
// Vive adentro de la tarjeta de «Lead entrante» del pop-up del embudo, debajo de
// «¿cómo entra tu gente?». Pedido de Martín (05/10/2026): «la configuración de la
// primera etapa en todo funnel de "Leads entrantes", que se pueda tener un
// desplegable o algo para seleccionar las campañas que deberían caer allí».
//
// ⚠️ LA SECCIÓN SIEMPRE ESTÁ, Y NO ESPERA A META. La primera versión giraba un spinner
// en el lugar de la sección entera mientras le preguntaba a Meta, y Martín: «el loader
// debería aparecer dentro del desplegable en todo caso, no en toda la sección, la sección
// siempre debe estar presente». Acá se lee SÓLO lo asignado (un setting, sin Meta y sin
// leads), y la tabla —que sí necesita Meta y contar leads— es un modal aparte con su
// propio giro adentro (app/crm/CampanasModal.tsx).
//
// Y no es un desplegable: «es algo importante que requiere tener una barra de busqueda,
// filtros, ordenamientos». Por eso el botón abre la tabla.
// =============================================================================

import { useEffect, useState } from 'react';
import { SANS } from '@/app/_ui';
import { asignadasDe, type CampanaAsignada } from '@/lib/campana-config';
import { campanasAsignadasAction, quitarCampanaAction } from './campanas-actions';
import { CampanasModal } from './CampanasModal';

export function CampanasDelProducto({ funnelId, nombreProducto }: {
  /** El embudo de este pop-up. `null` = el del negocio. */
  funnelId: number | null;
  nombreProducto: string;
}) {
  const [asignadas, setAsignadas] = useState<CampanaAsignada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    campanasAsignadasAction().then((r) => {
      if (!vivo) return;
      if (r.ok) setAsignadas(r.asignadas); else setError(r.error);
    }).catch(() => { if (vivo) setError('No se pudo leer'); });
    return () => { vivo = false; };
  }, []);

  const mias = asignadas ? asignadasDe(asignadas, funnelId) : [];

  const quitar = async (id: string) => {
    setQuitando(id);
    setError(null);
    try {
      const r = await quitarCampanaAction(id);
      if (r.ok) setAsignadas(r.asignadas); else setError(r.error);
    } catch {
      setError('No se pudo quitar');
    }
    setQuitando(null);
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: mias.length ? 10 : 6 }}>
        <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
          Campañas de Meta
        </span>
        <button type="button" onClick={() => setAbierto(true)}
          style={{
            flex: 'none', padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border-strong)',
            background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          {mias.length ? 'Editar' : 'Elegir campañas'}
        </button>
      </div>

      {/* Mientras llega lo asignado no se dibuja nada acá: son milisegundos, y un «ninguna»
          provisorio le diría a un producto con campañas que no tiene. */}
      {asignadas && mias.length === 0 && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--faint)' }}>Ninguna asignada.</p>
      )}
      {mias.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mias.map((a) => (
            <span key={a.id} title={`${a.tipo === 'campana' ? 'Campaña' : 'Conjunto'} · ${a.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', minWidth: 0,
                padding: '4px 4px 4px 10px', borderRadius: 99, border: '1px solid var(--border)',
                background: 'var(--surface)', fontFamily: SANS, fontSize: 12.5, color: 'var(--ink)',
              }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {a.tipo === 'conjunto' ? '↳ ' : ''}{a.nombre}
              </span>
              <button type="button" className="mk-icon-btn" data-tone="dim" disabled={quitando === a.id}
                onClick={() => void quitar(a.id)}
                title={`Quitar «${a.nombre}»`} aria-label={`Quitar «${a.nombre}»`}
                style={{ width: 20, height: 20, flex: 'none', borderRadius: 99, cursor: 'pointer' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--bad)' }}>{error}</p>}

      {abierto && (
        <CampanasModal funnelId={funnelId} nombreProducto={nombreProducto} anidada
          onCerrar={() => setAbierto(false)} onCambio={setAsignadas} />
      )}
    </div>
  );
}
