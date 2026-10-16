// =============================================================================
// /m/cuenta — «Tu cuenta» en el teléfono (la primera fila de More; vuelve a More)
// =============================================================================
// Referencia: la cuenta de Google en el celular (la app de Google › «Administrar tu cuenta», y
// Ajustes › Google en Android): tu foto y tu nombre arriba, al centro, y debajo las secciones como
// FILAS con su ícono, cada una abre lo suyo. Es lo mismo que «Tu cuenta» de la computadora
// (app/perfil, copiada de myaccount.google.com), destilado: las MISMAS secciones, en el mismo orden y
// con los mismos rótulos (lib/ajustes-secciones.ts), sin el índice ni las bajadas.
//
// Server: resuelve quién es, si está viendo a un cliente (y por dónde sale), qué secciones se
// ofrecen, si administra el negocio, y sus preferencias de avisos (por PERSONA,
// `usuarios.perfil.notifPush`). Lo que depende del teléfono (instalada, permiso, suscripción) lo
// lee el cliente. Las preferencias se leen acá y no con un GET desde el navegador: es un dato de
// la persona que ya está en el server, y un fetch al montar sería un parpadeo más.
//
// ⚠️ «MIRANDO A UN CLIENTE» SE DECIDE CON LA SALIDA (`salidaDeVista`), no con `leerPerfil().vista`:
// las dos preguntas casi siempre coinciden, pero si se separan (un super admin parado en el
// workspace de plataforma, que su fila no tiene como propio) esconder Seguridad y Notificaciones
// sin dibujar «Salir de…» deja a la persona sin lo suyo y sin por dónde volver. Con la salida, lo
// que se esconde y la puerta para recuperarlo aparecen juntos.
//
// El título («Tu cuenta», el mismo nombre que en la computadora) y el «‹ More» los pone el shell
// (app/m/_ui/cabecera.ts).
// =============================================================================

import './cuenta.css';
import { requireMovil, salidaDeVista } from '@/lib/movil-guard';
import { puedeVerKey } from '@/lib/movil-rutas';
import { getNotifPush, leerPerfil, usuarioPropio } from '@/lib/perfil';
import { TITULO_NEGOCIO, seccionesCuenta } from '@/lib/ajustes-secciones';
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

  // Tu nombre y tu foto salen de TU fila (lo último que guardaste en Información personal); la
  // sesión es el respaldo. Si el perfil leído es el de otro, ni el nombre ni la foto son tuyos.
  const tuyo = perfil && !perfil.vista.deOtro ? perfil.perfil : null;
  const deOtro = salida != null;

  const datos: DatosCuenta = {
    nombre: (tuyo?.nombre || ctx.sesion.nombre || '').trim(),
    email: ctx.sesion.email,
    foto: tuyo?.avatarUrl?.trim() || null,
    vista: salida ? { cliente: ctx.clienteNombre ?? 'este cliente', salida: salida.salida, modoAgencia: salida.modoAgencia } : null,
    secciones: seccionesCuenta(deOtro).map((s) => s.key),
    // «Configuración del negocio» es la key `configuraciones` del menú de la foto (nav.ts, sin
    // `rolesWs`: sólo quien administra). La misma regla que el menú y que el guard de sus páginas.
    negocio: puedeVerKey('configuraciones', ctx.rol, ctx.capa) ? TITULO_NEGOCIO : null,
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
