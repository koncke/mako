'use client'

// MaKo (no está en Polar): una lectura que salió A MEDIAS. Las de MaKo (lib/clientes-plataforma.ts, lib/admin-ingresos.ts)
// devuelven lo que pudieron y en `avisos` lo que no; sin esto, una lista corta se lee como completa. Va arriba de la lista,
// con el Alert de Polar.

import { Alert } from '@/app/admin/_polar/orbit'

export const AvisosDeLectura = ({ avisos }: { avisos?: readonly string[] }) =>
  avisos && avisos.length > 0 ? (
    <Alert
      variant="warning"
      soporte
      title="Puede faltar algo"
      description={`No pude leer ${avisos.join('; ')}.`}
    />
  ) : null
