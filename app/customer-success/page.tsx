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
import { ClientesApp } from './ClientesApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clients · Customer Success' };

export default async function CustomerSuccessPage() {
  const [clientes, whop] = await Promise.all([
    cartera().catch(() => []),
    whopConfigurado().catch(() => false),
  ]);
  return <ClientesApp clientes={clientes} totalClases={TOTAL_CLASES} whopConectado={whop} />;
}
