// =============================================================================
// /perfil/ia — «Tu cuenta» › Tus cuentas de IA (docs/ia-del-cliente.md §6, 21/10/2026)
// =============================================================================
// Su Claude, en SU computadora: la PC atiende sólo a quien la conectó (§10), así que es de la PERSONA y la ve todo el
// equipo, sea cual sea su rol. Antes vivía sólo en Integraciones (del admin), y un closer no tenía dónde conectar la suya
// (revisión del Cerebro, 21/10/2026). El admin ve acá todas las PC del negocio y elige el modelo. En el teléfono esta URL
// es /m/cuenta/ia (lib/movil-rutas.ts): el estado y «Desconectar»; conectar se hace en la computadora.

import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA, seccionesCuenta } from '@/lib/ajustes-secciones';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { TusCuentasIA } from '../../integraciones/TusCuentasIA';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TusCuentasIAPage() {
  await requireRolWs(['closer', 'setter']);
  const deOtro = await leerPerfil().then((p) => p.vista.deOtro, () => false);
  return (
    <AjustesPagina lugar={TITULO_CUENTA} secciones={seccionesCuenta(deOtro, 'ia')} activa="ia">
      <TituloAjustes titulo="Tus cuentas de IA" bajada="Tu Ops Center contesta con tu Claude, tu GPT o tu Gemini." />
      <TusCuentasIA sinCabecera />
    </AjustesPagina>
  );
}
