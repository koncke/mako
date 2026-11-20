'use client';
// =============================================================================
// «Tu pago no entró»: el aviso de la esquina cuando la renovación del plan de MaKo no se cobró (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien no paga... le tiene que quedar una deuda pendiente». Mientras la pasarela
// reintenta (la MORA, lib/plan-acceso-reglas.ts) se sigue entrando, y esto lo dice en todas las pantallas: cuánto
// quedó pendiente, cuándo se pausa la cuenta, y lleva a pagar. No se cierra: se apaga solo cuando el pago entra.
// Lo ve sólo el admin del negocio (el que paga): /api/plan/pagar contesta null a cualquier otro.
// Pide el dato UNA vez por carga y al volver a la pestaña, como el aviso del Pixel (el layout no se desmonta al navegar).
// LA PRUEBA (19/11/2026): el negocio cargado a mano al que Martín le apagó «Habilitado sin cobro» tiene 7 días de prueba (lib/cuenta-sin-cobro.ts). Mientras
// dura y no tiene su plan, la esquina dice hasta cuándo y lleva a cargar la tarjeta: el primer cobro es el día que termina (con Mercado Pago).
// =============================================================================
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { esVistaSinChrome } from './PublicRouteGate';
import { useVistaMovil } from './VistaMovil';
import { formatoMonto } from '@/lib/pasarela-moneda';

const SANS = "'Geist', sans-serif";
type Mora = { monto: number | null; moneda: string | null; pausaEl: string };
type Prueba = { hasta: string };

export function AvisoMoraPlan() {
  const pathname = usePathname();
  const movil = useVistaMovil();
  const sinChrome = movil || esVistaSinChrome(pathname) || (pathname ?? '').startsWith('/login') || (pathname ?? '').startsWith('/cuenta-pausada');
  const [mora, setMora] = useState<Mora | null>(null);
  const [prueba, setPrueba] = useState<Prueba | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (sinChrome) return;
    let vivo = true;
    const cargar = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/plan/pagar').then((r) => r.json()).then((j) => { if (vivo) { setMora(j?.mora ?? null); setPrueba(j?.prueba ?? null); } }).catch(() => {});
    };
    cargar();
    document.addEventListener('visibilitychange', cargar);
    return () => { vivo = false; document.removeEventListener('visibilitychange', cargar); };
  }, [sinChrome]);

  if (sinChrome) return null;
  if (!mora && prueba) return <AvisoPrueba prueba={prueba} />;
  if (!mora) return null;
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

/** «Prueba hasta el DD/MM · Elegir mi plan»: la tarjeta ahora y el primer cobro el día que termina. */
function AvisoPrueba({ prueba }: { prueba: Prueba }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dia = `${prueba.hasta.slice(8, 10)}/${prueba.hasta.slice(5, 7)}`;
  const porque = `Tu prueba gratis de MaKo termina el ${dia}. Para seguir, elige tu plan: cargas tu tarjeta ahora y el primer cobro es el ${dia}.`;
  async function elegir() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/plan/pagar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'prueba' }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (j.url) { window.location.href = j.url; return; }
      setError(j.error ?? 'No pudimos abrir el pago. Prueba otra vez en un minuto.');
    } catch { setError('No pudimos abrir el pago. Prueba otra vez en un minuto.'); }
    setEnviando(false);
  }
  return (
    <button type="button" onClick={elegir} title={error ?? porque} aria-label={error ?? porque} disabled={enviando}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
        boxShadow: '0 14px 40px rgba(18,21,27,.22)', fontFamily: SANS, pointerEvents: 'auto',
      }}>
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--warn-bg)', color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>!</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{enviando ? 'Abriendo el pago…' : error ? error : `Prueba hasta el ${dia} · ELEGIR MI PLAN`}</span>
    </button>
  );
}
