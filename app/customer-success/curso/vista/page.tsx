// /customer-success/curso/vista — RUTA VIEJA: redirige a Clients con su query (ver ../../a-clients.ts y docs/diseno-clients.md, D2).
import { aClients } from '../../a-clients';

export const dynamic = 'force-dynamic';

export default async function RutaVieja({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return aClients('/customer-success/curso/vista', searchParams);
}
