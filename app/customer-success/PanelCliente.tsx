'use client';

// =============================================================================
// PanelCliente — asignarle trabajo, desde su propia página
// =============================================================================
// Lo único que la página de un cliente hace que el tablero no haga: elegir qué proyectos
// y tareas son suyos. El resto de esa pantalla ES el tablero.
//
// ⚠️ EL SELECTOR VA EN UN `<Modal>` DE LA CASA y no reemplazando el contenido, al revés
// que en la ficha vieja. Allá el motivo era que un `<Modal>` adentro de otro se esconde a
// sí mismo (`app/_components/pila-modales.ts`); acá abajo hay una PÁGINA, no otro modal,
// así que la pila hace exactamente lo que promete.

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal } from '@/app/_ui';
import { AsignarTrabajo } from './AsignarTrabajo';

export function PanelCliente({ leadId, nombre }: { leadId: number; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();

  return (
    <>
      <button type="button" className="cl-pag-asignar" onClick={() => setAbierto(true)}>
        Asignarle trabajo
      </button>

      {abierto && (
        <Modal titulo={`Asignarle trabajo a ${nombre}`} ancho={620} onCerrar={() => setAbierto(false)}>
          <AsignarTrabajo
            leadId={leadId}
            nombre={nombre}
            onCerrar={() => setAbierto(false)}
            onListo={() => {
              setAbierto(false);
              // ⚠️ `router.refresh()` Y NO UN `reload()`: los datos de esta página los
              // arma el SERVER, así que refrescar la ruta vuelve a leerlos y React
              // reconcilia — sin recargar el bundle ni perder el scroll del tablero.
              router.refresh();
            }}
          />
        </Modal>
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

const CSS = `
.cl-pag-asignar{ flex:none; margin-bottom:2px; background:var(--surface);
  border:1px solid var(--border-strong); border-radius:9px; padding:7px 13px;
  font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.cl-pag-asignar:hover{ border-color:var(--primary); color:var(--primary); }
`;
