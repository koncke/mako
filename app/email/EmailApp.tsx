'use client';

// =============================================================================
// Email Marketing — secuencias por etapa (motor de nutrición) + broadcasts.
// Data-driven: lee/escribe vía /api/email/*. Las secuencias de email viven en
// nutricion_secuencias (pasos canal='email'); el envío real sale por Resend y
// se habilita POR WORKSPACE con el toggle "Envío real" (setting
// envio_email_enabled, lib/envio-flags.ts — el dueño hereda EMAIL_SEND_ENABLED
// del env si no tiene setting). El dominio de envío se configura acá mismo
// (mini-onboarding DominioSetup). Broadcasts = envíos puntuales a un segmento.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../_components/icons';
import { useConfirm } from '../_components/useConfirm';
import { VozGuia } from '../_components/VozGuia';
import { BotonIntegracion } from '../_components/ConectarIntegracion';
import { NutricionGenerar } from '../_components/NutricionGenerar';
import { SelectorEtiqueta } from '../_components/etiquetas-cliente';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos (espejo de lib/email-marketing.ts)
// ─────────────────────────────────────────────────────────────────────────────
type Opcion = { value: string; label: string; color?: string };
type StepStats = { sent: number; abiertos: number; clics: number };
type Paso = {
  orden: number; canal: 'email'; delay_horas: number;
  asunto: string | null; preheader?: string | null; cuerpo: string; template_wa: null;
};
type Secuencia = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  /** La etiqueta del disparador «Se le puso una etiqueta». */
  etiqueta_id: number | null;
  activa: boolean; pasos: Paso[]; inscriptos: number; statsPorPaso: StepStats[];
};

/**
 * El disparador «Se le puso una etiqueta» NECESITA la etiqueta (revisión del 08/10/2026,
 * etiquetas-2): sin ella la secuencia quedaba activa y muda. Por eso al elegirlo aparece al lado el
 * selector de etiquetas del CRM, y el server rechaza guardar sin una (lib/email-marketing.ts).
 */
const TRIGGER_ETIQUETA = 'etiqueta_puesta';
type Kpi = { label: string; value: string; delta: string; deltaColor: string };
type Broadcast = {
  id: number; asunto: string; preheader: string | null; cuerpo: string; segmento: string;
  estado: string; programado_at: string | null; enviado_at: string | null;
  total_destinatarios: number; created_at: string; enviados: number; abiertos: number; clics: number;
};
type Segmento = { value: string; label: string; descripcion: string };
type DnsRecord = { record: string; name: string; type: string; value: string; ttl?: string; priority?: number; status?: string };
/** Lo que contesta GET /api/email/dominio. Exportado para el «Vincular nuevo» del email de /automations. */
export type DomState = {
  conectado: boolean; envioHabilitado: boolean; sandbox: boolean; resendConfigurado: boolean;
  dominio: string | null; remitente: string; estadoDominio: string | null; records: DnsRecord[];
};

type View = 'sequences' | 'broadcasts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de red
// ─────────────────────────────────────────────────────────────────────────────
async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  return r.json() as Promise<T>;
}
async function apiSend<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json() as Promise<T>;
}

function fmtDelay(h: number): string {
  if (h <= 0) return 'inmediato';
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24), r = h % 24;
  return r ? `${d}d ${r}h` : `${d} día${d > 1 ? 's' : ''}`;
}
const pctTxt = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 1000) / 10}%` : '—');
function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ESTADO_STYLE: Record<string, { bg: string; fg: string; bd: string; label: string }> = {
  borrador: { bg: 'var(--surface-2)', fg: 'var(--dim)', bd: 'var(--border-strong)', label: 'borrador' },
  programado: { bg: 'var(--warn-bg)', fg: 'var(--warn)', bd: 'var(--warn-fill)', label: 'programado' },
  enviando: { bg: 'var(--warn-bg)', fg: 'var(--warn)', bd: 'var(--warn-fill)', label: 'enviando…' },
  enviado: { bg: 'var(--good-bg)', fg: 'var(--good)', bd: 'var(--good)', label: 'enviado' },
  cancelado: { bg: 'var(--bad-bg)', fg: 'var(--bad)', bd: 'var(--bad)', label: 'cancelado' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Estilos compartidos
// ─────────────────────────────────────────────────────────────────────────────
const btnPrimary: CSSProperties = { padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const btnAccent: CSSProperties = { padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const inputBase: CSSProperties = { padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', outline: 'none' };
const monoLabel: CSSProperties = { fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────
export function EmailApp() {
  const [view, setView] = useState<View>('sequences');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [secuencias, setSecuencias] = useState<Secuencia[]>([]);
  const [etapas, setEtapas] = useState<Opcion[]>([]);
  const [triggers, setTriggers] = useState<Opcion[]>([]);
  const [sendEnabled, setSendEnabled] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [segCounts, setSegCounts] = useState<Record<string, number>>({});

  const [dom, setDom] = useState<DomState | null>(null);
  const [showDom, setShowDom] = useState(false);

  const aplicarDom = useCallback((d: DomState) => {
    setDom(d);
    setSendEnabled(d.envioHabilitado);
    setResendOk(d.resendConfigurado);
  }, []);

  const loadDominio = useCallback(async () => {
    const j = await apiGet<{ ok: boolean; error?: string } & DomState>('/api/email/dominio');
    if (j.ok) { aplicarDom(j); return; }
    // 403 = setter/closer (la config es admin-only): sin ruido, la tab funciona
    // igual. Cualquier otro error sí se muestra — si no, el admin pierde el
    // setup y el toggle sin enterarse.
    if (!/admin/i.test(j.error ?? '')) setError(j.error || 'No se pudo cargar la config del dominio');
  }, [aplicarDom]);

  // ── carga inicial ──────────────────────────────────────────────────────────
  const loadSecuencias = useCallback(async () => {
    const j = await apiGet<{ ok: boolean; error?: string; kpis: Kpi[]; secuencias: Secuencia[]; etapas: Opcion[]; triggers: Opcion[]; sendEnabled: boolean; resendConfigurado: boolean }>('/api/email/secuencias');
    if (!j.ok) throw new Error(j.error || 'No se pudieron cargar las secuencias');
    setKpis(j.kpis); setSecuencias(j.secuencias); setEtapas(j.etapas); setTriggers(j.triggers);
    setSendEnabled(j.sendEnabled); setResendOk(j.resendConfigurado);
  }, []);
  const loadBroadcasts = useCallback(async () => {
    const j = await apiGet<{ ok: boolean; error?: string; broadcasts: Broadcast[]; segmentos: Segmento[]; segmentoCounts: Record<string, number> }>('/api/email/broadcasts');
    if (!j.ok) throw new Error(j.error || 'No se pudieron cargar los broadcasts');
    setBroadcasts(j.broadcasts); setSegmentos(j.segmentos); setSegCounts(j.segmentoCounts);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try { await Promise.all([loadSecuencias(), loadBroadcasts(), loadDominio()]); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setLoading(false); }
    })();
  }, [loadSecuencias, loadBroadcasts, loadDominio]);

  async function toggleEnvio() {
    if (!dom) return;
    const j = await apiSend<{ ok: boolean; error?: string } & DomState>('/api/email/dominio', 'POST', { action: 'envio', on: !dom.envioHabilitado });
    if (j.ok) aplicarDom(j);
  }

  const etapaColor = useCallback((k: string) => etapas.find((e) => e.value === k)?.color ?? '#6A4BD8', [etapas]);

  const isSeq = view === 'sequences';
  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-ink)' };
  const tabIdle: CSSProperties = { ...tabActive, fontWeight: 500, background: 'transparent', color: 'var(--dim)' };

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 7px', color: 'var(--ink)' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="email" size={34} /></span>
            Email
          </h1>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>
            Secuencias y broadcasts por email a tus leads en <strong style={{ color: 'var(--ink)' }}>Nutrición</strong>.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <VozGuia />
          <NutricionGenerar onAplicado={() => void loadSecuencias()} />
          {dom?.conectado && (
            <button onClick={() => void toggleEnvio()} title={dom.envioHabilitado ? 'El motor manda emails reales — clic para pausar' : 'Los envíos se registran como simulado — clic para activar'} aria-pressed={dom.envioHabilitado}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, border: '1px solid ' + (dom.envioHabilitado ? 'var(--good)' : 'var(--border-strong)'), background: dom.envioHabilitado ? 'var(--good-bg)' : 'var(--surface)', color: dom.envioHabilitado ? 'var(--good)' : 'var(--dim)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dom.envioHabilitado ? 'var(--good)' : 'var(--faint)' }} />
              Envío real: {dom.envioHabilitado ? 'ON' : 'OFF'}
            </button>
          )}
          {dom?.conectado && (
            <button onClick={() => setShowDom(true)} style={{ ...btnGhost, padding: '8px 14px', fontSize: '12.5px' }}>⚙ Dominio de envío</button>
          )}
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
            <button onClick={() => setView('sequences')} aria-pressed={isSeq} style={isSeq ? tabActive : tabIdle}>Secuencias</button>
            <button onClick={() => setView('broadcasts')} aria-pressed={!isSeq} style={!isSeq ? tabActive : tabIdle}>Broadcasts</button>
          </div>
        </div>
      </header>

      {/* Mini-onboarding: sin dominio verificado ni remitente propio, la tab pide la configuración acá mismo */}
      {!loading && dom && !dom.conectado && (
        <DominioSetup dom={dom} onUpdate={aplicarDom} />
      )}

      {/* Config del dominio accesible siempre (cambiar remitente / re-verificar / desconectar) */}
      {showDom && dom && (
        <div onClick={() => setShowDom(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <DominioSetup dom={dom} onUpdate={aplicarDom} onClose={() => setShowDom(false)} />
          </div>
        </div>
      )}

      {/* Aviso de estado del envío (cuando el dominio ya está conectado) */}
      {!loading && !error && dom?.conectado && (!resendOk || !sendEnabled) && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px', lineHeight: 1.5 }}>
          {!resendOk
            ? 'Resend no está configurado (falta la API key). Los envíos quedan en modo simulado.'
            : 'Envío real apagado: puedes escribir y probar todo, pero los envíos automáticos se registran como simulado y no salen de verdad. Actívalo con el botón "Envío real" de arriba cuando estés listo.'}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '13px' }}>{error}</div>
      )}

      {/* KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '18px' }}>
        {(loading ? Array.from({ length: 4 }).map((_, i) => ({ label: '—', value: '…', delta: '', deltaColor: 'var(--dim)', _k: i } as Kpi & { _k: number })) : kpis).map((k, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ ...monoLabel, fontSize: '11px', letterSpacing: '.09em', marginBottom: '9px' }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '27px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
              <span style={{ fontSize: '12.5px', color: k.deltaColor }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </section>

      {isSeq ? (
        <SequencesView
          loading={loading} secuencias={secuencias} etapas={etapas} triggers={triggers}
          etapaColor={etapaColor} reload={loadSecuencias}
        />
      ) : (
        <BroadcastsView
          loading={loading} broadcasts={broadcasts} segmentos={segmentos} segCounts={segCounts}
          sendEnabled={sendEnabled} reload={loadBroadcasts}
        />
      )}
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECUENCIAS
// ═════════════════════════════════════════════════════════════════════════════
function SequencesView(props: {
  loading: boolean; secuencias: Secuencia[]; etapas: Opcion[]; triggers: Opcion[];
  etapaColor: (k: string) => string; reload: () => Promise<void>;
}) {
  const { loading, secuencias, etapas, triggers, etapaColor, reload } = props;
  const [selId, setSelId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ nombre: string; etapa: string; trigger: string; etiquetaId: number | null; pasos: Paso[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [genFor, setGenFor] = useState<number | null>(null); // índice de paso en generación

  // selección efectiva
  const sel = secuencias.find((s) => s.id === selId) ?? secuencias[0] ?? null;
  useEffect(() => {
    if (sel && selId == null) setSelId(sel.id);
  }, [sel, selId]);

  // carga el draft cuando cambia la secuencia seleccionada
  useEffect(() => {
    if (!sel) { setDraft(null); return; }
    setDraft({ nombre: sel.nombre, etapa: sel.etapa, trigger: sel.trigger_tipo, etiquetaId: sel.etiqueta_id ?? null, pasos: sel.pasos.map((p) => ({ ...p })) });
    setMsg(null);
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!sel && !!draft && JSON.stringify({ nombre: sel.nombre, etapa: sel.etapa, trigger: sel.trigger_tipo, etiquetaId: sel.etiqueta_id ?? null, pasos: sel.pasos }) !== JSON.stringify(draft);

  const patchPaso = (i: number, patch: Partial<Paso>) =>
    setDraft((d) => (d ? { ...d, pasos: d.pasos.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : d));
  const addPaso = () =>
    setDraft((d) => (d ? { ...d, pasos: [...d.pasos, { orden: d.pasos.length + 1, canal: 'email', delay_horas: 24, asunto: '', preheader: '', cuerpo: '', template_wa: null }] } : d));
  const removePaso = (i: number) =>
    setDraft((d) => (d ? { ...d, pasos: d.pasos.filter((_, j) => j !== i) } : d));
  const movePaso = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.pasos.length) return d;
      const next = [...d.pasos];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, pasos: next };
    });

  async function guardar() {
    if (!sel || !draft) return;
    setSaving(true); setMsg(null);
    try {
      const pasos = draft.pasos.map((p, i) => ({ ...p, orden: i + 1 }));
      // El disparador viaja sólo si CAMBIÓ: volver a fijarlo en cada guardado de un paso lo
      // revalidaría (y una etiqueta archivada en el medio frenaría guardar el texto).
      const cambioDisparador = draft.trigger !== sel.trigger_tipo || (draft.trigger === TRIGGER_ETIQUETA && draft.etiquetaId !== (sel.etiqueta_id ?? null));
      const j = await apiSend<{ ok: boolean; error?: string }>('/api/email/secuencias', 'PATCH', {
        id: sel.id, nombre: draft.nombre, etapa: draft.etapa, pasos,
        ...(cambioDisparador ? { trigger: draft.trigger, ...(draft.trigger === TRIGGER_ETIQUETA ? { etiquetaId: draft.etiquetaId } : {}) } : {}),
      });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      await reload();
      setMsg({ type: 'ok', text: 'Cambios guardados.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally { setSaving(false); }
  }

  async function toggle() {
    if (!sel) return;
    try {
      const j = await apiSend<{ ok: boolean; error?: string }>('/api/email/secuencias', 'PATCH', { id: sel.id, activa: !sel.activa });
      if (!j.ok) throw new Error(j.error || 'No se pudo cambiar el estado');
      await reload();
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); }
  }

  async function generar(i: number) {
    if (!draft) return;
    const instruccion = window.prompt('¿Qué quieres que escriba MaKo para este email? (ej: "reescríbelo más corto y con más urgencia")');
    if (!instruccion) return;
    setGenFor(i); setMsg(null);
    try {
      const j = await apiSend<{ ok: boolean; error?: string; asunto: string; preheader: string; cuerpo: string }>('/api/email/generar', 'POST', {
        instruccion, etapa: draft.etapa, modo: 'paso', asuntoActual: draft.pasos[i].asunto, cuerpoActual: draft.pasos[i].cuerpo,
      });
      if (!j.ok) throw new Error(j.error || 'No se pudo generar');
      patchPaso(i, { asunto: j.asunto, preheader: j.preheader, cuerpo: j.cuerpo });
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setGenFor(null); }
  }

  const totalSent = sel ? sel.statsPorPaso.reduce((a, s) => a + s.sent, 0) : 0;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>
      {/* Lista */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', ...monoLabel }}>Secuencias por etapa</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && <div style={{ padding: '14px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
          {!loading && secuencias.length === 0 && <div style={{ padding: '14px', color: 'var(--faint)', fontSize: '13.5px' }}>No hay secuencias de email todavía.</div>}
          {secuencias.map((s) => {
            const active = s.id === (sel?.id ?? -1);
            return (
              <div key={s.id} role="button" tabIndex={0} aria-label={`Secuencia ${s.nombre}`} onClick={() => setSelId(s.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelId(s.id); } }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '11px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                <span style={{ width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: etapaColor(s.etapa) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '1px' }}>{s.pasos.length} emails · {s.activa ? 'activa' : 'pausada'} · {s.inscriptos} inscriptos</div>
                </div>
              </div>
            );
          })}
          <button onClick={() => setCreating(true)} style={{ marginTop: '4px', padding: '11px', borderRadius: '10px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Crear secuencia nueva</button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {!sel || !draft ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>{loading ? 'Cargando…' : 'Elige o crea una secuencia'}</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span style={{ width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: etapaColor(draft.etapa) }} />
                  <input value={draft.nombre} aria-label="Nombre de la secuencia" onChange={(e) => setDraft((d) => (d ? { ...d, nombre: e.target.value } : d))}
                    style={{ fontWeight: 600, fontSize: '19px', letterSpacing: '-0.01em', color: 'var(--ink)', border: 'none', background: 'transparent', fontFamily: "'Geist', sans-serif", outline: 'none', padding: '2px 0', minWidth: '240px', flex: 1 }} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '4px' }}>
                  {draft.pasos.length} emails · {totalSent.toLocaleString('en-US')} enviados · {sel.activa ? 'activa' : 'pausada'}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <Dropdown value={draft.etapa} onChange={(v) => setDraft((d) => (d ? { ...d, etapa: v } : d))} width={150} ariaLabel="Etapa" buttonStyle={{ padding: '6px 10px', fontSize: 12.5 }} options={etapas.map((e) => ({ value: e.value, label: e.label, color: e.color }))} />
                  <Dropdown value={draft.trigger} onChange={(v) => setDraft((d) => (d ? { ...d, trigger: v } : d))} width={230} ariaLabel="Trigger" buttonStyle={{ padding: '6px 10px', fontSize: 12.5 }} options={triggers.map((t) => ({ value: t.value, label: t.label }))} />
                  {draft.trigger === TRIGGER_ETIQUETA && (
                    <SelectorEtiqueta value={draft.etiquetaId} onElegir={(e) => setDraft((d) => (d ? { ...d, etiquetaId: e.id } : d))}
                      placeholder="Elige la etiqueta" ariaLabel="Etiqueta que lo dispara" width={190} buttonStyle={{ padding: '6px 10px', fontSize: 12.5 }} />
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flex: 'none' }}>
                {dirty && <button onClick={() => setDraft({ nombre: sel.nombre, etapa: sel.etapa, trigger: sel.trigger_tipo, etiquetaId: sel.etiqueta_id ?? null, pasos: sel.pasos.map((p) => ({ ...p })) })} disabled={saving} style={btnGhost}>Descartar</button>}
                {dirty && <button onClick={() => void guardar()} disabled={saving || (draft.trigger === TRIGGER_ETIQUETA && draft.etiquetaId == null)} title={draft.trigger === TRIGGER_ETIQUETA && draft.etiquetaId == null ? 'Elige la etiqueta' : undefined} style={{ ...btnPrimary, opacity: saving || (draft.trigger === TRIGGER_ETIQUETA && draft.etiquetaId == null) ? 0.6 : 1 }}>{saving ? 'Guardando…' : '✓ Guardar'}</button>}
                {!dirty && (
                  <button onClick={() => void toggle()} style={{ ...btnGhost, border: '1px solid ' + (sel.activa ? 'var(--border-strong)' : 'var(--good)'), background: sel.activa ? 'var(--surface)' : 'var(--good-bg)', color: sel.activa ? 'var(--dim)' : 'var(--good)' }}>{sel.activa ? '⏸ Pausar' : '▶ Activar'}</button>
                )}
              </div>
            </div>

            {msg && (
              <div style={{ margin: '14px 22px 0', padding: '9px 12px', borderRadius: '9px', fontSize: '13px', border: '1px solid ' + (msg.type === 'ok' ? 'var(--good)' : 'var(--bad)'), background: msg.type === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: msg.type === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{msg.text}</div>
            )}

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px' }}>
              {draft.pasos.map((st, i) => {
                const stat = sel.statsPorPaso[i] ?? { sent: 0, abiertos: 0, clics: 0 };
                return (
                  <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: '34px' }}>
                      <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(200,135,12,.12)', border: '1px solid rgba(200,135,12,.32)', color: '#9A6A09', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                      {i < draft.pasos.length - 1 && <span style={{ width: '2px', flex: 1, minHeight: '30px', background: 'var(--border)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px', flexWrap: 'wrap' }}>
                        <input type="number" min={0} value={st.delay_horas} aria-label={`Horas de espera antes del email ${i + 1}`} onChange={(e) => patchPaso(i, { delay_horas: Math.max(0, Number(e.target.value) || 0) })} style={{ ...inputBase, width: '78px', fontFamily: "'Geist Mono', monospace", fontSize: '12px' }} />
                        <span style={{ fontSize: '12px', color: 'var(--faint)' }}>horas → {fmtDelay(st.delay_horas)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>✉ Email</span>
                        <button onClick={() => void generar(i)} disabled={genFor === i} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '5px 10px', color: 'var(--ink)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>{genFor === i ? 'Generando…' : '✨ MaKo'}</button>
                        <button onClick={() => movePaso(i, -1)} disabled={i === 0} title="Subir" style={{ background: 'transparent', border: 'none', color: 'var(--faint)', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                        <button onClick={() => movePaso(i, 1)} disabled={i === draft.pasos.length - 1} title="Bajar" style={{ background: 'transparent', border: 'none', color: 'var(--faint)', cursor: 'pointer', opacity: i === draft.pasos.length - 1 ? 0.3 : 1 }}>↓</button>
                        <button onClick={() => removePaso(i)} style={{ background: 'transparent', border: 'none', color: 'var(--faint)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", textDecoration: 'underline' }}>eliminar</button>
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--surface-2)' }}>
                        <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                          <input value={st.asunto ?? ''} aria-label={`Asunto del email ${i + 1}`} onChange={(e) => patchPaso(i, { asunto: e.target.value })} placeholder="Asunto del email…" style={{ width: '100%', padding: '6px 0', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '15px', fontWeight: 600, outline: 'none' }} />
                          <input value={st.preheader ?? ''} aria-label={`Vista previa (preheader) del email ${i + 1}`} onChange={(e) => patchPaso(i, { preheader: e.target.value })} placeholder="Texto de vista previa (preheader)…" style={{ width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', outline: 'none' }} />
                        </div>
                        <textarea value={st.cuerpo} onChange={(e) => patchPaso(i, { cuerpo: e.target.value })} placeholder="Cuerpo del email… (variables: {nombre}, {empresa})" style={{ width: '100%', minHeight: '84px', resize: 'vertical', padding: '12px 13px', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.55, outline: 'none' }} />
                        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <Stat label="Enviados" value={stat.sent.toLocaleString('en-US')} color="var(--ink)" border />
                          <Stat label="Apertura" value={pctTxt(stat.abiertos, stat.sent)} color="var(--good)" border />
                          <Stat label="Clic" value={pctTxt(stat.clics, stat.sent)} color="var(--accent)" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ flex: 'none', width: '34px', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px dashed var(--border-strong)', color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</span>
                </div>
                <button onClick={addPaso} style={{ flex: 1, textAlign: 'left', padding: '14px', borderRadius: '11px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Agregar email a la secuencia</button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '14px', paddingLeft: '50px', lineHeight: 1.5 }}>
                La secuencia se dispara sola cuando un lead entra a la cohorte del trigger. El envío real sale por Resend con el <strong>Envío real en ON</strong> (botón de arriba) y la secuencia <strong>activa</strong>.
              </div>
            </div>
          </>
        )}
      </div>

      {creating && (
        <CrearSecuenciaModal etapas={etapas} triggers={triggers} onClose={() => setCreating(false)}
          onCreated={async (id) => { setCreating(false); await reload(); setSelId(id); }} />
      )}
    </div>
  );
}

function Stat({ label, value, color, border }: { label: string; value: string; color: string; border?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '9px 13px', borderRight: border ? '1px solid var(--border)' : undefined }}>
      <div style={{ fontSize: '10.5px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function CrearSecuenciaModal(props: { etapas: Opcion[]; triggers: Opcion[]; onClose: () => void; onCreated: (id: number) => void | Promise<void> }) {
  const { etapas, triggers, onClose, onCreated } = props;
  const [nombre, setNombre] = useState('');
  const [etapa, setEtapa] = useState(etapas[0]?.value ?? 'nutri');
  const [trigger, setTrigger] = useState('manual');
  const [etiquetaId, setEtiquetaId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const faltaEtiqueta = trigger === TRIGGER_ETIQUETA && etiquetaId == null;

  async function crear() {
    setBusy(true); setErr(null);
    try {
      const j = await apiSend<{ ok: boolean; error?: string; id: number }>('/api/email/secuencias', 'PATCH', {
        action: 'crear', nombre: nombre || 'Nueva secuencia de email', etapa, trigger,
        ...(trigger === TRIGGER_ETIQUETA ? { etiquetaId } : {}),
      });
      if (!j.ok) throw new Error(j.error || 'No se pudo crear');
      await onCreated(j.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>Nueva secuencia de email</div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '5px' }}>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Reactivación de leads fríos" autoFocus style={{ ...inputBase, width: '100%', marginBottom: '14px' }} />
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '5px' }}>Etapa</label>
        <div style={{ marginBottom: '14px' }}><Dropdown value={etapa} onChange={setEtapa} width="100%" options={etapas.map((e) => ({ value: e.value, label: e.label, color: e.color }))} /></div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '5px' }}>Trigger (cuándo se dispara)</label>
        <div style={{ marginBottom: '8px' }}><Dropdown value={trigger} onChange={setTrigger} width="100%" options={triggers.map((t) => ({ value: t.value, label: t.label }))} /></div>
        {trigger === TRIGGER_ETIQUETA && (
          <div style={{ marginBottom: '8px' }}>
            <SelectorEtiqueta value={etiquetaId} onElegir={(e) => setEtiquetaId(e.id)} placeholder="Elige la etiqueta" ariaLabel="Etiqueta que lo dispara" width="100%" />
          </div>
        )}
        {err && <div style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--bad)' }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
          <button onClick={onClose} disabled={busy} style={btnGhost}>Cancelar</button>
          <button onClick={() => void crear()} disabled={busy || faltaEtiqueta} style={{ ...btnPrimary, opacity: busy || faltaEtiqueta ? 0.6 : 1 }}>{busy ? 'Creando…' : 'Crear secuencia'}</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BROADCASTS
// ═════════════════════════════════════════════════════════════════════════════
function BroadcastsView(props: {
  loading: boolean; broadcasts: Broadcast[]; segmentos: Segmento[]; segCounts: Record<string, number>;
  sendEnabled: boolean; reload: () => Promise<void>;
}) {
  const { loading, broadcasts, segmentos, segCounts, sendEnabled, reload } = props;
  const [editId, setEditId] = useState<number | null>(null);

  async function crear() {
    const j = await apiSend<{ ok: boolean; error?: string; id: number }>('/api/email/broadcasts', 'POST', {});
    if (j.ok) { await reload(); setEditId(j.id); }
  }

  const editing = broadcasts.find((b) => b.id === editId) ?? null;

  return (
    <div style={{ flex: 1, minHeight: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontWeight: 600, fontSize: '20px', margin: 0, color: 'var(--ink)' }}>Broadcasts</h2>
          <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '3px' }}>Envíos puntuales a un segmento.</div>
        </div>
        <button onClick={() => void crear()} style={btnAccent}>+ Crear broadcast</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr 1fr 0.9fr', gap: '12px', padding: '13px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', ...monoLabel, fontSize: '10.5px', letterSpacing: '.07em' }}>
        <span>Campaña</span><span>Segmento</span><span>Enviados</span><span>Apertura</span><span>Clic</span><span style={{ textAlign: 'right' }}>Estado</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '20px 22px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
        {!loading && broadcasts.length === 0 && <div style={{ padding: '20px 22px', color: 'var(--faint)', fontSize: '13.5px' }}>No hay broadcasts. Crea el primero.</div>}
        {broadcasts.map((b) => {
          const seg = segmentos.find((s) => s.value === b.segmento);
          const est = ESTADO_STYLE[b.estado] ?? ESTADO_STYLE.borrador;
          const fecha = b.estado === 'programado' ? `Programado ${fmtFecha(b.programado_at)}` : b.estado === 'enviado' ? fmtFecha(b.enviado_at) : 'Borrador';
          return (
            <div key={b.id} role="button" tabIndex={0} aria-label={`Abrir broadcast ${b.asunto || 'sin asunto'}`} onClick={() => setEditId(b.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditId(b.id); } }} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr 1fr 0.9fr', gap: '12px', padding: '16px 22px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.asunto || '(sin asunto)'}</div>
                <div style={{ fontSize: '12px', color: 'var(--faint)' }}>{fecha}</div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--dim)' }}>{seg?.label ?? b.segmento}</div>
              <div style={{ fontSize: '14px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{b.enviados ? b.enviados.toLocaleString('en-US') : (b.estado === 'enviado' ? b.total_destinatarios.toLocaleString('en-US') : '—')}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>{pctTxt(b.abiertos, b.enviados)}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{pctTxt(b.clics, b.enviados)}</div>
              <div style={{ textAlign: 'right' }}><span style={{ display: 'inline-block', fontSize: '11.5px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: est.bg, color: est.fg, border: '1px solid ' + est.bd }}>{est.label}</span></div>
            </div>
          );
        })}
      </div>

      {editing && (
        <BroadcastEditor broadcast={editing} segmentos={segmentos} segCounts={segCounts} sendEnabled={sendEnabled}
          onClose={() => setEditId(null)} reload={reload} />
      )}
    </div>
  );
}

function BroadcastEditor(props: {
  broadcast: Broadcast; segmentos: Segmento[]; segCounts: Record<string, number>; sendEnabled: boolean;
  onClose: () => void; reload: () => Promise<void>;
}) {
  const { broadcast, segmentos, segCounts, sendEnabled, onClose, reload } = props;
  const { confirm, confirmNode } = useConfirm();
  const yaEnviado = broadcast.estado === 'enviado';
  const [asunto, setAsunto] = useState(broadcast.asunto);
  const [preheader, setPreheader] = useState(broadcast.preheader ?? '');
  const [cuerpo, setCuerpo] = useState(broadcast.cuerpo);
  const [segmento, setSegmento] = useState(broadcast.segmento);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [schedAt, setSchedAt] = useState('');
  const [gen, setGen] = useState(false);

  const count = segCounts[segmento] ?? 0;

  async function guardar(): Promise<boolean> {
    setBusy(true); setMsg(null);
    try {
      const j = await apiSend<{ ok: boolean; error?: string }>('/api/email/broadcasts', 'PATCH', { id: broadcast.id, asunto, preheader, cuerpo, segmento });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      await reload();
      return true;
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); return false; }
    finally { setBusy(false); }
  }

  async function generar() {
    const instruccion = window.prompt('¿Sobre qué quieres el broadcast? (ej: "anuncia un webinar en vivo el jueves sobre prospección")');
    if (!instruccion) return;
    setGen(true); setMsg(null);
    try {
      const j = await apiSend<{ ok: boolean; error?: string; asunto: string; preheader: string; cuerpo: string }>('/api/email/generar', 'POST', { instruccion, modo: 'broadcast', asuntoActual: asunto, cuerpoActual: cuerpo });
      if (!j.ok) throw new Error(j.error || 'No se pudo generar');
      setAsunto(j.asunto); setPreheader(j.preheader); setCuerpo(j.cuerpo);
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setGen(false); }
  }

  async function prueba() {
    const email = window.prompt('¿A qué email mando la prueba?');
    if (!email) return;
    if (!(await guardar())) return;
    setBusy(true); setMsg(null);
    try {
      const j = await apiSend<{ ok: boolean; error?: string }>('/api/email/broadcasts', 'PATCH', { id: broadcast.id, action: 'prueba', email });
      if (!j.ok) throw new Error(j.error || 'No se pudo enviar la prueba');
      setMsg({ type: 'ok', text: `Prueba enviada a ${email}.` });
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  async function programar() {
    if (!schedAt) { setMsg({ type: 'err', text: 'Elige fecha y hora.' }); return; }
    if (!(await guardar())) return;
    setBusy(true); setMsg(null);
    try {
      const iso = new Date(schedAt).toISOString();
      const j = await apiSend<{ ok: boolean; error?: string }>('/api/email/broadcasts', 'PATCH', { id: broadcast.id, action: 'programar', programado_at: iso });
      if (!j.ok) throw new Error(j.error || 'No se pudo programar');
      await reload(); setMsg({ type: 'ok', text: 'Broadcast programado.' });
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  async function enviar() {
    if (!(await guardar())) return;
    setBusy(true); setMsg(null); setConfirmSend(false);
    try {
      const j = await apiSend<{ ok: boolean; error?: string; enviados: number; simulados: number; fallos: number; saltados: number; total: number; truncado?: boolean }>('/api/email/broadcasts', 'PATCH', { id: broadcast.id, action: 'enviar' });
      if (!j.ok) throw new Error(j.error || 'No se pudo enviar');
      await reload();
      const partes = [
        `${j.enviados} enviados`,
        j.simulados ? `${j.simulados} simulados` : '',
        j.saltados ? `${j.saltados} saltados (contacto reciente)` : '',
        j.fallos ? `${j.fallos} fallos` : '',
      ].filter(Boolean).join(', ');
      setMsg({ type: 'ok', text: `Listo: ${partes} (de ${j.total}).${j.truncado ? ' ⚠ El segmento supera el tope de 2000; el resto no se envió.' : ''}` });
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  async function eliminar() {
    if (!(await confirm('¿Eliminar este broadcast? No se puede deshacer.'))) return;
    setBusy(true);
    try {
      const j = await apiSend<{ ok: boolean; error?: string }>(`/api/email/broadcasts?id=${broadcast.id}`, 'DELETE');
      if (!j.ok) throw new Error(j.error || 'No se pudo eliminar');
      await reload(); onClose();
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : String(e) }); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      {confirmNode}
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>{yaEnviado ? 'Broadcast enviado' : 'Editar broadcast'}</div>
          <button onClick={onClose} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
        </div>

        {yaEnviado && (
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--dim)' }}>
            {broadcast.total_destinatarios.toLocaleString('en-US')} destinatarios · {pctTxt(broadcast.abiertos, broadcast.enviados)} apertura · {pctTxt(broadcast.clics, broadcast.enviados)} clic
          </div>
        )}

        <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', margin: '10px 0 5px' }}>Segmento</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Dropdown value={segmento} onChange={setSegmento} width={280} options={segmentos.map((s) => ({ value: s.value, label: s.label, sub: s.descripcion }))} />
          <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>{count.toLocaleString('en-US')} con email</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 5px' }}>
          <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Asunto</label>
          <button onClick={() => void generar()} disabled={gen || yaEnviado} style={{ background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '4px 10px', color: 'var(--ink)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif", opacity: yaEnviado ? 0.5 : 1 }}>{gen ? 'Generando…' : '✨ Generar con MaKo'}</button>
        </div>
        <input value={asunto} onChange={(e) => setAsunto(e.target.value)} disabled={yaEnviado} placeholder="Asunto…" style={{ ...inputBase, width: '100%', fontSize: '15px', fontWeight: 600, marginBottom: '10px' }} />
        <input value={preheader} onChange={(e) => setPreheader(e.target.value)} disabled={yaEnviado} placeholder="Texto de vista previa (preheader)…" style={{ ...inputBase, width: '100%', marginBottom: '10px' }} />
        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} disabled={yaEnviado} placeholder="Cuerpo del email… (variables: {nombre}, {empresa})" style={{ ...inputBase, width: '100%', minHeight: '160px', resize: 'vertical', lineHeight: 1.55, fontSize: '14px' }} />

        {msg && <div style={{ marginTop: '12px', padding: '9px 12px', borderRadius: '9px', fontSize: '13px', border: '1px solid ' + (msg.type === 'ok' ? 'var(--good)' : 'var(--bad)'), background: msg.type === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: msg.type === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{msg.text}</div>}

        {!yaEnviado && (
          <>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '18px' }}>
              <button onClick={() => void guardar()} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>Guardar borrador</button>
              <button onClick={() => void prueba()} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>Enviar prueba</button>
              <button onClick={() => setConfirmSend(true)} disabled={busy} style={{ ...btnPrimary, marginLeft: 'auto', opacity: busy ? 0.6 : 1 }}>Enviar ahora →</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} style={{ ...inputBase, flex: 1 }} />
              <button onClick={() => void programar()} disabled={busy || !schedAt} style={{ ...btnGhost, opacity: busy || !schedAt ? 0.6 : 1 }}>Programar</button>
              <button onClick={() => void eliminar()} disabled={busy} style={{ ...btnGhost, border: '1px solid var(--bad)', color: 'var(--bad)' }}>Eliminar</button>
            </div>
            {broadcast.estado === 'programado' && <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--warn)' }}>⏱ Programado para {fmtFecha(broadcast.programado_at)}. Se enviará solo (si el envío real está activo).</div>}
          </>
        )}

        {confirmSend && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>¿Enviar a {count.toLocaleString('en-US')} leads ahora?</div>
            <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '4px', lineHeight: 1.5 }}>
              {sendEnabled ? 'Esto manda emails reales por Resend. No se puede deshacer.' : 'El envío real está apagado: se registrará como simulado (no sale de verdad).'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button onClick={() => setConfirmSend(false)} disabled={busy} style={btnGhost}>Cancelar</button>
              <button onClick={() => void enviar()} disabled={busy} style={{ ...btnPrimary, background: sendEnabled ? 'var(--bad)' : 'var(--ink)', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enviando…' : sendEnabled ? 'Sí, enviar de verdad' : 'Enviar (simulado)'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DOMINIO DE ENVÍO — mini-onboarding de la tab (Opción A: cuenta única de MaKo)
// ═════════════════════════════════════════════════════════════════════════════
// Pasos: (1) el admin escribe su dominio → se da de alta en Resend; (2) carga
// los registros DNS que devuelve Resend en su proveedor (tabla con copiar);
// (3) "Verificar" + polling hasta 'verified'; (4) elige el remitente. Mientras
// no esté conectado, la tab funciona en modo simulado.
// ⚠️ EXPORTADO (cuarta tanda del Chatbot, 09/10/2026, punto 16): el «Vincular nuevo» del «De» del
// email de /automations monta ESTE MISMO flujo en un modal, sin salir del lienzo
// (app/automations/EditorEmailGmail.tsx, cargado a demanda). Un segundo flujo de conectar el dominio
// sería la segunda implementación de lo mismo.
export function DominioSetup({ dom, onUpdate, onClose }: { dom: DomState; onUpdate: (d: DomState) => void; onClose?: () => void }) {
  const { confirm, confirmNode } = useConfirm();
  const [dominioInput, setDominioInput] = useState('');
  const [local, setLocal] = useState('hola');
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  const verificado = dom.estadoDominio === 'verified';
  const paso: 1 | 2 | 3 = !dom.dominio ? 1 : !verificado ? 2 : 3;

  // Polling del estado mientras el dominio espera verificación. Con `busy` en
  // las deps, el intervalo se corta durante una acción → un poll viejo no puede
  // pisar la respuesta fresca de verificar/remitente (race).
  useEffect(() => {
    if (paso !== 2 || busy) return;
    const t = setInterval(() => {
      void (async () => {
        const j = await apiGet<{ ok: boolean } & DomState>('/api/email/dominio');
        if (j.ok) onUpdate(j);
      })();
    }, 10000);
    return () => clearInterval(t);
  }, [paso, busy, onUpdate]);

  async function accion(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try {
      const j = await apiSend<{ ok: boolean; error?: string } & DomState>('/api/email/dominio', 'POST', body);
      if (!j.ok) throw new Error(j.error || 'No se pudo completar');
      onUpdate(j);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function copiar(texto: string, i: number) {
    try { await navigator.clipboard.writeText(texto); setCopiado(i); setTimeout(() => setCopiado(null), 1500); } catch { /* sin clipboard */ }
  }

  const pasoDot = (n: number, activo: boolean, hecho: boolean) => (
    <span style={{ width: '26px', height: '26px', flex: 'none', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Geist Mono', monospace", background: hecho ? 'var(--good-bg)' : activo ? 'rgba(200,135,12,.12)' : 'var(--surface-2)', border: '1px solid ' + (hecho ? 'var(--good)' : activo ? 'rgba(200,135,12,.4)' : 'var(--border-strong)'), color: hecho ? 'var(--good)' : activo ? '#9A6A09' : 'var(--faint)' }}>{hecho ? '✓' : n}</span>
  );

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '18px' }}>
      {confirmNode}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '19px', fontWeight: 600, color: 'var(--ink)' }}>Configura tu dominio de envío</div>
          <div style={{ fontSize: '13.5px', color: 'var(--dim)', marginTop: '4px', lineHeight: 1.5, maxWidth: '560px' }}>
            Para que tus emails salgan a nombre de <strong style={{ color: 'var(--ink)' }}>tu negocio</strong> (y lleguen a la bandeja de entrada, no a spam), hay que verificar tu dominio. Se hace una sola vez.
          </div>
        </div>
        {onClose && <button onClick={onClose} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
        {/* Paso 1 — dominio */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {pasoDot(1, paso === 1, paso > 1)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: paso >= 1 ? 'var(--ink)' : 'var(--faint)' }}>Tu dominio</div>
            {paso === 1 ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                <input value={dominioInput} onChange={(e) => setDominioInput(e.target.value)} placeholder="minegocio.com (sin https:// ni @)" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && dominioInput.trim()) void accion({ action: 'crear', dominio: dominioInput }); }}
                  style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', outline: 'none', flex: 1, minWidth: '240px' }} />
                <button onClick={() => void accion({ action: 'crear', dominio: dominioInput })} disabled={busy || !dominioInput.trim()}
                  style={{ ...btnPrimary, opacity: busy || !dominioInput.trim() ? 0.6 : 1 }}>{busy ? 'Agregando…' : 'Agregar dominio'}</button>
              </div>
            ) : (
              <div style={{ fontSize: '13.5px', color: 'var(--dim)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <code style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--ink)' }}>{dom.dominio}</code>
                <button onClick={async () => { if (await confirm('¿Quitar este dominio de la configuración? (no se borra de Resend)', { confirmLabel: 'Quitar' })) void accion({ action: 'desconectar' }); }} style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Geist', sans-serif" }}>cambiar</button>
              </div>
            )}
          </div>
        </div>

        {/* Paso 2 — DNS + verificación */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {pasoDot(2, paso === 2, paso > 2)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: paso >= 2 ? 'var(--ink)' : 'var(--faint)' }}>Carga estos registros en el DNS de tu dominio</div>
            {paso === 2 && (
              <>
                <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '4px', lineHeight: 1.5 }}>
                  En el panel donde administras el dominio (Cloudflare, GoDaddy, SiteGround…), agrega estos registros tal cual. Después toca <strong>Verificar</strong> — puede tardar unos minutos en propagar.
                </div>
                <div style={{ marginTop: '10px', border: '1px solid var(--border)', borderRadius: '11px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1.2fr 2fr 70px 70px', gap: '10px', padding: '9px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                    <span>Tipo</span><span>Host</span><span>Valor</span><span>Prior.</span><span></span>
                  </div>
                  {dom.records.map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1.2fr 2fr 70px 70px', gap: '10px', padding: '10px 12px', borderBottom: i < dom.records.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: '12.5px' }}>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: 'var(--ink)' }}>{r.type}</span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--ink)', wordBreak: 'break-all' }}>{r.name}</span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--dim)', wordBreak: 'break-all', fontSize: '11.5px' }}>{r.value.length > 60 ? r.value.slice(0, 60) + '…' : r.value}</span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--dim)' }}>{r.priority ?? '—'}</span>
                      <button onClick={() => void copiar(r.value, i)} style={{ padding: '4px 8px', borderRadius: '7px', border: '1px solid var(--border-strong)', background: copiado === i ? 'var(--good-bg)' : 'var(--surface)', color: copiado === i ? 'var(--good)' : 'var(--dim)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>{copiado === i ? '✓' : 'Copiar'}</button>
                    </div>
                  ))}
                  {dom.records.length === 0 && <div style={{ padding: '12px', fontSize: '12.5px', color: 'var(--faint)' }}>Cargando registros…</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => void accion({ action: 'verificar' })} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Verificando…' : 'Ya los cargué → Verificar'}</button>
                  <span style={{ fontSize: '12px', color: dom.estadoDominio === 'failure' ? 'var(--bad)' : 'var(--faint)' }}>
                    Estado: <strong>{dom.estadoDominio ?? 'pendiente'}</strong> · se re-chequea solo cada 10s
                  </span>
                </div>
              </>
            )}
            {paso > 2 && <div style={{ fontSize: '13px', color: 'var(--good)', marginTop: '3px', fontWeight: 600 }}>Dominio verificado ✓</div>}
          </div>
        </div>

        {/* Paso 3 — remitente */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {pasoDot(3, paso === 3 && dom.sandbox, paso === 3 && !dom.sandbox)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: paso >= 3 ? 'var(--ink)' : 'var(--faint)' }}>El remitente que van a ver tus leads</div>
            {paso === 3 && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Ana López)"
                    style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', outline: 'none', minWidth: '200px' }} />
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: '9px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="hola" style={{ padding: '9px 4px 9px 12px', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", fontSize: '13.5px', outline: 'none', width: '110px', textAlign: 'right' }} />
                    <span style={{ padding: '9px 12px 9px 2px', fontFamily: "'Geist Mono', monospace", fontSize: '13.5px', color: 'var(--dim)' }}>@{dom.dominio}</span>
                  </div>
                  <button onClick={() => void accion({ action: 'remitente', local, nombre })} disabled={busy || !nombre.trim() || !local.trim()}
                    style={{ ...btnAccent, opacity: busy || !nombre.trim() || !local.trim() ? 0.6 : 1 }}>{busy ? 'Guardando…' : 'Guardar remitente'}</button>
                </div>
                {!dom.sandbox && <div style={{ fontSize: '12.5px', color: 'var(--good)', marginTop: '8px', fontWeight: 600 }}>Remitente actual: {dom.remitente} ✓ — ¡listo! Ya puedes activar el envío real.</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {err && <div style={{ marginTop: '14px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '13px' }}>{err}</div>}
      {!dom.resendConfigurado && (
        <div style={{ marginTop: '14px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px' }}>
          Falta la API key de Resend. <BotonIntegracion servicio="email" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>Conectar Resend</BotonIntegracion>
        </div>
      )}
    </div>
  );
}
