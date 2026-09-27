'use client';

// =============================================================================
// NombrarVideos — qué es cada video de la landing
// =============================================================================
// El sistema DETECTA los videos: cada evento del snippet trae su `video_id`. Lo
// que no puede saber es cuál es el VSL y cuál el testimonio — eso solo lo sabe
// quien armó la página. Así que no se le pide que descubra nada: se le pide que
// NOMBRE lo que ya está a la vista.
//
// UNA sola pregunta por fila, no dos. La alternativa era un desplegable para el
// nombre y aparte un control «marcar como VSL»; el segundo se queda sin
// contestar porque no se entiende qué agrega. Acá el nombre ES la respuesta:
// quien elige «VSL» ya dijo cuál es, y la fila lo muestra al instante.

import { useState } from 'react';
import { Input, Select } from '@/app/_ui';
import { IconBtn } from './ServicioConfigForm';
import { Icon } from '@/app/_components/icons';
import { TIPOS_VIDEO, esTipoVsl, rotuloDe, type VideoLanding } from '@/lib/landing-videos';
import { borrarVideoAction, guardarVideoAction, ocultarVideoAction } from './landing-actions';

const MONO = "'Geist Mono', monospace";
/** Valor centinela de la última opción del desplegable. */
const OTRO = '__otro__';

export type VideoDetectado = {
  id: string;
  /** El titulo REAL, de Panda. El del iframe es de la pagina, no del video. */
  titulo: string | null;
  eventos: number;
  /** El video en si. */
  url: string | null;
  /** Donde vive, si no sabemos su URL directa. Plan B para poder mirarlo. */
  pagina: string | null;
  /**
   * Tiene nombre y su id no aparece en NINGÚN evento ni en la página: apunta a
   * un video que no existe. Ver el porqué donde se arma `filas`.
   */
  huerfano?: boolean;
};

export function NombrarVideos({
  detectados, videos, onCambio, enLaPagina = [], ocultos = [], onOcultos,
}: {
  detectados: VideoDetectado[];
  videos: VideoLanding[];
  onCambio: (v: VideoLanding[]) => void;
  /** Los que el negocio marcó como «no son de mi página». */
  ocultos?: string[];
  onOcultos?: (ids: string[]) => void;
  /** Lo que el analizador encontró EN la página. Es lo que hace que un video se
   *  pueda ver sin que nadie lo haya reproducido, venga de donde venga. */
  enLaPagina?: Array<{ id: string; url: string }>;
}) {
  const [escribiendo, setEscribiendo] = useState<string | null>(null); // el id que está en «Otro tipo…»
  const [verOcultos, setVerOcultos] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Todo lo que el sistema vio, más lo que se nombró alguna vez aunque hoy no
  // esté mandando eventos: un video que se pausó por un mes no tiene por qué
  // perder su nombre.
  // ⚠️ LA URL SALE DE LA PÁGINA CUANDO EL EVENTO NO LA TRAE. Panda la da por API,
  // pero un <video> puesto a mano, un YouTube o un Vimeo no tienen API — y no la
  // necesitan: están escritos en el HTML. Sin esto, ver un video seguía dependiendo
  // de que alguien lo reprodujera, que es exactamente lo que se vino a eliminar.
  const urlDe = (d: VideoDetectado) => d.url ?? enLaPagina.find((v) => v.id === d.id)?.url ?? null;

  const filas: VideoDetectado[] = [
    ...detectados,
    // ⚠️ UN NOMBRE PUEDE APUNTAR A UN ID QUE NO EXISTE, y eso no se ve. El id del
    // video es una CLAVE: se escribe exacto o no cruza con nada. Medido en la
    // landing de un cliente el 27/09/2026 — el VSL estaba nombrado como
    // «wistia:<id>» y los eventos llegaban como «w:<id>»: 3.927 eventos medidos y
    // el video marcado como EL VSL con cero. Las pantallas que hablan de «el VSL»
    // mostraban la curva vacía, y se reportó como que la retención no se medía.
    //
    // El renglón decía «sin actividad reciente», que para este caso afirma de más:
    // suena a que el video está tranquilo cuando lo que pasa es que ese id no es de
    // ningún video. Son dos estados distintos y necesitan dos frases.
    ...videos.filter((v) => !detectados.some((d) => d.id === v.id)).map((v) => ({
      id: v.id, titulo: null, eventos: 0, url: null, pagina: null,
      huerfano: !enLaPagina.some((e) => e.id === v.id),
    })),
    // Y los que la página TIENE pero todavía no mandaron un solo evento: son los
    // que más falta hace poder mirar, porque son los que nadie reprodujo nunca.
    ...enLaPagina
      .filter((v) => !detectados.some((d) => d.id === v.id) && !videos.some((g) => g.id === v.id))
      .map((v) => ({ id: v.id, titulo: null, eventos: 0, url: v.url, pagina: null })),
  ].filter((f) => verOcultos || !ocultos.includes(f.id));

  // ⚠️ Los ocultos NO desaparecen sin dejar rastro: se dice cuántos son y se puede
  // volver a verlos. Esconder algo sin decir que está escondido es la forma de que
  // alguien busque durante media hora un video que sí está midiendo.
  const nOcultos = [...detectados, ...videos].filter((v) => ocultos.includes(v.id)).length;

  if (!filas.length && !nOcultos) return null;

  // Los nombres propios que ya usó este negocio se ofrecen igual que los de
  // fábrica: si llamó a uno «Testimonio de Ana», el segundo testimonio se elige
  // en un click en vez de volver a escribirlo.
  const propios = [...new Set(videos.map((v) => v.nombre))].filter((n) => !TIPOS_VIDEO.some((t) => t === n));

  const guardar = async (id: string, nombre: string) => {
    setOcupado(id); setErr(null);
    // ⚠️ `esVsl` va SIEMPRE explícito, true o false — nunca undefined. Acá se está
    // contestando justamente esa pregunta, así que omitirla dejaría al video
    // anterior marcado y el cambio de nombre no se reflejaría en quién es el VSL.
    const r = await guardarVideoAction({ id, nombre, esVsl: esTipoVsl(nombre) });
    setOcupado(null);
    if (!r.ok) { setErr(r.error); return; }
    onCambio(r.videos);
    setEscribiendo(null);
    setTexto('');
  };

  const ocultar = async (id: string, ocultarlo: boolean) => {
    setOcupado(id); setErr(null);
    const r = await ocultarVideoAction(id, ocultarlo);
    setOcupado(null);
    if (!r.ok) { setErr(r.error); return; }
    onOcultos?.(r.ocultos);
  };

  const borrar = async (id: string) => {
    setOcupado(id); setErr(null);
    const r = await borrarVideoAction(id);
    setOcupado(null);
    if (!r.ok) { setErr(r.error); return; }
    onCambio(r.videos);
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Identifica tus videos</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
        Medimos cada video de tu página por separado. Ponles un nombre para saber a cuál corresponde
        cada retención en la ficha del lead. El que marques como <b>VSL</b> es el que se usa en el
        resto de la app.
      </div>

      <div style={{ marginTop: 12 }}>
        {filas.map((d) => {
          const guardado = videos.find((v) => v.id === d.id);
          const r = rotuloDe(videos, d.id, d.titulo);
          const editando = escribiendo === d.id;
          return (
            <div key={d.id} className="mk-fila-video" style={{ borderTop: '1px solid var(--border)', padding: '11px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  {/* ⚠️ EL TÍTULO, NO EL ID. Un id como
                      «1b9db76c-6bbb-4837-8274-96896c3d8b47» no le dice nada a
                      nadie, y era lo único que se mostraba: para contestar «¿qué
                      es este video?» había que adivinar. El título sale de Panda,
                      que lo tiene desde que el video se subió. El id queda en el
                      `title` del elemento, para cuando de verdad haga falta. */}
                  <span title={d.id} style={d.titulo
                    ? { fontSize: 13, color: 'var(--ink)', fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    : { fontFamily: MONO, fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.titulo ?? d.id}
                  </span>
                  {r.esVsl && <span style={{ flex: 'none', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: 'var(--mako-ink)', fontWeight: 700 }}>VSL</span>}
                </span>
                <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--faint)' }}>
                  {d.eventos > 0 ? `${d.eventos} ${d.eventos === 1 ? 'evento' : 'eventos'}` : d.huerfano ? 'ningún evento con ese id' : 'sin actividad reciente'}
                </span>
              </div>

              {/* ⚠️ TODO EN UNA FILA Y DEL MISMO ALTO. «Ver el video» vivía arriba,
                  suelto al lado del conteo de eventos, y los de editar y borrar
                  abajo: tres acciones sobre la misma cosa repartidas en dos
                  renglones y con dos tamaños distintos. El alto lo iguala
                  `.mk-fila-video .mk-icon-btn` en globals.css — no va inline,
                  porque un inline le gana al CSS y deja la barra sin poder
                  repintarse. */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editando ? (
                    <Input
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Ej.: Testimonio de Ana"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter' && texto.trim()) void guardar(d.id, texto); }}
                    />
                  ) : (
                    // El `Select` de la casa: el <select> nativo está prohibido y
                    // además este se renderiza en portal, así que el scroll del
                    // modal no lo recorta.
                    <Select
                      ariaLabel={`Qué es el video ${d.titulo ?? d.id}`}
                      value={guardado?.nombre ?? ''}
                      onChange={(v) => {
                        if (v === OTRO) { setEscribiendo(d.id); setTexto(guardado?.nombre ?? ''); return; }
                        void guardar(d.id, v);
                      }}
                      placeholder={r.propio ? r.texto : 'Sin identificar'}
                      options={[
                        ...TIPOS_VIDEO.map((t) => ({ value: t, label: t, ...(esTipoVsl(t) ? { sub: 'tu video de ventas: solo puede haber uno' } : {}) })),
                        ...propios.map((n) => ({ value: n, label: n, sub: 'ya lo usaste antes' })),
                        { value: OTRO, label: 'Otro tipo de video…', sub: 'escribe el nombre' },
                      ]}
                    />
                  )}
                </div>

                {/* VER va PRIMERO: es lo que permite contestar la pregunta que la
                    fila hace. Editar y borrar actúan sobre la respuesta, así que
                    van después.

                    ⚠️ Ya no depende de que alguien haya reproducido el video. La
                    URL sale del catálogo de Panda, que la tiene desde que el video
                    se subió. Si el video no está en Panda —un <video> nativo— el
                    plan B es abrir la PÁGINA donde se vio: no es lo mismo, pero
                    también contesta «¿cuál de todos es este?». */}
                {urlDe(d) ? (
                  <a className="mk-icon-btn" data-tone="dim" href={urlDe(d)!} target="_blank" rel="noopener noreferrer" title="Ver este video">
                    <Icon name="video" size={15} />
                  </a>
                ) : d.pagina ? (
                  <a className="mk-icon-btn" data-tone="dim" href={d.pagina} target="_blank" rel="noopener noreferrer" title="Abrir la página donde está este video">
                    <Icon name="video" size={15} />
                  </a>
                ) : (
                  // ⚠️ Y CUANDO NO HAY NINGUNO DE LOS DOS, se dice por qué. Es un
                  // video que no está en Panda —un <video> puesto a mano en la
                  // página— del que solo tenemos eventos viejos, anteriores a la
                  // versión del Pixel que manda la dirección de la página. En
                  // cuanto entre una visita nueva aparece el botón solo.
                  <span title="Este video no está en Panda y sus eventos son anteriores a la versión actual del Pixel"
                    style={{ flex: 'none', width: 'var(--touch)', height: 'var(--touch)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'var(--border-strong)' }}>
                    –
                  </span>
                )}

                {editando ? (
                  <IconBtn name="check" title="Guardar el nombre" tone="good" disabled={!texto.trim() || ocupado === d.id} onClick={() => void guardar(d.id, texto)} />
                ) : guardado ? (
                  <>
                    <IconBtn name="pen" title="Escribir otro nombre" onClick={() => { setEscribiendo(d.id); setTexto(guardado.nombre); }} />
                    {/* Olvidar el nombre NO borra la medición: los eventos son un
                        hecho y siguen ahí. Lo único que se pierde es el rótulo. */}
                    <IconBtn name="trash" title="Quitar el nombre (no borra la medición)" tone="bad" disabled={ocupado === d.id} onClick={() => void borrar(d.id)} />
                  </>
                ) : null}

                {/* ⚠️ «ESTE NO ES MÍO». Un video puede aparecer acá sin que nadie
                    lo haya puesto en la página: pasó con un «redirect al terminar»
                    configurado en el reproductor, que mandaba solo al espectador a
                    un video viejo de otra persona. Se quitó el redirect, pero los
                    eventos que dejó son un HECHO —ese video SÍ se reprodujo ahí— y
                    por eso el sistema lo sigue listando, con razón. Lo que faltaba
                    era poder decirle que no lo liste más.
                    Esconder NO borra: la medición queda intacta. */}
                {ocultos.includes(d.id) ? (
                  <IconBtn name="check" title="Volver a mostrarlo en esta lista" tone="good" disabled={ocupado === d.id} onClick={() => void ocultar(d.id, false)} />
                ) : (
                  <IconBtn name="eye-off" title="Este video no es de mi página (no borra la medición)" disabled={ocupado === d.id} onClick={() => void ocultar(d.id, true)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {nOcultos > 0 && (
        <button type="button" onClick={() => setVerOcultos((v) => !v)}
          style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--dim)', fontWeight: 600 }}>
          {verOcultos
            ? 'Ocultar los que marcaste como ajenos'
            : `${nOcultos} ${nOcultos === 1 ? 'video marcado como ajeno' : 'videos marcados como ajenos'} · Ver`}
        </button>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
