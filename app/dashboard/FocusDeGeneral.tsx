// =============================================================================
// FocusDeGeneral — la hoja «Focus» del Dashboard: lo que era /general, con su informe y sus bloques
// =============================================================================
// Desde el 17/10/2026 /general redirige acá (lib/dashboard-focus.ts explica el pedido). Este es el cuerpo de la
// página de antes, tal cual: el MISMO editor que el Dashboard con `informe="general"`, los datos de los bloques
// (app/general/datos.ts) y sus variables («{{nombre}}»). Lo único nuevo es la tira de arriba (`unido`): las hojas del
// Dashboard, que acá son links.
//
// Lo de siempre de /general (14/10/2026, Martín: «replicar lo que tenemos en dashboard… también crea templates… Los
// bloques también deberían ser editables»):
//   · EL INFORME ES OTRO: `general.informe.<sub>` (lib/graficos-tablero.ts), por persona y por workspace, con el mismo
//     compare-and-set. Quien nunca armó el suyo arranca EN BLANCO: la caja «¿Qué vas a crear hoy?» y las plantillas
//     de General (`CrearHoja`, ./NuevaHoja.tsx). Mirar no guarda nada.
//   · LOS BLOQUES DE GENERAL (lib/general-piezas.ts) son elementos del editor: el server lee sus datos con las
//     lecturas de siempre y cada bloque se dibuja en el navegador con sus opciones (app/general/ProveedorGeneral.tsx).
//
// ⚠️ LOS PEDIDOS SALEN DE `pedidosDeHoja` (./exportar.ts) con la vista vacía y la versión 0, como el Dashboard: la
//    MISMA cuenta que la pantalla, o cada gráfico se pide dos veces al abrir.
// ⚠️ En el teléfono Focus es el Today de MaKo Mobile (/m/hoy, lib/movil-rutas.ts): este editor no se ve ahí.
// =============================================================================

import type { LecturaTablero } from '@/lib/graficos-tablero';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { ocultosPorPlegado, plegadasDeEntrada } from '@/lib/graficos-secciones';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import type { HojaCorta } from '@/lib/dashboard-focus';
import { armarDatosGeneral, variablesDeQuienMira } from '../general/datos';
import { ProveedorGeneral } from '../general/ProveedorGeneral';
import { EditorInforme } from './EditorInforme';
import { pedidosDeHoja } from './exportar';
import { PLANTILLAS_GENERAL, informeGeneralInicial } from '@/lib/general-plantillas';
import { instanciarPlantilla } from '@/lib/graficos-plantillas';
import { MAX_HOJAS, type Tablero } from '@/lib/graficos-catalogo';

export async function FocusDeGeneral({ lectura, hojaPedida, plantillaPedida, hoy, hojasDashboard, senales: senalesYa }: {
  /** El informe de General (`leerInformeGeneral()`). */
  lectura: LecturaTablero;
  /** La hoja de General que se abre (null = la primera, Focus). */
  hojaPedida: string | null;
  /** Una plantilla de General pedida desde la galería del Dashboard: abre la hoja que nació de ella, o la suma. */
  plantillaPedida?: string;
  hoy: string;
  /** Las hojas del Dashboard, para la tira de arriba. */
  hojasDashboard: HojaCorta[];
  /** Lo que se sabe del negocio, si la página ya lo pidió (corre en paralelo con los informes). */
  senales?: Promise<SenalesNegocio | null>;
}) {
  // Quien nunca armó su General arranca EN BLANCO, como el Dashboard (Martín, 14/10/2026: «lo mismo que en Dashboard,
  // para un usuario nuevo, deberías proponerle un template»): la caja «¿Qué vas a crear hoy?» con las plantillas de
  // General abajo. La General de siempre viaja por dentro (la pantalla lee `hojas[0]`), no se muestra ni se guarda, y
  // la primera hoja que se crea es la ÚNICA. Un informe guardado sin hojas, igual.
  const enBlanco = lectura.estado === 'inicial' || !lectura.tablero.hojas.length || !!lectura.tablero.enBlanco;
  const base = lectura.tablero.hojas.length ? lectura.tablero : informeGeneralInicial();
  const plantilla = PLANTILLAS_GENERAL.find((p) => p.id === plantillaPedida);
  const nacida = plantilla && !enBlanco ? base.hojas.find((h) => h.plantilla === plantilla.id) : undefined;
  const agregar = plantilla && !nacida && (enBlanco || base.hojas.length < MAX_HOJAS) ? instanciarPlantilla(plantilla) : null;
  // En blanco, la pedida es la primera y ÚNICA, como en el Dashboard (app/dashboard/page.tsx).
  const tablero: Tablero = agregar && enBlanco ? { v: base.v, nombre: base.nombre, hojas: [], archivadas: base.archivadas } : base;
  const sinPaginas = enBlanco && !agregar;
  const hoja = agregar ?? nacida ?? tablero.hojas.find((h) => h.id === hojaPedida) ?? tablero.hojas[0];

  const pedidos0 = pedidosDeHoja(hoja, {}, hoy, 0, ocultosPorPlegado(hoja.componentes, plegadasDeEntrada(hoja.componentes)));
  // En blanco no se dibuja ningún gráfico: no se lee nada. Los bloques se arman igual: la plantilla que se elija los usa.
  const graficos = sinPaginas ? [] : pedidos0.graficos;
  const [datos, bloques, variables, senales] = await Promise.all([
    datosDeGraficos(graficos.map(({ pedido }) => pedido)),
    armarDatosGeneral(),
    variablesDeQuienMira(),
    // Para que la galería ponga primero sus sugeridas (lib/plantillas-sugeridas.ts). Sin IA: lo guardado.
    senalesYa ?? senalesDelNegocio().catch(() => null),
  ]);

  return (
    <ProveedorGeneral datos={bloques} variables={variables}>
      <EditorInforme
        key="general"
        inicial={tablero}
        datosIniciales={datos}
        lecturaFallo={lectura.estado === 'error'}
        hoy={hoy}
        hojaInicial={hoja.id}
        hojaAgregada={agregar}
        versionInicial={lectura.version}
        sinPaginas={sinPaginas}
        informe="general"
        senales={senales}
        unido={{ otras: hojasDashboard }}
      />
    </ProveedorGeneral>
  );
}
