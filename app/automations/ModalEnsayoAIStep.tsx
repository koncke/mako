'use client';

// =============================================================================
// ModalEnsayoAIStep — «Ensayar» un AI Step: un modal central grande (AI Step v2, décima tanda; uno por objetivo, undécima)
// =============================================================================
// Pedido de Martín (11/10/2026, FEEDBACK AI STEP 4): «la IA de MaKo que simula hacerte objeciones y tienes
// que responder... el modal debería reflejar el chat de WhatsApp... Y que pueda comenzar a responder allí
// mismo. El problema es que ya de por sí el modal es chico para poner los chats que hicimos... No sé si abrir
// otro modal en el medio de la pantalla o algo así, defínelo tú». El diseño, en docs/diseno-ai-step-v2.md §4.
//
//   · DÓNDE: un modal centrado, `min(1040px, 94vw) × min(720px, 90vh)`: el panel lateral y «Probar» son chicos
//     para un chat. Izquierda, el chat con la piel del medio (`ChatHilo`, con su composer: también se contesta
//     con audio, que se transcribe). Derecha, el objetivo, las 4 objeciones con su avance y el modo.
//   · UNDÉCIMA TANDA (docs/diseno-undecima-tanda.md §6): el ensayo es del AI STEP ENTERO. Las objeciones salen del
//     objetivo y de todos sus escenarios (`ai`), y «Responde MaKo» contesta como el motor y como «Probar»: la ruta
//     clasifica el mensaje del lead contra los escenarios de los pasos del lienzo (`pasos`) y redacta con el elegido
//     (o con «Lo demás»). Una línea del sistema dice qué escenario eligió; si sólo avisa, MaKo no contesta y el turno
//     pasa a la persona.
//   · «Respondes tú» y «Corregir» son el entrenamiento: «Guardar respuestas» deja los pares (lead → tu respuesta)
//     como `ejemplos` del AI STEP por la edición del flujo (`onGuardar`: borrador → Publicar), no en un setting aparte
//     ni en un escenario (§10-F).
//   · No le manda nada a nadie y no gasta Claude.
//
// ⚠️ Lo monta el editor en un portal al `body`: el panel del lienzo vive adentro de contenedores con
// `transform`, y un `position: fixed` nacido ahí se dibuja recortado (AGENTS.md).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Modal, Button } from '@/app/_ui';
import { ChatHilo, type HiloMsg } from '@/app/whatsapp/_shared/ChatHilo';
import { inpLienzo } from '@/app/_components/Lienzo';
import { ejemplosDeCharla, OBJECIONES_ENSAYO, type AIStepDelEnsayo, type LineaEnsayo } from '@/lib/ai-step-ensayo';
import type { EjemploCaso, MedioAIStep, PasoGrafo } from '@/lib/flujo-grafo';

const SANS = "'Geist', sans-serif";

type Linea = LineaEnsayo & { id: string };
type Prep = { primer: string; objeciones: string[] };
type Desenlace = 'positivo' | 'negativo' | 'abierto' | null;

let seq = 0;
const nid = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

/** El historial como lo entiende la ruta: lo de MaKo y lo tuyo son «el negocio»; lo del sistema no va. */
const historialDe = (h: readonly Linea[]) => h.filter((l) => l.de !== 'sistema')
  .map((l) => ({ de: l.de === 'lead' ? 'lead' as const : 'negocio' as const, texto: l.texto }));

async function aBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ModalEnsayoAIStep({ ai, pasos, medio, secuenciaId, onCerrar, onGuardar }: {
  /** El AI Step: su objetivo y sus escenarios (las objeciones salen de los dos). */
  ai: AIStepDelEnsayo;
  /** Los pasos del lienzo (sin publicar): con ellos «Responde MaKo» clasifica y contesta como el motor. */
  pasos: readonly PasoGrafo[];
  medio: MedioAIStep;
  /** La automatización (el redactor lee su estrategia para «Responde MaKo»). Sin ella, sólo «Respondes tú». */
  secuenciaId: number | null;
  onCerrar: () => void;
  /** Los ejemplos que quedan del ensayo (la pantalla los suma al AI Step). */
  onGuardar: (ejemplos: EjemploCaso[]) => void;
}) {
  const [prep, setPrep] = useState<Prep | null>(null);
  const [hilo, setHilo] = useState<Linea[]>([]);
  const [modo, setModo] = useState<'tu' | 'mako'>('tu');
  const [desenlace, setDesenlace] = useState<Desenlace>(null);
  const [escribe, setEscribe] = useState<null | 'lead' | 'mako'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const hiloRef = useRef<Linea[]>([]);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  const poner = (h: Linea[]) => { hiloRef.current = h; setHilo(h); };

  // El `onCerrar` de identidad FIJA (AGENTS.md: con una flecha nueva por render el modal pierde el foco).
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; });
  const cerrar = useCallback(() => cerrarRef.current(), []);
  // Los pasos más nuevos del lienzo (lo que se edita mientras el modal está abierto también cuenta).
  const pasosRef = useRef(pasos);
  useEffect(() => { pasosRef.current = pasos; });

  const pedir = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/automations/ai-step/ensayo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, medio, ai }) });
    const j = await r.json().catch(() => null);
    if (!j?.ok) throw new Error(j?.error ?? 'No respondió. Vuelve a intentarlo.');
    return j;
  };

  /** El turno del LEAD (MaKo hace de lead). `audio`: la nota de voz del negocio, que se transcribe. */
  const turnoLead = async (p: Prep, audio?: { base64: string; mime: string }) => {
    setEscribe('lead'); setErr(null);
    try {
      const j = await pedir({ action: 'lead', ensayo: p, historial: historialDe(hiloRef.current), ...(audio ? { audioBase64: audio.base64, audioMime: audio.mime } : {}) });
      if (!vivo.current) return;
      let h = hiloRef.current;
      if (j.transcripta) h = [...h, { id: nid(), de: 'tu', texto: String(j.transcripta) }];
      if (j.mensaje) h = [...h, { id: nid(), de: 'lead', texto: String(j.mensaje) }];
      poner(h);
      if (j.desenlace) setDesenlace(j.desenlace as Desenlace);
      return j.mensaje && !j.desenlace ? h : null;
    } catch (e) { if (vivo.current) setErr(e instanceof Error ? e.message : 'No respondió.'); return null; }
    finally { if (vivo.current) setEscribe(null); }
  };

  /**
   * «Responde MaKo»: la ruta clasifica el último mensaje del lead contra los escenarios del lienzo y redacta con el
   * elegido, como el motor. Una línea del sistema dice cuál eligió; si sólo avisa, MaKo no contesta y responde la
   * persona (el entrenamiento).
   */
  const turnoMako = async (p: Prep) => {
    if (secuenciaId == null) return;
    setEscribe('mako'); setErr(null);
    let contesto = false;
    try {
      const j = await pedir({ action: 'mako', secuenciaId, pasos: pasosRef.current, historial: historialDe(hiloRef.current) });
      if (!vivo.current) return;
      const escenario = typeof j.escenario === 'string' && j.escenario ? j.escenario : null;
      const h: Linea[] = [...hiloRef.current, ...(escenario ? [{ id: nid(), de: 'sistema' as const, texto: `«${escenario}»` }] : [])];
      if (typeof j.respuesta === 'string' && j.respuesta) { h.push({ id: nid(), de: 'mako', texto: j.respuesta }); contesto = true; }
      else { h.push({ id: nid(), de: 'sistema', texto: 'Te avisa' }); setModo('tu'); }
      poner(h);
    } catch (e) { if (vivo.current) { setErr(e instanceof Error ? e.message : 'No respondió.'); setModo('tu'); } return; }
    finally { if (vivo.current) setEscribe(null); }
    if (contesto) await turnoLead(p);
  };

  // Al abrir: las objeciones y el primer mensaje del lead.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const j = await pedir({ action: 'objeciones' });
        if (cancelado || !vivo.current) return;
        const p = { primer: String(j.primer), objeciones: (j.objeciones as string[]).slice(0, OBJECIONES_ENSAYO) };
        setPrep(p);
        await turnoLead(p);
      } catch (e) { if (!cancelado && vivo.current) setErr(e instanceof Error ? e.message : 'No se pudo preparar.'); }
    })();
    return () => { cancelado = true; };
    // Una vez al abrir: el objetivo y los escenarios no cambian mientras el modal está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // En «Responde MaKo», cada mensaje del lead lo contesta MaKo (hasta el desenlace).
  useEffect(() => {
    if (modo !== 'mako' || !prep || desenlace || escribe) return;
    const ultimo = hilo[hilo.length - 1];
    if (ultimo?.de === 'lead') void turnoMako(prep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, hilo, prep, desenlace, escribe]);

  const responder = async (texto: string): Promise<boolean> => {
    if (!prep || desenlace || escribe) return false;
    poner([...hiloRef.current, { id: nid(), de: 'tu', texto }]);
    await turnoLead(prep);
    return true;
  };
  const responderAudio = async (blob: Blob): Promise<boolean> => {
    if (!prep || desenlace || escribe) return false;
    await turnoLead(prep, { base64: await aBase64(blob), mime: blob.type || 'audio/webm' });
    return true;
  };

  // El avance de las objeciones: la `i` la plantea el lead después de la respuesta `i` del negocio.
  const respuestas = hilo.filter((l) => l.de === 'tu' || l.de === 'mako').length;
  const estadoObjecion = (i: number): 'pendiente' | 'ahora' | 'hecha' => (respuestas >= i + 2 ? 'hecha' : respuestas === i + 1 ? 'ahora' : 'pendiente');
  const ejemplos = ejemplosDeCharla(hilo);
  const ultimaMako = [...hilo].reverse().find((l) => l.de === 'tu' || l.de === 'mako');
  const puedeCorregir = ultimaMako?.de === 'mako' && !escribe;

  const mensajes: HiloMsg[] = hilo.map((l) => (l.de === 'sistema'
    ? { id: l.id, fromMe: false, tipo: 'sistema', texto: l.texto }
    : { id: l.id, fromMe: l.de !== 'lead', texto: l.texto, ...(l.de === 'mako' ? { ia: true } : {}) }));
  const chip = (activo: boolean): CSSProperties => ({
    flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
    background: activo ? 'var(--primary-bg)' : 'var(--surface)', color: activo ? 'var(--primary-strong)' : 'var(--ink)',
    fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  });

  return (
    <Modal titulo="Ensayo" onCerrar={cerrar} ancho={1040} alto="min(720px, 90vh)"
      pie={(
        <>
          <Button variant="tertiary" onClick={cerrar}>Cerrar</Button>
          <Button disabled={!ejemplos.length} onClick={() => onGuardar(ejemplos)}>
            {ejemplos.length ? `Guardar ${ejemplos.length} ${ejemplos.length === 1 ? 'respuesta' : 'respuestas'}` : 'Guardar respuestas'}
          </Button>
        </>
      )}>
      <div data-ensayo-ai-step style={{ display: 'flex', gap: 16, height: '100%', minHeight: 420, fontFamily: SANS, flexWrap: 'wrap' }}>
        <div style={{ flex: '3 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
          <ChatHilo accent="var(--wa)" accentBubble="var(--wa-bubble)" mensajes={mensajes} animarNuevos
            typing={escribe ? { lado: escribe === 'lead' ? 'left' : 'right' } : null}
            readOnly={!!desenlace || modo === 'mako'}
            placeholder={desenlace ? 'El ensayo terminó' : modo === 'mako' ? 'Contesta MaKo' : 'Responde como lo harías…'}
            onEnviarTexto={responder}
            onEnviarArchivo={medio === 'whatsapp' ? (blob, tipo) => (tipo === 'audio' ? responderAudio(blob) : Promise.resolve(false)) : undefined}
            vacio={<div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13 }}>{err ? '' : 'Preparando el ensayo…'}</div>} />
        </div>
        <div style={{ flex: '2 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Objetivo</div>
            <div style={{ fontSize: 13.5, color: ai.objetivo ? 'var(--ink)' : 'var(--faint)', lineHeight: 1.45, marginTop: 4 }}>{ai.objetivo || 'Sin objetivo'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Objeciones</div>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(prep?.objeciones ?? []).map((o, i) => {
                const e = estadoObjecion(i);
                return (
                  <li key={i} data-objecion={e} style={{ fontSize: 13, lineHeight: 1.4, color: e === 'hecha' ? 'var(--faint)' : 'var(--ink)', fontWeight: e === 'ahora' ? 600 : 400, textDecoration: e === 'hecha' ? 'line-through' : 'none' }}>{o}</li>
                );
              })}
              {!prep && <li style={{ fontSize: 13, color: 'var(--faint)', listStyle: 'none', marginLeft: -18 }}>Preparando…</li>}
            </ol>
          </div>
          <div style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label="Quién responde">
            <button type="button" role="radio" aria-checked={modo === 'tu'} style={chip(modo === 'tu')} onClick={() => setModo('tu')}>Respondes tú</button>
            <button type="button" role="radio" aria-checked={modo === 'mako'} disabled={secuenciaId == null} style={{ ...chip(modo === 'mako'), opacity: secuenciaId == null ? 0.5 : 1 }} onClick={() => setModo('mako')}>Responde MaKo</button>
          </div>
          {modo === 'mako' && puedeCorregir && ultimaMako && (
            corrigiendo == null ? (
              <Button size="sm" variant="secondary" onClick={() => setCorrigiendo(ultimaMako.texto)}>Corregir la última</Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea value={corrigiendo} rows={4} aria-label="Tu respuesta" onChange={(e) => setCorrigiendo(e.target.value)} style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" disabled={!corrigiendo.trim()} onClick={() => {
                    poner(hiloRef.current.map((l) => (l.id === ultimaMako.id ? { ...l, de: 'tu' as const, texto: corrigiendo.trim() } : l)));
                    setCorrigiendo(null);
                  }}>Usar mi respuesta</Button>
                  <Button size="sm" variant="tertiary" onClick={() => setCorrigiendo(null)}>Cancelar</Button>
                </div>
              </div>
            )
          )}
          {desenlace && (
            <div style={{ fontSize: 13, color: desenlace === 'positivo' ? 'var(--good)' : desenlace === 'negativo' ? 'var(--bad)' : 'var(--dim)' }}>
              {desenlace === 'positivo' ? 'Terminó bien.' : desenlace === 'negativo' ? 'Terminó mal.' : 'Terminó sin definirse.'}
            </div>
          )}
          {err && <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
        </div>
      </div>
    </Modal>
  );
}
