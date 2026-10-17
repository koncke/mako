// =============================================================================
// /m/second-brain/mapa — el Mapa del Second Brain en el teléfono (sólo el admin de la tab)
// =============================================================================
// Desde el 16/10/2026 /m/second-brain es el chat con MaKo (como en escritorio), y lo que era esa pantalla —el buscador,
// el mapa en chico, las carpetas y el Archivero (SecondBrainM.tsx, que explica sus referencias)— es el «Mapa», que se
// abre desde la hoja «Tus chats». Es su propia ruta para que cada página tenga UNA forma: el chat no se refresca tirando
// hacia abajo (es ver mensajes viejos) y el Mapa sí.
//
// Quién: la regla del Sidebar para `second-brain` (sólo el admin, y la capa), y cada ruta del Archivero vuelve a
// mirarlo (`resolverWsAdmin`). `?area=` (y `?vista=`) son las claves de escritorio: un link de otra pantalla abre esa área.

import '../second-brain.css';
import { requireMovil } from '@/lib/movil-guard';
import { construirCerebro } from '@/lib/cerebro-grafo';
import type { Cerebro } from '@/lib/cerebro-modelo';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { SecondBrainM } from '../SecondBrainM';
import { areaDeParam } from '../modelo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function MapaSecondBrainPagina({ searchParams }: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  await requireMovil({ navKey: 'second-brain' });
  const sp = await searchParams;

  let cerebro: Cerebro;
  try {
    cerebro = await construirCerebro();
  } catch (e) {
    console.error('[m/second-brain/mapa] construirCerebro:', e instanceof Error ? e.message : e);
    return (
      <PantallaM>
        <ErrorM frase="No pude leer tu Second Brain. No es nada tuyo." />
        <ComputadoraM que="El mapa, Exportar y Claude" />
      </PantallaM>
    );
  }

  return (
    <PantallaM>
      <SecondBrainM cerebro={cerebro} areaInicial={areaDeParam(sp.area)} />
      <ComputadoraM que="El mapa, Exportar y Claude" />
    </PantallaM>
  );
}
