'use client';

// =============================================================================
// IaUsageToast — cartel efímero "MaKo usó IA" ante CADA operación que gasta tokens
// =============================================================================
// Corre a nivel app (montado en el layout). Cada pocos segundos consulta el
// resumen de uso de IA; por cada operación MÁS NUEVA que la última que vimos
// encola un toast de 5s con el proceso + costo. Si en una ventana hubo VARIAS
// ops, las muestra en secuencia (una tras otra); si fue una ráfaga grande las
// colapsa en un solo aviso "N operaciones". Al clickear cualquiera lleva a
// Integraciones › Costo de MaKo con el historial de operaciones abierto.
//
// La baseline (última op vista) vive en un ref y se persiste best-effort en
// localStorage para NO re-disparar por operaciones viejas en cada recarga. El
// endpoint es solo-dueño/admin: para un cliente devuelve 403 → cortamos el
// polling y el toast nunca aparece.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MakoStar } from './MakoBrand';
import { procesoLegible, proveedorLegible, modeloLegible } from '@/lib/ia-labels';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const LS_KEY = 'mako_ia_last_seen_at';
const POLL_MS = 12000;
const SHOW_MS = 5000;
const BURST_MAX = 4; // más ops nuevas que esto en una ventana → colapsar en un aviso

const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

type Op = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type ToastItem = { kind: 'op'; op: Op } | { kind: 'many'; count: number; sum: number };

const safeGet = (): string | null => { try { return localStorage.getItem(LS_KEY); } catch { return null; } };
const safeSet = (v: string): void => { try { localStorage.setItem(LS_KEY, v); } catch { /* private mode / bloqueado */ } };

export function IaUsageToast() {
  const router = useRouter();
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const lastSeen = useRef<string | null>(null);
  const inited = useRef(false);
  const disabled = useRef(false); // 403 (no autorizado) → dejar de pollear

  const current = queue[0] ?? null;

  // Convierte las ops nuevas (vienen DESC) en items a encolar, en orden
  // cronológico; si fueron muchas de golpe, las colapsa en un único aviso.
  const enqueue = useCallback((opsDesc: Op[]) => {
    if (opsDesc.length === 0) return;
    const chrono = [...opsDesc].reverse();
    const items: ToastItem[] = chrono.length > BURST_MAX
      ? [{ kind: 'many', count: chrono.length, sum: chrono.reduce((t, o) => t + o.costUsd, 0) }]
      : chrono.map((op) => ({ kind: 'op', op }));
    setQueue((q) => [...q, ...items]);
  }, []);

  const poll = useCallback(async () => {
    if (disabled.current) return;
    // No pollear en pestañas de fondo: el toast solo tiene sentido si estás
    // mirando. Al volver a la pestaña, el listener de abajo pollea al instante
    // (y la baseline de localStorage muestra lo que pasó mientras no estabas).
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    let res: Response;
    try { res = await fetch('/api/anthropic-usage'); } catch { return; } // offline → reintenta al próximo tick
    if (res.status === 403) { disabled.current = true; return; } // cliente sin permiso → basta
    let data: { ok?: boolean; historial?: Op[] } | null = null;
    try { data = await res.json(); } catch { return; }
    if (!data?.ok || !Array.isArray(data.historial) || data.historial.length === 0) return;
    const historial = data.historial; // DESC (más nueva primero)
    const latest = historial[0];

    // Primer poll de la sesión: fijamos baseline. Si en localStorage había una
    // marca más vieja, avisamos (una vez) las ops que pasaron mientras no estabas.
    if (!inited.current) {
      inited.current = true;
      const stored = safeGet();
      const base = stored ?? latest.at;
      if (stored) enqueue(historial.filter((o) => o.at > base));
      lastSeen.current = latest.at;
      safeSet(latest.at);
      return;
    }

    const fresh = historial.filter((o) => o.at > (lastSeen.current ?? ''));
    if (fresh.length > 0) {
      lastSeen.current = latest.at;
      safeSet(latest.at);
      enqueue(fresh);
    }
  }, [enqueue]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    // visibilitychange cubre el cambio de pestaña (focus solo cubre la ventana).
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [poll]);

  // Muestra el item de la cabeza SHOW_MS y lo descarta; el siguiente entra solo.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const go = () => { setQueue([]); router.push('/integraciones?ops=1#saldo-ia'); };

  const many = current.kind === 'many';
  const op = current.kind === 'op' ? current.op : null;
  const gratis = current.kind === 'op' ? op!.costUsd === 0 : current.sum === 0;
  const titulo = many ? `MaKo usó IA · ${current.count} operaciones` : `MaKo usó IA · ${procesoLegible(op!.feature)}`;
  const sub = many ? 'varias operaciones en segundos' : `${proveedorLegible(op!.provider)} · ${modeloLegible(op!.model)}${op!.tokens > 0 ? ` · ${fmtTok(op!.tokens)} tok` : ''}`;
  const costo = many ? current.sum : op!.costUsd;

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
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>{titulo}</span>
        <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: '#9AA1AD', marginTop: 3 }}>{sub}</span>
      </span>
      <span style={{ flex: 'none', fontFamily: MONO, fontSize: 14, fontWeight: 700, color: gratis ? '#7FCF9E' : '#F3F5F8' }}>
        {gratis ? 'gratis' : usd(costo)}
      </span>
      <span aria-hidden style={{ flex: 'none', fontSize: 13, color: '#9AA1AD' }}>›</span>
    </button>
  );
}
