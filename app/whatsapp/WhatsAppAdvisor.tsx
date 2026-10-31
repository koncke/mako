'use client';

// =============================================================================
// WhatsAppAdvisor — MaKo en el panel del chat: qué escribirle a este lead
// =============================================================================
// Reemplaza "Plantillas rápidas". Lee la conversación real (en vivo) + la etapa +
// la ventana de 24h y, con la metodología "Levanta Muertos", recomienda mensajes
// listos para usar. Tiene dos modos: Consejo (recomendaciones) y Chat (preguntá).
// El historial del chat se guarda por contacto (en el backend).
//
// EL CHAT CON LAS PIEZAS DEL OPS CENTER (22/10/2026, TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del
// Ops Center»): el hilo es `HiloMako` y la caja es `CajaChat` (app/_chat/). Se queda en el panel del chat, con su motor
// (/api/whatsapp/advisor), y no pasa a la estrella de la tab: lo suyo es «Usar →», que lleva el borrador a la caja de
// WhatsApp de ESTE lead, y eso el Cerebro no lo puede hacer. «Usar →» y «Copiar» van en el hueco de cada respuesta de MaKo.

import '@/app/admin/operaciones/centro.css';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MakoLoader } from '../_components/MakoLoader';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { useNotaEnElActo } from '@/app/_chat/useNotaEnElActo';
import { cuerpoConArchivos, useAdjuntosDelChat } from '@/app/_chat/useAdjuntosDelChat';
import { ERROR_ADJUNTO, memoriaConArchivos } from '@/lib/mako-adjuntos';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { useCitaDelChat } from '@/app/_chat/useCitaDelChat';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Sugerencia = { angulo: string; tono: string; texto: string; guion_voz?: string };
type Recomendacion = { diagnostico: string; etapa: string; ventana_nota: string; sugerencias: Sugerencia[] };
type Msg = { role: 'user' | 'assistant'; content: string };

export type AdvisorGrupo = { id: string; contacto: string; empresa?: string | null; etapaLabel?: string | null; /** Con él el panel lee lo que el lead contestó en el formulario de la agenda (#361). */ leadId?: number | null };
type WaMsgLite = { saliente: boolean; texto: string | null };

/** Quien contesta en el hilo: MaKo, con su estrella. */
const MAKO = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };
const nada = () => {};

const SUGS_CHAT = ['Hazlo más corto', 'Dame una versión con nota de voz', '¿Cómo manejo la objeción de precio?', 'Reescribilo más cálido'];

const ANGULO_LABEL: Record<string, string> = {
  valor: 'Valor', curiosidad: 'Curiosidad', prueba_social: 'Prueba social',
  objecion: 'Objeción', cierre_suave: 'Cierre suave', depuracion: 'Depuración', urgencia_suave: 'Urgencia suave',
};
const TONO_LABEL: Record<string, string> = { directo: 'Directo', calido: 'Cálido', con_gancho: 'Con gancho' };

function InlineMd({ text }: { text: string }): ReactNode {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

const btnDark: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const chip = (bg: string, fg: string): CSSProperties => ({ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color: fg });

export function WhatsAppAdvisor({
  grupo, mensajes, ventanaAbierta, onUsar, onRedactarPlantilla, quickTemplates,
}: {
  grupo: AdvisorGrupo;
  mensajes: WaMsgLite[];
  ventanaAbierta: boolean;
  onUsar: (texto: string) => void;
  /** Sin esto, el botón no se dibuja: un rol que no puede abrir /automations no tiene a dónde ir. */
  onRedactarPlantilla?: (seed?: { objetivo: string; etapa: string }) => void;
  quickTemplates: string[];
}) {
  const [tab, setTab] = useState<'consejo' | 'chat'>('consejo');
  const [rec, setRec] = useState<Recomendacion | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // Chat
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  // Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
  const appEscritorio = useAppDeEscritorio();
  const [pensando, setPensando] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Fotos y PDF con la pregunta (28/10/2026, las cajas unificadas): el servidor los lee y van con el pedido.
  const adj = useAdjuntosDelChat({ puede: !pensando, onError: setChatError });
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Cache de la última recomendación por contacto → volver a un chat no recomputa.
  const recCacheRef = useRef<Map<string, Recomendacion>>(new Map());
  // Snapshot de los mensajes actuales, para mandarlos en el momento del pedido.
  const mensajesRef = useRef<WaMsgLite[]>(mensajes);
  mensajesRef.current = mensajes;
  // Id del contacto vigente: descarta respuestas de un análisis que quedó viejo
  // porque cambiaste de chat mientras cargaba (no filtra el consejo de A en B).
  const grupoIdRef = useRef(grupo.id);
  grupoIdRef.current = grupo.id;

  const payloadBase = () => ({
    groupId: grupo.id,
    contacto: grupo.contacto,
    empresa: grupo.empresa ?? null,
    etapaLabel: grupo.etapaLabel ?? null,
    leadId: grupo.leadId ?? null,
    ventanaAbierta,
    mensajes: mensajesRef.current.map((m) => ({ saliente: m.saliente, texto: m.texto })),
  });

  // Al cambiar de contacto: recuperar la recomendación cacheada y cargar el chat.
  useEffect(() => {
    setRec(recCacheRef.current.get(grupo.id) ?? null);
    setAnalizando(false); // no arrastrar el loader de un análisis de otro contacto
    setRecError(null); setChatError(null); setInput('');
    let alive = true;
    (async () => {
      try {
        const j = await fetch('/api/whatsapp/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'history', groupId: grupo.id }) }).then((r) => r.json());
        if (alive) setChat(j.ok ? (j.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })) : []);
      } catch { if (alive) setChat([]); }
    })();
    return () => { alive = false; };
  }, [grupo.id]);

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [chat, pensando, tab]);

  const analizar = async () => {
    if (analizando) return;
    const reqId = grupo.id; // el contacto para el que pedimos este análisis
    setAnalizando(true); setRecError(null);
    try {
      const j = await fetch('/api/whatsapp/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recommend', ...payloadBase() }) }).then((r) => r.json());
      if (j.ok) recCacheRef.current.set(reqId, j.recomendacion); // cachear siempre, aunque hayas cambiado de chat
      if (grupoIdRef.current !== reqId) return; // cambiaste de contacto: no pises su vista
      if (j.ok) setRec(j.recomendacion);
      else setRecError(j.error || 'No se pudo analizar.');
    } catch (e) { if (grupoIdRef.current === reqId) setRecError(e instanceof Error ? e.message : String(e)); }
    finally { if (grupoIdRef.current === reqId) setAnalizando(false); }
  };

  /** `dejarCaja`: lo manda una nota de voz por detrás (lo que la persona esté escribiendo mientras tanto queda en la caja). */
  // Lo de la caja sale con sus archivos (el servidor los lee: lib/adjuntos-del-chat.ts); una sugerencia o una nota, sin ellos.
  const cita = useCitaDelChat(grupo.id);
  const enviarChat = async (texto?: string, { dejarCaja = false } = {}) => {
    // Una nota de voz sale por detrás: la cita queda para lo que se está escribiendo. Una sugerencia, como lo escrito.
    const txt = (dejarCaja ? (texto ?? '') : cita.con(texto ?? input, texto === undefined && adj.hay)).trim();
    const conArchivos = texto === undefined && adj.hay;
    if ((!txt && !conArchivos) || pensando || adj.preparando || appEscritorio.bloqueada) return;
    const archivos = conArchivos ? adj.tomar() : [];
    if (!dejarCaja) { setInput(''); cita.soltar(); }
    setChatError(null);
    setChat((c) => [...c, { role: 'user', content: memoriaConArchivos(txt, archivos.map((f) => f.name)) }]);
    setPensando(true);
    try {
      const datos = { action: 'chat', mensaje: txt, ...payloadBase() };
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch('/api/whatsapp/advisor', archivos.length
          ? { method: 'POST', body: cuerpoConArchivos(datos, archivos) }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      // El cuerpo se lee como TEXTO: un corte de Vercel (413 con archivos de más, 504) llega en texto, no en JSON.
      let j: { ok?: boolean; messages?: Msg[]; error?: string; aviso?: string } | null = null;
      try { j = JSON.parse(cuerpo); } catch { /* no es JSON */ }
      if (j?.ok) {
        setChat((j.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
        if (j.aviso) setChatError(j.aviso);
      } else setChatError(j?.error || (status === 413 ? ERROR_ADJUNTO.pesado : 'No llegó la respuesta: vuelve a intentarlo.'));
    } finally { setPensando(false); }
  };

  const copiar = (texto: string, key: string) => {
    void navigator.clipboard?.writeText(texto);
    setCopiado(key); setTimeout(() => setCopiado((k) => (k === key ? null : k)), 1500);
  };

  const ultimoEntrante = mensajes.length > 0 && !mensajes[mensajes.length - 1].saliente;
  // La nota de voz sale en el acto (28/10/2026): se dibuja ya, se pasa a texto por detrás y sale por `enviarChat`.
  const nota = useNotaEnElActo({ clave: `asesor-wa:${grupo.id}`, puede: !pensando && !adj.preparando && !appEscritorio.bloqueada, mandar: (t) => { void enviarChat(t, { dejarCaja: true }); } });

  // El hilo del Ops Center: los mensajes por su posición (no traen id), y en cada respuesta de MaKo, «Usar →» y «Copiar».
  const items = useMemo((): ItemHilo[] => chat.map((m, i) => ({ k: 'msg', id: `a${i}`, role: m.role, texto: m.content, at: null })), [chat]);
  const enMensaje = (x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null => {
    const i = Number(x.id.slice(1));
    const m = chat[i];
    if (!m || m.role !== 'assistant') return null;
    return {
      abajo: (
        <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
          <button onClick={() => onUsar(m.content)} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, borderColor: 'var(--good)', color: 'var(--good)' }}>Usar →</button>
          <button onClick={() => copiar(m.content, `c${i}`)} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }}>{copiado === `c${i}` ? '✓' : 'Copiar'}</button>
        </div>
      ),
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>✨ MaKo — qué escribir</div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3 }}>
          {(['consejo', 'chat'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, background: tab === t ? 'var(--ink)' : 'transparent', color: tab === t ? 'var(--on-sidebar)' : 'var(--dim)' }}>{t === 'consejo' ? 'Consejo' : 'Chat'}</button>
          ))}
        </div>
      </div>

      {/* ── CONSEJO ── */}
      {tab === 'consejo' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!rec && !analizando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                {ultimoEntrante ? 'El lead escribió último. Pídele a MaKo qué responder, con la metodología Levanta Muertos.' : 'MaKo lee esta conversación y te sugiere qué escribirle para reactivarlo, sin sonar a seguimiento.'}
              </div>
              <button onClick={analizar} style={{ ...btnDark, width: '100%' }}>✨ Analizar conversación</button>
            </div>
          )}
          {analizando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <MakoLoader width={64} /><span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>leyendo el chat…</span>
            </div>
          )}
          {recError && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '9px 11px', color: 'var(--bad)', fontSize: 12.5 }}>{recError}</div>}

          {rec && !analizando && (
            <>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px' }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}><InlineMd text={rec.diagnostico} /></div>
                {rec.ventana_nota && <div style={{ fontSize: 11.5, color: ventanaAbierta ? 'var(--good)' : 'var(--warn)', marginTop: 7, fontWeight: 600 }}>{ventanaAbierta ? '🟢' : '🔒'} {rec.ventana_nota}</div>}
              </div>

              {rec.sugerencias.map((s, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={chip('var(--accent-soft)', '#14161B')}>{ANGULO_LABEL[s.angulo] ?? s.angulo}</span>
                    <span style={chip('var(--surface-2)', 'var(--dim)')}>{TONO_LABEL[s.tono] ?? s.tono}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.texto}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                    <button onClick={() => onUsar(s.texto)} style={{ ...btnGhost, borderColor: 'var(--good)', color: 'var(--good)' }}>Usar →</button>
                    <button onClick={() => copiar(s.texto, `s${i}`)} style={btnGhost}>{copiado === `s${i}` ? '✓ Copiado' : 'Copiar'}</button>
                  </div>
                  {s.guion_voz && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 11.5, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>🎙️ Guion de nota de voz</summary>
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 6 }}>{s.guion_voz}</div>
                      <button onClick={() => copiar(s.guion_voz!, `v${i}`)} style={{ ...btnGhost, marginTop: 6 }}>{copiado === `v${i}` ? '✓ Copiado' : 'Copiar guion'}</button>
                    </details>
                  )}
                </div>
              ))}

              {!ventanaAbierta && (
                <button
                  onClick={() => onRedactarPlantilla?.({
                    objetivo: `Reactivar a ${grupo.contacto}. ${rec.diagnostico}`,
                    etapa: ['pidio_info', 'vio_propuesta', 'objecion', 'frio', 'depuracion'].includes(rec.etapa) ? rec.etapa : 'frio',
                  })}
                  style={{ ...btnGhost, width: '100%', padding: '9px 12px', borderColor: 'var(--warn)', color: 'var(--warn)' }}
                >🔒 Ventana cerrada → redactar plantilla con MaKo</button>
              )}
              <button onClick={analizar} style={{ ...btnGhost, width: '100%' }}>↻ Volver a analizar</button>
            </>
          )}

          {/* Plantillas rápidas (accesos directos de siempre) */}
          {quickTemplates.length > 0 && (
            <div style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>Atajos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quickTemplates.map((t) => (
                  <button key={t} onClick={() => onUsar(t)} style={{ textAlign: 'left', padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>{t}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT ── */}
      {tab === 'chat' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={chatScrollRef} className="co-hilo" style={{ padding: '4px 2px 8px' }}>
            <div className="co-hilo__col">
              {chat.length === 0 && !pensando && (
                <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>Pregúntale a MaKo sobre este lead: cómo responderle, cómo manejar una objeción, o pídele una versión distinta de un mensaje.</div>
              )}
              <HiloMako items={nota.conNotas(items)} quien={MAKO} ahora={Date.now()} escribiendo={pensando ? { segs: 0 } : null}
                tarjeta={null} onTarjeta={nada} onReintentar={nota.reintentar(nada)} onDescartar={nota.descartar} onRecargar={nada} enMensaje={enMensaje} onCitar={cita.citar} />
              {chatError && <p className="co-nota co-nota--mal" role="alert">{chatError}<ReportarASoporte /></p>}
            </div>
          </div>
          <div style={{ flex: 'none', paddingTop: 8 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {SUGS_CHAT.map((s) => <button key={s} onClick={() => enviarChat(s)} disabled={pensando} style={{ flex: 'none', whiteSpace: 'nowrap', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 11.5, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.55 : 1 }}>{s}</button>)}
            </div>
            {/* La caja única (app/_chat/CajaChat.tsx): el «+» (fotos y PDF), los emojis y el micrófono que graba una nota (sale en el acto). */}
            <div className="co-caja">
              <CajaChat texto={input} onTexto={setInput} onMandar={() => { void enviarChat(); }} arriba={cita.arriba} ocupado={pensando || nota.pendientes}
                placeholder="Pregúntale a MaKo…" tituloMandar="Preguntar" enterManda bloqueo={appEscritorio.bloqueo} onGrabada={nota.onGrabada}
                adjuntos={adj.caja} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
