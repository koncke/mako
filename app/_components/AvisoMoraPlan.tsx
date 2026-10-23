'use client';
// =============================================================================
// «Tu pago no entró»: el aviso de la esquina cuando la renovación del plan de MaKo no se cobró (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien no paga... le tiene que quedar una deuda pendiente». Mientras la pasarela
// reintenta (la MORA, lib/plan-acceso-reglas.ts) se sigue entrando, y esto lo dice en todas las pantallas: cuánto
// quedó pendiente, cuándo se pausa la cuenta, y lleva a pagar. No se cierra: se apaga solo cuando el pago entra.
// Lo ve sólo el admin del negocio (el que paga): /api/plan/pagar contesta null a cualquier otro.
// Pide el dato UNA vez por carga y al volver a la pestaña, como el aviso del Pixel (el layout no se desmonta al navegar).
// =============================================================================
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { esVistaSinChrome } from './PublicRouteGate';
import { useVistaMovil } from './VistaMovil';
import { formatoMonto } from '@/lib/pasarela-moneda';

const SANS = "'Geist', sans-serif";
type Mora = { monto: number | null; moneda: string | null; pausaEl: string };

export function AvisoMoraPlan() {
  const pathname = usePathname();
  const movil = useVistaMovil();
  const sinChrome = movil || esVistaSinChrome(pathname) || (pathname ?? '').startsWith('/login') || (pathname ?? '').startsWith('/cuenta-pausada');
  const [mora, setMora] = useState<Mora | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (sinChrome) return;
    let vivo = true;
    const cargar = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/plan/pagar').then((r) => r.json()).then((j) => { if (vivo) setMora(j?.mora ?? null); }).catch(() => {});
    };
    cargar();
    document.addEventListener('visibilitychange', cargar);
    return () => { vivo = false; document.removeEventListener('visibilitychange', cargar); };
  }, [sinChrome]);

  if (sinChrome || !mora) return null;
  const cuanto = mora.monto != null && mora.moneda ? `${formatoMonto(mora.monto, mora.moneda)} ` : '';
  const pausa = `${mora.pausaEl.slice(8, 10)}/${mora.pausaEl.slice(5, 7)}`;
  const porque = `La renovación de tu plan no se pudo cobrar. Lo reintentamos solos; si no entra, el ${pausa} se pausa tu cuenta (tus datos quedan guardados).`;

  async function pagar() {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await fetch('/api/plan/pagar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'deuda' }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string };
      if (j.url) { window.location.href = j.url; return; }
    } catch { /* queda el aviso */ }
    setEnviando(false);
  }

  return (
    <button type="button" onClick={pagar} title={porque} aria-label={porque} disabled={enviando}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
        boxShadow: '0 14px 40px rgba(18,21,27,.22)', fontFamily: SANS, pointerEvents: 'auto',
      }}>
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--warn-bg)', color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>!</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{enviando ? 'Abriendo el pago…' : `Pago pendiente ${cuanto}· Pagar`}</span>
    </button>
  );
}
