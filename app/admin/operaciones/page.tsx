import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { Pagina, PermissionState } from '@/app/_ui';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { areasDeProgreso } from '@/lib/progreso';
import { PESTANAS_CENTRO, novedades, pedidosRecientes, recortarPedido, type PestanaCentro } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { CentroApp } from './CentroApp';

// =============================================================================
// /admin/operaciones — el Centro, como una app de chat (16/10/2026)
// =============================================================================
// La barra con los chats de las tres cuentas, la conversación con su caja de escribir, y Avance y Pushes
// como accesos de la barra (CentroApp.tsx). Lo que se rehízo y de dónde se copió, en el encabezado de
// CentroApp.tsx y en docs/hallazgos-operaciones.md.
//
// ⚠️ La guarda va antes de leer nada (tests/operaciones.test.ts).
// ⚠️ NO SE ESPERA A VERCEL: su API tarda hasta 8 s y la pantalla «tarda mucho en aparecer» (Martín, 15/10).
// Los pushes los pide la pantalla después de dibujarse (pushesCentroAction). Lo que se lee acá —la cola, los
// carteros y las bitácoras del build— es la base: si la cola falla, los chats se ven igual.

export const dynamic = 'force-dynamic';

export default async function OperacionesPage({ searchParams }: { searchParams: Promise<{ tab?: string; todos?: string; chat?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  if (!puedeOperar(admin, await wsSuperAdmin())) {
    return <Pagina><PermissionState motivo="rol" que="el Centro de Operaciones" /></Pagina>;
  }
  const { tab, todos, chat } = await searchParams;
  const vista: PestanaCentro = (PESTANAS_CENTRO as readonly string[]).includes(tab ?? '') ? (tab as PestanaCentro) : PESTANAS_CENTRO[0];
  const ahora = Date.now();
  const areas = areasDeProgreso();
  const [cola, carteros, tarjetas] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerDecisiones().catch(() => null),
  ]);
  // Lo que espera una respuesta de Martín en la Ticketera: el «pide aprobación» de Grok Bot, por empleado.
  const decisiones = tarjetas?.ok ? tarjetas.decisiones.map((d) => ({ chat: d.chat, destino: d.destino ?? null, respuesta: d.respuesta })) : null;
  const verTodos = todos === '1';
  const recientes = pedidosRecientes(areas, ahora, 14).map(recortarPedido);
  const pedidos = verTodos ? pedidosRecientes(areas, ahora, 3650).map(recortarPedido) : recientes;
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CentroApp
        base={chatsDeBitacoras({ areas, pedidos: recientes, ahora })}
        colaInicial={cola}
        carterosIniciales={carteros}
        decisionesIniciales={decisiones}
        pedidos={pedidos}
        novedades={novedades(areas, ahora)}
        todos={verTodos}
        ahora={ahora}
        sub={admin.sub}
        vistaInicial={vista}
        chatInicial={typeof chat === 'string' && chat ? chat : null}
      />
    </Pagina>
  );
}
