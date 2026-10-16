import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { Pagina, PermissionState } from '@/app/_ui';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { areasDeProgreso } from '@/lib/progreso';
import { pedidosRecientes, recortarPedido } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { leerMunecos } from '@/lib/centro-munecos-db';
import { CentroApp } from './CentroApp';
import { deshacerDecision, responderDecision } from '@/app/admin/runway/acciones';
// La Ticketera vive adentro del Centro (16/10/2026): sus hojas las importa la página (CambioVista.tsx lo explica).
import '@/app/tickets/decisiones/mazo.css';
import '@/app/tickets/decisiones/vistas.css';
import '@/app/admin/runway/decisiones.css';

// =============================================================================
// /admin/operaciones — el Centro, como una app de chat (16/10/2026)
// =============================================================================
// La barra con los chats de las tres cuentas y la conversación con su caja de escribir; el avance de cada chat es
// su barra derecha (CentroApp.tsx, Avance.tsx). Desde el 15/10 no hay pestañas: un `?tab=` viejo abre los chats. Lo que se rehízo y de dónde se copió, en el encabezado de
// CentroApp.tsx y en docs/hallazgos-operaciones.md.
//
// ⚠️ La guarda va antes de leer nada (tests/operaciones.test.ts).
// ⚠️ NO SE ESPERA A VERCEL: su API tarda hasta 8 s y la pantalla «tarda mucho en aparecer» (Martín, 15/10).
// Los pushes los pide la pantalla después de dibujarse (pushesCentroAction). Lo que se lee acá —la cola, los
// carteros y las bitácoras del build— es la base: si la cola falla, los chats se ven igual.

export const dynamic = 'force-dynamic';

export default async function OperacionesPage({ searchParams }: { searchParams: Promise<{ chat?: string; ticketera?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  if (!puedeOperar(admin, await wsSuperAdmin())) {
    return <Pagina><PermissionState motivo="rol" que="el Centro de Operaciones" /></Pagina>;
  }
  const { chat, ticketera } = await searchParams;
  const ahora = Date.now();
  const areas = areasDeProgreso();
  const [cola, carteros, tarjetas, munecos] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerDecisiones().catch(() => null),
    leerMunecos(),
  ]);
  // Las tarjetas de la Ticketera, enteras: cada chat dibuja las suyas arriba de la caja, y el botón Ticketera, todas.
  const decisiones = tarjetas?.ok ? tarjetas.decisiones : null;
  const pedidos = pedidosRecientes(areas, ahora, 14).map(recortarPedido);
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CentroApp
        base={chatsDeBitacoras({ areas, pedidos, ahora })}
        colaInicial={cola}
        carterosIniciales={carteros}
        decisionesIniciales={decisiones}
        munecosIniciales={munecos}
        pedidos={pedidos}
        ahora={ahora}
        sub={admin.sub}
        chatInicial={typeof chat === 'string' && chat ? chat : null}
        responder={responderDecision}
        deshacer={deshacerDecision}
        ticketeraInicial={ticketera === 'lista' ? 'lista' : ticketera === 'tarjetas' ? 'tarjetas' : null}
      />
    </Pagina>
  );
}
