'use client';

// =============================================================================
// MensajesChat — los mensajes de una secuencia, EN EL CHAT, editables ahí mismo
// =============================================================================
// Reemplaza al acordeón de filas plegadas. El pedido de Martín, textual: «el
// diseño para editar los mensajes tiene que ser tipo CHAT, simular el chat que
// ya tenemos construido, solo editar el mensaje allí mismo».
//
// Por qué el acordeón estaba mal, y no es una cuestión de gusto: un mensaje de
// WhatsApp se juzga por cómo SE VE cuando llega. Una fila plegada que dice
// «💬 WhatsApp · 2 — Hola {{nombre}}, ¿te sigue quedando b…» no deja ver el
// largo, ni los saltos de línea, ni cómo se lee uno detrás del otro. Había que
// abrir una fila para leer un mensaje y cerrarla para leer el siguiente, así
// que la única pregunta que importa —¿esto suena a persona?— era justo la que
// no se podía contestar.
//
// LA ANATOMÍA DE LA BURBUJA SE IMPORTA (`app/whatsapp/_shared/BurbujaMaKo`).
// Antes estaba copiada a mano acá, con un ⚠️ que pedía sincronizarla con
// `ChatHilo` cuando alguien la tocara. Dos copias con un comentario que pide
// sincronizarlas a mano son dos copias que se van a desincronizar: al aparecer
// la tercera —el texto de un aviso en Configuraciones › Notificaciones— se
// extrajo. ChatHilo sigue pintando las suyas: comparte la FORMA, no el
// comportamiento (aquel tiene composer, scroll infinito y lightbox).
//
// Lo que NO se simula: el mensaje del LEAD. Acá no hay conversación, hay lo que
// el negocio manda. Poner burbujas de la otra persona sería inventar lo que va
// a contestar, y para eso está el simulador de al lado, que además lo escribe
// MaKo. Lo que sí va entre mensaje y mensaje es CUÁNDO sale y BAJO QUÉ
// CONDICIÓN, que es lo que decide si la secuencia se lee como una persona o
// como un robot.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { BURBUJA_SALIENTE, PILDORA_SISTEMA, Autocrece } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { PasoAudioControl } from './PasoAudioControl';
import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';

// La forma sale del componente compartido: BURBUJA_SALIENTE y PILDORA_SISTEMA.
const BURBUJA_MIA = BURBUJA_SALIENTE;
const PILDORA = PILDORA_SISTEMA;

/**
 * Cuándo sale este mensaje, dicho como lo diría una persona.
 *
 * En horas crudas («delay 24 h») no se puede juzgar una cadencia: hay que
 * traducir a mano para saber si el segundo mensaje cae encima del primero.
 */
function cuando(horas: number, esPrimero: boolean): string {
  if (esPrimero) {
    if (horas <= 0) return 'Sale al instante';
    if (horas === 1) return 'Sale 1 hora después de que entra';
    if (horas < 24) return `Sale ${horas} horas después de que entra`;
    return `Sale ${Math.round(horas / 24)} día${horas >= 48 ? 's' : ''} después de que entra`;
  }
  if (horas <= 0) return 'Enseguida';
  if (horas === 1) return '1 hora después';
  if (horas < 24) return `${horas} horas después`;
  if (horas === 24) return 'Al día siguiente';
  return `${Math.round(horas / 24)} días después`;
}

/**
 * La condición del paso, en el mismo renglón que el tiempo.
 *
 * Sin esto, dos audios seguidos en la misma secuencia se leen como que salen
 * los dos — que fue exactamente lo que el dueño reportó. Se dice del lado del
 * LEAD («si no contestó»), no del motor («requiere sin_respuesta»).
 */
const CONDICION: Record<string, string> = {
  sin_respuesta: 'solo si no contestó',
  respondio: 'solo si contestó',
  ya_contactado: 'solo si ya le habías escrito',
  primer_contacto: 'solo si es la primera vez',
};

export function MensajesChat({ pasos, audios, rolAdmin, negocio, busy, onEditar, onAgregar, onQuitar, onAudio, onAudioNuevo, onError }: {
  pasos: PasoSecuenciaDto[];
  audios: AudioSetting[];
  rolAdmin: boolean;
  negocio: string;
  busy: boolean;
  onEditar: (orden: number, campo: 'cuerpo' | 'asunto' | 'delay_horas', valor: string | number) => void;
  onAgregar: () => void;
  onQuitar: (orden: number) => void;
  onAudio: (orden: number, audioId: number | null) => void;
  onAudioNuevo: (a: AudioSetting) => void;
  onError: (e: string) => void;
}) {
  // Qué burbuja está en modo edición. 0 = ninguna. Una sola a la vez: dos
  // textareas abiertos vuelven a ser el formulario que esto viene a reemplazar.
  const [editando, setEditando] = useState(0);
  const [ajustes, setAjustes] = useState(0);

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pasos.map((p, i) => {
        const audio = p.tipo === 'audio' && p.audio_id ? audios.find((a) => a.id === p.audio_id) : null;
        const enEdicion = editando === p.orden;
        const cond = p.requiere ? CONDICION[p.requiere] : null;
        return (
          <div key={p.orden} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* CUÁNDO Y BAJO QUÉ CONDICIÓN. Va como píldora del sistema —
                centrada y sin burbuja— porque no es algo que el lead reciba:
                si se pintara como burbuja, quien mira creería que el negocio
                le manda «Al día siguiente» al lead. Es la misma regla que
                ChatHilo ya aplica a sus líneas de sistema. */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => rolAdmin && setAjustes(ajustes === p.orden ? 0 : p.orden)}
                disabled={!rolAdmin}
                title={rolAdmin ? 'Cambiar cuándo sale' : undefined}
                style={{ ...PILDORA, cursor: rolAdmin ? 'pointer' : 'default', fontFamily: 'inherit' }}
              >
                {cuando(p.delay_horas, i === 0)}
                {cond ? <> · <span style={{ color: 'var(--dim)', fontWeight: 600 }}>{cond}</span></> : null}
                {p.canal === 'email' ? ' · por email' : null}
              </button>
            </div>

            {ajustes === p.orden && rolAdmin && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
                <span>Sale</span>
                <input
                  type="number" min={0} max={720} value={p.delay_horas}
                  onChange={(e) => onEditar(p.orden, 'delay_horas', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: 68, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                />
                <span>horas después {i === 0 ? 'de que el lead entra' : 'del mensaje anterior'}</span>
              </div>
            )}

            {/* LA BURBUJA. Alineada a la derecha porque la manda el negocio. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ ...BURBUJA_MIA, minWidth: enEdicion ? '78%' : undefined }}>

                {audio && (
                  <div style={{ marginBottom: p.cuerpo.trim() || enEdicion ? 8 : 0 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 600, marginBottom: 5 }}>🎙 {audio.titulo}</div>
                    {audio.url && <AudioPlay src={audio.url} style={{ width: '100%', maxWidth: 260 }} />}
                    {/* La transcripción es lo que el audio DICE. Se muestra en
                        gris y en cursiva para que no se confunda con el texto
                        que además se manda escrito: son dos cosas distintas y
                        el dueño tiene que poder distinguirlas de un vistazo. */}
                    {audio.transcript && (
                      <div style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', lineHeight: 1.5, marginTop: 6, whiteSpace: 'pre-wrap' }}>{audio.transcript}</div>
                    )}
                  </div>
                )}

                {p.canal === 'email' && (
                  <input
                    value={p.asunto ?? ''} onChange={(e) => onEditar(p.orden, 'asunto', e.target.value)}
                    placeholder="Asunto del email" disabled={!rolAdmin}
                    style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', outline: 'none', padding: '0 0 6px', marginBottom: 8, color: 'var(--ink)', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit' }}
                  />
                )}

                {enEdicion ? (
                  <Autocrece
                    value={p.cuerpo}
                    onChange={(v) => onEditar(p.orden, 'cuerpo', v)}
                    autoFocus
                    onListo={() => setEditando(0)}
                    placeholder={audio ? 'Algo por escrito junto al audio (un enlace, por ejemplo)' : 'Qué dice este mensaje…'}
                  />
                ) : (
                  // No es un <button>: un botón trae text-align:center y su
                  // propia tipografía, y el mensaje quedaría centrado — el bug
                  // que AGENTS.md documenta con el hero del portal de cursos.
                  <div
                    role={rolAdmin ? 'button' : undefined}
                    tabIndex={rolAdmin ? 0 : undefined}
                    onClick={() => rolAdmin && setEditando(p.orden)}
                    onKeyDown={(e) => { if (rolAdmin && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditando(p.orden); } }}
                    title={rolAdmin ? 'Editar este mensaje' : undefined}
                    style={{
                      fontSize: 13.5, lineHeight: 1.55, color: p.cuerpo.trim() ? 'var(--ink)' : 'var(--faint)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: rolAdmin ? 'text' : 'default',
                      fontStyle: p.cuerpo.trim() ? 'normal' : 'italic', outline: 'none',
                    }}
                  >
                    {p.cuerpo.trim() || (audio ? 'Sin texto junto al audio' : 'Sin texto todavía — toca para escribirlo')}
                  </div>
                )}

                {/* Las variantes NO se pintan como burbujas aparte: no son
                    mensajes más, son formas distintas de decir ÉSTE. Pintarlas
                    al lado haría creer que el lead recibe tres. */}
                {(p.variantes?.length ?? 0) > 1 && !enEdicion && (
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
                    ↻ {p.variantes?.length} formas de decirlo — sale una al azar
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{negocio || 'Tu negocio'}</span>
                  {enEdicion && (
                    <button type="button" onClick={() => setEditando(0)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Listo</button>
                  )}
                </div>
              </div>
            </div>

            {/* Cambiar entre texto y nota de voz, y quitar. Fuera de la burbuja
                y en chico: son cosas de configuración, y adentro competirían
                con el mensaje, que es lo que hay que leer. */}
            {rolAdmin && enEdicion && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {p.canal === 'whatsapp' && (
                  <PasoAudioControl
                    orden={p.orden} audios={audios} audioId={audio?.id ?? null}
                    onElegir={(id) => onAudio(p.orden, id)}
                    onGrabado={onAudioNuevo} onError={onError} disabled={busy}
                  />
                )}
                {pasos.length > 1 && (
                  <button type="button" onClick={() => { setEditando(0); onQuitar(p.orden); }}
                    style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    Quitar este mensaje
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {rolAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <button
            type="button" onClick={onAgregar}
            style={{ ...BURBUJA_MIA, background: 'transparent', border: '1px dashed var(--border-strong)', boxShadow: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            + Agregar un mensaje
          </button>
        </div>
      )}
    </div>
  );
}
