'use client';

// =============================================================================
// entidades/anuncio — la ficha de UN anuncio, partida en piezas (tanda v5, punto 21 e I3 del contrato)
// =============================================================================
// Martín (12/10/2026): el pop-up «Anuncio» es lo que vuelve el pop-up de métricas de cada anuncio que tenía la
// tab Ads Analyst (AdDetailTabs, app/marketing/ad-charts.tsx:537). Se arma SOBRE sus piezas, sin moverlas: el
// creativo (`AdCreative`), los números del período, el rendimiento diario (`RendimientoBody`), la audiencia
// (`BreakdownCharts`), el guion por beats (`FunnelModal` embebido, app/ads-analyst/ScriptsBrowser.tsx), el
// diagnóstico de la IA, el transcript (`TranscriptSection`) y `completo` (la ficha entera: `AdDetailTabs` en
// línea cuando el anuncio tiene su análisis de guion).
//
// Lo que no se ve en la firma:
//   · SE CARGA APARTE (next/dynamic, desde ./PiezaEntidad.tsx): ad-charts arrastra recharts y el Ads Analyst
//     entero, y la hoja no lo necesita hasta que alguien abre un anuncio.
//   · UNA LECTURA POR ANUNCIO Y PERÍODO, compartida por las piezas: GET /api/ad-insights (Meta EN VIVO) y GET
//     /api/ads-analyst/view (el análisis del guion). Son los MISMOS lectores del Ads Manager y de /anuncio/<id>.
//   · El período es el del gráfico que abrió el pop-up (lo pasa el pop-up). Sin él, los últimos 30 días hasta ayer.
//   · Las tareas del guion (re-analizar, cambiar ángulo o avatar) son las MISMAS rutas que usa AdDetailTabs.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Spinner } from '@/app/_ui';
import { ayerEnTijuana, diasAntes } from '@/lib/date-utils';
import type { ScriptView } from '@/lib/ads-analyst';
import { AdCreative, AdDetailTabs, BreakdownCharts, RendimientoBody, TranscriptSection, fmtUSD, type AdInsights } from '@/app/marketing/ad-charts';
import { FunnelModal, applyAngles, applyAvatares, type AngleDef, type AvatarDef } from '@/app/ads-analyst/ScriptsBrowser';

/** Cuánto espera cada pedido: Meta en vivo puede tardar (sin `signal`, una conexión caída gira para siempre). */
const TOPE_MS = 45_000;
const fmtNum = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtPct = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : `${n < 10 ? n.toFixed(1) : n.toFixed(0)}%`);

// ── La lectura: UNA por anuncio y período, compartida ─────────────────────────────────────────

type Lectura = { cargando: boolean; datos: AdInsights | null; guion: ScriptView | null; error: string | null };
const LECTURAS = new Map<string, Lectura>();
const AVISAR = new Set<() => void>();
const avisar = () => { for (const f of AVISAR) f(); };
const suscribir = (f: () => void) => { AVISAR.add(f); return () => { AVISAR.delete(f); }; };

async function json<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TOPE_MS), cache: 'no-store' });
  return (await r.json().catch(() => null)) as T | null;
}

function pedir(clave: string, adId: string, desde: string, hasta: string): void {
  LECTURAS.set(clave, { cargando: true, datos: LECTURAS.get(clave)?.datos ?? null, guion: LECTURAS.get(clave)?.guion ?? null, error: null });
  avisar();
  Promise.all([
    json<AdInsights & { error?: string }>(`/api/ad-insights?ad_id=${encodeURIComponent(adId)}&desde=${desde}&hasta=${hasta}`).catch(() => null),
    json<{ ok?: boolean; view?: ScriptView | null }>(`/api/ads-analyst/view?ad_id=${encodeURIComponent(adId)}`).catch(() => null),
  ]).then(([d, v]) => {
    const error = !d ? 'No pude leer el anuncio en Meta' : d.error ? `Meta: ${d.error}` : null;
    LECTURAS.set(clave, { cargando: false, datos: d && !d.error ? d : null, guion: v?.ok && v.view ? v.view : null, error });
  }).finally(avisar);
}

/** Lo del anuncio `adId` en el período (Meta y su guion), y cómo volver a pedirlo. */
export function useAnuncio(adId: string, desde: string, hasta: string) {
  const clave = `${adId}|${desde}|${hasta}`;
  const l = useSyncExternalStore(suscribir, () => LECTURAS.get(clave), () => undefined);
  useEffect(() => { if (!LECTURAS.has(clave)) pedir(clave, adId, desde, hasta); }, [clave, adId, desde, hasta]);
  const recargar = useCallback(() => pedir(clave, adId, desde, hasta), [clave, adId, desde, hasta]);
  return { cargando: !l || l.cargando, datos: l?.datos ?? null, guion: l?.guion ?? null, error: l?.error ?? null, recargar };
}

/** El período del pop-up, o los últimos 30 días hasta ayer (el mismo default «a ayer» de la pauta). */
export function periodoDeAnuncio(p?: { desde?: string; hasta?: string } | null): { desde: string; hasta: string } {
  if (p?.desde && p?.hasta && /^\d{4}-\d{2}-\d{2}$/.test(p.desde) && /^\d{4}-\d{2}-\d{2}$/.test(p.hasta) && p.desde <= p.hasta) return { desde: p.desde, hasta: p.hasta };
  const ayer = ayerEnTijuana();
  return { desde: diasAntes(ayer, 29), hasta: ayer };
}

// ── El vocabulario de ángulos y avatares del guion (lo mismo que hace AdDetailTabs) ───────────

function useVocabulario() {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      json<{ ok?: boolean; angles?: AngleDef[] }>('/api/ads-analyst/angles').catch(() => null),
      json<{ ok?: boolean; avatares?: AvatarDef[] }>('/api/ads-analyst/avatares').catch(() => null),
    ]).then(([a, v]) => {
      if (!vivo) return;
      if (a?.ok && a.angles?.length) applyAngles(a.angles);
      if (v?.ok && v.avatares) applyAvatares(v.avatares);
      setListo(true);
    });
    return () => { vivo = false; };
  }, []);
  return listo;
}

async function postear(url: string, cuerpo: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(125_000) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    return j?.ok ? null : j?.error || 'No se pudo';
  } catch { return 'No se pudo'; }
}

function PiezaGuion({ guion, recargar }: { guion: ScriptView; recargar: () => void }) {
  const listo = useVocabulario();
  const [msg, setMsg] = useState<string | null>(null);
  const correr = async (url: string, cuerpo: Record<string, unknown>, enCurso: string) => {
    setMsg(enCurso);
    const e = await postear(url, cuerpo);
    setMsg(e ? `Error: ${e}` : 'Listo.');
    if (!e) recargar();
  };
  if (!listo) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 60 }}><Spinner size={16} /></div>;
  return (
    <FunnelModal embedded sel={guion} onClose={() => {}} reMsg={msg}
      onReanalizar={(id) => void correr('/api/ads-analyst/analyze', { ad_id: id }, 'Re-analizando…')}
      onSetAngle={(id, angle) => void correr('/api/ads-analyst/angle-override', { ad_id: id, angle }, angle ? 'Cambiando ángulo…' : 'Volviendo a la IA…')}
      onSetAvatar={(id, avatar) => void correr('/api/ads-analyst/avatar-override', { ad_id: id, avatar }, avatar ? 'Cambiando avatar…' : 'Volviendo a la IA…')} />
  );
}

const Nada = ({ texto }: { texto: string }) => <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>{texto}</p>;

/** Una pieza de la ficha del anuncio `adId` (PIEZAS_ENTIDAD.anuncio). */
export default function PiezaAnuncio({ adId, pieza, periodo }: { adId: string; pieza: string; periodo?: { desde?: string; hasta?: string } | null }) {
  const { desde, hasta } = periodoDeAnuncio(periodo);
  const a = useAnuncio(adId, desde, hasta);
  if (a.cargando && !a.datos && !a.guion) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 60 }}><Spinner size={16} /></div>;
  const p = a.datos?.period ?? null;
  const g = a.guion;

  if (pieza === 'completo') {
    // Con su análisis de guion, la ficha de siempre (AdDetailTabs, en línea: el pop-up es la caja).
    if (g) return <AdDetailTabs key={adId} scriptView={g} desde={desde} hasta={hasta} defaultTab="rendimiento" inline />;
    // Sin él, la misma ficha con lo que hay: el creativo y los números de Meta.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {a.error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)' }}>{a.error}</p>}
        <strong style={{ fontSize: 17, color: 'var(--ink)' }}>{p?.ad_name ?? 'Anuncio'}</strong>
        {p && <Creativo adId={adId} datos={a.datos!} guion={null} />}
        {p && <RendimientoBody data={a.datos!} cierres={0} cashUsd={null} />}
        {a.datos && <BreakdownCharts demograficos={a.datos.demograficos} plataformas={a.datos.plataformas} regiones={a.datos.regiones} />}
        <Nada texto="Este anuncio todavía no tiene análisis de guion." />
      </div>
    );
  }

  switch (pieza) {
    case 'creativo': return a.datos || g ? <Creativo adId={adId} datos={a.datos} guion={g} /> : <Nada texto={a.error ?? 'Sin datos del anuncio.'} />;
    case 'numeros': return p ? <Numeros p={p} cierres={g?.cierres ?? null} /> : <Nada texto={a.error ?? 'Sin datos de Meta en este período.'} />;
    case 'diario': return p ? <RendimientoBody data={a.datos!} cierres={g?.cierres ?? 0} cashUsd={null} /> : <Nada texto={a.error ?? 'Sin datos de Meta en este período.'} />;
    case 'audiencia': return a.datos ? <BreakdownCharts demograficos={a.datos.demograficos} plataformas={a.datos.plataformas} regiones={a.datos.regiones} /> : <Nada texto={a.error ?? 'Sin datos de Meta.'} />;
    case 'guion': return g ? <PiezaGuion guion={g} recargar={a.recargar} /> : <Nada texto="Este anuncio todavía no tiene análisis de guion." />;
    case 'diagnostico': return g ? <Diagnostico guion={g} /> : <Nada texto="Este anuncio todavía no tiene análisis de guion." />;
    case 'transcript': return a.datos ? <TranscriptSection key={adId} adId={adId} initialTr={a.datos.transcript} /> : <Nada texto={a.error ?? 'Sin datos del anuncio.'} />;
    default: return <Nada texto="Esta pieza ya no existe." />;
  }
}

function Creativo({ adId, datos, guion }: { adId: string; datos: AdInsights | null; guion: ScriptView | null }) {
  const p = datos?.period ?? null;
  const stats = p
    ? [
        { label: 'Gasto', value: fmtUSD(p.spend_usd, 0) },
        { label: 'Leads', value: fmtNum(p.leads) },
        { label: 'Agendas', value: fmtNum(p.agendas), color: p.agendas > 0 ? 'var(--good)' : undefined },
        { label: 'Cierres', value: fmtNum(guion?.cierres ?? null) },
      ]
    : [{ label: 'Gasto', value: fmtUSD(guion?.spend ?? null, 0) }, { label: 'Agendas', value: fmtNum(guion?.agendas ?? null) }];
  return (
    <AdCreative compact adId={adId} adName={guion?.name ?? p?.ad_name ?? 'Anuncio'} thumbnail={guion?.thumbnail ?? null}
      permalink={guion?.permalink ?? null} creativeSinEnlace={guion?.creativeSinEnlace ?? true} stats={stats} />
  );
}

/** Los números del período, de Meta: lo que cuesta y lo que trae. */
function Numeros({ p, cierres }: { p: NonNullable<AdInsights['period']>; cierres: number | null }) {
  const filas: Array<[string, string]> = [
    ['Gasto', fmtUSD(p.spend_usd, 0)], ['Impresiones', fmtNum(p.impressions)], ['Alcance', fmtNum(p.reach)], ['Frecuencia', p.frequency ? p.frequency.toFixed(2) : '—'],
    ['Clics al enlace', fmtNum(p.link_clicks)], ['CTR', fmtPct(p.ctr)], ['Leads', fmtNum(p.leads)], ['Agendas', fmtNum(p.agendas)],
    ['CPM', fmtUSD(p.cpm_usd)], ['CPC', fmtUSD(p.cpc_usd)], ['Costo por agenda', p.agendas ? fmtUSD(p.spend_usd / p.agendas, 0) : '—'], ['Cierres', fmtNum(cierres)],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
      {filas.map(([k, v]) => (
        <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{k}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/** El diagnóstico que escribió la IA del Ads Analyst sobre el guion, y el gancho a probar. */
function Diagnostico({ guion }: { guion: ScriptView }) {
  if (!guion.note && !guion.suggestion) return <Nada texto="Sin diagnóstico." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {guion.note && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{guion.note.title}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--dim)', marginTop: 4 }}>{guion.note.text}</div>
        </div>
      )}
      {guion.suggestion && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Gancho a probar</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>{guion.suggestion}</div>
        </div>
      )}
    </div>
  );
}
