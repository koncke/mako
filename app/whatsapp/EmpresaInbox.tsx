'use client';

// =============================================================================
// EmpresaInbox — inbox del WhatsApp NO oficial (Evolution), leído del espejo en
// nuestra DB (/api/whatsapp/evolution/mensajes). Autocontenido: lista de chats +
// hilo. Es el "respaldo total" del PDF hecho vista: aunque banean el número, el
// historial vive acá. Se muestra en la tab WhatsApp con el toggle de canal.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { WhatsAppAdvisor } from './WhatsAppAdvisor';
import { EmojiPicker } from './EmojiPicker';
import { SendArrow, IconSmiley, IconClip, IconMic, iconComposerBtn } from './_shared/composer-icons';
import { useVoiceRecorder, VoiceRecorderBar } from './_shared/VoiceRecorder';
import { Avatar } from './_shared/Avatar';
import { Ticks } from './_shared/Ticks';
import { Dropdown } from '../components/Dropdown';
import { ETAPA_COLOR, etapaChip } from '@/lib/wa-etapas';
import { useNotifications } from '../_components/NotificationsProvider';

// La MISMA ficha editable del CRM que usa el inbox oficial (on-demand, ssr:false).
const LeadEditModal = dynamic(() => import('../leads/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });
// Atajos: idénticos a los del inbox oficial (se pasan al panel de MaKo).
const QUICK = ['Reagendar tu Diagnóstico', 'Te paso el link de pago', 'Te comparto el video de nuevo'];

type Conv = {
  chatJid: string; telefono: string | null; nombre: string; leadId: number | null;
  empresa: string | null; etapaKey: string | null; etapaLabel: string | null;
  ultimoTexto: string | null; ultimoTipo: string | null; ultimaFecha: string | null;
  ultimoEntrante: boolean; total: number; bloqueado: boolean;
};
type Msg = { id: number; fromMe: boolean; tipo: string | null; texto: string | null; mediaUrl: string | null; mediaMime: string | null; fecha: string | null; status: string | null };
type Borr = { id: number; leadId: number | null; telefono: string; texto: string; origen: string; leadNombre: string | null; createdAt: string };

async function jget<T>(url: string): Promise<T> { const r = await fetch(url, { cache: 'no-store' }); return r.json() as Promise<T>; }
async function jpost<T>(url: string, body: unknown): Promise<T> { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json() as Promise<T>; }

// Cache a NIVEL MÓDULO: sobrevive el desmontaje del componente (toggle de canal o
// navegación entre tabs) → al volver, la lista y el hilo aparecen al instante y se
// refrescan en 2º plano, sin recargar todo con spinner. (El oficial logra esto con
// un provider en el layout; acá alcanza con módulo-scope porque el JS no se recarga.)
let convsCache: Conv[] = [];
const msgsCache = new Map<string, Msg[]>();
function cacheMsgs(chat: string, m: Msg[]) {
  if (msgsCache.has(chat)) msgsCache.delete(chat);
  msgsCache.set(chat, m);
  while (msgsCache.size > 40) { const k = msgsCache.keys().next().value; if (k === undefined) break; msgsCache.delete(k); }
}
const DRAFTS_KEY = 'mako-wa-empresa-drafts';

function fmtHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtDia(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}
function preview(c: Conv): string {
  if (c.ultimoTexto) return c.ultimoTexto;
  switch (c.ultimoTipo) { case 'image': return 'Foto'; case 'audio': return 'Nota de voz'; case 'video': return 'Video'; case 'document': return 'Documento'; case 'sticker': return 'Sticker'; default: return '—'; }
}

export function EmpresaInbox() {
  const { setOpenChatNoOficial } = useNotifications();
  const [convs, setConvs] = useState<Conv[]>(convsCache);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(convsCache.length === 0);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errMsgs, setErrMsgs] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try { const raw = localStorage.getItem(DRAFTS_KEY); return raw ? (JSON.parse(raw) as Record<string, string>) : {}; } catch { return {}; }
  });
  const [sending, setSending] = useState(false);
  const [borradores, setBorradores] = useState<Borr[]>([]);
  const [showBorr, setShowBorr] = useState(false);
  const [borrBusy, setBorrBusy] = useState<number | null>(null);
  const [borrErr, setBorrErr] = useState<string | null>(null);
  const [detalleLeadId, setDetalleLeadId] = useState<number | null>(null); // abre la ficha del CRM
  const [blocking, setBlocking] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef<string | null>(null);   // chat objetivo (anti-race del poll)
  const stickRef = useRef(true);                 // ¿el user está pegado al fondo?
  // Ref al setter (identidad inestable del provider) → usarlo en el efecto de
  // selección y en el cleanup de desmontaje sin re-suscribir en cada re-render.
  const setOpenNoOfRef = useRef(setOpenChatNoOficial);
  setOpenNoOfRef.current = setOpenChatNoOficial;
  useEffect(() => () => setOpenNoOfRef.current(null), []);

  // Borrador POR CHAT, persistido en localStorage (como el oficial): cambiar de chat
  // o de tab NO pierde lo escrito, y recargar la página tampoco. `draft` es derivado.
  useEffect(() => { try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* quota/priv */ } }, [drafts]);
  const draft = sel ? (drafts[sel] ?? '') : '';
  const setDraft = useCallback((v: string | ((prev: string) => string)) => {
    if (!sel) return;
    setDrafts((d) => {
      const prev = d[sel] ?? '';
      const next = typeof v === 'function' ? v(prev) : v;
      if (!next) { const { [sel]: _omit, ...rest } = d; return rest; }
      return { ...d, [sel]: next };
    });
  }, [sel]);

  const loadConvs = useCallback(async () => {
    try {
      const j = await jget<{ ok: boolean; error?: string; conversaciones: Conv[] }>('/api/whatsapp/evolution/mensajes');
      if (!j.ok) throw new Error(j.error || 'No se pudieron cargar las conversaciones');
      convsCache = j.conversaciones;
      setConvs(j.conversaciones); setErr(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingConvs(false); }
  }, []);

  // Auto-abrir la conversación más reciente al entrar (#1) — sin pisar una elección
  // manual (solo si no hay nada seleccionado).
  useEffect(() => { if (sel == null && convs.length) setSel(convs[0].chatJid); }, [convs, sel]);

  useEffect(() => { void loadConvs(); const t = setInterval(() => void loadConvs(), 15000); return () => clearInterval(t); }, [loadConvs]);

  const loadBorr = useCallback(async () => {
    const j = await jget<{ ok: boolean; borradores: Borr[] }>('/api/whatsapp/evolution/borradores');
    if (j.ok) setBorradores(j.borradores);
  }, []);
  useEffect(() => { void loadBorr(); const t = setInterval(() => void loadBorr(), 20000); return () => clearInterval(t); }, [loadBorr]);

  async function accionBorrador(id: number, action: 'enviar' | 'descartar') {
    setBorrBusy(id); setBorrErr(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/borradores', { id, action });
      if (j.ok) {
        await loadBorr();
        if (action === 'enviar') { await loadConvs(); if (selRef.current) await loadMsgs(selRef.current); }
      } else setBorrErr(j.error || 'No se pudo completar');
    } finally { setBorrBusy(null); }
  }

  async function enviarManual() {
    const sc = convs.find((c) => c.chatJid === sel);
    if (!sc || !draft.trim()) return;
    setSending(true);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/mensajes', { telefono: sc.telefono, chat: sc.chatJid, texto: draft.trim() });
      if (j.ok) { setDraft(''); stickRef.current = true; await loadMsgs(sc.chatJid); }
      else setErrMsgs(j.error || 'No se pudo enviar');
    } finally { setSending(false); }
  }

  async function toggleBloqueo() {
    const sc = convs.find((c) => c.chatJid === sel);
    if (!sc?.telefono) return;
    const bloq = sc.bloqueado;
    if (!bloq && !window.confirm(`¿Bloquear a ${sc.nombre}? No le vas a poder escribir por el no oficial y el motor tampoco le manda.`)) return;
    setBlocking(true);
    try {
      const j = await jpost<{ ok: boolean; error?: string; bloqueado: boolean }>('/api/whatsapp/evolution/block', { telefono: sc.telefono, action: bloq ? 'unblock' : 'block', leadId: sc.leadId });
      if (j.ok) {
        const upd = (arr: Conv[]) => arr.map((c) => (c.chatJid === sc.chatJid ? { ...c, bloqueado: j.bloqueado } : c));
        setConvs((prev) => upd(prev));
        convsCache = upd(convsCache);
      } else setErrMsgs(j.error || 'No se pudo cambiar el bloqueo.');
    } finally { setBlocking(false); }
  }

  // Envío de media (archivo o nota de voz) por multipart. tipo='audio' para voz;
  // '' → el backend infiere imagen/video/documento del mimetype.
  async function enviarArchivo(blob: Blob, tipo: '' | 'audio', fileName: string) {
    const sc = convs.find((c) => c.chatJid === sel);
    if (!sc) return;
    setSending(true); setErrMsgs(null);
    try {
      const fd = new FormData();
      fd.append('chat', sc.chatJid);
      if (sc.telefono) fd.append('telefono', sc.telefono);
      if (sc.leadId) fd.append('leadId', String(sc.leadId));
      fd.append('tipo', tipo);
      fd.append('archivo', blob, fileName);
      const r = await fetch('/api/whatsapp/evolution/mensajes', { method: 'POST', body: fd });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (j.ok) { stickRef.current = true; await loadMsgs(sc.chatJid); }
      else setErrMsgs(j.error || 'No se pudo enviar el archivo');
    } catch (e) { setErrMsgs(e instanceof Error ? e.message : String(e)); }
    finally { setSending(false); }
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setErrMsgs('Archivo muy grande (máx 4 MB).'); return; }
    await enviarArchivo(f, '', f.name);
  }

  // Nota de voz con el grabador COMPARTIDO (idéntico al oficial). Transcodifica a
  // MP3 (formato universal, reusa audio.ts del oficial) y lo manda como 'audio'.
  const enviarAudioBlob = async (blob: Blob) => {
    setSending(true);
    let mp3: Blob;
    try {
      const { blobToMp3 } = await import('./audio');
      mp3 = await blobToMp3(blob);
    } catch (e) {
      setErrMsgs('No se pudo procesar el audio (' + (e instanceof Error ? e.message : 'error') + ').');
      setSending(false);
      return;
    }
    await enviarArchivo(mp3, 'audio', 'nota-de-voz.mp3');
  };
  const voz = useVoiceRecorder(enviarAudioBlob, setErrMsgs);

  const loadMsgs = useCallback(async (chat: string) => {
    setLoadingMsgs(true);
    try {
      const j = await jget<{ ok: boolean; error?: string; mensajes: Msg[] }>(`/api/whatsapp/evolution/mensajes?chat=${encodeURIComponent(chat)}`);
      if (selRef.current !== chat) return; // el user cambió de chat mientras cargaba → descartar
      if (!j.ok) { setErrMsgs(j.error || 'No se pudieron cargar los mensajes'); return; }
      setErrMsgs(null);
      // Anti-parpadeo: conservamos la URL firmada ya cargada de cada mensaje (las
      // firmas cambian por poll; re-firmar recargaría la media). Solo los nuevos
      // estrenan URL.
      setMsgs((prev) => {
        const urlPorId = new Map(prev.filter((m) => m.mediaUrl).map((m) => [m.id, m.mediaUrl] as const));
        const merged = j.mensajes.map((m) => (m.mediaUrl && urlPorId.has(m.id) ? { ...m, mediaUrl: urlPorId.get(m.id)! } : m));
        cacheMsgs(chat, merged); // instant re-open la próxima vez (#4)
        return merged;
      });
    } catch { if (selRef.current === chat) setErrMsgs('Error de red al cargar los mensajes'); }
    finally { if (selRef.current === chat) setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    selRef.current = sel;
    // Avisar al provider qué chat está abierto → no notifica ese chat y lo marca
    // leído (baja el badge del sidebar). Al desmontar/cerrar, se libera.
    setOpenNoOfRef.current(sel);
    if (!sel) { setMsgs([]); return; }
    stickRef.current = true;       // al abrir un chat, arrancamos pegados al fondo
    setMsgs(msgsCache.get(sel) ?? []); // pinta el cache al instante (sin spinner) y refresca
    setErrMsgs(null);
    void loadMsgs(sel);
    const t = setInterval(() => void loadMsgs(sel), 8000);
    return () => clearInterval(t);
  }, [sel, loadMsgs]);

  // Autoscroll SOLO si el user ya estaba pegado al fondo (no lo arrancamos de
  // leer historial arriba en cada poll).
  useEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [msgs]);
  const onScrollHilo = () => { const el = scrollRef.current; if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; };

  const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' };
  const selConv = convs.find((c) => c.chatJid === sel) ?? null;
  // Búsqueda + filtro por etapa (igual que el oficial), luego orden: chats con
  // borrador sin enviar arriba, después por recencia.
  const q = search.trim().toLowerCase();
  const etapasPresentes = [...new Map(convs.filter((c) => c.etapaKey).map((c) => [c.etapaKey!, c.etapaLabel!] as const)).entries()];
  const convsOrdenados = [...convs]
    .filter((c) => {
      if (filtroEtapa !== 'todas' && c.etapaKey !== filtroEtapa) return false;
      if (q && !(c.nombre.toLowerCase().includes(q) || (c.empresa ?? '').toLowerCase().includes(q) || (c.telefono ?? '').includes(q))) return false;
      return true;
    })
    .sort((a, b) => {
      const da = (drafts[a.chatJid] ?? '').trim() ? 1 : 0;
      const db = (drafts[b.chatJid] ?? '').trim() ? 1 : 0;
      if (da !== db) return db - da;
      return (b.ultimaFecha ?? '').localeCompare(a.ultimaFecha ?? '');
    });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px 1fr 344px', gap: '16px' }}>
      {/* LISTA */}
      <div style={card}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>API no Oficial</span>
          {borradores.length > 0 && (
            <button onClick={() => setShowBorr(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }} title="Mensajes que MaKo dejó listos para que los mandes con 1 clic">📝 {borradores.length} borrador{borradores.length > 1 ? 'es' : ''}</button>
          )}
        </div>
        {/* Búsqueda + filtro por etapa (#3, mismo patrón que el oficial) */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa o teléfono…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', outline: 'none' }} />
          {etapasPresentes.length > 0 && (
            <Dropdown value={filtroEtapa} onChange={setFiltroEtapa} width="100%" ariaLabel="Filtrar por etapa"
              options={[{ value: 'todas', label: 'Todas las etapas' }, ...etapasPresentes.map(([k, label]) => ({ value: k, label, color: ETAPA_COLOR[k] }))]} />
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
          {loadingConvs && convs.length === 0 && <div style={{ padding: '18px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
          {!loadingConvs && convs.length === 0 && !err && (
            <div style={{ padding: '18px', color: 'var(--faint)', fontSize: '13px', lineHeight: 1.5 }}>Todavía no hay mensajes en el número no oficial. Conectá el número (chip API no Oficial, arriba) y las conversaciones van a aparecer acá a medida que entren.</div>
          )}
          {err && <div style={{ margin: '10px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{err}</div>}
          {convsOrdenados.map((c) => {
            const active = c.chatJid === sel;
            const borr = (drafts[c.chatJid] ?? '').trim();
            return (
              <div key={c.chatJid} role="button" tabIndex={0} onClick={() => setSel(c.chatJid)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(c.chatJid); } }}
                style={{ display: 'flex', gap: '11px', padding: '11px 12px', borderRadius: '12px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'), alignItems: 'center' }}>
                <Avatar telefono={c.telefono} name={c.nombre} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                    <span style={{ fontSize: '11px', color: 'var(--faint)', flex: 'none' }}>{fmtDia(c.ultimaFecha)}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: borr || c.ultimoEntrante ? 'var(--ink)' : 'var(--faint)', fontWeight: c.ultimoEntrante ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {borr ? <><span style={{ color: 'var(--bad)', fontWeight: 600 }}>Borrador:</span> {borr}</> : <>{c.ultimoEntrante ? '' : '↩ '}{preview(c)}</>}
                  </div>
                </div>
                {c.leadId && <span title="Lead del CRM" style={{ width: '7px', height: '7px', flex: 'none', borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* HILO */}
      <div style={card}>
        {!selConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>Elegí una conversación</div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Avatar telefono={selConv.telefono} name={selConv.nombre} size={36} />
              <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{selConv.nombre}</div>
              {selConv.telefono && <span style={{ fontSize: '12.5px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace" }}>{selConv.telefono}</span>}
              <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--wa)', fontWeight: 600 }}>no oficial</span>
            </div>
            <div ref={scrollRef} onScroll={onScrollHilo} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface-2)' }}>
              {loadingMsgs && msgs.length === 0 && !errMsgs && <div style={{ color: 'var(--faint)', fontSize: '13px', textAlign: 'center' }}>Cargando…</div>}
              {errMsgs && (
                <div style={{ margin: 'auto', textAlign: 'center' }}>
                  <div style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px', marginBottom: '10px' }}>{errMsgs}</div>
                  <button onClick={() => sel && void loadMsgs(sel)} style={{ padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.fromMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', padding: '9px 12px', borderRadius: m.fromMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.fromMe ? 'var(--wa-bubble)' : 'var(--surface)', border: '1px solid ' + (m.fromMe ? 'rgba(28,138,84,.30)' : 'var(--border)') }}>
                    {m.mediaUrl && m.tipo === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mediaUrl} alt="imagen" style={{ maxWidth: '240px', borderRadius: '10px', display: 'block', marginBottom: m.texto ? '6px' : 0 }} />
                    )}
                    {m.mediaUrl && m.tipo === 'audio' && <audio controls src={m.mediaUrl} style={{ width: '240px' }} />}
                    {m.mediaUrl && m.tipo === 'video' && <video controls src={m.mediaUrl} style={{ maxWidth: '240px', borderRadius: '10px' }} />}
                    {m.mediaUrl && m.tipo === 'document' && <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--accent)' }}>📄 {m.texto || 'Documento'}</a>}
                    {!m.mediaUrl && (m.tipo === 'image' || m.tipo === 'audio' || m.tipo === 'video' || m.tipo === 'document') && <span style={{ fontSize: '13px', color: 'var(--faint)', fontStyle: 'italic' }}>📎 {m.texto || m.tipo} (no disponible)</span>}
                    {m.texto && m.tipo !== 'document' && <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                    <div style={{ fontSize: '10.5px', color: 'var(--faint)', marginTop: '3px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>{fmtHora(m.fecha)}{m.fromMe && <Ticks status={m.status} />}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              {showEmoji && (
                <div style={{ position: 'absolute', bottom: '64px', left: '12px', zIndex: 20 }}>
                  <EmojiPicker onPick={(em) => setDraft((d) => d + em)} onClose={() => setShowEmoji(false)} />
                </div>
              )}
              {voz.recording ? (
                <VoiceRecorderBar paused={voz.paused} secs={voz.secs} sending={sending}
                  onCancel={() => voz.stop(true)} onTogglePause={voz.paused ? voz.resume : voz.pause} onSend={() => voz.stop(false)} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                  <button onClick={() => setShowEmoji((v) => !v)} title="Emoji" style={{ ...iconComposerBtn, color: showEmoji ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
                  <button onClick={() => fileInput.current?.click()} disabled={sending} title="Adjuntar archivo" style={iconComposerBtn}><IconClip /></button>
                  <input ref={fileInput} type="file" onChange={onPickFile} style={{ display: 'none' }} accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviarManual(); } }}
                    placeholder="Escribí un mensaje… (sale por el número no oficial, con anti-baneo)" rows={1}
                    style={{ flex: 1, minHeight: '40px', maxHeight: '120px', resize: 'none', padding: '10px 14px', borderRadius: '21px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.35, outline: 'none' }} />
                  {draft.trim() ? (
                    <button onClick={() => void enviarManual()} disabled={sending} title="Enviar" style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
                  ) : (
                    <button onClick={() => void voz.start()} disabled={sending} title="Grabar nota de voz" style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.6 : 1 }}><IconMic /></button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* CONTEXTO — tarjeta del lead + panel de MaKo (mismo componente que el oficial) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', minHeight: 0, overflowY: 'auto', padding: '18px' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Lead</div>
        {selConv ? (
          <>
            {selConv.leadId ? (
              <button onClick={() => setDetalleLeadId(selConv.leadId!)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{selConv.nombre}</button>
            ) : (
              <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{selConv.nombre}</div>
            )}
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>{selConv.empresa ?? 'Sin empresa registrada'}</div>
            {etapaChip(selConv.etapaKey, selConv.etapaLabel) && (() => { const ch = etapaChip(selConv.etapaKey, selConv.etapaLabel)!; return <div style={{ marginTop: '8px' }}><span style={ch.style}><span style={ch.dot}></span>{ch.label}</span></div>; })()}
            {selConv.leadId ? (
              <button onClick={() => setDetalleLeadId(selConv.leadId!)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Ver detalle del lead →</button>
            ) : (
              <Link href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Buscar en CRM →</Link>
            )}
            {selConv.bloqueado && <div style={{ marginTop: '12px', fontSize: '12.5px', fontWeight: 600, color: 'var(--bad)' }}>Contacto bloqueado</div>}
            {selConv.telefono && (
              <button onClick={() => void toggleBloqueo()} disabled={blocking} style={{ marginTop: '12px', width: '100%', padding: '9px 12px', borderRadius: '10px', cursor: blocking ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, border: '1px solid ' + (selConv.bloqueado ? 'var(--border-strong)' : 'var(--bad)'), background: 'var(--surface)', color: selConv.bloqueado ? 'var(--dim)' : 'var(--bad)', opacity: blocking ? 0.6 : 1 }}>{blocking ? '…' : selConv.bloqueado ? 'Desbloquear contacto' : 'Bloquear contacto'}</button>
            )}
            <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0', flex: 'none' }}></div>
            <WhatsAppAdvisor
              grupo={{ id: selConv.chatJid, contacto: selConv.nombre, empresa: selConv.empresa, etapaLabel: selConv.etapaLabel }}
              mensajes={msgs.map((m) => ({ saliente: m.fromMe, texto: m.texto }))}
              ventanaAbierta={true}
              onUsar={(t) => setDraft((d) => (d.trim() ? `${d.replace(/\s+$/, '')}\n\n${t}` : t))}
              onRedactarPlantilla={() => {}}
              quickTemplates={QUICK}
            />
          </>
        ) : (
          <div style={{ fontSize: '12.5px', color: 'var(--faint)', lineHeight: 1.5 }}>Elegí una conversación para que MaKo te sugiera qué escribir.</div>
        )}
      </div>

      {detalleLeadId != null && <LeadEditModal leadId={detalleLeadId} onClose={() => setDetalleLeadId(null)} />}

      {/* Panel de borradores: mensajes listos para mandar con 1 clic (leads calientes) */}
      {showBorr && (
        <div onClick={() => setShowBorr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Borradores por enviar</div>
              <button onClick={() => setShowBorr(false)} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginBottom: '14px', lineHeight: 1.5 }}>A leads calientes el sistema no manda solo (anti-baneo). Revisá y enviá con 1 clic — o descartá.</div>
            {borrErr && <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{borrErr}</div>}
            {borradores.length === 0 && <div style={{ color: 'var(--faint)', fontSize: '13px', padding: '10px 0' }}>No hay borradores pendientes.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {borradores.map((b) => (
                <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>{b.leadNombre || b.telefono}</span>
                    <span style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace" }}>{b.origen}</span>
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{b.texto}</div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => void accionBorrador(b.id, 'descartar')} disabled={borrBusy === b.id} style={{ padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Descartar</button>
                    <button onClick={() => void accionBorrador(b.id, 'enviar')} disabled={borrBusy === b.id} style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', background: 'var(--wa)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: borrBusy === b.id ? 0.6 : 1 }}>{borrBusy === b.id ? 'Enviando…' : 'Enviar ✓'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
