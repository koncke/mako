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
import { SendArrow, IconSmiley, IconClip, IconMic, IconDoc } from './composer-icons';
import { useVoiceRecorder, VoiceRecorderBar } from './VoiceRecorder';
import { Ticks } from './Ticks';

export type HiloMsg = {
  id: string | number;
  fromMe: boolean;
  tipo?: string | null;
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
};

export function ChatHilo({
  mensajes, header, accent = 'var(--wa-noof)', accentBubble = 'var(--wa-noof-bubble)',
  onEnviarTexto, onEnviarArchivo, readOnly, cargando, vacio, placeholder,
}: ChatHiloProps) {
  const [draft, setDraft] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
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
  useEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [mensajes]);
  const onScroll = () => { const el = scrollRef.current; if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150; };

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setSendErr('Archivo muy grande (máx 4 MB).'); return; }
    setAdjunto(f);
  }
  async function enviarTexto() {
    if (!onEnviarTexto || !draft.trim()) return;
    setSending(true); setSendErr(null); stickRef.current = true;
    try { if (await onEnviarTexto(draft.trim())) setDraft(''); else setSendErr('No se pudo enviar el mensaje.'); }
    catch (e) { setSendErr('No se pudo enviar (' + (e instanceof Error ? e.message : 'error de red') + ').'); }
    finally { setSending(false); }
  }
  async function enviarComposer() {
    if (adjunto && onEnviarArchivo) {
      setSending(true); setSendErr(null); stickRef.current = true;
      try {
        const ok = await onEnviarArchivo(adjunto, '', adjunto.name, draft.trim() || undefined);
        if (ok) { setAdjunto(null); setDraft(''); if (fileInput.current) fileInput.current.value = ''; }
        else setSendErr('No se pudo enviar el archivo.');
      } finally { setSending(false); }
    } else await enviarTexto();
  }
  const enviarAudioBlob = async (blob: Blob) => {
    if (!onEnviarArchivo) return;
    setSending(true); setSendErr(null); setAudioFase('Procesando audio…'); stickRef.current = true;
    let mp3: Blob;
    try { const { blobToMp3 } = await import('../audio'); mp3 = await blobToMp3(blob); }
    catch (e) { setSendErr('No se pudo procesar el audio (' + (e instanceof Error ? e.message : 'error') + ').'); setSending(false); setAudioFase(null); return; }
    setAudioFase('Enviando audio…');
    await onEnviarArchivo(mp3, 'audio', 'nota-de-voz.mp3');
    setSending(false); setAudioFase(null);
  };
  const voz = useVoiceRecorder(enviarAudioBlob, setSendErr);
  const puedeComponer = !readOnly && (!!onEnviarTexto || !!onEnviarArchivo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, borderTop: `3px solid ${accent}`, overflow: 'hidden' }}>
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
                  {m.mediaUrl && m.tipo === 'audio' && <audio controls src={m.mediaUrl} style={{ width: 240, marginBottom: m.texto ? 6 : 0 }} />}
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
                  {m.texto && m.tipo !== 'document' && <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 5, marginTop: 3 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fmtHora(m.fecha)}</span>
                    {mine && <Ticks status={m.status ?? null} />}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {audioFase && (
        <div style={{ padding: '8px 16px', background: 'var(--surface-2)', color: accent, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)' }}>
          <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
          <span style={{ width: 13, height: 13, border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
          {audioFase} (puede tardar unos segundos)
        </div>
      )}
      {sendErr && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: 12.5, borderTop: '1px solid var(--border)' }}>{sendErr}</div>}

      {puedeComponer && (voz.recording ? (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
          <VoiceRecorderBar paused={voz.paused} secs={voz.secs} sending={sending} onCancel={() => voz.stop(true)} onTogglePause={voz.paused ? voz.resume : voz.pause} onSend={() => voz.stop(false)} />
        </div>
      ) : (
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
              placeholder={adjunto ? 'Agregá un texto (opcional)…' : (placeholder ?? 'Escribí un mensaje…')} rows={1}
              style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: 'none', padding: '9px 16px', borderRadius: 21, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, lineHeight: 1.35, outline: 'none' }} />
            {(draft.trim() || adjunto) ? (
              <button onClick={() => void enviarComposer()} disabled={sending} title="Enviar" aria-label="Enviar" style={{ flex: 'none', width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
            ) : onEnviarArchivo ? (
              <button onClick={() => void voz.start()} disabled={sending} title="Grabar nota de voz" aria-label="Grabar nota de voz" style={{ ...iconComposer, color: 'var(--dim)' }}><IconMic /></button>
            ) : null}
          </div>
        </div>
      ))}

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
