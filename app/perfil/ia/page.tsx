// =============================================================================
// /perfil/ia — «Tu cuenta» › Tus cuentas de IA (docs/ia-del-cliente.md §6, 21/10/2026)
// =============================================================================
// Su Claude, en SU computadora: la PC atiende sólo a quien la conectó (§10), así que es de la PERSONA y la ve todo el
// equipo, sea cual sea su rol. Antes vivía sólo en Integraciones (del admin), y un closer no tenía dónde conectar la suya
// (revisión del Cerebro, 21/10/2026). El admin ve acá todas las PC del negocio y elige el modelo. En el teléfono esta URL
// es /m/cuenta/ia (lib/movil-rutas.ts): el estado y «Desconectar»; conectar se hace en la computadora.

import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { TusCuentasIA } from '../../integraciones/TusCuentasIA';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TusCuentasIAPage({ searchParams }: { searchParams: Promise<{ computadora?: string }> }) {
  // ABIERTA DURANTE EL ONBOARDING (27/10/2026): el instalador de MaKo Desktop vuelve acá al terminar (`?computadora=1`), y
  // conectar la computadora y su IA es un paso del setup que el onboarding exige (lib/setup-negocio.ts). Con el gate, el
  // instalador terminaba en el onboarding y no en «Conecta MaKo».
  await requireRolWs(['closer', 'setter'], { gateOnboarding: false });
  const deOtro = await leerPerfil().then((p) => p.vista.deOtro, () => false);
  return (
    <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(deOtro, 'ia')} activa="ia">
      <TituloAjustes titulo="Tus cuentas de IA" bajada="Tu Ops Center contesta con tu Claude o tu GPT." />
      {/* `?computadora=1`: adonde vuelve el instalador de Windows al terminar (RUTA_TRAS_INSTALAR), directo en «Conecta MaKo». */}
      <TusCuentasIA sinCabecera computadora={(await searchParams).computadora === '1'} />
    </AjustesPagina>
  );
}
