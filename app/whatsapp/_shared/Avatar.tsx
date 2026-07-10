'use client';

// =============================================================================
// Avatar del contacto no oficial: foto de perfil de WhatsApp (Evolution) con
// fallback a iniciales. La URL se pide una vez por número y se cachea a nivel
// módulo (sobrevive re-render y re-montaje); dedup de requests en vuelo.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function fetchAvatar(key: string): Promise<string | null> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  let p = inflight.get(key);
  if (!p) {
    p = fetch(`/api/whatsapp/evolution/mensajes?avatar=${encodeURIComponent(key)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { ok?: boolean; url?: string | null }) => (j.ok ? (j.url ?? null) : null))
      .catch(() => null)
      .then((url) => { cache.set(key, url); inflight.delete(key); return url; });
    inflight.set(key, p);
  }
  return p;
}

export function useAvatar(telefono: string | null): string | null {
  const key = (telefono || '').replace(/\D/g, '');
  const [, force] = useState(0);
  useEffect(() => {
    if (!key || cache.has(key)) return; // ya cacheado (o sin número) → nada que hacer
    let vivo = true;
    void fetchAvatar(key).then(() => { if (vivo) force((n) => n + 1); }); // re-render al resolver
    return () => { vivo = false; };
  }, [key]);
  // Se lee del cache en cada render (no hay setState síncrono en el effect).
  return key && cache.has(key) ? (cache.get(key) ?? null) : null;
}

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : (name || '?').slice(0, 1)).toUpperCase();
}

export function Avatar({ telefono, name, size = 38 }: { telefono: string | null; name: string; size?: number }) {
  const src = useAvatar(telefono);
  const [failedSrc, setFailedSrc] = useState<string | null>(null); // qué URL falló (se resetea solo al cambiar src)
  // Mismos tokens que el avatar del inbox oficial (paridad de diseño).
  const box: CSSProperties = { width: size, height: size, flex: 'none', borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.37, overflow: 'hidden' };
  if (src && src !== failedSrc) {
    // referrerPolicy="no-referrer": las URLs del CDN de WhatsApp (pps.whatsapp.net)
    // devuelven 403 si el navegador manda el Referer de nuestro dominio.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} style={{ ...box, objectFit: 'cover' }} />;
  }
  return <div style={box}>{initials(name)}</div>;
}
