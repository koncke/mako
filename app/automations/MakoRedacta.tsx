'use client';

// =============================================================================
// MakoRedacta — el panel del ✦ de MaKo en el editor de WhatsApp (sexta tanda del Chatbot, WhatsApp 3)
// =============================================================================
// El pedido literal y lo que se decide sin red, en lib/mako-redacta.ts; la ruta, en
// app/api/chat-agent/redactar/route.ts. Acá: la caja para contarle a MaKo qué se quiere lograr (con el
// dictado en vivo de «Crear con IA», `BotonDictar`), lo que leyó, lo que propone y la voz.
//
//   · Lo que MaKo escribe es una PROPUESTA, y ya NO se dibuja acá (décima tanda, WhatsApp 5: «Las sugerencias de
//     MaKo, no deberían aparecer como un mensaje enviado, sino como un recuadro diferente arriba del recuadro
//     donde uno escribe»): se entrega por `onPropuesta` y el editor la pone en su recuadro arriba de la barra
//     (`SugerenciaMaKo`, EditorMensajeWhatsApp.tsx), con «Usar» (reemplaza los mensajes de la tarjeta),
//     «Agregar» (los suma al final) y, si propone una NOTA DE VOZ, «Grabar con este guion». Hasta el 11/10 eran
//     burbujas de WhatsApp con «Agregar» y «Usar» adentro de este panel, y se leían como mensajes ya enviados.
//     Nada se publica (sólo «Publicar» publica).
//   · SIN VOZ: «si no la tiene configurada, pedirsela y que se pueda configurar allí mismo». Aprenderla
//     (la destila MaKo de lo que hay, POST /api/mako/voz `destilar`) o escribirla a mano (`save`).
//   · «MaKo lo adapta a cada persona» (el `tipo: 'ia'` del paso, que antes era el botón ✦ del título)
//     vive acá, como una casilla: con un solo ✦ en la cabecera no hay dos botones que digan «MaKo».
//   · UNDÉCIMA TANDA: en «MaKo en WhatsApp» (`datos` = el contexto de la tarjeta, destino 'equipo') escribe el
//     aviso al EQUIPO, y si propone una nota de voz es para la Voz de MaKo (el editor la genera). Sin la voz del
//     negocio: la ruta no la lee ni pide configurarla.
//   · DECIMOTERCERA TANDA (12/10/2026):
//       - punto 8, «Falta el botón de "MaKo te ayuda a escribirlo" en todos los otros canales... es diferente WhatsApp
//         que Email»: `canal` ('whatsapp' | 'email' | 'instagram' | 'messenger'). Lo monta también el editor del email
//         (EditorEmailGmail.tsx: propone asunto y cuerpo) y el de un DM (EditorMensajeSocial.tsx: uno o dos mensajes
//         cortos, sin nota de voz). Lo que cambia por canal lo decide lib/mako-redacta.ts.
//       - punto 7, «todo eso se debe quedar guardado como parte del historial del chat... se tiene que ver que el usuario
//         apretó el botón en X tarjeta»: con `historial` (la automatización y el nombre de la tarjeta), la ruta anota el
//         pedido y lo que propuso en el chat de MaKo de esa automatización, y el chat abierto lo suma
//         (`avisarChatMako`, ./chat-mako-eventos.ts).
//       - el logo de MaKo en la cabecera (punto 4), no la estrella de texto.

import { useState, type CSSProperties } from 'react';
import { Spinner } from '@/app/_ui';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import type { CanalRedacta, DatosRedacta } from '@/lib/mako-redacta';
import { avisarChatMako } from './chat-mako-eventos';

const SANS = "'Geist', sans-serif";
/** La ruta corta a los 90 s (`maxDuration`); el navegador espera un poco más y no para siempre. */
const ESPERA_MS = 95_000;

type Respuesta = { mensajes: string[]; asunto: string | null; audio: string | null; nota: string | null; leido: string[]; sinVoz: boolean; descartes: string[] };

const caja: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.45, outline: 'none', resize: 'none' };
const btn: CSSProperties = { height: 32, padding: '0 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnMako: CSSProperties = { ...btn, border: '1px solid var(--mako-border)', background: 'var(--mako-bg)', color: 'var(--mako-ink)' };

/**
 * Lo que propuso MaKo, para el recuadro de la sugerencia del editor. `sinVoz`: además pidió la voz del negocio.
 * `asunto`: sólo el email (punto 8 de la decimotercera tanda).
 */
export type PropuestaRedacta = { mensajes: string[]; asunto?: string | null; audio: string | null; nota: string | null; sinVoz: boolean };

/** Dónde se anota lo que propone (punto 7): la automatización y la tarjeta tal como se lee en el lienzo. */
export type HistorialRedacta = { secuenciaId: number; tarjeta: string };

/** Lo que se le pregunta a la persona, por canal (corto, en tú). */
export const PLACEHOLDER_REDACTA: Record<CanalRedacta, string> = {
  whatsapp: '¿Qué quieres lograr con este mensaje?',
  email: '¿Qué quieres lograr con este email?',
  instagram: '¿Qué quieres lograr con este DM?',
  messenger: '¿Qué quieres lograr con este DM?',
};

export function MakoRedacta({ contexto, permiteAudio, adaptar, onPropuesta, onCerrar, deshabilitado, datos = 'motor', canal = 'whatsapp', historial = null }: {
  /** Por dónde sale lo que se escribe (punto 8): cambia lo que MaKo propone. Ausente = WhatsApp. */
  canal?: CanalRedacta;
  /** La tarjeta y su automatización: lo pedido y lo propuesto entran al chat de MaKo (punto 7). Sin esto, no se anota. */
  historial?: HistorialRedacta | null;
  /**
   * Qué datos resuelve quien manda (lib/mako-redacta.ts, `DatosRedacta`): el recordatorio tiene los suyos, y la
   * tarjeta «MaKo en WhatsApp» manda SU contexto (destino 'equipo', undécima tanda): MaKo escribe el aviso al
   * EQUIPO, con los datos para actuar y sin la voz del negocio.
   */
  datos?: DatosRedacta;
  /** Lo que el mensaje ya dice y lo de la automatización (el disparador, el objetivo). */
  contexto: { actual: string; disparador?: string; objetivo?: string | null; gancho?: string | null };
  /** ¿Se puede proponer una nota de voz? (el no oficial). */
  permiteAudio: boolean;
  /** «MaKo lo adapta a cada persona». Sin esto (varias partes, un audio), no se ofrece. */
  adaptar?: { activo: boolean; onCambiar: (on: boolean) => void } | null;
  /**
   * Lo que propuso MaKo (mensajes y/o el guion de una nota de voz): el editor lo pone en su recuadro arriba de la
   * barra (WhatsApp 5 de la décima tanda). Sólo si propuso algo.
   */
  onPropuesta: (p: PropuestaRedacta) => void;
  onCerrar: () => void;
  deshabilitado?: boolean;
}) {
  const [pedido, setPedido] = useState('');
  const [estado, setEstado] = useState<{ t: 'quieto' } | { t: 'pidiendo' } | { t: 'listo'; r: Respuesta } | { t: 'error'; error: string }>({ t: 'quieto' });
  const [voz, setVoz] = useState<{ t: 'quieto' } | { t: 'escribiendo'; texto: string } | { t: 'guardando' } | { t: 'lista' } | { t: 'error'; error: string }>({ t: 'quieto' });
  const pidiendo = estado.t === 'pidiendo';

  async function escribir() {
    if (pidiendo) return;
    setEstado({ t: 'pidiendo' });
    try {
      const r = await fetch('/api/chat-agent/redactar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido, actual: contexto.actual, disparador: contexto.disparador ?? '',
          objetivo: contexto.objetivo ?? '', gancho: contexto.gancho ?? '', permiteAudio, datos, canal,
          ...(historial ? { secuenciaId: historial.secuenciaId, tarjeta: historial.tarjeta } : {}),
        }),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      const j = await r.json().catch(() => null) as ({ ok?: boolean; error?: string; chat?: unknown } & Partial<Respuesta>) | null;
      // Lo que la ruta anotó en el chat de MaKo (punto 7), también si no pudo: el chat abierto lo suma.
      if (historial && j?.chat) avisarChatMako(historial.secuenciaId, j.chat);
      if (!j?.ok) { setEstado({ t: 'error', error: j?.error || 'MaKo no pudo escribirlo. Prueba de nuevo.' }); return; }
      const lista: Respuesta = { mensajes: j.mensajes ?? [], asunto: j.asunto ?? null, audio: j.audio ?? null, nota: j.nota ?? null, leido: j.leido ?? [], sinVoz: !!j.sinVoz, descartes: j.descartes ?? [] };
      setEstado({ t: 'listo', r: lista });
      if (lista.mensajes.length || lista.audio) onPropuesta({ mensajes: lista.mensajes, asunto: lista.asunto, audio: lista.audio, nota: lista.nota, sinVoz: lista.sinVoz });
    } catch (e) {
      setEstado({ t: 'error', error: e instanceof Error && e.name === 'TimeoutError' ? 'MaKo tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    }
  }

  async function guardarVoz(accion: 'destilar' | 'save', texto?: string) {
    setVoz({ t: 'guardando' });
    try {
      const r = await fetch('/api/mako/voz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accion === 'save' ? { action: 'save', texto } : { action: 'destilar' }),
        signal: AbortSignal.timeout(accion === 'destilar' ? 305_000 : 30_000),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!j?.ok) { setVoz({ t: 'error', error: j?.error || 'No se pudo guardar.' }); return; }
      setVoz({ t: 'lista' });
    } catch { setVoz({ t: 'error', error: 'Sin conexión. Prueba de nuevo.' }); }
  }

  const r = estado.t === 'listo' ? estado.r : null;
  return (
    <div data-mako-redacta style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MakoLogo size={20} animate={false} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mako-ink)' }}>MaKo</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar MaKo" title="Cerrar"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} rows={3} disabled={deshabilitado || pidiendo}
          placeholder={PLACEHOLDER_REDACTA[canal]} aria-label={PLACEHOLDER_REDACTA[canal].replace(/[¿?]/g, '')}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void escribir(); } }}
          style={{ ...caja, flex: 1, minWidth: 0 }} />
        <BotonDictar titulo="Dictar" valor={pedido} onValor={setPedido} onError={(m) => setEstado({ t: 'error', error: m })} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void escribir()} disabled={deshabilitado || pidiendo || (!pedido.trim() && !contexto.actual.trim())}
          style={{ ...btnMako, height: 36, padding: '0 16px', fontSize: 13.5, opacity: (!pedido.trim() && !contexto.actual.trim()) ? 0.55 : 1 }}>
          {pidiendo ? <><Spinner size={12} /> {GRAMATICA.analizando.rotulo}…</> : r ? 'Escribir otro' : 'Escribir'}
        </button>
        {adaptar && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)', cursor: 'pointer' }}
            title="MaKo reescribe este mensaje para cada persona, con lo que sabe de ella">
            <input type="checkbox" checked={adaptar.activo} disabled={deshabilitado} onChange={(e) => adaptar.onCambiar(e.target.checked)} />
            Adaptarlo a cada persona
          </label>
        )}
      </div>

      {estado.t === 'error' && <div role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{estado.error}</div>}

      {r && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.leido.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Leí {r.leido.join(' · ')}</div>}
          {/* LA PROPUESTA YA ESTÁ EN SU RECUADRO, arriba de la barra (WhatsApp 5): acá sólo se avisa, si el panel
              sigue abierto (MaKo pidió la voz del negocio, más abajo). */}
          {(r.mensajes.length > 0 || r.audio) && (
            <div data-sugerencia-lista style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--mako-bg)', border: '1px solid var(--mako-border)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mako-ink)' }}>✦ {GRAMATICA.recomienda.rotulo}</span>
              <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={onCerrar}>Verla</button>
            </div>
          )}
          {r.sinVoz && voz.t !== 'lista' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: 10, borderRadius: 12, border: '1px dashed var(--border-strong)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>MaKo todavía no sabe cómo escribes</div>
              {voz.t === 'escribiendo' ? (
                <>
                  <textarea value={voz.texto} rows={3} onChange={(e) => setVoz({ t: 'escribiendo', texto: e.target.value })}
                    placeholder="Cómo hablas con tus clientes: el tono, las palabras que usas, cómo cierras" aria-label="Cómo escribes" style={caja} />
                  <button type="button" style={{ ...btn, alignSelf: 'flex-end' }} disabled={!voz.texto.trim()} onClick={() => void guardarVoz('save', voz.texto)}>Guardar</button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" style={btnMako} disabled={voz.t === 'guardando'} onClick={() => void guardarVoz('destilar')}>
                    {voz.t === 'guardando' ? <><Spinner size={12} /> Aprendiendo…</> : 'Que la aprenda MaKo'}
                  </button>
                  <button type="button" style={btn} disabled={voz.t === 'guardando'} onClick={() => setVoz({ t: 'escribiendo', texto: '' })}>Escribirla yo</button>
                </div>
              )}
              {voz.t === 'error' && <div role="alert" style={{ fontSize: 12, color: 'var(--bad)' }}>{voz.error}</div>}
            </div>
          )}
          {r.sinVoz && voz.t === 'lista' && <div style={{ fontSize: 12, color: 'var(--good)' }}>Voz guardada</div>}
          {!r.mensajes.length && !r.audio && <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>MaKo no propuso nada. Cuéntale un poco más.</div>}
        </div>
      )}
    </div>
  );
}
