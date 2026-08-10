'use client';

// Solo abre el modal. Vive aparte porque la página es un server component y el
// modal necesita estado; meter 'use client' en la página entera la obligaría a
// mandar el cerebro al browser dos veces.

import { useState } from 'react';
import { ExportarCerebro } from './ExportarCerebro';
import type { Cerebro } from '@/lib/cerebro-modelo';
import type { EstadoFiltro } from '@/lib/cerebro-filtro';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';

export function BotonExportar({ cerebro, filtroMapa, recorte }: {
  cerebro: Cerebro;
  /** El filtro que tiene puesto el mapa: con él se siembra el del modal, así que abrir
   *  «Exportar» con el mapa recortado propone bajar exactamente eso. */
  filtroMapa: EstadoFiltro;
  /** Lo que el mapa muestra de verdad (incluye las búsquedas). Solo alimenta el rótulo
   *  del botón: lo que se EXPORTA sale del filtro, que es lo único que se puede volver
   *  a expresar en un formulario. */
  recorte: { ids: string[]; recortado: boolean };
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {/* «Exportar», no «Bajar». El patrón de la casa tiene dos niveles y está cerrado
          en cuatro pantallas: la ACCIÓN se llama Exportar/Importar y el botón que
          dispara la descarga, ya adentro del modal, se llama «Descargar ↓». Y «Bajar»
          además YA significa otra cosa acá: el «Bajar a tierra ↓» de /conocimiento no
          descarga nada, internaliza un curso. */}
      <Button
        variant="secondary"
        icon={<Icon name="descargar" size={16} />}
        title={recorte.recortado ? 'Exportar — te propone bajar el recorte que estás viendo' : 'Exportar a carpetas y archivos de texto'}
        onClick={() => setAbierto(true)}
      >
        Exportar
      </Button>
      {abierto && <ExportarCerebro cerebro={cerebro} filtroMapa={filtroMapa} onClose={() => setAbierto(false)} />}
    </>
  );
}
