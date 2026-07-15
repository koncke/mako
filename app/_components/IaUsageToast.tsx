'use client';

// =============================================================================
// IaUsageToast — cartel efímero "MaKo usó IA" ante CADA operación que gasta tokens
// =============================================================================
// Corre a nivel app (montado en el layout). Cada pocos segundos consulta el
// resumen de uso de IA; cuando aparece una operación MÁS NUEVA que la última que
// vimos, muestra un toast por 5s con el proceso + costo. Al clickearlo lleva a
// Integraciones › Costo de MaKo con el historial de operaciones abierto.
//
// La baseline (última op vista) se persiste en localStorage para NO re-disparar
// por operaciones viejas en cada recarga. El endpoint es solo-dueño/admin: para
// un cliente devuelve 403 y el toast simplemente nunca aparece.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MakoStar } from './MakoBrand';
import { procesoLegible, proveedorLegible, modeloLegible } from '@/lib/ia-labels';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const LS_KEY = 'mako_ia_last_seen_at';
const POLL_MS = 12000;

const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);

type Op = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type Toast = { op: Op } | null;

export function IaUsageToast() {
  const router = useRouter();
  const [toast, setToast] = useState<Toast>(null);
  const lastSeen = useRef<string | null>(null);
  const inited = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((op: Op) => {
    setToast({ op });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const poll = useCallback(async () => {
    let data: { ok?: boolean; historial?: Op[] } | null = null;
    try { data = await (await fetch('/api/anthropic-usage')).json(); } catch { return; }
    if (!data?.ok || !Array.isArray(data.historial) || data.historial.length === 0) return;
    const latest = data.historial[0];
    // Primer poll de la sesión: fijamos baseline sin disparar (evita el toast de
    // una op vieja al abrir la app). Preferimos lo guardado en localStorage.
    if (!inited.current) {
      inited.current = true;
      const stored = (() => { try { return localStorage.getItem(LS_KEY); } catch { return null; } })();
      lastSeen.current = stored ?? latest.at;
      // Si mientras estábamos fuera hubo ops nuevas respecto de lo guardado, avisamos una vez.
      if (stored && latest.at > stored) { lastSeen.current = latest.at; try { localStorage.setItem(LS_KEY, latest.at); } catch { /* */ } show(latest); }
      else { try { localStorage.setItem(LS_KEY, latest.at); } catch { /* */ } }
      return;
    }
    if (lastSeen.current && latest.at > lastSeen.current) {
      lastSeen.current = latest.at;
      try { localStorage.setItem(LS_KEY, latest.at); } catch { /* */ }
      show(latest);
    }
  }, [show]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [poll]);

  if (!toast) return null;
  const { op } = toast;
  const gratis = op.costUsd === 0;

  const go = () => {
    setToast(null);
    router.push('/integraciones?ops=1#saldo-ia');
  };

  return (
    <button
      type="button"
      onClick={go}
      aria-label="Ver el detalle del uso de IA"
      style={{
        position: 'fixed', right: 24, bottom: 24, zIndex: 400, maxWidth: 360,
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        background: '#14161B', color: '#F3F5F8', padding: '13px 15px', borderRadius: 13,
        border: '1px solid #2A2F38', boxShadow: '0 14px 36px rgba(18,21,27,.42)',
        fontFamily: SANS, cursor: 'pointer', animation: 'mkPop .2s cubic-bezier(.2,.7,.3,1)',
      }}
    >
      <span style={{ flex: 'none', display: 'flex' }}><MakoStar size={17} color="var(--accent-soft)" /></span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>
          MaKo usó IA · {procesoLegible(op.feature)}
        </span>
        <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: '#9AA1AD', marginTop: 3 }}>
          {proveedorLegible(op.provider)} · {modeloLegible(op.model)}{op.tokens > 0 ? ` · ${op.tokens >= 1000 ? `${(op.tokens / 1000).toFixed(1)}k` : op.tokens} tok` : ''}
        </span>
      </span>
      <span style={{ flex: 'none', fontFamily: MONO, fontSize: 14, fontWeight: 700, color: gratis ? '#7FCF9E' : '#F3F5F8' }}>
        {gratis ? 'gratis' : usd(op.costUsd)}
      </span>
      <span aria-hidden style={{ flex: 'none', fontSize: 13, color: '#9AA1AD' }}>›</span>
    </button>
  );
}
