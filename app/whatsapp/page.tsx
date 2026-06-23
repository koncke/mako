'use client';

// =============================================================================
// WhatsApp — Inbox real (Chatwoot, agrupado por contacto) + Secuencias
// =============================================================================
//  - Conversaciones: un hilo por persona (junta las conversaciones que Chatwoot
//    haya creado para ese contacto), con todos los mensajes incl. respuestas.
//    Responder = texto libre (solo entra dentro de la ventana de 24h del lead).
//    Cada contacto muestra su etapa del funnel; se puede filtrar por etapa.
//  - Secuencias: las 13 etapas reales de nutricion_secuencias (activar/pausar).
//    El cuerpo de cada paso es una plantilla aprobada de Meta (solo lectura).
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;                 // clave de grupo (por teléfono) — junta duplicados
  convIds: number[];          // todas las conversaciones de esa persona
  sendContactId: number;      // contacto al que se le manda (el de la conv más reciente)
  contacto: string;
  telefono: string | null;
  ultimoMensaje: string | null;
  ultimaActividad: number;
  sinLeer: number;
  ventanaAbierta: boolean;
  leadId: number | null;
  empresa: string | null;
  estadoLead: string | null;
  etapaKey: string | null;
  etapaLabel: string | null;
}

interface Mensaje {
  id: number;
  texto: string | null;
  saliente: boolean;
  fecha: number | null;
  template: string | null;
  status: string | null;
  error: string | null;
}

interface Template {
  name: string;
  category: string;
  language: string;
  params: string[];
  body: string;
}

interface Paso {
  orden: number;
  canal: string;
  delay_horas: number;
  asunto: string | null;
  cuerpo: string;
  template_wa: string | null;
}

interface Secuencia {
  id: number;
  clave: string;
  nombre: string;
  etapa: string;
  trigger_tipo: string;
  activa: boolean;
  pasos: Paso[];
  inscriptos: number;
  enviados: number;
}

type View = 'chats' | 'sequences';

const QUICK = ['Reagendar tu Diagnóstico', 'Te paso el link de pago', 'Te comparto el video de nuevo'];

const ETAPA_COLOR: Record<string, string> = {
  cliente: '#1D9E75', 'por-cobrar': '#C7417B', 'no-show': '#B5630A', j2: '#4F5BD5',
  'post-j1': '#6A4BD8', agendo: '#9D4EDD', 'vio-vsl': '#185FA5', form: '#888780', abierto: '#888780',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}

function fmtTime(unixSec: number | null): string {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString()
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}

function fmtDelay(horas: number): string {
  if (horas < 1) return 'inmediato';
  if (horas < 24) return `${Math.round(horas)} h`;
  return `día ${Math.round(horas / 24)}`;
}

const avatarStyle: CSSProperties = {
  width: '40px', height: '40px', flex: 'none', borderRadius: '50%',
  background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border-strong)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px',
};

function etapaChip(key: string | null, label: string | null): { style: CSSProperties; dot: CSSProperties; label: string } | null {
  if (!key || !label) return null;
  const color = ETAPA_COLOR[key] ?? '#888780';
  return {
    label,
    dot: { width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: color },
    style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px', background: 'var(--surface-2)', color: 'var(--dim)', border: '1px solid var(--border)', whiteSpace: 'nowrap' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [view, setView] = useState<View>('chats');

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todas');
  const [soloVentana, setSoloVentana] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const totalSinLeerRef = useRef<number | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selTpl, setSelTpl] = useState<string>('');

  const [secuencias, setSecuencias] = useState<Secuencia[]>([]);
  const [loadingSeqs, setLoadingSeqs] = useState(true);
  const [selSeqId, setSelSeqId] = useState<number | null>(null);

  // ── Carga inicial ──
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/conversations');
        const j = await r.json();
        const list: Contacto[] = j.ok ? j.contactos : [];
        setContactos(list);
        totalSinLeerRef.current = list.reduce((s, c) => s + c.sinLeer, 0);
        if (list[0]) setSelId(list[0].id);
      } finally {
        setLoadingConvs(false);
      }
    })();
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/secuencias');
        const j = await r.json();
        const list: Secuencia[] = j.ok ? j.secuencias : [];
        setSecuencias(list);
        if (list[0]) setSelSeqId(list[0].id);
      } finally {
        setLoadingSeqs(false);
      }
    })();
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/templates');
        const j = await r.json();
        setTemplates(j.ok ? j.templates : []);
      } catch {
        /* sin templates */
      }
    })();
  }, []);

  // ── Mensajes del contacto seleccionado (merge de sus conversaciones) ──
  useEffect(() => {
    if (selId == null) { setMensajes([]); return; }
    const grupo = contactos.find((c) => c.id === selId);
    const ids = grupo?.convIds ?? [];
    if (!ids.length) { setMensajes([]); return; }
    setLoadingMsgs(true);
    setSendError(null);
    void (async () => {
      try {
        const r = await fetch(`/api/whatsapp/thread?ids=${ids.join(',')}`);
        const j = await r.json();
        setMensajes(j.ok ? j.mensajes : []);
      } finally {
        setLoadingMsgs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  // ── Notificación (con sonido) de mensajes entrantes — polling cada 20s ──
  useEffect(() => {
    const beep = () => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.36);
      } catch { /* sin audio */ }
    };
    const tick = async () => {
      try {
        const r = await fetch('/api/whatsapp/conversations');
        const j = await r.json();
        if (!j.ok) return;
        const list: Contacto[] = j.contactos;
        const total = list.reduce((s, c) => s + c.sinLeer, 0);
        const prev = totalSinLeerRef.current;
        if (prev != null && total > prev) {
          const nuevo = [...list].sort((a, b) => b.ultimaActividad - a.ultimaActividad).find((c) => c.sinLeer > 0);
          setToast(`Nuevo mensaje${nuevo ? ` de ${nuevo.contacto}` : ''}`);
          beep();
          setTimeout(() => setToast(null), 6000);
        }
        totalSinLeerRef.current = total;
        setContactos(list);
      } catch { /* ignore */ }
    };
    const iv = setInterval(() => void tick(), 20000);
    return () => clearInterval(iv);
  }, []);

  async function refetchHilo(grupo: Contacto) {
    const rr = await fetch(`/api/whatsapp/thread?ids=${grupo.convIds.join(',')}`);
    const jj = await rr.json();
    setMensajes(jj.ok ? jj.mensajes : []);
  }

  async function enviar() {
    const txt = draft.trim();
    const grupo = contactos.find((c) => c.id === selId);
    if (!txt || !grupo || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: txt }),
      });
      const j = await r.json();
      if (!j.ok) {
        setSendError(j.error || 'No se pudo enviar.');
      } else {
        setDraft('');
        await refetchHilo(grupo);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function enviarTemplate() {
    const t = templates.find((x) => x.name === selTpl);
    const grupo = contactos.find((c) => c.id === selId);
    if (!t || !grupo || sending) return;
    setSending(true);
    setSendError(null);
    const param = t.params[0];
    const nombre = grupo.contacto ?? '';
    const bodyParams: Record<string, string> = param ? { [param]: nombre } : {};
    const content = param ? t.body.split(`{{${param}}}`).join(nombre) : t.body;
    try {
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: t.name, category: t.category, language: t.language, bodyParams, content }),
      });
      const j = await r.json();
      if (!j.ok) {
        setSendError(j.error || 'No se pudo enviar la plantilla.');
      } else {
        await refetchHilo(grupo);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function toggleSeq(id: number, activa: boolean) {
    setSecuencias((prev) => prev.map((s) => (s.id === id ? { ...s, activa } : s)));
    await fetch('/api/whatsapp/secuencias', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, activa }),
    });
  }

  // ── Derivados ──
  const isChats = view === 'chats';
  const q = search.trim().toLowerCase();
  const etapasPresentes = [...new Map(contactos.filter((c) => c.etapaKey).map((c) => [c.etapaKey, c.etapaLabel])).entries()];
  const filtrados = contactos.filter((c) => {
    if (filtroEtapa !== 'todas' && c.etapaKey !== filtroEtapa) return false;
    if (soloVentana && !c.ventanaAbierta) return false;
    if (q && !(c.contacto.toLowerCase().includes(q) || (c.empresa ?? '').toLowerCase().includes(q) || (c.telefono ?? '').includes(q))) return false;
    return true;
  });
  const sel = contactos.find((c) => c.id === selId) ?? null;
  const seqSel = secuencias.find((s) => s.id === selSeqId) ?? null;
  const ventanaAbierta = sel?.ventanaAbierta ?? false;
  const templatesInbox = templates.filter((t) => t.params.length <= 1); // autollenables con {{nombre}}

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 500, background: 'transparent', color: 'var(--dim)' };
  const chipBtn = (active: boolean): CSSProperties => ({ padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 600, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border)'), background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      {toast && (
        <div onClick={() => setToast(null)} style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: 'var(--ink)', color: 'var(--on-sidebar)', padding: '12px 16px', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.28)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>💬 {toast}</div>
      )}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>WhatsApp</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: '12.5px', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--good)' }}></span>Chatwoot conectado
            </span>
          </div>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>Conversaciones reales de WhatsApp · secuencias de <strong style={{ color: 'var(--ink)' }}>nutrición</strong> automáticas.</div>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => setView('chats')} style={isChats ? tabActive : tabIdle}>Conversaciones</button>
          <button onClick={() => setView('sequences')} style={!isChats ? tabActive : tabIdle}>Secuencias automáticas</button>
        </div>
      </header>

      {/* ============= CONVERSACIONES ============= */}
      {isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '330px 1fr 290px', gap: '16px' }}>
          {/* LISTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa o teléfono…" style={{ width: '100%', padding: '10px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                <Dropdown
                  value={filtroEtapa}
                  onChange={setFiltroEtapa}
                  width={158}
                  ariaLabel="Filtrar por etapa"
                  buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
                  options={[{ value: 'todas', label: 'Todas las etapas' }, ...etapasPresentes.map(([k, label]) => ({ value: (k as string) ?? '', label: (label as string) ?? '', color: ETAPA_COLOR[(k as string) ?? ''] }))]}
                />
                <button onClick={() => setSoloVentana((v) => !v)} style={chipBtn(soloVentana)}>⏱ Ventana 24h</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
              {loadingConvs && <div style={{ padding: '18px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
              {!loadingConvs && filtrados.length === 0 && <div style={{ padding: '18px', color: 'var(--faint)', fontSize: '13.5px' }}>Sin conversaciones.</div>}
              {filtrados.map((c) => {
                const active = c.id === selId;
                const chip = etapaChip(c.etapaKey, c.etapaLabel);
                return (
                  <div key={c.id} onClick={() => setSelId(c.id)} style={{ display: 'flex', gap: '11px', padding: '11px 12px', borderRadius: '12px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                    <div style={avatarStyle}>{initials(c.contacto)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.contacto}</span>
                        <span style={{ flex: 'none', fontSize: '11px', color: 'var(--faint)' }}>{fmtTime(c.ultimaActividad)}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ultimoMensaje ?? '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px' }}>
                        {chip && <span style={chip.style}><span style={chip.dot}></span>{chip.label}</span>}
                        {c.sinLeer > 0 && <span style={{ marginLeft: 'auto', flex: 'none', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--good)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.sinLeer}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HILO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {!sel && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>Elegí una conversación</div>}
            {sel && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                    <div style={avatarStyle}>{initials(sel.contacto)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '15.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.contacto}</div>
                      <div style={{ fontSize: '12px', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{sel.telefono ?? '—'}</div>
                    </div>
                  </div>
                  {etapaChip(sel.etapaKey, sel.etapaLabel) && (() => { const ch = etapaChip(sel.etapaKey, sel.etapaLabel)!; return <span style={ch.style}><span style={ch.dot}></span>{ch.label}</span>; })()}
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface-2)' }}>
                  {loadingMsgs && <div style={{ color: 'var(--dim)', fontSize: '13.5px' }}>Cargando mensajes…</div>}
                  {!loadingMsgs && mensajes.length === 0 && <div style={{ color: 'var(--faint)', fontSize: '13.5px' }}>Sin mensajes.</div>}
                  {mensajes.map((m) => {
                    const mine = m.saliente;
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.template ? 'var(--auto-bubble)' : (mine ? 'var(--wa-bubble)' : 'var(--surface)'), border: '1px solid ' + (m.template ? 'var(--warn-fill)' : (mine ? 'rgba(28,138,84,.30)' : 'var(--border)')), boxShadow: '0 1px 2px rgba(23,21,17,.04)' }}>
                          {m.template && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: '5px' }}>⚡ Plantilla · {m.template}</div>}
                          <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto ?? ''}</div>
                          <div style={{ fontSize: '10.5px', color: m.status === 'failed' ? 'var(--warn)' : 'var(--faint)', marginTop: '5px', textAlign: mine ? 'right' : 'left' }}>
                            {fmtTime(m.fecha)}
                            {mine && m.status ? ' · ' + (m.status === 'delivered' ? 'entregado ✓✓' : m.status === 'read' ? 'leído ✓✓' : m.status === 'sent' ? 'enviado ✓' : m.status === 'failed' ? 'falló ✗' : m.status) : ''}
                            {mine && m.status === 'failed' && m.error ? ` — ${m.error}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {sendError && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: '12.5px' }}>{sendError}</div>}
                {ventanaAbierta ? (
                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }} placeholder="Escribí un mensaje…" style={{ flex: 1, minHeight: '44px', maxHeight: '120px', resize: 'none', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.4, outline: 'none' }} />
                    <button onClick={() => void enviar()} disabled={sending} style={{ flex: 'none', height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: 'var(--good)', color: '#fff', fontSize: '14.5px', fontWeight: 600, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, fontFamily: "'Geist', sans-serif" }}>{sending ? 'Enviando…' : 'Enviar'}</button>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Ventana de 24h cerrada (el lead no escribió hace más de un día). Fuera de la ventana WhatsApp solo entrega <strong>plantillas aprobadas</strong>:</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select value={selTpl} onChange={(e) => setSelTpl(e.target.value)} style={{ flex: 1, height: '44px', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', outline: 'none' }}>
                        <option value="">Elegí una plantilla…</option>
                        {templatesInbox.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category})</option>)}
                      </select>
                      <button onClick={() => void enviarTemplate()} disabled={sending || !selTpl} style={{ flex: 'none', height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: 'var(--good)', color: '#fff', fontSize: '14.5px', fontWeight: 600, cursor: (sending || !selTpl) ? 'default' : 'pointer', opacity: (sending || !selTpl) ? 0.6 : 1, fontFamily: "'Geist', sans-serif" }}>{sending ? 'Enviando…' : 'Enviar plantilla'}</button>
                    </div>
                    {selTpl && (() => { const t = templatesInbox.find((x) => x.name === selTpl); if (!t) return null; const txt = t.params[0] ? t.body.split(`{{${t.params[0]}}}`).join(sel?.contacto ?? '') : t.body; return <div style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--faint)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{txt}</div>; })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CONTEXTO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', padding: '18px' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Lead</div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{sel?.contacto ?? '—'}</div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>{sel?.empresa ?? 'Sin empresa registrada'}</div>
            {sel && etapaChip(sel.etapaKey, sel.etapaLabel) && (() => { const ch = etapaChip(sel.etapaKey, sel.etapaLabel)!; return <div style={{ marginTop: '10px' }}><span style={ch.style}><span style={ch.dot}></span>{ch.label}</span></div>; })()}
            <a href={sel?.leadId ? `/leads/${sel.leadId}` : '/leads'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>{sel?.leadId ? 'Abrir ficha en CRM →' : 'Buscar en CRM →'}</a>
            <div style={{ height: '1px', background: 'var(--border)', margin: '18px 0' }}></div>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '11px' }}>Plantillas rápidas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {QUICK.map((t) => (
                <button key={t} onClick={() => setDraft(t)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '12px', lineHeight: 1.5 }}>El texto libre solo llega si el lead escribió en las últimas 24h. Para reactivar en frío, lo hace el motor de nutrición con plantillas aprobadas.</div>
          </div>
        </div>
      )}

      {/* ============= SECUENCIAS ============= */}
      {!isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Secuencias por etapa</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingSeqs && <div style={{ padding: '14px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
              {!loadingSeqs && secuencias.length === 0 && <div style={{ padding: '14px', color: 'var(--faint)', fontSize: '13.5px' }}>No hay secuencias todavía.</div>}
              {secuencias.map((s) => {
                const active = s.id === selSeqId;
                return (
                  <div key={s.id} onClick={() => setSelSeqId(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '11px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                    <span style={{ width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: s.activa ? 'var(--good)' : 'var(--faint)' }}></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '1px' }}>{s.pasos.length} pasos · {s.activa ? 'activa' : 'pausada'} · {s.inscriptos} inscriptos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {!seqSel && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>Elegí una secuencia</div>}
            {seqSel && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: seqSel.activa ? 'var(--good)' : 'var(--faint)' }}></span>
                      <span style={{ fontWeight: 600, fontSize: '19px', letterSpacing: '-0.01em', color: 'var(--ink)' }}>{seqSel.nombre}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '4px' }}>{seqSel.enviados} enviados · {seqSel.inscriptos} inscriptos · trigger: <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px' }}>{seqSel.trigger_tipo}</code></div>
                  </div>
                  <button onClick={() => void toggleSeq(seqSel.id, !seqSel.activa)} style={{ flex: 'none', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, border: '1px solid ' + (seqSel.activa ? 'var(--border-strong)' : 'var(--good)'), background: seqSel.activa ? 'var(--surface)' : 'var(--good-bg)', color: seqSel.activa ? 'var(--dim)' : 'var(--good)' }}>{seqSel.activa ? '⏸ Pausar secuencia' : '▶ Activar secuencia'}</button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px' }}>
                  {seqSel.pasos.map((st, i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: '34px' }}>
                        <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--auto-bubble)', border: '1px solid var(--warn-fill)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                        {i < seqSel.pasos.length - 1 && <span style={{ width: '2px', flex: 1, minHeight: '30px', background: 'var(--border)' }}></span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingBottom: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", fontSize: '12px' }}>{fmtDelay(st.delay_horas)}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--good)', fontWeight: 600 }}>⚡ {st.canal === 'whatsapp' ? 'WhatsApp' : st.canal}</span>
                          {st.template_wa && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', color: 'var(--dim)' }}>{st.template_wa}</span>}
                        </div>
                        <div style={{ width: '100%', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{st.cuerpo}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '8px', paddingLeft: '50px', lineHeight: 1.5 }}>El cuerpo de cada paso es una <strong>plantilla aprobada de Meta</strong> — se administra desde Meta/Chatwoot, no acá. Variable disponible: <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 5px', fontFamily: "'Geist Mono', monospace" }}>{'{{nombre}}'}</code>.</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
