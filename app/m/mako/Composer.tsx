'use client';

// =============================================================================
// El composer del chat con MaKo: [+ adjuntar] [campo de 1 a 5 líneas] [mic | enviar]
// =============================================================================
// UNA sola affordance de voz, el micrófono, con dos gestos:
//   · TOCAR = dictado al campo (useDictar: en vivo con el reconocimiento del navegador, o
//     grabar y transcribir con /api/plan-dictado donde no hay). El texto queda EDITABLE y
//     la persona envía: lo que transcribe una máquina se lee antes de que valga.
//   · MANTENER = nota de voz, como en WhatsApp: deslizar a la izquierda cancela, hacia
//     arriba bloquea (sigue grabando sin el dedo: [tacho] cronómetro [Enviar audio]). Al
//     soltar se transcribe y se manda con la transcripción visible en la burbuja.
//     ⚠️ La nota NO sale como audio a nadie: lo que viaja a MaKo es su transcripción, y
//     MaKo sólo PROPONE (toda acción se confirma en su tarjeta). Por eso soltar manda —en
//     WhatsApp, donde el audio le llega a una persona, soltar NO manda nada
//     (app/whatsapp/_shared/VoiceRecorder.tsx, «nada sale al soltar»).
//
// Teclado: con el campo enfocado la barra inferior se oculta (`data-m-sin-barra`, que
// respeta app/m/m.css) y el composer se apoya sobre el teclado: en Android lo hace solo el
// viewport (`interactive-widget=resizes-content`, en el layout); en iOS el layout no se
// achica y hay que correrlo lo que mide el teclado (`visualViewport`).
// =============================================================================

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as PE } from 'react';
import { Icon } from '@/app/_components/icons';
import { Button } from '@/app/_ui/Button';
import { useDictar, transcribirNota } from '@/app/_components/useDictar';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import { haptico } from '@/lib/haptico';
import { esIOS } from '@/lib/movil-instalar';
import { SheetM } from '../_ui';
import { IconoM } from './iconos';
import { achicarImagen } from './subir';
import {
  ESPERA_MANTENER_MS, TOPE_NOTA_S, comoHabilitarMic, duracion, esMicBloqueado, gestoDelMic,
  problemaDeSeleccion, restanteNota,
} from './chat-ui';

export type AdjuntoM = { id: string; file: File; nombre: string; tipo: 'image' | 'document'; thumb: string | null };
export type Envio = { texto: string; adjuntos: AdjuntoM[]; voz?: { url: string; secs: number } };

type Modo = 'quieto' | 'manteniendo' | 'bloqueado';

const ACCEPT_FOTOS = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';

let n = 0;
const nuevoId = () => `adj-${++n}`;

export function Composer({ enLinea, ocupado, onEnviar, onAltura }: {
  enLinea: boolean;
  /** MaKo está trabajando: se puede escribir el próximo, no mandarlo */
  ocupado: boolean;
  onEnviar: (e: Envio) => void;
  onAltura: (px: number) => void;
}) {
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<AdjuntoM[]>([]);
  const [procesando, setProcesando] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micBloqueado, setMicBloqueado] = useState(false);
  const [modo, setModo] = useState<Modo>('quieto');
  const [arrastre, setArrastre] = useState({ dx: 0, dy: 0 });
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const [hojaAdjuntar, setHojaAdjuntar] = useState(false);
  const [ios, setIos] = useState(false);

  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const inCamara = useRef<HTMLInputElement>(null);
  const inFotos = useRef<HTMLInputElement>(null);
  const inArchivo = useRef<HTMLInputElement>(null);
  const gesto = useRef<{ x0: number; y0: number; timer: number | null; suprimirClick: boolean }>({ x0: 0, y0: 0, timer: null, suprimirClick: false });
  const modoRef = useRef<Modo>('quieto');
  modoRef.current = modo;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIos(esIOS()); }, []);

  const fallaDeMic = (m: string) => {
    if (esMicBloqueado(m)) { setMicBloqueado(true); setError(null); }
    else setError(m);
    haptico('error');
  };

  // ── Tocar: dictar al campo ──
  const dictar = useDictar(texto, (v) => { setTexto(v); ajustarAlto(); }, fallaDeMic);

  // ── Mantener: la nota de voz ──
  const nota = useVoiceRecorder(async (blob, secs) => {
    setTranscribiendo(true);
    try {
      const r = await transcribirNota(blob);
      if (!r.ok) { fallaDeMic(r.error); return; }
      if (!r.texto.trim()) { setError('No se entendió el audio.'); return; }
      onEnviar({ texto: r.texto.trim(), adjuntos: [], voz: { url: URL.createObjectURL(blob), secs } });
    } finally { setTranscribiendo(false); }
  }, fallaDeMic);

  // El permiso ya negado se dice antes del primer toque (donde el navegador deja preguntar).
  useEffect(() => {
    let estado: PermissionStatus | null = null;
    const p = navigator.permissions?.query?.({ name: 'microphone' as PermissionName });
    p?.then((s) => {
      estado = s;
      setMicBloqueado(s.state === 'denied');
      s.onchange = () => setMicBloqueado(s.state === 'denied');
    }).catch(() => { /* Safari viejo: se sabe al tocar */ });
    return () => { if (estado) estado.onchange = null; };
  }, []);

  // Al llegar al tope, la nota se manda sola (como si soltara).
  useEffect(() => {
    if (modo !== 'quieto' && nota.secs >= TOPE_NOTA_S) { nota.stop(false); setModo('quieto'); }
  }, [modo, nota]);

  // El teclado de iOS no achica el layout: se corre el composer lo que mide.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !enfocado) { setTeclado(0); return; }
    const medir = () => setTeclado(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, [enfocado]);

  // El hilo deja lugar para el composer (y el teclado).
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const avisar = () => onAltura(el.offsetHeight + teclado);
    avisar();
    const ro = new ResizeObserver(avisar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onAltura, teclado]);

  function ajustarAlto() {
    const el = campo.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      // 5 líneas de 16 px × 1.4 + el padding: después scrollea adentro.
      el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    });
  }

  // ── Adjuntar ──
  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!lista.length) return;
    setError(null);
    setProcesando((p) => p + lista.length);
    const nuevos: AdjuntoM[] = [];
    try {
      for (const f of lista) {
        const esImagen = f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
        const esPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        if (!esImagen && !esPdf) { setError(ERROR_ADJUNTO.formato); continue; }
        try {
          const listo = esImagen ? await achicarImagen(f) : f;
          nuevos.push({ id: nuevoId(), file: listo, nombre: f.name || listo.name, tipo: esImagen ? 'image' : 'document', thumb: esImagen ? URL.createObjectURL(listo) : null });
        } catch { setError('No pude leer esa imagen.'); }
      }
    } finally { setProcesando((p) => Math.max(0, p - lista.length)); }
    if (!nuevos.length) return;
    setAdjuntos((actuales) => {
      const problema = problemaDeSeleccion([...actuales, ...nuevos].map((a) => a.file.size));
      if (problema) {
        setError(problema);
        nuevos.forEach((a) => a.thumb && URL.revokeObjectURL(a.thumb));
        return actuales;
      }
      return [...actuales, ...nuevos];
    });
  }

  const quitar = (id: string) => setAdjuntos((as) => {
    const a = as.find((x) => x.id === id);
    if (a?.thumb) URL.revokeObjectURL(a.thumb);
    return as.filter((x) => x.id !== id);
  });

  const elegir = (cual: 'camara' | 'fotos' | 'archivo') => {
    // El click al input va DENTRO del gesto: fuera de él el navegador no abre el selector.
    (cual === 'camara' ? inCamara : cual === 'fotos' ? inFotos : inArchivo).current?.click();
    setHojaAdjuntar(false);
  };

  // ── Enviar ──
  const hayAlgo = texto.trim().length > 0 || adjuntos.length > 0;
  const puedeEnviar = hayAlgo && enLinea && !ocupado && procesando === 0 && !dictar.escuchando && !dictar.subiendo;
  const enviar = () => {
    if (!puedeEnviar) return;
    onEnviar({ texto: texto.trim(), adjuntos });
    setTexto('');
    setAdjuntos([]);
    setError(null);
    ajustarAlto();
  };

  // ── El micrófono: tocar o mantener ──
  const micApagado = !enLinea || ocupado || transcribiendo || dictar.subiendo;
  const alBajar = (e: PE<HTMLButtonElement>) => {
    if (micApagado || dictar.escuchando) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesto.current.x0 = e.clientX;
    gesto.current.y0 = e.clientY;
    gesto.current.suprimirClick = false;
    gesto.current.timer = window.setTimeout(() => {
      gesto.current.timer = null;
      gesto.current.suprimirClick = true;
      setError(null);
      setArrastre({ dx: 0, dy: 0 });
      setModo('manteniendo');
      haptico('medium');
      void nota.start();
    }, ESPERA_MANTENER_MS);
  };
  const alMover = (e: PE<HTMLButtonElement>) => {
    if (modoRef.current !== 'manteniendo') return;
    const dx = e.clientX - gesto.current.x0;
    const dy = e.clientY - gesto.current.y0;
    setArrastre({ dx: Math.min(0, dx), dy: Math.min(0, dy) });
    const g = gestoDelMic(dx, dy);
    if (g === 'cancelar') { nota.stop(true); setModo('quieto'); haptico('light'); }
    else if (g === 'bloquear') { setModo('bloqueado'); haptico('light'); }
  };
  const alSoltar = () => {
    if (gesto.current.timer != null) { window.clearTimeout(gesto.current.timer); gesto.current.timer = null; return; } // fue un toque: lo resuelve onClick
    if (modoRef.current === 'manteniendo') { nota.stop(false); setModo('quieto'); }
  };
  const alCancelarPuntero = () => {
    if (gesto.current.timer != null) { window.clearTimeout(gesto.current.timer); gesto.current.timer = null; }
    if (modoRef.current === 'manteniendo') { nota.stop(true); setModo('quieto'); }
  };
  const alTocar = () => {
    // Después de mantener, el navegador igual dispara el click: ése no es un toque.
    if (gesto.current.suprimirClick) { gesto.current.suprimirClick = false; return; }
    if (micApagado && !dictar.escuchando) return;
    setError(null);
    if (!dictar.escuchando) haptico('medium');
    dictar.alternar();
  };

  const restante = restanteNota(nota.secs);
  const grabando = modo !== 'quieto';
  const verEnviar = hayAlgo && !dictar.escuchando && !grabando;

  return (
    <div
      ref={raiz}
      className="mm-composer"
      data-enfocado={enfocado || undefined}
      data-m-sin-barra={enfocado || grabando ? '' : undefined}
      style={teclado ? { transform: `translateY(${-teclado}px)` } : undefined}
    >
      {micBloqueado && (
        <p className="mm-composer__aviso" role="status">
          Micrófono bloqueado. {comoHabilitarMic(ios)}
        </p>
      )}
      {error && <p className="mm-composer__error" role="alert">{error}</p>}
      {!enLinea && <p className="mm-composer__aviso" role="status">Sin conexión: no se puede enviar.</p>}

      {(adjuntos.length > 0 || procesando > 0) && (
        <ul className="mm-adjuntos" aria-label="Archivos para enviar">
          {adjuntos.map((a) => (
            <li key={a.id} className="mm-adjunto">
              {a.thumb
                ? <img src={a.thumb} alt="" />
                : <span className="mm-adjunto__doc"><IconoM nombre="archivo" size={22} /><span>{a.nombre}</span></span>}
              <button type="button" className="mm-adjunto__quitar" aria-label={`Quitar ${a.nombre}`} onClick={() => quitar(a.id)}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
          {procesando > 0 && <li className="mm-adjunto mm-adjunto--cargando" aria-label="Preparando el archivo"><span className="mk-spin" /></li>}
        </ul>
      )}

      <div className="mm-composer__fila">
        {modo === 'bloqueado' ? (
          <>
            <button type="button" className="mm-circulo" aria-label="Descartar la nota de voz" onClick={() => { nota.stop(true); setModo('quieto'); }}>
              <Icon name="trash" size={22} />
            </button>
            <div className="mm-grabando" aria-live="polite">
              <span className="mm-grabando__punto" aria-hidden />
              <span className="mm-grabando__tiempo">{duracion(nota.secs)}</span>
              {restante != null && <span className="mm-grabando__resta">quedan {restante} s</span>}
            </div>
            <Button variant="primary" size="md" onClick={() => { nota.stop(false); setModo('quieto'); }}>Enviar audio</Button>
          </>
        ) : (
          <>
            {modo === 'manteniendo' ? (
              <div className="mm-grabando mm-grabando--mantener" aria-live="polite">
                <span className="mm-grabando__punto" aria-hidden />
                <span className="mm-grabando__tiempo">{duracion(nota.secs)}</span>
                {restante != null
                  ? <span className="mm-grabando__resta">quedan {restante} s</span>
                  : <span className="mm-grabando__cancelar" style={{ transform: `translateX(${Math.max(-60, arrastre.dx / 2)}px)` }}>‹ Desliza para cancelar</span>}
              </div>
            ) : (
              <>
                <button type="button" className="mm-circulo" aria-label="Adjuntar una foto o un archivo"
                  disabled={!enLinea || adjuntos.length >= 4} onClick={() => setHojaAdjuntar(true)}>
                  <IconoM nombre="mas" size={22} />
                </button>
                <textarea
                  ref={campo}
                  className="mm-campo"
                  rows={1}
                  aria-label="Mensaje para MaKo"
                  placeholder={transcribiendo ? 'Transcribiendo…' : dictar.escuchando ? 'Te escucho…' : 'Escribe a MaKo'}
                  value={texto}
                  enterKeyHint="send"
                  onChange={(e) => { setTexto(e.target.value); ajustarAlto(); }}
                  onFocus={() => setEnfocado(true)}
                  onBlur={() => {
                    // Tocar un botón del composer no cuenta como salir.
                    window.setTimeout(() => {
                      if (!raiz.current?.contains(document.activeElement)) setEnfocado(false);
                    }, 0);
                  }}
                />
              </>
            )}
            {verEnviar ? (
              <button type="button" className="mm-circulo mm-circulo--enviar" aria-label="Enviar a MaKo"
                disabled={!puedeEnviar}
                // Que el toque no le saque el foco al campo: el teclado queda abierto.
                onPointerDown={(e) => e.preventDefault()}
                onClick={enviar}>
                <IconoM nombre="enviar" size={22} />
              </button>
            ) : (
              <span className="mm-mic-caja">
                {modo === 'manteniendo' && (
                  <span className="mm-candado" style={{ transform: `translateY(${Math.max(-40, arrastre.dy / 2)}px)` }} aria-hidden>
                    <IconoM nombre="candado" size={20} />
                    <span className="mm-candado__flecha">⌃</span>
                  </span>
                )}
                <button
                  type="button"
                  className="mm-circulo mm-mic"
                  data-estado={modo === 'manteniendo' ? 'mantener' : dictar.escuchando ? 'escucha' : transcribiendo || dictar.subiendo ? 'trabaja' : undefined}
                  aria-label={dictar.escuchando ? 'Terminar de dictar' : 'Dictar; mantén para una nota de voz'}
                  aria-pressed={dictar.escuchando}
                  disabled={micApagado && !dictar.escuchando}
                  onPointerDown={alBajar}
                  onPointerMove={alMover}
                  onPointerUp={alSoltar}
                  onPointerCancel={alCancelarPuntero}
                  onClick={alTocar}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {transcribiendo || dictar.subiendo
                    ? <span className="mk-spin" aria-hidden />
                    : dictar.escuchando && !dictar.enVivo
                      ? <span className="mm-mic__segs">{duracion(dictar.segundos)}</span>
                      : <Icon name="mic" size={22} />}
                </button>
              </span>
            )}
          </>
        )}
      </div>

      <input ref={inCamara} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />
      <input ref={inFotos} type="file" accept={ACCEPT_FOTOS} multiple hidden onChange={alElegir} />
      <input ref={inArchivo} type="file" accept={ACCEPT_ADJUNTOS_CHAT} multiple hidden onChange={alElegir} />

      <SheetM abierto={hojaAdjuntar} onCerrar={() => setHojaAdjuntar(false)} titulo="Adjuntar" id="adjuntar" snap="medio">
        <div className="mm-opciones">
          <button type="button" className="mm-opcion" onClick={() => elegir('camara')}><IconoM nombre="camara" /> Cámara</button>
          <button type="button" className="mm-opcion" onClick={() => elegir('fotos')}><IconoM nombre="foto" /> Fotos</button>
          <button type="button" className="mm-opcion" onClick={() => elegir('archivo')}><IconoM nombre="archivo" /> Archivo</button>
        </div>
      </SheetM>
    </div>
  );
}
