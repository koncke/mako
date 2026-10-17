// =============================================================================
// La CRIATURA de un destino de la barra (17/10/2026)
// =============================================================================
// Martín: «"Ops Center" debería estar donde "Second Brain", con una criatura tipo ícono, moviéndose como siempre».
// Es el muñeco del Ops Center de ese nombre (app/admin/operaciones/Muneco.tsx), TRABAJANDO —flota y parpadea—, el mismo
// que tiene ese chat en el Centro porque el aspecto sale del nombre (lib/centro-munecos.ts → aspectoDe). Se usa el
// componente, nunca una copia del dibujo: si el Centro cambia sus muñecos, la barra cambia con ellos.
//
// Un poco más grande que un ícono de trazo: es una figura llena y a 19 px no se le ve la cara. El movimiento vive en
// `.mk-criatura` (app/_ui/ui.css) y no en centro.css, que sólo carga la pantalla del Centro.
//
// ⚠️ SIN 'use client' y sin hooks, como el muñeco: la dibujan la barra (cliente) y el More del teléfono (servidor).

import { Muneco } from '@/app/admin/operaciones/Muneco';

export function Criatura({ nombre, size = 19 }: { nombre: string; size?: number }) {
  return (
    <span className="mk-criatura" style={{ display: 'flex', flex: 'none' }}>
      <Muneco titulo={nombre} animo="trabajando" size={size + 4} style={{ margin: -2 }} />
    </span>
  );
}
