'use client';

// =============================================================================
// MensajeMakoLienzo — el lienzo de un Mensaje de MaKo, adentro de /automations (quinta tanda, punto 5)
// =============================================================================
// Pedido de Martín (09/10/2026), textual: «quiero que elimines el lienzo en la tab de
// "Notificaciones", pero que dejes un enlace para editarlo aquí. Y claro, que traigas todos los
// flujos de "Notificaciones" a la tab de chatbot».
//
// ⚠️ NO ES UNA COPIA DEL EDITOR: monta el MISMO `TemplateDetalleModal` (y adentro el mismo
// `FlujoAviso`) que dibujaba la tab de Configuraciones › Notificaciones, con el MISMO endpoint
// (`/api/perfil/plantillas`, con su guard de admin del workspace). Editar, publicar, prender, el
// deshacer y el «✨ Que lo escriba MaKo» siguen siendo los de allá: una segunda copia se quedaría
// vieja en la primera edición (AGENTS.md, «Una cosa, un lugar»).
//
// Lo que una pantalla montada adentro de otra asume (AGENTS.md, «Montar una PANTALLA adentro de un
// modal»), medido sobre TemplateDetalleModal + FlujoAviso + Lienzo, y qué se hace acá:
//   · la URL: no la leen ni la escriben. Nada.
//   · listeners de `document`/`window`: `visibilitychange` (guarda el borrador) y el Ctrl+Z del
//     deshacer. Acá hay UN lienzo montado a la vez (el de la automatización se desmonta al elegir
//     un mensaje), así que no compiten. Nada.
//   · `localStorage`: no lo usan. Nada.
//   · el alto: el detalle trae 620 px fijos y su marco (la tarjeta de /mensajes). Acá llena el área
//     del lienzo de borde a borde: `alto="100%"` + `marco={false}`, adentro de una caja absoluta
//     que le da un alto definido (ver el comentario del render).
//   · lo que flota sobre su borde izquierdo (el título, el zoom, el panel del nodo y el ENCUADRE):
//     la lista de /automations se le apoya encima, así que va `insetIzq` —el mismo de la automatización,
//     que sale de `muelles`—. Es la prop que se le sumó al detalle y al lienzo del aviso para esto.
//   · «Probar» (la vista del chat): el detalle sólo dibuja su botón si recibe `onVerChat`, y acá no
//     se pasa. La vista del chat se quedó en Notificaciones, que es donde vive (no es el lienzo).
//
// El `key` es obligatorio y lo pone quien monta: el detalle siembra seis `useState` de sus props
// (AGENTS.md, «Un `useState` sembrado de props no se resiembra»). Lo que el «⋯» de la lista cambia sin
// remontarlo (el interruptor, el nombre) el detalle lo resiembra solo (novena tanda).
//
// ⚠️ EL TACHO ES EL «ELIMINAR» DEL «⋯» (novena tanda, 10/10/2026): `onEliminar` llega de la lista, que
// pregunta con la confirmación de la casa y OCULTA el mensaje (se recupera). Sin él, el tacho del detalle
// borraba acá mismo y sin preguntar: dos «Eliminar» del mismo mensaje con dos consecuencias distintas.

import { TemplateDetalleModal, type PlantillaVista } from '../agencia/TemplateDetalleModal';
import { ENDPOINT_MENSAJES_MAKO } from '@/lib/chatbot-mensajes-mako';
import type { Muelles } from '@/lib/lienzo-grafo';

export function MensajeMakoLienzo({ plantilla, insetIzq, muelles, onCambio, onCerrar, onEliminar }: {
  plantilla: PlantillaVista;
  /** Lo que tapa la lista a la izquierda (`muelles(...).insets.izq`). */
  insetIzq: number;
  /** Dónde flota cada cosa: el panel de cada tarjeta con el tamaño de una automatización (`editorDeTarjeta`). */
  muelles?: Muelles | null;
  /** Cambió algo del mensaje (nombre, interruptor, texto publicado): la lista lo vuelve a leer. */
  onCambio: () => void;
  /** El detalle se cierra: se vuelve a la lista. */
  onCerrar: () => void;
  /** El tacho: el MISMO «Eliminar» del «⋯» de la fila (pregunta y oculta). */
  onEliminar: () => void;
}) {
  // ⚠️ EL ALTO LO DA UNA CAJA ABSOLUTA, no el `height: 100%` del detalle contra un ítem flex. El
  // detalle pone su alto con `height: alto`, y un porcentaje contra un alto que sale de `flex: 1`
  // es el caso que Safari resuelve a CERO (AGENTS.md, «Dos reglas de layout que se rompen
  // solas», regla 3) — con el `overflow: hidden` del detalle, eso es un lienzo en blanco. Una caja
  // `position: absolute; inset: 0` tiene alto DEFINIDO en todos los motores, y el detalle no se toca.
  return (
    <div data-mensaje-mako={plantilla.id} style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <TemplateDetalleModal
          plantilla={plantilla}
          endpoint={ENDPOINT_MENSAJES_MAKO}
          alto="100%" marco={false} insetIzq={insetIzq} muelles={muelles}
          onCambio={onCambio}
          onClose={onCerrar}
          onEliminar={onEliminar}
        />
      </div>
    </div>
  );
}
