'use client';

// =============================================================================
// La foto de Martín al lado de sus mensajes (17/10/2026)
// =============================================================================
// Martín: «Cada mensaje dentro de su globo, con la colita que apunta a la foto o a la criatura. De su lado va SU foto de
// perfil». Como un grupo de WhatsApp: la foto arriba, a la altura de la colita del globo. La foto es la de su perfil
// (/api/perfil, la misma que la barra); sin foto, su inicial.
// Se pide UNA vez por pestaña (el hilo se redibuja con cada refresco) y quien la cambia desde el teléfono
// (ChatsMovil.tsx → «Tu foto») la avisa con `ponerMiFoto`: se ve en el acto en todos los globos.

import { useEffect, useState } from 'react';
import { iniciales } from '@/lib/unicode-seguro';

type Yo = { foto: string | null; inicial: string };
let yo: Yo | null = null;
let pidiendo: Promise<Yo> | null = null;
const oyentes = new Set<(y: Yo) => void>();

function leerYo(): Promise<Yo> {
  if (yo) return Promise.resolve(yo);
  pidiendo ??= fetch('/api/perfil')
    .then((r) => r.json())
    .then((j: { ok?: boolean; perfil?: { nombre?: string; avatarUrl?: string } }) => {
      const nombre = j?.perfil?.nombre?.trim() || 'Tú';
      yo = { foto: j?.perfil?.avatarUrl || null, inicial: iniciales(nombre, 1, 'T') };
      return yo;
    })
    .catch(() => { pidiendo = null; return { foto: null, inicial: '' }; });
  return pidiendo;
}

/** La foto nueva de Martín (la acaba de subir): todos los globos la muestran sin volver a pedir el perfil. */
export function ponerMiFoto(url: string) {
  yo = { foto: url, inicial: yo?.inicial ?? '' };
  for (const f of oyentes) f(yo);
}

export function MiFoto({ size = 28 }: { size?: number }) {
  const [y, setY] = useState<Yo | null>(null);
  useEffect(() => {
    oyentes.add(setY);
    let vivo = true;
    void leerYo().then((v) => { if (vivo) setY(v); });
    return () => { vivo = false; oyentes.delete(setY); };
  }, []);
  return (
    <span className="co-mifoto" style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- la foto del perfil (Supabase) */}
      {y?.foto ? <img src={y.foto} alt="" /> : <span>{y?.inicial ?? ''}</span>}
    </span>
  );
}
