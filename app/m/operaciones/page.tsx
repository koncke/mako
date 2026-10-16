// =============================================================================
// /m/operaciones — el Centro de Operaciones en el teléfono (16/10/2026)
// =============================================================================
// Martín: «No veo el botón del Centro en mobile» y «quiero que todo se pueda ver en mobile y esta bien
// diseñado, lo del Centro». En la URL es /admin/operaciones (LAS MISMAS RUTAS: el proxy sirve esta
// página en un teléfono, lib/movil-rutas.ts → rutaMovil).
//
// Lo mismo que la computadora, destilado: los chats, con la conversación de cada uno en una hoja, su avance arriba
// y su caja de escribir fija abajo, y los Runners (CentroAppMovil.tsx y ChatsMovil.tsx).
//
// ⚠️ DESDE EL 16/10 EL TELÉFONO TAMBIÉN MANDA (Martín: «NO es funcional, no puedo mandar un prompt por allí a
// mis otras cuentas»): por el MISMO camino que la computadora (app/admin/operaciones/mandar.ts →
// encolarPedidoAction, con su `puedeOperar`), firmado con la clave DE ESTE teléfono. Hasta que la PC la
// acepte, la caja lo dice y ofrece copiarla.
//
// ⚠️ EL GUARD ES EL DE ESCRITORIO: `puedeOperar` (admin global + workspace de la plataforma + sesión
// con fila + segundo factor), antes de leer nada. Lo fija tests/operaciones.test.ts.
// ⚠️ No se espera a Vercel: los pushes llegan después de dibujar (pushesCentroAction).

import './operaciones.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, RUTA_MAS } from '@/lib/movil-rutas';
import { rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { areasDeProgreso } from '@/lib/progreso';
import { DIAS_HISTORIAL, pedidosDelCentro } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { leerMunecos } from '@/lib/centro-munecos-db';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import { CentroAppMovil } from './CentroAppMovil';
import { TicketeraMovil } from './TicketeraMovil';
import { nombresDeTabs } from '@/app/admin/operaciones/tabs';
import { deshacerDecision, responderDecision } from '@/app/admin/runway/acciones';
// La Ticketera vive adentro del Centro (16/10/2026): sus hojas las importa la página.
import '@/app/tickets/decisiones/mazo.css';
import '@/app/tickets/decisiones/vistas.css';
import '@/app/admin/runway/decisiones.css';

export const dynamic = 'force-dynamic';

const RUTA = '/m/operaciones';

export default async function CentroOperacionesMovil({ searchParams }: { searchParams: Promise<{ ticketera?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const plataforma = await wsSuperAdmin();
  // Como la Ticketera: el super admin entra en el workspace de la plataforma, no «sin workspace».
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs(RUTA, plataforma));
  await requireMovil({ onboarding: false });
  const cabecera = <CabeceraM titulo="Centro de Operaciones" padre={{ href: RUTA_MAS, label: 'More' }} />;
  if (!puedeOperar(admin, plataforma)) {
    return <PantallaM>{cabecera}<VacioM frase="Entra como super admin, con tu segundo factor, para usar el Centro." /></PantallaM>;
  }
  // La Ticketera entera (la fila de arriba de los chats, y las rutas de antes): pantalla de trabajo, como era.
  const { ticketera } = await searchParams;
  if (ticketera === 'tarjetas' || ticketera === 'lista') {
    const lectura = await leerDecisiones().catch(() => null);
    return (
      <PantallaM>
        <CabeceraM titulo="Ticketera" trabajo padre={{ href: RUTA, label: 'Centro' }} />
        <TicketeraMovil
          lectura={lectura ?? { ok: false, faltaTabla: false, error: 'no se pudieron leer' }}
          vistaInicial={ticketera} responder={responderDecision} deshacer={deshacerDecision}
        />
      </PantallaM>
    );
  }
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: los chats (de las bitácoras) se ven aunque la cola no se pueda leer.
  const [cola, estado, tarjetas, munecos] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerDecisiones().catch(() => null),
    leerMunecos(),
  ]);
  const decisiones = tarjetas?.ok ? tarjetas.decisiones : null;
  // Todas las fechas (16/10/2026): lo terminado hace rato va corto (lib/progreso-reglas.ts → pedidosDelCentro).
  const pedidos = pedidosDelCentro(areas, ahora);
  return (
    <PantallaM>
      {cabecera}
      <CentroAppMovil
        base={chatsDeBitacoras({ areas, pedidos, ahora, dias: DIAS_HISTORIAL })}
        colaInicial={cola}
        carterosIniciales={estado}
        decisionesIniciales={decisiones}
        munecosIniciales={munecos}
        pedidos={pedidos}
        ahora={ahora}
        sub={admin.sub}
        responder={responderDecision}
        tabs={nombresDeTabs()}
      />
    </PantallaM>
  );
}
