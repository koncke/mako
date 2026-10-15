// =============================================================================
// /perfil/seguridad — «Tu cuenta» › Seguridad (15/10/2026)
// =============================================================================
// Agregar y sacar métodos del segundo paso, la contraseña, los códigos de recuperación y los
// dispositivos recordados, con el diseño de la seguridad de Google (SeguridadCuenta.tsx). Todo lo
// hace /api/perfil/seguridad con la sesión completa.
//
// El `?ver=` (qué detalle se mira) lo lee el server: un link copiado abre el mismo detalle.

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA, seccionesCuenta } from '@/lib/ajustes-secciones';
import { AjustesPagina } from '@/app/_ui/Ajustes';
import { SeguridadCuenta } from './SeguridadCuenta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SeguridadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Es de la PERSONA, sea cual sea su rol: `requireRolWs([])` echaba a closers y setters,
  // que también pueden (y les conviene) activar el segundo paso.
  const s = await getUsuarioActual();
  if (!s) redirect('/login?next=%2Fperfil%2Fseguridad');
  const sp = await searchParams;
  const ver = typeof sp.ver === 'string' ? sp.ver : null;
  // Sólo para el índice: mirando a un cliente, «Tu cuenta» muestra su perfil y no se ofrece lo tuyo.
  const deOtro = await leerPerfil().then((p) => p.vista.deOtro, () => false);
  return (
    <AjustesPagina lugar={TITULO_CUENTA} secciones={seccionesCuenta(deOtro, 'seguridad')} activa="seguridad">
      <SeguridadCuenta ver={ver} />
    </AjustesPagina>
  );
}
