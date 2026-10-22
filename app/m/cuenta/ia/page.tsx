// =============================================================================
// /m/cuenta/ia — «Tu cuenta» › Tus cuentas de IA en el teléfono (21/10/2026). En la URL, /perfil/ia.
// =============================================================================
// Las computadoras de la persona que piensan su Ops Center con SU Claude: su estado, sus cuentas con las dos barras de
// uso y «Desconectar». Es app/perfil/ia (la de la computadora) destilada. Conectar una computadora no se hace acá: se
// instala un programa en la computadora, así que la fila lleva a la versión de computadora (IaM.tsx).
//
// Es de la PERSONA y de todos los roles (la computadora atiende sólo a quien la conectó): `requireMovil()` sin navKey,
// como el resto de «Tu cuenta». Los datos los lee el cliente de GET /api/ia-pc/estado, que pregunta la sesión y filtra
// por persona (el admin ve las de todo el negocio). Esta página sólo le pasa `refresco` para que tirar hacia abajo
// vuelva a pedirlos.
// La cabecera pone «‹ My Profile» sola (cabeceraPorRuta): una subpantalla de /m/cuenta.
// =============================================================================

import './ia.css';
import { requireMovil } from '@/lib/movil-guard';
import { PantallaM } from '../../_ui/PantallaM';
import { IaM } from './IaM';

export const dynamic = 'force-dynamic';

export default async function TusCuentasIAMovil() {
  await requireMovil();
  return (
    <PantallaM>
      <IaM refresco={Date.now()} />
    </PantallaM>
  );
}
