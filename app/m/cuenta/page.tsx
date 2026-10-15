// =============================================================================
// /m/cuenta — la cuenta de MaKo Mobile (la primera fila de More; vuelve a More)
// =============================================================================
// Server: resuelve quién es, si está viendo a un cliente (y por dónde sale), y sus
// preferencias de avisos (por PERSONA, `usuarios.perfil.notifPush`). Lo que depende del
// teléfono (instalada, permiso, suscripción) lo lee el cliente.
//
// Las preferencias se leen acá y no con un GET desde el navegador: es un dato de la
// persona que ya está en el server, y un fetch al montar sería un parpadeo más.
// El título («Perfil», el mismo nombre que en escritorio) y el «‹ More» los pone el shell
// (app/m/_ui/cabecera.ts).
// =============================================================================

import './cuenta.css';
import { requireMovil, salidaDeVista } from '@/lib/movil-guard';
import { getNotifPush, leerPerfil, usuarioPropio } from '@/lib/perfil';
import { PantallaM } from '../_ui/PantallaM';
import { CuentaM, type DatosCuenta } from './CuentaM';

export const dynamic = 'force-dynamic';

export default async function CuentaPagina() {
  const ctx = await requireMovil();
  const [salida, propio, push, perfil] = await Promise.all([
    salidaDeVista(), usuarioPropio(), getNotifPush(),
    // «Información personal», la misma de la computadora: se lee acá para que la hoja abra sin esperar.
    leerPerfil().catch(() => null),
  ]);

  const datos: DatosCuenta = {
    nombre: (ctx.sesion.nombre ?? '').trim(),
    email: ctx.sesion.email,
    vista: salida ? { cliente: ctx.clienteNombre ?? 'este cliente', salida: salida.salida, modoAgencia: salida.modoAgencia } : null,
    push,
    guardable: propio != null,
    esAdmin: (propio?.rol ?? ctx.rol) === 'admin',
    perfil,
  };

  return (
    <PantallaM>
      <CuentaM datos={datos} />
    </PantallaM>
  );
}
