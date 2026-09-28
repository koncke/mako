// =============================================================================
// /api/auth/me — identidad + workspace del request (para el sidebar y el banner)
// =============================================================================
// El sidebar lo usa para: (a) decidir qué shell mostrar (admin vs cliente),
// (b) pintar el banner de impersonación "estás viendo a <cliente>".

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getWorkspace, getWorkspaceActual, getRolWsEfectivo, estaImpersonando } from '@/lib/workspace';
import { rutaDeSalida } from '@/lib/agencia-cartera';
import { agenciaDeCliente } from '@/lib/agencia';
import { WS_PARAM } from '@/lib/ws-tab';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: true, autenticado: false });

  // ¿Un admin está "viendo como" un cliente, EN ESTA PESTAÑA?
  //
  // Antes esto leía la cookie de impersonación a mano. Ya no: el workspace puede
  // venir del `?ws=` de la pestaña, y con dos fuentes hay que preguntarle a quien
  // sabe combinarlas. Copiar la lógica acá era garantizar que un día el banner
  // dijera un cliente y los datos fueran de otro.
  const ws = await getWorkspaceActual();
  const impersonando = await estaImpersonando();
  let clienteNombre: string | null = null;
  const clienteWs = impersonando ? ws : null;
  if (clienteWs) {
    try { clienteNombre = (await getWorkspace(clienteWs))?.nombre ?? `Workspace ${clienteWs}`; } catch { clienteNombre = `Workspace ${clienteWs}`; }
  }

  // ⚠️ LA SALIDA ES UN DATO, NO UNA CONSTANTE. El botón «Salir de la vista»
  // apuntaba hardcodeado a '/admin' en tres lugares, y '/admin' está en
  // SOLO_ADMIN del gate: una agencia que lo apretara se comía el `denegarRol` y
  // aterrizaba en /inicio. Funciona, pero no es salir — es que la app te mueva
  // a otro lado. Ahora cada uno vuelve a la pantalla desde la que entró, y la
  // decisión vive en `rutaDeSalida` (lib/agencia-cartera.ts), en un solo lugar.
  const esSuperAdmin = sesion.rol === 'admin';
  // De qué agencia es este cliente, si es de alguna. Decide DOS cosas: la cadena
  // que se dibuja y a qué escalón vuelve «Salir».
  const agencia = esSuperAdmin && clienteWs ? await agenciaDeCliente(clienteWs) : null;

  return NextResponse.json({
    ok: true,
    autenticado: true,
    email: sesion.email,
    nombre: sesion.nombre,
    rol: sesion.rol,
    // Cómo se entró, porque la salida no es la misma puerta: el super-admin
    // borra `mako_ws` (o se va a una URL sin `?ws=`), la agencia borra
    // `mako_agencia`. Un DELETE al endpoint equivocado deja la cookie puesta y
    // el cartel vuelve solo, que se lee como un botón roto.
    modoAgencia: impersonando && !esSuperAdmin,
    // ⚠️ «SALIR» ES UN POP DE **UN** NIVEL, no una vuelta al principio. «Al salir
    // me debe llevar nuevamente a la anterior inspección del cliente de agencia,
    // en la tab de cliente, y si le doy salir nuevamente, recién ahí a super
    // admin» (27/09/2026). Antes hacía los dos escalones de un click y el
    // intermedio existía sólo colgado del link del nombre de la agencia, que es
    // otro control.
    //
    // Y NO hace falta un stack: el nivel de arriba se DERIVA. Si este workspace
    // es de una agencia, arriba está esa agencia; si no, arriba está la
    // plataforma. Un stack habría que guardarlo, sobreviviría mal a un F5 y
    // mentiría al entrar por un link directo.
    salida: agencia ? `/customer-success?${WS_PARAM}=${agencia.ws}` : rutaDeSalida(esSuperAdmin),
    // ⚠️ LA CADENA, PARA CUANDO HAY DOS NIVELES: el super admin mirando a un
    // cliente que pertenece a una agencia. Sin esto la barra dice «estás viendo
    // a Cliente X» y se calla lo único que hace falta saber ahí — de quién es
    // ese cliente y cómo volver un escalón, no dos.
    //
    // Se DERIVA de la base (`agenciaDeCliente`) y no de un parámetro de la URL:
    // un `?via=` se pierde en la primera navegación y además sería un dato de
    // afuera echado en pantalla. Sólo para el super admin: una agencia mirando a
    // SU cliente ya sabe de quién es, y decírselo sería ruido.
    agencia,
    // Rol dentro del negocio + workspace efectivo (para que el Sidebar filtre tabs).
    rolWs: await getRolWsEfectivo(),
    ws,
    // Capa que compró el cliente (lib/capas.ts): el Sidebar esconde lo que no
    // incluye. Es cosmético — el enforcement real es requireCapa server-side.
    capa: await getCapaActual(),
    legacy: sesion.sub === 'legacy',
    impersonando,
    clienteNombre,
    clienteWs,
  });
}
