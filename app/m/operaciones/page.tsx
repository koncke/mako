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
// Las cuentas y sus dispositivos del Uso (CuentasYDispositivos.tsx): el mismo dibujo que «Tus cuentas de IA».
import '@/app/integraciones/tus-cuentas-ia.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { areasDeProgreso } from '@/lib/progreso';
import { DIAS_HISTORIAL, pedidosDeLaCarga, pedidosDelCentro } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { leerMunecos } from '@/lib/centro-munecos-db';
import { leerAbiertas } from '@/lib/centro-preguntas-chat-db';
import { leerCuentasConNombre } from '@/lib/centro-titulares-db';
import { leerUltimosTurnos } from '@/lib/centro-turnos-db';
import { leerYaVistosDe } from '@/lib/centro-ya-vistos-db';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import { CentroAppMovil } from './CentroAppMovil';
import { TicketsMovil } from './TicketeraMovil';
import type { DatosCentro } from '@/app/admin/operaciones/useCentro';
import { indiceDeTabs, nombresDeTabs } from '@/app/admin/operaciones/tabs';
import { responderDecision } from '@/app/admin/runway/acciones';
// La Ticketera vive adentro del Centro (16/10/2026): sus hojas las importa la página.
import '@/app/tickets/bandeja/bandeja.css';
import '@/app/tickets/decisiones/mazo.css';
import '@/app/tickets/decisiones/vistas.css';
import '@/app/admin/runway/decisiones.css';

export const dynamic = 'force-dynamic';

const RUTA = '/m/operaciones';

export default async function CentroOperacionesMovil({ searchParams }: { searchParams: Promise<{ ticketera?: string; grupo?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const plataforma = await wsSuperAdmin();
  // Como la Ticketera: el super admin entra en el workspace de la plataforma, no «sin workspace».
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs(RUTA, plataforma));
  // Mirando a un CLIENTE, el Centro de la plataforma no se dibuja (23/10/2026, «estas cruzando workspace»): su «Tus cuentas de
  // IA» leería el negocio de la pestaña. Va al Ops Center de ese cliente, como en la computadora (app/admin/operaciones/page.tsx).
  if (ctx?.impersonando) redirect(await rutaConWs('/m/second-brain'));
  await requireMovil({ onboarding: false });
  // Sin «volver» desde el 21/10/2026: el Centro es el lugar del medio de la barra del super admin (una raíz, no una fila de More).
  const cabecera = <CabeceraM titulo="Ops Center" padre={null} />;
  if (!puedeOperar(admin, plataforma)) {
    return <PantallaM>{cabecera}<VacioM frase="Entra como super admin, con tu segundo factor, para usar el Centro." /></PantallaM>;
  }
  // `?ticketera=` abre LA Ticketera —los tickets de los usuarios—. `tarjetas` y `lista` eran las preguntas de los chats (se
  // sacaron el 17/10/2026: se contestan en el chat que las hizo): un link viejo abre los tickets.
  const { ticketera, grupo } = await searchParams;
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: los chats (de las bitácoras) se ven aunque la cola no se pueda leer.
  const [cola, estado, tarjetas, munecos, abiertas, cuentas, ultimos, yaVistos] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerDecisiones().catch(() => null),
    leerMunecos(),
    leerAbiertas(),
    leerCuentasConNombre(),
    leerUltimosTurnos(ahora),
    // El ✓ de cada «Completado» CON la carga (23/10/2026): sin él, la primera pintada decía otra cosa que la del refresco.
    leerYaVistosDe(),
  ]);
  const decisiones = tarjetas?.ok ? tarjetas.decisiones : null;
  // Todas las fechas (16/10/2026): lo terminado hace rato va corto (lib/progreso-reglas.ts → pedidosDelCentro).
  const pedidos = pedidosDelCentro(areas, ahora);
  const datos: DatosCentro = {
    base: chatsDeBitacoras({ areas, pedidos, ahora, dias: DIAS_HISTORIAL }),
    colaInicial: cola,
    carterosIniciales: estado,
    decisionesIniciales: decisiones,
    munecosIniciales: munecos,
    preguntasAbiertasIniciales: abiertas,
    cuentasIniciales: cuentas,
    ultimosIniciales: ultimos,
    yaVistosIniciales: yaVistos,
    // Lo terminado viejo se pide al abrir su chat, como en la computadora (pedidosDeLaCarga).
    pedidos: pedidosDeLaCarga(pedidos, ahora),
    ahora,
    sub: admin.sub,
    responder: responderDecision,
    tabs: nombresDeTabs(),
    indiceTabs: indiceDeTabs(),
  };
  // Los tickets de los usuarios necesitan el motor del Centro entero: «Aprobar» le firma el ticket al chat «Cerebro».
  if (ticketera === 'tickets' || ticketera === 'tarjetas' || ticketera === 'lista') {
    return (
      <PantallaM>
        <CabeceraM titulo="Ticketera" trabajo padre={{ href: RUTA, label: 'Centro' }} />
        <TicketsMovil {...datos} />
      </PantallaM>
    );
  }
  return (
    <PantallaM>
      {cabecera}
      {/* `?grupo=`: el push de un aviso abre ahí el grupo (lib/movil-rutas.ts). */}
      <CentroAppMovil {...datos} grupoInicial={grupo && /^\d{1,15}$/.test(grupo) ? Number(grupo) : null} />
    </PantallaM>
  );
}
