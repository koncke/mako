'use client';

// =============================================================================
// ResumenView — la tab "Resumen": el panorama que MaKo entendió del negocio
// =============================================================================
// Self-contained: trae el panorama de /api/onboarding/archivero. Es lo PRIMERO que
// ve el cliente al entrar al hub (P3/P4): lo que MaKo entendió, en prosa. Si todavía
// no hay documentos, no muestra nada forzado — solo un puntero a El Archivero.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const MONO = "'Geist Mono', monospace";

type Estado = { panorama: string; files: Array<{ id: string }>; answers: Record<string, string> };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };

// El panorama viene con SUBTÍTULOS EN MAYÚSCULA + párrafos (limpiamos markdown).
function PanoramaText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let k = 0;
  const esSub = (l: string) => l.length > 0 && l.length <= 48 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[a-záéíóúñ]/.test(l);
  for (const raw of lines) {
    const l = raw.trim().replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!l) continue;
    if (esSub(l)) out.push(<div key={k++} style={{ ...eyebrow, color: 'var(--accent)', marginTop: out.length ? 18 : 0, marginBottom: 7 }}>{l.replace(/[:：]$/, '')}</div>);
    else out.push(<p key={k++} style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.65, margin: '0 0 9px' }}>{l.replace(/^[-•·]\s*/, '')}</p>);
  }
  return <div>{out}</div>;
}

export function ResumenView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/archivero')).json(); if (j.ok || j.brief) setEst(j as Estado); else setErr(j.error || 'No se pudo cargar.'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando el resumen…</div>;
  if (err) return <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, textAlign: 'center' }}>{err}</div>;

  const panorama = (est?.panorama ?? '').trim();
  const nDatos = Object.keys(est?.answers ?? {}).length;

  // El panorama en prosa SOLO se arma al subir documentos. Pero el brief (answers)
  // también se llena a mano (Oferta / cliente ideal / huecos). Si hay datos pero no
  // panorama, NO negamos el conocimiento: lo reconocemos y apuntamos dónde verlo/completarlo.
  if (!panorama) {
    if (nDatos > 0) {
      return (
        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 10px' }}>Ya tengo {nDatos} dato{nDatos === 1 ? '' : 's'} de tu negocio</h2>
          <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 440 }}>
            Los ves y corriges en <b>Oferta</b> y <b>Avatares</b>. Para armar el panorama completo en prosa, sube tus documentos en <b>El Archivero</b>.
          </p>
        </div>
      );
    }
    // Sin datos y sin panorama: nada forzado, solo el puntero al Archivero.
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '56px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 10px' }}>Todavía no conozco tu negocio</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 420 }}>
          Sube tus documentos en <b>El Archivero</b> y aquí te armo el panorama completo: tu oferta, tu avatar, tu nicho y todo lo que un buen estratega anotaría.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow, color: 'var(--accent)' }}>✦ Esto entendí de tu negocio</div>
        {nDatos > 0 && <div style={{ ...eyebrow, fontSize: 10 }}>{nDatos} dato{nDatos === 1 ? '' : 's'} extraídos</div>}
      </div>
      <div style={card}><PanoramaText text={panorama} /></div>
    </div>
  );
}
