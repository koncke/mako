// =============================================================================
// /customer-success — Clients: la cartera del programa
// =============================================================================
// La pregunta que contesta, en el orden en que le importa a Mauricio el lunes a
// la mañana: ¿a quién le toca que YO haga algo, quién se quedó, y en qué bloque
// va cada uno.
//
// Reemplaza al script de terminal: emitir, rotar y revocar el link del cliente
// se hace desde acá, con las mismas reglas del share (ver ./actions.ts).

import { cartera } from '@/lib/cs-cartera';
import { TOTAL_CLASES } from '@/lib/programa-catalogo';
import { whopConfigurado } from '@/lib/whop';
import { esWorkspaceDueno } from '@/lib/workspace';
import { ComingSoon } from '@/app/_components/ComingSoon';
import { ClientesApp } from './ClientesApp';
import { tableroDeLaCartera } from './trabajo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clients · Customer Success' };

export default async function CustomerSuccessPage() {
  // ⚠️ MIENTRAS SE CONSTRUYE, solo el workspace de Mauricio. Va en POSITIVO
  // («solo el dueño»), no «cualquiera menos X»: la condición negativa deja
  // entrar a cada cliente nuevo sin que nada avise.
  //
  // No contradice la regla de que nada se construye owner-only: el programa, el
  // catálogo y el bucle SON workspace-aware desde el primer día. Lo que todavía
  // no existe es el temario de OTRO consultor —hoy las 44 clases son el sistema
  // de Mauricio, no un molde vacío—, así que un cliente que entrara vería el
  // material de él. Cuando el programa sea por workspace, se cae este guard.
  //
  // Y va ANTES de las consultas: un workspace que no lo va a ver no paga la
  // cartera ni el ping a Whop.
  if (!(await esWorkspaceDueno())) return <ComingSoon title="Customer Success" icon="cs" />;

  const [clientes, whop] = await Promise.all([
    cartera().catch(() => []),
    whopConfigurado().catch(() => false),
  ]);

  // El TABLERO de cada uno: cuántos proyectos, tareas y recurrentes tiene. Sólo los
  // números — el detalle lo pide la ficha al abrirse (./actions.ts).
  //
  // ⚠️ SE CRUZA CONTRA LA CARTERA ENTERA, no cliente por cliente. El cruce blando
  // decide si una palabra distingue a alguien mirando a TODOS; con la lista recortada,
  // cualquier palabra sería única y le metería a un cliente el trabajo de otro.
  //
  // ⚠️ Y SI FALLA, FALLA VISIBLE. `tableroDeLaCartera` devuelve `{ok:false, error}` en
  // vez de una lista vacía: «no pude leer el tablero» y «nadie tiene trabajo cargado»
  // son dos pantallas, y la segunda sobre la primera no la audita nadie.
  const tablero = await tableroDeLaCartera(
    clientes.map((c) => ({ leadId: c.leadId, nombre: c.nombre, empresa: c.empresa })),
  ).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No pude leer el tablero.' }));

  return <ClientesApp clientes={clientes} totalClases={TOTAL_CLASES} whopConectado={whop} tablero={tablero} />;
}
