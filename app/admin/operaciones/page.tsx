import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { Pagina, PermissionState } from '@/app/_ui';
import { carteroVivo, puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { areasDeProgreso, leerPushes } from '@/lib/progreso';
import { PESTANAS_CENTRO, frentesEnCurso, novedades, pedidosRecientes, recortarPedido, type PestanaCentro } from '@/lib/progreso-reglas';
import { chatsDelCentro, cuentasConCartero } from '@/lib/centro-chats';
import { CentroPestanas } from './CentroPestanas';

// =============================================================================
// /admin/operaciones — el Centro: Chats · Avance · Pushes · Áreas (Trabajos, en «Cartero y trabajos»)
// =============================================================================
// Las tres primeras son Progreso (lib/progreso.ts): salen de las bitácoras del build y de Vercel, así
// que tienen datos sin el cartero ni su token. «Trabajos» es la cola firmada que despacha el cartero.
// ⚠️ La guarda va antes de leer nada (tests/operaciones.test.ts).

export const dynamic = 'force-dynamic';

export default async function OperacionesPage({ searchParams }: { searchParams: Promise<{ tab?: string; todos?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  if (!puedeOperar(admin, await wsSuperAdmin())) {
    return <Pagina><PermissionState motivo="rol" que="el Centro de Operaciones" /></Pagina>;
  }
  const { tab, todos } = await searchParams;
  const inicial: PestanaCentro = (PESTANAS_CENTRO as readonly string[]).includes(tab ?? '') ? (tab as PestanaCentro) : PESTANAS_CENTRO[0];
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: si la cola no se puede leer, Progreso se ve igual (y al revés).
  const [cola, carteros, pushes] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerPushes(),
  ]);
  const verTodos = todos === '1';
  const pedidos = pedidosRecientes(areas, ahora, verTodos ? 3650 : 14).map(recortarPedido);
  const lista = carteros?.carteros ?? [];
  const chats = chatsDelCentro({
    carteros: lista, areas, pedidos, ahora,
    trabajos: (cola ?? []).map((p) => ({ id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at })),
  });
  return (
    <Pagina>
      <CentroPestanas
        inicial={inicial}
        frentes={frentesEnCurso(areas, ahora)}
        pedidos={pedidos}
        novedades={novedades(areas, ahora)}
        chats={chats}
        cuentas={cuentasConCartero(lista)}
        pushes={pushes}
        todos={verTodos}
        hayCartero={!!carteros?.carteros.some((k) => carteroVivo(k, ahora))}
        ahora={ahora}
        sub={admin.sub}
        cola={cola}
        carteros={carteros}
      />
    </Pagina>
  );
}
