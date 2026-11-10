'use client';

// =============================================================================
// Los ejemplos de Image en el TELÉFONO, con el MISMO guiado de la computadora (10/11/2026)
// =============================================================================
// Medido el 10/11 en producción a 375×812: en el teléfono, «Editar» de un ejemplo armaba la versión EN EL ACTO (leía las láminas,
// escribía con la IA del negocio y creaba el diseño) sin preguntar nada. Es lo que Martín no quería el 9/11 en la computadora
// («me llevó directamente al editor y no está bueno eso»), y sólo se había arreglado ahí: esta pantalla montaba la grilla sin
// `onReplicar`. El Cerebro, 10/11: «el guiado del teléfono SÍ tiene referencia: el mismo guiado de la computadora, con los mismos
// pasos, las mismas preguntas y los mismos componentes, acomodado al ancho del teléfono».
//
// Así que acá no hay piezas nuevas: `useGuiado`, `ChatReplica` y `ReplicarGuiado` de app/image-editor/carruseles/ReplicarGuiado.tsx,
// la tarjeta del chat de Create (`.cr-tarjeta`, que a ≤ 760 px ya va a todo el ancho) y su «←» (`.cr-volver`). En la computadora
// el chat va a la izquierda y el original al centro; en 375 px no entran lado a lado, así que se APILAN: primero MaKo, que es
// donde se contesta, y debajo las láminas del original. «Generar» abre el armado de siempre (./EditarCarrusel.tsx).
//
// Las hojas del chat (el hilo, la caja: app/admin/operaciones/centro.css y app/_chat/chat.css) en la computadora llegan con el
// panel de MaKo de la tab; el teléfono no las carga solo, así que van con la pieza (como app/_chat/PegadoHilo.tsx).
// Lo fija tests/image-movil-guiado.test.ts.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import '@/app/_crear/crear.css';
import { useCallback, useState, type ComponentProps } from 'react';
import { ExplorarCarruseles } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import { BASE_SIN_DATOS, ChatReplica, ReplicarGuiado, useGuiado, type BaseGuiado } from '@/app/image-editor/carruseles/ReplicarGuiado';
import type { Carrusel } from '@/lib/carruseles/explorar';

type Props = Omit<ComponentProps<typeof ExplorarCarruseles>, 'onReplicar' | 'telefono'> & {
  /** Lo que el guiado sabe del negocio (app/image-editor/guiado-base.ts). null = no se pudo leer: MaKo pregunta igual. */
  base: BaseGuiado | null;
};

export function EjemplosM({ base, ...explorar }: Props) {
  const [replicando, setReplicando] = useState<Carrusel | null>(null);
  const g = useGuiado(replicando, base ?? BASE_SIN_DATOS);
  const salir = useCallback(() => setReplicando(null), []);
  if (!g) return <ExplorarCarruseles telefono {...explorar} onReplicar={setReplicando} />;
  const volver = (
    <button type="button" className="cr-volver" onClick={salir} title="Volver a los ejemplos" aria-label="Volver a los ejemplos">←</button>
  );
  return (
    <div className="m-image-editor-guiado" data-guiado-movil="">
      <div className="cr-tarjeta m-image-editor-guiado__chat"><ChatReplica g={g} volver={volver} /></div>
      <ReplicarGuiado g={g} onSalir={salir} />
    </div>
  );
}
