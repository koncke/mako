'use client';
// =============================================================================
// «Actualiza el Pixel»: el aviso fijo de la esquina, en TODAS las pantallas
// =============================================================================
// Pedido de Martín (06/10/2026): «dentro de MaKo que siempre aparezca una
// notificación que no se pueda cerrar, pero que sea sutil, como lo tenemos en el
// CRM de "Revisar" que aparece abajo a la derecha».
//
// · NO SE PUEDE CERRAR, a propósito: no tiene ✕ ni «Después». Se apaga sola cuando
//   la página manda la versión nueva — o sea cuando de verdad no hay nada que hacer.
// · Es SUTIL: la misma anatomía que «A revisar» plegada, y nada más. El porqué no
//   va en la pantalla (regla de la casa): va en el `title` y en el modal al que lleva.
// · Lleva al lugar EXACTO donde se resuelve: el modal del Pixel.
//
// Pide el dato UNA vez por carga y al volver a la pestaña (por si la persona fue a
// pegar el código y volvió), sin sondeo: el layout no se desmonta al navegar, así
// que esto no es una consulta por pantalla. La decisión vive en el server y en
// lib/pixel-aviso.ts; acá sólo se dibuja lo que contestó.
// =============================================================================
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link, { useWs } from '@/app/_ui/Link';
import { esVistaSinChrome } from './PublicRouteGate';
import { RUTA_PIXEL, ROTULO_PIXEL_VIEJO } from '@/lib/pixel-aviso';

const SANS = "'Geist', sans-serif";

export function AvisoPixelViejo() {
  const pathname = usePathname();
  const ws = useWs();
  const sinChrome = esVistaSinChrome(pathname) || (pathname ?? '').startsWith('/login');
  const [estado, setEstado] = useState<{ viejo: boolean; instalada: number | null } | null>(null);

  useEffect(() => {
    if (sinChrome) return;
    let vivo = true;
    const cargar = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/integraciones/landing/version')
        .then((r) => r.json())
        .then((j) => {
          // Sin una respuesta válida no se afirma nada: queda lo que había.
          if (!vivo || !j?.ok) return;
          setEstado({ viejo: !!j.viejo, instalada: typeof j.instalada === 'number' ? j.instalada : null });
        })
        .catch(() => {});
    };
    cargar();
    document.addEventListener('visibilitychange', cargar);
    return () => { vivo = false; document.removeEventListener('visibilitychange', cargar); };
  }, [ws, sinChrome]);

  if (sinChrome || !estado?.viejo) return null;

  // ⚠️ El arreglo es la LÍNEA del Pixel (lib/pixel-cargador.ts, 09/10/2026), no repegar el
  // código: la línea sirve siempre la versión del día, así que este aviso no vuelve.
  const porque = estado.instalada != null
    ? `Tu página mide con la versión ${estado.instalada} del Pixel: pon la línea del Pixel en lugar del código viejo para grabar las visitas y ver el mapa de calor.`
    : 'Pon la línea del Pixel en lugar del código viejo para grabar las visitas y ver el mapa de calor.';

  return (
    <Link href={RUTA_PIXEL} title={porque} aria-label={porque}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', textDecoration: 'none',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
        boxShadow: '0 14px 40px rgba(18,21,27,.22)', fontFamily: SANS, pointerEvents: 'auto',
      }}>
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--warn-bg)', color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>!</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{ROTULO_PIXEL_VIEJO}</span>
    </Link>
  );
}
