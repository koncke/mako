'use client';

// =============================================================================
// SimuladorWhatsApp — secuencias COMO CHAT (réplica de PlantillasView de SuperAdmin)
// =============================================================================
// Mismo diseño que app/agencia/PlantillasView.tsx: lista de secuencias de mensajes como
// CONTACTOS (300px) + ChatHilo compartido (burbujas + composer real con emoji,
// adjuntar y nota de voz). "▶ Simular secuencia" reproduce los pasos como
// mensajes entrantes del negocio (vos sos EL LEAD: tus mensajes van a la
// derecha); escribes/mandás audio y MaKo responde como setter. La topbar /
// Editar abre el PERFIL de la secuencia de mensajes (SecuenciaPerfil, cubre el chat).

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { SecuenciaPerfil } from './SecuenciaPerfil';
import type { AudioSetting, SecuenciaDto, Opcion } from './ChatAgentApp';
import type { Objetivo } from '@/lib/setting-estrategia';

export const EMOJI_OBJETIVO: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };
export const emojiSecuencia = (j: SecuenciaDto): string => (j.estrategia ? EMOJI_OBJETIVO[j.estrategia.objetivo] : '⚑');

// Variables de plantilla → lead de prueba (solo visual, espejo del motor).
// Tolera {{nombre}} y {nombre} (los seeds viejos de email usan llave simple).
const conVars = (s: string) => s
  .replace(/\{\{?\s*nombre\s*\}?\}/gi, 'Juan')
  .replace(/\{\{?\s*apellido\s*\}?\}/gi, 'Pérez')
  .replace(/\{\{?\s*empresa\s*\}?\}/gi, 'Acme SRL');

function fmtTiming(p: { delay_horas: number; ancla?: 'reunion' }): string {
  const h = p.delay_horas;
  if (p.ancla === 'reunion') return h < 24 ? `${h}h antes de la reunión` : `${Math.round(h / 24)} día(s) antes de la reunión`;
  if (h <= 1) return 'al entrar a la etapa';
  if (h < 24) return `a las ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'al día siguiente' : `a los ${d} días`;
}

async function blobABase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(bin);
}

type Paso = { t: 'typing' } | { t: 'msg'; msg: HiloMsg };

export function SimuladorWhatsApp({ secuencias, objetivos, etiquetaEtapa, negocio, rolAdmin, audios, onWizard, onReload }: {
  secuencias: SecuenciaDto[];
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  negocio: string;
  rolAdmin: boolean;
  audios: AudioSetting[];
  onWizard: (id: number | 'nueva') => void;
  onReload: () => void;
}) {
  const [busq, setBusq] = useState('');
  const [selId, setSelId] = useState<number | ''>('');
  const [mensajes, setMensajes] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right'; autor?: string } | null>(null);
  const [detalle, setDetalle] = useState(false);
  const seq = useRef(0);

  useEffect(() => { if (selId === '' && secuencias.length) setSelId(secuencias[0].id); }, [secuencias, selId]);

  const lista = useMemo(() => {
    const q = busq.trim().toLowerCase();
    return secuencias.filter((j) => !q
      || j.nombre.toLowerCase().includes(q)
      || (j.estrategia?.gancho ?? '').toLowerCase().includes(q)
      || etiquetaEtapa(j.etapa).toLowerCase().includes(q));
  }, [secuencias, busq, etiquetaEtapa]);
  const sel = secuencias.find((j) => j.id === selId);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Al ENTRAR a una secuencia se reproduce sola, sin botón: entrar a un contacto
  // y ver llegar los mensajes ES la simulación. Un botón "▶ Simular" obligaba a
  // pedir lo único que se puede hacer en esa pantalla.
  //
  // La dependencia es el ID y una huella de los pasos de WhatsApp, NO el objeto
  // `sel` ni `audios`: cualquier recarga (guardar la estrategia, activar la
  // secuencia) les cambia la identidad y volvería a reproducir el guion BORRANDO
  // la conversación que el dueño tenga en curso.
  const guionKey = useMemo(() => (sel
    ? sel.pasos.filter((p) => p.canal === 'whatsapp').map((p) => `${p.orden}|${p.tipo ?? 'texto'}|${p.audio_id ?? ''}|${(p.cuerpo ?? '').length}`).join('~')
    : ''), [sel]);

  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setMensajes([]); setTyping(null); setDetalle(false);
    if (selId !== '' && guionKey) reproducirGuion();
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, guionKey]);

  const elegir = (id: number) => { setSelId(id); setDetalle(false); };

  // Reproduce la secuencia como mensajes ENTRANTES del negocio (tú = el lead).
  function reproducirGuion() {
    if (!sel) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    const pasosWa = sel.pasos.filter((p) => p.canal === 'whatsapp');
    const guion: Paso[] = [];
    for (const p of pasosWa) {
      guion.push({ t: 'typing' });
      // Paso de NOTA DE VOZ: se ve y se escucha como el lead lo recibe.
      const audio = p.tipo === 'audio' && p.audio_id ? audios.find((a) => a.id === p.audio_id) : null;
      guion.push({
        t: 'msg',
        msg: audio
          ? { id: `sim-${sel.id}-${p.orden}-${++seq.current}`, fromMe: false, autor: `${negocio || 'Tu negocio'} · ⏱ ${fmtTiming(p)}`, tipo: 'audio', mediaUrl: audio.url, texto: audio.transcript ? `🎙 ${audio.transcript}` : null, fecha: new Date().toISOString() }
          : { id: `sim-${sel.id}-${p.orden}-${++seq.current}`, fromMe: false, autor: `${negocio || 'Tu negocio'} · ⏱ ${fmtTiming(p)}`, texto: conVars(p.cuerpo), fecha: new Date().toISOString() },
      });
    }
    setMensajes([]); setTyping(null);
    const acc0: HiloMsg[] = [];
    let acc = 150;
    for (const p of guion) {
      if (p.t === 'typing') { timers.current.push(setTimeout(() => setTyping({ lado: 'left', autor: negocio || 'Tu negocio' }), acc)); acc += 600; }
      else { acc0.push(p.msg); const snap = [...acc0]; timers.current.push(setTimeout(() => { setTyping(null); setMensajes(snap); }, acc)); acc += 350; }
    }
  }

  const historialDe = (msgs: HiloMsg[]) => msgs
    .filter((m) => m.autor !== 'Simulador') // los avisos de error no son parte de la charla
    .map((m) => ({
      de: m.fromMe ? 'lead' : 'negocio',
      texto: m.texto || (m.tipo === 'audio' ? '(nota de voz)' : `[el lead mandó un archivo]`),
    }));

  async function pedirRespuesta(body: Record<string, unknown>, msgs: HiloMsg[]): Promise<{ respuesta?: string; transcript?: string } | null> {
    setTyping({ lado: 'left', autor: negocio || 'Tu negocio' });
    try {
      const r = await fetch('/api/chat-agent/simulador', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) {
        setMensajes([...msgs, { id: `err-${++seq.current}`, fromMe: false, autor: 'Simulador', texto: `⚠ ${j.error || 'MaKo no pudo responder.'}`, fecha: new Date().toISOString() }]);
        return null;
      }
      return j;
    } catch {
      setMensajes([...msgs, { id: `err-${++seq.current}`, fromMe: false, autor: 'Simulador', texto: '⚠ Sin conexión — prueba de nuevo.', fecha: new Date().toISOString() }]);
      return null;
    } finally {
      setTyping(null);
    }
  }

  async function enviarTexto(texto: string): Promise<boolean> {
    if (!sel) return false;
    const conLead = [...mensajes, { id: `lead-${++seq.current}`, fromMe: true, texto, fecha: new Date().toISOString() } as HiloMsg];
    setMensajes(conLead);
    const j = await pedirRespuesta({ secuenciaId: sel.id, historial: historialDe(conLead) }, conLead);
    if (j?.respuesta) setMensajes([...conLead, { id: `mako-${++seq.current}`, fromMe: false, autor: negocio || 'Tu negocio', texto: j.respuesta, fecha: new Date().toISOString() }]);
    return true;
  }

  async function enviarArchivo(blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string): Promise<boolean> {
    if (!sel) return false;
    const url = URL.createObjectURL(blob);
    if (tipo === 'audio') {
      const audioId = `lead-audio-${++seq.current}`;
      const conLead = [...mensajes, { id: audioId, fromMe: true, tipo: 'audio', mediaUrl: url, fecha: new Date().toISOString() } as HiloMsg];
      setMensajes(conLead);
      const j = await pedirRespuesta({ secuenciaId: sel.id, historial: historialDe(mensajes), audioBase64: await blobABase64(blob), audioMime: blob.type || 'audio/mpeg' }, conLead);
      if (!j) return true;
      // La transcripción vuelve del server: se pega al audio y llega la respuesta.
      const conTranscript = conLead.map((m) => (m.id === audioId ? { ...m, texto: j.transcript ? `🎙 ${j.transcript}` : m.texto } : m));
      setMensajes(j.respuesta
        ? [...conTranscript, { id: `mako-${++seq.current}`, fromMe: false, autor: negocio || 'Tu negocio', texto: j.respuesta, fecha: new Date().toISOString() }]
        : conTranscript);
      return true;
    }
    const esImg = blob.type.startsWith('image/');
    const conLead = [...mensajes, { id: `lead-file-${++seq.current}`, fromMe: true, tipo: esImg ? 'image' : 'document', mediaUrl: url, texto: caption || fileName, fecha: new Date().toISOString() } as HiloMsg];
    setMensajes(conLead);
    const historial = [...historialDe(mensajes), { de: 'lead', texto: `[el lead mandó un archivo: ${fileName}]${caption ? ` y escribió: ${caption}` : ''}` }];
    const j = await pedirRespuesta({ secuenciaId: sel.id, historial }, conLead);
    if (j?.respuesta) setMensajes([...conLead, { id: `mako-${++seq.current}`, fromMe: false, autor: negocio || 'Tu negocio', texto: j.respuesta, fecha: new Date().toISOString() }]);
    return true;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 620 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar secuencia…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          {/* Crear nueva (contacto gris, arriba de todo — patrón PlantillasView) */}
          {rolAdmin && (
            <button type="button" onClick={() => onWizard('nueva')}
              style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', marginBottom: 6, opacity: 0.85, fontFamily: 'inherit' }}>
              <span style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--faint)' }}>+</span>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Nueva secuencia de mensajes</div>
            </button>
          )}

          {lista.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Ninguna secuencia de mensajes coincide.</div>}
          {lista.map((j) => {
            const on = j.id === selId;
            const snippet = j.estrategia?.gancho ?? j.pasos.find((p) => p.canal === 'whatsapp')?.cuerpo ?? j.pasos[0]?.cuerpo ?? '';
            return (
              <button key={j.id} type="button" onClick={() => elegir(j.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2, opacity: j.activa ? 1 : 0.5, fontFamily: 'inherit' }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{emojiSecuencia(j)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.nombre}{!j.activa && <span style={{ color: 'var(--faint)', fontWeight: 500 }}> · pausada</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{etiquetaEtapa(j.etapa)} · {snippet.replace(/[*_\n]/g, ' ').slice(0, 34)}</div>
                </div>
                <span title={j.activa ? 'Activa' : 'Pausada'} style={{ width: 8, height: 8, borderRadius: '50%', background: j.activa ? 'var(--good)' : 'var(--border-strong)', flex: 'none' }} />
                {!j.estrategia && <span style={{ flex: 'none', fontFamily: "'Geist Mono', monospace", fontSize: 8.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--warn)', border: '1px solid var(--warn)', borderRadius: 5, padding: '1px 4px' }}>sin secuencia</span>}
              </button>
            );
          })}
        </div>
      </div>

      {detalle && sel ? (
        <SecuenciaPerfil secuencia={sel} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} rolAdmin={rolAdmin} audios={audios}
          onClose={() => setDetalle(false)} onCambio={onReload} onWizard={() => onWizard(sel.id)} />
      ) : sel ? (
        <ChatHilo
          accent="var(--wa)"
          accentBubble="var(--wa-bubble)"
          mensajes={mensajes}
          typing={typing}
          draftKey={`setting-sim-${sel.id}`}
          placeholder="Escribe como el lead…"
          onEnviarTexto={enviarTexto}
          onEnviarArchivo={enviarArchivo}
          vacio={(
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--faint)', fontSize: 13, lineHeight: 1.7, maxWidth: 300 }}>
              Esta secuencia todavía no tiene mensajes de WhatsApp.<br />Escribe abajo como el lead y MaKo te responde.
            </div>
          )}
          header={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <button type="button" onClick={() => setDetalle(true)} title="Ver perfil / editar" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{emojiSecuencia(sel)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.nombre}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{etiquetaEtapa(sel.etapa)}{sel.estrategia ? ` · ${objetivos.find((o) => o.value === sel.estrategia!.objetivo)?.label ?? sel.estrategia.objetivo}` : ' · sin secuencia definida'} · toca para {rolAdmin ? 'editar' : 'ver'}</div>
                </div>
              </button>
              {/* La secuencia ya se reprodujo sola al entrar. Esto es para
                  volver a verla desde el principio después de haber chateado,
                  no para arrancarla: por eso es un ícono discreto y no la
                  acción principal de la pantalla. */}
              <button type="button" onClick={reproducirGuion} title="Ver la secuencia otra vez desde el principio" aria-label="Ver la secuencia otra vez desde el principio"
                style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
              <button type="button" onClick={() => setDetalle(true)} title="Perfil de la secuencia de mensajes"
                style={{ flex: 'none', padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{rolAdmin ? 'Editar' : 'Perfil'}</button>
            </div>
          )}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>Elige una secuencia de mensajes.</div>
      )}
    </div>
  );
}
