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
import { pedidosRecientes, recortarPedido } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import { CentroAppMovil } from './CentroAppMovil';

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
    return <PantallaM>{cabecera}<VacioM frase="Entra como super admin, con tu segundo factor, para usar el Centro." /></PantallaM>;
  }
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: los chats (de las bitácoras) se ven aunque la cola no se pueda leer.
  const [cola, estado, tarjetas] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerDecisiones().catch(() => null),
  ]);
  const decisiones = tarjetas?.ok ? tarjetas.decisiones.map((d) => ({ chat: d.chat, destino: d.destino ?? null, respuesta: d.respuesta })) : null;
  const pedidos = pedidosRecientes(areas, ahora, 14).map(recortarPedido);
  return (
    <PantallaM>
      {cabecera}
      <CentroAppMovil
        base={chatsDeBitacoras({ areas, pedidos, ahora })}
        colaInicial={cola}
        carterosIniciales={estado}
        decisionesIniciales={decisiones}
        pedidos={pedidos}
        ahora={ahora}
        sub={admin.sub}
      />
    </PantallaM>
  );
}
