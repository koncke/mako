'use client';

// Solo abre el modal. Vive aparte porque la página es un server component y el
// modal necesita estado; meter 'use client' en la página entera la obligaría a
// mandar el cerebro al browser dos veces.

import { useState } from 'react';
import { ExportarCerebro } from './ExportarCerebro';
import type { Cerebro } from '@/lib/cerebro-modelo';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';

export function BotonExportar({ cerebro, conteo, recorte }: {
  cerebro: Cerebro;
  conteo: Record<string, number>;
  /** Lo que el mapa está mostrando ahora. `recortado` es falso cuando no hay ni filtro
   *  ni búsqueda: ahí «lo que estás viendo» y «todo» son lo mismo y no hay que
   *  preguntarlo. */
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
        title="Exportar a carpetas y archivos de texto"
        onClick={() => setAbierto(true)}
      >
        Exportar
      </Button>
      {abierto && <ExportarCerebro cerebro={cerebro} conteo={conteo} recorte={recorte} onClose={() => setAbierto(false)} />}
    </>
  );
}
