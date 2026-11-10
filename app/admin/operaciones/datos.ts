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
import { DIAS_HISTORIAL, pedidosDeLaCarga, pedidosDelCentro } from '@/lib/progreso-reglas';
import { chatsDeBitacoras } from '@/lib/centro-chats';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { leerMunecos } from '@/lib/centro-munecos-db';
import { leerAbiertas } from '@/lib/centro-preguntas-chat-db';
import { leerCuentasConNombre } from '@/lib/centro-titulares-db';
import { leerUltimosTurnos } from '@/lib/centro-turnos-db';
import { leerYaVistosDe } from '@/lib/centro-ya-vistos-db';
import { deshacerDecision, responderDecision } from '@/app/admin/runway/acciones';
import { indiceDeTabs, nombresDeTabs } from './tabs';
import type { DatosCentro } from './useCentro';

export async function datosDelCentroSiOpera(): Promise<DatosCentro | null> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return null;
  const ahora = Date.now();
  const areas = areasDeProgreso();
  // Cada lectura falla sola: los chats (de las bitácoras) se ven aunque la cola no se pueda leer.
  const [cola, carteros, tarjetas, munecos, abiertas, cuentas, ultimos, yaVistos] = await Promise.all([
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
  const pedidos = pedidosDelCentro(areas, ahora);
  return {
    base: chatsDeBitacoras({ areas, pedidos, ahora, dias: DIAS_HISTORIAL }),
    colaInicial: cola,
    carterosIniciales: carteros,
    decisionesIniciales: tarjetas?.ok ? tarjetas.decisiones : null,
    munecosIniciales: munecos,
    preguntasAbiertasIniciales: abiertas,
    cuentasIniciales: cuentas,
    ultimosIniciales: ultimos,
    yaVistosIniciales: yaVistos,
    // La lista se arma con TODOS (arriba); a la pantalla viaja lo sin terminar y lo terminado reciente: lo viejo de un chat se
    // pide al abrirlo (lib/progreso-reglas.ts → pedidosDeLaCarga; eran 733 KB en cada carga).
    pedidos: pedidosDeLaCarga(pedidos, ahora),
    ahora,
    sub: admin.sub,
    tabs: nombresDeTabs(),
    indiceTabs: indiceDeTabs(),
    responder: responderDecision,
    deshacer: deshacerDecision,
  };
}
