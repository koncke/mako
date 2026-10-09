'use client';

// =============================================================================
// MakoRedacta — el panel del ✦ de MaKo en el editor de WhatsApp (sexta tanda del Chatbot, WhatsApp 3)
// =============================================================================
// El pedido literal y lo que se decide sin red, en lib/mako-redacta.ts; la ruta, en
// app/api/chat-agent/redactar/route.ts. Acá: la caja para contarle a MaKo qué se quiere lograr (con el
// dictado en vivo de «Crear con IA», `BotonDictar`), lo que leyó, lo que propone y la voz.
//
//   · Lo que MaKo escribe es una PROPUESTA: «Usar» reemplaza los mensajes de la tarjeta, «Agregar» los
//     suma al final. Nada se publica (sólo «Publicar» publica).
//   · Si propone una NOTA DE VOZ, «Grabar con este guion» lo deja para leer mientras se graba (WhatsApp 6:
//     «está bien que aparezcan los guiones que sugirió MaKo, pero solo si sugirió algo»).
//   · SIN VOZ: «si no la tiene configurada, pedirsela y que se pueda configurar allí mismo». Aprenderla
//     (la destila MaKo de lo que hay, POST /api/mako/voz `destilar`) o escribirla a mano (`save`).
//   · «MaKo lo adapta a cada persona» (el `tipo: 'ia'` del paso, que antes era el botón ✦ del título)
//     vive acá, como una casilla: con un solo ✦ en la cabecera no hay dos botones que digan «MaKo».

import { useState, type CSSProperties } from 'react';
import { Spinner } from '@/app/_ui';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { BurbujaHilo } from '../whatsapp/_shared/BurbujaHilo';
import { IconMic } from '../whatsapp/_shared/composer-icons';

const SANS = "'Geist', sans-serif";
/** La ruta corta a los 90 s (`maxDuration`); el navegador espera un poco más y no para siempre. */
const ESPERA_MS = 95_000;

type Respuesta = { mensajes: string[]; audio: string | null; nota: string | null; leido: string[]; sinVoz: boolean; descartes: string[] };

const caja: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.45, outline: 'none', resize: 'none' };
const btn: CSSProperties = { height: 32, padding: '0 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnMako: CSSProperties = { ...btn, border: '1px solid var(--mako-border)', background: 'var(--mako-bg)', color: 'var(--mako-ink)' };

export function MakoRedacta({ contexto, permiteAudio, adaptar, onUsar, onGuion, onCerrar, deshabilitado }: {
  /** Lo que el mensaje ya dice y lo de la automatización (el disparador, el objetivo). */
  contexto: { actual: string; disparador?: string; objetivo?: string | null; gancho?: string | null };
  /** ¿Se puede proponer una nota de voz? (el no oficial). */
  permiteAudio: boolean;
  /** «MaKo lo adapta a cada persona». Sin esto (varias partes, un audio), no se ofrece. */
  adaptar?: { activo: boolean; onCambiar: (on: boolean) => void } | null;
  /** Lo que propuso MaKo: reemplaza los mensajes de la tarjeta o se suma al final. */
  onUsar: (textos: string[], modo: 'reemplazar' | 'agregar') => void;
  /** El guion de la nota de voz que propuso, para leerlo mientras se graba. */
  onGuion: (texto: string) => void;
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
          objetivo: contexto.objetivo ?? '', gancho: contexto.gancho ?? '', permiteAudio,
        }),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      const j = await r.json().catch(() => null) as ({ ok?: boolean; error?: string } & Partial<Respuesta>) | null;
      if (!j?.ok) { setEstado({ t: 'error', error: j?.error || 'MaKo no pudo escribirlo. Prueba de nuevo.' }); return; }
      setEstado({ t: 'listo', r: { mensajes: j.mensajes ?? [], audio: j.audio ?? null, nota: j.nota ?? null, leido: j.leido ?? [], sinVoz: !!j.sinVoz, descartes: j.descartes ?? [] } });
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
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mako-ink)' }}>✦ MaKo</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar MaKo" title="Cerrar"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} rows={3} disabled={deshabilitado || pidiendo}
          placeholder="¿Qué quieres lograr con este mensaje?" aria-label="Qué quieres lograr con este mensaje"
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
          {r.mensajes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mako-ink)' }}>✦ {GRAMATICA.recomienda.rotulo}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {r.mensajes.map((m, i) => <BurbujaHilo key={i} contenido={{ texto: m }} maxAncho="92%" />)}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" style={btn} disabled={deshabilitado} onClick={() => onUsar(r.mensajes, 'agregar')}>Agregar</button>
                <button type="button" style={{ ...btn, border: 'none', background: 'var(--wa)', color: '#fff' }} disabled={deshabilitado} onClick={() => onUsar(r.mensajes, 'reemplazar')}>Usar</button>
              </div>
            </div>
          )}
          {r.audio && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--mako-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--mako-ink)' }}><IconMic /> Mejor como nota de voz</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.audio}</div>
              <button type="button" style={{ ...btnMako, alignSelf: 'flex-end' }} disabled={deshabilitado} onClick={() => onGuion(r.audio!)}>Grabar con este guion</button>
            </div>
          )}
          {r.nota && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{r.nota}</div>}
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
