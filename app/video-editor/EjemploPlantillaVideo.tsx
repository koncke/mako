'use client';
// =============================================================================
// EjemploPlantillaVideo — «Ver ejemplo» de una plantilla de anuncio de «Nuevo video» (6/11/2026)
// =============================================================================
// La regla de Create (Martín, 29/10/2026: la estructura en la plantilla y un botón «Ver ejemplo» aparte): el ejemplo de un
// negocio FICTICIO del elenco (lib/editor-video/plantillas-ejemplos.ts), como guion de rodaje: lo que dice con sus segundos,
// los textos en pantalla, las tomas de apoyo y el texto del anuncio. Sin dibujar con el motor: este diálogo vive en la
// pantalla de «Nuevo video», y el motor del editor entra sólo por VideoEditorCliente (tests/video-editor-integracion).
// «Usar esta plantilla» hace lo mismo que la tarjeta.
// =============================================================================

import { Button, Modal } from '@/app/_ui';
import type { EjemploVideo } from '@/lib/editor-video/plantillas-ejemplos';

const fila: React.CSSProperties = { display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 };

export function EjemploPlantillaVideo({ nombre, e, alSalir, alUsar }: { nombre: string; e: EjemploVideo; alSalir: () => void; alUsar: () => void }) {
  return (
    <Modal titulo={`Ejemplo: ${e.negocio} (negocio ficticio)`} onCerrar={alSalir} ancho={680}
      pie={<><Button variant="secondary" onClick={alSalir}>Volver</Button><Button variant="primary" onClick={alUsar}>Usar esta plantilla</Button></>}>
      <p style={{ margin: '0 0 4px', fontSize: 13.5 }}><strong>{nombre}</strong> · {e.objetivo}</p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--dim)' }}>{e.sobre}</p>
      {e.guion.length > 0 && (
        <section aria-label="Lo que se dice">
          <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Lo que se dice</h3>
          {e.guion.map((g, i) => (
            <div key={i} style={fila}><span style={{ flex: 'none', width: 64, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{g.segundos}</span><span>{g.dice}</span></div>
          ))}
        </section>
      )}
      <section aria-label="Textos en pantalla" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Textos en pantalla</h3>
        {Object.entries(e.textos).map(([hueco, texto]) => (
          <div key={hueco} style={fila}><span style={{ flex: 'none', width: 120, color: 'var(--dim)' }}>{hueco}</span><strong>{texto}</strong></div>
        ))}
      </section>
      {e.tomas.length > 0 && (
        <section aria-label="Tomas de apoyo" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Tomas de apoyo</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>{e.tomas.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      )}
      {e.anuncio && (
        <section aria-label="Texto del anuncio" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Texto del anuncio</h3>
          <p style={{ margin: 0, fontSize: 13.5, whiteSpace: 'pre-line' }}>{e.anuncio}</p>
        </section>
      )}
    </Modal>
  );
}
