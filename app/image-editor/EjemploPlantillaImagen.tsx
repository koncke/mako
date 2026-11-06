'use client';
// =============================================================================
// EjemploPlantillaImagen — «Ver ejemplo» de una plantilla real de Image (6/11/2026)
// =============================================================================
// La regla de Create (Martín, 29/10/2026: «Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo"»): la
// tarjeta de «Nuevo diseño» muestra la ESTRUCTURA (lo que se crea) y aquí se ve la misma composición llena, de un negocio
// FICTICIO del elenco (docs/plantillas-reales/README.md, 2.2). Las dos salen de la misma función de
// lib/image-editor/plantillas-reales.ts, así que no pueden tener capas distintas. Se dibuja con ./MiniaturaDiseno.tsx, sin el
// motor. «Usar esta plantilla» hace lo mismo que la tarjeta: crea el diseño con la estructura.
// =============================================================================

import { useMemo, useState } from 'react';
import { Button, Modal } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { PlantillaImagen } from '@/lib/image-editor/plantillas-reales';
import { MiniaturaDiseno } from './MiniaturaDiseno';

let contador = 0;
const idLocal = () => `e${++contador}`;

/** Lo que MaKo le pregunta al negocio para llenarla (image.md, 3.4), dicho como se lee. */
const PREGUNTA: Record<PlantillaImagen['pide'][number], string> = {
  titulo_video: 'el título del video',
  resultado: 'el resultado que mostrar',
  caso: 'el caso de un cliente',
  foto: 'una foto tuya o de tu producto',
  respuesta_mensaje: 'un mensaje real de un cliente',
  cupos: 'cuántos cupos quedan',
  fecha: 'la fecha',
  propiedad: 'los datos de la propiedad',
  comparacion: 'qué se compara',
  historia: 'tu historia',
  creencia: 'la creencia que rompes',
  oferta: 'tu oferta',
};

export function EjemploPlantillaImagen({ p, alSalir, alUsar }: {
  p: PlantillaImagen;
  alSalir: () => void;
  /** Crea el diseño con la estructura de esta plantilla; un texto de vuelta es el error. */
  alUsar: () => Promise<string | null>;
}) {
  const doc = useMemo(() => p.ejemplo(idLocal), [p]);
  const paginas = doc.pages.length;
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usar = async () => {
    setCreando(true); setError(null);
    const e = await alUsar().catch((x: unknown) => (x instanceof Error ? x.message : 'No se pudo crear el diseño.'));
    if (e) { setError(e); setCreando(false); }
  };
  // Una página ocupa el ancho; varias van una al lado de la otra (la versión B, la segunda lámina).
  const ancho = paginas > 1 ? `${Math.floor(100 / paginas) - 2}%` : '100%';
  return (
    <Modal titulo={p.nombre} encabezado={`Ejemplo · ${p.negocio} (negocio ficticio)`} onCerrar={alSalir} ancho={paginas > 1 || p.ancho > p.alto ? 920 : 560}
      pie={<>
        <Button variant="secondary" onClick={alSalir} disabled={creando}>Volver</Button>
        <Button variant="primary" onClick={() => { void usar(); }} loading={creando}>Usar esta plantilla</Button>
      </>}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5 }}>{p.cuando} La plantilla trae esta composición con guías donde va lo tuyo.</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'center' }}>
        {doc.pages.map((pg, i) => (
          <figure key={pg.id ?? i} style={{ margin: 0, width: ancho, maxWidth: p.ancho < p.alto && paginas === 1 ? 380 : undefined }}>
            <div style={{ aspectRatio: `${p.ancho} / ${p.alto}`, borderRadius: 6, overflow: 'hidden', boxShadow: '0 4px 14px -6px rgba(0,0,0,.35)' }}>
              <MiniaturaDiseno doc={doc} pagina={i} titulo={`${p.nombre}, página ${i + 1}`} />
            </div>
            {paginas > 1 && pg.name ? <figcaption style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6 }}>{i + 1}. {pg.name}</figcaption> : null}
          </figure>
        ))}
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>
        Para hacer el tuyo, MaKo te pregunta: {p.pide.map((x) => PREGUNTA[x]).join(', ')}.
      </p>
      {error && <p role="alert" style={{ margin: '10px 0 0', color: 'var(--bad)' }}>{error}<ReportarASoporte /></p>}
    </Modal>
  );
}
