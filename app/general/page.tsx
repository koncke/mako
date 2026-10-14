// =============================================================================
// /general — la casa de cada persona: el MISMO editor que el Dashboard, con su informe y sus bloques
// =============================================================================
// Martín, 14/10/2026: «La personalización que hiciste en GENERAL es nula... Mirá que tienes de donde inspirarte...
// Tenemos un constructor de landing y gráficos para poder personalizar la tab general... Que todo sea personalizable,
// intenta replicar lo que tenemos en dashboard, solo que claro, aquí no hace falta tantos gráficos y tiene otro objetivo
// la tab... también crea templates... Me imagino una que diga "Bienvenido NOMBRE"... Los bloques también deberían ser
// editables». Y en el mismo turno: «Piensa en todos los bloques que un usuario, con los diferentes funnels que tenemos
// y en general, todo lo que un usuario podría llegar a querer ver en una tab general, para hacer el editable».
//
// Así quedó (reemplaza a las «vistas» del 13/10, que eran una lista de bloques fijos):
//   · EL EDITOR ES EL DEL DASHBOARD (app/dashboard/EditorInforme.tsx con `informe="general"`): hojas, «Nueva hoja» con
//     «¿Qué vas a crear hoy?» y la galería de General (lib/general-plantillas.ts), mover y agrandar, el estilo de la
//     hoja, los filtros, los gráficos de todo el catálogo, textos, imágenes, secciones.
//   · EL INFORME ES OTRO: `general.informe.<sub>` (lib/graficos-tablero.ts), por persona y por workspace, con el mismo
//     compare-and-set. Quien nunca armó el suyo ve la General de siempre (`informeGeneralInicial`), y mirar no la guarda.
//   · LOS BLOQUES DE GENERAL (lib/general-piezas.ts) son elementos del editor: el server los arma acá con las lecturas
//     de siempre (./piezas.tsx) y viajan por contexto (app/dashboard/ElementoGeneral.tsx).
//   · LOS TEXTOS ENTIENDEN VARIABLES: «{{saludo}}, {{nombre}}» (la plantilla «Bienvenida»).
//
// ⚠️ LOS PEDIDOS SALEN DE `pedidosDeHoja` (app/dashboard/exportar.ts) con la vista vacía y la versión 0, como en
//    /dashboard: la MISMA cuenta que la pantalla, o cada gráfico se pide dos veces al abrir.
// ⚠️ `flex: 'none'` + el alto + `overflow: hidden`, LOS TRES, como /dashboard: el que scrollea es el lienzo.
// ⚠️ En el teléfono /general es el Today de MaKo Mobile (lib/movil-rutas.ts): este editor no se ve ahí.
// =============================================================================

import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerInformeGeneral } from '@/lib/graficos-tablero';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { ocultosPorPlegado, plegadasDeEntrada } from '@/lib/graficos-secciones';
import { informeGeneralInicial } from '@/lib/general-plantillas';
import { EditorInforme } from '../dashboard/EditorInforme';
import { ContextoGeneral } from '../dashboard/ElementoGeneral';
import { pedidosDeHoja } from '../dashboard/exportar';
import { armarPiezas, variablesDeQuienMira } from './piezas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GeneralPage({ searchParams }: { searchParams: Promise<{ hoja?: string | string[] }> }) {
  await requireRolWs([], { nav: 'general' });
  const hoy = hoyEnTijuana();
  const p = await searchParams;
  const pedida = Array.isArray(p.hoja) ? p.hoja[0] : p.hoja;

  const lectura = await leerInformeGeneral();
  // Un informe guardado sin hojas (las borró todas) vuelve a la General de siempre: General nunca queda en blanco.
  const tablero = lectura.tablero.hojas.length ? lectura.tablero : informeGeneralInicial();
  const hoja = tablero.hojas.find((h) => h.id === pedida) ?? tablero.hojas[0];

  const pedidos0 = pedidosDeHoja(hoja, {}, hoy, 0, ocultosPorPlegado(hoja.componentes, plegadasDeEntrada(hoja.componentes)));
  const [datos, armadas, variables] = await Promise.all([
    datosDeGraficos(pedidos0.graficos.map(({ pedido }) => pedido)),
    armarPiezas(),
    variablesDeQuienMira(),
  ]);

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <ContextoGeneral piezas={armadas.piezas} variables={variables} funnels={armadas.funnels}>
        <EditorInforme
          inicial={tablero}
          datosIniciales={datos}
          lecturaFallo={lectura.estado === 'error'}
          hoy={hoy}
          hojaInicial={hoja.id}
          versionInicial={lectura.version}
          informe="general"
        />
      </ContextoGeneral>
    </Pagina>
  );
}
