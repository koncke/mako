'use client';

// =============================================================================
// NombrarVideosModal — ponerle nombre a un video SIN salir de la ficha
// =============================================================================
// Antes esto era un link a `/integraciones?abrir=landing`: para contestar «¿de
// qué video es este 73%?» había que abandonar la ficha del lead, buscar la
// tarjeta de la landing entre veintipico y volver. Se reportó así: «sería bueno
// que si le doy se abra un pop-up allí mismo para asignarle nombre, no que una
// redirección a otro lado».
//
// ⚠️ NO ESCRIBE NADA PROPIO: llama a `guardarVideoAction`, la MISMA escritura de
// /integraciones. Una segunda escritura del catálogo `landing.videos` sería un
// segundo lugar donde vive la regla de «un solo VSL» y el saneo del id, y el que
// se arregle no va a ser el otro.
//
// ⚠️ Y LAS LLAMADAS VAN DE A UNA. `guardarVideoAction` hace leer → fusionar →
// escribir sobre el MISMO setting, así que dos en paralelo pierden una de las dos
// sin dar error. Por eso se guarda al elegir, una fila a la vez, y no hay un botón
// «Guardar todo» que las dispare juntas.
//
// ⚠️ Y SU GATE ES EL DE /integraciones (`requireRolWs([], { nav: 'integraciones' })`),
// que REDIRIGE a quien no le toca en vez de contestar un error. Para un closer o un
// setter, guardar acá lo saca de la ficha — exactamente lo mismo que le pasaba con el
// link que esto reemplaza, así que no empeora; lo que falta para cerrarlo es un
// chequeo sin redirect que decida si el botón se dibuja. Queda anotado y sin hacer.

import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Modal, Select } from '@/app/_ui';
import { TIPOS_VIDEO, esTipoVsl, rotuloDe, type VideoLanding } from '@/lib/landing-videos';
import { guardarVideoAction } from '@/app/integraciones/landing-actions';
import type { VideoEngagement } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
/** Valor centinela de la última opción del desplegable (igual que /integraciones). */
const OTRO = '__otro__';

const fila: CSSProperties = { borderTop: '1px solid var(--border)', padding: '11px 0' };

export function NombrarVideosModal({
  porVideo, videos, onCerrar, onGuardado,
}: {
  /** Los videos que ESTE lead reprodujo. Es el universo de la pregunta: nombrar
   *  acá los que no vio nadie es trabajo de la pantalla de /integraciones. */
  porVideo: VideoEngagement[];
  videos: VideoLanding[];
  onCerrar: () => void;
  /** El catálogo ya guardado, para que el nombre aparezca sin recargar. */
  onGuardado: (videos: VideoLanding[]) => void;
}) {
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sin id no hay contra qué guardar un nombre: son los eventos viejos que no se
  // pudieron atribuir. Se dejan afuera en vez de dibujar una fila que no guarda.
  const filas = porVideo.filter((v) => !!v.videoId);

  // Los nombres propios que ya usó este negocio se ofrecen igual que los de
  // fábrica, como en /integraciones: el segundo testimonio se elige en un click.
  const propios = [...new Set(videos.map((v) => v.nombre))].filter((n) => !TIPOS_VIDEO.some((t) => t === n));

  const guardar = async (id: string, nombre: string) => {
    setOcupado(id); setErr(null);
    // `esVsl` SIEMPRE explícito, true o false: acá se está contestando esa misma
    // pregunta, así que omitirlo dejaría marcado al video anterior.
    const r = await guardarVideoAction({ id, nombre, esVsl: esTipoVsl(nombre) });
    setOcupado(null);
    if (!r.ok) { setErr(r.error); return; }
    onGuardado(r.videos);
    setEscribiendo(null); setTexto('');
  };

  // El portal necesita el DOM. Esto sólo se monta después de un click, así que en
  // el server no corre nunca; la guarda es para que no pueda empezar a correr.
  if (typeof document === 'undefined') return null;

  return createPortal(
    // ⚠️ `anidada`: se abre DESDE un control de la ficha del lead y es parte de la
    // misma tarea, así que lo de atrás NO se apaga. Y registrarse en la pila es lo
    // que hace que el Escape de la ficha se abstenga (`profundidadModales() > 0`):
    // sin eso, cerrar este pop-up cerraría también la ficha del lead.
    <Modal titulo="Nombra tus videos" ancho={440} anidada sinFiletes onCerrar={onCerrar}
      pie={<Button variant="primary" onClick={onCerrar}>Listo</Button>}>
      <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 4px', lineHeight: 1.5 }}>
        Un nombre por video, para saber de cuál es cada retención.
      </p>
      {filas.map((v) => {
        const id = v.videoId as string;
        const guardado = videos.find((g) => g.id === id);
        const r = rotuloDe(videos, id, v.titulo);
        const editando = escribiendo === id;
        return (
          <div key={id} style={fila}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
              {/* El título del player, no el id: un uuid de 36 caracteres no
                  contesta «¿cuál de todos es este?». El id queda en el `title`. */}
              <span title={id} style={v.titulo
                ? { minWidth: 0, fontSize: 13, fontWeight: 550, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                : { minWidth: 0, fontFamily: MONO, fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.titulo ?? id}
              </span>
              <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                {v.maxPct != null ? `${v.maxPct}%` : '—'}
              </span>
            </div>
            {editando ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Ej.: Testimonio corto"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && texto.trim()) void guardar(id, texto); }}
                  />
                </div>
                <Button variant="secondary" disabled={!texto.trim() || ocupado === id} onClick={() => void guardar(id, texto)}>
                  Guardar
                </Button>
              </div>
            ) : (
              // El `Select` de la casa: se dibuja en portal, así que el scroll del
              // modal no lo recorta, y corta el Escape antes que nadie.
              <Select
                ariaLabel={`Qué es el video ${v.titulo ?? id}`}
                value={guardado?.nombre ?? ''}
                disabled={ocupado === id}
                onChange={(valor) => {
                  if (valor === OTRO) { setEscribiendo(id); setTexto(guardado?.nombre ?? ''); return; }
                  void guardar(id, valor);
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
        );
      })}
      {!filas.length && (
        <p style={{ fontSize: 13, color: 'var(--faint)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Los eventos de este lead no dicen de qué video son. Sus nombres se ponen en la configuración de la landing.
        </p>
      )}
      {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </Modal>,
    document.body,
  );
}
