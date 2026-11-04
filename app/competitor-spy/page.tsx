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
import { piezasAction } from './actions';
import { listarCompetidores, resumenDePiezas } from '@/lib/spy';
import { sugeridosDelNegocio } from '@/lib/spy-sugeridos-server';
import { requireRolWs } from '@/lib/tab-access';
import { tabEnCapa } from '@/lib/capas';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// «Revisar ahora» es lo más caro de esta tab y se le fue sumando trabajo: lee Instagram por
// Apify (que puede tardar varios segundos), lee el canal de YouTube paginando hasta cuatro
// veces, y desde el 2/11/2026 además BAJA las imágenes —la foto de perfil, hasta 4 s, y las
// miniaturas de las piezas, con un presupuesto propio de 9 s (lib/spy-miniaturas.ts)—.
// Sumado puede pasar el default corto, y el corte llega DESPUÉS de haber leído: el usuario
// vería un error sobre una lectura que en realidad salió bien, y volvería a apretar, gastando
// otra vez la cuota de Apify. Mismo criterio que /crm y /copywriter.
export const maxDuration = 60;

export default async function CompetitorSpyPage({ searchParams }: { searchParams: Promise<{ competidor?: string }> }) {
  await requireRolWs([], { nav: 'market-an' });
  const pedido = Number((await searchParams).competidor);
  const abierto = Number.isInteger(pedido) && pedido > 0 ? pedido : null;
  // ⚠️ TODO EN PARALELO, Y LAS PIEZAS DEL QUE SE ABRE YA DESDE ACÁ (4/11/2026, Martín: «que cargue más rápido»). Antes eran cuatro
  // lecturas una detrás de otra, y las piezas recién se pedían después de hidratar, por una action (que además hace fila con las
  // demás). Con el `?competidor=` en la URL, la ficha llega con lo suyo y dibuja sin esperar otra vuelta.
  const [r, resumen, sugeridos, rol, ws, delAbierto, capa] = await Promise.all([
    listarCompetidores().catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) })),
    resumenDePiezas().catch(() => ({})),
    sugeridosDelNegocio().catch(() => []),
    getRolWsEfectivo(),
    getWorkspaceActual(),
    abierto ? piezasAction(abierto).catch(() => null) : Promise.resolve(null),
    getCapaActual(),
  ]);
  const esAdmin = rol === 'admin';
  return (
    <SpyApp
      iniciales={r.ok ? r.competidores : []}
      resumenInicial={resumen}
      abierto={abierto}
      piezasIniciales={abierto && delAbierto?.ok ? { id: abierto, piezas: delAbierto.piezas } : null}
      errorInicial={r.ok ? null : r.error}
      puedeBorrar={esAdmin}
      ws={ws}
      sugeridosIniciales={sugeridos}
      // La vista previa de sus páginas es la ruta del Diagnóstico del Web Generator, con SU puerta: el admin y esa tab en el plan.
      conVistaPrevia={esAdmin && tabEnCapa('landing-writer', capa)}
    />
  );
}
