// =============================================================================
// /m/operaciones — el Centro de Operaciones en el teléfono, SÓLO PARA MIRAR (15/10/2026)
// =============================================================================
// Martín: «No veo el botón del Centro en mobile» y «quiero que todo se pueda ver en mobile y esta bien
// diseñado, lo del Centro». En la URL es /admin/operaciones (LAS MISMAS RUTAS: el proxy sirve esta
// página en un teléfono, lib/movil-rutas.ts → rutaMovil).
//
// Copiado de la lista de GitHub Actions en el teléfono (capturada el 15/10): una fila por pedido con
// su estado, y el detalle al tocarla. Es la columna del celular del rediseño propuesto
// (docs/prototipos/centro-operaciones.html), destilada.
//
// ⚠️ SÓLO PARA MIRAR, a propósito: firmar un pedido necesita la clave DE ESTE dispositivo, cargada a
// mano en la PC, y eso no se planifica (decisión del 15/10). Lo que sirve desde el teléfono es
// enterarse: qué se mandó, qué llegó y qué carteros están andando. Mandar va en la computadora.
//
// ⚠️ EL GUARD ES EL DE ESCRITORIO: `puedeOperar` (admin global + workspace de la plataforma + sesión
// con fila + segundo factor), antes de leer nada. Lo fija tests/operaciones.test.ts.

import './operaciones.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, RUTA_MAS } from '@/lib/movil-rutas';
import { rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { motivoDeEspera, puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { CabeceraM, ErrorM, VacioM } from '@/app/m/_ui';
import { CentroMovil, type CarteroM, type PedidoM } from './CentroMovil';

export const dynamic = 'force-dynamic';

const RUTA = '/m/operaciones';

export default async function CentroOperacionesMovil() {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const plataforma = await wsSuperAdmin();
  // Como la Ticketera: el super admin entra en el workspace de la plataforma, no «sin workspace».
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs(RUTA, plataforma));
  await requireMovil({ onboarding: false });
  const cabecera = <CabeceraM titulo="Centro de Operaciones" padre={{ href: RUTA_MAS, label: 'More' }} />;
  if (!puedeOperar(admin, plataforma)) {
    return <>{cabecera}<VacioM frase="El Centro lo abre el super admin con su segundo factor." /></>;
  }
  try {
    const [cola, estado] = await Promise.all([listarPedidos(), leerCarteros()]);
    const ahora = Date.now();
    const pedidos: PedidoM[] = cola.map((p) => ({
      id: p.id,
      creado: p.created_at,
      texto: p.texto,
      estado: p.estado,
      chat: p.destino_titulo,
      cuenta: p.destino_cuenta,
      motivo: p.motivo,
      espera: motivoDeEspera(p, estado.carteros, ahora),
      tomado: p.tomado_at,
      entregado: p.entregado_at,
      cerrado: p.cerrado_at,
      cierre: p.cierre,
    }));
    const carteros: CarteroM[] = estado.carteros.map((k) => ({
      cuenta: k.cuenta, vistoAt: k.vistoAt, version: k.version, chats: k.chats.length,
    }));
    return <>{cabecera}<CentroMovil pedidos={pedidos} carteros={carteros} hayToken={estado.tokenPista != null} ahora={ahora} /></>;
  } catch {
    return <>{cabecera}<ErrorM frase="No pude leer la cola de trabajos." arreglo={{ rotulo: 'Volver a More', href: RUTA_MAS }} /></>;
  }
}
