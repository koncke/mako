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
import { SeccionCard, parsearSecciones } from '../components/SeccionCard';

/**
 * Loader estándar: cualquier espera se muestra, nunca se deja la pantalla muda.
 * Ocupa el ancho y respira: un spinner diminuto arriba a la izquierda no se lee
 * como "la app está trabajando", se lee como un detalle perdido.
 */
function Cargando({ texto }: { texto: string }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '34px 16px', color: 'var(--dim)', fontSize: 13.5, textAlign: 'center' }}>
      <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
      <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      {texto}
    </div>
  );
}

type PasoKey =
  | 'contexto' | 'voz' | 'ensayo' | 'aprobar'
  | 'wa_no_oficial' | 'wa_no_oficial_prueba'
  | 'wa_oficial' | 'wa_oficial_plantilla' | 'wa_oficial_prueba'
  | 'email_conectar' | 'email_prueba';
type Estado = { status: 'pendiente' | 'done'; steps: Record<string, { done: boolean }> };
type Def = { key: string; titulo: string; pasos: Array<{ key: string; label: string }> };
type Conversacion = { chatJid: string; nombre: string | null; telefono: string | null; mensajes: number; muestra: string | null };

// Títulos CORTOS y descriptivos, como el resto del onboarding ("El Archivero",
// "Tu personalidad", "Tu diagnóstico"). El subtítulo dice EL OBJETIVO del paso
// en una línea — qué se busca, no cómo funciona. Todo lo demás va en la caja de
// contexto, ABAJO de la acción, para no interrumpir.
const PREGUNTA: Record<PasoKey, { q: string; sub: string }> = {
  wa_no_oficial: { q: 'Tu WhatsApp: Método NO Oficial', sub: 'El número desde el que ya le escribís a tus clientes.' },
  wa_no_oficial_prueba: { q: 'Probemos que llega', sub: 'Un código a tu teléfono. Si no llega, no está conectado.' },
  contexto: { q: 'Tu forma de escribir', sub: 'Leo tus chats para aprender tu tono, tus preguntas y cómo cerrás.' },
  voz: { q: 'Tus audios', sub: 'Tu voz abre la conversación. Te paso el guion y grabás.' },
  ensayo: { q: 'El ensayo', sub: 'Hago de lead y vos me respondés. De ahí salen tus mensajes.' },
  aprobar: { q: 'Tus jugadas', sub: 'Esto quedó armado con lo que ensayamos.' },
  wa_oficial: { q: 'Tu WhatsApp: Método Oficial', sub: 'Para escribirle primero a quien nunca te escribió. Opcional.' },
  wa_oficial_plantilla: { q: 'Tu primera plantilla', sub: 'Meta aprueba los mensajes de apertura antes de dejarte usarlos.' },
  wa_oficial_prueba: { q: 'Probemos el oficial', sub: 'Que te llegue igual que le llega a un lead.' },
  email_conectar: { q: 'Tu email', sub: 'El canal para los que no contestan por WhatsApp.' },
  email_prueba: { q: 'Probemos el email', sub: 'Un correo de prueba a tu casilla.' },
};

// Contexto: va ABAJO del todo, después de la acción. Nunca entre el título y el
// botón (nadie lee un párrafo antes de poder hacer algo).
const AYUDA: Partial<Record<PasoKey, { titulo: string; puntos: string[]; ojo?: string }>> = {
  wa_no_oficial: {
    titulo: '¿Por qué el Método NO Oficial?',
    puntos: [
      'A favor: el lead ve tu foto y tu nombre, podés mandar audios y archivos, y respondés lo que quieras sin plantillas.',
      'El Oficial, en cambio, exige que cada mensaje de apertura lo apruebe Meta y no admite notas de voz.',
      'Su límite: solo podés escribirle a quien ya te escribió alguna vez. Para tráfico frío hace falta el Oficial.',
      'Cómo lo cuidamos: tope de mensajes por día, espera entre uno y otro, envío solo de 9 a 21, y a un lead caliente MaKo deja borrador en vez de mandar solo.',
    ],
    ojo: 'Escaneá el número de la EMPRESA, no tu personal: es el número que va a hablar con tus leads.',
  },
  wa_no_oficial_prueba: {
    titulo: '¿Por qué te mando un código?',
    puntos: ['Guardar la conexión no alcanza: recién cuando te llega un mensaje real sabemos que tus leads también lo van a recibir.'],
  },
  contexto: {
    titulo: '¿Qué busco en tus chats?',
    puntos: [
      'Tu tono: cómo saludás, si tuteás, qué muletillas usás.',
      'Tus preguntas: con qué averiguás si alguien te sirve como cliente.',
      'Tu forma de cerrar: cómo pasás de la charla a la reunión.',
      'El patrón: cuántos mensajes te toma y en qué orden.',
    ],
    ojo: 'Solo leo las conversaciones que elijas. Me quedo con tu forma de escribir, no con lo que dice cada cliente.',
  },
  wa_oficial: {
    titulo: '¿Cuándo lo vas a necesitar?',
    puntos: [
      'Para escribirle primero a alguien que nunca te escribió (el lead del formulario).',
      'Es un número verificado: no lo pueden banear por escribir en frío.',
      'A cambio, el primer mensaje tiene que ser una plantilla aprobada por Meta.',
    ],
    ojo: 'Podés saltearlo. Con tu número de empresa alcanza para arrancar.',
  },
  email_conectar: {
    titulo: '¿Por qué también email?',
    puntos: [
      'Al que no contesta por WhatsApp se le escribe por mail: no quema tu número.',
      'Damos de alta tu dominio solos; vos copiás tres registros al DNS.',
      'Mientras no esté verificado, los envíos quedan en modo simulado.',
    ],
  },
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
  // WhatsApp de empresa: el QR se genera y se escanea ACÁ, sin mandar a otra tab.
  const [evo, setEvo] = useState<{ estado: string; numero: string | null } | null>(null);
  const [qrEvo, setQrEvo] = useState<{ base64: string | null } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [verificado, setVerificado] = useState(false);

  // ── Paso contexto: elegir QUÉ chats puede leer, y el resultado ──
  const [convs, setConvs] = useState<Conversacion[] | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [busq, setBusq] = useState('');
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

  const pasoKey = (def?.pasos[idx]?.key ?? 'wa_no_oficial') as PasoKey;
  const enUltimo = !!def && idx === def.pasos.length - 1;
  const pasoKeyRef = useRef<PasoKey>(pasoKey);
  pasoKeyRef.current = pasoKey;
  const convsFiltradas = (convs ?? []).filter((c) => {
    const q = busq.trim().toLowerCase();
    return !q || (c.nombre ?? '').toLowerCase().includes(q) || (c.telefono ?? '').includes(q);
  });

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

  // ── WhatsApp de empresa: estado, QR y detección automática del escaneo ──
  const evoApi = useCallback(async (action: string) => {
    const r = await fetch('/api/whatsapp/evolution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    return r.json() as Promise<{ ok: boolean; error?: string; estado?: string; numero?: string | null; qr?: { base64: string | null } }>;
  }, []);

  const pidiendoEvo = useRef(false);
  useEffect(() => {
    if (pasoKeyRef.current !== 'wa_no_oficial' || evo !== null || pidiendoEvo.current) return;
    pidiendoEvo.current = true;
    void (async () => {
      try { const j = await evoApi('estado'); setEvo({ estado: j.estado ?? 'desconectado', numero: j.numero ?? null }); }
      catch { setEvo({ estado: 'desconectado', numero: null }); }
      finally { pidiendoEvo.current = false; }
    })();
  });

  // Mientras hay un QR en pantalla, preguntamos solos si ya lo escaneó: el
  // usuario no tiene que avisarnos con un botón.
  useEffect(() => {
    if (pasoKey !== 'wa_no_oficial' || !qrEvo || evo?.estado === 'conectado') return;
    const t = setInterval(() => {
      void (async () => {
        try {
          const j = await evoApi('estado');
          if (j.ok && j.estado) {
            setEvo({ estado: j.estado, numero: j.numero ?? null });
            if (j.estado === 'conectado') setQrEvo(null);
          }
        } catch { /* reintenta */ }
      })();
    }, 3000);
    return () => clearInterval(t);
  }, [pasoKey, qrEvo, evo?.estado, evoApi]);

  async function conectarEvo() {
    setBusy(true); setErr(null);
    try {
      const j = await evoApi('conectar');
      if (!j.ok) { setErr(j.error || 'No se pudo generar el código.'); return; }
      if (j.estado) setEvo({ estado: j.estado, numero: j.numero ?? null });
      if (j.qr) setQrEvo(j.qr);
    } finally { setBusy(false); }
  }

  async function desconectarEvo() {
    setBusy(true); setErr(null);
    try {
      const j = await evoApi('desconectar');
      if (!j.ok) { setErr(j.error || 'No se pudo desconectar.'); return; }
      setEvo({ estado: 'desconectado', numero: null }); setQrEvo(null);
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

  // ── Paso contexto: primero la lista de chats, después el análisis ──
  const cargarConvs = useCallback(async () => {
    try {
      const j = await (await fetch('/api/setting/onboarding/conversaciones', { cache: 'no-store' })).json();
      setConvs(j.ok ? (j.conversaciones ?? []) : []);
    } catch { setConvs([]); }
  }, []);
  useEffect(() => { if (pasoKeyRef.current === 'contexto' && convs === null) void cargarConvs(); });

  async function leerConversaciones() {
    if (!elegidos.size) { setErr('Elegí al menos una conversación.'); return; }
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/setting/onboarding/contexto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chats: [...elegidos] }),
      })).json();
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

  const hecho = (k: PasoKey) => !!estado?.steps?.[k]?.done;
  const puedeAvanzar = (() => {
    if (busy) return false;
    // Solo se traba lo que de verdad no tiene sentido saltear: leer el contexto,
    // ensayar un poco, y que el canal principal esté probado. El resto (oficial,
    // email, plantillas) se puede completar después — trabar ahí pierde gente.
    if (pasoKey === 'contexto') return !!contexto?.leido || hecho('contexto');
    if (pasoKey === 'ensayo') return msgs.filter((m) => m.fromMe).length >= 2 || hecho('ensayo');
    if (pasoKey === 'wa_no_oficial') return evo?.estado === 'conectado' || !!canales?.evolutionConectado || hecho('wa_no_oficial');
    if (pasoKey === 'wa_no_oficial_prueba') return verificado || hecho('wa_no_oficial_prueba');
    return true;
  })();

  const slides = [
    { t: 'Tu voz, no una plantilla', d: 'El primer mensaje que recibe un lead es un audio tuyo. Eso es lo que hace que te contesten.' },
    { t: 'Nada sale sin que lo apruebes', d: 'Armamos todo acá, lo probás en tu teléfono, y recién cuando vos digas se prende.' },
  ];

  return (
    <WizardShell
      fullscreen
      embebido
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
      escenario={<PanelMarketing servicioKey="whatsapp" nombre="Setting" slides={slides} eyebrow="✦ Dejemos tu setting listo" />}
    >
      {/* WHATSAPP NO OFICIAL — el QR vive ACÁ, no en otra tab */}
      {pasoKey === 'wa_no_oficial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          {evo === null ? (
            <Cargando texto="Viendo si ya está conectado…" />
          ) : evo.estado === 'conectado' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
              <div style={{ ...okBox, width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
                ✓ Conectado{evo.numero ? <> · <strong>{evo.numero}</strong></> : null}
              </div>
              <button onClick={() => void desconectarEvo()} disabled={busy} style={{ ...btn, color: 'var(--bad)', borderColor: 'var(--bad)' }}>
                {busy ? 'Desconectando…' : 'Desconectar este número'}
              </button>
            </div>
          ) : qrEvo?.base64 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrEvo.base64} alt="Código QR para vincular WhatsApp" style={{ width: 230, height: 230, borderRadius: 12, border: '1px solid var(--border)', background: '#fff' }} />
              <Cargando texto="Esperando que lo escanees…" />
              <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>WhatsApp → Dispositivos vinculados → Vincular dispositivo</div>
            </>
          ) : (
            <button onClick={() => void conectarEvo()} disabled={busy} style={btnDark}>
              {busy ? 'Generando el código…' : 'Generar el código QR'}
            </button>
          )}
        </div>
      )}

      {/* ⑥ WHATSAPP NO OFICIAL — prueba de vida */}
      {pasoKey === 'wa_no_oficial_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!verificado ? (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
                Te mando un código de 6 dígitos a tu WhatsApp. Es la única forma de saber que el canal quedó de verdad conectado.
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
            </>
          ) : (
            <div style={okBox}>✓ Llegó. Tu WhatsApp de empresa está conectado y probado.</div>
          )}
        </div>
      )}

      {/* ⑦ WHATSAPP OFICIAL — conectar */}
      {pasoKey === 'wa_oficial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canales?.oficialConectado ? (
            <div style={okBox}>✓ El oficial ya está conectado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
                Se conecta pegando un solo token de Meta en Configuraciones → Método; MaKo descubre el resto de los datos solo.
              </div>
              <a href="/integraciones" target="_blank" rel="noreferrer" style={{ ...btnDark, alignSelf: 'flex-start', textDecoration: 'none', display: 'inline-block' }}>Abrir integraciones ↗</a>
            </div>
          )}
        </div>
      )}

      {/* ⑧ WHATSAPP OFICIAL — plantilla */}
      {pasoKey === 'wa_oficial_plantilla' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Meta revisa cada mensaje de apertura antes de dejarte usarlo (tarda de minutos a unas horas). Como ya escribiste tus jugadas, mando una de esas a aprobar en vez de inventar una nueva.
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Se manda desde la sub-tab <strong style={{ color: 'var(--ink)' }}>Plantillas</strong> de WhatsApp, o desde el paso de MaKo de cada jugada. Mientras Meta no apruebe, el motor no manda ese paso — nunca sale un mensaje que Meta rechazaría.
          </div>
        </div>
      )}

      {/* ⑨ WHATSAPP OFICIAL — prueba */}
      {pasoKey === 'wa_oficial_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con la plantilla aprobada, probá una jugada desde su perfil («Probar de verdad»): te llega a vos exactamente como le llega al lead.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Si todavía está en revisión, podés seguir: el resto de la tab funciona igual.</div>
        </div>
      )}

      {/* ⑩ EMAIL — conectar */}
      {pasoKey === 'email_conectar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <a href="/email" target="_blank" rel="noreferrer" style={{ ...btnDark, alignSelf: 'flex-start', textDecoration: 'none', display: 'inline-block' }}>Configurar mi dominio ↗</a>
        </div>
      )}

      {/* ⑪ EMAIL — prueba */}
      {pasoKey === 'email_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Cuando el dominio esté verificado, probá una jugada con pasos de email desde su perfil: te llega el correo a tu casilla, con tu remitente.
          </div>
        </div>
      )}

      {/* CONTEXTO — elegir chats → analizar → resultado en secciones */}
      {pasoKey === 'contexto' && !contexto?.leido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {convs === null ? (
            <Cargando texto="Buscando tus conversaciones…" />
          ) : convs.length === 0 ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
              Todavía no tengo conversaciones para leer. Podés seguir: voy a escribir con el perfil de tu negocio y ajusto cuando empieces a chatear.
            </div>
          ) : (
            <>
              <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar contacto…" style={inp} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--faint)' }}>
                <span>{elegidos.size} elegidas de {convs.length}</span>
                <button onClick={() => setElegidos(new Set(convsFiltradas.map((c) => c.chatJid)))} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Elegir todas</button>
                {elegidos.size > 0 && <button onClick={() => setElegidos(new Set())} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Ninguna</button>}
              </div>
              <div style={{ maxHeight: 230, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface-2)' }}>
                {convsFiltradas.map((c) => {
                  const on = elegidos.has(c.chatJid);
                  return (
                    <button key={c.chatJid} type="button"
                      onClick={() => setElegidos((s) => { const n = new Set(s); if (n.has(c.chatJid)) n.delete(c.chatJid); else n.add(c.chatJid); return n; })}
                      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border)', background: on ? 'var(--good-bg)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ width: 16, height: 16, flex: 'none', borderRadius: 5, border: '1px solid ' + (on ? 'var(--good)' : 'var(--border-strong)'), background: on ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre || c.telefono || 'Sin nombre'}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.mensajes} mensajes · {c.muestra ?? ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => void leerConversaciones()} disabled={busy || elegidos.size === 0} style={{ ...btnDark, alignSelf: 'flex-start', opacity: busy || !elegidos.size ? 0.55 : 1 }}>
                {busy ? 'Leyendo…' : `🔎 Leer ${elegidos.size || ''} ${elegidos.size === 1 ? 'conversación' : 'conversaciones'}`}
              </button>
              {busy && <Cargando texto="Leyendo tus chats y sacando tu patrón… puede tardar unos segundos" />}
            </>
          )}
        </div>
      )}
      {pasoKey === 'contexto' && contexto?.leido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>Esto entendí</div>
          {parsearSecciones(contexto.resumen).map((s, i) => (
            <SeccionCard key={s.titulo} s={s} abiertoDefault={i === 0} icono="💬" size="sm" />
          ))}
          <button onClick={() => { setContexto(null); setElegidos(new Set()); }} style={{ ...btn, alignSelf: 'flex-start', marginTop: 4 }}>↻ Elegir otras conversaciones</button>
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
      {/* El contexto va SIEMPRE al final: explica sin interrumpir la acción. */}
      <Ayuda paso={pasoKey} />
    </WizardShell>
  );
}

/** El contexto del canal, DENTRO del paso: qué es, para qué sirve y qué cuidar. */
function Ayuda({ paso }: { paso: PasoKey }) {
  const a = AYUDA[paso];
  if (!a) return null;
  return (
    <div style={{ padding: '13px 15px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>{a.titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {a.puntos.map((p, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{p}</li>)}
      </ul>
      {a.ojo && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)', fontSize: 12.5, lineHeight: 1.55 }}>
          ⚠ {a.ojo}
        </div>
      )}
    </div>
  );
}
