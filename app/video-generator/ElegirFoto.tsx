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

export type FotoElegible = { id: string; url: string };

/**
 * Sube un archivo con PROGRESO REAL.
 *
 * ⚠️ XHR y no `fetch`, y no es una preferencia: **`fetch` no expone el progreso
 * de SUBIDA**. Su `ReadableStream` sirve para la bajada; para saber cuántos bytes
 * salieron hace falta `xhr.upload.onprogress`, que es lo que ya usa el
 * ads-manager (`NuevaCampanaModal.tsx`, `putWithProgress`).
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
    <button type="button" className="mk-fotoelegir" onClick={onAbrir} aria-label="Cambiar la foto">
      {children}
      <span className="mk-fotoelegir__velo">
        <span className="mk-fotoelegir__texto">
          <Icon name="perfil" size={15} />
          Cambiar la foto
        </span>
      </span>
    </button>
  );
}

/** El elegidor: las fotos que hay, y una para subir. */
export function ModalFotos({ fotos, elegida, onElegir, onSubida, onCerrar }: {
  fotos: FotoElegible[];
  elegida: string;
  onElegir: (id: string) => void;
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
        {fotos.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`mk-fotos__una${f.id === elegida ? ' mk-fotos__una--elegida' : ''}`}
            onClick={() => { onElegir(f.id); onCerrar(); }}
            aria-pressed={f.id === elegida}
          >
            <img src={f.url} alt="" />
            {f.id === elegida && (
              <span className="mk-fotos__tilde"><Icon name="check" size={13} /></span>
            )}
          </button>
        ))}

        {/* Subir: la misma medida que las otras, con borde punteado. El punteado
            dice «acá falta algo» sin una palabra, y no depende del color. */}
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
