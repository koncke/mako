import 'server-only';

// =============================================================================
// Lo que el Centro lee para montarse en OTRA página: hoy, /second-brain (17/10/2026)
// =============================================================================
// La tanda 5 de docs/diseno-mako-ai-native.md: Martín le escribe a sus chats de Claude Code desde el Second Brain
// («quiero mandar prompts por MaKo en el Second Brain», 17/10/2026). La pantalla monta el mismo motor que el Centro
// (useCentro.ts) con lo que devuelve esto.
//
// ⚠️ LA GUARDA VA ADENTRO, ANTES DE LEER NADA: una fila de la cola es un prompt que corre en la PC de Martín. Quien no
//    `puedeOperar` (super admin, en el workspace de la plataforma, con sesión con fila y segundo factor) recibe null y
//    no se lee nada: lo que no se ve no viaja (tests/operaciones.test.ts). Las dos páginas del Centro leen lo mismo en
//    su propio cuerpo, con la guarda arriba: el test las mira ahí.
// ⚠️ No se espera a Vercel: los pushes los pide la pantalla después de dibujar (useCentro.ts).

import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import { areasDeProgreso } from '@/lib/progreso';
import { DIAS_HISTORIAL, pedidosDelCentro } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { leerMunecos } from '@/lib/centro-munecos-db';
import { deshacerDecision, responderDecision } from '@/app/admin/runway/acciones';
import { nombresDeTabs } from './tabs';
import type { DatosCentro } from './useCentro';

export async function datosDelCentroSiOpera(): Promise<DatosCentro | null> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return null;
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: los chats (de las bitácoras) se ven aunque la cola no se pueda leer.
  const [cola, carteros, tarjetas, munecos] = await Promise.all([
    listarPedidos().catch(() => null),
    leerCarteros().catch(() => null),
    leerDecisiones().catch(() => null),
    leerMunecos(),
  ]);
  const pedidos = pedidosDelCentro(areas, ahora);
  return {
    base: chatsDeBitacoras({ areas, pedidos, ahora, dias: DIAS_HISTORIAL }),
    colaInicial: cola,
    carterosIniciales: carteros,
    decisionesIniciales: tarjetas?.ok ? tarjetas.decisiones : null,
    munecosIniciales: munecos,
    pedidos,
    ahora,
    sub: admin.sub,
    tabs: nombresDeTabs(),
    responder: responderDecision,
    deshacer: deshacerDecision,
  };
}
