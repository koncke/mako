'use client';

// =============================================================================
// SaldoMaKo — acceso rápido al Saldo de IA (vive en Integraciones)
// =============================================================================
// El detalle completo (por proveedor, historial, cargar saldo) NO va acá: vive
// en Integraciones › Saldo de IA. Esto es solo el restante a la vista con un
// link a esa sección.
//
// Vive dentro del desplegable del PERFIL, no en la barra: el consumo de IA es
// «visible, nunca protagonista» — al lado de las tabs competía con ellas todo el
// tiempo por algo que se mira una vez por semana. Por eso el tema por defecto es
// el CLARO (el del menú); `tema="oscuro"` queda para un fondo tipo sidebar.
// =============================================================================

import Link from '@/app/_ui/Link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from './MakoBrand';

const MONO = "'Geist Mono', monospace";
const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);

export function SaldoMaKo({ tema = 'claro' }: { tema?: 'claro' | 'oscuro' }) {
  const [restante, setRestante] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    // No pollear en pestañas de fondo (el chip solo importa si lo estás viendo).
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
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

  const oscuro = tema === 'oscuro';
  const tenue = oscuro ? 'var(--sidebar-text)' : 'var(--faint)';
  const fuerte = oscuro ? 'var(--on-sidebar)' : 'var(--ink)';

  const low = restante !== null && restante <= 5;
  const chipVal = restante !== null ? usd(restante) : cargado ? 'cargar' : '';
  const chipColor = restante === null ? tenue : low ? 'var(--bad)' : fuerte;

  const box: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
    padding: oscuro ? '9px 11px' : '10px 15px',
    borderRadius: oscuro ? 'var(--r-md)' : 0,
    border: oscuro ? '1px solid var(--sidebar-2)' : 'none',
    background: 'transparent', textDecoration: 'none', cursor: 'pointer',
  };

  return (
    <Link href="/integraciones#saldo-ia" title="Ver el saldo y el uso de la IA en Integraciones" style={box}>
      <MakoStar size={oscuro ? 13 : 15} color="var(--mako)" />
      <span style={{ flex: 1, textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: tenue }}>Saldo de IA</span>
      {chipVal && <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: chipColor }}>{chipVal}</span>}
      <span aria-hidden style={{ fontSize: 12, color: tenue, lineHeight: 1 }}>›</span>
    </Link>
  );
}
