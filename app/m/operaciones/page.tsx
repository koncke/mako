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
import { areasDeProgreso, leerPushes } from '@/lib/progreso';
import { PESTANAS_CENTRO, frentesEnCurso, novedades, pedidosRecientes, recortarPedido, type PestanaCentro } from '@/lib/progreso-reglas';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import type { CarteroM, PedidoM } from './CentroMovil';
import { CentroMovilPestanas } from './ProgresoMovil';
import { chatsDelCentro, cuentasConCartero } from '@/lib/centro-chats';

export const dynamic = 'force-dynamic';

const RUTA = '/m/operaciones';

export default async function CentroOperacionesMovil({ searchParams }: { searchParams: Promise<{ tab?: string; todos?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const plataforma = await wsSuperAdmin();
  // Como la Ticketera: el super admin entra en el workspace de la plataforma, no «sin workspace».
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs(RUTA, plataforma));
  await requireMovil({ onboarding: false });
  const cabecera = <CabeceraM titulo="Centro de Operaciones" padre={{ href: RUTA_MAS, label: 'More' }} />;
  if (!puedeOperar(admin, plataforma)) {
    return <PantallaM>{cabecera}<VacioM frase="El Centro lo abre el super admin con su segundo factor." /></PantallaM>;
  }
  const { tab, todos } = await searchParams;
  const inicial: PestanaCentro = (PESTANAS_CENTRO as readonly string[]).includes(tab ?? '') ? (tab as PestanaCentro) : PESTANAS_CENTRO[0];
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: Progreso (bitácoras y Vercel) se ve aunque la cola no se pueda leer.
  const [cola, estado, pushes] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerPushes(),
  ]);
  const trabajos: PedidoM[] | null = cola && estado ? cola.map((p) => ({
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
  })) : null;
  const carteros: CarteroM[] | null = estado ? estado.carteros.map((k) => ({
    cuenta: k.cuenta, vistoAt: k.vistoAt, version: k.version, chats: k.chats.length,
  })) : null;
  const verTodos = todos === '1';
  const pedidos = pedidosRecientes(areas, ahora, verTodos ? 3650 : 14).map(recortarPedido);
  const lista = estado?.carteros ?? [];
  const trabajosP = (cola ?? []).map((p) => ({ id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at }));
  const chats = chatsDelCentro({ carteros: lista, areas, pedidos, trabajos: trabajosP, ahora });
  return (
    <PantallaM>
      {cabecera}
      <CentroMovilPestanas
        inicial={inicial}
        frentes={frentesEnCurso(areas, ahora)}
        pedidos={pedidos}
        novedades={novedades(areas, ahora)}
        chats={chats}
        cuentas={cuentasConCartero(lista)}
        trabajos={trabajosP}
        pushes={pushes}
        todos={verTodos}
        ahora={ahora}
        cola={trabajos}
        carteros={carteros}
        hayToken={estado?.tokenPista != null}
      />
    </PantallaM>
  );
}
