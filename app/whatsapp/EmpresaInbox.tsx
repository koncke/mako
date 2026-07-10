'use client';

// =============================================================================
// EmpresaInbox — inbox del WhatsApp NO oficial (Evolution), leído del espejo en
// nuestra DB (/api/whatsapp/evolution/mensajes). Replica 1:1 el diseño y el
// comportamiento del inbox OFICIAL (mismas 3 columnas, filas, hilo, composer,
// tarjeta de lead + panel de MaKo), con UN acento de canal índigo (--wa-noof)
// para que NUNCA se confunda con el oficial: cinta superior del hilo, chip
// "NO OFICIAL" y tinte de la burbuja saliente. Es el "respaldo total" del PDF
// hecho vista: aunque banean el número, el historial vive acá.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type CSSProperties, type ChangeEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { WhatsAppAdvisor } from './WhatsAppAdvisor';
import { EmojiPicker } from './EmojiPicker';
import { SendArrow, IconSmiley, IconClip, IconMic } from './_shared/composer-icons';
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
// refrescan en 2º plano, sin recargar todo con spinner.
let convsCache: Conv[] = [];
const msgsCache = new Map<string, Msg[]>();
function cacheMsgs(chat: string, m: Msg[]) {
  if (msgsCache.has(chat)) msgsCache.delete(chat);
  msgsCache.set(chat, m);
  while (msgsCache.size > 40) { const k = msgsCache.keys().next().value; if (k === undefined) break; msgsCache.delete(k); }
}
const DRAFTS_KEY = 'mako-wa-empresa-drafts';
const LEIDO_KEY = 'mako-wa-empresa-leido';

// Botón redondo del compositor (emoji / adjuntar), idéntico al oficial (42x42 ghost).
const iconComposer: CSSProperties = {
  flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none',
  background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: '20px', lineHeight: 1,
};
const iconBtn: CSSProperties = {
  width: '28px', height: '28px', flex: 'none', borderRadius: '8px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
};
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' };

// Hora del último mensaje en la fila: hoy → HH:MM, si no → DD/MM (como el oficial).
function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString()
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}
function fmtHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function preview(c: Conv): string {
  if (c.ultimoTexto) return c.ultimoTexto;
  switch (c.ultimoTipo) { case 'image': return 'Foto'; case 'audio': return 'Nota de voz'; case 'video': return 'Video'; case 'document': return 'Documento'; case 'sticker': return 'Sticker'; case null: case undefined: return '—'; default: return '—'; }
}
const last10 = (tel: string | null) => (tel || '').replace(/\D/g, '').slice(-10);
function leerLeido(): Record<string, number> { try { const raw = localStorage.getItem(LEIDO_KEY); return raw ? (JSON.parse(raw) as Record<string, number>) : {}; } catch { return {}; } }

export function EmpresaInbox() {
  const { setOpenChatNoOficial } = useNotifications();
  const router = useRouter();
  const [convs, setConvs] = useState<Conv[]>(convsCache);
  const [busqLeads, setBusqLeads] = useState<Conv[]>([]); // leads del CRM traídos por el buscador (#2)
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(convsCache.length === 0);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errMsgs, setErrMsgs] = useState<string | null>(null);   // fallo de CARGA del hilo (con Reintentar)
  const [sendErr, setSendErr] = useState<string | null>(null);   // fallo de ENVÍO (barra sobre el composer, como el oficial)
  const [audioFase, setAudioFase] = useState<string | null>(null); // "Procesando…" / "Enviando…" de la nota de voz
  const [unreadAnchorId, setUnreadAnchorId] = useState<number | null>(null); // divisor "N no leídos" en el hilo
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  const [leidoMap, setLeidoMap] = useState<Record<string, number>>(() => (typeof window === 'undefined' ? {} : leerLeido()));
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try { const raw = localStorage.getItem(DRAFTS_KEY); return raw ? (JSON.parse(raw) as Record<string, string>) : {}; } catch { return {}; }
  });
  const [adjuntos, setAdjuntos] = useState<Record<string, File | null>>({});
  const [sending, setSending] = useState(false);
  const [borradores, setBorradores] = useState<Borr[]>([]);
  const [showBorr, setShowBorr] = useState(false);
  const [borrBusy, setBorrBusy] = useState<number | null>(null);
  const [borrErr, setBorrErr] = useState<string | null>(null);
  const [detalleLeadId, setDetalleLeadId] = useState<number | null>(null); // abre la ficha del CRM
  const [blocking, setBlocking] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockMotivo, setBlockMotivo] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [verOcultos, setVerOcultos] = useState(false); // vista "ver ocultos" para desocultar
  const [search, setSearch] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const [lightbox, setLightbox] = useState<{ tipo: 'image' | 'pdf'; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef<string | null>(null);   // chat objetivo (anti-race del poll)
  const stickRef = useRef(true);                 // ¿el user está pegado al fondo?
  const leidoAlAbrirRef = useRef(0);             // "leído hasta" al abrir el chat (para el divisor de no leídos)
  // Ref al setter (identidad inestable del provider) → usarlo en el efecto de
  // selección y en el cleanup de desmontaje sin re-suscribir en cada re-render.
  const setOpenNoOfRef = useRef(setOpenChatNoOficial);
  setOpenNoOfRef.current = setOpenChatNoOficial;
  useEffect(() => () => setOpenNoOfRef.current(null), []);

  // Borrador y adjunto POR CHAT (como el oficial): cambiar de chat/tab o recargar
  // NO pierde lo escrito ni el adjunto staged, y un adjunto queda atado a SU chat.
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
  const adjunto = sel ? (adjuntos[sel] ?? null) : null;
  const setAdjunto = (f: File | null) => { if (sel) setAdjuntos((a) => ({ ...a, [sel]: f })); };
  const adjuntoPreview = useMemo(() => (adjunto && adjunto.type.startsWith('image/') ? URL.createObjectURL(adjunto) : null), [adjunto]);
  useEffect(() => () => { if (adjuntoPreview) URL.revokeObjectURL(adjuntoPreview); }, [adjuntoPreview]);

  // Lista efectiva = conversaciones reales + leads del buscador que no estén ya
  // presentes (dedup por últimos 10 dígitos, tolera canonicalización MX/AR).
  const findConv = useCallback((jid: string | null): Conv | null => {
    if (!jid) return null;
    return convs.find((c) => c.chatJid === jid) ?? busqLeads.find((c) => c.chatJid === jid) ?? null;
  }, [convs, busqLeads]);

  const loadConvs = useCallback(async () => {
    try {
      const j = await jget<{ ok: boolean; error?: string; conversaciones: Conv[] }>(`/api/whatsapp/evolution/mensajes${verOcultos ? '?ocultos=1' : ''}`);
      if (!j.ok) throw new Error(j.error || 'No se pudieron cargar las conversaciones');
      if (!verOcultos) convsCache = j.conversaciones; // la vista normal alimenta el cache; la de ocultos no
      setConvs(j.conversaciones); setErr(null);
      setLeidoMap(leerLeido()); // refrescar marcadores de leído (los actualiza el provider)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingConvs(false); }
  }, [verOcultos]);

  // Auto-abrir la conversación más reciente al entrar (#1) — sin pisar una elección
  // manual (solo si no hay nada seleccionado).
  useEffect(() => { if (sel == null && convs.length) setSel(convs[0].chatJid); }, [convs, sel]);
  useEffect(() => { void loadConvs(); const t = setInterval(() => void loadConvs(), 15000); return () => clearInterval(t); }, [loadConvs]);

  // Buscador server-side: tipear un nombre/empresa/teléfono trae CUALQUIER lead del
  // CRM como conversación (#2), aunque nunca haya tenido mensajes. Debounce 350ms.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setBusqLeads([]); return; }
    const t = setTimeout(async () => {
      try {
        const j = await jget<{ ok: boolean; conversaciones: Conv[] }>(`/api/whatsapp/evolution/mensajes?buscar=${encodeURIComponent(q)}`);
        if (j.ok) setBusqLeads(j.conversaciones);
      } catch { /* búsqueda best-effort */ }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadBorr = useCallback(async () => {
    const j = await jget<{ ok: boolean; borradores: Borr[] }>('/api/whatsapp/evolution/borradores');
    if (j.ok) setBorradores(j.borradores);
  }, []);
  useEffect(() => { void loadBorr(); const t = setInterval(() => void loadBorr(), 20000); return () => clearInterval(t); }, [loadBorr]);

  const loadMsgs = useCallback(async (chat: string) => {
    // Spinner SOLO en la primera carga del chat (sin cache): el refresco de 8s
    // no debe parpadear el spinner en chats vacíos (leads recién traídos, total=0).
    if (!msgsCache.has(chat)) setLoadingMsgs(true);
    // Timeout duro: un backend colgado (p.ej. storage lento firmando media) NO
    // puede dejar el hilo "Cargando…" para siempre — cae a error + Reintentar.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(`/api/whatsapp/evolution/mensajes?chat=${encodeURIComponent(chat)}`, { cache: 'no-store', signal: ctrl.signal });
      const j = (await r.json()) as { ok: boolean; error?: string; mensajes: Msg[] };
      if (selRef.current !== chat) return; // el user cambió de chat mientras cargaba → descartar
      if (!j.ok) { setErrMsgs(j.error || 'No se pudieron cargar los mensajes'); return; }
      setErrMsgs(null);
      // Anti-parpadeo: conservamos la URL firmada ya cargada de cada mensaje.
      setMsgs((prev) => {
        const urlPorId = new Map(prev.filter((m) => m.mediaUrl).map((m) => [m.id, m.mediaUrl] as const));
        const merged = j.mensajes.map((m) => (m.mediaUrl && urlPorId.has(m.id) ? { ...m, mediaUrl: urlPorId.get(m.id)! } : m));
        cacheMsgs(chat, merged);
        return merged;
      });
    } catch { if (selRef.current === chat) setErrMsgs('Error de red al cargar los mensajes'); }
    finally { clearTimeout(to); if (selRef.current === chat) setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    selRef.current = sel;
    // Avisar al provider qué chat está abierto → no notifica ese chat y lo marca
    // leído (baja el badge del sidebar). Al desmontar/cerrar, se libera.
    setOpenNoOfRef.current(sel);
    setEmojiOpen(false);
    setSendErr(null);              // el error de envío no se arrastra entre chats
    leidoAlAbrirRef.current = sel ? (leidoMap[sel] ?? 0) : 0; // "leído hasta" ANTES de marcarlo (para el divisor)
    setUnreadAnchorId(null);
    if (!sel) { setMsgs([]); return; }
    stickRef.current = true;       // al abrir un chat, arrancamos pegados al fondo
    setMsgs(msgsCache.get(sel) ?? []); // pinta el cache al instante (sin spinner) y refresca
    setErrMsgs(null);
    void loadMsgs(sel);
    const t = setInterval(() => void loadMsgs(sel), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, loadMsgs]);

  // Marcar el chat abierto como LEÍDO al instante (sin esperar el poll de 15s):
  // espeja lo que hace el provider en localStorage → el punto verde se limpia ya.
  useEffect(() => {
    if (!sel) return;
    const c = convs.find((x) => x.chatJid === sel) ?? busqLeads.find((x) => x.chatJid === sel);
    const ts = Date.parse(c?.ultimaFecha ?? '') || Date.now();
    setLeidoMap((m) => ((m[sel] ?? 0) >= ts ? m : { ...m, [sel]: ts }));
  }, [sel, convs, busqLeads]);

  // Divisor "N mensajes no leídos": se ancla UNA vez al abrir, en la racha final
  // de entrantes cuya fecha supera el "leído hasta" que había ANTES de abrir.
  useEffect(() => {
    // Sin marcador de leído previo (primera vez / carrera con el baseline del
    // provider) tratamos el chat como todo leído: no mostramos divisor falso.
    if (unreadAnchorId !== null || msgs.length === 0 || leidoAlAbrirRef.current === 0) return;
    let run = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.fromMe) break;
      if (!(Date.parse(m.fecha ?? '') > leidoAlAbrirRef.current)) break;
      run++;
    }
    if (run === 0) return;
    setUnreadAnchorId(msgs[msgs.length - run].id);
    setUnreadAtOpen(run);
  }, [msgs, unreadAnchorId]);

  // Autoscroll SOLO si el user ya estaba pegado al fondo.
  useEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [msgs]);
  const onScrollHilo = () => { const el = scrollRef.current; if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150; };

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
    const sc = findConv(sel);
    if (!sc || !draft.trim()) return;
    setSending(true); setSendErr(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string; chatJid?: string | null }>('/api/whatsapp/evolution/mensajes', { telefono: sc.telefono, chat: sc.chatJid, texto: draft.trim(), leadId: sc.leadId });
      if (j.ok) { setDraft(''); stickRef.current = true; await enfocarTrasEnvio(sc.chatJid, j.chatJid ?? null); }
      else setSendErr(j.error || 'No se pudo enviar el mensaje.');
    } catch (e) { setSendErr('No se pudo enviar (' + (e instanceof Error ? e.message : 'error de red') + ').'); }
    finally { setSending(false); }
  }

  // Tras enviar, Evolution puede devolver un chatJid CANÓNICO distinto del que
  // adivinamos para un lead buscado (WhatsApp reescribe el 9/1 de AR/MX). El
  // espejo se guarda bajo ese jid real → refrescamos la lista y, si cambió,
  // movemos la selección al jid real para no quedar en un placeholder vacío.
  async function enfocarTrasEnvio(jidUsado: string, jidReal: string | null) {
    await loadConvs();
    if (jidReal && jidReal !== jidUsado) setSel(jidReal); // el effect de sel carga su hilo
    else await loadMsgs(jidUsado);
  }

  // Envío de media (archivo o nota de voz) por multipart. tipo='audio' para voz;
  // '' → el backend infiere imagen/video/documento del mimetype. Devuelve ok.
  async function enviarArchivo(blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string): Promise<boolean> {
    const sc = findConv(sel);
    if (!sc) return false;
    setSending(true); setSendErr(null);
    if (tipo === 'audio') setAudioFase('Enviando audio…');
    try {
      const fd = new FormData();
      fd.append('chat', sc.chatJid);
      if (sc.telefono) fd.append('telefono', sc.telefono);
      if (sc.leadId) fd.append('leadId', String(sc.leadId));
      if (caption) fd.append('caption', caption);
      fd.append('tipo', tipo);
      fd.append('archivo', blob, fileName);
      const r = await fetch('/api/whatsapp/evolution/mensajes', { method: 'POST', body: fd });
      const j = (await r.json()) as { ok: boolean; error?: string; chatJid?: string | null };
      if (j.ok) { stickRef.current = true; await enfocarTrasEnvio(sc.chatJid, j.chatJid ?? null); return true; }
      setSendErr(j.error || 'No se pudo enviar el archivo.');
      return false;
    } catch (e) { setSendErr('No se pudo enviar el archivo (' + (e instanceof Error ? e.message : 'error de red') + ').'); return false; }
    finally { setSending(false); if (tipo === 'audio') setAudioFase(null); }
  }

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setSendErr('Archivo muy grande (máx 4 MB).'); return; }
    setAdjunto(f);
  }

  // Nota de voz con el grabador COMPARTIDO (idéntico al oficial). Transcodifica a
  // MP3 (formato universal, reusa audio.ts del oficial) y lo manda como 'audio'.
  const enviarAudioBlob = async (blob: Blob) => {
    setSending(true); setSendErr(null); setAudioFase('Procesando audio…');
    let mp3: Blob;
    try {
      const { blobToMp3 } = await import('./audio');
      mp3 = await blobToMp3(blob);
    } catch (e) {
      setSendErr('No se pudo procesar el audio (' + (e instanceof Error ? e.message : 'error') + ').');
      setSending(false); setAudioFase(null);
      return;
    }
    await enviarArchivo(mp3, 'audio', 'nota-de-voz.mp3');
  };
  const voz = useVoiceRecorder(enviarAudioBlob, setSendErr);

  // Composer: si hay adjunto staged lo manda (con el texto como caption), si no el texto.
  async function enviarComposer() {
    if (adjunto) {
      const ok = await enviarArchivo(adjunto, '', adjunto.name, draft.trim() || undefined);
      if (ok) { setAdjunto(null); setDraft(''); if (fileInput.current) fileInput.current.value = ''; }
    } else await enviarManual();
  }

  async function setBloqueo(bloquear: boolean, motivo?: string) {
    const sc = findConv(sel);
    if (!sc?.telefono) return;
    setBlocking(true);
    try {
      const j = await jpost<{ ok: boolean; error?: string; bloqueado: boolean }>('/api/whatsapp/evolution/block', { telefono: sc.telefono, action: bloquear ? 'block' : 'unblock', leadId: sc.leadId, motivo });
      if (j.ok) {
        const upd = (arr: Conv[]) => arr.map((c) => (c.chatJid === sc.chatJid ? { ...c, bloqueado: j.bloqueado } : c));
        setConvs((prev) => upd(prev)); setBusqLeads((prev) => upd(prev)); convsCache = upd(convsCache);
      } else setSendErr(j.error || 'No se pudo cambiar el bloqueo.');
    } finally { setBlocking(false); }
  }

  // Ocultar (o mostrar) la conversación del inbox y de MaKo. No corta el envío.
  async function toggleOculto(ocultar: boolean) {
    const sc = findConv(sel);
    if (!sc?.telefono) return;
    if (ocultar && !window.confirm(`¿Ocultar a ${sc.nombre}? No se va a ver en el inbox ni MaKo la va a leer. Podés mostrarla de nuevo desde «Ver ocultos».`)) return;
    setHiding(true); setSendErr(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/block', { telefono: sc.telefono, action: ocultar ? 'hide' : 'unhide', leadId: sc.leadId });
      if (j.ok) { setSel(null); await loadConvs(); } // sale/entra de la lista → deseleccionar y recargar
      else setSendErr(j.error || 'No se pudo cambiar la visibilidad.');
    } finally { setHiding(false); }
  }

  const selConv = findConv(sel);
  const q = search.trim().toLowerCase();
  // Etapas presentes para el filtro (de la lista real).
  const etapasPresentes = [...new Map(convs.filter((c) => c.etapaKey).map((c) => [c.etapaKey!, c.etapaLabel!] as const)).entries()];
  // Merge real + buscados (dedup por últimos 10 dígitos), luego filtro y orden.
  const vistos = new Set(convs.map((c) => last10(c.telefono)).filter(Boolean));
  const todos = [...convs, ...busqLeads.filter((b) => { const k = last10(b.telefono); return k && !vistos.has(k); })];
  const sinLeer = (c: Conv) => c.chatJid !== sel && c.ultimoEntrante && !!c.ultimaFecha && Date.parse(c.ultimaFecha) > (leidoMap[c.chatJid] ?? 0);
  const convsOrdenados = todos
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
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '330px 1fr 344px', gap: '16px' }}>
      {/* LISTA */}
      <div style={card}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa o teléfono…"
            style={{ width: '100%', padding: '10px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
            <Dropdown value={filtroEtapa} onChange={setFiltroEtapa} width={158} ariaLabel="Filtrar por etapa" buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
              options={[{ value: 'todas', label: 'Todas las etapas' }, ...etapasPresentes.map(([k, label]) => ({ value: k, label, color: ETAPA_COLOR[k] }))]} />
            <button onClick={() => { setSel(null); setVerOcultos((v) => !v); }} title={verOcultos ? 'Volver al inbox' : 'Ver conversaciones ocultas (para mostrarlas de nuevo)'}
              style={{ padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 600, border: '1px solid ' + (verOcultos ? 'var(--ink)' : 'var(--border)'), background: verOcultos ? 'var(--ink)' : 'var(--surface-2)', color: verOcultos ? 'var(--on-sidebar)' : 'var(--dim)' }}>
              {verOcultos ? '← Volver' : '🙈 Ocultos'}
            </button>
          </div>
          {verOcultos && <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--dim)', lineHeight: 1.4 }}>Conversaciones ocultas. Abrí una y tocá «Mostrar contacto» para devolverla al inbox.</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
          {borradores.length > 0 && (
            <button onClick={() => setShowBorr(true)} title="Mensajes que MaKo dejó listos para que los mandes con 1 clic"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '6px', borderRadius: '12px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Geist', sans-serif", textAlign: 'left' }}>
              📝 {borradores.length} borrador{borradores.length > 1 ? 'es' : ''} por enviar
            </button>
          )}
          {loadingConvs && convs.length === 0 && <div style={{ padding: '18px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
          {!loadingConvs && convsOrdenados.length === 0 && !err && (
            <div style={{ padding: '18px', color: 'var(--faint)', fontSize: '13px', lineHeight: 1.5 }}>
              {search.trim() ? 'Ningún lead ni conversación coincide con la búsqueda.' : 'Todavía no hay mensajes en el número no oficial. Conectá el número (chip API no Oficial, arriba) y las conversaciones van a aparecer acá. También podés buscar cualquier lead del CRM por nombre para escribirle.'}
            </div>
          )}
          {err && <div style={{ margin: '10px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{err}</div>}
          {convsOrdenados.map((c) => {
            const active = c.chatJid === sel;
            const borr = (drafts[c.chatJid] ?? '').trim();
            const chip = etapaChip(c.etapaKey, c.etapaLabel);
            const nuevo = sinLeer(c);
            return (
              <div key={c.chatJid} onClick={() => setSel(c.chatJid)}
                style={{ display: 'flex', gap: '11px', padding: '11px 12px', borderRadius: '12px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                <Avatar telefono={c.telefono} name={c.nombre} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                    <span style={{ flex: 'none', fontSize: '11px', color: 'var(--faint)' }}>{fmtTime(c.ultimaFecha)}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: borr ? 'var(--ink)' : 'var(--dim)' }}>
                    {borr ? <><span style={{ color: 'var(--bad)', fontWeight: 600 }}>Borrador:</span> {borr}</> : (c.total === 0 ? 'Sin mensajes — escribirle' : preview(c))}
                  </div>
                  {(chip || nuevo) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px' }}>
                      {chip && <span style={chip.style}><span style={chip.dot}></span>{chip.label}</span>}
                      {nuevo && <span title="Mensaje nuevo sin leer" style={{ marginLeft: 'auto', flex: 'none', width: '11px', height: '11px', borderRadius: '50%', background: 'var(--good)' }} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HILO — cinta índigo superior = diferenciador de canal no oficial */}
      <div style={{ ...card, borderTop: '3px solid var(--wa-noof)' }}>
        {!selConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px', padding: '0 28px', textAlign: 'center', lineHeight: 1.5 }}>Elegí una conversación</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={selConv.leadId ? () => setDetalleLeadId(selConv.leadId!) : undefined}
                onKeyDown={selConv.leadId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetalleLeadId(selConv.leadId!); } } : undefined}
                role={selConv.leadId ? 'button' : undefined} tabIndex={selConv.leadId ? 0 : undefined}
                title={selConv.leadId ? 'Ver detalle del lead' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, cursor: selConv.leadId ? 'pointer' : 'default' }}>
                <Avatar telefono={selConv.telefono} name={selConv.nombre} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selConv.nombre}</div>
                  <div style={{ fontSize: '12px', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{selConv.telefono ?? '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
                <span style={{ padding: '3px 9px', borderRadius: '999px', background: 'var(--wa-noof)', color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '.02em' }}>NO OFICIAL</span>
                {etapaChip(selConv.etapaKey, selConv.etapaLabel) && (() => { const ch = etapaChip(selConv.etapaKey, selConv.etapaLabel)!; return <span style={ch.style}><span style={ch.dot}></span>{ch.label}</span>; })()}
              </div>
            </div>
            <div ref={scrollRef} onScroll={onScrollHilo} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface-2)' }}>
              {loadingMsgs && msgs.length === 0 && !errMsgs && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
                  <span style={{ width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: 'var(--wa-noof)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
                </div>
              )}
              {errMsgs && (
                <div style={{ margin: 'auto', textAlign: 'center' }}>
                  <div style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px', marginBottom: '10px' }}>{errMsgs}</div>
                  <button onClick={() => sel && void loadMsgs(sel)} style={{ padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
                </div>
              )}
              {!loadingMsgs && !errMsgs && msgs.length === 0 && <div style={{ color: 'var(--faint)', fontSize: '13.5px' }}>{selConv.total === 0 ? 'Todavía no le escribiste. Mandale el primer mensaje abajo.' : 'Sin mensajes.'}</div>}
              {msgs.map((m) => {
                const mine = m.fromMe;
                const esMedia = m.tipo === 'image' || m.tipo === 'audio' || m.tipo === 'video' || m.tipo === 'document' || m.tipo === 'sticker';
                const esPdf = (m.mediaMime || '').includes('pdf') || (m.texto || '').toLowerCase().endsWith('.pdf');
                return (
                  <Fragment key={m.id}>
                    {m.id === unreadAnchorId && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '999px', padding: '3px 12px' }}>{unreadAtOpen} {unreadAtOpen === 1 ? 'mensaje no leído' : 'mensajes no leídos'}</span>
                      </div>
                    )}
                  <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: mine ? 'var(--wa-noof-bubble)' : 'var(--surface)', border: '1px solid ' + (mine ? 'rgba(91,107,214,.30)' : 'var(--border)'), boxShadow: '0 1px 2px rgba(18,21,27,.04)' }}>
                      {m.mediaUrl && m.tipo === 'image' && (
                        <button onClick={() => setLightbox({ tipo: 'image', url: m.mediaUrl! })} title="Ver imagen" style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'block', marginBottom: m.texto ? '6px' : 0 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.mediaUrl} alt="adjunto" style={{ maxWidth: '240px', maxHeight: '280px', borderRadius: '10px', display: 'block' }} />
                        </button>
                      )}
                      {m.mediaUrl && m.tipo === 'audio' && <audio controls src={m.mediaUrl} style={{ width: '240px', marginBottom: m.texto ? '6px' : 0 }} />}
                      {m.mediaUrl && m.tipo === 'video' && <video controls src={m.mediaUrl} style={{ maxWidth: '240px', borderRadius: '10px', marginBottom: m.texto ? '6px' : 0, display: 'block' }} />}
                      {m.mediaUrl && m.tipo === 'document' && (esPdf ? (
                        <button onClick={() => setLightbox({ tipo: 'pdf', url: m.mediaUrl! })} title="Ver PDF" style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', maxWidth: '240px', marginBottom: m.texto ? '6px' : 0 }}>
                          <span style={{ fontSize: '20px', flex: 'none' }}>📄</span>
                          <span style={{ minWidth: 0, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{m.texto || 'Documento PDF'}</span>
                            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--primary)' }}>Ver previsualización</span>
                          </span>
                        </button>
                      ) : (
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', marginBottom: m.texto ? '6px' : 0 }}>📎 {m.texto || 'Abrir archivo'}</a>
                      ))}
                      {!m.mediaUrl && esMedia && <span style={{ display: 'block', fontSize: '13px', color: 'var(--faint)', fontStyle: 'italic', marginBottom: m.texto ? '6px' : 0 }}>📎 {m.texto || m.tipo} (no disponible)</span>}
                      {m.texto && m.tipo !== 'document' && <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: mine ? 'flex-end' : 'flex-start', gap: '5px', marginTop: '3px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--faint)' }}>{fmtHora(m.fecha)}</span>
                        {mine && <Ticks status={m.status} />}
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </div>
            {audioFase && (
              <div style={{ padding: '8px 16px', background: 'var(--surface-2)', color: 'var(--wa-noof)', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border)' }}>
                <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
                <span style={{ width: '13px', height: '13px', border: '2px solid var(--wa-noof)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
                {audioFase} (puede tardar unos segundos)
              </div>
            )}
            {sendErr && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: '12.5px', borderTop: '1px solid var(--border)' }}>{sendErr}</div>}
            {selConv.bloqueado ? (
              <div style={{ padding: '16px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '13px', color: 'var(--dim)' }}>⛔ Contacto bloqueado. <button onClick={() => void setBloqueo(false)} disabled={blocking} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Desbloquear</button> para volver a escribir.</div>
            ) : voz.recording ? (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
                <VoiceRecorderBar paused={voz.paused} secs={voz.secs} sending={sending}
                  onCancel={() => voz.stop(true)} onTogglePause={voz.paused ? voz.resume : voz.pause} onSend={() => voz.stop(false)} />
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--border)', position: 'relative' }}>
                {emojiOpen && <div onClick={() => setEmojiOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />}
                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '10px', zIndex: 40 }}>
                    <EmojiPicker onPick={(em) => setDraft((d) => d + em)} onClose={() => setEmojiOpen(false)} />
                  </div>
                )}
                {adjunto && (
                  <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {adjuntoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={adjuntoPreview} alt={adjunto.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: '48px', height: '48px', flex: 'none', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{adjunto.type.startsWith('audio/') ? '🎵' : adjunto.type.startsWith('video/') ? '🎬' : '📄'}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adjunto.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--faint)' }}>{(adjunto.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button onClick={() => { setAdjunto(null); if (fileInput.current) fileInput.current.value = ''; }} title="Quitar adjunto" style={{ ...iconBtn, flex: 'none' }}>✕</button>
                  </div>
                )}
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-end', gap: '4px', position: 'relative', zIndex: 40 }}>
                  <input ref={fileInput} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={(e: ChangeEvent<HTMLInputElement>) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                  <button onClick={() => setEmojiOpen((v) => !v)} title="Emojis" aria-label="Emojis" style={{ ...iconComposer, color: emojiOpen ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
                  <button onClick={() => fileInput.current?.click()} disabled={sending} title="Adjuntar archivo" aria-label="Adjuntar archivo" style={iconComposer}><IconClip /></button>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviarComposer(); } }}
                    placeholder={adjunto ? 'Agregá un texto (opcional)…' : 'Escribí un mensaje… (sale por el número no oficial, con anti-baneo)'} rows={1}
                    style={{ flex: 1, minHeight: '40px', maxHeight: '120px', resize: 'none', padding: '9px 16px', borderRadius: '21px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.35, outline: 'none' }} />
                  {(draft.trim() || adjunto) ? (
                    <button onClick={() => void enviarComposer()} disabled={sending} title="Enviar" aria-label="Enviar" style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
                  ) : (
                    <button onClick={() => void voz.start()} disabled={sending} title="Grabar nota de voz" aria-label="Grabar nota de voz" style={{ ...iconComposer, color: 'var(--dim)' }}><IconMic /></button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CONTEXTO — tarjeta del lead + panel de MaKo (mismo componente que el oficial) */}
      <div style={{ ...card, padding: '18px' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Lead</div>
        {selConv ? (
          <>
            {selConv.leadId ? (
              <button onClick={() => setDetalleLeadId(selConv.leadId!)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{selConv.nombre}</button>
            ) : (
              <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{selConv.nombre}</div>
            )}
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>{selConv.empresa ?? 'Sin empresa registrada'}</div>
            {etapaChip(selConv.etapaKey, selConv.etapaLabel) && (() => { const ch = etapaChip(selConv.etapaKey, selConv.etapaLabel)!; return <div style={{ marginTop: '10px' }}><span style={ch.style}><span style={ch.dot}></span>{ch.label}</span></div>; })()}
            {selConv.leadId ? (
              <button onClick={() => setDetalleLeadId(selConv.leadId!)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Ver detalle del lead →</button>
            ) : (
              <Link href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Buscar en CRM →</Link>
            )}
            {selConv.bloqueado && <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--bad)' }}>⛔ Contacto bloqueado</div>}
            {selConv.telefono && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {/* Ocultar: saca la conversación del inbox y de MaKo (para chats
                    personales). En la vista de ocultos, el botón la muestra de nuevo. */}
                <button onClick={() => void toggleOculto(!verOcultos)} disabled={hiding}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', cursor: hiding ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', opacity: hiding ? 0.6 : 1 }}>{hiding ? '…' : verOcultos ? '👁 Mostrar contacto' : '🙈 Ocultar contacto'}</button>
                <button onClick={() => (selConv.bloqueado ? void setBloqueo(false) : (setBlockMotivo(''), setBlockModalOpen(true)))} disabled={blocking}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', cursor: blocking ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, border: '1px solid ' + (selConv.bloqueado ? 'var(--border-strong)' : 'var(--bad)'), background: 'var(--surface)', color: selConv.bloqueado ? 'var(--dim)' : 'var(--bad)', opacity: blocking ? 0.6 : 1 }}>{blocking ? '…' : selConv.bloqueado ? 'Desbloquear contacto' : 'Bloquear contacto'}</button>
              </div>
            )}
            <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0', flex: 'none' }}></div>
            <WhatsAppAdvisor
              grupo={{ id: selConv.chatJid, contacto: selConv.nombre, empresa: selConv.empresa, etapaLabel: selConv.etapaLabel }}
              mensajes={msgs.map((m) => ({ saliente: m.fromMe, texto: m.texto }))}
              ventanaAbierta={true}
              onUsar={(t) => setDraft((d) => (d.trim() ? `${d.replace(/\s+$/, '')}\n\n${t}` : t))}
              onRedactarPlantilla={() => router.push(`/whatsapp?stab=plantillas&n=${Date.now()}`)}
              quickTemplates={QUICK}
            />
          </>
        ) : (
          <div style={{ fontSize: '12.5px', color: 'var(--faint)', lineHeight: 1.5 }}>Elegí una conversación para que MaKo te sugiera qué escribir.</div>
        )}
      </div>

      {detalleLeadId != null && <LeadEditModal leadId={detalleLeadId} onClose={() => setDetalleLeadId(null)} />}

      {/* Lightbox de previsualización (imagen / PDF), idéntico al oficial */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '28px' }}>
          <button onClick={() => setLightbox(null)} title="Cerrar" style={{ position: 'absolute', top: '18px', right: '18px', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✕</button>
          {lightbox.tipo === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt="adjunto" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: '8px', objectFit: 'contain' }} />
          ) : (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', height: '88vh', maxWidth: '900px', background: 'var(--surface)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* La URL ya sirve el PDF (proxy ?media= o URL firmada) → directo, sin
                  re-envolver en /api/whatsapp/file (eso causaba "conexión rechazada"). */}
              <iframe src={lightbox.url} title="PDF" style={{ flex: 1, width: '100%', border: 'none' }} />
              <a href={lightbox.url} target="_blank" rel="noreferrer" style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}>Abrir / descargar en pestaña nueva →</a>
            </div>
          )}
        </div>
      )}

      {/* Modal de bloqueo con motivo (como el oficial) */}
      {blockModalOpen && selConv && (
        <div onClick={() => setBlockModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>Bloquear a {selConv.nombre}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginBottom: '14px', lineHeight: 1.5 }}>No le vas a poder escribir por el no oficial y el motor de nutrición tampoco le va a mandar. Podés desbloquearlo cuando quieras.</div>
            <textarea value={blockMotivo} onChange={(e) => setBlockMotivo(e.target.value)} placeholder="Motivo del bloqueo (opcional)…" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button onClick={() => setBlockModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { void setBloqueo(true, blockMotivo.trim() || undefined); setBlockModalOpen(false); }} disabled={blocking} style={{ padding: '8px 18px', borderRadius: '9px', border: 'none', background: 'var(--bad)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: blocking ? 0.6 : 1 }}>Bloquear</button>
            </div>
          </div>
        </div>
      )}

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
