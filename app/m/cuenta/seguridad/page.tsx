// =============================================================================
// /m/cuenta/seguridad — «Tu cuenta» › Seguridad en el teléfono (15/10/2026)
// =============================================================================
// La MISMA pantalla que la computadora (SeguridadCuenta, copiada de la seguridad de Google): las mismas
// filas, en el mismo orden y con los mismos rótulos (reglas.ts), sin el índice de la izquierda. El
// teléfono destila, no rediseña. La URL que se ve es /perfil/seguridad (lib/movil-rutas.ts), con su
// `?ver=` para cada detalle, así que un link copiado abre lo mismo en los dos lados.
//
// Las llaves de acceso (huella o Face ID) se crean SÓLO acá: la API lo decide por el teléfono
// (`passkeysDisponibles`, decisión de Martín del 14/10/2026).

import '../cuenta.css';
import { requireMovil } from '@/lib/movil-guard';
import { PantallaM } from '../../_ui/PantallaM';
import { CabeceraM } from '../../_ui/CabeceraM';
import { SeguridadCuenta } from '@/app/perfil/seguridad/SeguridadCuenta';

export const dynamic = 'force-dynamic';

export default async function SeguridadMovil({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMovil();
  const sp = await searchParams;
  return (
    <PantallaM>
      <CabeceraM titulo="Seguridad" grande={false} />
      <div className="m-cuenta-seguridad">
        <SeguridadCuenta ver={typeof sp.ver === 'string' ? sp.ver : null} />
      </div>
    </PantallaM>
  );
}
