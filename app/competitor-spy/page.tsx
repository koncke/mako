// Competitor Spy — antes se llamaba «Market Analyst» y vivía entre los Analysts.
// Salió de ahí: no analiza un activo propio como los otros seis (una oferta, un
// anuncio, una landing), sino que VIGILA lo que hacen los demás. La `nav` key
// sigue siendo 'market-an' porque está escrita en la base.
//
// ⚠️ ENTRA DIRECTO. Sin puerta y sin wizard (Martín, 31/10/2026: «nada debe tener
// onboarding»; ninguno de los once productos medidos tapa la pantalla con uno).
// Lo que el wizard pedía ahora es la pantalla: un campo arriba, y pegar te lleva a
// la ficha. Los pasos del catálogo los marca el acto (lib/spy-actos.ts).

import { SpyApp } from './SpyApp';
import { listarCompetidores, resumenDePiezas } from '@/lib/spy';
import { requireRolWs } from '@/lib/tab-access';
import { getRolWsEfectivo } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function CompetitorSpyPage({ searchParams }: { searchParams: Promise<{ competidor?: string }> }) {
  await requireRolWs([], { nav: 'market-an' });
  const r = await listarCompetidores().catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  const resumen = await resumenDePiezas().catch(() => ({}));
  const pedido = Number((await searchParams).competidor);
  // Quién puede BORRAR. Cualquiera mira y agrega; borrar se lleva puestas todas las piezas
  // leídas por el equipo (`on delete cascade`, 0359) y no se deshace, así que es del admin.
  const esAdmin = (await getRolWsEfectivo()) === 'admin';
  return (
    <SpyApp
      iniciales={r.ok ? r.competidores : []}
      resumenInicial={resumen}
      abierto={Number.isInteger(pedido) && pedido > 0 ? pedido : null}
      errorInicial={r.ok ? null : r.error}
      puedeBorrar={esAdmin}
    />
  );
}
