'use client';

// =============================================================================
// LeadEditModal — carga la ficha completa on-demand y la muestra como modal
// =============================================================================
// Wrapper fino: trae getLeadFullAction y monta LeadSheet (preview con tabs).
// Para que abrir se sienta instantáneo: (1) cache en memoria por lead (reabrir
// no vuelve a esperar; se refresca en segundo plano), (2) skeleton con los datos
// que el caller ya tiene (seed) mientras llega el resto.

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { LeadSheet } from './LeadSheet';
import { getLeadFullAction, type LeadFullData } from './actions';
// El ancho del esqueleto es EL MISMO de la ficha (punto 14 del 12/10/2026: la ficha pasó de
// 760 a más ancha). Con un número propio acá, la caja abría a 760 y medio segundo después
// saltaba al ancho de la ficha — y el lead recién creado (punto 27) abre justo por este esqueleto.
import { ANCHO_FICHA_LEAD } from './lead-view/ficha-medidas';

const SANS = "'Geist', sans-serif";
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };

/** Datos mínimos que el caller puede pasar para pintar el skeleton al instante. */
export type LeadSeed = { nombre: string; empresa?: string | null };

// Cache en memoria (vive lo que la pestaña): reabrir una ficha es instantáneo y
// el fetch corre igual en segundo plano para refrescar.
const cache = new Map<number, LeadFullData>();

export function LeadEditModal({
  leadId,
  seed,
  focus,
  onClose,
}: {
  leadId: number;
  seed?: LeadSeed;
  /** Compat con los desgloses: sección pedida → tab del preview. */
  focus?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<LeadFullData | null>(() => cache.get(leadId) ?? null);
  const [notFound, setNotFound] = useState(false);
  // Reset al cambiar de lead: setState durante render guardado por comparación
  // (patrón React; no dispara el lint de setState-en-effect).
  const [prevLeadId, setPrevLeadId] = useState(leadId);
  if (prevLeadId !== leadId) {
    setPrevLeadId(leadId);
    setData(cache.get(leadId) ?? null);
    setNotFound(false);
  }

  useEffect(() => {
    let alive = true;
    getLeadFullAction(leadId)
      .then((d) => {
        if (!alive) return;
        if (!d) { cache.delete(leadId); setNotFound(true); return; }
        cache.set(leadId, d);
        setData(d);
      })
      .catch(() => { if (alive && !cache.get(leadId)) setNotFound(true); });
    return () => { alive = false; };
  }, [leadId]);

  if (notFound) {
    return (
      <div onClick={onClose} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', fontFamily: SANS, fontSize: 14, color: 'var(--dim)' }}>
          No se pudo cargar el lead. <button onClick={onClose} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
        </div>
      </div>
    );
  }

  if (!data) {
    // Skeleton instantáneo con lo que el caller ya sabe del lead.
    return (
      <div onClick={onClose} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: ANCHO_FICHA_LEAD, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px)', fontFamily: SANS }}>
          <div style={{ fontSize: 'clamp(20px,5vw,27px)', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{seed?.nombre ?? 'Cargando…'}</div>
          {seed?.empresa && <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{seed.empresa}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {[70, 120, 90].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)', animation: 'leadsheet-shimmer 1.2s infinite' }} />
              </div>
            ))}
          </div>
          <style>{'@keyframes leadsheet-shimmer { from { transform: translateX(-100%);} to { transform: translateX(100%);} }'}</style>
        </div>
      </div>
    );
  }

  // router.refresh al cerrar: sincroniza la vista de atrás con lo que haya
  // pasado en la ficha (borrado, ediciones desde la ruta).
  const close = () => { router.refresh(); onClose(); };

  // focus viejo de los desgloses → tab del preview.
  const initialTab = focus === 'plan-pagos' ? 'cobranza' : 'resumen';

  return <LeadSheet data={data} onClose={close} initialTab={initialTab} />;
}
