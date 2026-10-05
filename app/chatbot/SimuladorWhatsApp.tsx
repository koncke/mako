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

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { SecuenciaPerfil } from './SecuenciaPerfil';
import type { ProductoOpcion } from './ChatAgentApp';
import type { AudioSetting, SecuenciaDto, Opcion } from './ChatAgentApp';
import type { Objetivo } from '@/lib/setting-estrategia';

export const EMOJI_OBJETIVO: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };
// El objetivo puede ser uno del catálogo O uno que escribió el dueño: para esos
// no hay emoji propio y cae al genérico.
export const emojiSecuencia = (j: SecuenciaDto): string =>
  (j.estrategia ? (EMOJI_OBJETIVO[j.estrategia.objetivo as Objetivo] ?? '🎯') : '⚑');

// Variables de plantilla → lead de prueba (solo visual, espejo del motor).
// Tolera {{nombre}} y {nombre} (los seeds viejos de email usan llave simple).
const conVars = (s: string) => s
  .replace(/\{\{?\s*nombre\s*\}?\}/gi, 'Juan')
  .replace(/\{\{?\s*apellido\s*\}?\}/gi, 'Pérez')
  .replace(/\{\{?\s*empresa\s*\}?\}/gi, 'Acme SRL');

/**
 * La CONDICIÓN del paso, en palabras. Sin esto los dos audios de apertura de
 * la post-agenda se leen como que salen los dos, cuando el motor manda
 * exactamente UNO y saltea el otro. El dueño lo reportó mirando esta pantalla:
 * «veo que estos 2 audios están en una misma secuencia, pero no se deben
 * enviar ambos».
 */
const CONDICION: Record<string, string> = {
  ya_contactado: 'solo si ya le habías escrito',
  primer_contacto: 'solo si es la primera vez',
  sin_respuesta: 'solo si no contestó',
  respondio: 'solo si contestó',
};

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

export function SimuladorWhatsApp({ secuencias, objetivos, etiquetaEtapa, negocio, rolAdmin, audios, canalCaido, onAudioNuevo, onWizard, onReload, productos, disparadores }: {
  productos: ProductoOpcion[];
  disparadores: Opcion[];
  secuencias: SecuenciaDto[];
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  negocio: string;
  /** El WhatsApp del negocio está caído: prender una secuencia no va a enviar nada. */
  canalCaido: boolean;
  rolAdmin: boolean;
  audios: AudioSetting[];
  onAudioNuevo: (a: AudioSetting) => void;
  onWizard: (id: number | 'nueva') => void;
  onReload: () => void;
}) {
  const [busq, setBusq] = useState('');
  const [selId, setSelId] = useState<number | ''>('');
  const [mensajes, setMensajes] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right'; autor?: string } | null>(null);
  // La prueba TERMINA cuando la secuencia cumple su objetivo o queda claro que
  // no lo va a cumplir. Mientras es null la conversación sigue viva.
  const [cerradaSim, setCerradaSim] = useState<'positivo' | 'negativo' | null>(null);
  /** La tab ES el lienzo; el chat sólo sale de «Probar». No hay un tercer modo. */
  const [modo, setModo] = useState<'editor' | 'chat'>('editor');
  const seq = useRef(0);

  useEffect(() => { if (selId === '' && secuencias.length) setSelId(secuencias[0].id); }, [secuencias, selId]);
  // Otra secuencia = otra prueba: el cierre de la anterior no la puede trabar.
  useEffect(() => { setCerradaSim(null); }, [selId]);

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
    setMensajes([]); setTyping(null);
    if (selId !== '' && guionKey) reproducirGuion();
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, guionKey]);

  const elegir = (id: number) => { setSelId(id); setModo('editor'); };
  void elegir;

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
          ? { id: `sim-${sel.id}-${p.orden}-${++seq.current}`, fromMe: false, autor: `${negocio || 'Tu negocio'} · ⏱ ${fmtTiming(p)}${p.requiere && CONDICION[p.requiere] ? ` · ${CONDICION[p.requiere]}` : ''}`, tipo: 'audio', mediaUrl: audio.url, texto: audio.transcript ? `🎙 ${audio.transcript}` : null, fecha: new Date().toISOString() }
          : { id: `sim-${sel.id}-${p.orden}-${++seq.current}`, fromMe: false, autor: `${negocio || 'Tu negocio'} · ⏱ ${fmtTiming(p)}${p.requiere && CONDICION[p.requiere] ? ` · ${CONDICION[p.requiere]}` : ''}`, texto: conVars(p.cuerpo), fecha: new Date().toISOString() },
      });
      // EL PIE DEL AUDIO, que antes no se veía en ningún lado. En un paso de
      // nota de voz el `texto` de la burbuja se usa para la TRANSCRIPCIÓN, así
      // que `p.cuerpo` —el mensaje escrito que sale pegado al audio, con el link
      // del video— quedaba invisible. El dueño lo leyó como que el link faltaba:
      // «esos audios prometen enviar el video pero no sé cómo agregar ese link».
      // Ya estaba; no se mostraba. Va como burbuja aparte porque así llega.
      if (audio && p.cuerpo.trim()) {
        guion.push({
          t: 'msg',
          msg: {
            id: `sim-${sel.id}-${p.orden}-pie-${++seq.current}`, fromMe: false,
            autor: `${negocio || 'Tu negocio'} · junto al audio`,
            texto: conVars(p.cuerpo), fecha: new Date().toISOString(),
          },
        });
      }
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

  async function pedirRespuesta(body: Record<string, unknown>, msgs: HiloMsg[]): Promise<{ respuesta?: string; transcript?: string; desenlace?: 'positivo' | 'negativo' | null } | null> {
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
    if (j?.respuesta) {
      const hilo: HiloMsg[] = [...conLead, { id: `mako-${++seq.current}`, fromMe: false, autor: negocio || 'Tu negocio', texto: j.respuesta, fecha: new Date().toISOString() }];
      // La conversación TERMINA. Sin esto MaKo rebatía la misma objeción para
      // siempre: no hay lead que insista cuatro veces con lo mismo, y probar
      // una secuencia que nunca cierra no dice si la secuencia sirve.
      if (j.desenlace) {
        hilo.push({
          id: `fin-${++seq.current}`, fromMe: false, tipo: 'sistema',
          tono: j.desenlace === 'positivo' ? 'ok' : 'bad',
          texto: j.desenlace === 'positivo'
            ? 'La secuencia cumplió su objetivo con este lead.'
            : 'Esta conversación no va a llegar al objetivo. La secuencia cierra aquí.',
          fecha: new Date().toISOString(),
        });
      }
      setMensajes(hilo);
      setCerradaSim(j.desenlace ?? null);
    }
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

  /**
   * ⚠️ TODA LA TAB ES EL LIENZO. No hay pantalla de listado, ni tarjetas, ni lista al
   * costado: se entra EDITANDO la secuencia, y el chat es una consecuencia de «Probar».
   *
   * Martín, tres veces y la última con el resultado a la vista: «por DEFAULT abro la tab
   * y debe salir la grilla para editar las secuencias, y al darle a PROBAR recién la
   * vista del chat», «no pongas a la grilla chiquita en el medio en un recuadro, haz que
   * ocupe TODA la tab» y «mezclaste las cosas… te pedí que TODO la tab de chatbot sea la
   * grilla editable, y trajiste las tarjetas de clientes».
   *
   * ⚠️ «LA GRILLA» ES LA PIZARRA, NO UNA GRILLA DE TARJETAS. Es el lienzo con fondo de
   * cuadrícula (app/_components/Lienzo.tsx) que él mismo pidió cuadricular dos pedidos
   * antes. Leerlo como «una grilla de tarjetas» costó una tanda entera y trajo acá el
   * componente de la cartera de clientes de /customer-success, que es de OTRA pantalla.
   * Cuando una palabra puede nombrar dos cosas y una de las dos ya está en la pantalla,
   * es ésa.
   *
   * Cambiar de secuencia es un desplegable en la barra de arriba, no una pantalla
   * intermedia: volver a un listado para abrir otra es el recuadro otra vez.
   */
  if (!sel) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>
        Elige una secuencia de mensajes.
      </div>
    );
  }

  if (modo === 'chat') {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ChatHilo
          accent="var(--wa)"
          accentBubble="var(--wa-bubble)"
          mensajes={mensajes}
          typing={typing}
          draftKey={`setting-sim-${sel.id}`}
          readOnly={!!cerradaSim}
          placeholder={cerradaSim ? 'Esta prueba terminó' : 'Escribe como el lead…'}
          onEnviarTexto={enviarTexto}
          onEnviarArchivo={enviarArchivo}
          vacio={(
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--faint)', fontSize: 13, lineHeight: 1.7, maxWidth: 300 }}>
              Esta secuencia todavía no tiene mensajes de WhatsApp.<br />Escribe abajo como el lead y MaKo te responde.
            </div>
          )}
          header={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {/* La salida va PRIMERA y vuelve al LIENZO, que es de donde se vino y es la
                  pantalla de la tab. El destino de «Volver» es una propiedad de la
                  pantalla, no del historial (AGENTS.md). */}
              <button type="button" onClick={() => setModo('editor')} title="Volver a editar la secuencia"
                style={{ flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit' }}>←</button>
              <div style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{emojiSecuencia(sel)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.nombre}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Prueba · escribe como el lead</div>
              </div>
              {/* Volver a verla desde el principio después de haber chateado, no para
                  arrancarla: ya se reprodujo sola al entrar. */}
              <button type="button" onClick={reproducirGuion} title="Ver la secuencia otra vez desde el principio" aria-label="Ver la secuencia otra vez desde el principio"
                style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
              <button type="button" onClick={() => setModo('editor')} title="Editar la secuencia"
                style={{ flex: 'none', padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{rolAdmin ? 'Editar' : 'Perfil'}</button>
            </div>
          )}
        />
      </div>
    );
  }

  return (
    /**
     * ⚠️ EL `key` ES OBLIGATORIO ACÁ, y es un hallazgo de esta misma casa escrito hace
     * unas horas: «un `useState` sembrado de props no se resiembra; si la vista deja de
     * desmontarse, hay que poner el key». Antes se cambiaba de secuencia volviendo a una
     * pantalla de listado, así que cada apertura era un montaje nuevo; ahora el
     * desplegable cambia la secuencia SIN desmontar, y los seis `useState(props.…)` del
     * perfil —el texto, el publicado contra el que compara, el interruptor, el producto
     * elegido— se quedarían con los valores de la secuencia ANTERIOR. Se ve como dos
     * nombres distintos en la misma pantalla, y se guarda como el texto de una en la otra.
     */
    <SecuenciaPerfil key={sel.id} secuencia={sel} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} rolAdmin={rolAdmin} audios={audios} negocio={negocio} canalCaido={canalCaido} onAudioNuevo={onAudioNuevo}
      productos={productos} disparadores={disparadores}
      secuencias={secuencias}
      onAbrirClave={(clave) => {
        // El «Sigue con» del lienzo tiene que LLEVAR: un nodo que nombra otra secuencia y
        // no la abre es la mitad inútil del encadenamiento.
        const otra = secuencias.find((j) => j.clave === clave);
        if (otra) setSelId(otra.id);
      }}
      onElegir={(id) => setSelId(id)}
      onNueva={() => onWizard('nueva')}
      onProbar={() => setModo('chat')}
      onCambio={onReload} onWizard={() => onWizard(sel.id)} />
  );
}
