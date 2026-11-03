'use client';

// =============================================================================
// Media Buyer — elegir LUGARES de Meta (la zona de Ajustes y los lugares de «Nueva campaña»)
// =============================================================================
// Copiado del selector de ubicaciones del Administrador de anuncios de Meta: un buscador, la lista de lo que encontró con su
// tipo y su provincia, y lo elegido como etiquetas con su cruz. La búsqueda es la de siempre (`searchLugares`, por la Zernio
// del negocio o su token), por `POST /api/media-buyer` op `lugares` (la misma de `buscar_lugares_meta` en la API de MaKo).
// Sólo países, provincias y ciudades: lo que se sabe contener por id (lib/media-buyer/zona.ts).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { TextField } from '@/app/_ui';
import { ETIQUETA_TIPO } from '@/lib/meta-geo';
import { TIPOS_ZONA, ZONA_MAX, type LugarZona } from '@/lib/media-buyer/zona';

type Encontrado = LugarZona & { region?: string | null };

export function ElegirLugares({ elegidos, onCambio, etiqueta, ayuda, deshabilitado }: {
  elegidos: LugarZona[];
  onCambio: (xs: LugarZona[]) => void;
  etiqueta: string;
  ayuda?: string;
  deshabilitado?: boolean;
}) {
  const [q, setQ] = useState('');
  const [encontrados, setEncontrados] = useState<Encontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vez = useRef(0);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setEncontrados([]); setError(null); return; }
    const mia = ++vez.current;
    const h = setTimeout(() => {
      setBuscando(true);
      void fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'lugares', q: t }) })
        .then((r) => r.json()).catch(() => ({ ok: false, error: 'No pude buscar.' }))
        .then((r: { ok: boolean; lugares?: Encontrado[]; error?: string }) => {
          if (mia !== vez.current) return;
          setBuscando(false);
          if (!r.ok) { setError(r.error ?? 'No pude buscar.'); setEncontrados([]); return; }
          setError(null);
          setEncontrados((r.lugares ?? []).filter((l) => (TIPOS_ZONA as readonly string[]).includes(l.tipo)));
        });
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const ya = (l: LugarZona) => elegidos.some((x) => x.tipo === l.tipo && x.key === l.key);
  const sumar = (l: Encontrado) => {
    if (ya(l) || elegidos.length >= ZONA_MAX) return;
    onCambio([...elegidos, { tipo: l.tipo, key: l.key, nombre: l.nombre, pais: l.pais ?? null, region: l.region ?? null, regionId: l.regionId ?? null }]);
    setQ('');
  };

  return (
    <div className="mba-lugares">
      <TextField label={etiqueta} value={q} onChange={(e) => setQ(e.target.value)} disabled={deshabilitado}
        placeholder="Busca un país, una provincia o una ciudad" hint={error ?? ayuda} />
      {(buscando || encontrados.length > 0) && (
        <ul className="mba-lugares-lista" role="listbox" aria-label="Lugares encontrados">
          {buscando && !encontrados.length && <li className="mba-lugares-nada">Buscando…</li>}
          {encontrados.map((l) => (
            <li key={`${l.tipo}:${l.key}`}>
              <button type="button" role="option" aria-selected={ya(l)} disabled={ya(l)} onClick={() => sumar(l)}>
                <b>{l.nombre}</b>
                <span>{[ETIQUETA_TIPO[l.tipo], l.region, l.pais].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {elegidos.length > 0 && (
        <ul className="mba-lugares-elegidos" aria-label="Lugares elegidos">
          {elegidos.map((l) => (
            <li key={`${l.tipo}:${l.key}`}>
              <span>{l.nombre}<small> · {ETIQUETA_TIPO[l.tipo]}</small></span>
              <button type="button" aria-label={`Quitar ${l.nombre}`} disabled={deshabilitado}
                onClick={() => onCambio(elegidos.filter((x) => !(x.tipo === l.tipo && x.key === l.key)))}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
