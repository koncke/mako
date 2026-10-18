'use client';

// =============================================================================
// More — las dos filas que no navegan: una tab que se usa en la computadora, y un desplegable de la sidebar
// =============================================================================
// Referencia: Ajustes de iOS. Una fila que no lleva a una pantalla propia abre una HOJA en el lugar (como «Wi-Fi ›»
// cuando el detalle es corto), y una fila apagada dice por qué en la segunda línea, no con un candado.
//   · «En la computadora» (17/10/2026): la tab existe en la sidebar y no tiene pantalla del teléfono (lib/movil-rutas.ts →
//     SOLO_ESCRITORIO con su motivo, o EN_CAMINO). La hoja dice el motivo y abre la versión de computadora con la MISMA
//     salida que la última fila de More (la cookie de vista de escritorio, 12 h, y `conWs` con la pestaña del cliente).
//     Nunca un link pelado: el desvío la taparía con «Esta pantalla se usa en la computadora».
//   · Un desplegable («Coming soon» del super admin): la hoja con sus filas, como el flyout de escritorio.
// =============================================================================

import { useState } from 'react';
import type { FilaMas } from '@/lib/movil-rutas';
import { FilaEnComputadoraM } from '../_ui/EnComputadoraM';
import { FilaM } from '../_ui/FilaM';
import { ListaM } from '../_ui/Piezas';
import { SheetM } from '../_ui/SheetM';

type Computadora = Extract<FilaMas, { tipo: 'computadora' }>;
type Grupo = Extract<FilaMas, { tipo: 'grupo' }>;

/** La tab sin pantalla del teléfono: la fila «En la computadora» de app/m/_ui (la hoja con el motivo y la salida). */
export function FilaComputadoraM({ fila }: { fila: Computadora }) {
  return <FilaEnComputadoraM icono={fila.icon} titulo={fila.label} href={fila.href} motivo={fila.motivo} />;
}

export function FilaGrupoM({ fila }: { fila: Grupo }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <FilaM navegacion icono={fila.icon} titulo={fila.label} riel={<span className="m-mas-n">{fila.filas.length}</span>} onClick={() => setAbierta(true)} />
      <SheetM abierto={abierta} onCerrar={() => setAbierta(false)} titulo={fila.label} id="grupo">
        <ListaM>
          {fila.filas.map((f) => (f.tipo === 'pantalla'
            ? <FilaM key={f.key} navegacion icono={f.icon} titulo={f.label} href={f.href} />
            : f.tipo === 'computadora'
              ? <FilaComputadoraM key={f.key} fila={f} />
              : null))}
        </ListaM>
      </SheetM>
    </>
  );
}
