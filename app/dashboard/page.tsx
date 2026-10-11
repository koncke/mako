// =============================================================================
// /dashboard — la tab Dashboard: el editor de informes, de punta a punta
// =============================================================================
// Pedido de Martín (11/10/2026): «Elimina las tab de Marketing y Comercial que hay por
// defecto... Todo la tab de Dashboard debe ser el editable, no lo pongas como un recuadro
// abajo. Elimina la topbar, el título de la tab...». Marketing y Comercial son ahora las dos
// HOJAS del informe inicial, y sus rutas viejas traen acá con `?hoja=` (app/marketing/page.tsx,
// app/comercial/page.tsx).
//
// El catálogo está en lib/graficos-catalogo.ts, el lector en lib/graficos-datos.ts, los bloques en
// lib/graficos-bloques.ts y el informe de cada persona en lib/graficos-tablero.ts. Acá sólo se arma
// la primera pintada: el informe y los datos de la hoja que se abre, en el server, así la pantalla
// abre llena.
//
// ⚠️ LOS PEDIDOS SALEN DE `pedidosDeHoja` (./exportar.ts), la MISMA función que usa la pantalla, con
//    la vista vacía y la versión 0. Si esto armara los suyos, la firma de lo que ya llegó no coincidiría
//    con la de la pantalla y cada gráfico se pediría dos veces al abrir.

import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerTablero } from '@/lib/graficos-tablero';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { datosDeBloques } from '@/lib/graficos-bloques';
import { EditorInforme } from './EditorInforme';
import { pedidosDeHoja } from './exportar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ hoja?: string }> }) {
  await requireRolWs([], { nav: 'graphics' });

  const hoy = hoyEnTijuana();
  const p = await searchParams;
  const lectura = await leerTablero();
  const hoja = lectura.tablero.hojas.find((h) => h.id === p.hoja) ?? lectura.tablero.hojas[0];
  const { graficos, bloques } = pedidosDeHoja(hoja, {}, hoy, 0);
  // Como en /api/graficos: un período que termina después de hoy se acota a hoy (la firma no cambia,
  // porque sale del período que pidió el gráfico, no del acotado).
  const acotar = (desde: string, hasta: string) => (hasta > hoy ? (hoy < desde ? desde : hoy) : hasta);
  const [datos, datosBloque] = await Promise.all([
    datosDeGraficos(graficos.map(({ pedido }) => ({ ...pedido, hasta: acotar(pedido.desde, pedido.hasta) }))),
    datosDeBloques(bloques.map(({ pedido }) => pedido)),
  ]);

  return (
    // ⚠️ `flex: 'none'` + el alto + `overflow: hidden`, LOS TRES. Pagina trae `flex: 1` (base 0%), que en
    // la columna del layout ANULA el `height`: el <main> se estiraba a su contenido (2405 px medidos), el
    // que scrolleaba era el documento y la barra de controles —sticky contra .lk-lienzo— se iba con la
    // página (y = -1079 tras la rueda). Con esto el que scrollea es .lk-lienzo y la barra queda en y = 46.
    // `dvh` y no `vh`: en el celular, 100vh incluye la barra del navegador y el pie queda abajo de ella.
    // El PDF lo desarma en el @media print de ./editor-css.ts.
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <EditorInforme
        inicial={lectura.tablero}
        datosIniciales={datos}
        bloquesIniciales={datosBloque}
        lecturaFallo={lectura.estado === 'error'}
        hoy={hoy}
        hojaInicial={hoja.id}
      />
    </Pagina>
  );
}
