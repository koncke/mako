'use client';

// =============================================================================
// ChatHilo — la columna del HILO (burbujas con media + composer) COMPARTIDA
// =============================================================================
// Extraída del inbox del cliente (EmpresaInbox) para reusar el MISMO chat en el
// WhatsApp de MaKo (grupos) y en las plantillas: mismas burbujas, misma media
// (imagen/audio/video/documento + lightbox) y el MISMO composer (emoji + adjuntar
// + nota de voz). Es agnóstico de la fuente de datos: recibe `mensajes` y los
// handlers de envío. readOnly (plantillas) esconde el composer.

import { useEffect, useMemo, useRef, useState, Fragment, type CSSProperties, type ChangeEvent, type ReactNode } from 'react';
import { EmojiPicker } from '../EmojiPicker';
import { SendArrow, IconSmiley, IconClip, IconMic, IconDoc, IconTrash } from './composer-icons';
import { useVoiceRecorder, VoiceRecorderBar } from './VoiceRecorder';
import { Ticks } from './Ticks';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { AudioPlay } from './AudioPlay';

export type HiloMsg = {
  id: string | number;
  fromMe: boolean;
  tipo?: string | null;
  /** Solo para `tipo: 'sistema'`: pinta la línea en verde o en rojo. */
  tono?: 'ok' | 'bad' | null;
  texto?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  fecha?: string | null;
  status?: string | null;
  autor?: string | null; // nombre del remitente (para grupos, en burbujas ajenas)
};

const iconComposer: CSSProperties = { flex: 'none', width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: 1 };
const iconBtn: CSSProperties = { width: 28, height: 28, flex: 'none', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 };

function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export type ChatHiloProps = {
  mensajes: HiloMsg[];
  header?: ReactNode;
  /** acento del canal (cinta superior + burbuja saliente). Default índigo no-oficial. */
  accent?: string;
  accentBubble?: string;
  /** envía texto; devuelve true si ok. Ausente + readOnly → sin composer. */
  onEnviarTexto?: (texto: string) => Promise<boolean>;
  /** envía media/voz por multipart; tipo 'audio' para nota de voz. */
  onEnviarArchivo?: (blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string) => Promise<boolean>;
  readOnly?: boolean;
  cargando?: boolean;
  vacio?: ReactNode;
  placeholder?: string;
  /** burbuja "escribiendo…" (para previews animadas). lado: quién escribe. */
  typing?: { lado: 'left' | 'right'; autor?: string } | null;
  /** clave de la conversación → borrador POR conversación (no se filtra al saltar). */
  draftKey?: string;
  /** avisa si esta conversación tiene borrador (texto/adjunto/audio) para ordenarla. */
  onDraftChange?: (key: string, hayBorrador: boolean) => void;
};

// Borradores por conversación (sobreviven el salto entre chats, como el inbox real):
// texto, adjunto y audio grabado-sin-enviar quedan atados a SU chat.
const draftStore = new Map<string, string>();
const adjuntoStore = new Map<string, File>();
const audioStore = new Map<string, Blob>();

export function ChatHilo({
  mensajes, header, accent = 'var(--wa-noof)', accentBubble = 'var(--wa-noof-bubble)',
  onEnviarTexto, onEnviarArchivo, readOnly, cargando, vacio, placeholder, typing, draftKey, onDraftChange,
}: ChatHiloProps) {
  const [draft, setDraftState] = useState<string>(() => (draftKey ? draftStore.get(draftKey) ?? '' : ''));
  const [adjunto, setAdjuntoState] = useState<File | null>(() => (draftKey ? adjuntoStore.get(draftKey) ?? null : null));
  const [audioPend, setAudioPendState] = useState<Blob | null>(() => (draftKey ? audioStore.get(draftKey) ?? null : null));
  const prevKey = useRef(draftKey);
  // Reporta si el chat tiene ALGO en borrador (texto/adjunto/audio) → orden en la lista.
  const reportar = (key: string | undefined) => { if (key) onDraftChange?.(key, !!(draftStore.get(key) || adjuntoStore.get(key) || audioStore.get(key))); };
  // El borrador se lleva TAMBIÉN en un ref, y el store se escribe FUERA del
  // updater de estado. React puede invocar un updater dos veces (StrictMode) y
  // `reportar` avisa al PADRE: hacerlo adentro dispara un efecto ajeno durante
  // el render, y encima duplicado.
  const draftRef = useRef(draft);
  const setDraft = (v: string | ((p: string) => string)) => {
    const next = typeof v === 'function' ? (v as (p: string) => string)(draftRef.current) : v;
    draftRef.current = next;
    setDraftState(next);
    if (draftKey) { if (next) draftStore.set(draftKey, next); else draftStore.delete(draftKey); reportar(draftKey); }
  };
  const setAdjunto = (f: File | null) => { setAdjuntoState(f); if (draftKey) { if (f) adjuntoStore.set(draftKey, f); else adjuntoStore.delete(draftKey); reportar(draftKey); } };
  const setAudioPend = (b: Blob | null) => { setAudioPendState(b); if (draftKey) { if (b) audioStore.set(draftKey, b); else audioStore.delete(draftKey); reportar(draftKey); } };
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [audioFase, setAudioFase] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ tipo: 'image'; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const adjuntoPreview = useMemo(() => (adjunto && adjunto.type.startsWith('image/') ? URL.createObjectURL(adjunto) : null), [adjunto]);
  useEffect(() => () => { if (adjuntoPreview) URL.revokeObjectURL(adjuntoPreview); }, [adjuntoPreview]);
  const audioUrl = useMemo(() => (audioPend ? URL.createObjectURL(audioPend) : null), [audioPend]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  // Cambió la conversación → cargar SU borrador/adjunto/audio (no se pierden).
  useEffect(() => {
    if (prevKey.current === draftKey) return;
    prevKey.current = draftKey;
    const suyo = draftKey ? draftStore.get(draftKey) ?? '' : '';
    draftRef.current = suyo; // el ref tiene que seguir al estado o el próximo envío usa el borrador viejo
    setDraftState(suyo);
    setAdjuntoState(draftKey ? adjuntoStore.get(draftKey) ?? null : null);
    setAudioPendState(draftKey ? audioStore.get(draftKey) ?? null : null);
    setEmojiOpen(false); setSendErr(null);
  }, [draftKey]);
  useEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [mensajes, typing]);
  const onScroll = () => { const el = scrollRef.current; if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150; };

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setSendErr('Archivo muy grande (máx 4 MB).'); return; }
    setAdjunto(f);
  }
  async function enviarTexto() {
    const texto = draft.trim();
    // `sending` también corta acá: con Enter repetido se disparaban dos envíos
    // y, donde el handler es un turno de IA, las dos respuestas se pisaban.
    if (!onEnviarTexto || !texto || sending) return;
    setSending(true); setSendErr(null); stickRef.current = true;
    // La barra se vacía ANTES de esperar. En el inbox real el handler es un POST
    // de 300 ms y no se nota, pero en el simulador y en el ensayo espera un
    // TURNO ENTERO de IA: el mensaje quedaba duplicado, la burbuja arriba y el
    // mismo texto escrito abajo durante segundos. Si falla se devuelve, salvo
    // que el usuario ya haya escrito otra cosa mientras tanto.
    setDraft('');
    try {
      if (!(await onEnviarTexto(texto))) { setDraft((d) => d || texto); setSendErr('No se pudo enviar el mensaje.'); }
    } catch (e) {
      setDraft((d) => d || texto);
      setSendErr('No se pudo enviar (' + (e instanceof Error ? e.message : 'error de red') + ').');
    } finally { setSending(false); }
  }
  async function enviarComposer() {
    if (sending) return;
    if (adjunto && onEnviarArchivo) {
      const arch = adjunto; const cap = draft.trim();
      setSending(true); setSendErr(null); stickRef.current = true;
      setAdjunto(null); setDraft(''); if (fileInput.current) fileInput.current.value = '';
      try {
        if (!(await onEnviarArchivo(arch, '', arch.name, cap || undefined))) {
          setAdjunto(arch); setDraft((d) => d || cap); setSendErr('No se pudo enviar el archivo.');
        }
      } finally { setSending(false); }
    } else await enviarTexto();
  }
  // Al terminar de grabar NO se manda: queda como borrador para escucharlo antes.
  const enviarAudioBlob = async (blob: Blob) => { if (onEnviarArchivo) setAudioPend(blob); };
  const enviarAudioPend = async () => {
    const pend = audioPend;
    if (!pend || !onEnviarArchivo || sending) return;
    setSending(true); setSendErr(null); setAudioFase('Procesando audio…'); stickRef.current = true;
    let mp3: Blob;
    try { const { blobToMp3 } = await import('../audio'); mp3 = await blobToMp3(pend); }
    catch (e) { setSendErr('No se pudo procesar el audio (' + (e instanceof Error ? e.message : 'error') + ').'); setSending(false); setAudioFase(null); return; }
    setAudioFase('Enviando audio…');
    // Mismo criterio que el texto: la burbuja del audio ya está arriba, así que
    // la barra de preview no puede quedar abajo mostrando el mismo audio.
    setAudioPend(null);
    if (!(await onEnviarArchivo(mp3, 'audio', 'nota-de-voz.mp3'))) {
      setAudioPend(pend); setSendErr('No se pudo enviar el audio.');
    }
    setSending(false); setAudioFase(null);
  };
  const voz = useVoiceRecorder(enviarAudioBlob, setSendErr);
  const puedeComponer = !readOnly && (!!onEnviarTexto || !!onEnviarArchivo);

  return (
    // `data-esquina-ocupada` cuando hay composer: su «Enviar» vive en el rincón de abajo a la
    // derecha, y la esquina de los avisos (EsquinaAvisos) sube para no taparlo.
    <div data-esquina-ocupada={puedeComponer ? '' : undefined} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, borderTop: `3px solid ${accent}`, overflow: 'hidden' }}>
      {header && <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>{header}</div>}

      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)' }}>
        {cargando && mensajes.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
            <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: accent, borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
          </div>
        )}
        {!cargando && mensajes.length === 0 && (vacio ?? <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13.5 }}>Sin mensajes.</div>)}
        {mensajes.map((m) => {
          // Una línea de sistema NO es un mensaje de nadie: es lo que pasó en la
          // conversación ("pasaron 3 días", "la secuencia se pausó porque
          // respondió"). Va centrada y sin burbuja a propósito — si se pintara
          // como burbuja, quien mira creería que el negocio le mandó ESO al lead.
          // El TONO se agrega por campo y no por un `tipo` nuevo: cualquier tipo
          // desconocido cae al render de burbuja de acá abajo, y como estas
          // líneas se crean con fromMe:false se pintarían del lado del lead —
          // justo el malentendido que el párrafo de arriba evita.
          if (m.tipo === 'sistema') {
            const t = m.tono === 'ok'
              ? { background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)' }
              : m.tono === 'bad'
                ? { background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)' }
                : { background: 'var(--surface)', border: '1px dashed var(--border-strong)', color: 'var(--faint)' };
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ maxWidth: '86%', padding: '6px 13px', borderRadius: 999, ...t, fontSize: 11.5, lineHeight: 1.45, textAlign: 'center', fontWeight: m.tono ? 600 : 400 }}>{m.texto}</div>
              </div>
            );
          }
          const mine = m.fromMe;
          const esMedia = m.tipo === 'image' || m.tipo === 'audio' || m.tipo === 'video' || m.tipo === 'document' || m.tipo === 'sticker';
          const esPdf = (m.mediaMime || '').includes('pdf') || (m.texto || '').toLowerCase().endsWith('.pdf');
          return (
            <Fragment key={m.id}>
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: mine ? accentBubble : 'var(--surface)', border: '1px solid ' + (mine ? 'rgba(91,107,214,.30)' : 'var(--border)'), boxShadow: '0 1px 2px rgba(18,21,27,.04)' }}>
                  {!mine && m.autor && <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 2 }}>{m.autor}</div>}
                  {m.mediaUrl && m.tipo === 'image' && (
                    <button onClick={() => setLightbox({ tipo: 'image', url: m.mediaUrl! })} title="Ver imagen" style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'block', marginBottom: m.texto ? 6 : 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.mediaUrl} alt="adjunto" style={{ maxWidth: 240, maxHeight: 280, borderRadius: 10, display: 'block' }} />
                    </button>
                  )}
                  {m.mediaUrl && m.tipo === 'audio' && <AudioPlay src={m.mediaUrl} style={{ width: 240, marginBottom: m.texto ? 6 : 0 }} />}
                  {m.mediaUrl && m.tipo === 'video' && <video controls src={m.mediaUrl} style={{ maxWidth: 240, borderRadius: 10, marginBottom: m.texto ? 6 : 0, display: 'block' }} />}
                  {m.mediaUrl && m.tipo === 'document' && (
                    <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', textDecoration: 'none', maxWidth: 240, marginBottom: m.texto ? 6 : 0 }}>
                      <span style={{ flex: 'none', color: 'var(--dim)' }}><IconDoc size={22} /></span>
                      <span style={{ minWidth: 0, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.texto || (esPdf ? 'Documento PDF' : 'Documento')}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--primary)' }}>Abrir en pestaña nueva</span>
                      </span>
                    </a>
                  )}
                  {!m.mediaUrl && esMedia && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', marginBottom: m.texto ? 6 : 0 }}><IconClip /> {m.texto || m.tipo} (no disponible)</span>}
                  {/* ⚠️ EL TEXTO SE PINTA CON SUS MARCAS. Un mensaje de WhatsApp llega con
                      `*negrita*`, `_itálica_` y `~tachado~` — esto dibuja un hilo de WhatsApp,
                      así que mostrarlos crudos hace las dos cosas mal: no se ve cómo llega, y
                      los asteriscos se leen como un error de tipeo del texto. Vale para los
                      cuatro usos de este hilo, no sólo para la vista previa de un aviso. */}
                  {m.texto && m.tipo !== 'document' && <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}><TextoMarcas texto={m.texto} /></div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 5, marginTop: 3 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fmtHora(m.fecha)}</span>
                    {mine && <Ticks status={m.status ?? null} />}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        {typing && (
          <div style={{ display: 'flex', justifyContent: typing.lado === 'right' ? 'flex-end' : 'flex-start' }}>
            <div style={{ padding: '11px 14px', borderRadius: typing.lado === 'right' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: typing.lado === 'right' ? accentBubble : 'var(--surface)', border: '1px solid ' + (typing.lado === 'right' ? 'rgba(91,107,214,.30)' : 'var(--border)') }}>
              {typing.lado === 'left' && typing.autor && <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 3 }}>{typing.autor}</div>}
              <style>{'@keyframes mako-dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'}</style>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 8 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dim)', display: 'inline-block', animation: `mako-dot 1.2s ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {audioFase && (
        <div style={{ padding: '8px 16px', background: 'var(--surface-2)', color: accent, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)' }}>
          <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
          <span style={{ width: 13, height: 13, border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
          {audioFase} (puede tardar unos segundos)
        </div>
      )}
      {sendErr && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: 12.5, borderTop: '1px solid var(--border)' }}>{sendErr}</div>}

      {readOnly && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 4, opacity: 0.55, pointerEvents: 'none', userSelect: 'none' }}>
          <span style={iconComposer}><IconSmiley /></span>
          <span style={iconComposer}><IconClip /></span>
          <div style={{ flex: 1, minHeight: 40, padding: '9px 16px', borderRadius: 21, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--faint)', fontSize: 14, display: 'flex', alignItems: 'center' }}>{placeholder ?? 'Escribe un mensaje…'}</div>
          <span style={iconComposer}><IconMic /></span>
        </div>
      )}
      {puedeComponer && voz.recording && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
          <VoiceRecorderBar paused={voz.paused} secs={voz.secs} sending={sending} onCancel={() => voz.stop(true)} onTogglePause={voz.paused ? voz.resume : voz.pause} onSend={() => voz.stop(false)} />
        </div>
      )}
      {/* Audio grabado SIN enviar: escuchalo antes de mandarlo (o descartalo). Queda en borrador. */}
      {puedeComponer && !voz.recording && audioPend && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setAudioPend(null)} title="Descartar audio" aria-label="Descartar audio" style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--bad)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconTrash /></button>
          {audioUrl && <AudioPlay src={audioUrl} style={{ flex: 1, height: 40 }} />}
          <button onClick={() => void enviarAudioPend()} disabled={sending} title="Enviar audio" aria-label="Enviar audio" style={{ flex: 'none', width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--good)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
        </div>
      )}
      {puedeComponer && !voz.recording && !audioPend && (
        <div style={{ borderTop: '1px solid var(--border)', position: 'relative' }}>
          {emojiOpen && <div onClick={() => setEmojiOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />}
          {emojiOpen && <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 10, zIndex: 40 }}><EmojiPicker onPick={(em) => setDraft((d) => d + em)} onClose={() => setEmojiOpen(false)} /></div>}
          {adjunto && (
            <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              {adjuntoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={adjuntoPreview} alt={adjunto.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ width: 48, height: 48, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)' }}><IconDoc size={22} /></div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adjunto.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{(adjunto.size / 1024).toFixed(0)} KB</div>
              </div>
              <button onClick={() => { setAdjunto(null); if (fileInput.current) fileInput.current.value = ''; }} title="Quitar adjunto" style={{ ...iconBtn, flex: 'none' }}>✕</button>
            </div>
          )}
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-end', gap: 4, position: 'relative', zIndex: 40 }}>
            <input ref={fileInput} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={(e: ChangeEvent<HTMLInputElement>) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            <button onClick={() => setEmojiOpen((v) => !v)} title="Emojis" aria-label="Emojis" style={{ ...iconComposer, color: emojiOpen ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
            {onEnviarArchivo && <button onClick={() => fileInput.current?.click()} disabled={sending} title="Adjuntar archivo" aria-label="Adjuntar archivo" style={iconComposer}><IconClip /></button>}
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviarComposer(); } }}
              placeholder={adjunto ? 'Agrega un texto (opcional)…' : (placeholder ?? 'Escribe un mensaje…')} rows={1}
              style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: 'none', padding: '9px 16px', borderRadius: 21, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, lineHeight: 1.35, outline: 'none' }} />
            {(draft.trim() || adjunto) ? (
              <button onClick={() => void enviarComposer()} disabled={sending} title="Enviar" aria-label="Enviar" style={{ flex: 'none', width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
            ) : onEnviarArchivo ? (
              <button onClick={() => void voz.start()} disabled={sending} title="Grabar nota de voz" aria-label="Grabar nota de voz" style={{ ...iconComposer, color: 'var(--dim)' }}><IconMic /></button>
            ) : null}
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 28 }}>
          <button onClick={() => setLightbox(null)} title="Cerrar" aria-label="Cerrar" style={{ position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt="adjunto" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
