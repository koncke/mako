'use client';

// =============================================================================
// OnboardingSetting — el recorrido que deja la tab Setting lista
// =============================================================================
// Aplica la metodología de .claude/skills/tab-onboarding (Conectar → Contexto →
// Ensayo) con el MISMO chrome que el onboarding global (WizardShell fullscreen +
// PanelMarketing), para que se vea idéntico y no haya que aprender otra cosa.
//
// ① canales  — conectar Y PROBAR (que llegue el mensaje de verdad)
// ② contexto — cómo conversás: se lee de tus chats reales, no se te pregunta
// ③ voz      — tus audios, con MaKo dictándote el guion antes de grabar
// ④ ensayo   — MaKo hace de CLIENTE y vos respondés: de ahí salen las secuencias
// ⑤ aprobar  — mirás lo que quedó, lo probás y lo prendés

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { PanelMarketing } from '@/app/_components/PanelMarketing';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';

type PasoKey = 'canales' | 'contexto' | 'voz' | 'ensayo' | 'aprobar';
type Estado = { status: 'pendiente' | 'done'; steps: Record<string, { done: boolean }> };
type Def = { key: string; titulo: string; pasos: Array<{ key: string; label: string }> };

const PREGUNTA: Record<PasoKey, { q: string; sub: string }> = {
  canales: { q: '¿Por dónde le vas a escribir a tus leads?', sub: 'Conectamos el canal y te mando un mensaje de prueba: si no llega, no está conectado.' },
  contexto: { q: '¿Cómo conversás con tus clientes?', sub: 'No hace falta que me lo cuentes: si ya atendés por WhatsApp, lo leo de tus propias conversaciones.' },
  voz: { q: 'Grabemos tus audios', sub: 'El primer mensaje que recibe un lead es tu voz, no un texto. Te dicto el guion y vos grabás.' },
  ensayo: { q: 'Ensayemos: yo hago de cliente', sub: 'Te escribo como te escribiría un lead de verdad. Contestá como contestarías vos — de acá salen tus mensajes.' },
  aprobar: { q: 'Esto quedó armado', sub: 'Probalo en tu teléfono y prendelo cuando estés listo.' },
};

const btn: CSSProperties = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnDark: CSSProperties = { ...btn, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, outline: 'none' };
const okBox: CSSProperties = { padding: '10px 13px', borderRadius: 10, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: 13 };

export function OnboardingSetting({ onListo }: { onListo: () => void }) {
  const [def, setDef] = useState<Def | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Paso canales ──
  const [canales, setCanales] = useState<{ oficialConectado: boolean; evolutionConectado: boolean; envioHabilitado: boolean } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [verificado, setVerificado] = useState(false);

  // ── Paso contexto ──
  const [contexto, setContexto] = useState<{ leido: boolean; resumen: string } | null>(null);

  // ── Paso ensayo ──
  const [msgs, setMsgs] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right' } | null>(null);
  const seq = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/setting/onboarding', { cache: 'no-store' })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo cargar el onboarding.'); return; }
      setDef(j.def); setEstado(j.estado);
      // Retomar donde quedó: primer paso sin hacer.
      const i = (j.def?.pasos ?? []).findIndex((p: { key: string }) => !j.estado?.steps?.[p.key]?.done);
      setIdx(i < 0 ? 0 : i);
    } catch { setErr('Sin conexión — recargá la página.'); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  // Estado de los canales al entrar al paso 1.
  useEffect(() => {
    if (def?.pasos[idx]?.key !== 'canales' || canales) return;
    void (async () => {
      try {
        const j = await (await fetch('/api/setting/envio', { cache: 'no-store' })).json();
        if (j.ok) setCanales({ oficialConectado: j.oficialConectado, evolutionConectado: j.evolutionConectado, envioHabilitado: j.envioHabilitado });
      } catch { /* sin datos */ }
    })();
  }, [def, idx, canales]);

  const pasoKey = (def?.pasos[idx]?.key ?? 'canales') as PasoKey;
  const enUltimo = !!def && idx === def.pasos.length - 1;

  async function marcarPaso() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/setting/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'paso', paso: pasoKey }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo guardar el avance.'); return; }
      setEstado(j.estado);
      if (j.estado.status === 'done') { onListo(); return; }
      setIdx((i) => Math.min((def?.pasos.length ?? 1) - 1, i + 1));
    } finally { setBusy(false); }
  }

  // ── Paso 1: prueba de vida ──
  async function enviarCodigo() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/setting/onboarding/prueba', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enviar' }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo mandar el código.'); return; }
      setCodigoEnviado(true);
    } finally { setBusy(false); }
  }
  async function verificarCodigo() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/setting/onboarding/prueba', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verificar', codigo }),
      })).json();
      if (!j.ok) { setErr(j.error || 'El código no coincide.'); return; }
      setVerificado(true);
    } finally { setBusy(false); }
  }

  // ── Paso 2: leer sus conversaciones reales ──
  async function leerConversaciones() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/setting/onboarding/contexto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })).json();
      if (!j.ok) { setErr(j.error || 'No pude leer tus conversaciones.'); return; }
      setContexto({ leido: true, resumen: j.resumen ?? '' });
    } finally { setBusy(false); }
  }

  // ── Paso 4: MaKo hace de cliente ──
  const arrancarEnsayo = useCallback(async () => {
    setTyping({ lado: 'left' });
    try {
      const j = await (await fetch('/api/setting/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historial: [] }),
      })).json();
      if (j.ok && j.mensaje) setMsgs([{ id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]);
    } catch { /* el usuario puede escribir igual */ } finally { setTyping(null); }
  }, []);
  useEffect(() => { if (pasoKey === 'ensayo' && msgs.length === 0) void arrancarEnsayo(); }, [pasoKey, msgs.length, arrancarEnsayo]);

  async function responderComoNegocio(texto: string): Promise<boolean> {
    const conmigo: HiloMsg[] = [...msgs, { id: `y-${++seq.current}`, fromMe: true, texto, fecha: new Date().toISOString() }];
    setMsgs(conmigo);
    setTyping({ lado: 'left' });
    try {
      const historial = conmigo.map((m) => ({ de: m.fromMe ? 'negocio' : 'lead', texto: m.texto ?? '' }));
      const j = await (await fetch('/api/setting/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historial }),
      })).json();
      if (j.ok && j.mensaje) setMsgs([...conmigo, { id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]);
      return true;
    } catch { return true; } finally { setTyping(null); }
  }

  const puedeAvanzar = (() => {
    if (busy) return false;
    if (pasoKey === 'canales') return verificado || !!estado?.steps?.canales?.done;
    if (pasoKey === 'contexto') return !!contexto?.leido || !!estado?.steps?.contexto?.done;
    if (pasoKey === 'ensayo') return msgs.filter((m) => m.fromMe).length >= 2 || !!estado?.steps?.ensayo?.done;
    return true; // voz y aprobar se pueden pasar
  })();

  const slides = [
    { t: 'Tu voz, no una plantilla', d: 'El primer mensaje que recibe un lead es un audio tuyo. Eso es lo que hace que te contesten.' },
    { t: 'Nada sale sin que lo apruebes', d: 'Armamos todo acá, lo probás en tu teléfono, y recién cuando vos digas se prende.' },
  ];

  return (
    <WizardShell
      fullscreen
      titulo={def?.titulo ?? 'Setting'}
      total={def?.pasos.length ?? 5}
      idx={idx}
      pregunta={PREGUNTA[pasoKey]?.q ?? ''}
      sub={PREGUNTA[pasoKey]?.sub}
      error={err}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel="Listo, entrar a Setting"
      pending={busy}
      atrasLabel="Atrás"
      hideAtras={idx === 0}
      onAtras={() => setIdx((i) => Math.max(0, i - 1))}
      onSiguiente={() => void marcarPaso()}
      onConfirmar={() => void marcarPaso()}
      onClose={onListo}
      extraFooter={idx > 0 ? <button onClick={onListo} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer' }}>Lo configuro después</button> : undefined}
      escenario={<PanelMarketing servicioKey="whatsapp" nombre="Setting" slides={slides} eyebrow="✦ Tu setting, listo en 5 pasos" />}
    >
      {/* ① CANALES */}
      {pasoKey === 'canales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Estadito ok={!!canales?.evolutionConectado} label="WhatsApp de empresa (el número desde el que escribís)" ayuda="Se conecta escaneando un QR desde la tab WhatsApp." />
            <Estadito ok={!!canales?.oficialConectado} label="WhatsApp oficial (opcional, para plantillas de Meta)" />
          </div>
          {!verificado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
              <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>
                Te mando un código a tu WhatsApp. Si llega, el canal está de verdad conectado.
              </div>
              {!codigoEnviado ? (
                <button onClick={() => void enviarCodigo()} disabled={busy} style={{ ...btnDark, alignSelf: 'flex-start' }}>{busy ? 'Mandando…' : '📲 Mandame el código'}</button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric"
                    style={{ ...inp, width: 130, textAlign: 'center', letterSpacing: '.3em', fontFamily: "'Geist Mono', monospace" }} />
                  <button onClick={() => void verificarCodigo()} disabled={busy || codigo.length < 4} style={{ ...btnDark, opacity: codigo.length < 4 ? 0.5 : 1 }}>Verificar</button>
                  <button onClick={() => void enviarCodigo()} disabled={busy} style={btn}>Reenviar</button>
                </div>
              )}
            </div>
          ) : (
            <div style={okBox}>✓ Llegó. Tu WhatsApp está conectado de verdad.</div>
          )}
        </div>
      )}

      {/* ② CONTEXTO */}
      {pasoKey === 'contexto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!contexto?.leido ? (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
                Voy a mirar tus últimas conversaciones de WhatsApp y sacar de ahí cómo abrís, cómo preguntás y cómo cerrás. No leo nada personal: me quedo con tu forma de escribir.
              </div>
              <button onClick={() => void leerConversaciones()} disabled={busy} style={{ ...btnDark, alignSelf: 'flex-start' }}>
                {busy ? 'Leyendo tus chats…' : '🔎 Leer mis conversaciones'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Esto entendí de cómo conversás</div>
              <div style={{ padding: '13px 15px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>
                {contexto.resumen || 'No encontré conversaciones suficientes todavía — igual puedo escribir con el perfil de tu negocio.'}
              </div>
            </>
          )}
        </div>
      )}

      {/* ③ VOZ */}
      {pasoKey === 'voz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Grabá tus audios desde la sub-tab <strong style={{ color: 'var(--ink)' }}>🎙 Audios</strong> de Setting. Con uno alcanza para arrancar: el de bienvenida.
          </div>
          <div style={{ padding: '13px 15px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Guion del audio de bienvenida:</div>
            ① Saludá y decí tu nombre.<br />
            ② Reconocé de dónde salió el dato («me llegaron tus datos del anuncio»).<br />
            ③ Dejale tu número por si necesita algo.<br />
            ④ Una sola pregunta abierta: a qué se dedica su negocio.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Podés seguir sin grabarlo: los mensajes salen en texto hasta que lo hagas.</div>
        </div>
      )}

      {/* ④ ENSAYO — MaKo es el CLIENTE */}
      {pasoKey === 'ensayo' && (
        <div style={{ height: 380, display: 'flex', flexDirection: 'column' }}>
          <ChatHilo
            accent="var(--wa)"
            accentBubble="var(--wa-bubble)"
            mensajes={msgs}
            typing={typing}
            placeholder="Contestale como le contestarías vos…"
            onEnviarTexto={responderComoNegocio}
            vacio={<div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13 }}>Preparando el escenario…</div>}
          />
        </div>
      )}

      {/* ⑤ APROBAR */}
      {pasoKey === 'aprobar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con lo que ensayamos armé tus jugadas. Están <strong style={{ color: 'var(--ink)' }}>pausadas</strong>: entrá a Setting, escuchá cómo quedaron, probalas en tu teléfono y prendelas cuando estés listo.
          </div>
          <div style={okBox}>Nada sale a un lead hasta que vos prendas el «Envío real».</div>
        </div>
      )}
    </WizardShell>
  );
}

function Estadito({ ok, label, ayuda }: { ok: boolean; label: string; ayuda?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', marginTop: 5, background: ok ? 'var(--good)' : 'var(--border-strong)' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: ok ? 'var(--ink)' : 'var(--dim)' }}>{label}</div>
        {!ok && ayuda && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{ayuda}</div>}
      </div>
    </div>
  );
}
