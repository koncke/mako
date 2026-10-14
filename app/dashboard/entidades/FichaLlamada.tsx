'use client';

// =============================================================================
// FichaLlamada — el detalle de UNA llamada, con sus tareas, en una caja (interfaz C1 del Dashboard v4)
// =============================================================================
// Martín, 11/10/2026: «Closing Analyst va COMPLETO al Dashboard… y la tab se ELIMINA». Esto es el port del
// detalle de app/closing/ClosingBrowser.tsx (`Detail` y lo que colgaba de él), con el mismo comportamiento:
// la cabecera (puntaje, R1/R2, desenlace, fecha, duración, closer), el reproductor de Fathom (la miniatura y
// clic para reproducir; ▶ mm:ss abre la grabación en Fathom en ese segundo, porque el embed no salta), el
// resumen, el historial de revisiones, el Análisis (próximo paso, las 7 dimensiones con su cita, fortalezas,
// a mejorar, objeciones y coaching), los Momentos, el Transcript en vivo de Fathom con las marcas del
// análisis, «Lead →», y las TAREAS: revisar a mano, re-evaluar con MaKo y re-analizar.
//
// v5 (12/10/2026): el ADENTRO de la ficha se mudó a ./llamada.tsx, partido en piezas (el pop-up «Llamada» es
// una mini-hoja que las pone donde quiere, y la pieza `completo` es esta misma ficha sin el Modal). Esto quedó
// como la caja de siempre: el Modal con el título, la línea de arriba y el pie de tareas. Una sola
// implementación de cada sección: lo que se ve acá y en el pop-up es lo mismo. (Hasta el 13/10/2026 vivía en la
// carpeta de los bloques, al lado del bloque «Las llamadas»; los bloques se borraron y la ficha vino a su entidad.)
//
// Quién la abre: la acción «Ver llamada» del detalle de un número (../Detalle.tsx), `?llamada=<recording_id>`
// (EditorInforme), la acción de una fila (./acciones-fila.tsx) y el botón «Revisar» de un pop-up de llamada
// (../ElementoAccion.tsx, con `revisarAlAbrir`).
// Pide sus datos a GET /api/closing/llamada (una lectura compartida con las piezas abiertas de esa llamada).
//
// Lo que no se ve en la firma:
//   · SE MONTA EN EL <body>. Abierta desde una tarjeta de la grilla, un `position: fixed` queda relativo a la
//     tarjeta (react-grid-layout la ubica con `transform`) y recortado por su `overflow: hidden`. La envoltura
//     frena los eventos: un portal de React burbujea por el árbol de React, y un mousedown adentro empezaría a
//     arrastrar la tarjeta en modo edición (el mismo motivo que `Capa`, ../piezas.tsx).
//   · `onCerrar` va estable (`useCerrarEstable`): el efecto de foco del Modal depende de él (AGENTS.md).
//   · El ALTO de la caja es FIJO: pasar de «Momentos» a «Transcript» no la achica (AGENTS.md: «JAMÁS achiques
//     el tamaño de un detail según lo que contenga dentro»).
//   · Una TAREA no se aborta al cerrar la caja: re-analizar sigue en el server, y cuando contesta la hoja se
//     refresca igual (`onCambio`), aunque la ficha ya no esté.
//   · `soloLectura` apaga las TAREAS (revisar, re-analizar). Para un closer NO va: las tareas son de admin y
//     closer (decisión 6 de Martín), y las rutas lo vuelven a mirar (app/api/closing/puerta.ts).

import { useSyncExternalStore, type JSX, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Toast, useToast } from '@/app/_ui';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { NO_ARRASTRAR } from '../piezas';
import { CuerpoFichaLlamada, EncabezadoFicha, EstilosFicha, PieFichaLlamada, tituloDeFicha, useFichaLlamada } from './llamada';

type Props = {
  recordingId: number;
  onCerrar: () => void;
  /** Una tarea cambió la llamada: quien la abrió vuelve a pedir sus números. */
  onCambio?: () => void;
  /** Sin tareas (revisar, re-analizar): sólo se lee. */
  soloLectura?: boolean;
  /** Abre con el formulario de «Revisar a mano» ya abierto (el botón «Revisar» de un pop-up). */
  revisarAlAbrir?: boolean;
};

const parar = (e: SyntheticEvent) => e.stopPropagation();

const sinSuscripcion = () => () => {};
/**
 * Monta la ficha en el <body> (ver la cabecera). Sólo en el navegador: en el server no hay `document`, y una
 * ficha que abre de entrada (`?llamada=`) no puede dibujar un portal en la hidratación. `useSyncExternalStore`
 * contesta false en el server y al hidratar, y true después, sin un setState en un efecto.
 */
function EnElBody({ children }: { children: ReactNode }) {
  const enNavegador = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  if (!enNavegador) return null;
  return createPortal(
    <div className={NO_ARRASTRAR} onClick={parar} onMouseDown={parar} onPointerDown={parar} onTouchStart={parar}>{children}</div>,
    document.body,
  );
}

export function FichaLlamada({ recordingId, onCerrar, onCambio, soloLectura = false, revisarAlAbrir = false }: Props): JSX.Element {
  const cerrar = useCerrarEstable(onCerrar);
  const { toast, show, clear } = useToast();
  const f = useFichaLlamada(recordingId, { onCambio, soloLectura, revisarAlAbrir, aviso: (t, tono) => show(t, undefined, tono) });
  return (
    <EnElBody>
      <EstilosFicha />
      <Modal titulo={tituloDeFicha(f)} encabezado={f.llamada ? <EncabezadoFicha llamada={f.llamada} /> : undefined} onCerrar={cerrar} ancho={900} alto="min(90vh, 880px)"
        pie={f.llamada ? <PieFichaLlamada f={f} /> : undefined}>
        <CuerpoFichaLlamada f={f} />
      </Modal>
      <Toast state={toast} onClose={clear} />
    </EnElBody>
  );
}
