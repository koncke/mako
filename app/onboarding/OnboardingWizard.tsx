'use client';

// =============================================================================
// OnboardingWizard — alta guiada del cliente nuevo (bloqueante)
// =============================================================================
// Overlay full-screen (tapa el sidebar, patrón /login). 4 pasos:
//   1 Integraciones (Meta y WhatsApp obligatorias, probadas) → dispara la
//     EXTRACCIÓN histórica en background (panel lateral con progreso en vivo)
//   2 Datos de tus tabs (funnel por plantilla + metas + contacto de reportes)
//   3 Tu negocio (OnboardingForm embebido)
//   4 Tu primera Retro (streaming NDJSON de /api/retro → RetroReport)
// "Completar después" (status 'skipped') libera el dashboard; el wizard se
// retoma desde Configuraciones → Onboarding.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { MakoLogo, MakoStar } from '../_components/MakoBrand';
import { OnboardingForm } from './OnboardingForm';
import { RetroReport } from '../experimentos/RetroReport';
import type { RetroReporte, RetroPlanItem, RetroStreamEvent, RetroFaseId } from '@/lib/retro-reporte';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' };
const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });

// ── Tipos del API ─────────────────────────────────────────────────────────────

type Campo = { env: string; label: string; placeholder?: string; secreto: boolean; opcional: boolean; nota?: string; configurado: boolean; mask: string };
type Servicio = { key: string; nombre: string; categoria: string; paraQue: string; requerido: boolean; conectada: boolean; campos: Campo[]; tutorial: { pasos: string[]; url?: string; urlLabel?: string } };
type JobState = { status: 'pending' | 'running' | 'done' | 'error' | 'skipped'; cursor?: string | null; detail?: string | null; error?: string | null };
type Extraction = { status: 'idle' | 'running' | 'done' | 'error'; jobs: Record<string, JobState> };
type Conteos = { metricas_filas: number; metricas_desde: string | null; metricas_hasta: string | null; leads: number; transcripts: number; scripts: number; llamadas: number; vsl_filas: number };
type Estado = {
  status: 'pending' | 'in_progress' | 'skipped' | 'done';
  steps: { integraciones: { done: boolean }; tabs: { done: boolean }; negocio: { done: boolean }; retro: { done: boolean; retroId?: number | null }; plan: { done: boolean } };
  extraction: Extraction;
};
type WizardData = {
  estado: Estado;
  servicios: Servicio[];
  requeridos: string[];
  /** Los pasos que le tocan a ESTE cliente, según su capa (lib/capas.ts). */
  pasos: Paso[];
  capa: { id: string; nombre: string };
  settings: Record<string, string>;
  contacto: { nombre: string; email: string; telefono: string };
  usuario: { nombre: string; email: string };
  funnelTemplates: Array<{ id: string; name: string; description: string; etapas: string[] }>;
};
type RetroRow = { id: number; periodo_desde: string; periodo_hasta: string; reporte: RetroReporte | null };

// El wizard ya NO tiene los pasos clavados: el servidor manda cuáles según la
// capa que compró el cliente. Uno de Project Manager no conecta integraciones,
// así que su wizard son dos pantallas y adentro.
type Paso = 'integraciones' | 'tabs' | 'negocio' | 'retro' | 'plan';
const PASO_TITULO: Record<Paso, string> = {
  integraciones: 'Conectá tus integraciones',
  tabs: 'Los datos de tus tabs',
  negocio: 'Tu negocio',
  retro: 'Tu primera Retro',
  plan: 'Tu plan',
};

const JOB_LABELS: Record<string, string> = {
  meta_metrics: 'Métricas de Meta',
  meta_leads: 'Leads de formularios',
  ad_transcripts: 'Transcripción de anuncios',
  script_analyses: 'Análisis de guiones',
  fathom_calls: 'Llamadas de venta (Fathom)',
  vsl_metrics: 'Métricas del VSL',
};

// Campos del catálogo que en el wizard se reemplazan por su SETTING equivalente
// (la extracción y los crons leen la setting; mostrar ambos confundiría).
const CAMPOS_OCULTOS_WIZARD = new Set(['YOUTUBE_VSL_VIDEO_ID', 'PANDA_VSL_VIDEO_IDS']);

// Settings extra que se cargan junto a cada servicio (no son credenciales).
const SETTINGS_POR_SERVICIO: Record<string, Array<{ key: string; label: string; placeholder?: string; nota?: string }>> = {
  meta: [{ key: 'meta_page_id', label: 'ID de tu página de Facebook', placeholder: '1234567890', nota: 'Para traer los leads de tus formularios. Está en la sección "Información" de tu página.' }],
  youtube: [
    { key: 'youtube_vsl_video_id', label: 'ID del video del VSL', placeholder: 'dQw4w9WgXcQ' },
    { key: 'youtube_thanks_video_id', label: 'ID del video de Gracias', placeholder: '(opcional)' },
    { key: 'youtube_thanks_prep_video_id', label: 'ID del video de preparación', placeholder: '(opcional)' },
  ],
  panda: [{ key: 'panda_vsl_video_ids', label: 'IDs de videos del VSL', placeholder: 'id1,id2', nota: 'Separados por coma.' }],
};

async function post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    return await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// =============================================================================
export function OnboardingWizard() {
  const [data, setData] = useState<WizardData | null>(null);
  const [errCarga, setErrCarga] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>('integraciones');
  const [ext, setExt] = useState<Extraction | null>(null);
  const [conteos, setConteos] = useState<Conteos | null>(null);
  const [reporteVisible, setReporteVisible] = useState(false);
  const tickeando = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding')).json();
      if (!j.ok) { setErrCarga(j.error ?? 'No se pudo cargar el onboarding.'); return null; }
      const d = j as unknown as WizardData & { ok: boolean };
      setData(d);
      setExt(d.estado.extraction);
      // Retomar en el primer paso incompleto DE SU CAPA (el estado guarda todos
      // los pasos posibles, pero solo se muestran los que le tocan).
      const pendiente = d.pasos.find((p) => !d.estado.steps[p]?.done) ?? d.pasos[d.pasos.length - 1];
      if (pendiente) setPaso(pendiente);
      return d;
    } catch (e) {
      setErrCarga(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Refresh liviano de servicios (tras guardar credenciales) sin resetear el paso.
  const refreshServicios = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding')).json();
      if (j.ok) setData((d) => (d ? { ...d, servicios: j.servicios, settings: j.settings, estado: j.estado } : d));
    } catch { /* no fatal */ }
  }, []);

  // ── Extracción: poll de estado + loop de ticks ─────────────────────────────
  const pollEstado = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding/extraccion')).json();
      if (j.ok) { setExt(j.extraction as Extraction); setConteos(j.conteos as Conteos); }
    } catch { /* no fatal */ }
  }, []);

  useEffect(() => {
    if (!ext || ext.status === 'idle') return;
    const t = setInterval(pollEstado, 6000);
    return () => clearInterval(t);
  }, [ext?.status === 'idle', pollEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  const loopTicks = useCallback(async () => {
    if (tickeando.current) return;
    tickeando.current = true;
    try {
      for (let i = 0; i < 200; i++) {
        const t0 = Date.now();
        const j = await post('/api/onboarding/extraccion', { action: 'tick' });
        if (!j.ok) break;
        const e = j.extraction as Extraction;
        setExt(e);
        if (e.status !== 'running') break;
        // Un tick que vuelve enseguida = otro runner tiene el lease (u otra
        // pestaña trabaja): esperar antes de reintentar para no martillar.
        if (Date.now() - t0 < 5_000) await new Promise((r) => setTimeout(r, 15_000));
      }
    } finally { tickeando.current = false; }
  }, []);

  const arrancarExtraccion = useCallback(async () => {
    const j = await post('/api/onboarding/extraccion', { action: 'start' });
    if (j.ok) {
      setExt(j.extraction as Extraction);
      if ((j.extraction as Extraction).status === 'running') loopTicks();
    }
  }, [loopTicks]);

  // Si al montar la extracción quedó corriendo (volvió al wizard), retomar ticks.
  useEffect(() => {
    if (data && data.estado.extraction.status === 'running') loopTicks();
  }, [data, loopTicks]);

  const marcarPaso = async (step: Paso) => {
    await post('/api/onboarding', { action: 'paso', step, done: true });
    const pasos = data?.pasos ?? [];
    const idx = pasos.indexOf(step);
    if (idx >= 0 && idx < pasos.length - 1) setPaso(pasos[idx + 1]);
  };

  // Adónde sale del wizard. NO es siempre /general: una capa que no compró los
  // tableros no puede verlo (requireCapa lo rebotaría), así que su casa es el
  // board. Espeja homeDeCapa() de lib/tab-access.
  const home = data?.pasos.includes('integraciones') ? '/general' : '/plan';

  const completarDespues = async () => {
    await post('/api/onboarding', { action: 'paso', skip: true });
    window.location.href = home;
  };

  if (errCarga) {
    return (
      <Overlay>
        <div style={{ ...card, maxWidth: 560, margin: '120px auto', color: 'var(--bad)', fontWeight: 600, fontSize: 14 }}>{errCarga}</div>
      </Overlay>
    );
  }
  if (!data) {
    return (
      <Overlay>
        <div style={{ ...card, maxWidth: 560, margin: '120px auto', color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando tu onboarding…</div>
      </Overlay>
    );
  }

  const pasos = data.pasos;
  const pasoIdx = pasos.indexOf(paso);
  // El panel de extracción solo tiene sentido en una capa que extrae histórico.
  const mostrarPanel = ext != null && ext.status !== 'idle' && pasos.includes('integraciones');

  return (
    <Overlay>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <MakoLogo size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', lineHeight: 1.1 }}>Configuremos tu negocio</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 3 }}>Paso {pasoIdx + 1} de {pasos.length} — {PASO_TITULO[paso]}</div>
        </div>
        <div style={{ display: 'flex', gap: 7, marginLeft: 24 }}>
          {pasos.map((p, i) => (
            <span key={p} style={{ width: i === pasoIdx ? 22 : 7, height: 7, borderRadius: 999, background: i === pasoIdx ? 'var(--primary)' : data.estado.steps[p]?.done ? 'var(--good)' : 'var(--border-strong)', transition: 'all .2s' }} />
          ))}
        </div>
        <button type="button" onClick={completarDespues} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>Completar después</button>
      </div>

      {/* Cuerpo: pasos + panel lateral */}
      <div style={{ display: 'flex', gap: 24, padding: '28px 28px 60px', maxWidth: 1180, margin: '0 auto', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {paso === 'integraciones' && (
            <PasoIntegraciones
              data={data}
              onGuardado={refreshServicios}
              onMetaVerificada={arrancarExtraccion}
              onContinuar={async () => { await arrancarExtraccion(); await marcarPaso('integraciones'); }}
            />
          )}
          {paso === 'tabs' && <PasoTabs data={data} onContinuar={() => marcarPaso('tabs')} onVolver={() => setPaso('integraciones')} />}
          {paso === 'negocio' && (
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 4px' }}>Tu negocio</h2>
              <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 14px' }}>Esto alimenta el contexto de MaKo: mejores respuestas, mejores análisis.</p>
              <OnboardingForm embedded onComplete={() => marcarPaso('negocio')} />
            </div>
          )}
          {paso === 'retro' && (
            <PasoRetro
              ext={ext}
              retroDone={data.estado.steps.retro.done}
              onReporteVisible={() => setReporteVisible(true)}
              onFinalizada={async (retroId) => {
                await post('/api/onboarding', { action: 'paso', step: 'retro', done: true, retroId });
              }}
            />
          )}
          {paso === 'plan' && (
            <PasoPlan onFinalizar={async () => {
              await post('/api/onboarding', { action: 'paso', step: 'plan', done: true });
              window.location.href = '/plan';
            }} />
          )}
        </div>

        {mostrarPanel && !reporteVisible && <PanelExtraccion ext={ext!} conteos={conteos} onRetry={async (job) => { await post('/api/onboarding/extraccion', { action: 'retry', job }); loopTicks(); }} />}
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg)', overflowY: 'auto', fontFamily: SANS }}>
      {children}
    </div>
  );
}

// =============================================================================
// Paso 1 — Integraciones
// =============================================================================
function PasoIntegraciones({ data, onGuardado, onMetaVerificada, onContinuar }: {
  data: WizardData;
  onGuardado: () => Promise<void>;
  onMetaVerificada: () => Promise<void>;
  onContinuar: () => Promise<void>;
}) {
  const requeridos = data.servicios.filter((s) => s.requerido);
  const opcionales = data.servicios.filter((s) => !s.requerido);
  // verificado por servicio (para exigir "conectada y PROBADA")
  const [verificado, setVerificado] = useState<Record<string, boolean>>({});
  const [continuando, setContinuando] = useState(false);

  // Al montar: los servicios ya conectados se re-verifican solos (para que al
  // volver al wizard no haya que re-probar a mano).
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const s of data.servicios) {
        if (!s.conectada || verificado[s.key] != null) continue;
        const j = await post('/api/onboarding', { action: 'verificar', servicio: s.key });
        if (!alive) return;
        setVerificado((v) => ({ ...v, [s.key]: Boolean(j.ok) }));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listo = requeridos.every((s) => s.conectada && verificado[s.key]);

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 4px' }}>Conectá tus integraciones</h2>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 640 }}>Con <b>Meta</b> y <b>WhatsApp</b> conectados, MaKo empieza a extraer tu histórico al instante (lo ves al costado). Las demás las podés conectar ahora o después.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {requeridos.map((s) => (
          <ServicioCard key={s.key} servicio={s} settings={data.settings} abiertoInicial verificado={verificado[s.key]}
            onVerificado={async (ok) => {
              setVerificado((v) => ({ ...v, [s.key]: ok }));
              if (ok && s.key === 'meta') await onMetaVerificada();
            }}
            onGuardado={onGuardado} />
        ))}
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', margin: '8px 0 0' }}>Opcionales — suman más análisis</div>
        {opcionales.map((s) => (
          <ServicioCard key={s.key} servicio={s} settings={data.settings} verificado={verificado[s.key]}
            onVerificado={async (ok) => {
              setVerificado((v) => ({ ...v, [s.key]: ok }));
              if (ok) await onMetaVerificada(); // re-evalúa jobs (revive skipped)
            }}
            onGuardado={onGuardado} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
        <button style={{ ...btnDark, opacity: listo && !continuando ? 1 : 0.4, cursor: listo ? 'pointer' : 'default' }} disabled={!listo || continuando}
          onClick={async () => { setContinuando(true); try { await onContinuar(); } finally { setContinuando(false); } }}>
          {continuando ? 'Guardando…' : 'Continuar →'}
        </button>
      </div>
      {!listo && <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--warn)', marginTop: 8 }}>Conectá y probá Meta y WhatsApp para continuar.</div>}
    </div>
  );
}

function ServicioCard({ servicio, settings, abiertoInicial = false, verificado, onVerificado, onGuardado }: {
  servicio: Servicio;
  settings: Record<string, string>;
  abiertoInicial?: boolean;
  verificado?: boolean;
  onVerificado: (ok: boolean) => Promise<void>;
  onGuardado: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [valores, setValores] = useState<Record<string, string>>({});
  const extras = SETTINGS_POR_SERVICIO[servicio.key] ?? [];
  const [extrasVal, setExtrasVal] = useState<Record<string, string>>(() => Object.fromEntries(extras.map((e) => [e.key, settings[e.key] ?? ''])));
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [tutorialAbierto, setTutorialAbierto] = useState(false);

  const probar = async () => {
    setProbando(true); setResultado(null);
    try {
      // 1) guardar credenciales tipeadas
      const conValores = Object.fromEntries(Object.entries(valores).filter(([, v]) => v.trim()));
      if (Object.keys(conValores).length > 0) {
        const g = await post('/api/onboarding', { action: 'guardar', servicio: servicio.key, valores: conValores });
        if (!g.ok) { setResultado({ ok: false, texto: String(g.error ?? 'No se pudo guardar.') }); return; }
        setValores({});
      }
      // 2) settings extra (page id / video ids)
      const extrasCambiadas = Object.fromEntries(Object.entries(extrasVal).filter(([k, v]) => (settings[k] ?? '') !== v));
      if (Object.keys(extrasCambiadas).length > 0) await post('/api/onboarding', { action: 'config', settings: extrasCambiadas });
      // 3) probar conexión (contra lo guardado)
      const r = await post('/api/onboarding', { action: 'verificar', servicio: servicio.key });
      const ok = Boolean(r.ok);
      setResultado({ ok, texto: String(ok ? (r.detalle ?? 'Conexión OK.') : (r.error ?? 'Falló la conexión.')) });
      await onGuardado();
      await onVerificado(ok);
    } finally { setProbando(false); }
  };

  const estado = verificado === true
    ? chip('var(--good-bg)', 'var(--good)')
    : servicio.conectada
      ? chip('var(--warn-bg)', 'var(--warn)')
      : chip('var(--surface-2)', 'var(--dim)');
  const estadoTxt = verificado === true ? 'conectado ✓' : servicio.conectada ? 'guardado — probá la conexión' : servicio.requerido ? 'requerido' : 'sin conectar';

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}>
        <span style={{ flex: 'none', color: 'var(--dim)', fontSize: 12, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▸</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{servicio.nombre}</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{servicio.paraQue}</div>
        </div>
        <span style={estado}>{estadoTxt}</span>
      </button>

      {abierto && (
        <div style={{ padding: '4px 18px 18px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {servicio.tutorial.pasos.length > 0 && (
            <div>
              <button type="button" onClick={() => setTutorialAbierto((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {tutorialAbierto ? '▾ Ocultar tutorial' : '▸ ¿Cómo consigo esto? (tutorial paso a paso)'}
              </button>
              {tutorialAbierto && (
                <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
                  {servicio.tutorial.pasos.map((p, i) => <li key={i}>{p}</li>)}
                  {servicio.tutorial.url && <li><a href={servicio.tutorial.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{servicio.tutorial.urlLabel ?? servicio.tutorial.url} ↗</a></li>}
                </ol>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {servicio.campos.filter((c) => !CAMPOS_OCULTOS_WIZARD.has(c.env)).map((c) => (
              <div key={c.env} style={{ gridColumn: c.secreto ? 'span 2' : undefined }}>
                <label style={labelStyle}>{c.label}{c.opcional ? ' (opcional)' : ''}</label>
                <input
                  style={input}
                  type={c.secreto ? 'password' : 'text'}
                  value={valores[c.env] ?? ''}
                  placeholder={c.configurado ? (c.mask ? `guardado ••••${c.mask}` : 'guardado ✓') : (c.placeholder ?? '')}
                  onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
                />
                {c.nota && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>{c.nota}</div>}
              </div>
            ))}
            {extras.map((e) => (
              <div key={e.key}>
                <label style={labelStyle}>{e.label}</label>
                <input style={input} value={extrasVal[e.key] ?? ''} placeholder={e.placeholder} onChange={(ev) => setExtrasVal((v) => ({ ...v, [e.key]: ev.target.value }))} />
                {e.nota && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>{e.nota}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={{ ...btnDark, padding: '9px 16px', fontSize: 13, opacity: probando ? 0.6 : 1 }} disabled={probando} onClick={probar}>
              {probando ? 'Probando…' : 'Guardar y probar conexión'}
            </button>
            {resultado && <span style={{ fontSize: 13, fontWeight: 600, color: resultado.ok ? 'var(--good)' : 'var(--bad)' }}>{resultado.texto}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Paso 2 — Datos de tus tabs (funnel + metas + contacto)
// =============================================================================
function PasoTabs({ data, onContinuar, onVolver }: { data: WizardData; onContinuar: () => Promise<void>; onVolver: () => void }) {
  const [tpl, setTpl] = useState('highticket');
  const [cierres, setCierres] = useState(data.settings.objetivo_cierres ?? '');
  const [cash, setCash] = useState(data.settings.objetivo_cash_usd ?? '');
  const [nombre, setNombre] = useState(data.contacto.nombre || data.usuario.nombre);
  const [email, setEmail] = useState(data.contacto.email || data.usuario.email);
  const [telefono, setTelefono] = useState(data.contacto.telefono);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const continuar = async () => {
    setGuardando(true); setErr(null);
    try {
      const f = await post('/api/onboarding', { action: 'funnel', templateId: tpl });
      if (!f.ok) { setErr(String(f.error ?? 'No se pudo guardar el funnel.')); return; }
      await post('/api/onboarding', { action: 'config', settings: { objetivo_cierres: cierres.trim(), objetivo_cash_usd: cash.trim() } });
      await post('/api/onboarding', { action: 'contacto', contacto: { nombre, email, telefono } });
      await onContinuar();
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 4px' }}>Los datos de tus tabs</h2>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 640 }}>Tu funnel es la fuente de verdad del CRM y las métricas. Elegí el que más se parezca a cómo vendés — lo podés ajustar después en Configuraciones → Funnel.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {data.funnelTemplates.map((t) => (
          <button key={t.id} type="button" onClick={() => setTpl(t.id)}
            style={{ ...card, textAlign: 'left', cursor: 'pointer', fontFamily: SANS, border: tpl === t.id ? '2px solid var(--primary)' : '1px solid var(--border)', padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {t.name}
              {tpl === t.id && <span style={{ color: 'var(--primary)', fontSize: 13 }}>✓</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', margin: '4px 0 8px' }}>{t.description}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{t.etapas.join(' → ')}</div>
          </button>
        ))}
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', marginBottom: 12 }}>Tu meta mensual <span style={{ fontWeight: 500, color: 'var(--faint)', fontSize: 12.5 }}>(opcional — le da norte al dashboard)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Cierres por mes</label><input style={input} type="number" value={cierres} onChange={(e) => setCierres(e.target.value)} placeholder="Ej. 10" /></div>
          <div><label style={labelStyle}>Cash mensual (USD)</label><input style={input} type="number" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Ej. 50000" /></div>
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', marginBottom: 12 }}>¿A dónde te mandamos los reportes?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Nombre</label><input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div><label style={labelStyle}>Email</label><input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label style={labelStyle}>WhatsApp</label><input style={input} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52 1 686…" /></div>
        </div>
      </div>

      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button style={btnGhost} onClick={onVolver}>← Anterior</button>
        <button style={{ ...btnDark, opacity: guardando ? 0.6 : 1 }} disabled={guardando} onClick={continuar}>{guardando ? 'Guardando…' : 'Continuar →'}</button>
      </div>
    </div>
  );
}

// =============================================================================
// Paso — Tu plan (cierre de la capa Project Manager)
// =============================================================================
// La capa 'pm' no conecta nada ni corre Retro: su cierre es presentar al Perro
// Guardián y soltarlo en el board. El board arranca LIMPIO a propósito (el seed
// por defecto es el de un negocio que vende con ads: ver lib/todo-seeds.ts), así
// que lo primero que hace el cliente es crear su primer proyecto con MaKo.
function PasoPlan({ onFinalizar }: { onFinalizar: () => Promise<void> }) {
  const [yendo, setYendo] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <MakoStar size={22} color="var(--accent)" />
        <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>Tu plan</h2>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 640, lineHeight: 1.6 }}>
        Ya sé de qué se trata tu negocio. De acá en adelante, el <b>Perro Guardián</b> se encarga de
        que tu plan no se llene de cosas que no mueven la aguja: vos cargás lo que hay para hacer y
        él decide qué es prioritario y por qué. Si no estás de acuerdo, se lo discutís.
      </p>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Vos cargás, él prioriza', 'No elegís la prioridad a mano: MaKo compara cada tarea contra todo el resto y le pone un puntaje con su razón.'],
            ['Un solo objetivo a la vez', 'El proyecto más importante manda. Las tareas de los demás no pueden colarse en Alta, salvo una emergencia real.'],
            ['Te lo discute', 'Si creés que se equivocó, debatís. Te va a pedir argumentos — y tiene la última palabra.'],
          ].map(([t, d]) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--good)', fontSize: 15, lineHeight: 1.4, flex: 'none' }}>✓</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button style={{ ...btnDark, opacity: yendo ? 0.6 : 1 }} disabled={yendo}
        onClick={async () => { setYendo(true); try { await onFinalizar(); } finally { setYendo(false); } }}>
        {yendo ? 'Abriendo…' : 'Crear mi primer proyecto →'}
      </button>
    </div>
  );
}

// =============================================================================
// Paso 4 — Tu primera Retro (streaming) + reporte final
// =============================================================================
function PasoRetro({ ext, retroDone, onReporteVisible, onFinalizada }: {
  ext: Extraction | null;
  retroDone: boolean;
  onReporteVisible: () => void;
  onFinalizada: (retroId: number | null) => Promise<void>;
}) {
  const [generando, setGenerando] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [pasosLog, setPasosLog] = useState<string[]>([]);
  const [retro, setRetro] = useState<RetroRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const metaListo = ext?.jobs?.meta_metrics?.status === 'done';
  const metaSkipped = ext?.jobs?.meta_metrics?.status === 'skipped' || ext == null || ext.status === 'idle';
  const extError = ext?.status === 'error' && !metaListo;

  const generar = async () => {
    setGenerando(true); setErr(null); setPasosLog([]); setFase(null);
    try {
      const res = await fetch('/api/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', historico: true }) });
      if (!res.ok || !res.body) { setErr(`No se pudo generar (${res.status}).`); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          let ev: RetroStreamEvent;
          try { ev = JSON.parse(line) as RetroStreamEvent; } catch { continue; }
          if (ev.t === 'fase') setFase(ev.fase as RetroFaseId);
          else if (ev.t === 'step') setPasosLog((l) => [...l.slice(-7), ev.label]);
          else if (ev.t === 'done') {
            const r = ev.retro as unknown as RetroRow;
            setRetro(r);
            if (r?.reporte) onReporteVisible();
            await onFinalizada(r?.id ?? null);
          } else if (ev.t === 'error') setErr(ev.error);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setGenerando(false); }
  };

  const onPlan = async (item: RetroPlanItem, op: 'aceptar' | 'posponer' | 'descartar' | 'deshacer', motivo?: string) => {
    if (!retro) return;
    setBusyPlanId(item.id);
    try {
      const j = await post('/api/retro', { action: 'plan', id: retro.id, itemId: item.id, op, motivo });
      if (j.ok && j.reporte) setRetro((r) => (r ? { ...r, reporte: j.reporte as RetroReporte } : r));
    } finally { setBusyPlanId(null); }
  };

  // Reporte final a pantalla completa
  if (retro?.reporte) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <MakoStar size={22} color="var(--accent)" />
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>Tu primera Retro</h2>
          <button style={{ ...btnDark, marginLeft: 'auto' }} onClick={() => { window.location.href = '/general'; }}>Ir a mi dashboard →</button>
        </div>
        <RetroReport
          reporte={retro.reporte}
          periodo={`${retro.periodo_desde} – ${retro.periodo_hasta}`}
          alcance="todo el negocio"
          onPlan={onPlan}
          busyPlanId={busyPlanId}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 4px' }}>Tu primera Retro</h2>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 640 }}>
        MaKo cruza TODO tu histórico (ads, leads, llamadas, revenue) y te entrega el diagnóstico de tu negocio: dónde se te va la plata, qué funciona y el plan priorizado para arrancar.
      </p>

      {extError && (
        <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, background: 'var(--bad-bg)' }}>
          <span style={{ fontSize: 18 }}>✕</span>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            La extracción se frenó por un error — mirá el panel de la derecha y tocá <b>Reintentar</b> en el paso que falló. La Retro se habilita cuando terminen las métricas de Meta.
          </div>
        </div>
      )}
      {!metaListo && !metaSkipped && !extError && (
        <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>
            MaKo sigue extrayendo tus datos (lo ves al costado). Cuando terminen las <b>métricas de Meta</b>, la Retro se habilita — podés dejar esta pestaña abierta.
          </div>
        </div>
      )}
      {metaSkipped && (
        <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, background: 'var(--warn-bg)' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            Sin datos de Meta la Retro sale vacía. Volvé al paso 1 y conectá Meta, o finalizá sin Retro y generala después desde Experiments.
          </div>
        </div>
      )}

      {generando && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <MakoStar size={18} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{fase ? `MaKo está en: ${fase}` : 'Arrancando…'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pasosLog.map((p, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: 11.5, color: i === pasosLog.length - 1 ? 'var(--ink)' : 'var(--faint)' }}>· {p}</div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 12 }}>Esto tarda unos minutos — MaKo está leyendo TODO tu histórico.</div>
        </div>
      )}

      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button style={{ ...btnDark, opacity: generando || (!metaListo && !metaSkipped) ? 0.4 : 1 }} disabled={generando || (!metaListo && !metaSkipped)} onClick={generar}>
          {generando ? 'Generando…' : retroDone ? 'Re-generar la Retro' : '✦ Generar mi primera Retro'}
        </button>
        {(metaSkipped || extError) && !generando && (
          <button style={btnGhost} onClick={async () => { await onFinalizada(null); window.location.href = '/general'; }}>Finalizar sin Retro</button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Panel lateral — extracción en vivo
// =============================================================================
function PanelExtraccion({ ext, conteos, onRetry }: { ext: Extraction; conteos: Conteos | null; onRetry: (job: string) => Promise<void> }) {
  const jobChip = (st: JobState['status']) => {
    if (st === 'done') return <span style={chip('var(--good-bg)', 'var(--good)')}>listo</span>;
    if (st === 'running') return <span style={chip('var(--primary-bg)', 'var(--primary)')}>extrayendo…</span>;
    if (st === 'error') return <span style={chip('var(--bad-bg)', 'var(--bad)')}>error</span>;
    if (st === 'skipped') return <span style={chip('var(--surface-2)', 'var(--faint)')}>omitido</span>;
    return <span style={chip('var(--surface-2)', 'var(--dim)')}>en cola</span>;
  };

  return (
    <aside style={{ width: 300, flex: 'none', position: 'sticky', top: 24 }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <MakoStar size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Extrayendo tus datos</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14 }}>
          {ext.status === 'done' ? 'Listo — tu histórico está adentro.' : ext.status === 'error' ? 'Algo falló — mirá abajo.' : 'Podés seguir con los pasos mientras tanto.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {Object.entries(ext.jobs).map(([key, j]) => (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: j.status === 'skipped' ? 'var(--faint)' : 'var(--ink)' }}>{JOB_LABELS[key] ?? key}</span>
                {jobChip(j.status)}
              </div>
              {j.detail && <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{j.detail}</div>}
              {j.status === 'error' && (
                <div style={{ marginTop: 4 }}>
                  {j.error && <div style={{ fontSize: 11, color: 'var(--bad)', marginBottom: 4 }}>{j.error}</div>}
                  <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5 }} onClick={() => onRetry(key)}>Reintentar</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {conteos && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Cifra label="Métricas" valor={conteos.metricas_filas > 0 ? `${conteos.metricas_filas} filas${conteos.metricas_desde ? ` · desde ${conteos.metricas_desde}` : ''}` : '—'} />
            <Cifra label="Leads" valor={String(conteos.leads || '—')} />
            <Cifra label="Transcripciones" valor={String(conteos.transcripts || '—')} />
            <Cifra label="Guiones analizados" valor={String(conteos.scripts || '—')} />
            <Cifra label="Llamadas" valor={String(conteos.llamadas || '—')} />
            {conteos.vsl_filas > 0 && <Cifra label="VSL" valor={`${conteos.vsl_filas} filas`} />}
          </div>
        )}
      </div>
    </aside>
  );
}

function Cifra({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--ink)' }}>{valor}</span>
    </div>
  );
}
