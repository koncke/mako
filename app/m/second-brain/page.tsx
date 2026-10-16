// =============================================================================
// /m/second-brain — «Second Brain» en el teléfono: buscar un dato, mirar tu negocio y subirle algo
// =============================================================================
// La tab de escritorio (app/second-brain) es una pantalla oscura con el mapa (Grafo.tsx), la barra
// «Buscar un dato» arriba del lienzo y, al costado, la columna «Tu negocio»: los dos accesos (Tu Norte,
// Tu cuello de botella) y las cinco carpetas (Negocio · Oferta · Mercado · Mensaje · Funnel) con sus
// áreas y su conteo, o «falta». Ésta la DESTILA en ese orden: el buscador, el mapa en chico (la misma
// foto, las mismas posiciones), «Tu negocio» y las carpetas con sus áreas.
//
// Referencias: Obsidian para el teléfono (la búsqueda arriba, el explorador por carpetas, la nota que se
// abre con sus propiedades y sus enlaces) y Notion para el teléfono (la página abierta como hoja, las
// propiedades como filas nombre → valor, el «+» arriba a la derecha para capturar). El mapa chico es una
// isla oscura, como el lienzo de escritorio: `data-tema="oscuro"` redefine los TOKENS en esa caja.
//
// Lo que se hace acá: buscar (por nombre o en todo, y con MaKo, la misma ruta de escritorio
// /api/second-brain/buscar), abrir un área y un dato (sus datos, lo que MaKo explica, de dónde salió y
// con qué se conecta), mirar un documento y SUBIRLE algo al Archivero (un archivo, una foto o una web:
// las mismas rutas de escritorio, lib/archivero-subida.ts). Editar cada área, el mapa entero, Exportar y
// Claude: en la computadora.
//
// Quién: la regla del Sidebar para `second-brain` (sólo el admin), y cada ruta del Archivero vuelve a
// mirarlo (`resolverWsAdmin`). ⚠️ El workspace es el del request: `construirCerebro()` lee con
// getSetting/getTenantDb. `?area=` (y `?vista=`) son las claves de escritorio (QUERY_DE_SECCION): un link
// de otra pantalla (`rutaSeccion`) abre esa área.
// =============================================================================

import './second-brain.css';
import { requireMovil } from '@/lib/movil-guard';
import { construirCerebro } from '@/lib/cerebro-grafo';
import type { Cerebro } from '@/lib/cerebro-modelo';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { SecondBrainM } from './SecondBrainM';
import { areaDeParam } from './modelo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function SecondBrainPagina({ searchParams }: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  await requireMovil({ navKey: 'second-brain' });
  const sp = await searchParams;

  let cerebro: Cerebro;
  try {
    cerebro = await construirCerebro();
  } catch (e) {
    console.error('[m/second-brain] construirCerebro:', e instanceof Error ? e.message : e);
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
