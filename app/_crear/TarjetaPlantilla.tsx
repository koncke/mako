'use client';

// =============================================================================
// TarjetaPlantilla — una plantilla de «¿Qué vas a crear hoy?» con su EJEMPLO a la vista (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «Los templates tienen que ser reales, tanto en las imágenes como en copywriter, como en todos lados».
// La tarjeta era un marco gris con un nombre; no faltaban plantillas: la tarjeta no tenía dónde mostrar el ejemplo
// (docs/hallazgos-ui.md). La miniatura (4:3), de lo más propio a lo más pobre:
//   1. la de la tab (`miniatura`: Video dibuja la plantilla con `MiniaturaPlantilla`);
//   2. con el mouse encima, el `video` (AI Avatar), mudo, en bucle y nunca sin mouse;
//   3. la HOJA con el texto real del ejemplo (`extracto`: el título, el cuerpo y los chips; ./reglas.ts `hojaDe`);
//   4. la imagen a SU proporción (`cajaDeMiniatura`: una historia 9:16 ya no se recorta al tercio del medio);
//   5. el marco vacío del formato, con su rótulo, como antes.
// Arriba, la insignia (formato y duración) y la cinta «Ejemplo» (el negocio ficticio, ./ejemplo.ts); debajo, el nombre (sin
// bajada: tanda 6 del Web Generator); «cuándo usarla» va como `title`. Una tab que no pasa los campos nuevos se ve igual
// que antes. Aparte de PantallaCrear para dibujarla sola en tests/crear-pantalla.test.ts.
// =============================================================================

import { useState, type ReactNode } from 'react';
import { cajaDeMiniatura, chipsVisibles, hojaDe, marcoDe, type PlantillaCrear } from './reglas';
import { rotuloDeEjemplo } from './ejemplo';

export function TarjetaPlantilla({ pl, activa, usando, miniatura, onUsar, onActiva }: {
  pl: PlantillaCrear;
  /** El mouse o el foco está encima. */
  activa: boolean;
  /** La plantilla que se está usando (todas quedan quietas y esa dice «Creando»). */
  usando: string | null;
  miniatura?: (p: PlantillaCrear, activa: boolean) => ReactNode;
  onUsar: () => void;
  onActiva: (si: boolean) => void;
}) {
  const propia = miniatura?.(pl, activa);
  const conPropia = propia != null && propia !== false;
  const hoja = conPropia ? null : hojaDe(pl);
  const chips = hoja ? chipsVisibles(pl.chips) : [];
  const caja = cajaDeMiniatura(pl.formato);
  // El video corre sólo con un mouse encima: en el teléfono, tocar la tarjeta ya es «Usar plantilla».
  const [conMouse, setConMouse] = useState(false);
  const video = !conPropia && pl.video && activa && conMouse ? pl.video : null;
  return (
    <button type="button" className="cr-plantilla" onClick={onUsar} disabled={!!usando} title={pl.ayuda || undefined}
      data-creando={usando === pl.id ? 'si' : undefined} aria-label={`Usar la plantilla ${pl.nombre}`}
      onPointerEnter={(e) => { setConMouse(e.pointerType === 'mouse'); onActiva(true); }} onPointerLeave={() => onActiva(false)}
      onFocus={() => onActiva(true)} onBlur={() => onActiva(false)}>
      <span className="cr-plantilla__mini" style={{ aspectRatio: '4 / 3' }} data-hoja={hoja ? 'si' : undefined}>
        {conPropia ? propia
          : video ? <video className="cr-plantilla__video" src={video} style={caja ?? undefined} muted playsInline loop autoPlay aria-hidden />
          : hoja ? (
            <span className="cr-plantilla__hoja">
              {hoja.titulo ? <span className="cr-plantilla__titular">{hoja.titulo}</span> : null}
              <span className="cr-plantilla__extracto">{hoja.cuerpo}</span>
              {chips.length > 0 && (
                <span className="cr-plantilla__chips">{chips.map((c, i) => <span key={i} className="cr-plantilla__chip">{c}</span>)}</span>
              )}
            </span>
          )
          : pl.imagen ? <img src={pl.imagen} alt="" loading="lazy" style={caja ?? undefined} data-caja={caja ? 'si' : undefined} />
          : <span className="cr-plantilla__marco" style={marcoDe(pl.formato)} />}
        {!conPropia && !hoja && !pl.imagen && pl.rotulo ? <span className="cr-plantilla__rotulo">{pl.rotulo}</span> : null}
        {pl.insignia || pl.ejemplo ? (
          <span className="cr-plantilla__marcas">
            {pl.insignia ? <span className="cr-plantilla__insignia" title={pl.insignia}>{pl.insignia}</span> : null}
            {pl.ejemplo ? <span className="cr-plantilla__cinta" title={rotuloDeEjemplo(pl.ejemplo)}>Ejemplo</span> : null}
          </span>
        ) : null}
        {usando === pl.id
          ? <span className="cr-plantilla__usar" data-visible="si"><span className="cr-giro" /> Creando</span>
          : <span className="cr-plantilla__usar">Usar plantilla</span>}
      </span>
      <span className="cr-plantilla__nombre">{pl.nombre}</span>
    </button>
  );
}
