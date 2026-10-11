// =============================================================================
// /m/cuenta — la hoja Cuenta de MaKo Mobile
// =============================================================================
// Server: resuelve quién es, en qué negocio, si está viendo a un cliente (y por dónde
// sale), y sus preferencias de avisos (por PERSONA, `usuarios.perfil.notifPush`).
// Lo que depende del teléfono (instalada, permiso, suscripción) lo lee el cliente.
//
// Las preferencias se leen acá y no con un GET desde el navegador: es un dato de la
// persona que ya está en el server, y un fetch al montar sería un parpadeo más.
// =============================================================================

import './cuenta.css';
import { requireMovil, salidaDeVista } from '@/lib/movil-guard';
import { getWorkspace } from '@/lib/workspace';
import { getNotifPush, usuarioPropio } from '@/lib/perfil';
import { PantallaM } from '../_ui/PantallaM';
import { CuentaM, type DatosCuenta } from './CuentaM';
import { rolLegible } from './cuenta-ui';

export const dynamic = 'force-dynamic';

export default async function CuentaPagina() {
  const ctx = await requireMovil();
  const [salida, propio, push, negocio] = await Promise.all([
    salidaDeVista(),
    usuarioPropio(),
    getNotifPush(),
    ctx.impersonando
      ? Promise.resolve(ctx.clienteNombre)
      : ctx.ws != null
        ? getWorkspace(ctx.ws).then((w) => w?.nombre?.trim() || null).catch(() => null)
        : Promise.resolve(null),
  ]);

  const datos: DatosCuenta = {
    nombre: (ctx.sesion.nombre ?? '').trim(),
    email: ctx.sesion.email,
    rol: rolLegible(ctx.rol),
    negocio,
    vista: salida ? { cliente: ctx.clienteNombre ?? 'este cliente', salida: salida.salida, modoAgencia: salida.modoAgencia } : null,
    push,
    guardable: propio != null,
    esAdmin: (propio?.rol ?? ctx.rol) === 'admin',
  };

  return (
    <PantallaM>
      <CuentaM datos={datos} />
    </PantallaM>
  );
}
