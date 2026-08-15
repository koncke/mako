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
import { borrarVideoAction, guardarVideoAction } from './landing-actions';

const MONO = "'Geist Mono', monospace";
/** Valor centinela de la última opción del desplegable. */
const OTRO = '__otro__';

export type VideoDetectado = { id: string; titulo: string | null; eventos: number; url: string | null };

export function NombrarVideos({
  detectados, videos, onCambio,
}: {
  detectados: VideoDetectado[];
  videos: VideoLanding[];
  onCambio: (v: VideoLanding[]) => void;
}) {
  const [escribiendo, setEscribiendo] = useState<string | null>(null); // el id que está en «Otro tipo…»
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Todo lo que el sistema vio, más lo que se nombró alguna vez aunque hoy no
  // esté mandando eventos: un video que se pausó por un mes no tiene por qué
  // perder su nombre.
  const filas: VideoDetectado[] = [
    ...detectados,
    ...videos.filter((v) => !detectados.some((d) => d.id === v.id)).map((v) => ({ id: v.id, titulo: null, eventos: 0, url: null })),
  ];
  if (!filas.length) return null;

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
            <div key={d.id} style={{ borderTop: '1px solid var(--border)', padding: '11px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  {/* El id crudo, en monoespaciada y cortado: es la única forma de
                      distinguir dos videos que todavía no tienen nombre. */}
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.id}</span>
                  {r.esVsl && <span style={{ flex: 'none', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: 'var(--mako-ink)', fontWeight: 700 }}>VSL</span>}
                </span>
                <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                    {d.eventos > 0 ? `${d.eventos} ${d.eventos === 1 ? 'evento' : 'eventos'}` : 'sin actividad reciente'}
                  </span>
                  {/* ⚠️ VER EL VIDEO es lo que vuelve contestable la pregunta. Un id
                      como «v:que-se-vive.mp4» alcanza para atribuir eventos y no
                      para RECONOCERLO: con dos videos en la página había que
                      adivinar cuál se estaba nombrando. Solo aparece si sabemos
                      dónde está — un botón que no puede abrir nada es peor que
                      ninguno. */}
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" title="Ver este video"
                      style={{ flex: 'none', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)' }}>
                      <Icon name="video" size={14} />
                    </a>
                  ) : (
                    // ⚠️ LA AUSENCIA SE EXPLICA. Esconder el botón cuando no sabemos
                    // dónde está el video es correcto —uno que no puede abrir nada
                    // promete y falla— pero esconderlo EN SILENCIO deja a la persona
                    // buscando un botón que le dijimos que existía. Y la razón es
                    // accionable: la URL viaja desde la v8, así que un video con
                    // eventos y sin URL es uno cuyo código todavía es anterior.
                    <span title="La dirección del video llega con la versión nueva del Pixel" style={{ flex: 'none', fontSize: 11, color: 'var(--faint)', fontStyle: 'italic' }}>
                      {d.eventos > 0 ? 'para verlo, actualiza el Pixel' : ''}
                    </span>
                  )}
                </span>
              </div>

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
                      ariaLabel={`Qué es el video ${d.id}`}
                      value={guardado?.nombre ?? ''}
                      onChange={(v) => {
                        if (v === OTRO) { setEscribiendo(d.id); setTexto(guardado?.nombre ?? ''); return; }
                        void guardar(d.id, v);
                      }}
                      placeholder={r.propio ? r.texto : `Sin identificar${d.titulo ? ` — el reproductor dice «${d.titulo}»` : ''}`}
                      options={[
                        ...TIPOS_VIDEO.map((t) => ({ value: t, label: t, ...(esTipoVsl(t) ? { sub: 'tu video de ventas: solo puede haber uno' } : {}) })),
                        ...propios.map((n) => ({ value: n, label: n, sub: 'ya lo usaste antes' })),
                        { value: OTRO, label: 'Otro tipo de video…', sub: 'escribe el nombre' },
                      ]}
                    />
                  )}
                </div>
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
              </div>
            </div>
          );
        })}
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
