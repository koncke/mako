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
//
// Adjuntar, como WhatsApp del celular (pedido de Martín, 11/10/2026: «la vista previa del
// documento… como lo tiene WhatsApp… en todos los chats que suben documentos»): la hoja de
// adjuntar (cámara, fotos, archivo) sólo JUNTA. Con algo juntado, la pantalla pasa a la vista
// previa a pantalla completa (VistaAdjuntosM, que monta la MISMA VistaAdjuntos de los otros
// chats): se suman o se quitan archivos y se escribe el mensaje, que es el MISMO texto del
// composer. Enviar manda lo de siempre (`onEnviar({ texto, adjuntos })`): todo junto, por
// multipart, lo sube ChatMako. La ✕ (o «atrás») descarta los archivos; el texto queda.
//   ⚠️ ELEGIR NO SUBE NADA: `sumar` sólo achica las fotos en el teléfono (canvas, antes de
//      subir: Vercel corta a los ~4,5 MB) y las junta.
//   ⚠️ TODO lo que entra pasa por `sumar` —las tres entradas de la hoja y el «+» de la vista—,
//      así los 4 archivos, los 4 MB en total y «solo fotos o PDF» valen igual por los dos
//      caminos. El formato lo mira `tipoDeElegido` (tipo O extensión), no el `accept`.
// =============================================================================

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as PE } from 'react';
import { Icon } from '@/app/_components/icons';
import { Button } from '@/app/_ui/Button';
import { useDictar, transcribirNota } from '@/app/_components/useDictar';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import { useListaAdjuntos } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO, TOPE_ADJUNTOS } from '@/lib/mako-adjuntos';
import { haptico } from '@/lib/haptico';
import { esIOS } from '@/lib/movil-instalar';
import { FilaM, ListaM, SheetM } from '../_ui';
import { IconoChat, type NombreIconoChat } from './iconos';
import { achicarImagen } from './subir';
import { VistaAdjuntosM } from './VistaAdjuntosM';
import {
  ESPERA_MANTENER_MS, TOPE_NOTA_S, altoTeclado, avisoDeVista, comoHabilitarMic, duracion, envioDe,
  esMicBloqueado, gestoDelMic, problemaDeSeleccion, restanteNota, tipoDeElegido, type AdjuntoM,
} from './chat-ui';

export type { AdjuntoM } from './chat-ui';
export type Envio = { texto: string; adjuntos: AdjuntoM[]; voz?: { url: string; secs: number } };

type Modo = 'quieto' | 'manteniendo' | 'bloqueado';

const ACCEPT_FOTOS = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
/** El tope de la lista: los archivos del route. Los bytes (4 MB en total) y el formato los mira `sumar`. */
const TOPES_LISTA = { maxArchivos: TOPE_ADJUNTOS };
const SIN_CONEXION = 'Sin conexión: no se puede enviar.';

const OPCIONES_ADJUNTAR: ReadonlyArray<{ id: 'camara' | 'fotos' | 'archivo'; label: string; icono: NombreIconoChat }> = [
  { id: 'camara', label: 'Cámara', icono: 'camara' },
  { id: 'fotos', label: 'Fotos', icono: 'foto' },
  { id: 'archivo', label: 'Archivo', icono: 'archivo' },
];

export function Composer({ enLinea, ocupado, onEnviar, onAltura }: {
  enLinea: boolean;
  /** MaKo está trabajando: se puede escribir el próximo, no mandarlo */
  ocupado: boolean;
  onEnviar: (e: Envio) => void;
  onAltura: (px: number) => void;
}) {
  const [texto, setTexto] = useState('');
  const lista = useListaAdjuntos(TOPES_LISTA);
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
    const medir = () => setTeclado(altoTeclado(window.innerHeight, vv));
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

  // ── Adjuntar: elegir JUNTA (no sube nada) ──
  /**
   * La única puerta de entrada de un archivo: las tres de la hoja y el «+» de la vista previa.
   * Achica las fotos acá, en el teléfono, y las suma a la lista. Lo que no entra se dice; el lote
   * que pasaría los 4 archivos o los 4 MB en total no entra entero (como antes de la vista).
   */
  async function sumar(archivos: File[]) {
    if (!archivos.length) return;
    setError(null);
    setProcesando((p) => p + archivos.length);
    const nuevos: File[] = [];
    const motivos: string[] = [];
    try {
      for (const f of archivos) {
        const tipo = tipoDeElegido(f);
        if (!tipo) { motivos.push(ERROR_ADJUNTO.formato); continue; }
        try { nuevos.push(tipo === 'image' ? await achicarImagen(f) : f); }
        catch { motivos.push('No pude leer esa imagen.'); }
      }
    } finally { setProcesando((p) => Math.max(0, p - archivos.length)); }
    if (nuevos.length) {
      // Contra lo que hay AHORA (`ref`): mientras se achicaba, la persona pudo quitar o sumar otro.
      const tope = problemaDeSeleccion([...lista.ref.current.map((a) => a.file.size), ...nuevos.map((f) => f.size)]);
      if (tope) motivos.push(tope);
      else motivos.push(...lista.agregar(nuevos));
    }
    setError(motivos.length ? [...new Set(motivos)].join(' ') : null);
  }

  function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    e.target.value = '';
    void sumar(elegidos);
  }

  const quitar = (id: string) => {
    lista.quitar(id);
    if (!lista.ref.current.length) setError(null);
  };
  /** La ✕ de la vista (o «atrás»): descarta los archivos. El texto queda: es el borrador del chat. */
  const cerrarVista = () => {
    lista.vaciar();
    setError(null);
    ajustarAlto(); // lo que se escribió en la vista vuelve al campo, con su alto
  };

  const abrirHoja = () => {
    // Un dictado en curso no sigue escribiendo detrás de la vista previa.
    if (dictar.escuchando) dictar.alternar();
    // La hoja se lleva el foco: el composer deja de estar «enfocado» (y de seguir al teclado).
    setEnfocado(false);
    setHojaAdjuntar(true);
  };
  const elegir = (cual: 'camara' | 'fotos' | 'archivo') => {
    // El click al input va DENTRO del gesto: fuera de él el navegador no abre el selector.
    (cual === 'camara' ? inCamara : cual === 'fotos' ? inFotos : inArchivo).current?.click();
    setHojaAdjuntar(false);
  };

  // ── Enviar (el composer o la vista previa: lo mismo) ──
  const hayVista = lista.items.length > 0;
  const listo = enLinea && !ocupado && procesando === 0 && !transcribiendo && !dictar.escuchando && !dictar.subiendo;
  const hayAlgo = texto.trim().length > 0 || hayVista;
  const puedeEnviar = hayAlgo && listo;
  const enviar = () => {
    if (!puedeEnviar) return;
    // La lista de AHORA (la ref), no la del render: el «+» pudo sumar uno recién.
    onEnviar(envioDe(texto, lista.ref.current));
    setTexto('');
    lista.vaciar();
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
      className="m-mako-composer"
      data-enfocado={enfocado || undefined}
      data-teclado={teclado ? '' : undefined}
      data-m-sin-barra={enfocado || grabando ? '' : undefined}
      style={teclado ? { transform: `translateY(${-teclado}px)` } : undefined}
    >
      {micBloqueado && (
        <p className="m-mako-composer__aviso" role="status">
          Micrófono bloqueado. {comoHabilitarMic(ios)}
        </p>
      )}
      {error && !hayVista && <p className="m-mako-composer__error" role="alert">{error}</p>}
      {!enLinea && <p className="m-mako-composer__aviso" role="status">{SIN_CONEXION}</p>}

      {/* El primer archivo, mientras se achica: después lo muestra la vista previa. */}
      {procesando > 0 && !hayVista && (
        <ul className="m-mako-adjuntos-lista" aria-label="Archivos para enviar">
          <li className="m-mako-adjunto" aria-label="Preparando el archivo"><span className="mk-spin" /></li>
        </ul>
      )}

      <div className="m-mako-composer__fila">
        {modo === 'bloqueado' ? (
          <>
            <button type="button" className="m-mako-circulo" aria-label="Descartar la nota de voz" onClick={() => { nota.stop(true); setModo('quieto'); }}>
              <Icon name="trash" size={22} />
            </button>
            <div className="m-mako-grabando" aria-live="polite">
              <span className="m-mako-grabando__punto" aria-hidden />
              <span className="m-mako-grabando__tiempo">{duracion(nota.secs)}</span>
              {restante != null && <span className="m-mako-grabando__resta">quedan {restante} s</span>}
            </div>
            <Button variant="primary" size="md" onClick={() => { nota.stop(false); setModo('quieto'); }}>Enviar audio</Button>
          </>
        ) : (
          <>
            {modo === 'manteniendo' ? (
              <div className="m-mako-grabando" aria-live="polite">
                <span className="m-mako-grabando__punto" aria-hidden />
                <span className="m-mako-grabando__tiempo">{duracion(nota.secs)}</span>
                {restante != null
                  ? <span className="m-mako-grabando__resta">quedan {restante} s</span>
                  : <span className="m-mako-grabando__cancelar" style={{ transform: `translateX(${Math.max(-60, arrastre.dx / 2)}px)` }}>‹ Desliza para cancelar</span>}
              </div>
            ) : (
              <>
                <button type="button" className="m-mako-circulo" aria-label="Adjuntar una foto o un archivo"
                  disabled={!enLinea || lista.items.length >= TOPE_ADJUNTOS} onClick={abrirHoja}>
                  <IconoChat nombre="mas" size={22} />
                </button>
                <textarea
                  ref={campo}
                  className="m-mako-campo"
                  rows={1}
                  aria-label="Mensaje para MaKo"
                  placeholder={transcribiendo ? 'Transcribiendo…' : dictar.escuchando ? 'Te escucho…' : 'Escríbele a MaKo'}
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
              <button type="button" className="m-mako-circulo m-mako-circulo--enviar" aria-label="Enviar a MaKo"
                disabled={!puedeEnviar}
                // Que el toque no le saque el foco al campo: el teclado queda abierto.
                onPointerDown={(e) => e.preventDefault()}
                onClick={enviar}>
                <IconoChat nombre="enviar" size={22} />
              </button>
            ) : (
              <span className="m-mako-mic-caja">
                {modo === 'manteniendo' && (
                  <span className="m-mako-candado" style={{ transform: `translateY(${Math.max(-40, arrastre.dy / 2)}px)` }} aria-hidden>
                    <IconoChat nombre="candado" size={20} />
                    <span className="m-mako-candado__flecha">⌃</span>
                  </span>
                )}
                <button
                  type="button"
                  className="m-mako-circulo m-mako-mic"
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
                      ? <span className="m-mako-mic__segs">{duracion(dictar.segundos)}</span>
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
        <ListaM>
          {OPCIONES_ADJUNTAR.map((o) => (
            <FilaM key={o.id} navegacion chevron={false} titulo={o.label}
              leading={<span className="m-mako-opcion-ico"><IconoChat nombre={o.icono} size={18} /></span>}
              onClick={() => elegir(o.id)} />
          ))}
        </ListaM>
      </SheetM>

      {/* La vista previa, a pantalla completa, mientras haya algo juntado (por portal a #m-capas). */}
      {hayVista && (
        <VistaAdjuntosM
          items={lista.items}
          onAgregar={(fs) => void sumar(fs)}
          onQuitar={quitar}
          onCerrar={cerrarVista}
          texto={texto}
          onTexto={(v) => { setTexto(v); ajustarAlto(); }}
          onEnviar={enviar}
          accept={ACCEPT_ADJUNTOS_CHAT}
          maxArchivos={TOPE_ADJUNTOS}
          puedeEnviar={listo}
          estado={avisoDeVista({ preparando: procesando > 0, transcribiendo: transcribiendo || dictar.subiendo, ocupado })}
          error={error ?? (enLinea ? null : SIN_CONEXION)}
          acento="var(--primary)"
          placeholder="Escríbele a MaKo"
        />
      )}
    </div>
  );
}
