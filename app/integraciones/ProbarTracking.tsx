'use client';

// =============================================================================
// ProbarTracking — el "Test Events" de MaKo para la landing
// =============================================================================
// El equivalente al Pixel Helper de Meta. El botón "Verificar" de antes solo
// decía si ALGUNA VEZ llegó un evento — y estuvo en verde tres semanas mientras
// el VSL no medía nada, porque llegaban los plays pero ningún avance.
//
// Esto abre una sesión de prueba: mientras está prendida consulta cada 3s y
// muestra los eventos ENTRANDO, más cuatro chequeos que dicen qué anda y qué no
// (incluido si la landing tiene el código VIEJO, que es el error más común: se
// pega una vez y queda congelado ahí para siempre).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Evento = { ts: string; tipo: string; porcentaje: number | null; segundos: number | null; detalle: string | null };
type Chequeo = { id: string; label: string; estado: 'ok' | 'falta' | 'viejo'; detalle: string };
type Diag = { eventos: Evento[]; chequeos: Chequeo[]; veredicto: string; ultima: string | null };

const hora = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('es-MX', { hour12: false }); };

/** Cómo se lee cada evento crudo. Los tipos técnicos no se muestran pelados. */
function legible(e: Evento): { texto: string; color: string } {
  if (e.tipo === 'pageview') return { texto: 'Visitó la landing', color: 'var(--dim)' };
  if (e.tipo === 'play') return { texto: 'Arrancó el VSL', color: 'var(--primary)' };
  if (e.tipo === 'exit') return { texto: e.porcentaje != null ? `Salió en el ${e.porcentaje}%` : 'Salió del VSL', color: 'var(--bad)' };
  const m = /^p(\d+)$/.exec(e.tipo);
  if (m) return { texto: `Llegó al ${m[1]}% del VSL`, color: 'var(--good)' };
  const s = /^s(\d+)$/.exec(e.tipo);
  if (s) return { texto: `Vio ${s[1]} segundos`, color: 'var(--good)' };
  return { texto: e.tipo, color: 'var(--dim)' };
}

const ICONO: Record<string, string> = { ok: '✓', falta: '○', viejo: '!' };
const COLOR: Record<string, string> = { ok: 'var(--good)', falta: 'var(--faint)', viejo: 'var(--warn)' };

export function ProbarTracking() {
  const [activo, setActivo] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const traer = useCallback(async () => {
    try {
      const r = await fetch('/api/integraciones/landing/estado?diag=1', { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok) { setDiag({ eventos: r.eventos ?? [], chequeos: r.chequeos ?? [], veredicto: r.veredicto ?? '', ultima: r.ultima ?? null }); setErr(null); }
      else setErr(r?.error ?? 'No se pudo consultar');
    } catch { setErr('No se pudo consultar'); }
    finally { setCargando(false); }
  }, []);

  // Mientras la prueba está prendida, consulta cada 3s. Se apaga sola al cerrar
  // el modal (cleanup) para no dejar un poll corriendo de fondo.
  useEffect(() => {
    if (!activo) { if (timer.current) { clearInterval(timer.current); timer.current = null; } return; }
    setCargando(true);
    traer();
    timer.current = setInterval(traer, 3000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [activo, traer]);

  const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface-2)', padding: 16, fontFamily: SANS };

  if (!activo) {
    return (
      <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Probar que el código funciona</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
            Abrí tu landing en otra pestaña y reproducí unos segundos del video. Acá vas a ver llegar los eventos en vivo.
          </div>
        </div>
        <button type="button" onClick={() => setActivo(true)}
          style={{ flex: 'none', padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
          Empezar la prueba
        </button>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--good)', animation: 'pt-latido 1.4s infinite', flex: 'none' }} />
          <span style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Escuchando… {diag ? `· ${diag.veredicto}` : ''}</span>
        </div>
        <button type="button" onClick={() => setActivo(false)}
          style={{ flex: 'none', padding: '8px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
          Terminar
        </button>
      </div>
      <style>{'@keyframes pt-latido{0%,100%{opacity:1}50%{opacity:.25}}'}</style>

      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 12 }}>
        Abrí tu landing en otra pestaña, <b>reproducí el video</b> y mirá más de 15 segundos. Los eventos aparecen acá en unos segundos.
      </div>

      {/* Los 4 chequeos: qué anda y qué no, en criollo. */}
      {diag && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {diag.chequeos.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: COLOR[c.estado] }}>{ICONO[c.estado]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: c.estado === 'ok' ? 'var(--ink)' : 'var(--dim)' }}>{c.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1, lineHeight: 1.45 }}>{c.detalle}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Los eventos crudos, como el Test Events de Meta. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', maxHeight: 260, overflowY: 'auto' }}>
        {cargando && !diag && <div style={{ padding: 16, fontSize: 13, color: 'var(--faint)' }}>Conectando…</div>}
        {diag && diag.eventos.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--faint)', lineHeight: 1.55 }}>
            Todavía no llegó nada en las últimas 24 h. Si ya abriste tu landing y no aparece nada, el código no está pegado o no se publicó.
          </div>
        )}
        {diag?.eventos.map((e, i) => {
          const l = legible(e);
          return (
            <div key={`${e.ts}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{hora(e.ts)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: l.color, flex: 1, minWidth: 0 }}>{l.texto}</span>
              {e.segundos != null && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{Math.round(e.segundos)}s</span>}
            </div>
          );
        })}
      </div>

      {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
