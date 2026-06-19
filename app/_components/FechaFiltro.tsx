'use client';

// =============================================================================
// FechaFiltro — filtro de fecha global, tema claro (rediseño Marketing OS)
// =============================================================================
// Misma lógica que FechaFiltroGlobal (presets + rango personalizado en la URL
// ?desde&hasta), restilado al tema claro y al botón del header del rediseño.
// Lo usan /marketing y /comercial.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { presetsDeFecha } from './FechaFiltroGlobal';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

function fmtCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function FechaFiltro({ hoyReal }: { hoyReal: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const desdeUrl = searchParams.get('desde') ?? '';
  const hastaUrl = searchParams.get('hasta') ?? '';
  const activo = !!(desdeUrl && hastaUrl);

  const presets = presetsDeFecha(hoyReal);
  const presetActivo = activo ? presets.find((p) => p.desde === desdeUrl && p.hasta === hastaUrl) : undefined;

  const [customDesde, setCustomDesde] = useState(desdeUrl);
  const [customHasta, setCustomHasta] = useState(hastaUrl);

  const navegar = (d: string, h: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (d && h) {
      params.set('desde', d);
      params.set('hasta', h);
    } else {
      params.delete('desde');
      params.delete('hasta');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  };

  const etiqueta = !activo ? 'Todo el periodo' : presetActivo ? presetActivo.label : `${fmtCorta(desdeUrl)} – ${fmtCorta(hastaUrl)}`;
  const customValido = !!(customDesde && customHasta && customDesde <= customHasta);

  const dateInput: CSSProperties = { flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 17px', borderRadius: 11,
          border: '1px solid ' + (activo ? 'var(--accent)' : 'var(--border-strong)'),
          background: activo ? 'rgba(200,135,12,.10)' : 'var(--surface)',
          color: activo ? '#9A6A09' : 'var(--dim)', fontFamily: SANS, fontSize: 14.5, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <span aria-hidden>📅</span>
        <span>{etiqueta}</span>
        <span aria-hidden style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
          <div style={{ position: 'absolute', right: 0, marginTop: 8, zIndex: 50, width: 320, maxWidth: '88vw', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, boxShadow: '0 20px 50px rgba(23,21,17,.18)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {presets.map((p) => {
                const sel = presetActivo?.key === p.key;
                return (
                  <button key={p.key} type="button" onClick={() => navegar(p.desde, p.hasta)} style={{ padding: '8px 11px', borderRadius: 9, textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 13, border: '1px solid ' + (sel ? 'var(--accent)' : 'var(--border)'), background: sel ? 'rgba(200,135,12,.10)' : 'var(--surface-2)', color: sel ? '#9A6A09' : 'var(--ink)' }}>{p.label}</button>
                );
              })}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Personalizado</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="date" value={customDesde} max={customHasta || hoyReal} onChange={(e) => setCustomDesde(e.target.value)} style={dateInput} />
                <span style={{ color: 'var(--faint)' }}>→</span>
                <input type="date" value={customHasta} min={customDesde || undefined} max={hoyReal} onChange={(e) => setCustomHasta(e.target.value)} style={dateInput} />
              </div>
              <button type="button" disabled={!customValido} onClick={() => navegar(customDesde, customHasta)} style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: customValido ? 'pointer' : 'not-allowed', opacity: customValido ? 1 : 0.4 }}>Aplicar rango</button>
            </div>
            {activo && (
              <button type="button" onClick={() => navegar('', '')} style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 9, border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' }}>✕ Quitar filtro</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
