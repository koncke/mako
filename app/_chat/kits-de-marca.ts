'use client';

// =============================================================================
// kits-de-marca — los kits de marca del negocio desde el navegador (/api/marca)
// =============================================================================
// Lo usan la pantalla de la marca del Second Brain (app/second-brain/MarcaView.tsx) y el chat de Image (que ofrece el logo
// como foto y deja elegir el kit). El `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { KITS_VACIOS, sanearKits, type BorradorMarca, type KitMarca, type KitsMarca } from '@/lib/marca/kits';

type Resp<T> = ({ ok: true } & T) | { ok: false; error: string };

async function pedir<T>(init?: RequestInit): Promise<Resp<T>> {
  try {
    const res = await fetch('/api/marca', { cache: 'no-store', ...init });
    const j = (await res.json().catch(() => null)) as Resp<T> | null;
    if (!j || typeof j !== 'object' || !('ok' in j)) return { ok: false, error: res.status === 413 ? 'El archivo es muy pesado.' : 'No pude hablar con MaKo. Vuelve a intentar.' };
    return j;
  } catch {
    return { ok: false, error: 'No pude hablar con MaKo. Vuelve a intentar.' };
  }
}

const json = (cuerpo: Record<string, unknown>): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

export async function pedirKits(): Promise<Resp<{ kits: KitsMarca }>> {
  const r = await pedir<{ kits: unknown }>();
  return r.ok ? { ok: true, kits: sanearKits(r.kits) } : r;
}

export async function guardarKit(kit: Partial<KitMarca>, porDefecto = false): Promise<Resp<{ kits: KitsMarca; id: string }>> {
  const r = await pedir<{ kits: unknown; id: string }>(json({ accion: 'guardar', kit, porDefecto }));
  return r.ok ? { ok: true, kits: sanearKits(r.kits), id: r.id } : r;
}

export async function cambiarKit(accion: 'por-defecto' | 'borrar', id: string): Promise<Resp<{ kits: KitsMarca }>> {
  const r = await pedir<{ kits: unknown }>(json({ accion, id }));
  return r.ok ? { ok: true, kits: sanearKits(r.kits) } : r;
}

/** MaKo lee el manual (un PDF o una imagen) y devuelve un borrador. No guarda nada. */
export async function leerManual(archivo: File): Promise<Resp<{ borrador: BorradorMarca }>> {
  const fd = new FormData();
  fd.append('datos', JSON.stringify({ accion: 'leer' }));
  fd.append('adjuntos', archivo, archivo.name);
  return pedir<{ borrador: BorradorMarca }>({ method: 'POST', body: fd });
}

/** Los kits del negocio: `null` mientras carga; con un error, la lista vacía y el error (la pantalla lo dice). */
export function useKitsDeMarca(prendido = true): { kits: KitsMarca | null; error: string | null; poner: (k: KitsMarca) => void; recargar: () => void } {
  const [kits, setKits] = useState<KitsMarca | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!prendido) return;
    let vivo = true;
    void pedirKits().then((r) => {
      if (!vivo) return;
      if (r.ok) { setKits(r.kits); setError(null); } else { setKits(KITS_VACIOS); setError(r.error); }
    });
    return () => { vivo = false; };
  }, [prendido, vuelta]);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { kits, error, poner: setKits, recargar };
}
