'use client';

// =============================================================================
// SaldoMaKo — chip de la sidebar: link al Saldo de IA (vive en Integraciones)
// =============================================================================
// El detalle completo (por proveedor, historial, cargar saldo) NO va en la
// sidebar: vive en Integraciones › Saldo de IA. Acá solo un acceso rápido con el
// restante a la vista; al tocarlo redirige a esa sección.
// =============================================================================

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from './MakoBrand';

const MONO = "'Geist Mono', monospace";
const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);

export function SaldoMaKo() {
  const [restante, setRestante] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const j = await fetch('/api/anthropic-usage').then((r) => r.json());
      if (j?.ok) { setRestante(typeof j.restanteUsd === 'number' ? j.restanteUsd : null); setCargado(true); }
    } catch { /* offline → el chip igual linkea */ }
  }, []);

  useEffect(() => {
    cargar();
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    const t = setInterval(cargar, 60000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(t); };
  }, [cargar]);

  const low = restante !== null && restante <= 5;
  const chipVal = restante !== null ? usd(restante) : cargado ? 'cargar' : '';
  const chipColor = restante === null ? 'var(--sidebar-text)' : low ? 'var(--bad)' : 'var(--on-sidebar)';

  const box: CSSProperties = {
    marginBottom: 8, width: '100%', display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 11px', borderRadius: 11, border: '1px solid var(--sidebar-2)',
    background: 'transparent', textDecoration: 'none', cursor: 'pointer',
  };

  return (
    <Link href="/integraciones#saldo-ia" title="Ver el saldo y el uso de la IA en Integraciones" style={box}>
      <MakoStar size={13} color="var(--accent-soft)" />
      <span style={{ flex: 1, textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>Saldo de IA</span>
      {chipVal && <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: chipColor }}>{chipVal}</span>}
      <span aria-hidden style={{ fontSize: 12, color: 'var(--sidebar-text)', lineHeight: 1 }}>›</span>
    </Link>
  );
}
