// /m/cuenta/instalar — los pasos para agregar MaKo a la pantalla de inicio (iPhone, y Android sin
// el aviso de Chrome). La cabecera pone «‹ Tu cuenta» sola (cabeceraPorRuta): una subpantalla de
// /m/cuenta. El nombre («Instalar la app», el rótulo de la computadora) lo pone PasosInstalar con <CabeceraM>.

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
