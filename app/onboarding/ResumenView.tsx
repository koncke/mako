'use client';

// =============================================================================
// ResumenView — la tab "Resumen": el panorama que MaKo entendió del negocio
// =============================================================================
// Self-contained: trae el panorama de /api/onboarding/archivero. Es lo PRIMERO que
// ve el cliente al entrar al hub (P3/P4): lo que MaKo entendió, en prosa. Si todavía
// no hay documentos, no muestra nada forzado — solo un puntero a El Archivero.
//
// El panorama es texto plano con SUBTÍTULOS EN MAYÚSCULA (convención del prompt).
// Se parte en SECCIONES (una por subtítulo) y cada una es un contenedor desplegable
// propio, con un ícono heurístico según el tema — más fácil de escanear que un solo
// bloque de texto largo (pedido de Martín).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Estado = { panorama: string; files: Array<{ id: string }>; answers: Record<string, string> };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

type Seccion = { titulo: string; parrafos: string[] };

const esSub = (l: string) => l.length > 0 && l.length <= 48 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[a-záéíóúñ]/.test(l);

// Parte el panorama en secciones por subtítulo. El texto ANTES del primer
// subtítulo (si hay) cae en una sección "Panorama general".
function parsear(text: string): Seccion[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const secciones: Seccion[] = [];
  let actual: Seccion | null = null;
  for (const raw of lines) {
    const l = raw.trim().replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!l) continue;
    if (esSub(l)) {
      actual = { titulo: l.replace(/[:：]$/, ''), parrafos: [] };
      secciones.push(actual);
    } else {
      const limpio = l.replace(/^[-•·]\s*/, '');
      if (!actual) { actual = { titulo: 'Panorama general', parrafos: [] }; secciones.push(actual); }
      actual.parrafos.push(limpio);
    }
  }
  return secciones;
}

// Ícono heurístico por tema — solo cosmético, cae a 📌 si no matchea nada.
const ICONO_POR_TEMA: Array<[RegExp, string]> = [
  [/ofert|precio|ticket|producto|servicio/i, '🎯'],
  [/avatar|cliente|nicho|quién|target/i, '👤'],
  [/dolor|problema|frustraci/i, '🔥'],
  [/deseo|resultado|beneficio|transformaci/i, '✨'],
  [/proceso|método|sistema|cómo trabaj/i, '⚙️'],
  [/caso|testimonio|prueba|resultado/i, '⭐'],
  [/garantí|riesgo/i, '🛡️'],
  [/panorama general/i, '🗺️'],
];
const iconoDe = (titulo: string) => ICONO_POR_TEMA.find(([re]) => re.test(titulo))?.[1] ?? '📌';

function SeccionCard({ s, abiertoDefault }: { s: Seccion; abiertoDefault: boolean }) {
  const [abierto, setAbierto] = useState(abiertoDefault);
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <button type="button" onClick={() => setAbierto((a) => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}>
        {/* --accent-soft es amarillo fuerte: se funde con los emojis (mismo tono). Fondo neutro. */}
        <span aria-hidden style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{iconoDe(s.titulo)}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.titulo}</span>
        <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 12, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {abierto && (
        <div style={{ padding: '2px 18px 18px 62px' }}>
          {s.parrafos.map((p, i) => (
            <p key={i} style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.65, margin: i === 0 ? 0 : '9px 0 0' }}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
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

  const secciones = parsear(panorama);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow, color: 'var(--accent)' }}>✦ Esto entendí de tu negocio</div>
        {nDatos > 0 && <div style={{ ...eyebrow, fontSize: 10 }}>{nDatos} dato{nDatos === 1 ? '' : 's'} extraídos</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {secciones.map((s, i) => <SeccionCard key={s.titulo + i} s={s} abiertoDefault={i < 1} />)}
      </div>
    </div>
  );
}
