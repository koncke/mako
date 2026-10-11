'use client';

// =============================================================================
// LandingAnalystApp — el diagnóstico de la landing (Landing Generator → Diagnóstico)
// =============================================================================
// Dos columnas: la lista de landings analizadas a la izquierda y el diagnóstico
// completo a la derecha. Todo lo que se ve acá lo produce el server
// (lib/landing-analyst.ts); este componente solo dispara las acciones y pinta.
//
// La decisión visual que importa: el bloque de COMPORTAMIENTO va arriba del
// diagnóstico, no abajo. Es lo único medido de la página —el resto es juicio de
// MaKo— y verlo primero cambia cómo se leen los hallazgos.
//
// ⚠️ DESDE EL 11/10/2026 ES SÓLO LA TAREA. Decisión de Martín: «Lo de Landing Analyst se
// muda a Landing Generator y Landing Analyst se ELIMINA». Lo monta
// /landing-generator/analizar; /landing-analyst redirige (app/landing-analyst/destino.ts).
// Lo que era ANÁLISIS se fue a la hoja «Landing» del Dashboard y salió de acá: las
// pestañas «Lo que mide tu Pixel» y «Mapa de calor» (MapaDeCalor.tsx lo sigue montando
// el Dashboard desde esta carpeta) y los KPIs del pie (páginas analizadas, puntaje
// promedio, hallazgos graves: la tabla «Diagnóstico de cada página» de esa hoja).
// El archivo NO se mudó de carpeta a propósito: la sesión del editor de landings toca
// el link de «Escribir la nueva versión» en este mismo archivo.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import Link from '@/app/_ui/Link';
import { Icon } from '../_components/icons';
import { MakoLogo } from '../_components/MakoBrand';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { analisisCortado } from '@/lib/landing-url';
import type { LandingViewData, LandingAnalysisRow, LandingHallazgo, Severidad, Tone } from '@/lib/landing-analyst';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── helpers de formato ───────────────────────────────────────────────────────

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--faint)';
  return s >= 7.5 ? 'var(--good)' : s >= 5 ? 'var(--warn)' : 'var(--bad)';
}
function toneColor(t: Tone | null | undefined): string {
  return t === 'good' ? 'var(--good)' : t === 'bad' ? 'var(--bad)' : 'var(--warn)';
}
function toneBg(t: Tone | null | undefined): string {
  return t === 'good' ? 'var(--good-bg)' : t === 'bad' ? 'var(--bad-bg)' : 'var(--warn-bg)';
}
function fmtScore(s: number | null | undefined): string {
  if (s == null) return '—';
  return Number.isInteger(s) ? `${s}.0` : String(s);
}
function hostDe(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function pathDe(url: string): string {
  try { const u = new URL(url); return u.pathname === '/' ? '' : u.pathname; } catch { return ''; }
}
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const SEV: Record<Severidad, { label: string; color: string; bg: string }> = {
  alta: { label: 'Alta', color: 'var(--bad)', bg: 'var(--bad-bg)' },
  media: { label: 'Media', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  baja: { label: 'Baja', color: 'var(--dim)', bg: 'var(--surface-2)' },
};

const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20,
};
const eyebrow: CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)',
};
const btnPrimario: CSSProperties = {
  padding: '10px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: SANS, border: 'none',
  borderRadius: 10, cursor: 'pointer', background: 'var(--primary)', color: '#fff',
};
const btnSuave: CSSProperties = {
  padding: '9px 15px', fontSize: 13, fontWeight: 600, fontFamily: SANS,
  border: '1px solid var(--border-strong)', borderRadius: 10, cursor: 'pointer',
  background: 'var(--surface)', color: 'var(--ink)',
};
const inputUrl: CSSProperties = {
  flex: 1, minWidth: 220, padding: '10px 14px', fontSize: 13.5, fontFamily: SANS,
  border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)',
};

// ── piezas ───────────────────────────────────────────────────────────────────

/** Las 5 dimensiones como barras. El score general NO es su promedio: lo decide MaKo. */
function Dims({ dims }: { dims: LandingAnalysisRow['dims'] }) {
  if (!dims?.length) return null;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {dims.map((d) => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: scoreColor(d.score) }}>{fmtScore(d.score)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, d.score * 10)}%`, background: scoreColor(d.score), borderRadius: 8 }} />
          </div>
          {d.note && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.45 }}>{d.note}</div>}
        </div>
      ))}
    </div>
  );
}

/** Lo medido de verdad. Si el beacon no vio esta URL, se dice — no se estima. */
function Comportamiento({ c }: { c: LandingAnalysisRow['comportamiento'] }) {
  if (!c || !c.hay_datos) {
    return (
      <div style={{ ...card, background: 'var(--surface-2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="web" size={17} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>Sin datos de comportamiento para esta URL</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
            El diagnóstico es sobre el copy. Para que MaKo cruce el mensaje con lo que hace la gente, esta página tiene que tener el código de seguimiento puesto.{' '}
            <Link href="/integraciones" style={{ color: 'var(--primary)', fontWeight: 600 }}>Ver el código →</Link>
          </div>
        </div>
      </div>
    );
  }
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
  const paso = (label: string, valor: string, sub: string) => (
    <div key={label} style={{ flex: 1, minWidth: 108 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 650, marginTop: 4, letterSpacing: '-0.02em' }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{sub}</div>
    </div>
  );
  return (
    <div style={card}>
      <div style={{ ...eyebrow, marginBottom: 14 }}>Lo que hace la gente en esta página · medido</div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {paso('Visitas', String(c.visitas), `${c.visitantes} personas`)}
        {c.plays > 0 && paso('Arrancó el video', String(c.plays), `${pct(c.plays, c.visitantes)} de los que entran`)}
        {/* "Pasó la mitad" solo se pinta si SE MIDIÓ. Un 0 acá se lee como "nadie
            llega al medio del video" — una conclusión— cuando la verdad puede
            ser que no hay medición. Es la distinción que lib/vsl-retencion.ts
            trata como innegociable. */}
        {c.plays > 0 && c.llegaron_al_50 !== null && c.medidos > 0
          && paso('Pasó la mitad', String(c.llegaron_al_50), `${pct(c.llegaron_al_50, c.medidos)} de los medidos`)}
        {paso('Agendó', String(c.agendas), `${pct(c.agendas, c.visitantes)} de los que entran`)}
      </div>
      {c.plays > 0 && (c.llegaron_al_50 === null || c.medidos === 0) && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
          De cuánto video se ve no hay medición utilizable todavía — no es que nadie lo vea.
        </div>
      )}
      {c.visitantes_compartidos && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
          Parte de esta gente también entró a otras páginas del negocio, así que los datos del video son aproximados.
        </div>
      )}
      {c.top_referrers.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...eyebrow, marginRight: 4 }}>De dónde llegan</span>
          {c.top_referrers.map((r) => (
            <span key={r.ref} style={{ fontFamily: MONO, fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--dim)' }}>
              {r.ref} · {r.n}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--faint)' }}>
        Ventana medida: {fechaCorta(c.primer_evento)} → {fechaCorta(c.ultimo_evento)}
      </div>
    </div>
  );
}

function Hallazgo({ h }: { h: LandingHallazgo }) {
  const s = SEV[h.severidad] ?? SEV.media;
  return (
    <div style={{ ...card, borderLeft: `3px solid ${s.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>
        <span style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em' }}>{h.titulo}</span>
        {h.seccion && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>· {h.seccion}</span>}
      </div>
      {h.cita && (
        <blockquote style={{ margin: '0 0 11px', padding: '9px 14px', borderLeft: '2px solid var(--border-strong)', background: 'var(--surface-2)', borderRadius: '0 8px 8px 0', fontSize: 13.5, fontStyle: 'italic', color: 'var(--dim)', lineHeight: 1.5 }}>
          “{h.cita}”
        </blockquote>
      )}
      {h.por_que && <p style={{ margin: '0 0 11px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{h.por_que}</p>}
      {h.arreglo && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 13px', borderRadius: 10, background: 'var(--primary-bg)' }}>
          <Icon name="pen" size={15} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{h.arreglo}</div>
        </div>
      )}
    </div>
  );
}

// ── vista principal ──────────────────────────────────────────────────────────

// ⛔ Acá vivían las pestañas (`Vista = 'copy' | 'pulso' | 'mapa'`, `vistaInicial` y el
// `router.replace` que escribía `?tab=` de vuelta en la URL vieja). Salieron el 11/10/2026
// con el retiro de la tab: el pulso y el mapa son la hoja «Landing» del Dashboard, y un
// `?tab=` viejo lo traduce el redirect (app/landing-analyst/destino.ts).
export function LandingAnalystApp({ data, errorMsg }: { data: LandingViewData; errorMsg: string | null }) {
  const router = useRouter();
  const { landings, sinAnalizar } = data;

  const [url, setUrl] = useState('');
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'bad' | 'good'; texto: string } | null>(null);
  const [selUrl, setSelUrl] = useState<string | null>(landings[0]?.url ?? null);
  // Página que no se pudo leer sola: se ofrece pegar el texto en vez de dejar
  // al usuario contra la pared. `pegar.url` es la que quedó esperando su copy.
  const [pegar, setPegar] = useState<{ url: string; texto: string } | null>(null);

  const sel = useMemo(
    () => landings.find((l) => l.url === selUrl) ?? landings[0] ?? null,
    [landings, selUrl],
  );

  // ⚠️ UN ANÁLISIS AUTOMÁTICO CORRE POR DETRÁS (lo dispara guardar una página en el
  // Pixel), así que la pantalla no se entera sola de que terminó. Mientras haya uno
  // en curso —y no cortado— se refresca cada 15 s; sin ninguno, no se sondea nada.
  const actualizadoDe = (l: LandingAnalysisRow) => (l as LandingAnalysisRow & { updated_at?: string }).updated_at ?? null;
  const enCurso = landings.some((l) => l.status === 'pendiente' && !analisisCortado(l.status, actualizadoDe(l), Date.now()));
  useEffect(() => {
    if (!enCurso) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [enCurso, router]);

  const analizar = useCallback(async (raw: string, texto?: string) => {
    const target = raw.trim();
    if (!target) return;
    setCorriendo(target); setAviso(null);
    try {
      const r = await fetch('/api/landing-analyst/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(texto ? { url: target, texto } : { url: target }),
      });
      const j = await r.json();
      if (!j.ok) {
        setAviso({ tono: 'bad', texto: j.error || 'No se pudo analizar la página.' });
        if (j.pegable) setPegar({ url: j.url || target, texto: texto ?? '' });
        // El server YA guardó la fila con el fallo: sin este refresh la página
        // no aparecía en la lista hasta recargar a mano, y el intento se leía
        // como "no pasó nada".
        router.refresh();
        return;
      }
      setSelUrl(j.row.url); setUrl(''); setPegar(null);
      setAviso({ tono: 'good', texto: `Listo: ${(j.row.hallazgos ?? []).length} hallazgos.` });
      router.refresh();
    } catch (e) {
      setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) });
    } finally { setCorriendo(null); }
  }, [router]);

  const sincronizar = useCallback(async () => {
    setCorriendo('__sync__'); setAviso(null);
    try {
      const r = await fetch('/api/landing-analyst/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el sync');
      const partes = [`${j.analizadas} analizadas`];
      if (j.errores > 0) partes.push(`${j.errores} con error`);
      if (j.restantes > 0) partes.push(`quedan ${j.restantes}`);
      if (j.descubiertas > 0) partes.push(`${j.descubiertas} sin analizar esperando`);
      setAviso({ tono: j.analizadas === 0 && j.errores > 0 ? 'bad' : 'good', texto: partes.join(' · ') + '.' });
      router.refresh();
    } catch (e) {
      setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) });
    } finally { setCorriendo(null); }
  }, [router]);

  const borrar = useCallback(async (u: string) => {
    try {
      const r = await fetch(`/api/landing-analyst/view?url=${encodeURIComponent(u)}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({ ok: false }));
      // fetch solo rechaza por error de RED: un 500 llegaba acá como éxito y la
      // fila desaparecía de la vista para volver en el siguiente refresh.
      if (!j.ok) { setAviso({ tono: 'bad', texto: j.error || 'No se pudo quitar de la lista.' }); return; }
      if (selUrl === u) setSelUrl(null);
      router.refresh();
    } catch (e) { setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) }); }
  }, [router, selUrl]);

  const ocupado = corriendo !== null;

  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '28px 0 40px' }}>
      {/* HEADER */}
      <header style={{ padding: '0 32px', marginBottom: 22 }}>
        {/* La tab es Landing Generator y esto es una pantalla suya: el nivel de arriba es el
            panel de la tab, y se navega explícito (AGENTS.md, «El destino de "Volver"…»). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <MakoLogo size={22} />
          <Link href="/landing-generator" style={{ ...eyebrow, color: 'var(--dim)', textDecoration: 'none' }}>Landing Generator</Link>
          <span style={eyebrow}>/ Diagnóstico</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.025em', margin: 0 }}>
          Qué le pasa a tu página
        </h1>

        {/* Analizar una URL */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={inputUrl}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') analizar(url); }}
            placeholder="tudominio.com/tu-pagina"
            disabled={ocupado}
            aria-label="Dirección de la landing a analizar"
          />
          <button type="button" style={{ ...btnPrimario, opacity: ocupado || !url.trim() ? 0.55 : 1 }}
            disabled={ocupado || !url.trim()} onClick={() => analizar(url)}>
            {corriendo !== null && corriendo === url.trim() ? 'Analizando…' : 'Analizar'}
          </button>
          <button type="button" style={{ ...btnSuave, opacity: ocupado ? 0.55 : 1 }} disabled={ocupado} onClick={sincronizar}>
            {corriendo === '__sync__' ? 'Buscando…' : 'Buscar mis páginas'}
          </button>
        </div>

        {aviso && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.5,
            background: aviso.tono === 'bad' ? 'var(--bad-bg)' : 'var(--good-bg)', color: aviso.tono === 'bad' ? 'var(--bad)' : 'var(--good)' }}>
            {aviso.texto}
          </div>
        )}
        {errorMsg && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13.5, background: 'var(--bad-bg)', color: 'var(--bad)' }}>
            {errorMsg}
          </div>
        )}

        {/* La salida cuando la página se arma en el navegador. No es un caso raro:
            Lovable, Framer y cualquier React sin SSR llegan acá. */}
        {pegar && (
          <div style={{ ...card, marginTop: 12, borderLeft: '3px solid var(--warn)' }}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Pega el contenido de tu página</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', marginBottom: 10 }}>{pegar.url}</div>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>
              Abre tu landing, selecciona todo el texto de arriba a abajo y pégalo aquí. MaKo lo analiza igual y lo cruza con lo que hace la gente que entra.
            </p>
            <textarea
              style={{ width: '100%', minHeight: 150, padding: '12px 14px', fontSize: 13.5, fontFamily: SANS, lineHeight: 1.55, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }}
              value={pegar.texto}
              onChange={(e) => setPegar({ ...pegar, texto: e.target.value })}
              disabled={ocupado}
              placeholder="El titular, los subtítulos, los párrafos, los botones…"
              aria-label="Contenido de la página"
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={{ ...btnPrimario, opacity: ocupado || !pegar.texto.trim() ? 0.55 : 1 }}
                disabled={ocupado || !pegar.texto.trim()} onClick={() => analizar(pegar.url, pegar.texto)}>
                {corriendo === pegar.url ? 'Analizando…' : 'Analizar con este texto'}
              </button>
              <button type="button" style={btnSuave} onClick={() => setPegar(null)}>Ahora no</button>
            </div>
          </div>
        )}

        {/* Landings que el seguimiento vio y nadie analizó */}
        {sinAnalizar.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={eyebrow}>Tu seguimiento vio estas páginas</span>
            {sinAnalizar.slice(0, 6).map((s) => (
              <button key={s.url} type="button" disabled={ocupado} onClick={() => analizar(s.url)}
                style={{ ...btnSuave, padding: '6px 12px', fontSize: 12.5, fontFamily: MONO, opacity: ocupado ? 0.55 : 1 }}>
                {corriendo === s.url ? 'Analizando…' : `${hostDe(s.url)}${pathDe(s.url)} · ${s.visitas}`}
              </button>
            ))}
          </div>
        )}
      </header>

      {landings.length === 0 ? (
        <div style={{ padding: '0 32px' }}>
          <div style={{ ...card, padding: 40, textAlign: 'center', maxWidth: 560, margin: '30px auto 0' }}>
            {/* Se centra con FLEX, no con el `textAlign: 'center'` del padre: el preflight
                de Tailwind pone `svg { display: block }` y a un bloque el text-align no lo
                mueve — el icono quedaba pegado a la izquierda. */}
            <div style={{ display: 'flex', justifyContent: 'center' }}><MakoLogo size={54} /></div>
            <h2 style={{ fontSize: 20, fontWeight: 650, margin: '16px 0 8px', letterSpacing: '-0.02em' }}>Todavía no analizaste ninguna página</h2>
            <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, margin: 0 }}>
              Pega la dirección de tu landing arriba. MaKo la abre, lee el mensaje y lo cruza con lo que hace la gente que llega, para decirte qué cambiar primero.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 22, padding: '0 32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* LISTA */}
          <aside style={{ width: 292, flex: '0 0 auto', display: 'grid', gap: 10 }}>
            {landings.map((l) => {
              const on = sel?.url === l.url;
              return (
                <button key={l.url} type="button" onClick={() => setSelUrl(l.url)}
                  style={{ ...card, padding: 15, textAlign: 'left', cursor: 'pointer', width: '100%', fontFamily: SANS,
                    border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hostDe(l.url)}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pathDe(l.url) || '/'}</div>
                    </div>
                    {l.status === 'error'
                      ? <span style={{ fontSize: 10.5, fontFamily: MONO, padding: '3px 8px', borderRadius: 999, background: 'var(--bad-bg)', color: 'var(--bad)' }}>ERROR</span>
                      : l.status === 'pendiente'
                      ? <span style={{ fontSize: 10.5, fontFamily: MONO, padding: '3px 8px', borderRadius: 999, background: 'var(--mako-bg, var(--surface-2))', color: 'var(--mako-ink, var(--dim))', flex: 'none' }}>{GRAMATICA.analizando.rotulo.toUpperCase()}</span>
                      : <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: scoreColor(l.score), flex: 'none' }}>{fmtScore(l.score)}</span>}
                  </div>
                  {l.veredicto && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 7, lineHeight: 1.4 }}>{l.veredicto}</div>}
                </button>
              );
            })}
          </aside>

          {/* DETALLE */}
          <section style={{ flex: 1, minWidth: 380, display: 'grid', gap: 16 }}>
            {!sel ? null : sel.status === 'pendiente' ? (
              <div style={{ ...card, borderLeft: '3px solid var(--mako, var(--primary))' }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>{analisisCortado(sel.status, actualizadoDe(sel), Date.now()) ? 'Se cortó' : `${GRAMATICA.analizando.rotulo} · tu página`}</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, marginBottom: 12, color: 'var(--dim)' }}>{sel.url}</div>
                {analisisCortado(sel.status, actualizadoDe(sel), Date.now())
                  ? <button type="button" style={btnSuave} disabled={ocupado} onClick={() => analizar(sel.url)}>Reintentar</button>
                  : <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>Tarda unos minutos. Puedes cerrar esta pantalla.</p>}
              </div>
            ) : sel.status === 'error' ? (
              <div style={{ ...card, borderLeft: '3px solid var(--bad)' }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>No se pudo analizar</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, marginBottom: 12, color: 'var(--dim)' }}>{sel.url}</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>{sel.error}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {/* Si la página se arma en el navegador, reintentar no sirve de
                      nada: lo que destraba es pegar el texto. */}
                  {sel.bloqueada
                    ? <button type="button" style={btnPrimario} onClick={() => { setPegar({ url: sel.url, texto: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Pegar el contenido</button>
                    : <button type="button" style={btnSuave} disabled={ocupado} onClick={() => analizar(sel.url)}>Reintentar</button>}
                  <button type="button" style={btnSuave} onClick={() => borrar(sel.url)}>Quitar de la lista</button>
                </div>
              </div>
            ) : (
              <>
                {/* Veredicto */}
                <div style={{ ...card, display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 92, flex: 'none', textAlign: 'center' }}>
                    <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, lineHeight: 1, color: scoreColor(sel.score) }}>{fmtScore(sel.score)}</div>
                    <div style={{ ...eyebrow, marginTop: 6 }}>de 10</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999, background: toneBg(sel.veredicto_tone), color: toneColor(sel.veredicto_tone), marginBottom: 10 }}>
                      {sel.veredicto}
                    </div>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{sel.resumen}</p>
                    {/* Honestidad sobre la fuente: si el copy lo pegó el dueño, el
                        análisis vale igual pero la página no se lee sola, y eso
                        cambia qué tan al día está el diagnóstico. */}
                    {sel.bloqueada && (
                      <div style={{ marginTop: 12, padding: '9px 13px', borderRadius: 9, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 12.5, lineHeight: 1.5 }}>
                        Este diagnóstico salió del texto que pegaste: la página se arma en el navegador y MaKo no puede leerla sola. Si cambias el copy, vuelve a pegarlo.
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                      <a href={sel.url_final ?? sel.url} target="_blank" rel="noreferrer noopener" style={{ ...btnSuave, textDecoration: 'none', display: 'inline-block' }}>Ver la página ↗</a>
                      {/* Si el copy vino pegado, "volver a analizar" bajaría la
                          página, volvería a detectar que es JS-only y pisaría el
                          análisis con un error: hay que volver a pedir el texto. */}
                      <button type="button" style={{ ...btnSuave, opacity: ocupado ? 0.55 : 1 }} disabled={ocupado}
                        onClick={() => (sel.bloqueada
                          ? setPegar({ url: sel.url, texto: '' })
                          : analizar(sel.url))}>
                        {corriendo === sel.url ? 'Analizando…' : sel.bloqueada ? 'Actualizar el texto' : 'Volver a analizar'}
                      </button>
                      <Link href={`/landing-generator/crear?url=${encodeURIComponent(sel.url)}`} style={{ ...btnPrimario, textDecoration: 'none', display: 'inline-block' }}>
                        Escribir la nueva versión
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Lo medido */}
                <Comportamiento c={sel.comportamiento} />

                {/* Promesa + avatar */}
                {(sel.promesa || sel.avatar) && (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {sel.promesa && (
                      <div style={{ ...card, flex: 1, minWidth: 240 }}>
                        <div style={{ ...eyebrow, marginBottom: 8 }}>La promesa que se lee</div>
                        <div style={{ fontSize: 15, lineHeight: 1.55, fontWeight: 600 }}>{sel.promesa}</div>
                      </div>
                    )}
                    {sel.avatar && (
                      <div style={{ ...card, flex: 1, minWidth: 240 }}>
                        <div style={{ ...eyebrow, marginBottom: 8 }}>A quién le habla</div>
                        <div style={{ fontSize: 15, lineHeight: 1.55 }}>{sel.avatar}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dimensiones */}
                {sel.dims?.length ? (
                  <div style={card}>
                    <div style={{ ...eyebrow, marginBottom: 14 }}>Cómo puntúa</div>
                    <Dims dims={sel.dims} />
                  </div>
                ) : null}

                {/* Hallazgos */}
                {sel.hallazgos?.length ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={eyebrow}>Qué arreglar · {sel.hallazgos.length}</div>
                    {sel.hallazgos.map((h, i) => <Hallazgo key={`${h.titulo}-${i}`} h={h} />)}
                  </div>
                ) : null}

                {/* Recomendaciones */}
                {sel.recomendaciones?.length ? (
                  <div style={card}>
                    <div style={{ ...eyebrow, marginBottom: 12 }}>Por dónde empezar</div>
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 9 }}>
                      {sel.recomendaciones.map((r, i) => (
                        <li key={i} style={{ fontSize: 14, lineHeight: 1.55 }}>{r}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {/* La página, sección por sección */}
                {sel.secciones?.length ? (
                  <div style={card}>
                    <div style={{ ...eyebrow, marginBottom: 14 }}>La página, de arriba a abajo</div>
                    <div style={{ display: 'grid', gap: 14 }}>
                      {sel.secciones.map((s, i) => (
                        <div key={i} style={{ paddingLeft: 14, borderLeft: `2px solid ${toneColor(s.tone)}` }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: MONO, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>{s.tipo}</span>
                            <span style={{ fontSize: 14, fontWeight: 650 }}>{s.titulo}</span>
                          </div>
                          {s.copy && <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>{s.copy}</div>}
                          {s.diagnostico && <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5, color: toneColor(s.tone) }}>{s.diagnostico}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>
                  <span>Analizada el {fechaCorta(sel.analyzed_at)} · {sel.palabras ?? '—'} palabras leídas</span>
                  <button type="button" onClick={() => borrar(sel.url)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontFamily: MONO, fontSize: 11.5 }}>
                    Quitar de la lista
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ⛔ Acá iban los KPIs del pie (páginas analizadas, puntaje promedio, hallazgos graves):
          son análisis y viven en la hoja «Landing» del Dashboard desde el 11/10/2026. */}
    </main>
  );
}
