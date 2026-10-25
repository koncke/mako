'use client';

// =============================================================================
// Avatar del contacto no oficial: foto de perfil de WhatsApp (Evolution) con
// fallback a iniciales. La imagen se sirve por NUESTRO proxy same-origin
// (?avatarimg=<tel>), que baja los bytes del CDN de WhatsApp del lado del server
// — así evitamos el 403 por Referer/expiración/CSP del <img> directo. Los que
// no tienen foto se cachean en un Set a nivel módulo para no re-pedirlos.
// =============================================================================

import { useState, type CSSProperties } from 'react';
import { iniciales } from '@/lib/unicode-seguro';

const sinFoto = new Set<string>(); // teléfonos sin foto (o que fallaron) → no reintentar

const initials = (name: string): string => iniciales(name);

export function Avatar({ telefono, name, size = 38 }: { telefono: string | null; name: string; size?: number }) {
  const digits = (telefono || '').replace(/\D/g, '');
  const [, force] = useState(0);
  // Mismos tokens que el avatar del inbox oficial (paridad de diseño).
  const box: CSSProperties = { width: size, height: size, flex: 'none', borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.37, overflow: 'hidden' };
  if (digits && !sinFoto.has(digits)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/whatsapp/evolution/mensajes?avatarimg=${encodeURIComponent(digits)}`}
        alt={name}
        onError={() => { sinFoto.add(digits); force((n) => n + 1); }}
        style={{ ...box, objectFit: 'cover' }}
      />
    );
  }
  return <div style={box}>{initials(name)}</div>;
}
