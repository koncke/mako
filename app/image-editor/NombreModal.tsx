'use client';

// =============================================================================
// NombreModal — escribir un nombre (el de un diseño, el de una búsqueda guardada) sin el cuadro del navegador
// =============================================================================
// 18/11/2026 (F50 de docs/pendientes-verificados-17-11.md): «Cambiar nombre» de un diseño y «Guardar búsqueda» de los ejemplos
// usaban `window.prompt`, que no es de la app (otra letra, otro color, «Aceptar»/«Cancelar» del sistema, y en el teléfono una
// ventana que tapa todo). La referencia es la de al lado en la misma pantalla: «Guardar como plantilla» del «⋯» del diseño
// (app/creaciones/PublicarCreacion.tsx), el `Modal` de la casa con un campo y dos botones que nombran su acción.
// ⚠️ El pendiente pedía el campo ADENTRO del renglón, como app/web-generator/Inicio.tsx. El renglón lo dibuja
//    app/_crear/PantallaCrear.tsx, que es de las cinco tabs de Create y hoy lo edita otro chat: queda anotado en
//    docs/hallazgos-editor-imagen.md (18/11/2026).
// Qué nombre sirve lo decide `nombreValido` (./nombre-reglas.ts), con test.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import { Button, Modal } from '@/app/_ui';
import { nombreValido } from './nombre-reglas';

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14,
};

export function NombreModal({ titulo, rotulo, inicial, anterior = '', tope, accion, noAccion, onGuardar, alSalir }: {
  titulo: string;
  /** El nombre del campo («Nombre»). */
  rotulo: string;
  /** Lo que el campo trae escrito al abrir. */
  inicial: string;
  /** El nombre que ya está guardado: dejarlo igual no es un cambio. Sin esto (una búsqueda nueva), el sugerido se puede guardar. */
  anterior?: string;
  tope: number;
  /** El botón que guarda («Cambiar nombre»), y el que no («No cambiar»). */
  accion: string;
  noAccion: string;
  onGuardar: (nombre: string) => void;
  /** Sin guardar (el nombre del prop es el de `ModalGuardarPlantilla`, el de al lado). */
  alSalir: () => void;
}) {
  // Identidad FIJA para el Modal (AGENTS.md: con una flecha nueva por render, el foco se pierde con cada letra).
  const cerrarRef = useRef(alSalir);
  cerrarRef.current = alSalir;
  const cerrar = useCallback(() => cerrarRef.current(), []);
  const [nombre, setNombre] = useState(inicial);
  const listo = nombreValido(anterior, nombre, tope);
  const guardar = () => { if (listo) onGuardar(listo); };
  const pie = (
    <>
      <Button variant="secondary" onClick={cerrar}>{noAccion}</Button>
      <Button variant="primary" onClick={guardar} disabled={!listo}>{accion}</Button>
    </>
  );
  return (
    <Modal titulo={titulo} onCerrar={cerrar} pie={pie} ancho={440}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '0 0 6px' }} htmlFor="ie-nombre">{rotulo}</label>
      <input id="ie-nombre" data-autofocus style={campo} value={nombre} maxLength={tope}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }} />
    </Modal>
  );
}
