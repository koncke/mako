// /m/cuenta/instalar — los pasos para agregar MaKo a la pantalla de inicio (iPhone).
// La cabecera pone «‹ Cuenta» sola (cabeceraPorRuta): una subpantalla de /m/cuenta.

import '../cuenta.css';
import { requireMovil } from '@/lib/movil-guard';
import { PantallaM } from '../../_ui/PantallaM';
import { PasosInstalar } from './PasosInstalar';

export const dynamic = 'force-dynamic';

export default async function InstalarPagina() {
  await requireMovil();
  return (
    <PantallaM>
      <PasosInstalar />
    </PantallaM>
  );
}
