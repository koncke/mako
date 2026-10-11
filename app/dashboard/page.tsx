// =============================================================================
// /dashboard — la tab Dashboard: el editor de informes, de punta a punta
// =============================================================================
// Pedido de Martín (11/10/2026): «Elimina las tab de Marketing y Comercial que hay por
// defecto... Todo la tab de Dashboard debe ser el editable, no lo pongas como un recuadro
// abajo. Elimina la topbar, el título de la tab, el filtro de fecha (que eso cada uno lo va a
// agregar si quiere...)». Marketing y Comercial son ahora las dos HOJAS del informe inicial, y
// sus rutas viejas traen acá con `?hoja=` (app/marketing/page.tsx, app/comercial/page.tsx).
//
// El catálogo está en lib/graficos-catalogo.ts, el lector en lib/graficos-datos.ts y el
// informe de cada persona en lib/graficos-tablero.ts. Acá sólo se arma la primera pintada: el
// informe y los datos de la hoja que se abre, en el server, así la pantalla abre llena.

import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerTablero } from '@/lib/graficos-tablero';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { esGrafico, rangoDeGrafico } from '@/lib/graficos-catalogo';
import { EditorInforme } from './EditorInforme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ hoja?: string }> }) {
  await requireRolWs([], { nav: 'graphics' });

  const hoy = hoyEnTijuana();
  const p = await searchParams;
  const lectura = await leerTablero();
  const hoja = lectura.tablero.hojas.find((h) => h.id === p.hoja) ?? lectura.tablero.hojas[0];
  const datos = await datosDeGraficos(
    hoja.componentes.filter(esGrafico).map((g) => ({ grafico: g, ...rangoDeGrafico(g, hoja, hoy) })),
  );

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <EditorInforme
        inicial={lectura.tablero}
        datosIniciales={datos}
        lecturaFallo={lectura.estado === 'error'}
        hoy={hoy}
        hojaInicial={hoja.id}
      />
    </Pagina>
  );
}
