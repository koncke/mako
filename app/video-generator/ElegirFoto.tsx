'use client';

// =============================================================================
// Elegir con qué foto se genera — y subir una nueva, con progreso de verdad
// =============================================================================
// Martín: «cuando esté eligiendo la foto, no deben aparecer el resto abajo, sino
// que al pasar el cursor por la gran foto, y hacerle click, me permita
// seleccionar las otras. Y cuando suba una, que tenga el loader de subiendo».
//
// ⚠️ POR QUÉ LA TIRA DE ABAJO ESTABA MAL, más allá del gusto: ponía ocho caras
// del mismo tamaño en una pantalla cuyo trabajo es confirmar UNA. La regla de la
// casa —un paso por pantalla, y lo enorme es lo que se está decidiendo— la
// contradice sola. Elegir es una acción rara; verla siempre le cobra atención a
// todas las veces que no se usa.
//
// Con la foto grande como control, la pantalla queda con una sola cosa y la
// elección aparece cuando alguien la pide.

import { useEffect, useRef, useState } from 'react';
import { Modal, Button } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { IconoBorrar } from '../_ui/BotonBorrar';

export type FotoElegible = { id: string; url: string };

/**
 * Sube un archivo con PROGRESO REAL.
 *
 * ⚠️ XHR y no `fetch`, y no es una preferencia: **`fetch` no expone el progreso
 * de SUBIDA**. Su `ReadableStream` sirve para la bajada; para saber cuántos bytes
 * salieron hace falta `xhr.upload.onprogress`, que es lo que ya usa el
 * ads-manager (`app/ads-manager/creativeUpload.ts`, `putWithProgress`).
 *
 * Una barra alimentada por un `fetch` sólo puede ir de 0 a 100 de un salto, que
 * es una barra que miente sobre lo único que promete.
 */
function subirConProgreso(
  file: File,
  onProgreso: (pct: number) => void,
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/onboarding/persona');
    // Tope en 99: el 100 se pone cuando el servidor CONTESTA, no cuando el
    // último byte salió. Entre esas dos cosas hay una escritura a storage, y una
    // barra que llega a 100 y se queda ahí es peor que una que llega a 99.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgreso(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText) as { ok?: boolean; error?: string; warnings?: string[] };
        resolve({ ok: !!j.ok, error: j.error, warnings: j.warnings });
      } catch {
        resolve({ ok: false, error: `No se pudo subir la foto (HTTP ${xhr.status}).` });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: 'Se cortó la conexión al subir la foto.' });
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

/**
 * Una imagen que NO se dibuja hasta que terminó de bajar.
 *
 * ⚠️ El dueño: «cuando una foto cargada tarda en renderizar, no hagas que se
 * renderice cortada de arriba a abajo, como normalmente lo hacen, eso es feo».
 *
 * Y no es sólo feo: una foto que aparece por franjas es indistinguible de una
 * foto rota a medio cargar, así que la pantalla parece estar fallando justo
 * mientras funciona. Un JPEG progresivo lo hace por diseño y el navegador no
 * ofrece apagarlo — la única forma de no verlo es no montar el `<img>` a la
 * vista hasta que `load` haya disparado.
 *
 * El `<img>` se monta igual desde el principio (si no, no empieza a bajar):
 * lo que se controla es su OPACIDAD. Y `onError` también apaga el latido, o un
 * link vencido deja el punto pulsando para siempre.
 */
export function Foto({ src, alt, radio = 0 }: { src: string; alt: string; radio?: number }) {
  const [listo, setListo] = useState(false);
  return (
    <span style={{
      display: 'block', position: 'relative', width: '100%', height: '100%',
      background: 'var(--surface-2)', borderRadius: radio, overflow: 'hidden',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setListo(true)}
        onError={() => setListo(true)}
        style={{
          display: 'block', width: '100%', height: '100%', objectFit: 'cover',
          opacity: listo ? 1 : 0, transition: 'opacity .18s ease',
        }}
      />
      {!listo && (
        <span className="mk-cargando-foto" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * La foto grande, que ADEMÁS es el control para cambiarla.
 *
 * El hover descubre que se puede tocar; el click abre las otras. Y lleva
 * `aria-label` y foco propio porque un control que sólo se descubre por hover no
 * existe para quien navega con teclado.
 */
export function FotoGrande({ url, puedeCambiar, onAbrir, children }: {
  url: string;
  puedeCambiar: boolean;
  onAbrir: () => void;
  children?: React.ReactNode;
}) {
  if (!puedeCambiar) return <>{children}</>;
  return (
    <button type="button" className="mk-fotoelegir" onClick={onAbrir} aria-label="Cambiar foto">
      {children}
      <span className="mk-fotoelegir__velo">
        <span className="mk-fotoelegir__texto">
          <Icon name="perfil" size={15} />
          Cambiar foto
        </span>
      </span>
    </button>
  );
}

/** El elegidor: las fotos que hay, y una para subir. */
export function ModalFotos({ fotos, elegida, onElegir, onSubida, onBorrar, onCerrar }: {
  fotos: FotoElegible[];
  elegida: string;
  onElegir: (id: string) => void;
  /**
   * Sacar una foto. OPCIONAL a propósito: sin él, este modal se comporta
   * exactamente como hasta hoy.
   *
   * ⚠️ Lo tiene el onboarding y NO el wizard de generación, y la diferencia es
   * real: en el onboarding la persona está armando su juego de fotos —«sacar
   * fotos o agregar nuevas», textual del dueño— mientras que en medio de un
   * anuncio a medio filmar, borrar la foto de la que salió la imagen de un
   * escenario ya aprobado es una acción destructiva sin nada que la pida.
   */
  onBorrar?: (id: string) => void;
  /** La subida terminó bien: hay que refrescar la lista y quedarse con la nueva. */
  onSubida: () => void;
  onCerrar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const subir = async (f: File) => {
    setError('');
    setPct(0);
    const r = await subirConProgreso(f, (p) => { if (vivo.current) setPct(p); });
    if (!vivo.current) return;
    setPct(null);
    // ⚠️ La ruta contesta `ok: true` AUNQUE haya salteado el archivo —no era una
    // imagen, o pesaba más de 15 MB— y lo dice en `warnings`. Ignorarlos convierte
    // «tu foto no entró» en «no pasó nada», que es exactamente como se reportó la
    // primera vez.
    const aviso = r.warnings?.[0];
    if (!r.ok || aviso) { setError(String(aviso || r.error || 'No se pudo subir la foto.')); return; }
    onSubida();
  };

  return (
    <Modal titulo="¿Con cuál de tus fotos?" onCerrar={onCerrar} ancho={560}>
      {error && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)', marginBottom: 12 }}>{error}</div>
      )}

      <div className="mk-fotos">
        {/* Subir: la misma medida que las otras, con borde punteado. El punteado
            dice «acá falta algo» sin una palabra, y no depende del color.

            ⚠️ VA PRIMERO, no al final. Con ocho fotos, un botón de subir en la
            última celda queda debajo del pliegue de la grilla y hay que buscarlo;
            el dueño lo pidió textual: «dentro del pop-up la primera foto tiene que
            ser el placeholder para subir nuevas». Y con CERO fotos es lo único que
            hay, así que ponerlo al final es ponerlo en una lista vacía. */}
        <button
          type="button"
          className="mk-fotos__una mk-fotos__una--nueva"
          onClick={() => entrada.current?.click()}
          disabled={pct !== null}
        >
          {pct === null ? (
            <span className="mk-fotos__mas"><span aria-hidden>+</span>Subir otra</span>
          ) : (
            // El loader: una barra REAL, alimentada por los bytes que salieron.
            <span className="mk-fotos__subiendo">
              <span className="mk-fotos__pct">{pct}%</span>
              <span className="mk-fotos__barra"><i style={{ width: `${pct}%` }} /></span>
            </span>
          )}
        </button>

        {fotos.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`mk-fotos__una${f.id === elegida ? ' mk-fotos__una--elegida' : ''}`}
            onClick={() => { onElegir(f.id); onCerrar(); }}
            aria-pressed={f.id === elegida}
          >
            <Foto src={f.url} alt="" />
            {f.id === elegida && (
              <span className="mk-fotos__tilde"><Icon name="check" size={13} /></span>
            )}
          </button>
        )).flatMap((nodo, i) => {
          const f = fotos[i];
          if (!onBorrar) return [nodo];
          // ⚠️ La papelera va COMO ÍCONO sobre la foto y no como un botón de texto
          // en rojo: la regla de la casa dice que la acción destructiva de un
          // estado confirmado pesa menos que el estado que acompaña. Acá lo que
          // importa es la foto; sacarla es un gesto de servicio.
          return [(
            <span key={f.id} style={{ position: 'relative', display: 'inline-flex' }}>
              {nodo}
              <button
                type="button"
                aria-label="Sacar esta foto"
                title="Sacar esta foto"
                onClick={(e) => { e.stopPropagation(); onBorrar(f.id); }}
                style={{
                  position: 'absolute', top: 6, right: 6, width: 26, height: 26,
                  borderRadius: 999, display: 'grid', placeItems: 'center', padding: 0,
                  cursor: 'pointer', border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--dim)',
                }}
              >
                <IconoBorrar size={14} />
              </button>
            </span>
          )];
        })}

      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void subir(f);
        }}
      />

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="tertiary" onClick={onCerrar}>Seguir con esta</Button>
      </div>
    </Modal>
  );
}
