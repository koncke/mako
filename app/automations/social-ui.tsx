'use client';

// =============================================================================
// social-ui — las piezas con la cara de Instagram y de Messenger
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, CRON 5): «crear el "+" de Instagram, con su diseño
// personalizado, así como hicimos el de WhatsApp y Email. Que tenga sus colores y que la interfaz
// editable y "probar" se parezcan a Instagram». Y CRON 7: «lo mismo para Messenger».
//
// Lo usan la tarjeta (`VistaMensajeSocial`), el editor (`EditorMensajeSocial`) y «Probar»
// (`SimuladorSocial`): una sola burbuja y un solo logo, así las tres pantallas no divergen. Los colores
// salen de `IDENTIDAD_SOCIAL` (lib/canal-social.ts), mezclados con tokens que se redefinen en oscuro.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { GLIFO_SOCIAL, IDENTIDAD_SOCIAL, type CanalSocial } from '@/lib/canal-social';

/** El logo oficial (simple-icons) en blanco sobre su degradé. Dibujado acá: no depende de `BrandDefs`. */
export function LogoSocial({ canal, size = 22, radio }: { canal: CanalSocial; size?: number; radio?: number }) {
  const id = useId().replace(/:/g, '');
  const [a, b, c] = canal === 'instagram' ? ['#FEDA75', '#D62976', '#4F5BD5'] : ['#0099FF', '#A033FF', '#FF5280'];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={a} /><stop offset="0.55" stopColor={b} /><stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx={radio ?? 6.5} fill={`url(#g${id})`} />
      <g transform="translate(4.5 4.5) scale(0.625)"><path fill="#fff" d={GLIFO_SOCIAL[canal]} /></g>
    </svg>
  );
}

/**
 * Los `<symbol>` de las dos marcas, para el ícono de la cabecera de la tarjeta (`IconoNodo` en
 * app/_components/Lienzo.tsx dibuja `SvcIcon`, que hace `<use href="#ic-instagram">`). /automations no
 * monta `BrandDefs`: sin esto el ícono queda como un cuadrado de color liso. Montarlos dos veces es
 * inocuo (los `<use>` toman el primero, y son idénticos).
 */
export function SimbolosSociales() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <symbol id="ic-instagram" viewBox="0 0 24 24"><path fill="#fff" d={GLIFO_SOCIAL.instagram} /></symbol>
      <symbol id="ic-messenger" viewBox="0 0 24 24"><path fill="#fff" d={GLIFO_SOCIAL.messenger} /></symbol>
    </defs></svg>
  );
}

/** Una burbuja como en Instagram / Messenger: la del negocio con el degradé de la app, la de la persona gris. */
export function BurbujaSocial({ canal, saliente = true, children, compacta, lineas, style }: {
  canal: CanalSocial; saliente?: boolean; children: ReactNode; compacta?: boolean;
  /** Recorta a N renglones con «…» (la tarjeta del lienzo). */
  lineas?: number;
  style?: CSSProperties;
}) {
  const id = IDENTIDAD_SOCIAL[canal];
  const caja: CSSProperties = {
    maxWidth: compacta ? '100%' : '78%', minWidth: 0, boxSizing: 'border-box',
    padding: compacta ? '7px 11px' : '9px 14px',
    // Instagram redondea parejo; Messenger achica la esquina del lado de quien escribe.
    borderRadius: canal === 'instagram' ? 20 : saliente ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
    background: saliente ? id.burbuja : 'var(--surface-2)',
    color: saliente ? id.burbujaTexto : 'var(--ink)',
    border: saliente ? 'none' : '1px solid var(--border)',
    fontFamily: "'Geist', sans-serif", fontSize: compacta ? 12.5 : 14, lineHeight: compacta ? '17px' : 1.45,
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    ...(lineas ? { display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
    ...style,
  };
  return <div style={caja}>{children}</div>;
}

/** Un archivo adentro de la conversación: la foto, o el nombre del documento con su ícono. */
export function ArchivoSocial({ canal, url, mime, nombre, compacta, saliente = true }: { canal: CanalSocial; url: string | null; mime: string | null; nombre: string | null; compacta?: boolean; saliente?: boolean }) {
  const esImagen = (mime ?? '').startsWith('image/');
  const esVideo = (mime ?? '').startsWith('video/');
  if (url && esImagen) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre ?? 'imagen'} style={{ maxWidth: compacta ? '100%' : 220, maxHeight: compacta ? 90 : 260, borderRadius: 16, display: 'block', objectFit: 'cover' }} />;
  }
  if (url && esVideo && !compacta) return <video src={url} controls style={{ maxWidth: 220, maxHeight: 260, borderRadius: 16, display: 'block' }} />;
  return (
    <BurbujaSocial canal={canal} saliente={saliente} compacta={compacta}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M6 2h8l6 6v14H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        {nombre?.trim() || (esVideo ? 'Video' : 'Archivo')}
      </span>
    </BurbujaSocial>
  );
}

/** La cabecera de la conversación: la foto (las iniciales) y el nombre, como arriba de un DM. */
export function CabeceraSocial({ canal, nombre, detalle, derecha }: { canal: CanalSocial; nombre: string; detalle?: string; derecha?: ReactNode }) {
  const inicial = (nombre.trim()[0] ?? '?').toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 0 }}>
      <span aria-hidden style={{
        width: 30, height: 30, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: IDENTIDAD_SOCIAL[canal].degradado, padding: 2, boxSizing: 'border-box',
      }}>
        <span style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{inicial}</span>
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
        {detalle && <div style={{ fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detalle}</div>}
      </div>
      {derecha}
    </div>
  );
}
