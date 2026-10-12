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
//
// Desde el 11/10/2026 (Closing, Ads y Landing Analyst se retiraron de la sidebar y traen acá):
//   · `?hoja=` se resuelve con `hojaDestino` (lib/graficos-plantillas.ts): el id exacto, la hoja que
//     tiene la firma de la plantilla pedida, o la plantilla AGREGADA al informe (EditorInforme la suma
//     y la guarda). Antes caía en la primera hoja sin avisar.
//   · EL CLOSER entra (decisión 6 de Martín) y ve SÓLO la hoja Closing: un informe EN MEMORIA con la
//     plantilla de ids fijos, sin editar ni guardar (`soloLectura`). No se lee su informe guardado: no
//     tiene uno que pueda tocar. /api/graficos le contesta sólo lo de Closing.
//   · `?llamada=<recording_id>` abre la ficha de esa llamada (la ruta vieja era /closing?call=).
//
// TANDA v5 (12/10/2026):
//   · LA VERSIÓN de lo que se leyó (`leerTablero().version`) baja a la pantalla: el autoguardado la manda y la
//     ruta escribe con compare-and-set (lib/graficos-tablero.ts). El closer no guarda: null.
//   · Lo que arranca PLEGADO (una sección con «Arranca plegada», lib/graficos-secciones.ts) no se pide en la
//     primera pintada: se pide al abrirse (`pedidosDeHoja` con `ocultos`, la MISMA cuenta que la pantalla).

import { redirect } from 'next/navigation';
import { Pagina } from '@/app/_ui';
import { homeDeCapa, requireRolWs } from '@/lib/tab-access';
import { getCapaActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerTablero } from '@/lib/graficos-tablero';
import { hojaDestino, informeCloser, llamadaDeUrl } from '@/lib/graficos-plantillas';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { datosDeBloques } from '@/lib/graficos-bloques';
import type { Hoja, Tablero } from '@/lib/graficos-catalogo';
import { ocultosPorPlegado, plegadasDeEntrada } from '@/lib/graficos-secciones';
import { EditorInforme } from './EditorInforme';
import { pedidosDeHoja } from './exportar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Busqueda = { hoja?: string | string[]; llamada?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requireRolWs(['closer'], { nav: 'graphics' });
  // Cacheado por request (lib/auth.ts): no es una consulta más.
  const closer = (await getRolWsEfectivo()) === 'closer';
  if (closer) {
    // Lo único que el closer ve acá es Closing: si su negocio no lo compró, esto no es para él.
    const capa = await getCapaActual();
    if (!tabEnCapa('closing', capa)) redirect(await rutaConWs(homeDeCapa(capa)));
  }

  const hoy = hoyEnTijuana();
  const p = await searchParams;
  const pedida = Array.isArray(p.hoja) ? p.hoja[0] : p.hoja;
  const llamada = llamadaDeUrl(p.llamada);

  let tablero: Tablero;
  let lecturaFallo = false;
  let version: string | null = null;
  let hoja: Hoja;
  let agregar: Hoja | null = null;
  let lleno = false;
  if (closer) {
    tablero = informeCloser();
    hoja = tablero.hojas[0];
  } else {
    const lectura = await leerTablero();
    tablero = lectura.tablero;
    lecturaFallo = lectura.estado === 'error';
    version = lectura.version;
    const destino = hojaDestino(tablero, pedida);
    agregar = destino.agregar;
    lleno = !!destino.lleno;
    hoja = agregar ?? tablero.hojas.find((h) => h.id === destino.hojaId) ?? tablero.hojas[0];
  }
  const { graficos, bloques } = pedidosDeHoja(hoja, {}, hoy, 0, ocultosPorPlegado(hoja.componentes, plegadasDeEntrada(hoja.componentes)));
  // El período va TAL CUAL: el corte en hoy (y la fecha que mira hacia adelante) lo decide `datosDeGraficos`
  // (contrato v5, «el corte en hoy en UN lugar»). La firma sale del período que pidió el gráfico.
  const [datos, datosBloque] = await Promise.all([
    datosDeGraficos(graficos.map(({ pedido }) => pedido)),
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
        inicial={tablero}
        datosIniciales={datos}
        bloquesIniciales={datosBloque}
        lecturaFallo={lecturaFallo}
        hoy={hoy}
        hojaInicial={hoja.id}
        versionInicial={version}
        hojaAgregada={agregar}
        aviso={lleno ? 'Máximo de hojas' : null}
        soloLectura={closer}
        llamadaInicial={llamada}
      />
    </Pagina>
  );
}
